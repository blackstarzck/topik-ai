import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseClient } from './supabase-client';

/**
 * Supabase 서비스 계층 공용 가드/유틸.
 *
 * 각 feature 서비스 파일에 동일 본문으로 복제되어 있던 로컬 헬퍼(requireClient 24곳,
 * throwIfAborted 18곳, sleep 18곳, requireReason 14곳)를 단일 정의로 통합한다.
 * 동작·시그니처·에러 메시지는 기존 복제본과 동일하게 유지한다(동작 무변경 리팩토링).
 */

export function requireClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase client not configured');
  }
  return supabaseClient;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Request aborted', 'AbortError');
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** 조치성 RPC 공통 계약: p_reason 은 공백일 수 없다. */
export function requireReason(reason: string | undefined): string {
  const trimmed = (reason ?? '').trim();
  if (!trimmed) {
    throw new Error('사유/근거를 입력하세요. (RPC p_reason 필수)');
  }
  return trimmed;
}

/** jsonb/unknown 배열 → 모든 원소를 String() 강제 변환(비배열은 빈 배열). */
export function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/** jsonb/unknown 배열 → string 원소만 필터(비배열은 빈 배열). */
export function filterStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
