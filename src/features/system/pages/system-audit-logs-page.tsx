import { Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { usePermissionStore } from '../model/permission-store';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

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
    targetType: 'Billing',
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
  }
];

const columns: TableColumnsType<AuditLogRow> = [
  { title: '로그 ID', dataIndex: 'logId', width: 120 },
  {
    title: '대상 유형',
    dataIndex: 'targetType',
    width: 130,
    render: (value: string) => getTargetTypeLabel(value)
  },
  { title: '대상 ID', dataIndex: 'targetId', width: 140 },
  { title: '조치', dataIndex: 'action', width: 160 },
  { title: '수행자', dataIndex: 'actor', width: 120 },
  { title: '사유/근거', dataIndex: 'reason' },
  { title: '시각', dataIndex: 'createdAt', width: 190 }
];

export default function SystemAuditLogsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
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

  const filteredRows = useMemo(() => {
    return mergedRows.filter((item) => {
      if (targetType && item.targetType !== targetType) {
        return false;
      }
      if (targetId && item.targetId !== targetId) {
        return false;
      }
      return true;
    });
  }, [mergedRows, targetId, targetType]);

  return (
    <div>
      <PageTitle title="감사 로그" />
      <Paragraph className="page-description">
        운영 조치 이력을 `대상 유형`, `대상 ID` 기준으로 조회합니다.
      </Paragraph>
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
        />
      </Card>
    </div>
  );
}
