# topik-ai Handoff: PDF Export Quota Management

Date: 2026-07-07
Owner boundary: `v13` user app enforces quota during export. `topik-ai` owns admin UI and operations.

## Current User-App Contract

- `POST /api/export/pdf` keeps the existing request body.
- `POST /api/export/pdf/print` uses the same request body and returns `{ exportId }`.
- Both routes resolve export targets server-side, derive distinct `problem_id[]`, and call `public.claim_pdf_export_quota(p_user_id, p_problem_ids)` before creating `export_files`.
- Quota commit/release runs only from v13 server code with service role through `public.commit_pdf_export_quota(p_user_id, p_usage_ids, p_export_file_id)` and `public.release_pdf_export_quota(p_user_id, p_usage_ids, p_reason)`.
- Quota failure returns HTTP `429` with:

```json
{
  "error": "Localized PDF quota exceeded message",
  "code": "pdf_export_quota_exceeded",
  "limit": 3,
  "used": 3,
  "remaining": 0,
  "resetAt": "period end timestamp",
  "periodUnit": "month"
}
```

## Database Objects

- `pdf_export_quota_policies`
  - Default seed: `subject_scope='user'`, `resource_scope='problem'`, `period_unit='month'`, `period_timezone='Asia/Seoul'`, `limit_count=3`.
  - topik-ai can change `limit_count`, `period_unit`, `period_timezone`, `priority`, and `is_active`.
- `pdf_export_quota_usages`
  - Runtime ledger. v13 writes only through RPC.
  - Statuses: `reserved`, `committed`, `released`.
  - Reserved rows prevent concurrent overuse. Stale reservations older than 15 minutes are released on the next claim for the same user/problem/period.
  - Reserved rows are not exposed to normal user selects.
- `pdf_export_quota_resets`
  - Reset audit header.
  - `reset_scope` values: `user`, `group`, `global`.
  - `problem_id=null` means all problems in the current period.
- `pdf_export_quota_reset_targets`
  - Materialized user targets for `user`, `group`, and `global` resets.
  - For group and global reset, topik-ai must expand the target population to concrete `user_id` rows at reset creation time.
  - This prevents reset audit headers (`reason`, `created_by`) from being visible to unrelated authenticated users.

## Required Admin Features

1. Policy CRUD
   - Manage active policy values for limit count and period unit.
   - Validate `period_unit in ('day','week','month')`.
   - Keep one intended active policy for `user + problem` unless product explicitly defines policy precedence.

2. Reset operations
   - Individual user reset: insert `pdf_export_quota_resets(reset_scope='user', problem_id?, reason, created_by)` and one target row.
   - Group reset: insert reset header and materialize all target users into `pdf_export_quota_reset_targets`.
   - Global reset: insert reset header with `reset_scope='global'` and materialize all affected users into `pdf_export_quota_reset_targets`.
   - Reset is period-local in v13 RPC: usages before the latest matching reset in the same period are excluded.

3. Audit
   - Keep `created_by`, `created_at`, `reason`, scope, problem target, and materialized target count visible.
   - Do not edit or delete reset rows for normal operations. Add a compensating reset if needed.

4. Security boundary
   - Admin writes must run server-side with service role or platform-admin guarded server APIs.
   - Do not expose service role keys to browsers.
- v13 user routes must not be used as admin APIs.
- Do not grant browser/authenticated users execute permission on `commit_pdf_export_quota` or `release_pdf_export_quota`.

## Integration Notes

- Existing `export_files` remains the file/export status ledger.
- Saved PDF re-download does not create new quota usage.
- PDF generation failure releases reserved quota.
- Browser print fallback no longer writes `export_files` directly from the client. It must call `/api/export/pdf/print`.

## Suggested topik-ai Acceptance Tests

- Change policy from 3 monthly to 5 weekly and verify v13 claim behavior follows the DB policy.
- Reset one user for one problem and verify exports are allowed again in the same period.
- Reset a group by materializing target rows and verify only those users are affected.
- Global reset should apply only to materialized target users and should not expose reset audit rows to unrelated authenticated users.
- Non-admin browser users cannot insert/update policy or reset rows directly.
