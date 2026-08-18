import { isSupabaseConfigured } from './supabase-client';

/**
 * feature 별 *-data-source.ts 가 공유하는 mock/supabase 판별 로직.
 *
 * 판별 규칙(기존 21개 resolver 와 동일):
 * 1) Supabase 미구성 또는 `VITE_SUPABASE_DISABLED=true` → 'mock'
 * 2) 도메인 강제 env(예: `VITE_COMMUNITY_SOURCE=mock`) → 'mock'
 * 3) 그 외 → 'supabase'
 *
 * 도메인별 파일·env 키 계약은 그대로 유지된다 — 각 resolver 는 이 팩토리에
 * 위임하는 thin wrapper 다(원문: docs/architecture/admin-data-source-transition.md).
 */
export type ResolvedDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** 도메인 데이터 소스가 mock 으로 판정되는지 여부(비표준 소스 라벨용). */
export function isForcedMock(forceMockEnvKey?: string): boolean {
  if (!isSupabaseConfigured) {
    return true;
  }
  return forceMockEnvKey ? env[forceMockEnvKey] === 'mock' : false;
}

export function resolveDataSource(forceMockEnvKey?: string): ResolvedDataSource {
  return isForcedMock(forceMockEnvKey) ? 'mock' : 'supabase';
}
