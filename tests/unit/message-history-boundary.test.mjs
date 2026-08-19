import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateMessageHistoryBoundary,
  formatMessageHistoryBoundaryReport
} from '../../scripts/check-message-history-boundary.mjs';

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-message-history-boundary-'));
  tempDirs.push(root);
  return root;
}

function writeProjectFile(root, relativePath, content) {
  const absolutePath = join(root, relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

function writeValidProject(root) {
  writeProjectFile(
    root,
    'src/features/message/api/notification-supabase-adapter.ts',
    `
export async function loadNotificationDispatches() {
  return client.from('notification_dispatches').limit(200);
}
export async function loadNotificationDispatchAttempts(dispatchId) {
  return client.from('notification_delivery_attempts').eq('dispatch_id', dispatchId);
}
`
  );
  writeProjectFile(root, 'src/features/message/api/messages-service.ts', 'notification_dispatches\n');
  writeProjectFile(
    root,
    'src/features/message/pages/message-history-dispatch-page.tsx',
    'notification_dispatches\n'
  );
  writeProjectFile(
    root,
    'docs/specs/admin-data-contract.md',
    'NotificationDispatch NotificationDeliveryAttempt notification_dispatches notification_delivery_attempts\n'
  );
  writeProjectFile(
    root,
    'docs/page-sync/message-history-page-sync.md',
    'NotificationDispatch NotificationDeliveryAttempt notification_dispatches notification_delivery_attempts\n'
  );
  writeProjectFile(
    root,
    'docs/architecture/shared-supabase-schema-ownership.md',
    'notification_dispatches notification_delivery_attempts v13 X-09\n'
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-message-history-boundary', () => {
  it('passes when admin history uses notification dispatch and attempt tables', () => {
    const root = createTempRoot();
    writeValidProject(root);

    const result = evaluateMessageHistoryBoundary({ rootDir: root });

    expect(result).toEqual({ failures: [] });
    expect(formatMessageHistoryBoundaryReport(result)).toBe('Message history boundary check passed.');
  });

  it('fails when the supabase dispatch page loses its ledger reference', () => {
    const root = createTempRoot();
    writeValidProject(root);
    writeProjectFile(
      root,
      'src/features/message/pages/message-history-dispatch-page.tsx',
      'no ledger reference here\n'
    );

    const result = evaluateMessageHistoryBoundary({ rootDir: root });

    expect(result.failures).toContain(
      'src/features/message/pages/message-history-dispatch-page.tsx must reference notification_dispatches.'
    );
  });

  it('fails when stale message history table candidates reappear', () => {
    const root = createTempRoot();
    writeValidProject(root);
    writeProjectFile(root, 'docs/specs/stale.md', 'message_histories message_history_recipients\n');

    const result = evaluateMessageHistoryBoundary({ rootDir: root });

    expect(result.failures).toContain(
      'docs/specs/stale.md still references stale message history table candidate message_histories.'
    );
    expect(result.failures).toContain(
      'docs/specs/stale.md still references stale message history table candidate message_history_recipients.'
    );
  });

  it('fails when the shared v13 owner-read decision is not documented', () => {
    const root = createTempRoot();
    writeValidProject(root);
    writeProjectFile(
      root,
      'docs/architecture/shared-supabase-schema-ownership.md',
      'notification_dispatches notification_delivery_attempts\n'
    );

    const result = evaluateMessageHistoryBoundary({ rootDir: root });

    expect(result.failures).toContain('docs/architecture/shared-supabase-schema-ownership.md must reference v13 X-09.');
  });

  it('fails when admin dispatch attempt reads are changed to user-scoped reads', () => {
    const root = createTempRoot();
    writeValidProject(root);
    writeProjectFile(
      root,
      'src/features/message/api/notification-supabase-adapter.ts',
      `
export async function loadNotificationDispatches() {
  return client.from('notification_dispatches').limit(200);
}
export async function loadNotificationDispatchAttempts(dispatchId) {
  return client.from('notification_delivery_attempts').eq('dispatch_id', dispatchId).eq('user_id', 'user-1');
}
`
    );

    const result = evaluateMessageHistoryBoundary({ rootDir: root });

    expect(result.failures).toContain(
      'src/features/message/api/notification-supabase-adapter.ts loadNotificationDispatchAttempts must not filter by user_id; topik-ai admin detail reads are dispatch-scoped.'
    );
  });
});
