import { Form, Input, Modal, Typography } from 'antd';
import type { FormInstance } from 'antd';

import type { UserSummary } from '../model/types';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';

const { Text } = Typography;

// 관리자 메모 모달 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

export type UsersMemoModalProps = {
  target: UserSummary | null;
  form: FormInstance<{ memo: string }>;
  onOk: () => Promise<void>;
  onCancel: () => void;
};

export function UsersMemoModal({
  target,
  form,
  onOk,
  onCancel
}: UsersMemoModalProps): JSX.Element {
  return (
<Modal
  open={Boolean(target)}
  title="관리자 메모 작성"
  okText="저장"
  cancelText="취소"
  onCancel={onCancel}
  onOk={onOk}
  destroyOnHidden
>
  <Form form={form} layout="vertical">
    <Text type="secondary">
      대상 유형: {getTargetTypeLabel('Users')} / 대상 ID: {target?.id ?? '-'}
    </Text>
    <Form.Item
      label="메모"
      name="memo"
      rules={[{ required: true, message: '메모 내용을 입력하세요.' }]}
      style={{ marginTop: 12, marginBottom: 0 }}
    >
      <Input.TextArea rows={4} placeholder="운영 메모를 입력하세요." />
    </Form.Item>
  </Form>
</Modal>
  );
}
