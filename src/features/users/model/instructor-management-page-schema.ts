import {
  defaultInstructorQuery
} from './instructors-query-store';
import type {
  InstructorDetail,
  InstructorQuery,
  InstructorSearchField
} from './types';
import { parseSearchDate } from '@/shared/ui/search-bar/search-bar-utils';
import {
  matchesSearchDateRange,
  matchesSearchField
} from '@/shared/ui/search-bar/search-bar-utils';

// 강사 관리 페이지의 URL 파서·필터·조치 상수 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

export const instructorPageSizeOptions = ['20', '50', '100'];
export const instructorStatusFilterValues = ['정상', '정지', '탈퇴'] as const;

export const instructorSearchFieldOptions: {
  label: string;
  value: InstructorSearchField;
}[] = [
  { label: '전체', value: 'all' },
  { label: '강사 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일', value: 'email' },
  { label: '소속', value: 'organization' },
  { label: '대상 그룹', value: 'messageGroupName' }
];

export type InstructorActionState =
  | { type: 'suspend'; instructor: InstructorDetail }
  | { type: 'unsuspend'; instructor: InstructorDetail }
  | null;

function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseInstructorSearchField(value: string | null): InstructorSearchField {
  if (
    value === 'id' ||
    value === 'realName' ||
    value === 'email' ||
    value === 'organization' ||
    value === 'messageGroupName'
  ) {
    return value;
  }
  return defaultInstructorQuery.searchField;
}

export function parseInstructorQuery(searchParams: URLSearchParams): InstructorQuery {
  return {
    page: parsePositiveNumber(
      searchParams.get('page'),
      defaultInstructorQuery.page
    ),
    pageSize: parsePositiveNumber(
      searchParams.get('pageSize'),
      defaultInstructorQuery.pageSize
    ),
    sort: defaultInstructorQuery.sort,
    status: defaultInstructorQuery.status,
    activityStatus: defaultInstructorQuery.activityStatus,
    country: defaultInstructorQuery.country,
    organization: defaultInstructorQuery.organization,
    searchField: parseInstructorSearchField(searchParams.get('searchField')),
    startDate: parseSearchDate(searchParams.get('startDate')),
    endDate: parseSearchDate(searchParams.get('endDate')),
    keyword: searchParams.get('keyword') ?? ''
  };
}

export function buildInstructorSearchParams(
  query: InstructorQuery,
  selectedId?: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.searchField !== 'all') {
    params.set('searchField', query.searchField);
  }
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  if (query.endDate) {
    params.set('endDate', query.endDate);
  }
  if (query.keyword.trim()) {
    params.set('keyword', query.keyword.trim());
  }
  if (selectedId) {
    params.set('selected', selectedId);
  }

  return params;
}

export function filterInstructors(
  instructors: InstructorDetail[],
  query: InstructorQuery
): InstructorDetail[] {
  const keyword = query.keyword.trim().toLowerCase();

  const filtered = instructors.filter((item) => {
    if (
      !matchesSearchDateRange(item.lastActivityAt, query.startDate, query.endDate)
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      id: item.id,
      realName: item.realName,
      email: item.email,
      organization: item.organization,
      messageGroupName: item.messageGroupName
    });
  });

  return [...filtered].sort((left, right) => {
    if (query.sort === 'students-desc') {
      return right.studentCount - left.studentCount;
    }
    if (query.sort === 'courses-desc') {
      return right.courseCount - left.courseCount;
    }
    return right.lastActivityAt.localeCompare(left.lastActivityAt);
  });
}

export function formatCurrentDateTime(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

export function summarizeNoteContent(content: string, maxLength = 52): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trimEnd()}...`;
}
