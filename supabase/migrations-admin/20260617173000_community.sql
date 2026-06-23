-- =====================================================================
-- topik-ai admin - Community posts/reports - admin-0015
-- Community posts/reports mock -> Supabase transition.
-- RLS: admin select only. Writes are SECURITY DEFINER RPCs.
-- UI labels remain Korean; DB status values are ASCII.
-- down: supabase/migrations-admin/down/20260617173000_community.sql
-- =====================================================================

create table if not exists public.community_posts (
  id text primary key,
  title text not null,
  content_html text not null default '',
  author_id text not null,
  author_name text not null,
  board text not null,
  status text not null default 'published',
  last_moderation_policy_code text,
  reports_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.community_post_admin_notes (
  id text primary key,
  post_id text not null references public.community_posts(id) on delete cascade,
  title text not null,
  type text not null,
  author_id text not null,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id text primary key,
  target_post_id text references public.community_posts(id) on delete set null,
  target_user_id text not null,
  target_user_name text not null,
  reporter_id text not null,
  reporter_name text not null,
  reason text not null,
  reason_code text,
  process_status text not null default 'pending',
  resolution_action text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_posts drop constraint if exists community_posts_board_check;
alter table public.community_posts add constraint community_posts_board_check
  check (board in ('자유게시판','질문','후기'));
alter table public.community_posts drop constraint if exists community_posts_status_check;
alter table public.community_posts add constraint community_posts_status_check
  check (status in ('published','hidden'));
alter table public.community_posts drop constraint if exists community_posts_policy_code_check;
alter table public.community_posts add constraint community_posts_policy_code_check
  check (last_moderation_policy_code is null or last_moderation_policy_code in ('SPAM','ABUSE','AD','PRIVACY','DUPLICATE','OTHER'));
alter table public.community_posts drop constraint if exists community_posts_reports_count_nonnegative_check;
alter table public.community_posts add constraint community_posts_reports_count_nonnegative_check
  check (reports_count >= 0);

alter table public.community_post_admin_notes drop constraint if exists community_post_admin_notes_type_check;
alter table public.community_post_admin_notes add constraint community_post_admin_notes_type_check
  check (type in ('SPAM','욕설/혐오','성인/불법','광고/홍보','개인정보 노출','중복 게시','기타'));

alter table public.community_reports drop constraint if exists community_reports_process_status_check;
alter table public.community_reports add constraint community_reports_process_status_check
  check (process_status in ('pending','resolved'));
alter table public.community_reports drop constraint if exists community_reports_resolution_action_check;
alter table public.community_reports add constraint community_reports_resolution_action_check
  check (resolution_action is null or resolution_action in ('hide_post','suspend_user','dismiss'));

create index if not exists community_post_admin_notes_post_id
  on public.community_post_admin_notes (post_id);
create index if not exists community_reports_target_post_id
  on public.community_reports (target_post_id);
create index if not exists community_reports_process_status
  on public.community_reports (process_status);
create index if not exists community_posts_created_desc
  on public.community_posts (created_at desc);
create index if not exists community_reports_created_desc
  on public.community_reports (created_at desc);

alter table public.community_posts enable row level security;
alter table public.community_posts force row level security;
drop policy if exists community_posts_admin_select on public.community_posts;
create policy community_posts_admin_select on public.community_posts
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.community_post_admin_notes enable row level security;
alter table public.community_post_admin_notes force row level security;
drop policy if exists community_post_admin_notes_admin_select on public.community_post_admin_notes;
create policy community_post_admin_notes_admin_select on public.community_post_admin_notes
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.community_reports enable row level security;
alter table public.community_reports force row level security;
drop policy if exists community_reports_admin_select on public.community_reports;
create policy community_reports_admin_select on public.community_reports
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.next_community_post_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'POST-' || lpad((coalesce(max(substring(id from '^POST-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
  from public.community_posts
  where id ~ '^POST-[0-9]+$';
$$;

create or replace function public.next_community_post_admin_note_id(p_post_id text)
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select p_post_id || '-MEMO-' || lpad((coalesce(max(substring(id from '-MEMO-([0-9]+)$')::integer), 0) + 1)::text, 2, '0')
  from public.community_post_admin_notes
  where post_id = p_post_id and id ~ '-MEMO-[0-9]+$';
$$;

revoke all on function public.next_community_post_id() from public;
revoke all on function public.next_community_post_admin_note_id(text) from public;

insert into public.community_posts (
  id, title, content_html, author_id, author_name, board, status,
  last_moderation_policy_code, reports_count, created_at, updated_at, updated_by
) values
  ('POST-001','TOPIK 필기 노트 공유','<p>TOPIK 필기 노트를 공유합니다.</p>','U00012','이하은','자유게시판','published',null,0,'2026-03-02 00:00:00+09','2026-03-02 00:00:00+09','seed'),
  ('POST-002','운영 정책 문의','<p>신고 누적 시 제재 기준 문의입니다.</p>','U00047','조현우','질문','published',null,3,'2026-03-01 00:00:00+09','2026-03-01 00:00:00+09','seed'),
  ('POST-003','시험 후기 공유','<p>최근 TOPIK 시험 후기를 공유합니다.</p>','U00019','장도윤','후기','hidden','AD',1,'2026-02-28 00:00:00+09','2026-03-10 16:33:51+09','admin_lee')
on conflict (id) do nothing;

insert into public.community_post_admin_notes (
  id, post_id, title, type, author_id, author_name, content, created_at
) values
  ('POST-001-MEMO-01','POST-001','정상 게시글 1차 검토','기타','admin_park','박수민','학습 후기 성격의 정상 게시글입니다.','2026-03-12 09:18:00+09'),
  ('POST-002-MEMO-01','POST-002','댓글 분쟁 여부 확인 필요','욕설/혐오','admin_kim','김서영','댓글 흐름과 신고 사유를 함께 확인해야 합니다.','2026-03-13 14:06:00+09'),
  ('POST-002-MEMO-02','POST-002','작성자 이력 모니터링','기타','admin_park','박수민','동일 유형 신고가 추가로 접수되었습니다.','2026-03-14 10:22:00+09'),
  ('POST-003-MEMO-01','POST-003','외부 링크 포함 확인','광고/홍보','admin_lee','이서준','외부 스팸 링크 포함으로 숨김 처리했습니다.','2026-03-10 16:35:00+09')
on conflict (id) do nothing;

insert into public.community_reports (
  id, target_post_id, target_user_id, target_user_name, reporter_id, reporter_name,
  reason, reason_code, process_status, resolution_action, resolved_by, resolved_at, created_at
) values
  ('RP-001','POST-002','U00047','조현우','U00012','이하은','욕설 포함','ABUSE','pending',null,null,null,'2026-03-03 14:12:00+09'),
  ('RP-002',null,'U00019','장도윤','U00031','김민준','광고성 게시물','AD','pending',null,null,null,'2026-03-04 09:31:00+09'),
  ('RP-003','POST-003','U00077','조현우','U00001','김민준','스팸','SPAM','resolved','hide_post','admin_lee','2026-03-10 16:33:51+09','2026-03-04 10:05:00+09')
on conflict (id) do nothing;

create or replace function public.admin_hide_community_post(
  p_post_id text,
  p_reason text,
  p_policy_code text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.community_posts%rowtype;
  v_saved public.community_posts%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_policy_code is not null and p_policy_code not in ('SPAM','ABUSE','AD','PRIVACY','DUPLICATE','OTHER') then
    raise exception 'invalid community policy code: %', p_policy_code;
  end if;

  select * into v_old from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  update public.community_posts
     set status = 'hidden',
         last_moderation_policy_code = p_policy_code,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_hidden', 'CommunityPost', p_post_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'policy_code', p_policy_code, 'title', v_saved.title)
  );
  return p_post_id;
end;
$$;
revoke all on function public.admin_hide_community_post(text, text, text) from public;
grant execute on function public.admin_hide_community_post(text, text, text) to authenticated;

create or replace function public.admin_show_community_post(
  p_post_id text,
  p_reason text,
  p_policy_code text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.community_posts%rowtype;
  v_saved public.community_posts%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_policy_code is not null and p_policy_code not in ('SPAM','ABUSE','AD','PRIVACY','DUPLICATE','OTHER') then
    raise exception 'invalid community policy code: %', p_policy_code;
  end if;

  select * into v_old from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  update public.community_posts
     set status = 'published',
         last_moderation_policy_code = p_policy_code,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_shown', 'CommunityPost', p_post_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'policy_code', p_policy_code, 'title', v_saved.title)
  );
  return p_post_id;
end;
$$;
revoke all on function public.admin_show_community_post(text, text, text) from public;
grant execute on function public.admin_show_community_post(text, text, text) to authenticated;

create or replace function public.admin_delete_community_post(
  p_post_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.community_posts%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_deleted', 'CommunityPost', p_post_id,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title)
  );

  delete from public.community_posts where id = p_post_id;
  return p_post_id;
end;
$$;
revoke all on function public.admin_delete_community_post(text, text) from public;
grant execute on function public.admin_delete_community_post(text, text) to authenticated;

create or replace function public.admin_add_community_post_memo(
  p_post_id text,
  p_memo jsonb,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_post public.community_posts%rowtype;
  v_note_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_memo->>'title', '')), '') is null then raise exception 'memo title required'; end if;
  if nullif(btrim(coalesce(p_memo->>'content', '')), '') is null then raise exception 'memo content required'; end if;

  select * into v_post from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  v_note_id := public.next_community_post_admin_note_id(p_post_id);
  insert into public.community_post_admin_notes (
    id, post_id, title, type, author_id, author_name, content, created_at
  ) values (
    v_note_id,
    p_post_id,
    btrim(p_memo->>'title'),
    coalesce(nullif(btrim(p_memo->>'type'), ''), '기타'),
    coalesce(nullif(btrim(p_memo->>'author_id'), ''), caller_id::text),
    coalesce(nullif(btrim(p_memo->>'author_name'), ''), '관리자'),
    btrim(p_memo->>'content'),
    now()
  );

  update public.community_posts
     set updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id, 'post_memo_added', 'CommunityPost', p_post_id,
    jsonb_build_object(
      'reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'memo_id', v_note_id,
      'memo_title', btrim(p_memo->>'title'),
      'memo_type', coalesce(nullif(btrim(p_memo->>'type'), ''), '기타')
    )
  );
  return v_note_id;
end;
$$;
revoke all on function public.admin_add_community_post_memo(text, jsonb, text) from public;
grant execute on function public.admin_add_community_post_memo(text, jsonb, text) to authenticated;

create or replace function public.admin_resolve_community_report(
  p_report_id text,
  p_action text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_report public.community_reports%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_action not in ('hide_post','suspend_user','dismiss') then raise exception 'invalid report action: %', p_action; end if;

  select * into v_report from public.community_reports where id = p_report_id for update;
  if not found then raise exception 'unknown community report id: %', p_report_id; end if;

  if p_action = 'hide_post' and v_report.target_post_id is not null then
    update public.community_posts
       set status = 'hidden',
           last_moderation_policy_code = coalesce(v_report.reason_code, 'OTHER'),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_report.target_post_id;
  end if;

  update public.community_reports
     set process_status = 'resolved',
         resolution_action = p_action,
         resolved_by = caller_id::text,
         resolved_at = now()
   where id = p_report_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'report_resolved', 'CommunityReport', p_report_id,
    jsonb_build_object('process_status', jsonb_build_object('from', v_report.process_status, 'to', 'resolved')),
    jsonb_build_object(
      'action', p_action,
      'reason', p_reason,
      'affected_post_id', v_report.target_post_id,
      'affected_user_id', v_report.target_user_id,
      'user_suspend_integration', case when p_action = 'suspend_user' then 'intent_only_v13_admin_set_user_status_pending' else null end
    )
  );
  return p_report_id;
end;
$$;
revoke all on function public.admin_resolve_community_report(text, text, text) from public;
grant execute on function public.admin_resolve_community_report(text, text, text) to authenticated;
