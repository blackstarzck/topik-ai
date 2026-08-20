import { theme } from 'antd';

import { adminThemeToken } from '@/app/theme';

/**
 * 디자인 값의 단일 소스.
 *
 * 값을 여기서 새로 정하지 않는다 — `src/app/theme.ts` 의 antd 테마에서 **파생**한다.
 * `theme.getDesignToken` 은 순수 함수라 모듈 스코프에서 부를 수 있어서, 컴포넌트가 아닌
 * 컬럼 팩토리·스키마 모듈(Phase 4 분해 산출물)에서도 그대로 쓸 수 있다. `theme.useToken()`
 * 훅 방식은 그 파일들에서 부를 수 없어 채택하지 않았다.
 *
 * 규칙
 * - antd 에 같은 값의 토큰이 있으면 그 토큰을 쓴다(치환해도 화면이 안 바뀐다).
 * - antd 스케일 밖의 앱 고유값은 이 파일의 `APP_COLOR`/`FONT_SIZE.metric` 처럼 **여기 한 곳에**
 *   모아 둔다. 인라인에 흩어 두지 않는 것이 목적이고, antd 스케일로 억지로 끌어오지 않는다.
 * - 제3자 브랜드색(소셜 로그인 마크)과 데이터 시각화 팔레트는 대상이 아니다 —
 *   `scripts/check-design-tokens.mjs` 의 allowlist 에 근거와 함께 등재한다.
 *
 * 게이트: `npm run check:design-tokens`. 값 고정: `tests/unit/design-tokens.test.ts`.
 */
const designToken = theme.getDesignToken({ token: adminThemeToken });

/** 간격 스케일 — antd margin 계열과 1:1. padding 도 같은 수치라 하나로 쓴다. */
export const SPACE = {
  /** 4 (antd marginXXS) */
  xxs: designToken.marginXXS,
  /** 8 (antd marginXS) */
  xs: designToken.marginXS,
  /** 12 (antd marginSM) */
  sm: designToken.marginSM,
  /** 16 (antd margin) */
  base: designToken.margin,
  /** 20 (antd marginMD) */
  md: designToken.marginMD,
  /** 24 (antd marginLG) */
  lg: designToken.marginLG,
  /** 32 (antd marginXL) */
  xl: designToken.marginXL,
  /** 48 (antd marginXXL) */
  xxl: designToken.marginXXL
} as const;

/** 모서리 반경 — antd borderRadius 계열과 1:1(base 는 테마가 지정한 10). */
export const RADIUS = {
  /** 2 (antd borderRadiusXS) */
  xs: designToken.borderRadiusXS,
  /** 6 (antd borderRadiusSM) */
  sm: designToken.borderRadiusSM,
  /** 10 (antd borderRadius = 테마 지정값) */
  base: designToken.borderRadius,
  /** 12 (antd borderRadiusLG) */
  lg: designToken.borderRadiusLG
} as const;

/**
 * 글자 크기 — antd fontSize 계열과 1:1. 가시 텍스트 최소 14px 규칙([[typography-min-font-rule]])
 * 때문에 `sm` 도 14 다(테마가 `fontSizeSM: 14`).
 */
export const FONT_SIZE = {
  /** 14 (antd fontSizeSM — 테마가 14 로 올린 값) */
  sm: designToken.fontSizeSM,
  /** 14 (antd fontSize, 본문) */
  base: designToken.fontSize,
  /** 16 (antd fontSizeLG — 소제목) */
  lg: designToken.fontSizeLG,
  /** 20 (antd fontSizeXL) */
  xl: designToken.fontSizeXL,
  /** 28 — KPI 수치 전용. antd 스케일 밖(heading3 24 / heading2 30 사이)이라 앱 고유값으로 둔다. */
  metric: 28
} as const;

/** 아이콘 글리프 크기 — 텍스트가 아니라 도형이라 14px 최소 규칙 대상이 아니다. */
export const ICON_SIZE = {
  /** 18 — 아이콘 전용 버튼(셸 토글·알림 벨) */
  button: 18
} as const;

/** antd 토큰과 같은 값의 색. 치환해도 화면이 바뀌지 않는다. */
export const COLOR = {
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
} as const;

/**
 * antd 토큰에 대응값이 없는 앱 고유색. 인라인에 흩어져 있던 것을 모은 것이고,
 * 값은 그대로라 치환 시 화면이 바뀌지 않는다.
 */
export const APP_COLOR = {
  /** 사이드바 브랜드 패널 배경 */
  sidebarBrandBg: '#10233c',
  /** 사이드바 브랜드 패널 보조 텍스트(흰색 80%) */
  sidebarBrandTextMuted: '#ffffffcc',
  /** 사이드바 접힘 토글 바 배경 */
  sidebarToggleBg: 'rgba(16, 35, 60, 0.28)',
  /** 로그인 화면 배경 */
  loginBg: '#f5f7fb',
  /** 코드/원문 블록 배경(antd colorFillAlter 0.02 보다 살짝 진한 기존 값) */
  codeBlockBg: 'rgba(0, 0, 0, 0.03)',
  /** 목록 패널 헤더 배경(antd colorFillQuaternary 근사값이지만 기존 값 유지) */
  panelHeaderBg: '#fafafa',
  /** 알림 드롭다운 패널 그림자 */
  dropdownPanelShadow: '0 6px 16px rgba(0,0,0,0.12)',
  /** 셸 상단 구분선 */
  shellDividerBorder: '#e8edf5',
  /** 차트 눈금선 */
  chartGridLine: '#eef0f4',
  /** 차트 패널 테두리 */
  chartPanelBorder: '#e7ebf3',
  /** 도넛/게이지 미채움 트랙 배경 */
  chartTrackBg: '#eef2f7',
  /** 어두운 Tooltip 안의 보조 설명 텍스트 */
  tooltipDescriptionText: 'rgba(255, 255, 255, 0.72)'
} as const;
