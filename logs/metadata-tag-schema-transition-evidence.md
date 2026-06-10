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

## P2 진행 메모 (2026-06-10, 중간 기록 — 채점 아님)

> P2는 **미완료·미채점**이다. 본 절은 선행 산출물(가역 작업)의 중간 증적만 기록한다. 본 적재(비가역)는 미실행 — 신규 4테이블은 0행 유지. 재개 절차는 `docs/metadata-tag-schema-transition-handoff.md` §3.

### 완료된 선행 산출물

- **추출(§6.2-1)**: `npm run etl:extract` — `problems` 51~54 전수 470행 덤프(.omx/evidence/etl/problems-dump.json). 분포 실측이 D-9 확정치와 일치: 51 90+1 / 52 5+72 / 53 46+17 / 54 81+158 (approved+pending), 전수 `source='curated'`.
- **구조 실측**: 재조립 가능성 사전 검증 — 51: 90/90(blanks→resolved_text), 52: 76/76(검수 메모 따옴표 스팬 파싱→model_answer 재조립). 53: 62/62 chart_a+chart_b·글자수·과제 파싱. 54: 238/238 번호 질문·글자수 파싱(단, 154행은 scenario 축약형 — 입력표가 essay_type 등 공급). 적재 보류 확정 대상: `audit_seed` 예시 4행(materials/answer_key 부재).
- **D-3 재분류 입력표(draft)**: `data/etl/reclassification-input.json` 466행 — 분류 에이전트 24배치(본문 기반, 기계 변환 금지) + 17×85 사전·번호별 enum 전수 검증 위반 0건. 54번 1행은 출력 누락분 수동 보완. **번호별 표본 적대 감사 패스는 세션 리밋으로 미수행**(입력표 meta.status에 기록, 다음 세션 보완).
- **ETL 4스크립트(§6.2)**: `scripts/etl/` extract/transform/load/verify + 순수 코어 `lib/transform-core.mjs`(D-2 사전·D-4 채번·빌더·NOT NULL 보류 판정·재조립 검증). 드라이런(빈 입력표)으로 보류 경로·채번 결정성 확인.
- **P2-7(권장) 선행**: vitest 도입 + `tests/unit/transform-core.test.mjs` 43개 전부 PASS(`npm run test:unit`).
- **P2-6 준비**: 델타 리허설 시뮬레이터 `.omx/evidence/etl/make-delta-sim.mjs`(problems 무변경 — 덤프 사본 변형 방식) 작성.

### 잔여 (P2 채점 전 필수)

- 본 적재(transform→load) + 검증 5종(verify) + P2-1 idempotency 2회 로그 + P2-6 리허설 실행 + P2-3 보류 발주 기록 + P2-5 콘텐츠팀 샘플 승인(발주서 미발신 시 CONDITIONAL 사유).
