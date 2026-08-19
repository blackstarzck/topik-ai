import { Descriptions, Form, Input, InputNumber, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import { useMemo } from 'react';

import type {
  ExpirationHoldFormValues,
  ManualAdjustmentFormValues,
  PolicyFormValues,
  PolicyModalState
} from '../model/commerce-points-page-schema';
import type { PointExpiration, PointLedger } from '../model/point-types';
import { markRequiredDescriptionItems } from '@/shared/ui/descriptions/description-label';

// 포인트 편집 모달 3종 — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 폼 인스턴스·모달 상태·제출 핸들러는 페이지가 소유해 props 로 전달하고,
// 소멸 보류 선택 옵션 조립만 모달 내부에서 계산한다.
export type PointPolicyModalProps = {
  policyModalState: PolicyModalState;
  policyForm: FormInstance<PolicyFormValues>;
  closePolicyModal: () => void;
  handlePolicySubmit: () => Promise<void>;
};

export function PointPolicyModal({
  policyModalState,
  policyForm,
  closePolicyModal,
  handlePolicySubmit
}: PointPolicyModalProps): JSX.Element {
  return (
    <Modal
      open={Boolean(policyModalState)}
      title={
        policyModalState?.mode === 'edit' ? '포인트 정책 수정' : '포인트 정책 등록'
      }
      okText={policyModalState?.mode === 'edit' ? '수정 저장' : '정책 등록'}
      cancelText="취소"
      destroyOnHidden
      onCancel={closePolicyModal}
      onOk={handlePolicySubmit}
    >
      <Form form={policyForm} layout="vertical">
        <Descriptions
          bordered
          size="small"
          column={1}
          className="admin-form-descriptions"
          items={markRequiredDescriptionItems(
            [
              {
                key: 'name',
                label: '정책명',
                children: (
                  <Form.Item name="name" noStyle rules={[{ required: true }]}>
                    <Input placeholder="예: 추천 가입 보상" />
                  </Form.Item>
                )
              },
              {
                key: 'policyType',
                label: '정책 유형',
                children: (
                  <Form.Item
                    name="policyType"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { label: '적립', value: '적립' },
                        { label: '차감', value: '차감' },
                        { label: '소멸', value: '소멸' }
                      ]}
                    />
                  </Form.Item>
                )
              },
              {
                key: 'conditionSummary',
                label: '적용 조건',
                children: (
                  <Form.Item
                    name="conditionSummary"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                )
              },
              {
                key: 'earnDebitRule',
                label: '적립/차감 규칙',
                children: (
                  <Form.Item
                    name="earnDebitRule"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                )
              },
              {
                key: 'expirationRule',
                label: '소멸 규칙',
                children: (
                  <Form.Item
                    name="expirationRule"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                )
              },
              {
                key: 'targetCondition',
                label: '대상 조건',
                children: (
                  <Form.Item
                    name="targetCondition"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                )
              },
              {
                key: 'triggerSource',
                label: '발생 원천',
                children: (
                  <Form.Item
                    name="triggerSource"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                )
              },
              {
                key: 'duplicationRule',
                label: '중복 방지 규칙',
                children: (
                  <Form.Item
                    name="duplicationRule"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                )
              },
              {
                key: 'manualAdjustmentRule',
                label: '수동 조정 규칙',
                children: (
                  <Form.Item
                    name="manualAdjustmentRule"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={2} />
                  </Form.Item>
                )
              },
              {
                key: 'note',
                label: '운영 메모',
                children: (
                  <Form.Item name="note" noStyle rules={[{ required: true }]}>
                    <Input.TextArea rows={3} />
                  </Form.Item>
                )
              }
            ],
            [
              'name',
              'policyType',
              'conditionSummary',
              'earnDebitRule',
              'expirationRule',
              'targetCondition',
              'triggerSource',
              'duplicationRule',
              'manualAdjustmentRule',
              'note'
            ]
          )}
        />
      </Form>
    </Modal>
  );
}

export type PointManualAdjustmentModalProps = {
  adjustmentModalOpen: boolean;
  adjustmentTarget: PointLedger | null;
  adjustmentForm: FormInstance<ManualAdjustmentFormValues>;
  closeManualAdjustmentModal: () => void;
  handleManualAdjustmentSubmit: () => Promise<void>;
};

export function PointManualAdjustmentModal({
  adjustmentModalOpen,
  adjustmentTarget,
  adjustmentForm,
  closeManualAdjustmentModal,
  handleManualAdjustmentSubmit
}: PointManualAdjustmentModalProps): JSX.Element {
  return (
    <Modal
      open={adjustmentModalOpen}
      title={
        adjustmentTarget
          ? `포인트 수동 조정 · ${adjustmentTarget.userName}`
          : '포인트 수동 조정'
      }
      okText="조정 등록"
      cancelText="취소"
      destroyOnHidden
      onCancel={closeManualAdjustmentModal}
      onOk={handleManualAdjustmentSubmit}
    >
      <Form form={adjustmentForm} layout="vertical">
        <Descriptions
          bordered
          size="small"
          column={1}
          className="admin-form-descriptions"
          items={markRequiredDescriptionItems(
            [
              {
                key: 'userId',
                label: '회원 ID',
                children: (
                  <Form.Item name="userId" noStyle rules={[{ required: true }]}>
                    <Input placeholder="예: U00018" />
                  </Form.Item>
                )
              },
              {
                key: 'userName',
                label: '회원명',
                children: (
                  <Form.Item
                    name="userName"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="예: 김하린" />
                  </Form.Item>
                )
              },
              {
                key: 'ledgerType',
                label: '조정 유형',
                children: (
                  <Form.Item
                    name="ledgerType"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Select
                      options={[
                        { label: '적립', value: '적립' },
                        { label: '차감', value: '차감' },
                        { label: '회수', value: '회수' },
                        { label: '복구', value: '복구' }
                      ]}
                    />
                  </Form.Item>
                )
              },
              {
                key: 'amount',
                label: '조정 포인트',
                children: (
                  <Form.Item
                    name="amount"
                    noStyle
                    rules={[
                      { required: true },
                      {
                        validator: async (_, value: number | undefined) => {
                          if (!value || value <= 0) {
                            throw new Error('0보다 큰 포인트를 입력해 주세요.');
                          }
                        }
                      }
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={1}
                      step={100}
                      placeholder="예: 1000"
                    />
                  </Form.Item>
                )
              },
              {
                key: 'approvalMemo',
                label: '확인 메모',
                children: (
                  <Form.Item
                    name="approvalMemo"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                )
              },
              {
                key: 'reason',
                label: '사유/근거',
                children: (
                  <Form.Item name="reason" noStyle rules={[{ required: true }]}>
                    <Input.TextArea rows={4} />
                  </Form.Item>
                )
              }
            ],
            ['userId', 'userName', 'ledgerType', 'amount', 'approvalMemo', 'reason']
          )}
        />
      </Form>
    </Modal>
  );
}

export type PointExpirationHoldModalProps = {
  expirationHoldModalOpen: boolean;
  expirationHoldTarget: PointExpiration | null;
  expirationHoldForm: FormInstance<ExpirationHoldFormValues>;
  closeExpirationHoldModal: () => void;
  handleExpirationHoldSubmit: () => Promise<void>;
  expirations: PointExpiration[];
};

export function PointExpirationHoldModal({
  expirationHoldModalOpen,
  expirationHoldTarget,
  expirationHoldForm,
  closeExpirationHoldModal,
  handleExpirationHoldSubmit,
  expirations
}: PointExpirationHoldModalProps): JSX.Element {
  const expirationSelectOptions = useMemo(
    () =>
      expirations
        .filter((item) => item.status === '예정' || item.status === '보류')
        .map((item) => ({
          label: `${item.id} · ${item.userName} (${item.userId})`,
          value: item.id
        })),
    [expirations]
  );

  return (
    <Modal
      open={expirationHoldModalOpen}
      title={
        expirationHoldTarget
          ? `소멸 보류 등록 · ${expirationHoldTarget.id}`
          : '소멸 보류 등록'
      }
      okText="보류 등록"
      cancelText="취소"
      destroyOnHidden
      onCancel={closeExpirationHoldModal}
      onOk={handleExpirationHoldSubmit}
    >
      <Form form={expirationHoldForm} layout="vertical">
        <Descriptions
          bordered
          size="small"
          column={1}
          className="admin-form-descriptions"
          items={markRequiredDescriptionItems(
            [
              {
                key: 'expirationId',
                label: '소멸 예정 건',
                children: (
                  <Form.Item
                    name="expirationId"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Select
                      showSearch
                      options={expirationSelectOptions}
                      placeholder="소멸 예정 건을 선택해 주세요."
                    />
                  </Form.Item>
                )
              },
              {
                key: 'holdReason',
                label: '보류 사유',
                children: (
                  <Form.Item
                    name="holdReason"
                    noStyle
                    rules={[{ required: true }]}
                  >
                    <Input.TextArea rows={4} />
                  </Form.Item>
                )
              }
            ],
            ['expirationId', 'holdReason']
          )}
        />
      </Form>
    </Modal>
  );
}
