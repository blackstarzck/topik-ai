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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../../billing/model/commerce-store';
import {
  fetchAnalyticsOverviewSafe,
  type AnalyticsOverview
} from '../api/analytics-overview-service';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import type { AsyncState } from '../../../shared/model/async-state';
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

const periodDaysMap: Record<PeriodKey, number> = { '7d': 7, '30d': 30, '90d': 90 };
const periodLabelMap: Record<PeriodKey, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일'
};

// 직전 동일기간 대비 상대 변화율(%). 이전 값 0이면 현재>0 → 100%로 간주.
function relChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

// 비율(%): 분모 0이면 emptyValue(처리율 계열=100, 활성률=0 — 기존 화면 관례).
function rateOf(numerator: number, denominator: number, emptyValue: number): number {
  if (denominator === 0) {
    return emptyValue;
  }
  return Math.round((numerator / denominator) * 100);
}

type OverviewSummary = {
  activeRate: number | null;
  reportRate: number | null;
  deliveryRate: number | null;
  revenue: number | null;
  alerts: string[];
};

// Supabase 모드 KPI/이상 징후 — 하드코딩 문구 대신 집계값으로 계산한다.
function buildRealSummary(o: AnalyticsOverview, period: PeriodKey): OverviewSummary {
  const reportRate = rateOf(o.reportsResolved, o.reportsTotal, 100);
  const alerts: string[] = [];

  if (o.refundsPendingNow > 0) {
    alerts.push(
      `환불 처리 대기 건이 ${o.refundsPendingNow}건 있어 커머스 운영 지표와 함께 확인해야 합니다.`
    );
  }

  const deliveryDenominator = o.deliveriesSent + o.deliveriesFailed;
  if (deliveryDenominator > 0 && o.deliveriesFailed > 0) {
    const failRate = Math.round((o.deliveriesFailed / deliveryDenominator) * 1000) / 10;
    const prevDenominator = o.deliveriesSentPrev + o.deliveriesFailedPrev;
    const prevFailRate =
      prevDenominator > 0
        ? Math.round((o.deliveriesFailedPrev / prevDenominator) * 1000) / 10
        : null;
    alerts.push(
      `메시지 실패율이 ${periodLabelMap[period]} 기준 ${failRate}%입니다${
        prevFailRate !== null ? ` (직전 기간 ${prevFailRate}%)` : ''
      }.`
    );
  }

  if (o.reportsTotal > 0 && o.reportsTotalPrev > 0) {
    const prevReportRate = rateOf(o.reportsResolvedPrev, o.reportsTotalPrev, 100);
    if (reportRate < prevReportRate) {
      alerts.push(
        `신고 처리율이 직전 기간(${prevReportRate}%) 대비 ${prevReportRate - reportRate}%p 하락했습니다.`
      );
    }
  }

  return {
    activeRate: rateOf(o.activeUsers, o.totalUsers, 0),
    reportRate,
    deliveryRate: rateOf(o.deliveriesSent, deliveryDenominator, 100),
    revenue: o.revenueKrw,
    alerts
  };
}

// Supabase 모드 모듈별 핵심 지표. 기간별 지표 구성은 기존 화면 설계를 따르되,
// 실소스가 없는 '가입 전환율'(90d)만 '신규 가입'으로 대체한다.
// 추세: 개수/금액=직전 대비 상대 %, 비율=%p 차이.
function buildRealModuleRows(o: AnalyticsOverview, period: PeriodKey): ModuleSummary[] {
  const reportRate = rateOf(o.reportsResolved, o.reportsTotal, 100);
  const reportRatePrev = rateOf(o.reportsResolvedPrev, o.reportsTotalPrev, 100);
  const deliveryRateNow = rateOf(
    o.deliveriesSent,
    o.deliveriesSent + o.deliveriesFailed,
    100
  );
  const deliveryRatePrev = rateOf(
    o.deliveriesSentPrev,
    o.deliveriesSentPrev + o.deliveriesFailedPrev,
    100
  );

  if (period === '7d') {
    return [
      {
        key: 'users',
        module: '회원',
        primaryMetric: '신규 가입',
        value: `${o.newUsers.toLocaleString()}명`,
        trend: relChange(o.newUsers, o.newUsersPrev),
        route: '/users'
      },
      {
        key: 'community',
        module: '커뮤니티',
        primaryMetric: '신고 처리율',
        value: `${reportRate}%`,
        trend: reportRate - reportRatePrev,
        route: '/community/reports'
      },
      {
        key: 'message',
        module: '메시지',
        primaryMetric: '도달률',
        value: `${deliveryRateNow}%`,
        trend: deliveryRateNow - deliveryRatePrev,
        route: '/messages/history?channel=mail'
      },
      {
        key: 'commerce',
        module: '커머스',
        primaryMetric: '매출',
        value: `₩${o.revenueKrw.toLocaleString('ko-KR')}`,
        trend: relChange(o.revenueKrw, o.revenueKrwPrev),
        route: '/commerce/payments'
      }
    ];
  }

  if (period === '30d') {
    const activeRate = rateOf(o.activeUsers, o.totalUsers, 0);
    const activeRatePrev = rateOf(o.activeUsersPrev, o.totalUsers, 0);
    const refundRate = rateOf(o.refundsHandled, o.refundsTotal, 100);
    const refundRatePrev = rateOf(o.refundsHandledPrev, o.refundsTotalPrev, 100);
    return [
      {
        key: 'users',
        module: '회원',
        primaryMetric: '활성 회원 비율',
        value: `${activeRate}%`,
        trend: activeRate - activeRatePrev,
        route: '/users'
      },
      {
        key: 'community',
        module: '커뮤니티',
        primaryMetric: '신고 누적 처리',
        value: `${o.reportsResolved.toLocaleString()}건`,
        trend: relChange(o.reportsResolved, o.reportsResolvedPrev),
        route: '/community/reports'
      },
      {
        key: 'message',
        module: '메시지',
        primaryMetric: '실패 건수',
        value: `${o.deliveriesFailed.toLocaleString()}건`,
        trend: relChange(o.deliveriesFailed, o.deliveriesFailedPrev),
        route: '/messages/history?channel=push'
      },
      {
        key: 'commerce',
        module: '커머스',
        primaryMetric: '환불 처리율',
        value: `${refundRate}%`,
        trend: refundRate - refundRatePrev,
        route: '/commerce/refunds'
      }
    ];
  }

  return [
    {
      key: 'users',
      module: '회원',
      primaryMetric: '신규 가입',
      value: `${o.newUsers.toLocaleString()}명`,
      trend: relChange(o.newUsers, o.newUsersPrev),
      route: '/users'
    },
    {
      key: 'community',
      module: '커뮤니티',
      primaryMetric: '콘텐츠 생성량',
      value: `${o.postsCreated.toLocaleString()}건`,
      trend: relChange(o.postsCreated, o.postsCreatedPrev),
      route: '/community/posts'
    },
    {
      key: 'message',
      module: '메시지',
      primaryMetric: '누적 발송 수',
      value: `${o.deliveriesSent.toLocaleString()}건`,
      trend: relChange(o.deliveriesSent, o.deliveriesSentPrev),
      route: '/messages/history?channel=mail'
    },
    {
      key: 'commerce',
      module: '커머스',
      primaryMetric: '누적 매출',
      value: `₩${o.revenueKrw.toLocaleString('ko-KR')}`,
      trend: relChange(o.revenueKrw, o.revenueKrwPrev),
      route: '/commerce/payments'
    }
  ];
}

export default function AnalyticsOverviewPage(): JSX.Element {
  const navigate = useNavigate();
  const payments = useCommerceStore((state) => state.payments);
  const refunds = useCommerceStore((state) => state.refunds);
  const [searchParams, setSearchParams] = useSearchParams();
  const activePeriod = parsePeriod(searchParams.get('period'));

  // Supabase 모드 실데이터 집계(get_admin_analytics_overview). mock 모드는 data=null.
  const [overviewState, setOverviewState] = useState<AsyncState<AnalyticsOverview | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOverviewState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));
    void fetchAnalyticsOverviewSafe(periodDaysMap[activePeriod], controller.signal).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (result.ok) {
          setOverviewState({
            status: 'success',
            data: result.data,
            errorMessage: null,
            errorCode: null
          });
          return;
        }
        setOverviewState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error.message,
          errorCode: result.error.code
        }));
      }
    );
    return () => controller.abort();
  }, [activePeriod, reloadKey]);

  const overview = overviewState.data;
  const overviewLoading = isSupabaseConfigured && overviewState.status === 'pending';

  const handleRetryOverview = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  // ----- mock 폴백 계산(Supabase 미설정 시에만 사용; 기존 로직 유지) -----
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
  const mockSummary: OverviewSummary = {
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
  const mockModuleRows = moduleSummaryMap[activePeriod].map((row) => {
    if (row.key !== 'commerce') {
      return row;
    }

    if (row.primaryMetric.includes('환불 처리율')) {
      return { ...row, value: `${handledRefundRate}%` };
    }

    return { ...row, value: `₩${commerceRevenue.toLocaleString('ko-KR')}` };
  });

  // ----- 표시 모델: 실데이터 > (Supabase 로딩/오류 시 '—') > mock -----
  const summary: OverviewSummary = overview
    ? buildRealSummary(overview, activePeriod)
    : isSupabaseConfigured
      ? { activeRate: null, reportRate: null, deliveryRate: null, revenue: null, alerts: [] }
      : mockSummary;
  const moduleRows: ModuleSummary[] = overview
    ? buildRealModuleRows(overview, activePeriod)
    : isSupabaseConfigured
      ? []
      : mockModuleRows;

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

      {isSupabaseConfigured && overviewState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="분석 지표 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{overviewState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Button size="small" onClick={handleRetryOverview}>
                재시도
              </Button>
            </Space>
          }
        />
      ) : null}

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
            <Statistic
              title="활성 사용자 비율"
              value={summary.activeRate ?? '—'}
              suffix={summary.activeRate !== null ? '%' : undefined}
              loading={overviewLoading}
            />
            <Progress percent={summary.activeRate ?? 0} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic
              title="신고 처리율"
              value={summary.reportRate ?? '—'}
              suffix={summary.reportRate !== null ? '%' : undefined}
              loading={overviewLoading}
            />
            <Progress percent={summary.reportRate ?? 0} status="active" showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic
              title="메시지 도달률"
              value={summary.deliveryRate ?? '—'}
              suffix={summary.deliveryRate !== null ? '%' : undefined}
              loading={overviewLoading}
            />
            <Progress percent={summary.deliveryRate ?? 0} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card>
            <Statistic
              title="매출 합계"
              value={summary.revenue ?? '—'}
              prefix={summary.revenue !== null ? '₩' : undefined}
              loading={overviewLoading}
            />
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
              loading={overviewLoading}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="이상 징후">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {overview && summary.alerts.length === 0 ? (
                <Alert
                  showIcon
                  type="success"
                  message="주요 이상 징후가 감지되지 않았습니다."
                />
              ) : null}
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
