# 메타데이터·태그 스키마 전환 — HANDOFF (인바운드 모델 전환 직후, 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (인바운드 모델 전환 + SoT 일괄 개정 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 ① 재정의 P3(읽기 컷오버 + 검수 표면·컬럼 제거)부터 곧바로 이어가고, ② 외부 공급 API 계약(D-11) 발신 상태를 추적할 수 있도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (2026-06-11 인바운드 개정 — P3~P6 재정의, §12.3 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환 확정** + D-1~D-13 처분) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P2 채점 + P2 재채점 + P3 진행 메모) |

## 0. 아키텍처 확정 (2026-06-11 오너 결정 — 모든 작업의 기준)

```
[외부(공급) API — 문제 발원, 미개발] → 문항+메타데이터(schema-rule §4·§7, §7.9·검수 필드 제외) 완성 상태 공급
  → [ADMIN] 수신·적재(Supabase topik_writing_51~54 + source_map)
  → [ADMIN] 관리 포인트 = 태그(schema-rule §2) + 노출 통제 = service_status(D-6)
  → [v13] read-only 소비
```

- **검수 개념 전면 삭제**: review_status·review_workflow_status(E1 철회)·review_passed·validation_result + 검수 화면·쓰기·감사 액션 제거(컬럼 물리 제거 = 재정의 P3). 품질·상태 표현은 태그로만.
- **폐기된 트랙**: 콘텐츠팀 발주서·P2-5 샘플 승인·D-3 분류 소유권(브리프 포함)·상류 push(업로드/배포)·question_published. 구 아웃바운드 POL-017은 "문항 수신·관리 운영정책"으로 재정의.
- **인터림**: 백필 466행 = 초기 코퍼스(전 행 internal_test). 외부 API 미개발 동안 신규 공급 없음. problems는 v13이 읽는 동안 보존(동결 방침).

## 1. 진행 상태 (2026-06-11 SoT 일괄 개정 직후)

| 페이즈 | 판정 | 비고 |
| :---- | :--: | :---- |
| P0 결정 | **PASS** | `346e56e`+`2e0caa1` (역사) |
| P1 스키마 | **PASS** | `c467268`+`32a9c38`. 12파일 적용 — 검수 컬럼·E1은 재정의 P3에서 제거 예정 |
| P2 백필 | **PASS** (2026-06-11 재채점 — 종전 CONDITIONAL) | P2-5 게이트 폐기(인바운드 전환으로 트랙 소멸). 466행 = 인터림 초기 코퍼스 |
| P3 (재정의: 읽기 컷오버+검수 제거) | 미채점 | 1차 선행 개발 완료(`0289557` — 검수 모델 기준, 일부 재작업 필요). RT-3 읽기 전용 선행 대사 240필드 PASS(`d399056`) |
| P4 (관리 포인트 개방) | 미착수 | RPC·스캐폴딩 결선 상태(`OPERATION_WRITE_ENABLED=false`) |
| P5 / P6 (마스터 / 공급 API 수신) | 미착수 | P6은 D-11 공급 계약 회신 게이트(외부 API 미개발) |

## 2. 이번 세션(2026-06-11)에서 끝난 것

1. **D-3 분류 소유권 판정·집행**(`17d5f01`·`51dbe7a`) — 같은 날 인바운드 전환으로 폐기됨(역사).
2. **RT-3 읽기 전용 필드 대사**(`d399056`): 10문항 샘플 × 뷰 8 + 테이블 12 + 정합 4 = 240필드 ALL PASS. 도구 `.omx/evidence/rt3-field-reconcile.mjs`.
3. **인바운드 모델 전환 + SoT 일괄 개정**(본 커밋): 결정기록 §0 신설 + D행 처분, 실행계획안 개정(P3~P6 재정의·P2-5 폐기·P2 재채점 PASS), data-source-transition §10.2~10.4, POL-017/018 재정의, 양 IA 전면 재작성(문항 목록/문항 관리), page-sync·page-tables #19/#19-1·usage-map·action-log·data-contract §9.6/§12(+§12.6 수신 계약 신설)·gap-register §4.7(신규 갭 2건), api-reference admin 주석, 요청서 인바운드 재작성, 발주서·P2-5 샘플·D-3 브리프 폐기 배너.

## 3. 다음 작업 절차 (순서대로)

1. **D-11 공급 계약 요청 발신**(외부 — 오너 채널): `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`(인바운드 재작성본). P6 게이트이며 리드타임 최장 — 조기 발신 권장. P3~P5는 이와 무관하게 진행 가능.
2. **재정의 P3 실행**(P2 PASS — 착수 가능):
   1. §7.1 컷오버 절차: freeze 윈도 → ETL 델타 재적재(마지막 동기화) → 발산 0건 대사 → 데이터 소스 스위치(`src/features/assessment/api/question-bank-data-source.ts`) 기본값 'topik_writing' 플립 + **검수 표면 제거 코드** 배포.
   2. 검수 표면 제거: 검수 페이지 정체성 재구성(question-bank="문항 목록" 조회 전용), 검수 액션/메모 UI 삭제, `admin_update_topik_question`에서 검수 필드 화이트리스트 제거, 모델·스키마·presenter·URL 파라미터(`reviewStatus`)·상태 사전 정리, 상세 라우트 `/review/:questionId` 개명, e2e·vitest 재작성.
   3. 검수 4컬럼 제거 마이그레이션(4테이블 동시 + 추천 뷰 재생성 + ETL transform 검수 필드 기록 중지). down 스크립트 의무.
   4. 검증: RT-3(배포본 기준 재확인 — 선행 대사 도구 재사용), 검수 잔존 0건(grep+스키마 스냅샷), build·e2e·harness:check.
   5. problems read-only 동결 + 구 어댑터 플래그 봉인 유지(§12.2 롤백 경로).
   6. 문서 동기화(§11 P3 행) → P3 채점(§12.3 재정의 채점표) → 2단계 커밋(작업→채점).
3. **P4 — 관리 포인트 개방**: `OPERATION_WRITE_ENABLED` 게이트 제거 + facade `updateServiceStatus` 개방, 태그 부여/제거 UI(`admin_assign_question_tag`/`admin_remove_question_tag` — 서버측 가드 존재), RT-4 관리 쓰기 왕복(태그·service_status→DB→재반영→감사), POL-018 개정 기준(②③) 반영.
4. **P5 → P6**: 마스터 surface → 공급 API 수신 연동(계약 회신 후 — §10 재정의: 수신 페이로드 검증·idempotent 적재·question_received 감사).

## 4. 미해결·주의 사항

1. **외부 공급 API 미개발** — 신규 문항 유입 경로 부재(갭 레지스터 신규 갭 ①, 리스크 R6 🔴). D-11 요청서 발신은 오너 액션.
2. **검수 표면·컬럼이 아직 물리 존재**(갭 ②): 코드(검수 페이지·RPC 검수 분기)와 DB(검수 4컬럼+값)는 재정의 P3에서 제거 — 그 전까지 문서는 "사실+제거 예정" 표시로 정합 유지.
3. **컷오버 스위치 규율**: `question-bank-data-source.ts` 기본값은 P3 실행 전까지 'legacy' 유지. 신규 스키마 검증은 env `VITE_QUESTION_BANK_SOURCE=topik_writing`(로컬)로만.
4. **DB 상태**: 신규 4테이블 466행+source_map 470행(전 행 internal_test), question_tags 0행. 이번 세션 DB 쓰기 0건.
5. **e2e**: 모크 모드 `npm run test:e2e:mock`. 4177 포트 좀비 dev 서버 시 playwright 타임아웃 — `Get-NetTCPConnection -LocalPort 4177` 확인.
6. **BOM 함정**: `data/etl/reclassification-input.json` 수정은 Node 경유(PowerShell Set-Content는 BOM 부착).
7. **자격증명**: ETL·e2e admin 계정은 `.env.local`. 토큰·secret 회전 권고 여전히 유효.
8. 커밋 규율: 작업→채점 2단계, MD 수정은 `logs/admin-doc-update-log.md` 기록, `npm run harness:check` 필수(AGENTS.md).
9. **`.omx/evidence/` 지우지 말 것**(비추적): `etl/`(P2 증적), `rt3-field-reconcile.mjs`(RT-3 도구), `debug-topik-writing-read.mjs`, `make-p2-5-sample.mjs`(폐기 트랙 산출물이나 RT-3 표본 생성기로 재사용).
