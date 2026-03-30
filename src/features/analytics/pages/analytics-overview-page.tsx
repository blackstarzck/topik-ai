import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../../billing/model/commerce-store';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

type PeriodKey = '7d' | '30d' | '90d';

type ModuleSummary = {
  key: string;
  module: string;
  primaryMetric: string;
  value: string;
  trend: number;
  route: string;
};

function parsePeriod(value: string | null): PeriodKey {
  if (value === '30d' || value === '90d') {
    return value;
  }
  return '7d';
}

const periodOptions = [
  { label: '최근 7일', value: '7d' },
  { label: '최근 30일', value: '30d' },
  { label: '최근 90일', value: '90d' }
];

const summaryMap: Record<
  PeriodKey,
  {
    activeRate: number;
    reportRate: number;
    deliveryRate: number;
    revenue: number;
    alerts: string[];
  }
> = {
  '7d': {
    activeRate: 74,
    reportRate: 88,
    deliveryRate: 91,
    revenue: 1280000,
    alerts: ['환불 승인 대기 건이 전주 대비 2건 증가했습니다.']
  },
  '30d': {
    activeRate: 71,
    reportRate: 84,
    deliveryRate: 89,
    revenue: 5140000,
    alerts: ['메시지 실패율이 최근 30일 기준 3.1%로 상승했습니다.']
  },
  '90d': {
    activeRate: 69,
    reportRate: 82,
    deliveryRate: 87,
    revenue: 14300000,
    alerts: ['커뮤니티 신고 처리율이 90일 평균보다 4% 낮습니다.']
  }
};

const moduleSummaryMap: Record<PeriodKey, ModuleSummary[]> = {
  '7d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '신규 가입',
      value: '124명',
      trend: 12,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '신고 처리율',
      value: '88%',
      trend: 4,
      route: '/community/reports'
    },
    {
      key: 'message',
      module: '메시지',
      primaryMetric: '도달률',
      value: '91%',
      trend: -2,
      route: '/messages/history?channel=mail'
    },
    {
      key: 'commerce',
      module: '커머스',
      primaryMetric: '매출',
      value: '₩1,280,000',
      trend: 8,
      route: '/commerce/payments'
    }
  ],
  '30d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '활성 회원 비율',
      value: '71%',
      trend: 2,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '신고 누적 처리',
      value: '312건',
      trend: 6,
      route: '/community/reports'
    },
    {
      key: 'message',
      module: '메시지',
      primaryMetric: '실패 건수',
      value: '42건',
      trend: -3,
      route: '/messages/history?channel=push'
    },
    {
      key: 'commerce',
      module: '커머스',
      primaryMetric: '환불 처리율',
      value: '92%',
      trend: 3,
      route: '/commerce/refunds'
    }
  ],
  '90d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '가입 전환율',
      value: '34%',
      trend: 5,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '콘텐츠 생성량',
      value: '1,824건',
      trend: 11,
      route: '/community/posts'
    },
    {
      key: 'message',
      module: '메시지',
      primaryMetric: '누적 발송 수',
      value: '28,420건',
      trend: 7,
      route: '/messages/history?channel=mail'
    },
    {
      key: 'commerce',
      module: '커머스',
      primaryMetric: '누적 매출',
      value: '₩14,300,000',
      trend: 9,
      route: '/commerce/payments'
    }
  ]
};

function getPeriodStart(period: PeriodKey): Date {
  const now = new Date('2026-03-11T23:59:59');
  const start = new Date(now);

  if (period === '7d') {
    start.setDate(now.getDate() - 6);
    return start;
  }
  if (period === '30d') {
    start.setDate(now.getDate() - 29);
    return start;
  }
  start.setDate(now.getDate() - 89);
  return start;
}

export default function AnalyticsOverviewPage(): JSX.Element {
  const navigate = useNavigate();
  const payments = useCommerceStore((state) => state.payments);
  const refunds = useCommerceStore((state) => state.refunds);
  const [searchParams, setSearchParams] = useSearchParams();
  const activePeriod = parsePeriod(searchParams.get('period'));
  const periodStart = getPeriodStart(activePeriod);
  const commerceRevenue = payments
    .filter(
      (payment) => payment.status === '완료' && new Date(`${payment.paidAt}T00:00:00`) >= periodStart
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const handledRefundRate =
    refunds.length === 0
      ? 100
      : Math.round(
          (refunds.filter((refund) => refund.status !== '처리 대기').length / refunds.length) *
              100
        );
  const pendingRefundCount = refunds.filter((refund) => refund.status === '처리 대기').length;
  const summary = {
    ...summaryMap[activePeriod],
    revenue: commerceRevenue,
    alerts:
      pendingRefundCount > 0
        ? [
            `환불 처리 대기 건이 ${pendingRefundCount}건 있어 커머스 운영 지표와 함께 확인해야 합니다.`,
            ...summaryMap[activePeriod].alerts
          ]
        : summaryMap[activePeriod].alerts
  };
  const moduleRows = moduleSummaryMap[activePeriod].map((row) => {
    if (row.key !== 'commerce') {
      return row;
    }

    if (row.primaryMetric.includes('환불 처리율')) {
      return { ...row, value: `${handledRefundRate}%` };
    }

    return { ...row, value: `₩${commerceRevenue.toLocaleString('ko-KR')}` };
  });

  const commitPeriod = useCallback(
    (nextPeriod: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('period', nextPeriod);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const columns = useMemo<TableColumnsType<ModuleSummary>>(
    () => [
      {
        title: '모듈',
        dataIndex: 'module',
        width: 120,
        sorter: createTextSorter((record) => record.module)
      },
      {
        title: '핵심 지표',
        dataIndex: 'primaryMetric',
        width: 150,
        sorter: createTextSorter((record) => record.primaryMetric)
      },
      {
        title: '현재 값',
        dataIndex: 'value',
        width: 140,
        sorter: createTextSorter((record) => record.value)
      },
      {
        title: '추세',
        dataIndex: 'trend',
        width: 120,
        sorter: createNumberSorter((record) => record.trend),
        render: (trend: number) => (
          <Text type={trend >= 0 ? 'success' : 'danger'}>
            {trend >= 0 ? '+' : ''}
            {trend}%
          </Text>
        )
      },
      {
        title: '이동',
        key: 'route',
        width: 120,
        render: (_, record) => (
          <Button type="link" onClick={() => navigate(record.route)}>
            상세 보기
          </Button>
        )
      }
    ],
    [navigate]
  );

  return (
    <div>
      <PageTitle title="분석" />

      <Card style={{ marginBottom: 16 }}>
        <Space
          style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}
          wrap
        >
          <div>
            <Text strong>조회 기간</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              사용자, 커뮤니티, 메시지, 커머스 지표를 같은 기간 기준으로 비교합니다.
            </Paragraph>
          </div>
          <Segmented
            options={periodOptions}
            value={activePeriod}
            onChange={(value) => commitPeriod(String(value))}
          />
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="활성 사용자 비율" value={summary.activeRate} suffix="%" />
            <Progress percent={summary.activeRate} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="신고 처리율" value={summary.reportRate} suffix="%" />
            <Progress percent={summary.reportRate} status="active" showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="메시지 도달률" value={summary.deliveryRate} suffix="%" />
            <Progress percent={summary.deliveryRate} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="매출 합계" value={summary.revenue} prefix="₩" />
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {activePeriod === '7d'
                ? '최근 7일 확정 매출 기준'
                : activePeriod === '30d'
                  ? '최근 30일 결제 완료 기준'
                  : '최근 90일 누적 매출 기준'}
            </Paragraph>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card
            title="모듈별 핵심 지표"
            extra={
              <Button type="link" onClick={() => navigate('/dashboard')}>
                대시보드 이동
              </Button>
            }
          >
            <Table
              rowKey="key"
              showSorterTooltip={false}
              size="small"
              pagination={false}
              columns={columns}
              dataSource={moduleRows}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="이상 징후">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {summary.alerts.map((alert) => (
                <Alert
                  key={alert}
                  showIcon
                  type="warning"
                  message={alert}
                  action={
                    <Button type="link" size="small" onClick={() => navigate('/system/audit-logs')}>
                      감사 로그
                    </Button>
                  }
                />
              ))}
              <Alert
                showIcon
                type="info"
                message="기간 필터는 URL에 저장됩니다."
                description="동일 링크를 열면 같은 기간 기준 분석 결과를 다시 볼 수 있습니다."
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
