import type { SortOrder } from 'antd/es/table/interface';
import type { Key } from 'react';

type Primitive = string | number;

type AccessorValue = Primitive | readonly Primitive[] | null | undefined;

type Accessor<RecordType> = (record: RecordType) => AccessorValue;

function normalizeValue(value: Primitive | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function normalizeValues(value: AccessorValue): string[] {
  // `Array.isArray` 는 `readonly T[]` 를 좁히지 못해 else 분기에 배열 타입이 남는다.
  // 배열 여부를 먼저 분기한 값으로 다시 넘기지 않고 지역 변수로 좁힌다.
  if (Array.isArray(value)) {
    const items = value as readonly Primitive[];
    return items.map((item) => normalizeValue(item)).filter(Boolean);
  }

  const normalized = normalizeValue(value as Primitive | null | undefined);
  return normalized ? [normalized] : [];
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, 'ko-KR', {
    numeric: true,
    sensitivity: 'base'
  });
}

function parseNumericValue(value: Primitive | null | undefined): number {
  const normalized = normalizeValue(value);
  const numeric = Number(normalized.replace(/[^0-9.-]/g, ''));

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return 0;
}

export function createDefinedColumnFilterProps<RecordType>(
  values: readonly Primitive[],
  accessor: Accessor<RecordType>
): {
  filters: { text: string; value: string }[];
  // antd 의 `ColumnType.onFilter` 는 `(value: React.Key | boolean, ...)` 를 넘긴다.
  // React 19 타입의 `Key` 에는 `bigint` 가 포함되므로 파라미터를 `string | number | boolean`
  // 으로 좁히면 반공변성 위반으로 컬럼 배열 전체가 `ColumnType` 에 할당되지 않는다.
  onFilter: (value: Key | boolean, record: RecordType) => boolean;
} {
  const uniqueValues = Array.from(
    new Set(values.map((value) => normalizeValue(value)).filter(Boolean))
  ).sort(compareText);

  return {
    filters: uniqueValues.map((value) => ({
      text: value,
      value
    })),
    onFilter: (value, record) =>
      normalizeValues(accessor(record)).includes(String(value))
  };
}

export function createTextSorter<RecordType>(
  accessor: (record: RecordType) => Primitive | null | undefined
): (left: RecordType, right: RecordType) => number {
  return (left, right) =>
    compareText(normalizeValue(accessor(left)), normalizeValue(accessor(right)));
}

export function createNumberSorter<RecordType>(
  accessor: (record: RecordType) => number | null | undefined
): (left: RecordType, right: RecordType) => number {
  return (left, right) => (accessor(left) ?? 0) - (accessor(right) ?? 0);
}

export function createNumericTextSorter<RecordType>(
  accessor: (record: RecordType) => Primitive | null | undefined
): (left: RecordType, right: RecordType) => number {
  return (left, right) => {
    const difference =
      parseNumericValue(accessor(left)) - parseNumericValue(accessor(right));

    if (difference !== 0) {
      return difference;
    }

    return compareText(normalizeValue(accessor(left)), normalizeValue(accessor(right)));
  };
}

// URL 쿼리/antd sorter 값을 SortOrder 로 정규화한다 — 페이지 7곳에 복제돼 있던
// 동일 본문을 통합(도메인 별칭 PointSortOrder·CouponSortOrder 도 같은 유니온이다).
export function parseSortOrder(
  value: string | SortOrder | null | undefined
): SortOrder | null {
  return value === 'ascend' || value === 'descend' ? value : null;
}
