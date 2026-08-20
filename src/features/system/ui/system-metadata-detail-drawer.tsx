import { Alert, Button, Descriptions, Space, Tag, Tree, Typography } from 'antd';
import type { TreeProps } from 'antd';
import { EditOutlined, MinusSquareOutlined, PlusSquareOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';

import {
  DRAWER_TABLE_PAGINATION_WITH_HIDE,
  EXPOSURE_LABELS,
  MANAGER_TYPE_LABELS,
  MODULE_LABELS,
  STATUS_LABELS,
  SUMMARY_FILTER_LABELS,
  SYNC_LABELS,
  TEXT,
  buildDrawerGuideDescription,
  getDefaultItemLabels,
  getExposureStatusColor,
  getSettingCategory,
  getSyncStatusColor
} from '../model/system-metadata-page-schema';
import type { StatusActionState } from '../model/system-metadata-page-schema';
import type {
  SystemMetadataGroup,
  SystemMetadataHistoryEntry,
  SystemMetadataItem
} from '../model/system-metadata-types';
import {
  createMetadataHistoryColumns,
  createMetadataItemColumns
} from './system-metadata-columns';
import { createHelpLabel, renderValueList } from './system-metadata-render-utils';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DETAIL_DRAWER_WIDTH,
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { COLOR, SPACE } from '@/shared/styles/design-tokens';
import {
  createDrawerTableScroll,
  fixDrawerTableFirstColumn
} from '@/shared/ui/table/drawer-table';

const { Paragraph, Text } = Typography;

// 운영 설정 상세 Drawer — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 선택 그룹·트리 데이터·드래그 상태·조치 핸들러는 페이지가 소유해 props 로 전달하고,
// 운영 값/이력 컬럼 조립(팩토리 호출 + 첫 컬럼 고정)만 Drawer 내부에서 계산한다.
export type SystemMetadataDetailDrawerProps = {
  selectedGroup: SystemMetadataGroup | null;
  closeDrawer: () => void;
  openCreateItemModal: (groupId: string) => void;
  openEditGroupModal: (group: SystemMetadataGroup) => void;
  openEditItemModal: (groupId: string, item: SystemMetadataItem) => void;
  openDeleteItemConfirm: (group: SystemMetadataGroup, item: SystemMetadataItem) => void;
  setStatusActionState: (next: StatusActionState) => void;
  selectedGroupTreeData: NonNullable<TreeProps['treeData']>;
  handleSettingTreeSelect: NonNullable<TreeProps['onSelect']>;
  handleSettingTreeDrop: NonNullable<TreeProps['onDrop']>;
  reorderingItems: boolean;
  draggingItemId: string | null;
  dragOverItemId: string | null;
  setDragOverItemId: (next: string | null) => void;
  handleItemDrop: (targetItemId: string) => Promise<void>;
  handleItemDragStart: (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  resetItemDragState: () => void;
};

export function SystemMetadataDetailDrawer({
  selectedGroup,
  closeDrawer,
  openCreateItemModal,
  openEditGroupModal,
  openEditItemModal,
  openDeleteItemConfirm,
  setStatusActionState,
  selectedGroupTreeData,
  handleSettingTreeSelect,
  handleSettingTreeDrop,
  reorderingItems,
  draggingItemId,
  dragOverItemId,
  setDragOverItemId,
  handleItemDrop,
  handleItemDragStart,
  resetItemDragState
}: SystemMetadataDetailDrawerProps): JSX.Element {
  const itemColumns = useMemo(
    () =>
      createMetadataItemColumns({
        selectedGroup,
        reorderingItems,
        handleItemDragStart,
        resetItemDragState,
        openEditItemModal,
        openDeleteItemConfirm,
        setStatusActionState
      }),
    [
      handleItemDragStart,
      openDeleteItemConfirm,
      openEditItemModal,
      reorderingItems,
      resetItemDragState,
      selectedGroup,
      setStatusActionState
    ]
  );
  const historyColumns = useMemo(() => createMetadataHistoryColumns(), []);
  const drawerItemColumns = useMemo(
    () => fixDrawerTableFirstColumn<SystemMetadataItem>(itemColumns),
    [itemColumns]
  );

  const drawerHistoryColumns = useMemo(
    () => fixDrawerTableFirstColumn<SystemMetadataHistoryEntry>(historyColumns),
    [historyColumns]
  );

  return (
    <DetailDrawer
      open={Boolean(selectedGroup)}
      title={
        selectedGroup
          ? `${TEXT.drawerTitle}: ${selectedGroup.groupName}`
          : TEXT.drawerTitle
      }
      headerMeta={
        selectedGroup ? <Text type="secondary">{selectedGroup.groupId}</Text> : null
      }
      width={DETAIL_DRAWER_WIDTH.default}
      onClose={closeDrawer}
      footerStart={
        selectedGroup ? (
          <AuditLogLink
            targetType="SystemMetadataGroup"
            targetId={selectedGroup.groupId}
          />
        ) : null
      }
      footerEnd={
        selectedGroup ? (
          <Space>
            <Button
              size="large"
              data-testid="create-item-button"
              onClick={() => openCreateItemModal(selectedGroup.groupId)}
            >
              {TEXT.createItem}
            </Button>
            <Button size="large" icon={<EditOutlined />} onClick={() => openEditGroupModal(selectedGroup)}>
              {TEXT.editGroup}
            </Button>
            <Button
              size="large"
              danger={selectedGroup.status === 'active'}
              type={selectedGroup.status === 'active' ? 'primary' : 'default'}
              onClick={() =>
                setStatusActionState({
                  target: 'group',
                  group: selectedGroup,
                  nextStatus:
                    selectedGroup.status === 'active' ? 'inactive' : 'active'
                })
              }
            >
              {selectedGroup.status === 'active'
                ? '설정 비활성화'
                : '설정 활성화'}
            </Button>
          </Space>
        ) : null
      }
    >
      {selectedGroup ? (
        <DetailDrawerBody>
          <Alert
            type="info"
            showIcon
            message={`${MODULE_LABELS[selectedGroup.ownerModule]} 기능에서 쓰는 ${selectedGroup.groupName} 설정입니다.`}
            description={buildDrawerGuideDescription(selectedGroup)}
          />
          <DetailDrawerSection
            title={createHelpLabel(
              '기본 정보',
              '이 설정이 어떤 기능에서 쓰이고 누구에게 영향을 주는지 먼저 확인하는 영역입니다.'
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: SPACE.sm }}>
              화면에서 바로 값을 바꾸기 전에, 어떤 기능의 기준값인지와 사용자 화면에 영향이 있는지부터
              확인한 뒤 아래 운영 값을 조정해 주세요.
            </Paragraph>
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: 'groupName',
                  label: '설정명',
                  children: (
                    <Space direction="vertical" size={2}>
                      <Text strong>{selectedGroup.groupName}</Text>
                      <Text type="secondary">{selectedGroup.groupId}</Text>
                    </Space>
                  )
                },
                {
                  key: 'feature',
                  label: '소속 기능',
                  children: (
                    <Space wrap size={[8, 8]}>
                      <Tag color="blue">
                        {SUMMARY_FILTER_LABELS[getSettingCategory(selectedGroup)]}
                      </Tag>
                      <Text>{MODULE_LABELS[selectedGroup.ownerModule]}</Text>
                      <Text type="secondary">
                        {MANAGER_TYPE_LABELS[selectedGroup.managerType]}
                      </Text>
                    </Space>
                  )
                },
                {
                  key: 'status',
                  label: '운영 상태',
                  children: (
                    <Space wrap size={[8, 8]}>
                      <Tag color={selectedGroup.status === 'active' ? 'green' : 'default'}>
                        {STATUS_LABELS[selectedGroup.status]}
                      </Tag>
                      <Tag color={getSyncStatusColor(selectedGroup.syncStatus)}>
                        {SYNC_LABELS[selectedGroup.syncStatus]}
                      </Tag>
                      <Tag color={getExposureStatusColor(selectedGroup.exposureStatus)}>
                        {EXPOSURE_LABELS[selectedGroup.exposureStatus]}
                      </Tag>
                    </Space>
                  )
                },
                {
                  key: 'userSurface',
                  label: '사용자 화면',
                  children:
                    selectedGroup.linkedUserSurfaces.length > 0 ? (
                      renderValueList(selectedGroup.linkedUserSurfaces)
                    ) : (
                      <Text type="secondary">내부 운영에만 영향</Text>
                    )
                },
                {
                  key: 'description',
                  label: '운영 목적',
                  children: selectedGroup.description
                }
              ]}
            />
          </DetailDrawerSection>
          <DetailDrawerSection
            title={createHelpLabel(
              '설정 구조',
              '설정 그룹 아래에 어떤 운영 값이 연결되는지 트리 구조로 보여줍니다.'
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: SPACE.sm }}>
              설정 구조는 상위 설정 아래에 실제 운영 값이 매달리는 방식으로 구성됩니다. 각 계층의 마지막 `추가`
              노드로 같은 레벨의 값을 만들 수 있고, 기존 값은 드래그로 순서를 바꾸거나 눌러서 바로 수정할 수 있습니다.
            </Paragraph>
            <Tree
              defaultExpandAll
              showLine={{ showLeafIcon: false }}
              switcherIcon={({ expanded, isLeaf }) =>
                isLeaf ? null : expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />
              }
              draggable={{
                icon: false,
                nodeDraggable: (node) =>
                  typeof node.key === 'string' &&
                  !node.key.startsWith('group-') &&
                  !node.key.startsWith('add-item-')
              }}
              onSelect={handleSettingTreeSelect}
              onDrop={handleSettingTreeDrop}
              treeData={selectedGroupTreeData}
            />
          </DetailDrawerSection>
          <DetailDrawerSection
            title={createHelpLabel(
              '지금 운영 중인 값',
              '실제 선택지 목록입니다. 드래그로 순서를 바꾸고 우측 액션으로 수정 또는 상태 변경을 진행합니다.'
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: SPACE.sm }}>
              왼쪽 핸들을 드래그하면 정렬 순서가 즉시 바뀝니다. 라벨은 운영자가 이해하기 쉽게,
              코드는 로그와 API 추적에 맞게 유지해 주세요.
            </Paragraph>
            <AdminDataTable<SystemMetadataItem>
              rowKey="itemId"
              pagination={false}
              scroll={createDrawerTableScroll()}
              columns={drawerItemColumns}
              dataSource={selectedGroup.items}
              loading={reorderingItems}
              onRow={(record) => ({
                onDragOver: (event) => {
                  if (
                    reorderingItems ||
                    !draggingItemId ||
                    draggingItemId === record.itemId
                  ) {
                    return;
                  }

                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverItemId !== record.itemId) {
                    setDragOverItemId(record.itemId);
                  }
                },
                onDrop: (event) => {
                  event.preventDefault();
                  void handleItemDrop(record.itemId);
                },
                style:
                  draggingItemId === record.itemId
                    ? {
                        opacity: 0.45
                      }
                    : dragOverItemId === record.itemId
                      ? {
                          backgroundColor: COLOR.primaryBg,
                          boxShadow: `inset 0 2px 0 ${COLOR.primary}`
                        }
                      : undefined
              })}
            />
          </DetailDrawerSection>
          <DetailDrawerSection
            title={createHelpLabel(
              '고급 정보',
              '연동 체계와 책임 역할처럼 일반 운영자보다 시스템 관리자에게 더 중요한 정보입니다.'
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: SPACE.sm }}>
              문제 추적이나 개발 작업이 필요할 때 참고하는 정보입니다. 일반 운영 업무에서는 위 섹션 확인만으로도
              충분한 경우가 많습니다.
            </Paragraph>
            <Descriptions
              bordered
              column={1}
              items={[
                {
                  key: 'groupId',
                  label: '설정 ID',
                  children: selectedGroup.groupId
                },
                {
                  key: 'ownerRole',
                  label: '관리 책임 역할',
                  children: selectedGroup.ownerRole
                },
                {
                  key: 'defaultItems',
                  label: '기본값',
                  children: renderValueList(getDefaultItemLabels(selectedGroup.items))
                },
                {
                  key: 'itemCodePrefix',
                  label: '운영 값 코드 prefix',
                  children: selectedGroup.itemCodePrefix
                },
                {
                  key: 'updatedAt',
                  label: '최근 수정',
                  children: (
                    <Space direction="vertical" size={2}>
                      <Text>{selectedGroup.updatedAt}</Text>
                      <Text type="secondary">{selectedGroup.updatedBy}</Text>
                    </Space>
                  )
                },
                {
                  key: 'lastReviewedAt',
                  label: '마지막 검토',
                  children: selectedGroup.lastReviewedAt
                },
                {
                  key: 'notes',
                  label: '변경 전 참고 메모',
                  children: renderValueList(selectedGroup.schemaCandidateNotes)
                }
              ]}
            />
          </DetailDrawerSection>
          <DetailDrawerSection
            title={createHelpLabel(
              '변경 이력',
              '누가 어떤 설정을 바꿨는지 확인하는 기록입니다.'
            )}
          >
            <Paragraph type="secondary" style={{ marginBottom: SPACE.sm }}>
              최근 조치 사유와 수행자를 확인하면서 현재 값이 왜 유지되고 있는지 판단할 수 있습니다.
            </Paragraph>
            <AdminDataTable<SystemMetadataHistoryEntry>
              rowKey="historyId"
              pagination={DRAWER_TABLE_PAGINATION_WITH_HIDE}
              scroll={createDrawerTableScroll()}
              columns={drawerHistoryColumns}
              dataSource={selectedGroup.history}
            />
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
