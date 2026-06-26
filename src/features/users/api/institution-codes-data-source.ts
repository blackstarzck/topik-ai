import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * Users > 기관 코드 데이터 소스 스위치.
 *
 * - 'supabase' — institution_codes admin RPC(목록/생성/수정/삭제) 호출. Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 결정적 시드(mock 회귀 e2e 경로).
 *                `VITE_INSTITUTION_CODES_SOURCE=mock`으로 강제 가능.
 */
export type InstitutionCodesDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveInstitutionCodesDataSource(): InstitutionCodesDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_INSTITUTION_CODES_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const institutionCodesDataSource = resolveInstitutionCodesDataSource();
