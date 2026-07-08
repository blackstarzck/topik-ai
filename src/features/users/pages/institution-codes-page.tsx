import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cancelInstitutionInvitationSafe,
  clearInstitutionCodeSafe,
  createInstitutionCodeSafe,
  deleteInstitutionCodeSafe,
  fetchInstitutionCodeMembersSafe,
  fetchInstitutionCodesSafe,
  fetchInstitutionInvitationsSafe,
  inviteInstitutionMembersSafe,
  isInstitutionCodesSupabase,
  updateInstitutionCodeSafe
} from '../api/institution-codes-service';
import { fetchUsersSafe } from '../api/users-service';
import { kickNotificationEmailDispatch } from '../../../shared/api/notification-email-kick';
import { InvitationEmailStatusTag } from '../ui/invitation-email-status-tag';
import {
  institutionCodeKinds,
  institutionCodeStatuses
} from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeMember,
  InstitutionCodeStatus,
  InstitutionInvitation
} from '../model/institution-codes-types';
import type { UserSummary } from '../model/types';
import { usePermissionStore } from '../../system/model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  InstitutionQuestionExposureModal,
  type InstitutionQuestionMutationSummary
} from '../ui/institution-question-exposure-modal';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  TableActionMenu,
  type TableActionMenuItem
} from '../../../shared/ui/table/table-action-menu';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const CODE_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;
const pageSizeOptions = ['20', '50', '100'];

const kindOptions = institutionCodeKinds.map((kind) => ({ label: kind, value: kind }));
const statusOptions = institutionCodeStatuses.map((status) => ({
  label: status,
  value: status
}));

type CreateFormValues = {
  code: string;
  label: string;
  kind: InstitutionCodeKind;
  note?: string;
};

type EditFormValues = {
  label: string;
  kind: InstitutionCodeKind;
  status: InstitutionCodeStatus;
  note?: string;
  reason: string;
};

// 회원 관리 모달 통합 로스터 행 — 대기 중 초대와 소속 회원을 한 테이블로 묶는다.
type MemberRosterRow = {
  key: string;
  kind: 'invitation' | 'member';
  name: string;
  email: string;
  /** member 행만: 회원 상태(정상/정지/탈퇴). invitation 행은 '초대 대기' 태그로 렌더. */
  memberStatus: string;
  /** member: 가입일, invitation: 초대일. */
  date: string;
  invitation?: InstitutionInvitation;
  member?: InstitutionCodeMember;
};

function todayText(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Descriptions 라벨에는 Form.Item 의 필수 표시(*)가 붙지 않으므로 직접 부여한다.
function requiredLabel(text: string): JSX.Element {
  return (
    <span>
      {text}
      <span style={{ color: '#ff4d4f', marginInlineStart: 4 }}>*</span>
    </span>
  );
}

export default function InstitutionCodesPage(): JSX.Element {
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [codesState, setCodesState] = useState<AsyncState<InstitutionCode[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InstitutionCode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InstitutionCode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [createForm] = Form.useForm<CreateFormValues>();
  const [editForm] = Form.useForm<EditFormValues>();

  // 회원 관리(코드별 회원 추가/제거) 모달.
  const [memberTarget, setMemberTarget] = useState<InstitutionCode | null>(null);
  const [membersState, setMembersState] = useState<AsyncState<InstitutionCodeMember[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [memberReload, setMemberReload] = useState(0);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [addForm] = Form.useForm<{
    userIds: string[];
    reason: string;
    expiresInDays: number;
  }>();
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<InstitutionCodeMember | null>(null);
  // 대기 중(pending) 초대 목록 + 초대 취소 대상. memberReload 카운터를 함께 재사용한다.
  const [invitationsState, setInvitationsState] = useState<
    AsyncState<InstitutionInvitation[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [cancelInviteTarget, setCancelInviteTarget] =
    useState<InstitutionInvitation | null>(null);

  // 노출 문항 관리 모달(기관별 전용 노출 문항 추가/제거).
  const [questionExposureTarget, setQuestionExposureTarget] =
    useState<InstitutionCode | null>(null);

  // 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 코드 생성/수정(is_admin)과 달리 회원 관리는
  // platform_admin RPC라, 권한 미보유자에겐 회원 관리 컨트롤을 숨긴다(다른 두 화면과 일관).
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageMembers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  useEffect(() => {
    const controller = new AbortController();

    setCodesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCodesState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setCodesState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  // 회원 관리 모달이 열린 코드의 소속 회원 목록 로드.
  useEffect(() => {
    if (!memberTarget) {
      return;
    }
    const code = memberTarget.code;
    const controller = new AbortController();

    setMembersState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodeMembersSafe(code, undefined, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setMembersState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setMembersState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [memberTarget, memberReload]);

  // 회원 관리 모달이 열린 코드의 대기 중(pending) 초대 목록 로드.
  useEffect(() => {
    if (!memberTarget) {
      return;
    }
    const code = memberTarget.code;
    const controller = new AbortController();

    setInvitationsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionInvitationsSafe(
      { code, status: 'pending' },
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setInvitationsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setInvitationsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [memberTarget, memberReload]);

  // 회원 추가 피커용 회원 디렉터리(최초 모달 오픈 시 1회). 실패해도 제거 기능엔 영향 없음.
  useEffect(() => {
    if (!memberTarget || allUsers.length > 0) {
      return;
    }
    const controller = new AbortController();
    void fetchUsersSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setAllUsers(result.data);
    });
    return () => {
      controller.abort();
    };
  }, [memberTarget, allUsers.length]);

  const summary = useMemo(
    () => ({
      total: codesState.data.length,
      active: codesState.data.filter((item) => item.status === '활성').length,
      members: codesState.data.reduce((sum, item) => sum + item.memberCount, 0)
    }),
    [codesState.data]
  );

  const openCreate = useCallback(() => {
    setCreateOpen(true);
  }, []);

  const openEdit = useCallback((record: InstitutionCode) => {
    setEditTarget(record);
  }, []);

  const openDelete = useCallback((record: InstitutionCode) => {
    setDeleteTarget(record);
  }, []);

  const openMembers = useCallback((record: InstitutionCode) => {
    setMemberTarget(record);
  }, []);

  const openQuestionExposure = useCallback((record: InstitutionCode) => {
    setQuestionExposureTarget(record);
  }, []);

  const buildCodeActionItems = useCallback(
    (record: InstitutionCode): TableActionMenuItem[] => {
      const items: TableActionMenuItem[] = [];

      if (canManageMembers) {
        items.push(
          {
            key: `members-${record.code}`,
            label: '회원 관리',
            onClick: () => openMembers(record)
          },
          {
            key: `questions-${record.code}`,
            label: '노출 문항',
            onClick: () => openQuestionExposure(record)
          }
        );
      }

      items.push(
        {
          key: `edit-${record.code}`,
          label: '수정',
          onClick: () => openEdit(record)
        },
        {
          key: `delete-${record.code}`,
          label: '삭제',
          danger: true,
          disabled: record.memberCount > 0,
          title:
            record.memberCount > 0
              ? '가입 회원이 있는 코드는 먼저 회원 소속을 해제해야 합니다.'
              : undefined,
          onClick: () => openDelete(record)
        }
      );

      return items;
    },
    [canManageMembers, openDelete, openEdit, openMembers, openQuestionExposure]
  );

  const closeMembers = useCallback(() => {
    setMemberTarget(null);
    setRemoveTarget(null);
    setCancelInviteTarget(null);
  }, []);

  // 회원 추가 모달이 열릴 때 이전 입력값 초기화(폼 마운트 후).
  useEffect(() => {
    if (memberTarget) {
      addForm.resetFields();
    }
  }, [memberTarget, addForm]);

  // 이미 이 코드 소속이거나 대기 중 초대가 있는 회원은 초대 피커에서 제외.
  // 라벨에 현재 소속 코드를 함께 표기.
  const memberUserIdSet = useMemo(
    () => new Set(membersState.data.map((member) => member.userId)),
    [membersState.data]
  );
  const pendingInviteUserIdSet = useMemo(
    () => new Set(invitationsState.data.map((invitation) => invitation.userId)),
    [invitationsState.data]
  );
  const addUserOptions = useMemo(
    () =>
      allUsers
        .filter(
          (user) => !memberUserIdSet.has(user.id) && !pendingInviteUserIdSet.has(user.id)
        )
        .map((user) => {
          const name = user.realName || user.nickname || '(이름 없음)';
          const current = user.affiliationCode ? ` · 현재: ${user.affiliationCode}` : '';
          return {
            value: user.id,
            label: `${name} · ${user.email}${current}`
          };
        }),
    [allUsers, memberUserIdSet, pendingInviteUserIdSet]
  );

  const handleAddMembers = useCallback(async () => {
    if (!memberTarget || addSubmitting) {
      return;
    }
    // submitting을 검증 await 전에 세워 더블 서밋 창을 닫는다.
    setAddSubmitting(true);
    let values: { userIds: string[]; reason: string; expiresInDays: number };
    try {
      values = await addForm.validateFields();
    } catch {
      setAddSubmitting(false);
      return;
    }
    if (!values.userIds || values.userIds.length === 0) {
      setAddSubmitting(false);
      return;
    }

    const result = await inviteInstitutionMembersSafe(
      values.userIds,
      memberTarget.code,
      values.reason,
      values.expiresInDays ?? 7
    );
    setAddSubmitting(false);

    if (!result.ok) {
      notificationApi.error({ message: '초대 발송 실패', description: result.error.message });
      return;
    }

    if (result.data === 0) {
      notificationApi.info({
        message: '초대 대상 없음',
        description: '이미 소속이거나 대기 중 초대가 있어 새로 보낸 초대가 없습니다.'
      });
    } else {
      // 이메일이 cron 주기를 기다리지 않도록 워커 즉시 kick(실패해도 cron 이 수거).
      void kickNotificationEmailDispatch();
      notificationApi.success({
        message: '초대 발송 완료',
        description: `${result.data.toLocaleString()}명에게 초대를 보냈습니다. 인앱 알림은 즉시 전달되고 이메일 발송을 시작했습니다. 발송 결과는 메시지 ▸ 발송 이력에서 확인할 수 있습니다. (이미 소속·대기 중 제외)`
      });
    }
    addForm.resetFields();
    setMemberReload((prev) => prev + 1);
    setReloadKey((prev) => prev + 1);
  }, [addForm, addSubmitting, memberTarget, notificationApi]);

  const handleCancelInvitationConfirm = useCallback(
    async (reason: string) => {
      if (!cancelInviteTarget) {
        return;
      }
      const result = await cancelInstitutionInvitationSafe(
        cancelInviteTarget.invitationId,
        reason
      );
      if (!result.ok) {
        notificationApi.error({ message: '초대 취소 실패', description: result.error.message });
        setCancelInviteTarget(null);
        return;
      }
      notificationApi.success({
        message: '초대 취소 완료',
        description: `${cancelInviteTarget.realName || cancelInviteTarget.email} 의 ${cancelInviteTarget.code} 초대를 취소했습니다.`
      });
      setCancelInviteTarget(null);
      setMemberReload((prev) => prev + 1);
    },
    [cancelInviteTarget, notificationApi]
  );

  const handleRemoveConfirm = useCallback(
    async (reason: string) => {
      if (!memberTarget || !removeTarget) {
        return;
      }
      const result = await clearInstitutionCodeSafe([removeTarget.userId], reason);
      if (!result.ok) {
        notificationApi.error({ message: '회원 제거 실패', description: result.error.message });
        setRemoveTarget(null);
        return;
      }
      notificationApi.success({
        message: '회원 제거 완료',
        description: `${removeTarget.realName || removeTarget.email} 의 ${memberTarget.code} 소속이 해제되었습니다.`
      });
      setRemoveTarget(null);
      setMemberReload((prev) => prev + 1);
      setReloadKey((prev) => prev + 1);
    },
    [memberTarget, removeTarget, notificationApi]
  );

  const handleQuestionExposureMutated = useCallback(
    (summary: InstitutionQuestionMutationSummary) => {
      const modeLabel = summary.mode === 'add' ? '추가' : '해제';
      const r = summary.result;
      const hasIssue = r.blocked > 0 || r.failed > 0;
      const description = (
        <Space direction="vertical" size={4}>
          <Text>
            변경 {r.changed.toLocaleString()}건 · 변경 없음{' '}
            {r.unchanged.toLocaleString()}건
            {r.blocked > 0 ? ` · 차단 ${r.blocked.toLocaleString()}건` : ''}
            {r.failed > 0 ? ` · 실패 ${r.failed.toLocaleString()}건` : ''}
          </Text>
          {r.details.slice(0, 5).map((detail) => (
            <Text key={`${detail.kind}-${detail.questionId}`} type="secondary">
              [{detail.kind === 'blocked' ? '차단' : '실패'}] {detail.questionId}:{' '}
              {detail.message}
            </Text>
          ))}
        </Space>
      );
      const notify = hasIssue ? notificationApi.warning : notificationApi.success;
      notify({
        message: hasIssue
          ? `노출 문항 ${modeLabel} 일부 처리`
          : `노출 문항 ${modeLabel} 완료`,
        description
      });
    },
    [notificationApi]
  );

  const handleCreateSubmit = useCallback(async () => {
    let values: CreateFormValues;
    try {
      values = await createForm.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const code = values.code.trim();
      const label = values.label.trim();
      const note = values.note?.trim() ?? '';

      const result = await createInstitutionCodeSafe({ code, label, kind: values.kind, note });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 생성 실패',
          description: result.error.message
        });
        return;
      }

      if (isInstitutionCodesSupabase) {
        setReloadKey((prev) => prev + 1);
      } else {
        const created: InstitutionCode = {
          code,
          label,
          kind: values.kind,
          status: '활성',
          note,
          memberCount: 0,
          createdAt: todayText(),
          updatedAt: todayText()
        };
        setCodesState((prev) => ({
          ...prev,
          data: [created, ...prev.data],
          status: 'success'
        }));
      }

      notificationApi.success({
        message: '기관 코드 생성 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {code}</Text>
            <Text>이름: {label}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={code} />
          </Space>
        )
      });
      setCreateOpen(false);
    } finally {
      setSubmitting(false);
    }
  }, [createForm, notificationApi]);

  const handleEditSubmit = useCallback(async () => {
    if (!editTarget) {
      return;
    }

    let values: EditFormValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const label = values.label.trim();
      const note = values.note?.trim() ?? '';
      const reason = values.reason.trim();

      const result = await updateInstitutionCodeSafe({
        code: editTarget.code,
        label,
        kind: values.kind,
        status: values.status,
        note,
        reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 수정 실패',
          description: result.error.message
        });
        return;
      }

      if (isInstitutionCodesSupabase) {
        setReloadKey((prev) => prev + 1);
      } else {
        setCodesState((prev) => ({
          ...prev,
          data: prev.data.map((item) =>
            item.code === editTarget.code
              ? {
                  ...item,
                  label,
                  kind: values.kind,
                  status: values.status,
                  note,
                  updatedAt: todayText()
                }
              : item
          )
        }));
      }

      notificationApi.success({
        message: '기관 코드 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {editTarget.code}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={editTarget.code} />
          </Space>
        )
      });
      setEditTarget(null);
    } finally {
      setSubmitting(false);
    }
  }, [editForm, editTarget, notificationApi]);

  const handleDeleteConfirm = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const code = deleteTarget.code;
      const result = await deleteInstitutionCodeSafe({ code, reason });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 삭제 실패',
          description: result.error.message
        });
        return;
      }

      if (isInstitutionCodesSupabase) {
        setReloadKey((prev) => prev + 1);
      } else {
        setCodesState((prev) => {
          const data = prev.data.filter((item) => item.code !== code);
          return {
            ...prev,
            data,
            status: data.length === 0 ? 'empty' : 'success'
          };
        });
      }

      setEditTarget((prev) => (prev?.code === code ? null : prev));
      setMemberTarget((prev) => (prev?.code === code ? null : prev));
      setQuestionExposureTarget((prev) => (prev?.code === code ? null : prev));
      setDeleteTarget(null);
      notificationApi.success({
        message: '기관 코드 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {code}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={code} />
          </Space>
        )
      });
    },
    [deleteTarget, notificationApi]
  );

  const columns = useMemo<TableColumnsType<InstitutionCode>>(
    () => [
      {
        title: '코드',
        dataIndex: 'code',
        width: 200,
        sorter: createTextSorter((record) => record.code),
        render: (code: string) => (
          <Text strong copyable>
            {code}
          </Text>
        )
      },
      {
        title: '이름',
        dataIndex: 'label',
        width: 260,
        sorter: createTextSorter((record) => record.label)
      },
      {
        title: '종류',
        dataIndex: 'kind',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeKinds, (record) => record.kind),
        render: (kind: InstitutionCodeKind) => <Tag>{kind}</Tag>
      },
      {
        title: createStatusColumnTitle('상태', institutionCodeStatuses),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeStatuses, (record) => record.status),
        render: (status: InstitutionCodeStatus) => <StatusBadge status={status} />
      },
      {
        title: '가입 수',
        dataIndex: 'memberCount',
        width: 110,
        align: 'right',
        sorter: createNumberSorter((record) => record.memberCount),
        render: (memberCount: number) => memberCount.toLocaleString()
      },
      {
        title: '생성일',
        dataIndex: 'createdAt',
        width: 130,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '액션',
        key: 'action',
        width: 120,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => <TableActionMenu items={buildCodeActionItems(record)} />
      }
    ],
    [buildCodeActionItems]
  );

  // 소속 회원 + 대기 중 초대를 한 테이블로 합친 로스터(오너 결정 2026-07-07).
  // 초대 행은 상태 태그('초대 대기')와 초대 취소 액션으로, 회원 행은 회원 상태와 제거 액션으로 구분한다.
  const rosterRows = useMemo<MemberRosterRow[]>(
    () => [
      ...invitationsState.data.map((invitation) => ({
        key: `invitation-${invitation.invitationId}`,
        kind: 'invitation' as const,
        name: invitation.realName || invitation.nickname || '(이름 없음)',
        email: invitation.email,
        memberStatus: '',
        date: invitation.createdAt,
        invitation
      })),
      ...membersState.data.map((member) => ({
        key: `member-${member.userId}`,
        kind: 'member' as const,
        name: member.realName || member.nickname || '(이름 없음)',
        email: member.email,
        memberStatus: member.status,
        date: member.joinedAt,
        member
      }))
    ],
    [invitationsState.data, membersState.data]
  );

  const rosterColumns = useMemo<TableColumnsType<MemberRosterRow>>(
    () => [
      {
        title: '회원',
        dataIndex: 'name',
        render: (_, record) => <Text>{record.name}</Text>
      },
      { title: '이메일', dataIndex: 'email' },
      {
        title: '상태',
        key: 'status',
        width: 128,
        render: (_, record) =>
          record.kind === 'invitation' && record.invitation ? (
            <Space direction="vertical" size={2}>
              <Tooltip
                title={
                  record.invitation.expiresAt
                    ? `만료일: ${record.invitation.expiresAt}`
                    : undefined
                }
              >
                <Tag color="gold" style={{ marginInlineEnd: 0 }}>
                  초대 대기
                </Tag>
              </Tooltip>
              <InvitationEmailStatusTag invitation={record.invitation} />
            </Space>
          ) : (
            record.memberStatus
          )
      },
      { title: '가입·초대일', dataIndex: 'date', width: 120 },
      {
        title: '액션',
        key: 'action',
        width: 96,
        render: (_, record) => {
          if (!canManageMembers) {
            return null;
          }
          if (record.kind === 'invitation' && record.invitation) {
            const invitation = record.invitation;
            return (
              <Button
                type="link"
                size="small"
                danger
                onClick={() => setCancelInviteTarget(invitation)}
              >
                초대 취소
              </Button>
            );
          }
          if (record.member) {
            const member = record.member;
            return (
              <Button type="link" size="small" danger onClick={() => setRemoveTarget(member)}>
                제거
              </Button>
            );
          }
          return null;
        }
      }
    ],
    [canManageMembers]
  );

  const toolbar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Space size="large" wrap>
        <Text type="secondary">총 {summary.total.toLocaleString()}건</Text>
        <Text type="secondary">활성 {summary.active.toLocaleString()}건</Text>
        <Text type="secondary">누적 가입 {summary.members.toLocaleString()}명</Text>
      </Space>
      <Button type="primary" size="large" onClick={openCreate}>
        코드 생성
      </Button>
    </div>
  );

  return (
    <>
      {notificationContextHolder}
      <PageTitle title="기관 코드" />
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        박람회/기관 유입 QR에 싣는 코드를 등록·관리합니다. 회원이 이 코드를 달고 가입하면 기관 회원으로 추적됩니다.
        {!isInstitutionCodesSupabase && ' (현재 mock 데이터 — 생성/수정/삭제는 화면에만 반영됩니다.)'}
      </Paragraph>

      <AdminListCard toolbar={toolbar}>
        <AdminDataTable<InstitutionCode>
          rowKey="code"
          columns={columns}
          dataSource={codesState.data}
          loading={codesState.status === 'pending'}
          pagination={{
            pageSize: 20,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total.toLocaleString()}건`
          }}
        />
      </AdminListCard>

      <Modal
        open={createOpen}
        title="기관 코드 생성"
        okText="생성"
        cancelText="취소"
        confirmLoading={submitting}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreateSubmit()}
        destroyOnHidden
      >
        <Form form={createForm} layout="vertical" initialValues={{ kind: '박람회' }}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
          >
            <Descriptions.Item label={requiredLabel('코드')}>
              <Form.Item
                name="code"
                style={{ margin: 0 }}
                extra="QR 주소에 실리는 식별자 · 영문/숫자/-/_ 2~64자"
                rules={[
                  { required: true, message: '코드를 입력하세요.' },
                  {
                    validator: async (_, value: string | undefined) => {
                      if (value && !CODE_PATTERN.test(value.trim())) {
                        throw new Error('영문/숫자/-/_ 2~64자만 사용할 수 있습니다.');
                      }
                    }
                  }
                ]}
              >
                <Input placeholder="EXPO2026-BOOTH-A" autoComplete="off" />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('이름')}>
              <Form.Item
                name="label"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '이름을 입력하세요.' }]}
              >
                <Input placeholder="2026 한국어교육 박람회 · A부스" />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('종류')}>
              <Form.Item
                name="kind"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '종류를 선택하세요.' }]}
              >
                <Select options={kindOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="메모">
              <Form.Item name="note" style={{ margin: 0 }}>
                <Input.TextArea rows={2} placeholder="현장 QR 가입 · A부스" />
              </Form.Item>
            </Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal
        open={editTarget !== null}
        title={editTarget ? `기관 코드 수정 · ${editTarget.code}` : '기관 코드 수정'}
        okText="수정"
        cancelText="취소"
        confirmLoading={submitting}
        onCancel={() => setEditTarget(null)}
        onOk={() => void handleEditSubmit()}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={
            editTarget
              ? {
                  label: editTarget.label,
                  kind: editTarget.kind,
                  status: editTarget.status,
                  note: editTarget.note,
                  reason: ''
                }
              : undefined
          }
        >
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 96, whiteSpace: 'nowrap' }}
          >
            <Descriptions.Item label="코드">
              <Text strong>{editTarget?.code}</Text>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('이름')}>
              <Form.Item
                name="label"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '이름을 입력하세요.' }]}
              >
                <Input />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('종류')}>
              <Form.Item
                name="kind"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '종류를 선택하세요.' }]}
              >
                <Select options={kindOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('상태')}>
              <Form.Item
                name="status"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '상태를 선택하세요.' }]}
              >
                <Select options={statusOptions} style={{ width: '100%' }} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label="메모">
              <Form.Item name="note" style={{ margin: 0 }}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Descriptions.Item>
            <Descriptions.Item label={requiredLabel('변경 사유')}>
              <Form.Item
                name="reason"
                style={{ margin: 0 }}
                rules={[{ required: true, message: '변경 사유를 입력하세요.' }]}
              >
                <Input.TextArea rows={2} placeholder="감사 로그에 기록됩니다." />
              </Form.Item>
            </Descriptions.Item>
          </Descriptions>
        </Form>
      </Modal>

      <Modal
        open={memberTarget !== null}
        width={720}
        title={memberTarget ? `회원 관리 · ${memberTarget.code}` : '회원 관리'}
        footer={<Button onClick={closeMembers}>닫기</Button>}
        onCancel={closeMembers}
        destroyOnHidden
      >
        {memberTarget ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Text type="secondary">{memberTarget.label}</Text>

            {canManageMembers ? (
              <Form form={addForm} layout="vertical">
                <Form.Item
                  label="회원 초대"
                  name="userIds"
                  rules={[{ required: true, message: '초대할 회원을 선택하세요.' }]}
                  extra="초대 알림(인앱+이메일)이 발송되고, 회원이 수락해야 소속이 적용됩니다. 발송 내역은 메시지 ▸ 발송 이력에서 확인할 수 있습니다."
                >
                  <Select
                    mode="multiple"
                    placeholder="이름 또는 이메일로 검색하세요."
                    options={addUserOptions}
                    showSearch
                    optionFilterProp="label"
                    maxTagCount="responsive"
                  />
                </Form.Item>
                <Form.Item
                  label="만료 기간"
                  name="expiresInDays"
                  initialValue={7}
                  rules={[{ required: true, message: '만료 기간을 입력하세요.' }]}
                  extra="이 기간 안에 응답하지 않으면 초대가 만료됩니다."
                >
                  <InputNumber min={1} max={365} addonAfter="일" style={{ width: 140 }} />
                </Form.Item>
                <Form.Item
                  label="사유/근거"
                  name="reason"
                  rules={[{ required: true, message: '초대 사유를 입력하세요.' }]}
                >
                  <Input.TextArea rows={2} placeholder="감사 기록에 남길 초대 사유를 입력하세요." />
                </Form.Item>
                <Button
                  type="primary"
                  loading={addSubmitting}
                  onClick={() => void handleAddMembers()}
                >
                  선택 회원 초대
                </Button>
              </Form>
            ) : null}

            <div>
              <Text strong>
                소속 회원 {membersState.data.length.toLocaleString()}명 · 대기 중 초대{' '}
                {invitationsState.data.length.toLocaleString()}건
              </Text>
              {membersState.status === 'error' ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 8 }}
                  message={membersState.errorMessage ?? '회원 목록 조회에 실패했습니다.'}
                />
              ) : null}
              {invitationsState.status === 'error' ? (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginTop: 8 }}
                  message={invitationsState.errorMessage ?? '초대 목록 조회에 실패했습니다.'}
                />
              ) : null}
              <div style={{ marginTop: 8 }}>
                <AdminDataTable<MemberRosterRow>
                  rowKey="key"
                  columns={rosterColumns}
                  dataSource={rosterRows}
                  loading={
                    membersState.status === 'pending' ||
                    invitationsState.status === 'pending'
                  }
                  pagination={false}
                  scroll={{ y: 320 }}
                />
              </div>
            </div>

            {!isInstitutionCodesSupabase ? (
              <Text type="secondary">
                현재 mock 데이터 — 초대/제거는 화면에만 반영되며 목록은 비어 있습니다.
              </Text>
            ) : null}
          </Space>
        ) : null}
      </Modal>

      {memberTarget && removeTarget ? (
        <ConfirmAction
          open
          title="기관 소속 해제"
          description={`${removeTarget.realName || removeTarget.email} 의 ${
            memberTarget.code
          } 소속을 해제합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={removeTarget.userId}
          confirmText="해제 실행"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleRemoveConfirm}
        />
      ) : null}

      {cancelInviteTarget ? (
        <ConfirmAction
          open
          title="기관 초대 취소"
          description={`${cancelInviteTarget.realName || cancelInviteTarget.email} 에게 보낸 ${
            cancelInviteTarget.code
          } 초대를 취소합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={cancelInviteTarget.userId}
          confirmText="취소 실행"
          reasonPlaceholder="초대 취소 사유를 입력하세요."
          onCancel={() => setCancelInviteTarget(null)}
          onConfirm={handleCancelInvitationConfirm}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmAction
          open
          title="기관 코드 삭제"
          description={`${deleteTarget.code} 코드를 삭제합니다. 가입 수가 1명 이상이면 서버에서 삭제를 차단하며, 삭제된 코드는 가입/QR 유입과 기관 전용 문항 노출 대상에서 더 이상 사용할 수 없습니다.`}
          targetType="InstitutionCode"
          targetId={deleteTarget.code}
          confirmText="삭제 실행"
          reasonPlaceholder="삭제 사유를 입력하세요."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {questionExposureTarget ? (
        <InstitutionQuestionExposureModal
          open
          institution={questionExposureTarget}
          canManage={canManageMembers}
          isSupabase={isInstitutionCodesSupabase}
          onClose={() => setQuestionExposureTarget(null)}
          onMutated={handleQuestionExposureMutated}
        />
      ) : null}
    </>
  );
}
