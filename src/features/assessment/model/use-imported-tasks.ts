import { useCallback } from 'react';

import { fetchImportedTasksSafe } from '../api/imported-tasks-service';
import type { ImportedWritingTask } from './imported-task-types';
import type { AsyncState } from '@/shared/model/async-state';
import { useAsyncResource } from '@/shared/model/use-async-resource';

export type UseImportedTasksResult = {
  state: AsyncState<ImportedWritingTask[]>;
  reload: () => void;
};

/** 가져온 문항(인박스) 목록 로더 — 인박스 테이블 is_latest 행을 1회 조회한다. */
export function useImportedTasks(): UseImportedTasksResult {
  const fetchTasks = useCallback(
    (signal: AbortSignal) => fetchImportedTasksSafe(signal),
    []
  );
  return useAsyncResource<ImportedWritingTask[]>(fetchTasks, { initialData: [] });
}
