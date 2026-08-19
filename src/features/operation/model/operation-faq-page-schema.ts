import type { TabsProps } from 'antd';
import {
  matchesSearchDateRange,
  matchesSearchField
} from '@/shared/ui/search-bar/search-bar-utils';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import type { AsyncState } from '@/shared/model/async-state';
import type {
  OperationFaq,
  OperationFaqCategory,
  OperationFaqCuration,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqMetric,
  OperationFaqStatus
} from './types';
import { getFaqExposureSurfaceLabel } from './faq-schema';

// FAQ 3탭(마스터·노출 큐레이션·지표) 화면의 순수 스키마 — Phase 4 분해로 이동(동작 동일).
// 조회 상태·조치/저장 핸들러·폼 인스턴스는 페이지가 소유한다.

export type TabKey = 'master' | 'curation' | 'metrics';

export const tabItems: TabsProps['items'] = [
  { key: 'master', label: 'FAQ 마스터' },
  { key: 'curation', label: '노출 관리' },
  { key: 'metrics', label: '지표 보기' }
];

export const masterSearchFieldValues = [
  'all',
  'id',
  'question',
  'answer',
  'searchKeywords'
] as const;

export const masterSortFieldValues = [
  'id',
  'question',
  'category',
  'updatedAt',
  'status'
] as const;

export const curationSearchFieldValues = [
  'all',
  'id',
  'faqId',
  'question',
  'surface'
] as const;

export const curationSortFieldValues = [
  'id',
  'surface',
  'displayRank',
  'updatedAt',
  'exposureStatus'
] as const;

export const metricSearchFieldValues = [
  'all',
  'faqId',
  'question',
  'searchKeywords'
] as const;

export const metricSortFieldValues = [
  'faqId',
  'viewCount',
  'searchHitCount',
  'helpfulCount',
  'notHelpfulCount',
  'lastViewedAt'
] as const;

export type FaqPageParamKey =
  | 'tab'
  | 'keyword'
  | 'searchField'
  | 'startDate'
  | 'endDate'
  | 'status'
  | 'category'
  | 'sortField'
  | 'sortOrder'
  | 'selected'
  | 'curationKeyword'
  | 'curationSearchField'
  | 'curationSurface'
  | 'curationMode'
  | 'curationExposureStatus'
  | 'curationSortField'
  | 'curationSortOrder'
  | 'curationSelected'
  | 'metricKeyword'
  | 'metricSearchField'
  | 'metricSortField'
  | 'metricSortOrder';

export type FaqFormValues = {
  question: string;
  answer: string;
  searchKeywordsText: string;
  category: OperationFaqCategory;
  status: OperationFaqStatus;
};

export type CurationFormValues = {
  faqId: string;
  surface: OperationFaqExposureSurface;
  curationMode: OperationFaqCurationMode;
  displayRank: number;
  exposureStatus: OperationFaqCurationStatus;
  pinnedDateRange?: [Dayjs | null, Dayjs | null];
};

export type FaqEditorState =
  | { type: 'create' }
  | { type: 'edit'; faq: OperationFaq }
  | null;

export type CurationEditorState =
  | { type: 'create'; faqId?: string }
  | { type: 'edit'; curation: OperationFaqCuration }
  | null;

export type DangerState =
  | { type: 'deleteFaq'; faq: OperationFaq }
  | {
      type: 'toggleFaqStatus';
      faq: OperationFaq;
      nextStatus: OperationFaqStatus;
    }
  | { type: 'deleteCuration'; curation: OperationFaqCuration }
  | {
      type: 'toggleCurationStatus';
      curation: OperationFaqCuration;
      nextStatus: OperationFaqCurationStatus;
    }
  | null;

export type FaqCurationRow = OperationFaqCuration & {
  faq: OperationFaq | null;
};

export type FaqMetricRow = OperationFaqMetric & {
  faq: OperationFaq | null;
};

export function createInitialAsyncState<T>(data: T): AsyncState<T> {
  return {
    status: 'pending',
    data,
    errorMessage: null,
    errorCode: null
  };
}

export function parseTab(value: string | null): TabKey {
  if (value === 'curation' || value === 'metrics') {
    return value;
  }
  return 'master';
}

export function parseValue<T extends readonly string[]>(
  value: string | null,
  candidates: T
): T[number] | null {
  if (!value) {
    return null;
  }

  return candidates.includes(value) ? value : null;
}

export function joinKeywords(keywords: string[]): string {
  return keywords.join(', ');
}

export function parseKeywords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function formatPinnedDateRange(
  startAt: string | null,
  endAt: string | null
): string {
  if (!startAt && !endAt) {
    return '상시';
  }

  if (startAt && endAt) {
    return `${startAt} ~ ${endAt}`;
  }

  if (startAt) {
    return `${startAt}부터`;
  }

  return `${endAt ?? '-'}까지`;
}

export function formatMetricRatio(metric: OperationFaqMetric | null): string {
  if (!metric) {
    return '-';
  }

  const denominator = metric.helpfulCount + metric.notHelpfulCount;
  if (denominator === 0) {
    return '0%';
  }

  return `${Math.round((metric.helpfulCount / denominator) * 100)}%`;
}

export function getCurationStatusTagColor(status: OperationFaqCurationStatus): string {
  return status === 'active' ? 'green' : 'default';
}

export function getCurationModeTagColor(mode: OperationFaqCurationMode): string {
  return mode === 'manual' ? 'blue' : 'purple';
}

export function buildFaqFormValues(faq?: OperationFaq): FaqFormValues {
  return {
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    searchKeywordsText: faq ? joinKeywords(faq.searchKeywords) : '',
    category: faq?.category ?? '계정',
    status: faq?.status ?? '공개'
  };
}

export function buildCurationFormValues(
  curation?: OperationFaqCuration,
  faqId?: string
): CurationFormValues {
  return {
    faqId: curation?.faqId ?? faqId ?? '',
    surface: curation?.surface ?? 'help_center',
    curationMode: curation?.curationMode ?? 'manual',
    displayRank: curation?.displayRank ?? 1,
    exposureStatus: curation?.exposureStatus ?? 'active',
    pinnedDateRange:
      curation?.pinnedStartAt || curation?.pinnedEndAt
        ? [
            curation?.pinnedStartAt ? dayjs(curation.pinnedStartAt) : null,
            curation?.pinnedEndAt ? dayjs(curation.pinnedEndAt) : null
          ]
        : undefined
  };
}


// 아래는 페이지 useMemo 본문을 그대로 옮긴 순수 필터/빌더다(입력은 인자로).
export function filterVisibleFaqs(
  faqs: OperationFaq[],
  {
    faqStatusFilter,
    faqCategoryFilter,
    startDate,
    endDate,
    keyword,
    masterSearchField
  }: {
    faqStatusFilter: OperationFaqStatus | null;
    faqCategoryFilter: OperationFaqCategory | null;
    startDate: string;
    endDate: string;
    keyword: string;
    masterSearchField: string;
  }
): OperationFaq[] {
  return faqs.filter((faq) => {
    if (faqStatusFilter && faq.status !== faqStatusFilter) {
      return false;
    }

    if (faqCategoryFilter && faq.category !== faqCategoryFilter) {
      return false;
    }

    if (!matchesSearchDateRange(faq.updatedAt, startDate, endDate)) {
      return false;
    }

    return matchesSearchField(keyword, masterSearchField, {
      id: faq.id,
      question: faq.question,
      answer: faq.answer,
      searchKeywords: faq.searchKeywords
    });
  });
}

export function filterVisibleCurations(
  curationRows: FaqCurationRow[],
  {
    curationSurfaceFilter,
    curationModeFilter,
    curationExposureStatusFilter,
    curationKeyword,
    curationSearchField
  }: {
    curationSurfaceFilter: OperationFaqExposureSurface | null;
    curationModeFilter: OperationFaqCurationMode | null;
    curationExposureStatusFilter: OperationFaqCurationStatus | null;
    curationKeyword: string;
    curationSearchField: string;
  }
): FaqCurationRow[] {
  return curationRows.filter((curation) => {
    if (curationSurfaceFilter && curation.surface !== curationSurfaceFilter) {
      return false;
    }

    if (curationModeFilter && curation.curationMode !== curationModeFilter) {
      return false;
    }

    if (
      curationExposureStatusFilter &&
      curation.exposureStatus !== curationExposureStatusFilter
    ) {
      return false;
    }

    return matchesSearchField(curationKeyword, curationSearchField, {
      id: curation.id,
      faqId: curation.faqId,
      question: curation.faq?.question ?? '',
      surface: getFaqExposureSurfaceLabel(curation.surface)
    });
  });
}

export function filterVisibleMetrics(
  metricRows: FaqMetricRow[],
  { metricKeyword, metricSearchField }: { metricKeyword: string; metricSearchField: string }
): FaqMetricRow[] {
  return metricRows.filter((metric) =>
    matchesSearchField(metricKeyword, metricSearchField, {
      faqId: metric.faqId,
      question: metric.faq?.question ?? '',
      searchKeywords: metric.faq?.searchKeywords ?? []
    })
  );
}

export function buildFaqSummaryCards({
  totalFaqCount,
  publicFaqCount,
  activeCurationCount,
  totalViewCount
}: {
  totalFaqCount: number;
  publicFaqCount: number;
  activeCurationCount: number;
  totalViewCount: number;
}) {
  return [
  {
    key: 'all-faqs',
    label: '전체 FAQ',
    value: `${totalFaqCount.toLocaleString()}건`
  },
  {
    key: 'public-faqs',
    label: '공개 FAQ',
    value: `${publicFaqCount.toLocaleString()}건`
  },
  {
    key: 'active-curations',
    label: '활성 노출',
    value: `${activeCurationCount.toLocaleString()}건`
  },
  {
    key: 'faq-views',
    label: '누적 조회수',
    value: `${totalViewCount.toLocaleString()}회`
  }
];
}
