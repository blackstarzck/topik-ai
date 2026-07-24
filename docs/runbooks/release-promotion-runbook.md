# 회사 승격 릴리스 운영 runbook (promotion → stg → main)

개인 저장소 `blackstarzck/topik-ai`(코드 SoT)의 검증된 main SHA를 회사 저장소 `keduall/topik-admin`의 `stg`→`main`으로 승격해 운영 DB·Vercel 배포를 집행하는 절차. 아키텍처 개요와 게이트 계약은 `docs/architecture/admin-cicd-pipeline.md`, 워크플로 원문 계약은 `tests/unit/release-pipeline-contract.test.mjs`가 단일 기준이다.

## 1. 자동 체인 (정상 경로)

1. 개인 main push → `Validate development` 성공(evidence v4: sourceTreeSha·migrationDigest, db 플랜은 fresh + N-1 upgrade replay + topik-dev 실적용).
2. `Release promotion`(개인)이 검증된 SHA를 회사 `promote/<sha>`로 **재작성 없이** push하고 `promote/<sha> → stg` PR을 연다.
   - 인터록: 레거시 `Release production`이 `active`거나 `PROMOTION_GITHUB_TOKEN` 미등록이면 보류(단일 활성 경로 보장).
3. `Promotion gate`(회사)가 source/tree/migration digest/개인 evidence를 재계산 대조하고 `git merge-tree`로 **COMPANY_DRIFT**(회사측 독자 변경·충돌)를 차단한 뒤, `ATTESTATION_GITHUB_TOKEN`(blackstarzck)으로 head 커밋에 attestation(APPROVE 리뷰, fenced JSON)을 남긴다.
4. **guest merge (수동, 세션이 수행)** — §2.
5. `Company stg validation`(회사)이 stg tip의 trailer·tree를 검증하고 topik-dev tracker를 **재적용 없이** `--verify-all --require-clean`으로 재사용 확인 후 `staging-evidence-<stg tip>` 아티팩트를 남긴다. 실패 = topik-dev drift = prod 승격 자동 차단.
6. guest가 `stg → main` PR을 열면 같은 gate가 재검증한다. **배포 플랜(app/db)은 Playwright MCP staging 검증 코멘트(§3)가 있어야 attestation이 발급된다**(sync-only는 불요).
7. main merge → `Company production release`: `verify-company-release.mjs`가 **매번 전량 재검증**(merge trailer·머지된 PR 존재·attestation commit 바인딩·미해결 review thread 0·staging/development evidence·digest — 하나라도 실패하면 DB·Vercel 무변경) 후에만 read-only tracker preflight → expand 적용 → 구앱 smoke → Vercel 후보(candidate에 `VITE_RELEASE_SHA` 주입) → E2E → promote → 운영 smoke/런타임 로그(실패 시 자동 alias rollback).
8. **운영 MCP 검증(§3)** 통과가 릴리스 종결 조건이다.

## 2. guest merge 절차 (계정 라우팅: AGENTS §11.1)

merge는 워크플로가 아니라 릴리스 컨트롤러 세션이 `account-context`(프로세스 한정 자격)로 수행한다. attestation(gate 성공) 확인 후:

```bash
# stg 승격 (promote/<sha> → stg)
gh pr merge <PR번호> --repo keduall/topik-admin --merge \
  --match-head-commit <정확한 head SHA> \
  --subject "release: <plan> <source 7자> to stg" \
  --body "Release-Source: <source SHA 40자>"
```

- `--match-head-commit`이 stale head를 서버측에서 거부한다. merge 후 `git show -s --format='%an <%ae>'`로 author가 `guestkeduall-design <guestkeduall@gmail.com>`인지 확인하고, 불일치 시 rewrite 없이 중단·보고한다.
- `stg → main`도 동일 형식(`--body "Release-Source: <source SHA>"` 필수 — production verify가 trailer로 source를 복원한다).
- 수동/부트스트랩 승격: `npm run release:promote -- --source-sha <sha>`.

## 3. Playwright MCP 브라우저 검증 프로토콜

release manifest = `%USERPROFILE%\.topik-ai\release-manifests\<source-sha>.json` (스크린샷은 같은 폴더 하위). 세션이 중단되면 다른 세션이 source SHA만으로 이어받는다(`show`로 상태 확인).

```bash
node scripts/ci/release-manifest.mjs init --source-sha <sha> --release-plan <plan> --stg-sha <stg tip>
node scripts/ci/release-manifest.mjs set --source-sha <sha> --stage stg --deployment-url <url> --deployment-id <id>
node scripts/ci/release-manifest.mjs set --source-sha <sha> --stage stg --item login --state pass
# ... 체크리스트: login, coreFlows, consoleErrors, failedRequests, baselineCompared, shaMatch, screenshotsSaved
node scripts/ci/release-manifest.mjs set --source-sha <sha> --stage stg --verdict pass --summary "<요약>"
node scripts/ci/release-manifest.mjs comment --source-sha <sha>   # → stg→main PR에 코멘트로 게시
```

검증 항목: 로그인·핵심 운영 플로우(Users 목록/상세, 변경 영향 화면)·콘솔 오류 0·실패 네트워크 요청 0·직전 릴리스 대비 baseline·**배포 SHA 일치**(`<meta name="release-sha">` == source SHA)·스크린샷 저장. 게시된 `MCP-STG-EVIDENCE` 코멘트는 gate와 production verify가 `verify-mcp-evidence.mjs`로 검증한다(작성자·source/stg SHA 바인딩·verdict·체크리스트 전 항목). 운영 검증은 promote 후 같은 체크리스트를 운영 도메인에 수행하고 manifest `production` 스테이지에 기록한다 — verdict pass가 릴리스 종결.

## 4. 긴급 수동 릴리스 (승격 체인 불가 시)

1. 검증된 SHA 확인(개인 Validate development 성공 run).
2. 운영 DB: `npm run db:migrate -- --apply --manifest scripts/db/manifests/writing-production-cutover.json --batch release-all` + admin 동형(로컬 env에 prod ref·`SUPABASE_PRODUCTION_CONFIRM` 필요).
3. Vercel: 로컬에서 `vercel pull/build/deploy --prebuilt --prod`(candidate) → smoke → `vercel promote`.
4. 사후에 반드시 같은 SHA를 정식 승격 체인으로 통과시켜 회사 main 이력을 정합화한다.

## 5. 컷오버·롤백

- 동결/해제: `gh workflow disable|enable "Release production"`(개인). promotion 인터록이 이 상태를 읽어 경로를 자동 전환한다.
- **되돌릴 수 없는 지점 = 첫 stg merge가 회사 main에 도달한 뒤**(merge commit이 생기면 레거시 fast-forward mirror 복원 불가). 그 전에는 enable + 승격 PR/branch 정리만으로 완전 복원된다.
- 신 경로 장애 시: verify가 fail-closed이므로 "릴리스 중단"으로 수렴한다 — fix-forward 하거나 §4 수동 절차를 사용한다.
- N-1 upgrade replay의 회사 API 조회 실패 시: 릴리스 지연(정상). 비상시에만 개인 repo vars `UPGRADE_REPLAY_BASE_OVERRIDE`에 직전 릴리스 SHA를 넣고, 해소 후 비운다.

## 6. 시크릿·환경 (오너 등록, 위치 요약)

- 개인 repo secrets: `PROMOTION_GITHUB_TOKEN`(guest PAT — keduall/topik-admin contents+PR write **+ `workflow` 스코프**). 워크플로 파일을 포함한 소스 커밋을 무-재작성으로 promote 브랜치에 push하므로 `workflow` 스코프가 없으면 CI/워크플로를 건드리는 릴리스가 거부된다(classic이면 `repo`+`workflow`).
- 회사 repo secrets: `EVIDENCE_GITHUB_TOKEN`(blackstarzck PAT — topik-ai actions:read), `ATTESTATION_GITHUB_TOKEN`(blackstarzck PAT — topik-admin PR write; 조직 repo 접근 가능한 종류여야 함 — 개인 계정 fine-grained는 조직 repo를 못 봄).
- 회사 environments: `staging`(topik-dev 자격) / `Production`(운영 자격) — 상세 값 출처는 오너 체크리스트 문서.
- GITHUB_TOKEN 권한: main 대상 게이트는 회사 staging-evidence 아티팩트를 REST로 읽으므로 `promotion-gate.yml`·`release-company-production.yml` 모두 `permissions`에 `actions: read`가 선언돼 있어야 한다(명시 블록이 repo 기본값을 덮는다).
- PAT 만료 시 재발급·재등록(만료가 릴리스 실패로 나타나면 이 항목부터 확인).

## 7. Dry-run 검증 로그

- 2026-07-24 Phase 9 sync-only dry-run으로 전 체인(개인 검증 → promote → gate → attestation → guest stg merge → stg validation → stg→main → production verify 무배포)을 실제 실행해 검증했다. 이 과정에서 발견·수정된 환경/계약 결함:
  - promotion-gate의 아티팩트 파서가 GitHub 아티팩트 zip(데이터 디스크립터)의 로컬 헤더 크기를 신뢰해 실패 → 중앙 디렉터리 기반 파서로 교체.
  - `ATTESTATION_GITHUB_TOKEN`이 조직 repo를 못 보는 종류라 attestation 게시 실패 → 조직 repo 접근 가능한 PAT로 교체.
  - `PROMOTION_GITHUB_TOKEN`에 `workflow` 스코프 부재로 워크플로 변경 커밋 push 거부 → 스코프 추가.
  - `promotion-gate.yml` `permissions`에 `actions: read` 부재로 main 게이트의 staging 아티팩트 조회가 403 → 권한 추가.
- 교훈: 위 4건은 모두 "실배포 전이었다면 릴리스를 막았을" 설정/계약 결함이며, sync-only dry-run이 무배포로 이를 선제 포착했다. canary(실배포) 진입 전 이 로그의 재발 방지 계약 테스트가 유지되는지 확인한다.
