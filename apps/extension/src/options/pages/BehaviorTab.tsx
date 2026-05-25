import { Card, Space, Switch, Typography } from 'antd';

import { usePrefsStore } from '../../shared/store/prefs.store';

const { Text } = Typography;

export function BehaviorTab() {
  const prefs = usePrefsStore();

  return (
    <Card title="行为设置">
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <div>
            <Text strong>启用扩展</Text>
            <div>
              <Text type="secondary">关闭后扩展不会进行任何检测与翻译</Text>
            </div>
          </div>
          <Switch
            checked={prefs.enabled}
            onChange={(v) => {
              void prefs.patch({ enabled: v });
            }}
          />
        </Space>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <div>
            <Text strong>检测到英文页面自动提示</Text>
            <div>
              <Text type="secondary">关闭后只能从扩展图标手动触发翻译</Text>
            </div>
          </div>
          <Switch
            checked={prefs.autoPrompt}
            onChange={(v) => {
              void prefs.patch({ autoPrompt: v });
            }}
          />
        </Space>
        <Space style={{ justifyContent: 'space-between', width: '100%' }}>
          <div>
            <Text strong>开启划词翻译</Text>
            <div>
              <Text type="secondary">选中英文后弹出词典面板（含音标、释义、例句）</Text>
            </div>
          </div>
          <Switch
            checked={prefs.selectTranslate}
            onChange={(v) => {
              void prefs.patch({ selectTranslate: v });
            }}
          />
        </Space>
      </Space>
    </Card>
  );
}
