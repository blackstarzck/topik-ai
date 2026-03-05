import { Button, Result, Space } from 'antd';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage(): JSX.Element {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <Result
      status="404"
      title="확인되지 않은 페이지입니다"
      subTitle="입력한 주소를 다시 확인하거나 이전 페이지로 이동해주세요."
      extra={
        <Space>
          <Button onClick={handleBack}>이전 페이지</Button>
          <Button type="primary" onClick={() => navigate('/dashboard')}>
            대시보드로 이동
          </Button>
        </Space>
      }
    />
  );
}
