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

/**
 * `global.css` 가 쓰는 색의 **단일 소스**.
 *
 * CSS 는 TS 모듈을 import 할 수 없어서 이 파일의 값이 스타일시트에 닿지 못했고, 그래서
 * `global.css` 에 색 리터럴 112회(59종)가 남아 있었다 — 디자인 토큰 게이트도 CSS 는
 * `#1677ff` 금지 한 줄만 봤다(gap-register §3.17.2).
 *
 * 그래서 **브리지**를 둔다: 이 표에서 `src/styles/generated-design-tokens.css` 를 생성해
 * 커밋하고(생성기 `scripts/generate-design-token-css.mjs`), `global.css` 는 `var(--admin-*)`
 * 만 쓴다. 커밋본과 생성 결과가 어긋나면 `check:design-token-css` 가 막는다.
 *
 * 🚨 이 표는 **소유권을 옮긴 것이지 값을 바꾼 것이 아니다.** antd 토큰에 정확히 대응하는
 * 값은 토큰을 참조하고(그러면 테마를 바꿀 때 CSS 도 따라온다), 대응이 없는 앱 고유값은
 * 기존 리터럴을 그대로 들고 있다. 값을 통합·정리하는 것은 별개의 시각 변경이다.
 */
export const CSS_COLOR_VARIABLES: Record<string, string> = {
  // ── antd 토큰에 대응하는 것 ────────────────────────────────────────────────
  'color-primary': COLOR.primary,
  'color-error': designToken.colorError,
  'color-error-hover': designToken.colorErrorHover,
  'color-warning-bg': designToken.colorWarningBg,
  'color-warning-border': designToken.colorWarningBorder,
  'surface-default': COLOR.bgContainer,
  'text-on-accent': COLOR.textLightSolid,
  text: COLOR.text,
  'text-tertiary': COLOR.textTertiary,
  border: COLOR.border,
  'border-secondary': COLOR.borderSecondary,
  'row-hover-bg': designToken.colorFillTertiary,
  'popup-shadow': designToken.boxShadowSecondary.replace(/\s+/g, ' ').trim(),

  // ── 셸·전역 ──────────────────────────────────────────────────────────────
  /** 진한 잉크색 본문(사이드바 브랜드색과 같은 값) */
  'text-ink': APP_COLOR.sidebarBrandBg,
  'app-bg': APP_COLOR.loginBg,
  'app-bg-glow-start': '#e6eefb',
  'app-bg-glow-end': '#f5f9ff',
  'shell-divider': APP_COLOR.shellDividerBorder,
  'panel-header-bg': APP_COLOR.panelHeaderBg,
  'route-fallback-bg': '#f7f9fd',

  // ── 텍스트 계열(antd 대응 없음) ────────────────────────────────────────────
  'page-title-description': 'rgba(0, 0, 0, 0.62)',
  'page-title-meta': 'rgba(0, 0, 0, 0.58)',
  'text-muted': '#667085',
  'text-subtle': '#98a2b3',
  'text-body-muted': '#475467',
  'icon-focus': 'rgba(0, 0, 0, 0.72)',

  // ── 링크 ────────────────────────────────────────────────────────────────
  /** 🚨 브랜드색 파생이 아니라 antd 기본 파랑이다. 값 보존을 위해 그대로 옮겼다(§3.17.2 후속). */
  'link-hover': '#4096ff',

  // ── 상호작용 ─────────────────────────────────────────────────────────────
  'focus-ring': 'rgba(29, 78, 216, 0.28)',
  ripple: 'rgba(29, 78, 216, 0.18)',

  // ── 위험 조치 푸터 ───────────────────────────────────────────────────────
  'critical-footer-gradient-start': '#fff8f7',
  'critical-footer-gradient-end': '#fff1f0',

  // ── 발송 그룹 쿼리 빌더 ──────────────────────────────────────────────────
  'query-group-border': '#e8eaef',
  'query-group-root-bg': '#fcfdff',
  'query-rule-border': '#eef1f6',

  // ── 카드·구분선 ─────────────────────────────────────────────────────────
  'divider-strong': '#e5e7eb',
  'card-border': '#e4e7ec',
  'placeholder-border': '#d0d5dd',
  'placeholder-bg': '#fcfcfd',
  'editor-border': '#d7dfeb',

  // ── 태그 편집 모달 ───────────────────────────────────────────────────────
  'selected-bar-bg': '#f8fafc',
  'group-button-border': '#f1f5f9',
  'group-button-text': '#1f2937',
  'group-button-active-bg': '#eef6ff',

  // ── 문항 상세 문서 ───────────────────────────────────────────────────────
  'doc-accent': '#2563eb',
  'doc-accent-strong': '#1d4ed8',
  'doc-card-border': '#dbe4f0',
  'doc-card-bg': '#f8fbff',
  'doc-label-bg': '#f5f8ff',
  'pill-secondary-gradient-start': '#60a5fa',
  'pill-secondary-gradient-end': '#3b82f6',
  'pill-difficulty-gradient-start': '#6b7280',
  'pill-difficulty-gradient-end': '#475569',
  'rating-star': '#fbbf24',
  'memo-divider': 'rgba(250, 173, 20, 0.2)',
  'tag-success-text': '#15803d',
  'tag-success-border': '#bbf7d0',
  'tag-success-bg': '#f0fdf4',

  // ── 학습 분석 화면(analytics-learning-page.css) ─────────────────────────
  /** 학습 분석 화면 강조색 */
  'analytics-primary': '#0958d9',
  /** 학습 분석 보조 배경 */
  'analytics-subtle': '#f5f8fc',
  /** 학습 분석 진한 본문 */
  'analytics-text-strong': '#111827',
  /** KPI 수치 */
  'kpi-value-text': '#0a0a0a',
  /** 차트 범례·표 머리글 텍스트 */
  'chart-legend-text': '#475569',
  /** 사용량 0 행의 흐린 텍스트 */
  'hierarchy-zero-text': '#64748b',
  /** 조건 태그 테두리 */
  'analytics-tag-border': '#d6e4ff',
  /** 조건 태그 배경 */
  'analytics-tag-bg': '#f0f5ff',
  /** KPI 분류 라벨 */
  'analytics-category-text': '#1668dc',
  /** PDF 사용량 패널 테두리 */
  'hierarchy-border': '#e5eaf0',
  /** 통계 타일 배경 */
  'stat-tile-bg': '#fbfdff',
  /** 증가 표시 */
  'delta-positive': '#047857',
  /** 감소 표시 */
  'delta-negative': '#b42318',
  /** 패널 그림자색 */
  'panel-shadow-color': 'rgba(15, 23, 42, 0.12)',
  /** 점수 분포 세그먼트 구분선 */
  'segment-divider': 'rgba(255, 255, 255, 0.7)',
  /** 어두운 Tooltip 배경 */
  'tooltip-bg': '#1f1f1f',
  /** 어두운 Tooltip 그림자 */
  'tooltip-shadow': 'rgb(15 23 42 / 28%)',
  /** Tooltip 헤더 구분선 */
  'tooltip-header-divider': 'rgb(255 255 255 / 14%)',
  /** Tooltip 구분선 */
  'tooltip-divider': 'rgb(255 255 255 / 10%)',
  /** Tooltip 요약 블록 배경 */
  'tooltip-summary-bg': 'rgb(255 255 255 / 5%)',
  /** Tooltip 요약 보조 텍스트 */
  'tooltip-summary-muted': 'rgb(255 255 255 / 60%)',
  /** Tooltip 항목명 */
  'tooltip-term': 'rgb(255 255 255 / 62%)',
  /** Tooltip 항목값 */
  'tooltip-definition': 'rgb(255 255 255 / 90%)',
  /** Tooltip 상단 라벨 */
  'tooltip-eyebrow': '#91caff',
  /** Tooltip 주의 항목 */
  'tooltip-caution': '#fcd34d',
  /** 사용량 진행 바 트랙 */
  'usage-track-bg': '#e8eef7',
  /** 차트 미채움 트랙 */
  'chart-track-bg': APP_COLOR.chartTrackBg
};
