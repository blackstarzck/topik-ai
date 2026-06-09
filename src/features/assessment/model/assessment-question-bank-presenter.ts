import type {
  AssessmentQuestion,
  AssessmentQuestionDifficulty,
  AssessmentQuestionDomain,
  AssessmentQuestionNumber,
  AssessmentQuestionTypeLabel
} from './assessment-question-bank-types';

export function getQuestionText(question: AssessmentQuestion): string {
  return question.questionText;
}

export function getQuestionUsageSummary(question: AssessmentQuestion): string {
  return `사용 ${question.usageCount}회 / 시험 연결 ${question.linkedExamCount}건`;
}

export function getQuestionInstructionLabel(question: AssessmentQuestion): string {
  if (question.content.kind === '53' || question.content.kind === '54') {
    return '지시문';
  }

  return '문항 지시문';
}

export function getQuestionInstructionText(question: AssessmentQuestion): string {
  if (question.content.kind === '51' || question.content.kind === '52') {
    return `${question.content.instruction} ${question.content.learnerPrompt}`;
  }

  return question.content.learnerPrompt;
}

export function getQuestionSourceSummary(question: AssessmentQuestion): string {
  return `${question.sourceType} · ${question.generationBatchId} · ${question.generationModel} · ${question.promptVersion}`;
}

export function buildAssessmentQuestionSearchText(
  question: AssessmentQuestion
): string {
  return [
    question.questionId,
    question.topic,
    question.domain,
    question.questionTypeLabel,
    question.difficultyLevel,
    question.generationBatchId,
    question.promptVersion,
    question.coreMeaning,
    question.keyIssue,
    question.reviewMemo,
    question.managementNote,
    getQuestionText(question)
  ]
    .join(' ')
    .toLowerCase();
}

export type CommonQuestionFilter = {
  domain: AssessmentQuestionDomain | null;
  questionType: AssessmentQuestionTypeLabel | null;
  difficulty: AssessmentQuestionDifficulty | null;
  keyword: string;
};

export function filterQuestionsByNumbers(
  questions: AssessmentQuestion[],
  activeQuestionNumbers: AssessmentQuestionNumber[]
): AssessmentQuestion[] {
  return questions.filter((question) =>
    activeQuestionNumbers.includes(question.questionNumber)
  );
}

export function applyCommonQuestionFilters(
  questions: AssessmentQuestion[],
  filter: CommonQuestionFilter
): AssessmentQuestion[] {
  const normalizedKeyword = filter.keyword.trim().toLowerCase();

  return questions.filter((question) => {
    if (filter.domain && question.domain !== filter.domain) {
      return false;
    }

    if (filter.questionType && question.questionTypeLabel !== filter.questionType) {
      return false;
    }

    if (filter.difficulty && question.difficultyLevel !== filter.difficulty) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    return buildAssessmentQuestionSearchText(question).includes(normalizedKeyword);
  });
}
