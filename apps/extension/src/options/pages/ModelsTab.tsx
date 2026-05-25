import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Empty, Form, Input, Radio, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { llmApi } from '../../shared/api/llm';
import { storageGet, storageSet } from '../../shared/storage/chrome-storage';
import { LOCAL_KEYS } from '../../shared/storage/keys';
import { useAuthStore } from '../../shared/store/auth.store';
import { usePrefsStore } from '../../shared/store/prefs.store';

import type { ModelDescriptor, ProviderDescriptor } from '@translator/shared-types';

const { Title, Text } = Typography;

const KEY_SOURCE_LABEL = {
  system: '由开发者赞助 Key',
  user: '需自带 API Key',
  none: '免费引擎',
} as const;

export function ModelsTab() {
  const user = useAuthStore((s) => s.user);
  const { currentModel, patch } = usePrefsStore();

  const { data, isLoading } = useQuery({
    queryKey: ['models', user?.id, user?.tier],
    queryFn: () => llmApi.models(),
    enabled: !!user,
  });

  // 当前选中模型的 keySource，决定是否显示 API Key 录入
  const selectedModel: ModelDescriptor | undefined = useMemo(() => {
    if (!data) return undefined;
    for (const p of data.providers) {
      const m = p.models.find((x) => x.id === currentModel);
      if (m) return m;
    }
    return undefined;
  }, [data, currentModel]);

  const [userApiKey, setUserApiKey] = useState<string>('');

  useEffect(() => {
    if (!selectedModel) return;
    void (async () => {
      const keys =
        (await storageGet<Record<string, string>>('local', LOCAL_KEYS.USER_API_KEYS)) ?? {};
      setUserApiKey(keys[selectedModel.providerId] ?? '');
    })();
  }, [selectedModel]);

  if (!user) {
    return <Alert type="info" message="请先登录后再选择模型" />;
  }
  if (isLoading) {
    return <Card>加载模型列表…</Card>;
  }
  if (!data || data.providers.length === 0) {
    return <Empty description="暂无可用模型" />;
  }

  const handleModelChange = async (model: ModelDescriptor): Promise<void> => {
    await patch({ currentProvider: model.providerId, currentModel: model.id });
  };

  const handleSaveKey = async (val: string): Promise<void> => {
    if (!selectedModel) return;
    const keys =
      (await storageGet<Record<string, string>>('local', LOCAL_KEYS.USER_API_KEYS)) ?? {};
    keys[selectedModel.providerId] = val.trim();
    await storageSet('local', { [LOCAL_KEYS.USER_API_KEYS]: keys });
    setUserApiKey(val.trim());
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Alert
        type="info"
        showIcon
        message={`当前等级：${{ free: '免费会员', basic: '初级会员', premium: '高级会员' }[user.tier]}`}
        description={
          user.tier === 'free'
            ? '免费会员仅可使用 Google / LibreTranslate；升级初级会员后可使用通用 LLM。'
            : user.tier === 'basic'
              ? '初级会员需自带 API Key；高级会员模型由开发者赞助 Key。'
              : '高级会员可使用全部模型；高级模型 Key 由后端持有，无需配置。'
        }
      />

      {data.providers.map((p: ProviderDescriptor) => (
        <Card key={p.id} title={p.label} size="small">
          <Radio.Group
            value={currentModel}
            onChange={(e) => {
              const id = e.target.value as string;
              const m = p.models.find((x) => x.id === id);
              if (m) void handleModelChange(m);
            }}
          >
            <Space direction="vertical">
              {p.models.map((m) => (
                <Radio key={m.id} value={m.id}>
                  <Space>
                    <Text strong>{m.label}</Text>
                    <Tag
                      color={
                        m.keySource === 'system'
                          ? 'gold'
                          : m.keySource === 'user'
                            ? 'blue'
                            : 'green'
                      }
                    >
                      {KEY_SOURCE_LABEL[m.keySource]}
                    </Tag>
                    {m.priceHint && <Text type="secondary">{m.priceHint}</Text>}
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Card>
      ))}

      {selectedModel?.keySource === 'user' && (
        <Card title="自带 API Key" size="small">
          <Form layout="vertical">
            <Form.Item label={`${selectedModel.providerId} API Key`}>
              <Input.Password
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                onBlur={() => void handleSaveKey(userApiKey)}
                placeholder="sk-..."
              />
            </Form.Item>
            <Text type="secondary">
              密钥仅保存在浏览器本地（不同步），翻译时随请求发往本扩展后端，立即丢弃。
            </Text>
          </Form>
        </Card>
      )}

      {selectedModel?.keySource === 'system' && (
        <Card size="small">
          <Title level={5} style={{ marginTop: 0 }}>
            开发者赞助模型
          </Title>
          <Text type="secondary">该模型由开发者支付费用，无需您配置 API Key。仅高级会员可用。</Text>
        </Card>
      )}
    </Space>
  );
}
