# Users 가입 생애주기 정합화 v13 Handoff

## 1. 문제 요약

- 이메일 가입 직후 인증메일은 발송되지만 사용자가 인증을 완료하지 않을 수 있다.
- 이 계정은 가입 생애주기상 아직 정상 회원이 아니며, 이메일 인증 전에는 필수 약관 동의를 완료할 수도 없다.
- 따라서 Admin에서 `정상 / 동의 완료 / 미인증` 조합을 정상 표시로 허용하면 운영자가 가입 완료 회원으로 오해한다.
- topik-ai는 v13 원천 테이블 DDL/가입 플로우를 직접 수정하지 않지만, Admin 소유 `get_admin_users` RPC에서 가입 상태와 약관 표시 계약을 정규화한다.

## 2. 현재 RPC 관찰

- `get_admin_users`는 v13 `profiles`와 `auth.users`를 조인해 `status`, `email_confirmed`, `consent_status`, `consent_accepted_at`를 반환한다.
- `profiles.status='active'`는 현재 topik-ai에서 `정상`으로 매핑된다.
- `email_confirmed=false`는 `미인증`으로 매핑된다.
- `consent_status='consented'`는 `동의 완료`로 매핑된다.
- 이 3개 원천값이 독립적으로 내려오면 Admin 화면에서 `정상 / 동의 완료 / 미인증`처럼 가입 완료와 충돌하는 조합이 생길 수 있다.
- 2026-06-26 topik-ai 보정 후 `get_admin_users`는 `registration_status`를 별도 반환하고, `email_confirmed=false`이면 `consent_status='none'`, `consent_accepted_at=NULL`로 내려준다.

## 3. 불변식

Admin과 v13은 다음 가입 생애주기 불변식을 공유해야 한다.

| 조건 | Admin 회원 상태 | 약관 동의 표시 | 이메일 인증 표시 |
| --- | --- | --- | --- |
| `email_confirmed_at IS NULL` | 인증 대기 | 동의 불가 | 미인증 |
| `email_confirmed_at IS NOT NULL` + 필수 약관 미동의 | 약관 대기 | 미동의 또는 일부 동의 | 인증 완료 |
| `email_confirmed_at IS NOT NULL` + 필수 약관 동의 완료 | 정상 | 동의 완료 | 인증 완료 |
| 정지 또는 탈퇴 운영 상태 | 정지 또는 탈퇴 | 원천/파생 표시 유지 | 인증 완료 또는 미인증 |

추가 진단 규칙:

- `email_confirmed_at IS NULL AND user_consents EXISTS`는 v13 dry-run/backfill 검토 대상이다.
- `email_confirmed_at IS NULL AND profiles.status='active'`는 `profiles.status` 자체의 오류가 아니라, 가입 생애주기 상태가 운영 상태와 분리되어야 한다는 근거다.
- `email_confirmed_at IS NOT NULL AND required consent missing`은 약관 대기 또는 백필 대상이다.

## 4. topik-ai 소유 작업

- v13 `profiles.status` 원천값은 `UserSummary.status`에 유지한다.
- Admin 소유 `get_admin_users` RPC는 `registration_status`를 추가로 반환한다. 프론트는 이 값이 있으면 우선 사용하고, 구 RPC/모크 경로에서는 `profiles.status`, `emailVerificationStatus`, `termsConsentStatus`를 조합해 fallback 파생한다.
- `registration_status` 값은 `pending_email_verification`/`pending_required_consent`/`active`/`blocked`/`deleted`다.
- 이메일 미인증이면 약관 컬럼은 `동의 완료`로 표시하지 않고 `동의 불가`로 표시한다.
- 이메일 미인증이면 `get_admin_users`가 약관 집계를 `none/null`로 정규화하므로 회원 목록/상세에는 개발자용 백필 진단 태그를 노출하지 않는다.
- topik-ai migration은 이 이슈를 해결하기 위해 `auth.users`, `user_consents`, `legal_documents`, 승인 외 `profiles` write를 추가하지 않는다.
- topik-ai migration `supabase/migrations-admin/20260626120000_admin_users_registration_status.sql`은 Admin RPC만 교체하며, v13 원천 테이블 DDL은 변경하지 않는다.

## 5. v13 요청

v13은 원천 가입 플로우와 스키마 계약을 정합화해야 한다.

1. `profiles.status`를 가입 단계까지 과확장하지 말고, 별도 `registration_status` 또는 동등한 가입 생애주기 계약을 추가한다.
2. 이메일 미인증 사용자의 `user_consents` insert를 차단한다.
3. 이메일 인증과 필수 약관 동의 전에는 정상/active 회원 전환을 차단한다.
4. v13 사용자 앱의 가입 가드/RPC도 topik-ai `registration_status`와 동등한 계약을 갖춘다.
5. 기존 데이터에 대해 dry-run 리포트와 백필 계획을 먼저 제출한다.

## 6. v13 백필 대상

v13 dry-run 리포트는 최소 아래 집합을 분리해야 한다.

```sql
-- 이메일 미인증인데 active 상태인 계정
select p.id
from profiles p
join auth.users u on u.id = p.id
where u.email_confirmed_at is null
  and p.status = 'active';

-- 이메일 미인증인데 약관 동의 기록이 존재하는 계정
select distinct uc.user_id
from user_consents uc
join auth.users u on u.id = uc.user_id
where u.email_confirmed_at is null;

-- 이메일 인증은 완료됐지만 필수 약관 동의가 누락된 계정
select u.id
from auth.users u
where u.email_confirmed_at is not null
  and not exists (
    select 1
    from user_consents uc
    join legal_documents ld on ld.id = uc.document_id
    where uc.user_id = u.id
      and ld.requires_consent = true
  );
```

실제 백필 SQL은 v13 소유 migration에서 작성한다. topik-ai는 위 쿼리를 진단 기준으로만 사용한다.

## 7. QA 기준

- 이메일 가입 직후 인증 전: Admin 회원 상태 `인증 대기`, 약관 동의 `동의 불가`, 이메일 인증 `미인증`.
- 이메일 인증 후 약관 미동의: Admin 회원 상태 `약관 대기`, 정상 회원으로 표시하지 않음.
- 이메일 인증 + 필수 약관 동의 완료: Admin 회원 상태 `정상`, 약관 `동의 완료`, 이메일 `인증 완료`.
- 미인증인데 `user_consents`가 있어도 Admin 목록/상세 약관 표시는 `동의 불가`이며, `get_admin_users` 응답은 `consent_status='none'`, `consent_accepted_at=NULL`이다.
- `profiles.status` unknown 값은 Admin에서 `정상`으로 fallback하지 않고 오류로 드러남.

## 8. 기각 대안

- `profiles.status`에 가입 단계까지 모두 넣기: 운영 차단/탈퇴 상태와 가입 생애주기가 섞여 장기 계약이 불명확해진다.
- Admin에서 `정상 + 미인증`을 `인증 전` 보조 태그로만 보정하기: 약관 동의 완료처럼 보이는 문제를 해결하지 못한다.
- 미인증 사용자의 약관 원천 기록을 회원 목록에 운영 태그로 노출하기: 운영자가 내부 백필 용어를 보게 되어 혼란이 커진다. 진단은 dry-run SQL과 v13 migration 계획에서 다룬다.
