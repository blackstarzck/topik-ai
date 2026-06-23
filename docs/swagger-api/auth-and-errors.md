# Authentication, Headers, And Error Codes

[Back to Swagger API README](./README.md)

## Authentication Schemes

|Name|Type|In|Header|Scheme|Description|
|---|---|---|---|---|---|
|BearerAuth|http|-|Authorization: Bearer <jwt>|bearer|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|
|CampaignApiKey|apiKey|header|X-API-Key|-|Shared campaign API key for the /api/external/campaign/* endpoints.|

## Practical Header Examples

Bearer-authenticated endpoints:
```http
Authorization: Bearer <access_token>
```
External campaign endpoints:
```http
X-API-Key: <campaign_api_key>
```
JSON request endpoints:
```http
Content-Type: application/json
```

## Response And Error Code Index

|Status|Descriptions Seen In Swagger|
|---|---|
|200|Successful Response<br>Submission deleted<br>Assignee updated<br>Attachment image (or PDF) bytes<br>Submission claimed by caller<br>Edit saved<br>Submission invalidated<br>PDF file as an attachment<br>Source fields updated<br>New workflow status after transition<br>Translation saved<br>Current ARQ job status (with result when complete)<br>Eval run records from the SQLite eval database, optionally filtered by pipeline.<br>Individual test case results for the eval run, filtered by status.<br>Aggregate statistics for the eval run: pass rate, average score, distribution.<br>All admin reviews submitted for the target.<br>The created or updated review (upsert).<br>The current admin's review for the target, or `{}` if none submitted yet.<br>Run started. Returns the run_id to poll for status.<br>Current run status. Values: running, completed, failed, error.<br>High-level aggregate stats for the eval dashboard.<br>Full submission detail: essay text, task metadata, section scores, and feedback.<br>Paginated list of users who have at least one graded submission.<br>All graded writing submissions for the user, newest first.<br>Authenticated. Returns the user's JWT, refresh token, and profile.<br>Current status. `feedback`/scores populate once scored.<br>Audio binary stream (audio/mpeg).<br>Bookmark toggled; returns the new state.<br>Paginated submission history matching the filters.<br>Available question types for the requested TOPIK level.<br>Session created with all problems generated.<br>Current session state with its problems.<br>All submissions plus an aggregate summary for the session.<br>Answer graded; returns correctness, explanation, script, and XP.<br>Server-Sent Events stream (`text/event-stream`). Named events: `meta` (session_id + total_questions, sent first), `problem` (one per generated problem, WITHOUT audio so the FE renders the question immediately), `audio` (follow-up per problem carrying `audio_url` once TTS finishes; `audio_url` may be null on TTS failure), `error` (per-problem generation failure/timeout — stream continues), and `done` (terminal marker with `total_generated`). The `done` event always closes the stream.<br>New bookmark state for the problem.<br>AI-generated reading comprehension problem.<br>Paginated reading submission history, newest first.<br>All supported reading question types with labels and ranges.<br>Session created with all problems generated up front.<br>Current session state including all problems and progress index.<br>Final scored results for the session.<br>Answer graded within the session; returns correctness and progress.<br>Server-Sent Events stream (`text/event-stream`). Named events:<br>- `event: meta` — `{session_id, total_questions, status}` sent first.<br>- `event: problem` — one per generated problem: `{index, id, question_type, difficulty, passage, question, choices}`.<br>- `event: error` — `{index, message}` when a single problem fails or times out (stream continues with the next index).<br>- `event: done` — terminal marker: `{session_id, total_generated}`.<br>Answer graded; returns correctness, correct answer, explanation and XP.<br>Server-Sent Events stream (`text/event-stream`). Each event is `data: <partial text>` with embedded newlines escaped as `\n`; `: keep-alive` comments are sent periodically; the stream ends with `data: [DONE]`. Errors are delivered in-stream as `data: {"error": "..."}` before `[DONE]`.<br>PDF file download (feedback-{submission_id}.pdf).<br>Generated rich-metadata problem (review_status='검수 필요'); the body keys match the reference schema for the requested item_number.<br>Paginated submission history, newest first.<br>Submission deleted.<br>Draft saved; returns draft ID and character count.<br>Paginated cross-type list of serviceable writing questions.<br>Paginated list of rich-metadata questions for the item type.|
|201|Inquiry stored (append-only).<br>Survey response stored (append-only).<br>Stored. Use `url` as `image_url` on POST /submissions.<br>Created or refreshed. Idempotent per email.<br>Successful Response (admin user created — AdminUserResponse body).|
|202|Email job queued<br>Render job queued<br>Resend job queued<br>Scoring job queued<br>Accepted. Poll GET /submissions/{id} for status.<br>Submission accepted and enqueued for async evaluation.|
|204|Successful Response — no response body (admin user soft-deleted; admin password reset).|
|400|Invalid storage key prefix<br>Campaign window is closed (detail `CAMPAIGN_WINDOW_CLOSED`).<br>Empty upload (zero bytes).<br>Invalid bank audio path (bank_id not a valid UUID).<br>Invalid audio path (session_id/filename not a valid UUID).<br>Invalid request body (validation error).<br>Invalid request body, or question_index out of range.<br>Invalid question_index for this session.<br>Invalid submission ID format, or feedback not yet available.<br>Invalid submission ID format.<br>Guard violation (e.g. cannot remove/delete the last super_admin or self).|
|401|Missing or invalid admin JWT<br>Missing or invalid JWT.<br>Invalid email or password.<br>Missing or invalid X-API-Key.<br>Missing/invalid JWT, or session not owned by the caller.<br>Missing/invalid JWT, or not authorized to bookmark this problem.<br>Missing/invalid JWT, or not authorized for this session.|
|403|Caller lacks a campaign role<br>Caller lacks ops_admin/dev_admin role<br>Caller lacks ops_admin role<br>Caller lacks kr_content/vn_translator/ops_admin role<br>Caller lacks kr_content/ops_admin role<br>Caller lacks an email-capable campaign role<br>Caller lacks a PDF-capable campaign role<br>Caller lacks a scoring-capable campaign role<br>Caller lacks kr_content/ops_admin/dev_admin role<br>Caller lacks vn_translator/ops_admin role, or a vn_translator attempted to edit kr_feedback<br>Caller lacks the `admin` role.<br>Account not in EVAL_ADMIN_EMAILS allowlist, or missing the DB `admin` role.<br>Invalid bank audio token.<br>Invalid or expired audio token.<br>Caller lacks the required role (admin / super_admin).|
|404|Submission not found<br>Submission not found, index out of range, or empty object<br>Submission not found, PDF not generated, or empty object<br>User not found<br>Dataset not found or empty.<br>Run not found or expired (Redis TTL is 2 hours).<br>Submission not found.<br>No submission exists with that id.<br>Bank audio not found in storage.<br>Audio file not found in storage.<br>Session not found.<br>Reading problem not found.<br>Reading session not found.<br>Submission not found (or not owned by the user).<br>No active writing task found for the given task_type.<br>User not found<br>Target user not found|
|409|PDF not generated yet (POST /pdf first), or an email job is already in progress<br>No PDF to attach<br>Submission is not in 'submitted' status<br>Invalid state transition<br>Email already registered|
|413|File exceeds the 20 MB limit.|
|415|Unsupported file type, or file content does not match the declared Content-Type (magic-byte check failed).|
|422|Validation Error<br>Invalid submission UUID<br>Invalid submission or assignee UUID<br>Invalid UUID, no fields to update, or empty text<br>Invalid pagination parameters.<br>Invalid status filter or pagination parameters.<br>Invalid target_type.<br>Invalid target_type or malformed review body.<br>Invalid `pipeline` or `mode` (not in allowlist), or malformed `dataset`/`case_filter`.<br>Invalid submission_id (not a UUID).<br>Invalid user_id (not a UUID) or invalid pagination parameters.<br>Request body fails validation.<br>Request body fails Pydantic validation, or task-specific rules fail: Q51/Q52 require exactly 3 each of user_answers, provided_question_texts and provided_question_ids; Q53/Q54 require an image (image_url/image_urls) or text >= 100 chars.<br>submission_id is not a valid UUID.<br>Request body fails validation (e.g. bad email).<br>Missing required `token` query param.<br>Invalid query params (e.g. limit out of 1-100, negative offset).<br>Invalid query param (level outside 1-6).<br>Invalid request body (question_type / difficulty / lang).<br>Invalid pagination params (limit 1-100, offset >= 0).<br>Invalid request body (target_level / question_types / question_count).<br>Invalid request body (question_index / user_answer).<br>Invalid request body (problem_id / user_answer).<br>Weak password or invalid role<br>Validation error (weak password / invalid role)<br>Invalid item_number filter (must be 51\|52\|53\|54)<br>Invalid task_type (must be 51\|52\|53\|54)|
|429|Rate limit exceeded (5 requests/minute).<br>Rate limit exceeded (30 requests/minute).<br>Rate limit exceeded (10 requests/minute).<br>Rate limit exceeded (20 requests/minute).|
|500|AI prompt generation failed.|
|502|Could not fetch image from storage<br>Could not fetch PDF from storage<br>Storage backend (SeaweedFS) upload failed.<br>AI problem generation failed (LLM unavailable).|
|503|ARQ enqueue failed<br>Redis unavailable.|

## Per-Endpoint Auth Summary

|Method|Path|Auth/Header|
|---|---|---|
|`GET`|`/api/admin/campaign/contact-inquiries`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/reviewers`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/stats/overview`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/submissions`|BearerAuth: `Authorization: Bearer <jwt>`|
|`DELETE`|`/api/admin/campaign/submissions/{submission_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/submissions/{submission_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/assign`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/attachments/{idx}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/audit-log`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/claim`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/content-edit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/email`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/invalidate`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/pdf`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/pdf/download`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/resend-email`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/score`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/source-edit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/state`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/translation`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/tasks/{task_id}/status`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/users`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/users/{email}/submissions`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/campaign/waitlist`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/datasets`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/results`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/stats`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/eval/reviews/{target_type}/{target_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}/my`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/admin/eval/run`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/run/{run_id}/status`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/stats/overview`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/submissions/{submission_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/users`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/eval/users/{user_id}/submissions`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/admin/users`|BearerAuth: `Authorization: Bearer <jwt>` (role: `admin`)|
|`POST`|`/api/admin/users`|BearerAuth: `Authorization: Bearer <jwt>` (role: `super_admin`)|
|`DELETE`|`/api/admin/users/{user_id}`|BearerAuth: `Authorization: Bearer <jwt>` (role: `super_admin`)|
|`GET`|`/api/admin/users/{user_id}`|BearerAuth: `Authorization: Bearer <jwt>` (role: `admin`)|
|`PATCH`|`/api/admin/users/{user_id}`|BearerAuth: `Authorization: Bearer <jwt>` (role: `super_admin`)|
|`POST`|`/api/admin/users/{user_id}/password`|BearerAuth: `Authorization: Bearer <jwt>` (role: `super_admin`)|
|`POST`|`/api/eval/auth/login`|none declared|
|`GET`|`/api/evaluation/{submission_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/evaluation/{submission_id}/feedback`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/external/campaign/contact`|CampaignApiKey: `X-API-Key: <api_key>`|
|`POST`|`/api/external/campaign/follow-up`|CampaignApiKey: `X-API-Key: <api_key>`|
|`POST`|`/api/external/campaign/submissions`|CampaignApiKey: `X-API-Key: <api_key>`|
|`GET`|`/api/external/campaign/submissions/{submission_id}`|CampaignApiKey: `X-API-Key: <api_key>`|
|`POST`|`/api/external/campaign/uploads`|CampaignApiKey: `X-API-Key: <api_key>`|
|`POST`|`/api/external/campaign/waitlist`|CampaignApiKey: `X-API-Key: <api_key>`|
|`GET`|`/api/listening/audio-bank/{filename}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/listening/audio/{session_id}/{filename}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/listening/bookmark/{problem_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/listening/history`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/listening/question-types`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/listening/session`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/listening/session/{session_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/listening/session/{session_id}/results`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/listening/session/{session_id}/submit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/listening/session/stream`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/reading/bookmark/{problem_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/reading/generate`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/reading/history`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/reading/question-types`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/reading/session/{session_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/reading/session/{session_id}/results`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/reading/session/{session_id}/submit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/reading/session/stream`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/reading/submit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/writing/chat`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/writing/feedback/{submission_id}/export-pdf`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/writing/generate`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/writing/history`|BearerAuth: `Authorization: Bearer <jwt>`|
|`DELETE`|`/api/writing/history/{submission_id}`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/writing/save-draft`|BearerAuth: `Authorization: Bearer <jwt>`|
|`POST`|`/api/writing/submit`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/writing/tasks`|BearerAuth: `Authorization: Bearer <jwt>`|
|`GET`|`/api/writing/tasks/{task_type}`|BearerAuth: `Authorization: Bearer <jwt>`|
