import { Alert, Button, Empty, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import {
  assignQuestionTagSafe,
  removeQuestionTagSafe
} from '../api/assessment-question-bank-service';
import {
  REPEAT_AVOID_EXCESS_THRESHOLD,
  TAG_GROUP_REPEAT_AVOID
} from '../model/assessment-question-bank-schema';
import type {
  TopikWritingQuestionTagRow,
  TopikWritingTagMasterRow
} from '../model/assessment-question-bank-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';

const { Text } = Typography;

/**
 * P4 관리 포인트 — 태그 부여/제거 편집기 (실행계획안 §8, 결정 기록 D-6/D-8).
 * 부여·제거 모두 사유 입력이 필수다(question_tags.memo — 운영 메모의 유일한
 * 기록처). 부여 옵션은 tag_master 활성 사전이며 '서비스_노출상태' 그룹은
 * facade·RPC 양쪽에서 차단된다. 모든 write는 RPC 경유로 admin_audit_logs에
 * tag_assigned/tag_removed가 남는다 — 성공 알림(감사 링크 포함)은 부모가 띄운다.
 */

type QuestionTagEditModalProps = {
  open: boolean;
  questionId: string;
  activeTags: TopikWritingQuestionTagRow[];
  tagMasterRows: TopikWritingTagMasterRow[];
  onClose: () => void;
  /** write 성공 후 호출 — 부모가 태그 재조회 + 성공 알림(감사 링크)을 담당한다. */
  onMutated: (action: 'tag_assigned' | 'tag_removed', tagLabel: string) => void;
};

export function QuestionTagEditModal({
  open,
  questionId,
  activeTags,
  tagMasterRows,
  onClose,
  onMutated
}: QuestionTagEditModalProps): JSX.Element {
  const [selectedTagCode, setSelectedTagCode] = useState<string | null>(null);
  const [assignMemo, setAssignMemo] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TopikWritingQuestionTagRow | null>(
    null
  );

  const masterByCode = useMemo(() => {
    const byCode: Record<string, TopikWritingTagMasterRow> = {};
    tagMasterRows.forEach((row) => {
      byCode[row.tagCode] = row;
    });
    return byCode;
  }, [tagMasterRows]);

  const getTagLabel = (tagCode: string): string =>
    masterByCode[tagCode]?.tagNameKo ?? tagCode;

  const activeTagCodes = useMemo(
    () => new Set(activeTags.map((tag) => tag.tagCode)),
    [activeTags]
  );

  const selectOptions = useMemo(() => {
    const byGroup = new Map<string, { label: string; value: string }[]>();
    tagMasterRows.forEach((row) => {
      const options = byGroup.get(row.tagGroup) ?? [];
      options.push({
        label: `${row.tagNameKo} (${row.tagCode})`,
        value: row.tagCode
      });
      byGroup.set(row.tagGroup, options);
    });
    return [...byGroup.entries()].map(([group, options]) => ({
      label: group,
      title: group,
      options: options.map((option) => ({
        ...option,
        disabled: activeTagCodes.has(option.value)
      }))
    }));
  }, [activeTagCodes, tagMasterRows]);

  const selectedMaster = selectedTagCode ? masterByCode[selectedTagCode] : null;

  const repeatAvoidActiveCount = useMemo(
    () =>
      activeTags.filter(
        (tag) => masterByCode[tag.tagCode]?.tagGroup === TAG_GROUP_REPEAT_AVOID
      ).length,
    [activeTags, masterByCode]
  );

  const resetAssignForm = (): void => {
    setSelectedTagCode(null);
    setAssignMemo('');
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    resetAssignForm();
    setRemoveTarget(null);
    onClose();
  };

  const handleAssign = async (): Promise<void> => {
    if (!selectedTagCode) {
      return;
    }

    setAssigning(true);
    setErrorMessage(null);
    const result = await assignQuestionTagSafe({
      questionId,
      tagCode: selectedTagCode,
      memo: assignMemo.trim()
    });
    setAssigning(false);

    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }

    const label = getTagLabel(selectedTagCode);
    resetAssignForm();
    onMutated('tag_assigned', label);
  };

  const handleConfirmRemove = async (reason: string): Promise<void> => {
    if (!removeTarget) {
      return;
    }

    const result = await removeQuestionTagSafe({
      tagAssignmentId: removeTarget.tagAssignmentId,
      memo: reason
    });

    if (!result.ok) {
      setRemoveTarget(null);
      setErrorMessage(result.error.message);
      return;
    }

    const label = getTagLabel(removeTarget.tagCode);
    setRemoveTarget(null);
    setErrorMessage(null);
    onMutated('tag_removed', label);
  };

  return (
    <>
      <Modal
        open={open}
        title="태그 편집"
        footer={null}
        onCancel={handleClose}
        destroyOnHidden
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Text type="secondary">
            대상 유형: {getTargetTypeLabel('AssessmentQuestion')} / 대상 ID: {questionId}
          </Text>

          {errorMessage ? (
            <Alert
              type="error"
              showIcon
              message="태그 편집에 실패했습니다."
              description={errorMessage}
            />
          ) : null}

          {repeatAvoidActiveCount >= REPEAT_AVOID_EXCESS_THRESHOLD ? (
            <Alert
              type="warning"
              showIcon
              message="반복방지 태그 활성 과다"
              description={`반복방지 태그가 ${repeatAvoidActiveCount}개 활성입니다. 반복 노출 회피 대상 과다 문항은 노출 제외(excluded)를 권고합니다(POL-018 ③).`}
            />
          ) : null}

          <div>
            <Text strong>활성 태그</Text>
            <div style={{ marginTop: 8 }}>
              {activeTags.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="활성 태그가 없습니다."
                />
              ) : (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {activeTags.map((tag) => {
                    const label = getTagLabel(tag.tagCode);
                    return (
                      <Space key={tag.tagAssignmentId} size={8} wrap>
                        <Tag>{label}</Tag>
                        <Text type="secondary">{tag.memo || '-'}</Text>
                        <Button
                          size="small"
                          danger
                          aria-label={`태그 제거: ${label}`}
                          onClick={() => setRemoveTarget(tag)}
                        >
                          제거
                        </Button>
                      </Space>
                    );
                  })}
                </Space>
              )}
            </div>
          </div>

          <div>
            <Text strong>태그 부여</Text>
            <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
              <Select
                style={{ width: '100%' }}
                value={selectedTagCode ?? undefined}
                options={selectOptions}
                placeholder="부여할 태그를 선택해 주세요."
                aria-label="부여할 태그"
                showSearch
                optionFilterProp="label"
                onChange={(value) => setSelectedTagCode(value)}
              />
              {selectedMaster ? (
                <Text type="secondary">
                  {selectedMaster.description}
                  {selectedMaster.usageRule ? ` — ${selectedMaster.usageRule}` : ''}
                </Text>
              ) : null}
              <Input.TextArea
                rows={3}
                value={assignMemo}
                placeholder="태그 부여 사유를 입력해 주세요. (필수 — question_tags.memo로 기록)"
                aria-label="태그 부여 사유"
                onChange={(event) => setAssignMemo(event.target.value)}
              />
              <Button
                type="primary"
                loading={assigning}
                disabled={!selectedTagCode || assignMemo.trim().length === 0}
                onClick={() => void handleAssign()}
              >
                태그 부여
              </Button>
            </Space>
          </div>
        </Space>
      </Modal>

      {removeTarget ? (
        <ConfirmAction
          open
          title="태그 제거"
          description={`'${getTagLabel(removeTarget.tagCode)}' 태그를 제거합니다. 제거 이력은 보존되며(is_active=false), 제거 사유와 감사 로그(tag_removed)가 남습니다.`}
          targetType="AssessmentQuestion"
          targetId={questionId}
          confirmText="태그 제거"
          reasonPlaceholder="태그 제거 사유를 입력해 주세요."
          onCancel={() => setRemoveTarget(null)}
          onConfirm={handleConfirmRemove}
        />
      ) : null}
    </>
  );
}
