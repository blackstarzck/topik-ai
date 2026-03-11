# TOPIK AI Admin 코딩 가이드라인 (Coding Guidelines)

## 문서 계약

- 기준 모듈: Dashboard, Users, Community, Message, Operation, Commerce, Assessment, Content, Analytics, System
- 메뉴명은 `Users`(복수형)로 표기하며, `User` 단수형 사용을 금지합니다. (참조: `docs/architecture/admin-information-architecture.md:63`)
- 감사 로그 용어는 `감사 로그`로 통일합니다. (참조: `docs/architecture/admin-information-architecture.md:64`, `docs/specs/admin-action-log.md:4`)
- `시스템 로그`는 기술 로그로 감사 로그와 구분합니다. (참조: `docs/architecture/admin-information-architecture.md:65`)
- Users 상세 탭 고정: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` (참조: `docs/architecture/admin-information-architecture.md:66`)
- 확장 모듈 포함: `Commerce`, `Assessment`, `Content` (참조: `docs/architecture/admin-information-architecture.md`)

## 근거 문서

- `docs/architecture/admin-information-architecture.md`
- `docs/specs/admin-page-analysis.md`
- `docs/specs/admin-page-tables.md`
- `docs/specs/admin-user-detail-page-structure.md`
- `docs/specs/admin-action-log.md`
- `docs/guidelines/typescript-essential-checklist.md`
- `docs/guidelines/comments-rule.md`

## 적용 범위

- 본 문서는 TOPIK AI Admin 프론트엔드 구현 시 Antigravity 실행 지침으로 사용합니다.
- 대상 범위는 `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System`, `Dashboard` 모듈입니다.
- 메뉴명/로그 용어는 문서 계약을 우선합니다: `Users`, `감사 로그`, `시스템 로그`.

## 공통 원칙

- 모든 조치 코드는 운영 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 훼손하지 않아야 합니다.
- 파괴적 액션(정지/삭제/환불/숨김/사용자 정지)은 확인 단계와 사유/근거를 남길 수 있어야 합니다.
- 표준 상태값을 임의 변경하지 않습니다(예: `정상/정지/탈퇴`, `게시/숨김`, `완료/취소/환불`).
- 네트워크/서버 상태는 최소 `pending`, `success(result)`, `empty`, `error`를 구분해 UX에 반영합니다.
- 통신 안정성은 `try-catch`에만 의존하지 않고 Error Boundary, 라우트 fallback, 재시도/취소/타임아웃, 마지막 성공 상태 fallback 같은 fail-safe를 함께 설계합니다.
- 통신 실패가 발생해도 화면/기능 단위로 장애를 격리해 전체 서비스 중단을 방지합니다.

## CRUD 피드백 컴포넌트 선택

- Create/Update/Delete 등 사용자 조치 이후에는 상황에 맞는 피드백 컴포넌트를 선택해 즉시 상태를 안내합니다.
- CRUD 실행 완료 시 기본 성공 피드백 채널은 `message.success`를 사용합니다.
- 조치 결과의 맥락 정보(`Target Type`, `Target ID`, 사유/근거, 감사 로그 확인 링크)가 필요하면 `notification`을 사용합니다.
- 파괴적 액션의 사전 확인은 `Popconfirm` 또는 `Modal`을 사용하고, 사유/근거 입력이 필요하면 `Modal`/확인 다이얼로그(`ConfirmAction`)를 사용합니다.
- 동일 화면에서 피드백 방식이 혼재되지 않도록 액션 성격별 기준을 일관되게 적용합니다.
- 성공 이벤트에서 `message.success`와 `notification.success`를 동시에 노출하지 않습니다.

### Message 규칙 (기본)

- Create/Update/Delete 완료 직후 1회 노출을 기본으로 사용합니다.
- 문구는 `조치명 + 완료` 형태로 짧게 유지합니다.
- 목록/상태 갱신과 함께 호출해 실제 반영과 피드백 시점을 일치시킵니다.

```tsx
messageApi.success('게시글 숨김 완료');
```

### Popconfirm 규칙 (Delete)

- Delete 액션의 기본 확인 UI는 `Popconfirm`을 우선 사용합니다.
- `Popconfirm`은 즉시 확인/취소가 가능한 단순 삭제 시나리오에 사용합니다.
- 삭제 사유 입력이 필요하면 `Modal` 또는 `ConfirmAction`으로 승격합니다.

```tsx
<Popconfirm
  title="게시글 삭제"
  description="삭제 후 복구가 어렵습니다. 계속하시겠습니까?"
  okText="삭제"
  cancelText="취소"
  onConfirm={handleDelete}
>
  <Button danger>삭제</Button>
</Popconfirm>
```

### Notification 예외 규칙

- 감사 추적 정보(대상 유형/대상 ID/사유/로그 링크)를 함께 보여줘야 할 때만 `notification`을 사용합니다.
- 가능하면 조치 응답에서 `auditLogId`를 수신해 해당 로그로 이동시키고, 수신 불가 시 `대상 유형/대상 ID` 필터 딥링크를 사용합니다.

## 최적화

### Do
- 테이블 화면(`Users`, `Community`, `System > 감사 로그`)은 server-side pagination/filter/sort를 기본값으로 사용합니다.
- 대량 데이터(긴 목록)는 가상 스크롤(`virtual` + `scroll.y`) 적용 여부를 우선 검토합니다.
- 고비용 렌더 경로(복잡 셀 포맷팅, 대량 조건부 렌더)는 측정 후 국소 최적화합니다.

### Do Not
- 목록 전체를 클라이언트에 적재한 뒤 후처리하는 방식을 기본 전략으로 사용하지 않습니다.
- 측정 없이 `useMemo`/`useCallback`을 관성적으로 남발하지 않습니다.
- 전역 리렌더를 유발하는 단일 거대 상태 저장소 패턴을 기본으로 채택하지 않습니다.

### Checklist
- [ ] 목록 쿼리는 페이지/정렬/필터 단위로 서버에서 처리되는가?
- [ ] 대용량 화면에 가상 스크롤 검토 결과가 기록되었는가?
- [ ] 렌더 병목이 확인된 지점만 최적화했는가?

## 데이터 정합성

### Do
- 조치 API 호출 후 관련 리소스만 선택적으로 invalidate/재조회합니다.
- 조치 대상 식별자(`Target Type`, `Target ID`)를 UI와 로그에서 일관되게 유지합니다.
- 필터/정렬/탭 상태를 URL 파라미터와 동기화해 재현 가능한 화면 상태를 보장합니다.

### Do Not
- 성공 토스트만 띄우고 목록/상세/로그 상태를 갱신하지 않는 구현을 두지 않습니다.
- 동일 상태를 서로 다른 명칭으로 중복 관리하지 않습니다.
- `감사 로그`와 `시스템 로그`를 같은 데이터 소스로 취급하지 않습니다.

### Checklist
- [ ] 조치 후 목록/상세/감사 로그 화면의 데이터가 서로 모순되지 않는가?
- [ ] 상태값 문자열이 문서 기준 세트와 정확히 일치하는가?
- [ ] URL 복원 시 동일한 결과 집합이 재현되는가?

## 영향도

### Do
- 변경 전 영향을 받는 모듈을 명시합니다(예: `Users` 조치가 `System > 감사 로그`와 `Commerce`에 미치는 영향).
- 파괴적 액션은 확인 모달에서 영향 범위(노출 중단, 권한 제한, 결제 상태 변경 가능성)를 안내합니다.
- 변경 후 운영자가 검증할 경로(감사 로그 딥링크)를 함께 제공합니다.

### Do Not
- 조치 버튼만 추가하고 사후 검증 경로를 제공하지 않는 구현을 두지 않습니다.
- 권한 없는 사용자에게 실행 버튼을 활성화한 채 서버 에러로만 막지 않습니다.
- 전역 공용 컴포넌트 변경을 영향도 분석 없이 배포하지 않습니다.

### Checklist
- [ ] 변경사항에 대한 영향 모듈 목록이 PR/문서에 기록되었는가?
- [ ] 파괴적 액션은 확인 단계와 영향 안내를 포함하는가?
- [ ] 조치 직후 감사 로그 확인 경로가 제공되는가?

## 재활용

### Do
- 공통 패턴(`AdminDataTable`, `FilterBar`, `ActionConfirm`, `AuditLogLink`)을 우선 재사용합니다.
- 모듈별 구현은 공통 컴포넌트 위에 도메인 옵션만 얹는 방식으로 구성합니다.
- 동일한 상태 배지/오류 메시지/확인 모달 문구 템플릿을 재사용합니다.

### Do Not
- 페이지마다 별도의 테이블/필터/확인 모달 구현을 새로 복제하지 않습니다.
- 같은 액션(예: `회원 정지`)에 화면마다 다른 문구/단계를 사용하지 않습니다.
- 공통 레이어를 우회해 모듈 내부에서 HTTP 클라이언트를 직접 중복 생성하지 않습니다.

### Checklist
- [ ] 신규 화면이 기존 공통 컴포넌트로 구현 가능한지 먼저 검토했는가?
- [ ] 동일 액션 UX(확인/피드백/로그 링크)가 다른 화면과 동일한가?
- [ ] 중복 유틸/중복 API 래퍼를 추가하지 않았는가?

## 확장성

### Do
- 기능 추가 시 현재 IA 모듈 경계를 유지하고 feature 단위로 폴더/책임을 분리합니다.
- 탭/필터/액션 증설 시 기존 인터페이스를 깨지 않는 확장 포인트를 사용합니다.
- 권한 정책/상태값/컬럼 구성을 하드코딩 대신 선언형 설정으로 관리합니다.

### Do Not
- 단기 편의로 모듈 경계를 깨고 서로의 내부 상태를 직접 참조하지 않습니다.
- 향후 확장을 막는 단일 거대 컴포넌트를 생성하지 않습니다.
- 도메인 정책(권한, 로그 연계)을 컴포넌트 내부에 산발적으로 박아넣지 않습니다.

### Checklist
- [ ] 변경이 특정 feature 경계 안에서 닫히는가?
- [ ] 신규 탭/필터/액션 추가 시 기존 코드 수정량이 과도하지 않은가?
- [ ] 권한/정책/로그 연계 규칙이 선언형으로 중앙 관리되는가?

## Do

- 문서 계약의 용어/범위를 코드 규칙보다 우선 적용합니다.
- 조치 후 검증 가능성(감사 로그 확인 가능)을 항상 보장합니다.

## Do Not

- `Users`를 `User`로 표기하거나 `감사 로그`와 `시스템 로그`를 혼용하지 않습니다.

## Checklist

- [ ] 5대 품질 축(최적화/데이터 정합성/영향도/재활용/확장성)이 모두 반영되었는가?
- [ ] 각 축의 Do/Do Not/Checklist를 코드리뷰 체크리스트로 전환했는가?
- [ ] 관리자 도메인 예시(`Users`, `Community`, `Commerce`, `Assessment`, `Content`, `감사 로그`)가 각 축에 포함되었는가?
- [ ] 네트워크 상태(`pending/success/empty/error`)별 UX와 fail-safe(재시도/취소/타임아웃/fallback/격리)가 확인 가능한가?

## 제외 범위

- 백엔드 아키텍처, 배포/인프라, DB 스키마 설계는 본 지침 범위에서 제외합니다.

