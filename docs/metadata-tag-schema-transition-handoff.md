# 메타데이터·태그 스키마 전환 — HANDOFF (P0~P5 전부 PASS, 다음 = P6(외부 게이트). 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (P5 채점 PASS 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 내부 실행 페이즈(P0~P5)가 전부 닫혔으므로, 다음 세션이 **P6 — 외부 공급 API 수신 연동**(실행계획안 §10)의 게이트 상태를 확인하고 이어가도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (§12.4 스코어카드 P0~P5 = **PASS**) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환**) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P5 채점 + problems 동결 선언 절) |

## 0. 아키텍처 (2026-06-11 확정 — 결정 기록 §0)

```
외부(공급) API[문제 발원 — 미개발] → admin 수신·적재(Supabase topik_writing_51~54 + source_map)
  → admin 관리 포인트 = 태그(schema-rule §2) + 노출 통제 = service_status(D-6)  ← P4 개방 완료
  → 마스터 조회 surface = /system/metadata 읽기 전용 섹션(P5-1)  ← P5 완료
  → v13 read-only 소비.  검수 개념 = 전면 삭제(화면·코드·DB 모두 제거 완료).
```

## 1. 진행 상태

| 페이즈 | 판정 | 비고 |
| :---- | :--: | :---- |
| P0~P4 | PASS | 역사 (P2 재채점 — P2-5 폐기 / P3 재채점 — 0013 적용 / P4 — 관리 포인트 개방 + RT-4·RLS 검증. 466행 = 인터림 초기 코퍼스) |
| **P5** | **PASS** (2026-06-11) | P5-1 마스터 조회 surface(`/system/metadata` 확장 — 신규 라우트 없음 → P5-2 해당 없음=PASS). **권장 보류 2건**: P5-3(tag_master write)·P5-4(D-13 자산 저장소) — §3-2 참조 |
| **P6** | **미착수 ← 외부 게이트** | **D-11 공급 계약 회신 종속(발신은 오너 — 미발신 시 착수 불가)**. 채점표 = §12.3 P6-1~P6-6. 회신 도착 전 내부 코드 작업은 없음 |

## 2. 2026-06-11 커밋 흐름 (이 세션까지)

1. `f4c0cb7` 인바운드 전환 + SoT 재작성 → 2. `202f905` P3 컷오버 → 3. `77d01bd` P3 문서 → 4. `7a0f850` P3 1차 채점 → 5. `5262685` 0013 적용+P3 PASS → 6. `6846309` P4 개방 → 7. `18051fc` P4 채점 PASS.
8. `a96846b` — **P5-1 마스터 조회 surface**: 전수 카탈로그 로더 2종(`loadTopikWritingTopicMasterCatalog`/`loadTopikWritingTagMasterCatalog` — is_active·그룹 필터 없음) + facade `fetchQuestionBank{Topic,Tag}MasterCatalogSafe`(mock/topik_writing/legacy 분기) + `src/features/assessment/ui/master-catalog-section.tsx` 신설(읽기 전용 — 주제/태그 탭·필터·총/활성 집계·모크 배너) + `system-metadata-page.tsx` 마운트 + e2e mock 8번째 테스트 + §11 P5 행 문서 동기화(page-tables #40, page-IA §17 등).
9. (이 커밋) — P5 채점 PASS + 스코어카드·핸드오프 갱신.

## 3. 다음 작업 절차

1. **P6 게이트 확인(매 세션 첫 작업)**: D-11 공급 계약 회신 여부를 오너에게 확인. 회신 = `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`의 계약 항목(엔드포인트·페이로드 §4+§7·공급 식별자·버전·idempotency 키) 확정 → 계약 스냅샷 문서화(P6-1) 후 수신·적재 구현(§10: upsert idempotent + `service_status='internal_test'` 기본 + `question_received` 감사 + source_map 기록) → §12.3 P6 채점표.
2. **P5 권장 보류 2건(후속 — P6와 독립, 제품 결정 대기)**:
   - **P5-3 tag_master 활성/비활성 write**: 전용 RPC 마이그레이션 신설(`db:migrate` — 토큰 셸 주입 필요) + platform_admin 가드 + 신규 Target Type(예: `AssessmentTagMaster`) 결정 + 감사 라벨 추가(action-log에 의무 병기됨) + 카탈로그 섹션에 토글 UI. 추적: gap-register §4.7 신규 갭 ③.
   - **P5-4 D-13(53번 자료 자산 저장소)**: Storage 버킷/CDN 채택은 **오너 결정**. 채택 시 업로드 경로·`data_asset_url` 채움 정책 확정. 미결이면 현행(수치 JSONB 렌더 + empty state) 유지. 리스크 R10.
3. **기지 갭(범위 판단 대기)**: 감사 로그 **화면**(`/system/audit-logs`)은 모크 store SoT(gap-register §4.10.2)라 실 `admin_audit_logs` 행이 화면에 표시되지 않음 — P4·P5 역추적 증적은 DB 단으로 남김. 화면 실데이터 연동은 P6 범위 판단(또는 별도 트랙).
4. **오너 액션(병행 — 코드 작업 아님)**:
   - **D-11 공급 계약 요청 발신**: `docs/requests/upstream-writing-endpoints-request-2026-06-10.md` — **P6 유일 외부 게이트, 리드타임 최장. 최우선.**
   - **problems 동결 공지 발신**(v13 채널): 초안 `docs/requests/problems-read-only-freeze-notice-2026-06-11.md` — 발신 후 해당 문서 표에 일시 추기.
   - **legacy 어댑터 봉인 제거 판단**(§12.2): 권고 = P6 전까지 봉인 보존(읽기 전용·저비용 롤백). 제거 결정 시 `supabase-assessment-question-bank-service.ts`·`question-bank-data-source.ts`의 legacy 분기 삭제 + 문서 동기화.
   - **P5-4 자산 저장소 결정**(위 §3-2).
5. **P6 PASS 시**: 전환 프로젝트 종료 선언(§12.4 전 페이즈 PASS 확인 + POL-017 "코드 반영" 승격 + `docs/specs/admin-policy-source-map.md` 갱신).

## 4. 환경·운영 메모

1. **`SUPABASE_ACCESS_TOKEN`**: `.env.local`에 존재(sbp_…, gitignore). `db:*` 스크립트는 dotenv를 안 읽으므로 셸 주입 필요:
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = ((Select-String -Path .env.local -Pattern '^SUPABASE_ACCESS_TOKEN=').Line -split '=',2)[1]
   ```
   ETL·프로브 스크립트는 자체 로드(`loadEnvLocal`). **DDL이 없으면 토큰 불필요**(P5는 DDL 0건으로 닫힘 — P5-3/P6 적재 구현 시 필요).
2. **DB 현 상태**: 0013 적용 완료(검수 물리 제거). 인터림 466행 전 행 `internal_test`(RT-4 원복 확인). question_tags = 활성 0행 + 이력 1행, `admin_audit_logs`에 RT-4 4행 잔존(append-only 정상). 마스터: topic 85행/17주제(전 행 활성), tag 19종/6그룹(전 행 활성, '서비스_노출상태' 그룹 부재 = D-6).
3. **증적 프로브(재사용 가능, `.omx/` — git 비추적)**: P5-1 화면 확인 `.omx/evidence/p5-master-catalog-surface.mjs`(dev 4179 + 시드 admin, 쓰기 0건) / RT-4 `rt4-write-roundtrip.mjs` / RLS 네거티브 `rt4-rls-negative.mjs`. 리포트는 동명 `-report.json`.
4. **스위치 규율**: 기본 'topik_writing'. 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`(읽기 전용·조치 불가 — legacy 모드에서 마스터 카탈로그는 empty 안내).
5. **e2e**: 모크는 `npm run test:e2e:mock`(**8 테스트** — write 3종 + 마스터 카탈로그 1종 포함. 4177 좀비 dev 서버 주의 `Get-NetTCPConnection -LocalPort 4177`). vitest 39(`test:unit` — ETL transform 전용), `harness:check` = mojibake/crosslinks/route-coverage/lint/typecheck.
6. **PS 함정**: md 일괄 치환 시 `Set-Content` = BOM/CRLF 생성(Edit 도구 권장), 리다이렉트 `>` = UTF-16, git commit 메시지에 큰따옴표 = 인자 분리 깨짐(bash heredoc 권장), **PS 콘솔에서 한글 파일 출력은 mojibake로 보일 수 있음(파일은 정상 UTF-8 — Read 도구 사용)**. **이 머신에 `python` 없음**(스크립트는 node).
7. **커밋 규율**: 작업→채점 2단계, MD 수정 시 `logs/admin-doc-update-log.md`(IA 수정 시 `docs/specs/admin-page-ia-change-log.md` 동반), **신규 문서는 `docs/README.md` 색인 추가**(crosslink 게이트), `npm run harness:check` 필수.
8. **마스터 카탈로그 구조 메모(P5-3 착수 시)**: 섹션 컴포넌트는 assessment feature 소유(`master-catalog-section.tsx`) — 시스템 페이지가 마운트. 카탈로그 로더는 **전수**(편집용 `loadTopikWritingTagMaster`와 별개 — 그쪽은 활성+그룹 필터 내장). write 추가 시 토글은 카탈로그 섹션에, RPC 가드는 platform_admin(문항 RPC의 content_admin과 다름 — 결정 필요).
