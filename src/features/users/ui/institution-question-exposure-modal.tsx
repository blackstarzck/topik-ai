import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Tag,
  Tree,
  Typography
} from 'antd';
import type { TreeDataNode } from 'antd';
import type { Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addInstitutionQuestionsSafe,
  fetchInstitutionQuestionsSafe,
  removeInstitutionQuestionsSafe
} from '../api/institution-questions-service';
import { fetchInstitutionCodesSafe } from '../api/institution-codes-service';
import type {
  InstitutionExposableQuestion,
  InstitutionQuestionMutationResult
} from '../model/institution-questions-types';
import type { InstitutionCode } from '../model/institution-codes-types';
import type { AsyncState } from '../../../shared/model/async-state';

const { Text } = Typography;

/**
 * 기관 중심 노출 문항 관리 — 좌우 antd Tree(유형>주제>문항) 기반 Transfer형 모달.
 *
 * 좌측 트리에서 유형/주제를 체크하면 하위 문항이 일괄 체크되고(상위 indeterminate),
 * › 로 노출에 추가, 우측 트리에서 유형/주제/문항을 골라 ‹ 로 제거한다. 선택 단일 소스는 노출 문항 id 집합
 * (exposed: Set<questionId>)이며, 적용 시 최초 매핑(initialExposed)과의 차집합으로
 * add/remove RPC를 호출한다(둘 다 institution_code=현재 기관, 다른 기관 매핑 보존).
 *
 * 다른 기관 설정 불러오기: 소스 기관의 노출 문항을 합치기(∪)/덮어쓰기로 현재 선택에
 * 반영한다 — 적용 전까지 저장되지 않는다(같은 list facade 재사용, 신규 RPC 없음).
 */
const ITEM_TYPE_LABEL: Record<number, string> = {
  51: '빈칸 완성',
  52: '연결 표현',
  53: '자료 설명',
  54: '의견 서술'
};
const ITEM_NUMBERS = [51, 52, 53, 54];
const TRANSFER_PANEL_HEIGHT = 'min(52vh, 460px)';
const TRANSFER_TREE_HEIGHT = 440;
const GLOBAL_EXPOSURE_BLOCKED_MESSAGE =
  '전역 노출 상태가 노출 가능이 아니어서 기관 노출에 추가할 수 없습니다.';
const SERVICE_STATUS_LABELS: Record<string, string> = {
  available: '노출 가능',
  excluded: '노출 제외',
  internal_test: '내부 테스트'
};

type ExposureTreeNode = TreeDataNode & {
  searchText?: string;
  children?: ExposureTreeNode[];
};

function shortId(questionId: string): string {
  return questionId.replace('topik-writing-', '');
}

function isQuestionGloballyAvailable(question: InstitutionExposableQuestion): boolean {
  return question.serviceStatus === 'available';
}

function getServiceStatusLabel(status: string): string {
  return SERVICE_STATUS_LABELS[status] ?? status;
}

function renderQuestionTitle(
  question: InstitutionExposableQuestion,
  options: { disabled: boolean; inactive: boolean }
): JSX.Element {
  return (
    <Space size={4} wrap>
      <span>
        {shortId(question.questionId)} · {question.situationSummary || '(요약 없음)'}
      </span>
      {options.inactive ? <Tag color="default">전역 미노출</Tag> : null}
      {options.disabled ? <Tag color="warning">추가 불가</Tag> : null}
      {!isQuestionGloballyAvailable(question) ? (
        <Tag color="red">{getServiceStatusLabel(question.serviceStatus)}</Tag>
      ) : null}
    </Space>
  );
}

function buildExposureTree(
  questions: InstitutionExposableQuestion[],
  options: {
    disabledQuestionIds?: Set<string>;
    inactiveQuestionIds?: Set<string>;
  } = {}
): ExposureTreeNode[] {
  const disabledQuestionIds = options.disabledQuestionIds ?? new Set<string>();
  const inactiveQuestionIds = options.inactiveQuestionIds ?? new Set<string>();
  const byType = new Map<number, Map<string, InstitutionExposableQuestion[]>>();
  questions.forEach((question) => {
    if (!byType.has(question.itemNumber)) {
      byType.set(question.itemNumber, new Map());
    }
    const topics = byType.get(question.itemNumber) as Map<
      string,
      InstitutionExposableQuestion[]
    >;
    const topic = question.topicMain || '(주제 미지정)';
    if (!topics.has(topic)) {
      topics.set(topic, []);
    }
    (topics.get(topic) as InstitutionExposableQuestion[]).push(question);
  });

  const nodes: ExposureTreeNode[] = [];
  ITEM_NUMBERS.forEach((itemNumber) => {
    const topics = byType.get(itemNumber);
    if (!topics) {
      return;
    }
    const topicNodes: ExposureTreeNode[] = [];
    [...topics.keys()]
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .forEach((topic) => {
        const list = (topics.get(topic) as InstitutionExposableQuestion[])
          .slice()
          .sort((a, b) => a.questionId.localeCompare(b.questionId));
        const leaves: ExposureTreeNode[] = list.map((question) => {
          const disabled = disabledQuestionIds.has(question.questionId);
          const inactive = inactiveQuestionIds.has(question.questionId);
          const statusLabel = getServiceStatusLabel(question.serviceStatus);
          return {
            key: question.questionId,
            title: renderQuestionTitle(question, { disabled, inactive }),
            searchText: [
              shortId(question.questionId),
              question.questionId,
              question.situationSummary,
              question.topicMain,
              question.questionTypeName,
              statusLabel,
              inactive ? '전역 미노출' : '',
              disabled ? '추가 불가' : ''
            ]
              .filter(Boolean)
              .join(' '),
            isLeaf: true,
            disabled
          };
        });
        topicNodes.push({
          key: `type:${itemNumber}/topic:${topic}`,
          title: `${topic} (${list.length})`,
          selectable: false,
          children: leaves
        });
      });
    nodes.push({
      key: `type:${itemNumber}`,
      title: `${itemNumber}번 · ${ITEM_TYPE_LABEL[itemNumber] ?? ''}`,
      selectable: false,
      children: topicNodes
    });
  });
  return nodes;
}

function filterTree(nodes: ExposureTreeNode[], term: string): ExposureTreeNode[] {
  const lower = term.toLowerCase();
  const result: ExposureTreeNode[] = [];
  nodes.forEach((typeNode) => {
    const topicNodes: ExposureTreeNode[] = [];
    (typeNode.children ?? []).forEach((topicNode) => {
      const leaves = (topicNode.children ?? []).filter(
        (leaf) => {
          const searchText = leaf.searchText ?? String(leaf.title);
          return (
            searchText.toLowerCase().includes(lower) ||
            String(leaf.key).toLowerCase().includes(lower)
          );
        }
      );
      if (leaves.length) {
        topicNodes.push({ ...topicNode, children: leaves });
      }
    });
    if (topicNodes.length) {
      result.push({ ...typeNode, children: topicNodes });
    }
  });
  return result;
}

function collectGroupKeys(nodes: TreeDataNode[]): Key[] {
  const keys: Key[] = [];
  nodes.forEach((typeNode) => {
    keys.push(typeNode.key);
    (typeNode.children ?? []).forEach((topicNode) => keys.push(topicNode.key));
  });
  return keys;
}

function pickQuestionKeys(keys: Key[]): string[] {
  return keys
    .filter((key) => typeof key === 'string' && !key.startsWith('type:'))
    .map(String);
}

export type InstitutionQuestionMutationSummary = {
  mode: 'add' | 'remove';
  result: InstitutionQuestionMutationResult;
};

type InstitutionQuestionExposureModalProps = {
  open: boolean;
  institution: InstitutionCode;
  canManage: boolean;
  isSupabase: boolean;
  onClose: () => void;
  onMutated: (summary: InstitutionQuestionMutationSummary) => void;
};

export function InstitutionQuestionExposureModal({
  open,
  institution,
  canManage,
  isSupabase,
  onClose,
  onMutated
}: InstitutionQuestionExposureModalProps): JSX.Element {
  const code = institution.code;

  const [state, setState] = useState<AsyncState<InstitutionExposableQuestion[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [initialExposed, setInitialExposed] = useState<Set<string>>(new Set());
  const [exposed, setExposed] = useState<Set<string>>(new Set());
  const [leftChecked, setLeftChecked] = useState<string[]>([]);
  const [rightChecked, setRightChecked] = useState<string[]>([]);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [leftExpandedKeys, setLeftExpandedKeys] = useState<Key[]>([]);
  const [rightExpandedKeys, setRightExpandedKeys] = useState<Key[]>([]);
  const [leftAutoExpandParent, setLeftAutoExpandParent] = useState(false);
  const [rightAutoExpandParent, setRightAutoExpandParent] = useState(false);
  const [codeOptions, setCodeOptions] = useState<InstitutionCode[]>([]);
  const [sourceCode, setSourceCode] = useState<string | undefined>(undefined);
  const [loadMode, setLoadMode] = useState<'merge' | 'overwrite'>('merge');
  const [loadingSource, setLoadingSource] = useState(false);
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'pending', errorMessage: null }));

    void fetchInstitutionQuestionsSafe(code, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        const exposedIds = result.data
          .filter((question) => question.isExposed)
          .map((question) => question.questionId);
        setState({ status: 'success', data: result.data, errorMessage: null, errorCode: null });
        setInitialExposed(new Set(exposedIds));
        setExposed(new Set(exposedIds));
        setLeftChecked([]);
        setRightChecked([]);
        setWarningMessage(null);
        return;
      }
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [code, reloadKey]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setCodeOptions(result.data);
    });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (open) {
      setReason('');
      setLeftSearch('');
      setRightSearch('');
      setSourceCode(undefined);
      setLoadMode('merge');
      setErrorMessage(null);
      setWarningMessage(null);
    }
  }, [open, code]);

  const questionById = useMemo(
    () => new Map(state.data.map((question) => [question.questionId, question])),
    [state.data]
  );
  const inactiveQuestionIds = useMemo(
    () =>
      new Set(
        state.data
          .filter((question) => !isQuestionGloballyAvailable(question))
          .map((question) => question.questionId)
      ),
    [state.data]
  );
  const isQuestionAddable = useCallback(
    (questionId: string) => {
      const question = questionById.get(questionId);
      return question ? isQuestionGloballyAvailable(question) : false;
    },
    [questionById]
  );
  const availableQuestions = useMemo(
    () => state.data.filter((question) => !exposed.has(question.questionId)),
    [state.data, exposed]
  );
  const fullTree = useMemo(
    () =>
      buildExposureTree(availableQuestions, {
        disabledQuestionIds: inactiveQuestionIds,
        inactiveQuestionIds
      }),
    [availableQuestions, inactiveQuestionIds]
  );
  const leftTreeData = useMemo(
    () => (leftSearch.trim() ? filterTree(fullTree, leftSearch.trim()) : fullTree),
    [fullTree, leftSearch]
  );
  const exposedQuestions = useMemo(
    () => state.data.filter((question) => exposed.has(question.questionId)),
    [state.data, exposed]
  );
  const rightFullTree = useMemo(
    () => buildExposureTree(exposedQuestions, { inactiveQuestionIds }),
    [exposedQuestions, inactiveQuestionIds]
  );
  const rightTreeData = useMemo(
    () =>
      rightSearch.trim()
        ? filterTree(rightFullTree, rightSearch.trim())
        : rightFullTree,
    [rightFullTree, rightSearch]
  );

  useEffect(() => {
    if (leftSearch.trim()) {
      setLeftExpandedKeys(collectGroupKeys(leftTreeData));
      setLeftAutoExpandParent(true);
    }
  }, [leftSearch, leftTreeData]);

  useEffect(() => {
    if (rightSearch.trim()) {
      setRightExpandedKeys(collectGroupKeys(rightTreeData));
      setRightAutoExpandParent(true);
    }
  }, [rightSearch, rightTreeData]);

  const onLeftCheck = useCallback(
    (checked: Key[] | { checked: Key[]; halfChecked: Key[] }) => {
      const keys = Array.isArray(checked) ? checked : checked.checked;
      setLeftChecked(pickQuestionKeys(keys).filter(isQuestionAddable));
    },
    [isQuestionAddable]
  );

  const onRightCheck = useCallback(
    (checked: Key[] | { checked: Key[]; halfChecked: Key[] }) => {
      const keys = Array.isArray(checked) ? checked : checked.checked;
      setRightChecked(pickQuestionKeys(keys));
    },
    []
  );

  const moveRight = useCallback(() => {
    if (leftChecked.length === 0) {
      return;
    }
    setExposed((prev) => {
      const next = new Set(prev);
      leftChecked.filter(isQuestionAddable).forEach((id) => next.add(id));
      return next;
    });
    setLeftChecked([]);
  }, [isQuestionAddable, leftChecked]);

  const moveLeft = useCallback(() => {
    if (rightChecked.length === 0) {
      return;
    }
    setExposed((prev) => {
      const next = new Set(prev);
      rightChecked.forEach((id) => next.delete(id));
      return next;
    });
    setRightChecked([]);
  }, [rightChecked]);

  const handleLoadSource = useCallback(async () => {
    if (!sourceCode) {
      return;
    }
    setErrorMessage(null);
    setWarningMessage(null);
    setLoadingSource(true);
    const result = await fetchInstitutionQuestionsSafe(sourceCode);
    setLoadingSource(false);
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    const pool = new Set(state.data.map((question) => question.questionId));
    const sourceExposedIds = result.data
      .filter((question) => question.isExposed)
      .map((question) => question.questionId)
      .filter((id) => pool.has(id));
    const sourceIds = sourceExposedIds.filter(isQuestionAddable);
    const skipped = sourceExposedIds.length - sourceIds.length;
    setExposed((prev) =>
      loadMode === 'merge' ? new Set([...prev, ...sourceIds]) : new Set(sourceIds)
    );
    setLeftChecked([]);
    setRightChecked([]);
    if (skipped > 0) {
      setWarningMessage(
        `전역 노출 상태가 노출 가능이 아닌 문항 ${skipped.toLocaleString()}건은 불러오지 않았습니다.`
      );
    }
  }, [isQuestionAddable, sourceCode, loadMode, state.data]);

  const added = useMemo(
    () => [...exposed].filter((id) => !initialExposed.has(id)),
    [exposed, initialExposed]
  );
  const removed = useMemo(
    () => [...initialExposed].filter((id) => !exposed.has(id)),
    [exposed, initialExposed]
  );
  const hasChanges = added.length > 0 || removed.length > 0;
  const addableCandidateCount = availableQuestions.filter(isQuestionGloballyAvailable).length;
  const inactiveCandidateCount = availableQuestions.length - addableCandidateCount;
  const effectiveExposedCount = exposedQuestions.filter(isQuestionGloballyAvailable).length;
  const inactiveExposedCount = exposedQuestions.length - effectiveExposedCount;

  const handleApply = useCallback(async () => {
    setErrorMessage(null);
    setWarningMessage(null);
    if (!hasChanges) {
      return;
    }
    if (!reason.trim()) {
      setErrorMessage('변경 사유를 입력해 주세요.');
      return;
    }
    setApplying(true);
    let ok = true;
    if (added.length > 0) {
      const result = await addInstitutionQuestionsSafe({
        institutionCode: code,
        questionIds: added,
        reason: reason.trim()
      });
      if (result.ok) {
        onMutated({ mode: 'add', result: result.data });
        if (result.data.blocked > 0) {
          setWarningMessage(
            `${GLOBAL_EXPOSURE_BLOCKED_MESSAGE} 차단 ${result.data.blocked.toLocaleString()}건`
          );
        }
      } else {
        ok = false;
        setErrorMessage(result.error.message);
      }
    }
    if (ok && removed.length > 0) {
      const result = await removeInstitutionQuestionsSafe({
        institutionCode: code,
        questionIds: removed,
        reason: reason.trim()
      });
      if (result.ok) {
        onMutated({ mode: 'remove', result: result.data });
      } else {
        ok = false;
        setErrorMessage(result.error.message);
      }
    }
    setApplying(false);
    if (ok) {
      setReason('');
      setReloadKey((prev) => prev + 1);
    }
  }, [added, removed, hasChanges, reason, code, onMutated]);

  const sourceOptions = useMemo(
    () =>
      codeOptions
        .filter((option) => option.code !== code)
        .map((option) => ({ value: option.code, label: `${option.label} (${option.code})` })),
    [codeOptions, code]
  );

  return (
    <Modal
      open={open}
      width={920}
      title={`노출 문항 · ${code}`}
      onCancel={onClose}
      destroyOnHidden
      styles={{ body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' } }}
      footer={
        <Space>
          <Button onClick={onClose}>닫기</Button>
          {canManage ? (
            <Button
              type="primary"
              loading={applying}
              disabled={!hasChanges || !reason.trim()}
              onClick={() => void handleApply()}
            >
              적용{hasChanges ? ` — 노출 ${exposed.size.toLocaleString()}건` : ''}
            </Button>
          ) : null}
        </Space>
      }
    >
      <Space direction="vertical" size={14} style={{ width: '100%' }}>
        <Text type="secondary">{institution.label}</Text>

        {/* 기관 할당제 규칙을 화면에 명시한다. 배정은 이 기관 학습자에게 문항을 허용하는
            목록이며 다른 학습자에게 잠그는 장치가 아니다(계약 SoT: 마이그
            20260730120000). 이 안내가 없으면 배정 0건을 "제약 없음"으로 오해한다. */}
        <Alert
          type="info"
          showIcon
          message="소속 없는 학습자는 노출 허용한 문항을 모두 봅니다. 이 기관 소속 학습자는 여기서 배정한 문항만 봅니다."
        />

        {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
        {warningMessage ? <Alert type="warning" showIcon message={warningMessage} /> : null}

        {canManage ? (
          <div
            style={{
              border: '0.5px solid #d9d9d9',
              borderRadius: 8,
              padding: '12px 14px'
            }}
          >
            <Space wrap size={12} style={{ width: '100%' }}>
              <Text strong>다른 기관 설정 불러오기</Text>
              <Select
                placeholder="소스 기관 선택"
                style={{ minWidth: 260 }}
                options={sourceOptions}
                value={sourceCode}
                onChange={(value) => setSourceCode(value)}
                showSearch
                optionFilterProp="label"
              />
              <Radio.Group value={loadMode} onChange={(event) => setLoadMode(event.target.value)}>
                <Radio value="merge">합치기</Radio>
                <Radio value="overwrite">덮어쓰기</Radio>
              </Radio.Group>
              <Button
                loading={loadingSource}
                disabled={!sourceCode}
                onClick={() => void handleLoadSource()}
              >
                불러오기
              </Button>
            </Space>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 14 }}>
                불러온 항목은 아래 목록에 채워지며, 적용을 눌러야 저장됩니다.
              </Text>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
          <div
            data-testid="institution-question-left-panel"
            style={{
              flex: 1,
              minWidth: 0,
              border: '0.5px solid #d9d9d9',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              height: TRANSFER_PANEL_HEIGHT
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                추가 후보 · {availableQuestions.length.toLocaleString()}건
                {inactiveCandidateCount > 0
                  ? ` (추가 가능 ${addableCandidateCount.toLocaleString()}건 · 비활성 ${inactiveCandidateCount.toLocaleString()}건)`
                  : ''}
              </Text>
              <Input
                size="small"
                allowClear
                placeholder="유형·주제·문항 검색"
                value={leftSearch}
                style={{ marginTop: 6 }}
                onChange={(event) => setLeftSearch(event.target.value)}
              />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '6px 4px' }}>
              {leftTreeData.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={state.status === 'pending' ? '불러오는 중…' : '문항이 없습니다.'}
                />
              ) : (
                <Tree
                  checkable={canManage}
                  selectable={false}
                  blockNode
                  height={TRANSFER_TREE_HEIGHT}
                  treeData={leftTreeData}
                  checkedKeys={leftChecked}
                  onCheck={onLeftCheck}
                  expandedKeys={leftExpandedKeys}
                  autoExpandParent={leftAutoExpandParent}
                  onExpand={(keys) => {
                    setLeftExpandedKeys(keys);
                    setLeftAutoExpandParent(false);
                  }}
                />
              )}
            </div>
          </div>

          {canManage ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 8,
                flexShrink: 0
              }}
            >
              <Button
                aria-label="노출에 추가"
                type="primary"
                disabled={leftChecked.length === 0}
                onClick={moveRight}
              >
                ›
              </Button>
              <Button
                aria-label="노출에서 제거"
                disabled={rightChecked.length === 0}
                onClick={moveLeft}
              >
                ‹
              </Button>
            </div>
          ) : null}

          <div
            data-testid="institution-question-right-panel"
            style={{
              flex: 1,
              minWidth: 0,
              border: '0.5px solid #d9d9d9',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              height: TRANSFER_PANEL_HEIGHT
            }}
          >
            <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: 13 }}>
                노출 선택 · 배정 {effectiveExposedCount.toLocaleString()}건
                {inactiveExposedCount > 0
                  ? ` / 전역 미노출 ${inactiveExposedCount.toLocaleString()}건`
                  : ''}
              </Text>
              <Input
                size="small"
                allowClear
                placeholder="노출 문항 검색"
                value={rightSearch}
                style={{ marginTop: 6 }}
                onChange={(event) => setRightSearch(event.target.value)}
              />
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                padding: '6px 4px',
                ...(rightTreeData.length === 0
                  ? { display: 'flex', alignItems: 'center', justifyContent: 'center' }
                  : {})
              }}
            >
              {rightTreeData.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    exposedQuestions.length === 0
                      ? // 할당제에서 배정 0건은 "제약 없음"이 아니라 "이 기관 학습자에게
                        // 쓰기 문항이 하나도 안 보임"이다. 결과를 명시하지 않으면 관리자가
                        // 정반대로 읽는다.
                        '배정된 문항이 없습니다. 이 기관 소속 학습자에게는 쓰기 문항이 표시되지 않습니다.'
                      : '검색 결과가 없습니다.'
                  }
                />
              ) : (
                <Tree
                  checkable={canManage}
                  selectable={false}
                  blockNode
                  height={TRANSFER_TREE_HEIGHT}
                  treeData={rightTreeData}
                  checkedKeys={rightChecked}
                  onCheck={onRightCheck}
                  expandedKeys={rightExpandedKeys}
                  autoExpandParent={rightAutoExpandParent}
                  onExpand={(keys) => {
                    setRightExpandedKeys(keys);
                    setRightAutoExpandParent(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {canManage ? (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              사유 / 근거 <Text type="danger">*</Text>{' '}
              {hasChanges ? (
                <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                  (추가 {added.length} · 제거 {removed.length})
                </Text>
              ) : null}
            </Text>
            <Input.TextArea
              rows={2}
              value={reason}
              placeholder="감사 로그에 기록됩니다."
              style={{ marginTop: 6 }}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        ) : null}

        {!isSupabase ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            현재 mock 데이터 — 추가/제거는 화면에만 반영됩니다.
          </Text>
        ) : null}
      </Space>
    </Modal>
  );
}
