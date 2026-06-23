import { useCallback, useEffect, useState } from 'react';

import { fetchImportedTasksSafe } from '../api/imported-tasks-service';
import type { ImportedWritingTask } from './imported-task-types';
import type { AsyncState } from '../../../shared/model/async-state';

export type UseImportedTasksResult = {
  state: AsyncState<ImportedWritingTask[]>;
  reload: () => void;
};

/** 가져온 문항(인박스) 목록 로더 — 인박스 테이블 is_latest 행을 1회 조회한다. */
export function useImportedTasks(): UseImportedTasksResult {
  const [state, setState] = useState<AsyncState<ImportedWritingTask[]>>({
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

    void fetchImportedTasksSafe(controller.signal).then((result) => {
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
