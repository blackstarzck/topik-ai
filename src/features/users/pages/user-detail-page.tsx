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
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createNumberSorter,
  createNumericTextSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { formatUserDisplayName } from '../../../shared/ui/user/user-reference';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Text } = Typography;

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

type DetailModalState = {
  title: string;
  record: Record<string, unknown>;
} | null;

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
  const [detailModalState, setDetailModalState] = useState<DetailModalState>(null);
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
  const isAccountSuspended = currentStatus === '정지';

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
  const closeDetailModal = useCallback(() => setDetailModalState(null), []);

  const openDetailModal = useCallback(
    (title: string, record: Record<string, unknown>) => {
      setDetailModalState({ title, record });
    },
    []
  );

  const handleToggleSuspend = useCallback(() => {
    setPendingAction(isAccountSuspended ? 'unsuspend' : 'suspend');
  }, [isAccountSuspended]);

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
      {
        title: '활동 ID',
        dataIndex: 'id',
        width: 160,
        ...createColumnFilterProps(activityRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '활동 유형',
        dataIndex: 'type',
        width: 120,
        ...createColumnFilterProps(activityRows, (record) => record.type),
        sorter: createTextSorter((record) => record.type)
      },
      {
        title: '콘텐츠',
        dataIndex: 'content',
        ...createColumnFilterProps(activityRows, (record) => record.content),
        sorter: createTextSorter((record) => record.content)
      },
      {
        title: '활동 시각',
        dataIndex: 'createdAt',
        width: 180,
        ...createColumnFilterProps(activityRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 160,
        ...createColumnFilterProps(activityRows, (record) => record.ip),
        sorter: createTextSorter((record) => record.ip)
      }
    ],
    [activityRows]
  );

  const paymentColumns = useMemo<TableColumnsType<(typeof paymentRows)[number]>>(
    () => [
      {
        title: '결제 ID',
        dataIndex: 'id',
        width: 150,
        ...createColumnFilterProps(paymentRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id),
        render: (id: string) => (
          <Link
            className="table-navigation-link"
            to="/commerce/payments"
            onClick={(event) => event.stopPropagation()}
          >
            {id}
          </Link>
        )
      },
      {
        title: '상품',
        dataIndex: 'product',
        ...createColumnFilterProps(paymentRows, (record) => record.product),
        sorter: createTextSorter((record) => record.product)
      },
      {
        title: '결제 금액',
        dataIndex: 'amount',
        width: 130,
        align: 'right',
        ...createColumnFilterProps(paymentRows, (record) => record.amount),
        sorter: createNumericTextSorter((record) => record.amount)
      },
      {
        title: '결제 수단',
        dataIndex: 'method',
        width: 120,
        ...createColumnFilterProps(paymentRows, (record) => record.method),
        sorter: createTextSorter((record) => record.method)
      },
      {
        title: '결제일',
        dataIndex: 'paidAt',
        width: 130,
        ...createColumnFilterProps(paymentRows, (record) => record.paidAt),
        sorter: createTextSorter((record) => record.paidAt)
      },
      {
        title: createStatusColumnTitle('상태', ['완료', '취소', '환불']),
        dataIndex: 'status',
        width: 100,
        ...createColumnFilterProps(paymentRows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      }
    ],
    [paymentRows]
  );

  const communityColumns = useMemo<TableColumnsType<(typeof communityRows)[number]>>(
    () => [
      {
        title: '게시글 ID',
        dataIndex: 'id',
        width: 160,
        ...createColumnFilterProps(communityRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id),
        render: (id: string) => (
          <Link
            className="table-navigation-link"
            to="/community/posts"
            onClick={(event) => event.stopPropagation()}
          >
            {id}
          </Link>
        )
      },
      {
        title: '제목',
        dataIndex: 'title',
        ...createColumnFilterProps(communityRows, (record) => record.title),
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '게시판',
        dataIndex: 'board',
        width: 120,
        ...createColumnFilterProps(communityRows, (record) => record.board),
        sorter: createTextSorter((record) => record.board)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 120,
        ...createColumnFilterProps(communityRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '신고 수',
        dataIndex: 'reports',
        width: 90,
        align: 'right',
        ...createColumnFilterProps(communityRows, (record) => record.reports),
        sorter: createNumberSorter((record) => record.reports)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 110,
        ...createColumnFilterProps(communityRows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      }
    ],
    [communityRows]
  );

  const logsColumns = useMemo<TableColumnsType<(typeof logRows)[number]>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 150,
        ...createColumnFilterProps(logRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '로그 유형',
        dataIndex: 'type',
        width: 120,
        ...createColumnFilterProps(logRows, (record) => record.type),
        sorter: createTextSorter((record) => record.type)
      },
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 160,
        ...createColumnFilterProps(logRows, (record) => record.ip),
        sorter: createTextSorter((record) => record.ip)
      },
      {
        title: '기기',
        dataIndex: 'device',
        width: 170,
        ...createColumnFilterProps(logRows, (record) => record.device),
        sorter: createTextSorter((record) => record.device)
      },
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 190,
        ...createColumnFilterProps(logRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    [logRows]
  );

  const memoColumns = useMemo<TableColumnsType<(typeof memoRows)[number]>>(
    () => [
      {
        title: '메모 ID',
        dataIndex: 'id',
        width: 150,
        ...createColumnFilterProps(memoRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '관리자',
        dataIndex: 'admin',
        width: 130,
        ...createColumnFilterProps(memoRows, (record) => record.admin),
        sorter: createTextSorter((record) => record.admin),
        render: (admin: string) => (
          <Link
            className="table-navigation-link"
            to="/system/admins"
            onClick={(event) => event.stopPropagation()}
          >
            {admin}
          </Link>
        )
      },
      {
        title: '내용',
        dataIndex: 'content',
        ...createColumnFilterProps(memoRows, (record) => record.content),
        sorter: createTextSorter((record) => record.content)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 130,
        ...createColumnFilterProps(memoRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    [memoRows]
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
                  {
                    key: 'realName',
                    label: '이름',
                    children: formatUserDisplayName(user.realName, user.id)
                  },
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
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={activityRows}
            columns={activityColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('활동 상세 (더미)', record),
              style: { cursor: 'pointer' }
            })}
          />
        )
      },
      {
        key: 'payments',
        label: '결제',
        children: (
          <Table
            rowKey="id"
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={paymentRows}
            columns={paymentColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('결제 상세 (더미)', record),
              style: { cursor: 'pointer' }
            })}
          />
        )
      },
      {
        key: 'community',
        label: '커뮤니티',
        children: (
          <Table
            rowKey="id"
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={communityRows}
            columns={communityColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('커뮤니티 상세 (더미)', record),
              style: { cursor: 'pointer' }
            })}
          />
        )
      },
      {
        key: 'logs',
        label: '로그',
        children: (
          <Table
            rowKey="id"
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={logRows}
            columns={logsColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('로그 상세 (더미)', record),
              style: { cursor: 'pointer' }
            })}
          />
        )
      },
      {
        key: 'admin-memo',
        label: '관리자 메모',
        children: (
          <Table
            rowKey="id"
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={memoRows}
            columns={memoColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('관리자 메모 상세 (더미)', record),
              style: { cursor: 'pointer' }
            })}
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
      openDetailModal,
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
          <PageTitle title="Users 상세" />
        </div>

        <Card>
          <section
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 12
            }}
          >
            <Space size={10} wrap>
              <Button
                danger={!isAccountSuspended}
                disabled={currentStatus === '탈퇴' || pendingAction !== null}
                onClick={handleToggleSuspend}
              >
                {isAccountSuspended ? '정지 해제' : '계정 정지'}
              </Button>
              <Button danger onClick={() => setPendingAction('withdraw')}>
                탈퇴 처리
              </Button>
              <AuditLogLink targetType="Users" targetId={user.id} />
            </Space>
          </section>
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
      <TableRowDetailModal
        open={Boolean(detailModalState)}
        title={detailModalState?.title ?? ''}
        record={detailModalState?.record ?? null}
        onClose={closeDetailModal}
      />
    </div>
  );
}
