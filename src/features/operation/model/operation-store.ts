import { create } from 'zustand';

import {
  createInitialOperationEvents,
  createInitialOperationFaqCurations,
  createInitialOperationFaqMetrics,
  createInitialOperationFaqs,
  createInitialOperationNotices
} from '../api/mock-operation';
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
import { formatNowMinutes as formatNow, toDateOnly as toDateString } from '@/shared/model/date-format';

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

export const useOperationStore = create<OperationStore>((set, get) => ({
  notices: createInitialOperationNotices(),
  faqs: createInitialOperationFaqs(),
  faqCurations: createInitialOperationFaqCurations(),
  faqMetrics: createInitialOperationFaqMetrics(),
  events: createInitialOperationEvents(),
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
