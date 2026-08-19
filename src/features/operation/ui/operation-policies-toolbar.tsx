import { Button, Select, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import {
  operationPolicyCategoryValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from '../model/policy-types';
import type {
  OperationPolicyCategory,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from '../model/policy-types';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';

const { Text } = Typography;

// 정책 목록 검색/상세 필터 툴바 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 적용된 URL 값과 커밋 콜백은 페이지가 소유하고, 상세 필터 초안 상태(운영 영역·정책
// 유형·추적 상태·시행일)는 입력 UX 로 툴바 내부에서 관리한다.

export type OperationPoliciesToolbarProps = {
  searchField: string;
  keyword: string;
  categoryFilter: OperationPolicyCategory | null;
  policyTypeFilter: OperationPolicyType | null;
  trackingStatusFilter: OperationPolicyTrackingStatus | null;
  startDate: string;
  endDate: string;
  filteredCount: number;
  onCommit: (
    next: Partial<
      Record<
        | 'searchField'
        | 'keyword'
        | 'category'
        | 'policyType'
        | 'trackingStatus'
        | 'startDate'
        | 'endDate'
        | 'selected',
        string | null
      >
    >
  ) => void;
  onCreate: () => void;
};

export function OperationPoliciesToolbar({
  searchField,
  keyword,
  categoryFilter,
  policyTypeFilter,
  trackingStatusFilter,
  startDate,
  endDate,
  filteredCount,
  onCommit,
  onCreate
}: OperationPoliciesToolbarProps): JSX.Element {
  const [draftCategory, setDraftCategory] = useState(categoryFilter ?? '');
  const [draftPolicyType, setDraftPolicyType] = useState(policyTypeFilter ?? '');
  const [draftTrackingStatus, setDraftTrackingStatus] = useState(
    trackingStatusFilter ?? ''
  );
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

useEffect(() => {
  setDraftCategory(categoryFilter ?? '');
}, [categoryFilter]);

useEffect(() => {
  setDraftPolicyType(policyTypeFilter ?? '');
}, [policyTypeFilter]);

useEffect(() => {
  setDraftTrackingStatus(trackingStatusFilter ?? '');
}, [trackingStatusFilter]);

  const handleApplyDetailFilters = useCallback(() => {
    onCommit({
      category: draftCategory || null,
      policyType: draftPolicyType || null,
      trackingStatus: draftTrackingStatus || null,
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      selected: null
    });
  }, [
    onCommit,
    draftCategory,
    draftEndDate,
    draftPolicyType,
    draftStartDate,
    draftTrackingStatus
  ]);

  const handleResetDetailFilters = useCallback(() => {
    setDraftCategory('');
    setDraftPolicyType('');
    setDraftTrackingStatus('');
    handleDraftReset();
  }, [handleDraftReset]);

  const handleSearchBarDetailOpenChange = useCallback(
    (open: boolean) => {
      handleDetailOpenChange(open);

      if (!open) {
        setDraftCategory(categoryFilter ?? '');
        setDraftPolicyType(policyTypeFilter ?? '');
        setDraftTrackingStatus(trackingStatusFilter ?? '');
      }
    },
    [categoryFilter, handleDetailOpenChange, policyTypeFilter, trackingStatusFilter]
  );

  return (
<SearchBar
  searchField={searchField}
  searchFieldOptions={[
    { label: '전체', value: 'all' },
    { label: '정책 ID', value: 'id' },
    { label: '운영 영역', value: 'category' },
    { label: '문서명', value: 'title' },
    { label: '추적 상태', value: 'trackingStatus' },
    { label: '연관 관리자 화면', value: 'relatedAdminPages' },
    { label: '연관 사용자 화면', value: 'relatedUserPages' },
    { label: '추적 문서', value: 'sourceDocuments' },
    { label: '버전', value: 'versionLabel' },
    { label: '법령/근거', value: 'legalReferences' }
  ]}
  keyword={keyword}
  onSearchFieldChange={(value) =>
    onCommit({ searchField: value, selected: null })
  }
  onKeywordChange={(event) =>
    onCommit({
      keyword: event.target.value,
      searchField,
      selected: null
    })
  }
  keywordPlaceholder="정책 ID, 문서명, 버전, 법령/근거 검색"
  detailTitle="상세 필터"
  detailContent={
    <>
      <SearchBarDetailField label="운영 영역">
        <Select
          allowClear
          value={draftCategory || undefined}
          options={operationPolicyCategoryValues.map((value) => ({
            label: value,
            value
          }))}
          placeholder="운영 영역 선택"
          onChange={(value) => setDraftCategory(value ?? '')}
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="정책 유형">
        <Select
          allowClear
          value={draftPolicyType || undefined}
          options={operationPolicyTypeValues.map((value) => ({
            label: value,
            value
          }))}
          placeholder="정책 유형 선택"
          onChange={(value) => setDraftPolicyType(value ?? '')}
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="추적 상태">
        <Select
          allowClear
          value={draftTrackingStatus || undefined}
          options={operationPolicyTrackingStatusValues.map((value) => ({
            label: value,
            value
          }))}
          placeholder="추적 상태 선택"
          onChange={(value) => setDraftTrackingStatus(value ?? '')}
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="시행일">
        <SearchBarDateRange
          startDate={draftStartDate}
          endDate={draftEndDate}
          onChange={handleDraftDateChange}
        />
      </SearchBarDetailField>
    </>
  }
  onApply={handleApplyDetailFilters}
  onDetailOpenChange={handleSearchBarDetailOpenChange}
  onReset={handleResetDetailFilters}
  summary={
    <Text type="secondary">
      총 {filteredCount.toLocaleString()}건
    </Text>
  }
  actions={
    <Button type="primary" size="large" onClick={onCreate}>
      새 정책 등록
    </Button>
  }
/>
  );
}
