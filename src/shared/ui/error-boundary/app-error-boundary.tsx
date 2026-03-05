import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Button, Result } from 'antd';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  componentDidMount(): void {
    window.addEventListener('popstate', this.handleHistoryNavigate);
  }

  componentWillUnmount(): void {
    window.removeEventListener('popstate', this.handleHistoryNavigate);
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleHistoryNavigate = (): void => {
    if (this.state.hasError) {
      this.setState({ hasError: false });
    }
  };

  private handleBack = (): void => {
    if (window.history.length > 1) {
      this.setState({ hasError: false }, () => {
        window.history.back();
      });
      return;
    }

    window.location.assign('/dashboard');
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="화면 처리 중 오류가 발생했습니다."
          subTitle="잠시 후 다시 시도해주세요. 문제가 지속되면 운영 채널로 문의부탁드립니다."
          extra={
            <>
              <Button onClick={this.handleBack}>이전 페이지</Button>
              <Button type="primary" onClick={this.handleReload}>
                새로고침
              </Button>
            </>
          }
        />
      );
    }

    return this.props.children;
  }
}
