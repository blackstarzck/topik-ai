# Content > 학습 미션 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Content"
page_name: "학습 미션"
route: "/content/missions"
status: "placeholder"
primary_entity: "LearningMission"
primary_table_candidate: "learning_missions, learning_mission_rewards"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-01"
---

## 1. 문서 목적

- 이 문서는 `학습 미션` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Content` |
| 페이지명 | `학습 미션` |
| 라우트 | `/content/missions` |
| 현재 상태 | `placeholder` |
| 페이지 유형 | `정책/시나리오 편집형` |
| 페이지 목적 한 줄 요약 | 학습 미션 정의, 활성화 상태, 보상/배지 연결을 관리할 예정인 화면입니다. |
| 주요 운영자 | `CONTENT_MANAGER, SUPER_ADMIN` |
| 주요 권한 | `content.missions.manage` |
| 코드 근거 | `src/app/router/app-router.tsx placeholder` |
| 연관 SoT 문서 | `docs/specs/page-ia/content-missions-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 미션 조건, 활성화 상태, 포인트/배지 보상 연결을 관리할 예정입니다.
- 미션명, 조건, 보상, 상태, 도달률를 관리자 기준으로 추적합니다.
- 미션 화면과 리워드 영역에 노출 예정으로 연결됩니다.

### 비목표

- 실제 백엔드 스키마 최종 확정은 이 문서에서 담당하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 학습 미션 조회 | 학습 미션의 목록/상세 또는 예정 데이터 블록을 확인합니다. | 조회 | LearningMission | 현재 상태 확인 | 불필요 |
| 학습 미션 관리 | 미션명, 조건, 보상, 상태, 도달률에 대한 등록/수정/상태 변경 또는 예정 계약을 관리합니다. | 미확정 | LearningMission + missionId | 데이터 반영 또는 후속 검증 | 필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LearningMission | learning_missions, learning_mission_rewards | Create, Read, Update, Delete 후보 | 학습 미션 본문/상세/Modal | 미션명, 조건, 보상, 상태, 도달률, id, status, created_at, updated_at | LearningMission + missionId | 노출 예정 | placeholder 기준 후보이며 구현 전 확정 필요 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `미확정` | 학습 미션 등록/생성 후보 | service/store/API 후보 | 목록, 상세, 사용자 화면 후보 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | 학습 미션 조회 | service/store/API 후보 | URL/필터/탭 복원 | empty/error 처리 |
| Update | `미확정` | 학습 미션 수정/상태 변경 후보 | service/store/API 후보 | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 rollback |
| Delete | `미확정` | 학습 미션 삭제/숨김/중지 후보 | service/store/API 후보 | 목록, 상세, 감사 로그, 사용자 노출 | 확인 모달, 사유 필수, 실패 안내 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 학습 미션 주요 조치 | 미확정 | 필수 | 필수 | LearningMission | 대상 ID | /system/audit-logs?targetType=LearningMission&targetId={targetId} |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 미션 화면, 리워드 영역, 마이페이지 성취 | 노출 예정 | 미션명, 조건, 보상, 상태, 도달률 | 미션 화면과 리워드 영역에 노출 예정으로 연결됩니다. | 구현 전 정책 확정 후 | 실제 사용자 화면 저장소 확인 전까지 추정은 추정으로 유지 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Content > 배지 | 참고/후속 | 학습 미션 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| Commerce > 포인트 관리 | 참고/후속 | 학습 미션 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | 학습 미션 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 미션 화면 | 데이터 노출 후보 | 미션명, 조건, 보상, 상태, 도달률 | 학습 미션 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |
| 리워드 영역 | 데이터 노출 후보 | 미션명, 조건, 보상, 상태, 도달률 | 학습 미션 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |
| 마이페이지 성취 | 데이터 노출 후보 | 미션명, 조건, 보상, 상태, 도달률 | 학습 미션 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 초안/활성/중지 후보 | 초안/활성/중지 후보 | page-specific enum candidate | 초안/활성/중지 후보 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |
| 보상 유형 | 보상 유형 | page-specific enum candidate | 보상 유형 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/content/missions`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: page, pageSize, keyword, status, tab, selected 등 페이지별 후보
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: 행 클릭 Drawer/Modal 후보
- 사용자 화면 동기화에 필요한 식별자: LearningMission + missionId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/app/router/app-router.tsx placeholder` 구현과 `docs/specs/page-ia/content-missions-page-ia.md` 문서 일치 확인
  - service/store/mock 경계와 감사 로그 Target 확인
- Claude 확인 포인트:
  - 미션 화면과 리워드 영역에 노출 예정으로 연결됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - 실제 DB/API 필드 확정
  - 사용자 화면 노출 위치 확정
  - 감사 로그 Target Type 세분화

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 학습 미션 최종 계약 | placeholder라 미션 달성 조건 계산과 보상 지급 트리거가 미확정입니다. | 기획/백엔드/프론트 | 필터/액션/감사 로그 계약 변동 가능 | 미션 화면과 리워드 영역에 노출 예정으로 연결됩니다. | docs/specs/page-ia/content-missions-page-ia.md |
