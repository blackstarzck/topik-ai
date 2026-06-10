# 메타데이터·태그 스키마 전환 — HANDOFF (P1 완료 시점)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-10 (P1 PASS 직후, 오너 지시로 작업 중지) |
| 목적 | 다음 작업 세션이 P2(백필 ETL)부터 곧바로 이어갈 수 있도록 현재 상태·도구·다음 단계·주의사항을 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (P0~P6, §12.3 PASS 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (D-1~D-13 확정값 + v13 경계 합의) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0·P1 채점표·쿼리 원문) |

## 1. 진행 상태 (2026-06-10 기준)

| 페이즈 | 판정 | 핵심 증적 |
| :---- | :--: | :---- |
| P0 결정 확정 | **PASS** | 커밋 `346e56e`(원자 커밋) + `2e0caa1`(채점 기록). D-1~D-13 확정, freeze 가드 5곳 해제, AGENTS.md §2 재조정 |
| P1 스키마 구축 | **PASS** | 마이그레이션 12파일 프로덕션 적용 완료, 무변경 diff 0건, RLS 매트릭스·RT-1 왕복 53스텝 ALL PASS (§12.4 스코어카드의 P1 행 커밋 해시 참조) |
| P2 백필 ETL | 미착수 | **다음 작업.** P1 PASS로 실데이터 적재(비가역) 착수 가능 |
| P3~P6 | 미착수 | P3 코드 선행 개발은 P2와 병행 가능(컷오버 배포는 P2 PASS 후) |

## 2. 무엇이 어디에 있나

### 2.1 DB (talkpik-dev, `fglggyfvzjdsbyckinqa` — admin·v13 공용 프로젝트)

- 신규 오브젝트(전부 생성·RLS 적용 완료): `topik_writing_51/52/53/54_questions`, `topik_writing_topic_master`(17주제×세부 85행 시드), `topik_writing_tag_master`(19태그, '서비스_노출상태' 그룹 제외), `topik_writing_question_tags`, `topik_writing_question_source_map`, `topik_writing_question_recommendation_view`(security_invoker), 감사 RPC 3종(`admin_update_topik_question`/`admin_assign_question_tag`/`admin_remove_question_tag`), 마이그레이션 추적 테이블 `topik_writing_schema_migrations`.
- 문제 테이블 4종은 현재 **0행**(파일럿은 검증 후 정리됨). 백필 대상 원천: `problems` 51~54 **470행** (approved 222 = published/public, pending 248 = draft/private, 전부 `source='curated'`).
- 읽기 RLS: `private.is_admin()`(content_admin/platform_admin) 한정. 쓰기: RPC 단일 경로(직접 write는 RLS 차단, service-role만 우회 — 백필 경로).

### 2.2 Repo 자산

- `supabase/migrations/*.sql` 12파일 + `supabase/migrations/down/` 롤백 스크립트.
- `scripts/db/`: `run-sql.mjs`(Management API SQL 실행), `migrate.mjs`(`npm run db:migrate`, `--status`, `--down <파일명>`), `schema-snapshot.mjs`(`npm run db:snapshot`, `--diff a b --exclude-own`), `create-e2e-admin.mjs`(D-12 시드 계정), `p1-smoke.mjs`(RLS 매트릭스+RT-1 — P2 이후 회귀 검증에 재사용 가능. 단, 파일럿 행을 삽입·삭제하므로 본 적재 후에는 9999 ID 충돌 여부만 주의).

### 2.3 자격증명 (전부 gitignored — 커밋 금지)

- `.env.local`(이 repo): `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`(클라이언트), `SUPABASE_SECRET_KEY`(service-role, 서버 스크립트 전용), `E2E_ADMIN_EMAIL/PASSWORD`(content_admin 시드 계정), `E2E_USER_EMAIL/PASSWORD`(비admin 검증 계정).
- Management API 토큰(`SUPABASE_ACCESS_TOKEN`, `sbp_...`): v13 repo의 `.env.local`(`C:\Users\admin\Desktop\workspace\topik-project\v13\.env.local`)에 있다. db 스크립트 실행 전 환경변수로 주입할 것. 주의: v13 메모에 "transcript 노출됐으므로 회전 필수" 기록이 있다 — **토큰·secret key 회전을 오너에게 권고**(회전 시 양쪽 .env.local 갱신).
- 주의: `sb_secret` 키는 PowerShell `Invoke-RestMethod`에서 브라우저로 오인되어 거부된다 — 반드시 Node(fetch/supabase-js) 경유로 사용.

## 3. 다음 작업: P2 백필 ETL (채점표 §12.3 P2-1~P2-7)

### 3.1 만들 것 (`scripts/etl/` 신설, Node + SUPABASE_SECRET_KEY)

1. `extract-problems.mjs` — `problems` 51~54 전수 덤프(+ materials JSONB).
2. `transform-questions.mjs` — 채번(D-4)·컬럼 매핑·정규화·재분류 입력표 병합 → 테이블별 upsert payload + 적재 보류 목록 + 검증 리포트.
3. `load-questions.mjs` — source_map 선조회 idempotent upsert(service-role), `auto_checks_passed` 기록.
4. `verify-backfill.mjs` — 검증 5종(재조립/보존/수량/축/RT-2 재조회 diff 0건).

### 3.2 매핑에 쓸 원천 구조 (실측 — 증적 로그 D-5/D-13 절 참조)

- 공통: `problems.title`→`scenario_type` 초안/`situation_summary` 재료, `prompt`→`prompt_text`, `answer_key` JSONB 보존, `review_status/review_workflow_status` 이관 사전은 데이터 계약 §12.2 D-2 행, `materials.taxonomy`(speech_act/text_type/relation/scenario_type 등), `topic_category_code`→source_map 보존.
- 51 (90+1행): `materials.blanks.blank_1/2`에 role/function/answer_type/canonical_answer/accepted_answers/accepted_synonyms **이미 정규화돼 있음** → `blank_*` 컬럼 직매핑. `materials.source_context.resolved_text`→`resolved_text`(재조립 검증의 기준). `materials.review.validation`→`validation_result`.
- 52 (5+72행): `materials.blanks`+`scenario`+`taxonomy`(blank_count/blank_notation_policy/link_keywords/narrative_slots/subject_domain/topic_type). `completion_unit`/`connection_function`/`required_expression_function`/`answer_scope_type`(NOT NULL)은 scenario/taxonomy에서 파생 — 파생 불가 항목은 적재 보류(D-5).
- 53 (46+17행): `materials.charts`(수치 원본)→`source_data`(D-13), data_type/comparison_type 등 파생. `data_asset_url`은 빈 값 허용.
- 54 (81+158행): `materials.scenario`+`taxonomy`→essay_type/issue_topic/prompt_questions/stance_requirement/required_structure/reasoning_pattern/scoring_focus(NOT NULL 다수 — 파생 규칙 설계 필요).
- 번호별 정확한 materials 키 분포는 다음 쿼리로 재확인: `select question_no, jsonb_object_keys(materials) k, count(*) from problems where question_no in (51,52,53,54) group by 1,2 order by 1,2;` (taxonomy 하위는 `materials->'taxonomy'`로 동일 패턴).

### 3.3 재분류 입력표 (D-3 — P2 선행 산출물)

- 470행 전수에 `topic_main`(17 고정)/`topic_detail`(topic_master 85값)/`difficulty_level`(1~6)/`target_level`/`question_type_name` 부여. **`topic_category_code`로부터의 기계 변환 금지** — 문항 본문 기반 분류 초안(행별 분류 근거 기록) 작성 후 콘텐츠팀 승인(P2-5 샘플 10문항)으로 확정.
- 17주제·세부 사전은 DB `topik_writing_topic_master` 또는 `docs/metadata-tag-schema-rule.md` §4.3. topic FK 제약이 있어 사전 밖 값은 적재가 거부된다(=축 검증 자동화).
- 51번 90행은 `materials.source_difficulty_target`("TOPIK 3급")이 `target_level` 초안이 된다. 52~54는 `normalized_difficulty`/`source_difficulty` 활용.

### 3.4 P2 게이트 체크리스트 (전부 충족해야 PASS → P3 컷오버 가능)

- P2-1 idempotency: 2회 연속 실행 diff 0건 로그. P2-2 검증 리포트 5종. P2-3 적재 보류 목록+발주. P2-4 source_map 전수(적재 건수=매핑 건수, `legacy_publish_status/visibility` 보존 포함). P2-5 콘텐츠팀 샘플 승인(발주서 `docs/requests/content-team-order-2026-06-10.md` — **아직 미발신**). P2-6 델타 재적재 리허설 1회. P2-7(권장) vitest 매핑/역분해 단위 테스트.
- 전 문항 `service_status='internal_test'`로 적재(D-6 — 콘텐츠팀 승인 전 노출 차단).

## 4. P3 이후 요약 (상세는 실행계획안 §7~§10)

- P3: 읽기+검수 쓰기 동시 컷오버. 변경 파일 목록은 계획안 §7.2(11파일). 검수 쓰기는 `admin_update_topik_question`으로 교체(주의: **구 `admin_update_problem`은 라이브 DB에 없어 현행 검수 쓰기는 이미 깨져 있음** — 컷오버가 곧 수리다). 구 problems 어댑터는 플래그 봉인 보존(롤백 경로). RT-3/RT-4 + freeze→델타→발산 0건 대사 증적 필요. D-12 모크 모드(`VITE_SUPABASE_DISABLED`) 결선 포함.
- P4: `OPERATION_WRITE_ENABLED` 제거 + service_status write + 태그 UI + 감사 라벨 맵(`system-audit-logs-page.tsx`)에 신규 액션 코드(`service_status_changed`/`tag_assigned`/`tag_removed`/`review_status_changed`) 추가.
- P5: `/system/metadata`에 topic/tag 마스터 조회 그룹.
- P6: 외부 게이트 — 상류 요청서(`docs/requests/upstream-writing-endpoints-request-2026-06-10.md`, **미발신**) 회신 필요. task52 부재 이슈 포함.

## 5. 미해결·주의 사항

1. **외부 발신 2건 미발신**(P0-6 부분): 콘텐츠팀 발주서(P2-5 승인 의존)·상류 요청서(P6 게이트 의존) — 오너 채널 발신 필요.
2. **토큰 회전 권고**: §2.3 참조.
3. 현행 admin 검수 쓰기·운영 쓰기는 라이브 DB 기준 동작 불가(구 RPC 부재) — 사용자 영향: 검수 상태 변경 시 화면 오류. P3 컷오버가 해소 경로(데이터 계약 §9.6 주의 문구 기록됨).
4. `problems`는 P3 컷오버까지 검수 SoT, 컷오버 후 read-only 동결, 일몰은 P6 후 별도 결정(결정 기록 §2.3).
5. 페이즈 산출물 커밋 규율: 페이즈 작업 커밋 → §12.4 스코어카드 채점 기록 커밋(2단계) 패턴을 P0·P1에서 사용 — 유지 권장. 모든 MD 수정은 `logs/admin-doc-update-log.md`(+IA 수정 시 `docs/specs/admin-page-ia-change-log.md`) 기록 의무, `npm run harness:check` 필수(AGENTS.md).
6. `.omx/evidence/`의 스냅샷·스모크 리포트 JSON은 비추적 작업 산출물 — 정식 증적은 `logs/metadata-tag-schema-transition-evidence.md`에 옮겨 적는 방식 유지.
