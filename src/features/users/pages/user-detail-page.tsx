import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tabs,
  Typography,
  notification
} from 'antd';
import type { TabsProps } from 'antd';

const { Text } = Typography;
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import {
  addUserMemo,
  deleteUserMemo,
  fetchUserByIdSafe,
  fetchUserLearningOverviewSafe,
  getUserActivity,
  getUserCommunityPosts,
  getUserLegalConsents,
  getUserMemos,
  getUserPayments,
  setUserStatusSafe,
  type UserActivityEvent,
  type UserAdminMemo,
  type UserCommunityPost,
  type UserLegalConsent,
  type UserPaymentRecord
} from '../api/users-service';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import { usePermissionStore } from '@/features/system/model/permission-store';
import type {
  UserLearningOverview,
  UserStatus,
  UserSummary
} from '../model/types';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import {
  buildActionMeta,
  buildUserActivityRows,
  buildUserCommunityRows,
  buildUserMemoRows,
  buildUserPaymentRows,
  isUsersDetailTab,
  type DetailModalState,
  type PendingAction,
  type UsersDetailTabKey
} from '../model/user-detail-page-schema';
import { AffiliationTabPanel } from '../ui/user-detail-affiliation-tab';
import {
  createUserActivityColumns,
  createUserCommunityColumns,
  createUserMemoColumns,
  createUserPaymentColumns
} from '../ui/user-detail-columns';
import { UserDetailLearningTab } from '../ui/user-detail-learning-tab';
import { UserDetailProfileTab } from '../ui/user-detail-profile-tab';
import type { AsyncState } from '@/shared/model/async-state';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { TableRowDetailModal } from '@/shared/ui/table/table-row-detail-modal';

export default function UserDetailPage(): JSX.Element {
  const { userId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const [userState, setUserState] = useState<AsyncState<UserSummary | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [detailModalState, setDetailModalState] = useState<DetailModalState>(null);
  const [currentStatus, setCurrentStatus] = useState<UserStatus>('정상');
  const [communityPosts, setCommunityPosts] = useState<UserCommunityPost[]>([]);
  const [adminMemos, setAdminMemos] = useState<UserAdminMemo[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivityEvent[]>([]);
  const [userPayments, setUserPayments] = useState<UserPaymentRecord[]>([]);
  const [legalConsents, setLegalConsents] = useState<UserLegalConsent[]>([]);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoContent, setMemoContent] = useState('');
  const [memoReason, setMemoReason] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const [memoToDelete, setMemoToDelete] = useState<UserAdminMemo | null>(null);
  const [learningState, setLearningState] = useState<AsyncState<UserLearningOverview | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  // 기관 소속 변경 후 회원 정보를 재조회하기 위한 키.
  const [userReloadKey, setUserReloadKey] = useState(0);

  // 기관 코드 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 미보유 시 편집 컨트롤 숨김.
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageInstitutionCodes = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  const handleAffiliationChanged = useCallback(() => {
    setUserReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setUserState((prev) => ({ ...prev, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchUserByIdSafe(userId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setUserState({
          status: result.data ? 'success' : 'empty',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setUserState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });
    return () => controller.abort();
  }, [userId, userReloadKey]);

  const user = userState.data ?? undefined;

  useEffect(() => {
    if (!user) {
      return;
    }
    setCurrentStatus(user.status);
  }, [user]);

  // 학습 현황 탭: Supabase 모드는 실 DB(get_admin_user_learning_overview), 그 외 mock.
  useEffect(() => {
    const controller = new AbortController();
    setLearningState((prev) => ({ ...prev, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchUserLearningOverviewSafe(userId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setLearningState({
          status: 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setLearningState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });
    return () => controller.abort();
  }, [userId]);

  // 커뮤니티/메모 탭은 Supabase 모드에서 실 DB로 조회한다(미설정 시 mock 표시).
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const controller = new AbortController();
    void getUserCommunityPosts(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setCommunityPosts(result.data);
      }
    });
    return () => controller.abort();
  }, [userId]);

  const reloadMemos = useCallback(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    void getUserMemos(userId).then((result) => {
      if (result.ok) {
        setAdminMemos(result.data);
      }
    });
  }, [userId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const controller = new AbortController();
    void getUserMemos(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setAdminMemos(result.data);
      }
    });
    return () => controller.abort();
  }, [userId]);

  // 활동(study_events)/결제(payment_history) 탭과 약관 동의 버전은 Supabase 모드에서 admin RPC로
  // 조회한다(미설정 시 mock 표시). 접속 로그 목록 탭은 제거됨(프로필 '최근 로그인'만 노출).
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const controller = new AbortController();
    void getUserActivity(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setUserActivity(result.data);
      }
    });
    void getUserPayments(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setUserPayments(result.data);
      }
    });
    void getUserLegalConsents(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setLegalConsents(result.data);
      }
    });
    return () => controller.abort();
  }, [userId]);

  const handleAddMemo = useCallback(async () => {
    const content = memoContent.trim();
    const reason = memoReason.trim();
    if (!content || !reason) {
      notificationApi.warning({ message: '메모 내용과 사유를 모두 입력하세요.' });
      return;
    }
    setMemoSubmitting(true);
    const result = await addUserMemo(userId, content, reason);
    setMemoSubmitting(false);
    if (!result.ok) {
      notificationApi.error({ message: '메모 추가 실패', description: result.error.message });
      return;
    }
    notificationApi.success({
      message: '관리자 메모를 추가했습니다.',
      description: <AuditLogLink targetType="User" targetId={userId} />
    });
    setMemoModalOpen(false);
    setMemoContent('');
    setMemoReason('');
    reloadMemos();
  }, [memoContent, memoReason, notificationApi, reloadMemos, userId]);

  const handleDeleteMemo = useCallback(
    async (reason: string) => {
      if (!memoToDelete) {
        return;
      }
      const result = await deleteUserMemo(memoToDelete.id, reason);
      if (!result.ok) {
        notificationApi.error({ message: '메모 삭제 실패', description: result.error.message });
        return;
      }
      notificationApi.success({
        message: '관리자 메모를 삭제했습니다.',
        description: <AuditLogLink targetType="User" targetId={userId} />
      });
      setMemoToDelete(null);
      reloadMemos();
    },
    [memoToDelete, notificationApi, reloadMemos, userId]
  );

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

      // withdraw(탈퇴) write stays blocked pending the owner's decision (D-F);
      // the server rejects 'deleted' too.
      if (pendingAction === 'withdraw') {
        notificationApi.warning({
          message: '탈퇴 처리는 현재 비활성화되어 있습니다',
          description: '탈퇴(withdraw) 처리는 정책 확정 전까지 차단됩니다 (D-F).'
        });
        setPendingAction(null);
        return;
      }

      // Persist via the audited RPC (admin_set_user_status). Mock mode = no-op success.
      const result = await setUserStatusSafe(user.id, meta.nextStatus);
      if (!result.ok) {
        notificationApi.error({
          message: `${meta.title} 실패`,
          description: result.error.message
        });
        setPendingAction(null);
        return;
      }

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

  const activityRows = useMemo(() => buildUserActivityRows(userId), [userId]);
  const paymentRows = useMemo(() => buildUserPaymentRows(userId), [userId]);
  const communityRows = useMemo(() => buildUserCommunityRows(userId), [userId]);
  const memoRows = useMemo(() => buildUserMemoRows(userId), [userId]);

  // Supabase 모드: 실 DB 조회 결과, 그 외(mock): 위 더미 행.
  const communityDisplay = isSupabaseConfigured ? communityPosts : communityRows;
  const memoDisplay = isSupabaseConfigured ? adminMemos : memoRows;
  const activityDisplay = isSupabaseConfigured ? userActivity : activityRows;
  const paymentDisplay = isSupabaseConfigured ? userPayments : paymentRows;

  const activityColumns = useMemo(() => createUserActivityColumns(), []);
  const paymentColumns = useMemo(() => createUserPaymentColumns(), []);
  const communityColumns = useMemo(() => createUserCommunityColumns(), []);
  const memoColumns = useMemo(
    () => createUserMemoColumns({ onDeleteMemo: setMemoToDelete }),
    []
  );

  // 단계는 학습 RPC의 onboarding 블록(learning_goals)에서 파생한다.
  const tabs = useMemo<NonNullable<TabsProps['items']>>(
    () => [
      {
        key: 'profile',
        label: '프로필',
        children: user ? (
          <UserDetailProfileTab
            user={user}
            currentStatus={currentStatus}
            legalConsents={legalConsents}
          />
        ) : null
      },
      {
        key: 'affiliation',
        label: '기관 소속',
        children: user ? (
          <AffiliationTabPanel
            userId={userId}
            affiliationCode={user.affiliationCode}
            affiliationLabel={user.affiliationLabel}
            canManage={canManageInstitutionCodes}
            notificationApi={notificationApi}
            onChanged={handleAffiliationChanged}
          />
        ) : null
      },
      {
        key: 'learning',
        label: '학습 현황',
        children: (
          <UserDetailLearningTab
            user={user ?? null}
            learningState={learningState}
            onOpenDetail={openDetailModal}
          />
        )
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
            dataSource={activityDisplay}
            columns={activityColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('활동 상세', record),
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
            dataSource={paymentDisplay}
            columns={paymentColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('결제 상세', record),
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
            dataSource={communityDisplay}
            columns={communityColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('커뮤니티 상세', record),
              style: { cursor: 'pointer' }
            })}
          />
        )
      },
      {
        key: 'admin-memo',
        label: '관리자 메모',
        children: (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {isSupabaseConfigured ? (
              <div style={{ textAlign: 'right' }}>
                <Button type="primary" size="small" onClick={() => setMemoModalOpen(true)}>
                  메모 추가
                </Button>
              </div>
            ) : null}
            <Table
              rowKey="id"
              showSorterTooltip={false}
              size="small"
              pagination={false}
              dataSource={memoDisplay}
              columns={memoColumns}
              onRow={(record) => ({
                onClick: () => openDetailModal('관리자 메모 상세', record),
                style: { cursor: 'pointer' }
              })}
            />
          </Space>
        )
      }
    ],
    [
      activityColumns,
      activityDisplay,
      canManageInstitutionCodes,
      communityColumns,
      communityDisplay,
      currentStatus,
      handleAffiliationChanged,
      learningState,
      legalConsents,
      memoColumns,
      memoDisplay,
      notificationApi,
      paymentColumns,
      paymentDisplay,
      openDetailModal,
      user,
      userId
    ]
  );

  if (userState.status === 'pending') {
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <Empty
          description={userState.errorMessage ?? '회원 정보를 찾을 수 없습니다.'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
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
              <Button
                danger
                disabled={isSupabaseConfigured || pendingAction !== null}
                title={
                  isSupabaseConfigured
                    ? '탈퇴 처리는 정책 확정 전까지 비활성화됩니다 (D-F)'
                    : undefined
                }
                onClick={() => setPendingAction('withdraw')}
              >
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
      {memoToDelete ? (
        <ConfirmAction
          open
          title="관리자 메모 삭제"
          description="이 관리자 메모를 삭제합니다. 삭제 내역은 감사 로그에 기록됩니다."
          confirmText="삭제"
          targetType="User"
          targetId={userId}
          onCancel={() => setMemoToDelete(null)}
          onConfirm={handleDeleteMemo}
        />
      ) : null}
      <TableRowDetailModal
        open={Boolean(detailModalState)}
        title={detailModalState?.title ?? ''}
        record={detailModalState?.record ?? null}
        onClose={closeDetailModal}
      />

      <Modal
        open={memoModalOpen}
        title="관리자 메모 추가"
        okText="추가"
        cancelText="취소"
        confirmLoading={memoSubmitting}
        onOk={() => void handleAddMemo()}
        onCancel={() => setMemoModalOpen(false)}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            rows={4}
            value={memoContent}
            onChange={(event) => setMemoContent(event.target.value)}
            placeholder="메모 내용을 입력하세요."
          />
          <Input
            value={memoReason}
            onChange={(event) => setMemoReason(event.target.value)}
            placeholder="사유/근거 (감사 로그에 기록됩니다)"
          />
        </Space>
      </Modal>
    </div>
  );
}
