import {
  Button,
  Card,
  Descriptions,
  Empty,
  notification,
  Space,
  Table,
  Tabs,
  Typography
} from 'antd';
import type { TableColumnsType, TabsProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { getMockUserById } from '../api/mock-users';
import type { UserStatus } from '../model/types';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Paragraph, Text } = Typography;

type UsersDetailTabKey =
  | 'profile'
  | 'activity'
  | 'payments'
  | 'community'
  | 'logs'
  | 'admin-memo';

type PendingAction = 'suspend' | 'unsuspend' | 'withdraw' | null;

type ActionMeta = {
  title: string;
  confirmText: string;
  description: string;
  nextStatus: UserStatus;
};

const allowedTabs: readonly UsersDetailTabKey[] = [
  'profile',
  'activity',
  'payments',
  'community',
  'logs',
  'admin-memo'
];

function isUsersDetailTab(value: string | null): value is UsersDetailTabKey {
  return typeof value === 'string' && allowedTabs.includes(value as UsersDetailTabKey);
}

function buildActionMeta(
  currentStatus: UserStatus
): Record<Exclude<PendingAction, null>, ActionMeta> {
  return {
    suspend: {
      title: '회원 정지',
      confirmText: '정지 실행',
      description: '회원 기능을 즉시 제한합니다. 조치 사유와 근거를 기록하세요.',
      nextStatus: '정지'
    },
    unsuspend: {
      title: '회원 정지 해제',
      confirmText: '정지 해제',
      description: '회원 기능을 다시 활성화합니다. 해제 사유와 근거를 기록하세요.',
      nextStatus: '정상'
    },
    withdraw: {
      title: '회원 탈퇴 처리',
      confirmText: '탈퇴 처리',
      description: '복구가 어려운 조치입니다. 대상과 사유를 반드시 다시 확인하세요.',
      nextStatus: currentStatus === '탈퇴' ? '탈퇴' : '탈퇴'
    }
  };
}

export default function UserDetailPage(): JSX.Element {
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const user = useMemo(() => getMockUserById(userId), [userId]);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [currentStatus, setCurrentStatus] = useState<UserStatus>(
    user?.status ?? '정상'
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    setCurrentStatus(user.status);
  }, [user]);

  const activeTab = useMemo<UsersDetailTabKey>(() => {
    const tab = searchParams.get('tab');
    return isUsersDetailTab(tab) ? tab : 'profile';
  }, [searchParams]);

  const actionMeta = useMemo(() => buildActionMeta(currentStatus), [currentStatus]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (!isUsersDetailTab(nextTab)) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set('tab', nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const closeActionModal = useCallback(() => setPendingAction(null), []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!user || !pendingAction) {
        return;
      }

      const meta = actionMeta[pendingAction];
      setCurrentStatus(meta.nextStatus);
      notificationApi.success({
        message: `${meta.title} 완료`,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
            <Text>대상 ID: {user.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Users" targetId={user.id} />
          </Space>
        )
      });
      setPendingAction(null);
    },
    [actionMeta, notificationApi, pendingAction, user]
  );

  const activityRows = useMemo(
    () => [
      {
        id: `${userId}-A1`,
        type: '로그인',
        content: 'TOPIK 웹 로그인',
        createdAt: '2026-03-03 09:12',
        ip: '121.133.11.42'
      },
      {
        id: `${userId}-A2`,
        type: '게시글',
        content: '시험 학습 질문',
        createdAt: '2026-03-03 12:40',
        ip: '121.133.11.42'
      }
    ],
    [userId]
  );

  const paymentRows = useMemo(
    () => [
      {
        id: `${userId}-P1`,
        product: 'TOPIK Premium Monthly',
        amount: '₩9,000',
        method: '카드',
        paidAt: '2026-02-14',
        status: '완료'
      },
      {
        id: `${userId}-P2`,
        product: 'TOPIK Mock Test',
        amount: '₩5,000',
        method: '계좌이체',
        paidAt: '2026-01-03',
        status: '환불'
      }
    ],
    [userId]
  );

  const communityRows = useMemo(
    () => [
      {
        id: `${userId}-C1`,
        title: '필기 연습 노트도 공유합니다',
        board: '자유게시판',
        createdAt: '2026-02-21',
        reports: 0,
        status: '게시'
      },
      {
        id: `${userId}-C2`,
        title: '시험 후기 공유',
        board: '후기',
        createdAt: '2026-01-20',
        reports: 2,
        status: '숨김'
      }
    ],
    [userId]
  );

  const logRows = useMemo(
    () => [
      {
        id: `${userId}-L1`,
        type: '로그인',
        ip: '121.133.11.42',
        device: 'Windows Chrome',
        createdAt: '2026-03-03 09:12'
      },
      {
        id: `${userId}-L2`,
        type: 'API',
        ip: '121.133.11.42',
        device: 'Windows Chrome',
        createdAt: '2026-03-03 09:15'
      }
    ],
    [userId]
  );

  const memoRows = useMemo(
    () => [
      {
        id: `${userId}-M1`,
        admin: 'admin_park',
        content: '결제 문의 확인 후 환불 처리 가이드 전달',
        createdAt: '2026-02-15'
      },
      {
        id: `${userId}-M2`,
        admin: 'admin_kim',
        content: '커뮤니티 신고 건 모니터링 필요',
        createdAt: '2026-02-22'
      }
    ],
    [userId]
  );

  const activityColumns = useMemo<TableColumnsType<(typeof activityRows)[number]>>(
    () => [
      { title: '활동 ID', dataIndex: 'id', width: 160 },
      { title: '활동 유형', dataIndex: 'type', width: 120 },
      { title: '콘텐츠', dataIndex: 'content' },
      { title: '활동 시각', dataIndex: 'createdAt', width: 180 },
      { title: 'IP', dataIndex: 'ip', width: 160 }
    ],
    []
  );

  const paymentColumns = useMemo<TableColumnsType<(typeof paymentRows)[number]>>(
    () => [
      { title: '결제 ID', dataIndex: 'id', width: 150 },
      { title: '상품', dataIndex: 'product' },
      { title: '결제 금액', dataIndex: 'amount', width: 130, align: 'right' },
      { title: '결제 수단', dataIndex: 'method', width: 120 },
      { title: '결제일', dataIndex: 'paidAt', width: 130 },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'action',
        width: 180,
        render: (_, record) => (
          <Space size={8}>
            <Text>{record.id}</Text>
            <Link to="/billing/payments">결제 페이지로 이동</Link>
          </Space>
        )
      }
    ],
    []
  );

  const communityColumns = useMemo<TableColumnsType<(typeof communityRows)[number]>>(
    () => [
      { title: '게시글 ID', dataIndex: 'id', width: 160 },
      { title: '제목', dataIndex: 'title' },
      { title: '게시판', dataIndex: 'board', width: 120 },
      { title: '작성일', dataIndex: 'createdAt', width: 120 },
      { title: '신고 수', dataIndex: 'reports', width: 90, align: 'right' },
      {
        title: '상태',
        dataIndex: 'status',
        width: 110,
        render: (status: string) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const logsColumns = useMemo<TableColumnsType<(typeof logRows)[number]>>(
    () => [
      { title: '로그 ID', dataIndex: 'id', width: 150 },
      { title: '로그 유형', dataIndex: 'type', width: 120 },
      { title: 'IP', dataIndex: 'ip', width: 160 },
      { title: '기기', dataIndex: 'device', width: 170 },
      { title: '시각', dataIndex: 'createdAt', width: 190 }
    ],
    []
  );

  const memoColumns = useMemo<TableColumnsType<(typeof memoRows)[number]>>(
    () => [
      { title: '메모 ID', dataIndex: 'id', width: 150 },
      { title: '관리자', dataIndex: 'admin', width: 130 },
      { title: '내용', dataIndex: 'content' },
      { title: '작성일', dataIndex: 'createdAt', width: 130 }
    ],
    []
  );

  const tabs = useMemo<NonNullable<TabsProps['items']>>(
    () => [
      {
        key: 'profile',
        label: '프로필',
        children: user ? (
          <Descriptions
            bordered
            column={2}
            items={[
              { key: 'id', label: '사용자 ID', children: user.id },
              { key: 'email', label: '이메일', children: user.email },
              { key: 'nickname', label: '닉네임', children: user.nickname },
              { key: 'joinedAt', label: '가입일', children: user.joinedAt },
              { key: 'lastLoginAt', label: '최근 로그인', children: user.lastLoginAt },
              {
                key: 'status',
                label: '회원 상태',
                children: <StatusBadge status={currentStatus} />
              },
              { key: 'tier', label: '회원 등급', children: user.tier },
              {
                key: 'subscriptionStatus',
                label: '구독 상태',
                children: user.subscriptionStatus
              }
            ]}
          />
        ) : null
      },
      {
        key: 'activity',
        label: '활동',
        children: (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={activityRows}
            columns={activityColumns}
          />
        )
      },
      {
        key: 'payments',
        label: '결제',
        children: (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={paymentRows}
            columns={paymentColumns}
          />
        )
      },
      {
        key: 'community',
        label: '커뮤니티',
        children: (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={communityRows}
            columns={communityColumns}
          />
        )
      },
      {
        key: 'logs',
        label: '로그',
        children: (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={logRows}
            columns={logsColumns}
          />
        )
      },
      {
        key: 'admin-memo',
        label: '관리자 메모',
        children: (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={memoRows}
            columns={memoColumns}
          />
        )
      }
    ],
    [
      activityColumns,
      activityRows,
      communityColumns,
      communityRows,
      currentStatus,
      logRows,
      logsColumns,
      memoColumns,
      memoRows,
      paymentColumns,
      paymentRows,
      user
    ]
  );

  if (!user) {
    return (
      <Card>
        <Empty description="회원 정보를 찾을 수 없습니다." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Link to="/users">Users 목록으로 이동</Link>
        </Empty>
      </Card>
    );
  }

  return (
    <div>
      {notificationContextHolder}
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <div>
          <PageTitle title="사용자 상세" />
          <Paragraph className="page-description">
            {user.nickname} ({user.email}) / 사용자 ID: {user.id}
          </Paragraph>
        </div>

        <Card>
          <Space size={10} wrap style={{ marginBottom: 12 }}>
            <Button danger onClick={() => setPendingAction('suspend')}>
              계정 정지
            </Button>
            <Button onClick={() => setPendingAction('unsuspend')}>정지 해제</Button>
            <Button danger onClick={() => setPendingAction('withdraw')}>
              탈퇴 처리
            </Button>
            <AuditLogLink targetType="Users" targetId={user.id} />
          </Space>
          <Tabs activeKey={activeTab} items={tabs} onChange={handleTabChange} />
        </Card>
      </Space>

      {pendingAction ? (
        <ConfirmAction
          open
          title={actionMeta[pendingAction].title}
          description={actionMeta[pendingAction].description}
          confirmText={actionMeta[pendingAction].confirmText}
          targetType="Users"
          targetId={user.id}
          onCancel={closeActionModal}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </div>
  );
}
