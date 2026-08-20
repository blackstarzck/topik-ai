import { App as AntApp, ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { BrowserRouter } from 'react-router-dom';

import { AppRouter } from './router/app-router';
import { AuthGate } from '@/features/auth/ui/auth-gate';
import { AppErrorBoundary } from '@/shared/ui/error-boundary/app-error-boundary';
import { adminThemeToken } from './theme';

export function App(): JSX.Element {
  return (
    <ConfigProvider locale={koKR} theme={{ token: adminThemeToken }}>
      <AntApp>
        <AppErrorBoundary>
          <BrowserRouter>
            <AuthGate>
              <AppRouter />
            </AuthGate>
          </BrowserRouter>
        </AppErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
