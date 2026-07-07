import { toSafeResult } from '../../../shared/api/safe-request';
import {
  isSupabaseConfigured,
  supabaseClient
} from '../../../shared/api/supabase-client';

/**
 * 대시보드 요약/큐/경고 실데이터 집계 — get_admin_dashboard_stats (is_admin).
 * Supabase 미설정(mock 모드)에서는 null 을 반환하고 페이지가 기존 목업 수치를
 * 그대로 유지한다(다른 도메인의 "Supabase 모드=실 DB, 그 외 mock" 패턴 동일).
 */

export type DashboardStats = {
  newUsersToday: number;
  pendingReports: number;
  pendingRefunds: number;
  pendingRefundsOver24h: number;
  scheduledDispatches: number;
  failedDeliveries7d: number;
  roleChanges7d: number;
  reportsNew7d: number;
  reportsNewPrev7d: number;
  pushSent7d: number;
  pushFailed7d: number;
  pushSentPrev7d: number;
  pushFailedPrev7d: number;
};

type DashboardStatsRow = {
  new_users_today: number;
  pending_reports: number;
  pending_refunds: number;
  pending_refunds_over_24h: number;
  scheduled_dispatches: number;
  failed_deliveries_7d: number;
  role_changes_7d: number;
  reports_new_7d: number;
  reports_new_prev_7d: number;
  push_sent_7d: number;
  push_failed_7d: number;
  push_sent_prev_7d: number;
  push_failed_prev_7d: number;
};

export function fetchDashboardStatsSafe(signal?: AbortSignal) {
  return toSafeResult<DashboardStats | null>(async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return null;
    }
    const { data, error } = await supabaseClient.rpc('get_admin_dashboard_stats');
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (error) {
      throw new Error(error.message);
    }
    const row = ((data ?? []) as DashboardStatsRow[])[0];
    if (!row) {
      throw new Error('대시보드 지표 응답이 비어 있습니다.');
    }
    return {
      newUsersToday: row.new_users_today,
      pendingReports: row.pending_reports,
      pendingRefunds: row.pending_refunds,
      pendingRefundsOver24h: row.pending_refunds_over_24h,
      scheduledDispatches: row.scheduled_dispatches,
      failedDeliveries7d: row.failed_deliveries_7d,
      roleChanges7d: row.role_changes_7d,
      reportsNew7d: row.reports_new_7d,
      reportsNewPrev7d: row.reports_new_prev_7d,
      pushSent7d: row.push_sent_7d,
      pushFailed7d: row.push_failed_7d,
      pushSentPrev7d: row.push_sent_prev_7d,
      pushFailedPrev7d: row.push_failed_prev_7d
    };
  });
}
