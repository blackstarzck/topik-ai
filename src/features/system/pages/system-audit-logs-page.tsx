import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAssessmentQuestionBankStore } from '../../assessment/model/assessment-question-bank-store';
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
  logId: '로그 ID',
  targetType: '대상 유형',
  targetId: '대상 ID',
  action: '조치',
  actor: '수행자',
  reason: '사유/근거',
  createdAt: '시각'
};

const staticRows: AuditLogRow[] = [
  {
    logId: 'AL-10001',
    targetType: 'Users',
    targetId: 'U00001',
    action: '회원 정지',
    actor: 'admin_park',
    reason: '정책 위반 반복',
    createdAt: '2026-03-27 09:42:10'
  },
  {
    logId: 'AL-10002',
    targetType: 'Commerce',
    targetId: 'RF-002',
    action: '환불 승인',
    actor: 'admin_kim',
    reason: '서비스 미이행 확인',
    createdAt: '2026-03-27 10:15:02'
  },
  {
    logId: 'AL-10003',
    targetType: 'Community',
    targetId: 'POST-002',
    action: '게시글 숨김',
    actor: 'admin_lee',
    reason: '정책 위반 콘텐츠',
    createdAt: '2026-03-27 10:33:51'
  },
  {
    logId: 'AL-10004',
    targetType: 'Message',
    targetId: 'MAIL-001',
    action: '메일 발송',
    actor: 'admin_han',
    reason: '봄 시즌 뉴스레터 발송',
    createdAt: '2026-03-27 17:15:00'
  }
];

function getAuditActionLabel(action: string): string {
  if (action === 'review_memo_saved') {
    return '검수 메모 저장';
  }
  if (action === 'review_completed') {
    return '검수 완료';
  }
  if (action === 'review_on_hold') {
    return '보류';
  }
  if (action === 'review_revision_requested') {
    return '수정 필요';
  }
  if (action === 'operation_candidate_exposed') {
    return '노출 후보';
  }
  if (action === 'operation_candidate_hidden') {
    return '숨김 후보';
  }
  if (action === 'operation_excluded') {
    return '운영 제외';
  }
  return action;
}

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
  if (targetType === 'AssessmentQuestion') {
    return `/assessment/question-bank/review/${targetId}?tab=review`;
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
  const assessmentAudits = useAssessmentQuestionBankStore((state) => state.audits);
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
    const assessmentRows: AuditLogRow[] = assessmentAudits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: getAuditActionLabel(audit.action),
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

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

    return [
      ...metadataRows,
      ...couponRows,
      ...permissionRows,
      ...assessmentRows,
      ...staticRows
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [assessmentAudits, couponAudits, metadataAudits, permissionAudits]);

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
        title="감사 로그 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
