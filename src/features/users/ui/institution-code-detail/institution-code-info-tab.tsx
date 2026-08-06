import { Button, Descriptions, Form, Input, Select, Space, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { updateInstitutionCodeSafe } from '../../api/institution-codes-service';
import {
  patchInstitutionSettingsSafe,
  translateInstitutionContractError
} from '../../api/institution-contracts-service';
import {
  institutionCodeKinds,
  institutionCodeStatuses
} from '../../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeStatus
} from '../../model/institution-codes-types';
import type { InstitutionSettings } from '../../model/institution-contracts-types';
import type { NotificationApi } from './institution-code-detail-tab-types';
import { AuditLogLink } from '../../../../shared/ui/audit-log-link/audit-log-link';
import { createDescriptionLabel } from '../../../../shared/ui/descriptions/description-label';

const { Text } = Typography;

const kindOptions = institutionCodeKinds.map((kind) => ({ label: kind, value: kind }));
const statusOptions = institutionCodeStatuses.map((status) => ({
  label: status,
  value: status
}));

type InfoFormValues = {
  label: string;
  kind: InstitutionCodeKind;
  status: InstitutionCodeStatus;
  note?: string;
  reason: string;
};

type ContactFormValues = {
  contactName?: string;
  contactEmail?: string;
  reason: string;
};

type InstitutionCodeInfoTabProps = {
  institution: InstitutionCode;
  /** 담당자 편집에 필요하다. null 이면 아직 못 읽은 상태(편집 비활성). */
  settings: InstitutionSettings | null;
  canManage: boolean;
  notificationApi: NotificationApi;
  onChanged: () => void;
};

/**
 * 기본 정보 탭 — 구 수정 모달의 코드 메타 편집분이다.
 *
 * 노출 모드는 여기 없다: 배정 현황을 바로 옆에서 봐야 판단할 수 있어 `노출 문항` 탭으로
 * 옮겼다. 그 덕에 구 모달의 "모드 먼저 반영 → 실패하면 메타는 손대지 않음" 2단계 시퀀싱이
 * 사라지고, 이 탭은 코드 메타 한 번의 호출만 한다.
 */
export function InstitutionCodeInfoTab({
  institution,
  settings,
  canManage,
  notificationApi,
  onChanged
}: InstitutionCodeInfoTabProps): JSX.Element {
  const [form] = Form.useForm<InfoFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [contactForm] = Form.useForm<ContactFormValues>();
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // 셸이 재조회한 값으로 폼을 되돌린다(다른 탭의 변경이 코드 메타를 바꿀 수 있다).
  //
  // 🚨 **작성 중이면 건너뛴다.** 이 탭에는 폼이 둘(기본 정보 / 운영 담당자) 있고 둘 다 저장 시
  // `onChanged()` 로 셸 전량 재조회를 유발한다. 셸은 매 재조회마다 새 객체를 돌려주므로
  // (mock·supabase 모두 스냅샷/매핑), 가드가 없으면 **한쪽을 저장할 때 다른 쪽에 입력해 둔
  // 초안이 조용히 서버값으로 되돌아간다**. 사유가 required 라 오저장으로 곧장 이어지진 않지만,
  // 운영자는 자기가 고친 값이 사라진 걸 모른 채 사유만 다시 넣고 저장하게 된다.
  useEffect(() => {
    if (form.isFieldsTouched()) {
      return;
    }
    form.setFieldsValue({
      label: institution.label,
      kind: institution.kind,
      status: institution.status,
      note: institution.note,
      reason: ''
    });
  }, [form, institution]);

  // 🚨 프리필 effect 를 코드 메타와 합치지 않는다 — 두 소스(institution / settings)가 서로
  // 다른 시점에 도착하므로, 합치면 늦게 온 쪽이 먼저 온 쪽에 입력한 값을 덮는다.
  // dirty 가드는 위와 같은 이유로 여기에도 필요하다(반대 방향 덮어쓰기).
  useEffect(() => {
    if (contactForm.isFieldsTouched()) {
      return;
    }
    contactForm.setFieldsValue({
      contactName: settings?.contactName ?? '',
      contactEmail: settings?.contactEmail ?? '',
      reason: ''
    });
  }, [contactForm, settings]);

  const handleSubmit = useCallback(async () => {
    let values: InfoFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const reason = values.reason.trim();
      const result = await updateInstitutionCodeSafe({
        code: institution.code,
        label: values.label.trim(),
        kind: values.kind,
        status: values.status,
        note: values.note?.trim() ?? '',
        reason
      });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 수정 실패',
          description: result.error.message
        });
        return;
      }

      notificationApi.success({
        message: '기관 코드 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {institution.code}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      // 저장했으니 초안이 아니다 — dirty 를 풀어야 다음 셸 재조회의 프리필이 다시 산다.
      form.resetFields();
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }, [form, institution, notificationApi, onChanged]);

  const handleContactSubmit = useCallback(async () => {
    // 설정을 아직 못 읽었으면 저장하지 않는다 — 전량 upsert 라 현재 값 없이 보내면
    // 정원·초대 기본값·유입 차단이 지워진다. 입력도 disable 이라 도달 불가 경로다.
    if (!settings) {
      return;
    }

    let values: ContactFormValues;
    try {
      values = await contactForm.validateFields();
    } catch {
      return;
    }

    setContactSubmitting(true);
    try {
      const result = await patchInstitutionSettingsSafe(
        settings,
        {
          contactName: values.contactName ?? '',
          contactEmail: values.contactEmail ?? ''
        },
        values.reason
      );
      if (!result.ok) {
        notificationApi.error({
          message: '담당자 정보 저장 실패',
          description: translateInstitutionContractError(result.error.message)
        });
        return;
      }
      notificationApi.success({
        message: '담당자 정보 저장 완료',
        description: (
          <Space direction="vertical">
            <Text type="secondary">
              담당자 이름·이메일 값은 감사 로그에 기록되지 않습니다(변경된 항목명만 남습니다).
            </Text>
            <AuditLogLink targetType="InstitutionCode" targetId={institution.code} />
          </Space>
        )
      });
      // 위와 같은 이유로 dirty 를 푼다(사유만 비우면 touched 가 남는다).
      contactForm.resetFields();
      onChanged();
    } finally {
      setContactSubmitting(false);
    }
  }, [contactForm, institution.code, notificationApi, onChanged, settings]);

  const contactEditDisabled = !canManage || !settings;

  const items = [
    {
      key: 'code',
      label: '코드',
      children: <Text strong copyable>{institution.code}</Text>
    },
    {
      key: 'label',
      label: createDescriptionLabel('이름', { required: true }),
      children: (
        <Form.Item
          name="label"
          style={{ margin: 0 }}
          rules={[{ required: true, message: '이름을 입력하세요.' }]}
        >
          <Input />
        </Form.Item>
      )
    },
    {
      key: 'kind',
      label: createDescriptionLabel('종류', { required: true }),
      children: (
        <Form.Item
          name="kind"
          style={{ margin: 0 }}
          rules={[{ required: true, message: '종류를 선택하세요.' }]}
        >
          <Select options={kindOptions} style={{ width: '100%' }} />
        </Form.Item>
      )
    },
    {
      key: 'status',
      label: createDescriptionLabel('상태', { required: true }),
      children: (
        <>
          <Form.Item
            name="status"
            style={{ margin: 0 }}
            rules={[{ required: true, message: '상태를 선택하세요.' }]}
          >
            <Select options={statusOptions} style={{ width: '100%' }} />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: 6 }}>
            종료로 바꾸면 새 배정·초대가 막힙니다. 이미 소속된 회원의 문항 노출은 그대로
            유지됩니다.
          </Text>
        </>
      )
    },
    {
      key: 'createdAt',
      label: '생성·수정일',
      children: (
        <Text type="secondary">
          생성 {institution.createdAt} · 수정 {institution.updatedAt}
        </Text>
      )
    },
    {
      key: 'note',
      label: '메모',
      children: (
        <Form.Item name="note" style={{ margin: 0 }}>
          <Input.TextArea rows={2} />
        </Form.Item>
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
          <Input.TextArea rows={2} placeholder="감사 로그에 기록됩니다." />
        </Form.Item>
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
          기본 정보
        </Text>
        <Form form={form} layout="vertical" disabled={!canManage}>
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 110, whiteSpace: 'nowrap' }}
            items={items}
          />
        </Form>
        {canManage ? (
          <Button
            type="primary"
            style={{ marginTop: 10 }}
            loading={submitting}
            onClick={() => void handleSubmit()}
          >
            수정
          </Button>
        ) : null}
      </div>

      <div>
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>
          운영 담당자
        </Text>
        <Form form={contactForm} layout="vertical">
          <Descriptions
            bordered
            column={1}
            size="small"
            labelStyle={{ width: 110, whiteSpace: 'nowrap' }}
            items={[
              {
                key: 'contactName',
                label: '담당자 이름',
                children: (
                  <Form.Item name="contactName" style={{ margin: 0 }}>
                    <Input disabled={contactEditDisabled} placeholder="미입력" />
                  </Form.Item>
                )
              },
              {
                key: 'contactEmail',
                label: '담당자 이메일',
                children: (
                  <Form.Item
                    name="contactEmail"
                    style={{ margin: 0 }}
                    rules={[{ type: 'email', message: '이메일 형식이 아닙니다.' }]}
                  >
                    <Input disabled={contactEditDisabled} placeholder="미입력" />
                  </Form.Item>
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
                      disabled={contactEditDisabled}
                      placeholder="감사 로그에 기록됩니다(담당자 값은 기록되지 않습니다)."
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
            loading={contactSubmitting}
            disabled={contactEditDisabled}
            onClick={() => void handleContactSubmit()}
          >
            담당자 정보 저장
          </Button>
        ) : null}
      </div>
    </Space>
  );
}
