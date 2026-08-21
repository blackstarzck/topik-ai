import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { theme } from 'antd';
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

  /**
   * 정보 상태색은 브랜드색과 **분리 유지**로 결정됐다(2026-08-20). 정보 Alert 이 주요
   * 액션·링크와 같은 색이 되면 "정보"와 "이 화면의 주 동작"이 시각적으로 구분되지 않는다.
   *
   * 결정을 코드로 못박는다 — 누군가 색 일관성을 이유로 `colorInfo` 를 브랜드색으로
   * 맞추면 이 테스트가 막고 결정 이력을 가리킨다.
   */
  it('정보 상태색은 브랜드색과 다르게 유지한다', () => {
    const derived = theme.getDesignToken({ token: adminThemeToken });

    expect(derived.colorInfo).not.toBe(derived.colorPrimary);
    expect(adminThemeToken?.colorInfo).toBeUndefined();
  });

  it('브랜드색은 링크에도 같은 값으로 적용된다', () => {
    // colorLink 는 colorPrimary 파생이 아닌 별도 시드라 지정하지 않으면 antd 기본 파랑이 된다.
    const derived = theme.getDesignToken({ token: adminThemeToken });

    expect(derived.colorLink).toBe(derived.colorPrimary);
  });

  it('앱 루트가 이 토큰을 그대로 ConfigProvider 에 넘긴다', () => {
    const appSource = readFileSync(join(cwd(), 'src/app/app.tsx'), 'utf8');
    expect(appSource).toContain("import { adminThemeToken } from './theme'");
    expect(appSource).toContain('theme={{ token: adminThemeToken }}');
  });
});
