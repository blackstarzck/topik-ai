import { Alert, Button, Card, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCallback } from 'react';

import type { GroupSearchParamKey } from '../model/message-groups-page-schema';
import type { MessageGroup } from '../model/types';
import type { AsyncState } from '@/shared/model/async-state';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';

const { Paragraph, Text } = Typography;

// 대상 그룹 목록 섹션 — 검색 툴바+안내문+빈 결과 알림+테이블을 Phase 4 분해로 페이지에서
// 이동(동작 동일). 적용된 URL 값·커밋 콜백·목록 데이터·컬럼은 페이지가 소유하고, 상세
// 검색 날짜 초안(useSearchBarDateDraft·적용 커밋)은 입력 UX 로 섹션 내부에서 관리한다.
export type MessageGroupsTableSectionProps = {
  searchField: string;
  keyword: string;
  startDate: string;
  endDate: string;
  syncSearchParams: (next: Partial<Record<GroupSearchParamKey, string | null>>) => void;
  visibleGroups: MessageGroup[];
  columns: TableColumnsType<MessageGroup>;
  loadState: AsyncState<null>;
  openCreateDrawer: () => void;
  openEditDrawer: (group: MessageGroup) => void;
};

export function MessageGroupsTableSection({
  searchField,
  keyword,
  startDate,
  endDate,
  syncSearchParams,
  visibleGroups,
  columns,
  loadState,
  openCreateDrawer,
  openEditDrawer
}: MessageGroupsTableSectionProps): JSX.Element {
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const handleApplyDateRange = useCallback(() => {
    syncSearchParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [draftEndDate, draftStartDate, keyword, searchField, syncSearchParams]);

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 8
        }}
      >
        <div style={{ flex: 1 }}>
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '그룹 이름', value: 'name' },
              { label: '설명', value: 'description' },
              { label: '조건 요약', value: 'ruleSummary' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => syncSearchParams({ searchField: value })}
            onKeywordChange={(event) =>
              syncSearchParams({
                keyword: event.target.value,
                searchField
              })
            }
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="마지막 계산일">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={
              <Text type="secondary">총 {visibleGroups.length.toLocaleString()}건</Text>
            }
          />
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateDrawer}>
          그룹 추가
        </Button>
      </div>

      <Paragraph type="secondary" style={{ marginTop: 0 }}>
        메일과 푸시에서 공용으로 사용하는 대상 그룹입니다. 행을 클릭하면 우측에서 그룹 조건과
        예상 수신자 수를 바로 조정할 수 있습니다.
      </Paragraph>

      {loadState.status !== 'pending' && visibleGroups.length === 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="조건에 맞는 대상 그룹이 없습니다."
          description="검색어 또는 정의 방식을 조정하거나 새 그룹을 생성하세요."
        />
      ) : null}

      <AdminDataTable<MessageGroup>
        rowKey="id"
        columns={columns}
        dataSource={visibleGroups}
        onRow={(record) => ({
          onClick: () => openEditDrawer(record),
          style: { cursor: 'pointer' }
        })}
        loading={loadState.status === 'pending'}
        pagination={false}
        scroll={{ x: 1180 }}
      />
    </Card>
  );
}
