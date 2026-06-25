import {
  Alert,
  Button,
  Empty,
  Input,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  clearWritingQuestionInstitutionsSafe,
  setWritingQuestionInstitutionsSafe,
  updateAssessmentQuestionServiceStatusBulkSafe,
  updateAssessmentQuestionServiceStatusSafe
} from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import { useAssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import { useAssessmentQuestionList } from '../model/use-assessment-question-list';
import {
  useQuestionBankTagMaster,
  useQuestionBankTags,
  useQuestionInstitutions
} from '../model/use-question-bank-masters';
import {
  QuestionTagEditModal,
  type QuestionTagMutationSummary
} from '../ui/question-tag-edit-modal';
import { AssessmentBankTabs } from '../ui/assessment-bank-tabs';
import { BulkServiceStatusModal } from '../ui/bulk-service-status-modal';
import {
  BulkInstitutionExposureModal,
  type BulkInstitutionExposureMode
} from '../ui/bulk-institution-exposure-modal';
import {
  QuestionInstitutionEditModal,
  type QuestionInstitutionMutationSummary
} from '../ui/question-institution-edit-modal';
import { fetchInstitutionCodesSafe } from '../../users/api/institution-codes-service';
import type { InstitutionCode } from '../../users/model/institution-codes-types';
import {
  REPEAT_AVOID_EXCESS_THRESHOLD,
  SERVICE_STATUS_LABELS,
  TAG_GROUP_OPERATION_CAUTION,
  TAG_GROUP_REPEAT_AVOID,
  assessmentDifficultyLevels,
  assessmentQuestionNumbers,
  assessmentServiceStatuses,
  getServiceStatusColor,
  getServiceStatusLabel,
  parseAssessmentServiceStatus
} from '../model/assessment-question-bank-schema';
import {
  applyCommonQuestionFilters,
  filterQuestionsByNumbers
} from '../model/assessment-question-bank-presenter';
import {
  TableActionMenu,
  type TableActionMenuItem
} from '../../../shared/ui/table/table-action-menu';
import type {
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentServiceStatus,
  WritingQuestionInstitutionRow
} from '../model/assessment-question-bank-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

const { Text } = Typography;

/**
 * P4 관리 포인트 개방 (실행계획안 §8, 2026-06-11): 노출 통제(service_status)와
 * 태그 부여/제거가 admin의 유일한 문항 write 표면이다. 모든 write는 RPC 경유
 * (admin_update_topik_question / admin_assign·remove_question_tag)로 감사 로그에
 * 남고, 사유 입력이 필수다. POL-018 화면 가드: ② 운영주의 태그 활성 문항의
 * available 전환 경고(+사유 필수) ③ 반복방지 태그 활성 과다 시 excluded 권고.
 */

const serviceStatusLabels = assessmentServiceStatuses.map(
  (status) => SERVICE_STATUS_LABELS[status]
);

// 미매핑(전체 공개) 문항의 안정적 빈 배열 — 단건 모달이 부모 재렌더마다 새 [] 리터럴로
// 현재 매핑 참조를 갈아치워 미저장 선택을 초기화하지 않도록 모듈 상수로 고정한다.
const EMPTY_INSTITUTION_ROWS: WritingQuestionInstitutionRow[] = [];

type OperationActionState = {
  questionId: string;
  nextStatus: AssessmentServiceStatus;
} | null;

type OperationActionCopy = {
  label: string;
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

// D-6: 노출 가능(available) / 노출 제외(excluded). '운영 제외'는 excluded +
// 운영주의 태그 '운영 제외' 부여로 구분한다(태그 편집은 P4 — 버튼만 자리 확보).
const OPERATION_ACTIONS: { nextStatus: AssessmentServiceStatus; copy: OperationActionCopy }[] = [
  {
    nextStatus: 'available',
    copy: {
      label: '노출 가능',
      title: '노출 가능 전환',
      description:
        '이 문항을 노출 가능(available)으로 전환합니다. 운영주의 태그 활성 문항은 전환 사유가 필수이며(POL-018), 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 가능',
      successMessage: '노출 가능으로 변경했습니다.',
      reasonPlaceholder: '노출 가능 전환 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'excluded',
    copy: {
      label: '노출 제외',
      title: '노출 제외 전환',
      description:
        '이 문항을 노출 제외(excluded)로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 제외',
      successMessage: '노출 제외로 변경했습니다.',
      reasonPlaceholder: '노출 제외 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'internal_test',
    copy: {
      label: '내부 테스트',
      title: '내부 테스트 전환',
      description:
        '이 문항을 내부 테스트(internal_test)로 되돌립니다. 사용자 노출이 차단되며, 변경 사유는 감사 로그로 남습니다.',
      confirmText: '내부 테스트',
      successMessage: '내부 테스트로 변경했습니다.',
      reasonPlaceholder: '내부 테스트 전환 사유를 입력해 주세요.'
    }
  }
];

export default function AssessmentQuestionManagePage(): JSX.Element {
  const navigate = useNavigate();
  const filters = useAssessmentQuestionFilters();
  const { state, reload } = useAssessmentQuestionList();
  const { tagsByQuestionId, tagCountByQuestionId, reload: reloadTags } =
    useQuestionBankTags();
  const { tagMasterRows } = useQuestionBankTagMaster();
  const { institutionsByQuestionId, reload: reloadInstitutions } =
    useQuestionInstitutions();
  const [actionState, setActionState] = useState<OperationActionState>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AssessmentServiceStatus | null>(
    null
  );
  const [tagEditQuestionId, setTagEditQuestionId] = useState<string | null>(null);
  const [institutionEditQuestionId, setInstitutionEditQuestionId] = useState<
    string | null
  >(null);
  const [bulkInstitutionMode, setBulkInstitutionMode] =
    useState<BulkInstitutionExposureMode | null>(null);
  const [codeOptions, setCodeOptions] = useState<InstitutionCode[]>([]);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  const {
    searchParams,
    activeQuestionNumbers,
    topicMainFilter,
    topicDetailFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    commitParams
  } = filters;

  const serviceStatusFilter = parseAssessmentServiceStatus(
    searchParams.get('serviceStatus')
  );

  const hasCachedQuestions = state.data.length > 0;

  const currentNumberQuestions = useMemo(
    () => filterQuestionsByNumbers(state.data, activeQuestionNumbers),
    [activeQuestionNumbers, state.data]
  );

  const filteredQuestions = useMemo(() => {
    const common = applyCommonQuestionFilters(currentNumberQuestions, {
      topicMain: topicMainFilter,
      topicDetail: topicDetailFilter,
      questionType: questionTypeFilter,
      difficulty: difficultyFilter,
      keyword
    });

    return serviceStatusFilter
      ? common.filter(
          (question) => question.serviceStatus === serviceStatusFilter
        )
      : common;
  }, [
    currentNumberQuestions,
    difficultyFilter,
    keyword,
    questionTypeFilter,
    serviceStatusFilter,
    topicDetailFilter,
    topicMainFilter
  ]);

  // 선택된 문항 — 필터된 목록과 교차(stale 키 방어). 일괄 조치는 이 집합에만 적용.
  const selectedQuestions = useMemo(
    () =>
      filteredQuestions.filter((question) =>
        selectedRowKeys.includes(question.questionId)
      ),
    [filteredQuestions, selectedRowKeys]
  );

  // 필터(=URL 파라미터)가 바뀌면 선택을 초기화한다. 페이지네이션은 URL을 바꾸지
  // 않으므로 페이지 이동 중에는 선택이 유지된다(preserveSelectedRowKeys=false).
  const filterSignature = searchParams.toString();
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [filterSignature]);

  // 기관 노출 설정/일괄 모달의 코드 옵션 — 활성 기관 코드만 로드한다.
  useEffect(() => {
    const controller = new AbortController();
    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setCodeOptions(result.data.filter((code) => code.status === '활성'));
    });
    return () => controller.abort();
  }, []);

  const summaryItems = useMemo(() => {
    const countOf = (status: AssessmentServiceStatus) =>
      currentNumberQuestions.filter(
        (question) => question.serviceStatus === status
      ).length;

    return [
      {
        key: 'manage-total',
        label: '전체 문항',
        value: `${currentNumberQuestions.length.toLocaleString()}문항`,
        active: serviceStatusFilter === null,
        onClick: () => commitParams({ serviceStatus: null })
      },
      ...assessmentServiceStatuses.map((status) => ({
        key: `manage-${status}`,
        label: SERVICE_STATUS_LABELS[status],
        value: `${countOf(status).toLocaleString()}문항`,
        active: serviceStatusFilter === status,
        onClick: () => commitParams({ serviceStatus: status })
      }))
    ];
  }, [commitParams, currentNumberQuestions, serviceStatusFilter]);

  const tagGroupByCode = useMemo(() => {
    const byCode: Record<string, string> = {};
    tagMasterRows.forEach((row) => {
      byCode[row.tagCode] = row.tagGroup;
    });
    return byCode;
  }, [tagMasterRows]);

  const tagNameByCode = useMemo(() => {
    const byCode: Record<string, string> = {};
    tagMasterRows.forEach((row) => {
      byCode[row.tagCode] = row.tagNameKo;
    });
    return byCode;
  }, [tagMasterRows]);

  const institutionLabelByCode = useMemo(() => {
    const byCode: Record<string, string> = {};
    codeOptions.forEach((option) => {
      byCode[option.code] = option.label;
    });
    return byCode;
  }, [codeOptions]);

  // 노출(available) 일괄 전환 시 서버가 차단할 운영주의 태그 활성 건수 — 모달에서
  // "N건 자동 제외" 안내로 기대치를 맞춘다(실제 차단은 RPC가 강제).
  const bulkCautionCount = useMemo(
    () =>
      selectedQuestions.filter((question) =>
        (tagsByQuestionId[question.questionId] ?? []).some(
          (tag) => tagGroupByCode[tag.tagCode] === TAG_GROUP_OPERATION_CAUTION
        )
      ).length,
    [selectedQuestions, tagGroupByCode, tagsByQuestionId]
  );

  const handleTagMutated = useCallback(
    (summary: QuestionTagMutationSummary) => {
      if (!tagEditQuestionId) {
        return;
      }

      reloadTags();

      const parts: string[] = [];
      if (summary.assigned.length > 0) {
        parts.push(`부여 ${summary.assigned.length}건`);
      }
      if (summary.removed.length > 0) {
        parts.push(`제거 ${summary.removed.length}건`);
      }
      const changeSummary = parts.length > 0 ? parts.join(' · ') : '변경 없음';

      const description = (
        <Space direction="vertical" size={4}>
          <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
          <Text>대상 ID: {tagEditQuestionId}</Text>
          <AuditLogLink targetType="AssessmentQuestion" targetId={tagEditQuestionId} />
        </Space>
      );

      if (summary.failed.length > 0) {
        notificationApi.warning({
          message: `태그 변경 일부 처리 (${changeSummary}, 실패 ${summary.failed.length}건)`,
          description
        });
        return;
      }

      notificationApi.success({
        message: `태그를 변경했습니다 (${changeSummary}).`,
        description
      });
    },
    [notificationApi, reloadTags, tagEditQuestionId]
  );

  const handleConfirmOperationAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await updateAssessmentQuestionServiceStatusSafe({
        questionId: actionState.questionId,
        nextStatus: actionState.nextStatus,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '운영 상태를 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      const action = OPERATION_ACTIONS.find(
        (candidate) => candidate.nextStatus === actionState.nextStatus
      );
      const targetId = actionState.questionId;
      setActionState(null);
      reload();
      notificationApi.success({
        message: action?.copy.successMessage ?? '운영 상태를 변경했습니다.',
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {targetId}</Text>
            <AuditLogLink targetType="AssessmentQuestion" targetId={targetId} />
          </Space>
        )
      });
    },
    [actionState, notificationApi, reload]
  );

  const handleBulkConfirm = useCallback(
    async (reason: string) => {
      if (!bulkStatus) {
        return;
      }
      const targetIds = selectedQuestions.map((question) => question.questionId);
      // 노출 가능은 사유 입력 대신 개수 확인 팝업이라 사유가 비어 온다 → 감사용
      // 사유를 자동 생성한다(숨김 방향은 모달에서 사유 필수).
      const reasonForRpc =
        bulkStatus === 'available' && !reason.trim()
          ? `노출 가능 일괄 전환(개수 확인) — 총 ${targetIds.length}건`
          : reason;
      const result = await updateAssessmentQuestionServiceStatusBulkSafe({
        questionIds: targetIds,
        nextStatus: bulkStatus,
        reason: reasonForRpc
      });

      if (!result.ok) {
        notificationApi.error({
          message: '노출 상태를 일괄 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      const summary = result.data;
      const statusLabel = SERVICE_STATUS_LABELS[bulkStatus];
      setBulkStatus(null);
      setSelectedRowKeys([]);
      reload();

      const hasIssue = summary.blocked > 0 || summary.failed > 0;
      const description = (
        <Space direction="vertical" size={4}>
          <Text>
            변경 {summary.changed.toLocaleString()}건 · 변경없음{' '}
            {summary.unchanged.toLocaleString()}건
            {summary.blocked > 0
              ? ` · 차단 ${summary.blocked.toLocaleString()}건`
              : ''}
            {summary.failed > 0
              ? ` · 실패 ${summary.failed.toLocaleString()}건`
              : ''}
          </Text>
          {summary.details.slice(0, 5).map((detail) => (
            <Text key={`${detail.kind}-${detail.questionId}`} type="secondary">
              [{detail.kind === 'blocked' ? '차단' : '실패'}] {detail.questionId}:{' '}
              {detail.message}
            </Text>
          ))}
          {summary.batchId && summary.batchId !== 'mock-batch' ? (
            <Text type="secondary">batch: {summary.batchId}</Text>
          ) : null}
        </Space>
      );

      if (hasIssue) {
        notificationApi.warning({
          message: '노출 상태를 일괄 변경했습니다(일부 제외).',
          description
        });
      } else {
        notificationApi.success({
          message: `${statusLabel}로 ${summary.changed.toLocaleString()}건을 변경했습니다.`,
          description
        });
      }
    },
    [bulkStatus, notificationApi, reload, selectedQuestions]
  );

  const handleInstitutionMutated = useCallback(
    (summary: QuestionInstitutionMutationSummary) => {
      if (!institutionEditQuestionId) {
        return;
      }
      reloadInstitutions();

      const targetId = institutionEditQuestionId;
      const parts: string[] = [];
      if (summary.added.length > 0) {
        parts.push(`추가 ${summary.added.length}곳`);
      }
      if (summary.removed.length > 0) {
        parts.push(`제거 ${summary.removed.length}곳`);
      }
      const changeSummary = summary.clearedToPublic
        ? '전체 공개로 변경'
        : parts.length > 0
          ? parts.join(' · ')
          : '변경 없음';

      notificationApi.success({
        message: `기관 노출을 변경했습니다 (${changeSummary}).`,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {targetId}</Text>
            <AuditLogLink targetType="AssessmentQuestion" targetId={targetId} />
          </Space>
        )
      });
    },
    [institutionEditQuestionId, notificationApi, reloadInstitutions]
  );

  const handleBulkInstitutionConfirm = useCallback(
    async ({
      institutionCodes,
      reason
    }: {
      institutionCodes: string[];
      reason: string;
    }) => {
      if (!bulkInstitutionMode) {
        return;
      }
      const targetIds = selectedQuestions.map((question) => question.questionId);
      const result =
        bulkInstitutionMode === 'set'
          ? await setWritingQuestionInstitutionsSafe({
              questionIds: targetIds,
              institutionCodes,
              reason
            })
          : await clearWritingQuestionInstitutionsSafe({
              questionIds: targetIds,
              reason
            });

      if (!result.ok) {
        notificationApi.error({
          message: '기관 노출을 일괄 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      const summary = result.data;
      const modeLabel =
        bulkInstitutionMode === 'set' ? '기관 한정 지정' : '전체 공개 전환';
      setBulkInstitutionMode(null);
      setSelectedRowKeys([]);
      reloadInstitutions();

      const description = (
        <Space direction="vertical" size={4}>
          <Text>
            변경 {summary.changed.toLocaleString()}건 · 변경없음{' '}
            {summary.unchanged.toLocaleString()}건
            {summary.failed > 0
              ? ` · 실패 ${summary.failed.toLocaleString()}건`
              : ''}
          </Text>
          {summary.details.slice(0, 5).map((detail) => (
            <Text key={`${detail.kind}-${detail.questionId}`} type="secondary">
              [{detail.kind === 'blocked' ? '차단' : '실패'}] {detail.questionId}:{' '}
              {detail.message}
            </Text>
          ))}
          {summary.batchId && summary.batchId !== 'mock-batch' ? (
            <Text type="secondary">batch: {summary.batchId}</Text>
          ) : null}
        </Space>
      );

      if (summary.failed > 0) {
        notificationApi.warning({
          message: '기관 노출을 일괄 변경했습니다(일부 실패).',
          description
        });
      } else {
        notificationApi.success({
          message: `${modeLabel} — ${summary.changed.toLocaleString()}건을 변경했습니다.`,
          description
        });
      }
    },
    [bulkInstitutionMode, notificationApi, reloadInstitutions, selectedQuestions]
  );

  // 문항 상세 보기 진입 — 현재 검색/필터(searchParams)를 쿼리로 보존해 상세에서
  // 뒤로 돌아올 때 목록 상태가 복원되게 한다(구 목록 페이지 계약 계승).
  const openDetail = useCallback(
    (questionId: string) => {
      const qs = searchParams.toString();
      navigate(
        qs
          ? `/assessment/question-bank/${questionId}?${qs}`
          : `/assessment/question-bank/${questionId}`
      );
    },
    [navigate, searchParams]
  );

  // 컬럼 헤더 필터 옵션 — 주제·TOPIK 급수는 데이터에서 distinct 추출.
  const topicMainFilterOptions = useMemo(
    () =>
      Array.from(new Set(state.data.map((q) => q.topicMain).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .map((value) => ({ text: value, value })),
    [state.data]
  );

  const targetLevelFilterOptions = useMemo(
    () =>
      Array.from(new Set(state.data.map((q) => q.targetLevel).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .map((value) => ({ text: value, value })),
    [state.data]
  );

  // 더보기 메뉴 — 상세 보기 + 운영 조치(노출 상태 전환). 현재 상태 조치는 비활성.
  const createRowActionItems = useCallback(
    (record: AssessmentQuestionSummary): TableActionMenuItem[] => [
      {
        key: 'detail',
        label: '상세 보기',
        onClick: () => openDetail(record.questionId)
      },
      {
        key: 'institution-exposure',
        label: '기관 노출 설정',
        onClick: () => setInstitutionEditQuestionId(record.questionId)
      },
      ...OPERATION_ACTIONS.map((action) => ({
        key: `status-${action.nextStatus}`,
        label: action.copy.label,
        disabled: record.serviceStatus === action.nextStatus,
        onClick: () =>
          setActionState({
            questionId: record.questionId,
            nextStatus: action.nextStatus
          })
      }))
    ],
    [openDetail]
  );

  const manageColumns = useMemo<TableColumnsType<AssessmentQuestionSummary>>(
    () => [
      {
        title: '문항 번호',
        dataIndex: 'questionNumber',
        width: 110,
        sorter: createTextSorter((record) => record.questionNumber),
        filters: assessmentQuestionNumbers.map((number) => ({
          text: `${number}번`,
          value: number
        })),
        onFilter: (value, record) => record.questionNumber === value,
        render: (questionNumber: AssessmentQuestionNumber) => `${questionNumber}번`
      },
      {
        title: '문항 ID',
        dataIndex: 'questionId',
        width: 230,
        sorter: createTextSorter((record) => record.questionId),
        filterIcon: (filtered) => (
          <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          clearFilters
        }) => (
          <div
            style={{ padding: 8 }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Input
              allowClear
              placeholder="문항 ID 검색"
              value={selectedKeys[0] as string | undefined}
              onChange={(event) =>
                setSelectedKeys(event.target.value ? [event.target.value] : [])
              }
              onPressEnter={() => confirm()}
              style={{ marginBottom: 8, display: 'block', width: 220 }}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={() => confirm()}
              >
                검색
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFilters?.();
                  confirm();
                }}
              >
                초기화
              </Button>
            </Space>
          </div>
        ),
        onFilter: (value, record) =>
          record.questionId.toLowerCase().includes(String(value).toLowerCase()),
        render: (questionId: string) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => openDetail(questionId)}
          >
            {questionId}
          </Button>
        )
      },
      {
        title: '주제',
        dataIndex: 'topicMain',
        width: 160,
        sorter: createTextSorter((record) => record.topicMain),
        filters: topicMainFilterOptions,
        onFilter: (value, record) => record.topicMain === value,
        render: (topicMain: string) => <Text>{topicMain || '-'}</Text>
      },
      {
        title: '난이도',
        dataIndex: 'difficultyLevel',
        width: 110,
        sorter: (a, b) => (a.difficultyLevel ?? 0) - (b.difficultyLevel ?? 0),
        filters: assessmentDifficultyLevels.map((level) => ({
          text: `난이도 ${level}`,
          value: level
        })),
        onFilter: (value, record) => record.difficultyLevel === value,
        render: (difficultyLevel: number | null) =>
          difficultyLevel == null ? (
            <Text type="secondary">-</Text>
          ) : (
            <Text>난이도 {difficultyLevel}</Text>
          )
      },
      {
        title: 'TOPIK 급수',
        dataIndex: 'targetLevel',
        width: 130,
        sorter: createTextSorter((record) => record.targetLevel),
        filters: targetLevelFilterOptions,
        onFilter: (value, record) => record.targetLevel === value,
        render: (targetLevel: string) =>
          targetLevel ? (
            <Text>{targetLevel}</Text>
          ) : (
            <Text type="secondary">-</Text>
          )
      },
      {
        title: createStatusColumnTitle('노출 상태', serviceStatusLabels),
        dataIndex: 'serviceStatus',
        width: 130,
        sorter: createTextSorter((record) => record.serviceStatus ?? ''),
        render: (_, record) => (
          <Tag color={getServiceStatusColor(record.serviceStatus)}>
            {getServiceStatusLabel(record.serviceStatus)}
          </Tag>
        )
      },
      {
        title: '태그',
        key: 'tags',
        width: 150,
        render: (_, record) => {
          const count = tagCountByQuestionId[record.questionId] ?? 0;
          return (
            <Space size={6}>
              {count > 0 ? <Text>{count}개</Text> : <Text type="secondary">-</Text>}
              <Button
                size="small"
                aria-label={`태그 편집: ${record.questionId}`}
                onClick={() => setTagEditQuestionId(record.questionId)}
              >
                태그 편집
              </Button>
            </Space>
          );
        }
      },
      {
        // 현황 표시 전용 — 설정 진입은 행 더보기 메뉴의 '기관 노출 설정' 항목으로 이동했다.
        title: '기관 노출',
        key: 'institutions',
        width: 200,
        render: (_, record) => {
          const rows = institutionsByQuestionId[record.questionId] ?? [];
          if (rows.length === 0) {
            return <Tag color="default">전체 공개</Tag>;
          }
          return (
            <Space size={6} wrap>
              {rows.slice(0, 2).map((row) => (
                <Tag key={row.institutionCode} color="blue">
                  {institutionLabelByCode[row.institutionCode] ??
                    row.institutionLabel ??
                    row.institutionCode}
                </Tag>
              ))}
              {rows.length > 2 ? (
                <Text type="secondary">+{rows.length - 2}</Text>
              ) : null}
            </Space>
          );
        }
      },
      {
        title: '최근 수정',
        key: 'updatedAt',
        width: 160,
        sorter: createTextSorter((record) => record.updatedAt),
        render: (_, record) => <Text>{record.updatedAt || '-'}</Text>
      },
      {
        title: '',
        key: 'rowActions',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <TableActionMenu items={createRowActionItems(record)} />
        )
      }
    ],
    [
      createRowActionItems,
      institutionLabelByCode,
      institutionsByQuestionId,
      openDetail,
      tagCountByQuestionId,
      targetLevelFilterOptions,
      topicMainFilterOptions
    ]
  );

  const actionCopy = actionState
    ? OPERATION_ACTIONS.find(
        (candidate) => candidate.nextStatus === actionState.nextStatus
      )?.copy ?? null
    : null;

  // POL-018 화면 가드: available 전환 대상의 활성 태그를 검사해 ②(운영주의 태그
  // 활성 — 사유 필수 경고)·③(반복방지 태그 활성 과다 — excluded 권고) 문구를
  // 모달 설명에 덧붙인다. 사유 입력은 ConfirmAction에서 항상 필수다.
  const actionDescription = useMemo(() => {
    if (!actionState || !actionCopy) {
      return '';
    }
    if (actionState.nextStatus !== 'available') {
      return actionCopy.description;
    }

    const activeTags = tagsByQuestionId[actionState.questionId] ?? [];
    const cautionTagNames = activeTags
      .filter((tag) => tagGroupByCode[tag.tagCode] === TAG_GROUP_OPERATION_CAUTION)
      .map((tag) => tagNameByCode[tag.tagCode] ?? tag.tagCode);
    const repeatAvoidCount = activeTags.filter(
      (tag) => tagGroupByCode[tag.tagCode] === TAG_GROUP_REPEAT_AVOID
    ).length;

    const guards: string[] = [];
    if (cautionTagNames.length > 0) {
      guards.push(
        `이 문항에는 운영주의 태그(${cautionTagNames.join(', ')})가 활성입니다 — 전환 사유가 필수입니다(POL-018 ②).`
      );
    }
    if (repeatAvoidCount >= REPEAT_AVOID_EXCESS_THRESHOLD) {
      guards.push(
        `반복방지 태그가 ${repeatAvoidCount}개 활성입니다 — 반복 노출 회피 대상 과다 문항은 노출 제외(excluded)를 권고합니다(POL-018 ③).`
      );
    }

    return guards.length > 0
      ? `${actionCopy.description} ${guards.join(' ')}`
      : actionCopy.description;
  }, [actionCopy, actionState, tagGroupByCode, tagNameByCode, tagsByQuestionId]);

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title="TOPIK 쓰기 문항" />

        <AssessmentBankTabs active="questions" />

        <ListSummaryCards items={summaryItems} />

        <AdminListCard>
          {questionBankDataSource === 'mock' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="모크 모드로 동작 중입니다."
              description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터·감사 로그에는 기록되지 않습니다."
            />
          ) : null}

          {state.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="문항 목록을 불러오지 못했습니다."
              description={state.errorMessage ?? ''}
              action={
                <Button size="small" onClick={reload}>
                  다시 시도
                </Button>
              }
            />
          ) : null}

          {state.status === 'pending' && !hasCachedQuestions ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="문항 목록을 불러오는 중입니다."
            />
          ) : null}

          {selectedQuestions.length > 0 ? (
            <div
              data-testid="bulk-action-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 16,
                padding: '8px 12px',
                background: '#f5f5f5',
                border: '1px solid #f0f0f0',
                borderRadius: 6
              }}
            >
              <Text strong>선택 {selectedQuestions.length.toLocaleString()}건</Text>
              {selectedQuestions.length < filteredQuestions.length ? (
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() =>
                    setSelectedRowKeys(
                      filteredQuestions.map((question) => question.questionId)
                    )
                  }
                >
                  필터 결과 전체 {filteredQuestions.length.toLocaleString()}건 선택
                </Button>
              ) : null}
              <span style={{ flex: 1 }} />
              <Text type="secondary">일괄 노출 상태:</Text>
              <Button
                size="small"
                danger
                onClick={() => setBulkStatus('available')}
              >
                노출 가능
              </Button>
              <Button size="small" onClick={() => setBulkStatus('excluded')}>
                노출 제외
              </Button>
              <Button size="small" onClick={() => setBulkStatus('internal_test')}>
                내부 테스트
              </Button>
              <Text type="secondary">기관 노출:</Text>
              <Button size="small" onClick={() => setBulkInstitutionMode('set')}>
                기관 한정 지정
              </Button>
              <Button size="small" onClick={() => setBulkInstitutionMode('clear')}>
                전체 공개로
              </Button>
              <Button
                size="small"
                type="text"
                onClick={() => setSelectedRowKeys([])}
              >
                선택 해제
              </Button>
            </div>
          ) : null}

          {filteredQuestions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="조건에 맞는 관리 대상 문항이 없습니다."
            />
          ) : (
            <AdminDataTable<AssessmentQuestionSummary>
              className="assessment-bank-table"
              rowKey="questionId"
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
                preserveSelectedRowKeys: false
              }}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => `총 ${total.toLocaleString()}건`
              }}
              scroll={{ x: 1580 }}
              tableLayout="fixed"
              columns={manageColumns}
              dataSource={filteredQuestions}
            />
          )}
        </AdminListCard>

        {actionState && actionCopy ? (
          <ConfirmAction
            open
            title={actionCopy.title}
            description={actionDescription}
            targetType="AssessmentQuestion"
            targetId={actionState.questionId}
            confirmText={actionCopy.confirmText}
            reasonPlaceholder={actionCopy.reasonPlaceholder}
            onCancel={() => setActionState(null)}
            onConfirm={handleConfirmOperationAction}
          />
        ) : null}

        {bulkStatus ? (
          <BulkServiceStatusModal
            open
            nextStatus={bulkStatus}
            selectedQuestions={selectedQuestions}
            cautionCount={bulkCautionCount}
            onCancel={() => setBulkStatus(null)}
            onConfirm={handleBulkConfirm}
          />
        ) : null}

        {tagEditQuestionId ? (
          <QuestionTagEditModal
            open
            questionId={tagEditQuestionId}
            activeTags={tagsByQuestionId[tagEditQuestionId] ?? []}
            tagMasterRows={tagMasterRows}
            onClose={() => setTagEditQuestionId(null)}
            onMutated={handleTagMutated}
          />
        ) : null}

        {institutionEditQuestionId ? (
          <QuestionInstitutionEditModal
            open
            questionId={institutionEditQuestionId}
            activeInstitutions={
              institutionsByQuestionId[institutionEditQuestionId] ??
              EMPTY_INSTITUTION_ROWS
            }
            codeOptions={codeOptions}
            onClose={() => setInstitutionEditQuestionId(null)}
            onMutated={handleInstitutionMutated}
          />
        ) : null}

        {bulkInstitutionMode ? (
          <BulkInstitutionExposureModal
            open
            mode={bulkInstitutionMode}
            selectedQuestions={selectedQuestions}
            codeOptions={codeOptions}
            onCancel={() => setBulkInstitutionMode(null)}
            onConfirm={handleBulkInstitutionConfirm}
          />
        ) : null}
      </div>
    </>
  );
}
