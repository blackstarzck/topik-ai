import { resolveDataSource } from '@/shared/api/data-source';

/**
 * Operation > PDF 내보내기 제한 data source switch.
 *
 * - 'supabase' - get_admin_pdf_quota_* read RPC + admin_* write RPC 경로.
 *                Supabase가 구성되어 있으면 기본값.
 * - 'mock'     - Supabase 미구성 또는 `VITE_SUPABASE_DISABLED=true`일 때의
 *                결정적 Zustand seed 경로. `VITE_OPERATION_PDF_QUOTA_SOURCE=mock`
 *                으로 강제할 수 있다.
 */
export type OperationPdfQuotaDataSource = 'mock' | 'supabase';

export function resolveOperationPdfQuotaDataSource(): OperationPdfQuotaDataSource {
  return resolveDataSource('VITE_OPERATION_PDF_QUOTA_SOURCE');
}

export const operationPdfQuotaDataSource = resolveOperationPdfQuotaDataSource();
