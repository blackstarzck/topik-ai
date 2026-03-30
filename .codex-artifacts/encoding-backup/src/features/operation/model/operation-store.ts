import { create } from 'zustand';

import type {
  OperationEvent,
  OperationEventExposureChannel,
  OperationEventIndexingPolicy,
  OperationEventRewardType,
  OperationEventType,
  OperationEventVisibilityStatus,
  OperationFaq,
  OperationFaqCuration,
  OperationFaqStatus,
  OperationFaqMetric,
  OperationNotice,
  OperationNoticeStatus
} from './types';

const CURRENT_ACTOR = 'admin_current';

type SaveNoticePayload = Pick<OperationNotice, 'title' | 'bodyHtml'> & {
  id?: string;
};

type ToggleNoticeStatusPayload = {
  noticeId: string;
  nextStatus: OperationNoticeStatus;
};

type SaveFaqPayload = Pick<
  OperationFaq,
  'question' | 'answer' | 'searchKeywords' | 'category' | 'status'
> & {
  id?: string;
};

type ToggleFaqStatusPayload = {
  faqId: string;
  nextStatus: OperationFaqStatus;
};

type SaveFaqCurationPayload = Pick<
  OperationFaqCuration,
  | 'faqId'
  | 'surface'
  | 'curationMode'
  | 'displayRank'
  | 'exposureStatus'
  | 'pinnedStartAt'
  | 'pinnedEndAt'
> & {
  id?: string;
};

type SaveEventPayload = {
  id?: string;
  title: string;
  summary: string;
  bodyHtml: string;
  slug: string;
  eventType: OperationEventType;
  visibilityStatus: OperationEventVisibilityStatus;
  startAt: string;
  endAt: string;
  exposureChannels: OperationEventExposureChannel[];
  targetGroupId: string;
  targetGroupName: string;
  participantLimit: number | null;
  rewardType: OperationEventRewardType;
  rewardPolicyId: string;
  rewardPolicyName: string;
  messageTemplateId: string;
  bannerImageUrl: string;
  bannerImageSourceType: OperationEvent['bannerImageSourceType'];
  bannerImageFileName: string;
  bannerImages: OperationEvent['bannerImages'];
  landingUrl: string;
  messageTemplateName: string;
  metaTitle: string;
  metaDescription: string;
  ogImageUrl: string;
  canonicalUrl: string;
  indexingPolicy: OperationEventIndexingPolicy;
  adminMemo: string;
};

type EventActionPayload = {
  eventId: string;
};

type OperationStore = {
  notices: OperationNotice[];
  faqs: OperationFaq[];
  faqCurations: OperationFaqCuration[];
  faqMetrics: OperationFaqMetric[];
  events: OperationEvent[];
  saveNotice: (payload: SaveNoticePayload) => OperationNotice;
  toggleNoticeStatus: (payload: ToggleNoticeStatusPayload) => OperationNotice | null;
  deleteNotice: (noticeId: string) => OperationNotice | null;
  saveFaq: (payload: SaveFaqPayload) => OperationFaq;
  toggleFaqStatus: (payload: ToggleFaqStatusPayload) => OperationFaq | null;
  deleteFaq: (faqId: string) => OperationFaq | null;
  saveFaqCuration: (payload: SaveFaqCurationPayload) => OperationFaqCuration;
  deleteFaqCuration: (curationId: string) => OperationFaqCuration | null;
  saveEvent: (payload: SaveEventPayload) => OperationEvent;
  scheduleEventPublish: (payload: EventActionPayload) => OperationEvent | null;
  publishEvent: (payload: EventActionPayload) => OperationEvent | null;
  endEvent: (payload: EventActionPayload) => OperationEvent | null;
};

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function toDateString(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeKeywords(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  );
}

function createSlug(value: string, fallback: string): string {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || fallback;
}

function buildRewardPolicySummary(
  rewardType: OperationEventRewardType,
  rewardPolicyName: string
): string {
  if (rewardType === '?놁쓬') {
    return '蹂댁긽 ?놁쓬';
  }

  const normalizedPolicyName = normalizeText(rewardPolicyName);
  return normalizedPolicyName ? `${rewardType} 쨌 ${normalizedPolicyName}` : rewardType;
}

function buildCanonicalUrl(slug: string, landingUrl: string): string {
  const normalizedLandingUrl = normalizeText(landingUrl);
  if (normalizedLandingUrl) {
    return normalizedLandingUrl;
  }

  return `/events/${slug}`;
}

function resolveEventProgressStatus(
  startAt: string,
  endAt: string,
  forceEnded = false
): OperationEvent['progressStatus'] {
  if (forceEnded) {
    return '醫낅즺';
  }

  const today = toDateString(formatNow());
  if (today < startAt) {
    return '?덉젙';
  }
  if (today > endAt) {
    return '醫낅즺';
  }

  return '吏꾪뻾 以?;
}

function getNextNoticeId(notices: OperationNotice[]): string {
  const sequence =
    notices
      .map((notice) => Number(notice.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `NOTICE-${String(sequence).padStart(3, '0')}`;
}

function getNextFaqId(faqs: OperationFaq[]): string {
  const sequence =
    faqs
      .map((faq) => Number(faq.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `FAQ-${String(sequence).padStart(3, '0')}`;
}

function getNextFaqCurationId(curations: OperationFaqCuration[]): string {
  const sequence =
    curations
      .map((curation) => Number(curation.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `FAQCUR-${String(sequence).padStart(3, '0')}`;
}

function getNextEventId(events: OperationEvent[]): string {
  const sequence =
    events
      .map((event) => Number(event.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `EVT-${String(sequence).padStart(3, '0')}`;
}

const initialNotices: OperationNotice[] = [
  {
    id: 'NOTICE-001',
    title: '정기 점검 안내',
    author: 'admin_park',
    createdAt: '2026-03-03',
    status: '게시',
    bodyHtml:
      '<h2>정기 점검 안내</h2><p>2026??3??24??02:00遺??03:30源뚯? ?뺢린 ?먭???吏꾪뻾?⑸땲??</p><ul><li>?숈뒿 吏꾨룄 ??μ? ?먮룞 蹂듦뎄?⑸땲??</li><li>결제 諛?커뮤니티 湲곕뒫? ?먭? ?쒓컙 ?숈븞 ?쇱떆 以묐떒?⑸땲??</li></ul>',
    updatedAt: '2026-03-20 09:00',
    updatedBy: 'admin_park'
  },
  {
    id: 'NOTICE-002',
    title: '환불 ?뺤콉 蹂寃?,
    author: 'admin_kim',
    createdAt: '2026-02-21',
    status: '숨김',
    bodyHtml:
      '<h2>환불 ?뺤콉 蹂寃??덈궡</h2><p>2026??4??1?쇰????쇰? ?⑦궎吏 상품??환불 湲곗???蹂寃쎈맗?덈떎.</p><p>결제 ??7???대궡, ?숈뒿 ?대젰???녿뒗 寃쎌슦???쒗빐 ?꾩븸 환불??媛?ν빀?덈떎.</p>',
    updatedAt: '2026-03-18 14:20',
    updatedBy: 'admin_kim'
  }
];

const initialFaqs: OperationFaq[] = [
  {
    id: 'FAQ-001',
    question: '결제 ?ㅻ쪟媛 諛쒖깮?섎㈃ ?대뼡 ?뺣낫瑜?癒쇱? ?뺤씤?댁빞 ?섎굹??',
    answer:
      '결제 ID, 결제 수단, ?쒕룄 시각???뺤씤????결제 내역怨?시스템 로그瑜??④퍡 議고쉶?⑸땲??',
    searchKeywords: ['결제 ?ㅻ쪟', '결제 실패', '移대뱶 결제'],
    category: '결제',
    status: '怨듦컻',
    createdAt: '2026-03-08',
    updatedAt: '2026-03-08 11:20',
    updatedBy: 'admin_park'
  },
  {
    id: 'FAQ-002',
    question: '회원 정지 처리 대기?대뼡 로그瑜??뺤씤?댁빞 ?섎굹??',
    answer:
      '회원 상세?먯꽌 議곗튂 사유瑜?湲곕줉????媛먯궗 로그?먯꽌 대상?좏삎, 대상ID, ?섑뻾?먮? ?뺤씤?⑸땲??',
    searchKeywords: ['회원 정지', '怨꾩젙 정지', '媛먯궗 로그'],
    category: '怨꾩젙',
    status: '怨듦컻',
    createdAt: '2026-03-05',
    updatedAt: '2026-03-05 14:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'FAQ-003',
    question: '硫붿떆吏 발송 실패 嫄댁? ?대뵒???ъ떆?꾪븯?섏슂?',
    answer:
      '硫붿떆吏 발송 이력 상세 Drawer?먯꽌 실패 ?섏떊?먯? 실패 ?먯씤???뺤씤?????ъ떆??발송???ㅽ뻾?⑸땲??',
    searchKeywords: ['硫붿떆吏 실패', '?몄떆 실패', '硫붿씪 ?ъ떆??],
    category: '硫붿떆吏',
    status: '鍮꾧났媛?,
    createdAt: '2026-03-03',
    updatedAt: '2026-03-03 09:40',
    updatedBy: 'admin_kim'
  }
];

const initialFaqCurations: OperationFaqCuration[] = [
  {
    id: 'FAQCUR-001',
    faqId: 'FAQ-001',
    surface: 'help_center',
    curationMode: 'manual',
    displayRank: 1,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-20',
    pinnedEndAt: null,
    updatedAt: '2026-03-20 10:00',
    updatedBy: 'admin_park'
  },
  {
    id: 'FAQCUR-002',
    faqId: 'FAQ-002',
    surface: 'home_top',
    curationMode: 'manual',
    displayRank: 2,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-21',
    pinnedEndAt: null,
    updatedAt: '2026-03-21 09:30',
    updatedBy: 'admin_kim'
  },
  {
    id: 'FAQCUR-003',
    faqId: 'FAQ-001',
    surface: 'payment_help',
    curationMode: 'auto',
    displayRank: 1,
    exposureStatus: 'active',
    pinnedStartAt: '2026-03-18',
    pinnedEndAt: null,
    updatedAt: '2026-03-22 15:20',
    updatedBy: 'admin_park'
  }
];

const initialFaqMetrics: OperationFaqMetric[] = [
  {
    faqId: 'FAQ-001',
    viewCount: 842,
    searchHitCount: 214,
    helpfulCount: 122,
    notHelpfulCount: 11,
    lastViewedAt: '2026-03-23 09:10'
  },
  {
    faqId: 'FAQ-002',
    viewCount: 615,
    searchHitCount: 167,
    helpfulCount: 93,
    notHelpfulCount: 14,
    lastViewedAt: '2026-03-23 08:40'
  },
  {
    faqId: 'FAQ-003',
    viewCount: 148,
    searchHitCount: 42,
    helpfulCount: 19,
    notHelpfulCount: 7,
    lastViewedAt: '2026-03-22 18:05'
  }
];

const initialEvents: OperationEvent[] = [
  {
    id: 'EVT-001',
    title: '遊??숈뒿 異쒖꽍 ?대깽??,
    summary: '?곗냽 異쒖꽍 회원?먭쾶 ?ъ씤?몃? 吏湲됲븯??3??罹좏럹?몄엯?덈떎.',
    bodyHtml:
      '<h2>遊??숈뒿 異쒖꽍 ?대깽??/h2><p>3???????숈븞 ?곗냽 異쒖꽍???좎???회원?먭쾶 ?ъ씤?몃? 吏湲됲빀?덈떎.</p><ul><li>7???곗냽 異쒖꽍 ??100P 吏湲?/li><li>14???곗냽 異쒖꽍 ??異붽? 蹂대꼫??吏湲?/li><li>?대깽????낵 ????諛곕꼫?먯꽌 상세 議곌굔 ?뺤씤 媛??/li></ul>',
    slug: '遊??숈뒿-異쒖꽍-?대깽??,
    eventType: '異쒖꽍',
    progressStatus: '吏꾪뻾 以?,
    visibilityStatus: '?몄텧',
    startAt: '2026-03-20',
    endAt: '2026-03-31',
    exposureChannels: ['????, '?대깽????],
    targetGroupId: 'GRP-001',
    targetGroupName: '활성 ?숈뒿??,
    participantCount: 1280,
    participantLimit: 5000,
    rewardType: '?ъ씤??,
    rewardPolicyId: 'POINT-100',
    rewardPolicyName: '異쒖꽍 7???꾩쟻 100P',
    rewardPolicySummary: '?ъ씤??쨌 異쒖꽍 7???꾩쟻 100P',
    messageTemplateId: 'PUSH-MAN-001',
    bannerImages: [
      {
        uid: 'EVT-001-banner-1',
        name: 'attendance-march.png',
        url: 'https://images.example.com/events/attendance-march.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/attendance-march.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'attendance-march.png',
    landingUrl: '/events/spring-attendance',
    messageTemplateName: '?먭? 공지 ?몄떆',
    metaTitle: '遊??숈뒿 異쒖꽍 ?대깽??,
    metaDescription: '?곗냽 異쒖꽍 ???ъ씤?몃? 吏湲됲븯??3???숈뒿 ?대깽?몃? ?뺤씤?섏꽭??',
    ogImageUrl: 'https://images.example.com/events/attendance-march-og.png',
    canonicalUrl: '/events/spring-attendance',
    indexingPolicy: 'index',
    adminMemo: '?????곷떒 諛곕꼫? ?대깽?????숈떆 ?몄텧',
    createdAt: '2026-03-15',
    updatedAt: '2026-03-22 10:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'EVT-002',
    title: '移쒓뎄 珥덈? 由ъ썙??罹좏럹??,
    summary: '移쒓뎄 珥덈? 성공 수荑좏룿??吏湲됲븯???쒖쫵 ?꾨줈紐⑥뀡?낅땲??',
    bodyHtml:
      '<h2>移쒓뎄 珥덈? 由ъ썙??罹좏럹??/h2><p>移쒓뎄媛 珥덈? 留곹겕瑜??듯빐 媛?낇븯怨?泥??숈뒿??완료?섎㈃ 荑좏룿??吏湲됲빀?덈떎.</p><ol><li>移쒓뎄?먭쾶 ?꾩슜 留곹겕瑜?怨듭쑀?⑸땲??</li><li>移쒓뎄媛 媛????泥??숈뒿??완료?⑸땲??</li><li>議곌굔 異⑹” ??15% ?좎씤 荑좏룿???먮룞 諛쒓툒?⑸땲??</li></ol>',
    slug: '移쒓뎄-珥덈?-由ъ썙??罹좏럹??,
    eventType: '?꾨줈紐⑥뀡',
    progressStatus: '?덉젙',
    visibilityStatus: '예약',
    startAt: '2026-04-01',
    endAt: '2026-04-20',
    exposureChannels: ['????, '?대깽????],
    targetGroupId: 'GRP-003',
    targetGroupName: 'VIP 怨좉컼',
    participantCount: 0,
    participantLimit: 3000,
    rewardType: '荑좏룿',
    rewardPolicyId: 'COUPON-APR-15',
    rewardPolicyName: '移쒓뎄 珥덈? 15% 荑좏룿',
    rewardPolicySummary: '荑좏룿 쨌 移쒓뎄 珥덈? 15% 荑좏룿',
    messageTemplateId: 'MAIL-MAN-002',
    bannerImages: [
      {
        uid: 'EVT-002-banner-1',
        name: 'referral-april.png',
        url: 'https://images.example.com/events/referral-april.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/referral-april.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'referral-april.png',
    landingUrl: '/events/referral-april',
    messageTemplateName: 'VIP ?됱궗 珥덈? 硫붿씪',
    metaTitle: '移쒓뎄 珥덈? 由ъ썙??罹좏럹??,
    metaDescription: '移쒓뎄 珥덈? 성공 수사용자???덈뒗 ?좎씤 荑좏룿 ?대깽?몄엯?덈떎.',
    ogImageUrl: 'https://images.example.com/events/referral-april-og.png',
    canonicalUrl: '/events/referral-april',
    indexingPolicy: 'index',
    adminMemo: '4??1??09:00 ?먮룞 ?몄텧 ?덉젙',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-22 17:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'EVT-003',
    title: 'TOPIK ?묒떆 梨뚮┛吏',
    summary: '?묒떆 완료 회원?먭쾶 諛곗?瑜?吏湲됲븳 ?쒖쫵 梨뚮┛吏?낅땲??',
    bodyHtml:
      '<h2>TOPIK ?묒떆 梨뚮┛吏</h2><p>TOPIK ?묒떆瑜?완료??회원?먭쾶 ?꾩＜ 諛곗?瑜?吏湲됲뻽???쒖쫵 梨뚮┛吏?낅땲??</p><p>?꾩옱??醫낅즺?섏뼱 ?좉퇋 李몄뿬??遺덇??섎ŉ, 湲곗〈 李몄뿬 ?대젰怨?蹂댁긽 ?댁뿭留?蹂닿??⑸땲??</p>',
    slug: 'topik-?묒떆-梨뚮┛吏',
    eventType: '梨뚮┛吏',
    progressStatus: '醫낅즺',
    visibilityStatus: '숨김',
    startAt: '2026-02-01',
    endAt: '2026-02-28',
    exposureChannels: ['?대깽????],
    targetGroupId: 'GRP-004',
    targetGroupName: '운영 공지 구독??,
    participantCount: 642,
    participantLimit: null,
    rewardType: '諛곗?',
    rewardPolicyId: 'BADGE-TOPIK-001',
    rewardPolicyName: 'TOPIK 梨뚮┛吏 ?꾩＜ 諛곗?',
    rewardPolicySummary: '諛곗? 쨌 TOPIK 梨뚮┛吏 ?꾩＜ 諛곗?',
    messageTemplateId: 'PUSH-MAN-002',
    bannerImages: [
      {
        uid: 'EVT-003-banner-1',
        name: 'topik-challenge.png',
        url: 'https://images.example.com/events/topik-challenge.png'
      }
    ],
    bannerImageUrl: 'https://images.example.com/events/topik-challenge.png',
    bannerImageSourceType: 'file',
    bannerImageFileName: 'topik-challenge.png',
    landingUrl: '/events/topik-challenge',
    messageTemplateName: '二쇰쭚 罹좏럹???덈궡',
    metaTitle: 'TOPIK ?묒떆 梨뚮┛吏',
    metaDescription: 'TOPIK ?묒떆 회원???꾪븳 ?쒖쫵 梨뚮┛吏? 諛곗? 吏湲?湲곕줉?낅땲??',
    ogImageUrl: 'https://images.example.com/events/topik-challenge-og.png',
    canonicalUrl: '/events/topik-challenge',
    indexingPolicy: 'noindex',
    adminMemo: '醫낅즺 ???대젰 蹂닿??? ?몄텧 ?ш컻 怨꾪쉷 ?놁쓬.',
    createdAt: '2026-01-25',
    updatedAt: '2026-03-01 08:30',
    updatedBy: 'admin_lee'
  }
];

export const useOperationStore = create<OperationStore>((set, get) => ({
  notices: initialNotices,
  faqs: initialFaqs,
  faqCurations: initialFaqCurations,
  faqMetrics: initialFaqMetrics,
  events: initialEvents,
  saveNotice: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().notices.find((notice) => notice.id === payload.id) ?? null
      : null;

    const nextNotice: OperationNotice = target
      ? {
          ...target,
          title: payload.title,
          bodyHtml: payload.bodyHtml,
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextNoticeId(get().notices),
          title: payload.title,
          author: CURRENT_ACTOR,
          createdAt: toDateString(now),
          status: '숨김',
          bodyHtml: payload.bodyHtml,
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      notices: target
        ? state.notices.map((notice) =>
            notice.id === nextNotice.id ? nextNotice : notice
          )
        : [nextNotice, ...state.notices]
    }));

    return nextNotice;
  },
  toggleNoticeStatus: ({ noticeId, nextStatus }) => {
    const target = get().notices.find((notice) => notice.id === noticeId);
    if (!target) {
      return null;
    }

    const nextNotice: OperationNotice = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      notices: state.notices.map((notice) =>
        notice.id === noticeId ? nextNotice : notice
      )
    }));

    return nextNotice;
  },
  deleteNotice: (noticeId) => {
    const target = get().notices.find((notice) => notice.id === noticeId);
    if (!target) {
      return null;
    }

    set((state) => ({
      notices: state.notices.filter((notice) => notice.id !== noticeId)
    }));

    return target;
  },
  saveFaq: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().faqs.find((faq) => faq.id === payload.id) ?? null
      : null;
    const searchKeywords = normalizeKeywords(payload.searchKeywords);

    const nextFaq: OperationFaq = target
      ? {
          ...target,
          question: payload.question,
          answer: payload.answer,
          searchKeywords,
          category: payload.category,
          status: payload.status,
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextFaqId(get().faqs),
          question: payload.question,
          answer: payload.answer,
          searchKeywords,
          category: payload.category,
          status: payload.status,
          createdAt: toDateString(now),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      faqs: target
        ? state.faqs.map((faq) => (faq.id === nextFaq.id ? nextFaq : faq))
        : [nextFaq, ...state.faqs],
      faqMetrics: target
        ? state.faqMetrics
        : [
            {
              faqId: nextFaq.id,
              viewCount: 0,
              searchHitCount: 0,
              helpfulCount: 0,
              notHelpfulCount: 0,
              lastViewedAt: null
            },
            ...state.faqMetrics
          ]
    }));

    return nextFaq;
  },
  toggleFaqStatus: ({ faqId, nextStatus }) => {
    const target = get().faqs.find((faq) => faq.id === faqId);
    if (!target) {
      return null;
    }

    const nextFaq: OperationFaq = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      faqs: state.faqs.map((faq) => (faq.id === faqId ? nextFaq : faq)),
      faqCurations:
        nextStatus === '鍮꾧났媛?
          ? state.faqCurations.map((curation) =>
              curation.faqId === faqId
                ? {
                    ...curation,
                    exposureStatus: 'paused',
                    updatedAt: formatNow(),
                    updatedBy: CURRENT_ACTOR
                  }
                : curation
            )
          : state.faqCurations
    }));

    return nextFaq;
  },
  deleteFaq: (faqId) => {
    const target = get().faqs.find((faq) => faq.id === faqId);
    if (!target) {
      return null;
    }

    set((state) => ({
      faqs: state.faqs.filter((faq) => faq.id !== faqId),
      faqCurations: state.faqCurations.filter((curation) => curation.faqId !== faqId),
      faqMetrics: state.faqMetrics.filter((metric) => metric.faqId !== faqId)
    }));

    return target;
  },
  saveFaqCuration: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().faqCurations.find((curation) => curation.id === payload.id) ?? null
      : null;

    const nextCuration: OperationFaqCuration = target
      ? {
          ...target,
          faqId: payload.faqId,
          surface: payload.surface,
          curationMode: payload.curationMode,
          displayRank: payload.displayRank,
          exposureStatus: payload.exposureStatus,
          pinnedStartAt: payload.pinnedStartAt,
          pinnedEndAt: payload.pinnedEndAt,
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextFaqCurationId(get().faqCurations),
          faqId: payload.faqId,
          surface: payload.surface,
          curationMode: payload.curationMode,
          displayRank: payload.displayRank,
          exposureStatus: payload.exposureStatus,
          pinnedStartAt: payload.pinnedStartAt,
          pinnedEndAt: payload.pinnedEndAt,
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      faqCurations: target
        ? state.faqCurations.map((curation) =>
            curation.id === nextCuration.id ? nextCuration : curation
          )
        : [nextCuration, ...state.faqCurations]
    }));

    return nextCuration;
  },
  deleteFaqCuration: (curationId) => {
    const target =
      get().faqCurations.find((curation) => curation.id === curationId) ?? null;

    if (!target) {
      return null;
    }

    set((state) => ({
      faqCurations: state.faqCurations.filter(
        (curation) => curation.id !== curationId
      )
    }));

    return target;
  },
  saveEvent: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().events.find((event) => event.id === payload.id) ?? null
      : null;
    const eventId = target?.id ?? getNextEventId(get().events);
    const title = normalizeText(payload.title);
    const summary = normalizeText(payload.summary);
    const slug = createSlug(payload.slug || title, eventId.toLowerCase());
    const bannerImages = payload.bannerImages
      .map((bannerImage) => ({
        uid: normalizeText(bannerImage.uid),
        name: normalizeText(bannerImage.name),
        url: normalizeText(bannerImage.url)
      }))
      .filter((bannerImage) => bannerImage.uid && bannerImage.url);
    const representativeBannerImage = bannerImages[0];
    const bannerImageUrl = representativeBannerImage?.url ?? '';
    const bannerImageSourceType = 'file';
    const bannerImageFileName = representativeBannerImage?.name ?? '';
    const landingUrl = normalizeText(payload.landingUrl);
    const nextEvent: OperationEvent = {
      id: eventId,
      title,
      summary,
      bodyHtml: payload.bodyHtml,
      slug,
      eventType: payload.eventType,
      progressStatus: resolveEventProgressStatus(
        payload.startAt,
        payload.endAt,
        target?.progressStatus === '醫낅즺'
      ),
      visibilityStatus: payload.visibilityStatus,
      startAt: payload.startAt,
      endAt: payload.endAt,
      exposureChannels: [...payload.exposureChannels],
      targetGroupId: normalizeText(payload.targetGroupId),
      targetGroupName: normalizeText(payload.targetGroupName),
      participantCount: target?.participantCount ?? 0,
      participantLimit: payload.participantLimit ?? null,
      rewardType: payload.rewardType,
      rewardPolicyId: normalizeText(payload.rewardPolicyId),
      rewardPolicyName: normalizeText(payload.rewardPolicyName),
      rewardPolicySummary: buildRewardPolicySummary(
        payload.rewardType,
        payload.rewardPolicyName
      ),
      messageTemplateId: normalizeText(payload.messageTemplateId),
      bannerImages,
      bannerImageUrl,
      bannerImageSourceType,
      bannerImageFileName,
      landingUrl,
      messageTemplateName: normalizeText(payload.messageTemplateName),
      metaTitle: normalizeText(payload.metaTitle) || title,
      metaDescription: normalizeText(payload.metaDescription) || summary,
      ogImageUrl: normalizeText(payload.ogImageUrl) || bannerImageUrl,
      canonicalUrl:
        normalizeText(payload.canonicalUrl) || buildCanonicalUrl(slug, landingUrl),
      indexingPolicy: payload.indexingPolicy,
      adminMemo: normalizeText(payload.adminMemo),
      createdAt: target?.createdAt ?? toDateString(now),
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      events: target
        ? state.events.map((event) => (event.id === nextEvent.id ? nextEvent : event))
        : [nextEvent, ...state.events]
    }));

    return nextEvent;
  },
  scheduleEventPublish: ({ eventId }) => {
    const target = get().events.find((event) => event.id === eventId);
    if (!target) {
      return null;
    }

    const nextEvent: OperationEvent = {
      ...target,
      visibilityStatus: '예약',
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      events: state.events.map((event) => (event.id === eventId ? nextEvent : event))
    }));

    return nextEvent;
  },
  publishEvent: ({ eventId }) => {
    const target = get().events.find((event) => event.id === eventId);
    if (!target) {
      return null;
    }

    const nextEvent: OperationEvent = {
      ...target,
      visibilityStatus: '?몄텧',
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      events: state.events.map((event) => (event.id === eventId ? nextEvent : event))
    }));

    return nextEvent;
  },
  endEvent: ({ eventId }) => {
    const target = get().events.find((event) => event.id === eventId);
    if (!target) {
      return null;
    }

    const nextEvent: OperationEvent = {
      ...target,
      progressStatus: '醫낅즺',
      visibilityStatus: '숨김',
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      events: state.events.map((event) => (event.id === eventId ? nextEvent : event))
    }));

    return nextEvent;
  }
}));


