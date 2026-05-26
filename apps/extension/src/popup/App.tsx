import {
  GlobalOutlined,
  RightOutlined,
  RocketOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Select, Switch, Tag, Tooltip, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { authApi } from '../shared/api/auth';
import { llmApi } from '../shared/api/llm';
import { storageGet } from '../shared/storage/chrome-storage';
import { LOCAL_KEYS } from '../shared/storage/keys';
import { usePrefsStore } from '../shared/store/prefs.store';
import { isChromeExtensionContext, openOptionsPage } from '../shared/utils/extension-context';
import { isInjectableTab } from '../shared/utils/tab';

/** 目标语言选项（与 chrome.storage.sync targetLang 对应） */
const TARGET_LANG_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
] as const;

interface DetectionResult {
  isEnglish: boolean;
  lang: string;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  if (!isChromeExtensionContext()) return undefined;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function detectTab(tabId: number): Promise<DetectionResult> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const sample = (document.body?.innerText ?? '').slice(0, 5000);
      let latin = 0;
      let cjk = 0;
      let total = 0;
      for (const ch of sample) {
        if (/\s/.test(ch)) continue;
        total++;
        if (/[\u4e00-\u9fff]/.test(ch)) cjk++;
        else if (/[a-zA-Z]/.test(ch)) latin++;
      }
      const lang = document.documentElement.lang?.toLowerCase() ?? '';
      const isEn =
        lang.startsWith('en') || (total > 40 && latin / total > 0.55 && cjk / total < 0.12);
      return { isEnglish: isEn, lang: lang || '未知' };
    },
  });
  return result as DetectionResult;
}

async function sendTab(tabId: number, payload: { type: string }): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, payload);
  } catch (cause) {
    throw new Error('无法与页面通信，请刷新该网页后重试', { cause });
  }
}

const TIER_LABEL = { free: '免费会员', basic: '初级会员', premium: '高级会员' } as const;

export function App() {
  const prefs = usePrefsStore();
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [tabNotInjectable, setTabNotInjectable] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN);
      if (!token) return null;
      return authApi.me().catch(() => null);
    },
  });

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ['models', user?.id, user?.tier],
    queryFn: () => llmApi.models(),
    enabled: !!user,
  });

  /** 扁平化模型列表，供 Select 分组展示 */
  const modelSelectOptions = useMemo(() => {
    if (!modelsData) return [];
    return modelsData.providers.map((p) => ({
      label: p.label,
      options: p.models.map((m) => ({
        value: m.id,
        label: m.label,
        model: m,
      })),
    }));
  }, [modelsData]);

  const currentModelLabel = useMemo(() => {
    if (!modelsData) return prefs.currentModel;
    for (const p of modelsData.providers) {
      const m = p.models.find((x) => x.id === prefs.currentModel);
      if (m) return m.label;
    }
    return prefs.currentModel;
  }, [modelsData, prefs.currentModel]);

  const initPrefs = usePrefsStore((s) => s.init);

  useEffect(() => {
    void initPrefs();
  }, [initPrefs]);

  useEffect(() => {
    void (async () => {
      const tab = await getActiveTab();
      if (!isInjectableTab(tab)) {
        setTabNotInjectable(true);
        return;
      }
      try {
        setDetection(await detectTab(tab.id));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleModelChange = async (modelId: string): Promise<void> => {
    if (!modelsData) return;
    for (const p of modelsData.providers) {
      const model = p.models.find((m) => m.id === modelId);
      if (model) {
        await prefs.patch({ currentProvider: model.providerId, currentModel: model.id });
        return;
      }
    }
  };

  const handleTranslate = async (): Promise<void> => {
    const tab = await getActiveTab();
    if (!isInjectableTab(tab)) {
      message.warning('请在普通网页（http/https）上使用');
      return;
    }
    try {
      await sendTab(tab.id, { type: 'SHOW_TRANSLATE_BAR' });
      window.close();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '发送失败');
    }
  };

  const handleDetect = async (): Promise<void> => {
    const tab = await getActiveTab();
    if (!isInjectableTab(tab)) {
      message.warning('请在普通网页（http/https）上使用');
      setTabNotInjectable(true);
      return;
    }
    setTabNotInjectable(false);
    try {
      await sendTab(tab.id, { type: 'RUN_DETECT' });
      setDetection(await detectTab(tab.id));
      message.success('检测完成');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '检测失败');
    }
  };

  const statusText = tabNotInjectable
    ? '当前标签页不支持（请切换到普通网页）'
    : detection
      ? detection.isEnglish
        ? `当前页疑似英文（${detection.lang}）`
        : `当前页可能非英文（${detection.lang}）`
      : '正在检测页面语言…';

  const statusDotClass = tabNotInjectable
    ? 'ds-popup__dot--warn'
    : detection?.isEnglish
      ? 'ds-popup__dot--en'
      : 'ds-popup__dot--other';

  const displayName = user?.nickname || user?.email?.split('@')[0] || '访客';
  const displayId = user ? `ID: ${user.id.slice(0, 8)}` : '未登录';

  return (
    <div className="ds-popup">
      {/* 顶栏：用户信息与升级入口 */}
      <header className="ds-popup__header">
        <div className="ds-popup__user">
          <span className="ds-popup__avatar">
            <UserOutlined />
          </span>
          <div className="ds-popup__user-meta">
            <div className="ds-popup__user-name">
              {displayName}
              {user && (
                <Tag
                  color={
                    user.tier === 'premium' ? 'gold' : user.tier === 'basic' ? 'blue' : 'default'
                  }
                  style={{ marginLeft: 6, fontSize: 10, lineHeight: '18px' }}
                >
                  {TIER_LABEL[user.tier]}
                </Tag>
              )}
            </div>
            <div className="ds-popup__user-id">{displayId}</div>
          </div>
        </div>
        <div className="ds-popup__header-actions">
          {user && user.tier !== 'premium' && (
            <button type="button" className="ds-popup__upgrade" onClick={openOptionsPage}>
              <RocketOutlined />
              升级
            </button>
          )}
          <Tooltip title="目标语言在下方配置">
            <button type="button" className="ds-popup__icon-btn" aria-label="语言">
              <GlobalOutlined />
            </button>
          </Tooltip>
        </div>
      </header>

      {/* 主配置卡片：语言 + 模型 + 页面状态 */}
      <section className="ds-popup__panel">
        <div className="ds-popup__lang-row">
          <Select value="auto" disabled options={[{ value: 'auto', label: '自动检测' }]} />
          <RightOutlined className="ds-popup__lang-arrow" />
          <Select
            value={prefs.targetLang}
            options={TARGET_LANG_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            onChange={(v) => {
              void prefs.patch({ targetLang: v });
            }}
          />
        </div>

        <div className="ds-popup__model-row">
          <span className="ds-popup__model-label">翻译模型</span>
          <Select
            showSearch
            optionFilterProp="label"
            loading={modelsLoading}
            disabled={!user}
            placeholder={user ? '选择模型' : '登录后可选'}
            value={user ? prefs.currentModel : undefined}
            options={modelSelectOptions}
            onChange={(v) => {
              void handleModelChange(v);
            }}
            notFoundContent={modelsLoading ? '加载中…' : '暂无可用模型'}
          />
        </div>

        <div className="ds-popup__status">
          <span className={`ds-popup__dot ${statusDotClass}`} />
          <span>{statusText}</span>
          {!user && (
            <span
              style={{ marginLeft: 'auto', color: '#3b82f6', cursor: 'pointer' }}
              onClick={openOptionsPage}
            >
              去登录
            </span>
          )}
        </div>

        {/* 未登录时在面板内展示当前默认模型名称 */}
        {!user && (
          <div className="ds-popup__status" style={{ marginTop: 6 }}>
            <span>默认模型：{currentModelLabel}</span>
          </div>
        )}
      </section>

      {/* 操作栏：辅助按钮 + 主翻译 */}
      <div className="ds-popup__actions">
        <div className="ds-popup__actions-side">
          <Tooltip title="重新检测">
            <button
              type="button"
              className="ds-popup__mini-btn"
              onClick={() => void handleDetect()}
            >
              <SearchOutlined />
            </button>
          </Tooltip>
          <Tooltip title="账户与模型设置">
            <button type="button" className="ds-popup__mini-btn" onClick={openOptionsPage}>
              <SettingOutlined />
            </button>
          </Tooltip>
        </div>
        <Button
          type="primary"
          className="ds-popup__translate-btn"
          icon={<SwapOutlined />}
          onClick={() => void handleTranslate()}
        >
          翻译当前页
        </Button>
      </div>

      {/* 功能开关 */}
      <section className="ds-popup__features">
        <div className="ds-popup__feature-row">
          <div className="ds-popup__feature-label">
            检测到英文页自动提示
            <span className="ds-popup__feature-desc">进入英文页时显示翻译横幅</span>
          </div>
          <Switch
            checked={prefs.autoPrompt}
            onChange={(v) => {
              void prefs.patch({ autoPrompt: v });
            }}
          />
        </div>
        <div className="ds-popup__feature-row">
          <div className="ds-popup__feature-label">
            划词翻译
            <span className="ds-popup__feature-desc">选中英文后弹出词典面板</span>
          </div>
          <Switch
            checked={prefs.selectTranslate}
            onChange={(v) => {
              void prefs.patch({ selectTranslate: v });
            }}
          />
        </div>
      </section>

      {/* 底栏 */}
      <footer className="ds-popup__footer">
        <button type="button" className="ds-popup__footer-btn" onClick={openOptionsPage}>
          <SettingOutlined />
          设置
        </button>
        <button type="button" className="ds-popup__footer-btn" onClick={openOptionsPage}>
          账户与模型
          <RightOutlined style={{ fontSize: 10 }} />
        </button>
      </footer>
    </div>
  );
}
