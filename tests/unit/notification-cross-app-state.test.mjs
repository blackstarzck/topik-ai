import { describe, expect, it } from 'vitest';

import {
  buildCrossAppStateSql,
  evaluateCrossAppStateResult,
  formatCrossAppStateReport,
  runNotificationCrossAppStateCheck,
  runSupabaseSql
} from '../../scripts/check-notification-cross-app-state.mjs';

const COMPLETE_RESULT = {
  table_presence: [
    { table_name: 'notification_dispatches', exists_now: true },
    { table_name: 'notification_delivery_attempts', exists_now: true },
    { table_name: 'notification_settings', exists_now: true },
    { table_name: 'user_notifications', exists_now: true },
    { table_name: 'user_marketing_consent', exists_now: true }
  ],
  attempt_summary: {
    total_count: 3,
    distinct_user_count: 2,
    distinct_dispatch_count: 1,
    sent_count: 1,
    pending_count: 1,
    failed_count: 1
  },
  dispatch_summary: {
    total_count: 1,
    open_count: 0,
    terminal_count: 1
  },
  recent_attempts: [
    { id: 'attempt-secret-id', status: 'sent', has_sent_at: true },
    { id: 'attempt-pending-id', status: 'pending', has_sent_at: false }
  ]
};

describe('check-notification-cross-app-state', () => {
  it('builds SQL that checks topik-ai and v13 shared notification tables', () => {
    const sql = buildCrossAppStateSql();

    expect(sql).toContain('notification_dispatches');
    expect(sql).toContain('notification_delivery_attempts');
    expect(sql).toContain('notification_settings');
    expect(sql).toContain('user_notifications');
    expect(sql).toContain('user_marketing_consent');
  });

  it('passes when required tables exist and recent attempt timestamps match status', () => {
    const evaluation = evaluateCrossAppStateResult(COMPLETE_RESULT);

    expect(evaluation.failures).toEqual([]);
    expect(formatCrossAppStateReport(evaluation)).toContain('[notification-cross-app-state] PASS');
  });

  it('fails closed for missing tables and inconsistent recent attempt timestamps without leaking row ids', () => {
    const evaluation = evaluateCrossAppStateResult({
      ...COMPLETE_RESULT,
      table_presence: [
        { table_name: 'notification_dispatches', exists_now: true },
        { table_name: 'notification_delivery_attempts', exists_now: false },
        { table_name: 'notification_settings', exists_now: true },
        { table_name: 'user_notifications', exists_now: true },
        { table_name: 'user_marketing_consent', exists_now: true }
      ],
      recent_attempts: [
        { id: 'secret-sent-id', status: 'sent', has_sent_at: false },
        { id: 'secret-pending-id', status: 'pending', has_sent_at: true }
      ]
    });
    const report = formatCrossAppStateReport(evaluation);

    expect(evaluation.failures).toContain('Missing required table: notification_delivery_attempts');
    expect(evaluation.failures).toContain('A recent sent attempt is missing sent_at.');
    expect(evaluation.failures).toContain('A recent non-sent attempt has sent_at.');
    expect(report).not.toContain('secret-sent-id');
    expect(report).not.toContain('secret-pending-id');
  });

  it('calls the Supabase Management API without printing the access token', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ result: COMPLETE_RESULT }])
      };
    };

    const result = await runSupabaseSql({
      fetchImpl,
      projectRef: 'project-ref',
      accessToken: 'secret-token',
      sql: 'select 1'
    });

    expect(result).toEqual(COMPLETE_RESULT);
    expect(calls[0].url).toBe('https://api.supabase.com/v1/projects/project-ref/database/query');
    expect(calls[0].init.headers.Authorization).toBe('Bearer secret-token');
    expect(formatCrossAppStateReport(evaluateCrossAppStateResult(result))).not.toContain('secret-token');
  });

  it('runs the full check with injected env and fetch implementation', async () => {
    const evaluation = await runNotificationCrossAppStateCheck({
      rootDir: process.cwd(),
      env: {
        SUPABASE_PROJECT_REF: 'project-ref',
        SUPABASE_ACCESS_TOKEN: 'secret-token'
      },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ result: COMPLETE_RESULT })
      })
    });

    expect(evaluation.failures).toEqual([]);
  });
});
