# 메타데이터·태그 스키마 전환 — Phase 0 결정 확정 기록 (Decision Record)

| 항목 | 내용 |
| :---- | :---- |
| 문서 성격 | Phase 0 결정 확정본 (실행 계획안 §4 결정 테이블 D-1~D-13의 확정값 + v13 경계 합의 기록) |
| 확정일 | 2026-06-10 |
| 확정 주체 | 프로젝트 오너 지시(2026-06-10, "각 페이즈가 PASS 될 때까지 작업 완료" 위임)에 따라 실행 계획안의 권장안을 기준으로 확정. 실측 증거로 보강·수정된 항목은 각 행에 명시 |
| 기준 문서 | `docs/메타데이터-태그-스키마-전환-실행계획안.md`(P0~P6), `docs/metadata-tag-schema-rule.md`(v0.8) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (실DB 조사 쿼리·결과 원문) |

---

## 1. 결정 확정 테이블 (D-1 ~ D-13)

| ID | 결정 항목 | 확정값 |
| :---- | :---- | :---- |
| D-1 | 스키마 소유권·호스트 | **확정 — 권장안 채택(시나리오 B의 공유 호스트 변형)**. 신규 8오브젝트(+`question_source_map`)는 현행 v13 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev)에 생성하고, 마이그레이션 자산(`supabase/migrations`)은 이 repo(topik-ai)가 소유·관리한다. 승인 게이트: v13 측에 이미 **오너 결정 기록**(v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql` 헤더, 2026-06-09)이 존재하며 "real admin은 topik-ai repo이고, 문제 데이터의 관리(작성·노출 통제)는 admin이, v13은 read-only"를 확정했다 — 본 전환은 그 결정의 연장이다. 스테이징/브랜치 DB: **없음**(Management API `branches` 조회 결과 0건, 2026-06-10). 별도 `talkpik-prod` 프로젝트가 존재하나 admin/v13 양쪽 `.env` 모두 dev 프로젝트를 가리키며 prod 승격은 본 전환 비범위(§2.4). `problems` 일몰 조건은 §2.3 |
| D-2 | review_status 값 체계 | **확정 — ASCII enum 저장 + admin 한국어 라벨 매핑, 검수 2축 유지**. `review_status` 3값: `approved`=검수 완료 / `needs_revision`=검수 필요 / `on_hold`=사용 보류. `review_workflow_status` 5값(편차 E1, 4테이블 공통 컬럼 1개 추가): `not_started`/`in_progress`/`on_hold`/`done`/`revision_requested` (현행 admin 쓰기 사전 계승). 한국어 직저장 대안은 기각(v13 enum 관행 유지) |
| D-3 | topic 축 재분류 | **확정 — 17주제 수작업 재분류 입력표를 P2 선행 산출물로 생성**. `topic_category_code`(8값)로부터의 자동 코드 매핑은 금지(축이 다름) 원칙 유지. 입력표 작성 주체: 오너 위임에 따라 전환 작업에서 문항 본문(제목/프롬프트/시나리오) 기반 문항별 분류 초안을 작성하고, 분류 근거를 행마다 기록한다. 콘텐츠팀 승인은 P2-5 샘플 승인 게이트로 수행(승인 전 적재분은 `internal_test` 유지). `topic_category_code` 원값은 `question_source_map.legacy_topic_category_code`에 참고 보존 |
| D-4 | question_id 채번 | **확정 — 권장안 그대로**. `topik-writing-{item_number}-{4자리 연번}`. idempotency는 `question_source_map` 선조회로 보장: `legacy_problem_id` 기존 매핑이 있으면 그 `question_id` 재사용, 미매핑분만 결정적 정렬(`ORDER BY created_at, id`)로 신규 연번 할당. upsert도 source_map 매핑 기준 |
| D-5 | answer_key 역분해 | **확정 — 권장안 그대로**. 원본 JSONB(`answer_key`) 공통 컬럼 보존 + `blank_*` 정규화 병행. §7.2 필수 컬럼 역분해 실패 문항은 적재 보류(테이블 미적재, source_map·검증 리포트 추적) 후 재입력 시 적재. 실측 보강: v13 `problems.materials.blanks`에 빈칸별 role/function/answer_type/canonical_answer/accepted_answers/accepted_synonyms가 이미 정규화 보존돼 있어(51번 90/90행) 역분해 실패 위험은 당초 추정보다 낮다 |
| D-6 | service_status 정합 + 노출 제외 기준 | **확정 — `service_status` 컬럼이 유일한 물리 노출 상태(기본값 `internal_test`)**. 값: `available`=노출 가능 / `excluded`=노출 제외 / `internal_test`=내부 테스트. v0.8 §2.2의 '서비스_노출상태' 태그 그룹은 시드에서 제외하고 태그 RPC에서 부여 차단(이중 기록 방지). '운영 제외'는 `excluded` + 운영주의 태그 값 '운영 제외'로 구분. **노출 제외 기준(확정)**: ① `review_status != 'approved'` 문항은 `available` 전환 불가(RPC 가드) ② 운영주의 태그(`검수 필요`/`표현 주의`/`난이도 애매`) 활성 문항의 `available` 전환은 사유 필수 ③ 반복 노출 회피 대상(반복방지 태그 활성 과다)은 `excluded` 권고 — 각 기준을 `tag_master.usage_rule`과 POL-018에 기록. `operationStatus` 4값 union은 P3에서 제거 |
| D-7 | 메모 영구화 | **확정 — 권장안 그대로**. 검수 메모를 공통 `content_team_memo`에 영속화(현행 UI-local 가짜 저장 해소). 감사 로그 payload에 동일 본문 기록(`{"review_note": ...}` — v13 `admin_update_problem`의 `__note` 관행 계승). 태그별 메모는 `question_tags.memo` 별도 |
| D-8 | 쓰기 감사 계약 | **확정**. 신규 RPC 전부 `admin_audit_logs`(실측 스키마: `admin_user_id`/`action`/`target_table`/`target_id`/`diff`/`payload`)에 actor=`auth.uid()` + 컬럼 diff(`{col:{from,to}}`) 기록. `target_table`='`AssessmentQuestion`'(admin 감사 화면 Target Type 관행), `target_id`=신규 `question_id`. 액션 코드: 검수=`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`(admin 라벨 맵 기존 코드 재사용), 운영(P4)=`service_status_changed`·`tag_assigned`·`tag_removed`(신규), 배포(P6)=`question_published`(신규). 주의(실측): 구 `admin_update_problem`·`get_admin_users`·`admin_set_user_status` RPC는 **2026-06-09 v13 admin island 제거 마이그레이션으로 라이브 DB에서 이미 삭제됨** — "현행과 동등 보장"의 비교 대상은 위 v13 마이그레이션 파일의 계약 원문이며, P1 RPC는 신설이다 |
| D-9 | 52/53/54 데이터 | **확정 — 실재 쿼리 완료(2026-06-10)**: `problems` 검수 완료(approved) 51=90 / 52=5 / 53=46 / 54=81, 검수 전(pending) 51=1 / 52=72 / 53=17 / 54=158 (51~54 총 470행). 4테이블 모두 실데이터로 가동하며 빈 테이블 시나리오는 불필요. **백필 범위 보강 확정**: 검수 완료분만 이관하면 컷오버 후 검수 대기 248행이 admin 검수 표면에서 사라지므로(검수 워크플로 단절), 백필 범위는 `problems` 51~54 **전수(검수 상태 무관)**로 확정하고 검수 상태는 이관 사전(`docs/specs/admin-data-contract.md` §12.2 D-2 행: `pending`→`needs_revision`+`not_started`, `approved`→`approved`+`done`, `rejected`→`needs_revision`+`revision_requested`)으로 이관한다. 실행 계획안의 "검수 완료 90문항" 범위 기술은 본 결정으로 대체된다(계획안 §6.1 보강 주석 참조) |
| D-10 | admin 범위 확장 | **확정 — 권장안 그대로**. 메타데이터 ~45컬럼 입력/저작 UI는 비범위(콘텐츠팀 입력표→ETL 경로 유지). admin은 검수·태그 부여/제거·노출 통제·마스터 조회까지만 확장 |
| D-11 | 상류 업로드 엔드포인트 | **확정 — 요청서 발신 준비 완료**. upsert/노출토글 엔드포인트 신설 요청서(task52 부재 이슈 포함)를 `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`로 작성. 실제 발신은 오너 채널(메신저) 경유 — 미발신 상태는 P6 지연 리스크로 스코어카드에 기록. P1~P5는 미확정과 무관하게 진행 |
| D-12 | e2e 인증 전략 | **확정 — 권장안 그대로**. ① CI/스모크용 `VITE_SUPABASE_DISABLED` 모크 모드 실행 경로를 P3 작업 패키지에서 결선(현재 플래그는 미결선) ② 신규 스키마 연결 검증용 시드 admin 계정 1개를 P1에서 talkpik-dev에 생성(`app_role='content_admin'`, `status='active'`, e2e 전용 — 자격증명은 `.env.local` 비공개 키로만 관리) |
| D-13 | 53번 자료 자산 저장소 | **확정 — 권장안 그대로**. 1차 전환은 `source_data`(JSONB 수치)만 적재하고 화면은 수치 기반 표 렌더 + `data_asset_url` 빈 값 허용(empty state). Storage/CDN 채택은 P5에서 별도 결정. 실측 보강: 53번 46행 전부 `materials.charts`에 수치 데이터 보유 — `source_data` 적재원 확보됨 |

### 1.1 §3.3 파생 확정값 (식별자·코드 규칙)

- `question_type_code`(번호 파생 고정): 51=`writing_51_blank_completion` / 52=`writing_52_sentence_completion` / 53=`writing_53_data_description` / 54=`writing_54_opinion_essay`
- `question_type_name` 기본값(입력표에서 덮어쓰기 가능): 51=`빈칸 완성` / 52=`연결 표현` / 53=`자료 설명` / 54=`의견 서술` (admin 현행 유형 라벨 계승)
- `topic_source` 고정 문구: `메신저 전달 항목(국제 통용 한국어 표준 교육과정 적용 연구 참고)`
- `schema_version` 초기값: `1.0`

## 2. v13 경계 합의 기록

### 2.1 합의 근거 (경계의 SoT)

- v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql` (2026-06-09, 오너 결정): "v13 is the user-facing app … the real admin is the separate topik-ai repo. The NEW data flow for problems is: the ADMIN (topik-ai) fetches problems/questions from an EXTERNAL/third-party API (ALREADY REVIEW-COMPLETE), applies the exposure management point (public/private), and WRITES them to this Supabase DB; v13 only READS that data (read-only)." 같은 마이그레이션에서 v13 측 admin RPC 11종(구 `admin_update_problem` 포함)이 삭제됐다.
- 보존된 공유 자산(본 전환이 재사용): `public.admin_audit_logs` 테이블, `private.is_admin`/`is_content_admin`/`is_platform_admin` RLS 헬퍼, `profiles.app_role` enum — 전부 라이브 DB 존재 확인(2026-06-10).

### 2.2 네임스페이스·승인 경계

- topik-ai가 소유하는 오브젝트: `topik_writing_*` 접두 테이블 8종 + `topik_writing_question_source_map` + 그에 속한 인덱스/RLS/시드, `admin_*` 접두 신규 RPC. 기존 v13 테이블(`problems` 포함)에는 **DDL 변경 0건** 원칙(P1-4 무변경 diff로 증명).
- 적용 절차: 마이그레이션 작성 → 오너 승인(v13 오너 = admin 오너 동일인 — 단일 승인으로 충족) → 프로덕션 적용 → §5.4 스모크/diff 게이트. 브랜치/스테이징 DB가 없으므로(실측) 스테이징 검증은 "신규 오브젝트만 추가하는 additive 마이그레이션 + down 스크립트 + 적용 직후 무변경 diff"로 대체한다.

### 2.3 `problems` 일몰(sunset) 조건과 전환기 SoT 우선순위

1. P3 컷오버 전: `problems` = 검수 데이터 SoT (admin 읽기/검수 쓰기 모두 problems 경로).
2. P3 컷오버 시: 검수 freeze 윈도 → ETL 델타 재적재 → 발산 0건 대사 → 코드 전환. 이후 `problems`는 admin 기준 **read-only 레거시**로 동결(신규 admin write 금지, 구 어댑터는 플래그 봉인으로 P4 종료까지 보존 — 롤백 경로).
3. 컷오버 후: 신규 4테이블 = 검수·운영 SoT. v13 사용자 기능이 `problems`를 계속 읽는 동안 `problems` 행 삭제/아카이브는 금지.
4. 일몰(드롭/아카이브) 실행: P6 PASS + v13 사용자 기능의 신규 소비 경로 전환 확인 후 **별도 오너 결정**으로만 진행(본 전환 비범위).

### 2.4 prod 프로젝트 비범위 선언

- `talkpik-prod`(`eymlabowhfgtxbiqwxqh`)가 별도로 존재하나, admin과 v13의 `.env`가 모두 talkpik-dev를 가리키는 현행 운영 기준을 따른다. prod 승격·동기화는 본 전환 비범위이며 P6 이후 별도 트랙.

## 3. freeze 가드 해제 기록 (P0-3)

| 가드 위치 | 해제 내용 |
| :---- | :---- |
| `docs/architecture/admin-data-source-transition.md` §10.4 | 미채택 추적 메모 → 채택 확정·결정 기록 포인터로 갱신 |
| `docs/specs/admin-data-contract.md` §12 (+§9.6 연결 문장) | 후보 계약(미채택) → 채택 계약(컷오버 전 §9.6 병행 유효)으로 갱신, 편차 E1~E4 기록 |
| `docs/specs/admin-page-gap-register.md` §4.7 | `미확정`(코드 착수 차단) → `진행 중`(P0 결정 해소, P1~P6 실행) |
| `docs/specs/page-ia/assessment-question-bank-page-ia.md` / `...manage-page-ia.md` freeze 조항 | "Phase 0 전 계약 변경 금지" → "채택 확정, P3 컷오버 작업에서 IA 재작성" |
| `docs/page-sync/assessment-question-bank-page-sync.md` §13 전환 행 | 미확정 행 → 결정 확정·실행 중으로 해소 |

## 4. 편차 목록 승인 (실행 계획안 §5.2 E1~E4)

E1(`review_workflow_status` 공통 컬럼 추가), E2(`topik_writing_question_source_map` 매핑 테이블 — `legacy_topic_category_code` 참고 보존 컬럼 포함), E3(tag_master 시드에서 '서비스_노출상태' 그룹 제외 + 운영주의 '운영 제외' 값 추가), E4(추천 뷰 admin 목록용 6컬럼 확장)를 전부 승인한다. 콘텐츠팀 사후 승인 절차는 P2-5 샘플 승인에 병합(발주서 `docs/requests/content-team-order-2026-06-10.md`).

## 5. 후속 단계 게이트 요약

- P1 착수 조건: 본 기록 + freeze 해제 + 원자 커밋 + `harness:check` 통과(P0 채점 PASS — 실행 계획안 §12.3/§12.4).
- 외부 의존 추적: D-11 요청서(상류), D-3/E1/E3 발주서(콘텐츠팀) — 발신·회신 상태는 스코어카드 메모로 추적.
