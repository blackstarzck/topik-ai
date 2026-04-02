import { create } from 'zustand';

import assessmentQuestionDocuments from './assessment-question-bank-documents.json';
import type {
  AssessmentQuestion,
  AssessmentQuestionAuditAction,
  AssessmentQuestionAuditEvent
} from './assessment-question-bank-types';

const CURRENT_ACTOR = 'admin_current';

type UpdateReviewPassedPayload = {
  questionId: string;
  nextValue: boolean;
  reason: string;
};

type UpdateReviewMemoPayload = {
  questionId: string;
  reviewMemo: string;
};

type AssessmentQuestionBankStore = {
  questions: AssessmentQuestion[];
  audits: AssessmentQuestionAuditEvent[];
  updateReviewPassed: (
    payload: UpdateReviewPassedPayload
  ) => AssessmentQuestion | null;
  updateReviewMemo: (
    payload: UpdateReviewMemoPayload
  ) => AssessmentQuestion | null;
};

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function createAuditId(audits: AssessmentQuestionAuditEvent[]): string {
  const nextSequence =
    audits
      .map((audit) => Number(audit.id.replace('ASQ-AUD-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `ASQ-AUD-${String(nextSequence).padStart(4, '0')}`;
}

function mapReviewPassedAction(
  nextValue: boolean
): AssessmentQuestionAuditAction {
  return nextValue ? 'review_passed_marked' : 'review_passed_unmarked';
}

const initialQuestions = (
  assessmentQuestionDocuments as AssessmentQuestion[]
).map((question) => structuredClone(question));

export const useAssessmentQuestionBankStore = create<AssessmentQuestionBankStore>(
  (set) => ({
    questions: initialQuestions,
    audits: [],
    updateReviewPassed: ({ questionId, nextValue, reason }) => {
      let updatedQuestion: AssessmentQuestion | null = null;

      set((state) => {
        const nextQuestions = state.questions.map((question) => {
          if (question.id !== questionId) {
            return question;
          }

          updatedQuestion = {
            ...question,
            review_passed: nextValue
          };

          return updatedQuestion;
        });

        if (!updatedQuestion) {
          return state;
        }

        const audit: AssessmentQuestionAuditEvent = {
          id: createAuditId(state.audits),
          targetType: 'AssessmentQuestion',
          targetId: questionId,
          action: mapReviewPassedAction(nextValue),
          reason,
          changedBy: CURRENT_ACTOR,
          createdAt: formatNow()
        };

        return {
          questions: nextQuestions,
          audits: [audit, ...state.audits]
        };
      });

      return updatedQuestion;
    },
    updateReviewMemo: ({ questionId, reviewMemo }) => {
      let updatedQuestion: AssessmentQuestion | null = null;

      set((state) => {
        const nextQuestions = state.questions.map((question) => {
          if (question.id !== questionId) {
            return question;
          }

          updatedQuestion = {
            ...question,
            review_memo: reviewMemo
          };

          return updatedQuestion;
        });

        if (!updatedQuestion) {
          return state;
        }

        const audit: AssessmentQuestionAuditEvent = {
          id: createAuditId(state.audits),
          targetType: 'AssessmentQuestion',
          targetId: questionId,
          action: 'review_memo_saved',
          reason: reviewMemo,
          changedBy: CURRENT_ACTOR,
          createdAt: formatNow()
        };

        return {
          questions: nextQuestions,
          audits: [audit, ...state.audits]
        };
      });

      return updatedQuestion;
    }
  })
);
