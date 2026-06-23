-- =====================================================================
-- topik-ai admin · 외부 API 문항 적재 P6 · 0002
-- admin_ingest_writing_task: 외부 응답 1건을 인박스에 무손실·버전보존 적재하는 RPC.
--
-- 호출 맥락: 브라우저 anon/auth 키는 RLS로 INSERT 불가. 적재는 서버
--   (Vercel 라우트, api/auth-email/sync.ts 패턴)가 ① 관리자 JWT 검증으로 actor를
--   확인하고 ② service-role 키로 이 RPC를 호출한다. service-role은 auth.uid()가
--   NULL이므로 actor를 인자(p_actor_id)로 명시 전달한다. 실행 권한은 service_role
--   에만 부여 → actor 스푸핑 불가(신뢰 서버만 호출, GPT-5.5 검토 #7).
--
-- 멱등·버전(GPT-5.5 검토 #2/#3): (source_task_id, payload_hash)로 동일 버전 존재를
--   먼저 확인한다. 동일 내용 재수신 → last_seen/ingest_count만 갱신(unchanged).
--   내용 변경 재수신 → 기존 최신본 is_latest=false 강등 후 새 버전 insert(new_version).
--   최초 수신 → insert(inserted). 이전 원문은 절대 덮어쓰지 않는다("모두 기록").
--   ※ 강등을 insert보다 먼저 한다 — 부분 유니크 인덱스(task당 is_latest 1건) 위반 방지.
-- 감사: action='question_received', target_table='AssessmentQuestionImport'(승격 전이라
--   question_id 미존재 — 질문 단위 감사와 분리, GPT-5.5 검토 #9), target_id=source_task_id.
-- down: supabase/migrations/down/20260622160100_topik_writing_ingest_rpc.sql
-- =====================================================================

create or replace function public.admin_ingest_writing_task(
  p_actor_id        uuid,
  p_source_task_id  text,
  p_raw_payload     jsonb,
  p_raw_response_text text   default null,
  p_item_number     smallint default null,
  p_source_endpoint text     default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_sid        text := nullif(btrim(p_source_task_id), '');
  v_text       text;
  v_hash       text;
  v_import_id  bigint;
  v_existing_id bigint;
  v_superseded integer := 0;
  v_event      text;
begin
  -- 신뢰 서버(service-role)가 검증한 actor만 허용. content_admin 권한 필수.
  if p_actor_id is null then raise exception 'actor required'; end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_sid is null then raise exception 'source_task_id required'; end if;
  if p_raw_payload is null or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception 'raw_payload must be a json object';
  end if;
  if p_item_number is not null and p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be null or one of 51/52/53/54';
  end if;

  -- 해시는 원문 텍스트 기준(없으면 jsonb 정규화 텍스트). 무손실 원문이 우선.
  v_text := coalesce(p_raw_response_text, p_raw_payload::text);
  v_hash := md5(v_text);

  -- 동일 버전(같은 task+해시)이 이미 있나? → 갱신만(unchanged), 감사 없음.
  select import_id into v_existing_id
    from public.topik_writing_question_import
   where source_task_id = v_sid and payload_hash = v_hash;

  if v_existing_id is not null then
    update public.topik_writing_question_import
       set last_seen_at    = now(),
           ingest_count    = ingest_count + 1,
           item_number     = coalesce(p_item_number, item_number),
           source_endpoint = coalesce(p_source_endpoint, source_endpoint)
     where import_id = v_existing_id;
    return jsonb_build_object(
      'status', 'unchanged', 'import_id', v_existing_id,
      'source_task_id', v_sid, 'payload_hash', v_hash, 'item_number', p_item_number
    );
  end if;

  -- 새 내용 버전 → insert "전에" 기존 최신본을 강등(부분 유니크 인덱스 위반 방지).
  update public.topik_writing_question_import
     set is_latest = false
   where source_task_id = v_sid
     and is_latest;
  get diagnostics v_superseded = row_count;

  insert into public.topik_writing_question_import
    (source_task_id, payload_hash, raw_payload, raw_response_text,
     item_number, source_endpoint, is_latest, mapping_status)
  values
    (v_sid, v_hash, p_raw_payload, p_raw_response_text,
     p_item_number, p_source_endpoint, true, 'raw')
  returning import_id into v_import_id;

  v_event := case when v_superseded > 0 then 'new_version' else 'inserted' end;

  -- 감사: 외부 수신 이벤트. 승격 전이라 target은 import 단위(source_task_id).
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    p_actor_id, 'question_received', 'AssessmentQuestionImport', v_sid,
    '{}'::jsonb,
    jsonb_build_object(
      'event', v_event,
      'import_id', v_import_id,
      'payload_hash', v_hash,
      'item_number', p_item_number,
      'source_endpoint', p_source_endpoint
    )
  );

  return jsonb_build_object(
    'status', v_event, 'import_id', v_import_id,
    'source_task_id', v_sid, 'payload_hash', v_hash, 'item_number', p_item_number
  );
end;
$$;

-- 실행 권한: service_role 전용. anon/authenticated/public은 호출 불가(actor 스푸핑 차단).
revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from public;
revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from anon;
revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from authenticated;
grant execute on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) to service_role;

comment on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) is
  'service_role 전용(actor 명시 전달). 외부 응답 1건을 topik_writing_question_import에 무손실·버전보존 적재 — (source_task_id, payload_hash) 원자적 upsert, 변경 재전송은 새 버전(이전 버전 보존), 동일 재전송은 unchanged, admin_audit_logs question_received(target_table=AssessmentQuestionImport) 기록.';
