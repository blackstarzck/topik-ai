# 메타데이터·태그 스키마 전환 — HANDOFF (P0~P4 전부 PASS, 다음 = P5. 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (P4 채점 PASS 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 **P5 — 마스터 관리·신규 surface**(실행계획안 §9)부터 곧바로 이어가도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (§12.4 스코어카드 P0~P4 = **PASS**) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환**) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P4 채점 + problems 동결 선언 절) |

## 0. 아키텍처 (2026-06-11 확정 — 결정 기록 §0)

```
외부(공급) API[문제 발원 — 미개발] → admin 수신·적재(Supabase topik_writing_51~54 + source_map)
  → admin 관리 포인트 = 태그(schema-rule §2) + 노출 통제 = service_status(D-6)  ← P4 개방 완료
  → v13 read-only 소비.  검수 개념 = 전면 삭제(화면·코드·DB 모두 제거 완료).
```

## 1. 진행 상태

| 페이즈 | 판정 | 비고 |
| :---- | :--: | :---- |
| P0~P3 | PASS | 역사 (P2 재채점 — P2-5 폐기 / P3 재채점 — 0013 적용. 466행 = 인터림 초기 코퍼스) |
| **P4** | **PASS** (2026-06-11) | 관리 포인트 개방 — 노출 write + 태그 편집 + POL-018 ②③ 가드. RT-4 12단계·RLS 네거티브 18단계 ALL PASS |
| **P5** | **미착수 ← 다음 작업** | 채점표 = 실행계획안 §12.3 P5-1~P5-4 (**필수는 P5-1·P5-2 둘뿐**, P5-3·P5-4는 권장) |
| P6 | 미착수 | 외부 게이트 — D-11 공급 계약 회신 종속(발신은 오너). P5 PASS + D-11 확정이 선행 조건 |

## 2. 2026-06-11 커밋 흐름 (이 세션까지)

1. `f4c0cb7` — 인바운드 모델 전환 + SoT 22파일 일괄 재작성.
2. `202f905` — 재정의 P3 코드 실행(컷오버 + 검수 표면 제거 + 0013 작성). 3. `77d01bd` — P3-7 문서 동기화. 4. `7a0f850` — P3 1차 채점(CONDITIONAL). 5. `5262685` — 0013 적용 + P3 재채점 PASS.
6. `6846309` — **problems read-only 동결 선언(§7.1-6) + P4 실행**: 게이트 2곳(`SERVICE_STATUS_WRITE_ENABLED`/`OPERATION_WRITE_ENABLED`)·"준비 중" Alert 제거, facade 태그 write(`assignQuestionTagSafe`/`removeQuestionTagSafe` — 사유 공백 거부) + 태그 사전 로더(`fetchQuestionBankTagMasterSafe`), `src/features/assessment/ui/question-tag-edit-modal.tsx` 신설, POL-018 ②(운영주의 활성 태그 검사 경고)·③(반복방지 임계 2 `excluded` 권고 — `REPEAT_AVOID_EXCESS_THRESHOLD`) 가드, 감사 딥링크 구 `/review/` 버그 수정(`system-audit-logs-page.tsx`), mock 태그 store, e2e write 3종(7/7), §11 P4 행 문서 동기화.
7. `18051fc` — P4 채점 PASS + 스코어카드·핸드오프 갱신.

## 3. 다음 작업 절차 (순서대로)

1. **P5-1(필수) — 주제/태그 마스터 admin 조회 surface** (실행계획안 §9):
   - **1차 권장 경로 = `/system/metadata` 코드 테이블 페이지에 실데이터 그룹 노출**. 현행 구조: 라우트 `src/app/router/app-router.tsx:380`, 페이지 `src/features/system/pages/system-metadata-page.tsx`, SoT는 **zustand 모크 store** `src/features/system/model/system-metadata-store.ts`(groups+audits, write 액션 포함) + 타입 `system-metadata-types.ts`. 메뉴/권한: `admin-shell.tsx:307`(`system.metadata.manage`).
   - **구조 주의 2가지**: ① `MetadataModule` enum(`system-metadata-types.ts:1`)에 `Assessment`가 **없다**(Users/Message/Operation/Commerce/Content/System) — 신규 그룹의 ownerModule을 enum 확장으로 풀지, 기존 모듈(Content 또는 System) 소유로 분류할지 결정 필요. ② 모크 store 그룹은 편집 가능한 인메모리 SoT인데 topic/tag 마스터는 **Supabase 실데이터(읽기 전용이어야 함)** — 모크 그룹에 끼워 넣으면 편집 액션이 거짓 동작하므로, **Supabase 연동 읽기 전용 그룹(별도 섹션/비편집 렌더) 신설이 정합적**. 어느 쪽이든 page-IA(`docs/specs/page-ia/system-metadata-page-ia.md`)·page-tables 동기화 의무.
   - **데이터 로더 재사용**: 어댑터 `loadTopikWritingTopicMaster`/`loadTopikWritingTagMaster`(`src/features/assessment/api/topik-writing-question-bank-service.ts`). 단 facade `fetchQuestionBankTagMasterSafe`는 '서비스_노출상태' 그룹 필터 + `is_active=true` 필터가 내장(태그 편집용) — **마스터 화면이 전수(비활성 포함) 표시를 원하면 어댑터 직접 호출 또는 전수 로더 신설**. 실데이터 규모: topic 17주제/85행, tag 19종/6그룹.
   - 별도 전용 페이지를 신설하는 경우: 신규 라우트 + page-IA 신설 + 메뉴/브레드크럼(`admin-shell.tsx`/`admin-breadcrumb.tsx`/`admin-labels.ts`) + 권한 키(예: `assessment.tag-master.manage`) 일괄 작업 — 라우트-IA 커버리지 하네스가 강제한다.
   - 추천키/반복방지키는 **조회만**(JSONB 표시 — D-10 비범위, 편집은 후속 제품 결정).
2. **P5-2(필수)**: 신규 라우트 발생 시 page-IA·메뉴·권한·감사 동기화 + `harness:check` 통과. **라우트를 안 만들면 "해당 없음=PASS"** — 즉 P5-1을 `/system/metadata` 확장으로 풀면 P5는 사실상 P5-1 하나로 닫힌다.
3. **P5-3(권장) — tag_master 활성/비활성 토글 write**: 현행 RPC는 문항용 3종뿐 — tag_master write RPC **신설 필요**(마이그레이션 — P4 PASS로 비가역 실행 허용, `db:migrate` 토큰 필요). platform_admin 가드 + 신규 Target Type 결정(`admin_audit_logs`) + 감사 라벨 추가. 권장 항목이므로 보류 가능(보류 시 §12.4 메모에 후속 계획 기록).
4. **P5-4(권장) — D-13 후속(53번 자료 자산 저장소)**: Storage 버킷/CDN 채택 결정은 **오너 몫** — 채택 시 업로드 경로·`data_asset_url` 채움 정책 확정. 미결이면 현행(수치 JSONB 렌더 + empty state) 유지.
5. **P5 채점**(§12.3 P5 채점표) → 증적 로그 + §12.4 스코어카드 + 핸드오프 갱신. 커밋 규율: 작업→채점 2단계.
6. **오너 액션(병행 — 코드 작업 아님)**:
   - **problems 동결 공지 발신**(v13 채널): 초안 `docs/requests/problems-read-only-freeze-notice-2026-06-11.md` — 발신 후 해당 문서 표에 일시 추기.
   - **D-11 공급 계약 요청 발신**: `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`(P6 게이트 — 리드타임 최장).
   - **legacy 어댑터 봉인 제거 판단**(§12.2 — P4 종료 시점 판단 의무): 권고 = P6 전까지 봉인 보존(읽기 전용·저비용 롤백 경로). 제거 결정 시 `supabase-assessment-question-bank-service.ts`(legacy 어댑터)·`question-bank-data-source.ts`의 legacy 분기 삭제 + 문서 동기화.

## 4. 환경·운영 메모

1. **`SUPABASE_ACCESS_TOKEN`**: `.env.local`에 존재(sbp_…, gitignore). `db:*` 스크립트는 dotenv를 안 읽으므로 셸 주입 필요:
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = ((Select-String -Path .env.local -Pattern '^SUPABASE_ACCESS_TOKEN=').Line -split '=',2)[1]
   ```
   ETL·프로브 스크립트는 자체 로드(`loadEnvLocal`). **P5에서 DDL이 없으면(P5-3 보류 시) 토큰 불필요.**
2. **DB 현 상태**: 0013 적용 완료(검수 물리 제거). 인터림 466행 전 행 `internal_test`(RT-4 원복 확인). **question_tags = 활성 0행 + 이력 1행**(RT-4 제거 이력 — 이력 보존 설계상 정상), `admin_audit_logs`에 RT-4 4행(`topik-writing-51-0002`) 잔존(append-only 정상). 보류 4행 = `audit_seed` 예시(`-0001` — 프로브는 `-0002`부터).
3. **P4 산출 도구(재사용 가능)**: RT-4 브라우저 프로브 `.omx/evidence/rt4-write-roundtrip.mjs`(dev 서버 4179 + D-12 시드 admin, 수행 후 원복) / RLS 네거티브 `.omx/evidence/rt4-rls-negative.mjs`(서버 불필요 — 쓰기 실패가 기대값). 리포트는 동명 `-report.json`. 구 검수 프로브 `debug-topik-writing-read.mjs`는 구 화면 기준이라 깨짐(RT-4 프로브가 대체).
4. **기지 갭(후속 범위)**: 감사 로그 **화면**(`/system/audit-logs`)은 모크 store SoT(gap-register §4.10.2)라 실 `admin_audit_logs` 행이 화면에 표시되지 않음 — P4 역추적 증적은 DB 단으로 남김(action-log 문서에 주의 병기됨). 화면 실데이터 연동은 P5/P6에서 범위 판단.
5. **스위치 규율**: 기본 'topik_writing'. 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`(읽기 전용·조치 불가 — §3-6 오너 판단까지 보존).
6. **e2e**: 모크는 `npm run test:e2e:mock`(7 테스트 — write 3종 포함. 4177 좀비 dev 서버 주의 `Get-NetTCPConnection -LocalPort 4177`). vitest 39, `harness:check` = mojibake/crosslinks/route-coverage/lint/typecheck.
7. **PS 함정**: md 일괄 치환 시 `Set-Content` = BOM/CRLF 생성(Edit 도구 권장), 리다이렉트 `>` = UTF-16, git commit 메시지에 큰따옴표 = 인자 분리 깨짐(bash heredoc 권장). **이 머신에 `python` 없음**(스크립트는 node).
8. **커밋 규율**: 작업→채점 2단계, MD 수정 시 `logs/admin-doc-update-log.md`(IA 수정 시 `docs/specs/admin-page-ia-change-log.md` 동반), **신규 문서는 `docs/README.md` 색인 추가**(crosslink 게이트), `npm run harness:check` 필수.
