import { toSafeResult } from '../../../shared/api/safe-request';
import {
  isSupabaseConfigured,
  supabaseClient
} from '../../../shared/api/supabase-client';

/**
 * 분석 개요 기간 KPI 실데이터 집계 — get_admin_analytics_overview (is_admin).
 * 현재 기간 + 직전 동일기간 값을 함께 받아 추세(%)는 클라이언트에서 계산한다.
 * Supabase 미설정(mock 모드)에서는 null 을 반환하고 페이지가 기존 목업을 유지한다.
 */

export type AnalyticsOverview = {
  totalUsers: number;
  newUsers: number;
  newUsersPrev: number;
  activeUsers: number;
  activeUsersPrev: number;
  reportsTotal: number;
  reportsResolved: number;
  reportsTotalPrev: number;
  reportsResolvedPrev: number;
  postsCreated: number;
  postsCreatedPrev: number;
  deliveriesSent: number;
  deliveriesFailed: number;
  deliveriesSentPrev: number;
  deliveriesFailedPrev: number;
  revenueKrw: number;
  revenueKrwPrev: number;
  refundsTotal: number;
  refundsHandled: number;
  refundsTotalPrev: number;
  refundsHandledPrev: number;
  refundsPendingNow: number;
};

type AnalyticsOverviewRow = {
  total_users: number;
  new_users: number;
  new_users_prev: number;
  active_users: number;
  active_users_prev: number;
  reports_total: number;
  reports_resolved: number;
  reports_total_prev: number;
  reports_resolved_prev: number;
  posts_created: number;
  posts_created_prev: number;
  deliveries_sent: number;
  deliveries_failed: number;
  deliveries_sent_prev: number;
  deliveries_failed_prev: number;
  revenue_krw: number;
  revenue_krw_prev: number;
  refunds_total: number;
  refunds_handled: number;
  refunds_total_prev: number;
  refunds_handled_prev: number;
  refunds_pending_now: number;
};

export function fetchAnalyticsOverviewSafe(periodDays: number, signal?: AbortSignal) {
  return toSafeResult<AnalyticsOverview | null>(async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return null;
    }
    const { data, error } = await supabaseClient.rpc('get_admin_analytics_overview', {
      period_days: periodDays
    });
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (error) {
      throw new Error(error.message);
    }
    const row = ((data ?? []) as AnalyticsOverviewRow[])[0];
    if (!row) {
      throw new Error('분석 지표 응답이 비어 있습니다.');
    }
    return {
      totalUsers: row.total_users,
      newUsers: row.new_users,
      newUsersPrev: row.new_users_prev,
      activeUsers: row.active_users,
      activeUsersPrev: row.active_users_prev,
      reportsTotal: row.reports_total,
      reportsResolved: row.reports_resolved,
      reportsTotalPrev: row.reports_total_prev,
      reportsResolvedPrev: row.reports_resolved_prev,
      postsCreated: row.posts_created,
      postsCreatedPrev: row.posts_created_prev,
      deliveriesSent: row.deliveries_sent,
      deliveriesFailed: row.deliveries_failed,
      deliveriesSentPrev: row.deliveries_sent_prev,
      deliveriesFailedPrev: row.deliveries_failed_prev,
      revenueKrw: row.revenue_krw,
      revenueKrwPrev: row.revenue_krw_prev,
      refundsTotal: row.refunds_total,
      refundsHandled: row.refunds_handled,
      refundsTotalPrev: row.refunds_total_prev,
      refundsHandledPrev: row.refunds_handled_prev,
      refundsPendingNow: row.refunds_pending_now
    };
  });
}
