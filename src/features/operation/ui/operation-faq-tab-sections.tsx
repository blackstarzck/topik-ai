import { Alert, Button, Select, Space, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useCallback } from 'react';

import {
  curationSortFieldValues,
  masterSortFieldValues,
  metricSortFieldValues,
  parseValue,
  type FaqCurationRow,
  type FaqMetricRow,
  type FaqPageParamKey
} from '../model/operation-faq-page-schema';
import {
  faqCategoryOptions,
  faqCurationModeOptions,
  faqCurationStatusOptions,
  faqExposureSurfaceOptions,
  faqStatusOptions
} from '../model/faq-schema';
import type {
  OperationFaq,
  OperationFaqCategory,
  OperationFaqCuration,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqMetric,
  OperationFaqStatus
} from '../model/types';
import type { AsyncState } from '@/shared/model/async-state';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';

const { Text } = Typography;

// FAQ 3탭 콘텐츠(검색 툴바·상태 알림·테이블) — Phase 4 분해로 페이지 렌더에서 이동(동작 동일).
// 조회 상태·조치 핸들러·URL 커밋은 페이지가 소유하고 props 로 받으며, 상세 검색 초안은
// 각 섹션 내부에서 관리한다(13호 툴바 패턴).

type CommitFn = (next: Partial<Record<FaqPageParamKey, string | null>>) => void;

export function FaqMasterSection({
  faqsState,
  visibleFaqs,
  columns,
  masterSearchField,
  keyword,
  faqCategoryFilter,
  faqStatusFilter,
  startDate,
  endDate,
  onCommit,
  onReload,
  onOpenFaqCreate,
  onOpenFaqDrawer
}: {
  faqsState: AsyncState<OperationFaq[]>;
  visibleFaqs: OperationFaq[];
  columns: TableColumnsType<OperationFaq>;
  masterSearchField: string;
  keyword: string;
  faqCategoryFilter: OperationFaqCategory | null;
  faqStatusFilter: OperationFaqStatus | null;
  startDate: string;
  endDate: string;
  onCommit: CommitFn;
  onReload: () => void;
  onOpenFaqCreate: () => void;
  onOpenFaqDrawer: (faqId: string) => void;
}): JSX.Element {
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

const handleApplyMasterDateRange = useCallback(() => {
  onCommit({
    startDate: draftStartDate || null,
    endDate: draftEndDate || null
  });
}, [draftEndDate, draftStartDate, onCommit]);

const handleResetMasterFilters = useCallback(() => {
  handleDraftReset();
  onCommit({
    startDate: null,
    endDate: null,
    status: null,
    category: null
  });
}, [handleDraftReset, onCommit]);

  const handleMasterTableChange = useCallback<
    NonNullable<TableProps<OperationFaq>['onChange']>
  >(
  (_, __, sorter) => {
    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextField =
      nextSorter && typeof nextSorter.field === 'string'
        ? parseValue(nextSorter.field, masterSortFieldValues)
        : null;

    onCommit({
      sortField: nextField,
      sortOrder: nextField ? nextSorter?.order ?? null : null
    });
  },
  [onCommit]
);

const faqAlert =
  faqsState.status === 'error' ? (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 목록을 불러오지 못했습니다."
      description={
        <Space direction="vertical">
          <Text>{faqsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
          {faqsState.errorCode ? (
            <Text type="secondary">오류 코드: {faqsState.errorCode}</Text>
          ) : null}
          {faqsState.data.length > 0 ? (
            <Text type="secondary">
              마지막 성공 상태를 유지한 채 운영 흐름을 계속할 수 있습니다.
            </Text>
          ) : null}
        </Space>
      }
      action={
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload}>
          다시 시도
        </Button>
      }
    />
  ) : faqsState.status === 'pending' && faqsState.data.length > 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 목록을 새로 불러오는 중입니다."
      description="마지막 성공 상태를 유지한 채 최신 데이터를 동기화하고 있습니다."
    />
  ) : faqsState.status === 'empty' ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="등록된 FAQ가 없습니다."
      description="FAQ 등록 버튼으로 첫 FAQ를 추가하세요."
    />
  ) : faqsState.data.length > 0 && visibleFaqs.length === 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="검색 조건에 맞는 FAQ가 없습니다."
      description="검색어, 카테고리, 공개 상태, 날짜 조건을 다시 조정하세요."
    />
  ) : null;

  return (
    <>
        <SearchBar
          searchField={masterSearchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: 'FAQ ID', value: 'id' },
            { label: '질문', value: 'question' },
            { label: '답변', value: 'answer' },
            { label: '검색 키워드', value: 'searchKeywords' }
          ]}
          keyword={keyword}
          onSearchFieldChange={(value) =>
            onCommit({
              searchField: value,
              sortField: null,
              sortOrder: null
            })
          }
          onKeywordChange={(event) =>
            onCommit({ keyword: event.target.value || null })
          }
          detailTitle="상세 검색"
          detailContent={
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <SearchBarDetailField label="최종 수정일">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="카테고리">
                <Select
                  allowClear
                  value={faqCategoryFilter ?? undefined}
                  options={faqCategoryOptions}
                  placeholder="카테고리를 선택하세요."
                  onChange={(value) =>
                    onCommit({ category: value ?? null })
                  }
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="공개 상태">
                <Select
                  allowClear
                  value={faqStatusFilter ?? undefined}
                  options={faqStatusOptions}
                  placeholder="공개 상태를 선택하세요."
                  onChange={(value) =>
                    onCommit({ status: value ?? null })
                  }
                />
              </SearchBarDetailField>
            </Space>
          }
          onApply={handleApplyMasterDateRange}
          onDetailOpenChange={handleDetailOpenChange}
          onReset={handleResetMasterFilters}
          summary={<Text type="secondary">총 {visibleFaqs.length.toLocaleString()}건</Text>}
          actions={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={onReload}>
                새로고침
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={onOpenFaqCreate}
              >
                FAQ 등록
              </Button>
            </Space>
          }
        />
      {faqAlert}
        <AdminDataTable<OperationFaq>
          rowKey="id"
          columns={columns}
          dataSource={visibleFaqs}
          pagination={false}
          loading={faqsState.status === 'pending' && faqsState.data.length === 0}
          locale={{ emptyText: '등록된 FAQ가 없습니다.' }}
          scroll={{ x: 1180 }}
          onChange={handleMasterTableChange}
          onRow={(record) => ({
            onClick: () => onOpenFaqDrawer(record.id),
            style: { cursor: 'pointer' }
          })}
        />
    </>
  );
}

export function FaqCurationSection({
  curationsState,
  visibleCurations,
  columns,
  curationSearchField,
  curationKeyword,
  curationSurfaceFilter,
  curationModeFilter,
  curationExposureStatusFilter,
  onCommit,
  onReload,
  onOpenCurationCreate,
  onOpenCurationDrawer
}: {
  curationsState: AsyncState<OperationFaqCuration[]>;
  visibleCurations: FaqCurationRow[];
  columns: TableColumnsType<FaqCurationRow>;
  curationSearchField: string;
  curationKeyword: string;
  curationSurfaceFilter: OperationFaqExposureSurface | null;
  curationModeFilter: OperationFaqCurationMode | null;
  curationExposureStatusFilter: OperationFaqCurationStatus | null;
  onCommit: CommitFn;
  onReload: () => void;
  onOpenCurationCreate: () => void;
  onOpenCurationDrawer: (curationId: string) => void;
}): JSX.Element {
  const handleCurationTableChange = useCallback<
    NonNullable<TableProps<FaqCurationRow>['onChange']>
  >(
  (_, __, sorter) => {
    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextField =
      nextSorter && typeof nextSorter.field === 'string'
        ? parseValue(nextSorter.field, curationSortFieldValues)
        : null;

    onCommit({
      curationSortField: nextField,
      curationSortOrder: nextField ? nextSorter?.order ?? null : null
    });
  },
  [onCommit]
);

const curationAlert =
  curationsState.status === 'error' ? (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 노출 목록을 불러오지 못했습니다."
      description={
        <Space direction="vertical">
          <Text>{curationsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
          {curationsState.errorCode ? (
            <Text type="secondary">오류 코드: {curationsState.errorCode}</Text>
          ) : null}
        </Space>
      }
      action={
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload}>
          다시 시도
        </Button>
      }
    />
  ) : curationsState.status === 'pending' && curationsState.data.length > 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 노출 정보를 새로 불러오는 중입니다."
      description="마지막 성공 상태를 유지한 채 최신 노출 규칙을 반영하고 있습니다."
    />
  ) : curationsState.status === 'empty' ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="등록된 FAQ 노출 규칙이 없습니다."
      description="노출 추가 버튼으로 홈/고객센터 대표 FAQ를 관리하세요."
    />
  ) : curationsState.data.length > 0 && visibleCurations.length === 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="검색 조건에 맞는 노출 규칙이 없습니다."
      description="노출 위치, 설정 방식, 노출 상태 조건을 다시 조정하세요."
    />
  ) : null;

  return (
    <>
        <SearchBar
          searchField={curationSearchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: '노출 ID', value: 'id' },
            { label: 'FAQ ID', value: 'faqId' },
            { label: '질문', value: 'question' },
            { label: '노출 위치', value: 'surface' }
          ]}
          keyword={curationKeyword}
          onSearchFieldChange={(value) =>
            onCommit({
              curationSearchField: value,
              curationSortField: null,
              curationSortOrder: null
            })
          }
          onKeywordChange={(event) =>
            onCommit({
              curationKeyword: event.target.value || null
            })
          }
          extra={
            <Space wrap>
              <Select
                allowClear
                style={{ width: 180 }}
                value={curationSurfaceFilter ?? undefined}
                options={faqExposureSurfaceOptions}
                placeholder="노출 위치"
                onChange={(value) =>
                  onCommit({ curationSurface: value ?? null })
                }
              />
              <Select
                allowClear
                style={{ width: 160 }}
                value={curationModeFilter ?? undefined}
                options={faqCurationModeOptions}
                placeholder="설정 방식"
                onChange={(value) =>
                  onCommit({ curationMode: value ?? null })
                }
              />
              <Select
                allowClear
                style={{ width: 160 }}
                value={curationExposureStatusFilter ?? undefined}
                options={faqCurationStatusOptions}
                placeholder="노출 상태"
                onChange={(value) =>
                  onCommit({
                    curationExposureStatus: value ?? null
                  })
                }
              />
            </Space>
          }
          summary={
            <Text type="secondary">총 {visibleCurations.length.toLocaleString()}건</Text>
          }
          actions={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={onReload}>
                새로고침
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => onOpenCurationCreate()}
              >
                노출 추가
              </Button>
            </Space>
          }
        />
      {curationAlert}
        <AdminDataTable<FaqCurationRow>
          rowKey="id"
          columns={columns}
          dataSource={visibleCurations}
          pagination={false}
          loading={curationsState.status === 'pending' && curationsState.data.length === 0}
          locale={{ emptyText: '등록된 FAQ 노출 규칙이 없습니다.' }}
          scroll={{ x: 1320 }}
          onChange={handleCurationTableChange}
          onRow={(record) => ({
            onClick: () => onOpenCurationDrawer(record.id),
            style: { cursor: 'pointer' }
          })}
        />
    </>
  );
}

export function FaqMetricSection({
  metricsState,
  visibleMetrics,
  columns,
  metricSearchField,
  metricKeyword,
  onCommit,
  onReload,
  onOpenFaqDrawer
}: {
  metricsState: AsyncState<OperationFaqMetric[]>;
  visibleMetrics: FaqMetricRow[];
  columns: TableColumnsType<FaqMetricRow>;
  metricSearchField: string;
  metricKeyword: string;
  onCommit: CommitFn;
  onReload: () => void;
  onOpenFaqDrawer: (faqId: string) => void;
}): JSX.Element {
  const handleMetricTableChange = useCallback<
    NonNullable<TableProps<FaqMetricRow>['onChange']>
  >(
  (_, __, sorter) => {
    const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
    const nextField =
      nextSorter && typeof nextSorter.field === 'string'
        ? parseValue(nextSorter.field, metricSortFieldValues)
        : null;

    onCommit({
      metricSortField: nextField,
      metricSortOrder: nextField ? nextSorter?.order ?? null : null
    });
  },
  [onCommit]
);

const metricAlert =
  metricsState.status === 'error' ? (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 지표를 불러오지 못했습니다."
      description={
        <Space direction="vertical">
          <Text>{metricsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
          {metricsState.errorCode ? (
            <Text type="secondary">오류 코드: {metricsState.errorCode}</Text>
          ) : null}
        </Space>
      }
      action={
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload}>
          다시 시도
        </Button>
      }
    />
  ) : metricsState.status === 'pending' && metricsState.data.length > 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="FAQ 지표를 새로 불러오는 중입니다."
      description="마지막 성공 상태를 유지한 채 최신 조회/검색 지표를 갱신하고 있습니다."
    />
  ) : metricsState.status === 'empty' ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="표시할 FAQ 지표가 없습니다."
      description="FAQ가 등록되면 조회/검색 지표 스냅샷이 함께 생성됩니다."
    />
  ) : metricsState.data.length > 0 && visibleMetrics.length === 0 ? (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 12 }}
      message="검색 조건에 맞는 FAQ 지표가 없습니다."
      description="FAQ ID, 질문, 검색 키워드 기준으로 다시 검색하세요."
    />
  ) : null;

  return (
    <>
        <SearchBar
          searchField={metricSearchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: 'FAQ ID', value: 'faqId' },
            { label: '질문', value: 'question' },
            { label: '검색 키워드', value: 'searchKeywords' }
          ]}
          keyword={metricKeyword}
          onSearchFieldChange={(value) =>
            onCommit({
              metricSearchField: value,
              metricSortField: null,
              metricSortOrder: null
            })
          }
          onKeywordChange={(event) =>
            onCommit({
              metricKeyword: event.target.value || null
            })
          }
          summary={<Text type="secondary">총 {visibleMetrics.length.toLocaleString()}건</Text>}
          actions={
            <Button icon={<ReloadOutlined />} onClick={onReload}>
              새로고침
            </Button>
          }
        />
      {metricAlert}
        <AdminDataTable<FaqMetricRow>
          rowKey="faqId"
          columns={columns}
          dataSource={visibleMetrics}
          pagination={false}
          loading={metricsState.status === 'pending' && metricsState.data.length === 0}
          locale={{ emptyText: '표시할 FAQ 지표가 없습니다.' }}
          scroll={{ x: 1280 }}
          onChange={handleMetricTableChange}
          onRow={(record) => ({
            onClick: () => onOpenFaqDrawer(record.faqId),
            style: { cursor: record.faq ? 'pointer' : 'default' }
          })}
        />
    </>
  );
}
