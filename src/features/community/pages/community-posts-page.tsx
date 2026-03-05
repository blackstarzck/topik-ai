import { Card, Space, Table, Typography, message, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Paragraph, Text } = Typography;

type PostStatus = '게시' | '숨김';

type CommunityPost = {
  id: string;
  title: string;
  authorName: string;
  authorId: string;
  board: string;
  createdAt: string;
  views: number;
  comments: number;
  reports: number;
  status: PostStatus;
};

type PostActionState =
  | { type: 'hide'; post: CommunityPost }
  | { type: 'delete'; post: CommunityPost }
  | null;

const initialRows: CommunityPost[] = [
  {
    id: 'POST-001',
    title: 'TOPIK 필기 노트 공유',
    authorName: 'member_12',
    authorId: 'U00012',
    board: '자유게시판',
    createdAt: '2026-03-02',
    views: 189,
    comments: 16,
    reports: 0,
    status: '게시'
  },
  {
    id: 'POST-002',
    title: '운영 정책 문의',
    authorName: 'member_47',
    authorId: 'U00047',
    board: '질문',
    createdAt: '2026-03-01',
    views: 54,
    comments: 3,
    reports: 3,
    status: '게시'
  },
  {
    id: 'POST-003',
    title: '시험 후기 공유',
    authorName: 'member_19',
    authorId: 'U00019',
    board: '후기',
    createdAt: '2026-02-28',
    views: 410,
    comments: 22,
    reports: 1,
    status: '숨김'
  }
];

export default function CommunityPostsPage(): JSX.Element {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CommunityPost[]>(initialRows);
  const [actionState, setActionState] = useState<PostActionState>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const openHideAction = useCallback((post: CommunityPost) => {
    setActionState({ type: 'hide', post });
  }, []);

  const openDeleteAction = useCallback((post: CommunityPost) => {
    setActionState({ type: 'delete', post });
  }, []);

  const closeAction = useCallback(() => setActionState(null), []);

  const moveToAuthor = useCallback(
    (authorId: string) => {
      navigate(`/users/${authorId}?tab=profile`);
    },
    [navigate]
  );

  const showPostDetail = useCallback(
    (postId: string) => {
      messageApi.info(`게시글 보기: ${postId}`);
    },
    [messageApi]
  );

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      if (actionState.type === 'hide') {
        setRows((prev) =>
          prev.map((item) =>
            item.id === actionState.post.id ? { ...item, status: '숨김' } : item
          )
        );
        notificationApi.success({
          message: '게시글 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.post.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.post.id} />
            </Space>
          )
        });
      } else {
        setRows((prev) => prev.filter((item) => item.id !== actionState.post.id));
        notificationApi.success({
          message: '게시글 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.post.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.post.id} />
            </Space>
          )
        });
      }

      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const columns = useMemo<TableColumnsType<CommunityPost>>(
    () => [
      { title: '게시글 ID', dataIndex: 'id', width: 110 },
      { title: '제목', dataIndex: 'title', width: 260 },
      {
        title: '작성자',
        dataIndex: 'authorName',
        width: 140,
        render: (_, record) => (
          <Link to={`/users/${record.authorId}?tab=profile`}>{record.authorName}</Link>
        )
      },
      { title: '게시판', dataIndex: 'board', width: 120 },
      { title: '작성일', dataIndex: 'createdAt', width: 120 },
      { title: '조회수', dataIndex: 'views', width: 90, align: 'right' },
      { title: '댓글수', dataIndex: 'comments', width: 90, align: 'right' },
      { title: '신고수', dataIndex: 'reports', width: 90, align: 'right' },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        render: (status: PostStatus) => <StatusBadge status={status} />
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
                onClick: () => showPostDetail(record.id)
              },
              {
                key: `hide-${record.id}`,
                label: '게시글 숨김',
                disabled: record.status === '숨김',
                onClick: () => openHideAction(record)
              },
              {
                key: `delete-${record.id}`,
                label: '게시글 삭제',
                danger: true,
                onClick: () => openDeleteAction(record)
              },
              {
                key: `author-${record.id}`,
                label: '작성자 이동',
                onClick: () => moveToAuthor(record.authorId)
              }
            ]}
          />
        )
      }
    ],
    [moveToAuthor, openDeleteAction, openHideAction, showPostDetail]
  );

  return (
    <div>
      {contextHolder}
      {notificationContextHolder}
      <PageTitle title="게시글 관리" />
      <Paragraph className="page-description">
        게시글 보기, 숨김, 삭제, 작성자 이동 액션을 제공합니다.
      </Paragraph>

      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 1500 }}
          columns={columns}
          dataSource={rows}
        />
      </Card>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'hide' ? '게시글 숨김' : '게시글 삭제'}
          description={
            actionState.type === 'hide'
              ? '게시글 노출을 중단합니다. 숨김 사유를 기록하세요.'
              : '게시글을 목록에서 제거합니다. 삭제 사유를 기록하세요.'
          }
          targetType="Community"
          targetId={actionState.post.id}
          confirmText={actionState.type === 'hide' ? '숨김 실행' : '삭제 실행'}
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </div>
  );
}


