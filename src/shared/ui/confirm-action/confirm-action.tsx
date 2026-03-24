import { Alert, Descriptions, Input, Modal, Select, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getTargetTypeLabel } from '../../model/target-type-label';
import { markRequiredDescriptionItems } from '../descriptions/description-label';

const { Text } = Typography;

type ConfirmActionPolicyCodeOption = {
  label: string;
  value: string;
  description?: string;
};

type ConfirmActionProps = {
  open: boolean;
  title: string;
  description: string;
  targetType: string;
  targetId: string;
  confirmText: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  policyCodeLabel?: string;
  policyCodeOptions?: ConfirmActionPolicyCodeOption[];
  policyCodePlaceholder?: string;
  requirePolicyCode?: boolean;
  onCancel: () => void;
  onConfirm: (
    reason: string,
    context?: { policyCode?: string }
  ) => Promise<void> | void;
};

export function ConfirmAction({
  open,
  title,
  description,
  targetType,
  targetId,
  confirmText,
  requireReason = true,
  reasonLabel = '사유/근거',
  reasonPlaceholder = '조치 사유를 입력하세요.',
  policyCodeLabel = '정책 코드',
  policyCodeOptions,
  policyCodePlaceholder = '정책 코드를 선택하세요.',
  requirePolicyCode = false,
  onCancel,
  onConfirm
}: ConfirmActionProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [policyCode, setPolicyCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setPolicyCode('');
      setSubmitting(false);
    }
  }, [open]);

  const isDisabled = useMemo(() => {
    if (requireReason && reason.trim().length === 0) {
      return true;
    }
    if (requirePolicyCode && policyCode.trim().length === 0) {
      return true;
    }
    return false;
  }, [policyCode, reason, requirePolicyCode, requireReason]);

  const selectedPolicyCodeDescription = useMemo(
    () =>
      policyCodeOptions?.find((option) => option.value === policyCode)?.description ??
      '',
    [policyCode, policyCodeOptions]
  );

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim(), {
        policyCode: policyCode.trim() || undefined
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText="취소"
      okButtonProps={{ danger: true, disabled: isDisabled, loading: submitting }}
      onCancel={onCancel}
      onOk={handleConfirm}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        message="고위험 액션 확인"
        description={description}
        style={{ marginBottom: 12 }}
      />
      <Descriptions
        bordered
        size="small"
        column={1}
        className="admin-form-descriptions"
        items={markRequiredDescriptionItems(
          [
            {
              key: 'target',
              label: '대상',
              children: (
                <Text type="secondary">
                  대상 유형: {getTargetTypeLabel(targetType)} / 대상 ID: {targetId}
                </Text>
              )
            },
            ...(policyCodeOptions?.length
              ? [
                  {
                    key: 'policyCode',
                    label: policyCodeLabel,
                    children: (
                      <div>
                        <Select
                          value={policyCode || undefined}
                          options={policyCodeOptions}
                          placeholder={policyCodePlaceholder}
                          onChange={(value) => setPolicyCode(value)}
                        />
                        {selectedPolicyCodeDescription ? (
                          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                            {selectedPolicyCodeDescription}
                          </Text>
                        ) : null}
                      </div>
                    )
                  }
                ]
              : []),
            {
              key: 'reason',
              label: reasonLabel,
              children: (
                <Input.TextArea
                  rows={4}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={reasonPlaceholder}
                />
              )
            }
          ],
          [
            ...(policyCodeOptions?.length && requirePolicyCode ? ['policyCode'] : []),
            ...(requireReason ? ['reason'] : [])
          ]
        )}
      />
    </Modal>
  );
}
