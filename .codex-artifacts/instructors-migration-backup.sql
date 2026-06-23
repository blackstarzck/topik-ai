-- Users > 강사 관리: admin-owned instructor directory.
-- Owner decision (2026-06-19): Instructor is an ADMIN-OWNED entity (not a v13 user
-- subtype). New admin-owned tables + SECURITY DEFINER admin RPCs. No v13 DDL change.
-- Nested course/message summaries are denormalized as jsonb (display-only); admin
-- notes are a writable sub-table. Writes go through admin RPCs with reason + audit.
-- down: supabase/migrations-admin/down/20260619100000_instructors.sql

create table if not exists public.instructors (
  id                text primary key,
  real_name         text,
  email             text,
  nickname          text,
  organization      text,
  country           text,
  status            text not null default '정상',   -- 정상 / 정지 / 탈퇴
  activity_status   text,                            -- 활성 / 주의 / 휴면
  assignment_status text,                            -- 안정 / 주의 / 조정 필요
  course_count      int  not null default 0,
  student_count     int  not null default 0,
  last_activity_at  text,
  last_action_at    text,
  message_group_id   text,
  message_group_name text,
  specialties       jsonb not null default '[]'::jsonb,
  introduction      text,
  assigned_courses  jsonb not null default '[]'::jsonb,
  recent_messages   jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists instructors_status_idx on public.instructors (status);
create index if not exists instructors_activity_idx on public.instructors (activity_status);

create table if not exists public.instructor_admin_notes (
  id            text primary key default ('INOTE-' || replace(gen_random_uuid()::text, '-', '')),
  instructor_id text not null references public.instructors(id) on delete cascade,
  admin_user_id uuid,
  admin_name    text,
  content       text not null,
  created_at    timestamptz not null default now()
);
create index if not exists instructor_admin_notes_instructor_idx
  on public.instructor_admin_notes (instructor_id, created_at desc);

alter table public.instructors enable row level security;
alter table public.instructors force row level security;
alter table public.instructor_admin_notes enable row level security;
alter table public.instructor_admin_notes force row level security;

create policy instructors_admin_select on public.instructors
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy instructor_admin_notes_admin_select on public.instructor_admin_notes
  for select to authenticated using (private.is_admin((select auth.uid())));

-- ── Read: list ──────────────────────────────────────────────────────────────
create or replace function public.admin_list_instructors(
  p_search          text default null,
  p_status          text default null,
  p_activity_status text default null,
  p_organization    text default null,
  p_country         text default null
)
returns table (
  id text, real_name text, email text, nickname text, organization text, country text,
  status text, activity_status text, assignment_status text,
  course_count int, student_count int, last_activity_at text, last_action_at text,
  message_group_id text, message_group_name text
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select i.id, i.real_name, i.email, i.nickname, i.organization, i.country,
           i.status, i.activity_status, i.assignment_status,
           i.course_count, i.student_count, i.last_activity_at, i.last_action_at,
           i.message_group_id, i.message_group_name
      from public.instructors i
     where (p_status is null or i.status = p_status)
       and (p_activity_status is null or i.activity_status = p_activity_status)
       and (p_organization is null or i.organization = p_organization)
       and (p_country is null or i.country = p_country)
       and (
         v_search is null
         or i.id ilike '%' || v_search || '%'
         or lower(i.real_name) ilike '%' || v_search || '%'
         or lower(i.email) ilike '%' || v_search || '%'
       )
     order by i.id;
end;
$$;

-- ── Read: detail ────────────────────────────────────────────────────────────
create or replace function public.admin_get_instructor(p_instructor_id text)
returns table (
  id text, real_name text, email text, nickname text, organization text, country text,
  status text, activity_status text, assignment_status text,
  course_count int, student_count int, last_activity_at text, last_action_at text,
  message_group_id text, message_group_name text,
  specialties jsonb, introduction text, assigned_courses jsonb, recent_messages jsonb,
  admin_notes jsonb
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select i.id, i.real_name, i.email, i.nickname, i.organization, i.country,
           i.status, i.activity_status, i.assignment_status,
           i.course_count, i.student_count, i.last_activity_at, i.last_action_at,
           i.message_group_id, i.message_group_name,
           i.specialties, i.introduction, i.assigned_courses, i.recent_messages,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', n.id, 'adminName', n.admin_name,
                      'content', n.content, 'createdAt', to_char(n.created_at, 'YYYY-MM-DD'))
                    order by n.created_at desc)
               from public.instructor_admin_notes n
              where n.instructor_id = i.id
           ), '[]'::jsonb)
      from public.instructors i
     where i.id = p_instructor_id;
end;
$$;

-- ── Write: status (suspend / unsuspend / withdraw) ──────────────────────────
create or replace function public.admin_set_instructor_status(
  p_instructor_id text, p_status text, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if p_status not in ('정상', '정지', '탈퇴') then raise exception 'invalid status: %', p_status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select status into v_old from public.instructors where id = p_instructor_id for update;
  if not found then raise exception 'unknown instructor id: %', p_instructor_id; end if;
  if v_old = p_status then raise exception 'instructor already %', p_status; end if;

  update public.instructors set status = p_status, updated_at = now() where id = p_instructor_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_status_changed', 'Instructor', p_instructor_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_instructor_id;
end;
$$;

-- ── Write: admin notes ──────────────────────────────────────────────────────
create or replace function public.admin_add_instructor_note(
  p_instructor_id text, p_content text, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_admin_name text;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then raise exception 'content required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if not exists (select 1 from public.instructors where id = p_instructor_id) then
    raise exception 'unknown instructor id: %', p_instructor_id;
  end if;

  select coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), caller_id::text)
    into v_admin_name from public.profiles p where p.id = caller_id;

  insert into public.instructor_admin_notes (instructor_id, admin_user_id, admin_name, content)
       values (p_instructor_id, caller_id, v_admin_name, btrim(p_content))
    returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_note_added', 'Instructor', p_instructor_id,
          jsonb_build_object('note_id', v_id),
          jsonb_build_object('reason', btrim(p_reason), 'note_id', v_id));
  return v_id;
end;
$$;

create or replace function public.admin_delete_instructor_note(p_note_id text, p_reason text)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_instructor_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  delete from public.instructor_admin_notes where id = p_note_id returning instructor_id into v_instructor_id;
  if v_instructor_id is null then raise exception 'unknown note id: %', p_note_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_note_deleted', 'Instructor', v_instructor_id,
          jsonb_build_object('note_id', p_note_id),
          jsonb_build_object('reason', btrim(p_reason), 'note_id', p_note_id));
  return p_note_id;
end;
$$;

revoke all on function public.admin_list_instructors(text, text, text, text, text) from public;
grant execute on function public.admin_list_instructors(text, text, text, text, text) to authenticated;
revoke all on function public.admin_get_instructor(text) from public;
grant execute on function public.admin_get_instructor(text) to authenticated;
revoke all on function public.admin_set_instructor_status(text, text, text) from public;
grant execute on function public.admin_set_instructor_status(text, text, text) to authenticated;
revoke all on function public.admin_add_instructor_note(text, text, text) from public;
grant execute on function public.admin_add_instructor_note(text, text, text) to authenticated;
revoke all on function public.admin_delete_instructor_note(text, text) from public;
grant execute on function public.admin_delete_instructor_note(text, text) to authenticated;

-- Small dev seed (3 rows) for screen visibility; production starts empty / fed by ops.
insert into public.instructors
  (id, real_name, email, nickname, organization, country, status, activity_status, assignment_status,
   course_count, student_count, last_activity_at, last_action_at, message_group_id, message_group_name,
   specialties, introduction, assigned_courses, recent_messages)
values
  ('INS-0001', '김도연', 'instructor1@topik.ai', 'teacher_1', '본사 직속', '대한민국', '정상', '활성', '안정',
   2, 54, '2026-03-10 10:00', '2026-03-05 12:00', 'GRP-001', '강사 운영 공지',
   '["쓰기 첨삭","말하기 코칭"]'::jsonb, '본사 직속으로 TOPIK 학습자 온보딩과 과정 운영을 담당하는 강사입니다.',
   '[{"id":"CRS-001-1","title":"TOPIK I 입문 집중반","level":"초급~중급","studentCount":24,"status":"진행 중"}]'::jsonb,
   '[{"id":"MSG-001-1","channel":"메일","title":"강사 운영 공지","sentAt":"2026-03-09 11:00","status":"발송 완료"}]'::jsonb),
  ('INS-0002', '이하린', 'instructor2@topik.ai', 'teacher_2', '파트너 기관', '베트남', '정상', '주의', '주의',
   1, 18, '2026-02-24 10:00', '2026-03-01 12:00', 'GRP-002', 'TOPIK II 담당 강사',
   '["입문반 운영","시험 대비"]'::jsonb, '파트너 기관 소속으로 시험 대비 과정을 담당하는 강사입니다.',
   '[{"id":"CRS-002-1","title":"TOPIK II 실전 문제풀이","level":"중급~고급","studentCount":18,"status":"진행 중"}]'::jsonb,
   '[]'::jsonb),
  ('INS-0003', '박선우', 'instructor3@topik.ai', 'teacher_3', '본사 직속', '대한민국', '정지', '휴면', '조정 필요',
   0, 0, '2026-01-20 10:00', '2026-02-10 12:00', 'GRP-003', '휴면 강사 안내',
   '["문법 클리닉","개별 피드백"]'::jsonb, '휴면 상태로 재참여 안내가 필요한 강사입니다.',
   '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

comment on table public.instructors is
  'Admin-owned instructor directory (Users > 강사 관리). Owner decision 2026-06-19: admin-owned entity, not a v13 user subtype. Writes via admin RPC (status/notes) with reason + admin_audit_logs(target=Instructor).';
