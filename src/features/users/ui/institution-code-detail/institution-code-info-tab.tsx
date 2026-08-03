import { Button, Descriptions, Form, Input, Select, Space, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { updateInstitutionCodeSafe } from '../../api/institution-codes-service';
import {
  institutionCodeKinds,
  institutionCodeStatuses
} from '../../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeStatus
} from '../../model/institution-codes-types';
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

type InstitutionCodeInfoTabProps = {
  institution: InstitutionCode;
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
  notificationApi,
  onChanged
}: InstitutionCodeInfoTabProps): JSX.Element {
  const [form] = Form.useForm<InfoFormValues>();
  const [submitting, setSubmitting] = useState(false);

  // 셸이 재조회한 값으로 폼을 되돌린다(다른 탭의 변경이 코드 메타를 바꿀 수 있다).
  useEffect(() => {
    form.setFieldsValue({
      label: institution.label,
      kind: institution.kind,
      status: institution.status,
      note: institution.note,
      reason: ''
    });
  }, [form, institution]);

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
      form.setFieldsValue({ reason: '' });
      onChanged();
    } finally {
      setSubmitting(false);
    }
  }, [form, institution, notificationApi, onChanged]);

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
      <Form form={form} layout="vertical">
        <Descriptions
          bordered
          column={1}
          size="small"
          labelStyle={{ width: 110, whiteSpace: 'nowrap' }}
          items={items}
        />
      </Form>
      <div>
        <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
          수정
        </Button>
      </div>
    </Space>
  );
}
