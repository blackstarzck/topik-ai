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
  onConfirm: (reason: string, context?: { policyCode?: string }) => Promise<void> | void;
};

export function ConfirmAction({
  open,
  title,
  description,
  targetType,
  targetId,
  confirmText,
  requireReason = true,
  reasonLabel = '\uc0ac\uc720/\uadfc\uac70',
  reasonPlaceholder = '\uc870\uce58 \uc0ac\uc720\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.',
  policyCodeLabel = '\uc815\ucc45 \ucf54\ub4dc',
  policyCodeOptions,
  policyCodePlaceholder = '\uc815\ucc45 \ucf54\ub4dc\ub97c \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.',
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

  const selectedPolicyDescription = useMemo(
    () => policyCodeOptions?.find((option) => option.value === policyCode)?.description ?? '',
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
      cancelText="\ucde8\uc18c"
      okButtonProps={{ danger: true, disabled: isDisabled, loading: submitting }}
      onCancel={onCancel}
      onOk={() => void handleConfirm()}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="\uace0\uc704\ud5d8 \uc561\uc158 \ud655\uc778"
        description={description}
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
              label: '\ub300\uc0c1',
              children: (
                <Text type="secondary">
                  \ub300\uc0c1 \uc720\ud615: {getTargetTypeLabel(targetType)} / \ub300\uc0c1 ID:{' '}
                  {targetId}
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
                        {selectedPolicyDescription ? (
                          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                            {selectedPolicyDescription}
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
                  placeholder={reasonPlaceholder}
                  onChange={(event) => setReason(event.target.value)}
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
