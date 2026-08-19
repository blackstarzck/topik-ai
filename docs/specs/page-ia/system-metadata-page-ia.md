# System > 메타데이터 관리 상세 IA

## 1. 문서 목적

- `System > 메타데이터 관리` 페이지의 현재 운영 목적과 상호작용 구조를 고정합니다.
- 비개발자 운영자도 `무엇을 관리하는 곳인지`, `어디를 먼저 봐야 하는지`, `어떤 값이 실제 운영 선택지인지`를 이해할 수 있게 설명 레이어와 데이터 구조를 함께 기록합니다.
- 메타 그룹/운영 값 조치 이후 `감사 로그 확인`까지 이어지는 기본 흐름과 `SystemMetadataGroup + groupId` 감사 계약을 문서 SoT로 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | System |
| 페이지명 | 메타데이터 관리 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 목록 운영형 |
| 라우트 | `/system/metadata` |
| 화면 제목 | `운영 설정 카탈로그` |
| 주요 권한 | `system.metadata.manage` |
| 주요 role | `OPS_ADMIN`, `SUPER_ADMIN` |
| 연관 문서 | `docs/specs/admin-page-tables.md`, `docs/specs/admin-action-log.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/architecture/admin-data-source-transition.md` |

## 3. UI 예외

- 예외 없음

## 4. 페이지 목표와 비목표

### 목표

- 여러 관리자 화면에서 공통으로 재사용하는 선택지, 상태값, 노출 규칙을 그룹 단위로 조회하고 관리합니다.
- 운영자는 목록에서 설정 후보를 찾고, 상세 Drawer에서 `기본 정보 -> 설정 구조 -> 지금 운영 중인 값 -> 변경 이력` 순서로 검토합니다.
- 운영 값은 드래그 정렬과 수정/상태 변경을 통해 관리하고, 조치 후에는 `감사 로그 확인`으로 사후 검증합니다.

### 비목표

- 개별 화면 전용 문구, 임시 UI 텍스트, 단발성 렌더링 값은 이 페이지에서 직접 관리하지 않습니다.
- 실제 B2C 노출 화면을 이 페이지가 직접 편집하지 않습니다. 여기서는 관련 사용자 surface를 추적만 합니다.
- item-level 감사 Target Type을 분리하지 않습니다. 현재 조치는 모두 그룹 단위 감사 계약을 사용합니다.

## 5. 운영자 사용 시나리오

- 시나리오 1: 운영자가 요약 카드와 검색으로 기능 영역을 좁힌 뒤, 설정 목록에서 대상 그룹을 선택합니다.
- 시나리오 2: 운영자가 상세 Drawer의 `기본 정보`에서 영향 범위를 확인하고, `설정 구조` Tree에서 현재 값 계층과 추가 진입점을 파악합니다.
- 시나리오 3: 운영자가 `지금 운영 중인 값` 테이블에서 라벨/상태를 검토하고, 드래그로 순서를 바꾸거나 `운영 값 수정`을 실행합니다.
- 시나리오 4: 운영자가 설정 활성/비활성 또는 운영 값 수정 후 `감사 로그 확인` 링크로 이동해 `Target Type = SystemMetadataGroup`, `Target ID = groupId` 기준으로 증적을 검수합니다.

## 6. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 안내 Alert | 페이지 목적과 사용 순서 설명 | 운영 설정 정의, 3단계 사용 가이드 | 없음 | System 감사 로그, 각 기능 화면의 메타 설정 이해 보조 | 직접 영향 없음 |
| 요약 카드 | 기능 카테고리 단위로 범위 축소 | 전체 설정, 회원/권한, 메시지 발송, 운영/노출, 커머스/혜택 | 카드 선택 | 관련 기능 화면으로 사고 흐름 연결 | 직접 영향 없음 |
| SearchBar | 설정 탐색과 상태 복원 | 검색어, 최근 수정일, 총 설정 수 | 검색, 상세 검색, 설정 추가 | 상세 Drawer 진입 대상 결정 | 직접 영향 없음 |
| 설정 목록 테이블 | 그룹 단위 비교와 상세 진입 | 설정명, 소속 기능, 운영 값 요약, 사용자 영향, 운영 상태, 최근 수정 | 행 클릭, 상세 보기, 설정 수정, 운영 값 추가, 활성/비활성 | 각 기능의 공통 설정 변경 진입점 | 간접 영향 |
| TOPIK 쓰기 마스터 카탈로그 | 평가 주제/태그 마스터 실데이터 조회(P5-1) + 태그 활성/비활성 통제(P5-3) | 주제 마스터(종합/세부/정렬/상태/출처/메모), 태그 마스터(코드/태그명/그룹/상태/설명/사용 규칙) — Supabase 전수 조회(비활성 포함) | 태그 마스터 활성/비활성 토글(사유 필수·platform_admin RPC 가드) — 그 외 조회 전용 | TOPIK 쓰기 문항 목록/관리의 필터 축·태그 부여 옵션의 기준 사전(비활성 태그는 부여 옵션 제외) | 추천 노출 축의 원천(간접 영향) |
| 상세 Drawer | 설정 구조와 실제 운영 값을 관리 | 기본 정보, 설정 구조 Tree, 운영 값 테이블, 고급 정보, 변경 이력 | 운영 값 추가, 수정, 순서 변경, 상태 변경, 설정 활성/비활성, 감사 로그 이동 | System 감사 로그와 직접 연결 | 간접 또는 직접 영향 |
| 등록/수정 Modal | 그룹/운영 값 생성과 수정 | 그룹 메타 정보, 운영 값 코드/라벨/정렬/기본값 | 저장, 취소 | 추후 관련 기능 화면 선택지에 반영 | 간접 또는 직접 영향 |

## 7. 데이터 블록 정의

### 상단 요약 데이터

- `전체 설정`: 전체 메타 그룹 수
- `회원/권한`, `메시지 발송`, `운영/노출`, `커머스/혜택`: 기능 영역별 빠른 필터

### 본문 상단 UI 데이터

- 검색 대상: `전체`, `설정 ID`, `설정명`, `소속 기능`, `사용자 화면`
- 최근 수정일: 상세 검색 패널의 date range
- `설정 추가` 버튼: SearchBar 우측 끝, `size="large"`

### 본문 목록 데이터

- `설정`
  - 현재는 `설정명`만 1줄로 표시합니다.
  - 그룹 ID, 설명 같은 보조 정보는 목록에서 제거하고 상세 Drawer로 이동합니다.
- `소속 기능`
  - 기능 카테고리 태그만 표시합니다.
  - `모듈명 · 관리 방식` 보조 텍스트는 목록에서 제거합니다.
- `운영 값`
  - 현재 운영 중인 값 preview만 노출합니다.
  - `총 N개 값` 보조 문구는 제거합니다.
- `사용자 영향`
  - 상태 배지 + 보조 설명
  - 사용자 노출 확인: 실제 사용자 화면 연결이 확인된 상태
  - 사용자 노출 추정: 운영상 연결 가능성은 높지만 확정 문서/구현 확인이 없는 상태
  - 내부 전용: 관리자 운영에서만 쓰이는 값
  - 노출 예정: 아직 공개 전이지만 사용자 노출 계획이 있는 값

### 상세 Drawer 데이터

- `기본 정보`
  - 설정명, 그룹 ID, 소속 기능, 운영 상태, 사용자 화면, 운영 목적
- `설정 구조`
  - Ant Design `Tree`
  - 루트: 설정 그룹명
  - 자식: 현재 운영 값 노드
  - 각 계층 마지막 `추가` 노드: 같은 레벨의 운영 값 추가 진입점
  - 기존 운영 값 노드: 클릭 시 수정, 드래그 시 순서 변경
- `지금 운영 중인 값`
  - 정렬 핸들, 코드, 라벨, 상태, 사용자 영향, 정렬, 기본값, 최근 수정, 액션
  - 행 왼쪽 핸들을 드래그해 순서를 즉시 변경
- `고급 정보`
  - 관리 책임 역할, 기본값, 코드 prefix, 최근 수정자, 마지막 검토, 변경 참고 메모
- `변경 이력`
  - 조치 시각, 액션, 사유, 수행자
  - `item_reordered`를 포함한 그룹/운영 값 변경 이력 표시
- `운영 값 등록/수정 Modal`
  - 현재 mock 데이터 기준으로 같은 설정 그룹 안의 `운영 값 코드`, `운영 값 라벨` 중복을 즉시 검사합니다.
  - 저장 시 service layer에서도 같은 조건을 다시 검증합니다.

### TOPIK 쓰기 마스터 카탈로그 데이터 (P5-1 조회 + P5-3 태그 토글)

- 데이터 원천: Supabase `topik_writing_topic_master` / `topik_writing_tag_master` 전수 조회(비활성 포함) — 운영 설정 카탈로그(모크 그룹 store)와 SoT가 다릅니다.
- `주제 마스터` 탭: 정렬, 종합 주제, 세부 내용, 상태(활성/비활성), 출처, 메모 — 17개 고정 종합 주제 축. 전면 조회 전용.
- `태그 마스터` 탭: 태그 코드, 태그명, 그룹, 상태(활성/비활성 스위치), 설명, 사용 규칙, 예시 문항, 최근 수정 — 태그 부여 옵션의 값 사전
- 유일한 조치 = 태그 마스터 활성/비활성 토글(P5-3): ConfirmAction 사유 필수 → RPC `admin_update_tag_master_status`(platform_admin 가드 — 서버 강제, 비권한 시도는 실패 알림으로 표면화) → 성공 알림 + `감사 로그 확인` 링크. 비활성 태그는 문항 태그 부여 옵션에서 제외되고 부여 이력은 유지됩니다.
- 그 외 편집 없음: 마스터 값(이름·설명·그룹) 편집은 데이터 공급 계약·후속 운영 결정에 따르며, 추천키/반복방지키 JSONB는 문항 상세에서 조회(D-10 비범위)
- 상태 UX: 탭별 독립 AsyncState + `다시 시도`. 운영 source empty/error와 재시도 경로를 구분하고, Supabase 미구성 모크 모드는 배너 표시

## 8. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 설정 추가 | 수정 | `SystemMetadataGroup + groupId` | 불필요 | notification + 상세 Drawer 진입 | `/system/audit-logs?targetType=SystemMetadataGroup&targetId={groupId}` |
| 설정 수정 | 수정 | `SystemMetadataGroup + groupId` | 불필요 | notification + 상세 갱신 | 동일 |
| 운영 값 추가 | 수정 | `SystemMetadataGroup + groupId` | 불필요 | notification + 운영 값 테이블 갱신 | 동일 |
| 운영 값 수정 | 수정 | `SystemMetadataGroup + groupId` | 불필요 | notification + 운영 값 테이블 갱신 | 동일 |
| 운영 값 순서 변경 | 수정 | `SystemMetadataGroup + groupId` | 불필요 | 즉시 정렬 반영 + `item_reordered` 기록 | 동일 |
| 설정 활성/비활성 | 파괴적 | `SystemMetadataGroup + groupId` | 필요 | ConfirmAction 후 상태 배지 갱신 | 동일 |
| 운영 값 활성/비활성 | 파괴적 | `SystemMetadataGroup + groupId` | 필요 | ConfirmAction 후 행 상태 갱신 | 동일 |
| 태그 마스터 활성/비활성(P5-3) | 파괴적 | `AssessmentTagMaster + tagCode` | 필요(사유 필수 — RPC 단도 강제) | ConfirmAction 후 notification(감사 링크) + 카탈로그 재조회 | `/system/audit-logs?targetType=AssessmentTagMaster&targetId={tagCode}` — 권한: platform_admin(서버 가드, 실 감사 기록은 `admin_audit_logs` DB 단) |

## 9. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| 그룹/운영 값 활성 상태 | 확정 | `활성/비활성` 스위치와 ConfirmAction을 사용합니다. | 실제 선택지 노출 여부와 연결될 수 있습니다. | 없음 |
| 사용자 영향 라벨 | 확정 | 목록/상세에서 `사용자 노출 확인`, `사용자 노출 추정`, `내부 전용`, `노출 예정`으로 풀어 씁니다. | 관련 사용자 화면 추적 기준이 됩니다. | 공통 문서 용어와의 추가 통일 여부 |
| 항목 정렬 | 확정 | Tree와 테이블 모두에서 드래그로 순서를 바꿀 수 있습니다. | 선택지 노출 순서에 영향을 줄 수 있습니다. | 서버 저장 계약 확정 필요 |
| 운영 값 중복 체크 | 확정(mock 기준) | 같은 설정 그룹 안에서 `운영 값 코드`, `운영 값 라벨`이 중복되면 입력 단계와 저장 단계에서 모두 차단합니다. | 중복 선택지 노출과 로그 식별 충돌을 방지합니다. | 실제 API/DB unique 제약으로 승격 여부 |
| 감사 타깃 | 미확정 일부 존재 | 현재는 모든 항목 조치를 그룹 단위 `SystemMetadataGroup + groupId`로 기록합니다. | 직접 영향 없음 | item-level Target Type 분리 여부 |

## 10. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| System > 감사 로그 | 메타 그룹/운영 값 조치 검증 | `AuditLogLink` 딥링크 | 조치 후 필수 |
| Commerce / Message / Users / Operation 각 설정 화면 | 공통 선택지, 상태값, 노출 규칙의 원천 참조 | 메타 그룹 참조 | 선행 관계 |
| Assessment > TOPIK 쓰기 문항 목록/관리 | 주제 필터 축·태그 부여 옵션의 기준 마스터를 이 페이지에서 조회 | TOPIK 쓰기 마스터 카탈로그(동일 facade의 마스터 로더) | 선행 관계(조회 참조) |

## 11. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 그룹별 연결 사용자 surface | 그룹별 상이 | 각 그룹의 `linkedUserSurfaces[]`로 추적 | 이 페이지 자체는 내부 전용 |
| 메타데이터 관리 화면 자체 | 내부 전용 | 사용자 직접 노출 없음 | System 운영용 카탈로그 |

## 12. URL/상태 복원

- 기본 라우트: `/system/metadata`
- 필수 쿼리 파라미터: `summaryFilter`, `searchField`, `keyword`, `startDate`, `endDate`, `selected`
- Drawer 복원 여부: 예
- 재진입 시 복원 상태: 목록 필터, 선택된 메타 그룹 상세 Drawer

## 13. 상태 UX / fail-safe

- `pending`: 로딩 상태를 표시하고, 이전 성공 데이터가 있으면 유지합니다.
- `success`: 목록/상세/Tree/운영 값 테이블을 정상 렌더링합니다.
- `empty`: 조건에 맞는 설정이 없음을 안내합니다.
- `error`: notification과 함께 오류를 분리하고, 기존 데이터가 있으면 화면 전체를 비우지 않습니다.
- 마지막 성공 상태 fallback: fetch 실패 시 cached groups를 유지합니다.
- 요청 취소/재시도: service safe wrapper와 retry를 사용합니다.

## 14. 구현 메모

- 현재 코드베이스에서 재사용할 컴포넌트: `PageTitle`, `SearchBar`, `ListSummaryCards`, `AdminListCard`, `DetailDrawer`, `AdminFormDescriptions`, `AdminDataTable`, `ConfirmAction`, `AuditLogLink`
- 구현 파일: `src/features/system/pages/system-metadata-page.tsx` (URL 검색/선택 상태·조회 상태·폼 인스턴스·드래그 상태·트리 데이터·조치 컨텍스트 소유), `src/features/system/api/system-metadata-service.ts`, `src/features/system/model/system-metadata-store.ts` (mock 상태 store — Phase 4 분해로 시드·팩토리 분리), `src/features/system/model/system-metadata-seed.ts` (초기 그룹/감사 시드), `src/features/system/model/system-metadata-factories.ts` (이력·아이템·관리자 위치 팩토리), `src/features/system/model/system-metadata-types.ts`
- 페이지 분해 파일(Phase 4 20호 — 동작 동일): `src/features/system/model/system-metadata-page-schema.ts` (화면 카피·라벨/선택 옵션·요약 필터·에디터 상태 타입·폼 타입·순수 함수), `src/features/system/ui/system-metadata-render-utils.tsx` (값 목록·도움말 라벨·조치 알림 description), `src/features/system/ui/system-metadata-tree.tsx` (트리 드래그 핸들·항목/추가 타이틀), `src/features/system/ui/system-metadata-columns.tsx` (설정 목록·운영 값·변경 이력 컬럼 팩토리), `src/features/system/ui/system-metadata-form-items.tsx` (설정/운영 값 폼 Descriptions 아이템 팩토리), `src/features/system/ui/system-metadata-modals.tsx` (설정/운영 값 편집 모달 — 폼 인스턴스는 페이지가 전달), `src/features/system/ui/system-metadata-detail-drawer.tsx` (상세 Drawer — 운영 값/이력 컬럼 조립은 내부 계산), `src/features/system/ui/system-metadata-actions.tsx` (저장 2종·순서 변경·삭제·상태 변경 실행기 — 페이지 컨텍스트 주입)
- 마스터 카탈로그 섹션: `src/features/assessment/ui/master-catalog-section.tsx` (facade `assessment-question-bank-service.ts`의 마스터 카탈로그 로더를 사용 — 평가 도메인 데이터라 assessment feature에 두고 이 페이지가 마운트)
- 권한/로그/알림 처리 메모: 생성/수정/상태 변경/순서 변경 결과는 notification과 감사 로그를 같이 유지합니다.

## 15. 미해결 이슈

- 실제 API/DB 테이블과 승인 절차는 아직 문서 후보 단계입니다.
- `linkedAdminPages[]`, `linkedAdminLocations[]`는 내부 계약에 남아 있지만, 현재 운영자 UI에서는 직접 노출하지 않습니다.
- `사용자 노출 확인/추정` 표시를 공통 문서의 canonical 용어와 어디까지 통일할지는 후속 검토가 필요합니다.

## 16. 2026-03-27 보강 메모 > Tree 삭제 UX

- `설정 구조`는 Ant Design `Tree` 기본 라인 구조를 유지하고, 루트/하위 계층 마지막에는 항상 `추가` 노드를 둡니다.
- 운영 값 노드는 hover 되었을 때만 텍스트 우측에 삭제 아이콘을 노출합니다.
- Tree에서 삭제를 시작해도 조치 계약은 유지하며 `ConfirmAction -> Target Type = SystemMetadataGroup -> Target ID = groupId -> 감사 로그 확인` 흐름으로 이어집니다.
- `운영 값 수정` Modal 하단에는 `운영 값 삭제` 버튼을 별도로 두고, 같은 삭제 ConfirmAction으로 연결합니다.

## 17. 2026-06-11 보강 메모 > TOPIK 쓰기 마스터 카탈로그 (P5-1 조회 + P5-3 태그 토글)

- 메타데이터·태그 스키마 전환 P5-1(실행계획안 §9)로 운영 설정 카탈로그 카드 아래에 `TOPIK 쓰기 마스터 데이터` 섹션을 추가했습니다. 신규 라우트 없이 기존 `/system/metadata`를 확장한 1차 권장 경로입니다(P5-2 라우트 동기화 = 해당 없음).
- 모크 그룹 store에 끼워 넣지 않고 별도 섹션으로 분리한 이유: 그룹 store는 편집 가능한 인메모리 SoT인 반면 주제/태그 마스터는 Supabase 실데이터라서, 같은 표에 합치면 그룹 편집 액션이 마스터에 거짓 동작하기 때문입니다.
- P5-3(같은 날 후속 개방): 태그 마스터 활성/비활성 토글을 추가했습니다 — 신규 감사 계약 `Target Type = AssessmentTagMaster`, `Target ID = tagCode`, 액션 `tag_master_status_changed`(§8 액션 표·`docs/specs/admin-action-log.md` 동기화 완료). 가드는 RPC가 강제하는 platform_admin(이 페이지의 메뉴 권한 `system.metadata.manage`와 별개 — 화면은 토글을 노출하고 비권한 시도는 서버 거부를 실패 알림으로 표면화)이며, 사유는 화면(ConfirmAction)·RPC 양쪽에서 필수입니다.
- 그 외 마스터 값 편집·주제 마스터 조치는 여전히 없습니다(`SystemMetadataGroup` 감사 계약과 무관).
## 18. 2026-06-17 보강 메모 > System 메타데이터 그룹/항목 Supabase 전환

- 운영 설정 카탈로그의 그룹/항목 source는 `system_metadata_groups` + `system_metadata_group_items` Supabase 테이블이다. mock fallback은 `VITE_SYSTEM_METADATA_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`에서만 사용한다.
- 화면 모델은 기존 `SystemMetadataGroup.items[]` 중첩 구조를 유지한다. Supabase 서비스가 groups + group_items를 조회해 중첩 매핑한다.
- 그룹/항목 write action은 RPC 6종으로 확정됐다: `admin_save_metadata_group`, `admin_save_metadata_item`, `admin_toggle_metadata_group_status`, `admin_toggle_metadata_item_status`, `admin_delete_metadata_item`, `admin_reorder_metadata_items`.
- 감사 action은 `metadata_group_saved`, `metadata_item_saved`, `metadata_group_status_changed`, `metadata_item_status_changed`, `metadata_item_deleted`, `metadata_items_reordered`이며 모두 `SystemMetadataGroup + groupId` target을 사용한다.
- 항목 조치도 그룹 단위 target을 유지한다. item-level Target Type 분리는 이번 전환에서 채택하지 않았다.
- 미확정으로 남는 항목은 PK max+1 동시성, `is_default` 단일성 정책, `admin_locations`/이력 정규화다.
- 이 보강은 운영 설정 카탈로그 그룹/항목에 한정한다. TOPIK 쓰기 마스터 카탈로그(AssessmentMasterCatalog, `topik_writing_*`)는 기존 Supabase 계약을 유지하며 이번 전환 범위가 아니다.
