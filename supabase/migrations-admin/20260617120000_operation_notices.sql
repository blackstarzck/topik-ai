-- =====================================================================
-- topik-ai admin · Operation notices · admin-0009
-- admin 운영 공지사항 테이블 + admin RPC 단일 write 경로
--
-- 계약 SoT: docs/specs/admin-data-contract.md
-- 소유권:   docs/architecture/shared-supabase-schema-ownership.md
--           (tracker: admin_schema_migrations — topik_writing와 분리)
-- RLS 모델: 읽기 = admin(private.is_admin), 쓰기 = 정책 없음(RPC 단일 경로).
-- DB enum은 ASCII(published/hidden)로 저장하고 UI 한글 표기는 코드에서 매핑한다.
-- down: supabase/migrations-admin/down/20260617120000_operation_notices.sql
-- =====================================================================

create table if not exists public.operation_notices (
  id         text primary key,
  title      text not null,
  body_html  text not null default '',
  status     text not null default 'hidden',
  author     text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.operation_notices
  drop constraint if exists operation_notices_status_check;
alter table public.operation_notices
  add constraint operation_notices_status_check
  check (status in ('published','hidden'));

create index if not exists operation_notices_created_desc
  on public.operation_notices (created_at desc);

create index if not exists operation_notices_published_created
  on public.operation_notices (created_at desc)
  where status = 'published';

comment on table public.operation_notices is
  'Operation > 공지사항 SoT. status는 published/hidden ASCII 저장, UI 라벨은 게시/숨김. 쓰기는 admin RPC 단일 경로.';

alter table public.operation_notices enable row level security;
alter table public.operation_notices force  row level security;
drop policy if exists operation_notices_admin_select on public.operation_notices;
create policy operation_notices_admin_select on public.operation_notices
  for select to authenticated using (private.is_admin((select auth.uid())));

insert into public.operation_notices (
  id, title, body_html, status, author, created_at, updated_at, updated_by
) values
  (
    'NOTICE-001',
    '정기 점검 안내',
    '<h2>정기 점검 안내</h2><p>2026년 3월 24일 02:00부터 03:30까지 정기 점검을 진행합니다.</p><ul><li>학습 진도 저장은 자동 복구됩니다.</li><li>결제 및 커뮤니티 기능은 점검 시간 동안 일시 중단됩니다.</li></ul>',
    'published',
    'admin_park',
    '2026-03-03 00:00:00+09'::timestamptz,
    '2026-03-20 09:00:00+09'::timestamptz,
    'admin_park'
  ),
  (
    'NOTICE-002',
    '환불 정책 변경',
    '<h2>환불 정책 변경 안내</h2><p>2026년 4월 1일부터 일부 패키지 상품의 환불 기준이 변경됩니다.</p><p>결제 후 7일 이내, 학습 이력이 없는 경우에 한해 전액 환불이 가능합니다.</p>',
    'hidden',
    'admin_kim',
    '2026-02-21 00:00:00+09'::timestamptz,
    '2026-03-18 14:20:00+09'::timestamptz,
    'admin_kim'
  )
on conflict (id) do nothing;

create or replace function public.admin_save_operation_notice(
  p_id     text,
  p_notice jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id   uuid := auth.uid();
  v_id        text;
  v_title     text;
  v_body_html text;
  v_old       public.operation_notices%rowtype;
  v_diff      jsonb := '{}'::jsonb;
  v_action    text := 'notice_saved';
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_title := nullif(btrim(coalesce(p_notice->>'title', '')), '');
  v_body_html := coalesce(p_notice->>'body_html', '');

  if v_title is null then raise exception 'title required'; end if;
  if nullif(btrim(v_body_html), '') is null then raise exception 'body_html required'; end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'NOTICE-' || lpad((coalesce(max(substring(id from '^NOTICE-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_notices
     where id ~ '^NOTICE-[0-9]+$';

    insert into public.operation_notices (
      id, title, body_html, status, author, updated_by
    ) values (
      v_id, v_title, v_body_html, 'hidden', caller_id::text, caller_id::text
    );

    v_diff := jsonb_build_object(
      'title', jsonb_build_object('from', null, 'to', v_title),
      'body_html', jsonb_build_object('from', null, 'to', v_body_html),
      'status', jsonb_build_object('from', null, 'to', 'hidden')
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_notices
     where id = v_id
     for update;
    if not found then raise exception 'unknown notice id: %', v_id; end if;

    if v_old.title is distinct from v_title then
      v_diff := v_diff || jsonb_build_object(
        'title', jsonb_build_object('from', v_old.title, 'to', v_title)
      );
    end if;
    if v_old.body_html is distinct from v_body_html then
      v_diff := v_diff || jsonb_build_object(
        'body_html', jsonb_build_object('from', v_old.body_html, 'to', v_body_html)
      );
    end if;

    update public.operation_notices
       set title = v_title,
           body_html = v_body_html,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    v_action,
    'OperationNotice',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'title', v_title
    )
  );

  return v_id;
end;
$$;
revoke all on function public.admin_save_operation_notice(text, jsonb, text) from public;
grant execute on function public.admin_save_operation_notice(text, jsonb, text) to authenticated;

create or replace function public.admin_toggle_operation_notice_status(
  p_notice_id   text,
  p_next_status text,
  p_reason      text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_notices%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_next_status not in ('published','hidden') then
    raise exception 'invalid status: %', p_next_status;
  end if;

  select * into v_old
    from public.operation_notices
   where id = p_notice_id
   for update;
  if not found then raise exception 'unknown notice id: %', p_notice_id; end if;
  if v_old.status = p_next_status then
    raise exception 'notice already %', p_next_status;
  end if;

  update public.operation_notices
     set status = p_next_status,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_notice_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'notice_status_changed',
    'OperationNotice',
    p_notice_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title)
  );

  return p_notice_id;
end;
$$;
revoke all on function public.admin_toggle_operation_notice_status(text, text, text) from public;
grant execute on function public.admin_toggle_operation_notice_status(text, text, text) to authenticated;

create or replace function public.admin_delete_operation_notice(
  p_notice_id text,
  p_reason    text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_notices%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_notices
   where id = p_notice_id
   for update;
  if not found then raise exception 'unknown notice id: %', p_notice_id; end if;

  delete from public.operation_notices where id = p_notice_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'notice_deleted',
    'OperationNotice',
    p_notice_id,
    jsonb_build_object(
      'reason', p_reason,
      'title', v_old.title,
      'status', v_old.status,
      'author', v_old.author,
      'created_at', v_old.created_at,
      'updated_at', v_old.updated_at
    )
  );

  return p_notice_id;
end;
$$;
revoke all on function public.admin_delete_operation_notice(text, text) from public;
grant execute on function public.admin_delete_operation_notice(text, text) to authenticated;
