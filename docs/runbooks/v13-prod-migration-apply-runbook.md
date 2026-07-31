# v13 공유 마이그레이션 운영(topik-prod) 적용 runbook — 초안

상태: **초안**. 작성 2026-07-30, 같은 날 운영 실측 반영해 **7파일 기준으로 정정**(§9 정정 이력).

이 문서는 **v13→topik-ai DB 소유권 이전 프로그램의 M6(운영 catch-up) 실행 절차서**다. 전략·결정·로드맵의 단일 원문은 그 프로그램 계획서(오너 승인 2026-07-30, D1~D10 확정)이며 이 문서와 충돌하면 그 계획이 우선한다.

> 계획서는 main 에 머지됐다(PR #67, squash `8629ebf`) — [`docs/plans/v13-db-ownership-transfer-program-plan.md`](../plans/v13-db-ownership-transfer-program-plan.md).

v13은 원격 적용을 하지 않는다(v13 AGENTS.md·v13 `supabase/README.md`). 적용 집행은 topik-ai 운영면이 담당한다.

## 0. 요약

| 항목 | 값 |
| --- | --- |
| 운영 백로그 | **7파일** — dev 에만 있고 운영엔 없는 집합(2026-07-30 실측) |
| 백로그 목록 | `20260718120000` · `20260722120000` · `20260723234527` · `20260724120000` · `20260724130000` · `20260724140000` · `20260729120000` |
| 조건부 +1 | `20260527113000` — 운영 장부 기록이 dev 처럼 false record 면 **선행 수리**로 추가 (§2-2) |
| dev/운영 장부 | 둘 다 92행이지만 **집합이 다르다** — 운영-only 7 = blocked 5 + deferred 2(컷오버 **전** 적용된 정당한 역사) |
| 장부(tracker) | `supabase_migrations.schema_migrations` — 유지하고 쓰기 주체만 topik-ai (프로그램 D3=F1) |
| 차단 5건 | 운영엔 이미 역사로 기록됨 → **재적용·재기록 금지**. dev 는 영구 미적용 확정 (§5) |
| deferred 2건 | **운영에 살아 있고 dev 엔 없다** — M6 로도 해소되지 않는 비대칭, 존치/제거는 별도 결정 (§7) |
| 롤백 자산 | 백로그 7파일 **전부** v13 `supabase/migrations/down/` 에 짝 존재 (§6) |
| 운영 백업 | on-prem restic (`scripts/backup/topik-backup.sh`, 서버 chanchan2). Supabase Free 플랜 = 내장 백업 없음 → 이 경로가 유일 (§2-1) |
| 적용 경로 | 프로그램 **D9 승인**: 러너 v2 게이트식 해금, 시점은 **M2(아카이브) 이후** (§3) |

⚠️ **dev 매니페스트를 그대로 운영에 쓸 수 없다.** `scripts/db/manifests/v13-shared-dev.json` 의 sequence(10파일 9배치)는 dev 라이브 상태를 전제로 만들었다. 운영은 라이브 집합이 다르므로 **운영 전용 `v13-shared-prod.json`** 이 필요하고, 각 배치의 `expectPresent`/`expectAbsent`/`expectPresentAfter` 를 운영 실측 기준으로 재도출해야 한다.

## 1. 전제와 원칙

- **정본 분리**: 파일 목록·순서의 정본은 새로 만들 `v13-shared-prod.json`, 전략·결정의 정본은 프로그램 계획서다. dev 매니페스트는 참고용 모체일 뿐이다.
- **파일 본문은 커밋 고정본에서만 읽는다.** `--v13-sha` 로 v13 커밋을 고정하고 git object store 에서 읽는다(working tree 금지). M2 이후에는 바이트 동일이 증명된 내부 아카이브(`supabase/migrations-v13/`)를 원본으로 써도 결과가 같다.
- **운영 상태는 장부가 아니라 스키마 지문으로 실측한다.** dev 에서 장부와 실물이 어긋난 전례가 있다(`20260527113000` false record). 운영도 같은 가능성이 있으므로 §2-2 프로브가 판정 근거다.
- **워터마크**: 백로그 7건은 전부 `20260729120000` 이하 = v13 저작 역사다. 워터마크를 초과하는 신규 learner 마이그는 **백로그 7건이 소진되기 전에는 운영 적용 금지**(순서 역전 금지 가드를 러너 v2에 넣는다).
- 창 적용과 v13 앱 배포는 정합해야 한다. 창 이후 앱은 `complete_auth_gate` jsonb 오버로드(`20260718120000`), `get_my_account_state()`(`20260723234527`), `acquire_pdf_export_attempt`·3-인자 `claim_pdf_export_quota`(`20260724140000`)에 의존한다.
- DB 쓰기(적용·롤백·장부 기록)는 전부 오너 승인 후에만 실행한다.

## 2. 사전 게이트 (P0 — 하나라도 실패하면 진행 금지)

### 2-1. 운영 백업 확인

`scripts/backup/topik-backup.sh`(모드 backup|drill|flush)는 `SOURCE_PROJECT_REF="eymlabowhfgtxbiqwxqh"` 하드코딩 — topik-prod 전용이며 dev 백업 경로가 아니다. Free 플랜이라 Supabase 내장 백업이 없고, 이 on-prem restic 저장소(서버 chanchan2, `BACKUP_ROOT=/srv/topik-backup`)가 유일한 복구 원천이다. 상세는 `docs/runbooks/topik-prod-onprem-backup.md`.

체크리스트 (적용 창 직전, 서버 chanchan2 에서):

1. **fresh 스냅샷 확보** — 수동 1회 실행 후 성공 리포트 확인:
   ```bash
   sudo systemctl start topik-backup.service   # 또는 scripts/backup/run-backup.sh backup
   restic snapshots --tag complete --latest 1 --json   # run_id·시각이 방금 실행분인지
   ```
2. **최근 drill 성공** — 마지막 복원 드릴(`restic check --read-data` + 복원 + KEY_TABLES 대사)이 성공 상태인지 리포트로 확인. 실패 상태면 백업을 신뢰할 수 없다 → 드릴부터 복구.
3. **덤프 범위 확인** — roles / schema / data / auth·storage 데이터 4종이 스냅샷에 있는지(reference.json 동봉 메타 포함).
4. **디스크 여유** — `MIN_FREE_BYTES`(기본 50GiB) 위반 로그 없음.
5. **복원 경로 숙지** — down/ 으로 수습 불가한 상태(부분 커밋 꼬임 등)면 restic 복원이 최후 수단이다. 전체 DB 되감기이므로 창 이후 신규 데이터 유실을 수반한다는 점을 오너와 사전 합의.

### 2-2. 운영 지문 (read-only) — 이 게이트가 판정 근거다

장부 대신 실물을 조사한다. 러너의 `--status` 는 dev 전용이므로(§3), 운영 지문은 read-only SQL 로 직접 뜬다(`SUPABASE_PRODUCTION_CONFIRM` 을 지원하는 `run-sql.mjs` 경로, 오너 승인 하 read-only 한정).

```sql
select
  -- (a) 백로그 미적용 확인 — 전부 false 여야 정상
  to_regprocedure('public.complete_auth_gate(text,text,text,boolean,jsonb)') is not null
    as applied_20260718120000,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'export_files'
             and column_name = 'failure_code')                       as applied_20260722120000,
  to_regprocedure('private.is_active_user()')            is not null as applied_20260723234527,
  to_regprocedure('private.validate_review_set_study_event()') is not null
    as applied_20260724120000,
  to_regclass('public.pdf_export_request_periods')        is not null as applied_20260724140000,

  -- (b) 선행조건 — 전부 true 여야 진행 가능
  to_regprocedure('private.is_email_confirmed(uuid)')     is not null as pre_email_confirmed,
  to_regprocedure('public.accept_affiliation_invite(text,boolean)') is not null
    as pre_accept_invite,
  to_regprocedure('public.is_supported_country_code(text)') is not null as pre_iso_helper;
```

판정 규칙:

| 지문 | 기대 | 어긋나면 |
| --- | --- | --- |
| (a) `applied_*` 5개 | 전부 `false` | 하나라도 `true` = 운영이 이미 부분 적용됨 → **중단**, 백로그 재산정 |
| (b) `pre_email_confirmed` | `true` | `false` = `20260527113000` false record(dev B1 선례) → **`20260527113000` 을 순서 0으로 선행 적용** |
| (b) `pre_accept_invite` | `true` | `false` = `20260701140000` false record → 선행 적용. REVOKE 에 IF EXISTS 가 없어 `20260724130000` 이 42883 으로 중단된다 |
| (b) `pre_iso_helper` | `true` | `false` = `20260710095000` false record → 선행 적용. `20260718120000` 본문이 이 함수를 호출한다 |

주의 3가지:

- `pre_accept_invite` 는 **선행조건 동시에 미적용 신호**다. `20260724130000` 은 이 함수를 drop 하므로, `true` = "선행조건 충족 + B8 미적용" 이라는 뜻이다.
- **운영 라이브 4-인자 base 는 `20260710094000` 판**이다(신뢰 문서 필터 포함, 컷오버 전 적용된 역사). dev(`20260623103000` 판)와 본문이 다르다. 두 판 모두 이메일 인증 가드를 호출하지 않으며, 그 가드는 `20260718120000` 이 복구한다.
- **운영에는 dev 에 없는 객체가 살아 있다**(deferred 2건: `private.enforce_comparison_report_same_problem` 비교 가드, `public.create_external_writing_submission`). dev 창의 postcondition 집합이 운영 기대치의 전부가 아니다 — 운영 매니페스트 probe 에 이 비대칭을 반영한다.

### 2-3. 소스·롤백 자산 고정

- `--v13-sha` 는 백로그 7파일 + 그 down 7파일이 모두 포함된 **머지된 v13 커밋**으로 고정한다. ⚠️ 2026-07-30 현재 v13 로컬 main 은 origin 대비 ahead 2(미푸시)이고 down 11파일은 **미커밋** — 적용 전 커밋·푸시(오너 승인)가 선행돼야 한다.
- down 커버리지 확인(백로그 7 = down 7):

  ```bash
  for v in 20260718120000 20260722120000 20260723234527 20260724120000 \
           20260724130000 20260724140000 20260729120000; do
    ls supabase/migrations/down/ | grep -q "^$v" || echo "MISSING down: $v"
  done
  ```
- `v13-shared-prod.json` 이 리뷰·머지돼 있어야 한다(§1).

## 3. 적용 경로 — 프로그램 D9 로 결정됨

러너 `scripts/db/apply-v13-migration.mjs` 는 현재 운영을 **3중으로 거부**한다:

| # | 가드 | 위치 | 내용 |
| ---:| --- | --- | --- |
| 1 | `assertNotProduction` | apply-v13-migration.mjs:68 | `SUPABASE_PROJECT_REF` 가 운영 ref 면 무조건 실패 (`--status` 포함 모든 동작) |
| 2 | `assertManifestProjectRef` | migrate-core.mjs | manifest 의 `projectRef`(=dev 고정)와 타깃 ref 불일치 시 실패 |
| 3 | `assertWriteEnvironment` | apply-v13-migration.mjs:296 | `SUPABASE_PRODUCTION_CONFIRM` 이 **설정돼 있기만 해도** 실패 |

즉 환경변수 조작만으로는 운영에 못 쓴다. **D9 승인 내용 = 러너 v2 게이트식 해금**:

- 운영 전용 매니페스트 `v13-shared-prod.json`(`projectRef=eymlabowhfgtxbiqwxqh`, `environment=production`).
- 운영 실행 경로에서만 `SUPABASE_PRODUCTION_CONFIRM=eymlabowhfgtxbiqwxqh` + expected-ref 일치 + **배치 단위 승인** 3자를 요구(기존 admin/writing 운영 적용 게이트와 동형). 그 외 조합은 지금처럼 전부 거부 — dev 기본 동작은 무변경.
- **순서 역전 금지 가드**: 대상 장부의 최대 버전보다 낮은 pending 이 매니페스트에 남아 있으면 상위 버전 적용을 fail-closed.
- 시점: **M2(아카이브 import) 이후** — 바이트 동일 증명을 재사용한다. M6 는 M3~M5 와 독립이라 오너 우선순위에 따라 앞당길 수 있다.
- 가드를 만지는 변경이므로 리뷰 게이트(단위 테스트 + 적대적 리뷰) 필수.

## 4. 적용 순서

오너 승인 + §2 전부 통과 후, 한 배치씩 적용하고 배치마다 postcondition 을 확인한다.

| 순서 | 파일 | dev 배치 | 주의 |
| ---:| --- | --- | --- |
| 0 | `20260527113000` | B1 | **조건부** — §2-2 `pre_email_confirmed=false` 일 때만. 운영 장부에 false record 가 있으면 러너 provenance upsert 가 덮어쓴다 |
| 1 | `20260718120000` | (dev 는 창 이전 적용) | `is_email_confirmed` + `is_supported_country_code` 선행 필요. 적용 후 온보딩이 jsonb 경로로 바뀐다 → 앱 버전 정합 확인 |
| 2 | `20260722120000` + `20260729120000` | B4 | **2파일 1트랜잭션 필수** — 분리 적용 시 42883 결함 정의가 커밋된다 |
| 3 | `20260723234527` | B6 | **비멱등**: `set schema`+`rename` 7쌍. 실패 시 `private.*_unchecked` 개수로 부분 커밋 판정(0=클린 롤백, 1..6=수동 역전) 후에만 재시도 |
| 4 | `20260724120000` | B7 | — |
| 5 | `20260724130000` | B8 | 자체 begin/commit 포함 — 러너가 strip. `accept_affiliation_invite` 선행 필요(무조건 REVOKE) |
| 6 | `20260724140000` | B9 | **비멱등**(NOT NULL + unique). **유지보수 창**: PDF 요청 quiesce → 적용 → 앱 동시 배포. 실패 시 `pdf_export_quota_usages.request_id` 존재 여부 확인 후 재시도 |

- dev 의 B2(`20260710093000`)·B3(`20260701140000`)·B10(`20260710095000`)은 **운영에 이미 기록돼 있어 백로그가 아니다**(단 B3·B10 은 §2-2 선행조건 프로브 대상).
- 순서는 타임스탬프순과 일치한다. 단 `20260729120000` 은 `20260722120000` 의 수리본이므로 타임스탬프 위치가 아니라 **순서 2의 같은 트랜잭션**에 들어간다.

창 종결 조건: 러너 postcondition probe 전부 일치 + 앱 acceptance — 온보딩(`complete_auth_gate` 204), 대시보드 KPI, 문제 목록, PDF 내보내기(멱등 재시도 포함). dev 창(2026-07-30)과 동일 항목.

## 5. 차단 5건 — 재적용·재기록 금지

manifest `blockedMigrations` 5건. **운영에는 컷오버 전에 순서대로 적용된 정당한 역사로 이미 기록돼 있다.** dev 는 영구 미적용 확정(프로그램 D10). 지금 이 파일들을 **다시 적용하면** 아래 회귀가 발생한다 — 러너는 `--batch` 선택 단계에서 5건을 하드 거부하지만, 수동 경로에서는 사람이 마지막 방어선이다. 또한 **실행 없이 장부에만 기록하는 것도 금지**다(`20260527113000` false-record 사고의 재현).

| 파일 | 재적용 시 결과 |
| --- | --- |
| `20260629110000_institution_assigned_only_writing_access.sql` | visibility 술어가 `public.problems.materials` 를 참조 — 컷오버(`20260714140000`)가 해당 행을 삭제해 **쓰기 문항 풀 전면 숨김** |
| `20260629170000_non_institution_writing_full_exposure.sql` | 같은 술어·같은 삭제된 원본 — 동일하게 전면 숨김 |
| `20260701160000_institution_retry_availability.sql` | canonical reader 없는 구버전 `list_user_library_problem_items` 로 되돌려 **보관함에서 쓰기 항목 소실** |
| `20260629120000_auth_email_verified_access_gate.sql` | `20260718120000` 이 의도적으로 회수할 boolean-only 오버로드를 **재부여(보안 회귀)** + `user_consents_no_direct_insert` 를 구정책으로 교체 |
| `20260710094000_auth_gate_trusted_consent_docs.sql` | 같은 회수 대상 오버로드를 **재부여(보안 회귀)**. 운영 라이브 4-인자 base 의 현재 본문이 이 파일 판이라는 점과는 별개다 |

기관 노출 게이팅이 필요하면 이 파일들이 아니라 post-cutover 구조 기준의 **새 forward 마이그레이션**으로 작성한다.

## 6. 롤백 (down/)

백로그 7파일 전부 v13 `supabase/migrations/down/` 에 짝이 있다(2026-07-30 작성, 미커밋).

- **역순 실행** — 적용 순서(§4)의 정확한 반대:

  | 순서 | down 파일 | 비고 |
  | ---:| --- | --- |
  | 1 | `20260724140000` | 데이터 손실 구간(§아래) |
  | 2 | `20260724130000` | 신뢰 경계 재개방 경고 |
  | 3 | `20260724120000` | — |
  | 4 | `20260723234527` | **비멱등** rename 7쌍 역전 |
  | 5 | `20260729120000`(no-op) + `20260722120000` | **1트랜잭션** |
  | 6 | `20260718120000` | 마지막. jsonb 오버로드 제거 + boolean 권한 복원 |
  | 7 | `20260527113000` | 순서 0을 적용했을 때만. 반드시 6 다음 |

- **부분 롤백 비권장** — 배치 간 의존(`20260723234527`→`20260527113000`·B4, `20260724130000`→`20260701140000`, `20260724140000`→`20260723234527`)이 역방향에도 성립한다. 각 down 파일 헤더의 순서 경고를 따르고, 원칙적으로 창 전체를 되감는다.
- **앱 동시 롤백 필수** — 전체 롤백 후 DB 는 창 이전 상태다: 온보딩이 boolean-only 경로로 회귀, `get_my_account_state` 부재, 2-인자 claim. 창 이후 앱 버전은 이 상태에서 동작하지 않는다.
- **비멱등 구간** — down/`20260723234527` 의 rename+set schema 7쌍 역전: 실패 시 `private.*_unchecked` 개수(7=이동 전, 0=완료, 1..6=부분 커밋 → 남은 쌍만 수동)로 판정 후 재시도.
- **데이터 손실** — down/`20260724140000`: `pdf_export_request_periods` 행, `export_files`·`pdf_export_quota_usages` 의 request 식별 컬럼 삭제. down/`20260722120000`: `export_files.failure_code/failed_at` 삭제. 실행 전 §2-1 백업 필수. cutover 가 닫은 legacy queued 행은 복원 불가(일방향), cutover 가 해제한 예약 행은 마커(`request_identity_cutover`)로 복원됨 — 상세는 각 down 파일 헤더.
- **보안 회귀 경고** — down/`20260718120000` 은 동의 stale 창과 이메일 미인증 통과를, down/`20260724130000` 은 raw affiliation_code 신뢰와 브라우저 코드 RPC 2개를 되살린다. 창 전체 롤백의 일부로만 실행한다.
- 실행 수단: down 은 러너 외 경로(리뷰된 SQL 을 `run-sql.mjs` 로, 배치별 트랜잭션)로 실행하고, 장부에서 해당 version 행 삭제까지가 한 세트다. down 파일도 커밋 고정본에서 읽는다.
- down/ 으로 수습 불가한 상태면 최후 수단은 restic 복원(§2-1-5, 창 이후 데이터 유실 수반).

## 7. 남은 오너 결정

프로그램 D1~D10 은 2026-07-30 전부 승인됐다. M6 에 남은 열린 항목은 2건이다.

| # | 항목 | 선택지 | 비고 |
| ---:| --- | --- | --- |
| 1 | **유지보수 창 일정** | 일시 · 공지 범위 | `20260724140000` 요구: PDF quiesce + 앱 동시 배포. `20260718120000` 적용 시 온보딩 경로도 전환된다 |
| 2 | **deferred 2건의 운영 처분** | 존치 / 제거(신규 forward) | `20260629153000`(비교 가드 — 기존 cross-problem 행 UPDATE 차단), `20260629215000`(호출자 0 인 SECURITY DEFINER 표면). **운영엔 살아 있고 dev 엔 없다** — M6 로 해소되지 않는다. 판단 전 해당 객체를 라이브 함수 본문(`pg_proc.prosrc`)에서 역방향 grep 해 의존성을 확인한다(dev B10 교훈) |

이미 결정된 항목(참고): 적용 방식·시점 = D9(러너 v2 게이트식 해금, M2 이후) · blocked 5 = D10(dev 영구 미적용, 운영은 역사) · 장부 전략 = D3(F1 유지, 쓰기 주체만 topik-ai).

## 8. 참고

- 전략·로드맵 SoT: [`docs/plans/v13-db-ownership-transfer-program-plan.md`](../plans/v13-db-ownership-transfer-program-plan.md)
- 파일 목록 모체: `scripts/db/manifests/v13-shared-dev.json` (운영판은 `v13-shared-prod.json` 신설 예정)
- v13 이력: v13 `supabase/migrations/INDEX.md`, 롤백: v13 `supabase/migrations/down/`
- 백업: `docs/runbooks/topik-prod-onprem-backup.md` · 소유권 경계: `docs/architecture/shared-supabase-schema-ownership.md`
- dev 적용 이력: 2026-07-30 창 종료(장부 92행, 온보딩 재검증 204). `V13_CONTRACT_SHA=0ee14993`(PR #62), B10 승격(PR #63).

## 9. 정정 이력

| 일자 | 내용 |
| --- | --- |
| 2026-07-30 (초안) | dev 매니페스트 sequence 를 그대로 운영 대상으로 보고 **10파일 9배치**로 작성. `20260718120000` 은 운영에 이미 적용된 것으로 전제(부재 시 중단 게이트) |
| 2026-07-30 (정정) | 운영 실측 반영: 운영 백로그 = **7파일**, `20260718120000` 은 **백로그에 포함**(미적용). dev 의 B1·B2·B3·B10 은 운영에 이미 기록됨 → 백로그에서 제외하고 B1·B3·B10 은 선행조건 프로브로 전환. blocked 5 는 "운영에도 미적용" → "운영엔 역사로 적용됨, 재적용 금지" 로 정정. deferred 2 는 "운영에도 없음" → "운영에 살아 있음(비대칭)" 으로 정정. 적용 경로는 프로그램 D9 승인 내용으로 대체. `20260718120000` 의 down 을 신규 작성해 백로그 7파일 전부 롤백 커버 |
