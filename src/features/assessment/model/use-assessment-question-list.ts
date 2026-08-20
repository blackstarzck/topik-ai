import { useCallback } from 'react';

import { fetchAssessmentQuestionSummariesSafe } from '../api/assessment-question-bank-service';
import type { AssessmentQuestionSummary } from './assessment-question-bank-types';
import type { AsyncState } from '@/shared/model/async-state';
import { useAsyncResource } from '@/shared/model/use-async-resource';

export type UseAssessmentQuestionListResult = {
  state: AsyncState<AssessmentQuestionSummary[]>;
  reload: () => void;
};

/**
 * Shared data source for the split question-bank pages (문항 목록 / 문항 관리). Both
 * pages read the same summary inventory — P3 cutover: the recommendation view
 * (18 cols, 1 query) on the topik_writing canonical source and apply their own
 * status filter on top.
 */
export function useAssessmentQuestionList(): UseAssessmentQuestionListResult {
  const fetchSummaries = useCallback(
    (signal: AbortSignal) => fetchAssessmentQuestionSummariesSafe(signal),
    []
  );
  return useAsyncResource<AssessmentQuestionSummary[]>(fetchSummaries, {
    initialData: []
  });
}
