# 알림(Notification) 데이터 계약 — 단일 SoT

| 항목 | 내용 |
| --- | --- |
| 상태 | 활성 (2026-06-12 제정 — WP0-3) |
| 적용 | topik-ai(관리자) + v13(사용자) 공통. 문자열 enum은 양 저장소가 본 문서와 동일해야 한다 |
| 관련 | `docs/알림-기능-개발-실행계획안.md` §4·§5, `docs/architecture/shared-supabase-schema-ownership.md` |

## 1. 채널 (NotificationChannel)

```ts
type NotificationChannel = 'in_app' | 'email' | 'push' | 'zalo';
```

| 값 | 의미 | 상태 |
| --- | --- | --- |
| `in_app` | 앱 내부 알림센터·홈 카드·읽음/미읽음 | 1차 출시 |
| `email` | 메일 발송 | Phase 3 (provider O-1) |
| `push` | OS/브라우저/앱 푸시 | 준비 중 — 발송 비활성 |
| `zalo` | 외부 메신저 | deferred |

`push`를 `in_app`으로 재해석하지 않는다. 사용자 `notification_settings.channels` JSON의 허용 key는 위 4종이며, 기존 row에 `in_app` key가 없으면 **true(기본 수신)** 로 해석한다.

## 2. 분류 (NotificationClass) — 템플릿 필수 속성

```ts
type NotificationClass = 'transactional' | 'operational' | 'learning' | 'marketing';
```

| 값 | opt-out | mandatory(강제 발송) |
| --- | --- | --- |
| `transactional` | 우회 가능 (bypass 감사 필수) | 항상 |
| `operational` | 기본 pref 존중 | `mandatory=true` 템플릿만 in_app 강제. email/push 강제 불가. 설정 시 사유+확인 단계 |
| `learning` | 절대 존중 | 불가 |
| `marketing` | 명시적 동의 필수 | **저장 차단** (DB CHECK + RPC + UI 3중) |

opt-out 제외자는 delivery attempt `skipped` 또는 `opted_out`으로 집계한다 (미기록 금지).

## 3. 유형 (template_key) 와 category

| template_key | class | category | 트리거 | 기본 채널 |
| --- | --- | --- | --- | --- |
| `study_reminder` | learning | `study` | 사용자 슬롯 (reminder_time×days×timezone) | in_app+email |
| `weekly_summary` | learning | `study` | 주 1회 고정 슬롯 (기본 일 20:00 사용자 timezone) | in_app+email |
| `feedback_ready` | transactional (O-8b 재검토 여지) | `study` | 첨삭 완료 이벤트 | in_app+email |
| `exam_schedule` | operational | `exam_schedule` | 관리자 발송 | in_app(+email) |
| `notice` | operational | `notice` | 관리자 발송 | in_app |
| `event` | operational | `event` | 관리자 발송 | in_app |
| `marketing` | marketing | `marketing` | 관리자 발송 | email |
| `institution_invitation` | transactional (mandatory) | `notice` | 기관 초대 이벤트 (`admin_invite_institution_members`, 20260707140000) | in_app+email |

`category`는 `user_notifications.category`에 저장되어 B-01 카드 구분 표시에 사용한다: `'study' | 'exam_schedule' | 'notice' | 'event' | 'marketing'`.

> `institution_invitation` 특례: 카테고리는 `notice` 재사용(v13 CHECK 무변경), 구분은
> `template_key` + `payload.kind='institution_invitation'`. 발송은 v13 디스패처가 아니라
> topik-ai `admin_invite_institution_members` RPC가 inline으로 수행하며(payload에
> `invitation_id` 필요 + transactional 강제 이메일), dispatch.dedupe_key는
> `inst-invite:<uuid>`, attempt dedupe는 `user:institution_invitation[:email]:invitation_id`.
> v13은 이 알림을 라우팅 대신 수락/거부 모달로 처리한다
> (docs/requests/v13-institution-invitation-handoff-2026-07-07.md).

## 4. 상태 enum

```ts
// notification_templates.status — 기존 message UI 표기 유지
type TemplateStatus = '활성' | '비활성' | '초안';

// notification_dispatches.status
type DispatchStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'partial_failed' | 'failed' | 'canceled';

// notification_delivery_attempts.status
type AttemptStatus = 'pending' | 'sent' | 'failed' | 'skipped' | 'opted_out' | 'deduped';

// notification_dispatches.target_type
type DispatchTargetType = 'group' | 'schedule' | 'event' | 'test';

// notification_templates.mode — 기존 message UI 계약 유지
type TemplateMode = 'auto' | 'manual';
```

## 5. dedupe_key 형식 (idempotency 2단)

| 계층 | 형식 | 예 |
| --- | --- | --- |
| dispatch (발송 실행 단위) | `sched:{template_key}:{슬롯 윈도우 시작 ISO}` / `admin:{dispatch uuid}` / `event:{이벤트 id}` / `test:{actor}:{타임스탬프}` | `sched:study_reminder:2026-06-12T09:00+09:00` |
| attempt (수신자 단위) | `{user_id}:{template_key}:{회차}` — 회차는 스케줄형이면 사용자 timezone 기준 현지 날짜, 이벤트형이면 이벤트 id | `8d3f…:study_reminder:2026-06-12` |

- dispatch.dedupe_key: unique. 같은 슬롯/캠페인 재실행 차단.
- attempt.dedupe_key: nullable, **unique where not null**. 윈도우 경계를 넘는 재처리에서 사용자 단위 중복 차단. 관리자 수동 발송은 attempt 쪽 dedupe_key를 사용하지 않고(null) `unique(dispatch_id, user_id, channel)`로만 차단한다 — 같은 템플릿의 의도적 재발송을 막지 않기 위함.
- 회차가 다르면 정상 발송된다 (과잉 dedupe 금지 — QA N-EDGE-10).

## 6. 사용자 선호 키 (profiles.notification_prefs)

현행 코드 화이트리스트: `weekly_summary` | `feedback_ready` | `study_reminder` (v13 `NOTIFICATION_PREF_KEYS`).
operational 토글(`exam_schedule_email` 등) 노출 범위는 O-8 결정 후 본 문서에 추가한다. missing key는 false로 해석한다(기존 계약 유지).

## 7. 시간·요일 계약 (기존 유지)

- `reminder_time`: `HH:mm[:ss]`. `reminder_days`: 0–6 정수 배열, **0=일요일**. `timezone`: IANA 명칭, 기본 `Asia/Seoul`.
- 슬롯 판정의 시각 출처는 **DB `now()` 단일 기준**으로 한다 (이중 시각 출처 금지 — QA N-EDGE-06).

## 8. 파이프라인 소유권과 clean replay 계약

- 알림 운영 테이블, `notification_email_config`, private dispatcher/email/marketing 함수, `dispatch_notifications`
  pg_cron의 migration home은 topik-ai `supabase/migrations-admin/20260723011242_notification_pipeline_ownership_transfer.sql`이다.
- v13은 `profiles`, `notification_settings`, `user_notifications`, `user_marketing_consent`와 사용자 UI를
  소유한다. topik-ai 파이프라인은 이 객체를 service-role reader/writer로 사용하지만 DDL은 변경하지 않는다.
- v13의 `20260612180000`~`20260612200100` 과거 파이프라인 migration은 v13 단독 clean replay를 위한
  no-op이다. 통합 replay에서는 v13 사용자 객체와 topik-ai admin base를 먼저 만든 뒤 topik-ai forward
  migration을 적용한다.
- migration은 기존 dispatch/attempt/config row를 삭제·재시드하지 않는다. down은 공유 운영 상태 보존을
  위해 no-op이며 교정은 roll-forward로만 수행한다.
- `institution_invitation`은 위 cron dispatcher를 거치지 않는 inline RPC 특례를 유지한다.
