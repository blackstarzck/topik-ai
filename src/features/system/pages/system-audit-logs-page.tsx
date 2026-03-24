import { Card, Col, Row, Statistic, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getMockUserById } from '../../users/api/mock-users';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import {
  formatUserDisplayName,
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';
import { usePermissionStore } from '../model/permission-store';

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
    createdAt: '2026-03-11 09:42:10'
  },
  {
    logId: 'AL-10002',
    targetType: 'Commerce',
    targetId: 'RF-002',
    action: '환불 승인',
    actor: 'admin_kim',
    reason: '서비스 미이용 확인',
    createdAt: '2026-03-11 10:15:02'
  },
  {
    logId: 'AL-10003',
    targetType: 'Community',
    targetId: 'POST-002',
    action: '게시글 숨김',
    actor: 'admin_lee',
    reason: '정책 위반 콘텐츠',
    createdAt: '2026-03-11 10:33:51'
  },
  {
    logId: 'AL-10004',
    targetType: 'Message',
    targetId: 'MAIL-001',
    action: '메일 발송',
    actor: 'admin_han',
    reason: '수동 뉴스레터 발송',
    createdAt: '2026-03-11 17:15:00'
  },
  {
    logId: 'AL-10005',
    targetType: 'Instructor',
    targetId: 'INS-0007',
    action: '강사 정지',
    actor: 'admin_park',
    reason: '운영 정책 위반 확인',
    createdAt: '2026-03-12 10:05:14'
  },
  {
    logId: 'AL-10006',
    targetType: 'Referral',
    targetId: 'REF-0001',
    action: '추천 코드 비활성화',
    actor: 'admin_kim',
    reason: '이상치 검토 전 임시 비활성화',
    createdAt: '2026-03-12 13:22:09'
  },
  {
    logId: 'AL-10007',
    targetType: 'Referral',
    targetId: 'REF-0007',
    action: '보상 수동 조정',
    actor: 'admin_park',
    reason: '운영 검토 후 수동 보정',
    createdAt: '2026-03-12 17:48:33'
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
  const targetTypeFilter = searchParams.get('targetType') ?? '';
  const targetIdFilter = searchParams.get('targetId') ?? '';
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
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

    return [...permissionRows, ...staticRows].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }, [permissionAudits]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return mergedRows.filter((item) => {
      if (targetTypeFilter && item.targetType !== targetTypeFilter) {
        return false;
      }
      if (targetIdFilter && item.targetId !== targetIdFilter) {
        return false;
      }
      if (!matchesSearchDateRange(item.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        logId: item.logId,
        targetId: getAuditTargetDisplay(item),
        reason: item.reason,
        actor: item.actor,
        action: item.action
      });
    });
  }, [
    endDate,
    keyword,
    mergedRows,
    searchField,
    startDate,
    targetIdFilter,
    targetTypeFilter
  ]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            ...selectedRow,
            targetId: getAuditTargetDisplay(selectedRow)
          }
        : null,
    [selectedRow]
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          | 'keyword'
          | 'searchField'
          | 'startDate'
          | 'endDate',
          string
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('targetType');
      merged.delete('targetId');
      merged.delete('actor');
      merged.delete('action');

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
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayCount = filteredRows.filter((row) =>
    row.createdAt.startsWith(todayPrefix)
  ).length;
  const adminAuditCount = filteredRows.filter((row) => row.targetType === 'Admin').length;
  const commerceAuditCount = filteredRows.filter((row) => row.targetType === 'Commerce').length;

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
        width: 130,
        sorter: createTextSorter((record) => getTargetTypeLabel(record.targetType)),
        render: (value: string) => getTargetTypeLabel(value)
      },
      {
        title: '대상 ID',
        dataIndex: 'targetId',
        width: 160,
        sorter: createTextSorter((record) => getAuditTargetDisplay(record)),
        render: (value: string, record) => {
          const route = getTargetRoute(record.targetType, value);
          if (!route) {
            return getAuditTargetDisplay(record);
          }

          if (record.targetType === 'Users') {
            const userName = getMockUserById(value)?.realName;
            if (userName) {
              return (
                <UserNavigationLink
                  stopPropagation
                  userId={value}
                  userName={userName}
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="현재 결과" value={filteredRows.length} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="권한 변경 로그" value={adminAuditCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="오늘 생성 로그" value={todayCount} suffix="건" />
          </Card>
        </Col>
      </Row>

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
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            keywordPlaceholder="검색..."
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
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={
              <Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>
            }
          />
        }
      >

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          대상 ID 링크를 누르면 원본 운영 화면으로 이동합니다.
          {targetIdFilter ? (
            <>
              {' '}
              현재는 <Text strong>{targetIdFilter}</Text>에 대한 이력만 보고 있습니다.
            </>
          ) : null}
          {commerceAuditCount > 0 ? ' 커머스 환불/결제 처리 이력도 같은 표에서 함께 추적됩니다.' : null}
        </Paragraph>

        <AdminDataTable<AuditLogRow>
          rowKey="logId"
          pagination={false}
          scroll={{ x: 1200 }}
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
