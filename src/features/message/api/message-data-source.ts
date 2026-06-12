import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * 메시지(알림) 데이터 소스 스위치 (WP2-1 — docs/specs/notification-contract.md).
 *
 * - 'supabase' — notification_* 4테이블 읽기 + admin RPC 6종 쓰기(단일 경로).
 *                Supabase 구성 시 기본값.
 * - 'mock'     — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 기존 결정적 시드
 *                (mock 회귀 e2e 경로). `VITE_MESSAGE_SOURCE=mock`으로 강제 가능.
 */
export type MessageDataSource = 'mock' | 'supabase';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveMessageDataSource(): MessageDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_MESSAGE_SOURCE === 'mock' ? 'mock' : 'supabase';
}

export const messageDataSource = resolveMessageDataSource();
