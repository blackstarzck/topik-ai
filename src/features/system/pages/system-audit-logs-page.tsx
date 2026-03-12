import { Card, Col, Input, Row, Select, Statistic, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { matchesSearchField } from '../../../shared/ui/search-bar/search-bar-utils';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
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
  }
];

function getTargetRoute(targetType: string, targetId: string): string | null {
  if (targetType === 'Users') {
    return `/users/${targetId}?tab=profile`;
  }
  if (targetType === 'Instructor') {
    return `/users/groups?selected=${targetId}`;
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

export default function SystemAuditLogsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const permissionAudits = usePermissionStore((state) => state.audits);
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const targetTypeFilter = searchParams.get('targetType') ?? 'all';
  const targetIdFilter = searchParams.get('targetId') ?? '';
  const actorFilter = searchParams.get('actor') ?? 'all';
  const actionFilter = searchParams.get('action') ?? 'all';

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

  const actorOptions = useMemo(
    () =>
      Array.from(new Set(mergedRows.map((row) => row.actor))).map((actor) => ({
        label: actor,
        value: actor
      })),
    [mergedRows]
  );

  const actionOptions = useMemo(
    () =>
      Array.from(new Set(mergedRows.map((row) => row.action))).map((action) => ({
        label: action,
        value: action
      })),
    [mergedRows]
  );

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return mergedRows.filter((item) => {
      if (targetTypeFilter !== 'all' && item.targetType !== targetTypeFilter) {
        return false;
      }
      if (targetIdFilter && item.targetId !== targetIdFilter) {
        return false;
      }
      if (actorFilter !== 'all' && item.actor !== actorFilter) {
        return false;
      }
      if (actionFilter !== 'all' && item.action !== actionFilter) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        logId: item.logId,
        targetId: item.targetId,
        reason: item.reason,
        actor: item.actor,
        action: item.action
      });
    });
  }, [
    actionFilter,
    actorFilter,
    keyword,
    mergedRows,
    searchField,
    targetIdFilter,
    targetTypeFilter
  ]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          'keyword' | 'searchField' | 'targetType' | 'targetId' | 'actor' | 'action',
          string
        >
      >
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
        sorter: createTextSorter((record) => record.targetId),
        render: (value: string, record) => {
          const route = getTargetRoute(record.targetType, value);
          if (!route) {
            return value;
          }

          return (
            <Link
              className="table-navigation-link"
              to={route}
              onClick={(event) => event.stopPropagation()}
            >
              {value}
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

      <Card>
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
          onSearchFieldChange={(value) =>
            commitParams({
              searchField: value,
              targetType: targetTypeFilter,
              targetId: targetIdFilter,
              actor: actorFilter,
              action: actionFilter
            })
          }
          onKeywordChange={(event) =>
            commitParams({
              keyword: event.target.value,
              searchField,
              targetType: targetTypeFilter,
              targetId: targetIdFilter,
              actor: actorFilter,
              action: actionFilter
            })
          }
          keywordPlaceholder="검색..."
          detailTitle="상세 검색"
          detailContent={
            <>
              <SearchBarDetailField label="대상 유형">
                <Select
                  value={targetTypeFilter}
                  options={[
                    { label: '전체', value: 'all' },
                    ...Array.from(new Set(mergedRows.map((row) => row.targetType))).map((value) => ({
                      label: getTargetTypeLabel(value),
                      value
                    }))
                  ]}
                  onChange={(value) =>
                    commitParams({
                      targetType: value,
                      keyword,
                      searchField,
                      targetId: targetIdFilter,
                      actor: actorFilter,
                      action: actionFilter
                    })
                  }
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="대상 ID">
                <Input
                  allowClear
                  value={targetIdFilter}
                  placeholder="예: U00001"
                  onChange={(event) =>
                    commitParams({
                      targetId: event.target.value,
                      keyword,
                      searchField,
                      targetType: targetTypeFilter,
                      actor: actorFilter,
                      action: actionFilter
                    })
                  }
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="조치">
                <Select
                  value={actionFilter}
                  options={[{ label: '전체', value: 'all' }, ...actionOptions]}
                  onChange={(value) =>
                    commitParams({
                      action: value,
                      keyword,
                      searchField,
                      targetType: targetTypeFilter,
                      targetId: targetIdFilter,
                      actor: actorFilter
                    })
                  }
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="수행자">
                <Select
                  value={actorFilter}
                  options={[{ label: '전체', value: 'all' }, ...actorOptions]}
                  onChange={(value) =>
                    commitParams({
                      actor: value,
                      keyword,
                      searchField,
                      targetType: targetTypeFilter,
                      targetId: targetIdFilter,
                      action: actionFilter
                    })
                  }
                />
              </SearchBarDetailField>
            </>
          }
          onReset={() =>
            setSearchParams(
              targetIdFilter
                ? new URLSearchParams({ targetId: targetIdFilter })
                : new URLSearchParams(),
              { replace: true }
            )
          }
          summary={
            <Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>
          }
        />

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
      </Card>

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="감사 로그 상세"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
