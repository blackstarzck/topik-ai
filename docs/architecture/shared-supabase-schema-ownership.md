# 공유 Supabase 스키마 소유권 (Shared Schema Ownership)

| 항목 | 내용 |
| --- | --- |
| 상태 | 활성 SoT (2026-06-12 제정 — 알림 기능 개발 WP0-1) |
| 적용 대상 | 공유 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev) 및 상위 환경 |
| 관련 문서 | topik-ai `AGENTS.md` §2, v13 `AGENTS.md` 비협상 규칙, `docs/알림-기능-개발-실행계획안.md` §5.0 |

## 1. 원칙

공유 Supabase 프로젝트의 스키마 소유권은 **앱 기준이 아니라 도메인/네임스페이스 기준**으로 정한다.

- **v13 소유**: B2C 사용자 경험에 직접 필요한 core user-facing schema.
- **topik-ai 소유**: admin 운영 기능, 운영 이력, 관리자 전용 정책/그룹/템플릿 schema.
- **공유 객체**: user/admin 양쪽에서 읽거나 쓰는 객체는 본 문서에 owner / writer / reader / RLS / migration home을 명시한다.
- **기존 v13 테이블 변경**: owner(v13) 승인 + migration decision record 필수. topik-ai에서의 v13 테이블 DDL 변경은 금지 유지.
- migration tracker 분리: `topik_writing_schema_migrations`(메타데이터·태그 전환), `admin_schema_migrations`(admin 운영·알림), v13 자체 migration 흐름(user-facing). 서로 혼입 금지.

## 2. 객체별 소유권 매트릭스

| 객체 | owner (migration home) | writer | reader | RLS 요약 |
| --- | --- | --- | --- | --- |
| `profiles` (notification_prefs 포함) | v13 | 본인(user), admin RPC | 본인, admin | self select/update, 보호 컬럼 트리거 |
| `notification_settings` | v13 | 본인(user) | 본인 | owner all (`user_id = auth.uid()`) |
| `notification_log` | v13 | (deprecated — 신규 쓰기 경로 없음) | 본인, platform_admin | owner select. **알림 기능 rev3부터 발송 이력 SoT 아님** (O-9) |
| `user_notifications` | v13 | service role(파이프라인 insert), 본인(`read_at`만 update) | 본인 | owner select + read_at-only owner update |
| 마케팅 수신 동의 저장소 (O-7 확정 시) | v13 | 본인 | 본인, 발송 파이프라인(service role) | owner |
| `notification_templates` | **topik-ai** (`admin_schema_migrations`) | admin RPC | admin, 발송 파이프라인(service role) | admin 전용 |
| `notification_groups` | **topik-ai** | admin RPC | admin, 발송 파이프라인 | admin 전용 |
| `notification_dispatches` | **topik-ai** | admin RPC, 발송 파이프라인(service role) | admin | admin 전용 |
| `notification_delivery_attempts` | **topik-ai** | 발송 파이프라인(service role) | **admin + 본인(owner select — v13 X-09 발송 이력 패널이 읽음)** | service write / owner select / admin select — **공유 객체 decision record: 2026-06-12, 실행계획안 rev3 §5.2·O-9** |
| `admin_audit_logs` | v13 (2026-06-09 기존 결정) | admin RPC | admin | 기존 결정 유지 |
| `topik_writing_*` | topik-ai (`topik_writing_schema_migrations`) | 기존 결정(D-1) | 기존 결정 | `metadata-tag-schema-transition-decision-record.md` §2 |

## 3. 변경 절차

1. 새 객체 추가: owner repo의 migration home에 migration+down 작성 → 본 문서 §2에 행 추가 → 적용.
2. 공유 객체 reader/writer 변경: 양 repo 문서에 반영하고 본 문서의 decision record 칸에 일자·근거 기록.
3. v13 소유 테이블 DDL 변경: v13 오너 승인 + decision record 없이는 금지.

## 4. 제정 근거

- 알림 기능 개발 실행계획안 rev3 §5.0 (2026-06-12). 종전 규칙("v13: admin-oriented schema 추가 금지" / "topik-ai: `topik_writing_*`만 소유")은 admin이 실데이터 계약을 갖기 시작하면서 도메인 기준 소유권으로 개정됐다.
- 개정 승인: 오너의 알림 기능 자율 실행 지시(2026-06-12 /goal) — 증적 `logs/notification-feature-evidence.md` WP0-1.
