-- down: revert 회원 탈퇴 소프트 삭제.
-- request_account_deletion RPC 제거 + protect_profile_columns 를
-- 20260619140000(affiliation_code) 버전으로 복원(self active->deleted 예외 제거)
-- + profiles.deleted_at 컬럼 제거.

drop function if exists public.request_account_deletion();

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
    raise exception
      'profiles.status can only be changed by admins'
      using errcode = '42501';
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
  'BEFORE UPDATE on public.profiles. Blocks app_role/plan_label/status changes for non-admins and blocks normal affiliation_code edits.';

alter table public.profiles drop column if exists deleted_at;
