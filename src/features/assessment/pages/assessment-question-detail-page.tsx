import { Alert, Button, Card, Descriptions, Empty, Grid, Space, Tag, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { fetchAssessmentQuestionDetailSafe } from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import {
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
  AssessmentQuestionDetail
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { SourceDataCharts } from '../ui/source-data-chart';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * TOPIK 쓰기 문항 상세 — 조회 전용 (인바운드 모델, 결정 기록 §0).
 * 수신·적재된 문항의 번호별 실메타데이터를 열람한다. 관리 포인트(태그·노출
 * 통제)는 /manage 페이지 담당이며, 이 페이지에 쓰기 액션은 없다.
 */

type DetailDescriptionItem = NonNullable<DescriptionsProps['items']>[number];

function getDisplayText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '-';
}

function renderDescriptionParagraph(value: string | null | undefined): JSX.Element {
  return (
    <Paragraph className="assessment-detail-page__description-paragraph">
      {getDisplayText(value)}
    </Paragraph>
  );
}

function renderListItems(values: string[]): JSX.Element {
  if (values.length === 0) {
    return renderDescriptionParagraph('');
  }

  return (
    <ol className="assessment-detail-page__ordered-list">
      {values.map((value) => (
        <li key={value}>
          <Text className="assessment-detail-page__description-paragraph">
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
): DetailDescriptionItem[] {
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

  // 자료 수치(JSONB)를 차트로 시각화한다. 차트로 해석되지 않는 형태는 컴포넌트가
  // 원본 JSON으로 폴백한다.
  return <SourceDataCharts sourceData={content.sourceData} />;
}

function buildSharedDescriptionItems(
  question: AssessmentQuestionDetail
): DetailDescriptionItem[] {
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
        <div className="assessment-detail-page__highlight-panel">
          {renderDescriptionParagraph(question.promptText)}
        </div>
      )
    }
  ];
}

function buildNumberSpecificItems(
  question: AssessmentQuestionDetail
): DetailDescriptionItem[] {
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
): DetailDescriptionItem[] {
  return [
    {
      key: 'modelAnswer',
      label: '모범답안',
      span: 2,
      children: renderDescriptionParagraph(question.modelAnswer)
    },
    {
      key: 'autoChecks',
      label: '수신 정합 검사(auto_checks_passed)',
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

function buildDetailDescriptionItems(
  question: AssessmentQuestionDetail
): DetailDescriptionItem[] {
  return [
    ...buildSharedDescriptionItems(question),
    ...buildNumberSpecificItems(question),
    ...buildCommonTailItems(question)
  ];
}

export default function AssessmentQuestionDetailPage(): JSX.Element {
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
    });

    return () => {
      controller.abort();
    };
  }, [questionId, reloadKey]);

  const question = questionState.data;
  const backHref = buildQuestionBankListHref(location.search);
  const descriptionColumn = screens.lg ? 2 : 1;

  const pageTitle = question
    ? `TOPIK ${question.questionNumber}번 문항 상세`
    : '문항 상세';

  return (
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
            message="문항을 불러오지 못했습니다."
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
            message="문항 상세 데이터를 불러오는 중입니다."
          />
        ) : null}

        {questionState.status === 'error' ? (
          <Empty
            description="문항 상세를 불러오지 못했습니다."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : null}

        {question ? (
          <div className="assessment-detail-page">
            <div className="assessment-detail-page__header-actions">
              <Button size="large" onClick={() => navigate(backHref)}>
                목록으로 돌아가기
              </Button>
            </div>

            <div className="assessment-detail-page__main">
              <div className="assessment-detail-page__document">
                <Descriptions
                  bordered
                  size="small"
                  column={descriptionColumn}
                  className="assessment-detail-page__descriptions"
                  items={buildDetailDescriptionItems(question)}
                />
              </div>
            </div>

            <div className="assessment-detail-page__side">
              <Card className="assessment-detail-page__memo-card" title="문항 상태">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <Space
                    wrap
                    size={8}
                    className="assessment-detail-page__description-meta"
                  >
                    <Tag color={getServiceStatusColor(question.serviceStatus)}>
                      노출: {getServiceStatusLabel(question.serviceStatus)}
                    </Tag>
                  </Space>
                  <Text type="secondary">
                    이 페이지는 조회 전용입니다. 태그 부여/제거와 노출 상태 변경은
                    문항 관리 페이지에서 수행합니다.
                  </Text>
                  {question.contentTeamMemo ? (
                    <div>
                      <Text strong>콘텐츠팀 메모(수신 메타데이터)</Text>
                      <Paragraph className="assessment-detail-page__description-paragraph">
                        {question.contentTeamMemo}
                      </Paragraph>
                    </div>
                  ) : null}
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
    </div>
  );
}
