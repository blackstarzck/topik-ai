import {
  Alert,
  Button,
  Descriptions,
  Result,
  Select,
  Space,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  deleteSystemReportSafe,
  fetchSystemReportsSafe
} from '../api/system-reports-service';
import {
  formatSystemReportDateTime,
  formatSystemReportEnvironment,
  formatSystemReportReporter,
  formatSystemReportViewport,
  systemReportCategoryLabels,
  systemReportLocaleLabels,
  type SystemReport,
  type SystemReportCategory,
  type SystemReportPage,
  type SystemReportQuery
} from '../model/system-report-types';
import { usePermissionStore } from '../model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

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

function parseCategory(value: string | null): SystemReportCategory | undefined {
  return value === 'bug' || value === 'question' || value === 'suggestion' ? value : undefined;
}

export default function SystemReportsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const permissions = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId)?.permissions ?? [],
    [admins, currentAdminId]
  );
  const canRead = permissions.includes('system.reports.read');
  const canDelete = permissions.includes('system.reports.delete');

  const keyword = searchParams.get('keyword') ?? '';
  const startDate = searchParams.get('startDate') ?? '';
  const endDate = searchParams.get('endDate') ?? '';
  const category = parseCategory(searchParams.get('category'));
  const page = parsePage(searchParams.get('page'));
  const selectedReportId = searchParams.get('reportId');
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange: handleDateDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);
  const [draftCategory, setDraftCategory] = useState<SystemReportCategory | undefined>(category);
  const [deleteTarget, setDeleteTarget] = useState<SystemReport | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [listState, setListState] = useState<AsyncState<SystemReportPage>>({
    status: 'pending',
    data: { rows: [], totalCount: 0 },
    errorMessage: null,
    errorCode: null
  });

  const query = useMemo<SystemReportQuery>(() => ({
    category,
    createdFrom: startOfKstDay(startDate),
    createdTo: endOfKstDay(endDate),
    keyword: keyword || undefined,
    page,
    pageSize: PAGE_SIZE
  }), [category, endDate, keyword, page, startDate]);

  useEffect(() => {
    if (!canRead) return;
    const controller = new AbortController();
    setListState((current) => ({ ...current, status: 'pending', errorMessage: null, errorCode: null }));
    void fetchSystemReportsSafe(query, controller.signal).then((response) => {
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
  }, [canRead, query, reloadKey]);

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
    if (open) setDraftCategory(category);
  }, [category, handleDateDetailOpenChange]);

  const handleApply = useCallback(() => {
    commitParams({
      startDate: draftStartDate || undefined,
      endDate: draftEndDate || undefined,
      category: draftCategory
    });
  }, [commitParams, draftCategory, draftEndDate, draftStartDate]);

  const handleReset = useCallback(() => {
    handleDraftReset();
    setDraftCategory(undefined);
  }, [handleDraftReset]);

  const handleDeleteConfirm = useCallback(async (reason: string) => {
    if (!deleteTarget) return;
    const response = await deleteSystemReportSafe(deleteTarget.reportId, reason);
    if (!response.ok) {
      notificationApi.error({ message: '리포트 삭제 실패', description: response.error.message });
      return;
    }
    notificationApi.success({
      message: '리포트를 삭제했습니다.',
      description: `접수번호 ${response.data} · 삭제 기록은 감사 로그에서 확인할 수 있습니다.`
    });
    setDeleteTarget(null);
    commitParams({ reportId: undefined }, false);
    setReloadKey((current) => current + 1);
  }, [commitParams, deleteTarget, notificationApi]);

  const selectedReport = listState.data.rows.find((row) => row.reportId === selectedReportId) ?? null;

  const columns = useMemo<TableColumnsType<SystemReport>>(() => [
    {
      title: '접수 시각',
      dataIndex: 'createdAt',
      width: 180,
      sorter: createTextSorter((record) => record.createdAt),
      render: (value: string) => formatSystemReportDateTime(value)
    },
    {
      title: '접수번호',
      dataIndex: 'referenceCode',
      width: 200
    },
    {
      title: '유형',
      dataIndex: 'category',
      width: 110,
      render: (value: SystemReportCategory) => systemReportCategoryLabels[value]
    },
    {
      title: '제목',
      dataIndex: 'title',
      ellipsis: true
    },
    {
      title: '회신 이메일',
      dataIndex: 'email',
      width: 220,
      ellipsis: true
    },
    {
      title: '발생 화면',
      dataIndex: 'pathname',
      width: 200,
      ellipsis: true
    }
  ], []);

  if (!canRead) {
    return (
      <div>
        <PageTitle title="사용자 리포트" />
        <Result
          status="403"
          title="사용자 리포트 조회 권한이 없습니다."
          subTitle="접수 내용에 제출자 이메일과 자유 서술이 포함되어 있어 조회 권한을 부여받은 관리자만 접근할 수 있습니다."
          extra={<Button onClick={() => history.back()}>이전 화면</Button>}
        />
      </div>
    );
  }

  return (
    <div>
      {notificationContextHolder}
      <PageTitle
        title="사용자 리포트"
        description="학습자 앱에서 접수된 오류 신고·문의·제안을 조회합니다. 보관 기한은 없으며 삭제는 승인된 단건 처리만 가능합니다."
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="접수 내용에는 제출자가 직접 입력한 이메일과 본문이 포함됩니다."
        description="회신 외 목적으로 사용하지 마세요. 삭제하면 되돌릴 수 없고, 감사 로그에는 사유와 비식별 진단 정보만 남습니다."
      />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField="keyword"
            searchFieldOptions={[{ label: '접수번호·제목·본문·이메일', value: 'keyword' }]}
            keyword={keyword}
            onSearchFieldChange={() => undefined}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value || undefined })}
            keywordPlaceholder="접수번호, 제목, 본문, 이메일 검색"
            detailTitle="상세 검색"
            detailContent={
              <>
                <SearchBarDetailField label="접수 기간">
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="유형">
                  <Select
                    allowClear
                    style={{ width: '100%' }}
                    value={draftCategory}
                    placeholder="전체 유형"
                    options={[
                      { label: systemReportCategoryLabels.bug, value: 'bug' },
                      { label: systemReportCategoryLabels.question, value: 'question' },
                      { label: systemReportCategoryLabels.suggestion, value: 'suggestion' }
                    ]}
                    onChange={setDraftCategory}
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
            message="사용자 리포트를 불러오지 못했습니다."
            description={listState.data.rows.length > 0 ? '마지막으로 확인된 목록을 유지하고 있습니다.' : listState.errorMessage}
            action={<Button size="small" onClick={() => setReloadKey((current) => current + 1)}>재시도</Button>}
          />
        ) : null}
        {listState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="조건에 맞는 접수 내역이 없습니다."
            description="검색 조건을 바꾸어 다시 확인하세요."
          />
        ) : null}
        <AdminDataTable<SystemReport>
          rowKey="reportId"
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
            onClick: () => commitParams({ reportId: record.reportId }, false),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedReportId)}
        title={selectedReport ? `리포트 상세 · ${selectedReport.referenceCode}` : '리포트 상세'}
        headerMeta={selectedReport ? <Text>{systemReportCategoryLabels[selectedReport.category]}</Text> : null}
        footerStart={selectedReport ? (
          <Link
            to={`/system/audit-logs?searchField=targetId&keyword=${encodeURIComponent(selectedReport.referenceCode)}`}
          >
            이 접수번호의 감사 기록 보기
          </Link>
        ) : null}
        footerEnd={selectedReport && canDelete ? (
          <Button danger onClick={() => setDeleteTarget(selectedReport)}>
            리포트 삭제
          </Button>
        ) : null}
        onClose={() => commitParams({ reportId: undefined }, false)}
        destroyOnHidden
      >
        {selectedReport ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="접수 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'ref', label: '접수번호', children: selectedReport.referenceCode },
                  { key: 'category', label: '유형', children: systemReportCategoryLabels[selectedReport.category] },
                  { key: 'created', label: '접수 시각', children: formatSystemReportDateTime(selectedReport.createdAt) },
                  { key: 'email', label: '회신 이메일', children: selectedReport.email },
                  { key: 'reporter', label: '제출자', children: formatSystemReportReporter(selectedReport) }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="접수 내용">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text strong>{selectedReport.title}</Text>
                <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {selectedReport.message}
                </Paragraph>
              </Space>
            </DetailDrawerSection>

            <DetailDrawerSection title="진단 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'path', label: '발생 화면', children: selectedReport.pathname },
                  { key: 'env', label: '브라우저·OS·기기', children: formatSystemReportEnvironment(selectedReport) },
                  { key: 'viewport', label: '화면 크기', children: formatSystemReportViewport(selectedReport) },
                  { key: 'locale', label: '언어', children: systemReportLocaleLabels[selectedReport.locale] },
                  { key: 'version', label: '앱 버전', children: selectedReport.appVersion ?? '기록 없음' }
                ]}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : (
          <Alert type="info" showIcon message="선택한 리포트를 불러오는 중입니다." />
        )}
      </DetailDrawer>

      {deleteTarget ? (
        <ConfirmAction
          open
          title="사용자 리포트 삭제"
          description={`접수번호 ${deleteTarget.referenceCode} 를 영구 삭제합니다. 되돌릴 수 없으며 사유를 기록해야 합니다.`}
          targetType="SystemReport"
          targetId={deleteTarget.referenceCode}
          confirmText="삭제 실행"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </div>
  );
}
