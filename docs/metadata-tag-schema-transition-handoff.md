# 메타데이터·태그 스키마 전환 — HANDOFF (P3 PASS 전환 직후, 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (0013 적용 + P3 재채점 PASS 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 ① problems read-only 동결 선언 ② **P4 — 관리 포인트 개방**부터 곧바로 이어가도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (2026-06-11 인바운드 개정 — §12.4 스코어카드 P3 = **PASS**) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환**) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P3 채점 + P3 재채점 절) |

## 0. 아키텍처 (2026-06-11 확정 — 결정 기록 §0)

```
외부(공급) API[문제 발원 — 미개발] → admin 수신·적재(Supabase topik_writing_51~54 + source_map)
  → admin 관리 포인트 = 태그(schema-rule §2) + 노출 통제 = service_status(D-6)
  → v13 read-only 소비.  검수 개념 = 전면 삭제.
```

## 1. 진행 상태

| 페이즈 | 판정 | 비고 |
| :---- | :--: | :---- |
| P0·P1 | PASS | 역사 |
| P2 | **PASS** (재채점 — P2-5 게이트 폐기) | 466행 = 인터림 초기 코퍼스 |
| **P3 (재정의)** | **PASS** (2026-06-11 재채점 — 0013 적용으로 P3-4 해소) | 컷오버·표면 제거·컬럼 물리 제거·문서 동기화 전부 완료. **P4 착수 가능** |
| P4~P6 | 미착수 | P4 진입점 결선됨(§3-2). P6은 D-11 외부 게이트 |

## 2. 최근 커밋 흐름 (2026-06-11)

1. `f4c0cb7` — 인바운드 모델 전환 + SoT 22파일 일괄 재작성.
2. `202f905` — **재정의 P3 코드 실행**: 컷오버 1~4(스위치 기본값 'topik_writing' 플립, 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`) + 검수 표면 전면 제거(상세 파일 `assessment-question-detail-page.tsx` 개명, 라우트 `…/:questionId`) + 0013 작성 + ETL 검수 기록 중지.
3. `77d01bd` — **P3-7 문서 동기화**: "제거 예정" 마커 → "제거 완료" 전면 갱신 + data-contract §9.6 신규 스키마 기준 재작성.
4. `7a0f850` — P3 채점(CONDITIONAL — 당시 P3-4 토큰 대기).
5. (이번 커밋) — **0013 적용 + P3 재채점 PASS 전환**: `db:migrate` 성공, 스냅샷(4테이블 검수 컬럼 0건·뷰 16컬럼), RPC 원문 검수 참조 0건, RT-3 190필드 재확인, `etl:verify` 8체크 PASS(transform 재생성 후 RT-2 466행 diff 0건).

## 3. 다음 작업 절차 (순서대로)

1. **problems read-only 동결 선언**(§7.1-6 — v13 합의 절차, 결정 기록 §2.3): admin 코드는 problems에 쓰지 않음(이미 사실). 공지·기록만 — 오너/v13 채널.
2. **P4 — 관리 포인트 개방**(실행계획안 §8, 채점표 §12.3 P4):
   - facade `SERVICE_STATUS_WRITE_ENABLED` 플래그 제거 + manage 페이지 `OPERATION_WRITE_ENABLED` 제거 — 노출 통제 경로는 `setTopikWritingServiceStatus`(facade)→`admin_update_topik_question` 결선 완료.
   - 태그 부여/제거 UI 신설(`admin_assign_question_tag`/`admin_remove_question_tag` RPC 프로덕션 존재 — 검수 참조 0건 확인됨), 사유 memo 필수.
   - POL-018 ② 가드(운영주의 태그 활성 문항 `available` 전환 사유 필수 — 모달 문구는 이미 반영됨, 화면 강제 검사 구현)·③ 반복과다 `excluded` 권고.
   - **RT-4 관리 쓰기 왕복**(화면 write → DB 직조회 → 화면 재반영 → 감사 로그 역추적) + write e2e + RLS 직접 write 차단 확인 = P4 게이트(§12.1).
   - 문서 동기화(§11 P4 행: page-tables 액션 행·action-log 신규 계약·양 IA 액션·page-sync 감사 행·gap-register write 게이트 해소) + 채점.
3. **D-11 공급 계약 요청 발신**(오너 — 외부): `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`. P6 게이트(병행 가능).

## 4. 미해결·주의 사항

1. **`SUPABASE_ACCESS_TOKEN`**: 이번 세션부터 `.env.local`에 존재(sbp_…, gitignore 대상). 단 `db:*` 스크립트는 dotenv를 안 읽으므로 **셸에 주입 필요**: `$env:SUPABASE_ACCESS_TOKEN = ((Select-String -Path .env.local -Pattern '^SUPABASE_ACCESS_TOKEN=').Line -split '=',2)[1]`. 보안 회전·제거는 오너 판단(과거 회전 권고 이력 있음).
2. **DB 현 상태**: 0013 적용 완료 — 검수 4컬럼·구 18컬럼 뷰·RPC 검수 화이트리스트 전부 물리 제거됨. 스냅샷 `.omx/evidence/schema-snapshot-post-0013.json`(검증기 `check-post-0013-snapshot.mjs`), RPC 원문 `post-0013-rpc-defs.json`. down 스크립트는 구조 복원만(값 복원 불가 — 값 원본은 source_map·legacy `problems`).
3. **스위치 규율**: 기본값 = 'topik_writing'. 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`(읽기 전용 어댑터 — P4 종료까지 보존, §12.2).
4. **e2e admin 실DB 확인**: 모크 e2e + RT-3(DB 직조회)로 검증됨. 브라우저 실DB 확인 원하면 `.omx/evidence/debug-topik-writing-read.mjs`는 구 검수 화면 기준이라 깨짐 — 새 화면 기준 수정 필요.
5. e2e 모크는 `npm run test:e2e:mock`(4177 좀비 dev 서버 주의 — `Get-NetTCPConnection -LocalPort 4177`).
6. BOM 함정: `data/etl/reclassification-input.json` 수정은 Node 경유. md 일괄 치환 시 PS `Set-Content`도 BOM/CRLF 생성 — Edit 도구 권장. PS 리다이렉트(`>`)는 UTF-16 — 파일 저장은 `cmd /c` 경유.
7. 커밋 규율: 작업→채점 2단계, MD 수정 시 `logs/admin-doc-update-log.md`(IA 수정 시 `docs/specs/admin-page-ia-change-log.md` 동반), `npm run harness:check` 필수.
8. **`.omx/evidence/` 보존**: `etl/`(P2·델타·0013 후 verify 증적), `rt3-field-reconcile.mjs`(190필드 판), `schema-snapshot-post-0013.json`·`check-post-0013-snapshot.mjs`·`post-0013-rpc-defs.json`, `p2-5-sample.json`(RT-3 표본).
9. 인터림 코퍼스 466행 전 행 `internal_test`(노출 차단) — P4 개방 전 불변. question_tags 0행. 보류 4행 = `audit_seed` 예시(신규 ID `-0001` — 프로브는 `-0002`부터).
10. ETL 산출물 주의: 0013 이후 `etl:verify`는 **갱신 transform 산출물 기준**이어야 RT-2가 맞는다(구 산출물엔 검수 필드 포함 — 이번 세션에서 `etl:transform` 재생성으로 정리됨). `etl:load`는 P4 전 불필요.
11. 실행계획안 §7.2 변경 파일 표는 1차 선행 개발(구 모델) 역사 기록 — 현행 사실은 data-contract §9.6(재작성본)·양 page-IA·증적 로그 기준.
