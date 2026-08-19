import { Button, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import { Link } from 'react-router-dom';

import {
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent
} from '../model/types';
import type { EventSortField } from '../model/operation-events-page-schema';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

// 이벤트 목록 컬럼 정의 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// URL 동기화 상태(sort/filter)와 핸들러는 페이지가 소유하고 인자로 받는다.
export type OperationEventColumnsOptions = {
  sortField: EventSortField | null;
  sortOrder: SortOrder | null;
  eventTypeFilter: OperationEvent['eventType'] | null;
  visibilityStatusFilter: OperationEvent['visibilityStatus'] | null;
  listSearch: string;
  onPreview: (event: OperationEvent) => void;
};

export function createOperationEventColumns({
  sortField,
  sortOrder,
  eventTypeFilter,
  visibilityStatusFilter,
  listSearch,
  onPreview
}: OperationEventColumnsOptions): TableColumnsType<OperationEvent> {
  return [
    {
      title: '이벤트 ID',
      dataIndex: 'id',
      width: 132,
      sorter: createTextSorter((record) => record.id),
      sortOrder: sortField === 'id' ? sortOrder : null,
      render: (value: string, record) => (
        <Link
          className="table-navigation-link"
          to={`/operation/events/create/${record.id}${listSearch}`}
          onClick={(event) => event.stopPropagation()}
        >
          {value}
        </Link>
      )
    },
    {
      title: '이벤트명',
      dataIndex: 'title',
      width: 280,
      sorter: createTextSorter((record) => record.title),
      sortOrder: sortField === 'title' ? sortOrder : null
    },
    {
      title: '유형',
      dataIndex: 'eventType',
      width: 118,
      filteredValue: eventTypeFilter ? [eventTypeFilter] : null,
      ...createDefinedColumnFilterProps(operationEventTypeValues, (record) => record.eventType),
      sorter: createTextSorter((record) => record.eventType),
      sortOrder: sortField === 'eventType' ? sortOrder : null,
      render: (value: OperationEvent['eventType']) => <Tag color="blue">{value}</Tag>
    },
    {
      title: '진행 기간',
      dataIndex: 'startAt',
      width: 210,
      sorter: createTextSorter((record) => `${record.startAt}-${record.endAt}`),
      sortOrder: sortField === 'startAt' ? sortOrder : null,
      render: (_, record) => `${record.startAt} ~ ${record.endAt}`
    },
    {
      title: createStatusColumnTitle('노출 상태', operationEventVisibilityStatusValues),
      dataIndex: 'visibilityStatus',
      width: 118,
      filteredValue: visibilityStatusFilter ? [visibilityStatusFilter] : null,
      ...createDefinedColumnFilterProps(
        operationEventVisibilityStatusValues,
        (record) => record.visibilityStatus
      ),
      sorter: createTextSorter((record) => record.visibilityStatus),
      sortOrder: sortField === 'visibilityStatus' ? sortOrder : null,
      render: (value: OperationEvent['visibilityStatus']) => <StatusBadge status={value} />
    },
    {
      title: '참여자 수',
      dataIndex: 'participantCount',
      width: 130,
      render: (_, record) =>
        record.participantLimit
          ? `${record.participantCount.toLocaleString()} / ${record.participantLimit.toLocaleString()}`
          : `${record.participantCount.toLocaleString()}명`
    },
    {
      title: '보상 정책',
      dataIndex: 'rewardPolicySummary',
      width: 220,
      ellipsis: true
    },
    {
      title: '최근 수정일',
      dataIndex: 'updatedAt',
      width: 150,
      sorter: createTextSorter((record) => record.updatedAt),
      sortOrder: sortField === 'updatedAt' ? sortOrder : null
    },
    {
      title: '최근 수정자',
      dataIndex: 'updatedBy',
      width: 130
    },
    {
      title: '액션',
      key: 'actions',
      width: 96,
      onCell: () => ({
        onClick: (event) => {
          event.stopPropagation();
        }
      }),
      render: (_, record) => (
        <Button type="link" onClick={() => onPreview(record)}>
          미리보기
        </Button>
      )
    }
  ];
}
