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

> P3는 **미완료·미채점**이다. 본 절은 §12.3 규칙이 허용하는 **코드 선행 개발(가역)** 의 중간 증적만 기록한다. **컷오버 배포는 미실행 — 기본 데이터 소스는 legacy(`problems`) 유지**, P2 PASS 전환 후에만 플립한다.

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

### 잔여 (P3 채점 전 필수 — P2 PASS 전환 후)

- 컷오버 절차 실행(§7.1: freeze 윈도 → 델타 재적재 → 발산 0건 대사 → 기본 소스 플립 배포 → problems read-only 동결), RT-3 정식 채점(읽기 전용 선행 대사 완료 — 위 절; 컷오버 후 배포본 기준 재확인 + 권장 시 브라우저 렌더 경로 포함), RT-4 검수 쓰기 왕복(화면→DB→재반영→감사 로그 역추적), 문서 동기화(§11 P3 행: data contract §9.6 / page-tables #19·#19-1 / 양 page-IA / page-sync §5-7), P3 채점표(§12.3) 채점.
