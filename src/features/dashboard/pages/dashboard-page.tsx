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
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCommerceStore } from '../../billing/model/commerce-store';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph, Text } = Typography;

type QueueItem = {
  key: string;
  title: string;
  count: number;
  route: string;
  actionLabel: string;
};

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
  const pendingRefundCount = refunds.filter((refund) => refund.status === '처리 대기').length;

  const summaryCards = useMemo(
    () => [
      {
        key: 'new-users',
        title: '오늘 신규 회원',
        value: 124,
        suffix: '명'
      },
      {
        key: 'pending-reports',
        title: '처리 대기 신고',
        value: 37,
        suffix: '건'
      },
      {
        key: 'refund-queue',
        title: '환불 처리 대기',
        value: pendingRefundCount,
        suffix: '건'
      },
      {
        key: 'scheduled-messages',
        title: '예약 발송 대기',
        value: 12,
        suffix: '건'
      }
    ],
    [pendingRefundCount]
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
        count: 37,
        route: '/community/reports',
        actionLabel: '신고 관리'
      },
      {
        key: 'queue-refund',
        title: '환불 승인 대기',
        count: pendingRefundCount,
        route: '/commerce/refunds?status=처리 대기',
        actionLabel: '환불 확인'
      },
      {
        key: 'queue-message',
        title: '메시지 실패 검토',
        count: 6,
        route: '/messages/history?channel=mail&status=실패',
        actionLabel: '이력 보기'
      },
      {
        key: 'queue-admin',
        title: '권한 변경 검토',
        count: 3,
        route: '/system/permissions',
        actionLabel: '권한 관리'
      }
    ],
    [pendingRefundCount]
  );

  const alertItems = useMemo<AlertItem[]>(
    () => [
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
    ],
    [pendingRefundCount]
  );

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

      <Row gutter={[16, 16]}>
        {summaryCards.map((card) => (
          <Col key={card.key} xs={24} md={12} xl={6}>
            <Card>
              <Statistic title={card.title} value={card.value} suffix={card.suffix} />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} xl={10}>
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

        <Col xs={24} xl={7}>
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
                    description={`${item.count.toLocaleString()}건`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
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
      </Row>
    </div>
  );
}
