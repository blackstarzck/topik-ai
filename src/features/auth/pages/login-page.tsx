import { Button, Card, Form, Input, Typography } from 'antd';

import { useAuthStore } from '../model/auth-store';
import { APP_COLOR, SPACE } from '@/shared/styles/design-tokens';

type LoginValues = {
  email: string;
  password: string;
};

export function LoginPage(): JSX.Element {
  const signIn = useAuthStore((state) => state.signIn);
  const signingIn = useAuthStore((state) => state.signingIn);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);

  const handleFinish = (values: LoginValues): void => {
    void signIn(values.email.trim(), values.password);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: APP_COLOR.loginBg,
        padding: SPACE.lg
      }}
    >
      <Card style={{ width: 400 }}>
        <Typography.Title level={4} style={{ marginBottom: SPACE.xxs }}>
          TOPIK 관리자 로그인
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          v13 Supabase 관리자 계정으로 로그인하세요.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false} disabled={signingIn}>
          <Form.Item
            name="email"
            label="이메일"
            rules={[{ required: true, type: 'email', message: '이메일을 입력하세요.' }]}
          >
            <Input autoComplete="username" placeholder="admin@example.com" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="비밀번호"
            rules={[{ required: true, message: '비밀번호를 입력하세요.' }]}
          >
            <Input.Password autoComplete="current-password" size="large" />
          </Form.Item>
          {error ? (
            <Typography.Paragraph type="danger" style={{ marginTop: -SPACE.xxs }}>
              {error}
            </Typography.Paragraph>
          ) : null}
          {status === 'unauthorized' && !error ? (
            <Typography.Paragraph type="danger" style={{ marginTop: -SPACE.xxs }}>
              관리자 권한이 없는 계정입니다.
            </Typography.Paragraph>
          ) : null}
          <Button type="primary" htmlType="submit" block size="large" loading={signingIn}>
            로그인
          </Button>
        </Form>
      </Card>
    </div>
  );
}
