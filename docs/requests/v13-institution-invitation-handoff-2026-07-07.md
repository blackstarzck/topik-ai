# v13 기관 초대 알림 수락/거부 모달 handoff (2026-07-07)

## 1. 목적

topik-ai admin의 기관 회원 추가가 **즉시 배정에서 동의 기반 초대로 전환**되었다(오너 결정
2026-07-07). 관리자가 회원을 기관 코드에 초대하면:

1. `institution_code_invitations`에 **pending 초대**가 생성되고,
2. 사용자 `user_notifications`에 인앱 알림이 즉시 적재되며(payload에 초대 정보),
3. 초대 안내 이메일이 SMTP 워커를 통해 발송된다.

**v13에서 구현할 것**: 사용자가 알림함에서 이 초대 알림을 클릭하면 (기존처럼 라우팅하지 않고)
**수락/거부 모달**을 열고, 선택 결과를 `respond_institution_invitation` RPC로 제출한다.
수락 시에만 `profiles.affiliation_code`가 적용된다(거부 시 무변화).

admin 쪽(DB 계층 포함)은 전부 구현·dev DB 적용·검증 완료 상태다. v13은 **DB 마이그레이션이
필요 없고**, 프론트(알림 클릭 분기 + 모달 + RPC 호출)만 작업하면 된다.

## 2. admin/DB SoT (구현 완료, dev DB 적용됨)

- 마이그레이션(topik-ai 소유, `supabase/migrations-admin/`):
  - `20260707140000_institution_invitations.sql` — 테이블·템플릿 시드·admin RPC 3종
  - `20260707141000_institution_invitation_respond.sql` — 사용자 응답 RPC
- 관리 화면 진입점 3곳(모두 초대로 전환): 기관 코드 `회원 관리` 모달, 회원 목록 다중선택
  일괄 초대, 회원 상세 기관탭. 해제(소속 제거)는 기존 즉시 방식 유지.
- 알림 계약 등록: `docs/specs/notification-contract.md` §3 `institution_invitation`
- 소유권/경계 기록: `docs/architecture/shared-supabase-schema-ownership.md` 2026-07-07 절

### 2.1 `institution_code_invitations` 테이블

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| `id` | uuid PK | 초대 식별자(알림 payload의 `invitation_id`) |
| `code` | text | 기관 코드(불투명 문자열, FK 없음 — 수락 시 서버가 재검증) |
| `user_id` | uuid | 초대받은 회원(profiles FK, cascade) |
| `invited_by` | uuid | 초대한 관리자(auth.users FK) |
| `reason` | text | 관리자 초대 사유(감사용 — 사용자 노출 비권장) |
| `status` | text | `'pending' \| 'accepted' \| 'declined' \| 'canceled'` |
| `responded_at` | timestamptz | 응답/취소 시각 |
| `expires_at` | timestamptz | 만료 시각(기본 7일, 초대 시 1~365일 지정 — 2026-07-08 추가). 경과 시 접점에서 lazy 전환으로 `expired` |
| `created_at` | timestamptz | 초대 시각 |

RLS: **본인(`user_id = auth.uid()`) SELECT 허용** → v13 클라이언트가 자기 초대 행을 직접
조회해도 된다(모달 보조 정보용, 필수는 아님 — 알림 payload만으로 모달 구성 가능).
INSERT/UPDATE/DELETE는 정책 없음 + revoke — 반드시 RPC 경유.

같은 (user, code)의 pending 초대는 1건만 존재한다(partial unique). 서로 다른 코드의 pending
초대는 동시에 여러 건 있을 수 있다(각각 독립적으로 수락/거부; 수락은 최종 승리 — 아래 §5).

### 2.2 인앱 알림 행 계약 (`user_notifications`)

`admin_invite_institution_members`가 초대 시점에 즉시 insert한다(v13 디스패처 미경유):

```jsonc
{
  "template_key": "institution_invitation",
  "category": "notice",                       // 기존 CHECK 재사용 — 신규 카테고리 아님
  "title": "기관 소속 초대가 도착했습니다",
  "body": "{이름}님, {기관명} 기관 소속 초대가 도착했습니다. 수락하면 해당 기관 회원으로 등록됩니다. 이 초대는 {만료일}까지 응답할 수 있습니다.",
  "link_url": null,                           // 의도적으로 null — 라우팅 대신 모달
  "payload": {
    "kind": "institution_invitation",
    "invitation_id": "<uuid>",                // respond RPC에 그대로 전달
    "code": "CAMPAIGN-01",
    "code_label": "캠패인 유입 유저",
    "expires_at": "2026-07-15T02:31:00.000+00:00"  // 모달 D-day 표시용(2026-07-08 추가)
  },
  "delivery_attempt_id": "<uuid>"
}
```

**판별 키**: `template_key === 'institution_invitation'` (또는 `payload.kind`). 이 알림은
`read_at` 처리 후 **네비게이션 대신 모달을 열어야** 한다.

### 2.3 사용자 응답 RPC — `respond_institution_invitation`

```sql
public.respond_institution_invitation(p_invitation_id uuid, p_accept boolean) returns jsonb
-- SECURITY DEFINER, grant execute to authenticated. 초대받은 본인만 호출 가능.
```

성공 반환(jsonb) 3형:

| 상황 | 반환 |
| --- | --- |
| 수락 성공 | `{"status":"accepted","code":"...","code_label":"...","prev_code":"<기존 소속코드 또는 null>"}` |
| 거부 성공 | `{"status":"declined","code":"...","code_label":"..."}` |
| 수락했지만 코드가 삭제/종료됨 | `{"status":"canceled","error":"code_inactive","code":"...","code_label":"<라벨 또는 null>"}` |
| 만료 경과 후 응답(수락/거부 모두) | `{"status":"expired","error":"invitation_expired","code":"...","code_label":"..."}` — 초대도 expired로 영속화 |

예외(에러 message 문자열 — v13 모달 상태 매핑에 사용):

| message | 의미 · 권장 UI |
| --- | --- |
| `invitation already responded: accepted` | 이미 수락됨 → "이미 처리된 초대입니다" |
| `invitation already responded: declined` | 이미 거절됨 → 동일 |
| `invitation already responded: canceled` | 관리자가 취소함 → "관리자가 회수한 초대입니다" |
| `unknown invitation: <uuid>` | 초대 행 자체가 없음(비정상) → 일반 오류 |
| `forbidden: not invitation owner` | 본인 초대 아님(42501) → 일반 오류 |
| `unauthenticated` | 세션 만료 → 로그인 유도 |
| `forbidden: profile deleted` | 탈퇴 계정 → 일반 오류 |
| `affiliation_code write suppressed ...` | 서버측 보호 트리거 회귀(42501) — 발생 시 admin팀에 알릴 것 |

부수효과(수락 시): `profiles.affiliation_code = code` 적용, 감사 로그
(`institution_code_invitation_accepted`, actor=사용자) 기록. **트리거 우회는 RPC 내부에서
처리**되므로 v13이 GUC를 만질 필요 없음.

부수효과(모든 종결 — 수락/거부/코드비활성, 2026-07-07 하드닝): 아직 발송 전(pending)인
초대 안내 이메일 attempt 는 `skipped(invitation_responded)` 로 회수된다 — 사용자가
인앱에서 먼저 응답하면 stale 초대 메일이 뒤늦게 나가지 않는다. v13 쪽 처리 불필요(정보 공유).

## 3. v13 구현 범위

### 3.1 알림 클릭 분기 (`src/components/notifications/NotificationBell.tsx`)

현재: 클릭 → `markNotificationRead` → `resolveNotificationDestination(item)`으로 라우팅
(`notifications-data.ts`).

변경: `template_key === 'institution_invitation'`이면 목적지 해석을 건너뛰고 **초대 모달
오픈**(payload 전달). read 처리(optimistic)는 기존과 동일하게 수행.

### 3.2 초대 수락/거부 모달 (신규 컴포넌트)

- 내용: `{code_label} ({code})` 기관 초대 안내 + 수락하면 기관 회원으로 등록된다는 설명.
- 버튼: `수락` / `거부` / 닫기(나중에 결정 — 알림은 남아 있으므로 재진입 가능).
- **덮어쓰기 경고(중요)**: 사용자의 현재 `profiles.affiliation_code`가 null이 아니고 초대
  코드와 다르면, 수락 시 기존 소속이 초대 기관으로 **교체**됨을 모달에서 사전 고지할 것.
  (현재 소속은 세션 profile 또는 `institution_code_invitations` 조회와 무관하게 v13이 이미
  가진 profile 데이터로 판단. 수락 응답의 `prev_code`로 사후 확인도 가능.)
- 제출: `supabase.rpc('respond_institution_invitation', { p_invitation_id, p_accept })`
- 결과 처리:
  - `accepted` → 성공 토스트("기관 회원으로 등록되었습니다") + profile 캐시 갱신(affiliation
    이 문항 노출 등에 영향 — 아래 §5).
  - `declined` → 확인 토스트.
  - `canceled`/`code_inactive` → "만료된 초대입니다" 안내.
  - 예외 `invitation already responded: *` → "이미 처리된 초대입니다" 안내.

### 3.3 이메일 CTA 랜딩

초대 이메일(제목 `[TOPIK AI] 기관 소속 초대 안내`)의 CTA는 현재
**`/settings/notifications`**로 링크된다(알림/발송 이력 화면). 이메일 본문에는 워커 렌더링
제약({{display_name}}만 치환 가능)으로 **기관명이 없다** — "알림함에서 확인" 유도 문구.
v13이 더 나은 랜딩(예: 알림함 자동 오픈 쿼리)을 원하면 topik-ai
`notification_templates`의 `template_key='institution_invitation', channel='email'` 행
`link_url`만 바꾸면 된다(연락 주면 admin쪽에서 수정).

## 4. 검증된 동작 (2026-07-07 dev DB 프로브, 전부 PASS)

- 초대: pending 행 + dispatch(completed) + in_app attempt(sent) + `user_notifications`
  (payload에 invitation_id) + email attempt(pending) + 감사 로그.
- 이메일 발송 시점(2026-07-07 하드닝): 관리자가 초대를 보내면 admin 앱이 워커를 **즉시
  kick**(관리자 JWT 인증 POST)하여 수 초 내 발송되고, kick 실패 시에도 15분 cron 이
  자동 수거한다. 발송 상태(pending/sent/failed)는 admin 초대 목록에 노출된다.
- 이메일 실발송: SMTP 워커(`/api/notifications/dispatch-email`)로 실제 발송 확인
  (provider_message_id 기록, chanchan2@keduall.com 수신함에 실물 도착).
- 멱등: 같은 (user, code) 재초대=0건, 기소속 스킵, 종료 코드 초대는 예외.
- 응답: 수락 → affiliation 적용(비관리자 caller로 보호 트리거 통과 확인) / 거부 → 무변화 /
  재응답·타인 응답·취소된 초대 응답 → 위 §2.3 예외 문자열 그대로 발생.
- 코드 종료 후 수락 → `{status:'canceled', error:'code_inactive'}` + 초대 canceled 영속화.
- 타기관 소속자 수락 → 덮어쓰기 + `prev_code` 반환.
- RLS: 본인 행만 SELECT, 클라이언트 직접 insert/update 거부.
- 관리자 취소 시 미발송 이메일 attempt는 `skipped(invitation_canceled)`로 종결(취소된
  초대의 메일이 뒤늦게 나가지 않음). 단, **이미 발송된 이메일 뒤에 취소될 수는 있음** —
  그래서 모달의 "관리자가 회수한 초대" 상태 처리가 필요하다.

## 5. 엣지케이스·정책 정리

| 케이스 | 동작(서버 확정) | v13 UI |
| --- | --- | --- |
| 이미 응답한 초대 알림 재클릭 | RPC 예외 `invitation already responded: *` | 처리 상태 안내 모달 |
| 관리자가 초대 취소 | status=canceled, 알림 행은 그대로 남음 | 응답 시 "회수된 초대" 안내 |
| 코드 삭제/종료 후 수락 | `{status:'canceled', error:'code_inactive'}` (초대도 canceled로 영속화) | "만료된 초대" 안내 |
| 만료 경과 후 응답 | `{status:'expired', error:'invitation_expired'}` (초대도 expired 영속화) | "만료된 초대" 안내. 모달 오픈 시 payload.expires_at으로 D-day/만료 여부 선표시 권장 |
| 만료된 초대 재초대 | 허용 — invite RPC가 만료 pending을 expired로 자동 전환 후 새 초대 발송 | 새 알림으로 정상 표시 |
| 거절 후 재초대 | 허용(새 pending 행, 새 알림) | 새 알림으로 정상 표시 |
| 서로 다른 코드 복수 pending | 허용, 각각 독립 응답. 수락은 **최종 승리**(단일 컬럼 덮어쓰기) | 모달 덮어쓰기 경고로 커버 |
| 기존 타기관 소속자 수락 | 덮어쓰기(관리자 '소속 변경' 유스케이스), `prev_code` 반환·감사 | **모달 사전 경고 필수** |
| QR 가입 경로 | 기존 `accept_affiliation_invite(p_code,p_confirmed)`는 **무변경 공존**(그 함수는 기존 소속 있으면 전환 거부 — 초대 RPC와 다름) | 변경 불필요 |
| 알림 수신 선호 | class=transactional + mandatory=true — 인앱·이메일 모두 선호 무관 발송(동의 요청 성격) | 설정 화면 영향 없음 |

## 6. v13 테스트 체크리스트

1. admin에서 초대 발송(기관 코드 `회원 관리` 모달) → v13 벨 60초 폴링 내 뱃지 +1, 알림
   목록에 "기관 소속 초대가 도착했습니다" 카드(category notice).
2. 카드 클릭 → 라우팅되지 않고 모달 오픈, read_at 처리.
3. 수락 → 토스트 + `profiles.affiliation_code` 반영(기관 전용 문항 노출 변화 확인 —
   `v13-institution-question-exposure-handoff-2026-06-26.md`의 노출 조건과 연동됨).
4. 거부 → 무변화 확인.
5. 같은 알림 재클릭 → "이미 처리된 초대" 상태.
6. admin에서 취소한 초대 응답 → "회수된 초대" 상태.
7. 코드 종료 후 수락 → "만료된 초대" 상태.
8. 기존 소속과 다른 코드 수락 → 경고 노출 + 수락 시 교체 확인.
9. 이메일 수신(제목 `[TOPIK AI] 기관 소속 초대 안내`) + CTA 랜딩 확인.

## 7. 남은 사항 / 연락처

- dev DB에는 검증용 실초대 1건이 남아 있다: 김찬기(chanchan2@keduall.com) →
  `CAMPAIGN-01` pending, 인앱 알림 + 실발송 이메일 존재 — **v13 모달 구현 시 바로 이
  초대로 e2e 테스트 가능**.
- 운영 DB에는 미적용(기존 관례 — 운영 마이그레이션 일괄 적용 시점에 포함).
- 이메일 template 문구/링크 조정 필요 시 topik-ai `notification_templates`
  (`institution_invitation` × email) 행 수정으로 대응 가능.
