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
  const pendingRefundCount = refunds.filter((refund) => refund.status === '泥섎━ 대기).length;

  const summaryCards = useMemo(
    () => [
      {
        key: 'new-users',
        title: '?ㅻ뒛 ?좉퇋 회원',
        value: 124,
        suffix: '紐?
      },
      {
        key: 'pending-reports',
        title: '泥섎━ 대기신고',
        value: 37,
        suffix: '嫄?
      },
      {
        key: 'refund-queue',
        title: '환불 泥섎━ 대기,
        value: pendingRefundCount,
        suffix: '嫄?
      },
      {
        key: 'scheduled-messages',
        title: '예약 발송 대기,
        value: 12,
        suffix: '嫄?
      }
    ],
    [pendingRefundCount]
  );

  const quickLinks = useMemo(
    () => [
      {
        key: 'users',
        title: '회원 愿由?,
        description: '정지/?댁젣, 관리자 메모, 회원 상세 ?뺤씤',
        route: '/users'
      },
      {
        key: 'reports',
        title: '신고 愿由?,
        description: '커뮤니티 신고 寃?좎? ?꾩냽 議곗튂',
        route: '/community/reports'
      },
      {
        key: 'refunds',
        title: '환불 愿由?,
        description: '환불 대기嫄??뱀씤쨌嫄곗젅 泥섎━',
        route: '/commerce/refunds'
      },
      {
        key: 'messages',
        title: '硫붿떆吏 ?대젰',
        description: '硫붿씪/?몄떆 발송 寃곌낵? 실패 嫄??뺤씤',
        route: '/messages/history?channel=mail'
      }
    ],
    []
  );

  const queueItems = useMemo<QueueItem[]>(
    () => [
      {
        key: 'queue-report',
        title: '신고 泥섎━ 대기,
        count: 37,
        route: '/community/reports',
        actionLabel: '신고 愿由?
      },
      {
        key: 'queue-refund',
        title: '환불 ?뱀씤 대기,
        count: pendingRefundCount,
        route: '/commerce/refunds?status=泥섎━ 대기,
        actionLabel: '환불 ?뺤씤'
      },
      {
        key: 'queue-message',
        title: '硫붿떆吏 실패 寃??,
        count: 6,
        route: '/messages/history?channel=mail&status=실패',
        actionLabel: '?대젰 蹂닿린'
      },
      {
        key: 'queue-admin',
        title: '沅뚰븳 蹂寃?寃??,
        count: 3,
        route: '/system/permissions',
        actionLabel: '권한 관리
      }
    ],
    [pendingRefundCount]
  );

  const alertItems = useMemo<AlertItem[]>(
    () => [
      {
        key: 'alert-refund',
        severity: 'critical',
        title: '환불 泥섎━ SLA 珥덇낵 ?덉젙',
        description:
          pendingRefundCount > 0
            ? `24?쒓컙 ??泥섎━?댁빞 ?섎뒗 환불 대기嫄댁씠 ${pendingRefundCount}嫄??덉뒿?덈떎.`
            : '?꾩옱 SLA 珥덇낵 ?덉젙 환불 嫄댁? ?놁뒿?덈떎.',
        route: '/commerce/refunds?status=泥섎━ 대기
      },
      {
        key: 'alert-report',
        severity: 'warning',
        title: '신고 ?꾩쟻 게시글 利앷?',
        description: '理쒓렐 7??湲곗? 신고 ?꾩쟻 게시글??14% 利앷??덉뒿?덈떎.',
        route: '/community/reports'
      },
      {
        key: 'alert-message',
        severity: 'info',
        title: '?몄떆 ?꾨떖瑜??섎씫',
        description: '?몄떆 발송 ?꾨떖瑜좎씠 理쒓렐 3??湲곗? 4% ?섎씫?덉뒿?덈떎.',
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
    critical: '湲닿툒',
    warning: '二쇱쓽',
    info: '?덈궡'
  };

  return (
    <div>
      <PageTitle title="대시보드 />

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
            title="鍮좊Ⅸ 吏꾩엯"
            extra={
              <Button type="link" onClick={() => navigate('/analytics')}>
                분석 蹂닿린
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
          <Card title="泥섎━ 대기??>
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
                    description={`${item.count.toLocaleString()}嫄?}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={7}>
          <Card title="운영 寃쎄퀬">
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
                        愿???붾㈃ 蹂닿린
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


