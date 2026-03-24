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
  bannerImageUrl: string;
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
  if (rewardType === '없음') {
    return '보상 없음';
  }

  const normalizedPolicyName = normalizeText(rewardPolicyName);
  return normalizedPolicyName ? `${rewardType} · ${normalizedPolicyName}` : rewardType;
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
    return '종료';
  }

  const today = toDateString(formatNow());
  if (today < startAt) {
    return '예정';
  }
  if (today > endAt) {
    return '종료';
  }

  return '진행 중';
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
      '<h2>정기 점검 안내</h2><p>2026년 3월 24일 02:00부터 03:30까지 정기 점검을 진행합니다.</p><ul><li>학습 진도 저장은 자동 복구됩니다.</li><li>결제 및 커뮤니티 기능은 점검 시간 동안 일시 중단됩니다.</li></ul>',
    updatedAt: '2026-03-20 09:00',
    updatedBy: 'admin_park'
  },
  {
    id: 'NOTICE-002',
    title: '환불 정책 변경',
    author: 'admin_kim',
    createdAt: '2026-02-21',
    status: '숨김',
    bodyHtml:
      '<h2>환불 정책 변경 안내</h2><p>2026년 4월 1일부터 일부 패키지 상품의 환불 기준이 변경됩니다.</p><p>결제 후 7일 이내, 학습 이력이 없는 경우에 한해 전액 환불이 가능합니다.</p>',
    updatedAt: '2026-03-18 14:20',
    updatedBy: 'admin_kim'
  }
];

const initialFaqs: OperationFaq[] = [
  {
    id: 'FAQ-001',
    question: '결제 오류가 발생하면 어떤 정보를 먼저 확인해야 하나요?',
    answer:
      '결제 ID, 결제 수단, 시도 시각을 확인한 뒤 결제 내역과 시스템 로그를 함께 조회합니다.',
    searchKeywords: ['결제 오류', '결제 실패', '카드 결제'],
    category: '결제',
    status: '공개',
    createdAt: '2026-03-08',
    updatedAt: '2026-03-08 11:20',
    updatedBy: 'admin_park'
  },
  {
    id: 'FAQ-002',
    question: '회원 정지 처리 후 어떤 로그를 확인해야 하나요?',
    answer:
      '회원 상세에서 조치 사유를 기록한 뒤 감사 로그에서 대상 유형, 대상 ID, 수행자를 확인합니다.',
    searchKeywords: ['회원 정지', '계정 정지', '감사 로그'],
    category: '계정',
    status: '공개',
    createdAt: '2026-03-05',
    updatedAt: '2026-03-05 14:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'FAQ-003',
    question: '메시지 발송 실패 건은 어디서 재시도하나요?',
    answer:
      '메시지 발송 이력 상세 Drawer에서 실패 수신자와 실패 원인을 확인한 뒤 재시도 발송을 실행합니다.',
    searchKeywords: ['메시지 실패', '푸시 실패', '메일 재시도'],
    category: '메시지',
    status: '비공개',
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
    title: '봄 학습 출석 이벤트',
    summary: '연속 출석 회원에게 포인트를 지급하는 3월 캠페인입니다.',
    bodyHtml:
      '<h2>봄 학습 출석 이벤트</h2><p>3월 한 달 동안 연속 출석을 유지한 회원에게 포인트를 지급합니다.</p><ul><li>7일 연속 출석 시 100P 지급</li><li>14일 연속 출석 시 추가 보너스 지급</li><li>이벤트 탭과 앱 홈 배너에서 상세 조건 확인 가능</li></ul>',
    slug: '봄-학습-출석-이벤트',
    eventType: '출석',
    progressStatus: '진행 중',
    visibilityStatus: '노출',
    startAt: '2026-03-20',
    endAt: '2026-03-31',
    exposureChannels: ['앱 홈', '이벤트 탭'],
    targetGroupId: 'SEG-ATTEND-001',
    targetGroupName: '최근 30일 활성 학습자',
    participantCount: 1280,
    participantLimit: 5000,
    rewardType: '포인트',
    rewardPolicyId: 'POINT-100',
    rewardPolicyName: '출석 7일 누적 100P',
    rewardPolicySummary: '포인트 · 출석 7일 누적 100P',
    bannerImageUrl: 'https://images.example.com/events/attendance-march.png',
    landingUrl: '/events/spring-attendance',
    messageTemplateName: '출석 이벤트 공지 푸시',
    metaTitle: '봄 학습 출석 이벤트',
    metaDescription: '연속 출석 시 포인트를 지급하는 3월 학습 이벤트를 확인하세요.',
    ogImageUrl: 'https://images.example.com/events/attendance-march-og.png',
    canonicalUrl: '/events/spring-attendance',
    indexingPolicy: 'index',
    adminMemo: '앱 홈 상단 배너와 이벤트 탭 동시 노출',
    createdAt: '2026-03-15',
    updatedAt: '2026-03-22 10:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'EVT-002',
    title: '친구 초대 리워드 캠페인',
    summary: '친구 초대 성공 시 쿠폰을 지급하는 시즌 프로모션입니다.',
    bodyHtml:
      '<h2>친구 초대 리워드 캠페인</h2><p>친구가 초대 링크를 통해 가입하고 첫 학습을 완료하면 쿠폰을 지급합니다.</p><ol><li>친구에게 전용 링크를 공유합니다.</li><li>친구가 가입 후 첫 학습을 완료합니다.</li><li>조건 충족 시 15% 할인 쿠폰이 자동 발급됩니다.</li></ol>',
    slug: '친구-초대-리워드-캠페인',
    eventType: '프로모션',
    progressStatus: '예정',
    visibilityStatus: '예약',
    startAt: '2026-04-01',
    endAt: '2026-04-20',
    exposureChannels: ['웹 홈', '이벤트 탭'],
    targetGroupId: 'SEG-REF-APR',
    targetGroupName: '초대 링크 보유 회원',
    participantCount: 0,
    participantLimit: 3000,
    rewardType: '쿠폰',
    rewardPolicyId: 'COUPON-APR-15',
    rewardPolicyName: '친구 초대 15% 쿠폰',
    rewardPolicySummary: '쿠폰 · 친구 초대 15% 쿠폰',
    bannerImageUrl: 'https://images.example.com/events/referral-april.png',
    landingUrl: '/events/referral-april',
    messageTemplateName: '친구 초대 이벤트 메일',
    metaTitle: '친구 초대 리워드 캠페인',
    metaDescription: '친구 초대 성공 시 사용할 수 있는 할인 쿠폰 이벤트입니다.',
    ogImageUrl: 'https://images.example.com/events/referral-april-og.png',
    canonicalUrl: '/events/referral-april',
    indexingPolicy: 'index',
    adminMemo: '4월 1일 09:00 자동 노출 예정',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-22 17:10',
    updatedBy: 'admin_kim'
  },
  {
    id: 'EVT-003',
    title: 'TOPIK 응시 챌린지',
    summary: '응시 완료 회원에게 배지를 지급한 시즌 챌린지입니다.',
    bodyHtml:
      '<h2>TOPIK 응시 챌린지</h2><p>TOPIK 응시를 완료한 회원에게 완주 배지를 지급했던 시즌 챌린지입니다.</p><p>현재는 종료되어 신규 참여는 불가하며, 기존 참여 이력과 보상 내역만 보관합니다.</p>',
    slug: 'topik-응시-챌린지',
    eventType: '챌린지',
    progressStatus: '종료',
    visibilityStatus: '숨김',
    startAt: '2026-02-01',
    endAt: '2026-02-28',
    exposureChannels: ['이벤트 탭'],
    targetGroupId: 'SEG-TOPIK-ALL',
    targetGroupName: 'TOPIK 응시 회원',
    participantCount: 642,
    participantLimit: null,
    rewardType: '배지',
    rewardPolicyId: 'BADGE-TOPIK-001',
    rewardPolicyName: 'TOPIK 챌린지 완주 배지',
    rewardPolicySummary: '배지 · TOPIK 챌린지 완주 배지',
    bannerImageUrl: 'https://images.example.com/events/topik-challenge.png',
    landingUrl: '/events/topik-challenge',
    messageTemplateName: 'TOPIK 챌린지 결과 안내',
    metaTitle: 'TOPIK 응시 챌린지',
    metaDescription: 'TOPIK 응시 회원을 위한 시즌 챌린지와 배지 지급 기록입니다.',
    ogImageUrl: 'https://images.example.com/events/topik-challenge-og.png',
    canonicalUrl: '/events/topik-challenge',
    indexingPolicy: 'noindex',
    adminMemo: '종료 후 이력 보관용. 노출 재개 계획 없음.',
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
        nextStatus === '비공개'
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
    const bannerImageUrl = normalizeText(payload.bannerImageUrl);
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
        target?.progressStatus === '종료'
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
      bannerImageUrl,
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
      visibilityStatus: '노출',
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
      progressStatus: '종료',
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
