import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { theme } from 'antd';
import { describe, expect, it } from 'vitest';

import { adminThemeToken } from '../../src/app/theme';
import {
  APP_COLOR,
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

  it('글자 크기는 antd fontSize 스케일과 같다(KPI 전용값만 앱 고유)', () => {
    expect(FONT_SIZE.sm).toBe(designToken.fontSizeSM);
    expect(FONT_SIZE.base).toBe(designToken.fontSize);
    expect(FONT_SIZE.lg).toBe(designToken.fontSizeLG);
    expect(FONT_SIZE.xl).toBe(designToken.fontSizeXL);
    expect(FONT_SIZE.metric).toBe(28);
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
