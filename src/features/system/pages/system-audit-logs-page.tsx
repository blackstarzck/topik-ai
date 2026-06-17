import { Alert, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { fetchSystemAuditLogsSafe } from '../api/system-audit-logs-service';
import type { SystemAuditLogRow as AuditLogRow } from '../model/system-log-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import { UserNavigationLink } from '../../../shared/ui/user/user-reference';

const { Paragraph, Text } = Typography;

const detailLabelMap: Record<string, string> = {
  logId: '로그 ID',
  targetType: '대상 유형',
  targetId: '대상 ID',
  action: '조치',
  actor: '수행자',
  reason: '사유/근거',
  createdAt: '시각'
};

function getTargetRoute(targetType: string, targetId: string): string | null {
  if (targetType === 'Users') {
    return `/users/${targetId}?tab=profile`;
  }
  if (targetType === 'Instructor') {
    return `/users/groups?selected=${targetId}`;
  }
  if (targetType === 'Referral') {
    return `/users/referrals?selected=${targetId}`;
  }
  if (targetType === 'Community') {
    return '/community/posts';
  }
  if (targetType === 'CommunityPost') {
    return `/community/posts?selected=${targetId}`;
  }
  if (targetType === 'CommunityReport') {
    return `/community/reports?searchField=id&keyword=${targetId}`;
  }
  if (targetType === 'Billing' || targetType === 'Commerce') {
    if (targetId.startsWith('RF-')) {
      return `/commerce/refunds?keyword=${targetId}`;
    }
    return `/commerce/payments?keyword=${targetId}`;
  }
  if (targetType === 'CommerceCoupon') {
    return `/commerce/coupons?selected=${targetId}`;
  }
  if (targetType === 'CommerceCouponTemplate') {
    return `/commerce/coupons?view=subscriptionTemplate&selected=${targetId}`;
  }
  if (targetType === 'Notification' || targetType === 'Message') {
    if (targetId.startsWith('MAIL-')) {
      return '/messages/mail?tab=auto';
    }
    if (targetId.startsWith('PUSH-')) {
      return '/messages/push?tab=auto';
    }
    if (targetId.startsWith('GRP-')) {
      return '/messages/groups';
    }
    return '/messages/history?channel=mail';
  }
  if (targetType === 'Operation') {
    if (targetId.startsWith('EVT-')) {
      return `/operation/events?selected=${targetId}`;
    }
    if (targetId.startsWith('FAQ-')) {
      return `/operation/faq?selected=${targetId}`;
    }
    if (targetId.startsWith('NOTICE-')) {
      return `/operation/notices?preview=${targetId}`;
    }
    return '/operation/notices';
  }
  if (targetType === 'OperationNotice') {
    return `/operation/notices?preview=${targetId}`;
  }
  if (targetType === 'OperationEvent') {
    return `/operation/events?selected=${targetId}`;
  }
  if (targetType === 'OperationFaq') {
    return `/operation/faq?selected=${targetId}`;
  }
  if (targetType === 'OperationFaqCuration') {
    return `/operation/faq?tab=curation&curationSelected=${targetId}`;
  }
  if (targetType === 'OperationPolicy') {
    return `/operation/policies?selected=${targetId}`;
  }
  if (targetType === 'SystemMetadataGroup') {
    return `/system/metadata?selected=${targetId}`;
  }
  if (targetType === 'Assessment') {
    if (targetId.startsWith('EPS-')) {
      return '/assessment/question-bank/eps-topik';
    }
    if (targetId.startsWith('LVT-')) {
      return '/assessment/level-tests';
    }
    return '/assessment/question-bank';
  }
  if (targetType === 'AssessmentQuestion') {
    // P3 라우트 개명(202f905): 구 /review/:questionId → /:questionId (조회 전용 상세).
    return `/assessment/question-bank/${targetId}`;
  }
  if (targetType === 'AssessmentTagMaster') {
    // P5-3: 태그 마스터 토글의 원본 화면 = 마스터 카탈로그 섹션(태그 탭).
    return '/system/metadata';
  }
  if (targetType === 'Content') {
    if (targetId.startsWith('VOC-SON-')) {
      return '/content/vocabulary/sonagi';
    }
    if (targetId.startsWith('VOC-MC-')) {
      return '/content/vocabulary/multiple-choice';
    }
    if (targetId.startsWith('VOC-')) {
      return '/content/vocabulary';
    }
    if (targetId.startsWith('BADGE-')) {
      return '/content/badges';
    }
    if (targetId.startsWith('MISSION-')) {
      return '/content/missions';
    }
    return '/content/library';
  }
  if (targetType === 'Admin' || targetType === 'System') {
    return `/system/admins?keyword=${targetId}`;
  }
  return null;
}

function getAuditTargetDisplay(record: AuditLogRow): string {
  return record.targetDisplayName ?? record.targetId;
}

export default function SystemAuditLogsPage(): JSX.Element {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loadState, setLoadState] = useState<'pending' | 'success' | 'error'>('pending');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const targetTypeFilter = searchParams.get('targetType') ?? '';
  const targetIdFilter = searchParams.get('targetId') ?? '';
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  useEffect(() => {
    const controller = new AbortController();

    setLoadState('pending');
    setLoadErrorMessage('');
    void fetchSystemAuditLogsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setRows(result.data);
        setLoadState('success');
        return;
      }

      setLoadErrorMessage(result.error.message);
      setLoadState('error');
    });

    return () => {
      controller.abort();
    };
  }, []);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (targetTypeFilter && row.targetType !== targetTypeFilter) {
        return false;
      }
      if (targetIdFilter && row.targetId !== targetIdFilter) {
        return false;
      }
      if (!matchesSearchDateRange(row.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        logId: row.logId,
        targetId: getAuditTargetDisplay(row),
        action: row.action,
        actor: row.actor,
        reason: row.reason
      });
    });
  }, [endDate, keyword, rows, searchField, startDate, targetIdFilter, targetTypeFilter]);

  const commitParams = useCallback(
    (
      next: Partial<Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string | null>>
    ) => {
      const merged = new URLSearchParams(searchParams);
      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            ...selectedRow,
            targetTypeLabel: getTargetTypeLabel(selectedRow.targetType),
            targetIdDisplay: getAuditTargetDisplay(selectedRow)
          }
        : null,
    [selectedRow]
  );

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayCount = filteredRows.filter((row) => row.createdAt.startsWith(todayPrefix)).length;
  const adminAuditCount = filteredRows.filter((row) => row.targetType === 'Admin').length;

  const summaryItems = useMemo(
    () => [
      {
        key: 'all',
        label: '현재 결과',
        value: `${filteredRows.length.toLocaleString()}건`
      },
      {
        key: 'admin',
        label: '권한 변경 로그',
        value: `${adminAuditCount.toLocaleString()}건`
      },
      {
        key: 'today',
        label: '오늘 생성 로그',
        value: `${todayCount.toLocaleString()}건`
      }
    ],
    [adminAuditCount, filteredRows.length, todayCount]
  );

  const columns = useMemo<TableColumnsType<AuditLogRow>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'logId',
        width: 130,
        sorter: createTextSorter((record) => record.logId)
      },
      {
        title: '대상 유형',
        dataIndex: 'targetType',
        width: 140,
        sorter: createTextSorter((record) => getTargetTypeLabel(record.targetType)),
        render: (value: string) => getTargetTypeLabel(value)
      },
      {
        title: '대상 ID',
        dataIndex: 'targetId',
        width: 180,
        sorter: createTextSorter((record) => getAuditTargetDisplay(record)),
        render: (value: string, record) => {
          const route = getTargetRoute(record.targetType, value);
          if (!route) {
            return getAuditTargetDisplay(record);
          }

          if (record.targetType === 'Users') {
            if (record.targetUserName) {
              return (
                <UserNavigationLink
                  stopPropagation
                  userId={value}
                  userName={record.targetUserName}
                />
              );
            }
          }

          return (
            <Link
              className="table-navigation-link"
              to={route}
              onClick={(event) => event.stopPropagation()}
            >
              {getAuditTargetDisplay(record)}
            </Link>
          );
        }
      },
      {
        title: '조치',
        dataIndex: 'action',
        width: 150,
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '수행자',
        dataIndex: 'actor',
        width: 130,
        sorter: createTextSorter((record) => record.actor)
      },
      {
        title: '사유/근거',
        dataIndex: 'reason',
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 180,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="감사 로그" />
      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '로그 ID', value: 'logId' },
              { label: '대상 ID', value: 'targetId' },
              { label: '조치', value: 'action' },
              { label: '수행자', value: 'actor' },
              { label: '사유', value: 'reason' }
            ]}
            keyword={keyword}
            keywordPlaceholder="감사 로그 검색"
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="시각">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={<Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>}
          />
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          대상 ID 링크를 누르면 관련 운영 화면으로 이동합니다.
          {targetIdFilter ? (
            <>
              {' '}
              현재는 <Text strong>{targetIdFilter}</Text> 대상 이력만 보고 있습니다.
            </>
          ) : null}
        </Paragraph>

        {loadState === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="\uAC10\uC0AC \uB85C\uADF8\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
            description={loadErrorMessage}
          />
        ) : null}
        <AdminDataTable<AuditLogRow>
          rowKey="logId"
          pagination={false}
          scroll={{ x: 1300 }}
          columns={columns}
          dataSource={filteredRows}
          loading={loadState === 'pending'}
          locale={{ emptyText: loadState === 'error' ? loadErrorMessage : '\uC870\uD68C\uB41C \uAC10\uC0AC \uB85C\uADF8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' }}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="감사 로그 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
