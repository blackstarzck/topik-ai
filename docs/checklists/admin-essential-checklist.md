# TOPIK AI Admin Essential Checklist (Merge Gate)

## 1) 문서 목적
- 이 문서는 관리자 화면 변경의 머지 품질을 객관적으로 판단하는 게이트 문서다.
- 상세 규칙은 원문 문서에서 관리하고, 이 문서는 "차단 기준 + 증빙"만 관리한다.

## 2) 단일 원문(SoT) 맵과 충돌 우선순위
- 실행 지침/리뷰 게이트: `AGENTS.md`
- 프로젝트 코딩 품질 원문: `docs/guidelines/admin-coding-guidelines-antigravity.md`
- TypeScript 구현 표준 원문: `docs/guidelines/typescript-essential-checklist.md`
- 코드 주석 정책 원문: `docs/guidelines/comments-rule.md`
- React 최적화 원문: `docs/guidelines/react-optimization-rule.md`
- 행 클릭 상세 Drawer 레이아웃 원문: `docs/guidelines/admin-detail-drawer-guidelines.md`
- 상태/아키텍처 원문: `docs/architecture/admin-dev-stack.md`, `docs/architecture/admin-frontend-architecture.md`
- 데이터 계약/명명 기준 원문: `docs/specs/admin-data-contract.md`
- 문서 변경 이력 로그: `logs/admin-doc-update-log.md`
- 충돌 해석 우선순위: `AGENTS.md` > `docs/guidelines/admin-coding-guidelines-antigravity.md` > `docs/guidelines/typescript-essential-checklist.md` > `docs/guidelines/comments-rule.md` > `docs/guidelines/react-optimization-rule.md` > `docs/architecture/admin-dev-stack.md`/`docs/architecture/admin-frontend-architecture.md` > 본 문서
- 충돌이 해소되지 않으면 머지하지 않고 이슈를 생성한다.

## 3) 머지 전 하드 게이트 (P0, Blocking)
| ID | 게이트 | Owner | Blocking | 증빙(필수) |
|---|---|---|---|---|
| P0-01 | `AGENTS.md` 6.1 프로젝트 품질 게이트 통과 | FE | Yes | 체크 결과 + 관련 파일 경로 |
| P0-02 | `AGENTS.md` 6.2 React 최적화 게이트 통과 | FE | Yes | 체크 결과 + 코드 위치 |
| P0-03 | 조치성 기능은 `Target Type`, `Target ID`, 감사 로그 확인 경로 제공 | FE | Yes (해당 시) | 화면/코드 캡처 또는 링크 |
| P0-04 | URL 복원 시 동일 목록/필터/정렬/탭 결과 재현 | FE | Yes (해당 시) | 재현 절차 + 결과 기록 |
| P0-05 | 용어/범위 계약(`Users`, `감사 로그`, `시스템 로그`, Commerce/Assessment/Content 포함 IA, 사용자 노출 라벨 한글 기본값) 위반 없음 | FE | Yes | 변경 파일 grep/검토 결과 |
| P0-05B | 데이터/용어/키워드/변수명 정합성 및 일반 관리자 패턴 이탈 여부 검토 완료 | FE | Yes | 검토 결과 + 근거 |
| P0-05A | 페이지 단위 UI는 본문 컨테이너 안에 있고, `등록/추가/생성` 버튼은 본문 우측 상단 또는 `SearchBar` 우측 끝에 `large` 크기로 배치 | FE | Yes (해당 시) | 화면 캡처 + 코드 위치 |
| P0-05C | `Descriptions` 기반 입력 테이블에서 `required` 검증이 있는 항목은 label(`th`) heading에 빨간 `*` 표시 | FE | Yes (해당 시) | 화면 캡처 + 코드 위치 |
| P0-06 | `lint` 통과 | FE | Yes | 실행 명령 + 결과 로그 |
| P0-07 | `typecheck` 통과 | FE | Yes | 실행 명령 + 결과 로그 |
| P0-08 | `build` 통과 | FE | Yes | 실행 명령 + 결과 로그 |
| P0-09 | 변경 영향 핵심 플로우 e2e 테스트 실행 및 통과, 공통 문서 기준 UI 일관성 확인 포함 | FE/QA | Yes | e2e 실행 명령 + 통과 로그 또는 리포트 링크 + 확인한 UI baseline 기록 |
| P0-10 | 변경 영향 MD 문서 평가 완료, 필요 문서 수정 반영 완료 | FE | Yes | 영향 판단 근거 + 수정된 MD 목록 |
| P0-10A | 관리자 테이블/정책/B2C 노출 위치 변경 시 `docs/specs/admin-data-usage-map.md` 평가 및 반영 완료 | FE | Yes (해당 시) | 수정 diff 또는 N/A 근거 |
| P0-10B | 페이지별 상세 IA 문서(`docs/specs/page-ia/*.md`) 또는 IA 템플릿 수정 시 `docs/specs/admin-page-ia-change-log.md` 기록 완료 | FE | Yes (해당 시) | IA 로그 항목 링크 |
| P0-10C | 행 클릭 상세 Drawer 레이아웃 변경 시 `docs/guidelines/admin-detail-drawer-guidelines.md`와 관련 공통/페이지 IA 문서 반영 완료 | FE | Yes (해당 시) | 수정 diff 또는 N/A 근거 |
| P0-10D | API/mock/데이터베이스/응답 스키마/데이터 source 경계 변경 시 `docs/architecture/admin-data-source-transition.md`와 관련 SoT 문서 평가 및 반영 완료 | FE | Yes (해당 시) | 수정 diff 또는 N/A 근거 |
| P0-10E | 엔티티명, 테이블명 후보, 컬럼/필드명, 변수명, enum/code table 후보, 하드코딩된 schema candidate 분류 변경 시 `docs/specs/admin-data-contract.md` 평가 및 반영 완료 | FE | Yes (해당 시) | 수정 diff 또는 N/A 근거 |
| P0-10F | 현재 작업이 `docs/specs/admin-page-gap-register.md` 항목을 생성/해소/상태 변경하는 경우 문서 갱신 완료 | FE | Yes (해당 시) | 수정 diff 또는 N/A 근거 |
| P0-11 | MD를 수정한 경우 `logs/admin-doc-update-log.md`에 기록 완료 | FE | Yes (해당 시) | 로그 항목 링크 |
| P0-12 | 문서 파일(`docs/**`) 추가/삭제/이동 시 `docs/README.md` 인덱스와 로그 동시 반영 | FE | Yes (해당 시) | 인덱스 diff + 로그 항목 링크 |
| P0-13 | 네트워크 상태(`pending/success/empty/error`)별 UX와 복구 경로(재시도/fallback/가이드) 제공 | FE | Yes (해당 시) | 화면 상태별 캡처 + 코드 위치 |
| P0-14 | 통신 장애가 페이지 전체 중단으로 전파되지 않도록 fail-safe(예: Error Boundary, 라우트 fallback, timeout/cancel/retry) 적용 | FE | Yes (해당 시) | 장애 시나리오 점검 결과 |
| P0-15 | 사용자 인터랙션(저장/수정/삭제/확인) 후 UI 응답(`message`/`notification`/상태 반영/오류 안내)이 반드시 노출 | FE | Yes (해당 시) | 인터랙션별 결과 캡처 + 코드 위치 |

## 4) 운영 디테일 보강 체크

### 4-1) P0 운영 리스크 항목 (조건부 Blocking)
| ID | 항목 | Owner | Blocking | 완료 기준 |
|---|---|---|---|---|
| OP-P0-01 | 메뉴/페이지/필드/액션 단위 권한 경계 명시 | FE/BE | Yes (해당 시) | 권한 매트릭스 또는 정책 링크 |
| OP-P0-02 | 민감정보 노출 정책/다운로드 권한 분리 | FE/BE | Yes (해당 시) | 마스킹 규칙 + 접근 제어 근거 |
| OP-P0-03 | API 최종 권한 검증 전제 확인 | BE (FE 확인) | Yes (해당 시) | API 스펙/정책/리뷰 코멘트 |
| OP-P0-04 | 파괴적 액션 재확인(문구 입력 또는 2-step) + 대상 요약 | FE | Yes (해당 시) | UX 캡처 + 코드 위치 |
| OP-P0-05 | 대량 작업 프리뷰/부분 성공/오류 리포트 기준 정의 | FE/BE | Yes (해당 시) | 플로우 문서/화면/응답 규격 |
| OP-P0-06 | 중요 변경 추적(before/after, 변경 필드, 수행자, 사유, request/trace ID) 가능 | FE/BE | Yes (해당 시) | 로그 필드 정의/샘플 |
| OP-P0-07 | 시간대(UTC/KST), 로그 시간 기준 통일 | FE/BE | Yes (해당 시) | 표시/저장 기준 명시 |
| OP-P0-08 | 통화/세금/반올림/숫자 표기 기준 통일 | FE/BE | Yes (해당 시) | 포맷 규칙 문서/코드 근거 |

### 4-2) P1 운영 품질 항목 (Non-Blocking)
| ID | 항목 | Owner | Blocking | 완료 기준 |
|---|---|---|---|---|
| OP-P1-01 | 에러 메시지에 원인/해결/다음 행동 포함 | FE | No | 표준 메시지 템플릿 반영 |
| OP-P1-02 | empty/no-permission/no-data 상태 UI 표준화 | FE/Design | No | 상태별 UI 컴포넌트 확인 |
| OP-P1-03 | 신규 운영자용 필드 설명/툴팁/정책 링크 제공 | FE/PO | No | 화면 점검 결과 |
| OP-P1-04 | 다국어 사용 시 번역 누락/라벨 길이 변화 대응 | FE/Localization | No | i18n 점검 결과 |
| OP-P1-05 | `try-catch` 단독이 아닌 프레임워크 내장 fail-safe(React/Router/통신 라이브러리) 사용 기준 명시 | FE | No | 설계/코드리뷰 코멘트 |

## 5) 증빙 기록 템플릿
| 항목 ID | 결과(PASS/FAIL/N/A) | 증빙 링크/로그 | 담당자 | 비고 |
|---|---|---|---|---|
| 예: P0-06 | PASS | `npm run lint` 로그 링크 | FE | - |

## 6) 범위 외(참고)
- 기능 플래그, 롤백 정책, 릴리즈 노트 등 배포/변경 관리는 프론트엔드 구현 규칙의 직접 범위 밖이다.
- 단, 릴리즈에서 해당 항목이 요구되면 별도 운영/릴리즈 정책 문서에서 추적한다.

