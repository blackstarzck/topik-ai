# Analytics > 학습 분석 상세 IA

## 1. 문서 목적

- TOPIK 쓰기 51~54번 학습 성과를 동일한 분석 조건으로 비교하는 조회 전용 화면 계약을 정의합니다.
- 기간·문제 유형·주제·유형별 세부 특성이 KPI와 모든 분석 섹션에 함께 적용되는 것을 보장합니다.
- 개인 식별자, 답안 원문, 문장별 첨삭 본문은 노출하지 않습니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Analytics |
| 페이지명 | 학습 분석 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 대시보드형 |
| 라우트 | `/analytics/learning` |
| 주요 권한 | `analytics.read` |
| 주요 role | `SUPER_ADMIN`, `OPS_ADMIN`, `CONTENT_MANAGER`, `READ_ONLY` |
| 연관 문서 | 학습 분석 page-sync, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md` |

## 3. 목표와 비목표

### 목표

- 기간, 51~54번 문제 유형, `topic_main → topic_detail`, 문제 유형별 세부 특성으로 분석 범위를 좁힙니다.
- 학습 규모·피드백 품질·점수 분포·주제 성과·PDF 내보내기 사용을 같은 범위에서 비교합니다.
- 지표 정의, 계산식, 표본, 커버리지와 직전 동일 기간 비교 기준을 화면에서 확인합니다.

### 비목표

- 개인 학습자 단위 상세는 `Users > 회원 상세 > 학습 현황`이 담당합니다.
- 이 화면은 조회·CSV 내보내기만 제공하며 데이터 변경과 감사 로그 생성은 하지 않습니다.
- `export_downloaded`를 실제 파일 저장 완료로 해석하지 않습니다.

## 4. 화면 구조

| 영역 | 주요 내용 | 액션 |
| --- | --- | --- |
| 페이지 헤더 | 브레드크럼, 제목·설명, 데이터 갱신 시각 | CSV 내보내기, 분석 조건 열기 |
| KPI 8종 | 학습 활성 사용자, 제출 수, 피드백 완료율, 평균 환산 점수, 피드백 조회율, 평균 풀이 시간, 처리 시간 중앙값, PDF 내보내기 완료 수 | 정보 아이콘 클릭·hover·focus 시 `분류 → 지표명 → 지표 정의 → 계산 방법·포함 조건·주의사항` 계층의 설명 툴팁 노출 |
| 문제 유형별 비교 | 학습자, 제출자, 제출 수, 완료율, 평균 환산 점수, 조회율, 풀이 시간, 재제출률, PDF 내보내기 수 | 정렬 |
| 문제 유형별 점수 분포 | `0–40`, `41–60`, `61–80`, `81–100` | 차트/표 전환 |
| 주제별 성과 | `topic_main`, `topic_detail`, 문제 유형(51~54), 평균 환산 점수, 제출 수, 직전 기간 변화 — 문제 유형×주제 단위 행 | 정렬 |
| PDF 사용 분석 | 전체 내보내기 완료, 직접 귀속, 혼합, 미분류, 문제 유형별 건수, 귀속률 | 미분류 확인 |

## 5. 분석 조건

- 기본값은 최근 30일, 51~54번 전체, 이전 동일 기간 비교 사용, 주제·세부 특성 전체입니다.
- 기간은 최근 7/30/90일, 전체, 직접 선택을 지원합니다. 직접 선택은 KST 시작일 00:00 이상, 종료일 다음 날 00:00 미만으로 집계합니다.
- 이전 동일 기간은 같은 일수의 직전 구간이며 `전체`에서는 사용하지 않습니다.
- 문제 유형 다중 선택은 OR, 문제 유형과 주제·세부 특성 축 사이는 AND입니다.
- 대주제와 세부 주제는 종속 선택입니다. 유형별 세부 필터는 문제 유형을 하나만 선택했을 때만 활성화합니다.
- 같은 세부 필드 안의 복수 값은 OR, 서로 다른 세부 필드는 AND입니다.
- 51번은 빈칸 역할·기능·정답 표현 종류, 52번은 연결 기능·허용 답안 범위, 53번은 자료 유형·요구 글 구성, 54번은 논술 유형·요구 관점·글 구성을 사용합니다.
- 조건 Drawer의 변경은 draft이며 `분석 적용`에서만 URL과 집계 요청에 반영합니다. 닫으면 미적용 draft를 폐기합니다.

## 6. 지표 정의

- 학습 활성 사용자: 선택 범위에 `submission_id` 또는 `problem_id`로 귀속 가능한 학습 이벤트가 1건 이상인 고유 사용자입니다. 귀속 불가능 이벤트는 임의 배분하지 않고 커버리지에서 구분합니다.
- 피드백 완료율: 완료 제출 수 ÷ 전체 제출 수입니다.
- 평균 환산 점수: 유효 점수가 있는 완료 제출을 행별 `score_max` 기준으로 100점 환산합니다.
- 피드백 조회율: 열람된 완료 제출 수 ÷ 전체 완료 제출 수입니다.
- 평균 풀이 시간: `writing_submission_metrics`가 있는 제출만 집계하며 표본 수와 커버리지를 함께 표시합니다. 수집 없음은 0초가 아니라 `미수집`입니다.
- 처리 시간 중앙값: `피드백 생성 시각 - 제출 시각`의 중앙값이며 표본 수를 표시합니다.
- 재제출: `parent_submission_id`가 있는 제출이며 건수와 비율을 함께 제공합니다.
- PDF 내보내기 완료 수: `study_events.event_type='export_downloaded'` 건수입니다. 실제 파일 다운로드 완료 수가 아닙니다.
- 각 KPI 툴팁은 정의, 계산 방법, 포함 조건, 주의사항을 제공합니다. 표본 수와 커버리지는 카드 보조 문구로 표시하고, 직전 동일 기간 비교는 카드 변화값으로 표시합니다.

## 7. PDF 귀속 정책

- 단일 제출 내보내기는 `payload.source_id`를 제출에 연결해 문제 유형과 주제에 귀속합니다.
- 여러 문제 유형을 포함할 수 있는 보고서·서재 선택 내보내기는 확정 가능한 정보가 없으면 `혼합` 또는 `미분류`로 보존합니다.
- 문제 유형·주제 조건 적용 시 KPI에는 해당 범위로 귀속 가능한 이벤트만 포함합니다. 전체·직접 귀속·혼합·미분류와 귀속률은 PDF 사용 분석에서 별도로 표시합니다.

## 8. URL과 내보내기 계약

- 복원 대상 쿼리는 `period`, `from`, `to`, `compare`, 반복 `question`, `topicMain`, `topicDetail`, 반복 `d.<field>`입니다.
- 새로고침, 뒤로가기, 공유 URL에서 같은 적용 조건과 분석 결과를 복원합니다. Drawer open과 미적용 draft는 복원하지 않습니다.
- CSV는 UTF-8 BOM으로 만들며 열은 `section, question_type, topic_main, topic_detail, metric, category, value, unit, sample_count, coverage, period_start, period_end`입니다.

## 9. 데이터와 source 계약

- 집계 RPC: `get_admin_learning_analytics_filtered(...)`.
- 필터 옵션 RPC: `get_admin_learning_analytics_filter_options()`.
- 두 RPC는 `private.is_admin()` + `SECURITY DEFINER` read-only 계약이며 개인 식별자와 민감 본문을 반환하지 않습니다.
- 기본 기간·문제 유형 통계는 제출의 `problem_id`를 `problems.id`에 연결하고 `problems.question_no`로 51~54번을 판별합니다. 따라서 신규 메타데이터 매핑이 없는 현재 제출도 학습자·제출·점수·피드백 통계에서 누락하지 않습니다.
- 주제·세부 특성 조건과 주제별 성과는 역사 source map과 환경별 별칭을 합친 `topik_writing_problem_question_map`의 active/non-held 연결 및 `topik_writing_question_recommendation_view`를 사용합니다. 연결은 `problems.question_no = item_number`, `topic_main/topic_detail` 존재, 51~54번별 필수 세부 메타데이터 완전성을 모두 만족해야 합니다. `topic_main/topic_detail`이 주제 SoT이며 구 `problems.tags`는 사용하지 않습니다.
- 집계 summary는 현재/직전 기간 각각 제출과 학습 이벤트의 메타데이터 대상·연결 수를 반환합니다. coverage 분모에는 기간·문제 유형만 적용하며 주제·세부 조건을 적용하지 않습니다.
- 기존 `get_admin_learning_analytics(period_days)`는 호환성을 위해 유지하며 새 화면 facade는 filtered RPC와 filter-options RPC를 사용합니다.

## 10. 네트워크 상태와 fail-safe

- 초기 pending은 skeleton으로 표시합니다. 조건 재조회 중에는 마지막 성공 결과를 유지하고 갱신 상태를 표시합니다.
- success와 empty를 구분하고, 0·미수집·귀속 불가를 서로 다른 상태로 렌더합니다.
- error 시 마지막 성공 결과를 유지하며 오류 안내와 재시도를 제공합니다.
- 메타데이터 coverage가 100% 미만이면 현재 제출·직전 제출·현재 이벤트·직전 이벤트를 별도 경고하고 `연결 N건 / 대상 M건`을 표시합니다. coverage 필드 누락, 음수, mapped가 eligible보다 큰 응답은 0으로 간주하지 않고 재시도 액션이 있는 계약 오류로 표시합니다.
- 새 조건 적용 시 이전 요청을 취소하고 최신 요청 결과만 반영합니다.

## 11. 다른 화면 영향

| 대상 | 영향 |
| --- | --- |
| Analytics > 통계 개요 | 로그인 기반 활성 사용자와 학습 이벤트 기반 활성 사용자의 정의를 구분합니다. |
| Users > 회원 상세 > 학습 현황 | 같은 writing 원천의 개인 단위 상세이며 이 페이지는 개인 식별자를 반환하지 않습니다. |
| Assessment > TOPIK 쓰기 문항 | 신규 TOPIK 쓰기 메타데이터의 문제 유형·주제를 read-only 분석 축으로 재사용합니다. |
| v13 사용자 화면 | 같은 제출·피드백·이벤트 원천을 읽는 내부 운영 집계이며 화면에 직접 노출되지 않습니다. |

## 12. 구현·검증 메모

- 페이지: `src/features/analytics/pages/analytics-learning-page.tsx`.
- 서비스: `src/features/analytics/api/analytics-learning-service.ts`.
- 환경별 별칭 스키마는 `supabase/migrations/20260713072205_topik_writing_problem_alias.sql`, 집계 RPC는 `supabase/migrations-admin/20260713120000_admin_learning_analytics_metadata_coverage.sql`과 각 down 파일로 관리하며 기존 v13 소유 테이블 DDL은 변경하지 않습니다.
- e2e는 조건 draft/apply/reset, URL 복원, 모든 분석 섹션의 동일 필터 적용, KPI 설명 툴팁·헤더 버튼 제거·CSV, pending/empty/error fallback을 검증합니다. live 검증은 dev DB의 KST 날짜 경계를 독립 SQL로 계산하고 기간 5종, 비교 켬/끔과 직전 동일 기간, 51~54번, 대주제 단독·주제 2단계·의도적 0건 주제 조합, 번호별 세부 필드 10종, 같은 필드 OR, 필드 간 AND, 문항+주제+세부 조건 교차 AND, Drawer 실제 적용을 대조합니다. 각 조건의 제출 KPI뿐 아니라 문제 유형 비교·점수 분포·주제 성과·PDF 분석 화면과 취약 평가 차원 RPC 계약도 같은 독립 SQL scope와 비교합니다.
- 소요 시간·PDF 귀속·메타데이터 연결 커버리지가 낮으면 표본과 커버리지를 표시하며 값을 임의 보정하지 않습니다.
- 취약 평가 영역(평가 차원) 섹션은 2026-07-15 오너 지시로 화면·CSV·프론트 계약에서 제거했습니다. 집계 RPC의 `weak_dimensions`·차원 커버리지 필드는 유지되며 프론트가 무시합니다.
- 적용 조건 요약 바(조건 초기화·조건 변경)도 2026-07-15 오너 지시로 제거했습니다. 적용 조건 확인·변경·초기화는 헤더 `분석 조건 N` 버튼으로 여는 Drawer(적용될 조건 태그, 초기화 → 분석 적용)가 담당합니다.
