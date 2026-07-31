-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 10/12 · SECURITY DEFINER helpers in private schema
-- Spec: docs/development/database-schema.md §2.3
--
-- These functions are referenced by RLS policies in 12/12 rls_policies.sql.
-- They must be created AFTER profiles exists (02/12) and BEFORE policies.
-- =====================================================================

-- ---------------------------------------------------------------------
-- private.is_admin(uid) — returns true if user is content_admin or platform_admin
-- ---------------------------------------------------------------------
create or replace function private.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = uid
      and app_role in ('content_admin','platform_admin')
      and status = 'active'
  );
$$;

revoke all on function private.is_admin(uuid) from public;
grant execute on function private.is_admin(uuid) to authenticated;

comment on function private.is_admin(uuid) is
  'Returns true for content_admin/platform_admin. SECURITY DEFINER + stable for RLS use.';

-- ---------------------------------------------------------------------
-- public.touch_updated_at() — generic BEFORE UPDATE trigger function
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.touch_updated_at() is
  'Sets new.updated_at = now() on BEFORE UPDATE.';

-- ---------------------------------------------------------------------
-- public.supersede_active_draft() — fires on writing_submissions insert
-- Marks the matching active draft as superseded so the partial unique
-- index on writing_drafts (user_id, problem_id) where != superseded
-- continues to allow the next attempt.
-- ---------------------------------------------------------------------
create or replace function public.supersede_active_draft()
returns trigger
language plpgsql
as $$
begin
  -- If submission references a draft, mark only that draft.
  if new.draft_id is not null then
    update public.writing_drafts
       set autosave_status = 'superseded',
           updated_at = now()
     where id = new.draft_id
       and autosave_status <> 'superseded';
    return new;
  end if;

  -- Otherwise mark any active draft for (user, problem).
  update public.writing_drafts
     set autosave_status = 'superseded',
         updated_at = now()
   where user_id = new.user_id
     and problem_id = new.problem_id
     and autosave_status <> 'superseded';

  return new;
end;
$$;

comment on function public.supersede_active_draft() is
  'AFTER INSERT on writing_submissions: marks the active draft as superseded.';
