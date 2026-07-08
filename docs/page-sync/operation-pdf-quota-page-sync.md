# Operation > PDF 내보내기 제한 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Operation"
page_name: "PDF 내보내기 제한"
route: "/operation/pdf-quota"
status: "구현됨"
primary_entity: "PdfQuotaPolicy, PdfQuotaReset"
primary_table_candidate: "pdf_export_quota_policies, pdf_export_quota_resets, pdf_export_quota_reset_targets (v13 소유)"
owner_agent_scope: "shared"
last_reviewed_at: "2026-07-07"
---

## 1. 문서 목적

- 이 문서는 `PDF 내보내기 제한` 관리자 페이지와 v13 사용자 앱 내보내기 흐름 사이의 동기화 기준을 정리합니다.
- 관리자가 바꾸는 정책/초기화가 사용자 화면(429 안내, resetAt 표기)에 어떻게 이어지는지 추적합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Operation` |
| 페이지명 | `PDF 내보내기 제한` |
| 라우트 | `/operation/pdf-quota` (`?tab=resets`) |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형(탭 2개)` |
| 페이지 목적 한 줄 요약 | PDF 내보내기 쿼터 정책(한도/주기)과 개인·기관 코드·전체 초기화를 관리하는 화면입니다. |

## 3. v13 사용자 화면 연결 (B2C 노출 = 확인됨)

- v13 `POST /api/export/pdf`, `POST /api/export/pdf/print`는 `claim_pdf_export_quota`로 이 화면이 관리하는 정책을 그대로 소비한다.
- 쿼터 초과 시 v13 429 응답: `{error, code:'pdf_export_quota_exceeded', limit, used, remaining, resetAt, periodUnit, problemId}` — 학습자 화면 안내 문구에 노출된다.
- 이 화면의 정책 변경(예: 3/월 → 5/주)은 즉시 v13 claim 동작에 반영된다. 별도 배포/캐시 없음.
- **한도 0(의도적 중단)이면 모든 학습자 내보내기 시도가 429로 응답한다** — 사용자 카피는 "횟수 소진 + resetAt 안내"라 의도적 중단과 다소 안 맞는다(v13 소유 문구, 후속 개선 후보로 기록).
- 초기화는 실행한 주기 안에서만 유효(period-local). 학습자에게 초기화 이력은 노출하지 않는다(admin 전용, v13 RLS는 global/본인 대상 select만 허용).
- 2026-07-08 재설계: 정책은 단일 설정 폼(항상 1행, 저장 RPC 자기치유)이라 관리자 조작으로 "무정책 상태"(v13 전면 500)를 만들 수 없다. platform_admin의 직접 테이블 쓰기 등 admin 화면 밖 경로는 여전히 fail-closed 500 가능 — v13 claim 폴백 하드닝은 후속 제안으로 남김.

## 4. 데이터 계약 요약

- 소유권: `pdf_export_quota_*` 4테이블 + claim/commit/release RPC는 **v13 소유**. topik-ai는 DDL 불변, admin RPC 4종만 추가(`supabase/migrations-admin/20260708100000_pdf_export_quota_admin.sql`).
- 상세: `docs/architecture/shared-supabase-schema-ownership.md`의 "2026-07-07 PDF 내보내기 쿼터 소유권 기록".
- 그룹 정의: `profiles.affiliation_code` 기반 기관 코드(2026-07-07 오너 결정). 그룹 초기화 대상은 생성 시점 스냅샷.

## 5. 미결/후속

- 회원별 사용량 조회(used/remaining) 화면: P1 보류.
- 개인 초기화 모달의 회원 검색은 `get_admin_users`(platform_admin 전용 read RPC)를 재사용한다. platform_admin이 아닌 운영 관리자는 회원 목록 조회가 거부될 수 있어, 필요 시 pdf-quota 권한 기준의 경량 회원 조회 RPC를 후속 검토한다.
- prod 적용 게이트 별도.
