# TOPIK AI Admin 페이지별 상세 IA 변경 로그

## 목적

- 페이지별 상세 IA 문서(`docs/specs/page-ia/*.md`)의 생성/수정 이력을 별도로 추적한다.
- 어떤 정책과 정보 구조가 바뀌었는지 빠르게 확인할 수 있도록 변경 요약을 남긴다.

## 기록 규칙

- 페이지별 상세 IA 문서를 생성하거나 수정하면 이 문서에 1건 이상 기록한다.
- 동일 요청에서 여러 IA 문서를 함께 수정했다면 한 항목으로 묶어 기록할 수 있다.
- 일반 문서 변경 로그는 `logs/admin-doc-update-log.md`에 함께 남긴다.

## 로그 형식

| Date | Page | Change Type | Updated Files | Summary |
| --- | --- | --- | --- | --- |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 검수 메모 카드에 `수정 필요`와 `보류` 액션을 복원하고 상태 변경 UX를 일반화 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-gap-register.md` | 2depth 검수 페이지 우측 카드에서 `검수 완료`만 노출하던 흐름을 현재 상태 계약에 맞게 조정해, `검수 완료`, `수정 필요`, `보류`를 모두 같은 기본 버튼 톤으로 제공하고 최신 `review_memo`를 먼저 저장한 뒤 상태를 바꾸도록 IA와 현재 상태 설명을 갱신했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 수정 히스토리 기본 컬럼을 축소하고 확장 `Descriptions` 구조로 재구성 | `docs/specs/page-ia/assessment-question-bank-page-ia.md` | `수정 히스토리` 기본 행은 `수정 일시`, `수정자`, `수정 유형`만 보여주고, 확장 행에서는 `Descriptions` 안에 `검수자 메모`, `반영 리뷰`, `반영 필드(changed_fields[])`를 순서대로 확인하도록 IA를 갱신했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 수정 히스토리 테이블을 검수 메모 + 반영 리뷰 중심으로 재구성 | `docs/specs/page-ia/assessment-question-bank-page-ia.md` | `수정 히스토리`는 과거 검수 메모와 AI 반영 리뷰를 비교하는 블록이라는 계약에 맞춰, 테이블 기본 행에서는 `수정 일시`, `수정 유형`, `수정자`, `반영 소스`만 보여주고 확장 행에서 `검수자 메모`, `반영 리뷰`, 반영 필드 칩을 확인하도록 IA를 보강했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 검수 페이지 우측 액션 단순화와 `검수 완료` 흐름 고정 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-gap-register.md` | 2depth 검수 페이지 우측 카드에서 별도 `검수 메모 저장`, `보류`, `수정 필요`, 카드 내부 `감사 로그 확인`을 제거하고 `검수 메모 입력 -> 검수 완료` 단일 흐름으로 정리했다. 감사 로그 이동은 성공 피드백 경로로 유지하고, 관련 IA와 갭 레지스트리를 현재 구현 기준으로 갱신했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | AI 검수 목적과 유형별 검수 계약 보강 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-page-gap-register.md` | `검수 메모 = 적합성 판단`, `검수 완료 = 검수 종료 + JSON 내보내기 대상`, `수정 히스토리 = 과거 검수 메모 + AI 반영 설명` 규칙을 IA에 반영하고, `51/52`, `53`, `54` 문항별 검수 필드 차이를 문서 SoT로 고정했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 문제 번호 다중 선택과 기본 전체 선택 반영 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md` | `51~54번` 체크박스를 다중 선택 필터로 재정의하고, `questionNo`는 부분 선택일 때만 반복 파라미터로 유지하도록 URL 복원 규칙을 문서에 반영했다. |
| 2026-03-31 | `Assessment > TOPIK 쓰기 문제은행` | 검색바를 공용 목록형 `SearchBar` 셸 기준으로 재정렬 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-gap-register.md` | 문제은행 검색바를 page-local 필드 나열이 아니라 공용 목록형 `SearchBar` 패턴으로 다시 맞추고, 상세 검색은 팝오버 안에서 처리하는 기준으로 재정리했다. |
| 2026-03-30 | `Assessment > TOPIK 쓰기 문제은행` | 검수 메모 저장을 상태 변경 선행 조건으로 반영 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-action-log.md`, `docs/specs/admin-page-gap-register.md` | 검수 메모가 실제 검수 근거가 되도록 `검수 메모 저장 -> 검수 상태 변경` 규칙과 `AssessmentQuestion + questionId` 감사 로그 계약을 함께 문서화했다. |
| 2026-03-30 | `Assessment > TOPIK 쓰기 문제은행` | 2depth 검수 분리와 목록 Drawer 역할 조정 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md` | 검수 큐의 상세 확인은 2depth 검수 페이지로 분리하고, 목록 Drawer는 빠른 상세와 운영 상태 조치만 담당하도록 역할을 재정의했다. |
| 2026-03-30 | `Assessment > TOPIK 쓰기 문제은행` | `53/54번` 카드형 검수 워크스페이스 반영 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-page-gap-register.md` | `53/54번` 장문형 문항에 맞춰 검수 문서 렌더링을 카드형 워크스페이스로 정리하고, 51/52와 다른 읽기 순서와 필드 집합을 예외 규칙으로 반영했다. |
| 2026-03-27 | `System > 메타데이터 관리` | 목록/Drawer/Tree 운영 값 UX 재정리 | `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-page-gap-register.md` | 목록 보조 텍스트를 줄이고, 상세 Drawer의 `설정 구조` Tree와 운영 값 정렬 흐름을 현재 구현 기준으로 다시 맞췄다. |
| 2026-03-26 | `Operation > 정책 관리` | 이력 Drawer와 본문 미리보기 구조 재정의 | `docs/specs/page-ia/operation-policies-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md` | 정책 이력을 Drawer 중심으로 재정리하고, 본문 미리보기와 버전 게시 흐름을 현재 구현 기준으로 문서화했다. |
| 2026-03-26 | `Commerce > 쿠폰 관리` | 템플릿/발행/상태 UX 문서 동기화 | `docs/specs/page-ia/commerce-coupons-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-page-gap-register.md` | 쿠폰과 정기 쿠폰 템플릿의 생성/상태/발행 조치 흐름을 공용 목록형 테이블과 편집 화면 기준으로 다시 정리했다. |
| 2026-03-18 ~ 2026-03-25 | `기타 페이지 IA 이력` | 인코딩 손상 복구 전 축약 보존 | `logs/admin-doc-update-log.md` 참조 | 과거 일부 IA 변경 로그는 인코딩 손상으로 상세 복원이 어려워, 현재는 문서 변경 로그(`logs/admin-doc-update-log.md`)를 상세 이력의 보조 SoT로 사용한다. 필요 시 해당 로그를 기준으로 항목을 재확장한다. |
