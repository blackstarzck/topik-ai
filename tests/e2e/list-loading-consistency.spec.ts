import { expect, test } from '@playwright/test';

import { stretchAsyncFetchDelay } from './harness/admin-flow-helpers';

const auditedInitialLoadingPages = [
  { name: '회원 목록', url: '/users' },
  { name: '강사 관리', url: '/users/groups' },
  { name: '추천인 관리', url: '/users/referrals' },
  { name: '공지사항', url: '/operation/notices' },
  { name: 'FAQ', url: '/operation/faq' },
  { name: '이벤트', url: '/operation/events' },
  { name: '정책 관리', url: '/operation/policies' },
  { name: '쿠폰', url: '/commerce/coupons' },
  { name: '포인트', url: '/commerce/points' },
  // 🚨 두 화면은 표에 loading 을 아예 넘기지 않고 있었다 — mock 경로에 지연이 없어
  // pending 프레임이 관측되지 않아 누락이 드러나지 않았다(2026-08-21).
  { name: '결제 내역', url: '/commerce/payments' },
  { name: '환불 관리', url: '/commerce/refunds' },
  { name: 'TOPIK 쓰기 문제은행', url: '/assessment/question-bank' },
  { name: '메타데이터 관리', url: '/system/metadata' }
] as const;

for (const { name, url } of auditedInitialLoadingPages) {
  test(`${name} 초기 로딩은 본문 로딩 Alert 없이 테이블 loading 오버레이로 표시된다`, async ({
    page
  }) => {
    await page.addInitScript(stretchAsyncFetchDelay);
    await page.goto(url);

    const loadingTable = page.locator('.admin-data-table--loading').first();

    await expect(loadingTable).toBeVisible();
    await expect(loadingTable.locator('.ant-spin-spinning')).toBeVisible();
    await expect(
      page.getByText(/불러오는 중입니다\.|다시 불러오는 중입니다\.|새로 불러오는 중입니다\./)
    ).toHaveCount(0);
  });
}
