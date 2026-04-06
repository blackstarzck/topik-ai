import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Grid,
  Input,
  Space,
  Tag,
  Table,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionSafe,
  updateAssessmentQuestionReviewMemoSafe,
  updateAssessmentQuestionReviewStatusSafe
} from '../api/assessment-question-bank-service';
import { getAssessmentQuestionRubric } from '../model/assessment-question-prompt-fixture';
import {
  getReviewStatusColor,
  getValidationStatusColor
} from '../model/assessment-question-bank-schema';
import {
  getQuestionText
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
  AssessmentQuestionReviewDocument,
  AssessmentQuestionReviewStatus
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

type ReviewActionableStatus = Extract<
  AssessmentQuestionReviewStatus,
  '검수 완료' | '보류' | '수정 필요'
>;

type ReviewActionState = {
  nextStatus: ReviewActionableStatus;
} | null;

type ReviewActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

type ReviewCriterionCard = {
  key: string;
  title: string;
  body: string;
};

type ReviewHistoryCard = {
  key: string;
  editedAt: string;
  editedBy: string;
  editType: string;
  reviewerMemo: string;
  changedFields: string[];
  reflectedReview: string;
};

type ReviewDescriptionItem = NonNullable<DescriptionsProps['items']>[number];

type ReviewProfileKey = '51-52' | '53' | '54';

type ReviewViewModel = {
  title: string;
  instructionText: string;
  sourceText: string;
  coreMeaningLabel: string;
  coreMeaningText: string;
  keyIssueLabel: string;
  keyIssueText: string;
  questionPromptIntro?: string;
  modelAnswer: string;
  criteria: ReviewCriterionCard[];
  history: ReviewHistoryCard[];
};

function getDisplayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '-';
}

function renderDescriptionParagraph(value: string | null | undefined): JSX.Element {
  return (
    <Paragraph className="assessment-review-page__description-paragraph">
      {getDisplayText(value)}
    </Paragraph>
  );
}

const REVIEW_ACTION_COPY_BY_STATUS: Record<
  ReviewActionableStatus,
  ReviewActionCopy
> = {
  '검수 완료': {
    title: '검수 완료 처리',
    description:
      '이 문항을 검수 완료로 전환합니다. 저장된 검수 메모와 확인 사유는 감사 로그로 남습니다.',
    confirmText: '검수 완료',
    successMessage: '검수 완료 처리했습니다.',
    reasonPlaceholder: '검수 완료 사유를 입력해 주세요.'
  },
  보류: {
    title: '보류 처리',
    description:
      '이 문항을 보류로 전환합니다. 추가 확인이 필요한 사유와 최신 검수 메모는 감사 로그로 남습니다.',
    confirmText: '보류',
    successMessage: '보류 처리했습니다.',
    reasonPlaceholder: '보류 사유를 입력해 주세요.'
  },
  '수정 필요': {
    title: '수정 필요 처리',
    description:
      '이 문항을 수정 필요로 전환합니다. 재생성 또는 수동 수정이 필요한 이유와 최신 검수 메모는 감사 로그로 남습니다.',
    confirmText: '수정 필요',
    successMessage: '수정 필요 처리했습니다.',
    reasonPlaceholder: '수정 필요 사유를 입력해 주세요.'
  }
};

function buildQuestionBankListHref(search: string): string {
  const params = new URLSearchParams(search);

  params.delete('selected');

  if (!params.get('tab')) {
    params.set('tab', 'review');
  }

  const nextSearch = params.toString();
  return nextSearch ? `/assessment/question-bank?${nextSearch}` : '/assessment/question-bank';
}

function buildReviewCriteria(
  reviewDocument: AssessmentQuestionReviewDocument | null,
  question: AssessmentQuestion
): ReviewCriterionCard[] {
  const rubric = reviewDocument?.rubric ?? getAssessmentQuestionRubric(question.questionId);

  if (rubric) {
    return [
      {
        key: 'content',
        title: '내용',
        body: rubric.content
      },
      {
        key: 'language',
        title: '언어',
        body: rubric.language
      },
      {
        key: 'structure',
        title: '구성',
        body: rubric.structure
      }
    ];
  }

  return question.scoringCriteria.map((criterion, index) => ({
    key: `criterion-${index + 1}`,
    title: `기준 ${index + 1}`,
    body: criterion
  }));
}

function buildReviewHistory(
  reviewDocument: AssessmentQuestionReviewDocument | null,
  question: AssessmentQuestion
): ReviewHistoryCard[] {
  if (!reviewDocument) {
    return question.revisionHistory.map((item) => ({
      key: item.id,
      editedAt: item.changedAt,
      editedBy: item.changedBy,
      editType: 'revision',
      reviewerMemo: item.summary,
      changedFields: [],
      reflectedReview: ''
    }));
  }

  return reviewDocument.edit_history.map((item, index) => ({
    key: `${reviewDocument.id}-${index}`,
    editedAt: item.edited_at,
    editedBy: item.edited_by,
    editType: item.edit_type,
    reviewerMemo: item.summary,
    changedFields: item.changed_fields,
    reflectedReview: item.review_snapshot
  }));
}

function buildReviewHistoryColumns(): TableColumnsType<ReviewHistoryCard> {
  return [
    {
      title: '수정 일시',
      dataIndex: 'editedAt',
      key: 'editedAt',
      width: 160
    },
    {
      title: '수정자',
      dataIndex: 'editedBy',
      key: 'editedBy',
      width: 120
    },
    {
      title: '수정 유형',
      dataIndex: 'editType',
      key: 'editType',
      width: 140
    }
  ];
}

function buildReviewHistoryDescriptionItems(
  item: ReviewHistoryCard
): DescriptionsProps['items'] {
  return [
    {
      key: 'reviewerMemo',
      label: '검수자 메모',
      children: renderDescriptionParagraph(item.reviewerMemo)
    },
    {
      key: 'reflectedReview',
      label: '반영 리뷰',
      children: renderDescriptionParagraph(item.reflectedReview)
    },
    {
      key: 'changedFields',
      label: '반영 필드',
      children:
        item.changedFields.length > 0 ? (
          <Space
            wrap
            size={[6, 6]}
            className="assessment-review-page__history-field-list"
          >
            {item.changedFields.map((field) => (
              <Tag key={field} className="assessment-review-page__history-field-tag">
                {field}
              </Tag>
            ))}
          </Space>
        ) : (
          '-'
        )
    }
  ];
}

function buildReviewViewModel(question: AssessmentQuestion): ReviewViewModel {
  const reviewDocument = question.reviewDocument;

  if (!reviewDocument) {
    return {
      title: question.topic,
      instructionText:
        question.content.kind === '53' || question.content.kind === '54'
          ? getQuestionText(question)
          : '',
      sourceText: '',
      coreMeaningLabel: '핵심 의미',
      coreMeaningText: question.coreMeaning,
      keyIssueLabel: '핵심 문제',
      keyIssueText: question.keyIssue,
      modelAnswer: question.modelAnswer,
      criteria: buildReviewCriteria(null, question),
      history: buildReviewHistory(null, question)
    };
  }

  return {
    title: reviewDocument.approved_topic_seed.topic_seed_title,
    instructionText:
      question.content.kind === '53' || question.content.kind === '54'
        ? reviewDocument.prompt_text
        : '',
    sourceText: '',
    coreMeaningLabel: reviewDocument.context_notes.row1_label || '핵심 의미',
    coreMeaningText:
      reviewDocument.context_notes.row1_value || question.coreMeaning,
    keyIssueLabel: reviewDocument.context_notes.row2_label || '핵심 문제',
    keyIssueText: reviewDocument.context_notes.row2_value || question.keyIssue,
    questionPromptIntro:
      reviewDocument.approved_topic_seed.shared_context || question.content.learnerPrompt,
    modelAnswer: reviewDocument.model_answer,
    criteria: buildReviewCriteria(reviewDocument, question),
    history: buildReviewHistory(reviewDocument, question)
  };
}

function getReviewProfileKey(question: AssessmentQuestion): ReviewProfileKey {
  if (question.content.kind === '53') {
    return '53';
  }

  if (question.content.kind === '54') {
    return '54';
  }

  return '51-52';
}

function getQuestionFormText(question: AssessmentQuestion): string {
  if (question.reviewDocument) {
    return '53형';
  }

  const profileKey = getReviewProfileKey(question);

  if (profileKey === '51-52') {
    return '51·52 공통형';
  }

  if (profileKey === '53') {
    return '53형';
  }

  return '54형';
}

function buildCriteriaContent(criteria: ReviewCriterionCard[]): JSX.Element {
  if (criteria.length === 0) {
    return renderDescriptionParagraph('');
  }

  return (
    <div className="assessment-review-page__criteria-grid">
      {criteria.map((criterion) => (
        <div key={criterion.key} className="assessment-review-page__criteria-card">
          <Text strong>{criterion.title}</Text>
          <Paragraph className="assessment-review-page__criteria-body">
            {criterion.body}
          </Paragraph>
        </div>
      ))}
    </div>
  );
}

function buildSharedDescriptionItems(
  question: AssessmentQuestion,
  reviewView: ReviewViewModel
): ReviewDescriptionItem[] {
  return [
    {
      key: 'questionNumber',
      label: '문항 번호',
      children: getDisplayText(question.questionNumber)
    },
    {
      key: 'questionTopic',
      label: '문항 주제',
      children: getDisplayText(reviewView.title)
    },
    {
      key: 'questionForm',
      label: '문항 형태',
      children: getDisplayText(getQuestionFormText(question))
    },
    {
      key: 'questionId',
      label: '문항 ID',
      children: getDisplayText(question.questionId)
    },
    {
      key: 'instruction',
      label: '문항 지시문',
      span: 2,
      children: renderDescriptionParagraph(reviewView.instructionText)
    }
  ];
}

function buildCommonReviewDescriptionItems(
  reviewView: ReviewViewModel
): ReviewDescriptionItem[] {
  return [
    {
      key: 'source',
      label: '출처',
      span: 2,
      children: renderDescriptionParagraph(reviewView.sourceText)
    },
    {
      key: 'coreMeaning',
      label: reviewView.coreMeaningLabel,
      children: renderDescriptionParagraph(reviewView.coreMeaningText)
    },
    {
      key: 'keyIssue',
      label: reviewView.keyIssueLabel,
      children: renderDescriptionParagraph(reviewView.keyIssueText)
    },
    {
      key: 'modelAnswer',
      label: '모범답안',
      span: 2,
      children: renderDescriptionParagraph(reviewView.modelAnswer)
    },
    {
      key: 'criteria',
      label: '채점 기준',
      span: 2,
      children: buildCriteriaContent(reviewView.criteria)
    }
  ];
}

function buildReviewDescriptionItems(
  question: AssessmentQuestion,
  reviewView: ReviewViewModel
): ReviewDescriptionItem[] {
  const sharedItems = buildSharedDescriptionItems(question, reviewView);
  const commonItems = buildCommonReviewDescriptionItems(reviewView);

  if (question.content.kind === '51' || question.content.kind === '52') {
    return [
      ...sharedItems,
      {
        key: 'reviewPassage',
        label: '문항',
        span: 2,
        children: (
          <div className="assessment-review-page__highlight-panel">
            {renderDescriptionParagraph(getQuestionText(question))}
          </div>
        )
      },
      ...commonItems
    ];
  }

  if (question.content.kind === '53') {
    return [...sharedItems, ...commonItems];
  }

  return [
    ...sharedItems,
    {
      key: 'questionPrompt',
      label: '문항 질문',
      span: 2,
        children: (
          <div className="assessment-review-page__description-stack">
            {renderDescriptionParagraph(
              reviewView.questionPromptIntro ?? question.content.learnerPrompt
            )}
          <ol className="assessment-review-page__ordered-list">
            {question.content.conditionLines.map((line) => (
              <li key={line}>
                <Text className="assessment-review-page__description-paragraph">
                  {getDisplayText(line)}
                </Text>
              </li>
            ))}
          </ol>
          </div>
        )
      },
    ...commonItems
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
      setReviewMemoDraft(result.data.reviewMemo);
    });

    return () => {
      controller.abort();
    };
  }, [questionId, reloadKey]);

  const question = questionState.data;
  const hasUnsavedReviewMemo = Boolean(
    question && reviewMemoDraft !== question.reviewMemo
  );
  const backHref = buildQuestionBankListHref(location.search);
  const actionCopy = actionState
    ? REVIEW_ACTION_COPY_BY_STATUS[actionState.nextStatus]
    : null;
  const reviewView = question ? buildReviewViewModel(question) : null;
  const descriptionColumn = screens.lg ? 2 : 1;
  const historyColumns = buildReviewHistoryColumns();

  const syncQuestion = useCallback((updatedQuestion: AssessmentQuestion) => {
    setQuestionState({
      status: 'success',
      data: updatedQuestion,
      errorMessage: null,
      errorCode: null
    });
    setReviewMemoDraft(updatedQuestion.reviewMemo);
  }, []);

  const handleRequestReviewAction = useCallback(async (nextStatus: ReviewActionableStatus) => {
    if (!question) {
      return;
    }

    const nextReviewMemo = reviewMemoDraft.trim();

    if (!nextReviewMemo) {
      notificationApi.warning({
        message: '검수 메모를 먼저 입력해 주세요.',
        description:
          '검수 상태를 변경하기 전에 문항 적합성 판단과 확인 사유를 검수 메모에 남겨야 합니다.'
      });
      return;
    }

    if (hasUnsavedReviewMemo) {
      setIsSavingReviewMemo(true);
      const result = await updateAssessmentQuestionReviewMemoSafe({
        questionId: question.questionId,
        reviewMemo: nextReviewMemo
      });
      setIsSavingReviewMemo(false);

      if (!result.ok) {
        notificationApi.error({
          message: '검수 메모를 저장하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      syncQuestion(result.data);
    }

    setActionState({ nextStatus });
  }, [
    hasUnsavedReviewMemo,
    notificationApi,
    question,
    reviewMemoDraft,
    syncQuestion
  ]);

  const handleConfirmReviewAction = useCallback(
    async (reason: string) => {
      if (!question || !actionState) {
        return;
      }

      const result = await updateAssessmentQuestionReviewStatusSafe({
        questionId: question.questionId,
        nextStatus: actionState.nextStatus,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '검수 상태를 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      const successMessage =
        REVIEW_ACTION_COPY_BY_STATUS[actionState.nextStatus].successMessage;
      syncQuestion(result.data);
      setActionState(null);
      notificationApi.success({
        message: successMessage,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {result.data.questionId}</Text>
            <AuditLogLink
              targetType="AssessmentQuestion"
              targetId={result.data.questionId}
            />
          </Space>
        )
      });
    },
    [actionState, notificationApi, question, syncQuestion]
  );

  const pageTitle = question
    ? `TOPIK ${question.questionNumber}번 문항 검수`
    : '문항 검수';

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title={pageTitle} />

        <AdminListCard>
          {questionState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="검수 대상 문항을 불러오지 못했습니다."
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
              message="문항 검수 데이터를 불러오는 중입니다."
            />
          ) : null}

          {questionState.status === 'error' ? (
            <Empty
              description="문항 상세를 불러오지 못했습니다."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : null}

          {question && reviewView ? (
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
                    items={buildReviewDescriptionItems(question, reviewView)}
                  />

                  <div className="assessment-review-page__history-section">
                    <Text
                      strong
                      className="assessment-review-page__history-title"
                    >
                      수정 히스토리 ({reviewView.history.length}건)
                    </Text>
                    <Table
                      rowKey="key"
                      size="small"
                      pagination={false}
                      className="assessment-review-page__history-table"
                      columns={historyColumns}
                      dataSource={reviewView.history}
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
                              items={buildReviewHistoryDescriptionItems(item)}
                            />
                          </div>
                        ),
                        rowExpandable: (item) =>
                          Boolean(
                            item.reviewerMemo ||
                            item.reflectedReview ||
                            item.changedFields.length > 0
                          )
                      }}
                    />
                  </div>

                </div>
              </div>

              <div className="assessment-review-page__side">
                <Card
                  className="assessment-review-page__memo-card"
                  title="검수 메모"
                >
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div className="assessment-review-page__reviewer-meta">
                      <Text type="secondary">검수자</Text>
                      <Text strong>{getDisplayText(question.reviewerName)}</Text>
                    </div>
                    <Space
                      wrap
                      size={8}
                      className="assessment-review-page__description-meta"
                    >
                      <Tag color={getReviewStatusColor(question.reviewStatus)}>
                        {question.reviewStatus}
                      </Tag>
                      <Tag color={getValidationStatusColor(question.validationStatus)}>
                        {question.validationStatus}
                      </Tag>
                    </Space>
                    <Text type="secondary">
                      검수 메모를 기준으로 문항 적합성 판단과 후속 조치 사유를 함께 기록합니다.
                    </Text>
                    <TextArea
                      aria-label="검수 메모 입력"
                      value={reviewMemoDraft}
                      rows={10}
                      showCount
                      maxLength={500}
                      placeholder="검수 판단 근거를 입력하세요."
                      onChange={(event) => setReviewMemoDraft(event.target.value)}
                    />
                    <Text type={hasUnsavedReviewMemo ? 'warning' : 'secondary'}>
                      {hasUnsavedReviewMemo
                        ? '검수 상태 변경 전에 최신 검수 메모가 함께 저장됩니다.'
                        : '입력한 검수 메모를 기준으로 검수 상태를 변경합니다.'}
                    </Text>
                    <Space
                      direction="vertical"
                      size={8}
                      style={{ width: '100%' }}
                    >
                      <Button
                        size="large"
                        type="primary"
                        block
                        onClick={() => handleRequestReviewAction('검수 완료')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        검수 완료
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => handleRequestReviewAction('보류')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        보류
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => handleRequestReviewAction('수정 필요')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        수정 필요
                      </Button>
                    </Space>
                    <Text
                      type="secondary"
                      className="assessment-review-page__memo-footnote"
                    >
                      내보내기 시 `review_memo` 필드가 함께 포함됩니다.
                    </Text>
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
            targetId={question.questionId}
            confirmText={actionCopy.confirmText}
            reasonPlaceholder={actionCopy.reasonPlaceholder}
            onCancel={() => setActionState(null)}
            onConfirm={handleConfirmReviewAction}
          />
        ) : null}
      </div>
    </>
  );
}
