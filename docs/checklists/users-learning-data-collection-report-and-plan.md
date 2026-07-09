# Users 학습 데이터 수집 조사 보고서 및 실행 계획안

작성일: 2026-07-08  
대상: v13 사용자 화면, topik-ai Admin `Users > 회원 상세 > 학습 현황`, 향후 전체 사용자 학습 분석 화면  
작업 성격: 조사/계획 문서. 이 문서는 구현 변경 없이 수집 항목, 수집 가능성, 양 프로젝트 작업 경계를 정리한다.

## 1) 요약

- v13은 TOPIK 쓰기 51~54번에 대해 `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `study_events`, `learning_goals`, `recommendation_items`, `library_items` 기반 데이터를 이미 일부 수집한다.
- Admin `Users > 회원 상세 > 학습 현황`은 현재 `problem_attempts` 중심 KPI와 writing 제출/피드백 count를 함께 읽는 구조다. 그러나 v13 코드 기준 `problem_attempts`는 스키마와 조회/RPC 집계에는 있으나 실제 사용자 화면의 insert/update 경로를 확인하지 못했다.
- 따라서 TOPIK 쓰기 학습 현황은 `problem_attempts`가 아니라 writing 원천(`writing_submissions` + `writing_feedback` + `feedback_dimension_scores`)을 기준으로 재정의해야 한다.
- 사용자가 요청한 "한 문제를 푸는데 소요되는 시간"은 v13 쓰기 화면에 화면 표시용 `elapsedSeconds`가 있지만 제출 payload나 DB에는 저장되지 않는다. 정확한 운영 지표로 쓰려면 신규 수집 계약이 필요하다.
- Admin은 v13 API를 직접 호출해 화면을 구성하지 않는다. v13이 공유 Supabase 원천 데이터를 기록하고, topik-ai Admin은 관리자용 RPC/view/read contract를 통해 읽는 구조를 기본값으로 둔다.

## 2) 조사 근거

### v13 코드베이스 근거

| 근거 | 확인 내용 | 판정 |
| --- | --- | --- |
| `supabase/migrations/20260520120200_problems.sql` | `problems`에 `domain`, `question_no(51~54)`, `difficulty`, `tags`, `rubric`가 있다. | 문항/태그/난이도별 집계 가능 |
| `supabase/migrations/20260520120400_writing.sql` | `writing_submissions`에 `user_id`, `problem_id`, `question_no`, `answer_text`, `char_count`, `submitted_at`, `feedback_status`, `parent_submission_id`가 있다. | 쓰기 제출/재제출/최근 활동 집계 가능 |
| `supabase/migrations/20260520120500_feedback.sql` | `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `comparison_reports`가 있다. | 점수/약점/비교 리포트 가능, 원문 첨삭은 민감 |
| `src/lib/events/study-events.ts` | 이벤트 카탈로그에 `practice_started`, `draft_autosaved`, `submission_submitted`, `feedback_viewed`, `recommendation_clicked` 등이 있고 payload PII guard가 있다. | 행동 이벤트 일부 수집 가능 |
| `src/components/writing/*Writing*Workspace.tsx` | 쓰기 제출 성공 시 `submission_submitted` 이벤트를 남기고 `question_no`, `char_count`를 payload에 둔다. | 제출 이벤트 가능 |
| `src/components/feedback/FeedbackPageContent.tsx` | 피드백 화면 진입 시 `feedback_viewed` 이벤트를 남긴다. | 피드백 열람률 가능 |
| `src/components/practice/NextProblemView.tsx`, `src/lib/practice/consume.ts` | 추천 클릭 이벤트와 추천 항목 `consumed` 처리가 있다. | 추천 반응 일부 가능 |
| `src/components/writing/*Writing*Workspace.tsx` | 화면 표시용 `elapsedSeconds`는 있으나 제출 input에는 포함되지 않는다. | 쓰기 소요 시간은 신규 수집 필요 |
| `src/lib/practice/next.ts`, migrations/RPC | `problem_attempts`는 조회와 집계에 쓰이지만 v13 사용자 화면의 쓰기 경로는 발견되지 않았다. | TOPIK 쓰기 원천으로 쓰면 안 됨 |

### topik-ai Admin 근거

| 근거 | 확인 내용 | 판정 |
| --- | --- | --- |
| `supabase/migrations-admin/20260622170000_user_detail_live_data.sql` | Admin 학습 RPC가 `problem_attempts`에서 총 풀이 수, 정답률, 평균 점수, 누적 학습시간, 북마크 수를 계산한다. | 쓰기 중심 학습 현황과 불일치 위험 |
| `supabase/migrations-admin/20260622170000_user_detail_live_data.sql` | writing 제출/피드백 count는 `writing_submissions`, `writing_feedback`에서 계산한다. | writing count는 실제 원천과 맞음 |
| `src/features/users/pages/user-detail-page.tsx` | 회원 상세 학습 현황 탭은 총 풀이 수, 정답률, 평균 점수, 누적 학습시간, 북마크, 작문 제출/채점, 연속 학습일, 주간 학습, 최근 활동일을 표시한다. | 표시 항목별 원천 재정의 필요 |
| `supabase/migrations-admin/20260707130000_admin_dashboard_analytics_stats.sql` | 전체 통계 RPC는 가입/로그인/신고/알림/결제 중심이고 학습 성과 집계는 포함하지 않는다. | 전체 사용자 학습 분석용 RPC/view 필요 |

### 외부 교육/TOPIK 조사 근거

| 출처 | 시사점 |
| --- | --- |
| TOPIK 공식 쓰기 답안 작성 방법 | 51/52는 담화 구성, 53/54는 내용 및 과제 수행/글의 전개 구조/언어 사용 기준으로 봐야 한다. 총점만으로는 부족하다. |
| TOPIK 원고지 사용법 | 글자 수, 문단, 문장부호, 격식성 같은 형식 지표도 writing 품질 태그 후보가 된다. |
| 1EdTech Caliper | Assessment, Grading, Session, Tool Use, Feedback 프로필처럼 제출/채점/세션/도구 사용 이벤트를 분리하는 방식이 표준적이다. |
| Open edX Tracking Logs | 서버/브라우저/모바일 상호작용을 JSON 이벤트 로그로 남긴다. 제출 외에도 시작, 저장, 열람, 클릭 이벤트가 필요하다. |
| Coursera Skills Dashboard | skill별 숙련도, mastery까지 걸린 시간, 시간 대비 개선을 관리 지표로 둔다. TOPIK에서는 태그/루브릭별 숙련도와 개선 시간으로 대응된다. |
| EDUCAUSE Student Success Analytics | 학습분석은 점수 하나가 아니라 성취, 역량, 지속성, 윤리적 의사결정을 함께 봐야 한다. |

참고 URL:
- TOPIK II 쓰기 답안 작성 방법: https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175504804_07236.pdf
- TOPIK 원고지 사용법: https://exam.topik.go.kr/nasdata/webnas/raonkeditordata/uploadId/2024/02/20240227_175447974_51977.pdf
- 1EdTech Caliper: https://www.1edtech.org/standards/caliper
- Open edX Tracking Logs: https://docs.openedx.org/en/latest/developers/references/internal_data_formats/tracking_logs/index.html
- Coursera Skills Dashboard: https://blog.coursera.org/coursera-for-business-releases-skills-development-dashboards-to-measure-learning-outcomes/
- EDUCAUSE Student Success Analytics: https://library.educause.edu/resources/2022/5/a-framework-for-student-success-analytics

## 3) 개인 사용자 단위 수집 항목

| 우선순위 | 항목 | 설명 | v13 현재 판정 | Admin 표시/활용 |
| --- | --- | --- | --- | --- |
| P0 | 51~54번별 평균 점수 | 문항번호별 `score_total / score_max * 100` 평균 | 수집 가능 | 학습 현황 핵심 KPI |
| P0 | 최근 제출/최근 피드백 | 최근 제출 5건, 피드백 상태, 총점 | 수집 가능 | 회원 상세 최근 학습 |
| P0 | 태그별 풀이 목록 + 점수 | `problems.tags` 기준 제출 목록과 평균 점수 | 수집 가능 | 약점 태그/관심 주제 |
| P0 | 차원별 약점 | grammar/vocab/structure/content/expression/topic_fit 평균과 weakness level | 수집 가능 | 취약 영역 Top N |
| P0 | 학습 목표 | 목표 급수, 시험일, 주간 목표, weak areas | 수집 가능 | 목표 대비 현황 |
| P1 | 피드백 열람 여부 | 피드백이 생성된 뒤 사용자가 실제로 열람했는지 | 수집 가능 | 미열람 사용자 안내 |
| P1 | 재제출/개선 | `parent_submission_id`, `comparison_reports` 기반 이전 대비 개선 | 일부 가능 | 피드백 효과 |
| P1 | 제일 많이 푼 항목 | `question_no`, `problem_id`, `tags`별 최다 제출 | 수집 가능 | 반복 학습 패턴 |
| P1 | 문항별 소요 시간 | 51~54번별 active/elapsed time | 신규 수집 필요 | 학습량/난이도 판단 |
| P1 | 추천 반응 | 추천 클릭, 추천 항목 소비, 추천 후 제출 | 일부 가능 | 추천 효과 |
| P1 | 보관/복습 | 저장한 제출/문제/리포트, 태그/노트 | 수집 가능 | 복습 행동 |
| P2 | 작성 이탈 | 시작 후 제출하지 않음, draft 후 이탈 | 소규모 계측 필요 | 이탈 구간 개선 |
| P2 | 첫 입력/수정량 | 첫 글자 입력까지 시간, 수정 횟수 | 신규 수집 필요 | 작성 행동 분석 |
| 제한 | 답안 원문 | `answer_text` | 개인정보 민감 | 기본 관리자 payload 제외 |
| 제한 | 문장별 첨삭 원문/수정문/코멘트 | `sentence_feedback` | 개인정보 민감 | 별도 권한/감사 로그 전까지 제외 |

## 4) 전체 사용자 단위 수집 항목

| 우선순위 | 항목 | 설명 | v13 현재 판정 | Admin 표시/활용 |
| --- | --- | --- | --- | --- |
| P0 | 학습 활성 사용자 수 | 기간 내 제출/피드백/학습 이벤트가 있는 사용자 수 | 집계 필요 | 전체 학습 대시보드 |
| P0 | 제출 수/피드백 완료율 | 제출, 분석중, 완료, 실패 비율 | 수집 가능 | 운영량/품질 |
| P0 | 전체 평균 점수 | 기간/문항별 평균, 중앙값, 분포 | 집계 필요 | 성과 추이 |
| P0 | 51/52/53/54 분포 | 문항번호별 제출량, 평균 점수 | 집계 필요 | 문항별 사용성 |
| P0 | 취약 차원 Top N | 전체 사용자 기준 약점 분포 | 집계 필요 | 콘텐츠 개선 우선순위 |
| P1 | 태그별 성과 | 태그별 제출량, 평균 점수, 취약률 | 집계 필요 | 주제/콘텐츠 개선 |
| P1 | 피드백 처리 시간 | 제출부터 피드백 생성까지 걸린 시간 | 수집 가능 | 외부 평가 API SLA |
| P1 | 피드백 열람률 | 완료된 피드백 중 열람된 비율 | 집계 필요 | 피드백 소비율 |
| P1 | 재제출률/개선폭 | 피드백 후 다시 제출한 비율과 점수 변화 | 일부 가능 | 피드백 효과 |
| P1 | 콘텐츠 이상치 | 낮은 점수, 긴 소요 시간, 높은 이탈률 문제 | 시간/이탈 계측 필요 | 문항 검수 |
| P2 | 추천 효과 | 노출/클릭/소비/제출/점수 개선 funnel | 신규 집계 계약 필요 | 추천 품질 |
| P2 | 코호트 성장 | 가입 월, 목표 급수, 시험일, 기관별 성장 | 개인정보/집계 기준 필요 | 운영 리포트 |
| P2 | AI 모델 drift | AI 모델/버전별 평균 점수, 실패율, 편차 | 일부 가능 | 채점 품질 |

## 5) 두 프로젝트 작업 경계

### v13 사용자 화면/사용자 API 책임

v13은 학습 행동이 실제로 발생하는 곳이므로 원천 데이터를 생성한다.

- 쓰기 제출 시 `writing_submissions`를 안정적으로 생성한다.
- 외부 평가 완료/실패/대기 상태를 `writing_feedback`, `feedback_dimension_scores`에 동기화한다.
- `study_events`로 시작, 자동저장, 제출, 피드백 열람, 추천 클릭, export 같은 행동 이벤트를 기록한다.
- 문항별 소요 시간은 writing 전용 수집 계약을 추가한다. 권장 기본값은 `problem_attempts` 재사용이 아니라 `writing_submission_metrics` 또는 동등한 writing 전용 metrics 계약이다.
- 추천 효과 분석을 위해 추천 클릭, 추천 항목 consumed, 추천 후 제출 연결 기준을 보강한다.
- payload에는 답안 원문, 초안 본문, 문장별 첨삭 원문, AI narrative 같은 민감 데이터를 넣지 않는다.

### 공유 Supabase/DB 책임

공유 DB는 두 프로젝트가 같은 원천과 같은 계산식을 쓰도록 read contract를 제공한다.

- writing 원천 테이블은 v13 사용자 행동의 SoT로 본다.
- topik-ai Admin은 v13 테이블 DDL을 임의로 변경하지 않는다. 기존 v13 테이블 변경이 필요하면 v13 repo 작업 또는 공유 스키마 소유권 결정에 따라 진행한다.
- Admin 표시용 개인 RPC/view와 전체 집계 RPC/view를 별도 계약으로 둔다.
- 0과 미수집/null을 구분한다. 예: 소요 시간이 아직 계측되지 않은 사용자는 `0분`이 아니라 `미수집`으로 판단 가능해야 한다.
- 민감 데이터는 기본 관리자 RPC payload에 포함하지 않는다.

### topik-ai Admin 책임

Admin은 원천 데이터를 만들지 않고 운영자가 읽고 판단할 수 있게 보여준다.

- `Users > 회원 상세 > 학습 현황`은 writing 기준 KPI로 재정렬한다.
- 기존 `problem_attempts` 기반 KPI는 객관식/읽기/듣기용으로 유지하거나, TOPIK 쓰기 화면에서는 별도 라벨로 분리한다.
- 전체 사용자 학습 분석 화면은 기존 통계 개요에 섞기보다 `Analytics` 하위 학습 분석 섹션 또는 별도 탭으로 두는 것을 기본값으로 한다.
- 개인/전체 집계 모두 기간 필터를 가진다. 기본 기간은 최근 30일, 옵션은 최근 7일/30일/90일/전체다.
- 원문 답안/문장별 첨삭 원문 열람이 필요하면 별도 권한, 사유 입력, 감사 로그를 갖춘 기능으로 분리하고 기본 학습 현황에는 포함하지 않는다.

## 6) 실행 계획안

### Phase 0. 데이터 계약 확정

1. TOPIK 쓰기 학습 현황의 기준 원천을 `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `problems`, `study_events`, `learning_goals`로 확정한다.
2. `problem_attempts`는 객관식/읽기/듣기 attempt 원천으로 분리하고, TOPIK 쓰기 KPI의 기본 원천에서 제외한다.
3. 개인 지표 P0와 전체 지표 P0를 먼저 확정한다.
4. 점수 표시 기준은 원점수와 100점 정규화 점수를 함께 정의한다.
5. 개인정보 민감 항목은 기본 read contract에서 제외한다.

완료 기준:
- 개인/전체 P0 지표별 원천 테이블, 기준 시각, null 처리, 기간 필터 기준이 문서화되어 있다.
- v13과 topik-ai가 같은 계산식 이름과 의미를 사용한다.

### Phase 1. v13 수집 보강

1. 쓰기 소요 시간 수집 계약을 추가한다.
   - 권장 필드: `submission_id`, `user_id`, `problem_id`, `question_no`, `elapsed_time_seconds`, `active_time_seconds`, `started_at`, `submitted_at`.
   - 답안 원문이나 초안 본문은 metrics 계약에 넣지 않는다.
2. 제출 이벤트 payload에 운영 집계에 필요한 비민감 값만 남긴다.
   - 유지: `question_no`, `char_count`, `problem_id/submission_id` 전용 컬럼.
   - 제외: `answer_text`, draft body, feedback narrative.
3. 피드백 열람, 추천 클릭, 추천 consumed, 재제출 parent 연결을 같은 사용자의 행동 흐름으로 추적 가능하게 정리한다.
4. v13 사용자 화면의 성장/대시보드 지표가 Admin과 같은 원천을 읽도록 계산식을 정렬한다.

완료 기준:
- 51~54번 각각에 대해 제출, 피드백, 점수, 태그, 소요 시간이 DB에서 재현된다.
- 피드백 열람과 추천 클릭은 `study_events`로 확인된다.
- v13 화면에서 보이는 평균 점수와 Admin RPC 결과가 같은 사용자/기간에서 일치한다.

### Phase 2. Admin 개인 학습 현황 read contract 정렬

1. `get_admin_user_learning_overview` 또는 후속 RPC/view를 writing 중심으로 재정의한다.
2. 회원 상세 학습 현황은 다음 P0 블록을 표시한다.
   - 51~54번별 평균 점수
   - 총 제출 수/피드백 완료 수/피드백 대기 수
   - 최근 제출 5건
   - 태그별 제출/점수
   - 차원별 약점
   - 목표 대비 현황
3. 기존 `총 풀이 수`, `정답률`, `누적 학습시간`은 원천이 writing인지 objective attempt인지 라벨을 분명히 한다.
4. 소요 시간 미계측 상태는 `0분`이 아니라 `미수집` 또는 `수집 전`으로 노출한다.

완료 기준:
- Admin 회원 상세와 v13 사용자 성장/히스토리 화면이 같은 사용자/기간에서 같은 제출 수와 평균 점수를 보여준다.
- 원문 답안과 문장별 첨삭 원문은 기본 응답에 포함되지 않는다.

### Phase 3. Admin 전체 사용자 학습 분석 준비

1. 전체 사용자 집계 RPC/view를 추가한다.
   - 기간별 활성 학습 사용자 수
   - 제출 수, 피드백 완료율, 실패율
   - 51/52/53/54 분포
   - 평균 점수/점수 분포
   - 취약 차원 Top N
   - 태그별 제출량/평균 점수
2. `Analytics` 하위 학습 분석 탭 또는 별도 화면에서 표시한다.
3. 기간 필터는 최근 7일/30일/90일/전체를 기본 옵션으로 둔다.
4. 집계 화면은 개인 식별자를 기본 노출하지 않는다.

완료 기준:
- 같은 기간에 대해 SQL 집계와 화면 값이 일치한다.
- 학습 활성 사용자는 로그인 기준이 아니라 학습 행동 기준으로 계산된다.
- 집계 값이 없는 경우 empty와 미수집을 구분한다.

### Phase 4. 정합성 검증

1. 동일 테스트 사용자 1명을 선정해 v13에서 51/52/53/54 제출을 각각 수행한다.
2. 피드백 완료 후 v13 성장 화면, 보관함, 피드백 화면, Admin 회원 상세 값을 비교한다.
3. 전체 집계는 테스트 사용자 포함 전/후 값을 SQL과 화면에서 대사한다.
4. 개인정보 payload 검사를 수행한다.
5. 실패/대기/미수집 상태를 각각 검증한다.

완료 기준:
- 사용자 개인 P0 지표가 v13과 Admin에서 같은 값으로 재현된다.
- 전체 사용자 P0 지표가 SQL과 Admin 화면에서 같은 값으로 재현된다.
- 민감 본문 데이터가 관리자 기본 payload에 포함되지 않는다.

## 7) 의사결정이 필요한 항목

**결정 확정(2026-07-08, 오너가 Claude에 위임 → 전 항목 기본 추천안 채택):**

| 결정 항목 | 확정안 | 이유 |
| --- | --- | --- |
| TOPIK 쓰기 소요 시간 저장 위치 | ✅ writing 전용 metrics 계약(`writing_submission_metrics`, v13 소유) | `problem_attempts`는 objective attempt 성격이 강하고 writing 제출과 의미가 다르다. |
| Admin 전체 학습 분석 화면 위치 | ✅ `Analytics` 하위 학습 분석 탭 | 사용자 상세와 분리하면서 전체 운영 지표 성격을 유지한다. |
| 점수 표시 | ✅ 원점수 + 100점 정규화 병기 | TOPIK 문항별 만점이 달라 비교를 위해 정규화가 필요하다. |
| 원문 답안 노출 | ✅ 기본 제외 | 개인정보/학습자 민감 데이터이며 별도 권한/감사 로그 전까지 운영 요약에 필요하지 않다. |
| 활성 사용자 기준 | ✅ 로그인 기준이 아니라 학습 이벤트 기준(기존 대시보드 "활성 사용자(로그인)"와 라벨로 구분·공존) | 학습 분석의 목적은 실제 학습 행동 측정이다. |

## 8) 후속 문서 영향

이 계획이 구현으로 전환되면 다음 문서를 함께 갱신해야 한다.

- `docs/specs/admin-data-contract.md`: Users 학습 현황과 Analytics 학습 분석 데이터 계약
- `docs/page-sync/users-detail-page-sync.md`: v13 사용자 화면과 Admin 회원 상세 학습 현황 동기화 기준
- `docs/specs/page-ia/users-detail-page-ia.md`: 회원 상세 학습 현황 탭 IA
- `docs/specs/admin-data-usage-map.md`: B2C 노출/내부 전용/공유 데이터 분류
- `docs/architecture/admin-data-source-transition.md`: mock/API/RPC 전환 상태
- `docs/specs/admin-page-gap-register.md`: `problem_attempts` 기반 KPI와 writing 수집 gap 상태
- v13 repo의 해당 데이터 계약/화면 문서: writing 제출, 피드백, growth, library, recommendation, study events 관련 문서

