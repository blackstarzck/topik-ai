-- =====================================================================
-- TALKPIK AI · Phase 8 follow-up P1 · 2026-05-27
-- Storage 업로드 hardening — 이메일 미인증 사용자 차단
--
-- v1 보고서가 follow-up #1로 명시한 항목: 현재 avatars/exports owner_insert
-- 정책은 authenticated만 체크 → 이메일 인증 안 한 사용자도 JWT만 있으면 업로드
-- 가능. v1 시점에는 cleanup 함수가 storage.objects를 먼저 정리하므로 운영 위험
-- 낮다고 판단했지만, 정공법은 RLS에서 미인증 업로드 자체를 차단하는 것 (Codex 합의).
--
-- 헬퍼 함수:
--   private.is_email_confirmed(uid uuid) returns boolean
--   - SECURITY DEFINER + locked search_path (private 스키마 패턴 따름)
--   - public/anon revoke, authenticated/service_role에 execute grant
--   - storage.objects RLS에서 호출되어 auth.users.email_confirmed_at 조회
--
-- 적용 정책:
--   - avatars_owner_insert: bucket + folder owner + email_confirmed
--   - avatars_owner_update: using은 그대로(기존 row 식별만), with check에
--     email_confirmed 적용. UPDATE RLS는 using으로 기존 row 권한 + with check로
--     변경 후 row 권한을 분리 검사하므로, 결과적으로 미인증 사용자는 자기 기존
--     avatar update도 차단됨 — 업로드와 수정을 모두 차단하는 의도와 일치.
--   - exports_owner_insert: 동일 패턴
--   - read/delete 정책은 그대로 (자기 파일 cleanup은 미인증도 허용 = cleanup
--     함수 정책과 정합. 또한 server-side regeneration은 service_role로 RLS bypass)
--
-- Spec: docs/spec.md (이메일 인증 후 보호 액션)
-- =====================================================================

create or replace function private.is_email_confirmed(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, auth
as $$
  select email_confirmed_at is not null
  from auth.users
  where id = uid
$$;

revoke all on function private.is_email_confirmed(uuid) from public, anon, authenticated;
grant execute on function private.is_email_confirmed(uuid) to authenticated, service_role;

comment on function private.is_email_confirmed(uuid) is
  'Returns true if auth.users.email_confirmed_at is set for the given uid. '
  'SECURITY DEFINER with locked search_path. Used by Storage RLS to block '
  'unconfirmed users from uploading. Phase 8 follow-up P1 (2026-05-27).';

-- ---------------------------------------------------------------------
-- avatars: 이메일 인증 후에만 업로드/수정 가능
-- ---------------------------------------------------------------------
drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );

-- ---------------------------------------------------------------------
-- generated-exports: 이메일 인증 후에만 직접 insert 가능
-- (server-side regeneration은 service_role로 RLS bypass이므로 영향 없음)
-- ---------------------------------------------------------------------
drop policy if exists exports_owner_insert on storage.objects;
create policy exports_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and private.is_email_confirmed((select auth.uid()))
  );
