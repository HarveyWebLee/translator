import { useQuery } from '@tanstack/react-query';
import { Button, Card, Divider, message, Space, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { authApi } from '../shared/api/auth';
import { storageGet, storageGetMany, storageSet } from '../shared/storage/chrome-storage';
import { LOCAL_KEYS, SYNC_KEYS } from '../shared/storage/keys';
import { isChromeExtensionContext, openOptionsPage } from '../shared/utils/extension-context';
import { isInjectableTab } from '../shared/utils/tab';

const { Title, Text } = Typography;

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
    // content script 由 manifest 在 http(s) 页自动注入；失败多为扩展更新后未刷新的旧标签
    throw new Error('无法与页面通信，请刷新该网页后重试', { cause });
  }
}

export function App() {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  /** 当前活动标签不是 http(s)（如在 chrome://extensions 打开 popup） */
  const [tabNotInjectable, setTabNotInjectable] = useState(false);
  const [prefs, setPrefs] = useState({
    autoPrompt: true,
    selectTranslate: false,
  });

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = await storageGet<string>('local', LOCAL_KEYS.ACCESS_TOKEN);
      if (!token) return null;
      return authApi.me().catch(() => null);
    },
  });

  useEffect(() => {
    void (async () => {
      const data = await storageGetMany<Record<string, boolean | undefined>>('sync', [
        SYNC_KEYS.AUTO_PROMPT,
        SYNC_KEYS.SELECT_TRANSLATE,
      ]);
      setPrefs({
        autoPrompt: data[SYNC_KEYS.AUTO_PROMPT] !== false,
        selectTranslate: data[SYNC_KEYS.SELECT_TRANSLATE] === true,
      });
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

  const togglePref = async (key: keyof typeof prefs, val: boolean): Promise<void> => {
    setPrefs((p) => ({ ...p, [key]: val }));
    await storageSet('sync', {
      [SYNC_KEYS.AUTO_PROMPT]: key === 'autoPrompt' ? val : prefs.autoPrompt,
      [SYNC_KEYS.SELECT_TRANSLATE]: key === 'selectTranslate' ? val : prefs.selectTranslate,
    });
  };

  const handleTranslate = async (): Promise<void> => {
    const tab = await getActiveTab();
    if (!isInjectableTab(tab)) {
      message.warning('请在普通网页（http/https）上使用，无法在浏览器内置页翻译');
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : '检测失败');
    }
  };

  const tierLabel = user
    ? { free: '免费会员', basic: '初级会员', premium: '高级会员' }[user.tier]
    : null;
  const tierColor = user
    ? ({ free: 'default', basic: 'blue', premium: 'gold' } as const)[user.tier]
    : 'default';

  return (
    <div>
      <Title level={5} style={{ marginTop: 0 }}>
        AI 翻译助手
        {tierLabel && (
          <Tag color={tierColor} style={{ marginLeft: 8 }}>
            {tierLabel}
          </Tag>
        )}
      </Title>

      <div className="ds-popup__status">
        <span
          className={`ds-popup__dot ${detection?.isEnglish ? 'ds-popup__dot--en' : 'ds-popup__dot--other'}`}
        />
        <Text>
          {tabNotInjectable
            ? '当前标签页不支持（请切换到普通网页）'
            : detection
              ? detection.isEnglish
                ? `当前页疑似英文（${detection.lang}）`
                : `当前页可能非英文（${detection.lang}）`
              : '正在检测…'}
        </Text>
      </div>

      <Card size="small" styles={{ body: { padding: 12 } }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={8}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>检测到英文页自动提示</Text>
            <Switch
              checked={prefs.autoPrompt}
              onChange={(v) => {
                void togglePref('autoPrompt', v);
              }}
            />
          </Space>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>开启划词翻译</Text>
            <Switch
              checked={prefs.selectTranslate}
              onChange={(v) => {
                void togglePref('selectTranslate', v);
              }}
            />
          </Space>
        </Space>
      </Card>

      <Divider style={{ margin: '12px 0' }} />

      <Space style={{ width: '100%' }} orientation="vertical">
        <Button type="primary" block onClick={() => void handleTranslate()}>
          翻译当前页
        </Button>
        <Button block onClick={() => void handleDetect()}>
          重新检测
        </Button>
        <Button type="link" block onClick={openOptionsPage}>
          打开设置
        </Button>
      </Space>
    </div>
  );
}
