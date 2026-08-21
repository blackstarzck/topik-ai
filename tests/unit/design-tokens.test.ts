import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { theme } from 'antd';
import { describe, expect, it } from 'vitest';

import { adminThemeToken } from '../../src/app/theme';
import {
  APP_COLOR,
  CSS_COLOR_VARIABLES,
  CSS_FONT_VARIABLES,
  COLOR,
  FONT_SIZE,
  ICON_SIZE,
  RADIUS,
  SPACE
} from '../../src/shared/styles/design-tokens';

/**
 * 디자인 토큰 모듈이 antd 테마의 **파생물로만** 남아 있는지 고정한다.
 *
 * 누군가 `SPACE.sm` 을 13 으로 바꾸거나 `COLOR.primary` 에 다른 색을 박으면 antd 컴포넌트가
 * 그리는 화면과 우리 인라인 style 이 어긋난다 — 그 순간 "단일 소스"가 깨진다.
 * antd 가 계산한 값과 직접 비교해서 그 어긋남을 잡는다.
 */
const designToken = theme.getDesignToken({ token: adminThemeToken });

describe('디자인 토큰', () => {
  it('간격은 antd margin 스케일과 같다', () => {
    expect(SPACE).toEqual({
      xxs: designToken.marginXXS,
      xs: designToken.marginXS,
      sm: designToken.marginSM,
      base: designToken.margin,
      md: designToken.marginMD,
      lg: designToken.marginLG,
      xl: designToken.marginXL,
      xxl: designToken.marginXXL
    });
  });

  it('모서리는 antd borderRadius 스케일과 같다', () => {
    expect(RADIUS).toEqual({
      xs: designToken.borderRadiusXS,
      sm: designToken.borderRadiusSM,
      base: designToken.borderRadius,
      lg: designToken.borderRadiusLG
    });
  });

  it('글자 크기는 antd fontSize 스케일과 같다(metric 만 앱 고유)', () => {
    expect(FONT_SIZE.sm).toBe(designToken.fontSizeSM);
    expect(FONT_SIZE.base).toBe(designToken.fontSize);
    expect(FONT_SIZE.lg).toBe(designToken.fontSizeLG);
    expect(FONT_SIZE.xl).toBe(designToken.fontSizeXL);
    expect(FONT_SIZE.heading3).toBe(designToken.fontSizeHeading3);
    expect(FONT_SIZE.heading2).toBe(designToken.fontSizeHeading2);
    expect(FONT_SIZE.heading1).toBe(designToken.fontSizeHeading1);
    expect(FONT_SIZE.metric).toBe(28);
  });

  /**
   * 스케일이 두 벌이 되지 않게 하는 단정 — CSS 가 받는 값과 TS 가 쓰는 값이 **같은 숫자**여야
   * 한다. 게이트(`check:typography-min-font`)는 리터럴이 없는지만 보고, 브리지가 잘못된
   * 값을 내려도 막지 못한다.
   */
  it('CSS 글자 크기 변수는 FONT_SIZE 와 같은 값을 내려준다', () => {
    const expected = Object.fromEntries(
      Object.entries(FONT_SIZE).map(([key, value]) => [`font-${key}`, `${value}px`])
    );
    expect(CSS_FONT_VARIABLES).toEqual(expected);
  });

  it('CSS 글자 크기 변수도 최소 크기를 지킨다', () => {
    for (const [name, value] of Object.entries(CSS_FONT_VARIABLES)) {
      expect(Number.parseFloat(value), name).toBeGreaterThanOrEqual(14);
    }
  });

  /**
   * antd 가 그리는 크기와 우리가 쓰는 크기가 같은 스케일에서 나오는지 — `metric` 을 뺀 모든
   * 단계가 antd 파생값 집합에 실제로 존재해야 한다. 누군가 `lg: 17` 처럼 손으로 적으면
   * 여기서 걸린다.
   */
  it('metric 을 뺀 모든 단계가 antd 파생 스케일의 값이다', () => {
    const antdScale = new Set([
      designToken.fontSizeSM,
      designToken.fontSize,
      designToken.fontSizeLG,
      designToken.fontSizeXL,
      designToken.fontSizeHeading3,
      designToken.fontSizeHeading2,
      designToken.fontSizeHeading1
    ]);
    for (const [key, value] of Object.entries(FONT_SIZE)) {
      if (key === 'metric') continue;
      expect(antdScale.has(value), `FONT_SIZE.${key} = ${value}`).toBe(true);
    }
  });

  it('색은 antd 토큰과 같다', () => {
    expect(COLOR).toEqual({
      primary: designToken.colorPrimary,
      primaryBg: designToken.colorPrimaryBg,
      text: designToken.colorText,
      textSecondary: designToken.colorTextSecondary,
      textTertiary: designToken.colorTextTertiary,
      textLightSolid: designToken.colorTextLightSolid,
      bgContainer: designToken.colorBgContainer,
      bgLayout: designToken.colorBgLayout,
      border: designToken.colorBorder,
      borderSecondary: designToken.colorBorderSecondary,
      successBg: designToken.colorSuccessBg
    });
  });

  it('브랜드 기본색은 antd 기본 파랑이 아니다', () => {
    // #1677ff 는 antd 기본값이다. 테마가 지정한 브랜드색이 여기로 되돌아가면 화면 전체가 어긋난다.
    expect(COLOR.primary).not.toBe('#1677ff');
    expect(COLOR.primary).toBe(adminThemeToken?.colorPrimary);
  });

  it('가시 텍스트 크기는 최소 14px 규칙을 지킨다', () => {
    for (const [key, value] of Object.entries(FONT_SIZE)) {
      expect(value, `FONT_SIZE.${key}`).toBeGreaterThanOrEqual(14);
    }
  });

  it('아이콘 크기는 텍스트 최소 크기 규칙 대상이 아니다(도형)', () => {
    expect(ICON_SIZE.button).toBe(18);
  });

  it('앱 고유색은 antd 토큰과 겹치지 않는 값만 담는다', () => {
    const antdValues = new Set(Object.values(COLOR));
    for (const [key, value] of Object.entries(APP_COLOR)) {
      expect(antdValues.has(value), `APP_COLOR.${key} 는 COLOR 로 옮겨야 합니다`).toBe(false);
    }
  });

  it('게이트가 harness:check 에 배선돼 있다', () => {
    const packageJson = readFileSync(join(cwd(), 'package.json'), 'utf8');
    expect(packageJson).toContain('"check:design-tokens": "node ./scripts/check-design-tokens.mjs"');
    expect(packageJson).toContain('npm run check:design-tokens');
  });
});

/**
 * 링크 계열 색의 **대비비**를 고정한다.
 *
 * 🚨 이 저장소에서 두 번 같은 실수가 났다 — `colorLink` 가 antd 기본 파랑으로 남아 4.10:1
 * 이었고(#127), CSS 변수 브리지의 `link-hover` 는 `#4096ff` 로 **2.99:1** 이었다(#137 후속).
 * 후자는 hover 라서 더 나쁘다: 평소엔 읽히는 링크가 마우스를 올리면 덜 읽힌다.
 * 값이 아니라 **기준**을 테스트로 걸어 같은 계열 회귀를 막는다.
 */
function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4]
    .map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastOnWhite(hex: string): number {
  const luminance = relativeLuminance(hex);
  return (1 + 0.05) / (luminance + 0.05);
}

describe('링크 색 대비비', () => {
  /** WCAG AA 본문 기준. */
  const AA_BODY = 4.5;

  it('브랜드색과 링크색이 본문 대비 기준을 넘는다', () => {
    const derived = theme.getDesignToken({ token: adminThemeToken });

    expect(contrastOnWhite(derived.colorPrimary)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastOnWhite(derived.colorLink)).toBeGreaterThanOrEqual(AA_BODY);
  });

  it('링크 hover 도 같은 기준을 넘는다 — hover 에서 읽기 어려워지면 안 된다', () => {
    const derived = theme.getDesignToken({ token: adminThemeToken });

    expect(contrastOnWhite(derived.colorPrimaryHover)).toBeGreaterThanOrEqual(AA_BODY);
    // CSS 변수 브리지가 그 값을 그대로 내려주는지도 함께 본다.
    expect(CSS_COLOR_VARIABLES['link-hover']).toBe(derived.colorPrimaryHover);
  });

  it('antd 기본 파랑 계열이 링크 색으로 되돌아오지 않는다', () => {
    const stockBlues = ['#1677ff', '#4096ff', '#69b1ff'];
    const derived = theme.getDesignToken({ token: adminThemeToken });

    for (const stock of stockBlues) {
      expect(derived.colorLink.toLowerCase(), stock).not.toBe(stock);
      expect(CSS_COLOR_VARIABLES['link-hover'].toLowerCase(), stock).not.toBe(stock);
    }
  });
});
