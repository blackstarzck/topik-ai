import { Card, Col, Row, Statistic } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';


export default function DashboardPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="대시보드" />
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


