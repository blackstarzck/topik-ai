import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import {
  deleteMockSystemReport,
  loadMockSystemReports
} from './mock-system-reports';
import {
  deleteSystemReportInSupabase,
  loadSystemReportsFromSupabase
} from './supabase-system-reports-service';
import { systemReportsDataSource } from './system-reports-data-source';
import type { SystemReportQuery } from '../model/system-report-types';

export function fetchSystemReportsSafe(query: SystemReportQuery, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(
      () => systemReportsDataSource === 'supabase'
        ? loadSystemReportsFromSupabase(query, signal)
        : Promise.resolve(loadMockSystemReports(query)),
      { maxRetries: 1 }
    )
  );
}

// 삭제는 멱등이 아니므로 재시도하지 않는다. 두 번째 호출은 이미 지워진 행을
// 가리켜 'unknown system report' 로 실패하고, 사용자에게 잘못된 실패로 보인다.
export function deleteSystemReportSafe(
  reportId: string,
  reason: string,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    systemReportsDataSource === 'supabase'
      ? deleteSystemReportInSupabase(reportId, reason, signal)
      : Promise.resolve(deleteMockSystemReport(reportId))
  );
}
