import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
  notification
} from 'antd';
import type { AlertProps, DescriptionsProps, TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getMockUserById } from '../../users/api/mock-users';
import { usePermissionStore } from '../../system/model/permission-store';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
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

const DETAIL_DESCRIPTIONS_STYLES: DescriptionsProps['styles'] = {
  label: {
    width: 184,
    minWidth: 184,
    whiteSpace: 'nowrap'
  }
};

type PostStatus = '게시' | '숨김';

type PolicyCode =
  | 'SPAM'
  | 'ABUSE'
  | 'AD'
  | 'PRIVACY'
  | 'DUPLICATE'
  | 'OTHER';

type MemoType =
  | 'SPAM'
  | '욕설/혐오'
  | '성인/불법'
  | '광고/홍보'
  | '개인정보 노출'
  | '중복 게시'
  | '기타';

type AdminMemo = {
  id: string;
  title: string;
  type: MemoType;
  authorId: string;
  authorName: string;
  createdAt: string;
  content: string;
};

type CommunityPost = {
  id: string;
  title: string;
  content: string;
  contentHtml: string;
  authorName: string;
  authorId: string;
  board: string;
  createdAt: string;
  views: number;
  comments: number;
  reports: number;
  status: PostStatus;
  adminNotes: AdminMemo[];
  lastModerationPolicyCode?: PolicyCode;
  lastModerationReason?: string;
  lastModeratedAt?: string;
};

type PostActionState =
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

const mockPostPreviewImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F7F4EA"/><stop offset="100%" stop-color="#E0ECFF"/></linearGradient></defs><rect width="960" height="540" rx="36" fill="url(#g)"/><rect x="72" y="88" width="816" height="364" rx="28" fill="#FFFFFF" fill-opacity="0.86"/><text x="96" y="170" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#1D3557">TOPIK 필기 노트 미리보기</text><text x="96" y="240" font-family="Arial, sans-serif" font-size="28" fill="#4A5568">문제 유형별 핵심 포인트와 직전 체크리스트가 정리된 이미지 예시입니다.</text><text x="96" y="320" font-family="Arial, sans-serif" font-size="24" fill="#64748B">관리자 원문 보기 모달에서 이미지와 서식을 그대로 렌더링할 수 있도록 데이터 URI로 구성했습니다.</text></svg>'
)}`;

function getLatestAdminMemo(post: CommunityPost): AdminMemo | null {
  return [...post.adminNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function getCommunityUserName(userId: string, fallbackName: string): string {
  return getMockUserById(userId)?.realName ?? fallbackName;
}

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

const initialRows: CommunityPost[] = [
  {
    id: 'POST-001',
    title: 'TOPIK 필기 노트 공유',
    content:
      'TOPIK 듣기와 읽기 대비용으로 정리한 필기 노트를 공유합니다.\n문제 유형별 포인트와 자주 틀리는 함정을 표로 정리했고, 시험 직전 체크할 항목도 같이 적어두었습니다.',
    contentHtml: `
      <p>TOPIK 듣기와 읽기 대비용으로 정리한 <strong>필기 노트</strong>를 공유합니다.</p>
      <p>문제 유형별 포인트와 자주 틀리는 함정을 표로 정리했고, 시험 직전 체크할 항목도 같이 적어두었습니다.</p>
      <figure style="margin: 16px 0;">
        <img
          src="${mockPostPreviewImage}"
          alt="TOPIK 필기 노트 미리보기"
          style="display:block;max-width:100%;border-radius:16px;border:1px solid #E5E7EB;"
        />
      </figure>
      <ul>
        <li><strong>듣기</strong>: 보기 선지 함정 패턴 정리</li>
        <li><strong>읽기</strong>: 시간 배분 기준과 오답 포인트 메모</li>
        <li><strong>쓰기</strong>: 자주 쓰는 연결 표현 정리</li>
      </ul>
    `,
    authorName: getCommunityUserName('U00012', 'member_12'),
    authorId: 'U00012',
    board: '자유게시판',
    createdAt: '2026-03-02',
    views: 189,
    comments: 16,
    reports: 0,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-001-MEMO-01',
        title: '정상 게시글 1차 검토',
        type: '기타',
        authorId: 'admin_park',
        authorName: '박수미',
        createdAt: '2026-03-12 09:18:00',
        content: '학습 후기 성격의 정상 게시글입니다. 신고 이력 없이 조회수만 높아 추적 대상에서는 제외합니다.'
      }
    ]
  },
  {
    id: 'POST-002',
    title: '운영 정책 문의',
    content:
      '신고 누적 시 제재 기준이 어떻게 적용되는지 문의드립니다.\n경고 누적 기준과 정지 처리 기준이 공지와 실제 운영에서 동일한지 확인하고 싶습니다.',
    contentHtml: `
      <p>신고 누적 시 제재 기준이 어떻게 적용되는지 문의드립니다.</p>
      <p><strong>경고 누적 기준</strong>과 <strong>정지 처리 기준</strong>이 공지와 실제 운영에서 동일한지 확인하고 싶습니다.</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #D1D5DB; background: #F8FAFC;">
        신고 처리 과정에서 참고할 만한 공지 링크가 있으면 같이 안내 부탁드립니다.
      </blockquote>
    `,
    authorName: getCommunityUserName('U00047', 'member_47'),
    authorId: 'U00047',
    board: '질문',
    createdAt: '2026-03-01',
    views: 54,
    comments: 3,
    reports: 3,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-002-MEMO-01',
        title: '댓글 분쟁성 확인 필요',
        type: '욕설/혐오',
        authorId: 'admin_kim',
        authorName: '김혜영',
        createdAt: '2026-03-13 14:06:00',
        content: '신고 사유는 정책 문의 자체보다 댓글로 붙은 분쟁성 응답 때문입니다. 원문은 유지 가능성이 있어 댓글 흐름과 함께 확인이 필요합니다.'
      },
      {
        id: 'POST-002-MEMO-02',
        title: '작성자 재검토 인수인계',
        type: '기타',
        authorId: 'admin_park',
        authorName: '박수미',
        createdAt: '2026-03-14 10:22:00',
        content: '작성자 이력 확인 시 동일 유형 신고가 추가로 1건 있습니다. 즉시 삭제보다는 숨김 후 재검토 쪽이 적절합니다.'
      }
    ]
  },
  {
    id: 'POST-003',
    title: '시험 후기 공유',
    content:
      '최근 TOPIK 시험 후기를 공유합니다.\n듣기 파트는 예상보다 빨랐고, 쓰기 파트는 시간 배분이 가장 중요했습니다.\n실수했던 포인트도 함께 남겨둡니다.',
    contentHtml: `
      <p>최근 TOPIK 시험 후기를 공유합니다.</p>
      <p>듣기 파트는 예상보다 빨랐고, 쓰기 파트는 <strong>시간 배분</strong>이 가장 중요했습니다.</p>
      <p>실수했던 포인트도 함께 남겨둡니다.</p>
      <p><a href="https://example.com/community/post/POST-003" target="_blank" rel="noreferrer">관련 스터디 링크</a>를 함께 올렸습니다.</p>
    `,
    authorName: getCommunityUserName('U00019', 'member_19'),
    authorId: 'U00019',
    board: '후기',
    createdAt: '2026-02-28',
    views: 410,
    comments: 22,
    reports: 1,
    status: '숨김',
    adminNotes: [
      {
        id: 'POST-003-MEMO-01',
        title: '외부 링크 포함 확인',
        type: '광고/홍보',
        authorId: 'admin_lee',
        authorName: '이서준',
        createdAt: '2026-03-10 16:35:00',
        content: '후기 자체는 유익하지만 외부 오픈채팅 링크가 포함돼 있어 우선 숨김 처리했습니다. 링크 제거 후 재게시 가능 여부를 추후 확인합니다.'
      }
    ],
    lastModerationPolicyCode: 'AD',
    lastModerationReason: '외부 오픈채팅 유도 링크가 포함되어 임시 숨김 처리했습니다.',
    lastModeratedAt: '2026-03-10 16:33:51'
  }
];

export default function CommunityPostsPage(): JSX.Element {
  const [rows, setRows] = useState<CommunityPost[]>(initialRows);
  const [actionState, setActionState] = useState<PostActionState>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<AdminMemo | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string>('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [memoForm] = Form.useForm<{ title: string; type: MemoType; memo: string }>();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const currentAdmin = useMemo(
    () => admins.find((admin) => admin.adminId === currentAdminId) ?? admins[0] ?? null,
    [admins, currentAdminId]
  );
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
      const moderatedAt = formatNow();

      if (actionState.type === 'hide') {
        setRows((prev) =>
          prev.map((item) =>
            item.id === actionState.post.id
              ? {
                  ...item,
                  status: '숨김',
                  lastModerationPolicyCode: policyCode,
                  lastModerationReason: reason,
                  lastModeratedAt: moderatedAt
                }
              : item
          )
        );
        notificationApi.success({
          message: '게시글 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.post.id}</Text>
              <Text>
                정책 코드:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.post.id} />
            </Space>
          )
        });
      } else {
        setRows((prev) => prev.filter((item) => item.id !== actionState.post.id));
        if (selectedPostId === actionState.post.id) {
          setMemoModalOpen(false);
          commitParams({ selected: '' });
        }
        if (previewPostId === actionState.post.id) {
          setPreviewPostId('');
        }
        notificationApi.success({
          message: '게시글 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.post.id}</Text>
              <Text>
                정책 코드:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.post.id} />
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
    const authorName = currentAdmin?.name ?? '시스템';
    const createdAt = formatNow();
    const nextMemo: AdminMemo = {
      id: `${selectedPost.id}-MEMO-${String(selectedPost.adminNotes.length + 1).padStart(2, '0')}`,
      title: memoTitle,
      type: memoType,
      authorId,
      authorName,
      createdAt,
      content: memoContent
    };

    setRows((prev) =>
      prev.map((item) =>
        item.id === selectedPost.id
          ? { ...item, adminNotes: [nextMemo, ...item.adminNotes] }
          : item
      )
    );
    setMemoModalOpen(false);
    notificationApi.success({
      message: '내부 메모 등록 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
          <Text>대상 ID: {selectedPost.id}</Text>
          <Text>메모 작성자: {authorName}</Text>
          <Text>메모 제목: {memoTitle}</Text>
          <Text>메모 유형: {memoTypeLabelMap[memoType]}</Text>
          <Text>메모 내용: {memoContent}</Text>
          <AuditLogLink targetType="Community" targetId={selectedPost.id} />
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
          render: (type: MemoType) => memoTypeLabelMap[type]
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
        children: memoTypeLabelMap[selectedMemo.type]
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
        align: 'right',
        sorter: createNumberSorter((record) => record.views)
      },
      {
        title: '댓글수',
        dataIndex: 'comments',
        width: 90,
        align: 'right',
        sorter: createNumberSorter((record) => record.comments)
      },
      {
        title: '신고수',
        dataIndex: 'reports',
        width: 90,
        align: 'right',
        sorter: createNumberSorter((record) => record.reports)
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 100,
        ...createDefinedColumnFilterProps(postStatusFilterValues, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: PostStatus) => <StatusBadge status={status} />
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
              },
              {
                key: `hide-${record.id}`,
                label: '게시글 숨김',
                disabled: record.status === '숨김',
                onClick: () => setActionState({ type: 'hide', post: record })
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
    [handleOpenLatestMemoDetailModal, handleOpenPostPreview]
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
            onClick: () => handleOpenDetail(record.id),
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
              ? '게시글 노출을 중단합니다. 정책 코드와 숨김 사유를 기록하세요.'
              : '게시글을 목록에서 제거합니다. 정책 코드와 삭제 사유를 기록하세요.'
          }
          targetType="Community"
          targetId={actionState.post.id}
          confirmText={actionState.type === 'hide' ? '숨김 실행' : '삭제 실행'}
          policyCodeOptions={moderationPolicyCodeOptions.map((option) => ({
            label: option.label,
            value: option.value,
            description: option.description
          }))}
          requirePolicyCode
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
            <AuditLogLink targetType="Community" targetId={selectedPost.id} />
          ) : null
        }
        footerEnd={
          selectedPost ? (
            <Space wrap>
              <Button
                disabled={selectedPost.status === '숨김'}
                onClick={() => setActionState({ type: 'hide', post: selectedPost })}
              >
                게시글 숨김
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
                styles={DETAIL_DESCRIPTIONS_STYLES}
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
                children: `${getTargetTypeLabel('Community')} / ${selectedPost?.id ?? '-'}`
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
