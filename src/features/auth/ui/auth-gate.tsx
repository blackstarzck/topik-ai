import type { ReactNode } from 'react';
import { Suspense, lazy, useEffect } from 'react';
import { Spin } from 'antd';

import { useAuthStore } from '../model/auth-store';

/**
 * 로그인 화면은 지연 로딩한다 — 인증된 세션과 mock 모드에서는 렌더되지 않는데도
 * antd Form 계열(rc-field-form, async-validator, rc-input)을 초기 페이로드로 끌고 왔다.
 * 미인증 사용자에게는 이 화면이 첫 화면이므로, 대기 표시는 `initializing` 과 같은 것을 쓴다.
 */
const LoginPage = lazy(async () => {
  const module = await import('../pages/login-page');
  return { default: module.LoginPage };
});

type AuthGateProps = {
  children: ReactNode;
};

function AuthGateSpinner(): JSX.Element {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Spin size="large" />
    </div>
  );
}

/**
 * Flag-gated auth boundary (Phase A). When Supabase is not configured the gate is a
 * pass-through and the app behaves exactly as before (mock mode). When configured it
 * requires a v13 admin login before rendering the admin shell.
 */
export function AuthGate({ children }: AuthGateProps): JSX.Element {
  const status = useAuthStore((state) => state.status);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (status === 'mock' || status === 'authenticated') {
    return <>{children}</>;
  }

  if (status === 'initializing') {
    return <AuthGateSpinner />;
  }

  return (
    <Suspense fallback={<AuthGateSpinner />}>
      <LoginPage />
    </Suspense>
  );
}
