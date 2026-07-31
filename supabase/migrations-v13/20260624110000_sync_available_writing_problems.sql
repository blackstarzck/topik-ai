-- =====================================================================
-- v13 · §7(admin 관리) 공개 쓰기 문항을 problems로 머터리얼라이즈 · 동기화
--
-- 배경(2026-06-24 오너 확정): 쓰기 문제의 원본/원장은 topik-ai의 §7 스키마
--   (topik_writing_5x_questions, service_status로 노출 제어)다. v13 사용자 화면은
--   §7에서 읽지만, v13의 풀이/초안/서재/제출은 전부 public.problems(uuid PK)에 FK로
--   묶여 있어 §7 text question_id를 직접 쓸 수 없다. 그래서 §7의 service_status=
--   'available' 문항을 problems에 **사본(미러)으로 upsert**한다(§7=SoT, problems=v13
--   파생 미러). problems.id = topik-ai가 내려주는 결정적 uuid(md5(question_id)::uuid)
--   라 idempotent. 콘텐츠(materials/answer_key/rubric/prompt)는 §7 적재 원본
--   raw_payload 그대로 — v13 problem-normalizer가 기대하는 위자드 형태와 동일.
--
-- 노출 결정은 §7가, "무엇을 학습자에게 보일지"는 v13 normalizer/컴포넌트가 담당.
-- 미available 전환분은 하드삭제 금지(writing_submissions.problem_id on delete
--   restrict) — publish_status='archived'+lifecycle_status='inactive'로 내린다.
--
-- 출처 함수: topik-ai get_available_writing_problem_payloads(service_role 전용,
--   §7 available ⋈ 적재 인박스 raw_payload + problem_uuid). SECURITY DEFINER로
--   소유자 권한 실행해 호출/쓰기.
-- =====================================================================

create or replace function public.sync_available_writing_problems()
returns table (synced integer, archived integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_synced   integer := 0;
  v_archived integer := 0;
begin
  with up as (
    insert into public.problems (
      id, source, domain, question_no, topik_level, difficulty, tags, title, prompt,
      materials, answer_key, rubric, publish_status, visibility, lifecycle_status, updated_at
    )
    select
      pp.problem_uuid,
      'curated',
      'writing',
      pp.item_number,
      2,  -- TOPIK II (problems.topik_level CHECK in (1,2); 쓰기 51~54는 전부 II). 등급(3~6급)은 target_level/difficulty로 별도 표현

      -- 난이도: §7 difficulty_level(1~6=TOPIK 급수)을 problems.difficulty(CHECK 1~5)로 클램프.
      -- v13 문제목록의 난이도 칩(하/중/상 버킷)과 예상시간(난이도에서 파생)을 함께 구동. 없으면 null(→'-').
      case
        when nullif(pp.raw_payload->>'difficulty_level', '') is null then null
        else least(greatest((pp.raw_payload->>'difficulty_level')::int, 1), 5)::smallint
      end,
      -- 태그 칩: §7 분류(주제/세부/화행/시나리오)를 사람이 읽는 한글 태그로(순서 보존·중복/빈값 제거).
      coalesce((
        select array_agg(t order by ord)
        from (
          select t, min(ord) as ord
          from (
            select 1 as ord, nullif(pp.raw_payload->>'topic_main', '')    as t
            union all select 2, nullif(pp.raw_payload->>'topic_detail', '')
            union all select 3, nullif(pp.raw_payload->>'speech_act', '')
            union all select 4, nullif(pp.raw_payload->>'scenario_type', '')
          ) src
          where t is not null
          group by t
        ) d
      ), '{}')::text[],

      coalesce(
        nullif(pp.raw_payload->>'topic_seed_title', ''),
        nullif(pp.raw_payload#>>'{approved_topic_seed,topic_seed_title}', ''),
        nullif(pp.raw_payload#>>'{scenario_logic,scenario_title}', ''),
        nullif(pp.raw_payload->>'situation_summary', ''),
        nullif(pp.raw_payload->>'topic_main', ''),
        '쓰기 문제'
      ),
      coalesce(pp.raw_payload->>'prompt_text', ''),
      pp.raw_payload,
      pp.raw_payload->'answer_key',
      coalesce(pp.raw_payload->'rubric', pp.raw_payload->'approved_rubric'),
      'published',
      'public',
      'active',
      now()
    from public.get_available_writing_problem_payloads(null, null) pp
    on conflict (id) do update set
      question_no     = excluded.question_no,
      topik_level     = excluded.topik_level,
      difficulty      = excluded.difficulty,
      tags            = excluded.tags,
      title           = excluded.title,
      prompt          = excluded.prompt,
      materials       = excluded.materials,
      answer_key      = excluded.answer_key,
      rubric          = excluded.rubric,
      publish_status  = 'published',
      visibility      = 'public',
      lifecycle_status = 'active',
      updated_at      = now()
    returning 1
  )
  select count(*) into v_synced from up;

  update public.problems pr
     set publish_status  = 'archived',
         lifecycle_status = 'inactive',
         updated_at       = now()
   where pr.domain = 'writing'
     and pr.source = 'curated'
     and pr.publish_status <> 'archived'
     and pr.id not in (
       select pp.problem_uuid from public.get_available_writing_problem_payloads(null, null) pp
     );
  get diagnostics v_archived = row_count;

  return query select v_synced, v_archived;
end;
$$;

revoke all on function public.sync_available_writing_problems() from public;
revoke all on function public.sync_available_writing_problems() from anon;
grant execute on function public.sync_available_writing_problems() to service_role;

comment on function public.sync_available_writing_problems() is
  'v13: §7(topik-ai) service_status=available 쓰기문항을 public.problems로 idempotent 미러(id=md5(question_id)::uuid, 콘텐츠=§7 raw_payload). 미available은 archived/inactive 처리(하드삭제 금지). service_role 전용. 2026-06-24.';

-- 주기 동기화: admin이 §7 service_status를 토글하면 1분 내 problems 미러에 반영된다.
-- (교차 소유권 트리거 대신 v13이 자기 동기화를 스케줄 — cleanup cron 선례와 동일.)
-- 재실행 안전(unschedule 후 schedule). pg_cron 부재 환경(로컬 등)에서는 조용히 skip.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sync-writing-problems') then
    perform cron.unschedule('sync-writing-problems');
  end if;
  perform cron.schedule('sync-writing-problems', '* * * * *', 'select public.sync_available_writing_problems();');
exception
  when undefined_table or undefined_function or insufficient_privilege then
    raise notice 'pg_cron unavailable — sync-writing-problems not scheduled; run sync_available_writing_problems() manually or wire another trigger.';
end $$;
