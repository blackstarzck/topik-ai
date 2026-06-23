-- =====================================================================
-- topik-ai admin · 외부 API 문항 적재 P6 · 0003
-- admin_ingest_writing_tasks_bulk: 외부 응답 N건을 한 번의 DB 왕복으로 무손실 적재.
--
-- 배경: 적재 버튼/cron이 전체 목록(수백 건)을 동기화한다. 항목마다 RPC를 따로
--   호출하면 서버리스 함수에서 수백 회 왕복 → 타임아웃 위험. 그래서 배열을 받아
--   서버측에서 루프하며 기존 admin_ingest_writing_task를 재사용한다(검증된 멱등·
--   버전·감사 로직 그대로). 한 번의 호출로 집계(inserted/new_version/unchanged/failed) 반환.
--
-- 권한: service_role 전용(actor 명시 전달). 항목별 실패는 격리(서브트랜잭션)해
--   한 건 오류가 배치 전체를 중단시키지 않는다.
-- down: supabase/migrations/down/20260623100000_topik_writing_ingest_bulk_rpc.sql
-- =====================================================================

create or replace function public.admin_ingest_writing_tasks_bulk(
  p_actor_id        uuid,
  p_source_endpoint text,
  p_tasks           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item        jsonb;
  v_res         jsonb;
  v_status      text;
  v_inserted    integer := 0;
  v_new_version integer := 0;
  v_unchanged   integer := 0;
  v_failed      integer := 0;
  v_failures    jsonb   := '[]'::jsonb;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'tasks must be a json array';
  end if;

  for v_item in select * from jsonb_array_elements(p_tasks) loop
    begin
      v_res := public.admin_ingest_writing_task(
        p_actor_id,
        v_item->>'source_task_id',
        v_item->'raw_payload',
        v_item->>'raw_response_text',
        nullif(v_item->>'item_number', '')::smallint,
        p_source_endpoint
      );
      v_status := v_res->>'status';
      if v_status = 'inserted' then
        v_inserted := v_inserted + 1;
      elsif v_status = 'new_version' then
        v_new_version := v_new_version + 1;
      else
        v_unchanged := v_unchanged + 1;
      end if;
    exception when others then
      -- 항목별 격리: 한 건 오류는 해당 항목만 롤백하고 배치는 계속.
      -- 사유(SQLERRM) 보존 — 권한/제약 오류가 일반 실패와 구분 안 되는 문제 방지(관측성).
      v_failed := v_failed + 1;
      if jsonb_array_length(v_failures) < 50 then
        v_failures := v_failures || jsonb_build_object(
          'source_task_id', v_item->>'source_task_id',
          'error', left(coalesce(sqlerrm, ''), 300)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'new_version', v_new_version,
    'unchanged', v_unchanged,
    'failed', v_failed,
    'total', jsonb_array_length(p_tasks),
    'failures', v_failures
  );
end;
$$;

revoke all on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) from public;
revoke all on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) from anon;
revoke all on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) from authenticated;
grant execute on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) to service_role;

comment on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) is
  'service_role 전용. 외부 응답 배열을 한 번의 호출로 무손실 적재 — 항목별로 admin_ingest_writing_task 재사용(멱등·버전·감사), 항목 실패는 격리. inserted/new_version/unchanged/failed 집계 반환.';
