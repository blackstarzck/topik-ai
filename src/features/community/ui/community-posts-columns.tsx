import type { TableColumnsType } from 'antd';

import {
  getMemoTypeLabel,
  postBoardFilterValues,
  postStatusFilterValues
} from '../model/community-posts-page-schema';
import type { CommunityAdminMemo as AdminMemo, CommunityPost } from '../model/types';
import { BinaryStatusSwitch } from '@/shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import { fixDrawerTableFirstColumn } from '@/shared/ui/table/drawer-table';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

// 게시글 관리 목록·메모 테이블 컬럼 — Phase 4 분해로 페이지에서 이동(동작 동일).
// 조치 핸들러는 페이지가 소유하고 인자로 받는다.

export const memoColumns: TableColumnsType<AdminMemo> =
  fixDrawerTableFirstColumn<AdminMemo>([
        {
          title: '메모 ID',
          dataIndex: 'id',
          width: 150,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '제목',
          dataIndex: 'title',
          width: 220,
          sorter: createTextSorter((record) => record.title)
        },
        {
          title: '유형',
          dataIndex: 'type',
          width: 120,
          sorter: createTextSorter((record) => record.type),
          render: (type: string) => getMemoTypeLabel(type)
        },
        {
          title: '작성 관리자',
          dataIndex: 'authorName',
          width: 160,
          sorter: createTextSorter(
            (record) => `${record.authorName} ${record.authorId}`
          ),
          render: (_, record) =>
            `${record.authorName} (${record.authorId})`
        },
        {
          title: '작성일',
          dataIndex: 'createdAt',
          width: 180,
          sorter: createTextSorter((record) => record.createdAt)
        },
      ]);

export type CommunityPostColumnsOptions = {
  onOpenPreview: (postId: string) => void;
  onOpenLatestMemo: (post: CommunityPost) => void;
  onToggleStatus: (post: CommunityPost) => void;
  onDelete: (post: CommunityPost) => void;
};

export function createCommunityPostColumns({
  onOpenPreview,
  onOpenLatestMemo,
  onToggleStatus,
  onDelete
}: CommunityPostColumnsOptions): TableColumnsType<CommunityPost> {
  return [
      {
        title: '게시글 ID',
        dataIndex: 'id',
        width: 110,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 260,
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '작성자',
        dataIndex: 'authorName',
        width: 140,
        sorter: createTextSorter((record) => record.authorName),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            userId={record.authorId}
            userName={record.authorName}
            withId
          />
        )
      },
      {
        title: '게시판',
        dataIndex: 'board',
        width: 120,
        ...createDefinedColumnFilterProps(postBoardFilterValues, (record) => record.board),
        sorter: createTextSorter((record) => record.board)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 120,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '조회수',
        dataIndex: 'views',
        width: 90,
        sorter: createNumberSorter((record) => record.views)
      },
      {
        title: '댓글수',
        dataIndex: 'comments',
        width: 90,
        sorter: createNumberSorter((record) => record.comments)
      },
      {
        title: '신고수',
        dataIndex: 'reports',
        width: 90,
        sorter: createNumberSorter((record) => record.reports)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 100,
        ...createDefinedColumnFilterProps(postStatusFilterValues, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <BinaryStatusSwitch
            checked={record.status === '게시'}
            checkedLabel="게시"
            uncheckedLabel="숨김"
            onToggle={() => onToggleStatus(record)}
          />
        )
      },
      {
        title: '액션',
        key: 'actions',
        width: 160,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `preview-${record.id}`,
                label: '게시글 원문 보기',
                onClick: () => onOpenPreview(record.id)
              },
              {
                key: `memo-${record.id}`,
                label: '내부 메모',
                onClick: () => onOpenLatestMemo(record)
              }
            ]}
            footerItems={[
              {
                key: `delete-${record.id}`,
                label: '게시글 삭제',
                danger: true,
                onClick: () => onDelete(record)
              }
            ]}
          />
        )
      }
    ];
}
