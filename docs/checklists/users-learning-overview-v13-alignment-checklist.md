# Users 학습 현황 v13 정합성 확인 체크리스트

## 1) 목적
- 이 문서는 Admin `회원 목록 > 회원 상세 > 학습 현황` 탭의 요약 컨텐츠가 v13 사용자 화면에서 실제로 수집되는 데이터와 일치하는지 확인하는 절차다.
- 목표는 "Admin 화면이 DB를 읽는다"가 아니라 "v13 사용자 행동이 Admin 요약 필드의 원천 DB 컬럼을 채운다"까지 검증하는 것이다.
- 데이터 정합성 조사, v13 수집 경로 구현, Admin RPC 변경, 운영 QA 전에 이 체크리스트를 사용한다.

## 2) 범위와 SoT

### 대상 화면
- Admin: `Users > 회원 상세 > 학습 현황`
- v13: 온보딩 학습 목표, 쓰기 문제 작성/제출/피드백, 문제 풀이/추천/성장 화면

### 기준 문서와 구현
- Admin 데이터 계약: `docs/specs/admin-data-contract.md`의 `Users 회원 상세 학습 현황 데이터 계약`
- Admin IA: `docs/specs/page-ia/users-detail-page-ia.md`의 `학습 현황(문제 풀이) 탭`
- Admin/B2C 동기화: `docs/page-sync/users-detail-page-sync.md`의 `학습 현황 탭 동기화`
- Admin RPC: `supabase/migrations-admin/20260618120000_admin_user_learning_overview.sql`, `supabase/migrations-admin/20260622170000_user_detail_live_data.sql`
- Admin 화면 호출: `src/features/users/api/users-service.ts`, `src/features/users/api/supabase-users-service.ts`, `src/features/users/pages/user-detail-page.tsx`
- v13 원천 스키마: `learning_goals`, `problem_attempts`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `study_events`

## 3) 사전 확인

| ID | 체크 | 완료 기준 |
| --- | --- | --- |
| PRE-01 | Admin worktree와 v13 worktree 경로 확인 | Admin `topik-ai`, v13 `topik-project/v13`의 실제 경로를 기록한다. |
| PRE-02 | `.env.local` 사용 여부 확인 | Admin worktree에 `.env.local`이 있고 `VITE_SUPABASE_URL`, publishable/anon key, `SUPABASE_ACCESS_TOKEN` 존재 여부만 확인한다. 값은 출력하지 않는다. |
| PRE-03 | Admin Supabase 모드 확인 | `VITE_SUPABASE_DISABLED !== true`이고 URL/key가 있어 `isSupabaseConfigured=true`가 되는지 확인한다. |
| PRE-04 | Admin migration 적용 상태 확인 | `20260618120000_admin_user_learning_overview.sql`, `20260622170000_user_detail_live_data.sql`이 대상 DB에서 `applied`인지 확인한다. `pending`이면 화면 실데이터 검증 전에 차단으로 판정한다. |
| PRE-05 | v13 dirty worktree 확인 | v13에 기존 미커밋 변경이 있으면 범위와 소유자를 기록하고, 조사 중 수정하지 않는다. |
| PRE-06 | 테스트 대상 사용자 확정 | 검증용 learner `user_id`를 하나 정한다. 공유 보고에는 UUID/이메일을 필요 최소한으로 redaction한다. |

권장 명령:

```powershell
# Admin worktree에서 값 출력 없이 .env.local을 현재 프로세스에만 로드한 뒤 migration 상태 확인
$envPath = Join-Path (Get-Location) '.env.local'
Get-Content -LiteralPath $envPath | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -le 0) { return }
  $name = $line.Substring(0, $idx).Trim()
  if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { return }
  $value = $line.Substring($idx + 1).Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$name" -Value $value
}
npm run db:admin:migrate:status
```

## 4) Admin 요약 필드별 v13 수집 정합성

| Admin 표시 항목 | Admin RPC 키 | Admin RPC 원천 | v13 수집 경로 확인 기준 | 판정 |
| --- | --- | --- | --- | --- |
| 총 풀이 수 | `kpis.totalAttempts` | `problem_attempts.count(*)` | v13 사용자가 객관식/읽기/듣기 문제를 제출할 때 `problem_attempts` row가 생성되는지 확인한다. | 미확인 시 GAP |
| 정답률 | `kpis.correctRate` | `problem_attempts.is_correct` | 제출 후 `is_correct`가 true/false로 저장되는지 확인한다. | 미확인 시 GAP |
| 평균 점수 | `kpis.averageScore` | `problem_attempts.score` | 제출 후 `score`가 저장되는지 확인한다. v13 성장 화면의 `writing_feedback.score_total` 평균과 혼동하지 않는다. | 미확인 시 GAP |
| 누적 학습시간 | `kpis.totalStudyMinutes` | `sum(problem_attempts.time_spent_seconds)` | 풀이 시작/제출 사이 시간이 `time_spent_seconds`로 저장되는지 확인한다. `study_events` 발생만으로는 충족하지 않는다. | 미확인 시 GAP |
| 북마크 | `kpis.bookmarkedCount` | `problem_attempts.bookmarked` | 사용자가 문제 북마크를 바꿀 때 같은 attempt row 또는 별도 정책으로 `bookmarked`가 갱신되는지 확인한다. | 미확인 시 GAP |
| 작문 제출/채점 | `kpis.writingSubmissionCount`, `kpis.writingFeedbackCount` | `writing_submissions`, `writing_feedback` | 작문 제출 시 `writing_submissions`, 채점 완료 시 `writing_feedback` row가 생성되는지 확인한다. | 필수 PASS |
| 연속 학습일 | `kpis.streakDays` | `problem_attempts.started_at/submitted_at` KST 일자 | 연속 학습일이 객관식 attempt 기준인지 확인한다. 작문 제출만으로 증가해야 한다면 RPC 변경이 필요하다. | 정책 결정 필요 |
| 주간 학습 실적 | `kpis.weeklyStudiedMinutes` | 이번 주 `problem_attempts.time_spent_seconds` 합 | v13이 objective attempt 시간을 저장하지 않으면 0으로 남는다. | 미확인 시 GAP |
| 주간 목표 | `kpis.weeklyGoalMinutes` | `learning_goals.weekly_goal_minutes` | 온보딩/프로필에서 주간 목표 저장 후 row에 반영되는지 확인한다. | 필수 PASS |
| 최근 활동일 | `kpis.latestActivityAt` | `greatest(latest problem_attempt, latest writing)` | objective attempt 또는 writing submission/feedback 중 최신 일자가 Admin 값과 일치하는지 확인한다. | 부분 PASS 가능 |

## 5) v13 사용자 경로별 확인

### 5-1) 학습 목표
| ID | 체크 | 완료 기준 |
| --- | --- | --- |
| GOAL-01 | 온보딩 학습 목표 저장 | `learning_goals`에 `topik_level`, `target_grade`, `exam_date`, `weekly_goal_minutes`, `weak_areas`, `is_active=true`가 저장된다. |
| GOAL-02 | 프로필 목표 수정 | 목표 수정 후 기존 `weekly_goal_minutes`, `weak_areas` 보존 또는 변경 정책이 의도대로 동작한다. |
| GOAL-03 | Admin 반영 | Admin 온보딩 현황과 요약의 주간 목표가 같은 `learning_goals` row를 읽는다. |

### 5-2) 작문 제출/채점
| ID | 체크 | 완료 기준 |
| --- | --- | --- |
| WRITE-01 | draft 저장 | 작성 시작/자동저장 시 `writing_drafts`와 `study_events`가 정책대로 기록된다. Admin 요약 원천은 아니므로 참고로만 본다. |
| WRITE-02 | 제출 생성 | 제출 성공 후 `writing_submissions`에 `user_id`, `problem_id`, `question_no`, `char_count`, `submitted_at`, `feedback_status`가 저장된다. |
| WRITE-03 | 피드백 동기화 | 채점 완료 후 `writing_feedback.score_total`, `score_max`, `generated_at`이 저장된다. |
| WRITE-04 | 차원 점수 동기화 | `feedback_dimension_scores.dimension`, `score`, `score_max`, `weakness_level`이 저장된다. |
| WRITE-05 | Admin 반영 | Admin `작문 제출/채점`, `최근 작문 채점`, 작문 기반 약점 항목이 SQL 원천과 일치한다. |

### 5-3) 객관식/문제 풀이 attempt
| ID | 체크 | 완료 기준 |
| --- | --- | --- |
| ATTEMPT-01 | 제출 UI 존재 확인 | v13에서 objective 문제를 실제로 제출하는 사용자 경로를 찾는다. 경로가 없으면 즉시 GAP으로 기록한다. |
| ATTEMPT-02 | row 생성 | 제출 후 `problem_attempts` row가 생성된다. |
| ATTEMPT-03 | 정답/점수 저장 | `is_correct`, `score`, `status='submitted'`, `submitted_at`이 저장된다. |
| ATTEMPT-04 | 시간 저장 | `time_spent_seconds`가 0보다 큰 값으로 저장된다. |
| ATTEMPT-05 | 북마크 저장 | 북마크 조작 후 `bookmarked`가 기대값으로 저장된다. |
| ATTEMPT-06 | Admin 반영 | Admin `총 풀이 수`, `정답률`, `평균 점수`, `누적 학습시간`, `북마크`, `영역별 정답률`, `최근 풀이 이력`이 SQL 원천과 일치한다. |

### 5-4) `study_events` 관계
| ID | 체크 | 완료 기준 |
| --- | --- | --- |
| EVENT-01 | 이벤트 기록 확인 | `practice_started`, `draft_autosaved`, `submission_submitted`, `attempt_submitted`가 의도한 화면에서 기록되는지 확인한다. |
| EVENT-02 | Admin RPC 사용 여부 확인 | 현재 Admin 학습 현황 RPC는 `study_events`를 요약 KPI 원천으로 사용하지 않는다. 사용할 계획이면 RPC, 데이터 계약, page-sync, usage-map을 함께 갱신한다. |
| EVENT-03 | 중복 산식 방지 | v13 성장 화면의 volume 산식과 Admin 학습 현황 산식을 혼동하지 않는다. Admin 요약에 반영할 산식은 문서에 명시한다. |

## 6) SQL 대사 템플릿

대상 DB는 dev 환경에서만 확인한다. 결과를 공유할 때 이메일, 답안 원문, sentence feedback 본문은 제외한다.

```sql
-- 1. 학습 목표
select
  user_id,
  topik_level,
  target_grade,
  exam_date,
  weekly_goal_minutes,
  weak_areas,
  is_active,
  updated_at
from public.learning_goals
where user_id = '<target_user_id>';

-- 2. objective attempts
select
  id,
  problem_id,
  is_correct,
  score,
  status,
  started_at,
  submitted_at,
  bookmarked,
  time_spent_seconds
from public.problem_attempts
where user_id = '<target_user_id>'
order by coalesce(submitted_at, started_at) desc
limit 20;

-- 3. writing submission/feedback
select
  ws.id,
  ws.problem_id,
  ws.question_no,
  ws.char_count,
  ws.submitted_at,
  ws.feedback_status,
  wf.status as feedback_row_status,
  wf.score_total,
  wf.score_max,
  wf.generated_at
from public.writing_submissions ws
left join public.writing_feedback wf on wf.submission_id = ws.id
where ws.user_id = '<target_user_id>'
order by ws.submitted_at desc
limit 20;

-- 4. feedback dimensions
select
  submission_id,
  dimension,
  score,
  score_max,
  weakness_level
from public.feedback_dimension_scores
where user_id = '<target_user_id>'
order by submission_id, dimension;

-- 5. study events, 참고용
select
  event_type,
  count(*) as count,
  max(occurred_at) as latest_at
from public.study_events
where user_id = '<target_user_id>'
group by event_type
order by event_type;

-- 6. Admin RPC 결과, platform_admin 세션/권한으로 실행
select *
from public.get_admin_user_learning_overview('<target_user_id>');
```

## 7) 수동 QA 시나리오

| 단계 | 작업 | 기대 결과 |
| --- | --- | --- |
| 1 | v13 learner로 로그인 | 대상 `user_id`가 확정된다. |
| 2 | 온보딩 학습 목표 저장 | `learning_goals`와 Admin 온보딩/주간 목표가 일치한다. |
| 3 | 작문 문제 작성 후 제출 | `writing_submissions` count가 1 증가한다. |
| 4 | 채점 완료까지 대기 또는 상태 sync 호출 | `writing_feedback`, `feedback_dimension_scores`가 생성되고 Admin 작문 제출/채점이 증가한다. |
| 5 | objective 문제 제출 경로 실행 | `problem_attempts` row가 생성되어야 한다. 생성되지 않으면 객관식 요약 항목은 GAP이다. |
| 6 | Admin platform_admin으로 로그인 | `Users > 회원 상세 > 학습 현황` 탭 접근 가능하다. |
| 7 | Admin 요약과 SQL 대사 | 섹션 4의 모든 항목을 SQL 원천과 비교한다. |
| 8 | 네트워크/empty/error 상태 확인 | RPC pending/error/empty가 탭 내부에서 격리되고 회원 상세 전체가 중단되지 않는다. |

## 8) 판정 기준

| 판정 | 기준 |
| --- | --- |
| PASS | Admin migration이 적용되어 있고, Admin RPC 결과가 SQL 원천과 일치하며, v13 사용자 행동이 해당 원천 row/컬럼을 실제로 채운다. |
| PARTIAL | 작문/학습 목표처럼 일부 항목은 수집되지만, objective attempt 기반 요약 항목이 비어 있거나 다른 산식을 사용한다. |
| GAP | Admin 표시 항목의 원천 컬럼을 v13 사용자 경로에서 쓰지 않는다. 화면 표시는 mock, 0, `-` 또는 stale 데이터가 될 수 있다. |
| BLOCKED | 대상 DB에 Admin RPC migration이 pending이거나, platform_admin 권한/테스트 계정/외부 채점 API가 없어 실측할 수 없다. |

## 9) GAP 발견 시 선택지

| 선택지 | 적용 조건 | 필수 후속 문서 |
| --- | --- | --- |
| A. v13이 `problem_attempts`를 쓰도록 구현 | Admin 요약의 객관식 풀이 지표를 현행 계약대로 유지한다. | v13 구현 문서, Admin page-sync 확인 결과 |
| B. Admin RPC가 `study_events` 또는 writing 기반 산식을 함께 쓰도록 변경 | v13 성장 화면 산식과 Admin 요약을 맞추는 것이 제품 의도다. | `admin-data-contract`, `users-detail-page-ia`, `users-detail-page-sync`, `admin-data-usage-map`, migration |
| C. 미수집 항목을 Admin UI에서 숨기거나 `미수집`으로 표시 | 수집 구현 전 운영자 오해를 막는 임시 조치가 필요하다. | `users-detail-page-ia`, `admin-page-gap-register`, e2e 검증 |

## 10) 증빙 기록 템플릿

| 항목 | 결과(PASS/PARTIAL/GAP/BLOCKED) | 증빙 |
| --- | --- | --- |
| Admin migration 적용 |  |  |
| Supabase 모드 |  |  |
| 학습 목표 수집 |  |  |
| 작문 제출 수집 |  |  |
| 작문 피드백 수집 |  |  |
| objective attempt 생성 |  |  |
| 정답/점수/시간/북마크 저장 |  |  |
| Admin RPC 대사 |  |  |
| Admin 화면 대사 |  |  |
| 최종 판정 |  |  |
