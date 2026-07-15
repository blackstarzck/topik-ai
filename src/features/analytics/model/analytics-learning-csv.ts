import type { LearningAnalytics } from '../api/analytics-learning-service';

type CsvValue = string | number | null | undefined;

function csvEscape(value: CsvValue): string {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createLearningAnalyticsCsv(data: LearningAnalytics): string {
  const headers = [
    'section',
    'question_type',
    'topic_main',
    'topic_detail',
    'metric',
    'category',
    'value',
    'unit',
    'sample_count',
    'coverage',
    'period_start',
    'period_end'
  ];
  const rows: CsvValue[][] = [];
  const scope = data.scope;
  const addRow = (
    section: string,
    questionType: string | number | null,
    topicMain: string | null,
    topicDetail: string | null,
    metric: string,
    category: string,
    value: string | number | null,
    unit: string,
    sample: number | null,
    coverage: string | number | null
  ) => {
    rows.push([
      section,
      questionType,
      topicMain,
      topicDetail,
      metric,
      category,
      value,
      unit,
      sample,
      coverage,
      scope.startDate,
      scope.endDate
    ]);
  };

  const summary = data.summary;
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '학습 활성 사용자', '규모', summary.activeLearners, '명', summary.activeEventsAttributed, summary.activeEventAttributionRate);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '제출 수', '규모', summary.submissions, '건', summary.submitters, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '피드백 완료율', '성과', summary.completionRate, '%', summary.submissions, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '평균 환산 점수', '성과', summary.avgScoreNormalized, '점', summary.feedbackComplete, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '피드백 조회율', '행동', summary.feedbackViewRate, '%', summary.feedbackComplete, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '평균 풀이 시간', '행동', summary.avgElapsedSeconds, '초', summary.elapsedSamples, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, '처리 시간 중앙값', '운영', summary.medianProcessingSeconds, '초', summary.processingSamples, null);
  addRow('KPI', null, scope.topicMain, scope.topicDetail, 'PDF 내보내기 완료 수', '운영', summary.pdfExports, '건', data.pdfUsage.totalExports, data.pdfUsage.attributionRate);

  for (const row of data.perQuestion) {
    for (const [metric, value, unit, sample] of [
      ['학습자', row.activeLearners, '명', row.activeLearners],
      ['제출자', row.submitters, '명', row.submitters],
      ['제출 수', row.submissions, '건', row.submissions],
      ['피드백 완료율', row.completionRate, '%', row.submissions],
      ['평균 환산 점수', row.avgScoreNormalized, '점', row.submissions],
      ['피드백 조회율', row.feedbackViewRate, '%', row.submissions],
      ['평균 풀이 시간', row.avgElapsedSeconds, '초', row.elapsedSamples],
      ['재제출률', row.resubmissionRate, '%', row.submissions],
      ['PDF 내보내기 완료 수', row.pdfExports, '건', data.pdfUsage.totalExports]
    ] as const) {
      addRow('문제 유형별 비교', row.questionNo, scope.topicMain, scope.topicDetail, metric, '문제 유형', value, unit, sample, null);
    }
  }
  for (const row of data.scoreDistribution) {
    addRow('점수 분포', row.questionNo, scope.topicMain, scope.topicDetail, '환산 점수 구간', row.label, row.count, '건', row.count, row.percentage);
  }
  for (const row of data.topicStats) {
    addRow('주제별 성과', null, row.topicMain, row.topicDetail, '평균 환산 점수', '주제', row.avgScoreNormalized, '점', row.submissions, null);
  }
  for (const row of data.pdfUsage.perQuestion) {
    addRow('PDF 사용 분석', row.questionNo, scope.topicMain, scope.topicDetail, 'PDF 내보내기 완료 수', '직접 귀속', row.count, '건', data.pdfUsage.totalExports, data.pdfUsage.attributionRate);
  }
  addRow('PDF 사용 분석', null, scope.topicMain, scope.topicDetail, 'PDF 내보내기 완료 수', '직접 귀속 합계', data.pdfUsage.attributableExports, '건', data.pdfUsage.totalExports, data.pdfUsage.attributionRate);
  addRow('PDF 사용 분석', null, scope.topicMain, scope.topicDetail, 'PDF 내보내기 완료 수', '혼합', data.pdfUsage.mixedExports, '건', data.pdfUsage.totalExports, null);
  addRow('PDF 사용 분석', null, scope.topicMain, scope.topicDetail, 'PDF 내보내기 완료 수', '미분류', data.pdfUsage.unclassifiedExports, '건', data.pdfUsage.totalExports, null);

  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')}`;
}
