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
    { table_name: 'notification_templates', exists_now: true },
    { table_name: 'notification_groups', exists_now: true },
    { table_name: 'notification_dispatches', exists_now: true },
    { table_name: 'notification_delivery_attempts', exists_now: true },
    { table_name: 'notification_email_config', exists_now: true },
    { table_name: 'notification_settings', exists_now: true },
    { table_name: 'user_notifications', exists_now: true },
    { table_name: 'user_marketing_consent', exists_now: true }
  ],
  admin_table_contract: [
    'notification_templates',
    'notification_groups',
    'notification_dispatches',
    'notification_delivery_attempts',
    'notification_email_config'
  ].map((table_name) => ({
    table_name,
    owner_name: 'postgres',
    rls_enabled: true,
    rls_forced: true,
    anon_select: false,
    authenticated_select: table_name !== 'notification_email_config',
    authenticated_write: false,
    service_role_select: true,
    service_role_write: true
  })),
  function_contract: [
    'render_notification_text',
    'dispatch_scheduled_notifications_compat',
    'dispatch_scheduled_notifications',
    'dispatch_admin_notifications',
    'dispatch_notification_event_compat',
    'dispatch_notification_event',
    'retry_failed_email_attempts',
    'notification_email_transport',
    'finalize_email_attempt',
    'is_marketing_consented',
    'dispatch_notifications'
  ].map((function_name) => ({
    function_name,
    exists_now: true,
    owner_name: 'postgres',
    security_definer: function_name !== 'render_notification_text',
    expected_security_definer: function_name !== 'render_notification_text',
    public_execute: false,
    anon_execute: false,
    authenticated_execute: false
  })),
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
    expect(sql).toContain('notification_templates');
    expect(sql).toContain('notification_groups');
    expect(sql).toContain('notification_delivery_attempts');
    expect(sql).toContain('notification_email_config');
    expect(sql).toContain('notification_settings');
    expect(sql).toContain('user_notifications');
    expect(sql).toContain('user_marketing_consent');
    expect(sql).toContain('to_regprocedure');
    expect(sql).toContain('has_function_privilege');
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
        { table_name: 'notification_templates', exists_now: true },
        { table_name: 'notification_groups', exists_now: true },
        { table_name: 'notification_dispatches', exists_now: true },
        { table_name: 'notification_delivery_attempts', exists_now: false },
        { table_name: 'notification_email_config', exists_now: true },
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

  it('fails closed for owner, RLS, grants, and function exposure drift', () => {
    const evaluation = evaluateCrossAppStateResult({
      ...COMPLETE_RESULT,
      admin_table_contract: COMPLETE_RESULT.admin_table_contract.map((entry) =>
        entry.table_name === 'notification_templates'
          ? { ...entry, owner_name: 'unexpected', rls_forced: false, anon_select: true }
          : entry
      ),
      function_contract: COMPLETE_RESULT.function_contract.map((entry) =>
        entry.function_name === 'dispatch_notifications'
          ? { ...entry, authenticated_execute: true }
          : entry
      )
    });

    expect(evaluation.failures).toEqual(expect.arrayContaining([
      'Unexpected owner for notification_templates.',
      'RLS is not forced for notification_templates.',
      'anon can select notification_templates.',
      'Client EXECUTE privilege is exposed for dispatch_notifications.'
    ]));
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
