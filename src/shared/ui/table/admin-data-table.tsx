import { Table } from 'antd';
import type { TableProps } from 'antd';

export function AdminDataTable<RecordType extends object>(
  props: TableProps<RecordType>
): JSX.Element {
  const { size = 'small', showSorterTooltip = false, ...rest } = props;

  return <Table<RecordType> showSorterTooltip={showSorterTooltip} size={size} {...rest} />;
}
