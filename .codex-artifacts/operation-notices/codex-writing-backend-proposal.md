# Writing feature: move source-of-truth to backend API (for Sol)

**Date:** 2026-06-17
**From:** backend team (topik-ai)
**To:** Sol (frontend, topik-project-v13)
**Status:** proposal — needs your confirmation

## TL;DR

For the **writing feature**, please switch the frontend from reading/writing the
Supabase `writing_*` tables directly to **calling the backend API**. The backend
already persists every writing submission, draft, and AI feedback into its own
Postgres. Keeping a second copy in Supabase means the same essay lives in two
places and the scores will drift. Writing should have exactly one source of truth,
and that is the backend (it is where the real AI scoring happens).

This does **not** change auth (still Supabase) or the other domains — only writing.

## Why (verified from code, not assumption)

1. **Backend already saves everything.** `POST /api/writing/submit` runs
   `SubmitWritingCommand`: it persists the submission, enqueues async AI scoring,
   and the worker writes feedback + dimension scores + sentence corrections back
   into backend Postgres. `GET /api/evaluation/{id}/feedback` reads "DB-first from
   PostgreSQL". So the canonical writing data is already in the backend.

2. **The frontend currently fakes the score.** In
   `src/lib/writing/server-actions.ts`, `submitWritingAction` calls
   `generateMockFeedback(...)` and writes the mock into Supabase via the
   `submit_writing_with_feedback` RPC. Comparison reports use `ai_model: "mock-v1"`.
   There is no real AI scoring on the Supabase side — only the backend can do it.

3. **Double-write risk.** If the FE keeps writing to Supabase AND the backend
   writes to Postgres, each essay exists twice and can disagree. One source of
   truth removes that whole class of bug.

4. **Consistent with the agreed direction** (Lyle): "Postgres on the server =
   processed/aggregate data." AI-graded feedback *is* processed data.

## What the frontend uses today on Supabase (writing-related)

Tables FE reads/writes directly (count = call sites):

- `writing_submissions` (11), `writing_feedback` (11), `feedback_dimension_scores` (8),
  `writing_drafts` (7), `sentence_feedback` (2), `comparison_reports` (4)

RPCs: `submit_writing_with_feedback`, `create_comparison_report_with_metrics`

## Proposed mapping: Supabase → backend API

| FE action | Today (Supabase) | Switch to (backend API) | Status |
|---|---|---|---|
| Submit essay | insert `writing_submissions` + mock RPC | `POST /api/writing/submit` → returns `submission_id`, HTTP 202 | ✅ exists |
| Poll grading | (n/a — mock instant) | `GET /api/evaluation/{submission_id}` → `processing\|graded\|failed` | ✅ exists |
| Get feedback | read `writing_feedback` + dims + sentences | `GET /api/evaluation/{submission_id}/feedback` | ✅ exists |
| Save draft | upsert `writing_drafts` | `POST /api/writing/draft` (save_draft) | ✅ exists |
| History list | select `writing_submissions` | `GET /api/writing/history` | ✅ exists |
| Archive detail / retry / rate / report | `writing_submissions` | `GET/POST /api/writing/archive/{id}/...` | ✅ exists |
| Export PDF | `export_files` | `GET /api/writing/archive/{id}/export-pdf` | ✅ exists |
| Comparison report | `comparison_reports` + `mock-v1` | (backend endpoint not present yet — TBD) | ⚠️ gap |

## API contracts (so you can wire the calls)

### POST /api/writing/submit  → 202
Request:
```json
{
  "task_type": "Q54",            // "Q51" | "Q52" | "Q53" | "Q54"
  "task_id": "Q54",              // optional; defaults to task_type
  "text": "현대 사회에서 ...",     // min len: Q51/Q52=5, Q53=20, Q54=100
  "lang": "ko",                  // ko | en | vi
  "passage_context": ""          // Q51/Q52 only (passage with ㉠/㉡)
}
```
Response (202):
```json
{ "submission_id": "uuid", "status": "processing", "message": "...poll GET /api/evaluation/{id}" }
```

### GET /api/evaluation/{submission_id}  → status
```json
{ "submission_id": "uuid", "status": "graded", "total_score": 48.0, "max_score": 50.0, "processing_time_seconds": 42.1 }
```

### GET /api/evaluation/{submission_id}/feedback  → full result
Returns `total_score`, `max_score`, `trait_scores[]` (per-dimension: trait, score 0-10,
feedback, strengths, improvements, weight), `errors[]` (original/correction/explanation/
severity), `annotations[]` (inline, category 내용|구성|언어사용|표현), `ai_summary`,
plus `degraded`/`degraded_traits` flags. (202 `{"status":"processing"}` while still grading.)

> Note the shape difference vs Supabase: backend returns `trait_scores` (not
> `feedback_dimension_scores` rows) and `errors`/`annotations` (not `sentence_feedback`
> rows). If you want to keep your current UI components, we can agree on a small
> adapter — but the data is equivalent.

## Auth — the one prerequisite

Backend writing/evaluation endpoints require a JWT (`get_current_user`). The
frontend sends a **Supabase access token (ES256)**. The backend can already verify
Supabase tokens (`supabase_verifier.py`); we just need to enable it
(`SUPABASE_ENABLED=true`) and provision a backend user row on first login
(keyed by `auth.users.id` = JWT `sub`). **Action on backend side, not yours** —
you only need to attach the Supabase access token as `Authorization: Bearer <token>`
on every API call.

## Questions for you (Sol)

1. Are you OK moving writing submit/draft/feedback/history to backend API calls
   and dropping the direct Supabase `writing_*` access + `generateMockFeedback`?
2. Do you read the `writing_*` tables anywhere else we should know about
   (dashboard widgets, growth charts, library)?
3. For feedback UI: do you want backend to return data in the current Supabase
   shape (dimension/sentence rows) via an adapter, or will you map the
   `trait_scores`/`errors`/`annotations` shape on the FE?
4. Comparison report (progress vs previous): do you need a backend endpoint for
   this, or keep it FE-side for now?
5. Any blocker to attaching `Authorization: Bearer <supabase access token>` on
   backend calls?

## Out of scope here

Auth, profiles, problems, notifications, gamification, library, etc. — those are
separate decisions. This doc is **only about the writing feature**.
