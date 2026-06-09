import { useCallback, useEffect, useState } from 'react';

import { fetchAssessmentQuestionsSafe } from '../api/assessment-question-bank-service';
import type { AssessmentQuestion } from './assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';

export type UseAssessmentQuestionListResult = {
  state: AsyncState<AssessmentQuestion[]>;
  reload: () => void;
};

/**
 * Shared data source for the split question-bank pages (검수 / 문항 관리). Both
 * pages read the same Supabase `problems` (question_no 51-54) inventory and apply
 * their own status filter on top, so the fetch/abort/reload lifecycle lives here
 * once instead of being duplicated per page.
 */
export function useAssessmentQuestionList(): UseAssessmentQuestionListResult {
  const [state, setState] = useState<AsyncState<AssessmentQuestion[]>>({
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

    void fetchAssessmentQuestionsSafe(controller.signal).then((result) => {
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
