import { Typography } from 'antd';
import { APP_COLOR, COLOR, FONT_SIZE, RADIUS, SPACE } from '@/shared/styles/design-tokens';

import {
  CHART_LABEL_FONT_PX,
  computeCategoryChartLayout
} from '../model/category-chart-layout';

const { Text } = Typography;

/**
 * 53번(자료 설명형) 문항의 source_data(JSONB 수치)를 차트로 시각화한다.
 *
 * source_data는 chart_a·chart_b … 키로 차트를 담고, chart_roles 같은 비차트
 * 키도 함께 들어온다(series 없는 항목은 건너뛴다). 각 차트는 chart_type
 * (bar/line/pie/donut, 누락 시 bar)·title·unit·survey_org·year_range(범주축,
 * 숫자/문자 혼용)·series([{ label|name, values[] }])를 갖는다. 외부 차트
 * 라이브러리 없이 인라인 SVG로 그려 의존성을 늘리지 않는다.
 */

type ChartKind = 'bar' | 'line' | 'pie' | 'donut';

type ChartSeries = {
  label: string;
  values: number[];
};

type NormalizedChart = {
  key: string;
  kind: ChartKind;
  title: string;
  unit: string;
  surveyOrg: string;
  categories: string[];
  series: ChartSeries[];
};

const PALETTE = [
  '#1677ff',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#13c2c2',
  '#722ed1',
  '#faad14',
  '#2f54eb'
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** 축 눈금이 깔끔한 상한값(1·2·5 × 10^n)으로 올림한다. */
function niceMax(rawMax: number): number {
  if (rawMax <= 0) {
    return 1;
  }
  const power = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const normalized = rawMax / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
}

function normalizeChart(key: string, raw: unknown): NormalizedChart | null {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.series)) {
    return null;
  }

  const series: ChartSeries[] = (record.series as unknown[])
    .map(asRecord)
    .filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && Array.isArray(entry.values)
    )
    .map((entry, index) => ({
      label:
        typeof entry.label === 'string'
          ? entry.label
          : typeof entry.name === 'string'
            ? entry.name
            : `계열 ${index + 1}`,
      values: (entry.values as unknown[]).map(toNumber)
    }));

  if (series.length === 0) {
    return null;
  }

  const rawKind =
    typeof record.chart_type === 'string' ? record.chart_type.toLowerCase() : '';
  const kind: ChartKind =
    rawKind === 'line'
      ? 'line'
      : rawKind === 'pie'
        ? 'pie'
        : rawKind === 'donut'
          ? 'donut'
          : 'bar';

  const longestValueCount = Math.max(...series.map((entry) => entry.values.length), 1);
  const categories =
    Array.isArray(record.year_range) && record.year_range.length > 0
      ? (record.year_range as unknown[]).map((value) => String(value))
      : Array.from({ length: longestValueCount }, (_, index) => `${index + 1}`);

  return {
    key,
    kind,
    title: typeof record.title === 'string' && record.title.trim() ? record.title : key,
    unit: typeof record.unit === 'string' ? record.unit : '',
    surveyOrg: typeof record.survey_org === 'string' ? record.survey_org : '',
    categories,
    series
  };
}

export function parseSourceDataCharts(sourceData: unknown): NormalizedChart[] {
  const record = asRecord(sourceData);
  if (!record) {
    return [];
  }

  const charts: NormalizedChart[] = [];
  for (const [key, value] of Object.entries(record)) {
    const chart = normalizeChart(key, value);
    if (chart) {
      charts.push(chart);
    }
  }
  return charts;
}

/** pie/donut 슬라이스 도출 — 다계열(각 1값)은 계열별, 단일계열(다값)은 범주별. */
function toSlices(chart: NormalizedChart): { label: string; value: number }[] {
  if (
    chart.series.length > 1 &&
    chart.series.every((entry) => entry.values.length <= 1)
  ) {
    return chart.series.map((entry) => ({
      label: entry.label,
      value: entry.values[0] ?? 0
    }));
  }

  const first = chart.series[0];
  if (first && first.values.length > 1) {
    return first.values.map((value, index) => ({
      label: chart.categories[index] ?? `${index + 1}`,
      value
    }));
  }

  return chart.series.map((entry) => ({
    label: entry.label,
    value: entry.values.reduce((sum, value) => sum + value, 0)
  }));
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const outerStart = polar(cx, cy, rOuter, startAngle);
  const outerEnd = polar(cx, cy, rOuter, endAngle);

  if (rInner <= 0) {
    return [
      `M ${r2(cx)} ${r2(cy)}`,
      `L ${r2(outerStart.x)} ${r2(outerStart.y)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${r2(outerEnd.x)} ${r2(outerEnd.y)}`,
      'Z'
    ].join(' ');
  }

  const innerEnd = polar(cx, cy, rInner, endAngle);
  const innerStart = polar(cx, cy, rInner, startAngle);
  return [
    `M ${r2(outerStart.x)} ${r2(outerStart.y)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${r2(outerEnd.x)} ${r2(outerEnd.y)}`,
    `L ${r2(innerEnd.x)} ${r2(innerEnd.y)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${r2(innerStart.x)} ${r2(innerStart.y)}`,
    'Z'
  ].join(' ');
}

function LegendRow({
  items
}: {
  items: { label: string; color: string; suffix?: string }[];
}): JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        marginTop: SPACE.sm
      }}
    >
      {items.map((item) => (
        <span
          key={item.label}
          style={{ display: 'inline-flex', alignItems: 'center', gap: SPACE.xs, fontSize: FONT_SIZE.base }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: RADIUS.xs,
              background: item.color,
              flexShrink: 0
            }}
          />
          <Text style={{ fontSize: FONT_SIZE.base }}>
            {item.label}
            {item.suffix ? <Text type="secondary">{` ${item.suffix}`}</Text> : null}
          </Text>
        </span>
      ))}
    </div>
  );
}

function CategoryChart({ chart }: { chart: NormalizedChart }): JSX.Element {
  const allValues = chart.series.flatMap((entry) => entry.values);
  const maxVal = niceMax(Math.max(1, ...allValues));
  const seriesCount = chart.series.length;
  const isLine = chart.kind === 'line';
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => maxVal * ratio);

  // 값 라벨은 계열 수 조건을 만족할 때만 그린다 — 기하 계산에도 같은 조건을 넘긴다.
  const showsValueLabels = isLine ? seriesCount === 1 : seriesCount <= 2;

  /**
   * 라벨을 14px 로 그리려면 기하가 라벨 폭을 따라가야 한다(고정 폭 + 스케일 방식으로는
   * 실제 렌더 크기가 컨테이너에 따라 달라져 규칙을 지킬 수 없다 — 모듈 주석 참고).
   */
  const layout = computeCategoryChartLayout({
    categories: chart.categories,
    tickLabels: ticks.map((tick) => formatNumber(tick)),
    valueLabels: showsValueLabels ? allValues.map((value) => formatNumber(value)) : [],
    seriesCount
  });
  const { width, height, margin } = layout;
  const plotW = layout.plotWidth;
  const plotH = layout.plotHeight;
  const bandW = layout.bandWidth;
  const groupW = layout.groupWidth;
  const barW = layout.barWidth;

  const xCenter = (index: number) => margin.left + bandW * (index + 0.5);
  const yOf = (value: number) => margin.top + plotH - (value / maxVal) * plotH;

  return (
    <div>
      {/* 라벨 크기를 지키려고 스케일하지 않는다 — 좁은 컨테이너에서는 가로로 스크롤한다. */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={`${chart.title} ${chart.kind} 차트`}
        style={{ display: 'block' }}
      >
        {/* 가로 그리드 + y축 눈금 */}
        {ticks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + plotW}
                y2={y}
                stroke={APP_COLOR.chartGridLine}
                strokeWidth={1}
              />
              <text
                x={margin.left - 8}
                y={y + CHART_LABEL_FONT_PX / 3}
                textAnchor="end"
                fontSize={CHART_LABEL_FONT_PX}
                fill={COLOR.textTertiary}
              >
                {formatNumber(tick)}
              </text>
            </g>
          );
        })}

        {/* 축 */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotH}
          stroke={COLOR.border}
        />
        <line
          x1={margin.left}
          y1={margin.top + plotH}
          x2={margin.left + plotW}
          y2={margin.top + plotH}
          stroke={COLOR.border}
        />

        {/* 막대 */}
        {!isLine &&
          chart.series.map((entry, seriesIndex) =>
            entry.values.map((value, categoryIndex) => {
              const x =
                xCenter(categoryIndex) - groupW / 2 + barW * seriesIndex;
              const y = yOf(value);
              const barHeight = margin.top + plotH - y;
              return (
                <g key={`bar-${seriesIndex}-${categoryIndex}`}>
                  <rect
                    x={r2(x)}
                    y={r2(y)}
                    width={r2(Math.max(barW - 2, 1))}
                    height={r2(Math.max(barHeight, 0))}
                    fill={PALETTE[seriesIndex % PALETTE.length]}
                    rx={2}
                  />
                  {showsValueLabels ? (
                    <text
                      x={r2(x + Math.max(barW - 2, 1) / 2)}
                      y={r2(y - 5)}
                      textAnchor="middle"
                      fontSize={CHART_LABEL_FONT_PX}
                      fill={COLOR.textSecondary}
                    >
                      {formatNumber(value)}
                    </text>
                  ) : null}
                </g>
              );
            })
          )}

        {/* 선 */}
        {isLine &&
          chart.series.map((entry, seriesIndex) => {
            const color = PALETTE[seriesIndex % PALETTE.length];
            const points = entry.values
              .map((value, index) => `${r2(xCenter(index))},${r2(yOf(value))}`)
              .join(' ');
            return (
              <g key={`line-${seriesIndex}`}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {entry.values.map((value, index) => (
                  <g key={`point-${seriesIndex}-${index}`}>
                    <circle
                      cx={r2(xCenter(index))}
                      cy={r2(yOf(value))}
                      r={3}
                      fill={COLOR.bgContainer}
                      stroke={color}
                      strokeWidth={2}
                    />
                    {showsValueLabels ? (
                      <text
                        x={r2(xCenter(index))}
                        y={r2(yOf(value) - 9)}
                        textAnchor="middle"
                        fontSize={CHART_LABEL_FONT_PX}
                        fill={COLOR.textSecondary}
                      >
                        {formatNumber(value)}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
            );
          })}

        {/* x축 범주 라벨 */}
        {chart.categories.map((category, index) => (
          <text
            key={`cat-${index}`}
            x={r2(xCenter(index))}
            y={margin.top + plotH + CHART_LABEL_FONT_PX + 6}
            textAnchor="middle"
            fontSize={CHART_LABEL_FONT_PX}
            fill={COLOR.textSecondary}
          >
            {category}
          </text>
        ))}
      </svg>
      </div>

      {seriesCount > 1 ? (
        <LegendRow
          items={chart.series.map((entry, index) => ({
            label: entry.label,
            color: PALETTE[index % PALETTE.length]
          }))}
        />
      ) : null}
    </div>
  );
}

function PieChart({ chart }: { chart: NormalizedChart }): JSX.Element {
  const slices = toSlices(chart);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 84;
  const rInner = chart.kind === 'donut' ? 46 : 0;

  let cursor = 0;

  return (
    <div style={{ display: 'flex', gap: SPACE.base, flexWrap: 'wrap', alignItems: 'center' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${chart.title} ${chart.kind} 차트`}
        style={{ width: 180, height: 180, flexShrink: 0 }}
      >
        {total <= 0 ? (
          <circle cx={cx} cy={cy} r={rOuter} fill={COLOR.borderSecondary} />
        ) : slices.length === 1 ? (
          <g>
            <circle cx={cx} cy={cy} r={rOuter} fill={PALETTE[0]} />
            {rInner > 0 ? <circle cx={cx} cy={cy} r={rInner} fill={COLOR.bgContainer} /> : null}
          </g>
        ) : (
          slices.map((slice, index) => {
            const sweep = (slice.value / total) * 360;
            const start = cursor;
            const end = cursor + sweep;
            cursor = end;
            return (
              <path
                key={`slice-${slice.label}-${index}`}
                d={arcPath(cx, cy, rOuter, rInner, start, end)}
                fill={PALETTE[index % PALETTE.length]}
                stroke={COLOR.bgContainer}
                strokeWidth={1}
              />
            );
          })
        )}
      </svg>

      <div style={{ minWidth: 0 }}>
        <LegendRow
          items={slices.map((slice, index) => {
            const valueText = `${formatNumber(slice.value)}${chart.unit}`;
            // 단위가 이미 %면 비중 표기가 중복되므로 값만 노출한다.
            const showShare = total > 0 && chart.unit.trim() !== '%';
            return {
              label: slice.label,
              color: PALETTE[index % PALETTE.length],
              suffix: showShare
                ? `${valueText} · ${Math.round((slice.value / total) * 100)}%`
                : valueText
            };
          })}
        />
      </div>
    </div>
  );
}

function ChartCard({ chart }: { chart: NormalizedChart }): JSX.Element {
  const isComposition = chart.kind === 'pie' || chart.kind === 'donut';
  return (
    <div
      style={{
        flex: '1 1 300px',
        minWidth: 0,
        border: `1px solid ${APP_COLOR.chartPanelBorder}`,
        borderRadius: RADIUS.lg,
        padding: '12px 16px',
        background: COLOR.bgContainer
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.xs, flexWrap: 'wrap' }}>
        <Text strong>{chart.title}</Text>
        {chart.unit ? <Text type="secondary">{`(단위: ${chart.unit})`}</Text> : null}
      </div>
      {chart.surveyOrg ? (
        <div style={{ marginBottom: SPACE.xxs }}>
          <Text type="secondary" style={{ fontSize: FONT_SIZE.base }}>
            {`출처: ${chart.surveyOrg}`}
          </Text>
        </div>
      ) : null}
      {isComposition ? <PieChart chart={chart} /> : <CategoryChart chart={chart} />}
    </div>
  );
}

export function SourceDataCharts({ sourceData }: { sourceData: unknown }): JSX.Element {
  const charts = parseSourceDataCharts(sourceData);

  if (charts.length === 0) {
    // 차트로 해석할 수 없는 수치는 원본 JSON 그대로 노출(정보 손실 방지).
    return (
      <pre
        style={{
          margin: 0,
          maxHeight: 260,
          overflow: 'auto',
          fontSize: FONT_SIZE.base,
          background: APP_COLOR.codeBlockBg,
          padding: SPACE.xs
        }}
      >
        {JSON.stringify(sourceData, null, 2)}
      </pre>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.base }}>
        {charts.map((chart) => (
          <ChartCard key={chart.key} chart={chart} />
        ))}
      </div>

      <details style={{ marginTop: SPACE.sm }}>
        <summary style={{ cursor: 'pointer', fontSize: FONT_SIZE.base, color: COLOR.textTertiary }}>
          원본 수치(JSON) 보기
        </summary>
        <pre
          style={{
            margin: '8px 0 0',
            maxHeight: 260,
            overflow: 'auto',
            fontSize: FONT_SIZE.base,
            background: APP_COLOR.codeBlockBg,
            padding: SPACE.xs
          }}
        >
          {JSON.stringify(sourceData, null, 2)}
        </pre>
      </details>
    </div>
  );
}
