import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Input,
  Space,
  Tag,
  Timeline,
  Typography,
  notification
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionSafe,
  updateAssessmentQuestionReviewMemoSafe,
  updateAssessmentQuestionReviewStatusSafe
} from '../api/assessment-question-bank-service';
import {
  getReviewStatusColor,
  getValidationStatusColor
} from '../model/assessment-question-bank-schema';
import {
  getQuestionInstructionLabel,
  getQuestionInstructionText,
  getQuestionSourceSummary,
  getQuestionUsageSummary
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
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

type ReviewActionState = {
  nextStatus: AssessmentQuestionReviewStatus;
} | null;

type ReviewActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

function getReviewActionCopy(
  nextStatus: AssessmentQuestionReviewStatus
): ReviewActionCopy {
  if (nextStatus === '검수 완료') {
    return {
      title: '검수 완료 처리',
      description:
        '이 문항을 검수 완료로 전환합니다. 저장된 검수 메모와 확인 사유는 감사 로그로 남습니다.',
      confirmText: '검수 완료',
      successMessage: '검수 완료 처리되었습니다.',
      reasonPlaceholder: '검수 완료 근거를 입력해 주세요.'
    };
  }

  if (nextStatus === '보류') {
    return {
      title: '보류 처리',
      description:
        '이 문항을 보류 상태로 전환합니다. 후속 재검토를 위해 사유를 남겨야 합니다.',
      confirmText: '보류',
      successMessage: '보류 처리되었습니다.',
      reasonPlaceholder: '보류 사유를 입력해 주세요.'
    };
  }

  return {
    title: '수정 필요 처리',
    description:
      '이 문항을 수정 필요 상태로 전환합니다. 핵심 문제를 기준으로 수정 사유를 남겨야 합니다.',
    confirmText: '수정 필요',
    successMessage: '수정 필요 처리되었습니다.',
    reasonPlaceholder: '수정 필요 사유를 입력해 주세요.'
  };
}

function buildQuestionBankListHref(
  search: string,
  question: AssessmentQuestion | null
): string {
  const params = new URLSearchParams(search);

  params.delete('selected');

  if (!params.get('tab')) {
    params.set('tab', 'review');
  }

  if (question && !params.get('questionNo')) {
    params.set('questionNo', question.questionNumber);
  }

  const nextSearch = params.toString();
  return nextSearch ? `/assessment/question-bank?${nextSearch}` : '/assessment/question-bank';
}

function renderQuestionSpecificReviewBlock(
  question: AssessmentQuestion
): JSX.Element {
  if (question.content.kind === '51' || question.content.kind === '52') {
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'choices',
            label: '보기',
            children: (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {question.content.choices.map((choice) => (
                  <li key={choice}>
                    <Text>{choice}</Text>
                  </li>
                ))}
              </ol>
            )
          },
          {
            key: 'answer',
            label: '정답',
            children: question.content.answer
          }
        ]}
      />
    );
  }

  if (question.content.kind === '53') {
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'chartTitle',
            label: '자료 제목',
            children: question.content.chartTitle
          },
          {
            key: 'sourceSummary',
            label: '자료 설명',
            children: question.content.sourceSummary
          },
          {
            key: 'keyFigures',
            label: '핵심 수치',
            children: (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {question.content.keyFigures.map((figure) => (
                  <li key={figure}>{figure}</li>
                ))}
              </ul>
            )
          }
        ]}
      />
    );
  }

  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      items={[
        {
          key: 'topicPrompt',
          label: '논제',
          children: question.content.topicPrompt
        },
        {
          key: 'conditionLines',
          label: '조건 줄',
          children: (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {question.content.conditionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )
        },
        {
          key: 'outlineGuide',
          label: '개요 가이드',
          children: question.content.outlineGuide
        }
      ]}
    />
  );
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
  const backHref = buildQuestionBankListHref(location.search, question);
  const actionCopy = actionState ? getReviewActionCopy(actionState.nextStatus) : null;

  const syncQuestion = useCallback((updatedQuestion: AssessmentQuestion) => {
    setQuestionState({
      status: 'success',
      data: updatedQuestion,
      errorMessage: null,
      errorCode: null
    });
    setReviewMemoDraft(updatedQuestion.reviewMemo);
  }, []);

  const handleSaveReviewMemo = useCallback(async () => {
    if (!question) {
      return;
    }

    const nextReviewMemo = reviewMemoDraft.trim();

    if (!nextReviewMemo) {
      notificationApi.warning({
        message: '검수 메모를 먼저 입력하세요.',
        description:
          '검수 상태를 변경하기 전에 판단 근거와 수정 포인트를 검수 메모에 저장해야 합니다.'
      });
      return;
    }

    if (!hasUnsavedReviewMemo) {
      return;
    }

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
    notificationApi.success({
      message: '검수 메모를 저장했습니다.',
      description: (
        <Space direction="vertical" size={4}>
          <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
          <Text>대상 ID: {result.data.questionId}</Text>
          <Text>저장 메모: {nextReviewMemo}</Text>
          <AuditLogLink
            targetType="AssessmentQuestion"
            targetId={result.data.questionId}
          />
        </Space>
      )
    });
  }, [
    hasUnsavedReviewMemo,
    notificationApi,
    question,
    reviewMemoDraft,
    syncQuestion
  ]);

  const openReviewAction = useCallback(
    (nextStatus: AssessmentQuestionReviewStatus) => {
      if (!question) {
        return;
      }

      if (hasUnsavedReviewMemo) {
        notificationApi.warning({
          message: '검수 메모를 저장한 뒤 상태를 변경하세요.',
          description:
            '현재 페이지에서 수정한 검수 메모가 아직 저장되지 않았습니다. 메모를 저장한 뒤 검수 상태를 변경해 주세요.'
        });
        return;
      }

      if (!question.reviewMemo.trim()) {
        notificationApi.warning({
          message: '검수 메모 없이 상태를 변경할 수 없습니다.',
          description:
            '검수는 검수 메모를 기준으로 진행합니다. 먼저 검수 메모를 입력하고 저장해 주세요.'
        });
        return;
      }

      setActionState({ nextStatus });
    },
    [hasUnsavedReviewMemo, notificationApi, question]
  );

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

      const successMessage = getReviewActionCopy(actionState.nextStatus).successMessage;
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
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          문항 카드 안에서 지시문, 출처, 핵심 의미, 핵심 문제를 한 번에 검토하고,
          우측 패널에서 검수 메모 저장과 상태 결정을 진행합니다.
        </Paragraph>

        <div className="assessment-review-page__header-actions">
          <Button size="large" onClick={() => navigate(backHref)}>
            목록으로 돌아가기
          </Button>
        </div>

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

          {question ? (
            <div className="assessment-review-page">
              <Card
                className="assessment-review-page__question-card"
                title={
                  <Space align="center" size={12} wrap>
                    <Text strong>{question.questionId}</Text>
                    <Tag color="blue">TOPIK {question.questionNumber}번</Tag>
                    <Tag>{question.domain}</Tag>
                    <Tag>{question.questionTypeLabel}</Tag>
                    <Tag>{question.difficultyLevel}</Tag>
                  </Space>
                }
                extra={
                  <Space size={8} wrap>
                    <Tag color={getReviewStatusColor(question.reviewStatus)}>
                      {question.reviewStatus}
                    </Tag>
                    <Tag color={getValidationStatusColor(question.validationStatus)}>
                      {question.validationStatus}
                    </Tag>
                  </Space>
                }
              >
                <Space direction="vertical" size={20} style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message="검수 카드"
                    description="지시문과 핵심 정보, 모범답안, 채점 기준, 수정 히스토리를 한 카드 안에서 연속으로 검토합니다."
                  />

                  <div className="assessment-review-page__field">
                    <Text strong>{getQuestionInstructionLabel(question)}</Text>
                    <Paragraph className="assessment-review-page__instruction">
                      {getQuestionInstructionText(question)}
                    </Paragraph>
                  </div>

                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'source',
                        label: '출처',
                        children: getQuestionSourceSummary(question)
                      },
                      {
                        key: 'coreMeaning',
                        label: '핵심 의미',
                        children: question.coreMeaning
                      },
                      {
                        key: 'keyIssue',
                        label: '핵심 문제',
                        children: question.keyIssue
                      }
                    ]}
                  />

                  {renderQuestionSpecificReviewBlock(question)}

                  <Collapse
                    className="assessment-review-page__collapse"
                    items={[
                      {
                        key: 'model-answer',
                        label: '모범답안 보기',
                        children: (
                          <Paragraph style={{ marginBottom: 0 }}>
                            {question.modelAnswer}
                          </Paragraph>
                        )
                      },
                      {
                        key: 'scoring-criteria',
                        label: '채점 기준',
                        children: (
                          <ul className="assessment-review-page__list">
                            {question.scoringCriteria.map((criterion) => (
                              <li key={criterion}>{criterion}</li>
                            ))}
                          </ul>
                        )
                      },
                      {
                        key: 'revision-history',
                        label: '수정 히스토리',
                        children: (
                          <Timeline
                            items={question.revisionHistory.map((item) => ({
                              children: (
                                <Space direction="vertical" size={2}>
                                  <Text strong>{item.summary}</Text>
                                  <Text type="secondary">
                                    {item.changedAt} · {item.changedBy}
                                  </Text>
                                </Space>
                              )
                            }))}
                          />
                        )
                      }
                    ]}
                  />
                </Space>
              </Card>

              <div className="assessment-review-page__side">
                <Card
                  className="assessment-review-page__memo-card"
                  title="검수 메모"
                  extra={
                    <Text type="secondary">검수자 {question.reviewerName}</Text>
                  }
                >
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Text type="secondary">
                      검수 판단 근거와 수정 포인트를 먼저 저장한 뒤 상태를 결정합니다.
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
                        ? '저장되지 않은 변경사항이 있습니다.'
                        : '저장된 메모가 상태 변경의 기준으로 사용됩니다.'}
                    </Text>
                    <Button
                      type="primary"
                      size="large"
                      onClick={handleSaveReviewMemo}
                      loading={isSavingReviewMemo}
                      disabled={!reviewMemoDraft.trim() || !hasUnsavedReviewMemo}
                    >
                      검수 메모 저장
                    </Button>
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: 'usage',
                          label: '사용 현황',
                          children: getQuestionUsageSummary(question)
                        },
                        {
                          key: 'managementNote',
                          label: '운영 메모',
                          children: question.managementNote || '등록된 운영 메모가 없습니다.'
                        }
                      ]}
                    />
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Button
                        size="large"
                        onClick={() => openReviewAction('보류')}
                        disabled={hasUnsavedReviewMemo || !question.reviewMemo.trim()}
                      >
                        보류
                      </Button>
                      <Button
                        type="primary"
                        size="large"
                        onClick={() => openReviewAction('검수 완료')}
                        disabled={hasUnsavedReviewMemo || !question.reviewMemo.trim()}
                      >
                        검수 완료
                      </Button>
                      <Button
                        danger
                        size="large"
                        onClick={() => openReviewAction('수정 필요')}
                        disabled={hasUnsavedReviewMemo || !question.reviewMemo.trim()}
                      >
                        수정 필요
                      </Button>
                    </Space>
                    <AuditLogLink
                      targetType="AssessmentQuestion"
                      targetId={question.questionId}
                    />
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
