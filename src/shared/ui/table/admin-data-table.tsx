import { Table } from 'antd';
import type { TableProps } from 'antd';

export function AdminDataTable<RecordType extends object>(
  props: TableProps<RecordType>
): JSX.Element {
  const { size = 'small', ...rest } = props;

  return <Table<RecordType> size={size} {...rest} />;
}
