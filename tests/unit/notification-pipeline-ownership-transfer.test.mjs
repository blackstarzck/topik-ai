import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { describe, expect, it } from 'vitest';

const MIGRATION = join(
  process.cwd(),
  'supabase',
  'migrations-admin',
  '20260723011242_notification_pipeline_ownership_transfer.sql'
);
const DOWN = join(
  process.cwd(),
  'supabase',
  'migrations-admin',
  'down',
  '20260723011242_notification_pipeline_ownership_transfer.sql'
);

const sql = readFileSync(MIGRATION, 'utf8');
const downSql = readFileSync(DOWN, 'utf8');

describe('notification pipeline ownership transfer migration', () => {
  it('fails closed unless both repositories replay their prerequisite objects first', () => {
    for (const relation of [
      'public.profiles',
      'public.notification_settings',
      'public.user_notifications',
      'public.user_marketing_consent',
      'public.notification_templates',
      'public.notification_groups',
      'public.notification_dispatches',
      'public.notification_delivery_attempts'
    ]) {
      expect(sql).toContain(`'${relation}'`);
    }
    expect(sql).toContain("to_regnamespace('private')");
  });

  it('owns the complete dispatcher and email pipeline final state', () => {
    for (const functionName of [
      'render_notification_text',
      'dispatch_scheduled_notifications',
      'dispatch_admin_notifications',
      'dispatch_notification_event',
      'retry_failed_email_attempts',
      'notification_email_transport',
      'finalize_email_attempt',
      'is_marketing_consented',
      'dispatch_notifications'
    ]) {
      expect(sql).toContain(`function private.${functionName}`);
    }
    expect(sql).toContain('create table if not exists public.notification_email_config');
    expect(sql).toContain("perform cron.unschedule(v_jobid)");
    expect(sql).toContain("perform cron.schedule(");
    expect(sql).toContain("to_regprocedure('cron.schedule(text,text,text)')");
    expect(sql).not.toMatch(/\b(?:update|insert\s+into|delete\s+from)\s+cron\.job\b/iu);
    expect(sql).not.toMatch(/\bdrop\s+function\b/iu);
    expect(sql).toContain(
      'revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text)'
    );
  });

  it('converges dispatch overloads to the live single-function contract', () => {
    const eventDefinitions = sql.match(
      /create or replace function private\.dispatch_notification_event\(/g
    ) ?? [];
    expect(eventDefinitions).toHaveLength(3);
    expect(sql.match(/p_payload\s+jsonb\s+default '\{\}'::jsonb/g) ?? []).toHaveLength(3);
    expect(sql.match(/p_channel\s+text\s+default null/g) ?? []).toHaveLength(3);

    const scheduledDefinitions = sql.match(
      /create or replace function private\.dispatch_scheduled_notifications\(/g
    ) ?? [];
    expect(scheduledDefinitions).toHaveLength(2);
    expect(sql.match(/p_channel\s+text\s+default 'in_app'/g) ?? []).toHaveLength(2);

    // Legacy 1-arg/4-arg overloads must never be (re)declared: next to the defaulted
    // core signatures they make 1-arg and 4-arg call forms ambiguous (42725), and
    // replaying them over the live database removed parameter defaults (42P13).
    expect(sql).not.toMatch(
      /function private\.dispatch_scheduled_notifications\(\s*p_template_key\s+text\s*\)/iu
    );
    expect(sql).not.toContain('private.dispatch_scheduled_notifications(text)');
    expect(sql).not.toContain('private.dispatch_notification_event(text, uuid, text, jsonb)');
  });

  it('converges RLS and Data API grants without exposing write access to clients', () => {
    expect(sql).toContain('alter table public.notification_email_config force row level security');
    expect(sql).toContain('to authenticated;');
    expect(sql).toContain('from authenticated;');
    expect(sql).toContain('to service_role;');
    expect(sql).toContain('from public, anon;');
  });

  it('does not delete or reseed operational notification data', () => {
    expect(sql).not.toMatch(/\b(?:delete\s+from|truncate\s+(?:table\s+)?)public\.notification_/iu);
    expect(sql).toContain('on conflict (id) do nothing');
    expect(downSql).not.toMatch(/\b(?:drop|delete|truncate|alter)\b/iu);
    expect(downSql).toContain('roll-forward only');
  });

  it('does not take DDL ownership of v13 user notification tables', () => {
    expect(sql).not.toMatch(
      /\b(?:create|alter|drop|truncate)\s+(?:table\s+)?(?:if\s+(?:not\s+)?exists\s+)?public\.(?:profiles|notification_settings|user_notifications|user_marketing_consent)\b/iu
    );
  });
});
