import { Button, Space, Spin, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

import {
  messageGroupDefinitionTypeFilterValues,
  messageGroupStatusFilterValues
} from '../model/message-groups-page-schema';
import type { MessageGroup } from '../model/types';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

// 대상 그룹 목록 컬럼 — Phase 4 분해로 페이지 useMemo 본문에서 이동(동작 동일).
// 재계산 진행 상태와 행 조치 핸들러는 페이지가 소유하고 인자로 받는다.
export type MessageGroupColumnsContext = {
  recalculatingGroupId: string | null;
  onRecalculate: (group: MessageGroup) => void;
  onDelete: (group: MessageGroup) => void;
};

export function createMessageGroupColumns({
  recalculatingGroupId,
  onRecalculate,
  onDelete
}: MessageGroupColumnsContext): TableColumnsType<MessageGroup> {
  return [
    {
      title: '그룹 이름',
      dataIndex: 'name',
      width: 180,
      sorter: createTextSorter((record) => record.name)
    },
    {
      title: '설명',
      dataIndex: 'description',
      width: 260,
      ellipsis: true,
      sorter: createTextSorter((record) => record.description)
    },
    {
      title: '정의 방식',
      dataIndex: 'definitionType',
      width: 130,
      ...createDefinedColumnFilterProps(
        messageGroupDefinitionTypeFilterValues,
        (record) => record.definitionType
      ),
      sorter: createTextSorter((record) => record.definitionType)
    },
    {
      title: '조건 요약',
      dataIndex: 'ruleSummary',
      ellipsis: true,
      sorter: createTextSorter((record) => record.ruleSummary)
    },
    {
      title: '예상 대상 수',
      dataIndex: 'memberCount',
      width: 130,
      sorter: createNumberSorter((record) => record.memberCount),
      render: (value: number, record) => (
        <div className="message-groups-count-cell">
          <div className="message-groups-count-value-wrap">
            <span
              className={
                recalculatingGroupId === record.id
                  ? 'message-groups-count-value message-groups-count-value--muted'
                  : 'message-groups-count-value'
              }
            >
              {value.toLocaleString()}명
            </span>
            {recalculatingGroupId === record.id ? (
              <Spin size="small" className="message-groups-count-spinner" />
            ) : null}
          </div>
        </div>
      )
    },
    {
      title: createStatusColumnTitle('상태', ['사용중', '초안']),
      dataIndex: 'status',
      width: 100,
      ...createDefinedColumnFilterProps(
        messageGroupStatusFilterValues,
        (record) => record.status
      ),
      sorter: createTextSorter((record) => record.status),
      render: (status: string) => <StatusBadge status={status} />
    },
    {
      title: '작업',
      key: 'actions',
      width: 132,
      onCell: () => ({
        onClick: (event) => {
          event.stopPropagation();
        }
      }),
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="대상 수 재계산">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              loading={recalculatingGroupId === record.id}
              onClick={() => void onRecalculate(record)}
            />
          </Tooltip>
          <Tooltip title="그룹 삭제">
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => onDelete(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];
}
