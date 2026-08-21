import {
  BarChartOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  TableOutlined
} from '@ant-design/icons';
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Result,
  Segmented,
  Skeleton,
  Table,
  Tag,
  Typography
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  createMockLearningAnalytics,
  fetchLearningAnalyticsFilterOptionsSafe,
  fetchLearningAnalyticsSafe,
  mockLearningAnalyticsFilterOptions,
  type LearningAnalytics,
  type LearningAnalyticsFilterOptions
} from '../api/analytics-learning-service';
import {
  isAnalyticsPermissionError,
  translateAnalyticsError
} from '../api/analytics-permission-error';
import { usePermissionStore } from '@/features/system/model/permission-store';
import {
  areLearningAnalyticsQueriesEqual,
  countLearningAnalyticsConditions,
  parseLearningAnalyticsQuery,
  serializeLearningAnalyticsQuery,
  type LearningAnalyticsQuery,
  type LearningQuestionNo
} from '../model/analytics-learning-query';
import { createLearningAnalyticsCsv } from '../model/analytics-learning-csv';
import { getLearningAnalyticsMetadataCoverageState } from '../model/analytics-learning-metadata-coverage';
import {
  buildLearningPdfHierarchyRows,
  buildLearningPdfSlices,
  formatNumber,
  formatRefreshTime,
  getQuestionShortLabel,
  scoreColors,
  type PdfUsageHierarchyRow,
  type PdfUsageSlice
} from '../model/analytics-learning-page-schema';
import {
  createLearningPdfHierarchyColumns,
  createLearningQuestionColumns,
  createLearningTopicColumns
} from '../ui/analytics-learning-columns';
import { PdfUsageCompositionPie } from '../ui/analytics-learning-charts';
import { LearningConditionDrawer } from '../ui/analytics-learning-condition-drawer';
import { buildLearningKpiCards, KpiCard } from '../ui/analytics-learning-kpi';
import { PageTitle } from '@/shared/ui/page-title/page-title';

import './analytics-learning-page.css';

const { Text, Title } = Typography;


export default function AnalyticsLearningPage(): JSX.Element {
  const { message } = App.useApp();
  // 화면 게이트는 세션 grants(analytics.read) 기준 — DB 검사와 같은 판정을 내야 한다.
  const currentAdminId = usePermissionStore((store) => store.currentAdminId);
  const admins = usePermissionStore((store) => store.admins);
  const canRead = useMemo(
    () =>
      admins
        .find((admin) => admin.adminId === currentAdminId)
        ?.permissions.includes('analytics.read') ?? false,
    [admins, currentAdminId]
  );
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
  useEffect(() => {
    if (!canRead) {
      return;
    }
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
  }, [canRead]);

  useEffect(() => {
    if (!canRead) {
      return;
    }
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
        // 권한 거절이면 직전 수치를 남기지 않는다 — 회수 후에도 화면에 통계가
        // 잔존하면 "회수 즉시 거절" 계약이 화면에서 깨져 보인다.
        const permissionDenied = isAnalyticsPermissionError(result.error.message);
        setState((current) => ({
          status: 'error',
          data: permissionDenied ? null : current.data,
          errorMessage: translateAnalyticsError(result.error.message)
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
  }, [appliedQuery, appliedQueryKey, canRead, retryKey]);

  useEffect(() => {
    if (!drawerOpen) {
      setDraftQuery(appliedQuery);
    }
  }, [appliedQueryKey, appliedQuery, drawerOpen]);

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

  const columns = useMemo(() => createLearningQuestionColumns(), []);

  const { maxTopicSubmissions, topicRows } = useMemo(() => {
    const rows = [...(data?.topicStats ?? [])].sort((a, b) => {
      const submissionsOrder = b.submissions - a.submissions;
      if (submissionsOrder !== 0) {
        return submissionsOrder;
      }

      const mainTopicOrder = a.topicMain.localeCompare(b.topicMain, 'ko-KR');
      if (mainTopicOrder !== 0) {
        return mainTopicOrder;
      }

      const detailTopicOrder = a.topicDetail.localeCompare(b.topicDetail, 'ko-KR');
      if (detailTopicOrder !== 0) {
        return detailTopicOrder;
      }

      return a.questionNo - b.questionNo;
    });

    return {
      maxTopicSubmissions: rows.reduce(
        (maximum, row) => Math.max(maximum, row.submissions),
        0
      ),
      topicRows: rows
    };
  }, [data?.topicStats]);

  const topicColumns = useMemo(
    () => createLearningTopicColumns({ maxTopicSubmissions }),
    [maxTopicSubmissions]
  );
  const pdfUsageTotal = data?.pdfUsage.totalExports ?? 0;
  const pdfHierarchyRows = useMemo<PdfUsageHierarchyRow[]>(
    () => buildLearningPdfHierarchyRows(data),
    [data]
  );
  const pdfHierarchyColumns = useMemo(
    () => createLearningPdfHierarchyColumns({ pdfUsageTotal }),
    [pdfUsageTotal]
  );
  const pdfSlices = useMemo<PdfUsageSlice[]>(() => buildLearningPdfSlices(data), [data]);

  const distributionRows = useMemo(
    () =>
      (data?.scoreDistribution ?? []).map((row) => ({
        key: `${row.questionNo}-${row.bucket}`,
        ...row
      })),
    [data?.scoreDistribution]
  );

  const kpiCards = summary && data
    ? buildLearningKpiCards({ summary, pdfUsage: data.pdfUsage })
    : [];

  // 모든 훅 뒤에 위치해야 한다(조건부 훅 금지). 메뉴 숨김과 별개로 직접 URL 진입을
  // 막는 최종 화면 게이트 — DB 는 어차피 거절하지만, 단순 장애로 오해하지 않게 한다.
  if (!canRead) {
    return (
      <main className="analytics-learning-page" data-testid="analytics-learning-page">
        <PageTitle
          title="학습 분석"
          breadcrumbFirst
          description="문제 유형, 주제, 기간 기준으로 학습 성과와 피드백 활용을 분석합니다."
        />
        <Result
          status="403"
          title="통계 조회 권한이 없습니다."
          subTitle="통계 조회(analytics.read) 권한을 부여받은 관리자만 학습 분석을 볼 수 있습니다. 권한을 부여받은 뒤 새로고침하거나 다시 로그인하면 표시됩니다."
          extra={<Button onClick={() => history.back()}>이전 화면</Button>}
        />
      </main>
    );
  }

  return (
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
          <div className="analytics-analysis-row analytics-analysis-row--table-panels">
            <Card
              className="analytics-panel question-comparison-panel"
              title={<div className="analytics-panel-title">문제 유형별 비교 <Tag color="blue">{appliedQuery.questions.length === 4 ? '51~54번' : appliedQuery.questions.map((question) => `${question}번`).join(' · ')}</Tag></div>}
            >
              <Table
                aria-label="문제 유형별 비교"
                className="question-comparison-table"
                rowKey="questionNo"
                size="small"
                columns={columns}
                dataSource={data.perQuestion}
                pagination={false}
                scroll={{ x: 942 }}
              />
              <Text className="analytics-panel-note">학습자는 유형 간 중복될 수 있어 합산하지 않습니다. PDF는 직접 귀속 건만 유형별로 표시합니다.</Text>
            </Card>

            <Card
              className="analytics-panel score-distribution-panel"
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

          <div className="analytics-analysis-row analytics-analysis-row--single">
            <Card
              className="analytics-panel"
              title={<div className="analytics-panel-title">주제별 성과</div>}
              extra={<Text type="secondary">중복 포함</Text>}
            >
              <Table
                aria-label="주제별 성과"
                className="topic-performance-table"
                rowKey={(row) => `${row.topicMain}-${row.topicDetail}-${row.questionNo}`}
                size="small"
                columns={topicColumns}
                dataSource={topicRows}
                pagination={false}
                locale={{ emptyText: '선택 조건에 해당하는 주제가 없습니다.' }}
                scroll={{ x: 1236 }}
              />
            </Card>
          </div>

          <div className="analytics-analysis-row analytics-analysis-row--single">
            <Card
              className="analytics-panel pdf-usage-panel"
              title={<div className="analytics-panel-title">PDF 사용 분석 <Tag color="blue">내보내기 완료</Tag></div>}
            >
              <div className="pdf-usage-layout">
                <section className="pdf-composition" aria-labelledby="pdf-composition-title">
                  <div className="pdf-composition__heading">
                    <Text strong id="pdf-composition-title">전체 구성 비율</Text>
                    <Text type="secondary">전체 현황과 유형별 구성 비율을 확인합니다.</Text>
                  </div>
                  <div className="pdf-usage-stats">
                    <div>
                      <Text type="secondary">전체 이벤트</Text>
                      <strong>{formatNumber(data.pdfUsage.totalExports)}<small>건</small></strong>
                      <small>내보내기 완료 전체</small>
                    </div>
                    <div>
                      <Text type="secondary">직접 귀속</Text>
                      <strong>{formatNumber(data.pdfUsage.attributableExports)}<small>건</small></strong>
                      <small>귀속률 {formatNumber(data.pdfUsage.attributionRate, 1)}%</small>
                    </div>
                    <div>
                      <Text type="secondary">혼합</Text>
                      <strong>{formatNumber(data.pdfUsage.mixedExports)}<small>건</small></strong>
                      <small>여러 문제 유형 포함</small>
                    </div>
                    <div>
                      <Text type="secondary">미분류</Text>
                      <strong>{formatNumber(data.pdfUsage.unclassifiedExports)}<small>건</small></strong>
                      <small>유형 확인 불가</small>
                    </div>
                  </div>
                  <PdfUsageCompositionPie
                    slices={pdfSlices}
                    total={data.pdfUsage.totalExports}
                  />
                </section>
                <section className="pdf-hierarchy" aria-labelledby="pdf-hierarchy-title">
                  <div className="pdf-hierarchy__heading">
                    <Text strong id="pdf-hierarchy-title">문제 유형별 구성과 주제 상세</Text>
                    <Text type="secondary">문제 유형을 펼치면 직접 귀속된 주제를 완료 수 많은 순으로 확인할 수 있습니다.</Text>
                  </div>
                  <Table
                    aria-label="PDF 내보내기 구성과 주제 상세"
                    className="pdf-hierarchy__table"
                    rowKey="key"
                    size="small"
                    columns={pdfHierarchyColumns}
                    dataSource={pdfHierarchyRows}
                    pagination={false}
                    expandable={{
                      defaultExpandAllRows: true,
                      expandRowByClick: false,
                      indentSize: 18,
                      rowExpandable: (row) => row.kind === 'question' && Boolean(row.children?.length)
                    }}
                    rowClassName={(row) => `pdf-hierarchy-row is-${row.kind}${row.count === 0 ? ' is-zero' : ''}`}
                    locale={{ emptyText: 'PDF 내보내기 완료 데이터가 없습니다.' }}
                    scroll={{ x: 700 }}
                  />
                </section>
              </div>
              <Text className="analytics-panel-note">혼합·미분류는 특정 주제로 나누지 않습니다. `export_downloaded` 완료 이벤트이며 실제 파일 저장 완료 수와는 다릅니다.</Text>
            </Card>
          </div>
        </>
      ) : null}

      <LearningConditionDrawer
        open={drawerOpen}
        draftQuery={draftQuery}
        draftChanged={draftChanged}
        filterOptions={filterOptions}
        onDraftChange={setDraftQuery}
        onApply={handleApply}
        onClose={closeConditionDrawer}
      />

    </main>
  );
}
