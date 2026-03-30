import { Descriptions, Modal } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useMemo } from 'react';

type DetailRecord = Record<string, unknown>;

type TableRowDetailModalProps = {
  open: boolean;
  title: string;
  record: DetailRecord | null;
  labelMap?: Record<string, string>;
  onClose: () => void;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '-';
    }
    return value
      .map((item) =>
        typeof item === 'object' ? JSON.stringify(item) : String(item)
      )
      .join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function TableRowDetailModal({
  open,
  title,
  record,
  labelMap,
  onClose
}: TableRowDetailModalProps): JSX.Element {
  const items = useMemo<DescriptionsProps['items']>(() => {
    if (!record) {
      return [];
    }

    return Object.entries(record).map(([key, value]) => ({
      key,
      label: labelMap?.[key] ?? key,
      children: formatValue(value)
    }));
  }, [labelMap, record]);

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      <Descriptions bordered size="small" column={1} items={items} />
    </Modal>
  );
}
