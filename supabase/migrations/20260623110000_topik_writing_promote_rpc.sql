-- =====================================================================
-- topik-ai admin · 외부 API 문항 적재 P6 · 0004
-- admin_promote_writing_questions: 인박스(full §7 payload) → §7 정식 문항 upsert.
--
-- 매핑(질문1 결정): question_id 기준 upsert.
--   - §7에 없으면 INSERT(생성): service_status=internal_test(관리자 미결정), 태그 없음.
--   - §7에 있으면 UPDATE: 상류 콘텐츠·메타데이터만 덮어쓰고, 관리자 소유 필드는 보존
--       · service_status(노출) = 기존 값 유지(재동기화가 노출을 절대 되돌리지 않음)
--       · created_at = 기존 값 유지
--       · 태그(topik_writing_question_tags) = 별도 테이블 → 손대지 않음(자동 유지)
--   delete+insert로 구현(§7를 FK로 참조하는 자식 없음 — 확인됨). jsonb_populate_record로
--   raw_payload의 §7 컬럼명 1:1 매핑(상류가 우리 컬럼명을 그대로 사용). 매핑 미존재 키
--   (review_status 등 삭제 컬럼)는 무시. service_status는 ASCII로 강제(상류 한글 값 차단).
--
-- 검증 실패(필수 NULL/주제 FK/타입)는 항목별로 격리·롤백 후 인박스 mapping_status='held',
--   hold_reason=SQLERRM 기록(크래시 없음). 성공은 'promoted' + promoted_question_id.
-- 감사: action='question_received', target_table='AssessmentQuestion', target_id=question_id.
-- 권한: service_role 전용(actor 명시). 'raw'(신규/내용변경)·'held'(재시도) 대상 승격.
-- down: supabase/migrations/down/20260623110000_topik_writing_promote_rpc.sql
-- =====================================================================

create or replace function public.admin_promote_writing_questions(
  p_actor_id     uuid,
  p_question_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row              record;
  v_table            text;
  v_payload          jsonb;
  v_existing_status  text;
  v_existing_created timestamptz;
  v_new           integer := 0;
  v_updated       integer := 0;
  v_held          integer := 0;
  v_skipped_review integer := 0;
  v_failures      jsonb   := '[]'::jsonb;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;

  for v_row in
    select import_id, source_task_id, item_number, raw_payload
      from public.topik_writing_question_import
     where is_latest
       and mapping_status in ('raw', 'held')
       and (p_question_ids is null or source_task_id = any(p_question_ids))
  loop
    begin
      -- 검수 완료 게이트(fail-closed): 상류 review_status가 정확히 '검수 완료'가 아니면
      -- (누락·다른 값 포함) §7로 승격하지 않는다. 받아올 데이터는 반드시 검수 완료여야 함.
      if v_row.raw_payload->>'review_status' is distinct from '검수 완료' then
        update public.topik_writing_question_import
           set mapping_status = 'held', hold_reason = '검수 미완료(review_status<>검수 완료)'
         where import_id = v_row.import_id;
        v_skipped_review := v_skipped_review + 1;
        continue;
      end if;
      if v_row.item_number is null or v_row.item_number not in (51, 52, 53, 54) then
        raise exception 'unresolvable item_number';
      end if;
      v_table := format('topik_writing_%s_questions', v_row.item_number);

      -- 관리자 소유 필드 캡처(보존). 신규면 NULL.
      v_existing_status := null;
      v_existing_created := null;
      execute format('select service_status, created_at from public.%I where question_id = $1', v_table)
        into v_existing_status, v_existing_created
        using v_row.source_task_id;

      v_payload := v_row.raw_payload
        || jsonb_build_object(
             'service_status', coalesce(v_existing_status, 'internal_test'),
             'created_at', to_jsonb(coalesce(v_existing_created, now())),
             'updated_at', to_jsonb(now())
           );

      execute format('delete from public.%I where question_id = $1', v_table)
        using v_row.source_task_id;
      execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)', v_table, v_table)
        using v_payload;

      update public.topik_writing_question_import
         set mapping_status = 'promoted', promoted_question_id = v_row.source_task_id, hold_reason = null
       where import_id = v_row.import_id;

      if v_existing_status is null then v_new := v_new + 1; else v_updated := v_updated + 1; end if;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        p_actor_id, 'question_received', 'AssessmentQuestion', v_row.source_task_id, '{}'::jsonb,
        jsonb_build_object(
          'event', case when v_existing_status is null then 'promoted_new' else 'promoted_updated' end,
          'item_number', v_row.item_number
        )
      );
    exception when others then
      -- 항목 격리: 실패 행은 롤백(기존 §7 행 보존) 후 인박스에 held 표식.
      v_held := v_held + 1;
      update public.topik_writing_question_import
         set mapping_status = 'held', hold_reason = left(coalesce(sqlerrm, ''), 300)
       where import_id = v_row.import_id;
      if jsonb_array_length(v_failures) < 50 then
        v_failures := v_failures || jsonb_build_object(
          'question_id', v_row.source_task_id, 'error', left(coalesce(sqlerrm, ''), 300)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'promoted_new', v_new, 'promoted_updated', v_updated, 'held', v_held,
    'skipped_review', v_skipped_review, 'failures', v_failures
  );
end;
$$;

revoke all on function public.admin_promote_writing_questions(uuid, text[]) from public;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from anon;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from authenticated;
grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role;

comment on function public.admin_promote_writing_questions(uuid, text[]) is
  'service_role 전용. 인박스 full §7 payload를 §7 문항으로 upsert(질문1: question_id 기준, 콘텐츠 덮어쓰기 / service_status·created_at·태그 보존). jsonb_populate_record 매핑, service_status ASCII 강제. 실패는 held+hold_reason. 감사 question_received(AssessmentQuestion).';
