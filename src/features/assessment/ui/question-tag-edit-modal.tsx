import { Alert, Button, Empty, Input, Modal, Space, Tag, Typography } from 'antd';
import { CheckOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import type { MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

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
import { getTargetTypeLabel } from '@/shared/model/target-type-label';

const { Text, Paragraph } = Typography;

/**
 * P4 관리 포인트 — 태그 부여/제거 편집기 (실행계획안 §8, 결정 기록 D-6/D-8).
 *
 * 잡코리아 직무 선택 UI를 차용한 탐색형 편집기: 좌측 그룹 → 중앙 태그 다중
 * 체크 → 우측 상세 미리보기로 좁혀가고, 하단 칩 트레이에서 변경 예정을 확인한
 * 뒤 한 번에 적용한다. 우리 태그는 그룹→태그 2단계 플랫이므로 잡코리아의 3번째
 * 캐스케이드 칼럼은 상세 패널로 치환했다.
 *
 * 부여 옵션은 tag_master 활성 사전이며 '서비스_노출상태' 그룹은 facade·RPC
 * 양쪽에서 차단된다. 모든 write는 RPC(admin_assign·remove_question_tag)
 * 경유로 admin_audit_logs에 tag_assigned/tag_removed가 남는다 — 성공/부분 실패
 * 요약 알림(감사 링크)은 부모가 띄운다.
 */

export type QuestionTagMutationSummary = {
  assigned: string[];
  removed: string[];
  failed: { label: string; action: 'assign' | 'remove'; message: string }[];
};

type QuestionTagEditModalProps = {
  open: boolean;
  questionId: string;
  activeTags: TopikWritingQuestionTagRow[];
  tagMasterRows: TopikWritingTagMasterRow[];
  onClose: () => void;
  /** 일괄 write 성공/부분 실패 후 호출 — 부모가 태그 재조회 + 요약 알림을 담당한다. */
  onMutated: (summary: QuestionTagMutationSummary) => void;
};

export function QuestionTagEditModal({
  open,
  questionId,
  activeTags,
  tagMasterRows,
  onClose,
  onMutated
}: QuestionTagEditModalProps): JSX.Element {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [focusedTagCode, setFocusedTagCode] = useState<string | null>(null);
  const [pendingAdd, setPendingAdd] = useState<Set<string>>(() => new Set());
  const [pendingRemove, setPendingRemove] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failures, setFailures] = useState<QuestionTagMutationSummary['failed']>([]);

  const masterByCode = useMemo(() => {
    const byCode: Record<string, TopikWritingTagMasterRow> = {};
    tagMasterRows.forEach((row) => {
      byCode[row.tagCode] = row;
    });
    return byCode;
  }, [tagMasterRows]);

  const getTagLabel = (tagCode: string): string =>
    masterByCode[tagCode]?.tagNameKo ?? tagCode;

  // 활성 태그 빠른 조회 — 제거 시 tagAssignmentId가 필요하므로 행을 통째로 보관.
  const activeByCode = useMemo(() => {
    const byCode = new Map<string, TopikWritingQuestionTagRow>();
    activeTags.forEach((tag) => {
      if (!byCode.has(tag.tagCode)) {
        byCode.set(tag.tagCode, tag);
      }
    });
    return byCode;
  }, [activeTags]);

  const groups = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    tagMasterRows.forEach((row) => {
      if (!seen.has(row.tagGroup)) {
        seen.add(row.tagGroup);
        order.push(row.tagGroup);
      }
    });
    return order;
  }, [tagMasterRows]);

  const tagsByGroup = useMemo(() => {
    const byGroup = new Map<string, TopikWritingTagMasterRow[]>();
    tagMasterRows.forEach((row) => {
      const list = byGroup.get(row.tagGroup) ?? [];
      list.push(row);
      byGroup.set(row.tagGroup, list);
    });
    return byGroup;
  }, [tagMasterRows]);

  useEffect(() => {
    if (selectedGroup === null && groups.length > 0) {
      setSelectedGroup(groups[0]);
    }
  }, [groups, selectedGroup]);

  const trimmedQuery = query.trim().toLowerCase();

  // 검색어가 있으면 전 그룹 횡단 필터, 없으면 선택 그룹의 태그.
  const visibleTags = useMemo(() => {
    if (trimmedQuery) {
      return tagMasterRows.filter(
        (row) =>
          row.tagNameKo.toLowerCase().includes(trimmedQuery) ||
          row.tagCode.toLowerCase().includes(trimmedQuery)
      );
    }
    return selectedGroup ? tagsByGroup.get(selectedGroup) ?? [] : [];
  }, [selectedGroup, tagMasterRows, tagsByGroup, trimmedQuery]);

  const focusedMaster = focusedTagCode ? masterByCode[focusedTagCode] ?? null : null;

  // 검색을 비웠을 때 다른 그룹의 태그에 포커스가 남아 있으면(중앙 목록엔 안 보임)
  // 상세 패널과 목록의 불일치를 막기 위해 포커스를 해제한다.
  useEffect(() => {
    if (trimmedQuery !== '' || !focusedTagCode || !selectedGroup) {
      return;
    }
    const focused = masterByCode[focusedTagCode];
    if (focused && focused.tagGroup !== selectedGroup) {
      setFocusedTagCode(null);
    }
  }, [trimmedQuery, focusedTagCode, selectedGroup, masterByCode]);

  // POL-018 ③ 가드는 적용 후 예상 상태(활성 - 제거예정 + 추가예정)로 판정한다.
  const projectedRepeatAvoidCount = useMemo(() => {
    let count = 0;
    activeTags.forEach((tag) => {
      if (
        masterByCode[tag.tagCode]?.tagGroup === TAG_GROUP_REPEAT_AVOID &&
        !pendingRemove.has(tag.tagCode)
      ) {
        count += 1;
      }
    });
    pendingAdd.forEach((code) => {
      if (masterByCode[code]?.tagGroup === TAG_GROUP_REPEAT_AVOID) {
        count += 1;
      }
    });
    return count;
  }, [activeTags, masterByCode, pendingAdd, pendingRemove]);

  const addCount = pendingAdd.size;
  const removeCount = pendingRemove.size;
  const hasChanges = addCount > 0 || removeCount > 0;

  const toggleAdd = (code: string): void => {
    setPendingAdd((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleRemove = (code: string): void => {
    setPendingRemove((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleTag = (code: string): void => {
    if (activeByCode.has(code)) {
      toggleRemove(code);
    } else {
      toggleAdd(code);
    }
    setFocusedTagCode(code);
  };

  const handleReset = (): void => {
    setPendingAdd(new Set());
    setPendingRemove(new Set());
    setFailures([]);
    setErrorMessage(null);
  };

  const handleClose = (): void => {
    // destroyOnHidden로 재오픈 시 리셋되지만, 설정 변경에 대비해 명시적으로 정리한다.
    handleReset();
    onClose();
  };

  const handleApply = async (): Promise<void> => {
    setErrorMessage(null);

    const addCodes = [...pendingAdd];
    const removeRows = activeTags.filter((tag) => pendingRemove.has(tag.tagCode));
    if (addCodes.length === 0 && removeRows.length === 0) {
      return;
    }

    setApplying(true);

    const assigned: string[] = [];
    const removed: string[] = [];
    const failed: QuestionTagMutationSummary['failed'] = [];
    const succeededAdd = new Set<string>();
    const succeededRemove = new Set<string>();

    for (const code of addCodes) {
      const label = getTagLabel(code);
      const result = await assignQuestionTagSafe({
        questionId,
        tagCode: code
      });
      if (result.ok) {
        assigned.push(label);
        succeededAdd.add(code);
      } else {
        failed.push({ label, action: 'assign', message: result.error.message });
      }
    }

    for (const row of removeRows) {
      const label = getTagLabel(row.tagCode);
      const result = await removeQuestionTagSafe({
        tagAssignmentId: row.tagAssignmentId
      });
      if (result.ok) {
        removed.push(label);
        succeededRemove.add(row.tagCode);
      } else {
        failed.push({ label, action: 'remove', message: result.error.message });
      }
    }

    setApplying(false);

    // 성공분은 보류 목록에서 비워 재시도가 실패분만 겨냥하게 한다.
    if (succeededAdd.size > 0) {
      setPendingAdd((prev) => {
        const next = new Set(prev);
        succeededAdd.forEach((code) => next.delete(code));
        return next;
      });
    }
    if (succeededRemove.size > 0) {
      setPendingRemove((prev) => {
        const next = new Set(prev);
        succeededRemove.forEach((code) => next.delete(code));
        return next;
      });
    }

    setFailures(failed);

    if (assigned.length > 0 || removed.length > 0) {
      onMutated({ assigned, removed, failed });
    }

    if (failed.length === 0) {
      onClose();
    }
  };

  const applyDisabled = !hasChanges;

  return (
    <Modal
      open={open}
      title="태그 편집"
      footer={null}
      width={788}
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
            placeholder="태그명 또는 코드를 입력하세요."
            aria-label="태그 검색"
            value={query}
            style={{ width: 240 }}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Space>

        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            message="태그 편집에 실패했습니다."
            description={errorMessage}
          />
        ) : null}

        {failures.length > 0 ? (
          <Alert
            type="error"
            showIcon
            message={`${failures.length}건 처리에 실패했습니다.`}
            description={
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                {failures.map((failure) => (
                  <Text key={`${failure.action}-${failure.label}`}>
                    {failure.action === 'assign' ? '부여' : '제거'} · {failure.label}:{' '}
                    {failure.message}
                  </Text>
                ))}
              </Space>
            }
          />
        ) : null}

        {projectedRepeatAvoidCount >= REPEAT_AVOID_EXCESS_THRESHOLD ? (
          <Alert
            type="warning"
            showIcon
            message="반복방지 태그 활성 과다"
            description={`반복방지 태그가 ${projectedRepeatAvoidCount}개 활성(변경 예정 포함)입니다. 반복 노출 회피 대상 과다 문항은 노출 제외(excluded)를 권고합니다(POL-018 ③).`}
          />
        ) : null}

        <div
          style={{
            display: 'flex',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              flex: '0 0 168px',
              borderRight: '1px solid #f0f0f0',
              maxHeight: 300,
              overflowY: 'auto',
              background: '#fafafa'
            }}
          >
            {groups.length === 0 ? (
              <div style={{ padding: 12 }}>
                <Text type="secondary">그룹이 없습니다.</Text>
              </div>
            ) : (
              groups.map((group) => {
                const isSelected = group === selectedGroup && trimmedQuery === '';
                return (
                  <div
                    key={group}
                    role="button"
                    tabIndex={0}
                    aria-current={isSelected ? true : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '9px 12px',
                      cursor: 'pointer',
                      background: isSelected ? '#e6f4ff' : 'transparent',
                      color: isSelected ? '#1677ff' : 'inherit',
                      fontWeight: isSelected ? 600 : 400
                    }}
                    onClick={() => {
                      setSelectedGroup(group);
                      setQuery('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedGroup(group);
                        setQuery('');
                      }
                    }}
                  >
                    <span>{group}</span>
                    {isSelected ? (
                      <RightOutlined style={{ fontSize: 12 }} />
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {tagsByGroup.get(group)?.length ?? 0}
                      </Text>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              flex: '0 0 256px',
              borderRight: '1px solid #f0f0f0',
              maxHeight: 300,
              overflowY: 'auto'
            }}
          >
            {visibleTags.length === 0 ? (
              <div style={{ padding: 12 }}>
                <Text type="secondary">
                  {trimmedQuery ? '검색 결과가 없습니다.' : '태그가 없습니다.'}
                </Text>
              </div>
            ) : (
              visibleTags.map((tag) => {
                const active = activeByCode.has(tag.tagCode);
                const checked = active
                  ? !pendingRemove.has(tag.tagCode)
                  : pendingAdd.has(tag.tagCode);
                const isFocused = tag.tagCode === focusedTagCode;
                return (
                  <div
                    key={tag.tagCode}
                    role="checkbox"
                    tabIndex={0}
                    aria-checked={checked}
                    aria-label={tag.tagNameKo}
                    data-testid={`tag-row-${tag.tagCode}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      cursor: 'pointer',
                      background: isFocused ? '#e6f4ff' : 'transparent'
                    }}
                    onClick={() => toggleTag(tag.tagCode)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleTag(tag.tagCode);
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
                      {tag.tagNameKo}
                    </span>
                    {active ? (
                      <Tag color="green" style={{ marginInlineEnd: 0 }}>
                        활성
                      </Tag>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: 0,
              maxHeight: 300,
              overflowY: 'auto',
              padding: '12px 14px'
            }}
          >
            {focusedMaster ? (
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Text strong>{focusedMaster.tagNameKo}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {focusedMaster.tagCode} · {focusedMaster.tagGroup}
                </Text>
                {focusedMaster.description ? (
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    {focusedMaster.description}
                  </Paragraph>
                ) : null}
                {focusedMaster.usageRule ? (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      운영 가이드
                    </Text>
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      {focusedMaster.usageRule}
                    </Paragraph>
                  </div>
                ) : null}
              </Space>
            ) : (
              <Text type="secondary">
                태그를 선택하면 설명과 운영 가이드가 표시됩니다.
              </Text>
            )}
          </div>
        </div>

        <div>
          <Space
            style={{ width: '100%', justifyContent: 'space-between' }}
            align="center"
          >
            <Text strong>
              변경 예정{' '}
              <Text type="secondary" style={{ fontWeight: 400 }}>
                (추가 {addCount} · 제거 {removeCount})
              </Text>
            </Text>
            <Button
              type="link"
              size="small"
              disabled={!hasChanges}
              onClick={handleReset}
            >
              초기화
            </Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            {activeTags.length === 0 && pendingAdd.size === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="활성 태그가 없습니다."
              />
            ) : (
              <Space size={[6, 6]} wrap>
                {activeTags.map((tag) => {
                  const marked = pendingRemove.has(tag.tagCode);
                  const label = getTagLabel(tag.tagCode);
                  return (
                    <Tag
                      key={`active-${tag.tagAssignmentId}`}
                      color={marked ? 'error' : 'default'}
                      closable
                      style={marked ? { textDecoration: 'line-through' } : undefined}
                      onClose={(event: MouseEvent<HTMLElement>) => {
                        event.preventDefault();
                        toggleRemove(tag.tagCode);
                      }}
                    >
                      {label} · {marked ? '제거 예정' : '활성'}
                    </Tag>
                  );
                })}
                {[...pendingAdd].map((code) => (
                  <Tag
                    key={`add-${code}`}
                    color="success"
                    closable
                    onClose={(event: MouseEvent<HTMLElement>) => {
                      event.preventDefault();
                      toggleAdd(code);
                    }}
                  >
                    {getTagLabel(code)} · 추가 예정
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        </div>

        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={handleClose}>취소</Button>
          <Button
            type="primary"
            loading={applying}
            disabled={applyDisabled}
            onClick={() => void handleApply()}
          >
            확인{hasChanges ? ` — 변경 적용 (${addCount + removeCount}건)` : ''}
          </Button>
        </Space>
      </Space>
    </Modal>
  );
}
