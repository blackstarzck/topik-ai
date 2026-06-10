# 메타데이터·태그 스키마 전환 — HANDOFF (P2 채점 완료 CONDITIONAL, 4차 세션 종료 시점)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-10 (P2 본 적재·검증·리허설·채점까지 완료 후 작성 — 3차 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 P2-5 해소(외부 대기) 확인과 P3 선행 개발부터 곧바로 이어갈 수 있도록 상태·산출물·다음 단계·주의사항을 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (P0~P6, §12.3 PASS 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (D-1~D-13 확정값 + v13 경계 합의) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0·P1·P2 채점표) |

## 1. 진행 상태 (2026-06-10 4차 세션 종료 기준)

| 페이즈 | 판정 | 핵심 증적 |
| :---- | :--: | :---- |
| P0 결정 확정 | **PASS** | 커밋 `346e56e` + `2e0caa1`. D-1~D-13 확정, freeze 가드 5곳 해제 |
| P1 스키마 구축 | **PASS** | 커밋 `c467268`. 마이그레이션 12파일 프로덕션 적용, 무변경 diff 0건, RT-1 ALL PASS |
| P2 백필 ETL | **CONDITIONAL (채점 완료)** | 본 적재 466행+보류 4행, 검증 8체크 ALL PASS, idempotency 해시 동일, 델타 리허설 발산 0건. **유일 잔여 = P2-5(콘텐츠팀 10문항 샘플 승인 — 발주서 미발신)**. 증적 로그 P2 절 |
| P3 | **선행 개발 완료 (2026-06-11, 미채점)** | §7.2 변경 파일 전체 + 컷오버 스위치(기본 legacy 유지 — 배포 아님) + D-12 모크 모드 결선. e2e 5/5·빌드·실DB 읽기 프로브 466행 확인. 증적 로그 P3 진행 메모 절. **컷오버 배포·채점은 P2 PASS 전환 후** |
| P4~P6 | 미착수 | P4는 P3 PASS 후(코드상 OPERATION_WRITE_ENABLED 플래그 + facade 게이트 제거가 진입점) |

## 2. 이번 세션(4차)에서 끝난 것

### 2.1 q52 cf=ref 잔여 22행 표적 적대 감사 (구 핸드오프 §3-1)

- 워크플로 `wf_7ccb36f0-542`(에이전트 38개): 감사관 4인(행 분담, ㄱ/ㄴ 스팬 본문 대조) + 플래그별 독립 판정관 2인. 플래그 17건 → **교체 17건**(2인 일치 16 + 분열 1건 `352b7c74` 주 루프 판정: 라운드 내 일관성 원칙으로 '조건 제시'). 무플래그 5행(`1828acb9`·`29066193`·`2f989b36`·`a5351852`·`ac7cc645`)은 정당 중복 확인 — 가설 실측치 17/22 오류·5/22 정당.
- 반영 후 전 행 재검증 위반 0건, `test:unit` 43개 PASS. 증적: `.omx/evidence/etl/audit/`의 `sample-52-cfref.json`·`cfref-audit-workflow-output.txt`·`audit-decisions-cfref.json`·`make-cfref-sample.mjs`/`apply-cfref-corrections.mjs`.

### 2.2 본 적재 + 검증 + idempotency + 델타 리허설 (구 핸드오프 §3-2~4)

- transform: 470 = 466 적재(51:90/52:76/53:62/54:238) + 4 보류(전건 `audit_seed` 예시 행 — 재입력 발주 대상 0건 판정). load 1회차 후 verify **8체크 ALL PASS**(재조립/보존/수량/축/RT-2/D-6/source_map 대사).
- idempotency: load 2회차 전 테이블 sha256 동일(5/5) + verify 재실행 PASS. 리포트: `.omx/evidence/etl/load-report-1781089{118118,178877}.json`, `verify-report-…json`.
- 델타 리허설: 덤프 사본에 검수 변경 2건 시뮬레이션(52 `807c0fe3` pending→approved, 54 `096d5849` 메모 수정) → 델타 적재 따라잡기 ALL PASS(51·53 해시 불변 — 변경 국소성) → 원본 재적재로 원상 수렴 **발산 0건**. `problems` 쓰기 0건 유지.
- 도구 수정 1건: `scripts/etl/verify-backfill.mjs` selectAll 정렬 컬럼 매개변수화(topic_master에 question_id 부재 — 첫 실전 실행에서 발견).

### 2.3 채점·문서 동기화 (구 핸드오프 §3-5~6)

- P2 채점표: P2-1~P2-4·P2-6 PASS, P2-7 PASS(권장), **P2-5 CONDITIONAL** → 종합 **CONDITIONAL**(증적 로그 P2 절 + 스코어카드 §12.4).
- 문서 동기화: transition 문서 §10.4 백필 기록, 데이터 계약 §12.2 적재 수치 블록, gap-register §4.7(P2 실적 + 원천 title/hints 오염 3행 메모), doc-update-log, harness:check.

## 3. 다음 작업 절차 (순서대로)

1. **P2-5 해소 (외부 — 오너 액션)**: 콘텐츠팀 발주서(`docs/requests/content-team-order-2026-06-10.md`) 오너 채널 발신 → 10문항 샘플 승인 회신 수령. 회신 도착 시: 증적 로그 P2-5 행과 §12.4 스코어카드 P2 행을 재채점해 **PASS 전환 기록**(2단계 커밋 패턴). 승인 과정에서 분류 수정이 나오면 입력표 보정 → transform/load/verify 재실행(idempotent — 리허설로 검증된 경로).
2. ~~P3 선행 개발~~ → **완료(2026-06-11, 5차 세션)**: §7.2 변경 파일 전체 재작성 + 신설 4종(컷오버 스위치 `question-bank-data-source.ts`·신규 스키마 어댑터·D-12 모크 어댑터·마스터 로딩 훅). **기본 데이터 소스는 legacy 유지** — 컷오버 = `question-bank-data-source.ts` 기본값 플립(또는 `VITE_QUESTION_BANK_SOURCE=topik_writing`) 1곳. 검증: e2e 5/5(`npm run test:e2e:mock`)·빌드·vitest 43개·실DB 읽기 프로브(466행, 읽기 전용). 상세 증적: 증적 로그 P3 진행 메모 절.
3. **P3 컷오버 배포 (P2 PASS 전환 후에만)**: §7.1 절차 — 검수 freeze 윈도 → 델타 재적재(P2-6 리허설 경로 재사용) → 신·구 발산 0건 대사 → 기본 소스 플립 배포 → `problems` read-only 동결. 이후 RT-3 필드별 대사·RT-4 검수 쓰기 왕복(감사 로그 역추적)·문서 동기화(§11 P3 행)·P3 채점.

## 4. 미해결·주의 사항

1. **외부 발신 2건 여전히 미발신**: 콘텐츠팀 발주서(P2-5 게이트)·상류 요청서(P6 게이트). 오너 채널 발신 필요 — P2 PASS 전환의 유일 차단 요소.
2. **DB 상태**: 신규 4테이블 466행 + source_map 470행 적재 완료(전 행 `service_status='internal_test'` — 사용자 노출 차단), question_tags 0행(P4 개방). `problems`는 P3 컷오버까지 검수 SoT — ETL은 계속 읽기 전용(이번 세션 problems 쓰기 0건). 재적재는 transform→load 재실행만으로 안전(idempotent 증명 완료).
3. **BOM 함정**: PowerShell `Set-Content`/`Out-File`로 `data/etl/reclassification-input.json`을 수정하면 BOM이 붙는다. 수정은 Node 경유 권장(감사 반영 전부 Node로 수행, 현재 BOM 없음).
4. **자격증명**: `.env.local`의 `SUPABASE_SECRET_KEY` 등은 ETL 스크립트가 자동 로딩(`lib/env.mjs`). **토큰·secret 회전 권고 여전히 유효**(이전 핸드오프 기록 — transcript 노출 이력).
5. 현행 admin 검수 쓰기는 라이브 DB 기준 동작 불가(구 RPC 부재) — P3 컷오버가 해소 경로(변경 없음).
6. 페이즈 산출물 커밋 규율: 작업 커밋 → 채점 커밋 2단계, 모든 MD 수정은 `logs/admin-doc-update-log.md` 기록, `npm run harness:check` 필수(AGENTS.md).
7. **`.omx/evidence/etl/` 지우지 말 것**(비추적·정식 증적 아님): `problems-dump.json`(재생성 가능), `classify/`(분류 배치 — 유실 시 재분류 비용 큼), `audit/`(표본·표적 감사 증적 원본 — 워크플로 출력·판정 기록·반영 도구), `transform-out*/`·`load-report-*.json`·`verify-report-*.json`(P2 채점 증적), 일회성 도구들. 세션 리밋 참고: 표적 감사 워크플로는 에이전트 38개·토큰 약 169만 소모.

## 5. P3 이후 요약 (변경 없음 — 상세는 실행계획안 §7~§10)

- P3: 읽기+검수 쓰기 동시 컷오버(변경 파일 §7.2 11파일, RT-3/RT-4, freeze→델타→발산 0건 대사, D-12 모크 모드 결선). P4: 운영 write+태그. P5: 마스터 조회. P6: 상류 연동(요청서 회신 게이트, task52 부재 이슈).
