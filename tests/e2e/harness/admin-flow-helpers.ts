import { expect, type Locator, type Page } from '@playwright/test';

/**
 * mock 조회의 인위적 지연을 늘려 **로딩 상태를 관측 가능하게** 만든다.
 *
 * `page.addInitScript` 로 브라우저에 주입되므로 바깥 스코프를 참조하지 않는다.
 * 초기 로딩 표현을 보는 스펙과, 반대로 **재조회가 없어야 하는 것**을 보는 스펙이
 * 같이 쓴다(지연이 짧으면 재조회 유무를 구분할 수 없다).
 */
export function stretchAsyncFetchDelay(): void {
  const originalSetTimeout = window.setTimeout;

  function patchedSetTimeout(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): number {
    if (typeof timeout === 'number' && timeout > 0 && timeout < 1000) {
      return originalSetTimeout(handler, 2500, ...args);
    }

    return originalSetTimeout(handler, timeout, ...args);
  }

  // tests 프로젝트는 node 타입도 보므로 window.setTimeout 이 node 의 setTimeout
  // (`__promisify__` 보유)과 교차 타입이 된다. 스텁은 호출 시그니처만 대체한다.
  window.setTimeout = patchedSetTimeout as typeof window.setTimeout;
}

export async function getVisibleModal(page: Page): Promise<Locator> {
  const modal = page.locator('.ant-modal:visible').last();
  await expect(modal).toBeVisible();
  return modal;
}

export async function getVisibleDrawer(page: Page): Promise<Locator> {
  const drawer = page.locator('.ant-drawer-content-wrapper:visible').last();
  await expect(drawer).toBeVisible();
  return drawer;
}

export async function fillTextboxAt(
  container: Locator,
  index: number,
  value: string
): Promise<void> {
  await container.getByRole('textbox').nth(index).fill(value);
}

export async function submitVisibleModal(
  page: Page,
  testId: string
): Promise<void> {
  const modal = await getVisibleModal(page);
  await modal.getByTestId(testId).click();
}

export async function confirmVisibleReasonModal(
  page: Page,
  reason: string
): Promise<void> {
  const modal = await getVisibleModal(page);
  await modal.getByRole('textbox').fill(reason);
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
}

export async function closeNamedDialog(
  page: Page,
  titlePattern: RegExp,
  buttonName = '닫기'
): Promise<void> {
  await page
    .getByRole('dialog', { name: titlePattern })
    .getByRole('button', { name: buttonName })
    .click();
}
