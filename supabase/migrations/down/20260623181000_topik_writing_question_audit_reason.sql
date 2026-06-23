-- down: 20260623181000_topik_writing_question_audit_reason.sql
-- admin_update_topik_question 의 감사 payload 를 note 단독(20260611190100 정의)으로 되돌린다.
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
      continue;
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
    return;
  end if;

  if v_note is not null then
    v_payload := jsonb_build_object('note', v_note);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'service_status_changed', 'AssessmentQuestion', p_question_id, v_diff, v_payload);
end;
$$;
revoke all on function public.admin_update_topik_question(text, smallint, jsonb) from public;
grant execute on function public.admin_update_topik_question(text, smallint, jsonb) to authenticated;
