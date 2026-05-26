/**
 * Service Worker：
 * - 缓存登录与偏好快照供 content/popup 同步获取
 * - 转发 content 的翻译请求到后端（带 token）
 * - 处理 SSE 翻译流：service-worker 维护 fetch stream，再把事件转发给对应 content tab
 */

import { authApi } from '../shared/api/auth';
import { streamTranslation } from '../shared/api/sse';
import { translationApi } from '../shared/api/translation';
import { storageGet, storageGetMany, storageRemove } from '../shared/storage/chrome-storage';
import { LOCAL_KEYS, SYNC_KEYS } from '../shared/storage/keys';

import type { BgMessage, SettingsResponse, StreamEnvelope } from './messages';
import type { TranslateBatchRequest } from '@translator/shared-types';

const activeStreams = new Map<string, AbortController>();

/** 用户登录状态快照，避免每次都打后端 */
async function getSettings(): Promise<SettingsResponse> {
  const [accessToken, prefs] = await Promise.all([
    storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN),
    storageGetMany<Record<string, unknown>>('sync', Object.values(SYNC_KEYS)),
  ]);

  let tier: SettingsResponse['tier'] = 'free';
  if (accessToken) {
    try {
      const user = await authApi.me();
      tier = user.tier;
    } catch {
      // token 失效，清理
      await storageRemove('local', [LOCAL_KEYS.ACCESS_TOKEN, LOCAL_KEYS.REFRESH_TOKEN]);
    }
  }

  return {
    enabled: (prefs[SYNC_KEYS.ENABLED] as boolean | undefined) ?? true,
    autoPrompt: (prefs[SYNC_KEYS.AUTO_PROMPT] as boolean | undefined) ?? true,
    selectTranslate: (prefs[SYNC_KEYS.SELECT_TRANSLATE] as boolean | undefined) ?? false,
    hasAuth: Boolean(accessToken),
    tier,
    currentProvider: (prefs[SYNC_KEYS.CURRENT_PROVIDER] as string | undefined) ?? 'libre-translate',
    currentModel: (prefs[SYNC_KEYS.CURRENT_MODEL] as string | undefined) ?? 'libre-translate',
    targetLang: (prefs[SYNC_KEYS.TARGET_LANG] as string | undefined) ?? 'zh-CN',
  };
}

async function startStream(
  streamId: string,
  tabId: number,
  payload: TranslateBatchRequest,
): Promise<void> {
  // 1. 创建 SSE 会话
  const { sessionId } = await translationApi.createStreamSession(payload);

  const ctrl = new AbortController();
  activeStreams.set(streamId, ctrl);

  try {
    for await (const event of streamTranslation(sessionId, ctrl.signal)) {
      const envelope: StreamEnvelope = { type: 'TRANSLATE_STREAM_EVENT', streamId, event };
      void chrome.tabs.sendMessage(tabId, envelope).catch(() => undefined);
      if (event.type === 'done' || event.type === 'error') break;
    }
  } catch (err) {
    const envelope: StreamEnvelope = {
      type: 'TRANSLATE_STREAM_EVENT',
      streamId,
      event: { type: 'error', message: (err as Error).message },
    };
    void chrome.tabs.sendMessage(tabId, envelope).catch(() => undefined);
  } finally {
    activeStreams.delete(streamId);
  }
}

chrome.runtime.onMessage.addListener((message: BgMessage, sender, sendResponse) => {
  const handler = async () => {
    switch (message.type) {
      case 'GET_SETTINGS':
        return getSettings();

      case 'TRANSLATE_BATCH':
        return translationApi.batch(message.payload);

      case 'TRANSLATE_SELECTION':
        return translationApi.selection(message.payload);

      case 'START_TRANSLATE_STREAM': {
        const tabId = sender.tab?.id;
        if (!tabId) throw new Error('未找到来源标签页');
        void startStream(message.streamId, tabId, message.payload);
        return { started: true };
      }

      case 'ABORT_TRANSLATE_STREAM': {
        const ctrl = activeStreams.get(message.streamId);
        ctrl?.abort();
        return { aborted: Boolean(ctrl) };
      }

      default:
        throw new Error(`未知消息类型: ${(message as { type: string }).type}`);
    }
  };

  handler()
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err: Error) => sendResponse({ ok: false, error: err.message }));

  return true;
});

self.addEventListener('install', () => {
  console.log('[translator] service worker installed');
});
