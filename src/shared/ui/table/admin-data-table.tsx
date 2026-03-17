import { Table } from 'antd';
import type { TableProps } from 'antd';

export function AdminDataTable<RecordType extends object>(
  props: TableProps<RecordType>
): JSX.Element {
  const {
    className,
    loading,
    size = 'small',
    showSorterTooltip = false,
    ...rest
  } = props;

  const normalizedLoading =
    typeof loading === 'boolean'
      ? loading
        ? { spinning: true }
        : false
      : loading
        ? { ...loading }
        : loading;

  const isLoading =
    typeof normalizedLoading === 'boolean'
      ? normalizedLoading
      : Boolean(normalizedLoading?.spinning);

  const tableClassName = [
    className,
    'admin-data-table',
    isLoading ? 'admin-data-table--loading' : null
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Table<RecordType>
      className={tableClassName}
      loading={normalizedLoading}
      showSorterTooltip={showSorterTooltip}
      size={size}
      {...rest}
    />
  );
}
