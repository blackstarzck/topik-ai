# v13 Users 가입 생애주기 정합화 handoff (2026-06-26)

## 1. 목적

topik-ai Admin에서 발견한 `정상 / 동의 완료 / 미인증` 조합은 가입 완료 상태가 아니라 가입 생애주기 불변식 위반 후보다. 이 문서는 v13 작업자가 이메일 인증, 필수 약관 동의, 정상 사용자 진입 조건을 같은 기준으로 고칠 수 있도록 현재 v13 코드 근거, DB/RLS 수정 지점, dry-run/backfill 기준, QA 기준을 정리한다.

핵심 결론:

- `profiles.status`는 `active`/`blocked`/`deleted` 같은 운영 상태로 유지한다.
- 가입 생애주기 상태는 별도 계약으로 계산한다.
- 이메일 미인증 사용자는 약관 동의 기록을 만들 수 없고, `/auth/consent` 또는 workspace 정상 진입으로 넘어가면 안 된다.
- 이메일 인증 완료 후 필수 약관 동의가 누락된 사용자는 `약관 대기`로 보고 `/auth/consent`에 머문다.

## 2. topik-ai 선행 변경

topik-ai는 v13 원천 테이블을 직접 고치지 않고 Admin read 계약만 보정했다.

- Admin migration: `topik-ai/supabase/migrations-admin/20260626120000_admin_users_registration_status.sql`
- Admin RPC: `public.get_admin_users(...)`
- 추가 반환: `registration_status`
  - `pending_email_verification`
  - `pending_required_consent`
  - `active`
  - `blocked`
  - `deleted`
- 이메일 미인증이면 Admin RPC가 약관 집계를 `consent_status='none'`, `consent_accepted_at=NULL`로 정규화한다.
- Admin 화면은 미인증 사용자의 약관 상태를 `동의 완료`가 아니라 `동의 불가`로 표시한다.

v13은 위 표시 보정의 원천 원인을 해결해야 한다.

## 3. v13 현재 코드 근거

조사 repo:

- `C:\Users\admin\Desktop\workspace\topik-project\v13-dev`

확인한 현재 흐름:

| 영역 | 파일 | 현재 동작 | 문제 |
| --- | --- | --- | --- |
| 가입 후처리 | `src/app/auth/post-auth/page.tsx` | `requireActiveSession()` 후 `backfillOAuthDisplayName()`, `getAuthCompletionStatusForSession()`로 다음 경로 결정 | 이메일 인증 미완료를 별도 완료 상태로 보지 않는다. |
| 완료 상태 계산 | `src/lib/auth/completion.ts` | 프로필 필수값, 필수 약관, 학습 목표 기준으로 `pending-auth-completion`/`pending-learning-goal`/`ready` 계산 | `user.email_confirmed_at` 또는 동등한 이메일 인증 플래그가 선행 조건이 아니다. |
| workspace guard | `src/app/(workspace)/layout.tsx` | 비로그인, 비활성 계정, auth completion만 차단 | 이메일 미인증 세션이 존재하면 post-auth/consent로만 우회되고, 상태명이 명확하지 않다. |
| 약관 화면 | `src/app/auth/consent/page.tsx` | active session이면 미동의 문서를 조회하고 폼 표시 | 이메일 미인증 사용자를 먼저 `/auth/verify-email`로 돌려보내지 않는다. |
| 약관 action | `src/app/auth/consent/actions.ts` | 체크박스 검증 후 `complete_auth_gate` RPC 호출 | 서버 action 레벨에서 이메일 미인증을 차단하지 않는다. |
| 약관 helper | `src/lib/legal/consent.ts` | `user_consents` 누락 조회와 insert helper 제공 | 직접 insert helper가 이메일 인증 조건을 모른다. |
| 약관 RPC | `supabase/migrations/20260623103000_auth_completion_gate.sql` | `public.complete_auth_gate(...)`가 missing required docs를 `user_consents`에 insert | `auth.users.email_confirmed_at` 확인 없이 동의 기록 가능. |
| locale wrapper RPC | `supabase/migrations/20260625113000_auto_locale_detection.sql` | 6-arg `complete_auth_gate(...)`가 4-arg RPC로 위임 | 4-arg RPC에 guard를 추가하면 같이 보호된다. |
| 기존 이메일 인증 helper | `supabase/migrations/20260527113000_storage_email_confirmed_hardening.sql` | `private.is_email_confirmed(uid uuid)` 존재 | Storage RLS에는 쓰지만 auth completion/consent에는 아직 적용하지 않는다. |

관련 SOT:

- `v13-dev\docs\Wireframe\34-X-12-auth-verify-email\description.md`
- `v13-dev\docs\Wireframe\40-X-18-auth-consent\functional-spec.md`
- `v13-dev\docs\Wireframe\data-usage-index.md`
- `v13-dev\supabase\migrations\INDEX.md`

## 4. v13 불변식

| 조건 | v13 앱 상태 | 허용되는 다음 단계 | 금지되는 동작 |
| --- | --- | --- | --- |
| `auth.users.email_confirmed_at IS NULL` | `pending-email-verification` | `/auth/verify-email` 안내, 재전송 | `user_consents` insert, workspace 진입, 학습 목표/대시보드 진입 |
| 이메일 인증 완료 + 필수 프로필 누락 | `pending-auth-completion` | `/auth/consent`에서 프로필 보강 | workspace 진입 |
| 이메일 인증 완료 + 필수 약관 누락 | `pending-consent` 또는 기존 `pending-auth-completion` | `/auth/consent`에서 동의 기록 | workspace 진입 |
| 이메일 인증 완료 + 필수 약관 완료 + 학습 목표 없음 | `pending-learning-goal` | `/onboarding/learning-goal` | 대시보드 ready 처리 |
| 이메일 인증 완료 + 필수 약관 완료 + 학습 목표 있음 | `ready` | `/dashboard` | 없음 |
| `profiles.status IN ('blocked','deleted')` | inactive | `/auth/account-inactive` | 모든 mutation |

권장 상태명:

- 앱 내부 enum에는 `pending-email-verification`을 추가한다.
- Admin/DB 가입 상태 계약에는 `pending_email_verification`, `pending_required_consent`, `active`, `blocked`, `deleted`를 사용한다.
- `profiles.status='active'`는 이메일 인증/약관 완료를 뜻하지 않는다.

## 5. DB/RLS 구현 요청

새 v13 migration을 추가한다. 파일명은 v13 규칙에 따라 KST timestamp + snake_case를 사용하고, `supabase/migrations/INDEX.md`를 갱신한다.

### 5.1 `complete_auth_gate`에 이메일 인증 선행 guard 추가

4-arg 원본 RPC에 먼저 guard를 넣는다. 6-arg wrapper는 원본 RPC로 위임하므로 같이 보호된다.

요구:

- `v_user_id := auth.uid()` 이후 `auth.users.email_confirmed_at`을 조회한다.
- `email_confirmed_at IS NULL`이면 `auth_completion_required: email_verification` 예외를 던진다.
- 이 예외가 나면 profile update와 `user_consents` insert가 모두 발생하지 않아야 한다.
- `blocked`/`deleted` 계정 차단보다 앞뒤 순서는 v13이 결정하되, 어떤 경우에도 미인증 상태에서 consent insert는 금지한다.

예시 형태:

```sql
select email_confirmed_at is not null
into v_email_confirmed
from auth.users
where id = v_user_id;

if coalesce(v_email_confirmed, false) is false then
  raise exception 'auth_completion_required: email_verification'
    using errcode = '42501';
end if;
```

### 5.2 `user_consents` owner insert RLS에 이메일 인증 조건 추가

현재 owner insert 정책은 `user_id = auth.uid()`만 확인한다. 이메일 미인증 세션이 생길 수 있는 설정이면 client가 직접 `user_consents`를 insert할 수 있다.

요구:

- `user_consents_owner_insert` 정책의 `WITH CHECK`에 `private.is_email_confirmed((select auth.uid()))` 조건을 추가한다.
- `private.is_email_confirmed(uid uuid)`가 이미 있으므로 재사용한다.
- 정책 변경 후에도 `authenticated`만 insert 가능해야 한다.
- `anon` insert는 계속 불가해야 한다.

예시 형태:

```sql
drop policy if exists user_consents_owner_insert on public.user_consents;
create policy user_consents_owner_insert
  on public.user_consents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_email_confirmed((select auth.uid()))
  );
```

주의:

- RLS는 `SECURITY DEFINER` RPC 내부 insert에는 적용되지 않을 수 있다. 그래서 5.1 RPC guard와 5.2 RLS guard가 둘 다 필요하다.
- 새 `SECURITY DEFINER` 함수를 만들 경우 `search_path`를 고정하고, 생성 직후 `revoke all ... from public, anon` 후 필요한 role에만 `grant execute`한다.

### 5.3 가입 상태 helper 또는 RPC 추가

v13 앱과 Admin이 같은 언어로 상태를 말할 수 있도록 별도 helper를 둔다.

권장안:

- `private.get_registration_status(p_user_id uuid) returns text`
- 반환값:
  - `blocked`
  - `deleted`
  - `pending_email_verification`
  - `pending_required_consent`
  - `active`

주의:

- 이 helper는 `profiles.status`를 변경하지 않는다.
- 필수 약관 계산은 최신 published required `legal_documents` 기준이어야 한다.
- `email_confirmed_at IS NULL`이면 `user_consents` 기록 존재 여부와 무관하게 `pending_email_verification`이 우선한다.

## 6. 앱 구현 요청

### 6.1 `AuthCompletionStatus`에 이메일 인증 대기 추가

대상:

- `src/lib/auth/completion-routes.ts`
- `src/lib/auth/completion.ts`
- `src/app/auth/post-auth/page.tsx`
- `src/app/(workspace)/layout.tsx`
- landing CTA 관련 테스트

요구:

- `AuthCompletionStatus`에 `pending-email-verification` 추가.
- `getAuthCompletionStatusForSession()`은 프로필/약관/학습 목표보다 먼저 이메일 인증을 확인한다.
- 미인증이면 `/auth/post-auth` 또는 workspace guard가 `/auth/verify-email`로 보낸다.
- `pending-consent` 타입이 현재 사실상 쓰이지 않는다면 이번 작업에서 의미를 정리한다. 최소한 이메일 미인증과 약관 미동의는 같은 `pending-auth-completion`으로 뭉개지지 않아야 한다.

### 6.2 `/auth/consent` page/action에서 미인증 차단

대상:

- `src/app/auth/consent/page.tsx`
- `src/app/auth/consent/actions.ts`

요구:

- page render 전에 `user.email_confirmed_at` 또는 동등한 확인값을 검사한다.
- 미인증이면 missing documents를 조회하지 않고 `/auth/verify-email`로 보낸다.
- server action에서도 같은 guard를 반복한다. page guard만 두면 crafted POST 또는 stale form 제출을 막지 못한다.
- `complete_auth_gate`에서 `auth_completion_required: email_verification`이 오면 `save-failed`가 아니라 인증 안내 경로로 분기한다.

### 6.3 `recordRequiredConsents` 직접 사용 경로 점검

대상:

- `src/lib/legal/consent.ts`
- `rg "recordRequiredConsents|user_consents" src tests`

요구:

- `recordRequiredConsents()`가 남아 있으면 호출 전에 인증 완료 여부가 보장되는지 확인한다.
- 가능하면 약관 기록은 `complete_auth_gate` RPC 한 경로로 모아 트랜잭션 보장을 유지한다.

## 7. 기존 데이터 dry-run

실제 백필 전 dry-run 리포트를 먼저 만든다. `user_consents`는 감사성 ledger라 임의 삭제하지 않는다.

### 7.1 이메일 미인증 + active 운영 상태

이 집합은 `profiles.status` 오류로 바로 보지 않는다. `profiles.status='active'`가 운영 상태라는 근거이며, 가입 생애주기 상태 분리가 필요하다는 진단이다.

```sql
select p.id, u.email, p.status, u.created_at
from public.profiles p
join auth.users u on u.id = p.id
where u.email_confirmed_at is null
  and p.status = 'active'
order by u.created_at desc;
```

### 7.2 이메일 미인증 + 약관 동의 기록 존재

이 집합은 “원천 기록은 있으나 가입 생애주기상 유효 동의로 인정하지 않는” 대상이다.

```sql
select distinct uc.user_id, u.email, min(uc.accepted_at) as first_accepted_at, count(*) as consent_rows
from public.user_consents uc
join auth.users u on u.id = uc.user_id
where u.email_confirmed_at is null
group by uc.user_id, u.email
order by first_accepted_at desc;
```

처리 원칙:

- 자동 삭제 금지.
- Admin과 v13 가입 상태 helper는 이 기록을 “미인증 상태의 유효 동의 완료”로 계산하지 않는다.
- 법무/운영 결정 후 별도 무효화 컬럼 또는 감사 메모가 필요하면 별도 migration으로 설계한다.

### 7.3 이메일 인증 완료 + 필수 약관 누락

이 집합은 강제로 동의 완료 처리하지 말고 `/auth/consent`로 보내야 한다.

```sql
with required_docs as (
  select distinct on (ld.doc_type) ld.id, ld.doc_type, ld.version
  from public.legal_documents ld
  where ld.status = 'published'
    and ld.requires_consent is true
  order by ld.doc_type, ld.effective_at desc nulls last, ld.created_at desc
)
select u.id, u.email
from auth.users u
where u.email_confirmed_at is not null
  and exists (select 1 from required_docs)
  and exists (
    select 1
    from required_docs rd
    where not exists (
      select 1
      from public.user_consents uc
      where uc.user_id = u.id
        and uc.document_id = rd.id
    )
  )
order by u.created_at desc;
```

## 8. 테스트 계획

### 8.1 DB/migration tests

대상 기존 테스트:

- `tests/lib/supabase/auth-completion-gate-migration.test.ts`
- `tests/integration/auth-completion-gate-rpc.test.ts`

추가/수정 기준:

- `complete_auth_gate` migration test가 `auth.users.email_confirmed_at` guard를 확인한다.
- RLS policy SQL에 `private.is_email_confirmed((select auth.uid()))` 조건이 있는지 확인한다.
- local stack integration:
  - 미인증 가입 사용자가 `complete_auth_gate(... p_accept_required_consents=true)`를 호출하면 `auth_completion_required: email_verification`.
  - 위 실패 후 `user_consents` row가 0건.
  - 이메일 인증 완료 사용자만 missing required consents를 기록할 수 있음.

명령 후보:

```bash
pnpm test tests/lib/supabase/auth-completion-gate-migration.test.ts
SUPABASE_LOCAL_STACK=1 pnpm test tests/integration/auth-completion-gate-rpc.test.ts
```

### 8.2 App unit tests

대상 후보:

- `tests/lib/auth/completion.test.ts`
- `tests/app/auth/post-auth.test.ts`
- `tests/app/auth/consent-actions.test.ts`
- `tests/app/workspace-layout.test.tsx`
- `tests/components/landing/LandingAuthCta.test.tsx`

수용 기준:

- 미인증 session은 `pending-email-verification`.
- `/auth/post-auth`는 미인증 session을 `/auth/verify-email`로 보냄.
- `/auth/consent` action은 미인증이면 RPC 호출 전 인증 안내로 분기.
- workspace layout은 미인증 session을 정상 shell로 렌더하지 않음.

### 8.3 E2E

대상 후보:

- `tests/e2e/screens/verify-email.spec.ts`
- `tests/e2e/flows/consent-completion.spec.ts`

시나리오:

1. 이메일 가입 직후 인증 전:
   - `/auth/verify-email` 안내.
   - `/auth/consent` 직접 접근 시 동의 폼이 아니라 인증 안내.
   - workspace route 접근 시 인증 안내.
2. 이메일 인증 후 필수 약관 미동의:
   - `/auth/consent` 표시.
   - 동의 체크 전 제출 불가.
   - 체크 후 `user_consents` 기록.
3. 이메일 인증 + 필수 약관 + 학습 목표 완료:
   - `/dashboard` ready.

권장 검증:

```bash
pnpm lint
pnpm typecheck
pnpm test tests/lib/auth/completion.test.ts tests/app/auth/post-auth.test.ts tests/app/auth/consent-actions.test.ts tests/app/workspace-layout.test.tsx
pnpm exec playwright test tests/e2e/screens/verify-email.spec.ts tests/e2e/flows/consent-completion.spec.ts
```

## 9. 문서 갱신 범위

v13 작업 시 다음 문서 갱신 여부를 확인한다.

- `v13-dev\supabase\migrations\INDEX.md`: 새 migration 추가.
- `v13-dev\docs\Wireframe\34-X-12-auth-verify-email\description.md`: 미인증 session의 모든 auth completion 진입이 이 화면으로 모인다는 기준.
- `v13-dev\docs\Wireframe\40-X-18-auth-consent\functional-spec.md`: 이메일 인증 완료 후에만 약관 동의 가능하다는 권한 조건.
- `v13-dev\docs\Wireframe\data-usage-index.md`: `user_consents` insert 조건에 이메일 인증 필요.
- 필요하면 `v13-dev\docs\sot-change-proposals\`: SOT가 “이메일 가입에서 인증 전 약관 체크를 받은 것으로 본다”는 식으로 해석될 여지가 있으면 변경 제안부터 작성.

## 10. 기각 대안

- `profiles.status='active'`를 이메일 미인증이면 다른 값으로 바꾸기: 운영 정지/탈퇴 상태와 가입 생애주기가 섞인다.
- App page에서만 redirect하기: crafted action/RPC/direct Supabase client insert를 막지 못한다.
- RLS만 바꾸기: `SECURITY DEFINER` RPC 내부 insert는 RLS를 우회할 수 있으므로 `complete_auth_gate` guard가 필요하다.
- 기존 미인증 `user_consents`를 즉시 삭제하기: ledger 성격과 법무/감사 판단이 필요하므로 dry-run 후 별도 결정한다.

## 11. 참고한 Supabase 공식 문서

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): exposed schema의 RLS 필요성, `TO authenticated`, `auth.uid()` 사용, RLS 성능/보안 주의.
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions): `SECURITY DEFINER` 사용 시 `search_path` 고정, 함수 execute 권한 제한.
- [Securing your API](https://supabase.com/docs/guides/api/securing-your-api): 함수는 RLS가 아니라 `EXECUTE` grant로 호출 권한을 통제해야 한다는 기준.
- [How can I revoke execution of a Postgres function?](https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A): `PUBLIC`과 개별 role에서 execute 권한을 함께 revoke해야 한다는 운영 기준.
