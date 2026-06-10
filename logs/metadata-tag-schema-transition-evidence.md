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

### P0-5 확정 증적 (커밋 후 추기)

- (커밋 후 본 절에 해시·harness 로그 추기)
