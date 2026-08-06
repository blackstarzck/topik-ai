import { Alert, Button, Space, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cancelInstitutionInvitationSafe,
  clearInstitutionCodeSafe,
  fetchInstitutionCodeMembersSafe,
  fetchInstitutionInvitationsSafe,
  isInstitutionCodesSupabase
} from '../../api/institution-codes-service';
import { fetchUsersSafe } from '../../api/users-service';
import type {
  InstitutionCode,
  InstitutionCodeMember,
  InstitutionInvitation
} from '../../model/institution-codes-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionSettings
} from '../../model/institution-contracts-types';
import type { UserSummary } from '../../model/types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { InstitutionInviteDrawer } from './institution-invite-drawer';
import { InstitutionMemberPolicyDrawer } from './institution-member-policy-drawer';
import { InstitutionTabToolbar } from './institution-tab-toolbar';
import { InvitationEmailStatusTag } from '../invitation-email-status-tag';
import type { AsyncState } from '../../../../shared/model/async-state';
import { ConfirmAction } from '../../../../shared/ui/confirm-action/confirm-action';
import { AdminDataTable } from '../../../../shared/ui/table/admin-data-table';

const { Text } = Typography;

// 대기 중 초대와 소속 회원을 한 테이블로 묶는 통합 로스터 행(오너 결정 2026-07-07).
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

type InstitutionCodeMembersTabProps = {
  institution: InstitutionCode;
  /** 정원·초대 기본값·만료 차단. null 이면 아직 못 읽은 상태(정책 편집 비활성). */
  settings: InstitutionSettings | null;
  /** 만료 차단이 지금 실제로 걸리는지 판단하려면 계약 요약이 필요하다. */
  contractStatus: InstitutionContractStatusSummary | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 회원 탭 — 구 회원 관리 모달을 승격했다. 초대는 즉시 배정이 아니라 pending 초대를 만들고,
 * 회원이 v13 알림에서 수락해야 소속이 적용된다. 해제만 직접 반영된다.
 *
 * 초대는 `_guarded` wrapper RPC 로 나간다. 원함수를 직접 부르면 정원·계약 차단이 조용히
 * 우회되므로, 파사드에도 가드 없는 초대 함수를 남기지 않았다.
 */
export function InstitutionCodeMembersTab({
  institution,
  settings,
  contractStatus,
  canManage,
  notificationApi,
  onChanged
}: InstitutionCodeMembersTabProps): JSX.Element {
  const code = institution.code;

  const [membersState, setMembersState] = useState<AsyncState<InstitutionCodeMember[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [invitationsState, setInvitationsState] = useState<
    AsyncState<InstitutionInvitation[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [memberReload, setMemberReload] = useState(0);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [removeTarget, setRemoveTarget] = useState<InstitutionCodeMember | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] =
    useState<InstitutionInvitation | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
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
  }, [code, memberReload]);

  useEffect(() => {
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
  }, [code, memberReload]);

  // 초대 피커용 회원 디렉터리(탭 마운트 시 1회). 실패해도 제거 기능엔 영향 없음.
  useEffect(() => {
    if (allUsers.length > 0) {
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
  }, [allUsers.length]);

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

  // 초대 성공 후 갱신 두 축: 로컬 로스터(대기 초대 행)와 셸 settings(좌석 요약·정원 검사).
  const handleInvited = useCallback(() => {
    setMemberReload((prev) => prev + 1);
    onChanged();
  }, [onChanged]);

  // 툴바 요약과 본문 경보가 같은 판정을 쓰도록 여기서 한 번만 계산한다.
  const seatFull =
    settings !== null && settings.maxMembers !== null && settings.seatsUsed >= settings.maxMembers;
  const blockedNow =
    (settings?.blockIntakeOnExpiry ?? false) && contractStatus?.hasActiveContract === false;

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
      // 🚨 대기 초대도 좌석을 선점하므로 취소는 좌석 사용량을 바꾼다. 로컬 로스터만
      // 갱신하고 끝내면 셸이 들고 있는 settings(좌석 요약·정원 사전검사의 소스)가
      // stale 로 남아 "자리가 났는데 초대가 거부되는" 상태가 된다.
      onChanged();
    },
    [cancelInviteTarget, notificationApi, onChanged]
  );

  const handleRemoveConfirm = useCallback(
    async (reason: string) => {
      if (!removeTarget) {
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
        description: `${removeTarget.realName || removeTarget.email} 의 ${code} 소속이 해제되었습니다.`
      });
      setRemoveTarget(null);
      setMemberReload((prev) => prev + 1);
      onChanged();
    },
    [code, notificationApi, onChanged, removeTarget]
  );

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
          if (!canManage) {
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
    [canManage]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* 좌석은 "설정"이 아니라 판단에 필요한 **현황**이라 툴바에 상시 노출한다.
          정원·초대 기본값·유입 차단 편집만 Drawer 뒤로 보낸다. */}
      <InstitutionTabToolbar
        summary={
          settings ? (
            <Space size={8} wrap>
              <Text data-testid="institution-seat-usage">
                {settings.seatsUsed.toLocaleString()}
                {settings.maxMembers === null
                  ? ' / 무제한'
                  : ` / ${settings.maxMembers.toLocaleString()}`}
              </Text>
              <Text type="secondary">
                소속 {settings.memberCount.toLocaleString()}명 · 대기 초대{' '}
                {settings.pendingInvitationCount.toLocaleString()}건
              </Text>
            </Space>
          ) : (
            <Text type="secondary">좌석 불러오는 중…</Text>
          )
        }
        actions={
          <>
            {canManage ? (
              <Button
                type="primary"
                size="large"
                data-testid="institution-invite-open-button"
                onClick={() => setInviteOpen(true)}
              >
                회원 초대
              </Button>
            ) : null}
            <Button
              size="large"
              data-testid="institution-member-policy-open-button"
              onClick={() => setPolicyOpen(true)}
            >
              회원 정책
            </Button>
          </>
        }
      />

      {/* 현황 경보는 본문에 남긴다 — Drawer 안에 넣으면 열어보기 전까지 못 본다. */}
      {blockedNow ? (
        <Alert
          type="warning"
          showIcon
          message="계약이 만료돼 신규 배정·초대가 차단된 상태입니다."
          description="계약 탭에서 기간을 갱신하거나 회원 정책에서 차단 옵션을 해제하세요. 이미 소속된 회원은 그대로 유지됩니다."
        />
      ) : null}
      {seatFull ? (
        <Alert
          type="warning"
          showIcon
          message="정원이 모두 사용됐습니다."
          description="정원을 늘리거나 대기 중 초대를 취소해야 새로 초대할 수 있습니다."
        />
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
              membersState.status === 'pending' || invitationsState.status === 'pending'
            }
            pagination={false}
          />
        </div>
      </div>

      {!isInstitutionCodesSupabase ? (
        <Text type="secondary">
          현재 mock 데이터 — 초대/제거는 화면에만 반영되며 목록은 비어 있습니다.
        </Text>
      ) : null}

      {removeTarget ? (
        <ConfirmAction
          open
          title="기관 소속 해제"
          description={`${removeTarget.realName || removeTarget.email} 의 ${code} 소속을 해제합니다. 사유를 기록하세요.`}
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
          description={`${cancelInviteTarget.realName || cancelInviteTarget.email} 에게 보낸 ${cancelInviteTarget.code} 초대를 취소합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={cancelInviteTarget.userId}
          confirmText="취소 실행"
          reasonPlaceholder="초대 취소 사유를 입력하세요."
          onCancel={() => setCancelInviteTarget(null)}
          onConfirm={handleCancelInvitationConfirm}
        />
      ) : null}

      <InstitutionInviteDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        code={code}
        settings={settings}
        userOptions={addUserOptions}
        notificationApi={notificationApi}
        onInvited={handleInvited}
      />

      <InstitutionMemberPolicyDrawer
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        institution={institution}
        settings={settings}
        contractStatus={contractStatus}
        canManage={canManage}
        notificationApi={notificationApi}
        onChanged={onChanged}
      />
    </Space>
  );
}
