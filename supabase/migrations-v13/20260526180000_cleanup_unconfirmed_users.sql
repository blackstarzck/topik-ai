-- =====================================================================
-- TALKPIK AI · Phase 8-B · Unconfirmed user retention policy
--
-- Deletes auth.users with email_confirmed_at IS NULL and created_at older
-- than retention_days. Storage objects owned by victims are removed first
-- to avoid the "auth user owning storage objects cannot be deleted" failure.
-- public.profiles is removed via existing FK ON DELETE CASCADE (verified
-- invariant 2026-05-26).
--
-- Default retention 30 days. dry_run mode returns count without deleting.
-- max_batch caps per-call deletes to prevent runaway.
--
-- Function lives in private schema (already used by private.is_admin)
-- to avoid exposure through PostgREST. SECURITY DEFINER with locked
-- search_path so it can delete auth.users / storage.objects regardless of
-- caller role; revoked from public/anon/authenticated.
-- =====================================================================

create or replace function private.cleanup_unconfirmed_users(
  retention_days int default 30,
  dry_run boolean default false,
  max_batch int default 1000
)
returns int
language plpgsql security definer
set search_path = pg_catalog, public, auth, storage
as $$
declare
  victim_ids uuid[];
  deleted_count int;
begin
  if retention_days < 1 then
    raise exception 'retention_days must be >= 1 (got %)', retention_days;
  end if;
  if max_batch < 1 then
    raise exception 'max_batch must be >= 1 (got %)', max_batch;
  end if;

  select array_agg(id) into victim_ids
  from (
    select id from auth.users
    where email_confirmed_at is null
      and created_at < now() - make_interval(days => retention_days)
      and is_sso_user = false
    order by created_at
    limit max_batch
  ) sub;

  deleted_count := coalesce(array_length(victim_ids, 1), 0);

  if dry_run then
    raise log 'cleanup_unconfirmed_users dry_run: would delete % users older than % days',
      deleted_count, retention_days;
    return deleted_count;
  end if;

  if deleted_count > 0 then
    -- Storage objects first (Auth user delete conflict prevention; Codex Round 2 NF3)
    delete from storage.objects where owner = any(victim_ids);

    -- public.profiles auto-removed via FK ON DELETE CASCADE (verified invariant 2026-05-26)
    delete from auth.users where id = any(victim_ids);

    raise log 'cleanup_unconfirmed_users: deleted % users older than % days',
      deleted_count, retention_days;
  end if;

  return deleted_count;
end;
$$;

revoke all on function private.cleanup_unconfirmed_users(int, boolean, int)
  from public, anon, authenticated;

comment on function private.cleanup_unconfirmed_users(int, boolean, int) is
  'Delete unconfirmed auth.users older than N days (default 30) and their owned storage objects. '
  'SECURITY DEFINER with locked search_path. dry_run=true returns count without deleting. '
  'max_batch caps deletes per call. profiles row removed via FK ON DELETE CASCADE.';
