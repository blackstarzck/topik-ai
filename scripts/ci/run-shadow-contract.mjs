#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  inspectStaticMigrationContract,
  listLocalMigrations,
  stripOuterTransaction,
} from '../db/migrate-core.mjs';
import { verifyUsersContract } from '../db/verify-users-contract.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURE = {
  adminEmail: 'shadow-admin@example.invalid',
  memberEmail: 'shadow-member@example.invalid',
};
const V13_SHADOW_EXCLUDED_MIGRATIONS = new Set([
  // This historical migration inserts 466 UI fixtures without canonical
  // topik_writing source-map rows. Production data was cut over by ETL, while
  // the shadow database intentionally verifies schema/RPC contracts only.
  '20260608120200_seed_writing_problem_fixtures.sql',
]);
const V13_SHADOW_COMPATIBILITY_STEPS = [
  'drop-retired-writing-runtime-unserialized-implementation',
];
const SHA_PATTERN = /^[0-9a-f]{40}$/;

// Upgrade delta = entries of the current release plan that the N-1 plan did not
// contain, keyed by (source, name). Known limit: a file rewritten in place under
// scripts/db/manifests/unapplied-rewrites.json keeps its name, so the shadow keeps
// the N-1 content for it — the tracker checksum remains the fail-closed guard for
// real applications.
export function computeUpgradeDelta(currentEntries, previousEntries) {
  const previousKeys = new Set(previousEntries.map((entry) => `${entry.source}\t${entry.name}`));
  return currentEntries.filter((entry) => !previousKeys.has(`${entry.source}\t${entry.name}`));
}

export function extractV13Pin(workflowText) {
  const match = /V13_CONTRACT_SHA:\s*([0-9a-f]{40})/.exec(workflowText ?? '');
  if (!match) throw new Error('The N-1 tree does not pin V13_CONTRACT_SHA.');
  return match[1];
}

function prepareUpgradeBase({ upgradeFrom, v13Dir, currentV13Sha }) {
  if (!SHA_PATTERN.test(upgradeFrom)) {
    throw new Error('--upgrade-from must be a 40-hex commit SHA.');
  }
  try {
    run('git', ['merge-base', '--is-ancestor', upgradeFrom, 'HEAD']);
  } catch {
    throw new Error(
      `--upgrade-from ${upgradeFrom} is not an ancestor of HEAD — the company release history has diverged; investigate before promoting.`
    );
  }
  const cleanups = [];
  const n1Root = mkdtempSync(join(tmpdir(), 'topik-ai-n1-'));
  cleanups.push(() => rmSync(n1Root, { recursive: true, force: true }));
  const n1Path = join(n1Root, 'tree');
  run('git', ['worktree', 'add', '--detach', n1Path, upgradeFrom]);
  cleanups.push(() => run('git', ['worktree', 'remove', '--force', n1Path]));

  const v13Pin = extractV13Pin(
    readFileSync(join(n1Path, '.github', 'workflows', 'release-development.yml'), 'utf8')
  );
  let v13BaseDir = v13Dir;
  if (v13Pin !== currentV13Sha) {
    run('git', ['-C', v13Dir, 'fetch', 'origin', v13Pin]);
    const v13Root = mkdtempSync(join(tmpdir(), 'topik-ai-n1-v13-'));
    cleanups.push(() => rmSync(v13Root, { recursive: true, force: true }));
    v13BaseDir = join(v13Root, 'tree');
    run('git', ['-C', v13Dir, 'worktree', 'add', '--detach', v13BaseDir, v13Pin]);
    cleanups.push(() => run('git', ['-C', v13Dir, 'worktree', 'remove', '--force', v13BaseDir]));
  }

  const writingFiles = loadReleaseMigrations(
    join(n1Path, 'scripts', 'db', 'manifests', 'writing-production-cutover.json'),
    join(n1Path, 'supabase', 'migrations')
  );
  const adminFiles = loadReleaseMigrations(
    join(n1Path, 'scripts', 'db', 'manifests', 'admin-production-cutover.json'),
    join(n1Path, 'supabase', 'migrations-admin')
  );
  const plan = buildMigrationPlan(v13BaseDir, writingFiles, adminFiles);
  return {
    v13Pin,
    plan,
    cleanup: () => {
      for (const cleanup of cleanups.reverse()) {
        try {
          cleanup();
        } catch {
          // best-effort teardown; temp roots are removed recursively regardless
        }
      }
    }
  };
}

function getArgValue(args, flag) {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-8000);
    throw new Error(`${command} ${args.join(' ')} failed:\n${output}`);
  }
  return result.stdout ?? '';
}

function supabase(args) {
  return run('supabase', args);
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function loadReleaseMigrations(manifestPath, migrationsDir) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const localMigrations = listLocalMigrations(migrationsDir);
  const contract = inspectStaticMigrationContract({
    manifest,
    batchName: 'release-all',
    localMigrations,
    migrationsDir,
  });
  if (!contract.clean) throw new Error(`Static migration contract failed: ${manifestPath}`);
  return contract.entries.map((entry) => join(migrationsDir, entry.name));
}

function sourceMigrationFiles(source, migrationsDir, names) {
  return names.map((name) => ({ source, name, path: join(migrationsDir, name) }));
}

function buildMigrationPlan(v13Dir, writingFiles, adminFiles) {
  const v13MigrationsDir = join(v13Dir, 'supabase', 'migrations');
  const v13Files = sourceMigrationFiles(
    'v13',
    v13MigrationsDir,
    listLocalMigrations(v13MigrationsDir).filter(
      (name) => !V13_SHADOW_EXCLUDED_MIGRATIONS.has(name)
    )
  );
  const writing = writingFiles.map((path) => ({
    source: 'topik_writing',
    name: path.split(/[\\/]/).at(-1),
    path,
  }));
  const admin = adminFiles.map((path) => ({
    source: 'admin',
    name: path.split(/[\\/]/).at(-1),
    path,
  }));
  const sourceOrder = new Map([['v13', 0], ['topik_writing', 1], ['admin', 2]]);
  const all = [...v13Files, ...writing, ...admin].sort((left, right) => (
    left.name.slice(0, 14).localeCompare(right.name.slice(0, 14))
    || sourceOrder.get(left.source) - sourceOrder.get(right.source)
    || left.name.localeCompare(right.name)
  ));
  const fixtureAfter = all.findIndex(
    (entry) => entry.source === 'admin'
      && entry.name === '20260623200000_admin_accounts.sql'
  );
  if (fixtureAfter < 0) throw new Error('Admin account fixture seam is missing.');
  return {
    all,
    bootstrap: all.slice(0, fixtureAfter + 1),
    afterFixture: all.slice(fixtureAfter + 1),
    v13Count: v13Files.length,
  };
}

function generatedVersion(index) {
  const date = new Date(Date.UTC(2020, 0, 1, 0, 0, index));
  const digits = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ];
  return digits.join('');
}

function createShadowProject(v13Dir, bootstrapMigrations) {
  const workdir = mkdtempSync(join(tmpdir(), 'topik-ai-shadow-'));
  const projectId = `topik-ai-ci-shadow-${process.pid}`;
  const supabaseDir = join(workdir, 'supabase');
  const migrationsDir = join(supabaseDir, 'migrations');
  mkdirSync(migrationsDir, { recursive: true });
  const sourceConfig = join(v13Dir, 'supabase', 'config.toml');
  let config = readFileSync(sourceConfig, 'utf8');
  config = config.replace(
    /^project_id\s*=\s*"[^"]+"/m,
    `project_id = "${projectId}"`
  );
  config = config.replace(/(\[db\.seed\][\s\S]*?enabled\s*=\s*)true/, '$1false');
  writeFileSync(join(supabaseDir, 'config.toml'), config, 'utf8');
  bootstrapMigrations.forEach((entry, index) => {
    const suffix = entry.name.replace(/^\d{14}_/, '').replace(/[^a-z0-9_.-]/gi, '_');
    copyFileSync(
      entry.path,
      join(migrationsDir, `${generatedVersion(index)}_${entry.source}_${suffix}`)
    );
  });
  return { workdir, projectId };
}

function readSupabaseStatus(workdir) {
  const output = supabase(['status', '--output', 'json', '--workdir', workdir]);
  const status = JSON.parse(output);
  return {
    apiUrl: status.API_URL ?? status.api_url ?? status.api?.url,
    anonKey: status.ANON_KEY ?? status.anon_key ?? status.api?.anon_key,
    serviceRoleKey:
      status.SERVICE_ROLE_KEY ?? status.service_role_key ?? status.api?.service_role_key,
  };
}

function runPsql(containerName, sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
    ],
    { input: sql }
  );
}

function queryPsql(containerName, sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
    ],
    { input: sql }
  ).trim();
}

function verifyNotificationCatalog(containerName) {
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

function exerciseNotificationPipeline(containerName, memberId) {
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

function notificationDataSnapshot(containerName) {
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

function verifyNotificationMigrationReplay(containerName, migrationPath, memberId) {
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

function elevateShadowAdmin(containerName, adminId) {
  runPsql(containerName, `
do $$
begin
  execute 'alter table public.profiles disable trigger trg_profiles_protect_columns';
  update public.profiles
  set app_role = 'platform_admin', status = 'active'
  where id = ${sqlLiteral(adminId)}::uuid;
  execute 'alter table public.profiles enable trigger trg_profiles_protect_columns';
  if not exists (
    select 1 from public.profiles
    where id = ${sqlLiteral(adminId)}::uuid and app_role = 'platform_admin'
  ) then
    raise exception 'shadow admin profile elevation failed';
  end if;
exception when others then
  execute 'alter table public.profiles enable trigger trg_profiles_protect_columns';
  raise;
end $$;
`);
}

function prepareShadowWritingCutover(containerName) {
  runPsql(containerName, `
begin;
alter table private.writing_read_control
  disable trigger writing_runtime_transition_serialization;
update private.writing_read_control
set read_mode = 'canonical',
    submission_mode = 'blocked',
    changed_by = 'ci-shadow',
    change_reason = 'replay-final-cutover'
where singleton;
alter table private.writing_read_control
  enable trigger writing_runtime_transition_serialization;
do $$
begin
  if to_regclass('cron.job') is null then
    create schema if not exists cron;
    create table cron.job (
      jobid bigint generated always as identity primary key,
      schedule text not null,
      command text not null,
      database text not null default 'postgres',
      username text not null default 'postgres',
      active boolean not null default true,
      jobname text not null unique,
      nodename text not null default 'localhost',
      nodeport integer not null default 5432
    );
    create table cron.job_run_details (
      jobid bigint not null,
      end_time timestamptz
    );
    execute $function$
      create function cron.unschedule(p_job_id bigint)
      returns boolean
      language plpgsql
      as $body$
      begin
        delete from cron.job where jobid = p_job_id;
        return found;
      end
      $body$
    $function$;
    execute $function$
      create function cron.schedule(p_job_name text, p_schedule text, p_command text)
      returns bigint
      language plpgsql
      as $body$
      declare
        v_job_id bigint;
      begin
        insert into cron.job (jobname, schedule, command)
        values (p_job_name, p_schedule, p_command)
        returning jobid into v_job_id;
        return v_job_id;
      end
      $body$
    $function$;
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'sync-writing-problems'
  ) then
    insert into cron.job (jobname, schedule, command)
    values (
      'sync-writing-problems',
      '* * * * *',
      'select public.sync_available_writing_problems();'
    );
  end if;
end $$;
commit;
`);
}

function withV13ShadowCompatibility(entry, sql) {
  if (
    entry.source !== 'v13'
    || entry.name !== '20260714140000_writing_problem_identity_registry_cutover.sql'
  ) return sql;

  const marker = `drop function if exists private.set_writing_runtime_state(
  text, text, text, text, text, text
);`;
  if (!sql.includes(marker)) {
    throw new Error('Pinned v13 identity-cutover compatibility marker is missing.');
  }
  return sql.replace(
    marker,
    `${marker}
drop function if exists private.set_writing_runtime_state_unserialized_impl(
  text, text, text, text, text, text
);`
  );
}

async function createLocalUser({ apiUrl, serviceRoleKey, email, password }) {
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: email.split('@')[0] },
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.id) {
    throw new Error(`Local Auth fixture creation failed (${response.status}).`);
  }
  return body.id;
}

async function signIn({ apiUrl, anonKey, email, password }) {
  const response = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Local Auth sign-in failed (${response.status}).`);
  }
  return body.access_token;
}

async function callRpc({ apiUrl, anonKey, accessToken = null, name, body }) {
  return fetch(`${apiUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function verifyRpcRoles({ status, adminPassword, memberId }) {
  const accessToken = await signIn({
    ...status,
    email: FIXTURE.adminEmail,
    password: adminPassword,
  });
  const list = await callRpc({
    ...status,
    accessToken,
    name: 'get_admin_users',
    body: { search: null, sort: 'activity', page: 1, page_size: 50, affiliation: null },
  });
  const listRows = await list.json();
  if (!list.ok || !Array.isArray(listRows) || !listRows.some((row) => row.user_id === memberId)) {
    throw new Error(`Authenticated Users list RPC failed (${list.status}).`);
  }

  const detail = await callRpc({
    ...status,
    accessToken,
    name: 'get_admin_user',
    body: { target_user_id: memberId },
  });
  const detailRows = await detail.json();
  if (!detail.ok || !Array.isArray(detailRows) || detailRows[0]?.user_id !== memberId) {
    throw new Error(`Authenticated Users detail RPC failed (${detail.status}).`);
  }

  const exported = await callRpc({
    ...status,
    accessToken,
    name: 'admin_export_users',
    body: {
      p_reason: 'CI shadow contract verification',
      p_include_full_phone: false,
      p_affiliation: null,
      p_scope: 'selected',
      p_selected_user_ids: [memberId],
      p_search: null,
      p_search_field: 'all',
      p_start_date: null,
      p_end_date: null,
      p_gender_filters: [],
      p_tier_filters: [],
      p_subscription_status_filters: [],
      p_membership_status_filters: [],
      p_terms_consent_status_filters: [],
      p_email_verification_status_filters: [],
      p_selected_column_keys: ['id', 'email'],
    },
  });
  const exportRows = await exported.json();
  if (!exported.ok || !Array.isArray(exportRows) || exportRows[0]?.user_id !== memberId) {
    throw new Error(`Authenticated Users export RPC failed (${exported.status}).`);
  }

  const anonymous = await callRpc({
    ...status,
    name: 'get_admin_users',
    body: { search: null, sort: 'activity', page: 1, page_size: 1, affiliation: null },
  });
  if (anonymous.ok) throw new Error('Anonymous Users list RPC was not denied.');
  return {
    authenticatedList: true,
    authenticatedDetail: true,
    authenticatedExport: true,
    anonymousDenied: true,
  };
}

function applyMigrationFiles(entries, containerName) {
  entries.forEach((entry, index) => {
    if (
      entry.source === 'v13'
      && entry.name === '20260713084500_retire_writing_problem_mirror_cron.sql'
    ) {
      prepareShadowWritingCutover(containerName);
    }
    process.stdout.write(
      `[shadow:${entry.source}] ${index + 1}/${entries.length} ${entry.name} ... `
    );
    const migrationSql = withV13ShadowCompatibility(
      entry,
      stripOuterTransaction(readFileSync(entry.path, 'utf8'))
    );
    runPsql(containerName, `begin;\n${migrationSql}\ncommit;`);
    console.log('ok');
  });
}

async function main() {
  const args = process.argv.slice(2);
  const v13Dir = resolve(getArgValue(args, '--v13-dir') ?? '');
  const expectedV13Sha = getArgValue(args, '--v13-sha');
  const jsonOut = getArgValue(args, '--json-out');
  if (!expectedV13Sha) throw new Error('--v13-sha is required.');
  const actualV13Sha = execFileSync('git', ['-C', v13Dir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  if (actualV13Sha !== expectedV13Sha) {
    throw new Error(`v13 SHA mismatch: expected ${expectedV13Sha}, got ${actualV13Sha}.`);
  }
  const cliVersion = supabase(['--version']).trim();
  if (cliVersion !== '2.105.0') {
    throw new Error(`Supabase CLI 2.105.0 is required, got ${cliVersion}.`);
  }

  const writingFiles = loadReleaseMigrations(
    join(ROOT, 'scripts', 'db', 'manifests', 'writing-production-cutover.json'),
    join(ROOT, 'supabase', 'migrations')
  );
  const adminFiles = loadReleaseMigrations(
    join(ROOT, 'scripts', 'db', 'manifests', 'admin-production-cutover.json'),
    join(ROOT, 'supabase', 'migrations-admin')
  );
  const migrationPlan = buildMigrationPlan(v13Dir, writingFiles, adminFiles);
  const upgradeFrom = getArgValue(args, '--upgrade-from');
  const upgradeBase = upgradeFrom
    ? prepareUpgradeBase({ upgradeFrom, v13Dir, currentV13Sha: expectedV13Sha })
    : null;
  const activePlan = upgradeBase ? upgradeBase.plan : migrationPlan;
  const shadowProject = createShadowProject(v13Dir, activePlan.bootstrap);
  const shadowWorkdir = shadowProject.workdir;
  const password = `Shadow-${randomBytes(18).toString('base64url')}!9`;
  let started = false;
  try {
    supabase(['start', '--workdir', shadowWorkdir]);
    started = true;
    const dbContainer = run(
      'docker',
      [
        'ps',
        '--filter',
        `name=supabase_db_${shadowProject.projectId}`,
        '--format',
        '{{.Names}}',
      ]
    ).trim();
    if (!dbContainer) throw new Error('Supabase shadow database container was not found.');
    const status = readSupabaseStatus(shadowWorkdir);
    if (!status.apiUrl || !status.anonKey || !status.serviceRoleKey) {
      throw new Error('Supabase local status did not expose API credentials.');
    }
    const adminId = await createLocalUser({
      ...status,
      email: FIXTURE.adminEmail,
      password,
    });
    const memberId = await createLocalUser({
      ...status,
      email: FIXTURE.memberEmail,
      password,
    });
    elevateShadowAdmin(dbContainer, adminId);

    applyMigrationFiles(activePlan.afterFixture, dbContainer);
    let upgradeDelta = null;
    if (upgradeBase) {
      upgradeDelta = computeUpgradeDelta(migrationPlan.all, upgradeBase.plan.all);
      console.log(
        `[shadow:upgrade] N-1 ${upgradeFrom.slice(0, 7)} replayed; applying ${upgradeDelta.length} delta migration(s)`
      );
      applyMigrationFiles(upgradeDelta, dbContainer);
    }
    supabase([
      'db',
      'query',
      '--local',
      "notify pgrst, 'reload schema';",
      '--workdir',
      shadowWorkdir,
    ]);

    const contract = await verifyUsersContract({
      localWorkdir: shadowWorkdir,
      requireNoLegacyPhone: true,
    });
    if (!contract.clean) {
      throw new Error(`Shadow Users contract failed: ${contract.issues.join(', ')}`);
    }
    const rpc = await verifyRpcRoles({ status, adminPassword: password, memberId });
    const notification = verifyNotificationMigrationReplay(
      dbContainer,
      join(
        ROOT,
        'supabase',
        'migrations-admin',
        '20260723011242_notification_pipeline_ownership_transfer.sql'
      ),
      memberId
    );
    const report = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      mode: upgradeBase ? 'upgrade-replay' : 'fresh-replay',
      upgradeFrom: upgradeFrom ?? null,
      upgradeBaseV13Sha: upgradeBase?.v13Pin ?? null,
      upgradeDeltaCount: upgradeDelta ? upgradeDelta.length : null,
      v13CommitSha: actualV13Sha,
      supabaseCliVersion: cliVersion,
      v13MigrationCount: migrationPlan.v13Count,
      v13ExcludedFixtureMigrations: [...V13_SHADOW_EXCLUDED_MIGRATIONS],
      v13CompatibilitySteps: V13_SHADOW_COMPATIBILITY_STEPS,
      writingMigrationCount: writingFiles.length,
      adminMigrationCount: adminFiles.length,
      fingerprint: contract.fingerprint,
      contract: {
        clean: contract.clean,
        functionCount: contract.functionCount,
        requiredProfileColumnsPresent: contract.requiredProfileColumnsPresent,
        legacyProfilePhonePresent: contract.legacyProfilePhonePresent,
      },
      rpc,
      notification,
    };
    if (jsonOut) {
      const absolutePath = resolve(jsonOut);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    }
    console.log(`Shadow contract passed: fingerprint=${report.fingerprint}`);
  } finally {
    if (started) {
      run('supabase', ['stop', '--no-backup', '--workdir', shadowWorkdir]);
    }
    rmSync(shadowWorkdir, { recursive: true, force: true });
    upgradeBase?.cleanup();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
