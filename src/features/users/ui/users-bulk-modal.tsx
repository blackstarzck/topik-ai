import { Form, Input, InputNumber, Modal, Select, Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import { useEffect } from 'react';

const { Text } = Typography;

// 기관 초대/소속 해제 일괄 모달 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·제출·알림은 페이지가 소유하고, 열림 초기화만 모달 내부에서 처리한다.

export type UsersBulkModalProps = {
  mode: 'assign' | 'clear' | null;
  submitting: boolean;
  selectedCount: number;
  activeCodeOptions: Array<{ value: string; label: string }>;
  form: FormInstance<{ code: string; reason: string; expiresInDays: number }>;
  onOk: () => Promise<void>;
  onCancel: () => void;
};

export function UsersBulkModal({
  mode,
  submitting,
  selectedCount,
  activeCodeOptions,
  form,
  onOk,
  onCancel
}: UsersBulkModalProps): JSX.Element {
  // 모달이 열릴 때(폼 마운트 후) 이전 입력값을 비운다.
useEffect(() => {
  if (mode) {
    form.resetFields();
  }
}, [mode, form]);

  return (
<Modal
  open={mode !== null}
  title={mode === 'assign' ? '기관 초대' : '기관 소속 해제'}
  okText={mode === 'assign' ? '초대 발송' : '해제'}
  cancelText="취소"
  confirmLoading={submitting}
  onCancel={onCancel}
  onOk={onOk}
  destroyOnHidden
>
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Text type="secondary">
      {mode === 'assign'
        ? `선택한 회원 ${selectedCount.toLocaleString()}명에게 초대 알림(인앱+이메일)을 보냅니다. 회원이 수락해야 소속이 적용되며, 이미 같은 코드 소속이거나 대기 중 초대가 있는 회원은 건너뜁니다.`
        : `선택한 회원 ${selectedCount.toLocaleString()}명에게 적용됩니다. 기관 소속이 없는 회원은 변경 없이 건너뜁니다.`}
    </Text>
    <Form form={form} layout="vertical">
      {mode === 'assign' ? (
        <>
          <Form.Item
            label="기관 코드"
            name="code"
            rules={[{ required: true, message: '초대할 기관 코드를 선택하세요.' }]}
          >
            <Select
              placeholder="활성 코드를 선택하세요."
              options={activeCodeOptions}
              showSearch
              optionFilterProp="label"
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
        </>
      ) : null}
      <Form.Item
        label="사유/근거"
        name="reason"
        rules={[{ required: true, message: '조치 사유를 입력하세요.' }]}
        style={{ marginBottom: 0 }}
      >
        <Input.TextArea rows={3} placeholder="감사 기록에 남길 사유를 입력하세요." />
      </Form.Item>
    </Form>
  </Space>
</Modal>
  );
}
