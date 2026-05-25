import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';

import { useAuthStore } from '../../shared/store/auth.store';

export function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const register = useAuthStore((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: {
    email: string;
    password: string;
    nickname?: string;
  }): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await register(values.email, values.password, values.nickname);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form layout="vertical" onFinish={(v) => void onFinish(v)} disabled={loading}>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form.Item
        name="email"
        label="邮箱"
        rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
      >
        <Input placeholder="you@example.com" autoComplete="email" />
      </Form.Item>
      <Form.Item name="nickname" label="昵称（可选）" rules={[{ max: 32 }]}>
        <Input placeholder="选填" />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, min: 8, max: 64, message: '8-64 位' }]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          注册并登录
        </Button>
      </Form.Item>
      <Button type="link" block onClick={onSwitch}>
        已有账号？返回登录
      </Button>
    </Form>
  );
}
