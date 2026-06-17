import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Operation > 공지사항 데이터 소스 스위치.
 *
 * - 'supabase' — operation_notices 테이블 읽기 + admin RPC 3종 쓰기.
 *                Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 기존 결정적 시드
 *                (mock 회귀 e2e 경로). `VITE_OPERATION_NOTICES_SOURCE=mock`으로 강제 가능.
 */
export type OperationNoticesDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveOperationNoticesDataSource(): OperationNoticesDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_OPERATION_NOTICES_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const operationNoticesDataSource = resolveOperationNoticesDataSource();
