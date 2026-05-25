import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';

import { useAuthStore } from '../../shared/store/auth.store';

export function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      await login(values.email, values.password);
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
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, min: 8, message: '至少 8 位' }]}
      >
        <Input.Password autoComplete="current-password" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>
      <Button type="link" block onClick={onSwitch}>
        没有账号？立即注册
      </Button>
    </Form>
  );
}
