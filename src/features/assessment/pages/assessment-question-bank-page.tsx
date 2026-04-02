import { Alert, Button, Empty, Popover, Select, Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { fetchAssessmentQuestionsSafe } from '../api/assessment-question-bank-service';
import {
  buildAssessmentQuestionSearchText,
  getLatestEditedAt,
  getLatestEditedBy,
  getQuestionPreviewText,
  getQuestionTitle,
  getQuestionWorkflowStatus
} from '../model/assessment-question-bank-presenter';
import {
  getReviewPassedColor,
  getReviewPassedLabel,
  getWorkflowStatusColor,
  parseAssessmentQuestionReviewPassed
} from '../model/assessment-question-bank-schema';
import type { AssessmentQuestion } from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const previewTriggerStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: 0,
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  cursor: 'pointer'
};

const previewPopoverStyle: CSSProperties = {
  width: 420,
  maxWidth: 'min(420px, calc(100vw - 48px))'
};

const previewFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  width: '100%'
};

type SearchQueryKey =
  | 'domain'
  | 'questionType'
  | 'difficulty'
  | 'keyword'
  | 'reviewPassed';

type SearchQueryValue = string | null;

function renderPreviewParagraph(content: string): JSX.Element {
  return (
    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
      {content}
    </Paragraph>
  );
}

function buildReviewPageHref(
  questionId: string,
  params: URLSearchParams
): string {
  const nextSearch = params.toString();

  return nextSearch
    ? `/assessment/question-bank/review/${questionId}?${nextSearch}`
    : `/assessment/question-bank/review/${questionId}`;
}

function buildSummaryValue(count: number): string {
  return `${count.toLocaleString()}문항`;
}

function buildSelectOptions(values: string[]): Array<{ label: string; value: string }> {
  return values.map((value) => ({
    label: value,
    value
  }));
}

function renderQuestionPreviewCell(
  question: AssessmentQuestion,
  onOpenReviewPage: (questionId: string) => void
): JSX.Element {
  return (
    <Popover
      trigger={['hover', 'focus']}
      placement="rightTop"
      content={
        <Space direction="vertical" size={12} style={previewPopoverStyle}>
          <div>
            <Text strong>prompt_text</Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {question.prompt_text}
            </Paragraph>
          </div>
          <div>
            <Text strong>{question.context_notes.row1_label}</Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {question.context_notes.row1_value}
            </Paragraph>
          </div>
          <div>
            <Text strong>{question.context_notes.row2_label}</Text>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {question.context_notes.row2_value}
            </Paragraph>
          </div>
          <div style={previewFooterStyle}>
            <Button
              type="primary"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenReviewPage(question.id);
              }}
            >
              검토하기
            </Button>
          </div>
        </Space>
      }
    >
      <button
        type="button"
        style={previewTriggerStyle}
        aria-label={`${question.id} 문항 전체 미리 보기`}
      >
        {renderPreviewParagraph(getQuestionPreviewText(question))}
      </button>
    </Popover>
  );
}

export default function AssessmentQuestionBankPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [questionsState, setQuestionsState] = useState<AsyncState<AssessmentQuestion[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  const domainFilter = searchParams.get('domain') ?? '';
  const questionTypeFilter = searchParams.get('questionType') ?? '';
  const difficultyFilter = searchParams.get('difficulty') ?? '';
  const keyword = searchParams.get('keyword') ?? '';
  const reviewPassedFilter = parseAssessmentQuestionReviewPassed(
    searchParams.get('reviewPassed')
  );

  const [draftDomainFilter, setDraftDomainFilter] = useState<string | null>(
    domainFilter || null
  );
  const [draftQuestionTypeFilter, setDraftQuestionTypeFilter] = useState<string | null>(
    questionTypeFilter || null
  );
  const [draftDifficultyFilter, setDraftDifficultyFilter] = useState<string | null>(
    difficultyFilter || null
  );
  const [draftReviewPassedFilter, setDraftReviewPassedFilter] = useState<
    string | null
  >(searchParams.get('reviewPassed'));

  useEffect(() => {
    const controller = new AbortController();

    setQuestionsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setQuestionsState({
          status: 'error',
          data: [],
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
        return;
      }

      setQuestionsState({
        status: 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    setDraftDomainFilter(domainFilter || null);
    setDraftQuestionTypeFilter(questionTypeFilter || null);
    setDraftDifficultyFilter(difficultyFilter || null);
    setDraftReviewPassedFilter(searchParams.get('reviewPassed'));
  }, [domainFilter, questionTypeFilter, difficultyFilter, searchParams]);

  const hasCachedQuestions = questionsState.data.length > 0;

  const commitParams = useCallback(
    (nextValues: Partial<Record<SearchQueryKey, SearchQueryValue>>) => {
      const nextParams = new URLSearchParams(searchParams);

      Object.entries(nextValues).forEach(([key, value]) => {
        if (!value) {
          nextParams.delete(key);
          return;
        }

        nextParams.set(key, value);
      });

      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyFilters = useCallback(() => {
    commitParams({
      domain: draftDomainFilter,
      questionType: draftQuestionTypeFilter,
      difficulty: draftDifficultyFilter,
      reviewPassed: draftReviewPassedFilter,
      keyword: keyword || null
    });
  }, [
    commitParams,
    draftDifficultyFilter,
    draftDomainFilter,
    draftQuestionTypeFilter,
    draftReviewPassedFilter,
    keyword
  ]);

  const handleResetFilters = useCallback(() => {
    setDraftDomainFilter(null);
    setDraftQuestionTypeFilter(null);
    setDraftDifficultyFilter(null);
    setDraftReviewPassedFilter(null);
    commitParams({
      domain: null,
      questionType: null,
      difficulty: null,
      keyword: null,
      reviewPassed: null
    });
  }, [commitParams]);

  const domainOptions = useMemo(
    () =>
      buildSelectOptions(
        Array.from(new Set(questionsState.data.map((question) => question.meta.domain))).sort(
          (left, right) => left.localeCompare(right, 'ko')
        )
      ),
    [questionsState.data]
  );

  const questionTypeOptions = useMemo(
    () =>
      buildSelectOptions(
        Array.from(
          new Set(questionsState.data.map((question) => question.meta.question_type))
        ).sort((left, right) => left.localeCompare(right))
      ),
    [questionsState.data]
  );

  const difficultyOptions = useMemo(
    () =>
      buildSelectOptions(
        Array.from(
          new Set(questionsState.data.map((question) => String(question.meta.difficulty)))
        ).sort((left, right) => Number(left) - Number(right))
      ),
    [questionsState.data]
  );

  const filteredQuestions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return questionsState.data.filter((question) => {
      if (domainFilter && question.meta.domain !== domainFilter) {
        return false;
      }

      if (questionTypeFilter && question.meta.question_type !== questionTypeFilter) {
        return false;
      }

      if (difficultyFilter && String(question.meta.difficulty) !== difficultyFilter) {
        return false;
      }

      if (
        reviewPassedFilter !== null &&
        question.review_passed !== reviewPassedFilter
      ) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return buildAssessmentQuestionSearchText(question).includes(normalizedKeyword);
    });
  }, [
    difficultyFilter,
    domainFilter,
    keyword,
    questionTypeFilter,
    questionsState.data,
    reviewPassedFilter
  ]);

  const summaryItems = useMemo(() => {
    const totalCount = questionsState.data.length;
    const passedCount = questionsState.data.filter((question) => question.review_passed).length;
    const notPassedCount = totalCount - passedCount;

    return [
      {
        key: 'all',
        label: '전체 문항',
        value: buildSummaryValue(totalCount),
        active: reviewPassedFilter === null,
        onClick: () => commitParams({ reviewPassed: null })
      },
      {
        key: 'passed',
        label: '검수 통과',
        value: buildSummaryValue(passedCount),
        active: reviewPassedFilter === true,
        onClick: () => commitParams({ reviewPassed: 'true' })
      },
      {
        key: 'not-passed',
        label: '검수 미통과',
        value: buildSummaryValue(notPassedCount),
        active: reviewPassedFilter === false,
        onClick: () => commitParams({ reviewPassed: 'false' })
      }
    ];
  }, [commitParams, questionsState.data, reviewPassedFilter]);

  const openReviewPage = useCallback(
    (questionId: string) => {
      navigate(buildReviewPageHref(questionId, searchParams));
    },
    [navigate, searchParams]
  );

  const columns = useMemo<TableColumnsType<AssessmentQuestion>>(
    () => [
      {
        title: '문항 ID',
        dataIndex: 'id',
        width: 180,
        sorter: createTextSorter((record) => record.id),
        render: (value: string) => (
          <Link className="table-navigation-link" to={buildReviewPageHref(value, searchParams)}>
            {value}
          </Link>
        )
      },
      {
        title: '도메인 / question_type',
        key: 'meta',
        width: 260,
        sorter: createTextSorter(
          (record) =>
            `${record.meta.domain} ${record.meta.question_type} ${record.meta.difficulty}`
        ),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.meta.domain}</Text>
            <Text type="secondary">
              {record.meta.question_type} · difficulty {record.meta.difficulty}
            </Text>
          </Space>
        )
      },
      {
        title: '주제',
        key: 'topicSeedTitle',
        width: 260,
        sorter: createTextSorter((record) => getQuestionTitle(record)),
        render: (_, record) => (
          <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
            {getQuestionTitle(record)}
          </Paragraph>
        )
      },
      {
        title: 'prompt_text',
        key: 'promptText',
        sorter: createTextSorter((record) => getQuestionPreviewText(record)),
        render: (_, record) => renderQuestionPreviewCell(record, openReviewPage)
      },
      {
        title: '최종 문항 승인',
        key: 'finalWorkflow',
        width: 180,
        sorter: createTextSorter((record) => getQuestionWorkflowStatus(record)),
        render: (_, record) => (
          <Tag color={getWorkflowStatusColor(getQuestionWorkflowStatus(record))}>
            {getQuestionWorkflowStatus(record)}
          </Tag>
        )
      },
      {
        title: 'review_passed',
        dataIndex: 'review_passed',
        width: 160,
        sorter: createTextSorter((record) => String(record.review_passed)),
        render: (value: boolean) => (
          <Tag color={getReviewPassedColor(value)}>{getReviewPassedLabel(value)}</Tag>
        )
      },
      {
        title: '최근 수정',
        key: 'latestEdit',
        width: 220,
        sorter: createTextSorter((record) => getLatestEditedAt(record)),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text>{getLatestEditedAt(record)}</Text>
            <Text type="secondary">{getLatestEditedBy(record)}</Text>
          </Space>
        )
      }
    ],
    [openReviewPage, searchParams]
  );

  const toolbar = (
    <SearchBar
      searchField="all"
      searchFieldOptions={[{ label: '전체', value: 'all' }]}
      keyword={keyword}
      keywordAriaLabel="문항 검색어"
      onSearchFieldChange={() => undefined}
      onKeywordChange={(event) =>
        commitParams({
          keyword: event.target.value || null
        })
      }
      keywordPlaceholder="문항 ID, 주제, prompt_text, review_memo를 검색하세요."
      detailTitle="상세 검색"
      detailContent={
        <>
          <SearchBarDetailField label="도메인">
            <Select
              allowClear
              value={draftDomainFilter ?? undefined}
              options={domainOptions}
              placeholder="도메인 선택"
              onChange={(value) => setDraftDomainFilter(value ?? null)}
            />
          </SearchBarDetailField>
          <SearchBarDetailField label="question_type">
            <Select
              allowClear
              value={draftQuestionTypeFilter ?? undefined}
              options={questionTypeOptions}
              placeholder="question_type 선택"
              onChange={(value) => setDraftQuestionTypeFilter(value ?? null)}
            />
          </SearchBarDetailField>
          <SearchBarDetailField label="difficulty">
            <Select
              allowClear
              value={draftDifficultyFilter ?? undefined}
              options={difficultyOptions}
              placeholder="difficulty 선택"
              onChange={(value) => setDraftDifficultyFilter(value ?? null)}
            />
          </SearchBarDetailField>
          <SearchBarDetailField label="review_passed">
            <Select
              allowClear
              value={draftReviewPassedFilter ?? undefined}
              options={[
                { label: '검수 통과', value: 'true' },
                { label: '검수 미통과', value: 'false' }
              ]}
              placeholder="검수 통과 여부 선택"
              onChange={(value) => setDraftReviewPassedFilter(value ?? null)}
            />
          </SearchBarDetailField>
        </>
      }
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      summary={<Text type="secondary">현재 결과 {filteredQuestions.length.toLocaleString()}문항</Text>}
    />
  );

  const showInitialTableLoading =
    questionsState.status === 'pending' && !hasCachedQuestions;
  const shouldRenderQuestionTable =
    showInitialTableLoading || filteredQuestions.length > 0;

  return (
    <div>
      <PageTitle title="TOPIK 쓰기 문제은행" />
      <ListSummaryCards items={summaryItems} />

      <AdminListCard toolbar={toolbar}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="첨부 JSON 97건 기준으로만 구성된 화면입니다."
          description="id, meta, review_workflow, approved_topic_seed, prompt_text, context_notes, model_answer, rubric, edit_history, review_passed만 사용합니다."
        />

        {questionsState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="문항 목록을 불러오지 못했습니다."
            description={questionsState.errorMessage ?? ''}
            action={
              <Button size="small" onClick={() => setReloadKey((prev) => prev + 1)}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {shouldRenderQuestionTable ? (
          <AdminDataTable<AssessmentQuestion>
            rowKey="id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1500 }}
            columns={columns}
            dataSource={filteredQuestions}
            loading={showInitialTableLoading}
            onRow={(record) => ({
              onClick: () => openReviewPage(record.id),
              style: { cursor: 'pointer' }
            })}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="조건에 맞는 문항이 없습니다."
          />
        )}
      </AdminListCard>
    </div>
  );
}
