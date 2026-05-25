import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Divider, Space, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { authApi } from '../shared/api/auth';
import { storageGet, storageGetMany, storageSet } from '../shared/storage/chrome-storage';
import { LOCAL_KEYS, SYNC_KEYS } from '../shared/storage/keys';

const { Title, Text, Link } = Typography;

interface DetectionResult {
  isEnglish: boolean;
  lang: string;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
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

async function sendTab(tabId: number, message: { type: string }): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // 脚本未注入，主动注入一次
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content.ts', 'src/content/selection-translate.ts'],
    });
    await chrome.tabs.sendMessage(tabId, message);
  }
}

export function App() {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [prefs, setPrefs] = useState({
    enabled: true,
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
        SYNC_KEYS.ENABLED,
        SYNC_KEYS.AUTO_PROMPT,
        SYNC_KEYS.SELECT_TRANSLATE,
      ]);
      setPrefs({
        enabled: data[SYNC_KEYS.ENABLED] !== false,
        autoPrompt: data[SYNC_KEYS.AUTO_PROMPT] !== false,
        selectTranslate: data[SYNC_KEYS.SELECT_TRANSLATE] === true,
      });
      const tab = await getActiveTab();
      if (tab?.id && tab.url?.startsWith('http')) {
        try {
          setDetection(await detectTab(tab.id));
        } catch {
          /* ignore */
        }
      }
    })();
  }, []);

  const togglePref = async (key: keyof typeof prefs, val: boolean): Promise<void> => {
    setPrefs((p) => ({ ...p, [key]: val }));
    await storageSet('sync', {
      [SYNC_KEYS.ENABLED]: key === 'enabled' ? val : prefs.enabled,
      [SYNC_KEYS.AUTO_PROMPT]: key === 'autoPrompt' ? val : prefs.autoPrompt,
      [SYNC_KEYS.SELECT_TRANSLATE]: key === 'selectTranslate' ? val : prefs.selectTranslate,
    });
  };

  const handleTranslate = async (): Promise<void> => {
    const tab = await getActiveTab();
    if (tab?.id) await sendTab(tab.id, { type: 'SHOW_TRANSLATE_BAR' });
    window.close();
  };

  const handleDetect = async (): Promise<void> => {
    const tab = await getActiveTab();
    if (tab?.id) {
      await sendTab(tab.id, { type: 'RUN_DETECT' });
      try {
        setDetection(await detectTab(tab.id));
      } catch {
        /* ignore */
      }
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
          {detection
            ? detection.isEnglish
              ? `当前页疑似英文（${detection.lang}）`
              : `当前页可能非英文（${detection.lang}）`
            : '正在检测…'}
        </Text>
      </div>

      {!user && (
        <Alert
          type="warning"
          showIcon
          message="尚未登录"
          description={
            <span>
              请先 <Link onClick={() => chrome.runtime.openOptionsPage?.()}>打开选项页</Link>{' '}
              完成登录。
            </span>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Card size="small" styles={{ body: { padding: 12 } }}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text>启用扩展</Text>
            <Switch
              checked={prefs.enabled}
              onChange={(v) => {
                void togglePref('enabled', v);
              }}
            />
          </Space>
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

      <Space style={{ width: '100%' }} direction="vertical">
        <Button type="primary" block onClick={() => void handleTranslate()}>
          翻译当前页
        </Button>
        <Button block onClick={() => void handleDetect()}>
          重新检测
        </Button>
        <Button type="link" block onClick={() => chrome.runtime.openOptionsPage?.()}>
          打开设置
        </Button>
      </Space>
    </div>
  );
}
