import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

type SearchableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SearchableValue[];

function flattenSearchableValue(value: SearchableValue): string {
  if (Array.isArray(value)) {
    return value.map((item) => flattenSearchableValue(item)).join(' ');
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value).toLowerCase();
}

export function matchesSearchField(
  keyword: string,
  searchField: string,
  values: Record<string, SearchableValue>
): boolean {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  if (searchField === 'all') {
    return Object.values(values).some((value) =>
      flattenSearchableValue(value).includes(normalizedKeyword)
    );
  }

  return flattenSearchableValue(values[searchField]).includes(normalizedKeyword);
}

export function parseSearchDate(value: string | null): string {
  if (!value) {
    return '';
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
}

export function matchesSearchDateRange(
  value: string | null | undefined,
  startDate: string,
  endDate: string
): boolean {
  if (!startDate && !endDate) {
    return true;
  }

  const target = dayjs(value);
  if (!target.isValid()) {
    return false;
  }

  if (startDate && target.isBefore(dayjs(startDate).startOf('day'))) {
    return false;
  }

  if (endDate && target.isAfter(dayjs(endDate).endOf('day'))) {
    return false;
  }

  return true;
}

export function toSearchPickerRange(
  startDate: string,
  endDate: string
): [Dayjs | null, Dayjs | null] {
  return [startDate ? dayjs(startDate) : null, endDate ? dayjs(endDate) : null];
}
