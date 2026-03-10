import { Card, Col, Progress, Row, Typography } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Text } = Typography;

export default function AnalyticsOverviewPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="분석" />
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card>
            <Text>활성 사용자 비율</Text>
            <Progress percent={74} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Text>신고 처리율</Text>
            <Progress percent={88} status="active" />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Text>알림 도달률</Text>
            <Progress percent={91} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
