import reviewDocumentsJson from './fixtures/valid_questions_97items_2026-03-27.json';
import type {
  AssessmentQuestionReviewDocument,
  AssessmentQuestionSeed
} from './assessment-question-bank-types';

export const assessmentQuestionSeeds =
  reviewDocumentsJson as AssessmentQuestionSeed[];

const pinnedQuestionIdBySeedIndex: Record<number, string> = {
  0: 'AQ-54001',
  1: 'AQ-54002',
  2: 'AQ-51001',
  3: 'AQ-51002',
  4: 'AQ-52001',
  5: 'AQ-52002',
  6: 'AQ-53001',
  7: 'AQ-53002'
};

function formatGeneratedQuestionId(sequence: number): string {
  return `AQ-${String(53000 + sequence).padStart(5, '0')}`;
}

export const assessmentQuestionSeedEntries = (() => {
  let generatedQuestionSequence = 3;

  return assessmentQuestionSeeds.map((seed, seedIndex) => {
    const pinnedQuestionId = pinnedQuestionIdBySeedIndex[seedIndex];
    const questionId =
      pinnedQuestionId ?? formatGeneratedQuestionId(generatedQuestionSequence++);

    return {
      questionId,
      seedIndex,
      seed
    };
  });
})();

const questionSeedIndexByQuestionId: Record<string, number> = Object.fromEntries(
  assessmentQuestionSeedEntries.map(({ questionId, seedIndex }) => [
    questionId,
    seedIndex
  ])
);

const legacyQuestionSeedIndexByQuestionId: Record<string, number> = {
  'AQ-51001': 2,
  'AQ-51002': 3,
  'AQ-52001': 4,
  'AQ-52002': 5,
  'AQ-53001': 6,
  'AQ-53002': 7,
  'AQ-54001': 0,
  'AQ-54002': 1
};

export function getAssessmentQuestionSeed(questionId: string): AssessmentQuestionSeed | null {
  const seedIndex =
    questionSeedIndexByQuestionId[questionId] ??
    legacyQuestionSeedIndexByQuestionId[questionId];
  return assessmentQuestionSeeds[seedIndex] ?? null;
}

export function getAssessmentQuestionReviewFixture(
  questionId: string
): AssessmentQuestionReviewDocument | null {
  return getAssessmentQuestionSeed(questionId);
}

export function getAssessmentQuestionPromptText(questionId: string): string | null {
  return getAssessmentQuestionSeed(questionId)?.prompt_text ?? null;
}

export function getAssessmentQuestionRubric(
  questionId: string
): AssessmentQuestionReviewDocument['rubric'] | null {
  return getAssessmentQuestionSeed(questionId)?.rubric ?? null;
}
