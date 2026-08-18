import type {
  SystemReport,
  SystemReportPage,
  SystemReportQuery
} from '../model/system-report-types';
import { requireClient, throwIfAborted } from '@/shared/api/supabase-service-utils';

type SystemReportRow = {
  report_id: string;
  reference_code: string;
  category: SystemReport['category'];
  email: string;
  title: string;
  message: string;
  pathname: string;
  browser: SystemReport['browser'];
  os: SystemReport['os'];
  device_type: SystemReport['deviceType'];
  viewport_width: number;
  viewport_height: number;
  locale: SystemReport['locale'];
  app_version: string | null;
  reporter_user_id: string | null;
  created_at: string;
  total_count: number;
};

function mapSystemReport(row: SystemReportRow): SystemReport {
  return {
    reportId: row.report_id,
    referenceCode: row.reference_code,
    category: row.category,
    email: row.email,
    title: row.title,
    message: row.message,
    pathname: row.pathname,
    browser: row.browser,
    os: row.os,
    deviceType: row.device_type,
    viewportWidth: Number(row.viewport_width ?? 0),
    viewportHeight: Number(row.viewport_height ?? 0),
    locale: row.locale,
    appVersion: row.app_version,
    reporterUserId: row.reporter_user_id,
    createdAt: row.created_at
  };
}

export async function loadSystemReportsFromSupabase(
  query: SystemReportQuery,
  signal?: AbortSignal
): Promise<SystemReportPage> {
  const request = requireClient().rpc('admin_list_system_reports', {
    p_category: query.category ?? null,
    p_from: query.createdFrom ?? null,
    p_to: query.createdTo ?? null,
    p_keyword: query.keyword?.trim() || null,
    p_limit: query.pageSize,
    p_offset: (query.page - 1) * query.pageSize
  });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SystemReportRow[];
  return {
    rows: rows.map(mapSystemReport),
    totalCount: Number(rows[0]?.total_count ?? 0)
  };
}

export async function deleteSystemReportInSupabase(
  reportId: string,
  reason: string,
  signal?: AbortSignal
): Promise<string> {
  const request = requireClient().rpc('admin_delete_system_report', {
    p_report_id: reportId,
    p_reason: reason
  });
  const { data, error } = await (signal ? request.abortSignal(signal) : request);
  throwIfAborted(signal);
  if (error) throw new Error(error.message);
  return (data ?? '') as string;
}
