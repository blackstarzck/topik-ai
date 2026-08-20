import {
  Alert,
  Button,
  Descriptions,
  Result,
  Select,
  Space,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchBackupRunsSafe,
  fetchBackupSummarySafe
} from '../api/backups-service';
import { backupViewContext } from '../api/backup-data-source';
import {
  backupComponentStatusLabels,
  backupRunStatusLabels,
  backupValidationStatusLabels,
  formatBackupBytes,
  formatBackupDateTime,
  formatBackupDuration,
  formatBackupError,
  isRestoreDrillWarning,
  resolveBackupHealth,
  resolveDiskStatus,
  type BackupRun,
  type BackupRunPage,
  type BackupRunQuery,
  type BackupRunStatus,
  type BackupSummary
} from '../model/backup-types';
import { usePermissionStore } from '../model/permission-store';
import type { AsyncState } from '@/shared/model/async-state';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { createTextSorter } from '@/shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;
const PAGE_SIZE = 20;

function startOfKstDay(value: string): string | undefined {
  return value ? `${value}T00:00:00+09:00` : undefined;
}

function endOfKstDay(value: string): string | undefined {
  if (!value) return undefined;
  const next = new Date(`${value}T00:00:00+09:00`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseResult(value: string | null): BackupRunStatus | undefined {
  return value && ['running', 'succeeded', 'partial_failure', 'failed', 'delayed'].includes(value)
    ? value as BackupRunStatus
    : undefined;
}

function diskValue(percent: number | null): JSX.Element {
  const status = resolveDiskStatus(percent);
  return (
    <Space size={6}>
      <Text>{percent === null ? '기록 없음' : `${percent.toLocaleString('ko-KR')}%`}</Text>
      <StatusBadge status={status} />
    </Space>
  );
}

function formatTotalSize(record: BackupRun): string {
  if (record.databaseSizeBytes === null && record.storageSizeBytes === null) {
    return '기록 없음';
  }
  return formatBackupBytes((record.databaseSizeBytes ?? 0) + (record.storageSizeBytes ?? 0));
}

export default function SystemBackupsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canReadDetails = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId)?.permissions.includes('system.backups.read') ?? false,
    [admins, currentAdminId]
  );

  const keyword = searchParams.get('keyword') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const result = parseResult(searchParams.get('result'));
  const targetValue = searchParams.get('target');
  const target = targetValue === 'database' || targetValue === 'storage' ? targetValue : undefined;
  const page = parsePage(searchParams.get('page'));
  const selectedRunId = searchParams.get('runId');
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange: handleDateDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);
  const [draftResult, setDraftResult] = useState<BackupRunStatus | undefined>(result);
  const [draftTarget, setDraftTarget] = useState<'database' | 'storage' | undefined>(target);

  const [listState, setListState] = useState<AsyncState<BackupRunPage>>({
    status: 'pending',
    data: { rows: [], totalCount: 0 },
    errorMessage: null,
    errorCode: null
  });
  const [summaryState, setSummaryState] = useState<AsyncState<BackupSummary | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [selectedFallback, setSelectedFallback] = useState<BackupRun | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const query = useMemo<BackupRunQuery>(() => ({
    startedFrom: startOfKstDay(startDate),
    startedTo: endOfKstDay(endDate),
    result,
    target,
    keyword: keyword || undefined,
    page,
    pageSize: PAGE_SIZE
  }), [endDate, keyword, page, result, startDate, target]);

  useEffect(() => {
    if (!canReadDetails) return;
    const controller = new AbortController();
    setListState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchBackupRunsSafe(query, controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.ok) {
        setListState({
          status: response.data.totalCount === 0 ? 'empty' : 'success',
          data: response.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setListState((current) => ({
        ...current,
        status: 'error',
        errorMessage: response.error.message,
        errorCode: response.error.code
      }));
    });
    return () => controller.abort();
  }, [canReadDetails, query, reloadKey]);

  useEffect(() => {
    if (!canReadDetails) return;
    const controller = new AbortController();
    setSummaryState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchBackupSummarySafe(controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.ok) {
        setSummaryState({
          status: response.data.latestRunId ? 'success' : 'empty',
          data: response.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setSummaryState((current) => ({
        ...current,
        status: 'error',
        errorMessage: response.error.message,
        errorCode: response.error.code
      }));
    });
    return () => controller.abort();
  }, [canReadDetails, reloadKey]);

  const selectedFromPage = listState.data.rows.find((row) => row.runId === selectedRunId) ?? null;

  useEffect(() => {
    if (!canReadDetails || !selectedRunId || selectedFromPage) {
      setSelectedFallback(null);
      return;
    }
    const controller = new AbortController();
    void fetchBackupRunsSafe({ keyword: selectedRunId, page: 1, pageSize: 1 }, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted && response.ok) {
          setSelectedFallback(response.data.rows[0] ?? null);
        }
      });
    return () => controller.abort();
  }, [canReadDetails, selectedFromPage, selectedRunId]);

  const commitParams = useCallback((next: Record<string, string | undefined>, resetPage = true) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    });
    if (resetPage) merged.delete('page');
    setSearchParams(merged, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleDetailOpenChange = useCallback((open: boolean) => {
    handleDateDetailOpenChange(open);
    if (open) {
      setDraftResult(result);
      setDraftTarget(target);
    }
  }, [handleDateDetailOpenChange, result, target]);

  const handleApply = useCallback(() => {
    commitParams({
      startDate: draftStartDate || undefined,
      endDate: draftEndDate || undefined,
      result: draftResult,
      target: draftTarget
    });
  }, [commitParams, draftEndDate, draftResult, draftStartDate, draftTarget]);

  const handleReset = useCallback(() => {
    handleDraftReset();
    setDraftResult(undefined);
    setDraftTarget(undefined);
  }, [handleDraftReset]);

  const selectedRun = selectedFromPage ?? selectedFallback;
  const summary = summaryState.data;
  const successRate = summary && summary.recentTerminalCount > 0
    ? Math.round((summary.recentSuccessCount / summary.recentTerminalCount) * 100)
    : null;

  const summaryItems = useMemo(() => [
    {
      key: 'health',
      label: '현재 상태',
      value: <StatusBadge status={resolveBackupHealth(summary)} />
    },
    {
      key: 'last-success',
      label: '마지막 전체 성공',
      value: formatBackupDateTime(summary?.lastSuccessAt ?? null)
    },
    {
      key: 'success-rate',
      label: '최근 7일 성공률',
      value: successRate === null ? '기록 없음' : `${successRate}%`,
      hint: summary ? `${summary.recentSuccessCount.toLocaleString('ko-KR')} / ${summary.recentTerminalCount.toLocaleString('ko-KR')}회` : undefined
    },
    {
      key: 'disk',
      label: '디스크 사용률',
      value: summary?.diskUsedPercent === null || summary?.diskUsedPercent === undefined ? '기록 없음' : `${summary.diskUsedPercent.toLocaleString('ko-KR')}%`,
      hint: <StatusBadge status={resolveDiskStatus(summary?.diskUsedPercent ?? null)} />
    },
    {
      key: 'restore',
      label: '마지막 복원 점검',
      value: formatBackupDateTime(summary?.lastRestoreCompletedAt ?? null),
      hint: <StatusBadge status={isRestoreDrillWarning(summary) ? '주의' : '정상'} />
    }
  ], [successRate, summary]);

  const columns = useMemo<TableColumnsType<BackupRun>>(() => [
    {
      title: '시작 시각',
      dataIndex: 'startedAt',
      width: 170,
      sorter: createTextSorter((record) => record.startedAt),
      render: (value: string) => formatBackupDateTime(value)
    },
    {
      title: '종료 시각',
      dataIndex: 'completedAt',
      width: 170,
      sorter: createTextSorter((record) => record.completedAt ?? ''),
      render: (value: string | null) => formatBackupDateTime(value)
    },
    {
      title: '전체 결과',
      dataIndex: 'status',
      width: 110,
      render: (value: BackupRunStatus) => <StatusBadge status={backupRunStatusLabels[value]} />
    },
    {
      title: '데이터베이스',
      dataIndex: 'databaseStatus',
      width: 120,
      render: (value: BackupRun['databaseStatus']) => <StatusBadge status={backupComponentStatusLabels[value]} />
    },
    {
      title: '파일 저장소',
      dataIndex: 'storageStatus',
      width: 120,
      render: (value: BackupRun['storageStatus']) => <StatusBadge status={backupComponentStatusLabels[value]} />
    },
    {
      title: '전체 용량',
      key: 'totalSize',
      width: 120,
      render: (_, record) => formatTotalSize(record)
    },
    {
      title: '실행 시간',
      key: 'duration',
      width: 110,
      render: (_, record) => formatBackupDuration(record.startedAt, record.completedAt)
    },
    {
      title: '디스크 사용률',
      dataIndex: 'diskUsedPercent',
      width: 150,
      render: (value: number | null) => diskValue(value)
    }
  ], []);

  if (!canReadDetails) {
    return (
      <div>
        <PageTitle title="백업 관리" />
        <Result
          status="403"
          title="백업 상세 조회 권한이 없습니다."
          subTitle="슈퍼 관리자 또는 백업 상세 조회 권한을 부여받은 운영 담당자만 접근할 수 있습니다."
          extra={<Button onClick={() => history.back()}>이전 화면</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="백업 관리"
        description="topik-prod의 온프레미스 백업 결과를 조회합니다. 이 화면에서는 백업이나 복원을 실행할 수 없습니다."
      />

      {backupViewContext === 'mirror' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="운영 백업 상태의 개발환경 복사본입니다."
          description={`실제 백업 대상은 topik-prod이며 개발 데이터베이스 자체는 백업하지 않습니다. 마지막 동기화: ${formatBackupDateTime(summary?.lastReportReceivedAt ?? null)}`}
        />
      ) : null}

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="현재 백업 사본은 온프레미스 디스크 한 곳에만 보관됩니다."
        description="외부 저장소와 외장 디스크를 사용하지 않으므로 운영 데이터와 온프레미스 디스크가 동시에 손상되면 복구할 수 없습니다."
      />

      {summaryState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="백업 요약을 불러오지 못했습니다."
          description={summary ? '마지막으로 확인된 요약을 유지하고 있습니다.' : summaryState.errorMessage}
          action={<Button size="small" onClick={() => setReloadKey((current) => current + 1)}>재시도</Button>}
        />
      ) : null}

      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField="runId"
            searchFieldOptions={[{ label: '작업 번호', value: 'runId' }]}
            keyword={keyword}
            onSearchFieldChange={() => undefined}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value || undefined })}
            keywordPlaceholder="작업 번호 검색"
            detailTitle="상세 검색"
            detailContent={
              <>
                <SearchBarDetailField label="실행 기간">
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="결과">
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    value={draftResult}
                    placeholder="전체 결과"
                    options={[
                      { label: '진행 중', value: 'running' },
                      { label: '정상', value: 'succeeded' },
                      { label: '부분 실패', value: 'partial_failure' },
                      { label: '실패', value: 'failed' },
                      { label: '지연', value: 'delayed' }
                    ]}
                    onChange={setDraftResult}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="백업 대상">
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    value={draftTarget}
                    placeholder="전체 대상"
                    options={[
                      { label: '데이터베이스', value: 'database' },
                      { label: '파일 저장소', value: 'storage' }
                    ]}
                    onChange={setDraftTarget}
                  />
                </SearchBarDetailField>
              </>
            }
            onApply={handleApply}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleReset}
            summary={<Text type="secondary">총 {listState.data.totalCount.toLocaleString('ko-KR')}건</Text>}
          />
        }
      >
        {listState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="백업 실행 이력을 불러오지 못했습니다."
            description={listState.data.rows.length > 0 ? '마지막으로 확인된 목록을 유지하고 있습니다.' : listState.errorMessage}
            action={<Button size="small" onClick={() => setReloadKey((current) => current + 1)}>재시도</Button>}
          />
        ) : null}
        {listState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="조건에 맞는 백업 실행 이력이 없습니다."
            description="검색 조건을 바꾸거나 온프레미스 보고 설정을 확인하세요."
          />
        ) : null}
        <AdminDataTable<BackupRun>
          rowKey="runId"
          columns={columns}
          dataSource={listState.data.rows}
          loading={listState.status === 'pending' && listState.data.rows.length === 0}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: listState.data.totalCount,
            showSizeChanger: false,
            onChange: (nextPage) => commitParams({ page: String(nextPage) }, false)
          }}
          scroll={{ x: 1200 }}
          onRow={(record) => ({
            onClick: () => commitParams({ runId: record.runId }, false),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedRunId)}
        title={selectedRun ? `백업 상세 · ${selectedRun.runId}` : '백업 상세'}
        headerMeta={selectedRun ? <StatusBadge status={backupRunStatusLabels[selectedRun.status]} /> : null}
        footerStart={selectedRun?.systemLogId ? (
          <Link to={`/system/logs?searchField=id&keyword=${encodeURIComponent(selectedRun.systemLogId)}`}>
            연결된 시스템 로그 보기
          </Link>
        ) : <Text type="secondary">연결된 시스템 로그가 없습니다.</Text>}
        onClose={() => commitParams({ runId: undefined }, false)}
        destroyOnHidden
      >
        {selectedRun ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="실행 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'run', label: '작업 번호', children: selectedRun.runId },
                  { key: 'start', label: '시작 시각', children: formatBackupDateTime(selectedRun.startedAt) },
                  { key: 'complete', label: '종료 시각', children: formatBackupDateTime(selectedRun.completedAt) },
                  { key: 'duration', label: '실행 시간', children: formatBackupDuration(selectedRun.startedAt, selectedRun.completedAt) },
                  { key: 'next', label: '다음 실행', children: formatBackupDateTime(selectedRun.nextScheduledAt) },
                  { key: 'disk', label: '디스크 사용률', children: diskValue(selectedRun.diskUsedPercent) }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="데이터베이스 검사">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'status', label: '결과', children: <StatusBadge status={backupComponentStatusLabels[selectedRun.databaseStatus]} /> },
                  { key: 'size', label: '용량', children: formatBackupBytes(selectedRun.databaseSizeBytes) },
                  { key: 'validation', label: '검사', children: backupValidationStatusLabels[selectedRun.databaseValidationStatus] },
                  { key: 'error', label: '오류', children: formatBackupError(selectedRun.databaseErrorCode) }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="파일 저장소 검사">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'status', label: '결과', children: <StatusBadge status={backupComponentStatusLabels[selectedRun.storageStatus]} /> },
                  { key: 'count', label: '파일 수', children: selectedRun.storageObjectCount === null ? '기록 없음' : `${selectedRun.storageObjectCount.toLocaleString('ko-KR')}개` },
                  { key: 'size', label: '용량', children: formatBackupBytes(selectedRun.storageSizeBytes) },
                  { key: 'validation', label: '검사', children: backupValidationStatusLabels[selectedRun.storageValidationStatus] },
                  { key: 'error', label: '오류', children: formatBackupError(selectedRun.storageErrorCode) }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="종합 결과">
              <Paragraph style={{ marginBottom: 0 }}>
                {formatBackupError(selectedRun.errorCode)}
              </Paragraph>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : (
          <Alert type="info" showIcon message="선택한 백업 기록을 불러오는 중입니다." />
        )}
      </DetailDrawer>
    </div>
  );
}
