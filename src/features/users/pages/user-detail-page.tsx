import {
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  notification,
  Space,
  Spin,
  Table,
  Tabs,
  Typography
} from 'antd';
import type { TableColumnsType, TabsProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import {
  addUserMemo,
  fetchUserByIdSafe,
  fetchUserLearningOverviewSafe,
  getUserAccessLogs,
  getUserActivity,
  getUserCommunityPosts,
  getUserMemos,
  getUserPayments,
  setUserStatusSafe,
  type UserAccessLog,
  type UserActivityEvent,
  type UserAdminMemo,
  type UserCommunityPost,
  type UserPaymentRecord
} from '../api/users-service';
import type { UserLearningOverview, UserStatus, UserSummary } from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createNumericTextSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { formatNationality } from '../../../shared/model/country-name';

const { Text } = Typography;

const emptyProfileValue = '-';

const detailPaymentStatusFilterValues = ['완료', '취소', '환불'] as const;
const detailCommunityBoardFilterValues = ['자유게시판', '후기', '질문'] as const;
const detailCommunityStatusFilterValues = ['게시', '숨김'] as const;

const learningWeaknessSourceLabels: Record<string, string> = {
  domain: '영역',
  tag: '태그',
  writing_dimension: '작문 영역',
  goal: '목표'
};

type UsersDetailTabKey =
  | 'profile'
  | 'learning'
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

function renderProfileValue(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyProfileValue;
}

const allowedTabs: readonly UsersDetailTabKey[] = [
  'profile',
  'learning',
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
  const [userAccessLogs, setUserAccessLogs] = useState<UserAccessLog[]>([]);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoContent, setMemoContent] = useState('');
  const [memoReason, setMemoReason] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const [learningState, setLearningState] = useState<AsyncState<UserLearningOverview | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });

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
  }, [userId]);

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

  // 활동/결제/접속 로그 탭은 Supabase 모드에서 admin RPC로 조회한다(미설정 시 mock 표시).
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
    void getUserAccessLogs(userId, controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setUserAccessLogs(result.data);
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

  // Supabase 모드: 실 DB 조회 결과, 그 외(mock): 위 더미 행.
  const communityDisplay = isSupabaseConfigured ? communityPosts : communityRows;
  const memoDisplay = isSupabaseConfigured ? adminMemos : memoRows;
  const activityDisplay = isSupabaseConfigured ? userActivity : activityRows;
  const paymentDisplay = isSupabaseConfigured ? userPayments : paymentRows;
  const logDisplay = isSupabaseConfigured ? userAccessLogs : logRows;

  const activityColumns = useMemo<TableColumnsType<(typeof activityRows)[number]>>(
    () => [
      {
        title: '활동 ID',
        dataIndex: 'id',
        width: 160,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '활동 유형',
        dataIndex: 'type',
        width: 120,
        sorter: createTextSorter((record) => record.type)
      },
      {
        title: '콘텐츠',
        dataIndex: 'content',
        sorter: createTextSorter((record) => record.content)
      },
      {
        title: '활동 시각',
        dataIndex: 'createdAt',
        width: 180,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 160,
        sorter: createTextSorter((record) => record.ip)
      }
    ],
    []
  );

  const paymentColumns = useMemo<TableColumnsType<(typeof paymentRows)[number]>>(
    () => [
      {
        title: '결제 ID',
        dataIndex: 'id',
        width: 150,
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
        sorter: createTextSorter((record) => record.product)
      },
      {
        title: '결제 금액',
        dataIndex: 'amount',
        width: 130,
        sorter: createNumericTextSorter((record) => record.amount)
      },
      {
        title: '결제 수단',
        dataIndex: 'method',
        width: 120,
        sorter: createTextSorter((record) => record.method)
      },
      {
        title: '결제일',
        dataIndex: 'paidAt',
        width: 130,
        sorter: createTextSorter((record) => record.paidAt)
      },
      {
        title: createStatusColumnTitle('상태', ['완료', '취소', '환불']),
        dataIndex: 'status',
        width: 100,
        ...createDefinedColumnFilterProps(
          detailPaymentStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const communityColumns = useMemo<TableColumnsType<(typeof communityRows)[number]>>(
    () => [
      {
        title: '게시글 ID',
        dataIndex: 'id',
        width: 160,
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
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '게시판',
        dataIndex: 'board',
        width: 120,
        ...createDefinedColumnFilterProps(
          detailCommunityBoardFilterValues,
          (record) => record.board
        ),
        sorter: createTextSorter((record) => record.board)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 120,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '신고 수',
        dataIndex: 'reports',
        width: 90,
        sorter: createNumberSorter((record) => record.reports)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(
          detailCommunityStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const logsColumns = useMemo<TableColumnsType<(typeof logRows)[number]>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 150,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '로그 유형',
        dataIndex: 'type',
        width: 120,
        sorter: createTextSorter((record) => record.type)
      },
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 160,
        sorter: createTextSorter((record) => record.ip)
      },
      {
        title: '기기',
        dataIndex: 'device',
        width: 170,
        sorter: createTextSorter((record) => record.device)
      },
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 190,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  const memoColumns = useMemo<TableColumnsType<(typeof memoRows)[number]>>(
    () => [
      {
        title: '메모 ID',
        dataIndex: 'id',
        width: 150,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '관리자',
        dataIndex: 'admin',
        width: 130,
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
        sorter: createTextSorter((record) => record.content)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 130,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  const learningDomainColumns = useMemo<
    TableColumnsType<UserLearningOverview['domainAccuracy'][number]>
  >(
    () => [
      {
        title: '영역',
        dataIndex: 'domain',
        sorter: createTextSorter((record) => record.domain)
      },
      {
        title: '시도 수',
        dataIndex: 'attempts',
        width: 110,
        sorter: createNumberSorter((record) => record.attempts)
      },
      {
        title: '정답률',
        dataIndex: 'correctRate',
        width: 120,
        sorter: createNumberSorter((record) => record.correctRate ?? -1),
        render: (value: number | null) => (value == null ? '-' : `${value}%`)
      },
      {
        title: '평균 점수',
        dataIndex: 'averageScore',
        width: 120,
        sorter: createNumberSorter((record) => record.averageScore ?? -1),
        render: (value: number | null) => (value == null ? '-' : value)
      }
    ],
    []
  );

  const learningWeaknessColumns = useMemo<
    TableColumnsType<UserLearningOverview['weaknesses'][number]>
  >(
    () => [
      {
        title: '약점',
        dataIndex: 'label',
        sorter: createTextSorter((record) => record.label)
      },
      {
        title: '출처',
        dataIndex: 'source',
        width: 120,
        render: (value: string) => learningWeaknessSourceLabels[value] ?? value
      },
      {
        title: '심각도',
        dataIndex: 'severity',
        width: 100,
        sorter: createNumberSorter((record) => record.severity)
      },
      {
        title: '근거 수',
        dataIndex: 'evidenceCount',
        width: 100,
        sorter: createNumberSorter((record) => record.evidenceCount)
      }
    ],
    []
  );

  const learningAttemptColumns = useMemo<
    TableColumnsType<UserLearningOverview['recentAttempts'][number]>
  >(
    () => [
      {
        title: '문제',
        dataIndex: 'title',
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '영역',
        dataIndex: 'domain',
        width: 90,
        sorter: createTextSorter((record) => record.domain)
      },
      {
        title: '문항',
        dataIndex: 'questionNo',
        width: 80,
        render: (value: number | null) => (value == null ? '-' : value)
      },
      {
        title: '레벨',
        dataIndex: 'topikLevel',
        width: 110
      },
      {
        title: '난이도',
        dataIndex: 'difficulty',
        width: 90
      },
      {
        title: '정오',
        dataIndex: 'isCorrect',
        width: 90,
        render: (value: boolean | null) => (value == null ? '-' : value ? '정답' : '오답')
      },
      {
        title: '점수',
        dataIndex: 'score',
        width: 80,
        render: (value: number | null) => (value == null ? '-' : value)
      },
      {
        title: '소요(초)',
        dataIndex: 'timeSpentSeconds',
        width: 100,
        sorter: createNumberSorter((record) => record.timeSpentSeconds)
      },
      {
        title: '제출일',
        dataIndex: 'submittedAt',
        width: 120,
        sorter: createTextSorter((record) => record.submittedAt)
      }
    ],
    []
  );

  const learningWritingColumns = useMemo<
    TableColumnsType<UserLearningOverview['recentWriting'][number]>
  >(
    () => [
      {
        title: '제출 ID',
        dataIndex: 'submissionId',
        width: 160,
        sorter: createTextSorter((record) => record.submissionId)
      },
      {
        title: '문항',
        dataIndex: 'questionNo',
        width: 80
      },
      {
        title: '채점 상태',
        dataIndex: 'feedbackStatus',
        width: 120
      },
      {
        title: '점수',
        dataIndex: 'scoreTotal',
        width: 110,
        render: (value: number | null, record) =>
          value == null ? '-' : `${value}/${record.scoreMax ?? '-'}`
      },
      {
        title: '약점 차원',
        dataIndex: 'weaknessDimensions',
        render: (value: string[]) => (value && value.length ? value.join(', ') : '-')
      },
      {
        title: '제출일',
        dataIndex: 'submittedAt',
        width: 120,
        sorter: createTextSorter((record) => record.submittedAt)
      }
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
                  {
                    key: 'realName',
                    label: '이름',
                    children: renderProfileValue(user.realName)
                  },
                  { key: 'email', label: '이메일', children: user.email },
              { key: 'nickname', label: '닉네임', children: renderProfileValue(user.nickname) },
              {
                key: 'nationality',
                label: '국적',
                children: renderProfileValue(formatNationality(user.nationalityCode))
              },
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
              },
              {
                key: 'termsConsentStatus',
                label: '약관 동의',
                children: <StatusBadge status={user.termsConsentStatus} />
              },
              {
                key: 'termsConsentAt',
                label: '약관 동의일',
                children: renderProfileValue(user.termsConsentAt)
              }
            ]}
          />
        ) : null
      },
      {
        key: 'learning',
        label: '학습 현황',
        children:
          learningState.status === 'pending' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <Spin />
            </div>
          ) : learningState.status === 'error' ? (
            <Empty
              description={learningState.errorMessage ?? '학습 현황을 불러오지 못했습니다.'}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : learningState.data ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions bordered column={3} size="small" title="요약">
                <Descriptions.Item label="총 풀이 수">
                  {learningState.data.kpis.totalAttempts}
                </Descriptions.Item>
                <Descriptions.Item label="정답률">
                  {learningState.data.kpis.correctRate == null
                    ? '-'
                    : `${learningState.data.kpis.correctRate}%`}
                </Descriptions.Item>
                <Descriptions.Item label="평균 점수">
                  {learningState.data.kpis.averageScore == null
                    ? '-'
                    : learningState.data.kpis.averageScore}
                </Descriptions.Item>
                <Descriptions.Item label="누적 학습시간">
                  {learningState.data.kpis.totalStudyMinutes}분
                </Descriptions.Item>
                <Descriptions.Item label="북마크">
                  {learningState.data.kpis.bookmarkedCount}
                </Descriptions.Item>
                <Descriptions.Item label="작문 제출/채점">
                  {learningState.data.kpis.writingSubmissionCount} /{' '}
                  {learningState.data.kpis.writingFeedbackCount}
                </Descriptions.Item>
                <Descriptions.Item label="최근 활동일">
                  {learningState.data.kpis.latestActivityAt || '-'}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Text strong>영역별 정답률</Text>
                <Table
                  rowKey="domain"
                  showSorterTooltip={false}
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  dataSource={learningState.data.domainAccuracy}
                  columns={learningDomainColumns}
                />
              </div>

              <div>
                <Text strong>약점 영역</Text>
                <Table
                  rowKey="label"
                  showSorterTooltip={false}
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  dataSource={learningState.data.weaknesses}
                  columns={learningWeaknessColumns}
                />
              </div>

              <div>
                <Text strong>최근 풀이 이력</Text>
                <Table
                  rowKey="id"
                  showSorterTooltip={false}
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  dataSource={learningState.data.recentAttempts}
                  columns={learningAttemptColumns}
                  onRow={(record) => ({
                    onClick: () => openDetailModal('풀이 상세', record),
                    style: { cursor: 'pointer' }
                  })}
                />
              </div>

              <div>
                <Text strong>최근 작문 채점</Text>
                <Table
                  rowKey="submissionId"
                  showSorterTooltip={false}
                  size="small"
                  pagination={false}
                  style={{ marginTop: 8 }}
                  dataSource={learningState.data.recentWriting}
                  columns={learningWritingColumns}
                  onRow={(record) => ({
                    onClick: () => openDetailModal('작문 채점 상세', record),
                    style: { cursor: 'pointer' }
                  })}
                />
              </div>
            </Space>
          ) : (
            <Empty description="학습 데이터가 없습니다." image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
        key: 'logs',
        label: '로그',
        children: (
          <Table
            rowKey="id"
            showSorterTooltip={false}
            size="small"
            pagination={false}
            dataSource={logDisplay}
            columns={logsColumns}
            onRow={(record) => ({
              onClick: () => openDetailModal('로그 상세', record),
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
      communityColumns,
      communityDisplay,
      currentStatus,
      learningAttemptColumns,
      learningDomainColumns,
      learningState,
      learningWeaknessColumns,
      learningWritingColumns,
      logDisplay,
      logsColumns,
      memoColumns,
      memoDisplay,
      paymentColumns,
      paymentDisplay,
      openDetailModal,
      user
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
