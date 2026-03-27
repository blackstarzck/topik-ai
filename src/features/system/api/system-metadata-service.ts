import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import {
  useSystemMetadataStore,
  type SaveMetadataGroupPayload,
  type SaveMetadataItemPayload,
  type ToggleMetadataGroupStatusPayload,
  type ToggleMetadataItemStatusPayload
} from '../model/system-metadata-store';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createValidationError(message: string): AppApiError {
  return new AppApiError(message, {
    code: 'VALIDATION_ERROR',
    status: 400,
    retryable: false
  });
}

function createNotFoundError(message: string): AppApiError {
  return new AppApiError(message, {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

function normalizeLineItems(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function validateGroupPayload(payload: SaveMetadataGroupPayload): void {
  if (!payload.groupName.trim()) {
    throw createValidationError('그룹명을 입력해 주세요.');
  }
  if (!payload.description.trim()) {
    throw createValidationError('그룹 설명을 입력해 주세요.');
  }
  if (!payload.ownerRole.trim()) {
    throw createValidationError('관리 책임 역할을 입력해 주세요.');
  }
  if (!payload.itemCodePrefix.trim()) {
    throw createValidationError('항목 코드 prefix를 입력해 주세요.');
  }

  const normalizedAdminPages = normalizeLineItems(payload.linkedAdminPages);
  if (normalizedAdminPages.length === 0) {
    throw createValidationError('연관 관리자 화면을 최소 1개 입력해 주세요.');
  }
}

function validateItemPayload(payload: SaveMetadataItemPayload): void {
  if (!payload.code.trim()) {
    throw createValidationError('항목 코드를 입력해 주세요.');
  }
  if (!payload.label.trim()) {
    throw createValidationError('항목 라벨을 입력해 주세요.');
  }
  if (!payload.description.trim()) {
    throw createValidationError('항목 설명을 입력해 주세요.');
  }
  if (payload.sortOrder < 1) {
    throw createValidationError('정렬 순서는 1 이상이어야 합니다.');
  }
}

async function loadMetadataGroups(signal?: AbortSignal) {
  await sleep(220, signal);
  return useSystemMetadataStore.getState().groups;
}

async function persistMetadataGroup(
  payload: SaveMetadataGroupPayload,
  signal?: AbortSignal
) {
  await sleep(220, signal);
  validateGroupPayload(payload);

  const store = useSystemMetadataStore.getState();
  const normalizedName = payload.groupName.trim().toLowerCase();
  const duplicatedGroup = store.groups.find(
    (group) =>
      group.groupId !== payload.groupId &&
      group.groupName.trim().toLowerCase() === normalizedName
  );

  if (duplicatedGroup) {
    throw createValidationError('같은 그룹명이 이미 존재합니다.');
  }

  return store.saveGroup({
    ...payload,
    groupName: payload.groupName.trim(),
    description: payload.description.trim(),
    ownerRole: payload.ownerRole.trim(),
    linkedAdminPages: normalizeLineItems(payload.linkedAdminPages),
    linkedUserSurfaces: normalizeLineItems(payload.linkedUserSurfaces),
    schemaCandidateNotes: normalizeLineItems(payload.schemaCandidateNotes),
    itemCodePrefix: payload.itemCodePrefix.trim().toUpperCase(),
    reason: payload.reason.trim()
  });
}

async function persistMetadataItem(
  payload: SaveMetadataItemPayload,
  signal?: AbortSignal
) {
  await sleep(220, signal);
  validateItemPayload(payload);

  const store = useSystemMetadataStore.getState();
  const targetGroup = store.groups.find((group) => group.groupId === payload.groupId);
  if (!targetGroup) {
    throw createNotFoundError('메타 그룹을 찾을 수 없습니다.');
  }

  const normalizedCode = payload.code.trim().toUpperCase();
  const duplicatedItem = targetGroup.items.find(
    (item) =>
      item.itemId !== payload.itemId && item.code.trim().toUpperCase() === normalizedCode
  );

  if (duplicatedItem) {
    throw createValidationError('같은 항목 코드가 이미 존재합니다.');
  }

  const updatedGroup = store.saveItem({
    ...payload,
    code: normalizedCode,
    label: payload.label.trim(),
    description: payload.description.trim(),
    reason: payload.reason.trim()
  });

  if (!updatedGroup) {
    throw createNotFoundError('메타 그룹을 찾을 수 없습니다.');
  }

  return updatedGroup;
}

async function changeGroupStatus(
  payload: ToggleMetadataGroupStatusPayload,
  signal?: AbortSignal
) {
  await sleep(180, signal);

  const updatedGroup = useSystemMetadataStore.getState().toggleGroupStatus({
    ...payload,
    reason: payload.reason.trim()
  });

  if (!updatedGroup) {
    throw createNotFoundError('메타 그룹을 찾을 수 없습니다.');
  }

  return updatedGroup;
}

async function changeItemStatus(
  payload: ToggleMetadataItemStatusPayload,
  signal?: AbortSignal
) {
  await sleep(180, signal);

  const updatedGroup = useSystemMetadataStore.getState().toggleItemStatus({
    ...payload,
    reason: payload.reason.trim()
  });

  if (!updatedGroup) {
    throw createNotFoundError('메타 항목을 찾을 수 없습니다.');
  }

  return updatedGroup;
}

export function fetchMetadataGroupsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadMetadataGroups(signal), {
      maxRetries: 1
    })
  );
}

export function saveMetadataGroupSafe(
  payload: SaveMetadataGroupPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistMetadataGroup(payload, signal));
}

export function saveMetadataItemSafe(
  payload: SaveMetadataItemPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistMetadataItem(payload, signal));
}

export function toggleMetadataGroupStatusSafe(
  payload: ToggleMetadataGroupStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => changeGroupStatus(payload, signal));
}

export function toggleMetadataItemStatusSafe(
  payload: ToggleMetadataItemStatusPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => changeItemStatus(payload, signal));
}
