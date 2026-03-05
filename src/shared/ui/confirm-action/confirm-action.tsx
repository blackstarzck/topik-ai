import { Alert, Form, Input, Modal, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getTargetTypeLabel } from '../../model/target-type-label';

const { Text } = Typography;

type ConfirmActionProps = {
  open: boolean;
  title: string;
  description: string;
  targetType: string;
  targetId: string;
  confirmText: string;
  requireReason?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function ConfirmAction({
  open,
  title,
  description,
  targetType,
  targetId,
  confirmText,
  requireReason = true,
  onCancel,
  onConfirm
}: ConfirmActionProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  const isDisabled = useMemo(() => {
    if (!requireReason) {
      return false;
    }
    return reason.trim().length === 0;
  }, [reason, requireReason]);

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
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
      destroyOnClose
    >
      <Form layout="vertical">
        <Alert
          type="warning"
          showIcon
          message="고위험 액션 확인"
          description={description}
          style={{ marginBottom: 12 }}
        />
        <Text type="secondary">
          대상 유형: {getTargetTypeLabel(targetType)} / 대상 ID: {targetId}
        </Text>
        <Form.Item
          label="사유/근거"
          required={requireReason}
          style={{ marginTop: 12, marginBottom: 0 }}
        >
          <Input.TextArea
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="조치 사유를 입력하세요."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
