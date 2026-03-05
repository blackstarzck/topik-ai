import { Card, Space, Table, Typography, message, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Paragraph, Text } = Typography;

type ProcessStatus = '처리 대기' | '처리 완료';

type ReportRow = {
  id: string;
  targetPostId: string;
  targetUserId: string;
  reporter: string;
  reason: string;
  createdAt: string;
  processStatus: ProcessStatus;
};

type ReportActionState =
  | { type: 'hide-post'; row: ReportRow }
  | { type: 'suspend-user'; row: ReportRow }
  | null;

const initialRows: ReportRow[] = [
  {
    id: 'RP-001',
    targetPostId: 'POST-002',
    targetUserId: 'U00047',
    reporter: 'member_12',
    reason: '욕설 포함',
    createdAt: '2026-03-03 14:12',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-002',
    targetPostId: 'POST-010',
    targetUserId: 'U00019',
    reporter: 'member_31',
    reason: '광고성 게시물',
    createdAt: '2026-03-04 09:31',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-003',
    targetPostId: 'POST-003',
    targetUserId: 'U00077',
    reporter: 'member_01',
    reason: '스팸',
    createdAt: '2026-03-04 10:05',
    processStatus: '처리 완료'
  }
];

export default function CommunityReportsPage(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [actionState, setActionState] = useState<ReportActionState>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const processedStatus = useMemo<ProcessStatus>(() => {
    const baseStatus = initialRows[0]?.processStatus;
    const completedRow = initialRows.find((row) => row.processStatus !== baseStatus);
    return completedRow?.processStatus ?? (baseStatus as ProcessStatus);
  }, []);

  const closeAction = useCallback(() => setActionState(null), []);

  const moveToUser = useCallback(
    (userId: string) => {
      navigate(`/users/${userId}?tab=profile`);
    },
    [navigate]
  );

  const showPostDetail = useCallback(
    (postId: string) => {
      messageApi.info(`게시글 보기: ${postId}`);
    },
    [messageApi]
  );

  const markProcessed = useCallback(
    (row: ReportRow) => {
      setRows((prev) =>
        prev.map((item) =>
            item.id === row.id ? { ...item, processStatus: '처리 완료' } : item
        )
      );
      notificationApi.success({
        message: '신고 처리 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
            <Text>대상 ID: {row.id}</Text>
            <Text>사유/근거: 운영자가 신고 처리를 완료했습니다.</Text>
            <AuditLogLink targetType="Community" targetId={row.id} />
          </Space>
        )
      });
    },
    [notificationApi]
  );

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      if (actionState.type === 'hide-post') {
        setRows((prev) =>
          prev.map((item) =>
            item.id === actionState.row.id
              ? { ...item, processStatus: '처리 완료' }
              : item
          )
        );
        notificationApi.success({
          message: '게시글 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.row.targetPostId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.row.targetPostId} />
            </Space>
          )
        });
      } else {
        setRows((prev) =>
          prev.map((item) =>
            item.id === actionState.row.id
              ? { ...item, processStatus: '처리 완료' }
              : item
          )
        );
        notificationApi.success({
          message: '사용자 정지 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
              <Text>대상 ID: {actionState.row.targetUserId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Users" targetId={actionState.row.targetUserId} />
            </Space>
          )
        });
      }

      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const columns = useMemo<TableColumnsType<ReportRow>>(
    () => [
      { title: '신고 ID', dataIndex: 'id', width: 110 },
      { title: '게시글', dataIndex: 'targetPostId', width: 130 },
      { title: '신고자', dataIndex: 'reporter', width: 130 },
      { title: '신고 사유', dataIndex: 'reason', width: 220 },
      { title: '신고일', dataIndex: 'createdAt', width: 180 },
      {
        title: '처리 상태',
        dataIndex: 'processStatus',
        width: 120,
        render: (status: ProcessStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `view-${record.id}`,
                label: '게시글 보기',
                onClick: () => showPostDetail(record.targetPostId)
              },
              {
                key: `hide-${record.id}`,
                label: '게시글 숨김',
                onClick: () => setActionState({ type: 'hide-post', row: record })
              },
              {
                key: `suspend-${record.id}`,
                label: '사용자 정지',
                danger: true,
                onClick: () => setActionState({ type: 'suspend-user', row: record })
              },
              {
                key: `complete-${record.id}`,
                label: '신고 처리 완료',
                disabled: record.processStatus === processedStatus,
                onClick: () => markProcessed(record)
              },
              {
                key: `user-${record.id}`,
                label: '사용자 이동',
                onClick: () => moveToUser(record.targetUserId)
              }
            ]}
          />
        )
      }
    ],
    [markProcessed, moveToUser, processedStatus, showPostDetail]
  );

  return (
    <div>
      {contextHolder}
      {notificationContextHolder}
      <PageTitle title="신고 관리" />
      <Paragraph className="page-description">
        신고 관리 액션(게시글 보기, 게시글 숨김, 사용자 정지, 신고 처리 완료)을
        제공합니다.
      </Paragraph>

      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={columns}
          dataSource={rows}
        />
      </Card>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'hide-post' ? '게시글 숨김' : '사용자 정지'}
          description={
            actionState.type === 'hide-post'
              ? '신고 대상 게시글을 숨김 처리합니다. 사유를 입력하세요.'
              : '신고 대상 사용자를 정지 처리합니다. 사유를 입력하세요.'
          }
          targetType={actionState.type === 'hide-post' ? 'Community' : 'Users'}
          targetId={
            actionState.type === 'hide-post'
              ? actionState.row.targetPostId
              : actionState.row.targetUserId
          }
          confirmText={actionState.type === 'hide-post' ? '숨김 실행' : '정지 실행'}
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </div>
  );
}


