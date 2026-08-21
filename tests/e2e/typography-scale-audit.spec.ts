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

for (const { name, url } of auditedPages) {
  test(`${name} 의 렌더된 글자 크기가 전부 스케일 안이다`, async ({ page }) => {
    await page.goto(url);

    // 표·카드가 그려진 뒤에 재야 antd 내부 텍스트(Tag·Badge·빈 목록 문구)가 포함된다.
    await expect(page.locator('main')).toBeVisible();
    await page.waitForLoadState('networkidle');

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
