import { readFileSync } from 'node:fs';

import { stripOuterTransaction } from '../db/migrate-core.mjs';
import { queryPsql, runPsql, sqlLiteral } from './shadow-psql.mjs';

// 알림 카탈로그·발송 파이프라인·재생 불변 검증 — 분해로 run-shadow-contract.mjs 에서
// 이동(동작 동일). 재생 전후 스냅샷 비교까지 한 묶음이라 함께 옮긴다.
// 감사 로그 민감정보 게이트(verifyAuditSensitiveDataGate)는 소스 텍스트 계약 테스트가
// run-shadow-contract.mjs 를 직접 검사하므로 그대로 남겼다.

export function verifyNotificationCatalog(containerName) {
  runPsql(containerName, `
do $$
declare
  v_table text;
  v_owner text;
  v_rls boolean;
  v_force boolean;
  v_signature text;
  v_expected_definer boolean;
  v_actual_definer boolean;
  v_overloads int;
  v_defaults int;
begin
  foreach v_table in array array[
    'notification_templates',
    'notification_groups',
    'notification_dispatches',
    'notification_delivery_attempts',
    'notification_email_config'
  ] loop
    select pg_get_userbyid(c.relowner), c.relrowsecurity, c.relforcerowsecurity
      into v_owner, v_rls, v_force
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = v_table and c.relkind = 'r';
    if not found then
      raise exception 'notification table missing: %', v_table;
    end if;
    if v_owner <> 'postgres' or not v_rls or not v_force then
      raise exception 'notification table owner/RLS drift: % owner=% rls=% force=%',
        v_table, v_owner, v_rls, v_force;
    end if;
    if has_table_privilege('anon', format('public.%I', v_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('anon', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', v_table), 'DELETE') then
      raise exception 'anon notification table grant drift: %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'authenticated notification write grant drift: %', v_table;
    end if;
    if v_table = 'notification_email_config' then
      if has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
        raise exception 'authenticated email config read grant drift';
      end if;
    elsif not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'authenticated notification read grant missing: %', v_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', v_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', v_table), 'DELETE') then
      raise exception 'service_role notification grant drift: %', v_table;
    end if;
  end loop;

  for v_signature, v_expected_definer in
    select * from (values
      ('private.render_notification_text(text,text)', false),
      ('private.dispatch_scheduled_notifications(text,text)', true),
      ('private.dispatch_admin_notifications()', true),
      ('private.dispatch_notification_event(text,uuid,text,jsonb,text)', true),
      ('private.dispatch_notifications()', true),
      ('private.notification_email_transport(text,text,text,uuid)', true),
      ('private.finalize_email_attempt(uuid,text,text,text)', true),
      ('private.retry_failed_email_attempts()', true),
      ('private.is_marketing_consented(uuid)', true)
    ) as expected(signature, security_definer)
  loop
    select p.prosecdef
      into v_actual_definer
      from pg_proc p
     where p.oid = to_regprocedure(v_signature)
       and pg_get_userbyid(p.proowner) = 'postgres';
    if not found or v_actual_definer <> v_expected_definer then
      raise exception 'notification function owner/security drift: %', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'EXECUTE')
       or has_function_privilege('authenticated', v_signature, 'EXECUTE') then
      raise exception 'client notification execute grant drift: %', v_signature;
    end if;
  end loop;

  -- Each dispatch function must keep exactly one overload with its parameter
  -- defaults intact: a second overload makes 1-arg/4-arg call forms ambiguous
  -- (42725), and a defaults-less core cannot replay over the live databases (42P13).
  select count(*) into v_overloads
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'dispatch_notification_event';
  select pronargdefaults into v_defaults
    from pg_proc
   where oid = to_regprocedure('private.dispatch_notification_event(text,uuid,text,jsonb,text)');
  if v_overloads <> 1 or v_defaults is distinct from 2 then
    raise exception 'dispatch_notification_event overload contract drift: overloads=% defaults=%',
      v_overloads, v_defaults;
  end if;

  select count(*) into v_overloads
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'dispatch_scheduled_notifications';
  select pronargdefaults into v_defaults
    from pg_proc
   where oid = to_regprocedure('private.dispatch_scheduled_notifications(text,text)');
  if v_overloads <> 1 or v_defaults is distinct from 1 then
    raise exception 'dispatch_scheduled_notifications overload contract drift: overloads=% defaults=%',
      v_overloads, v_defaults;
  end if;

  if to_regclass('cron.job') is null or not exists (
    select 1 from cron.job
     where jobname = 'dispatch_notifications'
       and schedule = '*/10 * * * *'
       and active
  ) then
    raise exception 'dispatch_notifications cron contract missing';
  end if;
end
$$;
`);
}

export function exerciseNotificationPipeline(containerName, memberId) {
  runPsql(containerName, `
update public.profiles
   set notification_prefs = coalesce(notification_prefs, '{}'::jsonb)
     || '{"study_reminder":true,"feedback_ready":true}'::jsonb
 where id = ${sqlLiteral(memberId)}::uuid;

insert into public.notification_settings
  (user_id, reminder_time, reminder_days, channels, timezone)
values
  (${sqlLiteral(memberId)}::uuid, time '00:00',
   jsonb_build_array(extract(dow from (now() at time zone 'UTC'))::int),
   '{"in_app":true,"email":true,"zalo":false}'::jsonb, 'UTC')
on conflict (user_id) do update
set reminder_time = excluded.reminder_time,
    reminder_days = excluded.reminder_days,
    channels = excluded.channels,
    timezone = excluded.timezone;

update public.notification_templates
   set status = 'active'
 where template_key in ('study_reminder', 'feedback_ready')
   and channel in ('in_app', 'email');
update public.notification_email_config set mode = 'live' where id = true;

do $$
declare
  v_template_id uuid;
  v_dispatch_id uuid;
  v_attempts bigint;
  v_inbox bigint;
begin
  select id into v_template_id
    from public.notification_templates
   where template_key = 'notice' and channel = 'in_app' and status = 'active'
   limit 1;
  if v_template_id is null then
    raise exception 'active notice in_app template missing';
  end if;

  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, actor_id, reason, dedupe_key, started_at)
  values
    (v_template_id, 'notice', '["in_app"]'::jsonb, 'test', 'running',
     ${sqlLiteral(memberId)}::uuid, 'shadow notification contract',
     'shadow:admin-test:' || ${sqlLiteral(memberId)}, now())
  returning id into v_dispatch_id;
  perform private.dispatch_admin_notifications();
  select count(*) into v_attempts from public.notification_delivery_attempts
   where dispatch_id = v_dispatch_id and user_id = ${sqlLiteral(memberId)}::uuid
     and channel = 'in_app' and status = 'sent';
  select count(*) into v_inbox from public.user_notifications
   where user_id = ${sqlLiteral(memberId)}::uuid and delivery_attempt_id in (
     select id from public.notification_delivery_attempts where dispatch_id = v_dispatch_id
   );
  if v_attempts <> 1 or v_inbox <> 1 then
    raise exception 'admin test dispatch contract failed: attempts=% inbox=%', v_attempts, v_inbox;
  end if;
  perform private.dispatch_admin_notifications();
  if (select count(*) from public.notification_delivery_attempts where dispatch_id = v_dispatch_id) <> 1 then
    raise exception 'admin test dispatch was duplicated';
  end if;

  perform private.dispatch_scheduled_notifications('study_reminder', 'in_app');
  perform private.dispatch_scheduled_notifications('study_reminder', 'in_app');
  if (select count(*) from public.notification_delivery_attempts
       where user_id = ${sqlLiteral(memberId)}::uuid
         and template_key = 'study_reminder' and channel = 'in_app') <> 1 then
    raise exception 'scheduled in_app dedupe contract failed';
  end if;

  perform private.dispatch_scheduled_notifications('study_reminder', 'email');
  perform private.dispatch_scheduled_notifications('study_reminder', 'email');
  if (select count(*) from public.notification_delivery_attempts
       where user_id = ${sqlLiteral(memberId)}::uuid
         and template_key = 'study_reminder' and channel = 'email' and status = 'pending') <> 1 then
    raise exception 'email live defer/dedupe contract failed';
  end if;

  perform private.dispatch_notification_event(
    'feedback_ready', ${sqlLiteral(memberId)}::uuid, 'shadow-feedback-ready',
    '{"link_url":"/shadow-feedback"}'::jsonb, 'in_app');
  perform private.dispatch_notification_event(
    'feedback_ready', ${sqlLiteral(memberId)}::uuid, 'shadow-feedback-ready',
    '{"link_url":"/shadow-feedback"}'::jsonb, 'in_app');
  if (select count(*) from public.notification_delivery_attempts
       where user_id = ${sqlLiteral(memberId)}::uuid
         and template_key = 'feedback_ready' and channel = 'in_app' and status = 'sent') <> 1 then
    raise exception 'feedback_ready event dedupe contract failed';
  end if;

  -- The defaulted single overloads must accept every documented call form without
  -- 42725 ambiguity (5-arg and 2-arg forms are exercised above).
  perform private.dispatch_notification_event(
    'feedback_ready', ${sqlLiteral(memberId)}::uuid, 'shadow-feedback-ready-arity4',
    '{"link_url":"/shadow-feedback-arity4"}'::jsonb);
  perform private.dispatch_notification_event(
    'feedback_ready', ${sqlLiteral(memberId)}::uuid, 'shadow-feedback-ready-arity3');
  perform private.dispatch_scheduled_notifications('study_reminder');
  if (select count(*) from public.notification_delivery_attempts
       where user_id = ${sqlLiteral(memberId)}::uuid
         and template_key = 'feedback_ready' and channel = 'in_app' and status = 'sent'
         and dedupe_key like '%:shadow-feedback-ready-arity%') <> 2 then
    raise exception 'defaulted dispatch call-form contract failed';
  end if;
end
$$;
`);
}

export function notificationDataSnapshot(containerName) {
  const value = queryPsql(containerName, `
select jsonb_build_object(
  'templates', (select count(*) from public.notification_templates),
  'groups', (select count(*) from public.notification_groups),
  'dispatches', (select count(*) from public.notification_dispatches),
  'attempts', (select count(*) from public.notification_delivery_attempts),
  'inbox', (select count(*) from public.user_notifications),
  'email_config', (select count(*) from public.notification_email_config),
  'email_mode', (select mode from public.notification_email_config where id = true),
  'fail_user_id', (select fail_user_id from public.notification_email_config where id = true)
)::text;
`);
  return JSON.parse(value);
}

export function verifyNotificationMigrationReplay(containerName, migrationPath, memberId) {
  verifyNotificationCatalog(containerName);
  exerciseNotificationPipeline(containerName, memberId);
  const before = notificationDataSnapshot(containerName);
  const migrationSql = stripOuterTransaction(readFileSync(migrationPath, 'utf8'));
  runPsql(containerName, `begin;\n${migrationSql}\ncommit;`);
  verifyNotificationCatalog(containerName);
  const after = notificationDataSnapshot(containerName);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Notification migration changed data on replay: ${JSON.stringify({ before, after })}`);
  }
  return { clean: true, before, after };
}
