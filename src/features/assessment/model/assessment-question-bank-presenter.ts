import type {
  AssessmentQuestion,
  AssessmentQuestionEditHistoryItem
} from './assessment-question-bank-types';

export function getQuestionTitle(question: AssessmentQuestion): string {
  return question.approved_topic_seed.topic_seed_title;
}

export function getQuestionPreviewText(question: AssessmentQuestion): string {
  return question.prompt_text;
}

export function getQuestionWorkflowStatus(question: AssessmentQuestion): string {
  return question.review_workflow.final_question.status;
}

export function getLatestEditEntry(
  question: AssessmentQuestion
): AssessmentQuestionEditHistoryItem | null {
  return question.edit_history.length > 0
    ? question.edit_history[question.edit_history.length - 1]
    : null;
}

export function getLatestEditedAt(question: AssessmentQuestion): string {
  return getLatestEditEntry(question)?.edited_at ?? question.created_at;
}

export function getLatestEditedBy(question: AssessmentQuestion): string {
  return getLatestEditEntry(question)?.edited_by ?? '-';
}

export function buildAssessmentQuestionSearchText(
  question: AssessmentQuestion
): string {
  return [
    question.id,
    question.meta.domain,
    question.meta.question_type,
    String(question.meta.difficulty),
    getQuestionTitle(question),
    question.prompt_text,
    question.review_memo,
    question.context_notes.row1_value,
    question.context_notes.row2_value,
    question.approved_topic_seed.shared_context,
    question.approved_topic_seed.why_exam_worthy,
    question.edit_history.map((item) => item.summary).join(' ')
  ]
    .join(' ')
    .toLowerCase();
}
