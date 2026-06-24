-- =====================================================================
-- topik-ai admin · v13 풀이용 §7 full 페이로드 읽기 RPC · 0008
-- get_available_writing_problem_payloads(): v13 서버가 풀이 화면 렌더에 쓰는
--   full 문제 페이로드(정답 포함)를 반환. **service_role 전용(서버 전용)**.
--
-- 배경(2026-06-23/24 오너 확정): v13는 §7(관리 DB)에서 쓰기 문제를 읽기 전용으로
--   가져온다. 목록은 learner-safe get_public_writing_questions(정답 제외)로, 풀이
--   화면은 이 함수로 full 페이로드를 받는다. "무엇을 학습자에게 노출할지"는 v13의
--   normalizer/컴포넌트가 결정한다(= 기존 problems 경로와 동일) — 그래서 정답까지
--   포함한 full 페이로드를 v13 **서버**에 준다.
--
-- 왜 service_role 전용인가(보안):
--   반환하는 raw_payload에는 정답(answer_key/canonical/model_answer 등)이 들어 있다.
--   따라서 anon/authenticated에 grant하면 학습자가 rpc를 직접 호출해 정답을 가져갈 수
--   있다(누출). 그래서 **service_role(서버 전용 키)에만 grant**한다 — v13 서버가
--   createSupabaseServiceRoleClient로만 호출하고, 브라우저엔 normalizer가 거른 결과만
--   전달된다. 학습자 토큰으로는 호출 불가.
--
-- 페이로드 출처: §7 추천 뷰(service_status='available' 게이트) ⋈ 적재 인박스
--   (topik_writing_question_import.raw_payload, is_latest). raw_payload는 외부 공급
--   원본(=v13 normalizer가 materials/answer_key/rubric로 파싱하는 위자드 픽스처 형태).
-- down: supabase/migrations/down/20260624100000_writing_problem_payload_rpc.sql
-- =====================================================================

create or replace function public.get_available_writing_problem_payloads(
  p_item_number smallint default null,
  p_question_id text default null
)
returns table (
  question_id   text,
  problem_uuid  uuid,
  item_number   smallint,
  raw_payload   jsonb
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    v.question_id,
    -- 결정적 uuid: question_id → md5 → uuid. v13가 problems.id로 그대로 사용
    -- (머터리얼라이즈 idempotent 키). 의존성 없는 안정 매핑(uuid-ossp 불요).
    md5(v.question_id)::uuid as problem_uuid,
    v.item_number,
    imp.raw_payload
  from public.topik_writing_question_recommendation_view v
  join public.topik_writing_question_import imp
    on imp.promoted_question_id = v.question_id
   and imp.is_latest
  where v.service_status = 'available'
    and (p_item_number is null or v.item_number = p_item_number)
    and (p_question_id is null or v.question_id = p_question_id)
  order by v.question_id;
$$;

revoke all on function public.get_available_writing_problem_payloads(smallint, text) from public;
revoke all on function public.get_available_writing_problem_payloads(smallint, text) from anon;
revoke all on function public.get_available_writing_problem_payloads(smallint, text) from authenticated;
grant execute on function public.get_available_writing_problem_payloads(smallint, text) to service_role;

comment on function public.get_available_writing_problem_payloads(smallint, text) is
  'service_role 전용(서버). v13 머터리얼라이저용 §7 full 페이로드(정답 포함) + 결정적 problem_uuid(md5(question_id)::uuid → v13 problems.id). service_status=available 게이트 + 적재 인박스 raw_payload. anon/authenticated 호출 차단(정답 누출 방지). 2026-06-24.';
