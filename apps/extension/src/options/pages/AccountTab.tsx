import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Descriptions, Space, Spin, Tag, Typography } from 'antd';
import { useState } from 'react';

import { userApi } from '../../shared/api/user';
import { useAuthStore } from '../../shared/store/auth.store';
import { LoginForm } from '../components/LoginForm';
import { RegisterForm } from '../components/RegisterForm';

const { Title, Text } = Typography;

const TIER_LABEL = { free: '免费会员', basic: '初级会员', premium: '高级会员' } as const;
const TIER_COLOR = { free: 'default', basic: 'blue', premium: 'gold' } as const;

export function AccountTab() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const { data: membership } = useQuery({
    queryKey: ['membership', user?.id],
    queryFn: () => userApi.membership(),
    enabled: !!user,
  });

  if (loading) {
    return (
      <Card>
        <Spin />
      </Card>
    );
  }

  if (!user) {
    return (
      <Card style={{ maxWidth: 480 }}>
        <Title level={5}>{mode === 'login' ? '账户登录' : '账户注册'}</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          登录后才能使用 LLM 翻译。免费会员可使用 Google / LibreTranslate。
        </Text>
        {mode === 'login' ? (
          <LoginForm onSwitch={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitch={() => setMode('login')} />
        )}
      </Card>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Card>
        <Descriptions title="账户信息" column={1}>
          <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
          <Descriptions.Item label="昵称">{user.nickname ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="会员等级">
            <Tag color={TIER_COLOR[user.tier]}>{TIER_LABEL[user.tier]}</Tag>
            {user.tierExpiresAt && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                到期：{new Date(user.tierExpiresAt).toLocaleDateString()}
              </Text>
            )}
          </Descriptions.Item>
          {membership && (
            <Descriptions.Item label="本期用量">
              {membership.usedChars.toLocaleString()} /{' '}
              {membership.quotaChars?.toLocaleString() ?? '不限'} 字符
            </Descriptions.Item>
          )}
        </Descriptions>
        <Space>
          <Button onClick={() => void logout()}>退出登录</Button>
        </Space>
      </Card>

      {user.tier === 'free' && (
        <Alert
          type="info"
          showIcon
          message="升级为初级会员可使用 DeepSeek / OpenAI / Claude 等 LLM"
          description="升级后可在「模型」页填写自己的 API Key 调用。"
        />
      )}
      {user.tier === 'basic' && (
        <Alert
          type="info"
          showIcon
          message="升级为高级会员可使用 GPT-4 Turbo / Claude 3.5 Sonnet 等高级模型（开发者赞助 Key）"
        />
      )}
    </Space>
  );
}
