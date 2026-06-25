import { Alert, Descriptions, Input, Modal, Select, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import { assessmentQuestionNumbers } from '../model/assessment-question-bank-schema';
import type { AssessmentQuestionSummary } from '../model/assessment-question-bank-types';
import type { InstitutionCode } from '../../users/model/institution-codes-types';

const { Text } = Typography;

export type BulkInstitutionExposureMode = 'set' | 'clear';

type BulkInstitutionExposureModalProps = {
  open: boolean;
  mode: BulkInstitutionExposureMode;
  selectedQuestions: AssessmentQuestionSummary[];
  codeOptions: InstitutionCode[];
  onCancel: () => void;
  onConfirm: (payload: {
    institutionCodes: string[];
    reason: string;
  }) => Promise<void> | void;
};

/**
 * 기관별 노출 일괄 처리 모달 (선택 문항 N건).
 *
 * - set: 선택 문항의 허용 기관을 고른 집합으로 동기화(set-semantics — 기존 설정을
 *   덮어쓴다). 지정한 기관 회원에게만 노출. 기관 1곳 이상 + 사유 필수.
 * - clear: 선택 문항의 기관 한정을 전부 해제(전체 공개로 복귀). 사유 필수.
 *
 * 사유·문항별 격리·멱등·감사(batch_id)는 RPC가 책임진다(BulkServiceStatusModal 대칭).
 */
export function BulkInstitutionExposureModal({
  open,
  mode,
  selectedQuestions,
  codeOptions,
  onCancel,
  onConfirm
}: BulkInstitutionExposureModalProps): JSX.Element {
  const [codes, setCodes] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCodes([]);
      setReason('');
      setSubmitting(false);
    }
  }, [open]);

  const isSet = mode === 'set';
  const total = selectedQuestions.length;

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

  const handleConfirm = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onConfirm({
        institutionCodes: isSet ? codes : [],
        reason: reason.trim()
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDisabled =
    total === 0 || reason.trim().length === 0 || (isSet && codes.length === 0);

  return (
    <Modal
      open={open}
      title={isSet ? '기관 한정 일괄 지정' : '기관 노출 일괄 해제 — 전체 공개'}
      okText={isSet ? '기관 한정으로 지정' : '전체 공개로 변경'}
      cancelText="취소"
      okButtonProps={{ danger: true, disabled: confirmDisabled, loading: submitting }}
      onCancel={onCancel}
      onOk={() => void handleConfirm()}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message={
            isSet
              ? '선택한 문항을 기관 한정으로 지정합니다.'
              : '선택한 문항을 전체 공개로 되돌립니다.'
          }
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
              {isSet ? (
                <Text type="danger">
                  선택 문항의 기존 기관 노출 설정은 아래에서 고른 기관 집합으로
                  덮어쓰기됩니다(set). 지정한 기관 소속 회원에게만 노출됩니다.
                </Text>
              ) : (
                <Text type="danger">
                  선택 문항의 기관 한정이 모두 해제되어 전체 학습자에게 공개됩니다.
                </Text>
              )}
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
              ...(isSet
                ? [
                    {
                      key: 'codes',
                      label: '노출 기관',
                      children: (
                        <Select
                          mode="multiple"
                          allowClear
                          style={{ width: '100%' }}
                          placeholder="노출할 기관 코드를 선택하세요."
                          value={codes}
                          onChange={setCodes}
                          optionFilterProp="label"
                          options={codeOptions.map((option) => ({
                            value: option.code,
                            label: `${option.label} (${option.code})`
                          }))}
                        />
                      )
                    }
                  ]
                : []),
              {
                key: 'reason',
                label: '사유/근거',
                children: (
                  <Input.TextArea
                    rows={4}
                    value={reason}
                    placeholder={
                      isSet
                        ? '기관 한정 지정 사유를 입력해 주세요.'
                        : '전체 공개 전환 사유를 입력해 주세요.'
                    }
                    onChange={(event) => setReason(event.target.value)}
                  />
                )
              }
            ],
            isSet ? ['codes', 'reason'] : ['reason']
          )}
        />
      </Space>
    </Modal>
  );
}
