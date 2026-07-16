# Notification Worker Production Verification Runbook

## Purpose

This runbook verifies the production handoff of the email notification worker from v13 to topik-ai.

Target end state:

- topik-ai owns the server-side email worker.
- v13 remains a user-facing app and does not call the worker directly from app/client code.
- Server-only secrets stay outside browser-visible source and bundles.
- Production dispatch state is visible from both topik-ai admin history and v13 owner-read user history.

Do not record secret values in tickets, logs, screenshots, docs, commits, or chat. Record only variable names and pass/fail evidence.

The checked-in `notification-worker-production-evidence.example.md` file is a redacted example only. Do not copy it as the real evidence file without replacing redacted dispatch and attempt ids with non-secret ids from the actual production smoke run. The production evidence validator rejects `redacted` dispatch or attempt identifiers.

## Required SOT Checklist

### v13

- v13 repo: AGENTS.md - SOT change limits, v13=user-facing boundary, verification/reporting rules.
- v13 repo: README.md - v13 runtime and environment baseline.
- v13 repo: docs/scope-decisions/2026-06-17-ai-deferred-and-mvp-scope.md - MVP/deferred scope boundary.
- v13 repo: docs/Wireframe/data-usage-index.md - active SOT terms that still need proposal-based cleanup.
- v13 repo: docs/Wireframe/31-X-09-notification-settings/functional-spec.md - user notification settings/history contract.
- v13 repo: docs/Wireframe/31-X-09-notification-settings/description.md - user notification UI description.
- v13 repo: docs/sot-change-proposals/2026-06-18-admin-ownership-transfer-to-topik-ai.md - v13 proposal record for admin ownership transfer.

### topik-ai

- `AGENTS.md` - admin repo execution and doc update contract.
- `supabase/README.md` - `migrations` vs `migrations-admin` tracker separation.
- `docs/architecture/shared-supabase-schema-ownership.md` - owner/writer/reader matrix.
- `docs/specs/admin-data-contract.md` - admin data contract.
- `docs/specs/admin-data-usage-map.md` - admin page data source map.
- `docs/specs/notification-contract.md` - notification dispatch/attempt status contract.
- `docs/page-sync/message-history-page-sync.md` - `Message > 발송 이력` sync contract.
- `docs/page-sync/message-inapp-page-sync.md` - `Message > 인앱 발송` sync contract.
- `docs/알림-기능-구현-페이즈-가이드.md` - notification worker ownership and production transfer checklist.

## Phase 0 - Local Boundary Evidence

Run from `C:\Users\admin\Desktop\workspace\topik-ai`:

```bash
npm run harness:admin-transfer:local
npm run check:transfer-sot-checklist
npm run check:client-source-secrets
npm run check:migration-boundary
npm run harness:admin-boundary:local
npm run build
npm run check:client-secrets
npm run test:unit -- client-bundle-secret-leaks notification-worker-smoke notification-cross-app-state client-source-secret-boundary transfer-sot-checklist migration-ownership-boundary message-history-boundary vercel-worker-readiness notification-dispatch-email-worker
npx playwright test tests/e2e/message-source.spec.ts
```

Run from `C:\Users\admin\Desktop\workspace\topik-project\v13`:

```bash
pnpm harness:admin-boundary
```

Expected local result:

- `npm run harness:admin-transfer:local` runs both the topik-ai local admin boundary harness and the v13 admin boundary harness.
- topik-ai local boundary checks pass.
- topik-ai `Message > 발송 이력` e2e opens the history detail Drawer and keeps retry/audit actions live.
- Production readiness remains a separate fail-closed gate when Vercel link/env are absent.
- v13 boundary harness passes.
- v13 active docs may still warn about historical/admin terms until the SOT proposal is approved and applied.

## Phase 1 - Vercel Readiness

Run after linking the intended production Vercel project and configuring production runtime env:

```bash
npm run check:vercel-worker-readiness -- --strict-env
npm run check:notification-worker-smoke
```

Supabase environment routing contract:

- localhost and Vercel Development use `topik-dev` (`fglggyfvzjdsbyckinqa`).
- Vercel Preview and Production use `topik-prod` (`eymlabowhfgtxbiqwxqh`).
- Set both browser-safe `VITE_SUPABASE_*` values and canonical server-only `SUPABASE_*` values per Vercel target.
- A Vercel env update requires a new deployment. Do not treat successful env mapping as proof that prod migrations or worker runtime dependencies are ready.

Required production runtime env names:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NOTIFICATION_WORKER_SECRET`
- `CRON_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `SITE_URL`

Operator-only smoke env:

- `TOPIK_AI_PRODUCTION_URL`

Supported local aliases:

- `VITE_SUPABASE_URL` may stand in for `SUPABASE_URL` during local verification.
- `SUPABASE_SECRET_KEY` may stand in for `SUPABASE_SERVICE_ROLE_KEY` during local verification.
- Prefer the canonical production names above for Vercel runtime env.

Evidence to record:

- `.vercel/project.json` exists and contains project/org identifiers.
- `vercel.json` schedules `/api/notifications/dispatch-email` once daily at `00:00 UTC` (`09:00 KST`) so the fallback worker remains compatible with the Vercel Hobby Cron limit.
- Administrator-triggered delivery uses the authenticated immediate `POST` kick; the daily Cron is a recovery path for attempts that remain `pending`.
- `vercel.json` excludes `/api/` from the SPA rewrite.
- Readiness output contains no secret values.
- Strict readiness treats missing runtime env names as a failed production gate.
- Unauthenticated worker smoke returns `401` before any authenticated dispatch smoke is attempted.

2026-07-16 status note:

- The Vercel Supabase variables are split by target and the Production bundle resolves only `topik-prod`.
- The first PR Preview attempt failed because the previous `*/15 * * * *` worker schedule exceeded the Vercel Hobby Cron limit. The fallback schedule is now `0 0 * * *`, and the replacement Preview and Production deployments are Ready.
- Production unauthenticated `POST` requests to `/api/auth-email/sync`, `/api/admin/invite`, and `/api/notifications/dispatch-email` now return each handler's expected `401`. The worker's unauthenticated `GET` also returns `401`.
- `Ready` is a Vercel deployment/build/alias state. It does not prove that authenticated server functions can use their runtime Supabase or SMTP environment.
- An approved live smoke changed `notification_email_config.mode` from `disabled` to `live`, created dispatch `86da4dd8-1152-4835-87f1-2e12b44202ab`, and produced pending attempt `92b6938c-e546-4f2f-b5b3-9f416dc6c5d9`.
- The deployed Vercel worker and the adjacent `/api/auth-email/sync` and `/api/admin/invite` routes rejected the valid `topik-prod` administrator JWT with `401 invalid_session`. The JWT issuer and `admin_accounts` row both match `topik-prod`, so the Vercel server-only `SUPABASE_URL`/service key pair must be corrected and redeployed before the authenticated Vercel smoke can pass.
- To complete the approved real-send check without falsifying delivery state, the current worker source was executed locally with the production project secret resolved in memory from the Supabase Management API and the configured SMTP transport. It returned `processed=1, sent=1, failed=0`; the attempt is `sent` with `provider_message_id` and `sent_at`, retry count `0`, and no error.
- Production Admin `Message > 발송 이력` shows the same dispatch as `완료` and the attempt as `성공`. The dispatch ledger `recipient_count` remains `0` while the actual attempt aggregate is `1`; this is a separate data-consistency gap.

## Phase 2 - Production Worker Smoke

Run unauthenticated smoke first:

```bash
TOPIK_AI_PRODUCTION_URL="https://..." npm run check:notification-worker-smoke
```

Expected:

- `GET /api/notifications/dispatch-email` returns `401`.
- No email dispatch is triggered.

Run authenticated smoke only when processing pending attempts is acceptable:

```bash
TOPIK_AI_PRODUCTION_URL="https://..." CRON_SECRET="..." NOTIFICATION_WORKER_SECRET="..." npm run check:notification-worker-smoke -- --dispatch
```

Expected:

- Vercel Cron style `GET` with `Authorization: Bearer ${CRON_SECRET}` returns 2xx.
- Manual `POST` with `x-worker-secret` returns 2xx.
- SMTP rejection or transport failure does not mark attempts as `sent`; it keeps retry bookkeeping and writes `smtp_error`.

For the full production handoff gate, run:

```bash
npm run harness:admin-boundary:production
npm run check:admin-transfer-completion
```

This command intentionally uses `check:notification-worker-smoke -- --dispatch`, so run it only after the pending attempts used for smoke verification are acceptable to process.
The completion audit must report `Admin transfer completion audit: complete` before the transfer is considered finished. If it reports `incomplete`, keep the v13 transition route and follow the missing evidence lines.

## Phase 3 - Cross-App State Verification

Use a known pending email attempt or create a controlled test attempt through the admin workflow. Do not insert production data manually unless the release owner has approved the exact SQL.

Run the non-mutating Supabase state check:

```bash
SUPABASE_ACCESS_TOKEN="..." SUPABASE_PROJECT_REF="..." npm run check:notification-cross-app-state
```

Expected:

- Required shared/admin notification tables exist.
- Recent `sent` attempts have `sent_at`.
- Recent non-`sent` attempts do not have `sent_at`.
- Output prints aggregate counts and variable names only, not secret values.

Verify in Supabase or topik-ai admin views:

- `notification_dispatches.status` reflects the worker outcome.
- `notification_delivery_attempts.status` moves from `pending` to `sent`, `failed`, `skipped`, or `opted_out`.
- `sent_at` is set only for `sent`.
- `provider_message_id` is recorded only after provider success.
- retry/failure bookkeeping remains when provider config is missing or SMTP rejects/fails.

Verify in topik-ai:

- `Message > 발송 이력` shows the processed dispatch.
- Delivery counts match `notification_delivery_attempts`.
- Before production dispatch smoke, local e2e coverage for `Message > 발송 이력` is `npx playwright test tests/e2e/message-source.spec.ts`.

Verify in v13:

- X-09 notification history shows only owner-readable rows for the logged-in learner.
- v13 app/client code still has no caller for `/api/notifications/dispatch-email`.

## Phase 4 - v13 Transition Route Retirement Gate

Retire the v13 transition route only after Phases 0-3 have evidence.

Before removing the route, prepare a v13 SOT update proposal or approved SOT change for:

- `src/app/api/notifications/dispatch-email/route.ts`
- `src/lib/routes.ts`
- v13 repo: docs/ia.md API route table if it still lists the transition endpoint.
- Any remediation docs that describe the v13 route as current.

If the production evidence records `retire v13 transition route`, it must also record `Route retirement SOT approval: yes`. Without that marker, `npm run check:notification-production-evidence -- --require` fails. Use `Route retirement SOT approval: n/a` only when the decision is to keep the v13 transition route.

Do not remove v13 user-facing notification settings/history objects:

- `notification_settings`
- `user_notifications`
- `user_marketing_consent`
- owner-read use of `notification_delivery_attempts`

## Evidence Template

```md
## Notification worker production verification - YYYY-MM-DD

### SOT checklist
- v13 required SOT checked: yes
- topik-ai required SOT checked: yes
- SOT conflicts: none

### Local boundary
- topik-ai transfer checklist: pass
- topik-ai source secret check: pass
- topik-ai build: pass
- topik-ai bundle secret check: pass
- topik-ai targeted unit tests: pass
- v13 admin boundary harness: pass
- v13 transition retirement gate: pass

### Vercel readiness
- Project linked: yes
- Production env names configured: yes
- Readiness command: pass

### Smoke
- Unauthenticated GET 401: pass
- Authenticated cron GET 2xx: pass
- Authenticated manual POST 2xx: pass

### Cross-app data
- Dispatch id: DISPATCH-ID
- Attempt ids: ATTEMPT-ID
- topik-ai admin history verified: yes
- v13 owner-read history verified: yes

### Decision
- Keep v13 transition route / retire v13 transition route
- Route retirement SOT approval: n/a / yes
- Reason:
```
