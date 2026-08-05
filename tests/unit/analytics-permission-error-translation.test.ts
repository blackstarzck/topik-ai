import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import {
  isAnalyticsPermissionError,
  translateAnalyticsError
} from '../../src/features/analytics/api/analytics-permission-error';

// mock e2e 는 이 번역 경로를 실행하지 않는다(mock 모드는 RPC 호출 전에 null 반환).
// 그래서 순수 함수 단위 테스트로 계약을 고정한다.
describe('analytics 권한 오류 번역', () => {
  it('권한 거절 메시지를 한국어 안내로 바꾼다', () => {
    expect(translateAnalyticsError('forbidden: missing permission analytics.read')).toBe(
      '통계 조회 권한이 없습니다(analytics.read).'
    );
  });

  it('다른 오류는 원문을 유지한다 — 삼키면 예상 못한 실패를 진단할 수 없다', () => {
    expect(translateAnalyticsError('connection reset')).toBe('connection reset');
    expect(isAnalyticsPermissionError('unauthenticated')).toBe(false);
    expect(isAnalyticsPermissionError('forbidden: admin required')).toBe(false);
  });

  it('DB 가 실제로 던지는 raise 문구와 lockstep 이다', () => {
    // 마이그레이션의 문구가 바뀌면 이 테스트가 FE 번역도 함께 바꾸라고 알려준다.
    const migration = readFileSync(
      join(
        cwd(), 'supabase', 'migrations-admin',
        '20260805130000_admin_analytics_read_permission.sql'
      ),
      'utf8'
    );
    const raiseText = "raise exception 'forbidden: missing permission analytics.read';";
    expect(migration).toContain(raiseText);
    expect(isAnalyticsPermissionError('forbidden: missing permission analytics.read')).toBe(true);
  });
});
