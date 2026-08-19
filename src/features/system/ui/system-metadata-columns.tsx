import { Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { DragEvent as ReactDragEvent } from 'react';

import {
  EXPOSURE_LABELS,
  HISTORY_ACTION_LABELS,
  STATUS_LABELS,
  SUMMARY_FILTER_LABELS,
  SYNC_LABELS,
  TEXT,
  getExposureStatusColor,
  getItemPreviewText,
  getPreviewText,
  getSettingCategory,
  getSyncStatusColor
} from '../model/system-metadata-page-schema';
import type { StatusActionState } from '../model/system-metadata-page-schema';
import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataStatus,
  SystemMetadataGroup,
  SystemMetadataHistoryEntry,
  SystemMetadataItem
} from '../model/system-metadata-types';
import { MetadataItemDragHandle } from './system-metadata-tree';
import { createHelpLabel } from './system-metadata-render-utils';
import { BinaryStatusSwitch } from '@/shared/ui/table/binary-status-switch';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import { createTextSorter } from '@/shared/ui/table/table-column-utils';

const { Text } = Typography;

// 운영 설정 목록/운영 값/변경 이력 컬럼 — Phase 4 분해로 페이지 useMemo 본문에서
// 이동(동작 동일). 조치 핸들러·선택 그룹·재정렬 상태는 페이지가 소유하고 인자로 받는다.
export type MetadataGroupColumnsContext = {
  openDrawer: (groupId: string) => void;
  openEditGroupModal: (group: SystemMetadataGroup) => void;
  openCreateItemModal: (groupId: string) => void;
  setStatusActionState: (next: StatusActionState) => void;
};

export function createMetadataGroupColumns({
  openDrawer,
  openEditGroupModal,
  openCreateItemModal,
  setStatusActionState
}: MetadataGroupColumnsContext): TableColumnsType<SystemMetadataGroup> {
  return [
    {
      title: '설정',
      key: 'setting',
      width: 240,
      sorter: createTextSorter((record) => record.groupName),
      render: (_, record) => <Text strong>{record.groupName}</Text>
    },
    {
      title: createHelpLabel(
        '소속 기능',
        '이 설정이 어떤 운영 업무 영역에서 쓰이는지 보여줍니다.'
      ),
      key: 'feature',
      width: 140,
      render: (_, record) => (
        <Tag color="blue">{SUMMARY_FILTER_LABELS[getSettingCategory(record)]}</Tag>
      )
    },
    {
      title: createHelpLabel(
        '운영 값',
        '현재 운영 중인 선택지와 상태 값의 요약입니다.'
      ),
      key: 'itemPreview',
      width: 220,
      render: (_, record) => <Text>{getItemPreviewText(record.items)}</Text>
    },
    {
      title: createHelpLabel(
        '사용자 영향',
        '확인됨은 실제 사용자 화면 연결이 검증된 상태이고, 운영상 추정은 연결 가능성은 있으나 문서나 화면 확인이 끝나지 않은 상태입니다.'
      ),
      key: 'impact',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Tag color={getExposureStatusColor(record.exposureStatus)}>
            {EXPOSURE_LABELS[record.exposureStatus]}
          </Tag>
          <Text type="secondary">
            {record.linkedUserSurfaces.length > 0
              ? getPreviewText(record.linkedUserSurfaces)
              : '내부 운영에만 영향'}
          </Text>
        </Space>
      )
    },
    {
      title: createHelpLabel(
        '운영 상태',
        '활성 여부와 현재 검토 상태를 함께 보여줍니다.'
      ),
      key: 'statusSummary',
      width: 160,
      onCell: () => ({ onClick: (event) => event.stopPropagation() }),
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <BinaryStatusSwitch
            checked={record.status === 'active'}
            checkedLabel={TEXT.active}
            uncheckedLabel={TEXT.inactive}
            onToggle={() =>
              setStatusActionState({
                target: 'group',
                group: record,
                nextStatus: record.status === 'active' ? 'inactive' : 'active'
              })
            }
          />
          <Tag color={getSyncStatusColor(record.syncStatus)}>{SYNC_LABELS[record.syncStatus]}</Tag>
        </Space>
      )
    },
    {
      title: '최근 수정',
      dataIndex: 'updatedAt',
      width: 180,
      sorter: createTextSorter((record) => record.updatedAt),
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Text>{record.updatedAt}</Text>
          <Text type="secondary">{record.updatedBy}</Text>
        </Space>
      )
    },
    {
      title: '액션',
      key: 'action',
      width: 90,
      onCell: () => ({ onClick: (event) => event.stopPropagation() }),
      render: (_, record) => (
        <TableActionMenu
          items={[
            { key: `open-${record.groupId}`, label: '상세 보기', onClick: () => openDrawer(record.groupId) },
            { key: `edit-${record.groupId}`, label: TEXT.editGroup, onClick: () => openEditGroupModal(record) },
            { key: `item-${record.groupId}`, label: TEXT.createItem, onClick: () => openCreateItemModal(record.groupId) },
            {
              key: `toggle-${record.groupId}`,
              label: record.status === 'active' ? '설정 비활성화' : '설정 활성화',
              danger: record.status === 'active',
              onClick: () =>
                setStatusActionState({
                  target: 'group',
                  group: record,
                  nextStatus: record.status === 'active' ? 'inactive' : 'active'
                })
            }
          ]}
        />
      )
    }
  ];
}

export type MetadataItemColumnsContext = {
  selectedGroup: SystemMetadataGroup | null;
  reorderingItems: boolean;
  handleItemDragStart: (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  resetItemDragState: () => void;
  openEditItemModal: (groupId: string, item: SystemMetadataItem) => void;
  openDeleteItemConfirm: (group: SystemMetadataGroup, item: SystemMetadataItem) => void;
  setStatusActionState: (next: StatusActionState) => void;
};

export function createMetadataItemColumns({
  selectedGroup,
  reorderingItems,
  handleItemDragStart,
  resetItemDragState,
  openEditItemModal,
  openDeleteItemConfirm,
  setStatusActionState
}: MetadataItemColumnsContext): TableColumnsType<SystemMetadataItem> {
  return [
    {
      title: '',
      key: 'drag',
      width: 48,
      onCell: () => ({ onClick: (event) => event.stopPropagation() }),
      render: (_, record) => (
        <MetadataItemDragHandle
          itemId={record.itemId}
          disabled={reorderingItems}
          onDragStart={handleItemDragStart}
          onDragEnd={resetItemDragState}
        />
      )
    },
    { title: '운영 값 코드', dataIndex: 'code', width: 140 },
    { title: '운영 값', dataIndex: 'label', width: 160 },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      render: (value: MetadataStatus) => (
        <Tag color={value === 'active' ? 'green' : 'default'}>{STATUS_LABELS[value]}</Tag>
      )
    },
    {
      title: '사용자 영향',
      dataIndex: 'exposureStatus',
      width: 120,
      render: (value: MetadataExposureStatus) => (
        <Tag color={getExposureStatusColor(value)}>{EXPOSURE_LABELS[value]}</Tag>
      )
    },
    { title: '정렬', dataIndex: 'sortOrder', width: 80 },
    {
      title: TEXT.defaultValue,
      dataIndex: 'isDefault',
      width: 100,
      render: (value: boolean) =>
        value ? <Tag color="blue">{TEXT.defaultValue}</Tag> : <Text type="secondary">-</Text>
    },
    { title: '최근 수정', dataIndex: 'updatedAt', width: 160 },
    {
      title: '액션',
      key: 'action',
      width: 90,
      onCell: () => ({ onClick: (event) => event.stopPropagation() }),
      render: (_, record) =>
        selectedGroup ? (
          <TableActionMenu
            items={[
              { key: `edit-item-${record.itemId}`, label: TEXT.editItem, onClick: () => openEditItemModal(selectedGroup.groupId, record) },
              {
                key: `delete-item-${record.itemId}`,
                label: '운영 값 삭제',
                danger: true,
                onClick: () => openDeleteItemConfirm(selectedGroup, record)
              },
              {
                key: `toggle-item-${record.itemId}`,
                label: record.status === 'active' ? '운영 값 비활성화' : '운영 값 활성화',
                danger: record.status === 'active',
                onClick: () =>
                  setStatusActionState({
                    target: 'item',
                    group: selectedGroup,
                    item: record,
                    nextStatus: record.status === 'active' ? 'inactive' : 'active'
                  })
              }
            ]}
          />
        ) : null
    }
  ];
}

export function createMetadataHistoryColumns(): TableColumnsType<SystemMetadataHistoryEntry> {
  return [
    { title: '시각', dataIndex: 'createdAt', width: 170 },
    {
      title: '조치',
      dataIndex: 'action',
      width: 140,
      render: (value: MetadataHistoryAction) => HISTORY_ACTION_LABELS[value]
    },
    { title: '수정자', dataIndex: 'changedBy', width: 130 },
    { title: TEXT.reason, dataIndex: 'reason' }
  ];
}
