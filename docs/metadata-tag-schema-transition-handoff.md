# 메타데이터·태그 스키마 전환 — HANDOFF (P3 채점 CONDITIONAL 직후, 2026-06-11)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (재정의 P3 문서 동기화 + 채점 직후 — 종전 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 ① **0013 마이그레이션 적용(유일 잔여 차단 — `SUPABASE_ACCESS_TOKEN` 필요)** ② P3-4 재채점 → P3 PASS 전환 ③ P4 착수부터 곧바로 이어가도록 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (2026-06-11 인바운드 개정 — §12.4 스코어카드 P3 행 기록됨) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (**§0 = 인바운드 전환**) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0~P2 채점 + P2 재채점 + 재정의 P3 실행·문서 동기화·**P3 채점 절**) |

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
| P2 | **PASS** (2026-06-11 재채점 — P2-5 게이트 폐기) | 466행 = 인터림 초기 코퍼스 |
| **P3 (재정의)** | **CONDITIONAL** (2026-06-11 채점) | P3-1·2·3·5·6·7 전부 PASS. **P3-4만 대기 = 0013 마이그레이션 DB 적용(토큰 부재)**. 해소 후 재채점 PASS 전환 → P4 착수 가능 (§3) |
| P4~P6 | 미착수 | P3 PASS 전환 전 P4 착수 불가(§12.3 규칙). P4 진입점은 결선됨(§3-4) |

## 2. 최근 커밋 흐름 (2026-06-11)

1. `f4c0cb7` — 인바운드 모델 전환 + SoT 22파일 일괄 재작성.
2. `202f905` — **재정의 P3 코드 실행**: §7.1 컷오버 1~4(freeze → 델타 재적재 드리프트 0 → verify 8체크 → **스위치 기본값 'topik_writing' 플립**, 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`) + 검수 표면 전면 제거(상세 파일 개명 `assessment-question-detail-page.tsx`, 라우트 `…/:questionId` 개명) + 0013 마이그레이션 작성(+down, **미적용**) + ETL 검수 기록 중지. 검증: vitest 39/39, e2e 5/5(모크), RT-3 190필드 ALL PASS(실DB), build·harness 통과.
3. `ec63e00` — 핸드오프(종전판).
4. `77d01bd` — **P3-7 문서 동기화(§11 P3 행)**: "제거 예정" 마커 → "제거 완료(202f905)" 전면 갱신(양 page-IA·page-sync·page-tables #19/#19-1·data-usage-map·action-log·data-source-transition §10.2 역사 동결·gap-register·admin-overview) + **data-contract §9.6 신규 스키마 기준 재작성**. 구분 원칙: 화면·코드 = 제거 완료 / DB 컬럼·RPC = 0013 적용 대기. harness PASS.
5. (이번 커밋) — **P3 채점**: 증적 로그 P3 채점 절 + §12.4 스코어카드 P3 행(**CONDITIONAL** — P3-4만) + 본 핸드오프 갱신.

## 3. 다음 작업 절차 (순서대로)

1. **0013 마이그레이션 적용 — 유일 잔여 차단**: `SUPABASE_ACCESS_TOKEN`(Management API, sbp_…) 확보 후:
   ```
   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; npm run db:migrate
   ```
   → 적용 후 확인: `npm run db:snapshot`(검수 4컬럼 부재 + 뷰 16컬럼), `node .omx/evidence/rt3-field-reconcile.mjs`(190필드 재확인), `npm run etl:load && npm run etl:verify`(갱신 ETL idempotency — 선택). 신규 코드는 적용 전 DB와도 호환(검수 컬럼 미참조)이므로 순서 리스크 없음. 롤백: `node scripts/db/migrate.mjs --down 20260611190100_topik_writing_drop_review_columns.sql`(값 복원 불가 — down 헤더 참조).
2. **P3-4 재채점 → P3 PASS 전환**: 증적 로그 P3 채점 절에 재채점 추기(스키마 스냅샷·RT-3 증적 링크) + §12.4 스코어카드 P3 행 PASS 갱신 + 채점 커밋. 이때 잔존 0건 검증 마무리: 스냅샷에서 검수 4컬럼 부재·구 RPC 검수 화이트리스트 부재 확인.
3. **problems read-only 동결 선언**(§7.1-6 — v13 합의 절차, 결정 기록 §2.3): admin 코드는 이미 problems에 쓰지 않음. 공지·기록만.
4. **P4 — 관리 포인트 개방** (P3 PASS 전환 후): facade `SERVICE_STATUS_WRITE_ENABLED` 플래그 + manage 페이지 `OPERATION_WRITE_ENABLED` 제거(노출 통제 경로는 `setTopikWritingServiceStatus`로 결선 완료), 태그 부여/제거 UI(`admin_assign_question_tag`/`admin_remove_question_tag` RPC 존재), RT-4 관리 쓰기 왕복, POL-018 ②(운영주의 태그 사유 필수) 가드.
5. **D-11 공급 계약 요청 발신**(오너 — 외부): `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`. P6 게이트(병행 가능).

## 4. 미해결·주의 사항

1. **`SUPABASE_ACCESS_TOKEN` 부재**: `.env.local`·셸·사용자/머신 env 모두 없음(7차 세션 재확인). 0013 적용·스키마 스냅샷에 필요. service-role 키(`SUPABASE_SECRET_KEY`)로는 DDL 불가.
2. **DB 현 상태**: 검수 4컬럼·18컬럼 뷰·구 RPC(검수 화이트리스트)가 **아직 물리 존재**(0013 미적용). 신규 코드는 이를 사용하지 않으므로 동작 무관. P3-4 재채점은 적용 후에만.
3. **스위치 규율(역전됨)**: 기본값 = 'topik_writing'. 롤백 = env `VITE_QUESTION_BANK_SOURCE=legacy`(구 어댑터는 읽기 전용 — P4 종료까지 보존, §12.2).
4. **e2e admin 실DB 확인**: 모크 e2e + RT-3(DB 직조회)로 검증됨. 브라우저 실DB 확인을 원하면 `.omx/evidence/debug-topik-writing-read.mjs`는 **구 검수 화면 기준이라 깨짐** — 새 화면(문항 목록/상세) 기준으로 수정 필요(상세 라우트·버튼 라벨 변경됨).
5. e2e 모크는 `npm run test:e2e:mock`(4177 좀비 dev 서버 주의 — `Get-NetTCPConnection -LocalPort 4177`).
6. BOM 함정: `data/etl/reclassification-input.json` 수정은 Node 경유. (md 일괄 치환 시 PowerShell `Set-Content`도 BOM·CRLF를 만든다 — Edit 도구 사용 권장.)
7. 커밋 규율: 작업→채점 2단계, MD 수정 시 `logs/admin-doc-update-log.md`(IA 수정 시 `docs/specs/admin-page-ia-change-log.md` 동반), `npm run harness:check` 필수.
8. **`.omx/evidence/` 보존**: `etl/`(P2·델타 증적), `rt3-field-reconcile.mjs`(RT-3 도구 — 검수 필드 제외판), `p2-5-sample.json`(RT-3 표본).
9. 인터림 코퍼스 466행 전 행 `internal_test`(노출 차단) — P4 개방 전 불변. question_tags 0행.
10. 실행계획안 §7.2 변경 파일 표는 1차 선행 개발(구 모델) 기준 역사 기록 — 현행 사실은 data-contract §9.6(재작성본)·양 page-IA·증적 로그 재정의 P3 실행 절 기준.
