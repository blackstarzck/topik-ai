import { resolveDataSource } from '@/shared/api/data-source';

/**
 * Operation > 공지사항 데이터 소스 스위치.
 *
 * - 'supabase' — operation_notices 테이블 읽기 + admin RPC 3종 쓰기.
 *                Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 기존 결정적 시드
 *                (mock 회귀 e2e 경로). `VITE_OPERATION_NOTICES_SOURCE=mock`으로 강제 가능.
 */
export type OperationNoticesDataSource = 'mock' | 'supabase';

export function resolveOperationNoticesDataSource(): OperationNoticesDataSource {
  return resolveDataSource('VITE_OPERATION_NOTICES_SOURCE');
}

export const operationNoticesDataSource = resolveOperationNoticesDataSource();
