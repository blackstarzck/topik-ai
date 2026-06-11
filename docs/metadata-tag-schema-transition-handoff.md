# 메타데이터·태그 스키마 전환 — HANDOFF (6차 세션 종료 시점 — D-3 분류 주체 거버넌스 결정 보류 중)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-11 (6차 세션 — 5차 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 ① **D-3 분류 주체 재배정 결정(보류 중 — §0)을 먼저 확인**, ② 그 결정에 따라 P2-5 경로 재정렬, ③ P2 PASS 전환 → P3 컷오버로 이어갈 수 있도록 상태·산출물·다음 단계·주의사항을 인수인계 |

## 0. ⚠️ 최우선 — D-3 분류 작성 주체 거버넌스 결정 보류 중 (6차 세션 발견)

6차 세션에서 P2-5(콘텐츠팀 샘플 승인) 게이트의 정당성을 조사한 결과, **개발 측이 콘텐츠팀의 분류 작성 책임을 떠안은 역할 전도**가 확인됐다. 이는 다음 모든 작업의 방향을 좌우하므로 **결정 전까지 분류 트랙(P2-5 발신·재채점, P3 컷오버)을 진행하지 말 것.**

- **발견 요지**: 원안(`metadata-tag-schema-rule.md` §6.1/§6.3 + 실행계획안 D-3 L94·L118)은 문항 분류를 **콘텐츠팀 산출물**로 규정하고 자동 변환을 금지했다. 그러나 발주서 미발신으로 개발 측이 분류 466행을 직접 생성(`evidence:181` 분류 에이전트 24배치)했고, 결정기록 D-3(`:19`)가 이를 "오너 위임"으로 사후 재배정했다. 이 재배정은 원안과 불일치하며, P2-5는 그 자가생성 분류를 추인받는 비대칭 게이트로 작동 중이다.
- **결정 위임**: 오너가 본 결정을 외부 결정자(GPT-5.5)에게 위임. **자족 결정 브리프 작성 완료** — `docs/architecture/d3-classification-ownership-decision-brief.md`(질문·증거 A~F·선택지 3종·결정자 요청 산출 4가지). Claude는 GPT-5.5를 직접 호출할 수단이 없어 브리프 전달 형태로 위임.
- **선택지 요약**: ①재배정 철회(분류=콘텐츠팀 복원) ②재배정 유지(현 구조, 발주서 발신만 하면 진행) ③절충(작성 주체=콘텐츠팀, 개발 초안을 공식 시작점).
- **결정 도착 시 집행**: 브리프 §"결정 후 후속" 절대로 — 옵션 1/3이면 D-3·실행계획안 D-3·P2-5 문안 수정 + 466행 초안 위상 재기재 + 발주서/회신 가이드 갱신 + harness:check + doc-update-log + 2단계 커밋. 옵션 2면 변경 없이 발주서 발신(오너) 대기. 어느 경우든 `service_status=internal_test` 노출 차단은 P2-5 PASS 전까지 유지(D-6).

### 6차 세션 산출물 (커밋됨)
- `docs/requests/content-team-p2-5-sample-2026-06-11.md` — P2-5 10문항 샘플 검토 시트(초안). 결정적 선정(번호 51:2/52:3/53:2/54:3, topic_main 10종 distinct, 보조 4건, 난이도 3·4·5), 본문 발췌 + 초안 분류값 + 입력표 근거. **역할 경계 명시**: 분류 판정은 콘텐츠팀, 개발은 충실 추출만. 14개 주제쌍 topic_master 시드 대조 OK. 생성기 `.omx/evidence/make-p2-5-sample.mjs`(읽기 전용).
- `docs/architecture/d3-classification-ownership-decision-brief.md` — 위 결정 브리프.
- ※ 분류 트랙은 위 결정 대기로 정지. 결정 무관·게이트 무관한 개발 작업(RT-3 읽기 전용 대사)은 §3-3대로 진행 가능.
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (P0~P6, §12.3 PASS 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (D-1~D-13 확정값 + v13 경계 합의) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0·P1·P2 채점표 + P3 진행 메모) |

## 1. 진행 상태 (2026-06-11 5차 세션 종료 기준)

| 페이즈 | 판정 | 핵심 증적 |
| :---- | :--: | :---- |
| P0 결정 확정 | **PASS** | 커밋 `346e56e`+`2e0caa1`. D-1~D-13 확정 |
| P1 스키마 구축 | **PASS** | 커밋 `c467268`+`32a9c38`. 마이그레이션 12파일 프로덕션 적용, RT-1 ALL PASS |
| P2 백필 ETL | **CONDITIONAL (채점 완료)** | 커밋 `ab0aa98`+`09e2309`. 본 적재 466행+보류 4행, verify 8체크·idempotency·델타 리허설 ALL PASS. **유일 잔여 = P2-5(콘텐츠팀 10문항 샘플 승인 — 발주서 미발신)** |
| P3 읽기·검수 컷오버 | **선행 개발 완료 (미채점)** | 커밋 `0289557`. §7.2 변경 파일 전체 + 컷오버 스위치(기본 legacy — **배포 아님**). 증적 로그 P3 진행 메모 절 |
| P4~P6 | 미착수 | P4 진입점은 코드에 자리 확보됨(§3-7) |

## 2. 이번 세션(5차)에서 끝난 것 — P3 코드 선행 개발 (커밋 `0289557`)

### 2.1 아키텍처 핵심: 컷오버 스위치

- `src/features/assessment/api/question-bank-data-source.ts` — 문제은행 데이터 소스 3모드:
  - `legacy`(**현재 기본값**): 구 `problems` 읽기 + `admin_update_problem` 쓰기(서버에 RPC 부재 — 알려진 제약). 컷오버 후에도 P4 종료까지 롤백 경로로 봉인 보존(§12.2).
  - `topik_writing`: 신규 스키마 — env `VITE_QUESTION_BANK_SOURCE=topik_writing`으로 로컬 검증 가능.
  - `mock`: Supabase 미구성 시 자동 — D-12 CI/스모크 경로.
- **컷오버 배포 = 이 파일의 기본값을 'topik_writing'으로 플립하는 1줄 + §7.1 절차. 롤백 = 역플립.** P2 PASS 전환 전에는 절대 플립하지 않는다.

### 2.2 산출물 요약 (상세: 증적 로그 P3 진행 메모 절)

- 모델: `AssessmentQuestionSummary`(추천 뷰 18컬럼 1:1)/`Detail`(번호별 테이블) 분리, §3.3 ASCII 코드+한국어 라벨 사전, 번호별 content 4변형 실컬럼화, sentinel 9필드 제거 — `model/assessment-question-bank-{types,schema,presenter}.ts`.
- 어댑터: 신규 `api/topik-writing-question-bank-service.ts`(뷰 목록 1회 조회 + question_id 라우팅 상세 + topic_master/태그 로더 + `admin_update_topik_question` 검수 쓰기 — `content_team_memo` 실영속·`__note` 감사 payload), `api/mock-question-bank-service.ts`(D-12 픽스처 4문항·인메모리 write 왕복), legacy 어댑터는 신규 모델 매핑으로 재작성. facade가 스위치로 라우팅.
- 화면: 검수 목록(주제 종합/세부 축·검수 3값 카드), 문항 관리(`service_status` 축·태그 수·P4 대기 조치 3종), 검수 상세(번호별 실메타 + 메모 저장 + 검수 완료/사용 보류/검수 필요), 툴바(topic_master 2단 셀렉트·난이도 1~6), `status-column-title` 사전 갱신.
- 검증: lint/typecheck/build/vitest 43개 PASS. e2e 5/5 PASS(`npm run test:e2e:mock` 신설 — 검수 write 왕복 포함). **실DB 읽기 프로브**(읽기 전용, e2e admin 로그인): 목록 466문항·상세 4개 번호·manage 카드 "내부 테스트 466/노출 0" — P2 백필 상태와 일치. 도구 `.omx/evidence/debug-topik-writing-read.mjs`.

## 3. 다음 작업 절차 (순서대로)

> ⚠️ **선행 차단**: 아래 1·2단계(분류 트랙)는 **§0의 D-3 분류 주체 결정이 도착해야** 진행한다. 옵션 1/3(재배정 철회/절충)이면 1단계 자체가 재정의된다. 결정 전에는 §3-3(RT-3 읽기 전용)만 진행 가능.

1. **P2-5 해소 확인 (§0 결정 후 — 외부·오너 액션 선행)**: 콘텐츠팀 발주서(`docs/requests/content-team-order-2026-06-10.md`) + 6차 샘플 시트(`docs/requests/content-team-p2-5-sample-2026-06-11.md`) 오너 채널 발신 → 10문항 샘플 승인 회신. 회신 도착 시:
   - 승인 과정에서 분류 수정이 나오면: `data/etl/reclassification-input.json` 보정(Node 경유 — §4-5) → `npm run etl:transform` → `npm run etl:load` → `npm run etl:verify` 재실행(idempotent 증명 완료 — 채번·기존 행 안전) → 작업 커밋.
   - 재채점: 증적 로그 P2-5 행 CONDITIONAL→PASS(승인 기록 증적 첨부) + 종합 PASS 전환, 실행계획안 §12.4 스코어카드 P2 행 갱신 → 채점 커밋.
2. **P3 컷오버 (P2 PASS 후에만, §7.1)**:
   1. 검수 freeze 윈도 선언(운영 공지 — 현행 검수 쓰기는 어차피 불능이지만 절차 준수).
   2. 델타 재적재: `npm run etl:extract`(신규 덤프) → `etl:transform` → `etl:load` → `etl:verify`. source_map 470건 선조회로 채번 유지됨.
   3. 신·구 발산 0건 대사: verify 리포트(RT-2 diff 0건) + `review_status`/`review_workflow_status`/메모 영향 컬럼 — P2-6 리허설에서 검증된 경로.
   4. `question-bank-data-source.ts` 기본값 'topik_writing' 플립 → `npm run harness:check`+`build` → 배포(작업 커밋).
   5. `problems` read-only 동결(v13 합의 절차 — 결정 기록 §2) — 구 읽기 어댑터는 삭제하지 않고 봉인 유지.
3. **RT-3 실데이터 화면 표시 대사**: 번호별 ≥1건(권장 10건)의 목록·상세 표시값을 DB 행/입력표와 필드별 대사. `.omx/evidence/debug-topik-writing-read.mjs`를 필드 비교형으로 확장하면 됨. ※ 각 번호 `-0001`은 audit_seed 보류 행(테이블 미적재) — `-0002`부터 사용.
4. **RT-4 검수 쓰기 왕복**: 화면 검수 액션(메모 저장→검수 완료 등) → DB 직조회(번호별 테이블) → 화면 재반영 → `admin_audit_logs` 역추적(action·diff·payload.review_note) 1사이클. e2e admin 계정(`.env.local`) 사용. **실데이터 검수 상태가 바뀌므로** 대상 행·원상 복구 여부를 증적에 기록.
5. **문서 동기화 (§11 P3 행)**: 데이터 계약 §9.6, `admin-page-tables.md` #19/#19-1, 양 page-IA 매핑 블록, page-sync §5-7 후보 표, transition 문서 §10.4, doc-update-log, `harness:check`.
6. **P3 채점·기록**: §12.3 P3 채점표(P3-1~P3-7) → 증적 로그 + §12.4 스코어카드, 2단계 커밋(작업→채점).
7. **P4 진입점 (P3 PASS 후)**: manage 페이지 `OPERATION_WRITE_ENABLED` 플래그 + facade `updateServiceStatus` 게이트 제거(RPC·UI 스캐폴딩은 이미 결선), 태그 부여/제거 UI(`admin_assign_question_tag`/`admin_remove_question_tag` — 노출상태 그룹 차단 가드 서버측 존재).

## 4. 미해결·주의 사항

1. **외부 발신 2건 여전히 미발신**: 콘텐츠팀 발주서(P2-5 게이트 — P2 PASS 전환의 유일 차단 요소)·상류 요청서(P6 게이트). 오너 채널 발신 필요.
2. **컷오버 스위치 규율**: `question-bank-data-source.ts` 기본값은 P2 PASS 전환 전까지 'legacy' 유지. 신규 스키마 검증은 env `VITE_QUESTION_BANK_SOURCE=topik_writing`(로컬)로만.
3. **DB 상태**: 신규 4테이블 466행+source_map 470행(전 행 `internal_test` — 노출 차단), question_tags 0행. `problems`는 컷오버까지 검수 SoT — ETL·프로브 모두 읽기 전용 유지(이번 세션 DB 쓰기 0건). legacy 모드 검수 쓰기는 구 RPC 부재로 서버 오류(알려진 제약 — 컷오버가 해소).
4. **e2e**: 모크 모드는 `npm run test:e2e:mock`. **4177 포트에 좀비 dev 서버가 남으면 playwright webServer가 타임아웃** — `Get-NetTCPConnection -LocalPort 4177`로 점유 프로세스 확인 후 정리(이번 세션에서 1회 발생·정리).
5. **BOM 함정**: `data/etl/reclassification-input.json` 수정은 Node 경유(PowerShell `Set-Content`는 BOM 부착).
6. **자격증명**: ETL은 이 repo `.env.local` 자동 로딩(`scripts/etl/lib/env.mjs`), e2e admin 계정도 동일 파일. **토큰·secret 회전 권고 여전히 유효**(이전 핸드오프 기록 — transcript 노출 이력).
7. 커밋 규율: 작업 커밋 → 채점 커밋 2단계, 모든 MD 수정은 `logs/admin-doc-update-log.md` 기록, `npm run harness:check` 필수(AGENTS.md).
8. **`.omx/evidence/` 지우지 말 것**(비추적): `etl/`(P2 증적 전체 — classify/·audit/·transform-out*/·load/verify 리포트), `debug-review.mjs`/`debug-topik-writing-read.mjs`(P3 프로브 — RT-3 확장 모체). 세션 리밋 참고: 이번 세션은 다대수 에이전트 작업 없음(탐색 2건만).

## 5. P4 이후 요약 (변경 없음 — 상세는 실행계획안 §8~§10)

- P4: 운영 write(`service_status`)+태그 개방, RT-4 운영 왕복, RLS 직접 write 차단 재확인, 감사 표면 갱신. P5: 주제/태그 마스터 admin 조회 surface(+D-13 후속 결정). P6: 상류 연동(요청서 회신 게이트, task52 부재 이슈, POL-017 승격 — PASS 시 전환 프로젝트 종료 선언).
