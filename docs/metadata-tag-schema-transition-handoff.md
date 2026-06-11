# 메타데이터·태그 스키마 전환 — HANDOFF (재정의 P3 코드 컷오버 완료 직후, 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (재정의 P3 코드 실행 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 ① **0013 마이그레이션 적용(유일 잔여 차단 — 토큰 필요)** ② 문서 동기화 ③ P3 채점부터 곧바로 이어가도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (2026-06-11 인바운드 개정) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환**) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P2 채점 + P2 재채점 + 재정의 P3 실행 절) |

## 0. 아키텍처 (2026-06-11 확정 — 결정 기록 §0)

```
외부(공급) API[문제 발원 — 미개발] → admin 수신·적재(Supabase topik_writing_51~54 + source_map)
  → admin 관리 포인트 = 태그(schema-rule §2) + 노출 통제 = service_status(D-6)
  → v13 read-only 소비.  검수 개념 = 전면 삭제.
```

## 1. 진행 상태 (재정의 P3 코드 실행 직후)

| 페이즈 | 판정 | 비고 |
| :---- | :--: | :---- |
| P0·P1 | PASS | 역사 |
| P2 | **PASS** (2026-06-11 재채점 — P2-5 게이트 폐기) | 466행 = 인터림 초기 코퍼스 |
| **P3 (재정의)** | **코드 실행 완료 / 미채점** — 커밋 `202f905` | 컷오버 1~4단계 수행 + 검수 표면 제거 완료. **잔여 = 0013 마이그레이션 적용(토큰)·문서 동기화·채점** (§3) |
| P4~P6 | 미착수 | P4 진입점 결선됨(§4-3) |

## 2. 이번 세션에서 끝난 것 (커밋 4개)

1. `17d5f01`·`51dbe7a` — D-3 분류 소유권 조사·판정·집행(이후 인바운드 전환으로 폐기 — 역사).
2. `d399056` — RT-3 읽기 전용 선행 대사 240필드 PASS.
3. `f4c0cb7` — **인바운드 모델 전환 + SoT 22파일 일괄 재작성**(검수 삭제·P2-5 폐기·P2 재채점 PASS·P3~P6 재정의·요청서 인바운드 재작성).
4. `202f905` — **재정의 P3 코드 실행**:
   - §7.1 컷오버 1~4: freeze → 델타 재적재(해시 5종 P2와 동일 — 드리프트 0) → verify 8체크 PASS → **스위치 기본값 'topik_writing' 플립**(롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`).
   - 검수 표면 전면 제거: 타입/스키마/presenter/facade/어댑터 3종/페이지 3종(상세 페이지 파일 개명 `assessment-question-detail-page.tsx`)/라우트 개명(`…/review/:questionId`→`…/:questionId`)/라벨·브레드크럼·상태 사전/감사 라벨(구 검수 코드는 "(구)" 역사 렌더 유지)/CSS.
   - 0013 마이그레이션 작성(+down) — **미적용**(아래 §3-1).
   - ETL 검수 필드 기록 중지. 검증: vitest 39/39, e2e 5/5(모크), RT-3 190필드 ALL PASS(실DB), build·harness 전부 통과.

## 3. 다음 작업 절차 (순서대로)

1. **0013 마이그레이션 적용 — 유일 잔여 차단**: `SUPABASE_ACCESS_TOKEN`(Management API, sbp_…)이 이번 세션에 없어 적용 보류. 토큰 확보 후:
   ```
   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; npm run db:migrate
   ```
   → 적용 후 확인: `npm run db:snapshot`(검수 4컬럼 부재 + 뷰 16컬럼), `node .omx/evidence/rt3-field-reconcile.mjs`(190필드 재확인), `npm run etl:load && npm run etl:verify`(갱신 ETL의 idempotency — 선택). **신규 코드는 적용 전 DB와도 호환**(검수 컬럼을 select하지 않음)이므로 순서 리스크 없음. 롤백: `node scripts/db/migrate.mjs --down 20260611190100_topik_writing_drop_review_columns.sql`(값 복원은 불가 — down 헤더 참조).
2. **문서 동기화 (§11 P3 행)**: f4c0cb7에서 "현행 코드: 검수 표면 — 제거 예정" 마커를 달았던 문서들이 이제 사실과 어긋남(코드 제거 완료) — 마커를 "제거 완료(202f905)"로 갱신: 양 page-IA(§2 현재 상태·§4 시나리오·§5/§6 현행 표기·§12), page-sync, page-tables #19/#19-1, data-contract §9.6, data-usage-map, action-log, data-source-transition §10.2 주의문. 라우트 행은 IA에 반영 완료(이번 커밋).
3. **P3 채점 (§12.3 재정의 채점표)**: P3-1(컷오버 절차 증적 — 완료) / P3-2(읽기 컷오버+표면 제거 — 완료) / P3-3(RT-3 — 190필드 PASS 완료) / **P3-4(컬럼 제거 마이그레이션 — 1번 적용 후 PASS 가능)** / P3-5(legacy 봉인 — 완료) / P3-6(build·e2e·harness — 완료) / P3-7(문서 동기화 — 2번 후). 1·2번 완료 전 채점 시 P3-4·P3-7로 CONDITIONAL. 채점 후 §12.4 스코어카드 기록 + 채점 커밋.
4. **problems read-only 동결 선언**(§7.1-6 — v13 합의 절차, 결정 기록 §2.3): admin 코드는 이미 problems에 쓰지 않음. 공지·기록만.
5. **D-11 공급 계약 요청 발신**(오너 — 외부): `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`. P6 게이트.
6. **P4 — 관리 포인트 개방**: facade `SERVICE_STATUS_WRITE_ENABLED` 플래그 + manage 페이지 `OPERATION_WRITE_ENABLED` 제거(노출 통제 경로는 `setTopikWritingServiceStatus`로 결선 완료), 태그 부여/제거 UI(`admin_assign_question_tag`/`admin_remove_question_tag` RPC 존재), RT-4 관리 쓰기 왕복, POL-018 ②(운영주의 태그 사유 필수) 가드.

## 4. 미해결·주의 사항

1. **`SUPABASE_ACCESS_TOKEN` 부재**: `.env.local`·셸·사용자/머신 env 모두 없음(이전 세션 일회성 제공 추정 — 회전 권고 이력과 부합). 0013 적용·스키마 스냅샷에 필요. service-role 키(`SUPABASE_SECRET_KEY`)로는 DDL 불가.
2. **DB 현 상태**: 검수 4컬럼·18컬럼 뷰·구 RPC(검수 화이트리스트)가 **아직 물리 존재**(0013 미적용). 신규 코드는 이를 사용하지 않으므로 동작 무관. 단 P3-4 채점은 적용 후에만.
3. **스위치 규율(역전됨)**: 기본값 = 'topik_writing'. 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`(구 어댑터는 읽기 전용 — P4 종료까지 보존, §12.2).
4. **e2e admin 실DB 확인**: 이번 세션은 모크 e2e + RT-3(DB 직조회)로 검증. 브라우저 실DB 확인을 원하면 `.omx/evidence/debug-topik-writing-read.mjs`는 **구 검수 화면 기준이라 깨짐** — 새 화면(문항 목록/상세) 기준으로 수정 필요(상세 라우트·버튼 라벨 변경됨).
5. e2e 모크는 `npm run test:e2e:mock`(4177 좀비 dev 서버 주의 — `Get-NetTCPConnection -LocalPort 4177`).
6. BOM 함정: `data/etl/reclassification-input.json` 수정은 Node 경유.
7. 커밋 규율: 작업→채점 2단계, MD 수정 시 `logs/admin-doc-update-log.md`, `npm run harness:check` 필수.
8. **`.omx/evidence/` 보존**: `etl/`(P2·델타 증적), `rt3-field-reconcile.mjs`(RT-3 도구 — 검수 필드 제외판으로 갱신됨), `p2-5-sample.json`(RT-3 표본).
9. 인터림 코퍼스 466행 전 행 `internal_test`(노출 차단) — P4 개방 전 불변. question_tags 0행.
