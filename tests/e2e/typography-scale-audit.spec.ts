import { type Page, expect, test } from '@playwright/test';

/**
 * 실제 렌더된 글자 크기가 스케일 안에 있는지 감사한다.
 *
 * 🚨 이 검사가 따로 필요한 이유 — `scripts/check-typography-min-font.mjs` 는 `src/**` 만
 * 본다. **antd 가 자기 토큰으로 그리는 텍스트는 우리 소스에 숫자가 없다.** 실측
 * (2026-08-20)에서 우리 값은 전부 14 이상인데 `ant-tag`·`ant-switch-inner-*` 가 12px 로
 * 남아 있었다. 게이트는 green 이었다. 그때는 사람이 프리뷰에서 손으로 감사해 찾았고,
 * 그건 다음번에 반복되지 않는다 — 그래서 기계로 옮겼다(2026-08-21).
 *
 * 감사 축은 **등장 횟수가 아니라 값 집합**이다. 알림 벨·툴팁처럼 일시적으로 붙는 노드가
 * 있어 횟수는 실행마다 흔들리지만, 어떤 크기가 쓰였는지는 안정적이다.
 */

/** `FONT_SIZE`(base 14 파생 + 앱 고유 metric)가 허용하는 값. 원본 = src/shared/styles/design-tokens.ts */
const ALLOWED_FONT_SIZES_PX = [14, 16, 20, 24, 28, 30, 38];

/** 가시 텍스트 최소 크기(오너 지시 2026-07-14). */
const MIN_FONT_PX = 14;

const auditedPages = [
  { name: '대시보드', url: '/dashboard' },
  { name: '회원 목록', url: '/users' },
  { name: '학습 분석', url: '/analytics/learning' },
  { name: '포인트', url: '/commerce/points' },
  { name: 'TOPIK 쓰기 문제은행', url: '/assessment/question-bank' },
  { name: '작업 로그', url: '/system/logs' }
] as const;

/**
 * 텍스트 노드를 **직접** 가진 엘리먼트만 센다.
 *
 * 부모까지 세면 상속된 크기가 중복 계상돼 어느 엘리먼트가 실제로 그 크기를 정했는지
 * 알 수 없다. 아이콘(`.anticon`)은 텍스트가 아니라 도형이라 제외한다 —
 * 게이트의 `ICON_GLYPH_ALLOWLIST` 와 같은 판정 기준이다.
 */
async function collectRenderedFontSizes(page: Page) {
  return page.evaluate(() => {
    const sizes = new Set<number>();
    const samples: Record<string, string> = {};

    for (const element of Array.from(document.querySelectorAll('*'))) {
      if (element.closest('.anticon')) continue;
      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        .map((node) => node.textContent?.trim() ?? '')
        .join('');
      if (!ownText) continue;

      const px = Number.parseFloat(window.getComputedStyle(element).fontSize);
      if (!Number.isFinite(px)) continue;
      sizes.add(px);
      if (!samples[px]) {
        samples[px] = `${element.tagName.toLowerCase()}.${element.className || '(no class)'}: ${ownText.slice(0, 40)}`;
      }
    }

    return { sizes: Array.from(sizes).sort((a, b) => a - b), samples };
  });
}

/**
 * 셸조차 그려지지 않았으면 한 번만 다시 불러온다.
 *
 * 🚨 실패를 숨기는 재시도가 아니다. 이 spec 은 한 파일에서 서로 다른 라우트 6개를 방문하는데
 * (저장소에서 가장 많다), Vite dev 서버가 간헐적으로 연결을 떨군다 — 진단해 보니 화면이
 * 완전히 비고(`hasShell: false`, `bodyText: ""`) 콘솔에 `net::ERR_CONNECTION_FAILED` 만
 * 있었다. 타임아웃을 30초로 늘려도 그대로 떨어졌으니 **느림이 아니라 전송 실패**다.
 *
 * 그래서 되살리는 조건을 **"셸이 아예 없다"로 좁혔다.** 셸이 있으면(=문서가 왔으면) 그대로
 * 단언으로 넘어가므로, 글자 크기 위반이 재시도로 가려지는 경우는 없다. 저장소 전역
 * `retries` 를 켜는 방식은 반대로 진짜 실패를 전부 가리므로 택하지 않았다.
 */
async function gotoWithShell(page: Page, url: string) {
  await page.goto(url);
  const shell = page.locator('.ant-layout').first();
  const rendered = await shell
    .waitFor({ state: 'attached', timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!rendered) await page.reload();
  await expect(shell).toBeAttached();
}

for (const { name, url } of auditedPages) {
  test(`${name} 의 렌더된 글자 크기가 전부 스케일 안이다`, async ({ page }) => {
    await gotoWithShell(page, url);

    /**
     * 페이지 **자기 콘텐츠**가 마운트됐는지 — 공통 `PageTitle`(감사 대상 6화면 전부 사용).
     *
     * 🚨 셸의 `<main>`(antd `Content`)을 앵커로 쓰면 안 된다. 셸은 페이지보다 먼저 그려져서
     * 라우트 청크가 아직 안 왔을 때도 통과한다.
     *
     * 참고 — `--repeat-each=4`(24회) 로 돌리면 1~2회 이 앵커에서 떨어진다. 원인은 **느림이
     * 아니다**(30초를 줘도 떨어졌다). 진단해 보니 화면이 완전히 비어 있고
     * (`hasShell: false`, `bodyText: ""`) 콘솔에 `net::ERR_CONNECTION_FAILED` 가 있었다 —
     * Vite dev 서버가 짧은 시간에 24번 탐색을 받으면 간헐적으로 연결을 떨군다.
     *
     * 이 저장소는 `retries` 를 두지 않으므로 그 순간에는 **어느 spec 이든** 떨어진다(spec
     * 고유 문제가 아니다). CI 는 각 테스트를 한 번만 돌려 이 spec 의 탐색이 6회라 재현되지
     * 않는다. 그래서 여기서 타임아웃을 늘리거나 재시도를 넣지 않는다 — 늘려도 안 낫고,
     * 넣으면 진짜 실패를 가린다.
     */
    await expect(page.locator('.page-title-block')).toBeVisible();

    /**
     * 🚨 `waitForLoadState('networkidle')` 를 쓰지 않는다 — 알림 벨이 모든 화면에서
     * 60초마다 폴링하므로(`admin-notification-bell.tsx`) 네트워크가 조용해지는 시점이
     * 대기 조건이 되면 안 된다. 저장소의 다른 spec 도 쓰지 않는다.
     *
     * 대신 이 감사가 노리는 것 자체를 기다린다 — 셸의 antd `Tag`("현재 세션")는 모든
     * 화면에 있고, **antd 가 자기 토큰으로 그리는 텍스트**의 대표다(테마에서 `fontSizeSM`
     * 을 빼면 바로 이 노드가 12px 로 떨어진다).
     */
    await expect(page.locator('.ant-tag').first()).toBeVisible();

    /**
     * 표가 있는 화면은 로딩 오버레이가 걷힐 때까지 기다린다(없는 화면은 즉시 통과).
     *
     * 🔑 여기서 `toHaveCount(0)` 은 **"없다"는 단언이 아니라 "0 이 될 때까지 기다림"**
     * 으로 쓰는 것이 맞다 — 부재 증명에 쓰면 안 되지만 완료 대기에는 정확히 맞는 도구다.
     */
    await expect(page.locator('.admin-data-table--loading')).toHaveCount(0);

    const { sizes, samples } = await collectRenderedFontSizes(page);

    // 🔑 양성 앵커 — 아무것도 못 셌으면 아래 부정 단언이 t≈0 에 공짜로 통과한다.
    expect(sizes.length, `${name}: 텍스트를 하나도 세지 못했습니다`).toBeGreaterThan(0);
    expect(sizes, `${name}: 본문 14px 이 보이지 않습니다`).toContain(MIN_FONT_PX);

    const tooSmall = sizes.filter((px) => px < MIN_FONT_PX);
    expect(
      tooSmall,
      `${name}: ${MIN_FONT_PX}px 미만 — ${tooSmall.map((px) => `${px}px (${samples[px]})`).join(' / ')}`
    ).toEqual([]);

    const offScale = sizes.filter((px) => !ALLOWED_FONT_SIZES_PX.includes(px));
    expect(
      offScale,
      `${name}: 스케일 밖 크기 — ${offScale.map((px) => `${px}px (${samples[px]})`).join(' / ')}. `
        + `허용: ${ALLOWED_FONT_SIZES_PX.join(', ')}px`
    ).toEqual([]);
  });
}
