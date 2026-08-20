import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Space, Typography, notification } from 'antd';
import type { TableColumnsType, TreeProps } from 'antd';
import type { DragEvent as ReactDragEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchMetadataGroupsSafe } from '../api/system-metadata-service';
import { usePermissionStore } from '../model/permission-store';
import {
  SUMMARY_FILTER_LABELS,
  TEXT,
  getFeatureSearchValues,
  joinMultilineValue,
  matchesSummaryFilter,
  moveArrayItem,
  parseSummaryFilter,
  sortGroups
} from '../model/system-metadata-page-schema';
import type {
  DeleteActionState,
  GroupEditorState,
  GroupFormValues,
  ItemEditorState,
  ItemFormValues,
  StatusActionState,
  SummaryFilter
} from '../model/system-metadata-page-schema';
import type { MetadataActionContext } from '../ui/system-metadata-actions';
import {
  runDeleteItem,
  runItemReorder,
  runStatusAction,
  runSubmitGroup,
  runSubmitItem
} from '../ui/system-metadata-actions';
import { createMetadataGroupColumns } from '../ui/system-metadata-columns';
import { SystemMetadataDetailDrawer } from '../ui/system-metadata-detail-drawer';
import {
  MetadataGroupEditorModal,
  MetadataItemEditorModal
} from '../ui/system-metadata-modals';
import { createHelpLabel } from '../ui/system-metadata-render-utils';
import {
  MetadataTreeAddTitle,
  MetadataTreeItemTitle
} from '../ui/system-metadata-tree';
import { AssessmentMasterCatalogSection } from '@/features/assessment/ui/master-catalog-section';
import type { AsyncState } from '@/shared/model/async-state';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { SPACE } from '@/shared/styles/design-tokens';
import type {
  SystemMetadataGroup,
  SystemMetadataItem
} from '../model/system-metadata-types';

const { Paragraph, Text } = Typography;


export default function SystemMetadataPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [metadataState, setMetadataState] = useState<AsyncState<SystemMetadataGroup[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [groupEditorState, setGroupEditorState] = useState<GroupEditorState>(null);
  const [itemEditorState, setItemEditorState] = useState<ItemEditorState>(null);
  const [statusActionState, setStatusActionState] = useState<StatusActionState>(null);
  const [deleteActionState, setDeleteActionState] = useState<DeleteActionState>(null);
  const [pendingDeleteActionState, setPendingDeleteActionState] =
    useState<DeleteActionState>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [reorderingItems, setReorderingItems] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [hoveredTreeItemId, setHoveredTreeItemId] = useState<string | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [groupForm] = Form.useForm<GroupFormValues>();
  const [itemForm] = Form.useForm<ItemFormValues>();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const summaryFilter = parseSummaryFilter(searchParams.get('summaryFilter'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const selectedGroupId = searchParams.get('selected') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          'searchField' | 'keyword' | 'startDate' | 'endDate' | 'selected' | 'summaryFilter',
          string | null
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );
  const openCreateGroupModal = useCallback(() => {
    setGroupEditorState({ mode: 'create', group: null });
  }, []);
  const openEditGroupModal = useCallback((group: SystemMetadataGroup) => {
    setGroupEditorState({ mode: 'edit', group });
  }, []);
  const openCreateItemModal = useCallback((groupId: string) => {
    setItemEditorState({ groupId, item: null });
  }, []);
  const openEditItemModal = useCallback((groupId: string, item: SystemMetadataItem) => {
    setItemEditorState({ groupId, item });
  }, []);
  const openDeleteItemConfirm = useCallback(
    (group: SystemMetadataGroup, item: SystemMetadataItem) => {
      setDeleteActionState({ group, item });
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    setMetadataState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchMetadataGroupsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        const nextData = sortGroups(result.data);
        setMetadataState({
          status: nextData.length === 0 ? 'empty' : 'success',
          data: nextData,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setMetadataState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? metadataState.data.find((group) => group.groupId === selectedGroupId) ?? null
        : null,
    [metadataState.data, selectedGroupId]
  );
  const itemEditorGroup = useMemo(
    () =>
      itemEditorState
        ? metadataState.data.find((group) => group.groupId === itemEditorState.groupId) ?? null
        : null,
    [itemEditorState, metadataState.data]
  );

  useEffect(() => {
    setDraggingItemId(null);
    setDragOverItemId(null);
    setHoveredTreeItemId(null);
  }, [selectedGroupId]);

  useEffect(() => {
    if (itemEditorState || !pendingDeleteActionState) {
      return;
    }

    setDeleteActionState(pendingDeleteActionState);
    setPendingDeleteActionState(null);
  }, [itemEditorState, pendingDeleteActionState]);

  const selectedGroupTreeData = useMemo<NonNullable<TreeProps['treeData']>>(() => {
    if (!selectedGroup) {
      return [];
    }

    return [
      {
        key: `group-${selectedGroup.groupId}`,
        title: <Text strong>{selectedGroup.groupName}</Text>,
        selectable: false,
        children: [
          ...selectedGroup.items.map((item) => ({
            key: item.itemId,
            title: (
              <MetadataTreeItemTitle
                item={item}
                hovered={hoveredTreeItemId === item.itemId}
                onHoverChange={(hovered) =>
                  setHoveredTreeItemId(hovered ? item.itemId : null)
                }
                onDelete={(targetItem, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openDeleteItemConfirm(selectedGroup, targetItem);
                }}
              />
            ),
            isLeaf: true
          })),
          {
            key: `add-item-${selectedGroup.groupId}`,
            title: (
              <MetadataTreeAddTitle
                onClick={() => openCreateItemModal(selectedGroup.groupId)}
              />
            ),
            isLeaf: true,
            selectable: false
          }
        ]
      }
    ];
  }, [hoveredTreeItemId, openCreateItemModal, openDeleteItemConfirm, selectedGroup]);

  useEffect(() => {
    const canValidateSelection =
      metadataState.status === 'success' ||
      metadataState.status === 'empty' ||
      (metadataState.status === 'error' && metadataState.data.length > 0);

    if (!selectedGroupId || !canValidateSelection) return;
    if (!metadataState.data.some((group) => group.groupId === selectedGroupId)) {
      commitParams({ selected: null });
    }
  }, [commitParams, metadataState.data, metadataState.status, selectedGroupId]);

  useEffect(() => {
    if (!groupEditorState) {
      groupForm.resetFields();
      return;
    }

    const group = groupEditorState.group;
    groupForm.setFieldsValue({
      groupName: group?.groupName ?? '',
      description: group?.description ?? '',
      managerType: group?.managerType ?? 'codeTable',
      ownerModule: group?.ownerModule ?? 'System',
      ownerRole: group?.ownerRole ?? 'OPS_ADMIN',
      syncStatus: group?.syncStatus ?? 'draft',
      exposureStatus: group?.exposureStatus ?? 'internalOnly',
      itemCodePrefix: group?.itemCodePrefix ?? '',
      linkedAdminPagesText: joinMultilineValue(group?.linkedAdminPages ?? []),
      linkedUserSurfacesText: joinMultilineValue(group?.linkedUserSurfaces ?? []),
      schemaCandidateNotesText: joinMultilineValue(group?.schemaCandidateNotes ?? [])
    });
  }, [groupEditorState, groupForm]);

  useEffect(() => {
    if (!itemEditorState) {
      itemForm.resetFields();
      return;
    }

    const item = itemEditorState.item;
    itemForm.setFieldsValue({
      code: item?.code ?? '',
      label: item?.label ?? '',
      description: item?.description ?? '',
      status: item?.status ?? 'active',
      sortOrder: item?.sortOrder ?? (itemEditorGroup?.items.length ?? 0) + 1,
      isDefault: item?.isDefault ? 'yes' : 'no',
      exposureStatus: item?.exposureStatus ?? 'internalOnly'
    });
  }, [itemEditorGroup, itemEditorState, itemForm]);

  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return metadataState.data.filter((group) => {
      if (!matchesSummaryFilter(group, summaryFilter)) return false;
      if (!matchesSearchDateRange(group.updatedAt, startDate, endDate)) return false;
      if (!normalizedKeyword) return true;
      return matchesSearchField(normalizedKeyword, searchField, {
        groupId: group.groupId,
        groupName: group.groupName,
        feature: getFeatureSearchValues(group),
        userSurface: group.linkedUserSurfaces
      });
    });
  }, [endDate, keyword, metadataState.data, searchField, startDate, summaryFilter]);

  const openDrawer = useCallback((groupId: string) => {
    commitParams({ selected: groupId });
  }, [commitParams]);

  const closeDrawer = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const handleApplyDateRange = useCallback(() => {
    commitParams({ startDate: draftStartDate || null, endDate: draftEndDate || null });
  }, [commitParams, draftEndDate, draftStartDate]);

  const handleSummaryFilter = useCallback((nextSummaryFilter: SummaryFilter) => {
    commitParams({ summaryFilter: nextSummaryFilter || null });
  }, [commitParams]);

  const resetItemDragState = useCallback(() => {
    setDraggingItemId(null);
    setDragOverItemId(null);
  }, []);

  const actionContext = useMemo<MetadataActionContext>(
    () => ({
      currentAdminId,
      notificationApi,
      commitParams,
      setMetadataState,
      setGroupEditorState,
      setItemEditorState,
      setStatusActionState,
      setDeleteActionState,
      setHoveredTreeItemId,
      setSubmittingGroup,
      setSubmittingItem,
      setReorderingItems,
      resetItemDragState
    }),
    [commitParams, currentAdminId, notificationApi, resetItemDragState]
  );

  const handleSubmitGroup = useCallback(
    async () => runSubmitGroup(actionContext, groupForm, groupEditorState),
    [actionContext, groupEditorState, groupForm]
  );

  const handleSubmitItem = useCallback(
    async () => runSubmitItem(actionContext, itemForm, itemEditorState),
    [actionContext, itemEditorState, itemForm]
  );

  const handleItemReorder = useCallback(
    async (orderedItemIds: string[], reason: string) =>
      runItemReorder(actionContext, selectedGroup, orderedItemIds, reason),
    [actionContext, selectedGroup]
  );

  const handleItemDragStart = useCallback(
    (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => {
      if (reorderingItems) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
      setDraggingItemId(itemId);
      setDragOverItemId(itemId);
    },
    [reorderingItems]
  );

  const handleItemDrop = useCallback(
    async (targetItemId: string) => {
      if (!selectedGroup || !draggingItemId || draggingItemId === targetItemId) {
        resetItemDragState();
        return;
      }

      const currentOrder = selectedGroup.items.map((item) => item.itemId);
      const sourceIndex = currentOrder.indexOf(draggingItemId);
      const targetIndex = currentOrder.indexOf(targetItemId);

      if (sourceIndex < 0 || targetIndex < 0) {
        resetItemDragState();
        return;
      }

      const nextOrder = moveArrayItem(currentOrder, sourceIndex, targetIndex);
      await handleItemReorder(nextOrder, '운영 값 정렬 순서 조정');
    },
    [draggingItemId, handleItemReorder, resetItemDragState, selectedGroup]
  );

  const handleSettingTreeSelect = useCallback<NonNullable<TreeProps['onSelect']>>(
    (_, info) => {
      if (!selectedGroup) {
        return;
      }

      const nodeKey = String(info.node.key);
      if (nodeKey === `add-item-${selectedGroup.groupId}`) {
        openCreateItemModal(selectedGroup.groupId);
        return;
      }

      const targetItem =
        selectedGroup.items.find((item) => item.itemId === nodeKey) ?? null;
      if (targetItem) {
        openEditItemModal(selectedGroup.groupId, targetItem);
      }
    },
    [openCreateItemModal, openEditItemModal, selectedGroup]
  );

  const handleSettingTreeDrop = useCallback<NonNullable<TreeProps['onDrop']>>(
    (info) => {
      if (!selectedGroup) {
        return;
      }

      const dragKey = String(info.dragNode.key);
      const currentOrder = selectedGroup.items.map((item) => item.itemId);
      const sourceIndex = currentOrder.indexOf(dragKey);
      if (sourceIndex < 0) {
        return;
      }

      const dropKey = String(info.node.key);
      let targetIndex = currentOrder.length - 1;

      if (
        dropKey !== `group-${selectedGroup.groupId}` &&
        dropKey !== `add-item-${selectedGroup.groupId}`
      ) {
        const rawTargetIndex = currentOrder.indexOf(dropKey);
        if (rawTargetIndex < 0) {
          return;
        }

        const dropPath = String(info.node.pos).split('-');
        const relativeDropPosition =
          info.dropPosition - Number(dropPath[dropPath.length - 1]);
        targetIndex = rawTargetIndex;

        if (info.dropToGap && relativeDropPosition > 0) {
          targetIndex = rawTargetIndex + 1;
        }
      }

      const normalizedTargetIndex =
        targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      const nextOrder = moveArrayItem(
        currentOrder,
        sourceIndex,
        Math.max(0, Math.min(normalizedTargetIndex, currentOrder.length - 1))
      );

      void handleItemReorder(nextOrder, '설정 구조 드래그 정렬');
    },
    [handleItemReorder, selectedGroup]
  );


  const handleDeleteItem = useCallback(
    async (reason: string) => runDeleteItem(actionContext, deleteActionState, itemEditorState, reason),
    [actionContext, deleteActionState, itemEditorState]
  );

  const handleStatusAction = useCallback(
    async (reason: string) => runStatusAction(actionContext, statusActionState, reason),
    [actionContext, statusActionState]
  );

  const summaryItems = useMemo(
    () => [
      {
        key: 'all',
        label: '전체 설정',
        value: `${metadataState.data.length.toLocaleString()}개`,
        active: summaryFilter === '',
        onClick: () => handleSummaryFilter('')
      },
      {
        key: 'memberSettings',
        label: SUMMARY_FILTER_LABELS.memberSettings,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'memberSettings'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'memberSettings',
        onClick: () => handleSummaryFilter('memberSettings')
      },
      {
        key: 'messageSettings',
        label: SUMMARY_FILTER_LABELS.messageSettings,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'messageSettings'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'messageSettings',
        onClick: () => handleSummaryFilter('messageSettings')
      },
      {
        key: 'operationExposure',
        label: SUMMARY_FILTER_LABELS.operationExposure,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'operationExposure'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'operationExposure',
        onClick: () => handleSummaryFilter('operationExposure')
      },
      {
        key: 'commerceBenefits',
        label: SUMMARY_FILTER_LABELS.commerceBenefits,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'commerceBenefits'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'commerceBenefits',
        onClick: () => handleSummaryFilter('commerceBenefits')
      }
    ],
    [handleSummaryFilter, metadataState.data, summaryFilter]
  );

  const columns = useMemo<TableColumnsType<SystemMetadataGroup>>(
    () =>
      createMetadataGroupColumns({
        openDrawer,
        openEditGroupModal,
        openCreateItemModal,
        setStatusActionState
      }),
    [openCreateItemModal, openDrawer, openEditGroupModal]
  );


  const hasCachedGroups = metadataState.data.length > 0;
  const isFilteredEmpty =
    metadataState.status !== 'empty' && metadataState.data.length > 0 && filteredGroups.length === 0;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title={TEXT.pageTitle} />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: SPACE.lg }}
        message="쿠폰 적용 범위, 회원 상태, FAQ 노출 위치처럼 운영자가 직접 바꾸는 설정을 기능 기준으로 모아 보는 페이지입니다."
        description={
          <Space direction="vertical" size={4}>
            <Text>1. 상단 요약 카드에서 먼저 관리하려는 기능 영역을 좁힙니다.</Text>
            <Text>2. 목록에서 설정명을 눌러 어디에 쓰이는 값인지와 사용자 영향을 확인합니다.</Text>
            <Text>3. 필요한 운영 값만 추가하거나 수정하고, 감사 로그에서 변경 이력을 검증합니다.</Text>
          </Space>
        }
      />
      <ListSummaryCards items={summaryItems} />
      <Paragraph type="secondary" style={{ marginBottom: SPACE.lg }}>
        카드는 기능 영역을 빠르게 좁히는 용도이고, 실제 수정 여부 판단은 상세 Drawer의
        `기본 정보`, `설정 구조`, `지금 운영 중인 값`을 기준으로 진행하는 것을 기본으로 합니다.
      </Paragraph>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '설정 ID', value: 'groupId' },
              { label: '설정명', value: 'groupName' },
              { label: '소속 기능', value: 'feature' },
              { label: '사용자 화면', value: 'userSurface' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value, searchField })}
            keywordPlaceholder="설정명, 소속 기능, 사용자 화면으로 검색"
            detailTitle="상세 검색"
            detailContent={<SearchBarDetailField label={createHelpLabel('최근 수정', '최근 수정 범위로 설정 목록을 좁혀 볼 수 있습니다.') }><SearchBarDateRange startDate={draftStartDate} endDate={draftEndDate} onChange={handleDraftDateChange} /></SearchBarDetailField>}
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={<Text type="secondary">{TEXT.toolbarSummary} {filteredGroups.length.toLocaleString()}개 설정</Text>}
            actions={
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                data-testid="create-group-button"
                onClick={openCreateGroupModal}
              >
                {TEXT.createGroup}
              </Button>
            }
          />
        }
      >
        {metadataState.status === 'error' ? <Alert type="error" showIcon style={{ marginBottom: SPACE.sm }} message="운영 설정 목록을 불러오지 못했습니다." description={metadataState.errorMessage ?? ''} action={<Button size="small" onClick={() => setReloadKey((prev) => prev + 1)}>다시 시도</Button>} /> : null}
        {metadataState.status === 'pending' && hasCachedGroups ? <Alert type="info" showIcon style={{ marginBottom: SPACE.sm }} message="최신 운영 설정을 다시 불러오는 중입니다." /> : null}
        {metadataState.status === 'empty' ? <Alert type="info" showIcon style={{ marginBottom: SPACE.sm }} message="등록된 운영 설정이 없습니다." /> : null}
        {isFilteredEmpty ? <Alert type="info" showIcon style={{ marginBottom: SPACE.sm }} message="현재 검색 조건과 일치하는 운영 설정이 없습니다." /> : null}

        <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
          설정명을 눌러 상세를 열면 사용처, 현재 운영 값, 변경 영향, 감사 로그 확인 경로를 한 화면에서 볼 수 있습니다.
        </Paragraph>

        <AdminDataTable<SystemMetadataGroup> rowKey="groupId" pagination={false} scroll={{ x: 1480 }} loading={metadataState.status === 'pending' && !hasCachedGroups} columns={columns} dataSource={filteredGroups} onRow={(record) => ({ onClick: () => openDrawer(record.groupId), style: { cursor: 'pointer' } })} />
      </AdminListCard>

      {/* P5-1 마스터 조회 surface — SoT가 Supabase 실데이터라 모크 그룹 store와 분리(읽기 전용). */}
      <AssessmentMasterCatalogSection />

      <SystemMetadataDetailDrawer
        selectedGroup={selectedGroup}
        closeDrawer={closeDrawer}
        openCreateItemModal={openCreateItemModal}
        openEditGroupModal={openEditGroupModal}
        openEditItemModal={openEditItemModal}
        openDeleteItemConfirm={openDeleteItemConfirm}
        setStatusActionState={setStatusActionState}
        selectedGroupTreeData={selectedGroupTreeData}
        handleSettingTreeSelect={handleSettingTreeSelect}
        handleSettingTreeDrop={handleSettingTreeDrop}
        reorderingItems={reorderingItems}
        draggingItemId={draggingItemId}
        dragOverItemId={dragOverItemId}
        setDragOverItemId={setDragOverItemId}
        handleItemDrop={handleItemDrop}
        handleItemDragStart={handleItemDragStart}
        resetItemDragState={resetItemDragState}
      />

      <MetadataGroupEditorModal
        groupEditorState={groupEditorState}
        setGroupEditorState={setGroupEditorState}
        groupForm={groupForm}
        submittingGroup={submittingGroup}
        handleSubmitGroup={handleSubmitGroup}
      />

      {deleteActionState ? (
        <ConfirmAction
          open
          title="운영 값 삭제"
          description={`${deleteActionState.item.label} 값을 삭제하는 운영 사유를 입력해 주세요.`}
          targetType="SystemMetadataGroup"
          targetId={deleteActionState.group.groupId}
          confirmText="삭제 실행"
          onCancel={() => setDeleteActionState(null)}
          onConfirm={handleDeleteItem}
        />
      ) : null}

      <MetadataItemEditorModal
        itemEditorState={itemEditorState}
        setItemEditorState={setItemEditorState}
        itemEditorGroup={itemEditorGroup}
        itemForm={itemForm}
        submittingItem={submittingItem}
        handleSubmitItem={handleSubmitItem}
        selectedGroup={selectedGroup}
        setPendingDeleteActionState={setPendingDeleteActionState}
      />

      {statusActionState ? (
        <ConfirmAction
          open
          title={
            statusActionState.target === 'group'
              ? statusActionState.nextStatus === 'inactive'
                ? '운영 설정 비활성화'
                : '운영 설정 활성화'
              : statusActionState.nextStatus === 'inactive'
                ? '운영 값 비활성화'
                : '운영 값 활성화'
          }
          description={
            statusActionState.target === 'group'
              ? '운영 설정을 변경하는 사유를 입력해 주세요.'
              : `${statusActionState.item.label} 값을 변경하는 운영 사유를 입력해 주세요.`
          }
          targetType="SystemMetadataGroup"
          targetId={statusActionState.group.groupId}
          confirmText={statusActionState.nextStatus === 'inactive' ? '비활성화 실행' : '활성화 실행'}
          onCancel={() => setStatusActionState(null)}
          onConfirm={handleStatusAction}
        />
      ) : null}
    </div>
  );
}




