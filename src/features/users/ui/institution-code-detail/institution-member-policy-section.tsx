import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Progress,
  Space,
  Switch,
  Typography
} from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  translateInstitutionContractError,
  updateInstitutionSettingsSafe
} from '../../api/institution-contracts-service';
import { GLOBAL_INVITE_EXPIRY_DAYS } from '../../model/institution-contracts-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionSettings
} from '../../model/institution-contracts-types';
import type { InstitutionCode } from '../../model/institution-codes-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { AuditLogLink } from '../../../../shared/ui/audit-log-link/audit-log-link';
import { createDescriptionLabel } from '../../../../shared/ui/descriptions/description-label';

const { Text } = Typography;

type PolicyFormValues = {
  maxMembers?: number | null;
  defaultInviteExpiryDays?: number | null;
  blockIntakeOnExpiry: boolean;
  reason: string;
};

type InstitutionMemberPolicySectionProps = {
  institution: InstitutionCode;
  settings: InstitutionSettings | null;
  contractStatus: InstitutionContractStatusSummary | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 회원 정책 섹션 — 정원, 기관별 초대 유효기간 기본값, 계약 만료 시 유입 차단.
 *
 * 회원 탭에 두는 이유: 세 값 모두 "이 기관에 회원을 더 받을 수 있는가"를 결정하고, 그
 * 판단에는 바로 아래 현원·대기 초대 목록이 필요하다. 계약 탭에는 계약 기간과 담당자만 둔다.
 *
 * 좌석 정의를 화면에도 반복해 적는다: **소속 회원 + 만료되지 않은 대기 초대**다. 대기 초대가
 * 자리를 선점하므로 수락 시점에 정원이 초과되지 않는다. 만료된 초대는 세지 않는다 —
 * 서버가 정원용으로 별도 계수 함수를 쓰는 이유이기도 하다.
 */
export function InstitutionMemberPolicySection({
  institution,
  settings,
  contractStatus,
  canManage,
  notificationApi,
  onChanged
}: InstitutionMemberPolicySectionProps): JSX.Element {
  const [form] = Form.useForm<PolicyFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      maxMembers: settings?.maxMembers ?? null,
      defaultInviteExpiryDays: settings?.defaultInviteExpiryDays ?? null,
      blockIntakeOnExpiry: settings?.blockIntakeOnExpiry ?? false,
      reason: ''
    });
  }, [form, settings]);

  const handleSubmit = useCallback(async () => {
    let values: PolicyFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      // 담당자는 이 섹션에서 편집하지 않지만, 설정 RPC 는 전량값을 받으므로 현재 값을
      // 그대로 실어 보낸다. 빼먹으면 담당자 정보가 조용히 지워진다.
      const result = await updateInstitutionSettingsSafe({
        code: institution.code,
        maxMembers: values.maxMembers ?? null,
        defaultInviteExpiryDays: values.defaultInviteExpiryDays ?? null,
        blockIntakeOnExpiry: values.blockIntakeOnExpiry,
        contactName: settings?.contactName ?? '',
        contactEmail: settings?.contactEmail ?? '',
        reason: values.reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '회원 정책 저장 실패',
          description: translateInstitutionContractError(result.error.message)
        });
        return;
      }
      notificationApi.success({
        message: '회원 정책 저장 완료',
        description: (
          <Space direction="vertical">
            <Text>{institution.code}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      form.setFieldsValue({ reason: '' });
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }, [form, institution.code, notificationApi, onChanged, settings]);

  const seatsUsed = settings?.seatsUsed ?? 0;
  const maxMembers = settings?.maxMembers ?? null;
  const seatPercent =
    maxMembers && maxMembers > 0 ? Math.min(100, Math.round((seatsUsed / maxMembers) * 100)) : 0;
  const seatFull = maxMembers !== null && seatsUsed >= maxMembers;
  const blockedNow =
    (settings?.blockIntakeOnExpiry ?? false) && contractStatus?.hasActiveContract === false;

  return (
    <div data-testid="institution-member-policy-section">
      <Text strong style={{ fontSize: 15 }}>
        회원 정책
      </Text>

      {blockedNow ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message="계약이 만료돼 신규 배정·초대가 차단된 상태입니다."
          description="계약 탭에서 기간을 갱신하거나 아래 차단 옵션을 해제하세요. 이미 소속된 회원은 그대로 유지됩니다."
        />
      ) : null}
      {seatFull ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message="정원이 모두 사용됐습니다."
          description="정원을 늘리거나 대기 중 초대를 취소해야 새로 초대할 수 있습니다."
        />
      ) : null}

      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Descriptions
          bordered
          column={1}
          size="small"
          labelStyle={{ width: 150, whiteSpace: 'nowrap' }}
          items={[
            {
              key: 'seats',
              label: '좌석 사용',
              children: (
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Text data-testid="institution-seat-usage">
                    {seatsUsed.toLocaleString()}
                    {maxMembers === null
                      ? ' / 무제한'
                      : ` / ${maxMembers.toLocaleString()}`}
                  </Text>
                  {maxMembers !== null ? (
                    <Progress
                      percent={seatPercent}
                      size="small"
                      status={seatFull ? 'exception' : 'normal'}
                      style={{ maxWidth: 260, margin: 0 }}
                    />
                  ) : null}
                  <Text type="secondary">
                    소속 회원 {(settings?.memberCount ?? 0).toLocaleString()}명 + 대기 초대{' '}
                    {(settings?.pendingInvitationCount ?? 0).toLocaleString()}건(만료된 초대는
                    세지 않습니다).
                  </Text>
                </Space>
              )
            },
            {
              key: 'maxMembers',
              label: '정원',
              children: (
                <>
                  <Form.Item name="maxMembers" style={{ margin: 0 }}>
                    <InputNumber
                      min={1}
                      max={100000}
                      disabled={!canManage || !settings}
                      placeholder="비우면 무제한"
                      style={{ width: 180 }}
                      addonAfter="명"
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                    현재 좌석 사용량보다 낮게 설정할 수 없습니다.
                  </Text>
                </>
              )
            },
            {
              key: 'defaultInviteExpiryDays',
              label: '초대 유효기간 기본값',
              children: (
                <>
                  <Form.Item name="defaultInviteExpiryDays" style={{ margin: 0 }}>
                    <InputNumber
                      min={1}
                      max={365}
                      disabled={!canManage || !settings}
                      placeholder={`비우면 ${GLOBAL_INVITE_EXPIRY_DAYS}일`}
                      style={{ width: 180 }}
                      addonAfter="일"
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                    아래 초대 폼의 만료 기간에 기본으로 채워집니다.
                  </Text>
                </>
              )
            },
            {
              key: 'blockIntakeOnExpiry',
              label: '만료 시 유입 차단',
              children: (
                <>
                  <Form.Item
                    name="blockIntakeOnExpiry"
                    valuePropName="checked"
                    style={{ margin: 0 }}
                  >
                    <Switch
                      disabled={!canManage || !settings}
                      data-testid="institution-block-intake-switch"
                    />
                  </Form.Item>
                  <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                    계약이 만료된 동안 새 배정·초대를 막습니다. 문항 노출을 가리는 옵션(노출
                    문항 탭)과는 별개입니다 — 노출은 그대로 두고 유입만 막고 싶을 때 씁니다.
                  </Text>
                </>
              )
            },
            {
              key: 'reason',
              label: createDescriptionLabel('변경 사유', { required: true }),
              children: (
                <Form.Item
                  name="reason"
                  style={{ margin: 0 }}
                  rules={[{ required: true, message: '변경 사유를 입력하세요.' }]}
                >
                  <Input.TextArea
                    rows={2}
                    disabled={!canManage || !settings}
                    placeholder="감사 로그에 기록됩니다."
                  />
                </Form.Item>
              )
            }
          ]}
        />
      </Form>

      {canManage ? (
        <Button
          type="primary"
          style={{ marginTop: 10 }}
          loading={submitting}
          disabled={!settings}
          onClick={() => void handleSubmit()}
        >
          회원 정책 저장
        </Button>
      ) : null}
    </div>
  );
}
