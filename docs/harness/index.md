# TOPIK AI Admin Harness

## CI/CD 자동 게이트 (2026-07-21)

- PR은 `sync-only | app-only | db-only | app-db | blocked`로 fail-closed 분류하며 required check는 `.github/workflows/ci.yml`의 `ci-gate` 하나다. workflow-level path filter는 사용하지 않는다.
- `sync-only`는 변경 성격에 따라 light/full 검증만 수행하고, `app-only`는 quality·build·mock E2E, `db-only`와 `app-db`는 여기에 전체 shadow DB 계약을 추가한다. 기존 forward migration 변경과 알 수 없는 경로는 차단한다.
- `npm run db:contracts:verify`는 development/production manifest의 `release-all`, down pair, project ref를 정적으로 검사한다.
- `npm run check:expand-migrations -- --base <SHA>`는 기존 migration 변경과 contract 축소 SQL을 차단한다.
- `npm run db:shadow:verify -- --v13-dir <PATH> --v13-sha <SHA>`는 고정 v13, `topik_writing`, admin migration을 로컬 Supabase에 재생하고 Users RPC·권한을 확인한다.
- `main → 경로별 topik-dev 검증 → 회사 저장소 → 필요 시 topik-prod 후보 → Production 승격` 순서와 실패 정책은 `docs/architecture/admin-cicd-pipeline.md`를 단일 원문으로 사용한다.

## 1. 목적

- 이 문서는 TOPIK AI Admin 저장소에서 Codex와 사람이 함께 사용하는 기본 하네스를 정의한다.
- 목표는 `문서 SoT`, `기계 검증`, `공통 운영 플로우`, `지속적인 문서 가드닝`을 하나의 실행 체계로 묶는 것이다.
- 기준은 OpenAI의 Harness Engineering 글에서 제시한 `짧은 진입점 + 저장소 내부 SoT + 기계적 가드레일 + 반복 피드백 루프` 방향을 이 프로젝트 구조에 맞게 번역한 것이다.

## 2. 하네스 원칙

- `AGENTS.md`는 백과사전이 아니라 진입점이다. 상세 규칙은 `docs/**`가 SoT로 가진다.
- 데이터 정합성, 디자인/레이아웃/컴포넌트 일관성, 운영/정책 문서 최신성은 문서 지시만이 아니라 스크립트와 테스트로 반복 검증한다.
- 라우트, IA, 공통 UI, 감사 로그 계약이 서로 어긋나면 코드보다 먼저 하네스를 보강한다.
- 사용자 요구사항이 MD 수정/삭제와 연결되면 같은 작업에서 문서를 갱신하고 하네스 검증으로 드리프트를 잡는다.
- 결과 보고에는 항상 `영향 모듈`, `데이터 계약`, `공통 UI`, `운영/정책`, `검증 범위`를 남긴다.

## 3. 구성

### 3.1 지식 하네스

- 진입점: `AGENTS.md`
- 상위 SoT: `docs/architecture/admin-overview.md`
- 구조 인덱스: `docs/README.md`
- 도메인 계약:
  - `docs/specs/admin-data-contract.md`
  - `docs/specs/admin-action-log.md`
  - `docs/specs/admin-page-tables.md`
  - `docs/specs/page-ia/*.md`

### 3.2 구조 하네스

- `scripts/check-doc-crosslinks.mjs`
  - 문서와 `AGENTS.md` 안의 `docs/**`, `logs/**` 참조가 실제 파일과 일치하는지 검사한다.
  - `docs/README.md`에 활성 문서가 모두 인덱싱되어 있는지 검사한다.
- `scripts/check-route-doc-coverage.mjs`
  - `src/app/router/routes.ts`의 라우트 메타데이터와 `docs/specs/page-ia/*.md`의 라우트 문서화 상태를 교차검사한다.
  - redirect alias는 허용하고, 실제 운영 라우트의 문서 누락만 차단한다.

### 3.3 검증 하네스

- `npm run harness:check`
  - 인코딩 검사
  - 문서 교차참조 검사
  - 라우트-IA 커버리지 검사
  - lint
  - typecheck
- `npm run harness:e2e:smoke`
  - 공통 테이블 정렬 baseline
  - 공통 액션 컬럼 baseline
  - `Operation > 정책 관리`
  - `System > 메타데이터 관리`
- `npm run harness:full`
  - `harness:check`
  - build
  - 대표 e2e smoke

### 3.4 플로우 하네스

- `tests/e2e/harness/admin-flow-helpers.ts`
  - `Modal`, `Drawer`, 확인 사유 입력, 공통 Descriptions 입력 같은 운영 플로우 helper를 모은다.
- 원칙:
  - 페이지별 테스트보다 `목록 -> 상세 -> 조치 -> 감사 로그`, `편집 -> 확인 -> 발행`, `pending/empty/error` 같은 운영 패턴을 우선 재사용한다.

## 4. 현재 커버 범위

- 데이터 정합성:
  - 라우트와 IA 계약의 일치 여부
  - 문서 참조와 인덱스 정합성
- 디자인/레이아웃/컴포넌트 일관성:
  - 공통 테이블 텍스트 정렬 baseline
  - 공통 액션 컬럼 고정 baseline
  - 대표 운영 페이지에서 Drawer/Modal/감사 로그 흐름 baseline
- 운영/정책 문서 최신성:
  - 정책 관리, 메타데이터 관리 같은 대표 운영 페이지 smoke e2e
  - 문서 변경 로그와 README 인덱스 갱신 규칙

## 5. 실행 순서

1. 작은 문서/코드 변경
   - `npm run harness:check`
2. 공통 UI, 라우트, 운영 플로우 변경
   - `npm run harness:check`
   - `npm run build`
   - `npm run harness:e2e:smoke`
3. 고위험 운영 정책 변경
   - 위 명령에 더해 관련 모듈 e2e를 추가 실행
   - 문서 SoT와 로그를 같은 작업에서 갱신

## 6. 실패 해석

- `check-doc-crosslinks` 실패:
  - 삭제된 문서 참조 또는 README 인덱스 누락 가능성이 높다.
- `check-route-doc-coverage` 실패:
  - 라우트가 추가/삭제됐는데 IA 문서가 따라오지 않았을 가능성이 높다.
- `harness:e2e:smoke` 실패:
  - 공통 UI baseline 또는 대표 운영 흐름이 깨졌을 가능성이 높다.

## 7. 다음 단계

- `check-admin-invariants.mjs`
  - `Users` 복수형, `감사 로그/시스템 로그` 용어, 공통 버튼 배치 같은 전역 규칙을 정적 검사로 승격
- 문서 가드닝 자동화
  - 운영/정책 관련 파일 변경 시 관련 MD 갱신 여부를 경고
- 관측 가능성 확장
  - Playwright trace, console error, failed request를 smoke 결과에 함께 수집
