import { DeleteOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Space,
  Tag,
  Typography
} from 'antd';
import type { DescriptionsProps } from 'antd';
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
import { AdminFormDescriptions } from '../../../shared/ui/descriptions/admin-form-descriptions';

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

type TagMasterGroup = {
  group: string;
  rows: TopikWritingTagMasterRow[];
};

function formatAssignedTagLabel(labels: string[]): string {
  if (labels.length <= 1) {
    return labels[0] ?? '';
  }

  return `${labels[0]} 외 ${labels.length - 1}개`;
}

export function QuestionTagEditModal({
  open,
  questionId,
  activeTags,
  tagMasterRows,
  onClose,
  onMutated
}: QuestionTagEditModalProps): JSX.Element {
  const [selectedTagCodes, setSelectedTagCodes] = useState<string[]>([]);
  const [selectedTagGroup, setSelectedTagGroup] = useState<string | null>(null);
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

  const tagGroups = useMemo<TagMasterGroup[]>(() => {
    const byGroup = new Map<string, TopikWritingTagMasterRow[]>();
    tagMasterRows.forEach((row) => {
      const rows = byGroup.get(row.tagGroup) ?? [];
      rows.push(row);
      byGroup.set(row.tagGroup, rows);
    });
    return [...byGroup.entries()].map(([group, rows]) => ({ group, rows }));
  }, [tagMasterRows]);

  const selectedMasters = useMemo(
    () =>
      selectedTagCodes
        .map((tagCode) => masterByCode[tagCode])
        .filter((row): row is TopikWritingTagMasterRow => Boolean(row)),
    [masterByCode, selectedTagCodes]
  );

  const activeTagGroup = useMemo(
    () =>
      tagGroups.find((item) => item.group === selectedTagGroup) ??
      tagGroups[0] ??
      null,
    [selectedTagGroup, tagGroups]
  );

  const repeatAvoidActiveCount = useMemo(
    () =>
      activeTags.filter(
        (tag) => masterByCode[tag.tagCode]?.tagGroup === TAG_GROUP_REPEAT_AVOID
      ).length,
    [activeTags, masterByCode]
  );

  const resetAssignForm = (): void => {
    setSelectedTagCodes([]);
    setSelectedTagGroup(null);
    setAssignMemo('');
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    resetAssignForm();
    setRemoveTarget(null);
    onClose();
  };

  const handleAssign = async (): Promise<void> => {
    if (selectedTagCodes.length === 0 || assignMemo.trim().length === 0) {
      return;
    }

    setAssigning(true);
    setErrorMessage(null);
    const memo = assignMemo.trim();
    const assignedLabels: string[] = [];

    for (const tagCode of selectedTagCodes) {
      const result = await assignQuestionTagSafe({
        questionId,
        tagCode,
        memo
      });

      if (!result.ok) {
        setAssigning(false);
        if (assignedLabels.length > 0) {
          onMutated('tag_assigned', formatAssignedTagLabel(assignedLabels));
        }
        setErrorMessage(result.error.message);
        return;
      }

      assignedLabels.push(getTagLabel(tagCode));
    }

    setAssigning(false);
    resetAssignForm();
    onMutated('tag_assigned', formatAssignedTagLabel(assignedLabels));
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

  const handleTagCheckedChange = (tagCode: string, checked: boolean): void => {
    setSelectedTagCodes((current) => {
      if (checked) {
        return current.includes(tagCode) ? current : [...current, tagCode];
      }
      return current.filter((code) => code !== tagCode);
    });
  };

  const handleRemoveSelectedTag = (tagCode: string): void => {
    setSelectedTagCodes((current) => current.filter((code) => code !== tagCode));
  };

  const tagPickerPanel =
    tagGroups.length === 0 ? (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="부여할 수 있는 태그가 없습니다."
      />
    ) : (
      <div className="question-tag-edit-modal__tag-picker-panel">
        <div className="question-tag-edit-modal__tag-picker-header">
          <Text strong>부여할 태그</Text>
          <Text type="secondary">선택 {selectedTagCodes.length}개</Text>
        </div>

        <div className="question-tag-edit-modal__tag-picker-grid">
          <div
            className="question-tag-edit-modal__group-list"
            aria-label="태그 그룹"
          >
            {tagGroups.map(({ group, rows }) => {
              const checkedCount = selectedTagCodes.filter(
                (tagCode) => masterByCode[tagCode]?.tagGroup === group
              ).length;
              const isActiveGroup = activeTagGroup?.group === group;

              return (
                <button
                  key={group}
                  type="button"
                  className={
                    isActiveGroup
                      ? 'question-tag-edit-modal__group-button question-tag-edit-modal__group-button--active'
                      : 'question-tag-edit-modal__group-button'
                  }
                  onClick={() => setSelectedTagGroup(group)}
                >
                  <span>{group}</span>
                  <span className="question-tag-edit-modal__group-meta">
                    {checkedCount > 0 ? `${checkedCount}/${rows.length}` : rows.length}
                    <RightOutlined aria-hidden />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="question-tag-edit-modal__tag-list">
            <Text strong>{activeTagGroup?.group}</Text>
            <div className="question-tag-edit-modal__checkbox-grid">
              {(activeTagGroup?.rows ?? []).map((row) => (
                <Checkbox
                  key={row.tagCode}
                  checked={selectedTagCodes.includes(row.tagCode)}
                  disabled={activeTagCodes.has(row.tagCode)}
                  onChange={(event) =>
                    handleTagCheckedChange(row.tagCode, event.target.checked)
                  }
                >
                  <Space direction="vertical" size={0}>
                    <Text>{row.tagNameKo}</Text>
                    <Text type="secondary">{row.tagCode}</Text>
                  </Space>
                </Checkbox>
              ))}
            </div>

            {activeTagGroup?.rows.length ? (
              <Space direction="vertical" size={4}>
                {activeTagGroup.rows.map((row) => (
                  <Text key={row.tagCode} type="secondary">
                    {row.tagNameKo}: {row.description}
                    {row.usageRule ? ` / ${row.usageRule}` : ''}
                  </Text>
                ))}
              </Space>
            ) : null}
          </div>
        </div>

        <div className="question-tag-edit-modal__selected-bar">
          <div className="question-tag-edit-modal__selected-tags">
            {selectedMasters.length > 0 ? (
              selectedMasters.map((row) => (
                <Tag
                  key={row.tagCode}
                  closable
                  onClose={(event) => {
                    event.preventDefault();
                    handleRemoveSelectedTag(row.tagCode);
                  }}
                >
                  {row.tagNameKo}
                </Tag>
              ))
            ) : (
              <Text type="secondary">선택된 태그가 없습니다.</Text>
            )}
          </div>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            disabled={selectedTagCodes.length === 0}
            onClick={() => setSelectedTagCodes([])}
          >
            초기화
          </Button>
        </div>
      </div>
    );

  const descriptionItems = useMemo<DescriptionsProps['items']>(
    () => [
      {
        key: 'target',
        label: '대상',
        children: (
          <Space direction="vertical" size={2}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text type="secondary">대상 ID: {questionId}</Text>
          </Space>
        )
      },
      {
        key: 'activeTags',
        label: '활성 태그',
        children:
          activeTags.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="활성 태그가 없습니다."
            />
          ) : (
            <Space
              direction="vertical"
              size={8}
              className="question-tag-edit-modal__active-tags"
            >
              {activeTags.map((tag) => {
                const label = masterByCode[tag.tagCode]?.tagNameKo ?? tag.tagCode;
                return (
                  <Space key={tag.tagAssignmentId} size={8} wrap>
                    <Tag>{label}</Tag>
                    <Text type="secondary">{tag.memo || '-'}</Text>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={`태그 제거: ${label}`}
                      onClick={() => setRemoveTarget(tag)}
                    >
                      제거
                    </Button>
                  </Space>
                );
              })}
            </Space>
          )
      },
      {
        key: 'assignMemo',
        label: '부여 사유',
        children: (
          <Input.TextArea
            rows={3}
            value={assignMemo}
            placeholder="태그 부여 사유를 입력해 주세요. (필수 - question_tags.memo로 기록)"
            aria-label="태그 부여 사유"
            onChange={(event) => setAssignMemo(event.target.value)}
          />
        )
      }
    ],
    [
      activeTags,
      assignMemo,
      masterByCode,
      questionId
    ]
  );

  return (
    <>
      <Modal
        open={open}
        title="태그 편집"
        footer={null}
        onCancel={handleClose}
        destroyOnHidden
        width={860}
      >
        <Space direction="vertical" size={16} className="question-tag-edit-modal__body">
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

          <AdminFormDescriptions
            bordered
            size="small"
            column={1}
            className="question-tag-edit-modal__descriptions"
            items={descriptionItems}
            requiredKeys={['assignMemo']}
          />

          {tagPickerPanel}

          <div className="question-tag-edit-modal__actions">
            <Button onClick={handleClose}>취소</Button>
            <Button
              type="primary"
              loading={assigning}
              disabled={selectedTagCodes.length === 0 || assignMemo.trim().length === 0}
              onClick={() => void handleAssign()}
            >
              태그 부여
            </Button>
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
