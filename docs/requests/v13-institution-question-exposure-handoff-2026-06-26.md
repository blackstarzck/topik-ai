# v13 기관별 TOPIK 쓰기 문항 노출 적용 handoff (2026-06-26)

## 1. 목적

topik-ai admin에서 기관 코드별로 TOPIK 쓰기 문항을 전용 노출할 수 있게 되었다. v13 사용자 화면은 같은 Supabase 호스트의 `problems` 미러를 사용하므로, 사용자에게 문항을 보여주는 모든 경로에 기관 노출 조건을 적용해야 한다.

이 문서는 v13 작업자가 바로 구현 범위를 잡을 수 있도록 admin 쪽 SoT, v13 코드 조사 결과, 적용해야 할 파일, 권장 DB predicate, 검증 기준을 정리한 handoff다.

## 2. 현재 admin SoT

관리 화면:

- topik-ai admin route: `/users/institution-codes`
- 기능: 기관 코드 상세의 `노출 문항` 모달에서 기관 소속 회원에게 전용 노출할 TOPIK 쓰기 문항을 추가/해제한다.
- UI 모델: `src/features/users/model/institution-questions-types.ts`
- Supabase adapter: `src/features/users/api/supabase-institution-questions-service.ts`

DB SoT:

- 테이블: `public.topik_writing_question_institution_exposure`
- migration: `topik-ai/supabase/migrations/20260625100000_topik_writing_question_institution_exposure.sql`
- 역방향 기관 중심 RPC: `topik-ai/supabase/migrations/20260625100200_topik_writing_question_institution_reverse_rpcs.sql`
- 주요 admin RPC:
  - `admin_list_institution_writing_questions(p_institution_code text)`
  - `admin_add_institution_writing_questions(p_institution_code text, p_question_ids text[], p_reason text)`
  - `admin_remove_institution_writing_questions(p_institution_code text, p_question_ids text[], p_reason text)`

노출 계약:

```sql
visible_to(user, question) :=
  question.service_status = 'available'
  and (
    not exists (
      select 1
      from public.topik_writing_question_institution_exposure e
      where e.question_id = question.question_id
    )
    or exists (
      select 1
      from public.topik_writing_question_institution_exposure e
      where e.question_id = question.question_id
        and e.institution_code = user.affiliation_code
    )
  )
```

의미:

- 매핑 행이 없는 문항은 종전처럼 전체 공개다.
- 매핑 행이 하나라도 있는 문항은 기관 한정 문항이다.
- 기관 한정 문항은 `profiles.affiliation_code`가 해당 `institution_code`와 일치하는 사용자에게만 보인다.
- 매핑은 `service_status=available` 위에 얹히는 추가 노출 레이어다. `available`이 아니면 매핑과 무관하게 v13 사용자 화면에 노출하지 않는다.

주의:

- `topik_writing_question_institution_exposure.question_id`는 `text`다.
- v13 `public.problems.id`는 `uuid`다.
- v13 migration `20260624110000_sync_available_writing_problems.sql` 기준으로 `problems.id = md5(question_id)::uuid`인 파생 미러다. 가능하면 `problems.materials->>'question_id'`를 우선 사용하고, 필요 시 `md5(question_id)::uuid` 규칙으로 매칭한다.

## 3. v13 코드 조사 결과

조사 대상 repo:

- `C:\Users\admin\Desktop\workspace\topik-project\v13`

확인한 기존 전제:

- v13은 `profiles.affiliation_code`를 이미 보유한다.
  - migration: `supabase/migrations/20260619140000_profiles_affiliation_code.sql`
  - 기관 코드는 opaque text로 취급한다.
- v13은 topik-ai §7 available 쓰기 문항을 `public.problems`로 미러링한다.
  - migration: `supabase/migrations/20260624110000_sync_available_writing_problems.sql`
  - `problems.id = md5(question_id)::uuid`
  - 미available 문항은 hard delete가 아니라 `publish_status='archived'`, `lifecycle_status='inactive'`로 내린다.

현재 v13 누락:

| 사용자 경로 | v13 파일 | 현재 동작 | 필요한 조치 |
| --- | --- | --- | --- |
| 직접 쓰기 진입 | `src/app/(workspace)/writing/_components/WritingQuestionRoute.tsx`, `src/lib/writing/server.ts#getWritingProblem` | `domain='writing'`, `question_no`, `publish_status='published'`, `lifecycle_status='active'`만 확인한다. `?problem=<uuid>` direct link도 같은 조건만 본다. | 기관 노출 predicate를 반드시 적용한다. direct link 우회가 생기지 않게 server helper 또는 RPC 단에서 막는다. |
| 문제 목록 | `src/components/practice/problem-list-data.ts`, `src/components/practice/ProblemListView.tsx`, `supabase/migrations/20260625185000_stabilize_user_problem_sort.sql#list_user_problems` | `list_user_problems`의 `visible` CTE가 published/filter 조건만 사용한다. | `visible` CTE에 기관 노출 predicate를 추가한다. total_count도 필터 후 기준이어야 한다. |
| 다음 문제 | `src/lib/practice/next.ts#getNextProblem`, `pickProblemExcluding`, `fetchAlternatives`, `fetchPublishedProblemAlternatives` | 추천 row와 fallback `problems` 조회가 published/active 중심이다. | 추천 row와 fallback 후보 모두 같은 predicate로 거른다. |
| 추천 페이지 | `src/components/practice/recommendations-data.ts#queryRecommendationBundle` | browser client가 `recommendation_items`와 `problems`를 직접 조회한다. | client-only 필터 금지. RPC 또는 server route로 옮기고 DB predicate를 적용한다. |
| 약점 추천 | `src/lib/practice/weakness.ts#getWeaknessRecommendations` | active recommendation item을 먼저 보고, 없으면 `problems.tags overlaps` fallback을 조회한다. | recommendation item과 tag fallback 모두 같은 predicate로 거른다. |
| 제출 RPC guard | `supabase/migrations/20260617055040_guard_writing_submission_problem_visibility.sql#private.assert_writing_problem_submittable` | hidden/unpublished/inactive/non-writing은 막지만 기관 노출 조건은 모른다. | 제출 RPC에서도 기관 노출 predicate를 호출해야 한다. UI에서 숨겨도 known `problem_id` submit 우회가 가능하다. |

## 4. 권장 구현 방향

### 4.1 공통 predicate를 DB에 먼저 만든다

기관 노출 테이블은 admin RLS 정책상 일반 학습자가 직접 읽을 수 없다. v13에서 각 화면마다 client-side로 읽어 필터링하면 보안과 일관성이 모두 깨진다.

권장안:

- `security definer` helper 또는 RPC를 만들고, 그 안에서 `auth.uid()`의 `profiles.affiliation_code`와 `topik_writing_question_institution_exposure`를 비교한다.
- 기존 `list_user_problems`는 가능하면 SECURITY INVOKER 상태를 유지하고, `visible` CTE에서 helper boolean만 호출한다.
- browser client에서 `recommendation_items`와 `problems`를 직접 조합하는 경로는 RPC/server 경로로 옮긴다.

예시 predicate 형태:

```sql
create or replace function public.is_writing_problem_visible_to_caller(
  p_problem_id uuid,
  p_question_no smallint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  caller_code text;
  v_question_id text;
begin
  if caller_id is null then
    return false;
  end if;

  select nullif(btrim(affiliation_code), '')
    into caller_code
    from public.profiles
   where id = caller_id;

  select nullif(materials->>'question_id', '')
    into v_question_id
    from public.problems
   where id = p_problem_id
     and domain = 'writing'
     and question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  return not exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
  )
  or exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;
```

구현 시 확인할 점:

- `problems.materials->>'question_id'`가 모든 synced writing problem에 존재하는지 먼저 검증한다.
- 누락 가능성이 있으면 `md5(e.question_id)::uuid = p_problem_id` fallback을 helper에 넣는다.
- helper는 admin-only 테이블을 읽으므로 `security definer`, 고정 `search_path`, 최소 권한 grant, 테스트가 필요하다.
- `affiliation_code`가 null인 일반 사용자는 매핑이 없는 전체 공개 문항만 볼 수 있어야 한다.

### 4.2 `list_user_problems`에 먼저 적용한다

v13 최신 RPC는 `supabase/migrations/20260625185000_stabilize_user_problem_sort.sql`의 `public.list_user_problems`다. `visible` CTE의 writing published 조건에 다음 개념을 추가한다.

```sql
and (
  p.domain <> 'writing'
  or public.is_writing_problem_visible_to_caller(p.id, p.question_no)
)
```

효과:

- `/practice/problems` 목록과 페이지 total_count가 같이 맞는다.
- `recommended` filter도 hidden problem을 세지 않는다.
- direct list API 호출에서도 같은 결과가 나온다.

### 4.3 직접 쓰기 진입을 막는다

`src/lib/writing/server.ts#getWritingProblem`은 `problemId`를 명시해서 들어오는 경로를 허용한다. 목록에서 숨겼더라도 사용자가 URL을 알고 있으면 접근할 수 있으므로, 이 함수 또는 이 함수가 호출하는 DB RPC에서 같은 predicate를 적용해야 한다.

권장:

- `WritingQuestionRoute.tsx`에서 `requireUser()`로 받은 `user.id`를 `getWritingProblem`에 전달하거나, DB helper가 `auth.uid()`를 기준으로 판정하게 한다.
- `problemId`가 명시된 경우도 후보 쿼리 후 `is_writing_problem_visible_to_caller`가 false면 not found 또는 빈 상태로 처리한다.

### 4.4 추천과 fallback 경로를 모두 막는다

다음 경로는 precomputed recommendation과 fallback 후보가 섞여 있다. 둘 중 하나만 고치면 hidden problem이 다시 나온다.

- `src/lib/practice/next.ts#getNextProblem`
- `src/lib/practice/next.ts#pickProblemExcluding`
- `src/lib/practice/next.ts#fetchAlternatives`
- `src/lib/practice/next.ts#fetchPublishedProblemAlternatives`
- `src/lib/practice/weakness.ts#getWeaknessRecommendations`
- `src/components/practice/recommendations-data.ts#queryRecommendationBundle`

권장:

- recommendation item을 조회할 때 joined `problems`가 visible predicate를 통과한 것만 남긴다.
- tag fallback, same-question fallback, published fallback도 모두 predicate를 통과한 후보만 사용한다.
- browser client에서 직접 조회하는 추천 페이지는 RPC 또는 server-side fetch로 옮겨 admin-only exposure 테이블을 client에 노출하지 않는다.

### 4.5 제출 RPC guard도 갱신한다

`private.assert_writing_problem_submittable`은 `submit_writing_with_feedback` 앞단의 마지막 방어선이다. 여기에도 기관 노출 predicate를 넣어야 한다.

예시:

```sql
and public.is_writing_problem_visible_to_caller(p.id, p.question_no)
```

이 조치가 없으면 UI에서 숨긴 문항도 known `problem_id`로 제출될 수 있다.

## 5. 동기화와 데이터 운영

기관 노출 매핑 변경은 v13 `problems` 미러의 row 자체를 바꾸는 작업이 아니다. `service_status=available`이면 `problems`에는 계속 존재하고, 사용자별 visible predicate가 노출 여부를 결정한다.

운영 기준:

- `sync_available_writing_problems()`는 계속 service_status 기준 미러링만 담당한다.
- 기관 매핑 추가/해제 시 v13이 `problems`를 archive/unarchive하면 안 된다.
- 이미 생성된 `recommendation_items`는 유지할 수 있지만, read time에 visible predicate로 숨겨야 한다.
- 오래 숨겨진 추천 row 정리는 별도 cleanup으로 다룰 수 있으나, 최초 적용의 필수 조건은 아니다.

## 6. 테스트 기준

DB/RPC 테스트:

- affiliation_code가 null인 사용자는 매핑 없는 writing problem만 볼 수 있다.
- affiliation_code가 `PROFESSOR-KWON`인 사용자는 매핑 없는 공개 문항과 `PROFESSOR-KWON` 매핑 문항을 볼 수 있다.
- affiliation_code가 `PROFESSOR-LU`인 사용자는 `PROFESSOR-KWON` 전용 문항을 볼 수 없다.
- 한 문항이 여러 기관에 매핑된 경우 해당 기관 코드 사용자만 볼 수 있다.
- `list_user_problems`의 `total_count`는 기관 필터 적용 후 수량이다.
- `recommended=true` 필터가 hidden recommendation item을 세거나 반환하지 않는다.
- `private.assert_writing_problem_submittable`은 hidden-by-institution problem 제출을 거부한다.

E2E 테스트:

- 기관 코드가 없는 일반 사용자로 `/practice/problems`에 접속해 기존 공개 문항 목록이 유지되는지 확인한다.
- `profiles.affiliation_code='PROFESSOR-KWON'` 사용자로 접속해 Kwon 전용 문항이 보이고 다른 기관 전용 문항은 숨겨지는지 확인한다.
- hidden problem의 `/writing/...?...problem=<uuid>` 직접 접근이 not found 또는 접근 불가 상태로 처리되는지 확인한다.
- `/practice/next`, `/practice/recommendations`, `/practice/weakness`, `/growth`에서 hidden problem 카드가 나오지 않는지 확인한다.
- hidden problem id로 submit RPC 호출 시 실패하는지 확인한다.

## 7. 완료 조건

- 사용자 화면의 모든 writing problem 노출 경로가 같은 predicate를 사용한다.
- client-only 필터가 없다.
- direct link와 submit RPC 우회가 막힌다.
- 기존 일반 사용자 공개 문항 경험이 회귀하지 않는다.
- 기관 노출 변경이 v13 `problems` row archive/unarchive로 잘못 번역되지 않는다.
- v13 docs 또는 migration comment에 `매핑 없음=전체 공개, 매핑 있음=해당 기관 한정` 정책이 남는다.

## 8. v13 작업 전 확인 질문

구현 전에 아래만 확정하면 된다.

- `problems.materials->>'question_id'`가 모든 §7 synced writing problem에 존재하는가?
- 기존 seed fixture 또는 legacy writing problem 중 `materials.question_id`가 없는 row를 계속 사용자에게 노출해야 하는가?
- 기관 코드가 종료/비활성 상태일 때 v13은 admin catalog까지 조회해 차단할 것인가, 아니면 `profiles.affiliation_code`와 mapping만 비교할 것인가?
- hidden-by-institution 상태가 된 기존 draft/submission은 읽기 이력으로 유지하고, 새 풀이/새 제출만 막는 정책이 맞는가?

권장 답:

- §7 synced 문제는 `materials.question_id`를 필수로 보고, legacy fixture는 공개 대상에서 제외한다.
- v13은 기관 코드 catalog 검증을 하지 않고 mapping 비교만 한다. code catalog의 생성/종료/감사는 topik-ai admin 소관으로 둔다.
- 기존 제출/서재/피드백 이력은 삭제하지 않는다. 새 진입과 새 제출만 기관 predicate로 막는다.
