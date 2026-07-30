# v13 → topik-ai DB 마이그레이션 소유권 이전 프로그램 설계안

> 상태: **오너 승인 완료(2026-07-30)** — §7 결정 표 D1~D10 전 항목을 권고안대로 확정. 2026-07-30 작성, 수치는 전부 당일 실측.
> 다음 단계 = M0 동결 공지와 단계별(M1~) 실행 명세 작성. 이 문서가 결정의 SoT다.

## 0. 목표와 해석 고정

- 오너 확정(2026-07-30): **v13은 사용자 화면 코드만 관리한다. DB 스키마/DDL/관리 권한은 전부 topik-ai로 이전한다.**
- 해석 A(오너 명시): 이전 대상은 **관리 권한**(저작·원격 적용·장부 기록·CI 계약·운영 절차)이다. **실사용자 런타임 쓰기(RPC 경유)는 그대로 유지** — 학습자 앱의 DB 사용 능력은 변하지 않는다.
- 따라서 이 프로그램에는 **DB 객체 이동·재생성·데이터 이동이 없다.** 옮기는 것은 다섯 가지다:
  ① 마이그레이션 파일의 커스터디(저장 위치) ② 장부의 쓰기 주체 ③ CI 재생 계약의 입력 출처 ④ 신규 저작 위치 ⑤ 운영 적용 절차.

## 1. 현재 구조 실측 (2026-07-30)

### 1.1 세 흐름 (supabase/README.md §4 "세 추적 테이블")

| 도메인 | 파일 위치 | 장부(tracker) | 러너 | 파일 수 |
|---|---|---|---|---|
| TOPIK 쓰기 | topik-ai `supabase/migrations/` | `topik_writing_schema_migrations` | `db:migrate` | 33 |
| admin 운영 | topik-ai `supabase/migrations-admin/` | `admin_schema_migrations` | `db:admin:migrate` | 91 |
| v13 학습자(user-facing) | **v13** `supabase/migrations/` | `supabase_migrations.schema_migrations` | `scripts/db/apply-v13-migration.mjs` (dev 전용, 운영 ref 하드 거부) | 100 |

- v13 러너는 파일을 워킹트리가 아니라 `git show <--v13-sha>:<path>`로 읽고, 장부 `statements`에 sha256·배치·commit·운영자 provenance를 남긴다.
- 경계 불변식: **한 마이그레이션은 정확히 한 장부에만 기록**(게이트 `scripts/check-migration-ownership-boundary.mjs`, `--v13-root`/`TOPIK_V13_ROOT` 오버라이드).

### 1.2 v13 100파일 대사 (dev 기준 — 정확히 맞아떨어짐)

```
100 파일 = 92 (dev 장부 기록·적용)
         +  5 blocked   (영구 미적용 — 컷오버 후 적용하면 회귀; manifest blockedMigrations)
         +  2 deferred  (개별 오너 결정 대기; manifest deferredMigrations)
         +  1 adoptedElsewhere (20260723170000_system_reports.sql → admin 장부 소유, PR #59)
```

- dev 장부: 92행, `20260520120000` ~ `20260729120000` (실측 쿼리).
- v13 계약 SHA(`0ee14993`)와 v13 HEAD(`d00033f4`) 사이 `supabase/` diff **0** — 워터마크가 현재 깨끗하다.

### 1.3 dev/운영 장부 차이 — 핵심 실측

두 환경 모두 92행이지만 **집합이 다르다**:

| 구분 | 내용 |
|---|---|
| 운영 장부 | 92행 = `20260714160000` 이하 전부(당시 순정 타임스탬프 순서로 적용된 역사) |
| dev 장부 | 92행 = 100 − blocked 5 − deferred 2 − adopted 1 (컷오버 후 큐레이션 적용) |
| **dev-only 7 = 운영 적용 백로그** | `20260718120000`, `20260722120000`, `20260723234527`, `20260724120000`, `20260724130000`, `20260724140000`, `20260729120000` |
| **운영-only 7** | blocked 5 + deferred 2 (`20260629110000`, `20260629120000`, `20260629153000`, `20260629170000`, `20260629215000`, `20260701160000`, `20260710094000`) — 운영은 컷오버 **전에** 순서대로 적용했으므로 정당한 역사 |

⚠️ 운영-only 7건은 "운영에서 지워야 할 오류"가 아니다. 컷오버(`20260714140000`)가 이후에 그 효과를 대체했으므로 **최종 상태는 dev와 수렴**하되, 장부 역사는 환경별로 다른 것이 정상이다. 아카이브 매니페스트에 파일별 환경 지위를 명기해야 하는 이유다(§4.1).

### 1.4 CI 계약(V13_CONTRACT_SHA) 소비처 전수

핀 `0ee149930019c8a6f97644824c390d7d2ec76067`, 리터럴 8곳 + 파생 소비처:

| 소비처 | 용도 |
|---|---|
| `.github/workflows/ci.yml` | v13 sparse-checkout(`.ci/v13`) → `check:migration-boundary --v13-root` + `db:shadow:verify` |
| `.github/workflows/database-health.yml` | 주기 full shadow replay + `apply-v13-migration --status` |
| `.github/workflows/release-development.yml` | checkout×2, boundary, shadow, evidence(`development.json`)에 v13-sha 기록 |
| `.github/workflows/release-production.yml` | evidence 검증 4곳(기록된 v13-sha와 핀 대조) |
| `.github/workflows/release-promotion.yml` | 회사 promote evidence 검증 |
| `.github/workflows/release-company-production.yml` | env validator 핀 |
| `scripts/ci/validate-release-env.mjs` / `validate-development-env.mjs` | 리터럴 고정 상수(워크플로 핀과 상호 잠금) |
| `scripts/ci/run-shadow-contract.mjs` `extractV13Pin` | **N-1 업그레이드 재생**: N-1 트리의 워크플로에서 핀을 추출해 v13 repo를 fetch |
| `tests/unit/release-pipeline-contract.test.mjs`, `tests/unit/previous-release-resolution.test.mjs` | "모든 릴리스 워크플로는 핀을 가져야 한다"는 계약 테스트 |

shadow replay(`run-shadow-contract.mjs`)의 실제 재생 계획: **v13 99개**(100 − seed fixture `20260608120200` 제외) **+ writing 33 + admin 91을 타임스탬프 인터리브**(동점 시 v13 < writing < admin)로 로컬 Supabase에 전량 재생. blocked 5도 재생된다 — 클린 히스토리 재생에서는 정상 적용되고 이후 컷오버가 대체하기 때문(운영 역사와 동일 경로). 즉 **v13 파일 100개는 이전 후에도 CI 계약의 영구 입력**이며, 이전의 본질은 그 입력의 출처를 `.ci/v13`(외부 repo checkout)에서 topik-ai 내부 디렉터리로 바꾸는 것이다.

### 1.5 이미 확보된 선례·도구

| 선례/도구 | 내용 | 재사용처 |
|---|---|---|
| **T1 바이트 채택** (PR #59) | v13 정본을 blob 동일하게 `migrations-admin/`에 채택, admin 장부 단독 기록, v13 manifest `adoptedElsewhere` | 파일 커스터디 이동의 증명 방식(sha256/blob 대조) |
| **T2 소유권 이관 forward** (`20260723011242`) | v13 과거 마이그 6개를 replay-safe 역사로 두고 최종 정의를 topik-ai forward 1본으로 수렴 | 향후 learner 객체의 정의 교정이 필요할 때의 패턴 |
| **repair-row 선례** (2026-07-07) | v13 장부에 topik-ai가 직접 행 삽입(오너 승인) | 장부 쓰기 주체 이전의 정당성 근거 |
| `apply-v13-migration.mjs` + `v13-shared-dev.json` | manifest 배치 적용 + preflight/postcondition probe + blocked/deferred/adopted 분류 | 운영 catch-up manifest의 모체 |
| expand-gate (`check-expand-migrations.mjs`) | `supabase/(migrations|migrations-admin)`만 검사 — **신규 디렉터리는 현재 범위 밖** | 아카이브 import PR이 게이트와 충돌하지 않음(§4.3 순서 함정 참조) |

## 2. 불변식 (프로그램 전 기간 유지)

1. **한 마이그레이션 = 정확히 한 장부.** 이중 기록은 어떤 단계에서도 금지(기존 경계 규칙 그대로).
2. **이미 적용된 역사는 재적용·재기록·수정하지 않는다.** 이전 대상은 파일 커스터디·쓰기 주체·CI 입력 출처이지 DB 상태가 아니다.
3. **워터마크 규칙**: 동결 공지 시점의 v13 최신 버전(현재 `20260729120000`) **이하 = v13 저작 역사**(장부 소속 불변, 운영 catch-up 포함), **초과 = topik-ai 저작**. 이 단일 기준으로 "어느 장부/어느 절차인가"를 판정한다.
4. **바이트 동일성은 sha256 매니페스트로 증명**한다(T1 선례). 채택 파일은 주석 추가·개행 변환·BOM 삽입까지 금지.
5. **운영 적용은 릴리스 파이프라인과 별도의 승인 게이트**를 유지한다(현행 canary/promote 체계 계승).
6. 신규 마이그레이션은 **구버전 정의 위에 작성 금지**, 적용된 마이그레이션 **불변**(expand-gate) — 기존 규칙이 신규 디렉터리에도 확장 적용되어야 한다(M5).

## 3. 권고 아키텍처 (종착 상태)

```
[현재]                                          [종착]
v13 repo                                        v13 repo
 └─ supabase/migrations/ (100, 저작 계속)         └─ supabase/ (동결 사본 or 삭제 — D6)
     ↑ 저작: v13   적용: topik-ai(dev만)              + CI 가드: migrations 변경 = fail
     ↑ CI: topik-ai가 sparse-checkout             (신규 저작 없음)

topik-ai repo                                   topik-ai repo
 ├─ supabase/migrations/        (writing 33)     ├─ supabase/migrations/        (writing)
 ├─ supabase/migrations-admin/  (admin 91)       ├─ supabase/migrations-admin/  (admin)
 └─ (v13는 외부 참조)                             └─ supabase/migrations-v13/    (learner 100+α)
                                                      · 아카이브 100 (바이트 채택, 불변)
장부 3개 / 러너 3개 (v13분은 dev 전용)                 · 신규 learner 저작 연속 (워터마크 초과분)
                                                 장부 3개 / 러너 3개 — 전부 topik-ai가 운영
                                                 CI shadow replay 입력 = 전부 topik-ai 내부
                                                 V13_CONTRACT_SHA 제거(자기 트리 digest로 대체)
```

핵심: **장부 3개 체계는 그대로 두고(도메인 기준 소유권 원칙 유지), 세 번째 장부의 "쓰기 주체·파일 커스터디·CI 입력"만 topik-ai로 옮긴다.** DB 객체·RLS·grant는 이 프로그램에서 불변.

## 4. 다섯 설계 질문별 옵션과 권고

### 4.1 이전 단위·순서 (질문 1)

**파일 커스터디 이동은 DB 무접촉 작업**이다(적용도 재기록도 없음). 따라서 도메인/의존성 분할의 실익이 없다.

| 옵션 | 내용 | 평가 |
|---|---|---|
| **A. 일괄 아카이브 import (권고)** | v13 100파일을 `supabase/migrations-v13/`에 **바이트 그대로** 1 PR로 채택 + 파일별 sha256/blob 매니페스트 + 환경별 지위(applied-dev/applied-prod/blocked/deferred/adopted) 기록 | 리뷰 부담은 해시 매니페스트로 상쇄. 혼합 상태 기간 최소. CI는 무영향(§4.3) |
| B. 도메인별 분할 이전 (10~15 PR) | auth/writing/notification… 묶음별 순차 채택 | 재적용이 없는 작업이라 분할 이점 없음. 부분 이전 기간 동안 CI 이중 소스·경계 검사 예외가 길어짐. **기각 권고** |

- 신규 디렉터리 이름: `supabase/migrations-v13/` 권고(manifest namespace `v13_user_facing`·기존 용어와 일치. `migrations-learner` 등 개명은 오너 취향 — D1 비고).
- 아카이브에는 v13 `INDEX.md` 사본을 참고용으로 동봉하되, **sha 계약은 `.sql`에만** 적용한다.
- **신규 저작 위치 강제 시점 = 즉시**(D2). 이전 기간 중 v13에 신규 마이그가 생기면 아카이브 재동기화 + 계약 SHA 재핀을 반복해야 하므로, M0 공지와 동시에 동결하는 것이 총비용 최소다. 긴급 수정이 필요하면 그 시점부터 topik-ai 쪽 신규 파일로 저작한다(워터마크 초과 = topik-ai 저작).

### 4.2 장부 전략 (질문 2)

| 옵션 | 내용 | 평가 |
|---|---|---|
| **F1. 장부 유지 + 쓰기 주체 이전 (권고)** | `supabase_migrations.schema_migrations`를 **learner 도메인 장부로 계속 사용**하되, 쓰기 주체를 topik-ai 러너 단독으로 고정. 신규 learner 마이그(워터마크 초과)도 이 장부에 기록 | 장부 연속성 보존(dev 92 + 운영 92 역사 그대로), 이중 기록 원천 차단, 러너(`apply-v13-migration.mjs`)가 이미 이 장부를 안전하게 쓴다(provenance 포함). "동결"은 장부가 아니라 **v13 저장소의 저작**에 적용 |
| F2. 장부 동결(읽기 전용 역사) + 신규는 admin 장부 | 신규 learner 마이그를 `migrations-admin/`+`admin_schema_migrations`로 (system_reports 선례 확장) | learner 도메인 역사가 두 장부로 갈라짐. admin release-all manifest가 learner DDL을 자동 운영 적용하게 되어 도메인 경계·승인 단위가 흐려짐 |
| F3. admin 장부로 흡수(92행 복사 후 원본 삭제) | 물리 통합 | 역사 파괴 + 복사·삭제 사이 이중 기록 상태 발생(불변식 1 위반) + v13 CLI 호환 파괴. **기각 권고** |

F1 보충:
- system_reports(T1)는 "admin 도메인으로 **도메인 자체가 이동**한 객체"라 admin 장부가 맞았다. 이번 이전은 도메인이 아니라 **관리 권한**의 이동이므로, learner 도메인 장부를 유지하는 것이 도메인 기준 소유권 원칙(ownership doc §1)과 정합한다.
- 운영 catch-up 7건(§4.5)은 워터마크 이하 = v13 저작 역사이므로 **운영 v13 장부에 기록되는 것이 맞다**(F1에서 모순 없음).
- v13 로컬 재현(`supabase db reset`)은 원격 장부와 무관하므로 F1로 깨지지 않는다.

### 4.3 CI 계약 이전 경로 (질문 3)

이전이 진행되면 shadow replay 대상(v13 `supabase/`)의 **출처**가 바뀔 뿐 재생 자체는 영구히 남는다(§1.4). 경로는 3릴리스 계단:

| 단계 | 내용 | 검증 |
|---|---|---|
| **C1. 아카이브 import** (M2) | `supabase/migrations-v13/` 추가만. CI 배선 무변경(`.ci/v13` 그대로) | expand-gate 무영향(신규 디렉터리는 범위 밖), boundary/contract 무영향. import PR에서 `아카이브 == .ci/v13@핀` byte-diff 검증 스크립트 1회 실행 |
| **C2. 이중검증 릴리스** (M3) | `run-shadow-contract.mjs`의 v13 소스를 내부 아카이브로 전환하되, 같은 릴리스에서 `.ci/v13` checkout을 유지하며 **아카이브 == checkout byte-diff 어서션**을 추가 | 두 소스가 바이트 동일함을 릴리스 증거로 남김 |
| **C3. 핀 제거 릴리스** (M4) | sparse-checkout 스텝 삭제, `V13_CONTRACT_SHA` 리터럴 8곳 제거, evidence 필드 `v13-sha` → 아카이브 digest로 대체(`compute-migration-digest.mjs`에 신규 디렉터리 포함), 계약 테스트 2종 개정 | shadow replay가 자기 트리만으로 완결 |

주의점:
- **N-1 업그레이드 재생 호환**: `prepareUpgradeBase`는 N-1 트리의 워크플로에서 핀을 추출해 v13 repo를 fetch한다. C3에서 분기를 추가한다 — "N-1이 핀을 가지면 구경로(v13 fetch), 없으면 N-1 트리의 내부 아카이브 사용". **회사 운영이 C3 이후 릴리스를 promote할 때까지 v13 repo는 fetch 가능해야 하고 분기도 유지**해야 한다.
- **expand-gate 확장 순서 함정**: import PR(C1)과 게이트 범위 확장을 **같은 PR에 넣으면 안 된다**. 게이트는 PR head의 스크립트로 실행되므로, 확장된 정규식이 신규 파일 100개(status A)의 역사적 drop 문을 contract 위반으로 오탐한다. C1(범위 밖 import) → 별도 PR(M5)에서 범위 확장 순서를 지킨다.
- `database-health.yml`의 `apply-v13-migration --status`는 C2에서 `--v13-root`를 내부 아카이브 기준으로 바꾼다(러너의 소스 파라미터 확장 — §4.2 F1과 함께 러너 v2로 일괄 처리).
- boundary checker의 v13 참조(`DEFAULT_V13_ROOT`, `TOPIK_V13_ROOT`)는 C2에서 "내부 아카이브 우선, 외부 v13 root는 과도기 옵션"으로 `resolveV13Root`를 확장한다.

### 4.4 v13 쪽 차단 가드 (질문 4)

현황: v13 CI에는 마이그레이션 게이트가 전혀 없고(앱 검증 + 파이프라인 계약만), `supabase/README.md`에 "원격 적용 금지"만 명문화되어 있다. 즉 가드는 신설이다.

**계층 1 — 저장소 가드 (필수, 권고)**
- v13 CI `verify` job에 스텝 신설: base..head diff에서 `supabase/migrations/**` 추가·수정·삭제가 있으면 fail (메시지에 topik-ai 저작 경로 안내). `required` job의 기대 결과에 포함시켜 우회 불가로 만든다.
- v13 `AGENTS.md` 비협상 규칙 + `supabase/README.md`에 동결 명문화(워터마크·이전 프로그램 링크).
- `supabase/config.toml`·`seed.sql`은 로컬 재현 전용이므로 동결 범위에서 제외(변경은 리뷰로 통제). `migrations/INDEX.md`는 migrations/ 안에 있으므로 함께 동결.

**계층 2 — 자격증명 커스터디 (필수, 권고)**
- 원격 DDL의 실질 벡터는 두 가지뿐이다: Supabase **Management API PAT**(`sbp_…`)와 **DB 비밀번호**. v13 앱 런타임(anon/authenticated/service_role via PostgREST)으로는 DDL이 불가능하다. v13 CI에는 DB 시크릿이 없다(실측).
- 조치: PAT·DB 비밀번호를 topik-ai 운영면(로컬 운영 env + topik-ai GitHub secrets)에만 보관하는 원칙을 명문화하고, v13 작업면에 배포된 적 있는 토큰은 **회전**한다(시점 D8).
- 한계: Supabase PAT는 계정 단위라 프로젝트별 스코프 분리가 안 된다. 계정/조직 멤버십 정리가 근본 대책이며, 이는 오너 계정 운영 사항이다.

**계층 3 — DB 수준 tripwire (선택)**
- `CREATE EVENT TRIGGER`(ddl_command_start)로 "topik-ai 러너가 세팅하는 세션 GUC 없이 실행된 DDL"을 로깅 또는 차단하는 안. **Supabase 관리형 Postgres에서 postgres 롤의 이벤트 트리거 생성 가능 여부·플랫폼 자체 마이그레이션과의 간섭을 dev에서 먼저 검증해야 한다**(미검증 상태로 채택 금지). 검증 통과 시에도 1차는 로깅 모드 권고.

### 4.5 운영 DB 적용 대기분과의 순서 충돌 방지 (질문 5)

실측으로 백로그가 **7파일로 유한·확정**됐다(§1.3). 원칙:

1. **백로그 7건은 워터마크 이하 = v13 저작 역사** → 운영 v13 장부에 기록하며(F1 정합), 적용 원본은 "핀 시점 v13 트리"든 "바이트 동일이 증명된 내부 아카이브"든 결과가 같다(불변식 4). 권장 시점은 **M2(아카이브) 이후** — 바이트 증명을 재사용할 수 있다.
2. **`v13-shared-prod.json` manifest 신설**: dev manifest의 배치 구조·프리플라이트를 상속하되 운영 상태 차이를 반영한다.
   - `20260722120000` + `20260729120000`은 **반드시 동일 트랜잭션**(B4 규칙 — 깨진 정의가 커밋되지 않게).
   - 운영은 B3(`20260701140000`)가 이미 적용돼 있으므로 B8(`20260724130000`)의 REVOKE 선행조건이 자연 충족된다(dev와 배치 구성이 달라지는 지점).
   - **선행 프로브**: 운영 장부의 `20260527113000`이 실재 적용인지 검증(dev에서는 false record였음 — `private.is_email_confirmed(uuid)` 존재를 운영에서 확인). `complete_auth_gate` 체인·`is_supported_country_code` 존재도 dev B10 교훈대로 라이브 함수 본문 기준으로 검사.
3. **러너 운영 해금은 별도 오너 결정**(D9): 현행 `assertNotProduction` 하드 거부를 유지한 채, 운영 전용 실행 경로에만 `SUPABASE_PRODUCTION_CONFIRM=eymlabowhfgtxbiqwxqh` + expected-ref 일치 + 배치 단위 승인(기존 admin/writing 운영 적용 게이트와 동형)을 요구하는 v2로 확장한다.
4. **순서 역전 금지 가드**: 신규 learner 마이그(워터마크 초과)의 운영 적용은 **백로그 7건 소진 전 금지**. 러너 v2에 "대상 장부 최대 버전보다 낮은 pending이 매니페스트에 남아 있으면 상위 버전 적용 fail-closed" 가드를 넣는다.
5. blocked 5·deferred 2의 환경별 지위는 아카이브 매니페스트에 고정 기록한다(D10): blocked 5 = dev 영구 미적용·운영은 역사로 적용됨, deferred 2 = 오너 개별 결정 대기.
6. **dev/운영 라이브 비대칭 주의**: deferred 2건이 운영에는 이미 적용돼 있다(§1.3 운영-only). 즉 운영에는 `private.enforce_comparison_report_same_problem` 가드(교차 문항 비교 차단)와 `create_external_writing_submission`(호출자 0의 SECURITY DEFINER 표면)이 **살아 있고 dev에는 없다**. M6 백로그 적용으로도 이 차이는 해소되지 않으므로 D10에서 "dev 미적용 확정"과 별개로 **운영 측 존치/제거(제거 시 신규 forward)** 를 결정해야 한다. 처분 판단 전에는 dev B10 교훈대로 해당 객체를 라이브 함수 본문(prosrc)에서 역방향 grep 해 의존성을 확인한다.

## 5. 단계 로드맵 (M0~M7)

| 단계 | 내용 | 저장소 | 선행 | DB 접촉 |
|---|---|---|---|---|
| **M0** | 오너 공지: v13 `supabase/migrations` 저작 동결(워터마크 = `20260729120000`), 신규 저작은 topik-ai. 본 문서 결정 표 확정 | — | D2 결정 | 없음 |
| **M1** | v13 CI 동결 가드 + v13 AGENTS/README 개정 | v13 | M0 | 없음 |
| **M2** | 아카이브 import: `supabase/migrations-v13/` 100파일 바이트 채택 + sha256/환경지위 매니페스트 + byte-diff 1회 검증 (=§4.3 C1) | topik-ai | M0 | 없음 |
| **M3** | 이중검증 릴리스: shadow 소스 전환 + `.ci/v13` 대조 어서션, 러너 v2(소스=자기 repo·`--v13-root` 대체), boundary `resolveV13Root` 확장 (=C2) | topik-ai | M2 | 없음 |
| **M4** | 핀 제거 릴리스: sparse-checkout·`V13_CONTRACT_SHA` 8곳·계약 테스트 개정, evidence를 아카이브 digest로. N-1 분기 유지 (=C3) | topik-ai | M3 릴리스가 N-1이 된 후 | 없음 |
| **M5** | 신규 저작 개통: 첫 topik-ai발 learner 마이그부터 `migrations-v13/` 연속 저작 + v13 장부(F1) 기록. expand-gate 범위 확장(별도 PR — §4.3 함정), 릴리스 manifest에 learner 네임스페이스 추가 | topik-ai | M2 (M3~4와 병행 가능) | dev |
| **M6** | 운영 catch-up: `v13-shared-prod.json` + 러너 운영 해금(D9) + 선행 프로브 → 백로그 7건 배치 적용 | topik-ai | M2, D9 | **운영** |
| **M7** | 마무리: 자격증명 회전(D8), v13 `supabase/` 최종 처분(D6), 문서 일괄 개정(§9), N-1 분기 제거(회사 promote가 M4 이후 릴리스에 도달한 뒤) | 양쪽 | M4·M6 | 없음 |

M6은 M3~M5와 독립이며 오너 우선순위에 따라 앞당길 수 있다(아카이브 증명만 M2에서 확보되면 됨).

## 6. 리스크 레지스터

| 리스크 | 완화 |
|---|---|
| 이전 기간 중 v13에 마이그 신규 저작 발생(동결 위반) | M0 즉시 동결 + M1 CI required 가드. 위반 발견 시 워터마크 재협상 없이 해당 파일을 topik-ai로 재저작 |
| expand-gate가 import PR의 역사적 drop 문을 오탐 | 신규 디렉터리는 현재 게이트 범위 밖(실측). 게이트 확장은 M5 별도 PR — 같은 PR 금지 |
| N-1 업그레이드 재생이 v13 repo fetch에 실패 | C3 분기 유지 + 회사 promote가 M4 이후 릴리스에 도달할 때까지 v13 repo 보존·fetch 가능 유지 |
| 운영 `20260527113000`이 dev처럼 false record일 가능성 | M6 선행 프로브(라이브 함수 존재 검사)로 판정 후 manifest 반영 — dev B1 선례 그대로 |
| 계약 SHA 제거 시 릴리스 evidence 체인 단절 | evidence 스키마에 아카이브 digest 필드를 **추가 후 교체**(한 릴리스 겹침), 계약 테스트 2종을 같은 PR에서 개정 |
| blocked 5를 아카이브했다는 이유로 후임자가 재적용 시도 | 매니페스트에 `neverApply: dev` 지위와 사유(컷오버 회귀)를 파일 단위로 고정, 러너가 선택 시 사유와 함께 거부(현행 동작 계승) |
| v13 로컬 재현(`db reset`) 상실(D6에서 삭제 선택 시) | 동결 사본 유지(권고) 또는 topik-ai 아카이브로 재현 절차 이관 + 스키마 스냅샷 발행 중 택1 — D6에서 결정 |
| PAT가 계정 단위라 기술적 격리 불완전 | 커스터디·회전 + (선택) DB tripwire. 완전 격리는 계정/조직 구조 개편 필요 — 별건 |

## 7. 오너 결정 표 — **승인 완료(2026-07-30, 전 항목 권고안 채택)**

| ID | 질문 | 옵션 | 권고 | 결정 |
|---|---|---|---|---|
| **D1** | 이전 단위 | A. 일괄 아카이브 import(1 PR + sha 매니페스트) / B. 도메인 분할 | **A** (재적용 없는 파일 이동이라 분할 실익 없음) | ✅ 승인 |
| **D2** | v13 저작 동결 시점 | A. 즉시(M0) / B. CI 전환(M4) 후 | **A** (지연 시 재동기화·재핀 반복 비용) | ✅ 승인 |
| **D3** | 장부 전략 | F1. 장부 유지+쓰기 주체 이전 / F2. 동결+admin 장부 흡수 / F3. 복사 이관 | **F1** (연속성·이중기록 차단·러너 재사용) | ✅ 승인 |
| **D4** | 신규 learner 마이그의 집 | A. `migrations-v13/` 연속 저작 + v13 장부(F1 결합) / B. `migrations-admin/` 편입 | **A** (도메인 기준 소유권 원칙 유지) | ✅ 승인 |
| **D5** | CI 전환 방식 | A. 이중검증 1릴리스 경유 후 핀 제거 / B. 즉시 핀 제거 | **A** (byte-diff 어서션을 릴리스 증거로 남김) | ✅ 승인 |
| **D6** | v13 `supabase/` 최종 처분 | A. 동결 사본 유지(로컬 재현·과도기 참조) / B. 삭제 + 포인터 README | **A 당분간**, 삭제는 M7 이후 재결정 (로컬 재현 대체 확정 전 삭제 금지) | ✅ 승인 |
| **D7** | v13 차단 가드 수준 | A. CI 가드 + 문서 / B. A + DB 이벤트 트리거 tripwire | **A 먼저**, B는 dev 타당성 검증 통과 시 추가 | ✅ 승인 |
| **D8** | 자격증명 조치 | PAT·DB 비밀번호 회전 + topik-ai 운영면 단일 보관 — **시점**(M1 직후 vs M7) | **M1 직후** (동결과 동시 회전이 가드 실효성 최대) | ✅ 승인 |
| **D9** | 운영 catch-up 7건 | 적용 시점(M2 직후 권장) + 러너 운영 해금 방식(PRODUCTION_CONFIRM+expected-ref+배치 승인) 승인 | **M2 직후, 게이트식 해금** | ✅ 승인 |
| **D10** | blocked 5 / deferred 2 처분 | blocked 5: dev 영구 미적용 확정(매니페스트 고정) / deferred 2: ⓐ dev 영구 미적용 확정 여부 ⓑ **운영에 이미 존재하는** 두 객체(비교 가드·외부 제출 RPC)의 존치/제거(§4.5-6) | blocked 확정 + deferred ⓐ 미적용 확정, ⓑ는 prosrc 의존성 grep 후 개별 결정(필요 기능은 신규 forward로 재저작) | ✅ 승인 |

## 8. 비목표

- DB 객체·데이터·RLS·grant 변경 없음(관리 권한 이전이지 스키마 개편 아님).
- v13 앱 런타임 쓰기 경로(RPC·PostgREST) 변경 없음 — 해석 A.
- `topik_writing`·admin 두 네임스페이스의 기존 체계 변경 없음.
- 기관 노출 게이팅 복원(별건 결함), 신고 라우트 400(수정 완료·배포 별건), 운영 admin/writing 네임스페이스 릴리스는 이 프로그램 범위 밖.
- 이 문서 자체는 구현하지 않는다 — 결정 확정 후 단계별 실행 명세를 따로 작성.

## 9. 문서 개정 영향 목록 (구현 단계에서 함께 갱신)

| 문서 | 개정 내용 | 시점 |
|---|---|---|
| topik-ai `AGENTS.md` §2·§11.6 | "기존 v13 테이블 DDL 변경 금지" → "learner 네임스페이스 DDL은 `migrations-v13/`에서 topik-ai가 저작(경계: admin 네임스페이스에서 learner 객체 DDL 금지는 유지)" | M5 |
| topik-ai `supabase/README.md` | §3.2 러너 v2, 신규 디렉터리 절 추가, §4 경계 규칙 개정 | M3·M5 |
| `docs/architecture/shared-supabase-schema-ownership.md` §1·§3 | migration home 열의 v13 항목을 topik-ai `migrations-v13/`로, 변경 절차 3항 개정, 본 결정의 decision record 추가 | M2 |
| v13 `AGENTS.md`·`supabase/README.md`·`migrations/INDEX.md` | 동결 선언·워터마크·topik-ai 위임 명문화 | M1 |
| `scripts/check-migration-ownership-boundary.mjs` | 아카이브 인지(`resolveV13Root` 확장), learner 디렉터리 역방향 규칙(admin 객체 정의 금지) | M3·M5 |
| `docs/README.md`·`logs/admin-doc-update-log.md` | 인덱스·변경 로그(본 문서 추가분 포함) | 각 단계 |

---

### 부록 A. 실측 명령 (재현용)

- dev/운영 장부: `SUPABASE_PROJECT_REF=<ref> node scripts/db/run-sql.mjs --sql "select version from supabase_migrations.schema_migrations order by version"` (read-only)
- v13 파일 수: `supabase/migrations/*.sql` = 100 (v13 `0ee14993` == HEAD `d00033f4`, supabase diff 0)
- 계약 SHA 소비처: `grep -rn V13_CONTRACT_SHA` → 워크플로 6 + 밸리데이터 2 + 테스트/스크립트
- shadow 재생 구성: `scripts/ci/run-shadow-contract.mjs` `buildMigrationPlan`(v13 99 + writing 33 + admin 91, fixture 1 제외)
