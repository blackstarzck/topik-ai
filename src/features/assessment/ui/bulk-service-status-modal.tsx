import { Alert, Descriptions, Input, Modal, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import {
  SERVICE_STATUS_LABELS,
  assessmentQuestionNumbers,
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
 * 운영 조치 일괄 전환 확인 모달.
 *
 * - 노출 가능(available): 사유 입력 없이 "총 N개 | 51번 a | …  노출하시겠습니까?"
 *   번호별 개수 확인 팝업이다(오너 2026-06-23 결정 — 개수 확인만). 사유는 감사용으로
 *   자동 기록되며, 운영주의 태그 활성 문항은 서버가 자동 제외(차단)함을 안내한다.
 * - 숨김(노출 제외/내부 테스트): 사유 필수 + 현재 노출 중 문항이 학습자에게서
 *   즉시 사라진다는 경고를 띄운다.
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

  const isAvailable = nextStatus === 'available';
  const nextLabel = SERVICE_STATUS_LABELS[nextStatus];
  const total = selectedQuestions.length;

  // 번호별(51/52/53/54) 분포 — 노출 확인 팝업의 핵심 정보.
  const numberBreakdown = useMemo(
    () =>
      assessmentQuestionNumbers
        .map((number) => ({
          number,
          count: selectedQuestions.filter(
            (question) => question.questionNumber === number
          ).length
        }))
        .filter((entry) => entry.count > 0),
    [selectedQuestions]
  );

  // 현재 상태 분포 — 숨김 모달에서 표시.
  const statusBreakdown = useMemo(
    () =>
      assessmentServiceStatuses
        .map((status) => ({
          status,
          label: SERVICE_STATUS_LABELS[status],
          count: selectedQuestions.filter(
            (question) => question.serviceStatus === status
          ).length
        }))
        .filter((entry) => entry.count > 0),
    [selectedQuestions]
  );

  // 숨김 전환 시 지금 노출 중(available)인 문항은 학습자 화면에서 즉시 사라진다.
  const hidingNowVisibleCount = useMemo(() => {
    if (isAvailable) {
      return 0;
    }
    return selectedQuestions.filter(
      (question) => question.serviceStatus === 'available'
    ).length;
  }, [isAvailable, selectedQuestions]);

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
      title={isAvailable ? '문항 노출 확인' : `노출 상태 일괄 전환 — ${nextLabel}`}
      okText={isAvailable ? '노출하기' : `${nextLabel}로 변경`}
      cancelText="취소"
      okButtonProps={{
        danger: true,
        disabled:
          total === 0 || (!isAvailable && reason.trim().length === 0),
        loading: submitting
      }}
      onCancel={onCancel}
      onOk={() => void handleConfirm()}
      destroyOnHidden
    >
      {isAvailable ? (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="선택한 문항을 노출하시겠습니까?"
            description={
              <Space direction="vertical" size={6}>
                <Text strong style={{ fontSize: 15 }}>
                  총 {total.toLocaleString()}개
                  {numberBreakdown.map((entry) => (
                    <Text key={entry.number} strong style={{ fontSize: 15 }}>
                      {' | '}
                      {entry.number}번 {entry.count.toLocaleString()}개
                    </Text>
                  ))}
                </Text>
                {cautionCount > 0 ? (
                  <Text type="danger">
                    이 중 운영주의 태그가 활성인 {cautionCount}건은 노출에서 자동
                    제외됩니다(서버 차단). 나머지만 노출 가능으로 전환됩니다.
                  </Text>
                ) : null}
                <Text type="secondary">
                  이미 노출 중인 문항은 건너뜁니다. 노출 사유는 감사 로그에 자동
                  기록됩니다.
                </Text>
              </Space>
            }
          />
        </Space>
      ) : (
        <>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="일괄 운영 조치 확인"
            description={
              <Space direction="vertical" size={4}>
                <Text>
                  선택한 {total.toLocaleString()}건의 노출 상태를{' '}
                  <Text strong>{nextLabel}</Text>(으)로 일괄 변경합니다. 이미 해당
                  상태인 문항은 건너뜁니다(변경 없음).
                </Text>
                {hidingNowVisibleCount > 0 ? (
                  <Text type="danger">
                    이 중 현재 노출 중(노출 가능) 문항 {hidingNowVisibleCount}건이
                    학습자 화면에서 즉시 사라집니다.
                  </Text>
                ) : null}
                <Text type="secondary">
                  변경 사유는 문항별 감사 로그로 남습니다.
                </Text>
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
                  children: <Text>선택 {total.toLocaleString()}건</Text>
                },
                {
                  key: 'breakdown',
                  label: '현재 상태 분포',
                  children: (
                    <Space size={12} wrap>
                      {statusBreakdown.length > 0 ? (
                        statusBreakdown.map((entry) => (
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
        </>
      )}
    </Modal>
  );
}
