import { Alert, Button, Input, Modal, Space, Typography } from 'antd';
import { CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';

import { setWritingQuestionInstitutionsSafe } from '../api/assessment-question-bank-service';
import { getServiceStatusLabel } from '../model/assessment-question-bank-schema';
import type {
  AssessmentServiceStatus,
  BulkServiceStatusResult,
  WritingQuestionInstitutionRow
} from '../model/assessment-question-bank-types';
import type { InstitutionCode } from '../../users/model/institution-codes-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Text } = Typography;

/**
 * 기관별 노출 설정(단건) — 공개 기본 + 기관 한정.
 *
 * 태그 편집기의 다중 체크 + 칩 트레이 + 사유 필수 패턴을 차용하되, 기관 코드는
 * 그룹 계층이 없으므로 좌(기관 목록·검색)/우(상세) 2컬럼으로 단순화했다. 노출 모델은
 * set-semantics라 "체크된 코드 집합 = 그 문항의 최종 허용 기관"이며, 적용은
 * admin_set_writing_question_institutions RPC 1회다(추가/제거를 한 번에 반영).
 * 아무 기관도 선택하지 않으면 전체 공개로 되돌아간다. 사유는 필수이며 감사 로그로 남는다.
 */

export type QuestionInstitutionMutationSummary = {
  added: string[];
  removed: string[];
  /** 변경 결과 전체 공개로 돌아갔는지(현재 매핑이 있었고 최종 집합이 비었음). */
  clearedToPublic: boolean;
  result: BulkServiceStatusResult;
};

type QuestionInstitutionEditModalProps = {
  open: boolean;
  questionId: string;
  questionServiceStatus: AssessmentServiceStatus | null;
  activeInstitutions: WritingQuestionInstitutionRow[];
  /** 활성 기관 코드 옵션(institution_codes status='활성'). */
  codeOptions: InstitutionCode[];
  onClose: () => void;
  /** set 성공 후 호출 — 부모가 매핑 재조회 + 요약 알림을 담당한다. */
  onMutated: (summary: QuestionInstitutionMutationSummary) => void;
};

export function QuestionInstitutionEditModal({
  open,
  questionId,
  questionServiceStatus,
  activeInstitutions,
  codeOptions,
  onClose,
  onMutated
}: QuestionInstitutionEditModalProps): JSX.Element {
  const currentCodes = useMemo(
    () => activeInstitutions.map((row) => row.institutionCode),
    [activeInstitutions]
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(currentCodes));
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 현재 매핑이 바뀌면(재오픈/외부 변경) 선택 상태를 현재 매핑으로 동기화한다.
  useEffect(() => {
    setSelected(new Set(currentCodes));
  }, [currentCodes]);

  useEffect(() => {
    if (open) {
      setReason('');
      setQuery('');
      setErrorMessage(null);
    }
  }, [open, questionId]);

  const codeByValue = useMemo(() => {
    const byCode: Record<string, InstitutionCode> = {};
    codeOptions.forEach((option) => {
      byCode[option.code] = option;
    });
    return byCode;
  }, [codeOptions]);

  // 종료(비활성) 코드는 codeOptions(활성만)에 없으므로, 현재 매핑 행이 보유한 라벨을 폴백한다.
  const activeLabelByCode = useMemo(() => {
    const byCode: Record<string, string> = {};
    activeInstitutions.forEach((row) => {
      byCode[row.institutionCode] = row.institutionLabel;
    });
    return byCode;
  }, [activeInstitutions]);

  const getCodeLabel = (code: string): string =>
    codeByValue[code]?.label ?? activeLabelByCode[code] ?? code;

  const trimmedQuery = query.trim().toLowerCase();
  const visibleCodes = useMemo(() => {
    if (!trimmedQuery) {
      return codeOptions;
    }
    return codeOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(trimmedQuery) ||
        option.code.toLowerCase().includes(trimmedQuery)
    );
  }, [codeOptions, trimmedQuery]);

  const currentSet = useMemo(() => new Set(currentCodes), [currentCodes]);
  const added = useMemo(
    () => [...selected].filter((code) => !currentSet.has(code)),
    [selected, currentSet]
  );
  const removed = useMemo(
    () => currentCodes.filter((code) => !selected.has(code)),
    [currentCodes, selected]
  );
  const hasChanges = added.length > 0 || removed.length > 0;
  const willBePublic = selected.size === 0;
  const isGloballyAvailable = questionServiceStatus === 'available';

  const toggle = (code: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else if (!isGloballyAvailable) {
        return next;
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleReset = (): void => {
    setSelected(new Set(currentCodes));
    setReason('');
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    handleReset();
    onClose();
  };

  const handleApply = async (): Promise<void> => {
    setErrorMessage(null);
    if (!hasChanges) {
      return;
    }
    if (reason.trim().length === 0) {
      setErrorMessage('기관 노출 변경 사유를 입력해 주세요.');
      return;
    }

    setApplying(true);
    const result = await setWritingQuestionInstitutionsSafe({
      questionIds: [questionId],
      institutionCodes: [...selected],
      reason: reason.trim()
    });
    setApplying(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    onMutated({
      added: added.map(getCodeLabel),
      removed: removed.map(getCodeLabel),
      clearedToPublic: willBePublic && currentCodes.length > 0,
      result: result.data
    });
    onClose();
  };

  const applyDisabled = !hasChanges || reason.trim().length === 0;

  return (
    <Modal
      open={open}
      title="기관 노출 설정"
      footer={null}
      width={600}
      onCancel={handleClose}
      destroyOnHidden
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Space
          style={{ width: '100%', justifyContent: 'space-between' }}
          align="start"
          wrap
        >
          <Text type="secondary">
            대상 유형: {getTargetTypeLabel('AssessmentQuestion')} / 대상 ID: {questionId}
          </Text>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="기관명 또는 코드를 입력하세요."
            aria-label="기관 코드 검색"
            value={query}
            style={{ width: 240 }}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Space>

        <Alert
          type={isGloballyAvailable ? 'info' : 'warning'}
          showIcon
          message={
            !isGloballyAvailable
              ? '전역 노출 상태가 노출 가능이 아니어서 신규 기관 추가는 차단됩니다.'
              : willBePublic
                ? '선택한 기관이 없습니다 — 전체 공개(모든 학습자에게 노출)입니다.'
                : `기관 한정 ${selected.size}곳 — 선택한 기관 소속 회원에게만 노출됩니다.`
          }
          description={
            isGloballyAvailable
              ? '기관을 선택하지 않으면 전체 공개입니다. 단, 실제 사용자 노출은 전역 노출 상태가 노출 가능일 때만 유효합니다.'
              : `현재 상태: ${getServiceStatusLabel(questionServiceStatus)}. 기존 기관 매핑은 보존되지만 현재 사용자에게 노출되지 않으며, 이 모달에서는 제거만 가능합니다.`
          }
        />

        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            message="기관 노출 설정에 실패했습니다."
            description={errorMessage}
          />
        ) : null}

        <div
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}
        >
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {visibleCodes.length === 0 ? (
              <div style={{ padding: 12 }}>
                <Text type="secondary">
                  {trimmedQuery ? '검색 결과가 없습니다.' : '활성 기관 코드가 없습니다.'}
                </Text>
              </div>
            ) : (
              visibleCodes.map((option) => {
                const checked = selected.has(option.code);
                const disabledByStatus = !checked && !isGloballyAvailable;
                return (
                  <div
                    key={option.code}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={checked}
                    aria-disabled={disabledByStatus}
                    aria-label={option.label}
                    data-testid={`institution-row-${option.code}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      cursor: disabledByStatus ? 'not-allowed' : 'pointer',
                      opacity: disabledByStatus ? 0.55 : 1
                    }}
                    onClick={() => {
                      if (!disabledByStatus) {
                        toggle(option.code);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (!disabledByStatus) {
                          toggle(option.code);
                        }
                      }
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        flex: '0 0 16px',
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        border: checked ? 'none' : '1px solid #d9d9d9',
                        background: checked ? '#1677ff' : '#fff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}
                    >
                      {checked ? <CheckOutlined style={{ fontSize: 11 }} /> : null}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {option.label}
                    </span>
                    <Text
                      type="secondary"
                      style={{ flexShrink: 0, fontSize: 12, whiteSpace: 'nowrap' }}
                    >
                      {option.code} · 소속 {option.memberCount.toLocaleString()}명
                    </Text>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {hasChanges ? (
          <div>
            <Text strong>
              변경 사유 <Text type="danger">*</Text>
            </Text>
            <Input.TextArea
              rows={2}
              value={reason}
              placeholder="기관 노출 변경 사유를 입력해 주세요. (필수 — 감사 로그로 기록)"
              aria-label="기관 노출 변경 사유"
              style={{ marginTop: 6 }}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose}>취소</Button>
          <Button
            type="primary"
            loading={applying}
            disabled={applyDisabled}
            onClick={() => void handleApply()}
          >
            확인
            {hasChanges
              ? willBePublic
                ? ' — 전체 공개로 변경'
                : ` — 기관 한정 ${selected.size}곳 적용`
              : ''}
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
