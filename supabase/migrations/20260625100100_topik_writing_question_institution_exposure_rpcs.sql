-- =====================================================================
-- topik-ai admin · TOPIK 쓰기 문항 기관별 노출 관리 RPC 3종
--   admin_set_writing_question_institutions   (지정/변경, set-semantics)
--   admin_clear_writing_question_institutions (전체 공개로 해제)
--   admin_list_writing_question_institutions  (조회)
--
-- 계약 선례 종합:
--   - 권한·reason·self-verify·감사: admin_assign_institution_code(20260623110000)
--   - 배열·문항별 BEGIN/EXCEPTION 격리·item 파싱·{total,changed,unchanged,blocked,
--     failed,details,batch_id} 반환 shape: admin_bulk_set_writing_question_service_status(20260623180000)
--   - (question_id, item_number) 합성 참조 실재 검증: admin_assign_question_tag(20260610201200)
--
-- 권한: 쓰기(set/clear)는 auth.uid() + private.is_content_admin (단건 노출 변경 RPC와
--   동일 경계 — content_admin 이 platform_admin 을 포함하므로 둘 다 통과). UI 인증 세션
--   호출이라 actor 파라미터를 받지 않는다(spoof 방지). 조회(list)는 노출 현황 표시용이라
--   private.is_admin (READ_ONLY 포함 모든 admin 가독, RLS 읽기와 동일 경계).
-- 멱등: 목표 집합과 현재 집합이 같으면 무변경(unchanged) — 감사 행을 만들지 않는다.
-- 격리: 문항별 BEGIN/EXCEPTION 서브트랜잭션 — 한 건 오류가 배치 전체를 중단시키지 않는다.
-- down: supabase/migrations/down/20260625100100_topik_writing_question_institution_exposure_rpcs.sql
-- =====================================================================

-- ── Write: set-semantics (전달 코드 집합 = 그 문항의 최종 허용 집합) ──────────────
--   빈 codes 배열 = 매핑 전체 제거(전체 공개). 단건 모달의 추가/제거를 1회로 반영하고
--   일괄(다중 문항)도 같은 RPC 로 처리한다.
create or replace function public.admin_set_writing_question_institutions(
  p_question_ids      text[],
  p_institution_codes text[],
  p_reason            text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_batch_id   uuid := gen_random_uuid();
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ids        text[];
  v_codes      text[];
  v_invalid    text[];
  v_target     text[];
  v_qid        text;
  v_item       int;
  v_table      text;
  v_exists     boolean;
  v_current    text[];
  v_added      text[];
  v_removed    text[];
  v_verify     text[];
  v_changed    integer := 0;
  v_unchanged  integer := 0;
  v_failed     integer := 0;
  v_total      integer := 0;
  v_details    jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null and btrim(x) <> '');
  if cardinality(v_ids) > 1000 then
    raise exception 'too many question_ids: % (max 1000 per call)', cardinality(v_ids);
  end if;

  -- 목표 기관 코드 집합(중복·공백 제거). 빈 배열 허용 = 전체 공개로 해제.
  -- 활성 코드 검증은 문항 루프 안에서 '신규 부여 코드(v_added)' 에만 적용한다 — 이미 매핑돼
  -- 유지되는 코드(이후 status='종료' 로 바뀐 코드 포함)는 set-semantics 상 신규 부여가 아니므로
  -- 면제한다(종료 코드 보유 문항도 다른 활성 코드로 편집 가능). 위반 시 해당 문항만 failed 로 격리.
  v_codes := array(select distinct btrim(x)
                     from unnest(coalesce(p_institution_codes, array[]::text[])) x
                    where x is not null and btrim(x) <> '');

  -- self-verify 비교용 목표 집합(정렬)
  v_target := array(select c from unnest(v_codes) c order by c);

  foreach v_qid in array v_ids loop
    v_total := v_total + 1;
    begin
      v_item := (substring(v_qid from '^topik-writing-(51|52|53|54)-'))::int;
      if v_item is null then
        raise exception 'invalid question_id format: %', v_qid;
      end if;
      v_table := format('topik_writing_%s_questions', v_item);
      execute format('select exists(select 1 from public.%I where question_id = $1)', v_table)
        into v_exists using v_qid;
      if not v_exists then
        raise exception 'question not found: % (item %)', v_qid, v_item;
      end if;

      select coalesce(array_agg(institution_code), array[]::text[])
        into v_current
        from public.topik_writing_question_institution_exposure
       where question_id = v_qid;

      v_added   := array(select c from unnest(v_codes)   c where c <> all(v_current));
      v_removed := array(select c from unnest(v_current) c where c <> all(v_codes));

      -- 신규 부여 코드만 활성 검증(유지되는 코드는 면제 — set-semantics 정합). 위반 시 이 문항만 failed.
      if cardinality(v_added) > 0 then
        select array(select c from unnest(v_added) c
                      where not exists (select 1 from public.institution_codes ic
                                         where ic.code = c and ic.status = '활성'))
          into v_invalid;
        if v_invalid is not null and cardinality(v_invalid) > 0 then
          raise exception 'unknown or inactive institution code(s): %', array_to_string(v_invalid, ', ');
        end if;
      end if;

      -- 멱등: 추가·제거 둘 다 없으면 무변경(감사 없음)
      if cardinality(v_added) = 0 and cardinality(v_removed) = 0 then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      if cardinality(v_added) > 0 then
        insert into public.topik_writing_question_institution_exposure
          (question_id, item_number, institution_code, created_by, reason)
        select v_qid, v_item::smallint, c, caller_id, v_reason from unnest(v_added) c
        on conflict (question_id, institution_code) do nothing;
      end if;
      if cardinality(v_removed) > 0 then
        delete from public.topik_writing_question_institution_exposure
         where question_id = v_qid and institution_code = any(v_removed);
      end if;

      -- self-verify: 기록된 집합이 목표와 정확히 일치해야 한다(트리거/정책이 조용히 막으면 실패).
      select array(select institution_code
                     from public.topik_writing_question_institution_exposure
                    where question_id = v_qid order by institution_code)
        into v_verify;
      if v_verify is distinct from v_target then
        raise exception 'institution set mismatch after write for % (got %, expected %)',
          v_qid, v_verify, v_target;
      end if;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'question_institutions_changed',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('institution_codes',
          jsonb_build_object('added', to_jsonb(v_added), 'removed', to_jsonb(v_removed))),
        jsonb_build_object('reason', v_reason, 'batch_id', v_batch_id,
          'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'bulk', true)
      );
      v_changed := v_changed + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_details) < 50 then
        v_details := v_details || jsonb_build_object(
          'question_id', v_qid, 'kind', 'failed', 'message', left(coalesce(sqlerrm, ''), 300));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'total', v_total, 'changed', v_changed, 'unchanged', v_unchanged,
    'blocked', 0, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

-- ── Write: clear (매핑 전체 제거 = 전체 공개로 복귀) ───────────────────────────────
create or replace function public.admin_clear_writing_question_institutions(
  p_question_ids text[],
  p_reason       text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_batch_id   uuid := gen_random_uuid();
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ids        text[];
  v_qid        text;
  v_removed    text[];
  v_changed    integer := 0;
  v_unchanged  integer := 0;
  v_failed     integer := 0;
  v_total      integer := 0;
  v_details    jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null and btrim(x) <> '');
  if cardinality(v_ids) > 1000 then
    raise exception 'too many question_ids: % (max 1000 per call)', cardinality(v_ids);
  end if;

  foreach v_qid in array v_ids loop
    v_total := v_total + 1;
    begin
      select coalesce(array_agg(institution_code), array[]::text[])
        into v_removed
        from public.topik_writing_question_institution_exposure
       where question_id = v_qid;

      -- 멱등: 이미 매핑 없음(전체 공개) → 무변경(감사 없음)
      if cardinality(v_removed) = 0 then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      delete from public.topik_writing_question_institution_exposure
       where question_id = v_qid;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'question_institutions_cleared',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('institution_codes',
          jsonb_build_object('removed', to_jsonb(v_removed), 'to', null)),
        jsonb_build_object('reason', v_reason, 'batch_id', v_batch_id,
          'removed', to_jsonb(v_removed), 'bulk', true)
      );
      v_changed := v_changed + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_details) < 50 then
        v_details := v_details || jsonb_build_object(
          'question_id', v_qid, 'kind', 'failed', 'message', left(coalesce(sqlerrm, ''), 300));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'total', v_total, 'changed', v_changed, 'unchanged', v_unchanged,
    'blocked', 0, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

-- ── Read: 문항별(또는 전수) 기관 노출 매핑 + 코드 라벨/상태 동반 ──────────────────
create or replace function public.admin_list_writing_question_institutions(
  p_question_id text default null
)
returns table (
  question_id        text,
  item_number        smallint,
  institution_code   text,
  institution_label  text,
  institution_status text,
  reason             text,
  created_at         timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_qid     text := nullif(btrim(coalesce(p_question_id, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;

  return query
    select e.question_id, e.item_number, e.institution_code,
           ic.label, ic.status, e.reason, e.created_at
      from public.topik_writing_question_institution_exposure e
      left join public.institution_codes ic on ic.code = e.institution_code
     where (v_qid is null or e.question_id = v_qid)
     order by e.question_id, e.institution_code;
end;
$$;

revoke all     on function public.admin_set_writing_question_institutions(text[], text[], text) from public;
revoke all     on function public.admin_set_writing_question_institutions(text[], text[], text) from anon;
grant  execute on function public.admin_set_writing_question_institutions(text[], text[], text) to authenticated;
revoke all     on function public.admin_clear_writing_question_institutions(text[], text) from public;
revoke all     on function public.admin_clear_writing_question_institutions(text[], text) from anon;
grant  execute on function public.admin_clear_writing_question_institutions(text[], text) to authenticated;
revoke all     on function public.admin_list_writing_question_institutions(text) from public;
revoke all     on function public.admin_list_writing_question_institutions(text) from anon;
grant  execute on function public.admin_list_writing_question_institutions(text) to authenticated;

comment on function public.admin_set_writing_question_institutions(text[], text[], text) is
  'content_admin 전용(UI 세션·auth.uid()). 선택 문항 N건의 기관 노출 허용 집합을 set-semantics 로 동기화(빈 codes=전체 공개). 신규 부여 코드는 활성 코드만 허용(유지 코드 면제)·문항별 격리·멱등(무변경 무감사)·self-verify·변경 문항마다 감사(question_institutions_changed, batch_id 묶음). {total,changed,unchanged,blocked,failed,details,batch_id} 반환.';
comment on function public.admin_clear_writing_question_institutions(text[], text) is
  'content_admin 전용. 선택 문항 N건의 기관 노출 매핑을 전부 제거(전체 공개로 복귀). 멱등(무변경 무감사)·문항별 격리·변경 문항마다 감사(question_institutions_cleared). 동일 jsonb shape 반환.';
comment on function public.admin_list_writing_question_institutions(text) is
  'admin 전용 read. 문항별(p_question_id) 또는 전수(null) 기관 노출 매핑을 institution_codes 라벨/상태와 함께 반환(관리 화면 칩·설정 모달용).';
