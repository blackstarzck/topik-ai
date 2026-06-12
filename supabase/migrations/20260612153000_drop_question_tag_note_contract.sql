-- =====================================================================
-- topik-ai admin · metadata/tag schema follow-up
-- Drop the question tag note column from the current contract.
-- down: supabase/migrations/down/20260612153000_drop_question_tag_note_contract.sql
-- =====================================================================

drop function if exists public.admin_assign_question_tag(text, smallint, text, text, text);
drop function if exists public.admin_remove_question_tag(bigint, text);

alter table public.topik_writing_question_tags
  drop column if exists memo;

-- ---------------------------------------------------------------------
-- admin_assign_question_tag(question_id, item_number, tag_code, tag_value)
-- 가드: 태그 사전 존재+활성, '서비스_노출상태' 그룹 부여 차단(D-6),
--       (question_id, item_number) 합성 참조 실재 검증, 중복 활성 부여 차단.
-- ---------------------------------------------------------------------
create or replace function public.admin_assign_question_tag(
  p_question_id text,
  p_item_number smallint,
  p_tag_code    text,
  p_tag_value   text default null
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id       uuid := auth.uid();
  v_tag           public.topik_writing_tag_master%rowtype;
  v_exists        boolean;
  v_assignment_id bigint;
  v_assigned_by   text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be one of 51/52/53/54';
  end if;

  select * into v_tag from public.topik_writing_tag_master where tag_code = p_tag_code;
  if not found then raise exception 'unknown tag_code: %', p_tag_code; end if;
  if not v_tag.is_active then raise exception 'tag is inactive: %', p_tag_code; end if;
  if v_tag.tag_group = '서비스_노출상태' then
    raise exception 'exposure-status tag group is blocked: use service_status column (D-6)';
  end if;

  execute format('select exists(select 1 from public.%I where question_id = $1)',
                 format('topik_writing_%s_questions', p_item_number))
    into v_exists using p_question_id;
  if not v_exists then raise exception 'question not found: % (item %)', p_question_id, p_item_number; end if;

  select coalesce(display_name, id::text) into v_assigned_by from public.profiles where id = caller_id;

  begin
    insert into public.topik_writing_question_tags
      (question_id, item_number, tag_code, tag_value, assigned_by)
    values (p_question_id, p_item_number, p_tag_code, p_tag_value, v_assigned_by)
    returning tag_assignment_id into v_assignment_id;
  exception when unique_violation then
    raise exception 'tag already active on this question: %', p_tag_code;
  end;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'tag_assigned', 'AssessmentQuestion', p_question_id,
    jsonb_build_object('tag', jsonb_build_object('from', null, 'to', p_tag_code),
                       'tag_value', jsonb_build_object('from', null, 'to', p_tag_value)),
    '{}'::jsonb
  );

  return v_assignment_id;
end;
$$;
revoke all on function public.admin_assign_question_tag(text, smallint, text, text) from public;
grant execute on function public.admin_assign_question_tag(text, smallint, text, text) to authenticated;
comment on function public.admin_assign_question_tag(text, smallint, text, text) is
  'content_admin 전용. 문항 태그 부여(이력 보존형). 서비스_노출상태 그룹 차단(D-6), 합성 참조 검증, admin_audit_logs 기록(tag_assigned).';

-- ---------------------------------------------------------------------
-- admin_remove_question_tag(tag_assignment_id)
-- is_active=false + removed_at 갱신 방식(이력 보존), 감사 기록 동반.
-- ---------------------------------------------------------------------
create or replace function public.admin_remove_question_tag(
  p_tag_assignment_id bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_row     public.topik_writing_question_tags%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;

  select * into v_row from public.topik_writing_question_tags
   where tag_assignment_id = p_tag_assignment_id;
  if not found then raise exception 'tag assignment not found: %', p_tag_assignment_id; end if;
  if not v_row.is_active then raise exception 'tag assignment already removed: %', p_tag_assignment_id; end if;

  update public.topik_writing_question_tags
     set is_active = false,
         removed_at = now()
   where tag_assignment_id = p_tag_assignment_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'tag_removed', 'AssessmentQuestion', v_row.question_id,
    jsonb_build_object('tag', jsonb_build_object('from', v_row.tag_code, 'to', null)),
    '{}'::jsonb
  );
end;
$$;
revoke all on function public.admin_remove_question_tag(bigint) from public;
grant execute on function public.admin_remove_question_tag(bigint) to authenticated;
comment on function public.admin_remove_question_tag(bigint) is
  'content_admin 전용. 문항 태그 제거 — is_active=false+removed_at(이력 보존), admin_audit_logs 기록(tag_removed).';
