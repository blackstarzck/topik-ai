import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { useMessageStore } from '../model/message-store';
import type { ChannelSnapshot, MessageChannel, MessageGroup, MessageHistory } from '../model/types';

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

async function loadChannelSnapshot(
  channel: MessageChannel,
  signal?: AbortSignal
): Promise<ChannelSnapshot> {
  await sleep(240, signal);
  const state = useMessageStore.getState();
  return {
    templates: state.templates.filter((template) => template.channel === channel),
    groups: state.groups.filter((group) => group.channels.includes(channel))
  };
}

async function loadGroups(signal?: AbortSignal): Promise<MessageGroup[]> {
  await sleep(220, signal);
  return useMessageStore.getState().groups;
}

async function loadHistories(signal?: AbortSignal): Promise<MessageHistory[]> {
  await sleep(260, signal);
  return useMessageStore.getState().histories;
}

export function fetchChannelSnapshotSafe(
  channel: MessageChannel,
  signal?: AbortSignal
) {
  return toSafeResult(() =>
    withRetry(() => loadChannelSnapshot(channel, signal), { maxRetries: 1 })
  );
}

export function fetchGroupsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadGroups(signal), { maxRetries: 1 }));
}

export function fetchHistoriesSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadHistories(signal), { maxRetries: 1 }));
}
