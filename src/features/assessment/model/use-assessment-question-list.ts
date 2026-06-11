import { useCallback, useEffect, useState } from 'react';

import { fetchAssessmentQuestionSummariesSafe } from '../api/assessment-question-bank-service';
import type { AssessmentQuestionSummary } from './assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';

export type UseAssessmentQuestionListResult = {
  state: AsyncState<AssessmentQuestionSummary[]>;
  reload: () => void;
};

/**
 * Shared data source for the split question-bank pages (문항 목록 / 문항 관리). Both
 * pages read the same summary inventory — P3 cutover: the recommendation view
 * (18 cols, 1 query) on the topik_writing source, `problems` on the sealed
 * legacy source — and apply their own status filter on top.
 */
export function useAssessmentQuestionList(): UseAssessmentQuestionListResult {
  const [state, setState] = useState<AsyncState<AssessmentQuestionSummary[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionSummariesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error.message,
          errorCode: result.error.code
        }));
        return;
      }

      setState({
        status: result.data.length === 0 ? 'empty' : 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return { state, reload };
}
