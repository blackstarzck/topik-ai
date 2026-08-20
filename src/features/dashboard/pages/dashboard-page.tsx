import {
  Alert,
  Button,
  Card,
  Col,
  List,
  Row,
  Space,
  Statistic,
  Tag,
  Typography
} from 'antd';
import {
  BellOutlined,
  CreditCardOutlined,
  MessageOutlined,
  TeamOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useCallback, useMemo } from 'react';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { useNavigate } from 'react-router-dom';

import { useCommerceStore } from '@/features/billing/model/commerce-store';
import {
  fetchDashboardStatsSafe,
  type DashboardStats
} from '../api/dashboard-stats-service';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { BackupStatusCard } from '../components/backup-status-card';

const { Paragraph, Text } = Typography;

type QueueItem = {
  key: string;
  title: string;
  // Supabase 모드 로딩/오류 시 '—' 표시를 위해 문자열 허용.
  count: number | string;
  route: string;
  actionLabel: string;
};

// 직전 동일기간 대비 상대 변화율(%). 이전 값 0이면 현재>0 → 100%로 간주.
function relChange(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

// sent/(sent+failed) 도달률(%). 분모 0이면 null(발송 이력 없음).
function deliveryRate(sent: number, failed: number): number | null {
  const denominator = sent + failed;
  if (denominator === 0) {
    return null;
  }
  return Math.round((sent / denominator) * 100);
}

type AlertItem = {
  key: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  route: string;
};

export default function DashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const refunds = useCommerceStore((state) => state.refunds);
  // mock 모드 폴백용(스토어 기반). Supabase 모드는 RPC 집계값을 쓴다.
  const pendingRefundCount = refunds.filter((refund) => refund.status === '처리 대기').length;

  // Supabase 모드 실데이터 집계(get_admin_dashboard_stats). mock 모드는 data=null.
  const fetchStats = useCallback(
    (signal: AbortSignal) => fetchDashboardStatsSafe(signal),
    []
  );
  const { state: statsState, reload: reloadStats } = useAsyncResource<DashboardStats | null>(
    fetchStats,
    { initialData: null }
  );

  const stats = statsState.data;
  const statsLoading = isSupabaseConfigured && statsState.status === 'pending';

  const handleRetryStats = reloadStats;

  // 실데이터가 있으면 그대로, Supabase 모드 로딩/오류면 '—', mock 모드면 목업 값.
  const displayCount = useCallback(
    (real: number | undefined, mock: number): number | string => {
      if (real !== undefined) {
        return real;
      }
      return isSupabaseConfigured ? '—' : mock;
    },
    []
  );

  const summaryCards = useMemo(
    () => [
      {
        key: 'new-users',
        title: '오늘 신규 회원',
        value: displayCount(stats?.newUsersToday, 124),
        suffix: '명'
      },
      {
        key: 'pending-reports',
        title: '처리 대기 신고',
        value: displayCount(stats?.pendingReports, 37),
        suffix: '건'
      },
      {
        key: 'refund-queue',
        title: '환불 처리 대기',
        value: displayCount(stats?.pendingRefunds, pendingRefundCount),
        suffix: '건'
      },
      {
        key: 'scheduled-messages',
        title: '예약 발송 대기',
        value: displayCount(stats?.scheduledDispatches, 12),
        suffix: '건'
      }
    ],
    [displayCount, pendingRefundCount, stats]
  );

  const quickLinks = useMemo(
    () => [
      {
        key: 'users',
        title: '회원 관리',
        description: '정지/해제, 관리자 메모, 회원 상세 확인',
        route: '/users'
      },
      {
        key: 'reports',
        title: '신고 관리',
        description: '커뮤니티 신고 검토와 후속 조치',
        route: '/community/reports'
      },
      {
        key: 'refunds',
        title: '환불 관리',
        description: '환불 대기 건 승인·거절 처리',
        route: '/commerce/refunds'
      },
      {
        key: 'messages',
        title: '메시지 이력',
        description: '메일/푸시 발송 결과와 실패 건 확인',
        route: '/messages/history?channel=mail'
      }
    ],
    []
  );

  const queueItems = useMemo<QueueItem[]>(
    () => [
      {
        key: 'queue-report',
        title: '신고 처리 대기',
        count: displayCount(stats?.pendingReports, 37),
        route: '/community/reports',
        actionLabel: '신고 관리'
      },
      {
        key: 'queue-refund',
        title: '환불 승인 대기',
        count: displayCount(stats?.pendingRefunds, pendingRefundCount),
        route: '/commerce/refunds?status=처리 대기',
        actionLabel: '환불 확인'
      },
      {
        key: 'queue-message',
        title: '메시지 실패(최근 7일)',
        count: displayCount(stats?.failedDeliveries7d, 6),
        route: '/messages/history?channel=mail&status=실패',
        actionLabel: '이력 보기'
      },
      {
        // 권한 변경은 즉시 반영이라 "승인 대기" 개념이 없음 → 최근 변경 이력 건수로 대체.
        key: 'queue-admin',
        title: '최근 권한 변경(7일)',
        count: displayCount(stats?.roleChanges7d, 3),
        route: '/system/permissions',
        actionLabel: '권한 관리'
      }
    ],
    [displayCount, pendingRefundCount, stats]
  );

  const alertItems = useMemo<AlertItem[]>(() => {
    // Supabase 모드 실데이터 경고: 하드코딩 문구 대신 집계값으로 계산한다.
    if (stats) {
      const items: AlertItem[] = [];

      items.push({
        key: 'alert-refund',
        severity: stats.pendingRefundsOver24h > 0 ? 'critical' : 'info',
        title: '환불 처리 SLA',
        description:
          stats.pendingRefundsOver24h > 0
            ? `24시간이 경과한 환불 대기 건이 ${stats.pendingRefundsOver24h}건 있습니다.`
            : '현재 24시간 경과 환불 대기 건은 없습니다.',
        route: '/commerce/refunds?status=처리 대기'
      });

      const reportDelta = relChange(stats.reportsNew7d, stats.reportsNewPrev7d);
      items.push({
        key: 'alert-report',
        severity: stats.reportsNew7d > stats.reportsNewPrev7d ? 'warning' : 'info',
        title: '신고 추이(최근 7일)',
        description:
          stats.reportsNew7d === 0 && stats.reportsNewPrev7d === 0
            ? '최근 14일 신규 신고가 없습니다.'
            : `최근 7일 신규 신고 ${stats.reportsNew7d}건, 직전 7일 대비 ${
                reportDelta >= 0 ? '+' : ''
              }${reportDelta}% 입니다.`,
        route: '/community/reports'
      });

      const pushRate = deliveryRate(stats.pushSent7d, stats.pushFailed7d);
      const pushRatePrev = deliveryRate(stats.pushSentPrev7d, stats.pushFailedPrev7d);
      items.push({
        key: 'alert-message',
        severity:
          pushRate !== null && pushRatePrev !== null && pushRate < pushRatePrev
            ? 'warning'
            : 'info',
        title: '푸시 도달률(최근 7일)',
        description:
          pushRate === null
            ? '최근 7일 푸시 발송 이력이 없습니다.'
            : `최근 7일 푸시 도달률 ${pushRate}%${
                pushRatePrev !== null
                  ? `, 직전 7일 대비 ${pushRate - pushRatePrev >= 0 ? '+' : ''}${
                      pushRate - pushRatePrev
                    }%p`
                  : ''
              } 입니다.`,
        route: '/messages/history?channel=push'
      });

      return items;
    }

    // mock 모드 폴백(기존 목업 유지).
    return [
      {
        key: 'alert-refund',
        severity: 'critical',
        title: '환불 처리 SLA 초과 예정',
        description:
          pendingRefundCount > 0
            ? `24시간 내 처리해야 하는 환불 대기 건이 ${pendingRefundCount}건 있습니다.`
            : '현재 SLA 초과 예정 환불 건은 없습니다.',
        route: '/commerce/refunds?status=처리 대기'
      },
      {
        key: 'alert-report',
        severity: 'warning',
        title: '신고 누적 게시글 증가',
        description: '최근 7일 기준 신고 누적 게시글이 14% 증가했습니다.',
        route: '/community/reports'
      },
      {
        key: 'alert-message',
        severity: 'info',
        title: '푸시 도달률 하락',
        description: '푸시 발송 도달률이 최근 3일 기준 4% 하락했습니다.',
        route: '/messages/history?channel=push'
      }
    ];
  }, [pendingRefundCount, stats]);

  const alertColorMap: Record<AlertItem['severity'], string> = {
    critical: 'volcano',
    warning: 'gold',
    info: 'blue'
  };

  const alertLabelMap: Record<AlertItem['severity'], string> = {
    critical: '긴급',
    warning: '주의',
    info: '안내'
  };

  return (
    <div>
      <PageTitle title="대시보드" />

      {isSupabaseConfigured && statsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="대시보드 지표 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{statsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Button size="small" onClick={handleRetryStats}>
                재시도
              </Button>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]}>
        {summaryCards.map((card) => (
          <Col key={card.key} xs={24} md={12} xl={6}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                suffix={typeof card.value === 'number' ? card.suffix : undefined}
                loading={statsLoading}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={8}>
          <Card
            title="빠른 진입"
            extra={
              <Button type="link" onClick={() => navigate('/analytics')}>
                분석 보기
              </Button>
            }
          >
            <Row gutter={[12, 12]}>
              {quickLinks.map((item) => (
                <Col key={item.key} xs={24} sm={12}>
                  <Card size="small" hoverable onClick={() => navigate(item.route)}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text strong>{item.title}</Text>
                      <Text type="secondary">{item.description}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} xl={5}>
          <Card title="처리 대기 큐">
            <List
              dataSource={queueItems}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key={`${item.key}-action`}
                      type="link"
                      onClick={() => navigate(item.route)}
                    >
                      {item.actionLabel}
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      item.key.includes('refund') ? (
                        <CreditCardOutlined />
                      ) : item.key.includes('message') ? (
                        <MessageOutlined />
                      ) : item.key.includes('admin') ? (
                        <TeamOutlined />
                      ) : (
                        <WarningOutlined />
                      )
                    }
                    title={item.title}
                    description={
                      typeof item.count === 'number'
                        ? `${item.count.toLocaleString()}건`
                        : item.count
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={5}>
          <Card title="운영 경고">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {alertItems.map((item) => (
                <Alert
                  key={item.key}
                  showIcon
                  type={
                    item.severity === 'critical'
                      ? 'error'
                      : item.severity === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                  message={
                    <Space>
                      <span>{item.title}</span>
                      <Tag color={alertColorMap[item.severity]}>
                        {alertLabelMap[item.severity]}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <Paragraph style={{ marginBottom: 0 }}>{item.description}</Paragraph>
                      <Button type="link" icon={<BellOutlined />} onClick={() => navigate(item.route)}>
                        관련 화면 보기
                      </Button>
                    </Space>
                  }
                />
              ))}
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={6}>
          <BackupStatusCard />
        </Col>
      </Row>
    </div>
  );
}
