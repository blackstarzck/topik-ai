import { Alert, Button, Descriptions, Space } from 'antd';
import type { AlertProps, DescriptionsProps } from 'antd';

import { moderationPolicyCodeLabelMap } from '../model/community-posts-page-schema';
import { memoColumns } from './community-posts-columns';
import type { CommunityAdminMemo as AdminMemo, CommunityPost } from '../model/types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION
} from '@/shared/ui/table/drawer-table';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

// 게시글 상세 Drawer — Phase 4 분해로 페이지에서 이동(레이아웃·조치 동일).
// 열림 판정·조치 확정·모달 오픈은 페이지가 소유하고 콜백으로 받는다.

function buildPostDetailItems(post: CommunityPost, onOpenPreview: (postId: string) => void): DescriptionsProps['items'] {

    if (!post) {
      return [];
    }

    return [
      { key: 'id', label: '게시글 ID', children: post.id },
      { key: 'title', label: '제목', children: post.title },
      {
        key: 'author',
        label: '작성자',
        children: (
          <UserNavigationLink
            userId={post.authorId}
            userName={post.authorName}
            withId
          />
        )
      },
      { key: 'board', label: '게시판', children: post.board },
      { key: 'createdAt', label: '작성일', children: post.createdAt },
      { key: 'views', label: '조회수', children: post.views },
      { key: 'comments', label: '댓글수', children: post.comments },
      { key: 'reports', label: '신고수', children: post.reports },
      {
        key: 'status',
        label: '상태',
        children: <StatusBadge status={post.status} />
      },
      {
        key: 'adminNotes',
        label: '내부 메모 수',
        children: `${post.adminNotes.length}건`
      },
      {
        key: 'lastPolicyCode',
        label: '최근 조치 정책 코드',
        children: post.lastModerationPolicyCode
          ? moderationPolicyCodeLabelMap[post.lastModerationPolicyCode]
          : '-'
      },
      {
        key: 'lastModeratedAt',
        label: '최근 조치 시각',
        children: post.lastModeratedAt ?? '-'
      },
      {
        key: 'lastModerationReason',
        label: '최근 조치 사유',
        children: post.lastModerationReason ?? '-'
      },
      {
        key: 'preview',
        label: '게시글 원문 보기',
        children: (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() => onOpenPreview(post.id)}
          >
            보러가기
          </Button>
        )
      },
    ];
}

function buildPostStatusAlert(post: CommunityPost): AlertProps | null {

    
    if (post.status === '숨김') {
      return {
        type: 'warning',
        showIcon: true,
        message: '현재 숨김 처리된 게시글입니다.',
        description: post.lastModerationPolicyCode
          ? `최근 조치 정책 코드: ${moderationPolicyCodeLabelMap[post.lastModerationPolicyCode]}`
          : '사용자 화면 노출이 중단된 상태입니다.'
      };
    }

    if (post.reports > 0) {
      return {
        type: 'info',
        showIcon: true,
        message: '신고 누적 게시글입니다.',
        description: `현재 신고 ${post.reports}건이 누적되어 있습니다. 필요 시 신고 관리 화면에서 후속 검수를 이어가세요.`
      };
    }

    return null;
}

export type CommunityPostDetailDrawerProps = {
  post: CommunityPost | null;
  onClose: () => void;
  onOpenPreview: (postId: string) => void;
  onToggleStatus: (post: CommunityPost) => void;
  onDelete: (post: CommunityPost) => void;
  onOpenMemoModal: () => void;
  onOpenMemoDetail: (memo: AdminMemo) => void;
};

export function CommunityPostDetailDrawer({
  post,
  onClose,
  onOpenPreview,
  onToggleStatus,
  onDelete,
  onOpenMemoModal,
  onOpenMemoDetail
}: CommunityPostDetailDrawerProps): JSX.Element {
  const statusAlert = post ? buildPostStatusAlert(post) : null;

  return (
    <DetailDrawer
      open={Boolean(post)}
      title={post ? `게시글 상세 · ${post.id}` : '게시글 상세'}
      onClose={onClose}
      destroyOnHidden
      width={760}
      headerMeta={
        post ? <StatusBadge status={post.status} /> : null
      }
      footerStart={
        post ? (
          <AuditLogLink targetType="CommunityPost" targetId={post.id} />
        ) : null
      }
      footerEnd={
        post ? (
          <Space wrap>
            <Button
              onClick={() => onToggleStatus(post)}
            >
              {post.status === '게시' ? '게시글 숨김' : '게시글 재게시'}
            </Button>
            <Button
              danger
              onClick={() => onDelete(post)}
            >
              게시글 삭제
            </Button>
          </Space>
        ) : null
      }
    >
      {post ? (
        <DetailDrawerBody>
          {statusAlert ? <Alert {...statusAlert} /> : null}

          <DetailDrawerSection title="게시글 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildPostDetailItems(post, onOpenPreview)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection
            title="메모 히스토리"
            actions={
              <Button type="primary" size="large" onClick={onOpenMemoModal}>
                메모 등록
              </Button>
            }
          >
            <AdminDataTable<AdminMemo>
              rowKey="id"
              columns={memoColumns}
              dataSource={post.adminNotes}
              pagination={DRAWER_TABLE_PAGINATION}
              scroll={createDrawerTableScroll(720)}
              locale={{ emptyText: '등록된 내부 메모가 없습니다.' }}
              onRow={(record) => ({
                onClick: () => onOpenMemoDetail(record),
                style: { cursor: 'pointer' }
              })}
            />
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
