# Commerce > 쿠폰 관리 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Commerce"
page_name: "쿠폰 관리"
route: "/commerce/coupons"
status: "구현됨"
primary_entity: "CommerceCoupon"
primary_table_candidate: "commerce_coupons, commerce_coupon_subscription_templates"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-01"
---

## 1. 문서 목적

- 이 문서는 `쿠폰 관리` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Commerce` |
| 페이지명 | `쿠폰 관리` |
| 라우트 | `/commerce/coupons`, `/commerce/coupons/create`, `/commerce/coupons/create/:couponId`, `/commerce/coupons/template/create`, `/commerce/coupons/template/create/:templateId` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형 + 등록 상세 페이지` |
| 페이지 목적 한 줄 요약 | 쿠폰 정책과 정기 쿠폰 템플릿을 등록, 수정, 발행/중지하는 화면입니다. |
| 주요 운영자 | `OPS_ADMIN, SUPER_ADMIN` |
| 주요 권한 | `commerce.coupons.manage` |
| 코드 근거 | `src/features/commerce/pages/commerce-coupons-page.tsx, src/features/commerce/pages/commerce-coupon-create-page.tsx, src/features/commerce/pages/commerce-coupon-template-create-page.tsx` |
| 연관 SoT 문서 | `docs/specs/page-ia/commerce-coupons-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 쿠폰/정기 템플릿 혜택, 조건, 기간, 발행 상태를 관리합니다.
- 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책를 관리자 기준으로 추적합니다.
- 쿠폰함, 결제 할인 적용, 프로모션 배너에 운영상 추정으로 연결됩니다.

### 비목표

- 실제 백엔드 스키마 최종 확정은 이 문서에서 담당하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 쿠폰 관리 조회 | 쿠폰 관리의 목록/상세 또는 예정 데이터 블록을 확인합니다. | 조회 | CommerceCoupon | 현재 상태 확인 | 불필요 |
| 쿠폰 관리 관리 | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책에 대한 등록/수정/상태 변경 또는 예정 계약을 관리합니다. | 수정 | CommerceCoupon + couponId | 데이터 반영 또는 후속 검증 | 필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CommerceCoupon | commerce_coupons, commerce_coupon_subscription_templates | Create, Read, Update, Delete 후보 | 쿠폰 관리 본문/상세/Modal | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책, id, status, created_at, updated_at | CommerceCoupon + couponId | 운영상 추정 | 현재 프론트엔드/문서 기준 후보 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원 또는 후보` | 쿠폰 관리 등록/생성 후보 | service/store/API 후보 | 목록, 상세, 사용자 화면 후보 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | 쿠폰 관리 조회 | service/store/API 후보 | URL/필터/탭 복원 | empty/error 처리 |
| Update | `지원 또는 후보` | 쿠폰 관리 수정/상태 변경 후보 | service/store/API 후보 | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 rollback |
| Delete | `지원 또는 후보` | 쿠폰 관리 삭제/숨김/중지 후보 | service/store/API 후보 | 목록, 상세, 감사 로그, 사용자 노출 | 확인 모달, 사유 필수, 실패 안내 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 쿠폰 관리 주요 조치 | 예 | 필수 | 필수 | CommerceCoupon | 대상 ID | /system/audit-logs?targetType=CommerceCoupon&targetId={targetId} |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 쿠폰함, 결제 할인 적용, 프로모션 배너 | 운영상 추정 | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책 | 쿠폰함, 결제 할인 적용, 프로모션 배너에 운영상 추정으로 연결됩니다. | 관리자 변경 후 또는 원본 데이터 갱신 후 | 실제 사용자 화면 저장소 확인 전까지 추정은 추정으로 유지 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Commerce > 결제 내역 | 참고/후속 | 쿠폰 관리 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| Commerce > 포인트 관리 | 참고/후속 | 쿠폰 관리 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | 쿠폰 관리 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 쿠폰함 | 데이터 노출 후보 | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책 | 쿠폰 관리 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 결제 할인 적용 | 데이터 노출 후보 | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책 | 쿠폰 관리 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 프로모션 배너 | 데이터 노출 후보 | 쿠폰명, 혜택, 만료/종료일, 사용 조건, 정기 발행 정책 | 쿠폰 관리 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 초안/발행/중지/만료 | 초안/발행/중지/만료 | page-specific enum candidate | 초안/발행/중지/만료 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |
| 혜택 유형 | 혜택 유형 | page-specific enum candidate | 혜택 유형 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |
| 적용 범위 | 적용 범위 | page-specific enum candidate | 적용 범위 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/commerce/coupons`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: page, pageSize, keyword, status, tab, selected 등 페이지별 후보
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: `/commerce/coupons/create`, `/commerce/coupons/create/:couponId`, `/commerce/coupons/template/create`, `/commerce/coupons/template/create/:templateId`
- 사용자 화면 동기화에 필요한 식별자: CommerceCoupon + couponId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/commerce/pages/commerce-coupons-page.tsx, src/features/commerce/pages/commerce-coupon-create-page.tsx, src/features/commerce/pages/commerce-coupon-template-create-page.tsx` 구현과 `docs/specs/page-ia/commerce-coupons-page-ia.md` 문서 일치 확인
  - service/store/mock 경계와 감사 로그 Target 확인
- Claude 확인 포인트:
  - 쿠폰함, 결제 할인 적용, 프로모션 배너에 운영상 추정으로 연결됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - 실제 DB/API 필드 확정
  - 사용자 화면 노출 위치 확정
  - 감사 로그 Target Type 세분화

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 쿠폰 관리 최종 계약 | 쿠폰 발급 대상, 사용 조건 검증, 결제 적용 우선순위는 사용자 결제 화면과 맞춰야 합니다. | 기획/백엔드/프론트 | 필터/액션/감사 로그 계약 변동 가능 | 쿠폰함, 결제 할인 적용, 프로모션 배너에 운영상 추정으로 연결됩니다. | docs/specs/page-ia/commerce-coupons-page-ia.md |

## 2026-06-17 Supabase 전환 동기화

- 데이터소스: `Commerce > 쿠폰 관리`(`/commerce/coupons`)는 `commerce_coupons`와 `commerce_coupon_subscription_templates` Supabase-backed hybrid source로 전환됐다. `commerce-coupons-data-source.ts`는 `VITE_COMMERCE_COUPONS_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`일 때 mock으로 회귀한다.
- CRUD/조치: 쿠폰 본체 저장/복제/발행 일시중지/재개/삭제는 `admin_save_commerce_coupon`, `admin_duplicate_commerce_coupon`, `admin_set_commerce_coupon_issue_state`, `admin_delete_commerce_coupon`을 사용한다. 정기 템플릿 저장/상태 변경/삭제는 `admin_save_commerce_coupon_template`, `admin_set_commerce_coupon_template_status`, `admin_delete_commerce_coupon_template`을 사용한다.
- 감사: 쿠폰 본체 Target Type은 `CommerceCoupon`, 템플릿 Target Type은 `CommerceCouponTemplate`이다. action은 `coupon_saved`, `coupon_duplicated`, `coupon_paused`, `coupon_resumed`, `coupon_deleted`, `coupon_template_saved`, `coupon_template_paused`, `coupon_template_resumed`, `coupon_template_deleted`이며 모든 write RPC는 reason 필수다. Supabase 경로에서는 store `CouponAuditEvent(AL-CPN-)` 대신 `admin_audit_logs`를 감사 SoT로 사용한다.
- B2C 동기화: 쿠폰함/결제 할인 적용 노출은 기존과 같이 운영상 추정 또는 노출 예정으로 둔다. 현 시점의 확정 admin SoT는 쿠폰 본체/정기 템플릿 테이블 2종이며, 사용자 앱의 실제 보유/사용 상태는 발급/사용 원장 확정 후 분리한다.
- 미확정: 발급/사용 원장(`commerce_coupon_issues`, `commerce_coupon_redemptions`), scope-ref/대상 그룹/알림 정규화, `planTier` 영속화, `target_user_ids` v13 연동 정책.
