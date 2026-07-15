import {
  BarChartOutlined,
  DownloadOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  TableOutlined
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  DatePicker,
  Divider,
  Drawer,
  Empty,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import type { TableColumnsType, ThemeConfig } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import {
  createMockLearningAnalytics,
  fetchLearningAnalyticsFilterOptionsSafe,
  fetchLearningAnalyticsSafe,
  mockLearningAnalyticsFilterOptions,
  type LearningAnalytics,
  type LearningAnalyticsFilterOptions,
  type LearningAnalyticsQuestionStat,
  type LearningAnalyticsTopicStat
} from '../api/analytics-learning-service';
import {
  areLearningAnalyticsQueriesEqual,
  countLearningAnalyticsConditions,
  defaultLearningAnalyticsQuery,
  learningDetailKeysByQuestion,
  learningPeriodLabels,
  learningQuestionLabels,
  parseLearningAnalyticsQuery,
  resolveLearningAnalyticsDateRange,
  serializeLearningAnalyticsQuery,
  type LearningAnalyticsPeriod,
  type LearningAnalyticsQuery,
  type LearningDetailFilterKey,
  type LearningQuestionNo
} from '../model/analytics-learning-query';
import { createLearningAnalyticsCsv } from '../model/analytics-learning-csv';
import { getLearningAnalyticsMetadataCoverageState } from '../model/analytics-learning-metadata-coverage';
import {
  DrawerFooter,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '../../../shared/ui/drawer-frame/drawer-frame';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

import './analytics-learning-page.css';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type KpiKey =
  | 'activeLearners'
  | 'submissions'
  | 'completionRate'
  | 'avgScore'
  | 'feedbackViewRate'
  | 'elapsedTime'
  | 'processingTime'
  | 'pdfExports';

type MetricDefinition = {
  key: KpiKey;
  category: string;
  label: string;
  definition: string;
  formula: string;
  inclusion: string;
  caution: string;
};

// 지표 사전 문구는 비개발 운영자 기준(오너, 2026-07-15): DB·SQL 용어와 '귀속/커버리지' 같은
// 전문어를 쓰지 않는다. e2e가 평균 환산 점수 계산 방법 문구를 검증하므로 수정 시 스펙도 함께 갱신.
const metricDefinitions: MetricDefinition[] = [
  {
    key: 'activeLearners',
    category: '규모',
    label: '해당 조건 학습자',
    definition: '선택한 기간·문제 유형·주제에서 학습 활동을 한 번이라도 남긴 사람 수입니다. 같은 사람이 여러 번 활동해도 1명으로 셉니다.',
    formula: '조건에 연결되는 학습 활동이 있는 사람을 중복 없이 셉니다.',
    inclusion: '어떤 문제에 대한 활동인지 확인할 수 있는 기록만 셉니다.',
    caution: '어떤 문제에 대한 활동인지 알 수 없는 기록은 추측으로 나눠 넣지 않고 집계에서 뺍니다.'
  },
  {
    key: 'submissions',
    category: '규모',
    label: '제출 수',
    definition: '선택한 조건에서 학습자가 TOPIK 쓰기 답안을 제출한 횟수입니다.',
    formula: '조건에 맞는 답안 제출 건수를 모두 더합니다.',
    inclusion: '51~54번 문제 중 선택한 기간·유형·주제 조건에 맞는 제출만 셉니다.',
    caution: '같은 사람이 같은 문제를 다시 제출해도 각각 1건으로 셉니다.'
  },
  {
    key: 'completionRate',
    category: '성과',
    label: '피드백 완료율',
    definition: '제출된 답안 중 AI 피드백까지 완성된 비율입니다.',
    formula: '피드백이 완성된 제출 ÷ 전체 제출 × 100',
    inclusion: '아직 처리 중이거나 실패한 제출도 전체 제출(나누는 수)에 포함해 계산합니다.',
    caution: '지난 기간과의 변화는 %p(퍼센트포인트) 차이로 표시합니다. 예: 80%에서 85%가 되면 +5.0%p입니다.'
  },
  {
    key: 'avgScore',
    category: '성과',
    label: '평균 환산 점수',
    definition: '문제마다 만점이 달라서, 각 점수를 100점 만점 기준으로 바꾼 뒤 평균낸 값입니다.',
    formula: '(받은 점수 ÷ 그 문제의 만점) × 100을 제출마다 구한 뒤 평균냅니다.',
    inclusion: '점수와 만점이 모두 정상적으로 기록된 피드백 완료 제출만 사용합니다.',
    caution: '51~54번은 만점이 서로 달라 원점수를 그대로 평균내면 왜곡되므로, 100점으로 바꾼 뒤 평균냅니다.'
  },
  {
    key: 'feedbackViewRate',
    category: '행동',
    label: '피드백 조회율',
    definition: '완성된 피드백 중 학습자가 실제로 한 번 이상 열어 본 비율입니다.',
    formula: '열어 본 피드백 ÷ 완성된 피드백 전체 × 100',
    inclusion: '어느 제출의 피드백을 봤는지 확인되는 조회 기록만 셉니다.',
    caution: '같은 피드백을 여러 번 열어 봐도 1건으로 셉니다.'
  },
  {
    key: 'elapsedTime',
    category: '행동',
    label: '평균 풀이 시간',
    definition: '학습자가 문제를 푸는 데 걸린 시간의 평균입니다.',
    formula: '풀이 시간이 기록된 제출들의 시간을 모두 더해 평균냅니다.',
    inclusion: '풀이 시간이 정상적으로 기록된 제출만 사용합니다.',
    caution: '기록된 제출이 하나도 없으면 0초가 아니라 미수집으로 표시합니다.'
  },
  {
    key: 'processingTime',
    category: '운영',
    label: '처리 시간 중앙값',
    definition: '답안 제출 후 AI 피드백이 완성될 때까지 걸린 시간의 중앙값입니다. 전체 건의 절반은 이보다 빠르고, 절반은 느립니다.',
    formula: '제출부터 피드백 완성까지 걸린 시간을 짧은 순서로 늘어놓았을 때 한가운데 값을 씁니다.',
    inclusion: '피드백이 언제 완성됐는지 기록된 완료 제출만 사용합니다.',
    caution: '재처리 등으로 유난히 오래 걸린 소수 건이 값을 끌어올리지 않도록 평균 대신 중앙값을 씁니다.'
  },
  {
    key: 'pdfExports',
    category: '운영',
    label: 'PDF 내보내기 완료 수',
    definition: '선택한 기간에 피드백 PDF 내보내기가 완료된 횟수입니다.',
    formula: 'PDF 내보내기 완료 기록을 모두 더합니다.',
    inclusion: '문제 유형·주제 필터를 쓰면, 어떤 문제의 PDF인지 확인되는 건만 이 지표에 넣습니다.',
    caution: '앱에서 내보내기가 완료된 횟수라서, 파일이 기기에 실제로 저장됐는지까지 보장하지는 않습니다.'
  }
];

const detailFilterLabels: Record<LearningDetailFilterKey, string> = {
  blankRole: '빈칸 역할',
  blankFunction: '빈칸 기능',
  answerType: '정답 표현 종류',
  connectionFunction: '연결 기능',
  answerScope: '허용 답안 범위',
  dataType: '자료 유형',
  requiredStructure: '요구 글 구성',
  essayType: '논술 유형',
  stance: '요구 관점'
};

const periodOptions: Array<{ label: string; value: LearningAnalyticsPeriod }> = [
  { label: '최근 7일', value: '7d' },
  { label: '30일', value: '30d' },
  { label: '90일', value: '90d' },
  { label: '전체', value: 'all' },
  { label: '직접 선택', value: 'custom' }
];

const scoreColors = ['#2563eb', '#0ea5e9', '#8b5cf6', '#5b21b6'];

// 학습 분석 페이지 타이포 기준: antd 베이스 16px(파생 SM 14px). 가시 텍스트는 14px 미만 금지.
const learningTypographyTheme: ThemeConfig = { token: { fontSize: 16 } };

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null) {
    return '—';
  }
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDuration(value: number | null): string {
  if (value == null) {
    return '미수집';
  }
  if (value >= 3600) {
    return `${Math.floor(value / 3600)}시간 ${Math.floor((value % 3600) / 60)}분`;
  }
  if (value >= 60) {
    return `${Math.floor(value / 60)}분 ${String(Math.round(value % 60)).padStart(2, '0')}초`;
  }
  return `${Math.round(value)}초`;
}

function relativeChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatRefreshTime(value: Date | null): string {
  if (!value) {
    return '갱신 대기';
  }
  return value
    .toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    .replace(/\. /g, '-')
    .replace('.', '');
}

type TrendProps = {
  current: number | null;
  previous: number | null;
  mode: 'relative' | 'point' | 'duration';
  suffix?: string;
  lowerIsBetter?: boolean;
};

function MetricTrend({
  current,
  previous,
  mode,
  suffix = '',
  lowerIsBetter = false
}: TrendProps): JSX.Element | null {
  if (current == null || previous == null) {
    return null;
  }
  const delta = mode === 'relative' ? relativeChange(current, previous) : current - previous;
  if (delta == null) {
    return null;
  }
  const isUp = delta > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;
  const text =
    mode === 'duration'
      ? formatDuration(Math.abs(delta))
      : `${formatNumber(Math.abs(delta), 1)}${mode === 'relative' ? '%' : suffix}`;
  return (
    <span className={`analytics-learning-trend ${isGood ? 'is-good' : 'is-bad'}`}>
      <span aria-hidden="true">{isUp ? '▲' : '▼'}</span> {text}
    </span>
  );
}

type KpiCardProps = {
  definition: MetricDefinition;
  value: ReactNode;
  unit?: string;
  trend?: ReactNode;
  helper: ReactNode;
  loading: boolean;
  onOpenDefinition: (key: KpiKey) => void;
};

function KpiCard({
  definition,
  value,
  unit,
  trend,
  helper,
  loading,
  onOpenDefinition
}: KpiCardProps): JSX.Element {
  return (
    <Card className="analytics-kpi-card" loading={loading} variant="outlined">
      <Text className="analytics-kpi-category">{definition.category}</Text>
      <div className="analytics-kpi-title-row">
        <Text strong>{definition.label}</Text>
        <Button
          type="text"
          size="small"
          shape="circle"
          className="analytics-kpi-info"
          aria-label={`${definition.label} 지표 설명`}
          icon={<InfoCircleOutlined />}
          onClick={() => onOpenDefinition(definition.key)}
        />
      </div>
      <div className="analytics-kpi-value-row">
        <span className="analytics-kpi-value">{value}</span>
        {unit ? <span className="analytics-kpi-unit">{unit}</span> : null}
        {trend}
      </div>
      <Text className="analytics-kpi-helper">{helper}</Text>
    </Card>
  );
}

function copyTextFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function getAppliedConditionTags(query: LearningAnalyticsQuery): string[] {
  const tags = [
    query.period === 'custom' && query.from && query.to
      ? `${query.from}~${query.to}`
      : learningPeriodLabels[query.period]
  ];
  if (query.questions.length === 4) {
    tags.push('51~54번 전체');
  } else {
    tags.push(...query.questions.map((question) => `${question}번`));
  }
  if (query.compare && query.period !== 'all') {
    tags.push('이전 동일 기간');
  }
  if (query.topicMain) {
    tags.push(query.topicMain);
  }
  if (query.topicDetail) {
    tags.push(query.topicDetail);
  }
  for (const [key, values] of Object.entries(query.detailFilters)) {
    for (const value of values ?? []) {
      tags.push(`${detailFilterLabels[key as LearningDetailFilterKey]}: ${value}`);
    }
  }
  return tags;
}

function getQuestionShortLabel(questionNo: LearningQuestionNo): string {
  return learningQuestionLabels[questionNo];
}

export default function AnalyticsLearningPage(): JSX.Element {
  const { message } = App.useApp();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchKey = searchParams.toString();
  const appliedQuery = useMemo(
    () => parseLearningAnalyticsQuery(new URLSearchParams(searchKey)),
    [searchKey]
  );
  const appliedQueryKey = useMemo(
    () => serializeLearningAnalyticsQuery(appliedQuery).toString(),
    [appliedQuery]
  );
  const [draftQuery, setDraftQuery] = useState<LearningAnalyticsQuery>(appliedQuery);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<KpiKey>('activeLearners');
  const [chartMode, setChartMode] = useState<'chart' | 'table'>('chart');
  const [retryKey, setRetryKey] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filterOptions, setFilterOptions] = useState<LearningAnalyticsFilterOptions>(
    mockLearningAnalyticsFilterOptions
  );
  const [state, setState] = useState<{
    status: 'pending' | 'success' | 'empty' | 'error';
    data: LearningAnalytics | null;
    errorMessage: string | null;
  }>({ status: 'pending', data: null, errorMessage: null });
  const dictionaryRefs = useRef<Partial<Record<KpiKey, HTMLDivElement | null>>>({});

  useEffect(() => {
    const controller = new AbortController();
    void fetchLearningAnalyticsFilterOptionsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok && result.data) {
        setFilterOptions(result.data);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({
      status: 'pending',
      data: current.data,
      errorMessage: null
    }));
    void fetchLearningAnalyticsSafe(appliedQuery, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        setState((current) => ({
          status: 'error',
          data: current.data,
          errorMessage: result.error.message
        }));
        return;
      }
      const data = result.data ?? createMockLearningAnalytics(appliedQuery);
      setState({
        status: data.summary.submissions === 0 ? 'empty' : 'success',
        data,
        errorMessage: null
      });
      setUpdatedAt(new Date());
    });
    return () => controller.abort();
  }, [appliedQuery, appliedQueryKey, retryKey]);

  useEffect(() => {
    if (!drawerOpen) {
      setDraftQuery(appliedQuery);
    }
  }, [appliedQueryKey, appliedQuery, drawerOpen]);

  useEffect(() => {
    if (!dictionaryOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      dictionaryRefs.current[selectedMetric]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [dictionaryOpen, selectedMetric]);

  const data = state.data;
  const summary = data?.summary;
  const comparePrevious = data?.scope.comparePrevious ?? false;
  const metadataCoverageState = useMemo(
    () => getLearningAnalyticsMetadataCoverageState(summary, comparePrevious),
    [comparePrevious, summary]
  );
  const metadataCoverageUnavailable = metadataCoverageState.unavailable;
  const metadataCoverageWarnings = metadataCoverageState.warnings;
  const isInitialLoading = state.status === 'pending' && !data;
  const isRefreshing = state.status === 'pending' && Boolean(data);
  const conditionCount = countLearningAnalyticsConditions(appliedQuery);
  const draftChanged = !areLearningAnalyticsQueriesEqual(draftQuery, appliedQuery);
  const draftRange = resolveLearningAnalyticsDateRange(draftQuery);
  const selectedQuestion =
    draftQuery.questions.length === 1 ? draftQuery.questions[0] : null;
  const selectedTopic = filterOptions.topics.find(
    (topic) => topic.topicMain === draftQuery.topicMain
  );

  const openDictionary = useCallback((key: KpiKey) => {
    setSelectedMetric(key);
    setDictionaryOpen(true);
  }, []);

  const openConditionDrawer = useCallback(() => {
    setDraftQuery(appliedQuery);
    setDrawerOpen(true);
  }, [appliedQuery]);

  const closeConditionDrawer = useCallback(() => {
    setDraftQuery(appliedQuery);
    setDrawerOpen(false);
  }, [appliedQuery]);

  const applyQuery = useCallback(
    (query: LearningAnalyticsQuery) => {
      setSearchParams(serializeLearningAnalyticsQuery(query), { replace: true });
    },
    [setSearchParams]
  );

  const handleApply = useCallback(() => {
    if (draftQuery.questions.length === 0) {
      void message.warning('문제 유형을 한 개 이상 선택해 주세요.');
      return;
    }
    if (
      draftQuery.period === 'custom' &&
      (!draftQuery.from || !draftQuery.to || draftQuery.from > draftQuery.to)
    ) {
      void message.warning('유효한 시작일과 종료일을 선택해 주세요.');
      return;
    }
    applyQuery(draftQuery);
    setDrawerOpen(false);
  }, [applyQuery, draftQuery, message]);

  const handleShare = useCallback(async () => {
    const queryString = serializeLearningAnalyticsQuery(appliedQuery).toString();
    const url = `${window.location.origin}${location.pathname}?${queryString}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!copyTextFallback(url)) {
        throw new Error('clipboard unavailable');
      }
      void message.success('현재 분석 조건 URL을 복사했습니다.');
    } catch {
      void message.error('URL을 복사하지 못했습니다. 브라우저 권한을 확인해 주세요.');
    }
  }, [appliedQuery, location.pathname, message]);

  const handleCsvExport = useCallback(() => {
    if (!data) {
      void message.warning('내보낼 분석 데이터가 없습니다.');
      return;
    }
    const csv = createLearningAnalyticsCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `learning-analytics_${data.scope.startDate ?? 'all'}_${data.scope.endDate ?? 'all'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void message.success('현재 분석 결과를 CSV로 내보냈습니다.');
  }, [data, message]);

  const questionColumns = useMemo<TableColumnsType<LearningAnalyticsQuestionStat>>(
    () => [
      {
        title: '문제 유형',
        dataIndex: 'questionNo',
        fixed: 'left',
        width: 138,
        render: (value: LearningQuestionNo) => getQuestionShortLabel(value)
      },
      { title: '학습자', dataIndex: 'activeLearners', width: 88, render: (value: number) => `${formatNumber(value)}명` },
      { title: '제출자', dataIndex: 'submitters', width: 88, render: (value: number) => `${formatNumber(value)}명` },
      { title: '제출', dataIndex: 'submissions', width: 78, render: (value: number) => `${formatNumber(value)}건` },
      { title: '완료율', dataIndex: 'completionRate', width: 84, render: (value: number | null) => `${formatNumber(value, 1)}%` },
      { title: '평균 환산 점수', dataIndex: 'avgScoreNormalized', width: 120, render: (value: number | null) => `${formatNumber(value, 1)}점` },
      { title: '조회율', dataIndex: 'feedbackViewRate', width: 82, render: (value: number | null) => `${formatNumber(value, 1)}%` },
      { title: '풀이 시간', dataIndex: 'avgElapsedSeconds', width: 112, render: (value: number | null) => formatDuration(value) },
      { title: '재제출률', dataIndex: 'resubmissionRate', width: 90, render: (value: number | null) => `${formatNumber(value, 1)}%` },
      { title: 'PDF', dataIndex: 'pdfExports', width: 72, render: (value: number) => `${formatNumber(value)}건` }
    ],
    []
  );

  const topicColumns = useMemo<TableColumnsType<LearningAnalyticsTopicStat>>(
    () => [
      { title: '대주제', dataIndex: 'topicMain', width: 84 },
      { title: '세부 주제', dataIndex: 'topicDetail', width: 112 },
      {
        title: '문제 유형',
        dataIndex: 'questionNo',
        width: 88,
        render: (value: LearningQuestionNo) => `${value}번`
      },
      {
        title: '평균 환산 점수',
        dataIndex: 'avgScoreNormalized',
        width: 110,
        render: (value: number | null) => `${formatNumber(value, 1)}점`
      },
      {
        title: '제출',
        dataIndex: 'submissions',
        width: 72,
        render: (value: number) => formatNumber(value)
      },
      {
        title: '변화',
        key: 'delta',
        width: 70,
        render: (_, row) => {
          if (row.avgScoreNormalized == null || row.avgScoreNormalizedPrev == null) {
            return '—';
          }
          const delta = row.avgScoreNormalized - row.avgScoreNormalizedPrev;
          return <span className={delta >= 0 ? 'is-positive' : 'is-negative'}>{delta >= 0 ? '+' : ''}{formatNumber(delta, 1)}</span>;
        }
      }
    ],
    []
  );

  const distributionRows = useMemo(
    () =>
      (data?.scoreDistribution ?? []).map((row) => ({
        key: `${row.questionNo}-${row.bucket}`,
        ...row
      })),
    [data?.scoreDistribution]
  );

  const kpiCards = summary
    ? [
        {
          definition: metricDefinitions[0],
          value: formatNumber(summary.activeLearners),
          unit: '명',
          trend: <MetricTrend current={summary.activeLearners} previous={summary.activeLearnersPrev} mode="relative" />,
          helper: `귀속 이벤트 ${formatNumber(summary.activeEventsAttributed)}건 · coverage ${formatNumber(summary.activeEventAttributionRate, 1)}%`
        },
        {
          definition: metricDefinitions[1],
          value: formatNumber(summary.submissions),
          unit: '건',
          trend: <MetricTrend current={summary.submissions} previous={summary.submissionsPrev} mode="relative" />,
          helper: `제출자 ${formatNumber(summary.submitters)}명 · 재제출 ${formatNumber(summary.resubmissions)}건`
        },
        {
          definition: metricDefinitions[2],
          value: formatNumber(summary.completionRate, 1),
          unit: '%',
          trend: <MetricTrend current={summary.completionRate} previous={summary.completionRatePrev} mode="point" suffix="%p" />,
          helper: `완료 ${formatNumber(summary.feedbackComplete)} / 전체 ${formatNumber(summary.submissions)}`
        },
        {
          definition: metricDefinitions[3],
          value: formatNumber(summary.avgScoreNormalized, 1),
          unit: '점',
          trend: <MetricTrend current={summary.avgScoreNormalized} previous={summary.avgScoreNormalizedPrev} mode="point" suffix="점" />,
          helper: `0~100 환산 · N=${formatNumber(summary.feedbackComplete)}`
        },
        {
          definition: metricDefinitions[4],
          value: formatNumber(summary.feedbackViewRate, 1),
          unit: '%',
          trend: <MetricTrend current={summary.feedbackViewRate} previous={summary.feedbackViewRatePrev} mode="point" suffix="%p" />,
          helper: `조회 ${formatNumber(summary.feedbackViewedCount)} / 완료 ${formatNumber(summary.feedbackComplete)}`
        },
        {
          definition: metricDefinitions[5],
          value: formatDuration(summary.avgElapsedSeconds),
          trend: <MetricTrend current={summary.avgElapsedSeconds} previous={summary.avgElapsedSecondsPrev} mode="duration" lowerIsBetter />,
          helper: `N=${formatNumber(summary.elapsedSamples)} · coverage ${summary.submissions > 0 ? formatNumber((summary.elapsedSamples / summary.submissions) * 100, 1) : '—'}%`
        },
        {
          definition: metricDefinitions[6],
          value: formatDuration(summary.medianProcessingSeconds),
          trend: <MetricTrend current={summary.medianProcessingSeconds} previous={summary.medianProcessingSecondsPrev} mode="duration" lowerIsBetter />,
          helper: `완료 피드백 ${formatNumber(summary.processingSamples)}건`
        },
        {
          definition: metricDefinitions[7],
          value: formatNumber(summary.pdfExports),
          unit: '건',
          trend: <MetricTrend current={summary.pdfExports} previous={summary.pdfExportsPrev} mode="relative" />,
          helper: `전체 이벤트 ${formatNumber(data?.pdfUsage.totalExports)} · 귀속률 ${formatNumber(data?.pdfUsage.attributionRate, 1)}%`
        }
      ]
    : [];

  return (
    <ConfigProvider theme={learningTypographyTheme}>
    <main
      className={`analytics-learning-page${drawerOpen ? ' analytics-learning-page--drawer-open' : ''}`}
      data-testid="analytics-learning-page"
    >
      <PageTitle
        title="학습 분석"
        breadcrumbFirst
        description="문제 유형, 주제, 기간 기준으로 학습 성과와 피드백 활용을 분석합니다."
        actions={
          <>
            <Button size="large" icon={<InfoCircleOutlined />} onClick={() => openDictionary('activeLearners')}>
              지표 사전
            </Button>
            <Button size="large" icon={<ShareAltOutlined />} onClick={() => void handleShare()}>
              분석 공유
            </Button>
            <Button size="large" icon={<DownloadOutlined />} onClick={handleCsvExport} disabled={!data}>
              CSV 내보내기
            </Button>
            <Button size="large" type="primary" icon={<FilterOutlined />} onClick={openConditionDrawer}>
              분석 조건 {conditionCount}
            </Button>
          </>
        }
        meta={<span>데이터 갱신&nbsp; {formatRefreshTime(updatedAt)} KST</span>}
      />

      {state.status === 'error' ? (
        <Alert
          className="analytics-learning-alert"
          type="error"
          showIcon
          message="학습 분석 데이터를 갱신하지 못했습니다."
          description={state.errorMessage}
          action={<Button icon={<ReloadOutlined />} onClick={() => setRetryKey((value) => value + 1)}>재시도</Button>}
        />
      ) : null}
      {isRefreshing ? (
        <Alert className="analytics-learning-alert" type="info" showIcon message="직전 결과를 유지한 채 새 조건으로 갱신하고 있습니다." />
      ) : null}
      {metadataCoverageUnavailable ? (
        <Alert
          className="analytics-learning-alert"
          data-testid="metadata-coverage-unavailable"
          type="error"
          showIcon
          message="학습 데이터의 메타데이터 연결 상태를 확인할 수 없습니다."
          description="통계 계약 또는 배포 상태를 확인한 뒤 다시 시도해 주세요. 기존 집계 값은 참고용으로만 사용해 주세요."
          action={<Button icon={<ReloadOutlined />} onClick={() => setRetryKey((value) => value + 1)}>재시도</Button>}
        />
      ) : null}
      {metadataCoverageWarnings.map((warning) => (
        <Alert
          key={warning.testId}
          className="analytics-learning-alert"
          data-testid={warning.testId}
          type="warning"
          showIcon
          message={warning.message}
          description={warning.description}
        />
      ))}

      <section aria-labelledby="learning-kpi-heading">
        <div className="analytics-section-heading">
          <Title id="learning-kpi-heading" level={4}>핵심 지표</Title>
          <Tag color="blue">{appliedQuery.questions.length === 4 ? '51~54번 전체' : appliedQuery.questions.map((question) => `${question}번`).join(' · ')}</Tag>
          <Text type="secondary">{data?.scope.startDate && data.scope.endDate ? `${data.scope.startDate}~${data.scope.endDate}` : '전체 기간'}</Text>
        </div>
        {isInitialLoading ? (
          <div className="analytics-kpi-grid" aria-label="핵심 지표 불러오는 중">
            {Array.from({ length: 8 }, (_, index) => <Card key={index} className="analytics-kpi-card"><Skeleton active paragraph={{ rows: 2 }} title={{ width: '58%' }} /></Card>)}
          </div>
        ) : (
          <div className="analytics-kpi-grid">
            {kpiCards.map((card) => (
              <KpiCard
                key={card.definition.key}
                {...card}
                loading={false}
                onOpenDefinition={openDictionary}
              />
            ))}
          </div>
        )}
      </section>

      {state.status === 'empty' && data ? (
        <Card className="analytics-empty-card"><Empty description="선택 조건에 해당하는 학습 데이터가 없습니다." /></Card>
      ) : null}

      {data ? (
        <>
          <div className="analytics-analysis-row">
            <Card
              className="analytics-panel"
              title={<div className="analytics-panel-title">문제 유형별 비교 <Tag color="blue">{appliedQuery.questions.length === 4 ? '51~54번' : appliedQuery.questions.map((question) => `${question}번`).join(' · ')}</Tag></div>}
            >
              <Table
                aria-label="문제 유형별 비교"
                rowKey="questionNo"
                size="small"
                columns={questionColumns}
                dataSource={data.perQuestion}
                pagination={false}
                scroll={{ x: 942 }}
              />
              <Text className="analytics-panel-note">학습자는 유형 간 중복될 수 있어 합산하지 않습니다. PDF는 직접 귀속 건만 유형별로 표시합니다.</Text>
            </Card>

            <Card
              className="analytics-panel"
              title={<div className="analytics-panel-title">문제 유형별 점수 분포 <Tag color="blue">100점 환산</Tag></div>}
              extra={
                <Segmented
                  value={chartMode}
                  onChange={(value) => setChartMode(value as 'chart' | 'table')}
                  options={[
                    { label: '차트', value: 'chart', icon: <BarChartOutlined /> },
                    { label: '표', value: 'table', icon: <TableOutlined /> }
                  ]}
                />
              }
            >
              {chartMode === 'chart' ? (
                <div className="score-distribution-chart" role="img" aria-label="문제 유형별 100점 환산 점수 분포">
                  <div className="score-distribution-legend">
                    {['0-40', '41-60', '61-80', '81-100'].map((label, index) => (
                      <span key={label}><i style={{ backgroundColor: scoreColors[index] }} />{label}</span>
                    ))}
                  </div>
                  {data.perQuestion.map((question) => {
                    const buckets = data.scoreDistribution.filter((row) => row.questionNo === question.questionNo);
                    return (
                      <div className="score-distribution-row" key={question.questionNo}>
                        <Text strong>{getQuestionShortLabel(question.questionNo)}</Text>
                        <div className="score-distribution-bar">
                          {buckets.map((bucket, index) => (
                            <div
                              key={bucket.bucket}
                              className="score-distribution-segment"
                              style={{ width: `${bucket.percentage}%`, backgroundColor: scoreColors[index] }}
                              title={`${bucket.label}: ${bucket.count}건 (${bucket.percentage}%)`}
                            >
                              {bucket.percentage >= 10 ? `${formatNumber(bucket.percentage)}%` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Table
                  aria-label="문제 유형별 점수 분포 표"
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={distributionRows}
                  columns={[
                    { title: '문제 유형', dataIndex: 'questionNo', render: (value: LearningQuestionNo) => `${value}번` },
                    { title: '구간', dataIndex: 'label' },
                    { title: '제출', dataIndex: 'count', render: (value: number) => `${formatNumber(value)}건` },
                    { title: '비율', dataIndex: 'percentage', render: (value: number) => `${formatNumber(value, 1)}%` }
                  ]}
                />
              )}
            </Card>
          </div>

          <div className="analytics-analysis-row">
            <Card
              className="analytics-panel"
              title={<div className="analytics-panel-title">주제별 성과</div>}
              extra={<Text type="secondary">중복 포함</Text>}
            >
              <Table
                aria-label="주제별 성과"
                rowKey={(row) => `${row.topicMain}-${row.topicDetail}-${row.questionNo}`}
                size="small"
                columns={topicColumns}
                dataSource={data.topicStats}
                pagination={false}
                locale={{ emptyText: '선택 조건에 해당하는 주제가 없습니다.' }}
                scroll={{ x: 536 }}
              />
            </Card>

            <Card
              className="analytics-panel pdf-usage-panel"
              title={<div className="analytics-panel-title">PDF 사용 분석 <Tag color="blue">내보내기 완료</Tag></div>}
            >
              <div className="pdf-usage-stats">
                <div><Text type="secondary">전체 이벤트</Text><strong>{formatNumber(data.pdfUsage.totalExports)}<small>건</small></strong></div>
                <div><Text type="secondary">직접 귀속</Text><strong>{formatNumber(data.pdfUsage.attributableExports)}<small>건</small></strong></div>
                <div><Text type="secondary">귀속률</Text><strong>{formatNumber(data.pdfUsage.attributionRate, 1)}<small>%</small></strong></div>
              </div>
              <div className="pdf-question-list">
                {data.pdfUsage.perQuestion.map((row, index) => (
                  <div key={row.questionNo}>
                    <span><i style={{ backgroundColor: scoreColors[index % scoreColors.length] }} />{row.questionNo}번</span>
                    <Text>{formatNumber(row.count)}건</Text>
                  </div>
                ))}
                <div><span><i className="is-mixed" />혼합</span><Text>{formatNumber(data.pdfUsage.mixedExports)}건</Text></div>
                <div><span><i className="is-unclassified" />미분류</span><Text>{formatNumber(data.pdfUsage.unclassifiedExports)}건</Text></div>
              </div>
              <Text className="analytics-panel-note">`export_downloaded` 완료 이벤트이며 실제 파일 저장 완료 수와는 다릅니다.</Text>
            </Card>
          </div>
        </>
      ) : null}

      <Drawer
        className="analytics-condition-drawer"
        rootClassName="analytics-condition-drawer-root"
        width={320}
        mask={false}
        push={false}
        open={drawerOpen}
        onClose={closeConditionDrawer}
        title={<DrawerTitle>분석 조건</DrawerTitle>}
        styles={mergeDrawerFrameStyles({
          body: { padding: '0 16px 20px' },
          footer: { padding: '20px 12px' }
        })}
        footer={
          <DrawerFooter
            start={<Button size="large" onClick={closeConditionDrawer}>취소</Button>}
            end={
              <>
                <Button size="large" onClick={() => setDraftQuery(defaultLearningAnalyticsQuery)}>초기화</Button>
                <Button size="large" type="primary" onClick={handleApply}>분석 적용</Button>
              </>
            }
          />
        }
      >
        <div className="analytics-condition-drawer__body">
          <div className="condition-drawer-intro">
            <Text>모든 분석 섹션에 동일하게 적용됩니다.</Text>
            <Tag color={draftChanged ? 'gold' : 'blue'}>{draftChanged ? '미적용 변경 있음' : '현재 적용 중'}</Tag>
          </div>

          <section className="condition-section">
            <Title level={5}>기간</Title>
            <Segmented
              block
              size="small"
              value={draftQuery.period}
              options={periodOptions}
              onChange={(value) =>
                setDraftQuery((current) => ({
                  ...current,
                  period: value as LearningAnalyticsPeriod,
                  compare: value === 'all' ? false : current.compare
                }))
              }
            />
            <RangePicker
              aria-label="직접 분석 기간"
              allowEmpty={[true, true]}
              format="YYYY-MM-DD"
              value={
                draftQuery.from && draftQuery.to
                  ? [dayjs(draftQuery.from), dayjs(draftQuery.to)]
                  : null
              }
              disabled={draftQuery.period !== 'custom'}
              onChange={(values) =>
                setDraftQuery((current) => ({
                  ...current,
                  from: values?.[0]?.format('YYYY-MM-DD') ?? null,
                  to: values?.[1]?.format('YYYY-MM-DD') ?? null
                }))
              }
            />
            <div className="condition-switch-row">
              <Text>이전 동일 기간 비교</Text>
              <Switch
                checked={draftQuery.compare && draftQuery.period !== 'all'}
                disabled={draftQuery.period === 'all'}
                onChange={(checked) => setDraftQuery((current) => ({ ...current, compare: checked }))}
              />
            </div>
            <Text type="secondary" className="condition-helper">
              {draftRange.startDate && draftRange.endDate
                ? `${draftRange.startDate}~${draftRange.endDate} · KST · 종료일 포함`
                : '전체 기간 · 이전 기간 비교 없음'}
            </Text>
          </section>

          <Divider />

          <section className="condition-section">
            <Title level={5}>문제 유형</Title>
            <Text type="secondary" className="condition-helper">선택 항목 내부는 OR로 집계합니다.</Text>
            <Checkbox.Group
              className="question-checkbox-group"
              value={draftQuery.questions}
              onChange={(values) => {
                const questions = values
                  .map(Number)
                  .filter((value): value is LearningQuestionNo => value >= 51 && value <= 54)
                  .sort();
                setDraftQuery((current) => ({
                  ...current,
                  questions,
                  detailFilters: questions.length === 1 ? current.detailFilters : {}
                }));
              }}
              options={([51, 52, 53, 54] as LearningQuestionNo[]).map((question) => ({
                label: learningQuestionLabels[question],
                value: question
              }))}
            />
          </section>

          <Divider />

          <section className="condition-section">
            <Title level={5}>주제</Title>
            <Text type="secondary" className="condition-helper">문제 유형과 독립된 필터 축이며, 축 사이는 AND입니다.</Text>
            <label className="condition-field">
              <span>대주제</span>
              <Select
                value={draftQuery.topicMain}
                placeholder="전체"
                allowClear
                options={filterOptions.topics.map((topic) => ({ label: topic.topicMain, value: topic.topicMain }))}
                onChange={(value) => setDraftQuery((current) => ({ ...current, topicMain: value ?? null, topicDetail: null }))}
              />
            </label>
            <label className="condition-field">
              <span>세부 주제</span>
              <Select
                value={draftQuery.topicDetail}
                placeholder="전체"
                allowClear
                disabled={!draftQuery.topicMain}
                options={(selectedTopic?.topicDetails ?? []).map((topic) => ({ label: topic, value: topic }))}
                onChange={(value) => setDraftQuery((current) => ({ ...current, topicDetail: value ?? null }))}
              />
            </label>
          </section>

          <Divider />

          <section className="condition-section">
            <Title level={5}>유형별 세부</Title>
            {!selectedQuestion ? (
              <Select disabled placeholder="문제 유형 1개 선택 시 사용" />
            ) : (
              learningDetailKeysByQuestion[selectedQuestion].map((key) => (
                <label className="condition-field" key={key}>
                  <span>{detailFilterLabels[key]}</span>
                  <Select
                    mode="multiple"
                    allowClear
                    maxTagCount="responsive"
                    value={draftQuery.detailFilters[key] ?? []}
                    placeholder="전체"
                    options={(filterOptions.detailFilters[String(selectedQuestion) as `${LearningQuestionNo}`]?.[key] ?? []).map((value) => ({ label: value, value }))}
                    onChange={(values) =>
                      setDraftQuery((current) => ({
                        ...current,
                        detailFilters: { ...current.detailFilters, [key]: values }
                      }))
                    }
                  />
                </label>
              ))
            )}
            <Text type="secondary" className="condition-helper">같은 필드의 값은 OR, 서로 다른 필드는 AND로 집계합니다.</Text>
          </section>

          <Divider />

          <section className="condition-section condition-summary">
            <Title level={5}>적용될 조건</Title>
            <div className="analytics-condition-tags">
              {getAppliedConditionTags(draftQuery).map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
            <Text type="secondary">예상 범위: {draftRange.startDate && draftRange.endDate ? `${draftRange.startDate}~${draftRange.endDate}` : '전체 기간'}</Text>
          </section>
        </div>
      </Drawer>

      <Modal
        className="analytics-metric-dictionary"
        width={760}
        open={dictionaryOpen}
        onCancel={() => setDictionaryOpen(false)}
        footer={<Button size="large" type="primary" onClick={() => setDictionaryOpen(false)}>확인</Button>}
        title="학습 분석 지표 사전"
      >
        <Text type="secondary">아래 설명과 숫자는 지금 적용된 분석 조건을 기준으로 합니다.</Text>
        <div className="metric-dictionary-list">
          {metricDefinitions.map((definition) => (
            <div
              key={definition.key}
              ref={(node) => { dictionaryRefs.current[definition.key] = node; }}
              className={`metric-definition-card ${selectedMetric === definition.key ? 'is-selected' : ''}`}
              tabIndex={-1}
            >
              <div className="metric-definition-heading">
                <Tag color="blue">{definition.category}</Tag>
                <Text strong>{definition.label}</Text>
              </div>
              <dl>
                <div><dt>정의</dt><dd>{definition.definition}</dd></div>
                <div><dt>계산 방법</dt><dd>{definition.formula}</dd></div>
                <div><dt>포함 조건</dt><dd>{definition.inclusion}</dd></div>
                <div><dt>현재 집계</dt><dd>{definition.key === 'activeLearners' ? `조건에 연결된 학습 활동 ${formatNumber(summary?.activeEventsAttributed)}건 · 연결률 ${formatNumber(summary?.activeEventAttributionRate, 1)}%` : definition.key === 'elapsedTime' ? `시간이 기록된 제출 ${formatNumber(summary?.elapsedSamples)}건` : definition.key === 'processingTime' ? `완료 피드백 ${formatNumber(summary?.processingSamples)}건` : `제출 ${formatNumber(summary?.submissions)}건`}</dd></div>
                <div><dt>주의사항</dt><dd>{definition.caution}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </Modal>
    </main>
    </ConfigProvider>
  );
}
