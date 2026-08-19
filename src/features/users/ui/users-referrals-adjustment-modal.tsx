import { Form, Input, InputNumber, Modal, Typography } from 'antd';
import type { FormInstance } from 'antd';

import type { ReferralRewardAdjustmentFormValues } from '../model/users-referrals-page-schema';
import type { ReferralSummary } from '../model/referrals-types';

const { Text } = Typography;

// 보상 수동 조정 모달 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·검증·저장은 페이지가 소유하고 props 로 받는다.

export type ReferralAdjustmentModalProps = {
  target: ReferralSummary | null;
  form: FormInstance<ReferralRewardAdjustmentFormValues>;
  onOk: () => Promise<void>;
  onCancel: () => void;
};

export function ReferralAdjustmentModal({
  target,
  form,
  onOk,
  onCancel
}: ReferralAdjustmentModalProps): JSX.Element {
  return (
      <Modal
        open={Boolean(target)}
        title="보상 수동 조정"
        okText="조정 저장"
        cancelText="취소"
        onCancel={onCancel}
        onOk={onOk}
      destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Text type="secondary">
            대상 유형: 추천인 / 대상 ID: {target?.id ?? '-'}
          </Text>
          <Form.Item
            label="조정 금액"
            name="amount"
            rules={[
              { required: true, message: '조정 금액을 입력하세요.' },
              {
                validator: async (_, value: number | undefined) => {
                  if (!value) {
                    throw new Error('0이 아닌 금액을 입력하세요.');
                  }
                }
              }
            ]}
            style={{ marginTop: 12 }}
            extra="양수는 수동 보정, 음수는 회수로 기록됩니다."
          >
            <InputNumber
              style={{ width: '100%' }}
              step={1000}
              placeholder="예: 5000 또는 -3000"
            />
          </Form.Item>
          <Form.Item
            label="사유/근거"
            name="reason"
            rules={[{ required: true, message: '조정 사유를 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="운영 판단 근거를 입력하세요." />
          </Form.Item>
        </Form>
      </Modal>
  );
}
