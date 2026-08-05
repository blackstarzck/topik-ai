import { Alert, Button, Form, Input, InputNumber, Select, Space, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cancelInstitutionInvitationSafe,
  clearInstitutionCodeSafe,
  fetchInstitutionCodeMembersSafe,
  fetchInstitutionInvitationsSafe,
  isInstitutionCodesSupabase
} from '../../api/institution-codes-service';
import {
  inviteInstitutionMembersGuardedSafe,
  translateInstitutionContractError
} from '../../api/institution-contracts-service';
import { fetchUsersSafe } from '../../api/users-service';
import type {
  InstitutionCode,
  InstitutionCodeMember,
  InstitutionInvitation
} from '../../model/institution-codes-types';
import {
  GLOBAL_INVITE_EXPIRY_DAYS,
  type InstitutionContractStatusSummary,
  type InstitutionSettings
} from '../../model/institution-contracts-types';
import type { UserSummary } from '../../model/types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { InstitutionMemberPolicySection } from './institution-member-policy-section';
import { InvitationEmailStatusTag } from '../invitation-email-status-tag';
import { kickNotificationEmailDispatch } from '../../../../shared/api/notification-email-kick';
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
  const [addForm] = Form.useForm<{
    userIds: string[];
    reason: string;
    expiresInDays: number;
  }>();
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<InstitutionCodeMember | null>(null);

  // 초대 만료 기간의 기본값은 기관 설정에서 온다(없으면 전역 7일). `initialValue` 로는
  // 설정을 나중에 받아오는 이 화면에서 값이 갱신되지 않으므로 setFieldsValue 로 채운다.
  // 운영자가 손으로 바꾼 값을 덮지 않도록 설정이 바뀔 때만 다시 채운다.
  useEffect(() => {
    addForm.setFieldsValue({
      expiresInDays: settings?.defaultInviteExpiryDays ?? GLOBAL_INVITE_EXPIRY_DAYS
    });
  }, [addForm, settings?.defaultInviteExpiryDays]);
  const [cancelInviteTarget, setCancelInviteTarget] =
    useState<InstitutionInvitation | null>(null);

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

  const handleAddMembers = useCallback(async () => {
    if (addSubmitting) {
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

    // 정원 초과는 서버도 막지만, 왕복 전에 알려주면 운영자가 대상 인원을 바로 줄일 수 있다.
    // 좌석 = 소속 회원 + 만료되지 않은 대기 초대(서버 계산과 같은 정의).
    const seatLimit = settings?.maxMembers ?? null;
    if (settings && seatLimit !== null && settings.seatsUsed + values.userIds.length > seatLimit) {
      setAddSubmitting(false);
      notificationApi.error({
        message: '정원 초과',
        description: `정원 ${seatLimit.toLocaleString()}명 중 ${settings.seatsUsed.toLocaleString()}명이 사용 중입니다(소속 회원 + 대기 초대). ${values.userIds.length.toLocaleString()}명을 더 초대할 수 없습니다.`
      });
      return;
    }

    const result = await inviteInstitutionMembersGuardedSafe(
      values.userIds,
      code,
      values.reason,
      // 폼에 값이 있으면 그것을, 비어 있으면 null 을 보내 서버가 기관 기본값으로 해석한다.
      values.expiresInDays ?? null
    );
    setAddSubmitting(false);

    if (!result.ok) {
      notificationApi.error({
        message: '초대 발송 실패',
        description: translateInstitutionContractError(result.error.message)
      });
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
    onChanged();
  }, [addForm, addSubmitting, code, notificationApi, onChanged, settings]);

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
      <InstitutionMemberPolicySection
        institution={institution}
        settings={settings}
        contractStatus={contractStatus}
        canManage={canManage}
        notificationApi={notificationApi}
        onChanged={onChanged}
      />

      {canManage ? (
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
            rules={[{ required: true, message: '만료 기간을 입력하세요.' }]}
            extra={
              settings?.defaultInviteExpiryDays !== null && settings
                ? `이 기간 안에 응답하지 않으면 초대가 만료됩니다. 기관 기본값 ${settings.defaultInviteExpiryDays}일이 채워져 있습니다.`
                : `이 기간 안에 응답하지 않으면 초대가 만료됩니다. 기관 기본값이 없어 전역 기본 ${GLOBAL_INVITE_EXPIRY_DAYS}일이 채워져 있습니다.`
            }
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
          <Button type="primary" loading={addSubmitting} onClick={() => void handleAddMembers()}>
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
    </Space>
  );
}
