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
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item)).filter(Boolean);
  }

  const normalized = normalizeValue(value);
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
  onFilter: (value: string | number | boolean, record: RecordType) => boolean;
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
