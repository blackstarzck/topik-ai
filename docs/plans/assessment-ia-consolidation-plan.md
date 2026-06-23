# 평가(Assessment) IA 통합 작업 명세 — "메뉴 1 + 탭 2"

> 자급식 실행 명세. 새 세션(같은 repo 폴더)에서 이 문서 + 아래 파일들을 읽고 그대로 구현하면 된다.
> 결정·근거는 Opus 4.8 + GPT-5.5 멀티에이전트 토론 결과(2026-06-23). **구현 전 코드 먼저 읽을 것.**

## 0. 목표 (한 줄)

평가 좌측 메뉴의 **TOPIK 쓰기 문항 3개(목록·관리·인박스)** 를 **메뉴 1개 + route-backed 탭 2개**로 통합한다.

## 1. 왜 (결정 근거)

- **목록(`/assessment/question-bank`)과 관리(`/assessment/question-bank/manage`)는 같은 객체** — 둘 다 §7 추천 뷰(`topik_writing_question_recommendation_view`)를 읽고, 관리만 쓰기(노출/태그)가 추가됨. "조회 vs 쓰기"를 메뉴로 나누는 건 안티패턴 → **하나로 통합, 쓰기는 권한 게이팅으로 인라인.**
- **인박스(`/assessment/question-bank/imported`)는 진짜 다른 것** — 다른 테이블(`topik_writing_question_import`), 승격 전 단계, 가져오기 버튼. **데이터 계층은 절대 합치지 말 것**(별도 훅·테이블 유지). 단 메뉴/화면 셸은 같이 둠(탭).
- 상세(`/assessment/question-bank/:questionId`)는 읽기 전용 별도 라우트로 유지.

## 2. 목표 구조

**좌측 메뉴(평가 하위): 단일 항목 "TOPIK 쓰기 문항" → `/assessment/question-bank`**

페이지 상단에 **route-backed 탭 2개**(antd Tabs; 탭 클릭 = 해당 라우트로 이동, 활성 탭은 현재 경로에서 도출):

- **탭① 「문항」** → `/assessment/question-bank`
  - 통합 인벤토리 = 현재 **관리 페이지(`assessment-question-manage-page.tsx`)를 기준**으로 함(이미 조회+쓰기 표면).
  - 거기에 목록 페이지의 **요약 카드(번호별 51/52/53/54)** 도 함께 노출(상태별 카드와 병행 가능).
  - **쓰기 액션(노출 상태 버튼 + 태그 편집 + POL-018 가드)은 권한 `assessment.question-bank.manage` 있을 때만** 인라인 렌더. 권한 없으면 액션 열·버튼 숨김(=조회 전용처럼 보임).
  - 노출상태 필터 유지(상태는 "필터", 행 이동 아님).
- **탭② 「가져온 문항(인박스)」** → `/assessment/question-bank/imported`
  - 현재 `assessment-imported-tasks-page.tsx` 내용 그대로(별도 데이터 훅 `useImportedTasks`, 가져오기 버튼, 승격/보류 상태). **쓰기는 §7 쪽 아님 — 적재/가져오기만.**

**상세** `/assessment/question-bank/:questionId` — 읽기 전용 유지(탭 밖, 2-depth). 목록으로 돌아가기는 `/assessment/question-bank`.

**`/assessment/question-bank/manage` 라우트는 제거** → `/assessment/question-bank`로 **redirect**(북마크·감사 링크 보존; redirect는 route-doc 커버리지 면제).

## 3. 변경 파일 (먼저 읽고 → 수정)

- `src/app/router/routes.ts` — `SimplePageRouteKey`에서 `assessment-question-manage` 제거; `/assessment/question-bank/manage` page 항목 제거 후 **redirect**(`{ kind:'redirect', path:'/assessment/question-bank/manage', to:'/assessment/question-bank' }`) 추가. `/question-bank`·`/imported`·`/:questionId`는 유지(둘 다 탭으로 쓰이지만 라우트는 각자 유지 — URL 상태/문서 소유).
- `src/app/router/route-elements.tsx` — `assessment-question-manage` 케이스/lazy import 제거. `assessment-question-bank` → 통합 페이지(탭 셸). `assessment-imported-tasks` → 같은 탭 셸의 인박스 탭(또는 셸이 라우트로 분기).
- `src/shared/layout/admin-shell.tsx` — 평가 children에서 **관리·인박스 항목 제거**, "TOPIK 쓰기 문항"(→`/question-bank`) 단일만. selected-key resolver: `/assessment/question-bank/*` 전부 `/assessment/question-bank`로(현 459-463 단순화). openKeys 확인.
- `src/shared/layout/admin-breadcrumb.tsx` — `/manage` 브랜치 제거. `/imported`·`/:questionId`는 `평가 > TOPIK 쓰기 문항 > {탭/상세}` 형태로. (현 253-285 정리)
- `src/shared/layout/admin-labels.ts` — `assessmentQuestionBank` 유지. `assessmentQuestionManage`·`assessmentImportedTasks`는 탭 라벨로 재활용하거나 정리.
- 페이지 컴포넌트:
  - 공유 **탭 셸**(Tabs 헤더 + 활성 탭=현재 라우트)을 만들고, 탭① 본문=통합 문항(관리 페이지 베이스 + 권한 게이팅 + 요약카드), 탭② 본문=기존 인박스 페이지.
  - **권한 훅**: 다른 화면이 권한 확인하는 방식을 따를 것(nav의 `permissionKeys`/권한 스토어 탐색). 권한 없으면 액션 미렌더.
  - `assessment-question-bank-page.tsx`(구 목록 전용)는 통합 페이지로 흡수하거나 제거.
- `docs/specs/page-ia/` — `assessment-question-bank-page-ia.md`에 통합(조회+쓰기) 반영, `assessment-question-manage-page-ia.md`는 redirect되므로 내용 병합 후 정리(커버리지는 `/question-bank`·`/imported`만 있으면 통과). `assessment-question-bank-imported-page-ia.md` 유지.
- `tests/e2e/assessment-question-bank.spec.ts` — **핵심 재정비**:
  - 구 `/manage` 테스트 → `/assessment/question-bank`로 경로 변경, 제목 통합.
  - 같은 URL에서 "조회 상태 vs 관리 상태"를 권한 픽스처로 분리하거나, mock 관리자가 manage 권한 보유이므로 통합 페이지에 액션이 보이는 전제로 재작성.
  - 탭 전환 테스트 추가(문항 ↔ 가져온 문항).

## 4. 제약 / 함정

- **인박스 데이터 계층 분리 유지** — 인박스 훅/테이블을 §7 목록과 합치지 말 것(섞이면 인박스 행이 §7 목록에 새거나 POL-018 오작동).
- **조회 vs 쓰기 = 라우트 아님, 권한**. read-only 관리자에게 쓰기 컨트롤 노출 금지.
- 탭은 **route-backed**(`?tab=` 금지 — 라우트별 URL 상태/문서 소유).
- 기존 적재 기능(인박스·가져오기 버튼·승격/cron) **건드리지 말 것** — 동작 유지.
- 게이트(반드시 통과): `npm run typecheck` · `npm run lint`(⚠️ 기존 무관 에러 `src/features/message/pages/message-template-create-page.tsx:174`는 **이 작업 소관 아님 — 손대지 말 것**) · `npm run check:mojibake` · `node ./scripts/check-route-doc-coverage.mjs` · `npm run test:unit` · `npm run test:e2e:mock`.
- 검증: 모크 프리뷰(launch.json `topik-ai-mock`, 4188)로 탭/권한/인박스 렌더 확인. 실모드 확인은 `topik-ai-supabase`(4189) + 관리자 세션 주입.

## 5. 비목표

- 데이터 모델·적재/승격 RPC·검수 게이트 변경 없음(완료됨).
- 운영 DB 적용·커밋은 이 작업 범위 아님(별도).
