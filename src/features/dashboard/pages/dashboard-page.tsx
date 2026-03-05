import { Card, Col, Row, Statistic, Typography } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

export default function DashboardPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="대시보드" />
      <Paragraph className="page-description">
        운영 지표를 요약하고 Work Queue 우선순위를 관리합니다.
      </Paragraph>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="Today New Users" value={124} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="Pending Reports" value={37} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card>
            <Statistic title="Refund Queue" value={8} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

