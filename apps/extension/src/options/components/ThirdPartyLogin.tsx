import { GithubOutlined, GoogleOutlined, MobileOutlined } from '@ant-design/icons';
import { Button, Divider, Space, message } from 'antd';

/**
 * 第三方登录入口（OAuth Google/GitHub、短信验证码）。
 *
 * 当前为占位骨架：
 * - 后端 `auth/strategies/google.strategy.ts`、`github.strategy.ts`、`sms/sms.controller.ts`
 *   已就位，待接入官方 SDK 与短信通道后即可激活。
 * - 这里仅提供 UI 入口，点击统一提示「即将上线」，符合 F-AUTH-05（P2）。
 */
export function ThirdPartyLogin() {
  const notReady = (channel: string) => () => {
    void message.info(`${channel} 登录即将上线，敬请期待`);
  };

  return (
    <>
      <Divider plain>或使用第三方登录</Divider>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Button block icon={<GoogleOutlined />} onClick={notReady('Google')}>
          使用 Google 账号
        </Button>
        <Button block icon={<GithubOutlined />} onClick={notReady('GitHub')}>
          使用 GitHub 账号
        </Button>
        <Button block icon={<MobileOutlined />} onClick={notReady('手机短信')}>
          手机短信验证码
        </Button>
      </Space>
    </>
  );
}
