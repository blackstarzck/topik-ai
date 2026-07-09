# v13 대시보드 KPI writing 원천 정렬 handoff (2026-07-09)

## 1. 목적 (한 줄)

v13 학생 앱의 대시보드/성장 화면 KPI 일부가 **비어 있는 `problem_attempts` 테이블**을 읽어
항상 0으로 표시된다. TOPIK 쓰기 실데이터(`writing_submissions` + `study_events`)를 원천으로
재정의해, 학생이 실제로 쓰기 문제를 풀면 그 활동이 대시보드에 반영되게 한다.

이 문서는 **v13 저장소 단독 작업**을 위한 인수인계다. topik-ai(관리자) 쪽은 이미 같은 문제를
쓰기 원천으로 재정의 완료했고(2026-07-08), 이 문서의 §5에 **그대로 참고할 수 있는 계산식**을
제시한다. v13과 관리자가 같은 계산식을 쓰면 두 화면의 숫자가 일치한다(그것이 목표).

## 2. 배경 — "빈 창고" 문제

`problem_attempts`는 원래 객관식/읽기/듣기 풀이 기록용 테이블이지만, **v13 사용자 앱 어디에도
insert 경로가 없다.** 유일한 참조는 다음 문제 추천 시 "이미 푼 문제 제외"용 SELECT 두 곳뿐이다:

- `src/lib/practice/next.ts:128` (getNextProblem 내 attempt dedup)
- `src/lib/practice/next.ts:559` (fetchPublishedProblemAlternatives 내 dedup)

둘 다 읽기만 하고 쓰지 않는다. 결과적으로 공유 dev DB에서 `problem_attempts`는 **0 행**이다
(2026-07-08 확인). TOPIK 쓰기(51~54)는 `writing_submissions`에 저장되므로, 쓰기만 있는 현재
`problem_attempts`가 채워질 일은 없다.

## 3. 현재 영향 범위 (사용자에게 보이는 증상)

### 3.1 `get_dashboard_kpi()` RPC — 4개 KPI 중 3개가 빈 창고를 읽음

SoT: `supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql` §5 (라인 400~486)

| 반환 컬럼 | 계산 원천 | 현재 결과 |
| --- | --- | --- |
| `today_attempts` | `problem_attempts` 오늘 개수 (라인 426~430) | 항상 **0** |
| `total_attempts` | `problem_attempts` 전체 개수 (라인 433~435) | 항상 **0** |
| `exam_days_left` | `learning_goals.exam_date` (라인 438~448) | ✅ 정상 |
| `streak_days` | `problem_attempts` 날짜 기반 연속 일수 (라인 451~480) | 항상 **0** |

### 3.2 화면별 실제 노출 상태

| 화면 | 소비 위치 | 현재 상태 |
| --- | --- | --- |
| `/dashboard` "오늘 제출 수" | `DashboardKpiSummary` (`todayAttempts`) | 0 → "시작 안내" 문구 표시 |
| `/dashboard` "연속 학습일" | `DashboardKpiSummary` (`streakDays`) | 0 → "시작 안내" 문구 표시 |
| `/growth` "연속 학습일" | `growth/page.tsx:242` (`kpi.streakDays`) | **0 (미우회)** |
| `/growth` "누적 풀이 수" | `growth/page.tsx:246` `mergeAttemptCounts` | ⚠️ **이미 부분 우회됨** — `Math.max(problem_attempts=0, study_events 제출수)`로 study_events 값 사용 (`src/lib/growth/activityMetrics.ts`) |

> 요점: 성장 페이지는 "누적 풀이 수"만 study_events로 우회해 두었고, **streak는 대시보드·성장
> 양쪽 다 여전히 `get_dashboard_kpi()`의 0을 그대로 쓴다.** RPC를 고치면 두 화면이 함께 해결된다.

## 4. 원천 재정의 방향 (권장 = A안)

- **A안 (권장): `get_dashboard_kpi()`를 쓰기 원천으로 재정의.** `today_attempts`/`total_attempts`는
  "제출 수"(`writing_submissions` 또는 `study_events`의 제출 이벤트), `streak_days`는 학습 이벤트
  (`study_events`) 기반으로 계산. v13 코드 변경 최소(RPC 본문 + 필요 시 라벨 문구), 프론트 계약
  (`DashboardKpi` 타입) 무변경으로 처리 가능.
- B안 (비권장, 대규모): 나중에 객관식/읽기/듣기 기능을 붙이며 `problem_attempts`에 실제 insert
  경로를 추가. 지금 시점엔 과投자 — 쓰기만 있는 현재를 해결하지 못한다.

### 4.1 원천 선택 세부 (오너 결정과 정합)

- **"제출 수"**: 쓰기 제출 단위가 자연스럽다 → `writing_submissions` count. (또는 `study_events`
  의 `submission_submitted` 이벤트 count — 성장 페이지의 기존 우회와 동일 기준으로 맞추면
  두 화면이 일치한다. 아래 §7 결정 필요 항목 참조.)
- **streak(연속 학습일)**: 관리자 쪽 오너 결정은 **"활성 = 학습 이벤트 기준(로그인 아님)"**이다.
  → `study_events`에 이벤트가 있는 KST 날짜 기준으로 연속 일수 계산(제출뿐 아니라 연습 시작·
  피드백 열람도 "학습한 날"로 인정). 이렇게 하면 관리자 회원 상세의 streak와 동일해진다.
- **exam_days_left**: 변경 불필요(이미 `learning_goals` 기반).

## 5. 참고 계산식 (topik-ai에서 이미 검증된 SQL)

topik-ai 관리자 RPC `get_admin_user_learning_overview`(마이그
`supabase/migrations-admin/20260708130000_users_learning_overview_writing_first.sql`)가
동일 문제를 쓰기 원천으로 재정의했고 dev DB에서 검증됐다. **그 CTE를 거의 그대로 옮길 수 있다.**

### 5.1 streak — 학습 이벤트 기준 (권장, 관리자와 동일)

```sql
-- study_events가 있는 KST 날짜를 최근일부터 역순으로 세되,
-- 최근 활동일이 오늘 또는 어제일 때만 '현재 streak'로 인정
with event_days as (
  select distinct (se.occurred_at at time zone 'Asia/Seoul')::date as d
  from public.study_events se
  where se.user_id = caller_id
),
ranked_days as (
  select d,
         row_number() over (order by d desc) as rn,
         max(d) over () as max_d
  from event_days
  where d <= today_kst
)
select case
  when (select max(d) from event_days where d <= today_kst) >= today_kst - 1
  then (select count(*)::int from ranked_days where d = max_d - (rn - 1)::int)
  else 0
end;
```

### 5.2 제출 수 — 쓰기 제출 기준

```sql
-- 오늘 제출 (KST 경계는 기존 today_start/today_end 재사용)
select count(*)::int
  from public.writing_submissions
  where user_id = caller_id
    and submitted_at >= today_start and submitted_at < today_end;

-- 누적 제출
select count(*)::int
  from public.writing_submissions
  where user_id = caller_id;
```

> study_events 기준으로 맞추려면 `writing_submissions` 대신
> `study_events where event_type in ('attempt_submitted','submission_submitted')`를 쓴다.
> 성장 페이지의 `mergeAttemptCounts` 우회가 이미 study_events count를 쓰므로, **study_events로
> 통일하면 대시보드·성장의 "누적 풀이 수"가 정확히 일치**한다(권장).

## 6. v13 영향 파일 (예상)

| 파일 | 변경 내용 |
| --- | --- |
| `supabase/migrations/2026XXXXHHMMSS_dashboard_kpi_writing_source.sql` (신규) | `create or replace function public.get_dashboard_kpi()` — §5 계산식으로 본문 교체. 반환 시그니처(`today_attempts, total_attempts, exam_days_left, streak_days`)는 **그대로 유지**(프론트 계약 무변경). down 파일로 직전 정의 복원 가능하게. |
| `src/lib/learning/kpi.ts` | 변경 없음(반환 시그니처 유지 시). 주석의 "attempts" 표현만 "제출/학습 이벤트"로 정정 권장. |
| `src/components/dashboard/DashboardKpiSummary.tsx` | 라벨이 이미 "오늘 제출 수(todaySubmissions)"라 대체로 무변경. `total_attempts` 의미가 "제출 수"로 바뀌므로 관련 i18n 문구 검토. |
| `src/app/(workspace)/growth/page.tsx` | streak가 이제 RPC에서 실값으로 오므로 별도 우회 불필요. `mergeAttemptCounts`는 study_events로 통일 시 그대로 두거나 단순화 가능(회귀 주의). |
| `messages/{ko,en,vi}.json` | KPI 라벨/단위 문구가 "풀이"→"제출"로 바뀌면 함께 갱신. |
| `src/lib/learning/kpi.test.ts` 등 | `computeStreakDays` 단위 테스트는 그대로 두되(순수 함수), RPC 계약 변경에 맞춰 통합/컴포넌트 테스트 기대값 갱신. |

## 7. 착수 전 결정 필요 항목

| 항목 | 선택지 | 권장 |
| --- | --- | --- |
| "제출 수" 원천 | (a) `writing_submissions` / (b) `study_events` 제출 이벤트 | **(b)** — 성장 페이지 기존 우회와 일치, 재제출/이벤트 흐름과도 정합 |
| "제출 수"에 재제출 포함 여부 | 포함 / 제외(원 제출만) | 대시보드는 "활동량" 성격이므로 **포함**(관리자 회원 상세도 총 제출 수는 재제출 포함) |
| 라벨 유지 | 현행 "제출 수" 유지 / "학습 활동" 등으로 변경 | 현행 유지(문구 변경 최소) |

## 8. 검증 기준 (완료 정의)

- [ ] dev DB에서 `get_dashboard_kpi()`를 실제 쓰기 이력이 있는 사용자로 호출 시
      `today_attempts`/`total_attempts`/`streak_days`가 0이 아닌 실값을 반환한다.
- [ ] `/dashboard`와 `/growth`의 "연속 학습일"이 같은 사용자에서 **동일 값**으로 표시된다.
- [ ] 같은 사용자·기간에서 v13 대시보드 값과 topik-ai 관리자 회원 상세 학습현황
      (`get_admin_user_learning_overview`)의 streak/제출 수가 **일치**한다(정렬 목표).
- [ ] 활동이 없는 신규 사용자는 여전히 0 → "시작 안내" 문구가 정상 표시된다(회귀 없음).
- [ ] `problem_attempts` 참조 dedup 로직(`next.ts:128`, `:559`)은 건드리지 않는다(추천 회귀 방지).
- [ ] typecheck / lint / 단위·컴포넌트 테스트 통과.

## 9. 주의사항·경계

- **반환 시그니처를 바꾸지 말 것.** `today_attempts/total_attempts/exam_days_left/streak_days`
  4컬럼을 유지하면 프론트(`kpi.ts`) 계약을 안 건드리고 RPC 본문만 교체할 수 있다.
- **`problem_attempts` dedup 참조는 그대로.** 추천 로직이 이 테이블을 "이미 푼 문제 제외"에
  쓰므로 삭제/변경하면 추천 회귀가 난다. 이번 작업은 KPI 집계 원천만 바꾼다.
- **소요 시간(`writing_submission_metrics`)은 이 작업과 별개.** 그 테이블은 topik-ai 작업에서
  v13 소유로 신설·계측 완료됐고(마이그 `20260708113000`), 대시보드 KPI에는 사용하지 않는다.
- **KST 경계**는 기존 `today_start/today_end` 계산을 재사용한다(요일/시간대 회귀 주의).
- 이 정렬 후에도 성장 페이지의 점수/추세(`writing_feedback` 기반)는 이미 실데이터라 무변경이다.

## 10. 관련 문서 (topik-ai 측 SoT)

- `docs/checklists/users-learning-data-collection-report-and-plan.md` — 학습 데이터 수집 전체 계획
  (이 handoff는 그 계획 Phase 1의 "v13 대시보드 계산식 정렬" 잔여 항목에 해당)
- `docs/specs/admin-data-contract.md` 2026-07-08 절 — 관리자 쪽 재정의 계약(원천·계산식 SoT)
- `docs/specs/admin-page-gap-register.md` 2026-07-08 절 — 이 gap이 미확정으로 등록된 위치
- 관리자 참고 마이그레이션(계산식 원본): `supabase/migrations-admin/20260708130000_users_learning_overview_writing_first.sql`
