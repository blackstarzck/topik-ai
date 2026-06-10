import { getReviewStatusLabel, getServiceStatusLabel } from './assessment-question-bank-schema';
import type {
  AssessmentQuestionNumber,
  AssessmentQuestionSummary
} from './assessment-question-bank-types';

export function getQuestionTopicText(question: AssessmentQuestionSummary): string {
  return question.topicDetail
    ? `${question.topicMain} / ${question.topicDetail}`
    : question.topicMain;
}

export function getQuestionLevelText(question: AssessmentQuestionSummary): string {
  const difficulty =
    question.difficultyLevel == null ? '' : `난이도 ${question.difficultyLevel}`;
  return [question.targetLevel, difficulty].filter(Boolean).join(' · ');
}

/**
 * §7.2: 검색 텍스트 축 교체 — scenario_type/situation_summary/recommendation_keys를
 * 포함하고 sentinel 전용 필드(coreMeaning 등)는 제거한다(뷰 확장 컬럼 E4 전제).
 */
export function buildAssessmentQuestionSearchText(
  question: AssessmentQuestionSummary
): string {
  return [
    question.questionId,
    question.topicMain,
    question.topicDetail,
    question.questionTypeName,
    question.targetLevel,
    question.scenarioType,
    question.situationSummary,
    question.recommendationKeys.join(' '),
    question.contentTeamMemo,
    getReviewStatusLabel(question.reviewStatus),
    getServiceStatusLabel(question.serviceStatus)
  ]
    .join(' ')
    .toLowerCase();
}

export type CommonQuestionFilter = {
  topicMain: string | null;
  topicDetail: string | null;
  questionType: string | null;
  difficulty: number | null;
  keyword: string;
};

export function filterQuestionsByNumbers<T extends AssessmentQuestionSummary>(
  questions: T[],
  activeQuestionNumbers: AssessmentQuestionNumber[]
): T[] {
  return questions.filter((question) =>
    activeQuestionNumbers.includes(question.questionNumber)
  );
}

export function applyCommonQuestionFilters<T extends AssessmentQuestionSummary>(
  questions: T[],
  filter: CommonQuestionFilter
): T[] {
  const normalizedKeyword = filter.keyword.trim().toLowerCase();

  return questions.filter((question) => {
    if (filter.topicMain && question.topicMain !== filter.topicMain) {
      return false;
    }

    if (filter.topicDetail && question.topicDetail !== filter.topicDetail) {
      return false;
    }

    if (filter.questionType && question.questionTypeName !== filter.questionType) {
      return false;
    }

    if (filter.difficulty != null && question.difficultyLevel !== filter.difficulty) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    return buildAssessmentQuestionSearchText(question).includes(normalizedKeyword);
  });
}
