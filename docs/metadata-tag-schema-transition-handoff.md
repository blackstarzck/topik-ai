# 메타데이터·태그 스키마 전환 — HANDOFF (P2 진행 중, 3차 중단 시점)

| 항목 | 내용 |
| :---- | :---- |
| 작성일 | 2026-06-10 (D-3 입력표 표본 적대 감사 패스 완료 직후 오너 지시로 작업 정리 — 2차 핸드오프를 본 문서로 대체) |
| 목적 | 다음 작업 세션이 P2 잔여 작업(본 적재→검증→리허설→채점)부터 곧바로 이어갈 수 있도록 상태·산출물·다음 단계·주의사항을 인수인계 |
| 실행 SoT | `docs/메타데이터-태그-스키마-전환-실행계획안.md` (P0~P6, §12.3 PASS 채점 게이트, §12.4 스코어카드) |
| 결정 SoT | `docs/architecture/metadata-tag-schema-transition-decision-record.md` (D-1~D-13 확정값 + v13 경계 합의) |
| 증적 로그 | `logs/metadata-tag-schema-transition-evidence.md` (P0·P1 채점표 + P2 진행 메모) |

## 1. 진행 상태 (2026-06-10 3차 중단 기준)

| 페이즈 | 판정 | 핵심 증적 |
| :---- | :--: | :---- |
| P0 결정 확정 | **PASS** | 커밋 `346e56e` + `2e0caa1`. D-1~D-13 확정, freeze 가드 5곳 해제 |
| P1 스키마 구축 | **PASS** | 커밋 `c467268`. 마이그레이션 12파일 프로덕션 적용, 무변경 diff 0건, RT-1 ALL PASS |
| P2 백필 ETL | **진행 중 (미채점)** | 선행 산출물 + **표본 적대 감사 패스 완료**(§2). **본 적재는 여전히 미실행 — 신규 4테이블·source_map 0행** |
| P3~P6 | 미착수 | P3 코드 선행 개발은 P2와 병행 가능(컷오버 배포는 P2 PASS 후) |

## 2. 이번 세션(3차)에서 끝난 것 — 표본 적대 감사 패스 (구 핸드오프 §3-1)

### 2.1 수행 방식·결과

- 표본: 번호별 15행×4 = 60행. 결정적 추출(id 정렬 + 균등 간격, 54번 수동 보완 행 `68f40294` 강제 포함) — 생성기 `.omx/evidence/etl/make-audit-samples.mjs`, 표본 `.omx/evidence/etl/audit/sample-{51..54}.json`(분류 행 + 배치 원문 prompt/hints + 사전·enum 동봉).
- 감사: 워크플로 `wf_d7d3d7f6-753`(에이전트 48개) — 번호별 적대 감사관 4인이 본문 원문 대조(인용 실재·topic 쌍 적합성·번호별 세부 필드·고정값), 플래그 22건 산출. 플래그별로 **독립 판정관 2인**이 재판정.
- 판정 규칙: 2인 일치 교체=채택(17건), 2인 일치 유지=유지(1건), 분열 2건+문구 차이 1건=주 루프 판정. 결과: **교체 20건 + topic 스왑 후속 rationale 재작성 2건 반영, 유지 2건**.
- 입력표 반영 후 전 행 재검증(17×85 사전 쌍·번호별 enum·화살표 체인·주보조 중복) 위반 0건, `npm run test:unit` 43개 PASS 유지. meta.status에 감사 완료 기록.

### 2.2 반영 내역 요약 (상세·근거 전문: `.omx/evidence/etl/audit/audit-decisions.json`)

- 51(5건): `7a6857b3` topic 주·보조 스왑(도서관 이용 시간 변경 — 시설 main, 동일 구조 `3121a2c8` 선례 정렬)+rationale 재작성, `3a99dac6`·`dba3e606` rationale 무근거 단정 교정(본문 외 '교내'·'선생님' 추정 제거), `f29bab79` secondary 누락 보완.
- 52(9건+유지1): cf/ref 스왑·중복 기입 오류 정정 — `6a385a9c`(cf↔ref 스왑), `82558fba`·`e83f7ad7`(이유 설명 중복→목적 제시), `be625860`(결과 중복→조건 제시), `afa616bb`(대조 연결→결과 제시, 결과→조건 제시), `c7d836fa` topic 스왑(기후/계절↔전문 분야/과학)+ref 결과 제시(주 루프 판정 — 전례 `29066193` 실측)+rationale 재작성. `7ed44fb6` cf는 유지(분열 — cf/ref 별개 필드 논거).
- 53(2건): `9f77e996` rationale의 hints 출처 인용을 본문 실재 인용으로 교체, `6797adb7` interpretation_difficulty 추세 설명→복수 비교(change_type=증가와 자체 모순 해소).
- 54(3건+유지1): essay_type 경계 정렬 — `0ec489f4`·`7f9780d9` 원인·해결형→주장형(명시적 원인 질문 부재), `c7b4bd49` 원인·해결형→장단점형(동형 `34cc94e3` 정렬). stance_requirement는 유지.
- topic 분포 변화(466행): 일상생활 67→66, 기후 1→0, 주거와 환경 42→43, 전문 분야 15→16 (나머지 불변 — 사회 73/교육 66/일과 직업 48/쇼핑 34/건강 30/여가와 오락 27/교통 20/식음료 18/대인관계 15/공공 서비스 5/개인 신상 3/여행 2, 예술 0).

### 2.3 감사가 남긴 후속 항목 (다음 세션 §3-1)

- **q52 cf=ref 동일값 잔여 22행 표적 감사 권고**: 표본 내 cf=ref 중복 4행이 4/4 오류(ㄴ 기능이 미기록된 채 ㄱ 값 중복 기입)였다. 전체 76행 중 cf=ref가 26행 — 표본 4행 보정 후 잔여 22행은 미감사. 특히 batch-08 계열(`cdb54b6e`/`ce32c790`/`d69db6d2`/`e6aa5055`/`f1518646`, 목적 제시 중복)이 판정 과정에서 동일 패턴으로 지목됐다. 단 `29066193`처럼 정당한 중복(ㄱ·ㄴ 모두 결과 진술)도 있으므로 행별 본문 대조 필요.
- **원천 데이터 품질 메모(분류 오류 아님)**: 51번 표본에서 title/hints가 본문과 전혀 다른 시나리오로 오염된 행 3건 발견 — `0027601f`(힌트 '전통 음악 공연 추천' vs 본문 수강 신청), `7a6857b3`(title '회의 일정 변경 요청' vs 본문 도서관 공지), `aae581e2`(힌트 '컴퓨터실 임시 등록' vs 본문 주차 등록). 분류·rationale은 본문을 올바르게 따랐으므로 입력표는 무영향. 문서 동기화 시 gap-register §4.7에 기록 권장.
- 54번 관찰: hints.logic_chain 보유 6행은 reasoning_pattern이 힌트 복사본이고 situation_summary=null(전부 scenario 완전형이라 transform이 자체 공급 — 계약 위반 아님). stance_requirement 쏠림(표본 14/15 '해결 방안 제시')은 관찰만 기록.

## 3. 다음 작업 절차 (P2 잔여 — 순서대로)

1. **(권장) q52 cf=ref 잔여 22행 표적 감사**: §2.3 첫 항목. 대상 추출은 `node --input-type=module -e` 한 줄(cf==ref 필터)로 가능, 본문은 `.omx/evidence/etl/classify/batch-*.json`에서 대조. 감사→재판정→반영 패턴은 이번 세션 도구 재사용(`.omx/evidence/etl/audit/apply-audit-corrections.mjs` 참고 — 보정 목록만 교체). ※ 이번 워크플로(`wf_d7d3d7f6-753`)의 resume는 같은 세션 한정이라 불가하나, 전체 출력은 `.omx/evidence/etl/audit/audit-workflow-output.txt`에 보존됨.
2. **본 적재**: `npm run etl:transform`(source_map 선조회 — 현재 0행이므로 전량 신규 채번) → `npm run etl:load`(upsert+source_map 동시 기록, 적재 후 테이블별 sha256 해시 출력) → `npm run etl:verify`(검증 5종: 재조립/보존/수량/축/RT-2 + service_status·source_map 대사). 산출 리포트는 `.omx/evidence/etl/`에 쌓임.
3. **P2-1 idempotency**: `etl:load` 2회차 실행 → load-report의 테이블별 해시가 1회차와 동일 + `etl:verify` 재실행 diff 0건 — 2회분 로그를 증적으로.
4. **P2-6 델타 리허설**: `node .omx/evidence/etl/make-delta-sim.mjs`(problems에는 **쓰지 않고** 덤프 사본에 검수 변경 2건 시뮬레이션: 52 pending→approved 1건, 54 메모 수정 1건) → `etl:transform --dump .omx/evidence/etl/problems-dump-delta.json --out .omx/evidence/etl/transform-out-delta --batch p2-delta-rehearsal` → `etl:load --in …-delta` → `etl:verify --in …-delta --dump …-delta.json`(변경 따라잡기 확인) → 원본 덤프로 transform/load/verify 재실행(원상 수렴 = 발산 0건 대사).
5. **채점·기록**: 증적 로그 P2 절(채점표 P2-1~P2-7) + 실행계획안 §12.4 스코어카드 P2 행. **P2-5(콘텐츠팀 샘플 승인)는 발주서 미발신 상태면 CONDITIONAL** — 해소 조건(오너 채널 발신→10문항 승인)을 스코어카드에 기록. P2-2~P2-4·P2-6·P2-7은 위 절차로 충족 가능.
6. **문서 동기화(§11 P2 행)**: transition 문서 §10.4 아래 백필 기록 추가, 데이터 계약 §12.2(식별자 매핑 확정 — 이미 반영돼 있어 적재 결과 수치만 보강), gap-register §4.7 백필 갭 메모(+§2.3 원천 title/hints 오염 3행), doc-update-log, `npm run harness:check`. 커밋은 2단계(작업 커밋 → 채점 기록 커밋) 패턴 유지.

## 4. 미해결·주의 사항

1. **외부 발신 2건 여전히 미발신**: 콘텐츠팀 발주서(`docs/requests/content-team-order-2026-06-10.md` — P2-5 게이트 의존)·상류 요청서(P6 게이트 의존). 오너 채널 발신 필요.
2. **세션 리밋**: 다대수 에이전트 작업(§3-1 표적 감사 등)은 리밋 여유 확인 후 수행 권장. 이번 감사 워크플로는 에이전트 48개·토큰 약 187만 소모.
3. **DB 상태**: 신규 4테이블·question_tags 0행, source_map 0행(파일럿은 P1에서 정리됨). 2차·3차 세션 모두 **DB 쓰기 0건** — 읽기(덤프·선조회)만 수행. `problems`는 P3 컷오버까지 검수 SoT이므로 ETL은 계속 읽기 전용(델타 리허설도 덤프 사본 방식).
4. **BOM 함정**: PowerShell `Set-Content`/`Out-File`로 `data/etl/reclassification-input.json`을 수정하면 BOM이 붙는다(transform은 BOM 1개는 허용하도록 방어 코드 있음). 수정은 Node 경유 권장(이번 감사 반영도 전부 Node로 수행).
5. **자격증명**: `.env.local`(이 repo)의 `SUPABASE_SECRET_KEY` 등은 ETL 스크립트가 자동 로딩(`lib/env.mjs`). Management API 토큰(`SUPABASE_ACCESS_TOKEN`)은 v13 repo `.env.local` — db 스크립트(`db:migrate` 등)에만 필요, ETL에는 불필요. **토큰·secret 회전 권고는 여전히 유효**(이전 핸드오프 기록 — transcript 노출 이력).
6. 현행 admin 검수 쓰기는 라이브 DB 기준 동작 불가(구 RPC 부재) — P3 컷오버가 해소 경로(변경 없음).
7. 페이즈 산출물 커밋 규율: 작업 커밋 → 채점 커밋 2단계, 모든 MD 수정은 `logs/admin-doc-update-log.md` 기록, `npm run harness:check` 필수(AGENTS.md).
8. **`.omx/evidence/etl/` 지우지 말 것**(비추적·정식 증적 아님): `problems-dump.json`(재생성 가능), `classify/`(분류 배치 입·출력 — LLM 결과물, 유실 시 재분류 비용 큼), `audit/`(이번 세션 신규 — 표본 4파일·감사 워크플로 전체 출력·판정 기록 `audit-decisions.json`·반영 도구. **감사 증적의 원본**), 일회성 도구들(`make-classify-batches.mjs`/`assemble-input-table.mjs`/`make-audit-samples.mjs`/`make-delta-sim.mjs` 등).

## 5. P3 이후 요약 (변경 없음 — 상세는 실행계획안 §7~§10)

- P3: 읽기+검수 쓰기 동시 컷오버(변경 파일 §7.2 11파일, RT-3/RT-4, freeze→델타→발산 0건 대사, D-12 모크 모드 결선). P4: 운영 write+태그. P5: 마스터 조회. P6: 상류 연동(요청서 회신 게이트, task52 부재 이슈).
