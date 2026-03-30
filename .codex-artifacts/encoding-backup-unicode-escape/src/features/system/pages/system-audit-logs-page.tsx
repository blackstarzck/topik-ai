import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCouponStore } from '../../commerce/model/coupon-store';
import { getMockUserById } from '../../users/api/mock-users';
import { usePermissionStore } from '../model/permission-store';
import { useSystemMetadataStore } from '../model/system-metadata-store';
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
import {
  formatUserDisplayName,
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';

const { Paragraph, Text } = Typography;

type AuditLogRow = {
  logId: string;
  targetType: string;
  targetId: string;
  action: string;
  actor: string;
  reason: string;
  createdAt: string;
};

const detailLabelMap: Record<string, string> = {
  logId: '\ub85c\uadf8 ID',
  targetType: '\ub300\uc0c1 \uc720\ud615',
  targetId: '\ub300\uc0c1 ID',
  action: '\uc870\uce58',
  actor: '\uc218\ud589\uc790',
  reason: '\uc0ac\uc720/\uadfc\uac70',
  createdAt: '\uc2dc\uac01'
};

const staticRows: AuditLogRow[] = [
  {
    logId: 'AL-10001',
    targetType: 'Users',
    targetId: 'U00001',
    action: '\ud68c\uc6d0 \uc815\uc9c0',
    actor: 'admin_park',
    reason: '\uc815\ucc45 \uc704\ubc18 \ubc18\ubcf5',
    createdAt: '2026-03-27 09:42:10'
  },
  {
    logId: 'AL-10002',
    targetType: 'Commerce',
    targetId: 'RF-002',
    action: '\ud658\ubd88 \uc2b9\uc778',
    actor: 'admin_kim',
    reason: '\uc11c\ube44\uc2a4 \ubbf8\uc774\ud589 \ud655\uc778',
    createdAt: '2026-03-27 10:15:02'
  },
  {
    logId: 'AL-10003',
    targetType: 'Community',
    targetId: 'POST-002',
    action: '\uac8c\uc2dc\uae00 \uc228\uae40',
    actor: 'admin_lee',
    reason: '\uc815\ucc45 \uc704\ubc18 \ucf58\ud150\uce20',
    createdAt: '2026-03-27 10:33:51'
  },
  {
    logId: 'AL-10004',
    targetType: 'Message',
    targetId: 'MAIL-001',
    action: '\uba54\uc77c \ubc1c\uc1a1',
    actor: 'admin_han',
    reason: '\ubd04 \uc2dc\uc98c \ub274\uc2a4\ub808\ud130 \ubc1c\uc1a1',
    createdAt: '2026-03-27 17:15:00'
  }
];

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
  if (record.targetType !== 'Users') {
    return record.targetId;
  }

  const userName = getMockUserById(record.targetId)?.realName;
  return userName ? formatUserDisplayName(userName, record.targetId) : record.targetId;
}

export default function SystemAuditLogsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const permissionAudits = usePermissionStore((state) => state.audits);
  const couponAudits = useCouponStore((state) => state.audits);
  const metadataAudits = useSystemMetadataStore((state) => state.audits);
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

  const mergedRows = useMemo(() => {
    const permissionRows: AuditLogRow[] = permissionAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

    const couponRows: AuditLogRow[] = couponAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

    const metadataRows: AuditLogRow[] = metadataAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

    return [...metadataRows, ...couponRows, ...permissionRows, ...staticRows].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }, [couponAudits, metadataAudits, permissionAudits]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return mergedRows.filter((row) => {
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
  }, [endDate, keyword, mergedRows, searchField, startDate, targetIdFilter, targetTypeFilter]);

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
        label: '\ud604\uc7ac \uacb0\uacfc',
        value: `${filteredRows.length.toLocaleString()}\uac74`
      },
      {
        key: 'admin',
        label: '\uad8c\ud55c \ubcc0\uacbd \ub85c\uadf8',
        value: `${adminAuditCount.toLocaleString()}\uac74`
      },
      {
        key: 'today',
        label: '\uc624\ub298 \uc0dd\uc131 \ub85c\uadf8',
        value: `${todayCount.toLocaleString()}\uac74`
      }
    ],
    [adminAuditCount, filteredRows.length, todayCount]
  );

  const columns = useMemo<TableColumnsType<AuditLogRow>>(
    () => [
      {
        title: '\ub85c\uadf8 ID',
        dataIndex: 'logId',
        width: 130,
        sorter: createTextSorter((record) => record.logId)
      },
      {
        title: '\ub300\uc0c1 \uc720\ud615',
        dataIndex: 'targetType',
        width: 140,
        sorter: createTextSorter((record) => getTargetTypeLabel(record.targetType)),
        render: (value: string) => getTargetTypeLabel(value)
      },
      {
        title: '\ub300\uc0c1 ID',
        dataIndex: 'targetId',
        width: 180,
        sorter: createTextSorter((record) => getAuditTargetDisplay(record)),
        render: (value: string, record) => {
          const route = getTargetRoute(record.targetType, value);
          if (!route) {
            return getAuditTargetDisplay(record);
          }

          if (record.targetType === 'Users') {
            const userName = getMockUserById(value)?.realName;
            if (userName) {
              return <UserNavigationLink stopPropagation userId={value} userName={userName} />;
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
        title: '\uc870\uce58',
        dataIndex: 'action',
        width: 150,
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '\uc218\ud589\uc790',
        dataIndex: 'actor',
        width: 130,
        sorter: createTextSorter((record) => record.actor)
      },
      {
        title: '\uc0ac\uc720/\uadfc\uac70',
        dataIndex: 'reason',
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '\uc2dc\uac01',
        dataIndex: 'createdAt',
        width: 180,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="\uac10\uc0ac \ub85c\uadf8" />
      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '\uc804\uccb4', value: 'all' },
              { label: '\ub85c\uadf8 ID', value: 'logId' },
              { label: '\ub300\uc0c1 ID', value: 'targetId' },
              { label: '\uc870\uce58', value: 'action' },
              { label: '\uc218\ud589\uc790', value: 'actor' },
              { label: '\uc0ac\uc720', value: 'reason' }
            ]}
            keyword={keyword}
            keywordPlaceholder="\uac10\uc0ac \ub85c\uadf8 \uac80\uc0c9"
            detailTitle="\uc0c1\uc138 \uac80\uc0c9"
            detailContent={
              <SearchBarDetailField label="\uc2dc\uac01">
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
            summary={<Text type="secondary">\ucd1d {filteredRows.length.toLocaleString()}\uac74</Text>}
          />
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          \ub300\uc0c1 ID \ub9c1\ud06c\ub97c \ub204\ub974\uba74 \uad00\ub828 \uc6b4\uc601 \ud654\uba74\uc73c\ub85c \uc774\ub3d9\ud569\ub2c8\ub2e4.
          {targetIdFilter ? (
            <>
              {' '}
              \ud604\uc7ac\ub294 <Text strong>{targetIdFilter}</Text> \ub300\uc0c1 \uc774\ub825\ub9cc \ubcf4\uace0 \uc788\uc2b5\ub2c8\ub2e4.
            </>
          ) : null}
        </Paragraph>

        <AdminDataTable<AuditLogRow>
          rowKey="logId"
          pagination={false}
          scroll={{ x: 1300 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="\uac10\uc0ac \ub85c\uadf8 \uc0c1\uc138"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
