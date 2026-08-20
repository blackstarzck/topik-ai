import {
  Alert,
  Button,
  Descriptions,
  Drawer,
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
  patchInstitutionSettingsSafe,
  translateInstitutionContractError
} from '../../api/institution-contracts-service';
import { GLOBAL_INVITE_EXPIRY_DAYS } from '../../model/institution-contracts-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionSettings
} from '../../model/institution-contracts-types';
import type { InstitutionCode } from '../../model/institution-codes-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { createDescriptionLabel } from '@/shared/ui/descriptions/description-label';
import {
  DrawerFooter,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '@/shared/ui/drawer-frame/drawer-frame';

const { Text } = Typography;

type PolicyFormValues = {
  maxMembers?: number | null;
  defaultInviteExpiryDays?: number | null;
  blockIntakeOnExpiry: boolean;
  reason: string;
};

type InstitutionMemberPolicyDrawerProps = {
  open: boolean;
  onClose: () => void;
  institution: InstitutionCode;
  settings: InstitutionSettings | null;
  contractStatus: InstitutionContractStatusSummary | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 회원 정책 Drawer — 정원, 기관별 초대 유효기간 기본값, 계약 만료 시 유입 차단.
 *
 * 세 값 모두 "이 기관에 회원을 더 받을 수 있는가"를 정하는 **설정**이라 편집은 여기 모으고,
 * 판단에 필요한 좌석 수치는 탭 툴바에 상시 노출한다. 좌석 정의를 여기에도 반복해 적는다:
 * **소속 회원 + 만료되지 않은 대기 초대**. 대기 초대가 자리를 선점하므로 수락 시점에 정원이
 * 초과되지 않는다(만료된 초대는 세지 않는다 — 서버가 정원용 계수 함수를 따로 두는 이유).
 *
 * 저장 실패 시 Drawer 를 닫지 않는다 — 입력을 잃지 않아야 사유를 고쳐 재시도할 수 있다.
 */
export function InstitutionMemberPolicyDrawer({
  open,
  onClose,
  institution,
  settings,
  contractStatus,
  canManage,
  notificationApi,
  onChanged
}: InstitutionMemberPolicyDrawerProps): JSX.Element {
  const [form] = Form.useForm<PolicyFormValues>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    form.setFieldsValue({
      maxMembers: settings?.maxMembers ?? null,
      defaultInviteExpiryDays: settings?.defaultInviteExpiryDays ?? null,
      blockIntakeOnExpiry: settings?.blockIntakeOnExpiry ?? false,
      reason: ''
    });
  }, [form, open, settings]);

  const handleSubmit = useCallback(async () => {
    // 설정을 아직 못 읽었으면 저장할 수 없다 — 전량 upsert 라 현재 값 없이 보내면
    // 담당자 등 이 폼 밖 필드가 지워진다. 입력도 disable 이라 도달 불가 경로다.
    if (!settings) {
      return;
    }

    let values: PolicyFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const result = await patchInstitutionSettingsSafe(
        settings,
        {
          maxMembers: values.maxMembers ?? null,
          defaultInviteExpiryDays: values.defaultInviteExpiryDays ?? null,
          blockIntakeOnExpiry: values.blockIntakeOnExpiry
        },
        values.reason
      );
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
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [form, institution.code, notificationApi, onChanged, onClose, settings]);

  const seatsUsed = settings?.seatsUsed ?? 0;
  const maxMembers = settings?.maxMembers ?? null;
  const seatPercent =
    maxMembers && maxMembers > 0 ? Math.min(100, Math.round((seatsUsed / maxMembers) * 100)) : 0;
  const seatFull = maxMembers !== null && seatsUsed >= maxMembers;
  const blockedNow =
    (settings?.blockIntakeOnExpiry ?? false) && contractStatus?.hasActiveContract === false;
  const editDisabled = !canManage || !settings;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={640}
      destroyOnHidden
      title={<DrawerTitle>회원 정책</DrawerTitle>}
      styles={mergeDrawerFrameStyles()}
      footer={
        <DrawerFooter
          start={<Button onClick={onClose}>취소</Button>}
          end={
            canManage ? (
              <Button
                type="primary"
                loading={submitting}
                disabled={editDisabled}
                onClick={() => void handleSubmit()}
              >
                회원 정책 저장
              </Button>
            ) : null
          }
        />
      }
    >
      <div className="detail-drawer__body" data-testid="institution-member-policy-drawer">
        <div data-testid="institution-member-policy-section">
          {blockedNow ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="계약이 만료돼 신규 배정·초대가 차단된 상태입니다."
              description="계약 탭에서 기간을 갱신하거나 아래 차단 옵션을 해제하세요. 이미 소속된 회원은 그대로 유지됩니다."
            />
          ) : null}
          {seatFull ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="정원이 모두 사용됐습니다."
              description="정원을 늘리거나 대기 중 초대를 취소해야 새로 초대할 수 있습니다."
            />
          ) : null}

          <Form form={form} layout="vertical">
            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                {
                  key: 'seats',
                  label: '좌석 사용',
                  children: (
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      {/* 🚨 `institution-seat-usage` testid 는 툴바가 갖는다. 여기에도 달면
                          Drawer 가 열린 동안 매칭이 2개가 되어 strict violation 이 난다. */}
                      <Text>
                        {seatsUsed.toLocaleString()}
                        {maxMembers === null ? ' / 무제한' : ` / ${maxMembers.toLocaleString()}`}
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
                          disabled={editDisabled}
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
                          disabled={editDisabled}
                          placeholder={`비우면 ${GLOBAL_INVITE_EXPIRY_DAYS}일`}
                          style={{ width: 180 }}
                          addonAfter="일"
                        />
                      </Form.Item>
                      <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
                        회원 초대 폼의 만료 기간에 기본으로 채워집니다.
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
                          disabled={editDisabled}
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
                        disabled={editDisabled}
                        placeholder="감사 로그에 기록됩니다."
                      />
                    </Form.Item>
                  )
                }
              ]}
            />
          </Form>
        </div>
      </div>
    </Drawer>
  );
}
