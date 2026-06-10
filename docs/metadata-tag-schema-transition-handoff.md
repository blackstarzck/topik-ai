# 메타데이터·태그 스키마 전환 — HANDOFF (P2 진행 중, 2차 중단 시점)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-10 (P2 선행 산출물 완료 직후 오너 지시로 작업 중지 — 1차 핸드오프(P1 완료 시점)를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 P2 잔여 작업(본 적재→검증→리허설→채점)부터 곧바로 이어갈 수 있도록 상태·산출물·다음 단계·주의사항을 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (P0~P6, §12.3 PASS 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (D-1~D-13 확정값 + v13 경계 합의) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0·P1 채점표 + P2 진행 메모) |

## 1. 진행 상태 (2026-06-10 2차 중단 기준)

| 페이즈 | 판정 | 핵심 증적 |
| :---- | :--: | :---- |
| P0 결정 확정 | **PASS** | 커밋 `346e56e` + `2e0caa1`. D-1~D-13 확정, freeze 가드 5곳 해제 |
| P1 스키마 구축 | **PASS** | 커밋 `c467268`. 마이그레이션 12파일 프로덕션 적용, 무변경 diff 0건, RT-1 ALL PASS |
| P2 백필 ETL | **진행 중 (미채점)** | 선행 산출물 완료: ETL 4스크립트+단위 테스트 43개, D-3 재분류 입력표 466행(draft). **본 적재는 미실행 — 신규 4테이블은 여전히 0행** |
| P3~P6 | 미착수 | P3 코드 선행 개발은 P2와 병행 가능(컷오버 배포는 P2 PASS 후) |

## 2. 이번 세션(P2 선행)에서 끝난 것

### 2.1 ETL 스크립트 (`scripts/etl/`, 커밋 산출물)

- `lib/env.mjs` — `.env.local` 부트스트랩(BOM 허용 아님 — 입력표 수정은 Node로만, §5-4 주의).
- `lib/transform-core.mjs` — **순수 함수 코어**(I/O 없음): D-2 검수 사전, D-4 채번(`assignQuestionIds` — source_map 선조회 재사용+`(created_at,id)` 결정 정렬), 번호별 빌더(build51~54), 재조립 검증, NOT NULL 계약(`REQUIRED_COLUMNS`)·보류 판정, `transformAll`. 파생 규칙 근거는 함수 주석에 있음.
- `extract-problems.mjs` / `transform-questions.mjs` / `load-questions.mjs` / `verify-backfill.mjs` — npm 스크립트 `etl:extract`/`etl:transform`/`etl:load`/`etl:verify`.
- `tests/unit/transform-core.test.mjs` — vitest 43개 전부 PASS(`npm run test:unit`). vitest는 devDependency로 추가됨.

### 2.2 D-3 재분류 입력표 (커밋 산출물, draft)

- `data/etl/reclassification-input.json` — 466행(51:90/52:76/53:62/54:238). 행 구성: topic_main/topic_detail(17×85 고정 사전 전수 검증, 위반 0건)+secondary+difficulty/target(파생 초안)+question_type_name+rationale(행별 본문 인용 근거)+번호별 세부(q52: completion_unit·connection_function·required_expression_function·answer_scope_type / q53: comparison_type·change_type·interpretation_difficulty / q54: essay_type·stance_requirement·reasoning_pattern·situation_summary).
- 작성 방법: 분류 에이전트 24배치(문항 본문 기반, 기계 변환 금지) → 사전·enum 전수 검증. **번호별 표본 적대 감사 패스는 세션 리밋으로 미수행**(meta.status에 기록) — 다음 세션 §4-1 참조.
- 54번 1행(`68f40294-…`)은 에이전트 출력 누락분을 수동 보완 분류(rationale에 표기).
- topic 분포: 사회 73 / 일상생활 67 / 교육 66 / 일과 직업 48 / 주거와 환경 42 / 쇼핑 34 / 건강 30 / 여가와 오락 27 / 교통 20 / 식음료 18 / 대인관계 15 / 전문 분야 15 / 공공 서비스 5 / 개인 신상 3 / 여행 2 / 기후 1 (예술 0).

### 2.3 비추적 작업 산출물 (`.omx/evidence/etl/` — **지우지 말 것**, 정식 증적 아님)

- `problems-dump.json` — 470행 전수 덤프(재생성: `npm run etl:extract`). `extract-report.json`/`probe-out.json`/`probe2-out.json` — 구조 실측.
- `classify/` — 분류 배치 입력 24개(`batch-*.json`, 재생성: `make-classify-batches.mjs`) + 에이전트 출력 24개(`out-batch-*.json`, **LLM 작업 결과물 — 유실 시 재분류 비용 큼**) + `topic-dictionary.json`.
- 일회성 도구: `make-classify-batches.mjs`, `assemble-input-table.mjs`(out-batch → 입력표 조립+전수 재검증), `patch-missing-row.mjs`, `make-delta-sim.mjs`(P2-6 리허설용 — §4-4).

### 2.4 실측 요약 (transform 설계 근거 — 상세는 probe 산출물)

- 51(90+예시1): `materials.blanks` 완전 정규화 → 직매핑. 재조립(빈칸→`source_context.resolved_text`) 90/90 일치.
- 52(76+1): 대표정답은 `answer_key.blank_target_giyeok/nieun`의 따옴표 스팬 파싱으로 복원 — 재조립 76/76 일치. `resolved_text`=`answer_key.model_answer`(완성 단락).
- 53(62+1): 전 행 chart_a+chart_b → `data_type='복합 자료'`, `source_data`=charts 원본(D-13). 글자수·과제(1~3)·금지요소 prompt 파싱 62/62.
- 54(237+1+예시1): 두 구조군 — 84행은 scenario 완전형(logic_chain 보유), 154행은 축약형(`scenario.topic_seed_title`만) → essay_type/stance/reasoning/situation_summary는 입력표(q54)가 공급. 번호 질문·글자수 파싱 238/238.
- 적재 보류 확정 대상: `audit_seed` 예시 4행(UUID `1111…`/`2222…`/`3333…`/`4444…`, materials·answer_key 부재) — hold_reason과 함께 source_map만 기록.
- **채번 주의**: 예시 4행이 created_at 가장 이른 행이라 `topik-writing-{nn}-0001`을 선점한다(보류 행도 question_id 선점 — source_map 계약). 51 실행 첫 행은 0002.

## 3. 다음 작업 절차 (P2 잔여 — 순서대로)

1. **(권장) 적대 감사 패스 보완**: 분류 입력표 표본 감사(번호별 15행)가 미수행 상태다. 새 워크플로(또는 에이전트 4개)로 `data/etl/reclassification-input.json`의 표본을 `.omx/evidence/etl/classify/batch-*.json` 원문 대조로 감사 → 플래그 행 재판정 → 입력표 갱신(`assemble-input-table.mjs` 재실행 또는 직접 수정) → meta.status에서 미수행 문구 제거. ※ 1차 워크플로 run(`wf_5423e011-637`)의 resume는 **같은 세션 한정**이라 불가.
2. **본 적재**: `npm run etl:transform`(source_map 선조회 — 현재 0행이므로 전량 신규 채번) → `npm run etl:load`(upsert+source_map 동시 기록, 적재 후 테이블별 sha256 해시 출력) → `npm run etl:verify`(검증 5종: 재조립/보존/수량/축/RT-2 + service_status·source_map 대사). 산출 리포트는 `.omx/evidence/etl/`에 쌓임.
3. **P2-1 idempotency**: `etl:load` 2회차 실행 → load-report의 테이블별 해시가 1회차와 동일 + `etl:verify` 재실행 diff 0건 — 2회분 로그를 증적으로.
4. **P2-6 델타 리허설**: `node .omx/evidence/etl/make-delta-sim.mjs`(problems에는 **쓰지 않고** 덤프 사본에 검수 변경 2건 시뮬레이션: 52 pending→approved 1건, 54 메모 수정 1건) → `etl:transform --dump .omx/evidence/etl/problems-dump-delta.json --out .omx/evidence/etl/transform-out-delta --batch p2-delta-rehearsal` → `etl:load --in …-delta` → `etl:verify --in …-delta --dump …-delta.json`(변경 따라잡기 확인) → 원본 덤프로 transform/load/verify 재실행(원상 수렴 = 발산 0건 대사).
5. **채점·기록**: 증적 로그 P2 절(채점표 P2-1~P2-7) + 실행계획안 §12.4 스코어카드 P2 행. **P2-5(콘텐츠팀 샘플 승인)는 발주서 미발신 상태면 CONDITIONAL** — 해소 조건(오너 채널 발신→10문항 승인)을 스코어카드에 기록. P2-2~P2-4·P2-6·P2-7은 위 절차로 충족 가능.
6. **문서 동기화(§11 P2 행)**: transition 문서 §10.4 아래 백필 기록 추가, 데이터 계약 §12.2(식별자 매핑 확정 — 이미 반영돼 있어 적재 결과 수치만 보강), gap-register §4.7 백필 갭 메모, doc-update-log, `npm run harness:check`. 커밋은 2단계(작업 커밋 → 채점 기록 커밋) 패턴 유지.

## 4. 미해결·주의 사항

1. **외부 발신 2건 여전히 미발신**: 콘텐츠팀 발주서(`docs/requests/content-team-order-2026-06-10.md` — P2-5 게이트 의존)·상류 요청서(P6 게이트 의존). 오너 채널 발신 필요.
2. **세션 리밋**: 이번 중단의 직접 원인. 다대수 에이전트 작업(감사 패스 등)은 리밋 리셋 후 수행 권장.
3. **DB 상태**: 신규 4테이블·question_tags 0행, source_map 0행(파일럿은 P1에서 정리됨). 이번 세션은 **DB 쓰기 0건** — 읽기(덤프)만 수행했다. `problems`는 P3 컷오버까지 검수 SoT이므로 ETL은 계속 읽기 전용(델타 리허설도 덤프 사본 방식).
4. **BOM 함정**: PowerShell `Set-Content`/`Out-File`로 `data/etl/reclassification-input.json`을 수정하면 BOM이 붙는다(transform은 BOM 1개는 허용하도록 방어 코드 있음). 수정은 Node 경유 권장.
5. **자격증명**: `.env.local`(이 repo)의 `SUPABASE_SECRET_KEY` 등은 ETL 스크립트가 자동 로딩(`lib/env.mjs`). Management API 토큰(`SUPABASE_ACCESS_TOKEN`)은 v13 repo `.env.local` — db 스크립트(`db:migrate` 등)에만 필요, ETL에는 불필요. **토큰·secret 회전 권고는 여전히 유효**(이전 핸드오프 기록 — transcript 노출 이력).
6. 현행 admin 검수 쓰기는 라이브 DB 기준 동작 불가(구 RPC 부재) — P3 컷오버가 해소 경로(변경 없음).
7. 페이즈 산출물 커밋 규율: 작업 커밋 → 채점 커밋 2단계, 모든 MD 수정은 `logs/admin-doc-update-log.md` 기록, `npm run harness:check` 필수(AGENTS.md).

## 5. P3 이후 요약 (변경 없음 — 상세는 실행계획안 §7~§10)

- P3: 읽기+검수 쓰기 동시 컷오버(변경 파일 §7.2 11파일, RT-3/RT-4, freeze→델타→발산 0건 대사, D-12 모크 모드 결선). P4: 운영 write+태그. P5: 마스터 조회. P6: 상류 연동(요청서 회신 게이트, task52 부재 이슈).
