import { Tabs, Typography } from 'antd';
import { useEffect } from 'react';

import { useAuthStore } from '../shared/store/auth.store';
import { usePrefsStore } from '../shared/store/prefs.store';

import { AccountTab } from './pages/AccountTab';
import { BehaviorTab } from './pages/BehaviorTab';
import { ModelsTab } from './pages/ModelsTab';

const { Title, Text } = Typography;

export function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initPrefs = usePrefsStore((s) => s.init);

  useEffect(() => {
    void initAuth();
    void initPrefs();
  }, [initAuth, initPrefs]);

  return (
    <div>
      <div className="ds-options__header">
        <Title level={3} style={{ marginBottom: 4 }}>
          AI 翻译助手 · 设置
        </Title>
        <Text type="secondary">
          统一的账户、模型与行为配置。模型可见性受会员等级控制；初级会员需自带 API Key。
        </Text>
      </div>
      <Tabs
        defaultActiveKey="account"
        items={[
          { key: 'account', label: '账户', children: <AccountTab /> },
          { key: 'models', label: '模型', children: <ModelsTab /> },
          { key: 'behavior', label: '行为', children: <BehaviorTab /> },
        ]}
      />
    </div>
  );
}
