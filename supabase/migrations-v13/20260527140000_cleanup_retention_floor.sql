-- =====================================================================
-- TALKPIK AI · Phase 8 follow-up v2.3 · 2026-05-27
-- cleanup_unconfirmed_users — retention_days < 30 보호 강화
--
-- v1 보고서가 "30일 미만 절대 안 건드림"이라고 주장했지만 #22 마이그레이션은
-- retention_days >= 1만 검증 → 호출자가 1로 줄여 호출하면 1일짜리 미인증 사용자도
-- 삭제 가능 (Codex GPT-5 자체 검수에서 적발, 2026-05-27).
--
-- 본 마이그레이션이 정공법으로 보호:
--   - retention_days < 30 + dry_run = false → raise exception (실 삭제 차단)
--   - retention_days < 30 + dry_run = true → 허용 (테스트/preview 용도, 삭제 안 함이라 안전)
--   - 기존 retention_days >= 1 최소 조건은 유지 (음수/0 차단)
--
-- create or replace function — #22 함수 재정의. 시그니처 동일.
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
  -- Phase 8 follow-up v2.3 (2026-05-27): 실 삭제는 30일 미만 차단. dry_run preview는 허용.
  if retention_days < 30 and not dry_run then
    raise exception 'retention_days must be >= 30 for real deletion (got %, dry_run=%). Use dry_run=true for shorter preview.', retention_days, dry_run;
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

-- 권한 의도 재선언 (Codex 권고 v2.3 안전 문서화)
revoke all on function private.cleanup_unconfirmed_users(int, boolean, int)
  from public, anon, authenticated;

comment on function private.cleanup_unconfirmed_users(int, boolean, int) is
  'Delete unconfirmed auth.users older than N days (default 30) and their owned storage objects. '
  'SECURITY DEFINER with locked search_path. dry_run=true returns count without deleting. '
  'max_batch caps deletes per call. profiles row removed via FK ON DELETE CASCADE. '
  'Phase 8 follow-up v2.3 2026-05-27: retention_days < 30 + dry_run=false is forbidden (raise exception).';
