import { API_BASE_URL } from '../env';
import { storageGet } from '../storage/chrome-storage';
import { LOCAL_KEYS } from '../storage/keys';

import type { TranslateStreamEvent } from '@translator/shared-types';

/**
 * 通过 fetch + ReadableStream 解析 SSE，避免 EventSource 不支持自定义 header 的限制。
 * 携带 access token 于 query 上（与后端 JwtStrategy 双取兼容）。
 */
export async function* streamTranslation(
  sessionId: string,
  signal?: AbortSignal,
): AsyncIterable<TranslateStreamEvent> {
  const token = await storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN);
  const url = `${API_BASE_URL}/translation/stream/${sessionId}?token=${encodeURIComponent(token ?? '')}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`SSE 建立失败: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE 事件以 \n\n 分隔
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      // 提取 data: 开头的行（NestJS 的 @Sse 会把 data 字段 JSON 序列化为单行）
      const dataLine = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!dataLine) continue;
      try {
        const parsed = JSON.parse(dataLine) as TranslateStreamEvent;
        yield parsed;
      } catch {
        // 忽略心跳或非 JSON 行
      }
    }
  }
}
