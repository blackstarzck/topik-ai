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
  { label: '理쒓렐 7??, value: '7d' },
  { label: '理쒓렐 30??, value: '30d' },
  { label: '理쒓렐 90??, value: '90d' }
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
    alerts: ['환불 ?뱀씤 대기嫄댁씠 ?꾩＜ ?鍮?2嫄?利앷??덉뒿?덈떎.']
  },
  '30d': {
    activeRate: 71,
    reportRate: 84,
    deliveryRate: 89,
    revenue: 5140000,
    alerts: ['硫붿떆吏 실패?⑥씠 理쒓렐 30??湲곗? 3.1%濡??곸듅?덉뒿?덈떎.']
  },
  '90d': {
    activeRate: 69,
    reportRate: 82,
    deliveryRate: 87,
    revenue: 14300000,
    alerts: ['커뮤니티 신고 泥섎━?⑥씠 90???됯퇏蹂대떎 4% ??뒿?덈떎.']
  }
};

const moduleSummaryMap: Record<PeriodKey, ModuleSummary[]> = {
  '7d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '?좉퇋 媛??,
      value: '124紐?,
      trend: 12,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '신고 泥섎━??,
      value: '88%',
      trend: 4,
      route: '/community/reports'
    },
    {
      key: 'message',
      module: '硫붿떆吏',
      primaryMetric: '?꾨떖瑜?,
      value: '91%',
      trend: -2,
      route: '/messages/history?channel=mail'
    },
    {
      key: 'commerce',
      module: '而ㅻ㉧??,
      primaryMetric: '留ㅼ텧',
      value: '??,280,000',
      trend: 8,
      route: '/commerce/payments'
    }
  ],
  '30d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '활성 회원 鍮꾩쑉',
      value: '71%',
      trend: 2,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '신고 ?꾩쟻 泥섎━',
      value: '312嫄?,
      trend: 6,
      route: '/community/reports'
    },
    {
      key: 'message',
      module: '硫붿떆吏',
      primaryMetric: '실패 嫄댁닔',
      value: '42嫄?,
      trend: -3,
      route: '/messages/history?channel=push'
    },
    {
      key: 'commerce',
      module: '而ㅻ㉧??,
      primaryMetric: '환불 泥섎━??,
      value: '92%',
      trend: 3,
      route: '/commerce/refunds'
    }
  ],
  '90d': [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '媛???꾪솚??,
      value: '34%',
      trend: 5,
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '콘텐츠?앹꽦??,
      value: '1,824嫄?,
      trend: 11,
      route: '/community/posts'
    },
    {
      key: 'message',
      module: '硫붿떆吏',
      primaryMetric: '?꾩쟻 발송 ??,
      value: '28,420嫄?,
      trend: 7,
      route: '/messages/history?channel=mail'
    },
    {
      key: 'commerce',
      module: '而ㅻ㉧??,
      primaryMetric: '?꾩쟻 留ㅼ텧',
      value: '??4,300,000',
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
          (refunds.filter((refund) => refund.status !== '泥섎━ 대기).length / refunds.length) *
              100
        );
  const pendingRefundCount = refunds.filter((refund) => refund.status === '泥섎━ 대기).length;
  const summary = {
    ...summaryMap[activePeriod],
    revenue: commerceRevenue,
    alerts:
      pendingRefundCount > 0
        ? [
            `환불 泥섎━ 대기嫄댁씠 ${pendingRefundCount}嫄??덉뼱 而ㅻ㉧??운영 吏?쒖? ?④퍡 ?뺤씤?댁빞 ?⑸땲??`,
            ...summaryMap[activePeriod].alerts
          ]
        : summaryMap[activePeriod].alerts
  };
  const moduleRows = moduleSummaryMap[activePeriod].map((row) => {
    if (row.key !== 'commerce') {
      return row;
    }

    if (row.primaryMetric.includes('환불 泥섎━??)) {
      return { ...row, value: `${handledRefundRate}%` };
    }

    return { ...row, value: `??{commerceRevenue.toLocaleString('ko-KR')}` };
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
        title: '紐⑤뱢',
        dataIndex: 'module',
        width: 120,
        sorter: createTextSorter((record) => record.module)
      },
      {
        title: '?듭떖 吏??,
        dataIndex: 'primaryMetric',
        width: 150,
        sorter: createTextSorter((record) => record.primaryMetric)
      },
      {
        title: '?꾩옱 媛?,
        dataIndex: 'value',
        width: 140,
        sorter: createTextSorter((record) => record.value)
      },
      {
        title: '異붿꽭',
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
        title: '?대룞',
        key: 'route',
        width: 120,
        render: (_, record) => (
          <Button type="link" onClick={() => navigate(record.route)}>
            상세 蹂닿린
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
            <Text strong>議고쉶 湲곌컙</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              사용자 커뮤니티, 硫붿떆吏, 而ㅻ㉧??吏?쒕? 媛숈? 湲곌컙 湲곗??쇰줈 鍮꾧탳?⑸땲??
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
            <Statistic title="활성 사용자鍮꾩쑉" value={summary.activeRate} suffix="%" />
            <Progress percent={summary.activeRate} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="신고 泥섎━?? value={summary.reportRate} suffix="%" />
            <Progress percent={summary.reportRate} status="active" showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="硫붿떆吏 ?꾨떖瑜? value={summary.deliveryRate} suffix="%" />
            <Progress percent={summary.deliveryRate} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic title="留ㅼ텧 ?⑷퀎" value={summary.revenue} prefix="?? />
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {activePeriod === '7d'
                ? '理쒓렐 7???뺤젙 留ㅼ텧 湲곗?'
                : activePeriod === '30d'
                  ? '理쒓렐 30??결제 완료 湲곗?'
                  : '理쒓렐 90???꾩쟻 留ㅼ텧 湲곗?'}
            </Paragraph>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={16}>
          <Card
            title="紐⑤뱢蹂??듭떖 吏??
            extra={
              <Button type="link" onClick={() => navigate('/dashboard')}>
                대시보드?대룞
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
          <Card title="?댁긽 吏뺥썑">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {summary.alerts.map((alert) => (
                <Alert
                  key={alert}
                  showIcon
                  type="warning"
                  message={alert}
                  action={
                    <Button type="link" size="small" onClick={() => navigate('/system/audit-logs')}>
                      媛먯궗 로그
                    </Button>
                  }
                />
              ))}
              <Alert
                showIcon
                type="info"
                message="湲곌컙 ?꾪꽣??URL????λ맗?덈떎."
                description="?숈씪 留곹겕瑜??대㈃ 媛숈? 湲곌컙 湲곗? 분석 寃곌낵瑜??ㅼ떆 蹂????덉뒿?덈떎."
              />
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}


