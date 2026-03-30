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
          title="?붾㈃ 泥섎━ 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎."
          subTitle="?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂. 臾몄젣媛 吏?띾릺硫?운영 梨꾨꼸濡?臾몄쓽遺?곷뱶由쎈땲??"
          extra={
            <>
              <Button onClick={this.handleBack}>?댁쟾 ?섏씠吏</Button>
              <Button type="primary" onClick={this.handleReload}>
                ?덈줈怨좎묠
              </Button>
            </>
          }
        />
      );
    }

    return this.props.children;
  }
}

