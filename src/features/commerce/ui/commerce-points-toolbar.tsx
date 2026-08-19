import { Button, Select, Space, Typography } from 'antd';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  defaultPointExpirationQuery,
  defaultPointLedgerQuery,
  defaultPointPolicyQuery
} from '../model/point-schema';
import type {
  ExpirationDraftFilter,
  LedgerDraftFilter,
  PolicyDraftFilter
} from '../model/commerce-points-page-schema';
import type {
  CommercePointsQuery,
  PointExpiration,
  PointExpirationQuery,
  PointLedger,
  PointLedgerQuery,
  PointPolicyQuery
} from '../model/point-types';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';

const { Text } = Typography;

// 포인트 검색 툴바 — 탭별 검색 필드/상세 필터/조치 버튼을 Phase 4 분해로 페이지에서
// 이동(동작 동일). 적용된 URL 질의와 커밋 콜백·모달 오프너·내보내기는 페이지가 소유하고,
// 상세 필터 초안(정책·원장·소멸 + 날짜 초안 2벌)은 입력 UX 로 툴바 내부에서 관리한다.
export type CommercePointsSearchToolbarProps = {
  query: CommercePointsQuery;
  activeCount: number;
  commitPolicyQuery: (next: Partial<PointPolicyQuery>) => void;
  commitLedgerQuery: (next: Partial<PointLedgerQuery>) => void;
  commitExpirationQuery: (next: Partial<PointExpirationQuery>) => void;
  openCreatePolicyModal: () => void;
  openManualAdjustmentModal: (ledger?: PointLedger | null) => void;
  openExpirationHoldModal: (expiration?: PointExpiration | null) => void;
  handleExportExpirations: () => Promise<void>;
};

export function CommercePointsSearchToolbar({
  query,
  activeCount,
  commitPolicyQuery,
  commitLedgerQuery,
  commitExpirationQuery,
  openCreatePolicyModal,
  openManualAdjustmentModal,
  openExpirationHoldModal,
  handleExportExpirations
}: CommercePointsSearchToolbarProps): JSX.Element {
  const [policyDraft, setPolicyDraft] = useState<PolicyDraftFilter>({
    status: defaultPointPolicyQuery.status,
    type: defaultPointPolicyQuery.type
  });
  const [ledgerDraft, setLedgerDraft] = useState<LedgerDraftFilter>({
    type: defaultPointLedgerQuery.type,
    sourceType: defaultPointLedgerQuery.sourceType,
    status: defaultPointLedgerQuery.status
  });
  const [expirationDraft, setExpirationDraft] = useState<ExpirationDraftFilter>({
    status: defaultPointExpirationQuery.status
  });
  const {
    draftStartDate: draftLedgerStartDate,
    draftEndDate: draftLedgerEndDate,
    handleDraftDateChange: handleLedgerDraftDateChange,
    handleDraftReset: handleLedgerDraftReset,
    handleDetailOpenChange: handleLedgerDetailOpenChangeBase
  } = useSearchBarDateDraft(query.ledger.startDate, query.ledger.endDate);
  const {
    draftStartDate: draftExpirationStartDate,
    draftEndDate: draftExpirationEndDate,
    handleDraftDateChange: handleExpirationDraftDateChange,
    handleDraftReset: handleExpirationDraftReset,
    handleDetailOpenChange: handleExpirationDetailOpenChangeBase
  } = useSearchBarDateDraft(
    query.expiration.startDate,
    query.expiration.endDate
  );

  useEffect(() => {
    setPolicyDraft({
      status: query.policy.status,
      type: query.policy.type
    });
  }, [query.policy.status, query.policy.type]);

  useEffect(() => {
    setLedgerDraft({
      type: query.ledger.type,
      sourceType: query.ledger.sourceType,
      status: query.ledger.status
    });
  }, [query.ledger.sourceType, query.ledger.status, query.ledger.type]);

  useEffect(() => {
    setExpirationDraft({
      status: query.expiration.status
    });
  }, [query.expiration.status]);

  const handlePolicyDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setPolicyDraft({
        status: query.policy.status,
        type: query.policy.type
      });
    },
    [query.policy.status, query.policy.type]
  );

  const handleLedgerDetailOpenChange = useCallback(
    (open: boolean) => {
      handleLedgerDetailOpenChangeBase(open);
      if (open) {
        return;
      }

      setLedgerDraft({
        type: query.ledger.type,
        sourceType: query.ledger.sourceType,
        status: query.ledger.status
      });
    },
    [
      handleLedgerDetailOpenChangeBase,
      query.ledger.sourceType,
      query.ledger.status,
      query.ledger.type
    ]
  );

  const handleExpirationDetailOpenChange = useCallback(
    (open: boolean) => {
      handleExpirationDetailOpenChangeBase(open);
      if (open) {
        return;
      }

      setExpirationDraft({
        status: query.expiration.status
      });
    },
    [handleExpirationDetailOpenChangeBase, query.expiration.status]
  );

  const handleSearchFieldChange = useCallback(
    (value: string) => {
      if (query.tab === 'policy') {
        commitPolicyQuery({
          searchField: value as PointPolicyQuery['searchField'],
          page: 1
        });
        return;
      }

      if (query.tab === 'ledger') {
        commitLedgerQuery({
          searchField: value as PointLedgerQuery['searchField'],
          page: 1
        });
        return;
      }

      commitExpirationQuery({
        searchField: value as PointExpirationQuery['searchField'],
        page: 1
      });
    },
    [commitExpirationQuery, commitLedgerQuery, commitPolicyQuery, query.tab]
  );

  const handleKeywordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (query.tab === 'policy') {
        commitPolicyQuery({
          keyword: event.target.value,
          page: 1
        });
        return;
      }

      if (query.tab === 'ledger') {
        commitLedgerQuery({
          keyword: event.target.value,
          page: 1
        });
        return;
      }

      commitExpirationQuery({
        keyword: event.target.value,
        page: 1
      });
    },
    [commitExpirationQuery, commitLedgerQuery, commitPolicyQuery, query.tab]
  );

  const activeSearchField =
    query.tab === 'policy'
      ? query.policy.searchField
      : query.tab === 'ledger'
        ? query.ledger.searchField
        : query.expiration.searchField;
  const activeKeyword =
    query.tab === 'policy'
      ? query.policy.keyword
      : query.tab === 'ledger'
        ? query.ledger.keyword
        : query.expiration.keyword;

  const policyDetailContent = (
    <>
      <SearchBarDetailField label="정책 상태">
        <Select
          value={policyDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '초안', value: '초안' },
            { label: '운영 중', value: '운영 중' },
            { label: '중지', value: '중지' }
          ]}
          onChange={(value) =>
            setPolicyDraft((prev) => ({
              ...prev,
              status: value as PolicyDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="정책 유형">
        <Select
          value={policyDraft.type}
          options={[
            { label: '전체 유형', value: 'all' },
            { label: '적립', value: '적립' },
            { label: '차감', value: '차감' },
            { label: '소멸', value: '소멸' }
          ]}
          onChange={(value) =>
            setPolicyDraft((prev) => ({
              ...prev,
              type: value as PolicyDraftFilter['type']
            }))
          }
        />
      </SearchBarDetailField>
    </>
  );

  const ledgerDetailContent = (
    <>
      <SearchBarDetailField label="원장 유형">
        <Select
          value={ledgerDraft.type}
          options={[
            { label: '전체 유형', value: 'all' },
            { label: '적립', value: '적립' },
            { label: '차감', value: '차감' },
            { label: '회수', value: '회수' },
            { label: '복구', value: '복구' },
            { label: '소멸', value: '소멸' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              type: value as LedgerDraftFilter['type']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="발생 원천">
        <Select
          value={ledgerDraft.sourceType}
          options={[
            { label: '전체 원천', value: 'all' },
            { label: '추천', value: '추천' },
            { label: '미션', value: '미션' },
            { label: '이벤트', value: '이벤트' },
            { label: '결제', value: '결제' },
            { label: '환불', value: '환불' },
            { label: '관리자', value: '관리자' },
            { label: '시스템', value: '시스템' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              sourceType: value as LedgerDraftFilter['sourceType']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="처리 상태">
        <Select
          value={ledgerDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '완료', value: '완료' },
            { label: '보류', value: '보류' },
            { label: '취소', value: '취소' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              status: value as LedgerDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="발생 기간">
        <SearchBarDateRange
          startDate={draftLedgerStartDate}
          endDate={draftLedgerEndDate}
          onChange={handleLedgerDraftDateChange}
        />
      </SearchBarDetailField>
    </>
  );

  const expirationDetailContent = (
    <>
      <SearchBarDetailField label="소멸 상태">
        <Select
          value={expirationDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '예정', value: '예정' },
            { label: '보류', value: '보류' },
            { label: '완료', value: '완료' },
            { label: '취소', value: '취소' }
          ]}
          onChange={(value) =>
            setExpirationDraft((prev) => ({
              ...prev,
              status: value as ExpirationDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="예정 기간">
        <SearchBarDateRange
          startDate={draftExpirationStartDate}
          endDate={draftExpirationEndDate}
          onChange={handleExpirationDraftDateChange}
        />
      </SearchBarDetailField>
    </>
  );

  const activeSearchBarProps =
    query.tab === 'policy'
      ? {
          searchFieldOptions: [
            { label: '정책명', value: 'name' },
            { label: '정책 ID', value: 'id' }
          ],
          keywordPlaceholder: '정책명 또는 정책 ID 검색',
          detailContent: policyDetailContent,
          onApply: () =>
            commitPolicyQuery({
              page: 1,
              status: policyDraft.status,
              type: policyDraft.type
            }),
          onReset: () =>
            setPolicyDraft({
              status: defaultPointPolicyQuery.status,
              type: defaultPointPolicyQuery.type
            }),
          onDetailOpenChange: handlePolicyDetailOpenChange,
          actions: (
            <Button type="primary" size="large" onClick={openCreatePolicyModal}>
              정책 등록
            </Button>
          )
        }
      : query.tab === 'ledger'
        ? {
            searchFieldOptions: [
              { label: '회원 ID', value: 'userId' },
              { label: '회원명', value: 'userName' },
              { label: '원장 ID', value: 'id' }
            ],
            keywordPlaceholder: '회원 ID, 회원명 또는 원장 ID 검색',
            detailContent: ledgerDetailContent,
            onApply: () =>
              commitLedgerQuery({
                page: 1,
                type: ledgerDraft.type,
                sourceType: ledgerDraft.sourceType,
                status: ledgerDraft.status,
                startDate: draftLedgerStartDate,
                endDate: draftLedgerEndDate
              }),
            onReset: () => {
              setLedgerDraft({
                type: defaultPointLedgerQuery.type,
                sourceType: defaultPointLedgerQuery.sourceType,
                status: defaultPointLedgerQuery.status
              });
              handleLedgerDraftReset();
            },
            onDetailOpenChange: handleLedgerDetailOpenChange,
            actions: (
              <Button
                type="primary"
                size="large"
                onClick={() => openManualAdjustmentModal()}
              >
                포인트 수동 조정
              </Button>
            )
          }
        : {
            searchFieldOptions: [
              { label: '회원 ID', value: 'userId' },
              { label: '회원명', value: 'userName' },
              { label: '소멸 ID', value: 'id' }
            ],
            keywordPlaceholder: '회원 ID, 회원명 또는 소멸 ID 검색',
            detailContent: expirationDetailContent,
            onApply: () =>
              commitExpirationQuery({
                page: 1,
                status: expirationDraft.status,
                startDate: draftExpirationStartDate,
                endDate: draftExpirationEndDate
              }),
            onReset: () => {
              setExpirationDraft({
                status: defaultPointExpirationQuery.status
              });
              handleExpirationDraftReset();
            },
            onDetailOpenChange: handleExpirationDetailOpenChange,
            actions: (
              <Space wrap>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => openExpirationHoldModal()}
                >
                  소멸 보류 등록
                </Button>
                <Button size="large" onClick={handleExportExpirations}>
                  내역 내보내기
                </Button>
              </Space>
            )
          };

  return (
    <SearchBar
      searchField={activeSearchField}
      searchFieldOptions={activeSearchBarProps.searchFieldOptions}
      keyword={activeKeyword}
      onSearchFieldChange={handleSearchFieldChange}
      onKeywordChange={handleKeywordChange}
      keywordPlaceholder={activeSearchBarProps.keywordPlaceholder}
      detailContent={activeSearchBarProps.detailContent}
      onApply={activeSearchBarProps.onApply}
      onReset={activeSearchBarProps.onReset}
      onDetailOpenChange={activeSearchBarProps.onDetailOpenChange}
      summary={<Text type="secondary">총 {activeCount.toLocaleString()}건</Text>}
      actions={activeSearchBarProps.actions}
    />
  );
}
