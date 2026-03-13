import {
  Card,
  Col,
  Descriptions,
  Modal,
  Row,
  Space,
  Statistic,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getMockUserById } from '../../users/api/mock-users';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
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
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import {
  formatUserDisplayName,
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';

const { Text } = Typography;

type PostStatus = '게시' | '숨김';

type CommunityPost = {
  id: string;
  title: string;
  content: string;
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

function getCommunityUserName(userId: string, fallbackName: string): string {
  return getMockUserById(userId)?.realName ?? fallbackName;
}

const initialRows: CommunityPost[] = [
  {
    id: 'POST-001',
    title: 'TOPIK 필기 노트 공유',
    content:
      'TOPIK 듣기와 읽기 대비용으로 정리한 필기 노트를 공유합니다.\n문제 유형별 포인트와 자주 틀리는 함정을 표로 정리했고, 시험 직전 체크할 항목도 같이 적어두었습니다.',
    authorName: getCommunityUserName('U00012', 'member_12'),
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
    content:
      '신고 누적 시 제재 기준이 어떻게 적용되는지 문의드립니다.\n경고 누적 기준과 정지 처리 기준이 공지와 실제 운영에서 동일한지 확인하고 싶습니다.',
    authorName: getCommunityUserName('U00047', 'member_47'),
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
    content:
      '최근 TOPIK 시험 후기를 공유합니다.\n듣기 파트는 예상보다 빨랐고, 쓰기 파트는 시간 배분이 가장 중요했습니다.\n실수했던 포인트도 함께 남겨둡니다.',
    authorName: getCommunityUserName('U00019', 'member_19'),
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
  const [rows, setRows] = useState<CommunityPost[]>(initialRows);
  const [actionState, setActionState] = useState<PostActionState>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');
      merged.delete('board');

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

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((record) => {
      if (!matchesSearchDateRange(record.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: record.id,
        title: record.title,
        authorName: record.authorName,
        content: record.content
      });
    });
  }, [endDate, keyword, rows, searchField, startDate]);

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
      {
        title: '게시글 ID',
        dataIndex: 'id',
        width: 110,
        ...createColumnFilterProps(visibleRows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 260,
        ...createColumnFilterProps(visibleRows, (record) => record.title),
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '작성자',
        dataIndex: 'authorName',
        width: 140,
        ...createColumnFilterProps(visibleRows, (record) => record.authorName),
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
        ...createColumnFilterProps(visibleRows, (record) => record.board),
        sorter: createTextSorter((record) => record.board)
      },
      {
        title: '작성일',
        dataIndex: 'createdAt',
        width: 120,
        ...createColumnFilterProps(visibleRows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '조회수',
        dataIndex: 'views',
        width: 90,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.views),
        sorter: createNumberSorter((record) => record.views)
      },
      {
        title: '댓글수',
        dataIndex: 'comments',
        width: 90,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.comments),
        sorter: createNumberSorter((record) => record.comments)
      },
      {
        title: '신고수',
        dataIndex: 'reports',
        width: 90,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.reports),
        sorter: createNumberSorter((record) => record.reports)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 100,
        ...createColumnFilterProps(visibleRows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: PostStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'actions',
        width: 140,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `hide-${record.id}`,
                label: '게시글 숨김',
                disabled: record.status === '숨김',
                onClick: () => setActionState({ type: 'hide', post: record })
              },
              {
                key: `delete-${record.id}`,
                label: '게시글 삭제',
                danger: true,
                onClick: () => setActionState({ type: 'delete', post: record })
              }
            ]}
          />
        )
      }
    ],
    [visibleRows]
  );

  const detailItems = useMemo<DescriptionsProps['items']>(() => {
    if (!selectedPost) {
      return [];
    }

    return [
      { key: 'id', label: '게시글 ID', children: selectedPost.id },
      { key: 'title', label: '제목', children: selectedPost.title },
      {
        key: 'author',
        label: '작성자',
        children: formatUserDisplayName(
          selectedPost.authorName,
          selectedPost.authorId
        )
      },
      { key: 'board', label: '게시판', children: selectedPost.board },
      { key: 'createdAt', label: '작성일', children: selectedPost.createdAt },
      { key: 'views', label: '조회수', children: selectedPost.views },
      { key: 'comments', label: '댓글수', children: selectedPost.comments },
      { key: 'reports', label: '신고수', children: selectedPost.reports },
      {
        key: 'status',
        label: '상태',
        children: <StatusBadge status={selectedPost.status} />
      },
      {
        key: 'content',
        label: '본문',
        children: (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {selectedPost.content}
          </div>
        )
      }
    ];
  }, [selectedPost]);

  const hiddenCount = rows.filter((row) => row.status === '숨김').length;
  const reportedCount = rows.filter((row) => row.reports > 0).length;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="게시글 관리" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="전체 게시글" value={rows.length} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="숨김 게시글" value={hiddenCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="신고 누적 게시글" value={reportedCount} suffix="건" />
          </Card>
        </Col>
      </Row>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '게시글 ID', value: 'id' },
              { label: '제목', value: 'title' },
              { label: '작성자', value: 'authorName' },
              { label: '본문', value: 'content' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) =>
              commitParams({
                searchField: value
              })
            }
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="작성일">
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
              <Text type="secondary">총 {visibleRows.length.toLocaleString()}건</Text>
            }
          />
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          신고 건은{' '}
          <Link className="table-navigation-link" to="/community/reports">
            신고 관리
          </Link>
          에서 이어서 확인할 수 있습니다.
        </Text>
        <AdminDataTable<CommunityPost>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1500 }}
          columns={columns}
          dataSource={visibleRows}
          onRow={(record) => ({
            onClick: () => setSelectedPost(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

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
          onCancel={() => setActionState(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <Modal
        open={Boolean(selectedPost)}
        title="게시글 상세"
        onCancel={() => setSelectedPost(null)}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Descriptions bordered size="small" column={1} items={detailItems} />
      </Modal>
    </div>
  );
}
