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
    throw createValidationError('\uadf8\ub8f9\uba85\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }
  if (!payload.description.trim()) {
    throw createValidationError('\uadf8\ub8f9 \uc124\uba85\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }
  if (!payload.ownerRole.trim()) {
    throw createValidationError(
      '\uad00\ub9ac \ucc45\uc784 \uc5ed\ud560\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.'
    );
  }
  if (!payload.itemCodePrefix.trim()) {
    throw createValidationError('\ud56d\ubaa9 \ucf54\ub4dc prefix\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }

  const normalizedAdminPages = normalizeLineItems(payload.linkedAdminPages);
  if (normalizedAdminPages.length === 0) {
    throw createValidationError(
      '\uc5f0\uad00 \uad00\ub9ac\uc790 \ud654\uba74\uc744 \ucd5c\uc18c 1\uac1c \uc785\ub825\ud574 \uc8fc\uc138\uc694.'
    );
  }
}

function validateItemPayload(payload: SaveMetadataItemPayload): void {
  if (!payload.code.trim()) {
    throw createValidationError('\ud56d\ubaa9 \ucf54\ub4dc\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }
  if (!payload.label.trim()) {
    throw createValidationError('\ud56d\ubaa9 \ub77c\ubca8\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }
  if (!payload.description.trim()) {
    throw createValidationError('\ud56d\ubaa9 \uc124\uba85\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.');
  }
  if (payload.sortOrder < 1) {
    throw createValidationError('\uc815\ub82c \uc21c\uc11c\ub294 1 \uc774\uc0c1\uc774\uc5b4\uc57c \ud569\ub2c8\ub2e4.');
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
    throw createValidationError('\uac19\uc740 \uadf8\ub8f9\uba85\uc774 \uc774\ubbf8 \uc874\uc7ac\ud569\ub2c8\ub2e4.');
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
    throw createNotFoundError('\uba54\ud0c0 \uadf8\ub8f9\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.');
  }

  const normalizedCode = payload.code.trim().toUpperCase();
  const duplicatedItem = targetGroup.items.find(
    (item) =>
      item.itemId !== payload.itemId && item.code.trim().toUpperCase() === normalizedCode
  );

  if (duplicatedItem) {
    throw createValidationError(
      '\uac19\uc740 \ud56d\ubaa9 \ucf54\ub4dc\uac00 \uc774\ubbf8 \uc874\uc7ac\ud569\ub2c8\ub2e4.'
    );
  }

  const updatedGroup = store.saveItem({
    ...payload,
    code: normalizedCode,
    label: payload.label.trim(),
    description: payload.description.trim(),
    reason: payload.reason.trim()
  });

  if (!updatedGroup) {
    throw createNotFoundError('\uba54\ud0c0 \uadf8\ub8f9\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.');
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
    throw createNotFoundError('\uba54\ud0c0 \uadf8\ub8f9\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.');
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
    throw createNotFoundError('\uba54\ud0c0 \ud56d\ubaa9\uc744 \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.');
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
