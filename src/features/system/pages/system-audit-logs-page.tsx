import { Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
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

function getTargetRoute(targetType: string, targetId: string): string | null {
  if (targetType === 'Users') {
    return `/users/${targetId}?tab=profile`;
  }
  if (targetType === 'Community') {
    return '/community/posts';
  }
  if (targetType === 'Billing' || targetType === 'Commerce') {
    return '/commerce/payments';
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
    return '/system/admins';
  }
  return null;
}

const staticRows: AuditLogRow[] = [
  {
    logId: 'AL-10001',
    targetType: 'Users',
    targetId: 'U00001',
    action: '회원 정지',
    actor: 'admin_park',
    reason: '정책 위반 반복',
    createdAt: '2026-03-04 09:42:10'
  },
  {
    logId: 'AL-10002',
    targetType: 'Commerce',
    targetId: 'PAY-1002',
    action: '환불 승인',
    actor: 'admin_kim',
    reason: '중복 결제 확인',
    createdAt: '2026-03-04 10:15:02'
  },
  {
    logId: 'AL-10003',
    targetType: 'Community',
    targetId: 'POST-002',
    action: '게시글 숨김',
    actor: 'admin_lee',
    reason: '정책 위반 콘텐츠',
    createdAt: '2026-03-04 10:33:51'
  },
  {
    logId: 'AL-10004',
    targetType: 'Content',
    targetId: 'VOC-SON-001',
    action: '콘텐츠 초안 저장',
    actor: 'admin_han',
    reason: '소나기 콘텐츠 구조 초안 저장',
    createdAt: '2026-03-10 17:15:00'
  }
];

export default function SystemAuditLogsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AuditLogRow | null>(null);
  const targetType = searchParams.get('targetType');
  const targetId = searchParams.get('targetId');
  const permissionAudits = usePermissionStore((state) => state.audits);

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

  const filteredRows = useMemo(
    () =>
      mergedRows.filter((item) => {
        if (targetType && item.targetType !== targetType) {
          return false;
        }
        if (targetId && item.targetId !== targetId) {
          return false;
        }
        return true;
      }),
    [mergedRows, targetId, targetType]
  );

  const columns = useMemo<TableColumnsType<AuditLogRow>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'logId',
        width: 120,
        ...createColumnFilterProps(filteredRows, (record) => record.logId),
        sorter: createTextSorter((record) => record.logId)
      },
      {
        title: '대상 유형',
        dataIndex: 'targetType',
        width: 140,
        ...createColumnFilterProps(filteredRows, (record) =>
          getTargetTypeLabel(record.targetType)
        ),
        sorter: createTextSorter((record) => getTargetTypeLabel(record.targetType)),
        render: (value: string) => getTargetTypeLabel(value)
      },
      {
        title: '대상 ID',
        dataIndex: 'targetId',
        width: 160,
        ...createColumnFilterProps(filteredRows, (record) => record.targetId),
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
        width: 160,
        ...createColumnFilterProps(filteredRows, (record) => record.action),
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '수행자',
        dataIndex: 'actor',
        width: 120,
        ...createColumnFilterProps(filteredRows, (record) => record.actor),
        sorter: createTextSorter((record) => record.actor)
      },
      {
        title: '사유/근거',
        dataIndex: 'reason',
        ...createColumnFilterProps(filteredRows, (record) => record.reason),
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 190,
        ...createColumnFilterProps(filteredRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    [filteredRows]
  );

  const handleRowClick = useCallback(
    (record: AuditLogRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="감사 로그" />
      <Card>
        <Paragraph>
          <Text type="secondary">현재 필터:</Text>{' '}
          <Text>
            대상 유형={targetType ? getTargetTypeLabel(targetType) : '전체'}, 대상 ID=
            {targetId ?? '전체'}
          </Text>
        </Paragraph>
        <Table
          rowKey="logId"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={handleRowClick}
        />
      </Card>
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="감사 로그 상세 (모킹)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
