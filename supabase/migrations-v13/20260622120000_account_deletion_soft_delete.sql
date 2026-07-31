-- =====================================================================
-- TALKPIK AI · 회원 탈퇴(self-service 계정 삭제) — 소프트 삭제 단계
--
-- 결정 근거(확정 SOT): docs/development-core-planning/01-core-decisions/README.md
--   "탈퇴 계정은 30일 복구 유예 후 개인정보를 비식별/삭제한다."
-- 구현 브리프: docs/sot-change-proposals/2026-06-22-account-deletion-self-service.md
--
-- 이 마이그레이션은 *소프트 삭제* 만 담당한다:
--   1) profiles.deleted_at 컬럼 추가(탈퇴 요청 시각).
--   2) protect_profile_columns 트리거를 보완해 *본인의* active → deleted
--      단방향 전이만 허용(복구 deleted → active 는 계속 차단 = admin/후속).
--   3) request_account_deletion() RPC: 호출자 본인 status='deleted',
--      deleted_at=now() 로 멱등 전환.
--
-- 의도적으로 하지 않는 것(후속/비-6·22-blocking):
--   - storage.objects / auth.users 하드 삭제(30일 cron) — 후속 마이그레이션.
--   - admin_audit_logs 기록 — admin_user_id 가 ON DELETE RESTRICT 라
--     self-탈퇴 audit 행은 향후 하드 삭제를 막는 함정이 된다. 탈퇴 사실은
--     profiles.deleted_at 로 충분히 기록된다.
--   - 복구 RPC — 후속(복구는 admin/service-role 전용 경로로 분리).
--
-- 멱등성: add column if not exists / create or replace / 단방향 예외는
--   조건부라 재실행 안전. supabase db reset 통과 가정.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles.deleted_at — 탈퇴 요청 시각
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  '회원 탈퇴 요청 시각. status=deleted 전환 시 기록. 30일 복구 유예 후 하드 삭제(후속) 기준. status=active 면 null.';

-- ---------------------------------------------------------------------
-- 2. protect_profile_columns 보완 — 본인 active→deleted 단방향 허용
--    (20260619140000 버전 기준 + status 분기만 self-deactivation 예외 추가)
-- ---------------------------------------------------------------------
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Admins (content_admin / platform_admin) bypass entirely.
  if private.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.app_role is distinct from old.app_role then
    raise exception
      'profiles.app_role can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.plan_label is distinct from old.plan_label then
    raise exception
      'profiles.plan_label can only be changed by admins or billing service'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    -- 회원 탈퇴(self-service): 행 소유자 본인이 active → deleted 로만 전환 가능.
    -- 그 외 모든 status 변경(타인, 역방향 deleted→active 복구, blocked 등)은
    -- 계속 admin 전용으로 차단한다.
    if not (
      new.id = (select auth.uid())
      and old.status = 'active'
      and new.status = 'deleted'
    ) then
      raise exception
        'profiles.status can only be changed by admins (self active->deleted excepted)'
        using errcode = '42501';
    end if;
  end if;

  if new.affiliation_code is distinct from old.affiliation_code
     and current_setting('app.claim_affiliation_code', true) is distinct from '1' then
    raise exception
      'profiles.affiliation_code can only be changed by claim_affiliation_code'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_columns() from public;

comment on function private.protect_profile_columns() is
  'BEFORE UPDATE on public.profiles. Blocks app_role/plan_label/status changes for non-admins '
  '(self active->deleted excepted for 회원 탈퇴) and blocks normal affiliation_code edits.';

-- ---------------------------------------------------------------------
-- 3. request_account_deletion() — 본인 계정 소프트 삭제 RPC
--    SECURITY DEFINER: 소유자로 실행되어 RLS 우회, auth.uid()=호출자 유지.
--    트리거의 self active->deleted 예외가 적용되어 UPDATE 가 통과한다.
-- ---------------------------------------------------------------------
create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := (select auth.uid());
  cur_status text;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select status into cur_status from public.profiles where id = caller_id;
  if cur_status is null then
    raise exception 'profile not found';
  end if;

  -- 멱등: 이미 deleted 면 deleted_at 재스탬프 없이 성공 반환(30일 시계 보호).
  if cur_status = 'deleted' then
    return;
  end if;

  -- blocked 등 비활성 계정은 self-탈퇴 대상이 아니다(트리거도 차단).
  if cur_status <> 'active' then
    raise exception 'account is not active (status=%)', cur_status;
  end if;

  update public.profiles
    set status = 'deleted',
        deleted_at = now()
    where id = caller_id;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

comment on function public.request_account_deletion() is
  'Authenticated self-service 회원 탈퇴. Sets caller profiles.status=deleted + deleted_at=now(). '
  'Idempotent (no re-stamp if already deleted). Recovery(deleted->active) and hard-delete are out of scope.';
