# 메타데이터·태그 스키마 전환 — 페이즈 게이트 증적 로그

실행 계획안(`docs/메타데이터-태그-스키마-전환-실행계획안.md`) §12.3 채점표의 항목별 증적을 페이즈 단위로 누적 기록한다. 쿼리는 별도 표기가 없으면 Supabase Management API(`/v1/projects/fglggyfvzjdsbyckinqa/database/query`) 경유 실행이며, 실행 도구는 `scripts/db/run-sql.mjs`다.

---

## P0 증적 (2026-06-10)

### P0-1 결정 13건 확정

- 확정본: `docs/architecture/metadata-tag-schema-transition-decision-record.md` §1 (D-1~D-13, 미정 항목 0건).

### P0-2 v13 경계 합의

- 합의 SoT: v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql` 헤더(2026-06-09 오너 결정) — admin(topik-ai)이 문제 데이터 관리 주체, v13은 read-only. 동 마이그레이션이 구 admin RPC 11종 drop.
- 기록 위치: 결정 기록 §2 + `docs/architecture/admin-data-source-transition.md` §10.4 갱신.

### D-9 실재 여부 쿼리 (2026-06-10 실행)

```sql
select question_no, review_status, count(*) from problems group by 1,2 order by 1,2;
```

| question_no | review_status | count |
| --- | --- | --- |
| 51 | approved | 90 |
| 51 | pending | 1 |
| 52 | approved | 5 |
| 52 | pending | 72 |
| 53 | approved | 46 |
| 53 | pending | 17 |
| 54 | approved | 81 |
| 54 | pending | 158 |
| (null) | approved | 1 (51~54 비대상) |

### D-9 보강 — source/노출 신호 분포 (2026-06-10 실행)

```sql
select source, review_status, publish_status, visibility, count(*) from problems
 where question_no in (51,52,53,54) group by 1,2,3,4 order by 1,2;
```

| source | review_status | publish_status | visibility | count |
| --- | --- | --- | --- | --- |
| curated | approved | published | public | 222 |
| curated | pending | draft | private | 248 |

- 51~54 전수가 `curated`(콘텐츠 파이프라인 산출)로, 사용자 생성(`ai_generated`) 행은 0건 — 전수 백필 범위가 건전함을 확인.
- approved 222행은 현재 `published/public`으로 v13 사용자 읽기 경로에 노출 중. 백필 시 `service_status`는 D-6 기본값 `internal_test`로 적재하되(신규 체계의 노출은 콘텐츠팀 승인 후 개방), 구 노출 신호는 `question_source_map.legacy_publish_status`/`legacy_visibility`로 보존한다 — v13 사용자 노출은 `problems` 경로가 유지되는 동안 영향 없음(결정 기록 §2.3-3).

### D-1 스테이징/브랜치 DB·호스트 확인 (2026-06-10 실행)

- `GET /v1/projects/fglggyfvzjdsbyckinqa/branches` → `[]` (브랜치 DB 없음).
- `GET /v1/projects` → `talkpik-prod`(eymlabowhfgtxbiqwxqh), `talkpik-dev`(fglggyfvzjdsbyckinqa) 2건. admin `.env.local`·v13 `.env.local` 모두 dev 프로젝트 참조 확인.

### D-8 관련 실측 — 구 admin RPC 부재·공유 자산 보존 확인 (2026-06-10 실행)

```sql
select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.proname like 'admin_%' or p.proname in ('get_admin_users','admin_set_user_status');
-- → 0행 (admin_update_problem 등 구 RPC는 라이브 DB에 없음)

select n.nspname, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='private';
-- → is_admin / is_content_admin / is_org_admin / is_platform_admin 등 보존 확인

select column_name from information_schema.columns
 where table_schema='public' and table_name='admin_audit_logs' order by ordinal_position;
-- → id, admin_user_id, action, target_table, target_id, diff, payload, created_at
```

### D-5/D-13 관련 실측 — materials 구조 (2026-06-10 실행)

- 51번 approved 90행 전부 `materials.blanks`(blank_1/blank_2: role·function·answer_type·canonical_answer·accepted_answers·accepted_synonyms), `materials.review.validation`, `materials.taxonomy`(speech_act·text_type·scenario_type·relation·category 등), `materials.source_context.resolved_text` 보유.
- 52번 5행: `blanks`+`scenario`+`taxonomy`, 53번 46행: `charts`(수치 원본)+`scenario`+`taxonomy`, 54번 81행: `scenario`+`taxonomy` 보유. 52~54 taxonomy에 `subject_domain`/`topic_type`/`question_type` 존재(17주제 축 아님 — D-3 재분류 필요 근거).

### P0-3 / P0-4 / P0-5

- freeze 가드 해제 5곳 + AGENTS.md §2 재조정: 본 커밋 diff가 증적(결정 기록 §3 대조).
- 원자 커밋 해시·`harness:check` 결과: 커밋 후 본 로그 P0 채점 절에 추기.

### P0 채점 (실행 계획안 §12.3 P0 채점표)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P0-1 | 결정 13건 확정값 기록 | PASS | 결정 기록 §1 (미정 0건) |
| P0-2 | v13 경계 합의(problems 일몰 조건 포함) | PASS | 결정 기록 §2 + transition §10.4 |
| P0-3 | freeze 가드 해제 5곳 동기화 | PASS | 본 커밋 diff (5곳 전부) |
| P0-4 | AGENTS.md §2 제외 범위 재조정 | PASS | 본 커밋 diff |
| P0-5 | 원자적 커밋 + harness:check | 잠정 | 본 파일을 포함한 원자 커밋 직후, 해시·harness 로그를 하단 "P0-5 확정 증적" 절에 추기해 PASS로 확정한다 |
| P0-6 | D-11 상류 요청·콘텐츠팀 발주 발신 | 권장-부분 | 요청서·발주서 작성 완료(`docs/requests/`), 오너 채널 발신 대기 — P2/P6 지연 리스크로 기록 |

- 종합 판정: **잠정 PASS** — P0-5 증적(커밋 해시+harness 로그)이 하단에 추기되는 시점에 PASS 확정. 확정 판정은 실행 계획안 §12.4 스코어카드에 기록한다.
- 채점자: 프로젝트 오너 위임 실행(2026-06-10 지시).
- 증적 형식 메모(적대적 검증 반영): freeze 가드 5곳은 같은 작업 사본에서 "미채택 신설 → 채택 해제"가 한 배치로 일어나 커밋 이력상 미채택 상태가 존재하지 않는다. 따라서 P0-3 증적은 "git diff의 전이"가 아니라 ① 본 커밋의 최종 상태(채택 확정 문구) + ② `logs/admin-doc-update-log.md`의 2026-06-10 거버넌스 동기화(미채택 신설)·P0 실행(해제) 2개 연속 기록으로 갈음한다. P0-2의 v13 합의 원문은 외부 repo 파일(`topik-project/v13/supabase/migrations/20260609130000_remove_v13_admin_island.sql`)이며 핵심 문구는 결정 기록 §2.1에 인용 보존했다.

### P0-5 확정 증적 (커밋 후 추기 — 2026-06-10)

- 원자 커밋: `346e56e` — "docs(transition): confirm Phase 0 decisions (D-1~D-13), release freeze guards, record v13 boundary agreement" (20 files, +1626/-13: 기준 문서 2건 + 실행계획안 + 결정 기록 + 증적 로그 + 요청서 2건 + SoT 9건 + AGENTS.md + README + 로그 2건 + run-sql.mjs).
- `npm run harness:check` 통과(커밋 직전 실행): mojibake 검출 0건 / doc crosslink 103개 문서 검증 통과 / route-doc coverage 52라우트-37 IA 문서 통과 / eslint 0건 / tsc 0건.
- 적대적 검증 2종(채점 반박·정합성 검토) 실행 결과 블로커 1건(미커밋 상태 자체)과 마이너 7건이 보고됐고, 마이너 지적 전건(스코어카드 미기록·§3.3 사전 포인터·90문항 잔존 표기·12건/13건 로그 오류·page-tables 로그 누락·lifecycle_status/admin_update_problem 잔존 모순 5곳·source 분포 미확인)을 커밋 전에 수정 반영했다.
- **P0-5 = PASS 확정. P0 종합 판정 = PASS** (필수 5건 PASS, 권장 P0-6 부분 — 종합 미산입, 후속 계획은 §12.4 메모).

---

## P1 증적 (2026-06-10)

### P1-1 마이그레이션 12파일 + down 스크립트, 적용

- 파일: `supabase/migrations/20260610200100~20260610201200` 12파일 + `supabase/migrations/down/` 동수. 내용: 주제 마스터(+17주제×세부 85행 시드), 태그 마스터(+19태그 시드), 문제 테이블 4종(공통 §7.1+E1+번호별 전용, topic FK·CHECK 제약), question_tags(활성 중복 차단 부분 유니크), source_map(E2+`legacy_publish_status/visibility` 보존), 추천 뷰(§7.9+E4, `security_invoker=true`), 인덱스, RLS 8오브젝트, 감사 RPC 3종.
- 스테이징: v13 측 스테이징/브랜치 DB 부재(실측)로 D-1 합의에 따라 "additive 마이그레이션 + down 스크립트 + 무변경 diff + RT-1"로 대체.
- 적용 로그(2026-06-10, `npm run db:migrate`): 12파일 전부 `ok`, 추적 테이블 `topik_writing_schema_migrations` 기록.

### P1-2 승인 → 프로덕션 적용

- 승인: v13 오너=admin 오너 동일인 — 오너 위임 실행(2026-06-10 지시) 단일 승인(결정 기록 §2.2). 적용 대상: talkpik-dev(`fglggyfvzjdsbyckinqa`).

### P1-3 프로덕션 스모크 — RLS 역할 매트릭스 + 뷰 anon 차단

- 도구: `scripts/db/p1-smoke.mjs` (53스텝 전부 PASS, 2026-06-10). 매트릭스 결과:

| 역할 | 문제 4테이블 | topic_master | tag_master | question_tags | source_map | 추천 뷰 |
| --- | --- | --- | --- | --- | --- | --- |
| anon | 0행 | 0행 | 0행 | 0행 | 0행 | **0행(차단 — security_invoker 네거티브 통과)** |
| 비admin(authenticated) | 0행 | 0행 | 0행 | 0행 | 0행 | 0행 |
| admin(content_admin) | 파일럿 각 1행 | 85행 | 19행 | 1행 | 4행 | 4행 |

- 쓰기 차단: 비admin 직접 INSERT → RLS 위반 오류, 비admin RPC → `forbidden: content_admin required`.

### P1-4 기존 테이블 무변경 diff

- `scripts/db/schema-snapshot.mjs`: 적용 전(테이블 24/함수 61/정책 55/뷰 0) → 적용 후(34/64/63/1), `--diff --exclude-own` 결과 **자기 네임스페이스 제외 차이 0건**.

### P1-5 RT-1 파일럿 적재 왕복

- 번호별 파일럿 1건씩(`topik-writing-{51..54}-9999`, `backfill_batch='pilot'`, `service_status='internal_test'`)을 service-role로 적재 → ① 번호별 테이블 직조회(필드 26~31개 일치) ② 추천 뷰(14필드 일치) ③ 태그 조인(`rec_first_entry`↔'첫 진입용') ④ admin RLS 경유 — 4경로 전부 입력과 필드별 diff 0건(JSONB는 키 정렬 정규화 비교). 검증 후 파일럿 행 정리(뷰 0행 확인 — P2 채번 오염 방지).
- RPC 왕복 보강: `admin_assign_question_tag` → `tag_assigned` 감사 행, `admin_update_topik_question`(workflow `in_progress`+메모+`__note`) → `review_status_changed` 감사 행 + `payload.review_note` 기록 + 재조회 반영 확인.

### P1-6 마스터 2종 시드 검증

```sql
select count(distinct topic_main), count(*) from topik_writing_topic_master;            -- 17 / 85
select count(*), count(*) filter (where tag_group='서비스_노출상태') from topik_writing_tag_master; -- 19 / 0
```

- 17주제 전수·세부 85행, 태그 19종(6그룹), '서비스_노출상태' 그룹 0건(D-6/E3 준수) 확인.

### P1-7 (권장) db 스크립트 + 절차 문서화

- `package.json`: `db:migrate`/`db:migrate:status`/`db:snapshot`/`db:sql` 추가. 절차는 `docs/architecture/admin-data-source-transition.md` §10.4에 기록(CLI 대신 Management API 사용 사유 포함).

### D-12 시드 계정

- e2e admin(`e2e-admin@topik-ai.test`, `app_role=content_admin`)·비admin 검증 계정 생성 — 자격증명은 `.env.local`(gitignored)에만 보관. `scripts/db/create-e2e-admin.mjs` 신설(프로필 승격은 보호 트리거로 인해 1회성 SQL로 수행).

### P1 채점 (실행 계획안 §12.3 P1 채점표)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P1-1 | 마이그레이션 12파일+down, 적용 | PASS | 본 절(스테이징 부재는 D-1 대체 검증) |
| P1-2 | 승인 → 프로덕션 적용 | PASS | 본 절 + 결정 기록 §2.2 |
| P1-3 | 스모크(8오브젝트+RLS 매트릭스+뷰 anon 차단) | PASS | 매트릭스 표(53스텝 ALL PASS) |
| P1-4 | 기존 테이블 무변경 diff | PASS | diff 0건 |
| P1-5 | RT-1 파일럿 적재 왕복 | PASS | 4경로 필드별 일치 + 정리 확인 |
| P1-6 | 마스터 2종 시드 검증 | PASS | 시드 대사 쿼리 결과 |
| P1-7 | db 스크립트+절차 문서화 | PASS(권장) | package.json + transition §10.4 |

- 종합 판정: **PASS** (필수 6건 전부 PASS + 권장 1건 PASS).
- 채점자: 프로젝트 오너 위임 실행(2026-06-10 지시). 커밋 해시는 §12.4 스코어카드에 기록.

---

## P2 증적 (2026-06-10)

> 선행 산출물(1~3차 세션) + 표적 감사·본 적재·idempotency·델타 리허설(4차 세션, 2026-06-10). 채점표는 본 절 말미.

### 완료된 선행 산출물

- **추출(§6.2-1)**: `npm run etl:extract` — `problems` 51~54 전수 470행 덤프(.omx/evidence/etl/problems-dump.json). 분포 실측이 D-9 확정치와 일치: 51 90+1 / 52 5+72 / 53 46+17 / 54 81+158 (approved+pending), 전수 `source='curated'`.
- **구조 실측**: 재조립 가능성 사전 검증 — 51: 90/90(blanks→resolved_text), 52: 76/76(검수 메모 따옴표 스팬 파싱→model_answer 재조립). 53: 62/62 chart_a+chart_b·글자수·과제 파싱. 54: 238/238 번호 질문·글자수 파싱(단, 154행은 scenario 축약형 — 입력표가 essay_type 등 공급). 적재 보류 확정 대상: `audit_seed` 예시 4행(materials/answer_key 부재).
- **D-3 재분류 입력표(draft)**: `data/etl/reclassification-input.json` 466행 — 분류 에이전트 24배치(본문 기반, 기계 변환 금지) + 17×85 사전·번호별 enum 전수 검증 위반 0건. 54번 1행은 출력 누락분 수동 보완. ~~번호별 표본 적대 감사 패스는 세션 리밋으로 미수행~~ → **3차 세션(2026-06-10)에서 수행 완료(아래 절)**.
- **ETL 4스크립트(§6.2)**: `scripts/etl/` extract/transform/load/verify + 순수 코어 `lib/transform-core.mjs`(D-2 사전·D-4 채번·빌더·NOT NULL 보류 판정·재조립 검증). 드라이런(빈 입력표)으로 보류 경로·채번 결정성 확인.
- **P2-7(권장) 선행**: vitest 도입 + `tests/unit/transform-core.test.mjs` 43개 전부 PASS(`npm run test:unit`).
- **P2-6 준비**: 델타 리허설 시뮬레이터 `.omx/evidence/etl/make-delta-sim.mjs`(problems 무변경 — 덤프 사본 변형 방식) 작성.

### D-3 입력표 표본 적대 감사 패스 (2026-06-10 3차 세션, 수행 완료)

- 방식: 번호별 15행×4=60행 결정적 표본(id 정렬+균등 간격, 54번 수동 보완 행 강제 포함) → 워크플로 `wf_d7d3d7f6-753`(에이전트 48개) — 적대 감사관 4인(본문 원문 대조) + 플래그별 독립 판정관 2인 재판정.
- 결과: 플래그 22건(wrong 5·questionable 17) → **교체 20건 + topic 스왑 후속 rationale 재작성 2건 반영, 유지 2건**. 판정 규칙: 2인 일치=채택/유지, 분열 2건·문구차 1건=주 루프 판정(근거 영구 기록). 인용 조작·환각 0건(rationale 무근거 단정 3건은 교정).
- 주요 정정 유형: q52 cf/ref 중복·스왑 기입(6행), topic 주·보조 역전(2행 — `7a6857b3` 도서관/`c7d836fa` 정전기), q54 essay_type 경계 정렬(3행), q53 난이도 자체모순(1행), rationale 본문 외 인용·단정(3행), secondary 누락(1행).
- 반영 후 전 행 재검증(사전 쌍·enum·화살표·주보조 중복) 위반 0건, `npm run test:unit` 43개 PASS 유지. topic 분포 변화: 일상생활 67→66, 기후 1→0, 주거와 환경 42→43, 전문 분야 15→16.
- 증적(비추적, `.omx/evidence/etl/audit/`): 표본 `sample-{51..54}.json`, 워크플로 전체 출력 `audit-workflow-output.txt`, 판정·근거 전문 `audit-decisions.json`, 반영 도구 `apply-audit-corrections.mjs`. 커밋 산출물은 입력표 본체(meta.status에 감사 완료 기록).
- 후속 권고(채점 비차단): q52 cf=ref 동일값 잔여 22행 표적 감사(표본 내 중복 4행이 4/4 오류) + 원천 title/hints 오염 3행 gap-register 기록 — 핸드오프 §2.3·§3-1. → **두 건 모두 4차 세션(2026-06-10)에서 이행 완료**(표적 감사: 아래 절, gap-register §4.7 기록).

### D-3 입력표 q52 cf=ref 표적 적대 감사 (2026-06-10 4차 세션, 수행 완료)

- 대상: 표본 감사 후속 권고 이행 — q52에서 `connection_function`=`required_expression_function` 동일값 잔여 22행 전수(표본 보정 4행 제외 모집단).
- 방식: 표본 `.omx/evidence/etl/audit/sample-52-cfref.json`(22행 + 배치 원문 prompt/hints + enum + 필드 규약 동봉, 결정적 추출) → 워크플로 `wf_7ccb36f0-542`(에이전트 38개) — 적대 감사관 4인(행 분담, ㄱ/ㄴ 스팬 본문 대조) + 플래그별 독립 판정관 2인 재판정. 판정 규칙은 표본 감사와 동일(2인 일치 교체=채택, 2인 일치 유지=유지, 분열=주 루프 판정·근거 영구 기록).
- 결과: 플래그 17건 → **교체 17건 반영**(2인 일치 16건 + 분열 1건 주 루프 판정 — `352b7c74` '-려면' 스팬의 조건/목적 분열을 라운드 내 일관성 원칙으로 '조건 제시' 채택). 무플래그 5행(`1828acb9`·`29066193`·`2f989b36`·`a5351852`·`ac7cc645`)은 ㄱ·ㄴ 기능이 실제로 같은 **정당 중복**으로 확인 — 표본 감사의 "동일값 행 자동 재검수" 가설이 17/22 오류·5/22 정당으로 실측됨.
- 교체 내역: ref 측 15건(결과 제시 6·조건 제시 4·목적/방법/순서 연결/이유 설명/추가 설명 각 1) + cf 측 2건(`1a40115b`·`6b0c1b71` 조건 제시) — 전형 패턴(한 빈칸 기능의 두 필드 중복 기입) 17/17 재현, 인용 조작·환각 0건.
- 반영 후: 전 행 재검증(17×85 사전 쌍·번호별 enum·화살표 체인·주보조 중복) 위반 0건, `npm run test:unit` 43개 PASS, 입력표 BOM 없음(Node 경유 기록). 반영 후 cf=ref 잔여 5행 = 정당 중복 5행과 정확히 일치. `meta.status`에 표적 감사 완료 기록.
- 증적(비추적, `.omx/evidence/etl/audit/`): `sample-52-cfref.json`, `cfref-audit-workflow-output.txt`(워크플로 전체 출력), `audit-decisions-cfref.json`(판정·근거 전문), 도구 `make-cfref-sample.mjs`/`apply-cfref-corrections.mjs`.

### 본 적재 (§6.2 transform→load→verify, 2026-06-10 4차 세션)

- transform: input 470 = loaded 466 + held 4, per table 51:90/52:76/53:62/54:238, source_map 선조회 0건(전량 신규 채번). 보류 4행은 전건 `audit_seed` 예시 행(재분류 입력표 없음 + 필수 컬럼 역분해 실패 — D-5 예정 경로), 사유 포함 목록 `transform-out/holds.json`.
- load 1회차(`.omx/evidence/etl/load-report-1781089118118.json`): upsert 466 + source_map 470. 테이블별 sha256(canonical 전 행): 51 `6136f8a8…` / 52 `fcdeb996…` / 53 `22f1f5e1…` / 54 `7caa54bb…` / source_map `b5a0e4f4…`.
- 검증 도구 수정 1건(첫 실전 실행에서 발견): `verify-backfill.mjs`의 selectAll이 정렬 컬럼을 `question_id`로 고정해 `topic_master`(축 검증) 조회가 실패 → 정렬 컬럼 매개변수화. 검증 로직 자체는 무변경.
- verify(`verify-report-1781089167485.json`): **8체크 ALL PASS** — 재조립 51(90행)/52(76행) 전건 일치, 보존(answer_key 원본+51 정규화) 466행 동치, 수량 470=466+4, 축 topic_master 85쌍 전수 포함, RT-2 재조회 왕복 466행 필드별 diff 0건, service_status 전 행 `internal_test`(D-6), source_map 전수 대사(매핑 470=덤프, 보류 hold_reason 4건, legacy 노출 신호 보존).

### P2-1 idempotency (2026-06-10 4차 세션)

- load 2회차(`load-report-1781089178877.json`): 전 테이블 rows·sha256이 1회차와 동일(**5/5 IDENTICAL** — 51/52/53/54/source_map) + verify 재실행(`verify-report-1781089199267.json`) 8체크 ALL PASS. 2회분 리포트 보존.

### P2-6 델타 재적재 리허설 (2026-06-10 4차 세션)

- 원칙 준수: `problems`(검수 SoT)에는 쓰기 0건 — 덤프 사본 변형 방식(`make-delta-sim.mjs`). 시뮬레이션 2건: 52 `807c0fe3` pending→approved(+publish/visibility/검수 메모/updated_at 전진), 54 `096d5849` 검수 메모 수정(+updated_at 전진).
- 델타 적용: transform(`--batch p2-delta-rehearsal`, 기존 매핑 470건 재사용 — 채번 안정 확인) → load(`load-report-delta.json`): 51·53 해시 불변, 52·54·source_map만 변화(변경 국소성) → verify(`verify-report-delta.json`, 델타 덤프 기준) **ALL PASS** — 델타 따라잡기 RT-2 diff 0건.
- 원상 복원: 원본 덤프로 transform→load(`load-report-restore.json`) → 해시 5종이 본 적재 1회차와 전부 동일, verify(`verify-report-restore.json`) ALL PASS — **원상 수렴 발산 0건 대사**.

### P2 채점 (실행 계획안 §12.3 P2 채점표)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P2-1 | ETL 4스크립트 동작 + idempotency(2회 연속 diff 0건) | PASS | load 리포트 2회분 해시 5/5 동일 + verify 재실행 ALL PASS(본 절) |
| P2-2 | 검증 리포트 5종 + RT-2 재조회 왕복 | PASS | verify 리포트 4회분 ALL PASS(본 적재·2회차·델타·복원) |
| P2-3 | 적재 보류 목록 산출 + 재입력 발주 | PASS | `holds.json` 4건(사유 포함) + source_map hold_reason. 전건 `audit_seed` 예시 행(실문항 아님, D-5 예정 경로)으로 **재입력 발주 대상 0건 판정** — 실문항 보류 발생 시 발주 절차는 발주서 양식 재사용 |
| P2-4 | source_map 전수 기록(legacy 매핑) | PASS | 매핑 470 = 덤프 470, 적재 466 + 보류 4 대사, legacy 노출 신호(publish/visibility) 보존 — verify 체크 포함 |
| P2-5 | 콘텐츠팀 샘플 승인(10문항) | **CONDITIONAL** | 발주서(`docs/requests/content-team-order-2026-06-10.md`) **미발신**. 해소 조건: 오너 채널 발신 → 10문항 샘플 승인 회신 → 재채점. 대기 중 전 행 `service_status='internal_test'`로 사용자 노출 차단 유지(D-6, 발주서 일정 연동 조항과 일치) |
| P2-6 | 델타 재적재 리허설 1회 | PASS | 리허설 로그(따라잡기 ALL PASS + 원상 수렴 발산 0건, 본 절) |
| P2-7 | vitest 단위 테스트(매핑/역분해 순수 함수) | PASS(권장) | 43개 PASS(표적 감사 반영 후 재실행 포함) |

- 종합 판정: **CONDITIONAL** (FAIL 0건, 필수 P2-5만 외부 승인 대기 — §12.3 판정 규칙). 해소 조건·담당: 오너 채널 발주서 발신(프로젝트 오너) → 콘텐츠팀 10문항 승인 회신 → P2-5 재채점 PASS 전환. CONDITIONAL 동안 P3 컷오버 배포 착수 불가(코드 선행 개발은 병행 허용 — §7).
- 채점자: 프로젝트 오너 위임 실행(2026-06-10 지시). 작업 커밋 `ab0aa98` — 스코어카드(§12.4) P2 행에 채점 기록(2026-06-10 채점 커밋).

### P2 재채점 (2026-06-11 — 인바운드 모델 전환에 따른 P2-5 게이트 폐기)

- 근거: 2026-06-11 오너 결정으로 인바운드 모델 전환 확정(결정 기록 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0). 분류 메타데이터는 외부(공급) API가 완성 상태로 공급하므로 **P2-5(콘텐츠팀 샘플 승인) 게이트는 트랙 소멸로 폐기**(발주서는 미발신 상태로 종결 — `docs/requests/content-team-order-2026-06-10.md` 폐기 배너).
- 재채점: 필수 P2-1~P2-4·P2-6 PASS(원 채점 유지) + P2-5 폐기(채점 항목에서 제외) + 권장 P2-7 PASS → FAIL 0건·대기 항목 0건 — **종합 PASS 전환**. 백필 466행은 인터림 초기 코퍼스로 유지(전 행 `service_status='internal_test'` — 노출 차단은 P4 관리 포인트 개방 전까지 불변).
- 부수 기록: 같은 날 오전의 D-3 분류 소유권 판정(옵션 3)·P2-5 샘플 시트(`docs/requests/content-team-p2-5-sample-2026-06-11.md`)도 동일 전환으로 폐기(역사 보존, 10문항 표본은 RT-3 대사 표본으로 재사용됨). 검수 개념 전면 삭제에 따른 검수 4컬럼 제거·검수 표면 제거는 재정의 P3 범위(실행계획안 §7 개정).
- 채점자: 프로젝트 오너 위임 실행(2026-06-11 인바운드 전환 지시). 스코어카드(§12.4) P2 행 갱신 동반.

---

## P3 진행 메모 (2026-06-11, 중간 기록 — 채점 아님)

> (작성 시점 2026-06-11 5차 세션 기준) P3는 **미완료·미채점**이다. 본 절은 §12.3 규칙이 허용하는 **코드 선행 개발(가역)** 의 중간 증적만 기록한다. **컷오버 배포는 미실행 — 기본 데이터 소스는 legacy(`problems`) 유지**, P2 PASS 전환 후에만 플립한다. ※ 이후 같은 날 P2 재채점 PASS → 재정의 P3 실행(컷오버 수행, `202f905`) → 문서 동기화(`77d01bd`) → 하단 P3 채점 절로 이어짐 — 본 주의문은 작성 시점 기록.

### 선행 개발 완료 산출물 (§7.2 변경 파일 13종 + 신설 4종)

- **컷오버 스위치**: `src/features/assessment/api/question-bank-data-source.ts`(신설) — `legacy`(기본) / `topik_writing`(env `VITE_QUESTION_BANK_SOURCE`) / `mock`(Supabase 미구성, D-12). 컷오버 = 기본값 플립 1곳, 롤백 = 동일 스위치 역플립(§12.2 — 구 어댑터는 P4 종료까지 보존).
- **모델 재정의**: `AssessmentQuestionSummary`(추천 뷰 18컬럼 1:1)/`AssessmentQuestionDetail`(번호별 테이블) 분리, 상태는 §3.3 ASCII 코드 저장값 + 한국어 라벨 사전(`approved`=검수 완료/`needs_revision`=검수 필요/`on_hold`=사용 보류, `service_status` 3값), 번호별 content 4변형을 실컬럼으로 재구성(51 빈칸 2종 메타, 52 연결·요구 기능/단서/대표정답, 53 자료·비교·source_data, 54 글쓰기 유형·질문·채점 중점), sentinel 전용 9필드(sourceType/generationBatchId/promptVersion/validationStatus/usageCount/linkedExamCount/coreMeaning/keyIssue/revisionHistory) 제거.
- **신규 스키마 어댑터**: 뷰 목록 1회 조회 + `question_id` 라우팅 번호별 상세 + `topic_master`/활성 태그 로더 + 검수 쓰기 `admin_update_topik_question`(액션 사전 + `__note` 감사 payload, `content_team_memo` 실영속 — D-7 가짜 저장 해소). legacy 어댑터는 신규 모델로 매핑하도록 재작성(정직 sentinel, 봉인 롤백 경로).
- **D-12 모크 모드 결선**: 인메모리 픽스처 4문항(번호별 1건) 어댑터 + `npm run test:e2e:mock` 스크립트 — Supabase 미구성 실행에서 목록·상세·검수 write 왕복이 화면 수준으로 동작.
- **화면**: 검수 목록(주제 종합/세부 2축·상황 요약·검수 3값 카드), 문항 관리(`service_status` 축 카드·노출 상태 컬럼·태그 수·P4 대기 조치 3종 스캐폴딩), 검수 상세(번호별 실메타 Descriptions + 메모 저장 버튼 + 검수 완료/사용 보류/검수 필요 액션), 툴바(topic_master 기반 주제 2단 셀렉트 + 난이도 1~6), `status-column-title` 사전 갱신(검수 3값+노출 3값 추가, 구 운영 4값 제거).

### 검증 (2026-06-11)

- `lint`/`typecheck`/`build` PASS, `test:unit` 43개 PASS.
- e2e 재작성 5/5 PASS(`test:e2e:mock`): 목록 신규 축 렌더, 번호별 실메타 표시, **검수 메모 저장→검수 완료 write 흐름 화면 왕복**, manage P4 대기 안내, 감사 로그 역이동 차단.
- **실DB 읽기 프로브**(비공식 — RT-3 사전 확인, 쓰기 0건): `VITE_QUESTION_BANK_SOURCE=topik_writing` + D-12 시드 admin 로그인으로 목록 466문항(뷰)·상세 4개 번호(번호별 테이블 라우팅)·manage 카드 "내부 테스트 466 / 노출 가능 0 / 노출 제외 0" 표시 확인 — P2 백필 상태와 정확히 일치. 보류 행(`*-0001` audit_seed)은 상세 조회 시 오류 표면화(정상 — 테이블 미적재). 도구: `.omx/evidence/debug-topik-writing-read.mjs`.

### RT-3 읽기 전용 필드 대사 (2026-06-11 6차 세션 — 선행, 미채점)

- 범위: P2-5 10문항 샘플(번호 51:2/52:3/53:2/54:3 전수, topic_main 10종 distinct). **화면 데이터 소스를 DB 직조회**(dev 서버 불필요) — 목록 소스 = 추천 뷰(`topik_writing_question_recommendation_view`), 상세 소스 = 번호별 테이블 — 후 **저작 입력표(`reclassification-input.json`)·원문 덤프와 필드별 대사**.
- 결과: **240필드 ALL PASS(diff 0)** — 문항당 뷰 8필드(topic_main/topic_detail/difficulty_level/target_level/question_type_name/review_status/review_workflow_status/service_status) + 테이블 12필드(+secondary_topic_main/detail·prompt_text·item_number) + 목록↔상세 정합 4필드. `review_status`/`review_workflow_status`는 D-9 이관 사전(approved→approved/done, pending→needs_revision/not_started) 일치, 전 행 `service_status='internal_test'`(D-6), `prompt_text`=원문 `prompt` 일치. **쓰기 0건**. 도구 `.omx/evidence/rt3-field-reconcile.mjs`(읽기 전용).
- 의의: 신규 스키마 읽기 경로(뷰·번호별 테이블)가 저작 값을 **무손실·충실히 표현**함을 확인 — RT-2(transform 산출물↔DB)에 더해 **표시 소스↔저작 입력**까지 대사. presenter의 ASCII→한국어 라벨 매핑은 vitest(43)+세션5 브라우저 프로브로 별도 커버. **정식 RT-3 채점은 P3 컷오버(P2 PASS 후) 시점** — 본 절은 선행 증적.

### 재정의 P3 실행 (2026-06-11 — 인바운드 모델, 커밋 `202f905`. 미채점)

- **§7.1 컷오버 1~4단계 수행**: ① freeze(레거시 쓰기는 이미 불능 — 절차 선언) ② 델타 재적재: `etl:extract`(신규 덤프 470행, 분포 불변) → `etl:transform` → `etl:load` — **테이블 해시 5종이 P2 본 적재와 전부 동일(드리프트 0)** ③ `etl:verify` 8체크 ALL PASS(`verify-report-1781153139018.json`) ④ **데이터 소스 스위치 기본값 'topik_writing' 플립**(`question-bank-data-source.ts` — 롤백은 env `VITE_QUESTION_BANK_SOURCE=legacy`, 구 어댑터 봉인 보존).
- **검수 표면 코드 제거 완료**: 타입·스키마 사전·presenter·URL 파라미터(`reviewStatus`)·facade(검수 쓰기/메모 제거)·신규 어댑터(16컬럼 뷰 select + `setTopikWritingServiceStatus` P4 진입점)·legacy 어댑터(읽기 전용화)·mock·목록 페이지("TOPIK 쓰기 문항 목록" 조회 전용, 번호별 카드, 노출 상태 컬럼)·상세 페이지(파일 개명 `assessment-question-detail-page.tsx`, 검수 메모/액션 삭제)·manage(검수 컬럼/문구 제거)·라우트 개명(`/review/:questionId`→`/:questionId`)·라벨/브레드크럼/상태 사전·감사 라벨(신 액션 + 구 검수 코드 "(구)" 역사 렌더)·CSS 클래스 개명.
- **0013 마이그레이션 작성**(`20260611190100_topik_writing_drop_review_columns.sql` + down): 검수 4컬럼 drop(4테이블) + 뷰 16컬럼 재생성 + RPC 화이트리스트 `service_status` 단일 축소(가드 ① 삭제, payload.note). **적용 미실행 — `SUPABASE_ACCESS_TOKEN` 부재(이번 세션 미보유)**. 신규 코드는 검수 컬럼을 select하지 않아 적용 전 DB와도 호환(적용 순서 안전).
- **ETL 갱신**: `transform-core.mjs` 검수 필드 기록 중지(`mapReviewStatus` 제거, REQUIRED_COLUMNS 정리).
- **검증**: typecheck·lint·build PASS, vitest 39/39, e2e 5/5(`test:e2e:mock` — 조회 전용 어서션 + 검수 표면 부재 네거티브 + 구 라우트 비렌더), **RT-3 재실행(갱신 도구) 190필드 ALL PASS**(검수 필드 제외 기준 — 뷰 6+테이블 10+정합 3 × 10문항), harness:check 전 항목, src 검수 잔존 = 폐기 선언 주석만(표시 문자열 0건).

### 잔여 (P3 채점 전 필수 — P2 PASS 전환 후) ※ 해소됨 — 하단 채점 절 참조

- (작성 시점 기록) 컷오버 절차 실행(§7.1: freeze 윈도 → 델타 재적재 → 발산 0건 대사 → 기본 소스 플립 배포 → problems read-only 동결), RT-3 정식 채점(읽기 전용 선행 대사 완료 — 위 절; 컷오버 후 배포본 기준 재확인 + 권장 시 브라우저 렌더 경로 포함), RT-4 검수 쓰기 왕복(화면→DB→재반영→감사 로그 역추적), 문서 동기화(§11 P3 행: data contract §9.6 / page-tables #19·#19-1 / 양 page-IA / page-sync §5-7), P3 채점표(§12.3) 채점. → 컷오버 1~4·RT-3·문서 동기화 수행 완료(`202f905`·`77d01bd`). RT-4(검수 쓰기 왕복)는 검수 삭제로 폐기 — §12.0 개정의 RT-4는 P4 관리 쓰기 왕복으로 재정의됨. problems read-only 동결 선언(§7.1-6)은 채점과 별개 후속(공지·기록).

### 문서 동기화 — §11 P3 행 (2026-06-11 7차 세션, 커밋 `77d01bd`)

- "현행 코드: 검수 표면 — 제거 예정" 마커를 전부 "제거 완료(`202f905`)"로 갱신: 양 page-IA(§2/§4/§5/§6/§8/§9/§11/§12)·page-sync(§2~§6, §9, §10, §12)·page-tables #19/#19-1(컬럼·필터·카드·액션 행 신규 화면 사실로 재작성)·data-usage-map·action-log·data-source-transition(§10.2 역사 동결 선언·§10.3)·gap-register(신규 갭 ② 코드 측 해소·§4.7 대상 파일 현행화)·admin-overview(Assessment 라우트 표).
- **data-contract §9.6은 §11 P3 행 의무("재작성")에 따라 신규 스키마(추천 뷰 + 번호별 4테이블 + 마스터 + 태그 집계, facade 기본 `topik_writing`) 기준으로 재작성** — 구 `problems` 계약은 git 이력의 역사 기록으로 위임. 편차 E1/E4·§12.3에 0013 작성 완료·적용 대기 상태 병기.
- 구분 원칙: 화면·코드 표면 = 제거 완료(`202f905`) / DB 물리 컬럼·RPC 검수 경로 = 마이그레이션 `0013` 작성 완료·적용 대기. 기록: `logs/admin-doc-update-log.md` + `docs/specs/admin-page-ia-change-log.md`. `harness:check` 전 항목 통과.

### P3 채점 (실행 계획안 §12.3 P3 채점표 — 재정의. 2026-06-11 7차 세션)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P3-1 | 컷오버 절차 증적(freeze → 델타 재적재 → 발산 0건 대사) | PASS | 재정의 P3 실행 절(본 로그): freeze 선언 + 델타 재적재 해시 5종 P2 본 적재와 전부 동일(드리프트 0) + `etl:verify` 8체크 ALL PASS(`verify-report-1781153139018.json`) — 커밋 `202f905` |
| P3-2 | 읽기 컷오버(데이터 소스 스위치 플립) + 검수 표면 제거 | PASS | 스위치 기본값 `topik_writing` 플립(`question-bank-data-source.ts`) + 검수 표면 전 계층 제거(타입~CSS, 라우트 개명) 코드 diff `202f905` + e2e 5/5(조회 전용 + 검수 부재 네거티브) + src 검수 잔존 = 폐기 선언 주석·감사 "(구)" 역사 라벨만 |
| P3-3 | RT-3 실데이터 화면 표시 대사(번호별 ≥1건, 권장 10건) | PASS | 선행 대사 240필드 ALL PASS + 컷오버 후 갱신 도구(`rt3-field-reconcile.mjs` — 검수 필드 제외판) 재실행 **190필드 ALL PASS**(10문항: 뷰 6 + 테이블 10 + 정합 3, 실DB 읽기 전용) |
| P3-4 | 검수 4컬럼 제거 마이그레이션(뷰 재생성·ETL 갱신 포함) + 잔존 0건 검증 | **CONDITIONAL** | 마이그레이션 `0013`(`20260611190100_topik_writing_drop_review_columns.sql` + down) 작성 완료, ETL transform 검수 기록 중지, 화면·코드 잔존 0건(grep). **단 DB 적용 미실행 — `SUPABASE_ACCESS_TOKEN` 부재**(service-role 키로는 DDL 불가). 해소 조건: 토큰 확보 → `npm run db:migrate` → `npm run db:snapshot`(검수 4컬럼 부재 + 뷰 16컬럼 확인) + RT-3 재확인 → 재채점. 담당: 프로젝트 오너(토큰 제공) + 다음 세션(적용·검증). 기한: P4 착수 전 |
| P3-5 | 구 `problems` 어댑터 플래그 봉인 보존(롤백 경로) | PASS | env `VITE_QUESTION_BANK_SOURCE=legacy` 봉인(읽기 전용 어댑터 — 검수/쓰기 경로 제거됨), P4 종료까지 보존(§12.2) — 코드 확인 `202f905` |
| P3-6 | `build` + 재작성 e2e + `harness:check` 통과 | PASS | typecheck·lint·build PASS, vitest 39/39, e2e 5/5(`test:e2e:mock`), harness:check — `202f905` 세션 + 문서 동기화 후 재실행(7차 세션) 전부 통과 |
| P3-7 | 문서 동기화(§11 P3 행: data-contract §9.6 / page-tables / 양 IA / page-sync) | PASS | 본 로그 "문서 동기화" 절 — §9.6 신규 스키마 기준 재작성 포함, 커밋 `77d01bd` + 로그 2종 기록 |

- 종합 판정: **CONDITIONAL** (FAIL 0건 — 필수 P3-4만 토큰 부재로 마이그레이션 적용 대기, §12.3 판정 규칙). **P4 착수 불가.** 해소 조건·담당·기한: P3-4 행 참조 — 적용·검증 후 재채점으로 PASS 전환해야 P4(관리 포인트 개방) 진행.
- 신규 코드는 검수 컬럼을 select하지 않아 0013 적용 전 DB와도 호환(운영 리스크 없음 — 잔여는 순수 DB 정리·증적 확보).
- 채점자: 프로젝트 오너 위임 실행(2026-06-11 지시). 스코어카드(§12.4) P3 행 기록 동반.

### P3 재채점 (2026-06-11 — P3-4 해소: 0013 마이그레이션 적용. 종합 **PASS** 전환)

- **해소 경위**: 오너가 `SUPABASE_ACCESS_TOKEN`(sbp_…)을 `.env.local`에 제공 → `npm run db:migrate:status`(12 applied + 0013 pending 확인) → **`npm run db:migrate` 적용 성공**(`20260611190100_topik_writing_drop_review_columns.sql`).
- **잔존 0건 검증 (P3-4 후반부)**:
  - 스키마 스냅샷(`npm run db:snapshot` → `.omx/evidence/schema-snapshot-post-0013.json`, 검증기 `check-post-0013-snapshot.mjs`): **4테이블 검수 컬럼 존재 0건**(51: 53컬럼/52: 50/53: 52/54: 49 — review_status·review_workflow_status·review_passed·validation_result 전무), **추천 뷰 정확히 16컬럼**(review 컬럼 없음) — RESULT: PASS.
  - RPC 원문 대사(`pg_get_functiondef` → `.omx/evidence/post-0013-rpc-defs.json`): `admin_update_topik_question`/`admin_assign_question_tag`/`admin_remove_question_tag` **검수 참조 0건**(화이트리스트 `service_status` 단일·가드 ① 삭제 확정).
- **RT-3 재확인**: `rt3-field-reconcile.mjs` 재실행 — **190필드 ALL PASS**(10문항, 뷰 6+테이블 10+정합 3, 쓰기 0건). 적용 후 DB 기준 무손실 재확인.
- **ETL 정합(선택 검증)**: `etl:transform`(로컬 재생성 — 갱신 transform, 검수 필드 미기록) → `etl:verify` **8체크 ALL PASS**(재조립 51/52·보존 466행·수량 470=466+4·축·**RT-2 재조회 466행 diff 0건**·internal_test 전 행·source_map 전수 — `verify-report-1781158071651.json`). ※ 첫 verify는 RT-2 1건 FAIL이었으나 원인은 0013 이전 델타 재적재 시점의 payload 산출물(검수 필드 포함)과의 비교 — transform 재생성으로 해소(데이터 이상 아님, 보류 4행 = 기지 `audit_seed` 예시 행). `etl:load`는 불필요한 프로덕션 쓰기라 생략(RT-2가 동일 보장 제공).
- **재채점**: P3-4 → **PASS**(마이그레이션 적용 + 뷰 재생성 + ETL 갱신 + 잔존 0건 검증 — 증적 위 항목). P3-1·2·3·5·6·7 PASS 유지 → FAIL 0건·대기 0건 — **종합 PASS 전환. P4(관리 포인트 개방) 착수 가능.**
- 롤백 경로 비고: down 스크립트 존재(`supabase/migrations/down/…drop_review_columns.sql` — 컬럼 구조 복원만, 값 복원 불가. 값 원본은 source_map·legacy `problems`에 보존).
- 채점자: 프로젝트 오너 위임 실행(2026-06-11 지시 — 토큰 제공으로 해소 조건 이행). 스코어카드(§12.4) P3 행 PASS 갱신 동반.

---

## problems read-only 동결 선언 (2026-06-11 — §7.1-6 이행, 채점 외 기록)

- **선언**: P3 PASS(0013 적용 포함)에 따라 v13 `problems`를 admin 기준 **read-only 레거시로 동결**한다(결정 기록 §2.3-2). admin 코드의 `problems` write 경로는 원래 부재(구 admin RPC는 2026-06-09 v13 측에서 drop, legacy 어댑터는 읽기 전용)이므로 **코드 0줄 — 선언·기록만**.
- 공지 초안: `docs/requests/problems-read-only-freeze-notice-2026-06-11.md` (v13 채널 발신은 오너 수행 — 발신 일시는 해당 문서에 추기).
- 기록 반영: `docs/architecture/admin-data-source-transition.md` §10.3 인터림 상태 절에 동결 선언 행 추가.
- 보존·일몰 규율 재확인: v13 사용자 기능이 읽는 동안 `problems` 행 삭제/아카이브 금지(§2.3-3), 일몰은 P6 PASS 후 별도 오너 결정(§2.3-4). 구 읽기 어댑터 봉인(`VITE_QUESTION_BANK_SOURCE=legacy`)은 P4 종료까지 보존.

---

## P4 증적 (2026-06-11 — 관리 포인트 개방)

### P4 실행 (코드 — 실행계획안 §8)

- **노출 write 개방(P4-1)**: facade `SERVICE_STATUS_WRITE_ENABLED` 게이트 + manage 페이지 `OPERATION_WRITE_ENABLED` 플래그·"준비 중" 경고 Alert 제거. 조치 3종(노출 가능/노출 제외/내부 테스트) 활성 — 현재 상태와 같은 전환 버튼만 비활성(무의미 전환 차단). 경로: `updateAssessmentQuestionServiceStatusSafe` → `setTopikWritingServiceStatus` → RPC `admin_update_topik_question`(사유 `__note`→`payload.note`). facade에서 사유 공백 거부.
- **태그 부여/제거(P4-2)**: facade 함수 신설 `assignQuestionTagSafe`/`removeQuestionTagSafe`(+`fetchQuestionBankTagMasterSafe` 태그 사전 로더 — '서비스_노출상태' 그룹 필터) → 어댑터 `assignTopikWritingQuestionTag`/`removeTopikWritingQuestionTag` → RPC `admin_assign_question_tag`/`admin_remove_question_tag`. UI = `question-tag-edit-modal.tsx` 신설(manage 행별 `태그 편집` 버튼): 활성 태그 목록+memo 표시, 제거 ConfirmAction(사유 필수), 사전 기반 부여(그룹 옵션·검색·이미 활성 비활성화·usage_rule 안내, 태그+사유 입력 전 비활성). 사유 memo 필수(`question_tags.memo`+`payload.tag_memo`). mock 경로(인메모리 태그 store) 동반.
- **POL-018 화면 가드**: ② `available` 전환 모달이 대상 문항의 운영주의 그룹 활성 태그를 검사해 태그명 명시 경고 표시(사유는 전 조치 필수). ③ 반복방지 그룹 활성 태그 임계(`REPEAT_AVOID_EXCESS_THRESHOLD=2`) 이상 시 전환 모달·태그 편집 모달에 `excluded` 권고 표시.
- **감사 표면(P4-5)**: 액션 라벨 4종(`service_status_changed`/`tag_assigned`/`tag_removed`/`question_received`) 확인 + **딥링크 버그 수정** — `system-audit-logs-page.tsx`의 AssessmentQuestion Target 링크가 제거된 구 라우트(`/assessment/question-bank/review/{id}`)를 가리키던 것을 P3 개명 라우트(`/assessment/question-bank/{id}`)로 교정. 상세 페이지 "(P4 개방 예정)" 안내 문구 정리.

### RT-4 관리 쓰기 왕복 (P4-3 — §12.0, 실DB)

- 수행: dev 서버(4179) + D-12 시드 admin 화면 로그인, 대상 `topik-writing-51-0002`(인터림 코퍼스 1행 — 사전 상태 internal_test·활성 태그 0건 확인 후 진행, 종료 시 원복). 도구 `.omx/evidence/rt4-write-roundtrip.mjs`, 리포트 `rt4-write-roundtrip-report.json`.
- **12단계 ALL PASS**: ① 화면 노출 제외 전환(사유 필수 모달) → DB 직조회 `excluded` ② 화면 재조회 반영(행 태그 '노출 제외') ③ 화면 태그 부여(`ops_expression_caution` 표현 주의 + memo) → DB `question_tags` 활성 행+memo 일치 ④ POL-018 ② 가드 문구 실데이터 표시 확인(노출 가능 모달 — 취소) ⑤ 화면 태그 제거(ConfirmAction 사유) → DB `is_active=false`+`removed_at`+제거 memo(이력 보존) ⑥ 내부 테스트 원복 → DB `internal_test` ⑦ **감사 4행 역추적(DB 단)**: 액션 순서 `service_status_changed`→`tag_assigned`→`tag_removed`→`service_status_changed`, diff(`{service_status:{from,to}}`/`{tag:{from,to}}`)·payload(`note`/`tag_memo`)·actor(`admin_user_id`)·`target_table='AssessmentQuestion'` 전부 계약 일치 ⑧ 감사 딥링크(`/system/audit-logs?targetType=AssessmentQuestion&targetId=…`) 진입 확인.
- **정직 표기**: 감사 로그 **화면**은 모크 store SoT(기지 갭 gap-register §4.10.2 — 감사 SoT 혼합)라 실 `admin_audit_logs` 행이 화면 목록에 표시되지 않는다. P4 계약(라벨 맵·딥링크·문서)은 충족하며, 실 감사 행 역추적 증적은 DB 단 대사(⑦)로 남겼다. 화면 실데이터 연동은 후속 범위(action-log 문서에 주의 병기).
- 데이터 불변 조건 갱신: 인터림 466행 전 행 `internal_test` 유지(원복 확인). `question_tags`는 **활성 0행 + 이력 1행**(RT-4 제거 이력 — 이력 보존 설계상 정상), 감사 로그에 RT-4 4행 잔존(append-only 설계상 정상).

### RLS 직접 write 차단 네거티브 (P4-4 — §12.1, 실DB)

- 도구 `.omx/evidence/rt4-rls-negative.mjs`, 리포트 `rt4-rls-negative-report.json`. **18단계 ALL PASS**.
- 역할 3종 × 직접 write: anon/비admin(E2E_USER)/admin(E2E_ADMIN — RPC 우회 직접 테이블) 모두 번호별 테이블 UPDATE·`question_tags` INSERT/DELETE·`tag_master` UPDATE 차단(0011 설계 — 쓰기 정책 0건). RPC 가드: anon `admin_update_topik_question` 거부(unauthenticated), 비admin RPC 2종 거부(`forbidden: content_admin required`), 노출상태 그룹 태그 부여 거부(시드 제외 — unknown tag_code). 값 불변 재확인(service-role 재조회 + 프로브 memo 행 0건).

### 검증 게이트 (P4-6)

- write e2e: `test:e2e:mock` **7/7 PASS** — 신규 3종(관리 조치 개방 렌더 / 노출 전환 화면 왕복(사유 필수·재조회 반영) / 태그 부여·제거+POL-018 ② 가드 표시) + 기존 조회·부재 네거티브 4종.
- vitest 39/39, `npm run build` PASS, `npm run harness:check`(mojibake/crosslinks/route-coverage/lint/typecheck) 전 항목 PASS.

### 문서 동기화 — §11 P4 행 (작업 커밋 `6846309`)

- IA 2종(관리 IA §7.3 "조치 활성 규칙" 재작성·오픈 이슈 2건 해소 / 목록 IA P4 마커 갱신 — IA 체인지로그 동반), page-tables #19-1 액션·태그 편집 모달 재작성, action-log P4 write 계약(payload 키·역추적 경로·감사 화면 모크 SoT 주의 병기), page-sync P4 개방 완료 표기, data-contract §9.6 쓰기 계약·§12.3 화면 결선 완료, gap-register §4.7 write 게이트 해소(+P3 잔존 분류 표기 정리), policy-source-map **POL-018 → 코드 반영 승격**, data-source-transition §10.3 운영 write 경계 재작성. 기록: `logs/admin-doc-update-log.md` + `docs/specs/admin-page-ia-change-log.md`.

### P4 채점 (실행 계획안 §12.3 P4 채점표 — 2026-06-11)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P4-1 | `service_status` write 개방 + `OPERATION_WRITE_ENABLED` 게이트 제거 | PASS | 코드 diff `6846309`(facade `SERVICE_STATUS_WRITE_ENABLED`·manage `OPERATION_WRITE_ENABLED`·"준비 중" Alert 제거) + 동작 확인(RT-4 ①·②: 화면 전환 → DB `excluded` → 화면 재반영, e2e 노출 전환 왕복) |
| P4-2 | 태그 부여/제거 UI+RPC(노출상태 그룹 차단 가드 포함) | PASS | `question-tag-edit-modal.tsx` + facade/어댑터 결선(코드 diff `6846309`), 동작 확인(RT-4 ③·⑤: 부여 memo 일치·제거 이력 보존), 가드 테스트(RLS 네거티브: 노출상태 그룹 부여 거부 + facade 옵션 필터·RPC 가드 이중 차단, 사유 공백 거부) |
| P4-3 | **RT-4 관리 쓰기 왕복(태그·service_status)** | PASS | 본 로그 RT-4 절 — 12단계 ALL PASS(화면 write → DB 직조회 → 화면 재반영 → 감사 4행 역추적(DB 단, 액션 순서·diff·payload·actor 계약 일치) + 딥링크 진입), internal_test 1행 수행 후 원복. 리포트 `.omx/evidence/rt4-write-roundtrip-report.json`. 정직 표기: 감사 **화면**의 실 행 표시는 기지 갭 §4.10.2(모크 store SoT — 후속 범위) |
| P4-4 | RLS 직접 write 차단 재확인 | PASS | 본 로그 RLS 네거티브 절 — 18단계 ALL PASS(anon/비admin/admin × UPDATE/INSERT/DELETE 차단 + RPC unauthenticated/forbidden 거부 + 값 불변 재확인). 리포트 `.omx/evidence/rt4-rls-negative-report.json` |
| P4-5 | 감사 표면 갱신(액션 라벨·딥링크) + action-log 문서 계약 | PASS | 라벨 4종 확인 + AssessmentQuestion 딥링크 구 `/review/` 경로 버그 수정(코드 diff `6846309`) + action-log P4 write 계약 추가(문서 diff `6846309`) |
| P4-6 | write e2e 통과 | PASS | `test:e2e:mock` 7/7(write 시나리오 3종 — 사유 필수·재조회 반영·POL-018 ② 가드 어서션) + 실DB 화면 경로는 RT-4 브라우저 프로브로 보강 |
| P4-7 | 노출 제외 기준 운영 가이드 반영(D-6 후속) | PASS(권장) | `tag_master.usage_rule`에 기준 ②③ 기록(P1 시드)·태그 편집 모달이 선택 태그의 usage_rule 안내 표시·POL-018 정책 행 코드 반영 승격·관리 IA §7.4 가이드 병기 |

- 종합 판정: **PASS** (필수 P4-1~P4-6 전부 PASS + 권장 P4-7 PASS). **P5(마스터 관리·신규 surface) 착수 가능.**
- §12.2 후속 판단 포인터(채점 외): P4 종료 시점의 구 problems 어댑터 플래그 봉인 제거 여부는 오너 판단 대기 — 권고: 읽기 전용·저비용이므로 P6(공급 연동) 전까지 봉인 보존 유지.
- 채점자: 프로젝트 오너 위임 실행(2026-06-11 지시 — "남은 작업을 이어가"). 스코어카드(§12.4) P4 행 기록 동반.

---

## P5 증적 (2026-06-11 — 마스터 관리·신규 surface)

### P5-1 실행 (코드 — 실행계획안 §9, 작업 커밋 `a96846b`)

- **경로 선택**: 1차 권장 경로 = **기존 `/system/metadata` 확장**(신규 라우트·메뉴·권한 키 0건 — P5-2는 "해당 없음" 경로). 모크 그룹 store(편집 가능 인메모리 SoT)에 끼우지 않고 **Supabase 실데이터 읽기 전용 별도 섹션**으로 분리 — 같은 표에 합치면 편집 액션이 거짓 동작하기 때문(핸드오프 §3-1 구조 주의 ②, `MetadataModule` enum 확장도 불필요해짐).
- **데이터 계층**: 전수 카탈로그 로더 2종 신설 `loadTopikWritingTopicMasterCatalog`/`loadTopikWritingTagMasterCatalog`(`topik-writing-question-bank-service.ts`) — 기존 편집용 로더와 달리 **is_active·'서비스_노출상태' 그룹 필터 없음**(마스터 행 자체를 표시). facade `fetchQuestionBankTopicMasterCatalogSafe`/`fetchQuestionBankTagMasterCatalogSafe`(mock/topik_writing/legacy 분기 — legacy는 마스터 테이블이 없어 빈 배열 = 화면 empty 안내). 카탈로그 행 타입 2종(`TopikWritingTopicMasterCatalogRow`/`TopikWritingTagMasterCatalogRow`) + 모크 카탈로그(D-12 — 비활성 예시 1행 포함, 비활성 렌더 검증용).
- **UI**: `src/features/assessment/ui/master-catalog-section.tsx` 신설(평가 도메인 데이터라 assessment feature 소유, 시스템 페이지가 마운트) — `TOPIK 쓰기 마스터 데이터 (읽기 전용)` 카드: 주제/태그 탭, 컬럼 필터(종합 주제·그룹·활성)·정렬, 탭별 `총 N건 · 활성 M건` 집계, 탭별 독립 AsyncState(pending/empty/error+재시도), 모크 배너. **편집 액션 0**(write 없음 — 감사 계약 영향 없음).
- **추천키/반복방지키**: 문항 상세 JSONB 조회로 유지(D-10 비범위 — 실행계획안 §9 "조회만" 원칙, 마스터 화면에 편집 진입점 없음).

### P5-1 화면 확인 (실DB — §12.3 판정 기준 "화면 확인")

- 수행: dev 서버(4179) + D-12 시드 admin 화면 로그인. 도구 `.omx/evidence/p5-master-catalog-surface.mjs`, 리포트 `p5-master-catalog-surface-report.json`. **쓰기 0건**(service-role은 직조회 집계만).
- **8단계 ALL PASS**: ⓐ DB 직조회 — topic_master 전수 85행·17개 종합 주제·활성 85 ⓑ tag_master 전수 19행·6그룹·활성 19('서비스_노출상태' 그룹 부재 = D-6 시드 원칙 확인) ① 섹션 렌더 ② 주제 탭 화면 집계 `총 85건 · 활성 85건` = DB 대사 + 표본 행(개인 신상/이름, sort 101 — 시드 첫 행) ③ 태그 탭 화면 집계 `총 19건 · 활성 19건` = DB 대사 + 표본 행(rec_use/추천 사용, 그룹 추천사용) ④ 읽기 전용 — 섹션 내 상태 스위치 0 + 추가/수정/삭제 버튼 0.

### 검증 게이트

- e2e: `test:e2e:mock` **8/8 PASS** — 신규 1종(주제/태그 마스터 `/system/metadata` 읽기 전용 조회: 모크 배너·전수 표시(비활성 행 포함)·탭 전환·편집 액션 부재 어서션) + 기존 7종 회귀 무손상.
- vitest 39/39, `npm run build` PASS, `npm run harness:check`(mojibake / crosslinks 107문서 / **route-coverage 52라우트·37 IA** / lint / typecheck) 전 항목 PASS.

### 문서 동기화 — §11 P5 행 (작업 커밋 `a96846b`)

- page-IA(`system-metadata-page-ia.md` §6 화면 구조 행·§7 데이터 블록·§10 Assessment 영향·§14 구현 메모·§17 보강 메모 — IA 체인지로그 동반), page-tables **#40 신규 표**, data-contract §9.6 마스터 카탈로그 계약 행, data-source-transition §10.3 마스터 조회 surface 행, action-log(마스터 카탈로그 = 감사 액션 없음 + P5-3 개방 시 신규 Target Type 결정 의무), gap-register §4.7(P5-1 구현 기록 + **신규 갭 ③** tag_master write 보류 + 분류 갱신). 기록: `logs/admin-doc-update-log.md`.

### P5 채점 (실행 계획안 §12.3 P5 채점표 — 2026-06-11)

| # | 항목 | 판정 | 증적 |
| :-- | :---- | :--: | :---- |
| P5-1 | 주제/태그 마스터 admin 조회 surface 가동 | PASS | 본 로그 P5-1 화면 확인 절 — 8단계 ALL PASS(DB 직조회 85행/17주제·19태그/6그룹 ↔ 화면 집계·표본 행·읽기 전용 대사). 리포트 `.omx/evidence/p5-master-catalog-surface-report.json` + e2e mock 8/8(모크 경로 화면 검증) |
| P5-2 | 신규 라우트 발생 시 page-IA·메뉴·권한·감사 동기화 + 라우트 커버리지 하네스 통과 | PASS(해당 없음) | 신규 라우트 0건(기존 `/system/metadata` 확장 — §12.3 기준 "라우트 없으면 해당 없음=PASS"). `harness:check` 로그: route-coverage 52라우트/37 IA PASS(기존 IA 문서 동기화는 P5-1 증적에 포함) |
| P5-3 | tag_master 활성/비활성 write(+Target Type 결정) | 보류(권장) | 미수행 — 후속 계획: 전용 write RPC 마이그레이션 신설(`db:migrate` 토큰 필요) + platform_admin 가드 + 신규 Target Type(예: `AssessmentTagMaster`) 결정 + 감사 라벨 추가(action-log 의무 병기됨). 추적: gap-register §4.7 신규 갭 ③ + §12.4 메모 |
| P5-4 | D-13 후속(53번 자산 저장소) 결정 실행 | 보류(권장) | 오너 결정 미결(Storage 버킷/CDN 채택은 오너 몫 — 실행계획안 §9). 현행 유지: 53번 자료는 수치 JSONB 렌더 + empty state. 결정 시 업로드 경로·`data_asset_url` 채움 정책 확정. 추적: §12.4 메모 + 리스크 R10 |

- 종합 판정: **PASS** (필수 P5-1·P5-2 전부 PASS — §12.3 판정 규칙상 권장 P5-3·P5-4는 종합 판정 비산입, 후속 계획을 §12.4에 기록). **P6(외부 공급 수신 연동)은 외부 게이트 — D-11 공급 계약 회신 확정이 선행 조건.**
- 채점자: 프로젝트 오너 위임 실행(2026-06-11 지시 — "이어서 작업해"). 작업 커밋 `a96846b`, 스코어카드(§12.4) P5 행 기록 동반(채점 커밋).

### P5-3 추기 (2026-06-11 같은 날 — 보류했던 권장 항목 실행·PASS 전환. 작업 커밋 `6cbf30b`)

- **결정 확정**: 신규 Target Type = `AssessmentTagMaster`(Target ID = tag_code, 라벨 "태그 마스터", 딥링크 `/system/metadata`), 감사 액션 = `tag_master_status_changed`(diff `{is_active:{from,to}}`, payload `{note, active_assignment_count}` — 토글 시점 활성 부여 수 동봉).
- **DB(0014 적용)**: `20260611210100_topik_writing_tag_master_admin_rpc.sql` — `admin_update_tag_master_status(p_tag_code, p_next_active, p_note)`: SECURITY DEFINER + **`private.is_platform_admin` 가드**(실행계획안 §9 확정값 — 문항 RPC의 content_admin과 분리: 마스터 사전 변경은 전 문항 부여 옵션에 영향) + 사유 RPC 단 필수 + 미존재·무변경 토글 거부 + `updated_at` 갱신. `db:migrate` 적용 + RPC 원문 대사(가드·액션·Target Type 포함 3/3 확인). down 스크립트 동반(함수 drop만 — 데이터 무변경).
- **코드**: 어댑터 `setTopikWritingTagMasterStatus` → facade `updateTagMasterStatusSafe`(사유 공백 거부, mock/topik_writing/legacy 분기 — legacy 거부) → 카탈로그 태그 탭 토글(BinaryStatusSwitch → ConfirmAction 사유 필수 → 성공 알림 + AuditLogLink + 재조회). 감사 화면 라벨·딥링크·Target Type 라벨 결선. mock 가변 store(RPC 가드 동형 — 미존재·무변경 거부).
- **동작 확인(§12.3 P5-3 판정 기준) — 프로브 14단계 ALL PASS** (`.omx/evidence/p5-3-tag-master-write.mjs`, 리포트 `p5-3-tag-master-write-report.json`, 대상 `flow_basic_check` — 종료 시 원복):
  - 거부 3방향: anon RPC(unauthenticated) / 비admin RPC(forbidden: platform_admin required) / **content_admin RPC·화면 모두 거부**(문항 write가 허용되는 역할도 마스터 write는 차단 — 가드 분리 실증, 거부 후 값 불변 확인).
  - 허용 경로: e2e 전용 시드 admin(D-12)을 일시 승격(platform_admin) → 화면 토글 비활성화(사유 필수 모달) → DB 직조회 `is_active=false`+`updated_at` → 화면 재조회 반영(스위치 해제) → 활성화 원복 → **감사 2행 역추적(DB 단)**: 액션·`AssessmentTagMaster`·tag_code·diff 양방향·payload note/active_assignment_count·actor 전부 계약 일치 → 딥링크 진입.
  - 원복: 시드 admin 역할 content_admin 원복 확인 + 태그 활성 원복(데이터 불변 종료).
  - 승격 메커니즘 기록: `profiles.app_role`은 v13 보호 트리거(`protect_profile_columns`)가 service-role 직접 변경을 차단(auth.uid() 없음) — admin 전면 우회 + `profiles_self_update` RLS로 **시드 admin 본인 세션 self-update** 사용. (관찰: content_admin의 self-승격이 v13 정책상 허용 — 기존 자세, 본 전환 비범위. 오너 참고용 기록.)
- **검증 게이트**: e2e mock **9/9**(신규 — 태그 마스터 토글 사유 필수·화면 왕복·집계 반영), vitest 39/39, build·harness:check PASS.
- **재채점**: P5-3 보류(권장) → **PASS(권장)** — P5 종합 PASS 불변(필수 산입 없음), 잔여 권장 보류는 **P5-4 단독**(D-13 자산 저장소 — 오너 결정). 문서 동기화: §11 P5 행 재동기화(action-log 신규 계약 결선·gap-register 신규 갭 ③ 해소 포함, 커밋 `6cbf30b`).
