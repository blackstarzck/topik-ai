import { App as AntApp, ConfigProvider } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { BrowserRouter } from 'react-router-dom';

import { AppRouter } from './router/app-router';
import { AppErrorBoundary } from '../shared/ui/error-boundary/app-error-boundary';
import '../shared/api/http-client';

const themeToken = {
  colorPrimary: '#0f4da8',
  borderRadius: 10,
  fontFamily: "'Freesentation', 'Noto Sans KR', 'Segoe UI', sans-serif"
};

export function App(): JSX.Element {
  return (
    <ConfigProvider locale={koKR} theme={{ token: themeToken }}>
      <AntApp>
        <AppErrorBoundary>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AppErrorBoundary>
      </AntApp>
    </ConfigProvider>
  );
}
