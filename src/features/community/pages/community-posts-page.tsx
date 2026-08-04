import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Typography,
  notification
} from 'antd';
import type { AlertProps, DescriptionsProps, TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  addCommunityPostMemoSafe,
  deleteCommunityPostSafe,
  fetchCommunityModeratorOptionsSafe,
  fetchCommunityPostsSafe,
  hideCommunityPostSafe,
  showCommunityPostSafe
} from '../api/community-service';
import type { CommunityModeratorOption } from '../api/community-service';
import type {
  CommunityAdminMemo as AdminMemo,
  CommunityPolicyCode as PolicyCode,
  CommunityPost
} from '../model/types';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
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
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import {
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';

const { Text } = Typography;

type MemoType =
  | 'SPAM'
  | '욕설/혐오'
  | '성인/불법'
  | '광고/홍보'
  | '개인정보 노출'
  | '중복 게시'
  | '기타';

type PostActionState =
  | { type: 'show'; post: CommunityPost }
  | { type: 'hide'; post: CommunityPost }
  | { type: 'delete'; post: CommunityPost }
  | null;

const postBoardFilterValues = ['자유게시판', '질문', '후기'] as const;
const postStatusFilterValues = ['게시', '숨김'] as const;

const moderationPolicyCodeOptions = [
  {
    label: 'SPAM · 스팸/도배',
    value: 'SPAM',
    description: '반복 게시, 도배, 자동 생성형 콘텐츠처럼 정상 이용을 방해하는 게시글입니다.'
  },
  {
    label: 'ABUSE · 욕설/혐오',
    value: 'ABUSE',
    description: '욕설, 혐오 표현, 괴롭힘 등 커뮤니티 운영 정책 위반 게시글입니다.'
  },
  {
    label: 'AD · 광고/홍보',
    value: 'AD',
    description: '허용되지 않은 외부 홍보, 제휴 링크, 영리 목적 광고 게시글입니다.'
  },
  {
    label: 'PRIVACY · 개인정보 노출',
    value: 'PRIVACY',
    description: '전화번호, 계좌, 주소 등 민감한 개인정보가 직접 노출된 게시글입니다.'
  },
  {
    label: 'DUPLICATE · 중복 게시',
    value: 'DUPLICATE',
    description: '동일 또는 유사한 내용을 반복 게시해 정리가 필요한 게시글입니다.'
  },
  {
    label: 'OTHER · 기타',
    value: 'OTHER',
    description: '정책 코드에 없는 사유이지만 운영 검토 결과 조치가 필요한 게시글입니다.'
  }
] as const;

const moderationPolicyCodeLabelMap: Record<PolicyCode, string> = {
  SPAM: 'SPAM · 스팸/도배',
  ABUSE: 'ABUSE · 욕설/혐오',
  AD: 'AD · 광고/홍보',
  PRIVACY: 'PRIVACY · 개인정보 노출',
  DUPLICATE: 'DUPLICATE · 중복 게시',
  OTHER: 'OTHER · 기타'
};

const memoTypeOptions = [
  { label: 'SPAM', value: 'SPAM' },
  { label: '욕설/혐오', value: '욕설/혐오' },
  { label: '성인/불법', value: '성인/불법' },
  { label: '광고/홍보', value: '광고/홍보' },
  { label: '개인정보 노출', value: '개인정보 노출' },
  { label: '중복 게시', value: '중복 게시' },
  { label: '기타', value: '기타' }
] as const;

const memoTypeLabelMap: Record<MemoType, string> = {
  SPAM: 'SPAM',
  '욕설/혐오': '욕설/혐오',
  '성인/불법': '성인/불법',
  '광고/홍보': '광고/홍보',
  '개인정보 노출': '개인정보 노출',
  '중복 게시': '중복 게시',
  기타: '기타'
};

function getMemoTypeLabel(type: string): string {
  return memoTypeLabelMap[type as MemoType] ?? type;
}

function getLatestAdminMemo(post: CommunityPost): AdminMemo | null {
  return [...post.adminNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export default function CommunityPostsPage(): JSX.Element {
  const [rows, setRows] = useState<CommunityPost[]>([]);
  const [loadState, setLoadState] = useState<'pending' | 'success' | 'error'>('pending');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [actionState, setActionState] = useState<PostActionState>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<AdminMemo | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [memoForm] = Form.useForm<{ title: string; type: MemoType; memo: string }>();
  const [currentAdmin, setCurrentAdmin] = useState<CommunityModeratorOption | null>(null);
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const selectedPostId = searchParams.get('selected') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  useEffect(() => {
    const controller = new AbortController();

    setLoadState('pending');
    setLoadErrorMessage('');
    void fetchCommunityPostsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setRows(result.data);
        setLoadState('success');
        return;
      }

      setLoadErrorMessage(result.error.message);
      setLoadState('error');
    });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void fetchCommunityModeratorOptionsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }

      setCurrentAdmin(result.data.currentAdmin);
    });

    return () => {
      controller.abort();
    };
  }, []);

  const selectedPost = useMemo(
    () => rows.find((row) => row.id === selectedPostId) ?? null,
    [rows, selectedPostId]
  );
  const previewPost = useMemo(
    () => rows.find((row) => row.id === previewPostId) ?? null,
    [previewPostId, rows]
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate' | 'selected', string>
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

  useEffect(() => {
    memoForm.resetFields();
  }, [memoForm, selectedPostId]);

  useEffect(() => {
    if (!memoModalOpen) {
      memoForm.resetFields();
    }
  }, [memoForm, memoModalOpen]);

  useEffect(() => {
    if (selectedPostId && !selectedPost) {
      commitParams({ selected: '' });
    }
  }, [commitParams, selectedPost, selectedPostId]);

  useEffect(() => {
    if (previewPostId && !previewPost) {
      setPreviewPostId('');
    }
  }, [previewPost, previewPostId]);

  useEffect(() => {
    if (!selectedPost) {
      setMemoModalOpen(false);
      setSelectedMemo(null);
    }
  }, [selectedPost]);

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const handleOpenDetail = useCallback(
    (postId: string) => {
      commitParams({ selected: postId });
    },
    [commitParams]
  );

  const handleCloseDetail = useCallback(() => {
    setMemoModalOpen(false);
    commitParams({ selected: '' });
  }, [commitParams]);

  const handleOpenMemoModal = useCallback(() => {
    setMemoModalOpen(true);
  }, []);

  const handleCloseMemoModal = useCallback(() => {
    setMemoModalOpen(false);
  }, []);

  const handleCloseMemoDetailModal = useCallback(() => {
    setSelectedMemo(null);
  }, []);

  const handleOpenMemoDetailModal = useCallback((memo: AdminMemo) => {
    setSelectedMemo(memo);
  }, []);

  const handleOpenLatestMemoDetailModal = useCallback(
    (post: CommunityPost) => {
      const latestMemo = getLatestAdminMemo(post);

      if (!latestMemo) {
        notificationApi.info({
          message: '등록된 내부 메모가 없습니다.',
          description: '게시글 상세에서 신규 내부 메모를 등록할 수 있습니다.'
        });
        return;
      }

      setSelectedMemo(latestMemo);
    },
    [notificationApi]
  );

  const handleOpenPostPreview = useCallback((postId: string) => {
    setPreviewPostId(postId);
  }, []);

  const handleClosePostPreview = useCallback(() => {
    setPreviewPostId('');
  }, []);

  const handleTogglePostStatus = useCallback((post: CommunityPost) => {
    setActionState({
      type: post.status === '게시' ? 'hide' : 'show',
      post
    });
  }, []);

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
    async (reason: string, context?: { policyCode?: string }) => {
      if (!actionState) {
        return;
      }

      const policyCode = context?.policyCode as PolicyCode | undefined;
      const result =
        actionState.type === 'show'
          ? await showCommunityPostSafe({
              postId: actionState.post.id,
              reason
            })
          : actionState.type === 'hide'
            ? await hideCommunityPostSafe({
                postId: actionState.post.id,
                reason,
                policyCode
              })
            : await deleteCommunityPostSafe(actionState.post.id, reason);

      if (!result.ok) {
        notificationApi.error({
          message: '\uCEE4\uBBA4\uB2C8\uD2F0 \uC870\uCE58 \uC2E4\uD328',
          description: result.error.message
        });
        return;
      }

      if (actionState.type === 'delete') {
        setRows((prev) => prev.filter((item) => item.id !== actionState.post.id));
        if (selectedPostId === actionState.post.id) {
          setMemoModalOpen(false);
          commitParams({ selected: '' });
        }
        if (previewPostId === actionState.post.id) {
          setPreviewPostId('');
        }
      } else {
        setRows((prev) =>
          prev.map((item) => (item.id === result.data.id ? result.data : item))
        );
      }

      if (actionState.type === 'show') {
        notificationApi.success({
          message: '\uAC8C\uC2DC\uAE00 \uACF5\uAC1C \uC644\uB8CC',
          description: (
            <Space direction="vertical">
              <Text>\uB300\uC0C1 \uC720\uD615: {getTargetTypeLabel('CommunityPost')}</Text>
              <Text>\uB300\uC0C1 ID: {actionState.post.id}</Text>
              <Text>\uC0AC\uC720/\uADFC\uAC70: {reason}</Text>
              <AuditLogLink targetType="CommunityPost" targetId={actionState.post.id} />
            </Space>
          )
        });
      } else if (actionState.type === 'hide') {
        notificationApi.success({
          message: '\uAC8C\uC2DC\uAE00 \uC228\uAE40 \uC644\uB8CC',
          description: (
            <Space direction="vertical">
              <Text>\uB300\uC0C1 \uC720\uD615: {getTargetTypeLabel('CommunityPost')}</Text>
              <Text>\uB300\uC0C1 ID: {actionState.post.id}</Text>
              <Text>
                \uC815\uCC45 \uCF54\uB4DC:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>\uC0AC\uC720/\uADFC\uAC70: {reason}</Text>
              <AuditLogLink targetType="CommunityPost" targetId={actionState.post.id} />
            </Space>
          )
        });
      } else {
        notificationApi.success({
          message: '\uAC8C\uC2DC\uAE00 \uC0AD\uC81C \uC644\uB8CC',
          description: (
            <Space direction="vertical">
              <Text>\uB300\uC0C1 \uC720\uD615: {getTargetTypeLabel('CommunityPost')}</Text>
              <Text>\uB300\uC0C1 ID: {actionState.post.id}</Text>
              <Text>
                \uC815\uCC45 \uCF54\uB4DC:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>\uC0AC\uC720/\uADFC\uAC70: {reason}</Text>
              <AuditLogLink targetType="CommunityPost" targetId={actionState.post.id} />
            </Space>
          )
        });
      }

      setActionState(null);
    },
    [actionState, commitParams, notificationApi, previewPostId, selectedPostId]
  );

  const handleAddAdminMemo = useCallback(async () => {
    if (!selectedPost) {
      return;
    }

    const values = await memoForm.validateFields();
    const memoTitle = values.title.trim();
    const memoType = values.type;
    const memoContent = values.memo.trim();
    const authorId = currentAdmin?.adminId ?? 'system';
    const authorName = currentAdmin?.name ?? '\uC2DC\uC2A4\uD15C';
    const result = await addCommunityPostMemoSafe({
      postId: selectedPost.id,
      title: memoTitle,
      type: memoType,
      authorId,
      authorName,
      content: memoContent
    });

    if (!result.ok) {
      notificationApi.error({
        message: '\uB0B4\uBD80 \uBA54\uBAA8 \uB4F1\uB85D \uC2E4\uD328',
        description: result.error.message
      });
      return;
    }

    setRows((prev) =>
      prev.map((item) => (item.id === result.data.id ? result.data : item))
    );
    setMemoModalOpen(false);
    notificationApi.success({
      message: '\uB0B4\uBD80 \uBA54\uBAA8 \uB4F1\uB85D \uC644\uB8CC',
      description: (
        <Space direction="vertical">
          <Text>\uB300\uC0C1 \uC720\uD615: {getTargetTypeLabel('CommunityPost')}</Text>
          <Text>\uB300\uC0C1 ID: {selectedPost.id}</Text>
          <Text>\uBA54\uBAA8 \uC791\uC131\uC790: {authorName}</Text>
          <Text>\uBA54\uBAA8 \uC81C\uBAA9: {memoTitle}</Text>
          <Text>\uBA54\uBAA8 \uC720\uD615: {memoTypeLabelMap[memoType]}</Text>
          <Text>\uBA54\uBAA8 \uB0B4\uC6A9: {memoContent}</Text>
          <AuditLogLink targetType="CommunityPost" targetId={selectedPost.id} />
        </Space>
      )
    });
  }, [currentAdmin, memoForm, notificationApi, selectedPost]);

  const memoColumns = useMemo<TableColumnsType<AdminMemo>>(
    () =>
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
      ]),
    []
  );

  const memoDetailItems = useMemo<DescriptionsProps['items']>(() => {
    if (!selectedMemo) {
      return [];
    }

    return [
      { key: 'id', label: '메모 ID', children: selectedMemo.id },
      { key: 'title', label: '제목', children: selectedMemo.title },
      {
        key: 'type',
        label: '유형',
        children: getMemoTypeLabel(selectedMemo.type)
      },
      {
        key: 'author',
        label: '작성 관리자',
        children: `${selectedMemo.authorName} (${selectedMemo.authorId})`
      },
      { key: 'createdAt', label: '작성일', children: selectedMemo.createdAt },
      {
        key: 'content',
        label: '메모 내용',
        children: (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {selectedMemo.content}
          </div>
        )
      }
    ];
  }, [selectedMemo]);

  const columns = useMemo<TableColumnsType<CommunityPost>>(
    () => [
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
            onToggle={() => handleTogglePostStatus(record)}
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
                onClick: () => handleOpenPostPreview(record.id)
              },
              {
                key: `memo-${record.id}`,
                label: '내부 메모',
                onClick: () => handleOpenLatestMemoDetailModal(record)
              }
            ]}
            footerItems={[
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
    [handleOpenLatestMemoDetailModal, handleOpenPostPreview, handleTogglePostStatus]
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
        children: (
          <UserNavigationLink
            userId={selectedPost.authorId}
            userName={selectedPost.authorName}
            withId
          />
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
        key: 'adminNotes',
        label: '내부 메모 수',
        children: `${selectedPost.adminNotes.length}건`
      },
      {
        key: 'lastPolicyCode',
        label: '최근 조치 정책 코드',
        children: selectedPost.lastModerationPolicyCode
          ? moderationPolicyCodeLabelMap[selectedPost.lastModerationPolicyCode]
          : '-'
      },
      {
        key: 'lastModeratedAt',
        label: '최근 조치 시각',
        children: selectedPost.lastModeratedAt ?? '-'
      },
      {
        key: 'lastModerationReason',
        label: '최근 조치 사유',
        children: selectedPost.lastModerationReason ?? '-'
      },
      {
        key: 'preview',
        label: '게시글 원문 보기',
        children: (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() => handleOpenPostPreview(selectedPost.id)}
          >
            보러가기
          </Button>
        )
      },
    ];
  }, [handleOpenPostPreview, selectedPost]);

  const drawerStatusAlert = useMemo<AlertProps | null>(() => {
    if (!selectedPost) {
      return null;
    }

    if (selectedPost.status === '숨김') {
      return {
        type: 'warning',
        showIcon: true,
        message: '현재 숨김 처리된 게시글입니다.',
        description: selectedPost.lastModerationPolicyCode
          ? `최근 조치 정책 코드: ${moderationPolicyCodeLabelMap[selectedPost.lastModerationPolicyCode]}`
          : '사용자 화면 노출이 중단된 상태입니다.'
      };
    }

    if (selectedPost.reports > 0) {
      return {
        type: 'info',
        showIcon: true,
        message: '신고 누적 게시글입니다.',
        description: `현재 신고 ${selectedPost.reports}건이 누적되어 있습니다. 필요 시 신고 관리 화면에서 후속 검수를 이어가세요.`
      };
    }

    return null;
  }, [selectedPost]);

  const hiddenCount = rows.filter((row) => row.status === '숨김').length;
  const reportedCount = rows.filter((row) => row.reports > 0).length;
  const postSummaryCards = useMemo(
    () => [
      {
        key: 'all-posts',
        label: '전체 게시글',
        value: `${rows.length.toLocaleString()}건`
      },
      {
        key: 'hidden-posts',
        label: '숨김 게시글',
        value: `${hiddenCount.toLocaleString()}건`
      },
      {
        key: 'reported-posts',
        label: '신고 누적 게시글',
        value: `${reportedCount.toLocaleString()}건`
      }
    ],
    [hiddenCount, reportedCount, rows.length]
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="게시글 관리" />
      <ListSummaryCards items={postSummaryCards} />

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
        {loadState === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="\uCEE4\uBBA4\uB2C8\uD2F0 \uAC8C\uC2DC\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
            description={loadErrorMessage}
          />
        ) : null}
        <AdminDataTable<CommunityPost>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1500 }}
          columns={columns}
          dataSource={visibleRows}
          loading={loadState === 'pending'}
          locale={{ emptyText: loadState === 'error' ? loadErrorMessage : '\uC870\uD68C\uB41C \uAC8C\uC2DC\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.' }}
          onRow={(record) => ({
            onClick: () => handleOpenDetail(record.id),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={
            actionState.type === 'show'
              ? '게시글 재게시'
              : actionState.type === 'hide'
                ? '게시글 숨김'
                : '게시글 삭제'
          }
          description={
            actionState.type === 'show'
              ? '숨김 처리된 게시글을 다시 게시합니다. 재게시 사유를 기록하세요.'
              : actionState.type === 'hide'
              ? '게시글 노출을 중단합니다. 정책 코드와 숨김 사유를 기록하세요.'
              : '게시글을 목록에서 제거합니다. 정책 코드와 삭제 사유를 기록하세요.'
          }
          targetType="CommunityPost"
          targetId={actionState.post.id}
          confirmText={
            actionState.type === 'show'
              ? '재게시 실행'
              : actionState.type === 'hide'
                ? '숨김 실행'
                : '삭제 실행'
          }
          policyCodeOptions={
            actionState.type === 'show'
              ? undefined
              : moderationPolicyCodeOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                  description: option.description
                }))
          }
          requirePolicyCode={actionState.type !== 'show'}
          onCancel={() => setActionState(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <DetailDrawer
        open={Boolean(selectedPost)}
        title={selectedPost ? `게시글 상세 · ${selectedPost.id}` : '게시글 상세'}
        onClose={handleCloseDetail}
        destroyOnHidden
        width={760}
        headerMeta={
          selectedPost ? <StatusBadge status={selectedPost.status} /> : null
        }
        footerStart={
          selectedPost ? (
            <AuditLogLink targetType="CommunityPost" targetId={selectedPost.id} />
          ) : null
        }
        footerEnd={
          selectedPost ? (
            <Space wrap>
              <Button
                onClick={() => handleTogglePostStatus(selectedPost)}
              >
                {selectedPost.status === '게시' ? '게시글 숨김' : '게시글 재게시'}
              </Button>
              <Button
                danger
                onClick={() => setActionState({ type: 'delete', post: selectedPost })}
              >
                게시글 삭제
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedPost ? (
          <DetailDrawerBody>
            {drawerStatusAlert ? <Alert {...drawerStatusAlert} /> : null}

            <DetailDrawerSection title="게시글 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={detailItems}
              />
            </DetailDrawerSection>

            <DetailDrawerSection
              title="메모 히스토리"
              actions={
                <Button type="primary" size="large" onClick={handleOpenMemoModal}>
                  메모 등록
                </Button>
              }
            >
              <AdminDataTable<AdminMemo>
                rowKey="id"
                columns={memoColumns}
                dataSource={selectedPost.adminNotes}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(720)}
                locale={{ emptyText: '등록된 내부 메모가 없습니다.' }}
                onRow={(record) => ({
                  onClick: () => handleOpenMemoDetailModal(record),
                  style: { cursor: 'pointer' }
                })}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <Modal
        open={memoModalOpen}
        title="내부 메모 등록"
        okText="저장"
        cancelText="취소"
        onCancel={handleCloseMemoModal}
        onOk={handleAddAdminMemo}
      destroyOnHidden
        styles={{ body: { paddingBottom: 8 } }}
      >
        <Form form={memoForm}>
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              {
                key: 'target',
                label: '대상',
                children: `${getTargetTypeLabel('CommunityPost')} / ${selectedPost?.id ?? '-'}`
              },
              {
                key: 'author',
                label: '작성자',
                children: `${currentAdmin?.name ?? '시스템'} (${currentAdmin?.adminId ?? 'system'})`
              },
              {
                key: 'title',
                label: '제목',
                children: (
                  <Form.Item
                    name="title"
                    style={{ marginBottom: 0 }}
                    rules={[
                      {
                        validator: (_, value) =>
                          typeof value === 'string' && value.trim().length > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error('메모 제목을 입력하세요.'))
                      }
                    ]}
                  >
                    <Input maxLength={100} placeholder="메모 제목을 입력하세요." />
                  </Form.Item>
                )
              },
              {
                key: 'type',
                label: '유형',
                children: (
                  <Form.Item
                    name="type"
                    style={{ marginBottom: 0 }}
                    rules={[{ required: true, message: '메모 유형을 선택하세요.' }]}
                  >
                    <Select
                      options={memoTypeOptions.map((option) => ({
                        label: option.label,
                        value: option.value
                      }))}
                      placeholder="메모 유형을 선택하세요."
                    />
                  </Form.Item>
                )
              },
              {
                key: 'memo',
                label: '메모 내용',
                children: (
                  <Form.Item
                    name="memo"
                    style={{ marginBottom: 0 }}
                    rules={[
                      {
                        validator: (_, value) =>
                          typeof value === 'string' && value.trim().length > 0
                            ? Promise.resolve()
                            : Promise.reject(new Error('메모 내용을 입력하세요.'))
                      }
                    ]}
                  >
                    <Input.TextArea
                      rows={5}
                      showCount
                      maxLength={500}
                      placeholder="후속 검수 포인트, 인수인계 메모, 외부 연계 이슈 등을 기록하세요."
                    />
                  </Form.Item>
                )
              }
            ]}
          />
        </Form>
      </Modal>

      <Modal
        open={Boolean(selectedMemo)}
        title="내부 메모 상세"
        footer={null}
        onCancel={handleCloseMemoDetailModal}
      destroyOnHidden
      >
        {selectedMemo ? (
          <Descriptions bordered size="small" column={1} items={memoDetailItems} />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(previewPost)}
        title="게시글 원문 보기"
        footer={null}
        width={860}
        onCancel={handleClosePostPreview}
      destroyOnHidden
      >
        {previewPost ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'title', label: '제목', children: previewPost.title },
                {
                  key: 'author',
                  label: '작성자',
                  children: (
                    <UserNavigationLink
                      userId={previewPost.authorId}
                      userName={previewPost.authorName}
                      withId
                    />
                  )
                },
                { key: 'board', label: '게시판', children: previewPost.board },
                { key: 'createdAt', label: '작성일', children: previewPost.createdAt }
              ]}
            />
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 12,
                padding: 20,
                background: '#fff',
                lineHeight: 1.7
              }}
              dangerouslySetInnerHTML={{ __html: previewPost.contentHtml }}
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
