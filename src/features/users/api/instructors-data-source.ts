import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Users > 강사 관리 데이터 소스 스위치.
 *
 * - 'supabase' — instructors 테이블 읽기 + admin RPC(목록/상세/상태변경) 호출.
 *                Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 기존 결정적 시드
 *                (mock 회귀 e2e 경로). `VITE_INSTRUCTORS_SOURCE=mock`으로 강제 가능.
 */
export type InstructorsDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveInstructorsDataSource(): InstructorsDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_INSTRUCTORS_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const instructorsDataSource = resolveInstructorsDataSource();
