-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0012
-- 감사 RPC 3종 (실행 계획안 §5.3, 결정 기록 D-6/D-7/D-8)
--
-- 계약: SECURITY DEFINER + private.is_content_admin 가드 + 화이트리스트 patch
--       + admin_audit_logs(actor, action, target_table='AssessmentQuestion',
--       target_id=question_id, diff={col:{from,to}}, payload={"review_note":...}).
--       v13 구 admin_update_problem(2026-06-09 drop됨)의 계약 원문을 계승한다.
-- down: supabase/migrations/down/20260610201200_topik_writing_admin_rpcs.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. admin_update_topik_question(question_id, item_number, patch)
--    가변 컬럼 화이트리스트: review_status / review_workflow_status /
--    service_status / content_team_memo. 예약 키 '__note' → 감사 payload.
--    가드: service_status='available' 전환은 review_status='approved' 필수(D-6 ①).
--    review_status='approved' 전이 시 review_passed=true 동기 기록.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_topik_question(
  p_question_id text,
  p_item_number smallint,
  p_patch       jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  v_table    text;
  v_old      jsonb;
  v_diff     jsonb := '{}'::jsonb;
  v_note     text  := nullif(p_patch->>'__note', '');
  v_payload  jsonb := '{}'::jsonb;
  v_action   text;
  v_new_review_status text;
  v_effective_review_status text;
  k          text;
  v_from     text;
  v_to       text;
  allowed    text[] := array['review_status', 'review_workflow_status', 'service_status', 'content_team_memo'];
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_question_id is null then raise exception 'question_id required'; end if;
  if p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be one of 51/52/53/54';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;

  v_table := format('topik_writing_%s_questions', p_item_number);

  execute format(
    'select to_jsonb(t) from public.%I t where t.question_id = $1', v_table)
    into v_old using p_question_id;
  if v_old is null then raise exception 'question not found: %', p_question_id; end if;

  -- D-6 ①: available 전환 가드 — 전이 후 기준의 review_status가 approved여야 한다.
  v_new_review_status := p_patch->>'review_status';
  v_effective_review_status := coalesce(v_new_review_status, v_old->>'review_status');
  if p_patch->>'service_status' = 'available' and v_effective_review_status <> 'approved' then
    raise exception 'service_status=available requires review_status=approved (POL-018)';
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      continue; -- '__note' 포함 미허용 키는 컬럼에 닿지 않는다
    end if;
    v_from := v_old->>k;
    v_to   := p_patch->>k;
    if v_from is distinct from v_to then
      execute format('update public.%I set %I = $1, updated_at = now() where question_id = $2', v_table, k)
        using v_to, p_question_id;
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', v_from, 'to', v_to));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then
    return; -- 변경 없음 → 감사 행 없음 (v13 관행 계승)
  end if;

  -- D-2: 검수 완료 전이 시 최종 검수 통과 플래그 동기 기록
  if v_diff ? 'review_status' and v_new_review_status = 'approved' then
    execute format('update public.%I set review_passed = true where question_id = $1', v_table)
      using p_question_id;
  end if;

  -- D-8: 결정적 액션 코드 파생
  if v_diff ? 'service_status' then
    v_action := 'service_status_changed';
  elsif v_diff ? 'review_status' and v_new_review_status = 'approved' then
    v_action := 'review_completed';
  elsif v_diff ? 'review_status' and v_new_review_status = 'needs_revision' then
    v_action := 'review_revision_requested';
  elsif (v_diff ? 'review_status' and v_new_review_status = 'on_hold')
     or (v_diff ? 'review_workflow_status' and p_patch->>'review_workflow_status' = 'on_hold') then
    v_action := 'review_on_hold';
  elsif v_diff ? 'review_workflow_status' then
    v_action := 'review_status_changed';
  else
    v_action := 'review_memo_saved';
  end if;

  if v_note is not null then
    v_payload := jsonb_build_object('review_note', v_note);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, v_action, 'AssessmentQuestion', p_question_id, v_diff, v_payload);
end;
$$;
revoke all on function public.admin_update_topik_question(text, smallint, jsonb) from public;
grant execute on function public.admin_update_topik_question(text, smallint, jsonb) to authenticated;
comment on function public.admin_update_topik_question(text, smallint, jsonb) is
  'content_admin 전용. topik_writing_5x_questions 가변 컬럼(검수 2축/service_status/메모) patch + admin_audit_logs diff 기록. 예약 키 __note는 payload.review_note로 저장(D-7).';

-- ---------------------------------------------------------------------
-- 2. admin_assign_question_tag(question_id, item_number, tag_code, tag_value)
--    가드: 태그 사전 존재+활성, '서비스_노출상태' 그룹 부여 차단(D-6),
--          (question_id, item_number) 합성 참조 실재 검증, 중복 활성 부여 차단.
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
  caller_id    uuid := auth.uid();
  v_tag        public.topik_writing_tag_master%rowtype;
  v_exists     boolean;
  v_assignment_id bigint;
  v_assigned_by text;
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
-- 3. admin_remove_question_tag(tag_assignment_id)
--    is_active=false + removed_at 갱신 방식(이력 보존), 감사 기록 동반.
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
