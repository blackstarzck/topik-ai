import { describe, expect, it } from 'vitest';

import {
  CHART_LABEL_FONT_PX,
  computeCategoryChartLayout,
  estimateTextWidthPx
} from '../../src/features/assessment/model/category-chart-layout';

/**
 * 차트 라벨을 14px 로 그리려면 기하가 라벨 폭을 따라가야 한다.
 *
 * 이 계산이 틀리면 라벨이 겹치는데, **겹침은 e2e 로 잡기 어렵다**(SVG 텍스트는 서로를 가려도
 * DOM 상으로는 둘 다 보인다). 그래서 "라벨 폭 + 최소 여백 ≤ 배정된 자리" 불변식을 여기서
 * 숫자로 고정한다.
 */
const TICKS = ['0', '25', '50', '75', '100'];

function layoutOf(categories: string[], seriesCount = 1, valueLabels: string[] = []) {
  return computeCategoryChartLayout({
    categories,
    tickLabels: TICKS,
    valueLabels,
    seriesCount
  });
}

describe('estimateTextWidthPx', () => {
  it('한글은 라틴·숫자보다 넓게 센다', () => {
    expect(estimateTextWidthPx('한국어')).toBeGreaterThan(estimateTextWidthPx('abc'));
    expect(estimateTextWidthPx('2024')).toBe(Math.ceil(4 * 0.6 * CHART_LABEL_FONT_PX));
  });

  it('빈 문자열은 0 이다', () => {
    expect(estimateTextWidthPx('')).toBe(0);
  });
});

describe('computeCategoryChartLayout', () => {
  it('짧은 범주 4개는 기본 폭 안에 들어간다', () => {
    const layout = layoutOf(['2021', '2022', '2023', '2024']);

    expect(layout.width).toBe(360);
    expect(layout.height).toBe(240);
  });

  it('범주 라벨이 배정된 밴드보다 넓지 않다', () => {
    for (const categories of [
      ['2021', '2022', '2023', '2024'],
      ['상반기', '하반기'],
      ['20대 이하', '30대', '40대', '50대', '60대 이상'],
      Array.from({ length: 14 }, (_, index) => `${2010 + index}년`)
    ]) {
      const layout = layoutOf(categories);
      const widest = Math.max(...categories.map((label) => estimateTextWidthPx(label)));

      expect(layout.bandWidth, categories.join('/')).toBeGreaterThanOrEqual(widest);
    }
  });

  it('범주가 늘어나면 폭이 늘어난다 — 라벨을 생략하지 않는다', () => {
    const few = layoutOf(['2023', '2024']);
    const many = layoutOf(Array.from({ length: 20 }, (_, index) => `${2005 + index}년`));

    expect(many.width).toBeGreaterThan(few.width);
    expect(many.bandWidth).toBeGreaterThanOrEqual(estimateTextWidthPx('2005년'));
  });

  it('긴 한글 범주도 겹치지 않게 밴드를 넓힌다', () => {
    const categories = ['국민연금 수급자', '기초연금 수급자', '둘 다 받는 사람'];
    const layout = layoutOf(categories);

    expect(layout.bandWidth).toBeGreaterThanOrEqual(estimateTextWidthPx(categories[0]));
    expect(layout.width).toBeGreaterThan(360);
  });

  it('y축 눈금 라벨이 왼쪽 여백 안에 들어간다', () => {
    const layout = computeCategoryChartLayout({
      categories: ['2023', '2024'],
      tickLabels: ['0', '2,500', '5,000', '7,500', '10,000'],
      valueLabels: [],
      seriesCount: 1
    });

    expect(layout.margin.left).toBeGreaterThanOrEqual(estimateTextWidthPx('10,000'));
  });

  it('값 라벨을 그리면 계열 수만큼 자리를 확보한다', () => {
    // 🚨 "값 라벨을 켜면 밴드가 넓어진다"로 단언하면 안 된다 — 범주가 적으면 기본 폭 하한이
    // 지배해서 밴드가 이미 충분히 넓고, 값 라벨용 오른쪽 여백이 늘어 오히려 좁아질 수도 있다.
    // 지켜야 하는 것은 "값 라벨이 배정된 자리에 들어간다"는 불변식이다.
    const withValues = layoutOf(['2023', '2024'], 2, ['1,234', '2,345', '3,456', '4,567']);

    expect(withValues.bandWidth).toBeGreaterThanOrEqual(estimateTextWidthPx('4,567') * 2);
  });

  it('범주가 많으면 값 라벨 폭이 전체 폭을 끌어올린다', () => {
    const categories = Array.from({ length: 12 }, (_, index) => `${2013 + index}`);
    const longValues = categories.map(() => '1,234,567');
    const withoutValues = layoutOf(categories, 2);
    const withValues = layoutOf(categories, 2, longValues);

    expect(withValues.width).toBeGreaterThan(withoutValues.width);
    expect(withValues.bandWidth).toBeGreaterThanOrEqual(estimateTextWidthPx('1,234,567') * 2);
  });

  it('x축 라벨 줄이 들어갈 아래 여백을 남긴다', () => {
    const layout = layoutOf(['2023', '2024']);

    expect(layout.margin.bottom).toBeGreaterThanOrEqual(CHART_LABEL_FONT_PX);
    expect(layout.plotHeight).toBeGreaterThan(0);
  });

  it('범주가 없어도 0 으로 나누지 않는다', () => {
    const layout = layoutOf([]);

    expect(Number.isFinite(layout.bandWidth)).toBe(true);
    expect(layout.bandWidth).toBeGreaterThan(0);
    expect(Number.isFinite(layout.barWidth)).toBe(true);
  });

  it('막대 폭은 계열이 많아도 양수로 남는다', () => {
    const layout = layoutOf(['2023', '2024'], 8);

    expect(layout.barWidth).toBeGreaterThan(0);
    expect(layout.groupWidth).toBeLessThanOrEqual(layout.bandWidth);
  });

  it('라벨 기준 크기는 14px 미만으로 내려가지 않는다', () => {
    expect(CHART_LABEL_FONT_PX).toBeGreaterThanOrEqual(14);
  });
});
