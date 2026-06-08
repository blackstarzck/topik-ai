import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Spin } from 'antd';

import { useAuthStore } from '../model/auth-store';
import { LoginPage } from '../pages/login-page';

type AuthGateProps = {
  children: ReactNode;
};

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

  return <LoginPage />;
}
