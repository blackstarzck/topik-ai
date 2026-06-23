-- User detail > Admin memo tab: admin-owned per-member memo notes.
-- New admin-owned table + read/add/delete RPCs. user_id is a LOOSE ref to a member
-- (no FK to v13 profiles). All writes go through SECURITY DEFINER admin RPCs with
-- reason + admin_audit_logs. No v13 DDL change.
-- down: supabase/migrations-admin/down/20260618125000_user_admin_memos.sql

create table if not exists public.user_admin_memos (
  id            text primary key default ('UMEMO-' || replace(gen_random_uuid()::text, '-', '')),
  user_id       text not null,
  admin_user_id uuid,
  admin_name    text,
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists user_admin_memos_user_idx
  on public.user_admin_memos (user_id, created_at desc);

alter table public.user_admin_memos enable row level security;
alter table public.user_admin_memos force row level security;

-- Admin read only; writes go exclusively through the SECURITY DEFINER RPCs below.
create policy user_admin_memos_admin_select on public.user_admin_memos
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.admin_list_user_memos(p_user_id text)
returns table (id text, admin_name text, content text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select m.id, m.admin_name, m.content, m.created_at
    from public.user_admin_memos m
    where m.user_id = p_user_id
    order by m.created_at desc;
end;
$$;

create or replace function public.admin_add_user_memo(p_user_id text, p_content text, p_reason text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_admin_name text;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_user_id, '')), '') is null then raise exception 'user id required'; end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then raise exception 'content required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), caller_id::text)
    into v_admin_name
    from public.profiles p
   where p.id = caller_id;

  insert into public.user_admin_memos (user_id, admin_user_id, admin_name, content)
       values (p_user_id, caller_id, v_admin_name, btrim(p_content))
    returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'user_memo_added',
    'User',
    p_user_id,
    jsonb_build_object('memo_id', v_id),
    jsonb_build_object('reason', btrim(p_reason), 'memo_id', v_id, 'content_preview', left(btrim(p_content), 80))
  );

  return v_id;
end;
$$;

create or replace function public.admin_delete_user_memo(p_memo_id text, p_reason text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_user_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  delete from public.user_admin_memos where id = p_memo_id returning user_id into v_user_id;
  if v_user_id is null then
    raise exception 'unknown memo id: %', p_memo_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'user_memo_deleted',
    'User',
    v_user_id,
    jsonb_build_object('memo_id', p_memo_id),
    jsonb_build_object('reason', btrim(p_reason), 'memo_id', p_memo_id)
  );

  return p_memo_id;
end;
$$;

revoke all on function public.admin_list_user_memos(text) from public;
grant execute on function public.admin_list_user_memos(text) to authenticated;
revoke all on function public.admin_add_user_memo(text, text, text) from public;
grant execute on function public.admin_add_user_memo(text, text, text) to authenticated;
revoke all on function public.admin_delete_user_memo(text, text) from public;
grant execute on function public.admin_delete_user_memo(text, text) to authenticated;

comment on table public.user_admin_memos is
  'Admin-owned per-member memo notes (User detail > admin memo tab). user_id is a loose ref to a member (no FK). Writes via admin RPC only; admin_audit_logs records add/delete.';
