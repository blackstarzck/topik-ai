import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import { MIN_VISIBLE_FONT_SIZE_PX, adminThemeToken } from '../../src/app/theme';

/**
 * 가시 텍스트 최소 14px 규칙 중 **antd 가 자기 토큰으로 그리는 표면**을 고정한다.
 *
 * `scripts/check-typography-min-font.mjs` 는 `src/**` 의 리터럴만 훑으므로 antd 파생값을
 * 볼 수 없다. Tag 본문·Switch 내부 라벨·Badge count·표 필터 빈 목록 문구가 전부
 * `fontSizeSM` 한 곳에서 나오는데 antd 기본 파생값은 12 다 — 이 토큰이 사라지면 게이트는
 * green 인데 화면에는 12px 텍스트가 되돌아온다.
 */
describe('admin antd 테마 토큰', () => {
  it('소형 텍스트 파생 기준값(fontSizeSM)이 최소 크기 이상이다', () => {
    expect(adminThemeToken?.fontSizeSM).toBeGreaterThanOrEqual(MIN_VISIBLE_FONT_SIZE_PX);
  });

  it('본문 크기를 임의로 키우지 않는다(설정하더라도 최소 크기 이상)', () => {
    const bodyFontSize = adminThemeToken?.fontSize;
    if (bodyFontSize !== undefined) {
      expect(bodyFontSize).toBeGreaterThanOrEqual(MIN_VISIBLE_FONT_SIZE_PX);
    }
  });

  it('앱 루트가 이 토큰을 그대로 ConfigProvider 에 넘긴다', () => {
    const appSource = readFileSync(join(cwd(), 'src/app/app.tsx'), 'utf8');
    expect(appSource).toContain("import { adminThemeToken } from './theme'");
    expect(appSource).toContain('theme={{ token: adminThemeToken }}');
  });
});
