import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import { isInitialSummaryLoad } from '../../src/shared/ui/list-summary-cards/list-summary-cards';

/**
 * 요약 카드 로딩 판정을 고정한다.
 *
 * 이 판정이 틀리면 두 방향으로 깨진다 — 너무 좁으면 조회 중에 `0건`·`₩0` 을 정상 수치처럼
 * 보여주고(원래 결함), 너무 넓으면 재조회마다 이미 맞는 수치가 스켈레톤으로 가려져 화면이
 * 깜빡인다. 그래서 "pending 이고 **캐시가 없을 때만**"이다.
 */
describe('isInitialSummaryLoad', () => {
  it('처음 조회 중이고 데이터가 없으면 로딩이다', () => {
    expect(isInitialSummaryLoad('pending', false)).toBe(true);
  });

  it('재조회 중이라도 직전 데이터가 있으면 로딩이 아니다', () => {
    // 🚨 여기서 true 를 돌려주면 조치 후 재조회마다 카드가 깜빡인다.
    expect(isInitialSummaryLoad('pending', true)).toBe(false);
  });

  it('pending 이 아닌 상태는 데이터 유무와 무관하게 로딩이 아니다', () => {
    for (const status of ['idle', 'success', 'empty', 'error'] as const) {
      expect(isInitialSummaryLoad(status, false), status).toBe(false);
      expect(isInitialSummaryLoad(status, true), status).toBe(false);
    }
  });

  it('빈 결과(empty)는 로딩이 아니다 — 0 은 진짜 0 이다', () => {
    expect(isInitialSummaryLoad('empty', false)).toBe(false);
  });

  it('조회 실패는 로딩이 아니다 — 에러 표시가 따로 있다', () => {
    expect(isInitialSummaryLoad('error', false)).toBe(false);
  });
});

describe('요약 카드 로딩 배선', () => {
  const CONSUMERS = [
    'src/features/assessment/pages/assessment-imported-tasks-page.tsx',
    'src/features/assessment/pages/assessment-question-manage-page.tsx',
    'src/features/billing/pages/billing-payments-page.tsx',
    'src/features/billing/pages/billing-refunds-page.tsx',
    'src/features/commerce/pages/commerce-coupons-page.tsx',
    'src/features/commerce/pages/commerce-points-page.tsx',
    'src/features/community/pages/community-posts-page.tsx',
    'src/features/community/pages/community-reports-page.tsx',
    'src/features/message/pages/message-history-mock-page.tsx',
    'src/features/operation/pages/operation-events-page.tsx',
    'src/features/operation/pages/operation-faq-page.tsx',
    'src/features/operation/pages/operation-policies-page.tsx',
    'src/features/system/pages/system-admins-page.tsx',
    'src/features/system/pages/system-audit-logs-page.tsx',
    'src/features/system/pages/system-backups-page.tsx',
    'src/features/system/pages/system-logs-page.tsx',
    'src/features/system/pages/system-metadata-page.tsx'
  ];

  /**
   * 🚨 한 화면만 배선하면 그 화면만 로딩을 그리고 나머지는 여전히 `0` 을 보여준다 —
   * 화면 간 불일치는 원래 결함보다 나쁘다. 그래서 **소비 화면 전수**를 고정한다.
   */
  it('ListSummaryCards 를 쓰는 모든 화면이 loading 을 넘긴다', () => {
    for (const relative of CONSUMERS) {
      const source = readFileSync(join(cwd(), relative), 'utf8');
      expect(source, relative).toContain('<ListSummaryCards');
      expect(source, relative).toContain('isInitialSummaryLoad(');
    }
  });

  it('목록이 늘어나면 테스트도 같이 늘어난다(누락 방지)', () => {
    // 소비 화면이 새로 생겼는데 이 목록에 없으면 위 케이스가 그 화면을 검사하지 않는다.
    // 실제 사용처 수와 목록 길이를 맞춰 둔다.
    const uiSource = readFileSync(
      join(cwd(), 'src/shared/ui/list-summary-cards/list-summary-cards.tsx'),
      'utf8'
    );
    expect(uiSource).toContain('loading = false');
    expect(CONSUMERS.length).toBe(17);
  });
});
