import { expect, type Page } from '@playwright/test';

/**
 * 라이브 검증용 관리자 로그인 — 이미 세션이 있으면 넘어간다.
 *
 * 🚨 **판정 전에 화면이 결정될 때까지 기다려야 한다.** 원래는 이랬다.
 *
 * ```ts
 * if (!(await password.isVisible())) return;   // 재시도 없는 즉시 판정
 * ```
 *
 * `isVisible()` 은 기다리지 않는다. 로그인 화면이 초기 페이로드에 있던 동안에는
 * `page.goto` 가 끝난 시점에 입력이 이미 DOM 에 있어서 우연히 맞았지만, 로그인 화면을
 * 지연 로딩으로 바꾼 뒤(초기 페이로드 −94 kB) Suspense 프레임이 생겨 판정 시점에는 아직
 * 입력이 없다. 그래서 **로그인을 건너뛰고** 로그인 화면에 그대로 머문 채 다음 단언이
 * "회원 목록 헤딩 없음"으로 떨어졌다 — 앱은 정상인데 검증만 20분기 실패했다.
 *
 * 그래서 두 결과 중 하나가 나타날 때까지 기다린 **뒤에** 분기한다.
 * - 로그인 폼이 보이면 로그인한다.
 * - 페이지 본문(공통 `PageTitle`)이 보이면 이미 인증된 것이므로 넘어간다.
 */
export async function loginIfNeeded(
  page: Page,
  credentials: { email: string | undefined; password: string | undefined }
): Promise<void> {
  const passwordInput = page.locator('input[type="password"]');
  const authenticatedContent = page.locator('.page-title-block');

  await expect(passwordInput.or(authenticatedContent).first()).toBeVisible();
  if (!(await passwordInput.isVisible())) return;

  await page.locator('input[type="email"], input#email').first().fill(credentials.email ?? '');
  await passwordInput.fill(credentials.password ?? '');
  await page.locator('button[type="submit"]').click();
  await expect(passwordInput).not.toBeVisible();
}
