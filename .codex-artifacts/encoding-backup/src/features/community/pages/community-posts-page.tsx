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
import type { AlertProps, TableColumnsType } from 'antd';
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
  | '?뺤꽕/?먯삤'
  | '?깆씤/遺덈쾿'
  | '愿묎퀬/?띾낫'
  | '媛쒖씤?뺣낫 ?몄텧'
  | '以묐났 게시'
  | '湲고?';

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
  | { type: 'show'; post: CommunityPost }
  | { type: 'hide'; post: CommunityPost }
  | { type: 'delete'; post: CommunityPost }
  | null;

const postBoardFilterValues = ['?먯쑀게시판, '吏덈Ц', '후기'] as const;
const postStatusFilterValues = ['게시', '숨김'] as const;

const moderationPolicyCodeOptions = [
  {
    label: 'SPAM 쨌 ?ㅽ뙵/스팸',
    value: 'SPAM',
    description: '諛섎났 게시, 스팸, ?먮룞 ?앹꽦??肄섑뀗痢좎쿂??정상 내용??諛⑺빐?섎뒗 게시글?낅땲??'
  },
  {
    label: 'ABUSE 쨌 ?뺤꽕/?먯삤',
    value: 'ABUSE',
    description: '?뺤꽕, ?먯삤 ?쒗쁽, 愿대∼????커뮤니티 운영 ?뺤콉 ?꾨컲 게시글?낅땲??'
  },
  {
    label: 'AD 쨌 愿묎퀬/?띾낫',
    value: 'AD',
    description: '?덉슜?섏? ?딆? ?몃? ?띾낫, ?쒗쑕 留곹겕, ?곷━ 紐⑹쟻 愿묎퀬 게시글?낅땲??'
  },
  {
    label: 'PRIVACY 쨌 媛쒖씤?뺣낫 ?몄텧',
    value: 'PRIVACY',
    description: '?꾪솕踰덊샇, 怨꾩쥖, 二쇱냼 ??誘쇨컧??媛쒖씤?뺣낫媛 吏곸젒 ?몄텧??게시글?낅땲??'
  },
  {
    label: 'DUPLICATE 쨌 以묐났 게시',
    value: 'DUPLICATE',
    description: '?숈씪 ?먮뒗 ?좎궗??내용??諛섎났 게시판?뺣━媛 ?꾩슂??게시글?낅땲??'
  },
  {
    label: 'OTHER 쨌 湲고?',
    value: 'OTHER',
    description: '?뺤콉 肄붾뱶???녿뒗 사유?댁?留?운영 寃??寃곌낵 議곗튂媛 ?꾩슂??게시글?낅땲??'
  }
] as const;

const moderationPolicyCodeLabelMap: Record<PolicyCode, string> = {
  SPAM: 'SPAM 쨌 ?ㅽ뙵/스팸',
  ABUSE: 'ABUSE 쨌 ?뺤꽕/?먯삤',
  AD: 'AD 쨌 愿묎퀬/?띾낫',
  PRIVACY: 'PRIVACY 쨌 媛쒖씤?뺣낫 ?몄텧',
  DUPLICATE: 'DUPLICATE 쨌 以묐났 게시',
  OTHER: 'OTHER 쨌 湲고?'
};

const memoTypeOptions = [
  { label: 'SPAM', value: 'SPAM' },
  { label: '?뺤꽕/?먯삤', value: '?뺤꽕/?먯삤' },
  { label: '?깆씤/遺덈쾿', value: '?깆씤/遺덈쾿' },
  { label: '愿묎퀬/?띾낫', value: '愿묎퀬/?띾낫' },
  { label: '媛쒖씤?뺣낫 ?몄텧', value: '媛쒖씤?뺣낫 ?몄텧' },
  { label: '以묐났 게시', value: '以묐났 게시' },
  { label: '湲고?', value: '湲고?' }
] as const;

const memoTypeLabelMap: Record<MemoType, string> = {
  SPAM: 'SPAM',
  '?뺤꽕/?먯삤': '?뺤꽕/?먯삤',
  '?깆씤/遺덈쾿': '?깆씤/遺덈쾿',
  '愿묎퀬/?띾낫': '愿묎퀬/?띾낫',
  '媛쒖씤?뺣낫 ?몄텧': '媛쒖씤?뺣낫 ?몄텧',
  '以묐났 게시': '以묐났 게시',
  湲고?: '湲고?'
};

const mockPostPreviewImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F7F4EA"/><stop offset="100%" stop-color="#E0ECFF"/></linearGradient></defs><rect width="960" height="540" rx="36" fill="url(#g)"/><rect x="72" y="88" width="816" height="364" rx="28" fill="#FFFFFF" fill-opacity="0.86"/><text x="96" y="170" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#1D3557">TOPIK 후기 ?명듃 誘몃━蹂닿린</text><text x="96" y="240" font-family="Arial, sans-serif" font-size="28" fill="#4A5568">臾몄젣 ?좏삎蹂??듭떖 ?ъ씤?몄? 吏곸쟾 泥댄겕由ъ뒪?멸? ?뺣━???대?吏 ?덉떆?낅땲??</text><text x="96" y="320" font-family="Arial, sans-serif" font-size="24" fill="#64748B">愿由ъ옄 ?먮Ц 蹂닿린 紐⑤떖?먯꽌 ?대?吏? ?쒖떇??洹몃?濡??뚮뜑留곹븷 ???덈룄濡??곗씠??URI濡?援ъ꽦?덉뒿?덈떎.</text></svg>'
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
    title: 'TOPIK 후기 ?명듃 怨듭쑀',
    content:
      'TOPIK ?ｊ린? ?쎄린 ?鍮꾩슜?쇰줈 ?뺣━??후기 ?명듃瑜?怨듭쑀?⑸땲??\n臾몄젣 ?좏삎蹂??ъ씤?몄? ?먯＜ ?由щ뒗 ?⑥젙???쒕줈 ?뺣━?덇퀬, ?쒗뿕 吏곸쟾 泥댄겕????ぉ??媛숈씠 ?곸뼱?먯뿀?듬땲??',
    contentHtml: `
      <p>TOPIK ?ｊ린? ?쎄린 ?鍮꾩슜?쇰줈 ?뺣━??<strong>후기 ?명듃</strong>瑜?怨듭쑀?⑸땲??</p>
      <p>臾몄젣 ?좏삎蹂??ъ씤?몄? ?먯＜ ?由щ뒗 ?⑥젙???쒕줈 ?뺣━?덇퀬, ?쒗뿕 吏곸쟾 泥댄겕????ぉ??媛숈씠 ?곸뼱?먯뿀?듬땲??</p>
      <figure style="margin: 16px 0;">
        <img
          src="${mockPostPreviewImage}"
          alt="TOPIK 후기 ?명듃 誘몃━蹂닿린"
          style="display:block;max-width:100%;border-radius:16px;border:1px solid #E5E7EB;"
        />
      </figure>
      <ul>
        <li><strong>?ｊ린</strong>: 蹂닿린 ?좎? ?⑥젙 ?⑦꽩 ?뺣━</li>
        <li><strong>?쎄린</strong>: ?쒓컙 諛곕텇 湲곗?怨??ㅻ떟 ?ъ씤??硫붾え</li>
        <li><strong>?곌린</strong>: ?먯＜ ?곕뒗 ?곌껐 ?쒗쁽 ?뺣━</li>
      </ul>
    `,
    authorName: getCommunityUserName('U00012', 'member_12'),
    authorId: 'U00012',
    board: '?먯쑀게시판,
    createdAt: '2026-03-02',
    views: 189,
    comments: 16,
    reports: 0,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-001-MEMO-01',
        title: '정상 게시글 1李?寃??,
        type: '湲고?',
        authorId: 'admin_park',
        authorName: '諛뺤닔誘?,
        createdAt: '2026-03-12 09:18:00',
        content: '?숈뒿 후기 ?깃꺽??정상 게시글?낅땲?? 신고 ?대젰 ?놁씠 議고쉶?섎쭔 ?믪븘 異붿쟻 ??곸뿉?쒕뒗 ?쒖쇅?⑸땲??'
      }
    ]
  },
  {
    id: 'POST-002',
    title: '운영 정책 문의',
    content:
      '신고 ?꾩쟻 ???쒖옱 湲곗????대뼸寃??곸슜?섎뒗吏 臾몄쓽?쒕┰?덈떎.\n寃쎄퀬 ?꾩쟻 湲곗?怨?정지 泥섎━ 湲곗???공지? ?ㅼ젣 운영?먯꽌 ?숈씪?쒖? ?뺤씤?섍퀬 ?띠뒿?덈떎.',
    contentHtml: `
      <p>신고 ?꾩쟻 ???쒖옱 湲곗????대뼸寃??곸슜?섎뒗吏 臾몄쓽?쒕┰?덈떎.</p>
      <p><strong>寃쎄퀬 ?꾩쟻 湲곗?</strong>怨?<strong>정지 泥섎━ 湲곗?</strong>??공지? ?ㅼ젣 운영?먯꽌 ?숈씪?쒖? ?뺤씤?섍퀬 ?띠뒿?덈떎.</p>
      <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #D1D5DB; background: #F8FAFC;">
        신고 泥섎━ 怨쇱젙?먯꽌 李멸퀬??留뚰븳 공지 留곹겕媛 ?덉쑝硫?媛숈씠 ?덈궡 遺?곷뱶由쎈땲??
      </blockquote>
    `,
    authorName: getCommunityUserName('U00047', 'member_47'),
    authorId: 'U00047',
    board: '吏덈Ц',
    createdAt: '2026-03-01',
    views: 54,
    comments: 3,
    reports: 3,
    status: '게시',
    adminNotes: [
      {
        id: 'POST-002-MEMO-01',
        title: '?볤? 遺꾩웳???뺤씤 ?꾩슂',
        type: '?뺤꽕/?먯삤',
        authorId: 'admin_kim',
        authorName: '源?쒖쁺',
        createdAt: '2026-03-13 14:06:00',
        content: '신고 사유???뺤콉 臾몄쓽 ?먯껜蹂대떎 ?볤?濡?遺숈? 遺꾩웳???묐떟 ?뚮Ц?낅땲?? ?먮Ц? ?좎? 媛?μ꽦???덉뼱 ?볤? ?먮쫫怨??④퍡 ?뺤씤???꾩슂?⑸땲??'
      },
      {
        id: 'POST-002-MEMO-02',
        title: '작성일?ш????몄닔?멸퀎',
        type: '湲고?',
        authorId: 'admin_park',
        authorName: '諛뺤닔誘?,
        createdAt: '2026-03-14 10:22:00',
        content: '작성일?대젰 ?뺤씤 ???숈씪 ?좏삎 신고媛 異붽?濡?1嫄??덉뒿?덈떎. 즉시 ??젣蹂대떎??숨김 ???ш???履쎌씠 ?곸젅?⑸땲??'
      }
    ]
  },
  {
    id: 'POST-003',
    title: '시험 후기 공유',
    content:
      '理쒓렐 TOPIK ?쒗뿕 후기瑜?怨듭쑀?⑸땲??\n?ｊ린 ?뚰듃???덉긽蹂대떎 鍮⑤옄怨? ?곌린 ?뚰듃???쒓컙 諛곕텇??媛??以묒슂?덉뒿?덈떎.\n?ㅼ닔?덈뜕 ?ъ씤?몃룄 ?④퍡 ?④꺼?〓땲??',
    contentHtml: `
      <p>理쒓렐 TOPIK ?쒗뿕 후기瑜?怨듭쑀?⑸땲??</p>
      <p>?ｊ린 ?뚰듃???덉긽蹂대떎 鍮⑤옄怨? ?곌린 ?뚰듃??<strong>?쒓컙 諛곕텇</strong>??媛??以묒슂?덉뒿?덈떎.</p>
      <p>?ㅼ닔?덈뜕 ?ъ씤?몃룄 ?④퍡 ?④꺼?〓땲??</p>
      <p><a href="https://example.com/community/post/POST-003" target="_blank" rel="noreferrer">愿???ㅽ꽣??留곹겕</a>瑜??④퍡 ?щ졇?듬땲??</p>
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
        title: '?몃? 留곹겕 ?ы븿 ?뺤씤',
        type: '愿묎퀬/?띾낫',
        authorId: 'admin_lee',
        authorName: '?댁꽌以',
        createdAt: '2026-03-10 16:35:00',
        content: '후기 ?먯껜???좎씡?섏?留??몃? ?ㅽ뵂梨꾪똿 留곹겕媛 ?ы븿???덉뼱 ?곗꽑 숨김 泥섎━?덉뒿?덈떎. 留곹겕 ?쒓굅 ???ш쾶??媛???щ?瑜?異뷀썑 ?뺤씤?⑸땲??'
      }
    ],
    lastModerationPolicyCode: 'AD',
    lastModerationReason: '?몃? ?ㅽ뵂梨꾪똿 ?좊룄 留곹겕媛 ?ы븿?섏뼱 ?꾩떆 숨김 泥섎━?덉뒿?덈떎.',
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
          message: '?깅줉???대? 硫붾え媛 ?놁뒿?덈떎.',
          description: '게시글 상세?먯꽌 ?좉퇋 ?대? 硫붾え瑜??깅줉?????덉뒿?덈떎.'
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
      const moderatedAt = formatNow();

      if (actionState.type === 'show') {
        setRows((prev) =>
          prev.map((item) =>
            item.id === actionState.post.id
              ? {
                  ...item,
                  status: '게시',
                  lastModerationPolicyCode: undefined,
                  lastModerationReason: reason,
                  lastModeratedAt: moderatedAt
                }
              : item
          )
        );
        notificationApi.success({
          message: '게시글 ?ш쾶??완료',
          description: (
            <Space direction="vertical">
              <Text>대상?좏삎: {getTargetTypeLabel('Community')}</Text>
              <Text>대상ID: {actionState.post.id}</Text>
              <Text>사유/洹쇨굅: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.post.id} />
            </Space>
          )
        });
      } else if (actionState.type === 'hide') {
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
              <Text>대상?좏삎: {getTargetTypeLabel('Community')}</Text>
              <Text>대상ID: {actionState.post.id}</Text>
              <Text>
                ?뺤콉 肄붾뱶:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>사유/洹쇨굅: {reason}</Text>
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
              <Text>대상?좏삎: {getTargetTypeLabel('Community')}</Text>
              <Text>대상ID: {actionState.post.id}</Text>
              <Text>
                ?뺤콉 肄붾뱶:{' '}
                {policyCode ? moderationPolicyCodeLabelMap[policyCode] : '-'}
              </Text>
              <Text>사유/洹쇨굅: {reason}</Text>
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
    const authorName = currentAdmin?.name ?? '시스템;
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
      message: '?대? 硫붾え ?깅줉 완료',
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Community')}</Text>
          <Text>대상ID: {selectedPost.id}</Text>
          <Text>硫붾え 작성일 {authorName}</Text>
          <Text>硫붾え 제목: {memoTitle}</Text>
          <Text>硫붾え ?좏삎: {memoTypeLabelMap[memoType]}</Text>
          <Text>硫붾え 내용: {memoContent}</Text>
          <AuditLogLink targetType="Community" targetId={selectedPost.id} />
        </Space>
      )
    });
  }, [currentAdmin, memoForm, notificationApi, selectedPost]);

  const memoColumns = useMemo<TableColumnsType<AdminMemo>>(
    () =>
      fixDrawerTableFirstColumn<AdminMemo>([
        {
          title: '硫붾え ID',
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
          title: '?좏삎',
          dataIndex: 'type',
          width: 120,
          sorter: createTextSorter((record) => record.type),
          render: (type: MemoType) => memoTypeLabelMap[type]
        },
        {
          title: '?묒꽦 愿由ъ옄',
          dataIndex: 'authorName',
          width: 160,
          sorter: createTextSorter(
            (record) => `${record.authorName} ${record.authorId}`
          ),
          render: (_, record) =>
            `${record.authorName} (${record.authorId})`
        },
        {
          title: '작성일,
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
      { key: 'id', label: '硫붾え ID', children: selectedMemo.id },
      { key: 'title', label: '제목', children: selectedMemo.title },
      {
        key: 'type',
        label: '?좏삎',
        children: memoTypeLabelMap[selectedMemo.type]
      },
      {
        key: 'author',
        label: '?묒꽦 愿由ъ옄',
        children: `${selectedMemo.authorName} (${selectedMemo.authorId})`
      },
      { key: 'createdAt', label: '작성일, children: selectedMemo.createdAt },
      {
        key: 'content',
        label: '硫붾え 내용',
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
        title: '작성일,
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
        title: '게시판,
        dataIndex: 'board',
        width: 120,
        ...createDefinedColumnFilterProps(postBoardFilterValues, (record) => record.board),
        sorter: createTextSorter((record) => record.board)
      },
      {
        title: '작성일,
        dataIndex: 'createdAt',
        width: 120,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '議고쉶??,
        dataIndex: 'views',
        width: 90,
        sorter: createNumberSorter((record) => record.views)
      },
      {
        title: '?볤???,
        dataIndex: 'comments',
        width: 90,
        sorter: createNumberSorter((record) => record.comments)
      },
      {
        title: '신고수,
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
        title: '?≪뀡',
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
                label: '게시글 ?먮Ц 蹂닿린',
                onClick: () => handleOpenPostPreview(record.id)
              },
              {
                key: `memo-${record.id}`,
                label: '?대? 硫붾え',
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
        label: '작성일,
        children: (
          <UserNavigationLink
            userId={selectedPost.authorId}
            userName={selectedPost.authorName}
            withId
          />
        )
      },
      { key: 'board', label: '게시판, children: selectedPost.board },
      { key: 'createdAt', label: '작성일, children: selectedPost.createdAt },
      { key: 'views', label: '議고쉶??, children: selectedPost.views },
      { key: 'comments', label: '?볤???, children: selectedPost.comments },
      { key: 'reports', label: '신고수, children: selectedPost.reports },
      {
        key: 'status',
        label: '상태',
        children: <StatusBadge status={selectedPost.status} />
      },
      {
        key: 'adminNotes',
        label: '?대? 硫붾え ??,
        children: `${selectedPost.adminNotes.length}嫄?
      },
      {
        key: 'lastPolicyCode',
        label: '理쒓렐 議곗튂 ?뺤콉 肄붾뱶',
        children: selectedPost.lastModerationPolicyCode
          ? moderationPolicyCodeLabelMap[selectedPost.lastModerationPolicyCode]
          : '-'
      },
      {
        key: 'lastModeratedAt',
        label: '理쒓렐 議곗튂 시각',
        children: selectedPost.lastModeratedAt ?? '-'
      },
      {
        key: 'lastModerationReason',
        label: '理쒓렐 議곗튂 사유',
        children: selectedPost.lastModerationReason ?? '-'
      },
      {
        key: 'preview',
        label: '게시글 ?먮Ц 蹂닿린',
        children: (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto', fontWeight: 600 }}
            onClick={() => handleOpenPostPreview(selectedPost.id)}
          >
            蹂대윭媛湲?
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
        message: '?꾩옱 숨김 泥섎━??게시글?낅땲??',
        description: selectedPost.lastModerationPolicyCode
          ? `理쒓렐 議곗튂 ?뺤콉 肄붾뱶: ${moderationPolicyCodeLabelMap[selectedPost.lastModerationPolicyCode]}`
          : '사용자?붾㈃ ?몄텧??以묐떒??상태?낅땲??'
      };
    }

    if (selectedPost.reports > 0) {
      return {
        type: 'info',
        showIcon: true,
        message: '신고 ?꾩쟻 게시글?낅땲??',
        description: `?꾩옱 신고 ${selectedPost.reports}嫄댁씠 ?꾩쟻?섏뼱 ?덉뒿?덈떎. ?꾩슂 ??신고 愿由??붾㈃?먯꽌 ?꾩냽 寃?섎? ?댁뼱媛?몄슂.`
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
        value: `${rows.length.toLocaleString()}嫄?
      },
      {
        key: 'hidden-posts',
        label: '숨김 게시글',
        value: `${hiddenCount.toLocaleString()}嫄?
      },
      {
        key: 'reported-posts',
        label: '신고 ?꾩쟻 게시글',
        value: `${reportedCount.toLocaleString()}嫄?
      }
    ],
    [hiddenCount, reportedCount, rows.length]
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="게시글 愿由? />
      <ListSummaryCards items={postSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '게시글 ID', value: 'id' },
              { label: '제목', value: 'title' },
              { label: '작성일, value: 'authorName' },
              { label: '蹂몃Ц', value: 'content' }
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
            keywordPlaceholder="寃??.."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="작성일>
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
              <Text type="secondary">珥?{visibleRows.length.toLocaleString()}嫄?/Text>
            }
          />
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          신고 嫄댁?{' '}
          <Link className="table-navigation-link" to="/community/reports">
            신고 愿由?
          </Link>
          ?먯꽌 ?댁뼱???뺤씤?????덉뒿?덈떎.
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
          title={
            actionState.type === 'show'
              ? '게시글 ?ш쾶??
              : actionState.type === 'hide'
                ? '게시글 숨김'
                : '게시글 삭제'
          }
          description={
            actionState.type === 'show'
              ? '숨김 泥섎━??게시글???ㅼ떆 게시?⑸땲?? ?ш쾶??사유를 기록하세요.'
              : actionState.type === 'hide'
              ? '게시글 노출을 중단합니다. ?뺤콉 肄붾뱶? 숨김 사유를 기록하세요.'
              : '게시글??紐⑸줉?먯꽌 ?쒓굅?⑸땲?? ?뺤콉 肄붾뱶? ??젣 사유를 기록하세요.'
          }
          targetType="Community"
          targetId={actionState.post.id}
          confirmText={
            actionState.type === 'show'
              ? '?ш쾶???ㅽ뻾'
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
        title={selectedPost ? `게시글 상세 쨌 ${selectedPost.id}` : '게시글 상세'}
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
                onClick={() => handleTogglePostStatus(selectedPost)}
              >
                {selectedPost.status === '게시' ? '게시글 숨김' : '게시글 ?ш쾶??}
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

            <DetailDrawerSection title="게시글 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={detailItems}
              />
            </DetailDrawerSection>

            <DetailDrawerSection
              title="硫붾え ?덉뒪?좊━"
              actions={
                <Button type="primary" size="large" onClick={handleOpenMemoModal}>
                  硫붾え ?깅줉
                </Button>
              }
            >
              <AdminDataTable<AdminMemo>
                rowKey="id"
                columns={memoColumns}
                dataSource={selectedPost.adminNotes}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(720)}
                locale={{ emptyText: '?깅줉???대? 硫붾え媛 ?놁뒿?덈떎.' }}
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
        title="?대? 硫붾え ?깅줉"
        okText="대상
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
                label: '대상,
                children: `${getTargetTypeLabel('Community')} / ${selectedPost?.id ?? '-'}`
              },
              {
                key: 'author',
                label: '작성일,
                children: `${currentAdmin?.name ?? '시스템} (${currentAdmin?.adminId ?? 'system'})`
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
                            : Promise.reject(new Error('硫붾え 제목???낅젰?섏꽭??'))
                      }
                    ]}
                  >
                    <Input maxLength={100} placeholder="硫붾え 제목???낅젰?섏꽭??" />
                  </Form.Item>
                )
              },
              {
                key: 'type',
                label: '?좏삎',
                children: (
                  <Form.Item
                    name="type"
                    style={{ marginBottom: 0 }}
                    rules={[{ required: true, message: '硫붾え ?좏삎???좏깮?섏꽭??' }]}
                  >
                    <Select
                      options={memoTypeOptions.map((option) => ({
                        label: option.label,
                        value: option.value
                      }))}
                      placeholder="硫붾え ?좏삎???좏깮?섏꽭??"
                    />
                  </Form.Item>
                )
              },
              {
                key: 'memo',
                label: '硫붾え 내용',
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
                      placeholder="?꾩냽 寃???ъ씤?? ?몄닔?멸퀎 硫붾え, ?몃? ?곌퀎 ?댁뒋 ?깆쓣 湲곕줉?섏꽭??"
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
        title="?대? 硫붾え 상세"
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
        title="게시글 ?먮Ц 蹂닿린"
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
                  label: '작성일,
                  children: (
                    <UserNavigationLink
                      userId={previewPost.authorId}
                      userName={previewPost.authorName}
                      withId
                    />
                  )
                },
                { key: 'board', label: '게시판, children: previewPost.board },
                { key: 'createdAt', label: '작성일, children: previewPost.createdAt }
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


