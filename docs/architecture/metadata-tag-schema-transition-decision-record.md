# 메타데이터·태그 스키마 전환 — Phase 0 결정 확정 기록 (Decision Record)

| 항목 | 내용 |
| :---- | :---- |
| 문서 성격 | Phase 0 결정 확정본 (실행 계획안 §4 결정 테이블 D-1~D-13의 확정값 + v13 경계 합의 기록) |
| 확정일 | 2026-06-10 |
| 확정 주체 | 프로젝트 오너 지시(2026-06-10, "각 페이즈가 PASS 될 때까지 작업 완료" 위임)에 따라 실행 계획안의 권장안을 기준으로 확정. 실측 증거로 보강·수정된 항목은 각 행에 명시 |
| 기준 문서 | `docs/메타데이터-태그-스키마-전환-실행계획안.md`(P0~P6), `docs/metadata-tag-schema-rule.md`(v0.8) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (실DB 조사 쿼리·결과 원문) |

---

## 0. 2026-06-11 인바운드 모델 전환 (오너 결정 — 데이터 흐름 방향 정정, 본 문서 D-2/D-3/D-7/D-8/D-10/D-11 재정의)

2026-06-11 프로젝트 오너 결정으로 TOPIK 쓰기 문항의 데이터 흐름이 **인바운드 수신 모델**로 확정됐다. 종전 admin 문서들이 SoT로 삼던 아웃바운드 push 모델(POL-017 구판: `검수 → 배포(API 업로드) → 노출 통제`)은 **폐기·대체**된다. 본 결정으로 admin 문서는 2026-06-09 v13 경계 결정 원문(§2.1 — "admin이 외부 API로부터 문제를 받아와, 노출 관리 포인트를 적용해, Supabase에 쓴다; v13은 read-only")과 같은 방향이 된다.

### 0.1 확정 데이터 흐름

```
[외부(공급) API — 문제 발원·생성 주체. 미개발 상태(공급 계약 요청 추진, D-11 재정의)]
        │  문제 본문 + 메타데이터(완성 상태) 공급
        │  페이로드 = schema-rule §4 메타데이터 + §7 테이블 스키마(§7.9 추천 뷰 제외, 검수 필드 제외)
        ▼
[ADMIN 수신·적재] → Supabase topik_writing_51/52/53/54_questions + question_source_map
        ▼
[ADMIN 관리 포인트] ① 태그(schema-rule §2: tag_master 사전 기반 question_tags 부여/제거)
                    ② 노출 통제: service_status 컬럼(D-6 유지 — available/excluded/internal_test, 기본 internal_test)
        ▼
[v13 사용자 기능] read-only 소비
```

### 0.2 확정 사항

1. **문제 발원 = 외부(공급) API.** 문제 본문·정답·메타데이터(주제/난이도/유형/번호별 세부 메타 — schema-rule §4·§7)는 외부 측에서 **완성 상태로** 공급된다. admin은 문제를 저작·생성·분류·검수하지 않는다. 외부 API는 **미개발 상태**이며 공급 계약은 요청 문서(D-11 재정의)로 추진한다.
2. **admin 역할 = 수신·적재 + 관리 포인트 + 노출 통제.** 관리 포인트는 schema-rule §2의 **태그**(추천목적/반복방지/학습흐름/운영주의/대표문제/추천사용)다. 노출 통제는 `service_status` 전용 컬럼으로 유지한다(D-6 — 태그와 별개 물리 컬럼, '서비스_노출상태' 태그 그룹 시드 제외 불변).
3. **검수 개념 전면 삭제.** `review_status`·`review_workflow_status`(편차 E1 — 철회)·`review_passed`·`validation_result` 컬럼과 검수 화면·검수 쓰기·검수 감사 액션·검수 메모 개념을 admin 표면·스키마·계약·정책에서 제거한다(컬럼 물리 제거는 재정의된 P3 마이그레이션). 문제 품질·상태 표현은 태그(관리 포인트)로만 한다. `auto_checks_passed`는 수신·적재 자동 정합 검사 표식으로 존치하고, `content_team_memo`는 수신 메타데이터로 존치한다(admin 쓰기 없음).
4. **인터림(외부 API 미개발 동안).** P2 백필 466행은 **초기 코퍼스**(유효 저장 데이터)로 유지한다. 신규 공급은 API 개발 완료 후 수신 경로로만 받는다. `problems`는 v13 사용자 기능이 읽는 동안 보존한다(§2.3 동결 방침 유지 — 단 "검수 SoT" 위상은 소멸, 레거시 원천으로만 의미).
5. **소멸하는 트랙.** 콘텐츠팀 발주서·P2-5 샘플 승인 게이트·D-3 분류 소유권 트랙(2026-06-11 오전 옵션 3 판정 포함)은 본 전환으로 **목적 자체가 소멸**해 폐기한다(메타데이터가 외부에서 완성 상태로 공급되므로 admin 경유 분류·승인 절차가 존재하지 않음). 상류 push(업로드/배포) 트랙(구 P6·`question_published`)도 폐기한다.

### 0.3 재정의 영향 요약

| 대상 | 처분 |
| :---- | :---- |
| D-2(검수 값 체계)·D-7(검수 메모 영구화)·편차 E1 | **철회** — 검수 개념 삭제 |
| D-3(재분류 입력표)·P2-5 게이트·콘텐츠팀 발주서 | **폐기(트랙 소멸)** — 메타데이터는 외부 공급. 466행 인터림 코퍼스의 기존 분류값은 백필 산출물로 유효 |
| D-6(service_status)·D-4(채번)·D-5(원본 보존)·D-12(e2e)·D-13(자료 자산) | **유지** (D-6은 검수 결합 기준 ①만 삭제) |
| D-8(감사 계약) | 검수 액션 4종 제거, `service_status_changed`/`tag_assigned`/`tag_removed` 유지, `question_published` 폐기, `question_received`(수신) 후속 추가 |
| D-10(admin 범위) | 수신·적재 + 태그 + 노출 통제로 재정의(저작·검수 없음) |
| D-11(상류 요청) | push 엔드포인트 요청 → **문항 공급(인바운드) API 계약 요청**으로 재작성 |
| 실행계획 P3~P6·POL-017·POL-018 기준 ① | 재정의(실행계획안 2026-06-11 개정판·정책 맵 참조) |

---

## 1. 결정 확정 테이블 (D-1 ~ D-13)

| ID | 결정 항목 | 확정값 |
| :---- | :---- | :---- |
| D-1 | 스키마 소유권·호스트 | **확정 — 권장안 채택(시나리오 B의 공유 호스트 변형)**. 신규 8오브젝트(+`question_source_map`)는 현행 v13 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev)에 생성하고, 마이그레이션 자산(`supabase/migrations`)은 이 repo(topik-ai)가 소유·관리한다. 승인 게이트: v13 측에 이미 **오너 결정 기록**(v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql` 헤더, 2026-06-09)이 존재하며 "real admin은 topik-ai repo이고, 문제 데이터의 관리(작성·노출 통제)는 admin이, v13은 read-only"를 확정했다 — 본 전환은 그 결정의 연장이다. 스테이징/브랜치 DB: **없음**(Management API `branches` 조회 결과 0건, 2026-06-10). 별도 `talkpik-prod` 프로젝트가 존재하나 admin/v13 양쪽 `.env` 모두 dev 프로젝트를 가리키며 prod 승격은 본 전환 비범위(§2.4). `problems` 일몰 조건은 §2.3 |
| D-2 | review_status 값 체계 | **[철회 — 2026-06-11 §0]** 검수 개념 전면 삭제로 본 결정은 폐기됐다. `review_status` 3값·`review_workflow_status` 5값(편차 E1) 체계와 검수 표면은 제거 대상(컬럼 물리 제거는 재정의 P3 마이그레이션). 문제 품질·상태는 태그(관리 포인트)로만 표현. (종전 확정값: ASCII enum 2축 + 한국어 라벨 — P1~P2 산출물에 반영된 역사 기록은 증적 로그 참조) |
| D-3 | topic 축 재분류 | **[폐기(트랙 소멸) — 2026-06-11 §0]** 인바운드 전환으로 주제·난이도·유형 등 분류 메타데이터는 **외부(공급) API가 완성 상태로 공급**한다 — admin 경유 재분류·승인 절차 자체가 소멸. P2-5 샘플 승인 게이트·콘텐츠팀 발주서·분류 소유권 트랙(같은 날 오전 옵션 3 판정 `docs/architecture/d3-classification-ownership-decision-brief.md` 포함) 전부 폐기. **인터림 코퍼스 466행의 기존 분류값은 백필 산출물로 유효한 저장 데이터**로 유지하며, 외부 API 가동 후 공급측 데이터로의 대체(재공급) 여부는 공급 계약에서 결정. `topic_category_code` 원값은 `question_source_map.legacy_topic_category_code`에 참고 보존(불변) |
| D-4 | question_id 채번 | **확정 — 권장안 그대로**. `topik-writing-{item_number}-{4자리 연번}`. idempotency는 `question_source_map` 선조회로 보장: `legacy_problem_id` 기존 매핑이 있으면 그 `question_id` 재사용, 미매핑분만 결정적 정렬(`ORDER BY created_at, id`)로 신규 연번 할당. upsert도 source_map 매핑 기준 |
| D-5 | answer_key 역분해 | **확정 — 권장안 그대로**. 원본 JSONB(`answer_key`) 공통 컬럼 보존 + `blank_*` 정규화 병행. §7.2 필수 컬럼 역분해 실패 문항은 적재 보류(테이블 미적재, source_map·검증 리포트 추적) 후 재입력 시 적재. 실측 보강: v13 `problems.materials.blanks`에 빈칸별 role/function/answer_type/canonical_answer/accepted_answers/accepted_synonyms가 이미 정규화 보존돼 있어(51번 90/90행) 역분해 실패 위험은 당초 추정보다 낮다 |
| D-6 | service_status 정합 + 노출 제외 기준 | **확정·유지(2026-06-11 §0에서 검수 결합 기준 ①만 삭제) — `service_status` 컬럼이 유일한 물리 노출 상태(기본값 `internal_test`)**. 값: `available`=노출 가능 / `excluded`=노출 제외 / `internal_test`=내부 테스트. v0.8 §2.2의 '서비스_노출상태' 태그 그룹은 시드에서 제외하고 태그 RPC에서 부여 차단(이중 기록 방지). '운영 제외'는 `excluded` + 운영주의 태그 값 '운영 제외'로 구분. **노출 제외 기준(2026-06-11 개정)**: ① ~~검수 미완료 `available` 전환 불가~~(검수 개념 삭제로 철회) ② 운영주의 태그(`표현 주의`/`난이도 애매` 등) 활성 문항의 `available` 전환은 사유 필수 ③ 반복 노출 회피 대상(반복방지 태그 활성 과다)은 `excluded` 권고 — 각 기준을 `tag_master.usage_rule`과 POL-018에 기록. `operationStatus` 4값 union은 재정의 P3에서 제거 |
| D-7 | 메모 영구화 | **[철회 — 2026-06-11 §0, 2026-06-12 보강]** 검수 메모 개념 삭제로 폐기. `content_team_memo` 컬럼은 **수신 메타데이터**로 존치(admin 쓰기 없음). 태그 부여/제거의 별도 운영 메모 필드는 두지 않고, 태그 이력(`question_tags`)과 감사 액션(`tag_assigned`/`tag_removed`)으로 추적 |
| D-8 | 쓰기 감사 계약 | **확정·재정의(2026-06-11 §0)**. 신규 RPC 전부 `admin_audit_logs`(실측 스키마: `admin_user_id`/`action`/`target_table`/`target_id`/`diff`/`payload`)에 actor=`auth.uid()` + 컬럼 diff(`{col:{from,to}}`) 기록. `target_table`='`AssessmentQuestion`', `target_id`=신규 `question_id`. **액션 코드(개정)**: 운영=`service_status_changed`·`tag_assigned`·`tag_removed`(유지), 수신=`question_received`(외부 API 수신·적재 — 공급 연동 시 추가). ~~검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)~~·~~배포 `question_published`~~는 검수 삭제·push 폐기로 철회. 주의(실측): 구 `admin_update_problem` 등 v13 RPC는 2026-06-09 admin island 제거로 라이브 DB에서 이미 삭제됨 |
| D-9 | 52/53/54 데이터 | **확정 — 이행 완료(역사 기록)**: `problems` 51~54 전수 470행(approved 222 + pending 248) 실재 확인 후 전수 백필 확정, P2에서 466행 적재 + 4행 보류 완료. **[2026-06-11 §0 보강]** 백필 산출물 466행은 **인터림 초기 코퍼스**로 유지(신규 공급은 외부 API 가동 후 수신 경로). 백필 시 이관된 검수 상태 값은 검수 개념 삭제(D-2 철회)에 따라 재정의 P3 컬럼 제거 마이그레이션에서 함께 정리된다 |
| D-10 | admin 범위 | **확정·재정의(2026-06-11 §0)**. admin 범위 = **수신·적재(외부 API → Supabase) + 문항 조회 + 관리 포인트(태그 부여/제거) + 노출 통제(`service_status`) + 마스터 조회**. 메타데이터 입력/저작 UI 비범위 원칙 유지(메타데이터는 외부 공급). ~~검수~~는 범위에서 제거(§0-3) |
| D-11 | 외부 공급 API 계약 | **재정의(2026-06-11 §0) — 문항 공급(인바운드) API 계약 요청**. 종전 "상류 업로드(push) 엔드포인트 신설 요청"은 폐기하고, 외부 측에 **문항+메타데이터 공급 API**(페이로드 = schema-rule §4·§7(7.9 제외, 검수 필드 제외), idempotency 식별자 포함)를 요청한다 — 요청서 `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`(2026-06-11 인바운드 기준 재작성). 외부 API 미개발 상태이므로 수신 연동(재정의 P6)은 공급 계약 회신 게이트에 종속. 발신은 오너 채널 경유 |
| D-12 | e2e 인증 전략 | **확정 — 권장안 그대로**. ① CI/스모크용 `VITE_SUPABASE_DISABLED` 모크 모드 실행 경로를 P3 작업 패키지에서 결선(현재 플래그는 미결선) ② 신규 스키마 연결 검증용 시드 admin 계정 1개를 P1에서 talkpik-dev에 생성(`app_role='content_admin'`, `status='active'`, e2e 전용 — 자격증명은 `.env.local` 비공개 키로만 관리) |
| D-13 | 53번 자료 자산 저장소 | **확정 — 권장안 그대로**. 1차 전환은 `source_data`(JSONB 수치)만 적재하고 화면은 수치 기반 표 렌더 + `data_asset_url` 빈 값 허용(empty state). Storage/CDN 채택은 P5에서 별도 결정. 실측 보강: 53번 46행 전부 `materials.charts`에 수치 데이터 보유 — `source_data` 적재원 확보됨 |

### 1.1 §3.3 파생 확정값 (식별자·코드 규칙)

- `question_type_code`(번호 파생 고정): 51=`writing_51_blank_completion` / 52=`writing_52_sentence_completion` / 53=`writing_53_data_description` / 54=`writing_54_opinion_essay`
- `question_type_name` 기본값(입력표에서 덮어쓰기 가능): 51=`빈칸 완성` / 52=`연결 표현` / 53=`자료 설명` / 54=`의견 서술` (admin 현행 유형 라벨 계승)
- `topic_source` 고정 문구: `메신저 전달 항목(국제 통용 한국어 표준 교육과정 적용 연구 참고)`
- `schema_version` 초기값: `1.0`

### 1.2 2026-07-13 환경 재시드 problem 별칭 확장

- D-4의 역사 `legacy_problem_id → question_id` source map은 불변 이력으로 유지합니다. 환경 재시드로 현재 `problems.id`가 달라져도 기존 행을 update/rebind하지 않습니다.
- 현재 문제 연결은 별도 `topik_writing_problem_aliases` edge로 추가하고, 읽기는 `topik_writing_problem_question_map` 통합 뷰를 사용합니다. 별칭 edge는 자체 `mapping_status`와 `hold_reason`을 가져 역사 hold 사유를 상속하거나 지우지 않습니다.
- 자동 연결은 동일 문항 번호, 정규화 prompt, answer key가 모두 일치하고 한 problem이 한 question에만 대응할 때만 허용합니다. 그 외 후보는 hold 후 수동 판정하며, 참조 데이터 coverage 100%와 fan-out/orphan 0을 배포 전 gate로 강제합니다.
- 이 확장은 topik_writing 도메인의 additive 스키마/ETL이며 v13 소유 `problems`의 DDL·DML과 학습 제출 원천을 변경하지 않습니다.

## 2. v13 경계 합의 기록

### 2.1 합의 근거 (경계의 SoT)

- v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql` (2026-06-09, 오너 결정): "v13 is the user-facing app … the real admin is the separate topik-ai repo. The NEW data flow for problems is: the ADMIN (topik-ai) fetches problems/questions from an EXTERNAL/third-party API (ALREADY REVIEW-COMPLETE), applies the exposure management point (public/private), and WRITES them to this Supabase DB; v13 only READS that data (read-only)." 같은 마이그레이션에서 v13 측 admin RPC 11종(구 `admin_update_problem` 포함)이 삭제됐다.
- 보존된 공유 자산(본 전환이 재사용): `public.admin_audit_logs` 테이블, `private.is_admin`/`is_content_admin`/`is_platform_admin` RLS 헬퍼, `profiles.app_role` enum — 전부 라이브 DB 존재 확인(2026-06-10).

### 2.2 네임스페이스·승인 경계

- topik-ai가 소유하는 오브젝트: `topik_writing_*` 접두 도메인 테이블·뷰(`topik_writing_question_source_map`, 환경별 `topik_writing_problem_aliases`, 통합 읽기 뷰 `topik_writing_problem_question_map` 포함)와 그에 속한 인덱스/RLS/시드, `admin_*` 접두 신규 RPC. 기존 v13 테이블(`problems` 포함)에는 **DDL 변경 0건** 원칙(P1-4 무변경 diff로 증명).
- 적용 절차: 마이그레이션 작성 → 오너 승인(v13 오너 = admin 오너 동일인 — 단일 승인으로 충족) → 프로덕션 적용 → §5.4 스모크/diff 게이트. 브랜치/스테이징 DB가 없으므로(실측) 스테이징 검증은 "신규 오브젝트만 추가하는 additive 마이그레이션 + down 스크립트 + 적용 직후 무변경 diff"로 대체한다.

### 2.3 `problems` 일몰(sunset) 조건과 전환기 SoT 우선순위

1. P3 컷오버 전: `problems` = admin 문항 읽기 경로(레거시 원천). ※ 2026-06-11 §0으로 "검수 SoT" 위상은 소멸 — 검수 개념 자체가 admin에서 제거됐다.
2. P3 컷오버 시: freeze 윈도 → ETL 델타 재적재 → 발산 0건 대사 → 코드 전환. 이후 `problems`는 admin 기준 **read-only 레거시**로 동결(신규 admin write 금지, 구 어댑터는 플래그 봉인으로 P4 종료까지 보존 — 롤백 경로).
3. 컷오버 후: 신규 4테이블 = admin 문항·운영 SoT(수신·태그·노출). v13 사용자 기능이 `problems`를 계속 읽는 동안 `problems` 행 삭제/아카이브는 금지.
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
