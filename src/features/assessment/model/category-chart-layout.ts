import { FONT_SIZE } from '@/shared/styles/design-tokens';

/**
 * 53번(자료 설명형) 범주축 차트의 기하 계산.
 *
 * 🚨 **SVG 안의 `fontSize` 는 CSS 픽셀이 아니다** — viewBox 가 스케일되면 함께 스케일된다.
 * 이전 구현은 `viewBox="0 0 360 220"` 을 `width: '100%', maxWidth: 480` 으로 늘려 그렸으므로
 * `fontSize={9}` 의 실제 크기는 컨테이너 폭에 따라 달라졌다(480px 로 늘면 12px, 360px 미만으로
 * 줄면 9px 미만). 어느 경우에도 가시 텍스트 최소 14px 규칙(오너 지시 2026-07-14)을 만족하지
 * 못했고, 게이트는 JSX 속성형(`fontSize={9}`)을 정규식이 놓쳐 이를 보지 못했다.
 *
 * 그래서 차트를 **스케일하지 않는다**. viewBox 단위 = CSS 픽셀이 되도록 산출 폭 그대로 그리고,
 * 좁은 컨테이너에서는 가로 스크롤로 넘긴다. 대신 폭·여백·밴드 너비를 **라벨이 겹치지 않는
 * 최소값**으로 계산해야 한다 — 이 모듈이 그 계산이다(순수 함수라 단위 테스트로 고정한다).
 */

/** 축·값 라벨 크기. 규칙상 14px 미만으로 내릴 수 없다. */
export const CHART_LABEL_FONT_PX = FONT_SIZE.base;

/** 라벨 사이 최소 여백(px). 이보다 좁으면 시각적으로 붙어 보인다. */
const LABEL_GAP_PX = 8;

/** 차트 기본(최소) 폭·높이. 라벨이 요구하면 폭만 늘어난다. */
const BASE_WIDTH_PX = 360;
const HEIGHT_PX = 240;

/**
 * 문자열의 렌더 폭 추정치(px).
 *
 * 실제 측정 없이 계산해야 하므로(SSR·단위 테스트 포함) 폭이 다른 두 부류로만 나눈다 —
 * CJK·전각은 약 1em, 그 밖(숫자·라틴·구두점)은 약 0.6em. 과소추정은 겹침을 만들므로
 * 경계에서는 **넉넉한 쪽**으로 반올림한다.
 */
export function estimateTextWidthPx(text: string, fontPx = CHART_LABEL_FONT_PX): number {
  let units = 0;
  for (const char of text) {
    units += isWideChar(char) ? 1 : 0.6;
  }
  return Math.ceil(units * fontPx);
}

function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) || // 한글 자모
    (code >= 0x2e80 && code <= 0xa4cf) || // CJK 부수·한자·가나
    (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
    (code >= 0xf900 && code <= 0xfaff) || // CJK 호환 한자
    (code >= 0xfe30 && code <= 0xfe6f) || // CJK 호환 형식
    (code >= 0xff00 && code <= 0xff60) || // 전각 영숫자
    (code >= 0xffe0 && code <= 0xffe6)
  );
}

export type CategoryChartLayout = {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  plotWidth: number;
  plotHeight: number;
  bandWidth: number;
  /** 그룹(한 범주 안 전체 막대) 폭. */
  groupWidth: number;
  /** 막대 하나의 폭. */
  barWidth: number;
};

export type CategoryChartLayoutInput = {
  categories: string[];
  /** y축 눈금에 표시될 문자열들(최댓값 산출 후 형식화된 것). */
  tickLabels: string[];
  /** 막대 위·꼭짓점 위에 표시될 값 문자열들. 표시하지 않으면 빈 배열. */
  valueLabels: string[];
  seriesCount: number;
};

/**
 * 라벨이 겹치지 않는 최소 기하를 계산한다.
 *
 * - `margin.left` = 가장 긴 y축 눈금 라벨 + 눈금선 간격.
 * - `margin.bottom` = x축 범주 라벨 한 줄 + 축과의 간격.
 * - `bandWidth` = 범주 라벨과 값 라벨 중 더 넓은 것 + 최소 여백. 범주 수를 곱해 폭을 늘린다.
 *   폭이 늘어난 만큼 컨테이너에서 가로 스크롤이 생긴다(라벨을 생략하거나 줄이지 않는다).
 */
export function computeCategoryChartLayout({
  categories,
  tickLabels,
  valueLabels,
  seriesCount
}: CategoryChartLayoutInput): CategoryChartLayout {
  const categoryCount = Math.max(1, categories.length);
  const series = Math.max(1, seriesCount);

  const widestTick = maxTextWidth(tickLabels);
  const widestCategory = maxTextWidth(categories);
  const widestValue = maxTextWidth(valueLabels);

  const margin = {
    top: Math.ceil(CHART_LABEL_FONT_PX * 1.6),
    right: Math.max(14, Math.ceil(widestValue / 2) + 4),
    // 라벨 한 줄(폰트의 약 1.4배 줄높이) + 축선과의 간격.
    bottom: Math.ceil(CHART_LABEL_FONT_PX * 1.4) + 16,
    left: widestTick + LABEL_GAP_PX + 8
  };

  // 값 라벨은 계열마다 하나씩 나란히 놓이므로 밴드 안에서 계열 수만큼 자리를 차지한다.
  const valueRowWidth = valueLabels.length > 0 ? (widestValue + LABEL_GAP_PX) * series : 0;
  const minBandWidth = Math.max(
    widestCategory + LABEL_GAP_PX,
    valueRowWidth,
    // 막대가 보이지 않을 정도로 좁아지지 않게 하는 하한.
    series * 12
  );

  const basePlotWidth = BASE_WIDTH_PX - margin.left - margin.right;
  const plotWidth = Math.max(basePlotWidth, minBandWidth * categoryCount);
  const width = plotWidth + margin.left + margin.right;
  const plotHeight = HEIGHT_PX - margin.top - margin.bottom;
  const bandWidth = plotWidth / categoryCount;
  const groupWidth = bandWidth * 0.66;

  return {
    width,
    height: HEIGHT_PX,
    margin,
    plotWidth,
    plotHeight,
    bandWidth,
    groupWidth,
    barWidth: groupWidth / series
  };
}

function maxTextWidth(texts: string[]): number {
  return texts.reduce((widest, text) => Math.max(widest, estimateTextWidthPx(text)), 0);
}
