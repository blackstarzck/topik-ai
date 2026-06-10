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
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionDetailSafe,
  saveAssessmentQuestionReviewMemoSafe,
  updateAssessmentQuestionReviewSafe
} from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import {
  getReviewStatusColor,
  getReviewStatusLabel,
  getReviewWorkflowStatusColor,
  getReviewWorkflowStatusLabel,
  getServiceStatusColor,
  getServiceStatusLabel
} from '../model/assessment-question-bank-schema';
import {
  getQuestionLevelText,
  getQuestionTopicText
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentBlankMeta,
  AssessmentQuestionContent53,
  AssessmentQuestionDetail,
  AssessmentReviewAction
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
  action: AssessmentReviewAction;
} | null;

type ReviewActionCopy = {
  label: string;
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

type ReviewDescriptionItem = NonNullable<DescriptionsProps['items']>[number];

// D-2 검수 액션 → §3.3 저장값 사전. reason은 RPC `__note`로 감사 payload에 남는다.
const REVIEW_ACTION_COPY: Record<AssessmentReviewAction, ReviewActionCopy> = {
  approved: {
    label: '검수 완료',
    title: '검수 완료 처리',
    description:
      '이 문항을 검수 완료(approved)로 전환합니다. review_passed가 함께 기록되며, 저장된 검수 메모와 확인 사유는 감사 로그로 남습니다.',
    confirmText: '검수 완료',
    successMessage: '검수 완료 처리했습니다.',
    reasonPlaceholder: '검수 완료 사유를 입력해 주세요.'
  },
  on_hold: {
    label: '사용 보류',
    title: '사용 보류 처리',
    description:
      '이 문항을 사용 보류(on_hold)로 전환합니다. 추가 확인이 필요한 사유와 최신 검수 메모는 감사 로그로 남습니다.',
    confirmText: '사용 보류',
    successMessage: '사용 보류 처리했습니다.',
    reasonPlaceholder: '사용 보류 사유를 입력해 주세요.'
  },
  needs_revision: {
    label: '검수 필요',
    title: '검수 필요 처리',
    description:
      '이 문항을 검수 필요(needs_revision)로 전환합니다. 재생성 또는 수동 수정이 필요한 이유와 최신 검수 메모는 감사 로그로 남습니다.',
    confirmText: '검수 필요',
    successMessage: '검수 필요 처리했습니다.',
    reasonPlaceholder: '수정이 필요한 사유를 입력해 주세요.'
  }
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

function renderListItems(values: string[]): JSX.Element {
  if (values.length === 0) {
    return renderDescriptionParagraph('');
  }

  return (
    <ol className="assessment-review-page__ordered-list">
      {values.map((value) => (
        <li key={value}>
          <Text className="assessment-review-page__description-paragraph">
            {value}
          </Text>
        </li>
      ))}
    </ol>
  );
}

function renderTagList(values: string[]): JSX.Element {
  if (values.length === 0) {
    return renderDescriptionParagraph('');
  }

  return (
    <Space wrap size={[6, 6]}>
      {values.map((value) => (
        <Tag key={value}>{value}</Tag>
      ))}
    </Space>
  );
}

function buildQuestionBankListHref(search: string): string {
  const params = new URLSearchParams(search);

  params.delete('selected');
  params.delete('tab');

  const nextSearch = params.toString();
  return nextSearch ? `/assessment/question-bank?${nextSearch}` : '/assessment/question-bank';
}

function formatWordCount(min: number | null, max: number | null): string {
  if (min == null && max == null) {
    return '';
  }
  return `${min ?? '?'}~${max ?? '?'}자`;
}

function buildBlankItems(
  label: string,
  blank: AssessmentBlankMeta
): ReviewDescriptionItem[] {
  return [
    {
      key: `${label}-meta`,
      label: `빈칸 ${blank.position || label} (역할/기능/정답 유형)`,
      children: renderDescriptionParagraph(
        [blank.role, blank.blankFunction, blank.answerType].filter(Boolean).join(' / ')
      )
    },
    {
      key: `${label}-answers`,
      label: `빈칸 ${blank.position || label} 대표·허용 정답`,
      children: (
        <Space direction="vertical" size={4}>
          <Text strong>{getDisplayText(blank.canonicalAnswer)}</Text>
          {blank.acceptedAnswers.length > 0 ? renderTagList(blank.acceptedAnswers) : null}
        </Space>
      )
    }
  ];
}

function render53SourceData(content: AssessmentQuestionContent53): JSX.Element {
  if (content.sourceData == null) {
    // D-13: 1차 전환은 수치(JSONB)만 적재 — 자산 URL과 수치 모두 없으면 empty state.
    return renderDescriptionParagraph('');
  }

  return (
    <pre
      style={{
        margin: 0,
        maxHeight: 260,
        overflow: 'auto',
        fontSize: 12,
        background: 'rgba(0, 0, 0, 0.03)',
        padding: 8
      }}
    >
      {JSON.stringify(content.sourceData, null, 2)}
    </pre>
  );
}

function buildSharedDescriptionItems(
  question: AssessmentQuestionDetail
): ReviewDescriptionItem[] {
  const secondaryTopic = question.secondaryTopicMain
    ? `${question.secondaryTopicMain} / ${question.secondaryTopicDetail ?? ''}`
    : '';

  return [
    {
      key: 'questionNumber',
      label: '문항 번호',
      children: getDisplayText(`${question.questionNumber}번`)
    },
    {
      key: 'questionId',
      label: '문항 ID',
      children: getDisplayText(question.questionId)
    },
    {
      key: 'topicAxis',
      label: '주제(종합/세부)',
      children: getDisplayText(getQuestionTopicText(question))
    },
    {
      key: 'secondaryTopic',
      label: '보조 주제',
      children: getDisplayText(secondaryTopic)
    },
    {
      key: 'typeAndLevel',
      label: '유형 · 급수/난이도',
      children: getDisplayText(
        [question.questionTypeName, getQuestionLevelText(question)]
          .filter(Boolean)
          .join(' · ')
      )
    },
    {
      key: 'scenario',
      label: '시나리오 유형',
      children: getDisplayText(question.scenarioType)
    },
    {
      key: 'situationSummary',
      label: '상황 요약',
      span: 2,
      children: renderDescriptionParagraph(question.situationSummary)
    },
    {
      key: 'learningGoal',
      label: '학습 목표',
      span: 2,
      children: renderDescriptionParagraph(question.learningGoalSummary)
    },
    {
      key: 'promptText',
      label: '문항 본문',
      span: 2,
      children: (
        <div className="assessment-review-page__highlight-panel">
          {renderDescriptionParagraph(question.promptText)}
        </div>
      )
    }
  ];
}

function buildNumberSpecificItems(
  question: AssessmentQuestionDetail
): ReviewDescriptionItem[] {
  const { content } = question;

  if (content.kind === '51') {
    return [
      {
        key: 'resolvedText',
        label: '복원문(빈칸 채움)',
        span: 2,
        children: renderDescriptionParagraph(question.resolvedText)
      },
      ...buildBlankItems('ㄱ', content.blank1),
      ...buildBlankItems('ㄴ', content.blank2)
    ];
  }

  if (content.kind === '52') {
    return [
      {
        key: 'resolvedText',
        label: '복원문(빈칸 채움)',
        span: 2,
        children: renderDescriptionParagraph(question.resolvedText)
      },
      {
        key: 'completionUnit',
        label: '완성 단위 / 허용답안 범위',
        children: renderDescriptionParagraph(
          [content.completionUnit, content.answerScopeType].filter(Boolean).join(' / ')
        )
      },
      {
        key: 'connectionFunctions',
        label: '연결 기능(ㄱ) / 요구 표현 기능(ㄴ)',
        children: renderDescriptionParagraph(
          [content.connectionFunction, content.requiredExpressionFunction]
            .filter(Boolean)
            .join(' / ')
        )
      },
      {
        key: 'clueBefore',
        label: 'ㄱ 단서 문장',
        children: renderDescriptionParagraph(content.clueBeforeText)
      },
      {
        key: 'clueAfter',
        label: 'ㄴ 단서 문장',
        children: renderDescriptionParagraph(content.clueAfterText)
      },
      {
        key: 'canonicalAnswers',
        label: '대표 정답(ㄱ / ㄴ)',
        children: renderDescriptionParagraph(
          [content.blank1CanonicalAnswer, content.blank2CanonicalAnswer]
            .filter(Boolean)
            .join(' / ')
        )
      },
      {
        key: 'scoringNotes',
        label: '채점 주의',
        children: renderDescriptionParagraph(content.scoringNotes)
      }
    ];
  }

  if (content.kind === '53') {
    return [
      {
        key: 'dataMeta',
        label: '자료 유형 / 자료 주제',
        children: renderDescriptionParagraph(
          [content.dataType, content.dataTopic].filter(Boolean).join(' / ')
        )
      },
      {
        key: 'chartMeta',
        label: '차트 제목 / 단위',
        children: renderDescriptionParagraph(
          [content.chartTitle, content.chartUnit].filter(Boolean).join(' / ')
        )
      },
      {
        key: 'comparison',
        label: '비교 유형 / 변화 / 해석 난이도',
        children: renderDescriptionParagraph(
          [content.comparisonType, content.changeType, content.interpretationDifficulty]
            .filter(Boolean)
            .join(' / ')
        )
      },
      {
        key: 'wordCount',
        label: '글자 수',
        children: renderDescriptionParagraph(
          formatWordCount(content.wordCountMin, content.wordCountMax)
        )
      },
      {
        key: 'requiredStructure',
        label: '글 구성',
        children: renderTagList(content.requiredStructure)
      },
      {
        key: 'keyFindings',
        label: '핵심 발견',
        children: renderListItems(content.keyFindings)
      },
      {
        key: 'sourceData',
        label: '자료 수치(source_data)',
        span: 2,
        children: render53SourceData(content)
      },
      {
        key: 'scoringFocus',
        label: '채점 중점',
        span: 2,
        children: renderListItems(content.scoringFocus)
      }
    ];
  }

  return [
    {
      key: 'essayMeta',
      label: '글쓰기 유형 / 쟁점',
      children: renderDescriptionParagraph(
        [content.essayType, content.issueTopic].filter(Boolean).join(' / ')
      )
    },
    {
      key: 'stance',
      label: '관점 요구 / 추론 패턴',
      children: renderDescriptionParagraph(
        [content.stanceRequirement, content.reasoningPattern].filter(Boolean).join(' / ')
      )
    },
    {
      key: 'promptQuestions',
      label: '문항 질문',
      span: 2,
      children: renderListItems(content.promptQuestions)
    },
    {
      key: 'wordCount',
      label: '글자 수',
      children: renderDescriptionParagraph(
        formatWordCount(content.wordCountMin, content.wordCountMax)
      )
    },
    {
      key: 'requiredStructure',
      label: '글 구성',
      children: renderTagList(content.requiredStructure)
    },
    {
      key: 'argumentKeywords',
      label: '근거 키워드',
      children: renderTagList(content.argumentKeywords)
    },
    {
      key: 'prohibitedElements',
      label: '금지 요소',
      children: renderTagList(content.prohibitedElements)
    },
    {
      key: 'scoringFocus',
      label: '채점 중점',
      span: 2,
      children: renderListItems(content.scoringFocus)
    }
  ];
}

function buildCommonTailItems(
  question: AssessmentQuestionDetail
): ReviewDescriptionItem[] {
  return [
    {
      key: 'modelAnswer',
      label: '모범답안',
      span: 2,
      children: renderDescriptionParagraph(question.modelAnswer)
    },
    {
      key: 'autoChecks',
      label: '자동 검증(auto_checks_passed)',
      children: getDisplayText(
        question.autoChecksPassed == null
          ? ''
          : question.autoChecksPassed
            ? '통과'
            : '실패'
      )
    },
    {
      key: 'recommendationKeys',
      label: '추천 키',
      children: renderTagList(question.recommendationKeys)
    }
  ];
}

function buildReviewDescriptionItems(
  question: AssessmentQuestionDetail
): ReviewDescriptionItem[] {
  return [
    ...buildSharedDescriptionItems(question),
    ...buildNumberSpecificItems(question),
    ...buildCommonTailItems(question)
  ];
}

export default function AssessmentQuestionReviewPage(): JSX.Element {
  const { questionId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questionState, setQuestionState] = useState<AsyncState<AssessmentQuestionDetail | null>>({
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

    void fetchAssessmentQuestionDetailSafe(questionId, controller.signal).then((result) => {
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
      setReviewMemoDraft(result.data.contentTeamMemo);
    });

    return () => {
      controller.abort();
    };
  }, [questionId, reloadKey]);

  const question = questionState.data;
  const hasUnsavedReviewMemo = Boolean(
    question && reviewMemoDraft !== question.contentTeamMemo
  );
  const backHref = buildQuestionBankListHref(location.search);
  const actionCopy = actionState ? REVIEW_ACTION_COPY[actionState.action] : null;
  const descriptionColumn = screens.lg ? 2 : 1;

  const syncQuestion = useCallback((updatedQuestion: AssessmentQuestionDetail) => {
    setQuestionState({
      status: 'success',
      data: updatedQuestion,
      errorMessage: null,
      errorCode: null
    });
    setReviewMemoDraft(updatedQuestion.contentTeamMemo);
  }, []);

  const handleSaveReviewMemo = useCallback(async (): Promise<boolean> => {
    if (!question) {
      return false;
    }

    const nextReviewMemo = reviewMemoDraft.trim();

    setIsSavingReviewMemo(true);
    const result = await saveAssessmentQuestionReviewMemoSafe({
      questionId: question.questionId,
      memo: nextReviewMemo
    });
    setIsSavingReviewMemo(false);

    if (!result.ok) {
      notificationApi.error({
        message: '검수 메모를 저장하지 못했습니다.',
        description: result.error.message
      });
      return false;
    }

    syncQuestion(result.data);
    return true;
  }, [notificationApi, question, reviewMemoDraft, syncQuestion]);

  const handleRequestReviewAction = useCallback(
    async (action: AssessmentReviewAction) => {
      if (!question) {
        return;
      }

      if (!reviewMemoDraft.trim()) {
        notificationApi.warning({
          message: '검수 메모를 먼저 입력해 주세요.',
          description:
            '검수 상태를 변경하기 전에 문항 적합성 판단과 확인 사유를 검수 메모에 남겨야 합니다.'
        });
        return;
      }

      if (hasUnsavedReviewMemo) {
        const saved = await handleSaveReviewMemo();
        if (!saved) {
          return;
        }
      }

      setActionState({ action });
    },
    [
      handleSaveReviewMemo,
      hasUnsavedReviewMemo,
      notificationApi,
      question,
      reviewMemoDraft
    ]
  );

  const handleConfirmReviewAction = useCallback(
    async (reason: string) => {
      if (!question || !actionState) {
        return;
      }

      const result = await updateAssessmentQuestionReviewSafe({
        questionId: question.questionId,
        action: actionState.action,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '검수 상태를 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      const successMessage = REVIEW_ACTION_COPY[actionState.action].successMessage;
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
          {questionBankDataSource === 'mock' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="모크 모드로 동작 중입니다."
              description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터·감사 로그에는 기록되지 않습니다."
            />
          ) : null}

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
                    items={buildReviewDescriptionItems(question)}
                  />
                </div>
              </div>

              <div className="assessment-review-page__side">
                <Card
                  className="assessment-review-page__memo-card"
                  title="검수 메모"
                >
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <Space
                      wrap
                      size={8}
                      className="assessment-review-page__description-meta"
                    >
                      <Tag color={getReviewStatusColor(question.reviewStatus)}>
                        {getReviewStatusLabel(question.reviewStatus)}
                      </Tag>
                      <Tag
                        color={getReviewWorkflowStatusColor(
                          question.reviewWorkflowStatus
                        )}
                      >
                        진행: {getReviewWorkflowStatusLabel(question.reviewWorkflowStatus)}
                      </Tag>
                      <Tag color={getServiceStatusColor(question.serviceStatus)}>
                        노출: {getServiceStatusLabel(question.serviceStatus)}
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
                        ? '저장하지 않은 검수 메모가 있습니다. 검수 상태 변경 시 함께 저장됩니다.'
                        : '검수 메모는 content_team_memo로 영속 저장되며 감사 로그에도 남습니다.'}
                    </Text>
                    <Button
                      size="large"
                      block
                      onClick={() => void handleSaveReviewMemo()}
                      loading={isSavingReviewMemo}
                      disabled={!hasUnsavedReviewMemo}
                    >
                      메모 저장
                    </Button>
                    <Space
                      direction="vertical"
                      size={8}
                      style={{ width: '100%' }}
                    >
                      <Button
                        size="large"
                        type="primary"
                        block
                        onClick={() => handleRequestReviewAction('approved')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        검수 완료
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => handleRequestReviewAction('on_hold')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        사용 보류
                      </Button>
                      <Button
                        size="large"
                        block
                        onClick={() => handleRequestReviewAction('needs_revision')}
                        loading={isSavingReviewMemo}
                        disabled={!reviewMemoDraft.trim()}
                      >
                        검수 필요
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
