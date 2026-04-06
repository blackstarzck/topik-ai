import type { AssessmentQuestion } from './assessment-question-bank-types';

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
