import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Grid,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionSafe,
  updateAssessmentQuestionReviewMemoSafe,
  updateAssessmentQuestionReviewPassedSafe
} from '../api/assessment-question-bank-service';
import {
  getReviewPassedColor,
  getReviewPassedLabel,
  getWorkflowStatusColor
} from '../model/assessment-question-bank-schema';
import type {
  AssessmentQuestion,
  AssessmentQuestionChart,
  AssessmentQuestionEditHistoryItem
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

type ReviewActionState = {
  nextValue: boolean;
} | null;

type ReviewActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

type HistoryRow = AssessmentQuestionEditHistoryItem & {
  key: string;
};

type ReviewDescriptionItem = NonNullable<DescriptionsProps['items']>[number];

function buildQuestionBankListHref(search: string): string {
  return search ? `/assessment/question-bank${search}` : '/assessment/question-bank';
}

function getReviewActionCopy(nextValue: boolean): ReviewActionCopy {
  return nextValue
    ? {
        title: '검수 통과 처리',
        description:
          '이 문항의 `review_passed` 값을 true로 변경합니다. 저장된 review_memo와 함께 감사 로그가 남습니다.',
        confirmText: '검수 통과',
        successMessage: 'review_passed 값을 true로 변경했습니다.',
        reasonPlaceholder: '검수 통과 처리 사유를 입력해 주세요.'
      }
    : {
        title: '검수 미통과 처리',
        description:
          '이 문항의 `review_passed` 값을 false로 변경합니다. 저장된 review_memo와 함께 감사 로그가 남습니다.',
        confirmText: '검수 미통과',
        successMessage: 'review_passed 값을 false로 변경했습니다.',
        reasonPlaceholder: '검수 미통과 처리 사유를 입력해 주세요.'
      };
}

function renderParagraph(text: string): JSX.Element {
  return (
    <Paragraph className="assessment-review-page__description-paragraph">
      {text || '-'}
    </Paragraph>
  );
}

function renderTagList(values: string[]): JSX.Element {
  return values.length > 0 ? (
    <Space wrap size={[6, 6]}>
      {values.map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
    </Space>
  ) : (
    <span>-</span>
  );
}

function renderStringList(values: string[]): JSX.Element {
  return values.length > 0 ? (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {values.map((value) => (
        <li key={value}>{value}</li>
      ))}
    </ul>
  ) : (
    <span>-</span>
  );
}

function renderJson(value: unknown): JSX.Element {
  return (
    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function buildChartItems(
  prefix: 'chart_a' | 'chart_b',
  chart: AssessmentQuestionChart
): ReviewDescriptionItem[] {
  return [
    {
      key: `${prefix}-title`,
      label: `${prefix}.title`,
      children: chart.title || '-'
    },
    {
      key: `${prefix}-type`,
      label: `${prefix}.chart_type`,
      children: chart.chart_type || '-'
    },
    {
      key: `${prefix}-unit`,
      label: `${prefix}.unit`,
      children: chart.unit || '-'
    },
    {
      key: `${prefix}-survey-org`,
      label: `${prefix}.survey_org`,
      children: chart.survey_org || '-'
    },
    {
      key: `${prefix}-year-range`,
      label: `${prefix}.year_range`,
      span: 2,
      children: renderStringList(chart.year_range)
    },
    {
      key: `${prefix}-series`,
      label: `${prefix}.series`,
      span: 2,
      children: chart.series.length > 0 ? renderJson(chart.series) : '-'
    }
  ];
}

function buildHistoryColumns(): TableColumnsType<HistoryRow> {
  return [
    {
      title: 'edited_at',
      dataIndex: 'edited_at',
      key: 'edited_at',
      width: 180
    },
    {
      title: 'edited_by',
      dataIndex: 'edited_by',
      key: 'edited_by',
      width: 140
    },
    {
      title: 'edit_type',
      dataIndex: 'edit_type',
      key: 'edit_type',
      width: 180
    },
    {
      title: 'source',
      dataIndex: 'source',
      key: 'source',
      width: 180
    }
  ];
}

function buildHistoryDescriptionItems(item: HistoryRow): DescriptionsProps['items'] {
  return [
    {
      key: 'summary',
      label: 'summary',
      children: renderParagraph(item.summary)
    },
    {
      key: 'changed-fields',
      label: 'changed_fields',
      children: renderTagList(item.changed_fields)
    },
    {
      key: 'review-snapshot',
      label: 'review_snapshot',
      children: renderParagraph(item.review_snapshot)
    }
  ];
}

export default function AssessmentQuestionReviewPage(): JSX.Element {
  const { questionId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questionState, setQuestionState] = useState<AsyncState<AssessmentQuestion | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewMemoDraft, setReviewMemoDraft] = useState('');
  const [isSavingReviewMemo, setIsSavingReviewMemo] = useState(false);
  const [actionState, setActionState] = useState<ReviewActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const screens = useBreakpoint();

  useEffect(() => {
    const controller = new AbortController();

    setQuestionState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionSafe(questionId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setQuestionState({
          status: 'error',
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
        return;
      }

      setQuestionState({
        status: 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
      setReviewMemoDraft(result.data.review_memo);
    });

    return () => {
      controller.abort();
    };
  }, [questionId, reloadKey]);

  const question = questionState.data;
  const hasUnsavedReviewMemo = Boolean(
    question && reviewMemoDraft !== question.review_memo
  );
  const backHref = buildQuestionBankListHref(location.search);
  const actionCopy = actionState ? getReviewActionCopy(actionState.nextValue) : null;
  const historyColumns = useMemo(() => buildHistoryColumns(), []);
  const historyRows = useMemo<HistoryRow[]>(
    () =>
      question?.edit_history.map((item, index) => ({
        ...item,
        key: `${question.id}-${index}`
      })) ?? [],
    [question]
  );
  const descriptionColumn = screens.lg ? 2 : 1;

  const syncQuestion = useCallback((updatedQuestion: AssessmentQuestion) => {
    setQuestionState({
      status: 'success',
      data: updatedQuestion,
      errorMessage: null,
      errorCode: null
    });
    setReviewMemoDraft(updatedQuestion.review_memo);
  }, []);

  const handleSaveReviewMemo = useCallback(async () => {
    if (!question) {
      return;
    }

    setIsSavingReviewMemo(true);
    const result = await updateAssessmentQuestionReviewMemoSafe({
      questionId: question.id,
      reviewMemo: reviewMemoDraft
    });
    setIsSavingReviewMemo(false);

    if (!result.ok) {
      notificationApi.error({
        message: 'review_memo를 저장하지 못했습니다.',
        description: result.error.message
      });
      return;
    }

    syncQuestion(result.data);
    notificationApi.success({
      message: 'review_memo를 저장했습니다.',
      description: (
        <Space direction="vertical" size={4}>
          <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <AuditLogLink targetType="AssessmentQuestion" targetId={result.data.id} />
        </Space>
      )
    });
  }, [notificationApi, question, reviewMemoDraft, syncQuestion]);

  const handleRequestReviewPassedUpdate = useCallback(
    (nextValue: boolean) => {
      if (!question) {
        return;
      }

      if (!reviewMemoDraft.trim()) {
        notificationApi.warning({
          message: 'review_memo를 먼저 입력해 주세요.',
          description:
            '검수 통과 여부를 변경하기 전에 review_memo에 판단 근거를 남겨야 합니다.'
        });
        return;
      }

      setActionState({ nextValue });
    },
    [notificationApi, question, reviewMemoDraft]
  );

  const handleConfirmReviewPassedUpdate = useCallback(
    async (reason: string) => {
      if (!question || !actionState) {
        return;
      }

      if (hasUnsavedReviewMemo) {
        setIsSavingReviewMemo(true);
        const memoResult = await updateAssessmentQuestionReviewMemoSafe({
          questionId: question.id,
          reviewMemo: reviewMemoDraft
        });
        setIsSavingReviewMemo(false);

        if (!memoResult.ok) {
          notificationApi.error({
            message: 'review_memo를 저장하지 못했습니다.',
            description: memoResult.error.message
          });
          return;
        }

        syncQuestion(memoResult.data);
      }

      const result = await updateAssessmentQuestionReviewPassedSafe({
        questionId: question.id,
        nextValue: actionState.nextValue,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: 'review_passed 값을 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      syncQuestion(result.data);
      setActionState(null);
      notificationApi.success({
        message: getReviewActionCopy(actionState.nextValue).successMessage,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <AuditLogLink targetType="AssessmentQuestion" targetId={result.data.id} />
          </Space>
        )
      });
    },
    [
      actionState,
      hasUnsavedReviewMemo,
      notificationApi,
      question,
      reviewMemoDraft,
      syncQuestion
    ]
  );

  const metaItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'id',
          label: 'id',
          children: question.id
        },
        {
          key: 'created-at',
          label: 'created_at',
          children: question.created_at
        },
        {
          key: 'domain',
          label: 'meta.domain',
          children: question.meta.domain
        },
        {
          key: 'question-type',
          label: 'meta.question_type',
          children: question.meta.question_type
        },
        {
          key: 'difficulty',
          label: 'meta.difficulty',
          children: question.meta.difficulty
        },
        {
          key: 'inference-gap',
          label: 'meta.inference_gap',
          children: String(question.meta.inference_gap)
        },
        {
          key: 'link-keywords',
          label: 'meta.link_keywords',
          span: 2,
          children: renderTagList(question.meta.link_keywords)
        }
      ]
    : [];

  const workflowItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'stage-order',
          label: 'review_workflow.stage_order',
          span: 2,
          children: renderStringList(question.review_workflow.stage_order)
        },
        ...question.review_workflow.stage_order.flatMap((stageName) => {
          const stage = question.review_workflow[stageName];

          return [
            {
              key: `${stageName}-status`,
              label: `${stageName}.status`,
              children: (
                <Tag color={getWorkflowStatusColor(stage.status)}>{stage.status}</Tag>
              )
            },
            {
              key: `${stageName}-artifact`,
              label: `${stageName}.artifact_id`,
              children: stage.artifact_id
            },
            {
              key: `${stageName}-source`,
              label: `${stageName}.approval_source`,
              span: 2,
              children: stage.approval_source
            }
          ];
        }),
        {
          key: 'review-passed',
          label: 'review_passed',
          span: 2,
          children: (
            <Tag color={getReviewPassedColor(question.review_passed)}>
              {getReviewPassedLabel(question.review_passed)}
            </Tag>
          )
        }
      ]
    : [];

  const topicSeedItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'topic-seed-title',
          label: 'approved_topic_seed.topic_seed_title',
          span: 2,
          children: question.approved_topic_seed.topic_seed_title
        },
        {
          key: 'shared-context',
          label: 'approved_topic_seed.shared_context',
          span: 2,
          children: renderParagraph(question.approved_topic_seed.shared_context)
        },
        {
          key: 'expected-question-type',
          label: 'approved_topic_seed.expected_question_type',
          children: question.approved_topic_seed.expected_question_type
        },
        {
          key: 'expected-bridge',
          label: 'approved_topic_seed.expected_cross_chart_bridge',
          children: question.approved_topic_seed.expected_cross_chart_bridge
        },
        {
          key: 'why-exam-worthy',
          label: 'approved_topic_seed.why_exam_worthy',
          span: 2,
          children: renderParagraph(question.approved_topic_seed.why_exam_worthy)
        }
      ]
    : [];

  const scenarioItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'scenario-title',
          label: 'scenario_logic.scenario_title',
          span: 2,
          children: question.scenario_logic.scenario_title
        },
        {
          key: 'logic-chain',
          label: 'scenario_logic.logic_chain',
          span: 2,
          children: renderStringList(question.scenario_logic.logic_chain)
        },
        {
          key: 'chart-a-focus',
          label: 'scenario_logic.chart_a_focus',
          children: question.scenario_logic.chart_a_focus
        },
        {
          key: 'chart-b-focus',
          label: 'scenario_logic.chart_b_focus',
          children: question.scenario_logic.chart_b_focus
        },
        {
          key: 'cross-chart-bridge',
          label: 'scenario_logic.cross_chart_bridge',
          span: 2,
          children: question.scenario_logic.cross_chart_bridge
        },
        {
          key: 'writing-reason',
          label: 'scenario_logic.writing_reason',
          span: 2,
          children: renderParagraph(question.scenario_logic.writing_reason)
        },
        {
          key: 'relation-cause',
          label: 'relation.cause_label',
          children: question.relation.cause_label
        },
        {
          key: 'relation-effect',
          label: 'relation.effect_label',
          children: question.relation.effect_label
        },
        {
          key: 'relation-description',
          label: 'relation.description',
          span: 2,
          children: renderParagraph(question.relation.description)
        }
      ]
    : [];

  const contextItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'row1',
          label: `context_notes.${question.context_notes.row1_label}`,
          children: question.context_notes.row1_value
        },
        {
          key: 'row2',
          label: `context_notes.${question.context_notes.row2_label}`,
          children: question.context_notes.row2_value
        },
        {
          key: 'cause',
          label: 'context_notes.cause',
          span: 2,
          children: renderParagraph(question.context_notes.cause)
        },
        {
          key: 'status',
          label: 'context_notes.status',
          span: 2,
          children: renderParagraph(question.context_notes.status)
        }
      ]
    : [];

  const narrativeItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'summary-trend',
          label: 'narrative.summary_trend',
          span: 2,
          children: renderParagraph(question.narrative.summary_trend)
        },
        {
          key: 'detail-feature',
          label: 'narrative.detail_feature',
          span: 2,
          children: renderParagraph(question.narrative.detail_feature)
        },
        {
          key: 'rank-flip',
          label: 'narrative.rank_flip_sentence',
          span: 2,
          children: renderParagraph(question.narrative.rank_flip_sentence)
        },
        {
          key: 'cause-keywords',
          label: 'narrative.cause_keywords',
          children: renderTagList(question.narrative.cause_keywords)
        },
        {
          key: 'plan-keywords',
          label: 'narrative.plan_keywords',
          children: renderTagList(question.narrative.plan_keywords)
        },
        {
          key: 'cause-sentence',
          label: 'narrative.cause_sentence',
          span: 2,
          children: renderParagraph(question.narrative.cause_sentence)
        },
        {
          key: 'forecast-sentence',
          label: 'narrative.forecast_sentence',
          span: 2,
          children: renderParagraph(question.narrative.forecast_sentence)
        },
        {
          key: 'problem-sentence',
          label: 'narrative.problem_sentence',
          span: 2,
          children: renderParagraph(question.narrative.problem_sentence)
        },
        {
          key: 'solution-keywords',
          label: 'narrative.solution_keywords',
          children: renderTagList(question.narrative.solution_keywords)
        },
        {
          key: 'solution-sentence',
          label: 'narrative.solution_sentence',
          span: 2,
          children: renderParagraph(question.narrative.solution_sentence)
        }
      ]
    : [];

  const promptAndRubricItems: DescriptionsProps['items'] = question
    ? [
        {
          key: 'prompt-text',
          label: 'prompt_text',
          span: 2,
          children: renderParagraph(question.prompt_text)
        },
        {
          key: 'model-answer',
          label: 'model_answer',
          span: 2,
          children: renderParagraph(question.model_answer)
        },
        {
          key: 'rubric-content',
          label: 'rubric.content',
          span: 2,
          children: renderParagraph(question.rubric.content)
        },
        {
          key: 'rubric-structure',
          label: 'rubric.structure',
          span: 2,
          children: renderParagraph(question.rubric.structure)
        },
        {
          key: 'rubric-language',
          label: 'rubric.language',
          span: 2,
          children: renderParagraph(question.rubric.language)
        }
      ]
    : [];

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title={question ? `${question.id} 문항 검토` : '문항 검토'} />

        <AdminListCard>
          {questionState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="문항 상세를 불러오지 못했습니다."
              description={questionState.errorMessage ?? ''}
              action={
                <Button size="small" onClick={() => setReloadKey((prev) => prev + 1)}>
                  다시 시도
                </Button>
              }
            />
          ) : null}

          {questionState.status === 'pending' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="문항 검토 데이터를 불러오는 중입니다."
            />
          ) : null}

          {questionState.status === 'error' ? (
            <Empty
              description="문항 상세를 불러오지 못했습니다."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : null}

          {question ? (
            <div className="assessment-review-page">
              <div className="assessment-review-page__header-actions">
                <Button size="large" onClick={() => navigate(backHref)}>
                  목록으로 돌아가기
                </Button>
              </div>

              <div className="assessment-review-page__main">
                <div className="assessment-review-page__document">
                  <Descriptions
                    bordered
                    size="small"
                    column={descriptionColumn}
                    className="assessment-review-page__descriptions"
                    items={metaItems}
                  />

                  <Card title="review_workflow" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={workflowItems}
                    />
                  </Card>

                  <Card title="approved_topic_seed" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={topicSeedItems}
                    />
                  </Card>

                  <Card title="scenario_logic / relation" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={scenarioItems}
                    />
                  </Card>

                  <Card title="chart_a / chart_b" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={[
                        ...buildChartItems('chart_a', question.chart_a),
                        ...buildChartItems('chart_b', question.chart_b)
                      ]}
                    />
                  </Card>

                  <Card title="context_notes / narrative" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={[...contextItems, ...narrativeItems]}
                    />
                  </Card>

                  <Card title="prompt_text / model_answer / rubric" style={{ marginTop: 24 }}>
                    <Descriptions
                      bordered
                      size="small"
                      column={descriptionColumn}
                      className="assessment-review-page__descriptions"
                      items={promptAndRubricItems}
                    />
                  </Card>

                  <div className="assessment-review-page__history-section">
                    <Text strong className="assessment-review-page__history-title">
                      edit_history ({historyRows.length}건)
                    </Text>
                    <Table
                      rowKey="key"
                      size="small"
                      pagination={false}
                      className="assessment-review-page__history-table"
                      columns={historyColumns}
                      dataSource={historyRows}
                      locale={{ emptyText: '수정 이력이 없습니다.' }}
                      scroll={{ x: 920 }}
                      expandable={{
                        expandedRowRender: (item) => (
                          <div className="assessment-review-page__history-expanded">
                            <Descriptions
                              bordered
                              column={1}
                              size="small"
                              className="assessment-review-page__history-descriptions"
                              items={buildHistoryDescriptionItems(item)}
                            />
                          </div>
                        ),
                        rowExpandable: (item) =>
                          Boolean(
                            item.summary ||
                            item.review_snapshot ||
                            item.changed_fields.length > 0
                          )
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="assessment-review-page__side">
                <Card
                  className="assessment-review-page__memo-card"
                  title="review_memo"
                  extra={
                    <Tag color={getReviewPassedColor(question.review_passed)}>
                      {getReviewPassedLabel(question.review_passed)}
                    </Tag>
                  }
                >
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Text type="secondary">
                      이 카드에서는 JSON의 `review_memo`와 `review_passed`만 수정합니다.
                    </Text>
                    <TextArea
                      aria-label="review_memo 입력"
                      value={reviewMemoDraft}
                      rows={10}
                      showCount
                      maxLength={2000}
                      placeholder="review_memo를 입력하세요."
                      onChange={(event) => setReviewMemoDraft(event.target.value)}
                    />
                    <Text type={hasUnsavedReviewMemo ? 'warning' : 'secondary'}>
                      {hasUnsavedReviewMemo
                        ? '저장되지 않은 review_memo 변경사항이 있습니다.'
                        : '현재 review_memo가 저장된 상태입니다.'}
                    </Text>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Button
                        size="large"
                        block
                        onClick={handleSaveReviewMemo}
                        loading={isSavingReviewMemo}
                      >
                        review_memo 저장
                      </Button>
                      <Button
                        size="large"
                        type="primary"
                        block
                        disabled={question.review_passed}
                        onClick={() => handleRequestReviewPassedUpdate(true)}
                      >
                        검수 통과
                      </Button>
                      <Button
                        size="large"
                        block
                        disabled={!question.review_passed}
                        onClick={() => handleRequestReviewPassedUpdate(false)}
                      >
                        검수 미통과
                      </Button>
                    </Space>
                    <AuditLogLink targetType="AssessmentQuestion" targetId={question.id} />
                  </Space>
                </Card>
              </div>
            </div>
          ) : null}
        </AdminListCard>

        {actionState && question && actionCopy ? (
          <ConfirmAction
            open
            title={actionCopy.title}
            description={actionCopy.description}
            targetType="AssessmentQuestion"
            targetId={question.id}
            confirmText={actionCopy.confirmText}
            reasonPlaceholder={actionCopy.reasonPlaceholder}
            onCancel={() => setActionState(null)}
            onConfirm={handleConfirmReviewPassedUpdate}
          />
        ) : null}
      </div>
    </>
  );
}
