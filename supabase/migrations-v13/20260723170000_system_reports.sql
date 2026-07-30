-- Private user-submitted system reports. The user app is the sole submission
-- boundary and calls the service-role-only RPC after validating a small,
-- privacy-reviewed diagnostics allowlist.

create table if not exists private.system_reports (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique
    default ('SR-' || upper(encode(gen_random_bytes(8), 'hex'))),
  idempotency_key uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  category text not null
    check (category in ('bug', 'question', 'suggestion')),
  email text not null
    check (
      char_length(email) between 3 and 254
      and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ),
  title text not null
    check (char_length(title) between 1 and 120 and title = btrim(title)),
  message text not null
    check (char_length(message) between 1 and 4000 and message = btrim(message)),
  pathname text not null
    check (
      left(pathname, 1) = '/'
      and position('?' in pathname) = 0
      and position('#' in pathname) = 0
    ),
  browser text not null
    check (browser in ('chrome', 'safari', 'firefox', 'edge', 'other')),
  os text not null
    check (os in ('windows', 'macos', 'ios', 'android', 'linux', 'other')),
  device_type text not null
    check (device_type in ('desktop', 'tablet', 'mobile', 'unknown')),
  viewport_width integer not null check (viewport_width >= 0),
  viewport_height integer not null check (viewport_height >= 0),
  locale text not null check (locale in ('ko', 'en', 'vi')),
  app_version text
    check (
      app_version is null
      or char_length(app_version) between 1 and 12
    ),
  created_at timestamptz not null default now(),
  constraint system_reports_reference_code_format
    check (reference_code ~ '^SR-[0-9A-F]{16}$')
);

alter table private.system_reports enable row level security;
alter table private.system_reports force row level security;

revoke all on table private.system_reports from public;
revoke all on table private.system_reports from anon;
revoke all on table private.system_reports from authenticated;
revoke all on table private.system_reports from service_role;

create or replace function public.submit_system_report(
  p_idempotency_key uuid,
  p_user_id uuid,
  p_category text,
  p_email text,
  p_title text,
  p_message text,
  p_pathname text,
  p_browser text,
  p_os text,
  p_device_type text,
  p_viewport_width integer,
  p_viewport_height integer,
  p_locale text,
  p_app_version text
)
returns table (
  reference_code text,
  created_at timestamptz,
  inserted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_report private.system_reports%rowtype;
  v_inserted boolean;
begin
  insert into private.system_reports (
    idempotency_key,
    user_id,
    category,
    email,
    title,
    message,
    pathname,
    browser,
    os,
    device_type,
    viewport_width,
    viewport_height,
    locale,
    app_version
  )
  values (
    p_idempotency_key,
    p_user_id,
    p_category,
    p_email,
    p_title,
    p_message,
    p_pathname,
    p_browser,
    p_os,
    p_device_type,
    p_viewport_width,
    p_viewport_height,
    p_locale,
    p_app_version
  )
  on conflict (idempotency_key) do nothing
  returning * into v_report;

  if found then
    v_inserted := true;
  else
    select report.*
      into strict v_report
    from private.system_reports report
    where report.idempotency_key = p_idempotency_key;
    v_inserted := false;
  end if;

  return query
  select v_report.reference_code, v_report.created_at, v_inserted;
end;
$$;

revoke all on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) from public;
revoke all on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) from anon;
revoke all on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) from authenticated;
revoke all on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) from service_role;
grant execute on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) to service_role;

comment on table private.system_reports is
  'Private system reports submitted through the validated user-app boundary.';
comment on function public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
) is
  'Atomically inserts or returns a system report by idempotency key. Service role only.';
