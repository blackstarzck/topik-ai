import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Typography
} from 'antd';
import type { notification } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cancelInstitutionInvitationSafe,
  clearInstitutionCodeSafe,
  fetchInstitutionCodesSafe,
  fetchInstitutionInvitationsSafe
} from '../api/institution-codes-service';
import {
  inviteInstitutionMembersGuardedSafe,
  translateInstitutionContractError
} from '../api/institution-contracts-service';
import type {
  InstitutionCode,
  InstitutionInvitation
} from '../model/institution-codes-types';
import { renderProfileValue } from '../model/user-detail-page-schema';
import { InvitationEmailStatusTag } from './invitation-email-status-tag';
import { kickNotificationEmailDispatch } from '@/shared/api/notification-email-kick';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';

const { Text } = Typography;

// 기관 소속 탭 — Phase 4 분해로 페이지 본문에서 파일 분리(동작 동일).

type NotificationApi = ReturnType<typeof notification.useNotification>[0];

type AffiliationTabPanelProps = {
  userId: string;
  affiliationCode: string;
  affiliationLabel: string;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

// 회원 상세 > 기관 소속 탭. 읽기(회원 구분/코드/행사) + 편집(초대·해제) 자체 상태로 운영.
// 소속 부여는 즉시 배정이 아니라 초대(admin_invite_institution_members) — 회원이 v13 알림에서
// 수락해야 적용된다. 해제는 기존 직접 RPC(admin_clear_institution_code) 유지, onChanged 로 상위 재조회.
export function AffiliationTabPanel({
  userId,
  affiliationCode,
  affiliationLabel,
  canManage,
  notificationApi,
  onChanged
}: AffiliationTabPanelProps): JSX.Element {
  const [codes, setCodes] = useState<InstitutionCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [reason, setReason] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [submitting, setSubmitting] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<InstitutionInvitation[]>([]);
  const [invitationReload, setInvitationReload] = useState(0);
  const [cancelInviteTarget, setCancelInviteTarget] =
    useState<InstitutionInvitation | null>(null);

  useEffect(() => {
    if (!canManage) {
      return;
    }
    const controller = new AbortController();
    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setCodes(result.data);
      }
    });
    return () => controller.abort();
  }, [canManage]);

  // 이 회원의 대기 중(pending) 초대 — 초대 발송/취소 시 재조회.
  useEffect(() => {
    if (!canManage) {
      return;
    }
    const controller = new AbortController();
    void fetchInstitutionInvitationsSafe(
      { userId, status: 'pending' },
      controller.signal
    ).then((result) => {
      if (!controller.signal.aborted && result.ok) {
        setPendingInvitations(result.data);
      }
    });
    return () => controller.abort();
  }, [canManage, userId, invitationReload]);

  // 초대 피커는 활성 코드만(종료 코드 초대는 RPC가 차단).
  const activeOptions = useMemo(
    () =>
      codes
        .filter((code) => code.status === '활성')
        .map((code) => ({ value: code.code, label: `${code.label} (${code.code})` })),
    [codes]
  );

  const handleInvite = useCallback(async () => {
    if (!selectedCode) {
      notificationApi.warning({ message: '초대할 기관 코드를 선택하세요.' });
      return;
    }
    if (!reason.trim()) {
      notificationApi.warning({ message: '초대 사유를 입력하세요.' });
      return;
    }
    setSubmitting(true);
    // 정원·계약 만료 차단이 걸린 wrapper 로 보낸다. 원함수를 직접 부르면 기관 코드 화면에서
    // 설정한 정원이 이 진입점에서 조용히 우회된다.
    const result = await inviteInstitutionMembersGuardedSafe(
      [userId],
      selectedCode,
      reason.trim(),
      expiresInDays
    );
    setSubmitting(false);
    if (!result.ok) {
      notificationApi.error({
        message: '기관 초대 실패',
        description: translateInstitutionContractError(result.error.message)
      });
      return;
    }
    if (result.data > 0) {
      // 이메일이 cron 주기를 기다리지 않도록 워커 즉시 kick(실패해도 cron 이 수거).
      void kickNotificationEmailDispatch();
      notificationApi.success({
        message: '기관 초대 발송 완료',
        description:
          '초대를 보냈습니다. 인앱 알림은 즉시 전달되고 이메일 발송을 시작했습니다. 발송 결과는 메시지 ▸ 발송 이력에서 확인할 수 있습니다.'
      });
    } else {
      notificationApi.info({
        message: '초대를 보내지 않았습니다',
        description: '이미 소속이거나 대기 중 초대가 있어 보내지 않았습니다.'
      });
    }
    setSelectedCode('');
    setReason('');
    setInvitationReload((prev) => prev + 1);
    onChanged();
  }, [expiresInDays, notificationApi, onChanged, reason, selectedCode, userId]);

  const handleCancelInvitation = useCallback(
    async (cancelReason: string) => {
      if (!cancelInviteTarget) {
        return;
      }
      const result = await cancelInstitutionInvitationSafe(
        cancelInviteTarget.invitationId,
        cancelReason
      );
      if (!result.ok) {
        notificationApi.error({ message: '초대 취소 실패', description: result.error.message });
        setCancelInviteTarget(null);
        return;
      }
      notificationApi.success({
        message: '초대 취소 완료',
        description: `${cancelInviteTarget.code} 초대를 취소했습니다.`
      });
      setCancelInviteTarget(null);
      setInvitationReload((prev) => prev + 1);
    },
    [cancelInviteTarget, notificationApi]
  );

  const handleClear = useCallback(
    async (clearReason: string) => {
      const result = await clearInstitutionCodeSafe([userId], clearReason);
      if (!result.ok) {
        notificationApi.error({ message: '기관 소속 해제 실패', description: result.error.message });
        setClearOpen(false);
        return;
      }
      notificationApi.success({ message: '기관 소속 해제 완료' });
      setClearOpen(false);
      onChanged();
    },
    [notificationApi, onChanged, userId]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Descriptions
        bordered
        column={1}
        items={[
          {
            key: 'memberKind',
            label: '회원 구분',
            children: affiliationCode ? (
              <Tag color="blue">기관 회원</Tag>
            ) : (
              <Tag>일반 회원</Tag>
            )
          },
          {
            key: 'affiliationCode',
            label: '유입 코드',
            children: renderProfileValue(affiliationCode)
          },
          {
            key: 'affiliationLabel',
            label: '기관/행사',
            children: renderProfileValue(affiliationLabel)
          },
          {
            key: 'affiliationNote',
            label: '안내',
            children: (
              <Text type="secondary">
                박람회/기관 유입 QR로 가입 시 코드가 기록됩니다. 코드의 의미는 회원 관리 ▸ 기관 코드에서 관리합니다.
              </Text>
            )
          }
        ]}
      />

      {canManage && pendingInvitations.length > 0 ? (
        <Alert
          type="info"
          showIcon
          message="대기 중 초대"
          description={
            <Space direction="vertical" size={4}>
              {pendingInvitations.map((invitation) => (
                <Space key={invitation.invitationId} size={8} wrap>
                  <Text>
                    {invitation.codeLabel || invitation.code} ({invitation.code}) ·{' '}
                    {invitation.createdAt}
                    {invitation.expiresAt ? ` · 만료 ${invitation.expiresAt}` : ''}
                  </Text>
                  <InvitationEmailStatusTag invitation={invitation} />
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() => setCancelInviteTarget(invitation)}
                  >
                    초대 취소
                  </Button>
                </Space>
              ))}
              <Text type="secondary">회원이 수락하면 소속이 적용됩니다.</Text>
            </Space>
          }
        />
      ) : null}

      {canManage ? (
        <Card size="small" title="기관 초대">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Text type="secondary">
              즉시 배정이 아니라 초대 알림(인앱+이메일)이 발송되고, 회원이 수락해야 소속이
              적용됩니다. 발송 내역은 메시지 ▸ 발송 이력에서 확인할 수 있습니다.
            </Text>
            <Select
              value={selectedCode || undefined}
              onChange={setSelectedCode}
              options={activeOptions}
              placeholder="초대할 활성 코드를 선택하세요."
              showSearch
              optionFilterProp="label"
              style={{ width: '100%', maxWidth: 420 }}
            />
            <Space size={8} align="center">
              <Text type="secondary">만료 기간</Text>
              <InputNumber
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(value) => setExpiresInDays(value ?? 7)}
                addonAfter="일"
                style={{ width: 140 }}
              />
              <Text type="secondary">이 기간 안에 응답하지 않으면 초대가 만료됩니다.</Text>
            </Space>
            <Input.TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="감사 기록에 남길 초대 사유를 입력하세요."
              style={{ maxWidth: 420 }}
            />
            <Space>
              <Button type="primary" loading={submitting} onClick={() => void handleInvite()}>
                기관 초대 보내기
              </Button>
              {affiliationCode ? (
                <Button danger onClick={() => setClearOpen(true)}>
                  소속 해제
                </Button>
              ) : null}
            </Space>
          </Space>
        </Card>
      ) : null}

      {clearOpen ? (
        <ConfirmAction
          open
          title="기관 소속 해제"
          description={`${affiliationCode} 소속을 해제합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={userId}
          confirmText="해제 실행"
          onCancel={() => setClearOpen(false)}
          onConfirm={handleClear}
        />
      ) : null}

      {cancelInviteTarget ? (
        <ConfirmAction
          open
          title="기관 초대 취소"
          description={`${cancelInviteTarget.code} 초대를 취소합니다. 사유를 기록하세요.`}
          targetType="Users"
          targetId={userId}
          confirmText="취소 실행"
          reasonPlaceholder="초대 취소 사유를 입력하세요."
          onCancel={() => setCancelInviteTarget(null)}
          onConfirm={handleCancelInvitation}
        />
      ) : null}
    </Space>
  );
}
