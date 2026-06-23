-- =====================================================================
-- topik-ai admin · TOPIK 쓰기 문항 단건 노출 조치 감사 사유 정합성 · 0006
-- admin_update_topik_question 의 감사 payload 에 'reason' 키를 추가한다.
--
-- 배경: 감사 읽기 RPC admin_list_audit_logs(20260618001000)는 사유를
--   payload->>'reason' 으로 노출한다. 그런데 단건 노출 조치 RPC는 사유를
--   payload.note 로만 기록해 와서 감사 화면의 '사유' 칸이 비어 보였다(잠재 결함).
--   일괄 처리 RPC(admin_bulk_set_writing_question_service_status, 0005)는 note·reason
--   둘 다 기록한다 — 단건도 동일하게 맞춰 두 경로의 감사 사유 표기를 정합화한다.
--
-- 변경: payload 를 {note} → {note, reason}(둘 다 동일 사유)로만 확장. 그 외 계약
--   (auth.uid()+is_content_admin, service_status 단일 화이트리스트, 무변경 무감사,
--   action='service_status_changed', target_table='AssessmentQuestion')은 불변.
-- down: supabase/migrations/down/20260623181000_topik_writing_question_audit_reason.sql
-- =====================================================================

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
  k          text;
  v_from     text;
  v_to       text;
  allowed    text[] := array['service_status'];
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
    return; -- 변경 없음 → 감사 행 없음
  end if;

  if v_note is not null then
    -- note(예약 키 호환) + reason(감사 읽기 RPC 노출 키) 동시 기록.
    v_payload := jsonb_build_object('note', v_note, 'reason', v_note);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'service_status_changed', 'AssessmentQuestion', p_question_id, v_diff, v_payload);
end;
$$;
revoke all on function public.admin_update_topik_question(text, smallint, jsonb) from public;
grant execute on function public.admin_update_topik_question(text, smallint, jsonb) to authenticated;
comment on function public.admin_update_topik_question(text, smallint, jsonb) is
  'content_admin 전용. topik_writing_5x_questions의 service_status(노출 통제) patch + admin_audit_logs diff 기록. 예약 키 __note는 payload.note·payload.reason(감사 읽기 노출 키)에 동시 저장(2026-06-23 정합화).';
