import { Alert, Descriptions, Input, Modal, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import {
  SERVICE_STATUS_LABELS,
  assessmentServiceStatuses
} from '../model/assessment-question-bank-schema';
import type {
  AssessmentQuestionSummary,
  AssessmentServiceStatus
} from '../model/assessment-question-bank-types';

const { Text } = Typography;

type BulkServiceStatusModalProps = {
  open: boolean;
  nextStatus: AssessmentServiceStatus;
  selectedQuestions: AssessmentQuestionSummary[];
  /** 노출(available) 전환 시 서버가 차단할 운영주의 태그 활성 건수(안내용). */
  cautionCount?: number;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
};

/**
 * 운영 조치 일괄 전환 확인 모달 (P1). 단건 ConfirmAction과 같은 골격(경고 +
 * 대상/사유 Descriptions)을 따르되, 일괄 처리에 필요한 정보를 보강한다:
 * 선택 건수, 현재 상태 분포, 그리고 숨김(노출 제외/내부 테스트) 전환 시 "지금
 * 노출 중인 K건이 학습자에게서 사라진다"는 경고. 사유는 일괄에 공통 적용된다.
 */
export function BulkServiceStatusModal({
  open,
  nextStatus,
  selectedQuestions,
  cautionCount = 0,
  onCancel,
  onConfirm
}: BulkServiceStatusModalProps): JSX.Element {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  const nextLabel = SERVICE_STATUS_LABELS[nextStatus];

  const breakdown = useMemo(() => {
    const counts = assessmentServiceStatuses.map((status) => ({
      status,
      label: SERVICE_STATUS_LABELS[status],
      count: selectedQuestions.filter(
        (question) => question.serviceStatus === status
      ).length
    }));
    return counts.filter((entry) => entry.count > 0);
  }, [selectedQuestions]);

  // 숨김(노출 제외/내부 테스트) 전환 시, 지금 노출 중(available)인 문항은 학습자
  // 화면에서 즉시 사라진다 — 대량 콘텐츠 장애 위험이므로 별도 경고한다.
  const hidingNowVisibleCount = useMemo(() => {
    if (nextStatus === 'available') {
      return 0;
    }
    return selectedQuestions.filter(
      (question) => question.serviceStatus === 'available'
    ).length;
  }, [nextStatus, selectedQuestions]);

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
      title={`노출 상태 일괄 전환 — ${nextLabel}`}
      okText={`${nextLabel}로 변경`}
      cancelText="취소"
      okButtonProps={{
        danger: true,
        disabled: reason.trim().length === 0 || selectedQuestions.length === 0,
        loading: submitting
      }}
      onCancel={onCancel}
      onOk={() => void handleConfirm()}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="일괄 운영 조치 확인"
        description={
          <Space direction="vertical" size={4}>
            <Text>
              선택한 {selectedQuestions.length.toLocaleString()}건의 노출 상태를{' '}
              <Text strong>{nextLabel}</Text>(으)로 일괄 변경합니다. 이미 해당
              상태인 문항은 건너뜁니다(변경 없음).
            </Text>
            {hidingNowVisibleCount > 0 ? (
              <Text type="danger">
                이 중 현재 노출 중(노출 가능) 문항 {hidingNowVisibleCount}건이
                학습자 화면에서 즉시 사라집니다.
              </Text>
            ) : null}
            {nextStatus === 'available' && cautionCount > 0 ? (
              <Text type="danger">
                이 중 운영주의 태그가 활성인 {cautionCount}건은 노출에서 자동
                제외됩니다(서버 차단). 나머지만 노출 가능으로 전환됩니다.
              </Text>
            ) : null}
            <Text type="secondary">변경 사유는 문항별 감사 로그로 남습니다.</Text>
          </Space>
        }
      />
      <Descriptions
        bordered
        size="small"
        column={1}
        className="admin-form-descriptions"
        items={markRequiredDescriptionItems(
          [
            {
              key: 'count',
              label: '대상',
              children: (
                <Text>선택 {selectedQuestions.length.toLocaleString()}건</Text>
              )
            },
            {
              key: 'breakdown',
              label: '현재 상태 분포',
              children: (
                <Space size={12} wrap>
                  {breakdown.length > 0 ? (
                    breakdown.map((entry) => (
                      <Text key={entry.status} type="secondary">
                        {entry.label} {entry.count.toLocaleString()}건
                      </Text>
                    ))
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Space>
              )
            },
            {
              key: 'reason',
              label: '사유/근거',
              children: (
                <Input.TextArea
                  rows={4}
                  value={reason}
                  placeholder={`${nextLabel} 일괄 전환 사유를 입력해 주세요.`}
                  onChange={(event) => setReason(event.target.value)}
                />
              )
            }
          ],
          ['reason']
        )}
      />
    </Modal>
  );
}
