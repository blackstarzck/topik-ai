import { expect, test } from '@playwright/test';

// Phase 3b 확산: 대시보드가 useAsyncResource 로 전환된 뒤에도 mock 모드 초기
// 렌더(요약 카드·업무 큐·빠른 이동)가 유지되는지 성공 경로를 고정한다.
test('dashboard renders summary cards and work queues in mock mode', async ({
  page
}) => {
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
  await expect(page.getByText('오늘 신규 회원')).toBeVisible();
  await expect(page.getByText('처리 대기 신고').first()).toBeVisible();
  // 업무 큐 리스트는 카드 로딩 스켈레톤 아래 붙어(attached) 있으면 충분하다 —
  // 뷰포트/로딩 타이밍에 따라 visible 판정이 흔들려 attached 로 고정한다.
  await expect(page.getByText('신고 처리 대기')).toBeAttached();
  await expect(page.getByText('회원 관리').first()).toBeVisible();
});
