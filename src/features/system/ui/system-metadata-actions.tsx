import type { FormInstance } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { Dispatch, SetStateAction } from 'react';

import {
  deleteMetadataItemSafe,
  reorderMetadataItemsSafe,
  saveMetadataGroupSafe,
  saveMetadataItemSafe,
  toggleMetadataGroupStatusSafe,
  toggleMetadataItemStatusSafe
} from '../api/system-metadata-service';
import {
  STATUS_LABELS,
  mergeUpdatedGroup,
  normalizeMultilineValue
} from '../model/system-metadata-page-schema';
import type {
  DeleteActionState,
  GroupEditorState,
  GroupFormValues,
  ItemEditorState,
  ItemFormValues,
  StatusActionState
} from '../model/system-metadata-page-schema';
import type { SystemMetadataGroup } from '../model/system-metadata-types';
import { buildNotificationDescription } from './system-metadata-render-utils';
import type { AsyncState } from '@/shared/model/async-state';

// 운영 설정 조치 실행기(변형 ⑩) — Phase 4 분해로 페이지 핸들러 본문에서 이동(동작 동일).
// 페이지가 소유한 상태 setter·알림 인스턴스·URL 커밋을 컨텍스트로 주입받고,
// 실행 시점·소유권은 페이지의 3줄 위임 핸들러가 그대로 가진다.
export type MetadataActionContext = {
  currentAdminId: string;
  notificationApi: NotificationInstance;
  commitParams: (
    next: Partial<
      Record<
        'searchField' | 'keyword' | 'startDate' | 'endDate' | 'selected' | 'summaryFilter',
        string | null
      >
    >
  ) => void;
  setMetadataState: Dispatch<SetStateAction<AsyncState<SystemMetadataGroup[]>>>;
  setGroupEditorState: Dispatch<SetStateAction<GroupEditorState>>;
  setItemEditorState: Dispatch<SetStateAction<ItemEditorState>>;
  setStatusActionState: Dispatch<SetStateAction<StatusActionState>>;
  setDeleteActionState: Dispatch<SetStateAction<DeleteActionState>>;
  setHoveredTreeItemId: Dispatch<SetStateAction<string | null>>;
  setSubmittingGroup: Dispatch<SetStateAction<boolean>>;
  setSubmittingItem: Dispatch<SetStateAction<boolean>>;
  setReorderingItems: Dispatch<SetStateAction<boolean>>;
  resetItemDragState: () => void;
};

export async function runSubmitGroup(
  ctx: MetadataActionContext,
  groupForm: FormInstance<GroupFormValues>,
  groupEditorState: GroupEditorState
): Promise<void> {
  if (!groupEditorState) return;
  try {
    const values = await groupForm.validateFields();
    ctx.setSubmittingGroup(true);
    const reason =
      groupEditorState.mode === 'create'
        ? '운영 설정 신규 등록'
        : '운영 설정 정보 수정';
    const result = await saveMetadataGroupSafe({
      groupId: groupEditorState.group?.groupId,
      groupName: values.groupName,
      description: values.description,
      managerType: values.managerType,
      ownerModule: values.ownerModule,
      ownerRole: values.ownerRole,
      syncStatus: values.syncStatus,
      exposureStatus: values.exposureStatus,
      linkedAdminPages: normalizeMultilineValue(values.linkedAdminPagesText),
      linkedUserSurfaces: normalizeMultilineValue(values.linkedUserSurfacesText),
      schemaCandidateNotes: normalizeMultilineValue(values.schemaCandidateNotesText),
      itemCodePrefix: values.itemCodePrefix,
      reason,
      changedBy: ctx.currentAdminId
    });
    if (!result.ok) {
      ctx.notificationApi.error({
        message:
          groupEditorState.mode === 'create'
            ? '운영 설정 추가 실패'
            : '운영 설정 수정 실패',
        description: result.error.message
      });
      return;
    }
    ctx.setMetadataState((prev) => ({
      status: 'success',
      data: mergeUpdatedGroup(prev.data, result.data),
      errorMessage: null,
      errorCode: null
    }));
    ctx.commitParams({ selected: result.data.groupId });
    ctx.setGroupEditorState(null);
    ctx.notificationApi.success({
      message:
        groupEditorState.mode === 'create'
          ? '운영 설정 추가 완료'
          : '운영 설정 수정 완료',
      description: buildNotificationDescription(result.data, reason)
    });
  } finally {
    ctx.setSubmittingGroup(false);
  }
}

export async function runSubmitItem(
  ctx: MetadataActionContext,
  itemForm: FormInstance<ItemFormValues>,
  itemEditorState: ItemEditorState
): Promise<void> {
  if (!itemEditorState) return;
  try {
    const values = await itemForm.validateFields();
    ctx.setSubmittingItem(true);
    const reason = itemEditorState.item
      ? '운영 값 정보 수정'
      : '운영 값 신규 추가';
    const result = await saveMetadataItemSafe({
      groupId: itemEditorState.groupId,
      itemId: itemEditorState.item?.itemId,
      code: values.code,
      label: values.label,
      description: values.description,
      status: values.status,
      sortOrder: Number(values.sortOrder),
      isDefault: values.isDefault === 'yes',
      exposureStatus: values.exposureStatus,
      reason,
      changedBy: ctx.currentAdminId
    });
    if (!result.ok) {
      ctx.notificationApi.error({
        message: itemEditorState.item
          ? '운영 값 수정 실패'
          : '운영 값 추가 실패',
        description: result.error.message
      });
      return;
    }
    ctx.setMetadataState((prev) => ({
      status: 'success',
      data: mergeUpdatedGroup(prev.data, result.data),
      errorMessage: null,
      errorCode: null
    }));
    ctx.commitParams({ selected: result.data.groupId });
    ctx.setItemEditorState(null);
    ctx.notificationApi.success({
      message: itemEditorState.item
        ? '운영 값 수정 완료'
        : '운영 값 추가 완료',
      description: buildNotificationDescription(result.data, reason)
    });
  } finally {
    ctx.setSubmittingItem(false);
  }
}

export async function runItemReorder(
  ctx: MetadataActionContext,
  selectedGroup: SystemMetadataGroup | null,
  orderedItemIds: string[],
  reason: string
): Promise<void> {
  if (!selectedGroup) {
    ctx.resetItemDragState();
    return;
  }

  const currentOrder = selectedGroup.items.map((item) => item.itemId);
  if (currentOrder.join('|') === orderedItemIds.join('|')) {
    ctx.resetItemDragState();
    return;
  }

  ctx.setReorderingItems(true);
  const result = await reorderMetadataItemsSafe({
    groupId: selectedGroup.groupId,
    orderedItemIds,
    reason,
    changedBy: ctx.currentAdminId
  });
  ctx.setReorderingItems(false);
  ctx.resetItemDragState();

  if (!result.ok) {
    ctx.notificationApi.error({
      message: '운영 값 순서 변경 실패',
      description: result.error.message
    });
    return;
  }

  ctx.setMetadataState((prev) => ({
    status: 'success',
    data: mergeUpdatedGroup(prev.data, result.data),
    errorMessage: null,
    errorCode: null
  }));
  ctx.notificationApi.success({
    message: '운영 값 순서 변경 완료',
    description: buildNotificationDescription(result.data, reason)
  });
}

export async function runDeleteItem(
  ctx: MetadataActionContext,
  deleteActionState: DeleteActionState,
  itemEditorState: ItemEditorState,
  reason: string
): Promise<void> {
  if (!deleteActionState) {
    return;
  }

  const result = await deleteMetadataItemSafe({
    groupId: deleteActionState.group.groupId,
    itemId: deleteActionState.item.itemId,
    reason,
    changedBy: ctx.currentAdminId
  });

  if (!result.ok) {
    ctx.notificationApi.error({
      message: '운영 값 삭제 실패',
      description: result.error.message
    });
    return;
  }

  ctx.setMetadataState((prev) => ({
    status: 'success',
    data: mergeUpdatedGroup(prev.data, result.data),
    errorMessage: null,
    errorCode: null
  }));
  if (itemEditorState?.item?.itemId === deleteActionState.item.itemId) {
    ctx.setItemEditorState(null);
  }
  ctx.setHoveredTreeItemId(null);
  ctx.setDeleteActionState(null);
  ctx.notificationApi.success({
    message: '운영 값 삭제 완료',
    description: buildNotificationDescription(result.data, reason)
  });
}

export async function runStatusAction(
  ctx: MetadataActionContext,
  statusActionState: StatusActionState,
  reason: string
): Promise<void> {
  if (!statusActionState) return;
  const result =
    statusActionState.target === 'group'
      ? await toggleMetadataGroupStatusSafe({
          groupId: statusActionState.group.groupId,
          nextStatus: statusActionState.nextStatus,
          reason,
          changedBy: ctx.currentAdminId
        })
      : await toggleMetadataItemStatusSafe({
          groupId: statusActionState.group.groupId,
          itemId: statusActionState.item.itemId,
          nextStatus: statusActionState.nextStatus,
          reason,
          changedBy: ctx.currentAdminId
        });

  if (!result.ok) {
    ctx.notificationApi.error({
      message:
        statusActionState.target === 'group'
          ? '운영 설정 상태 변경 실패'
          : '운영 값 상태 변경 실패',
      description: result.error.message
    });
    return;
  }

  ctx.setMetadataState((prev) => ({
    status: 'success',
    data: mergeUpdatedGroup(prev.data, result.data),
    errorMessage: null,
    errorCode: null
  }));
  ctx.notificationApi.success({
    message:
      statusActionState.target === 'group'
        ? STATUS_LABELS[statusActionState.nextStatus] + ' 완료'
        : '운영 값 ' + STATUS_LABELS[statusActionState.nextStatus] + ' 완료',
    description: buildNotificationDescription(result.data, reason)
  });
  ctx.setStatusActionState(null);
}
