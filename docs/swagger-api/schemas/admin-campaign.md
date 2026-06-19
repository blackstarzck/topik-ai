# Admin Campaign API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[CampaignAssignRequest](#campaignassignrequest)|object|
|[CampaignAuditEntry](#campaignauditentry)|object|
|[CampaignAuditLogResponse](#campaignauditlogresponse)|object|
|[CampaignContactInquiryItem](#campaigncontactinquiryitem)|object|
|[CampaignContactInquiryListResponse](#campaigncontactinquirylistresponse)|object|
|[CampaignContentEditRequest](#campaigncontenteditrequest)|object|
|[CampaignInvalidateRequest](#campaigninvalidaterequest)|object|
|[CampaignReviewer](#campaignreviewer)|object|
|[CampaignReviewerListResponse](#campaignreviewerlistresponse)|object|
|[CampaignSourceEditRequest](#campaignsourceeditrequest)|object|
|[CampaignStateTransitionRequest](#campaignstatetransitionrequest)|object|
|[CampaignStatsOverview](#campaignstatsoverview)|object|
|[CampaignSubmissionDetail](#campaignsubmissiondetail)|object|
|[CampaignSubmissionListItem](#campaignsubmissionlistitem)|object|
|[CampaignSubmissionListResponse](#campaignsubmissionlistresponse)|object|
|[CampaignSubmissionUserDetail](#campaignsubmissionuserdetail)|object|
|[CampaignTranslationRequest](#campaigntranslationrequest)|object|
|[CampaignUserListResponse](#campaignuserlistresponse)|object|
|[CampaignUserSummary](#campaignusersummary)|object|
|[CampaignWaitlistItem](#campaignwaitlistitem)|object|
|[CampaignWaitlistListResponse](#campaignwaitlistlistresponse)|object|
|[OkClaimResponse](#okclaimresponse)|object|
|[OkResponse](#okresponse)|object|
|[TaskEnqueuedResponse](#taskenqueuedresponse)|object|
|[TaskStatusResponse](#taskstatusresponse)|object|
|[WorkflowStateResponse](#workflowstateresponse)|object|

## CampaignAssignRequest

Admin request to assign or clear the reviewer on a submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|assignee_id|no|anyOf<string \| null>|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the reviewer to assign; null clears the assignee.|
|note|no|anyOf<string \| null>|-|-|["Reassigned to native reviewer."]|Optional note recorded with the assignment.|

## CampaignAuditEntry

One entry in a submission's audit log.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|integer|-|-|[42]|Primary key of the audit entry.|
|actor_email|yes|string|-|-|["reviewer@example.com"]|Email of the actor who performed the action.|
|actor_role|yes|anyOf<string \| null>|-|-|["content_reviewer"]|Role of the actor at the time of the action; null if unknown.|
|action|yes|string|-|-|["state_transition"]|Action identifier (e.g. state transition, source edit).|
|before|yes|anyOf<object<string, -> \| null>|-|-|[{"workflow_status":"content_review"}]|Snapshot of the affected fields before the action; null if not applicable.|
|after|yes|anyOf<object<string, -> \| null>|-|-|[{"workflow_status":"pdf_ready"}]|Snapshot of the affected fields after the action; null if not applicable.|
|note|yes|anyOf<string \| null>|-|-|["Approved after content review."]|Optional note recorded with the action; null if none.|
|at|yes|string|-|-|["2026-06-08T10:00:00Z"]|ISO-8601 UTC timestamp when the action occurred.|

## CampaignAuditLogResponse

Audit log entries for a submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignAuditEntry>|-|-|[[]]|Audit entries, typically newest-first.|

## CampaignContactInquiryItem

One row in the admin contact-inquiries list.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|integer|-|-|[42]|Primary key of the contact inquiry.|
|name|yes|string|-|-|["Nguyen Van A"]|Name supplied by the person who submitted the inquiry.|
|email|yes|string|-|-|["learner@example.com"]|Contact email (display projection of the stored value).|
|affiliation|yes|anyOf<string \| null>|-|-|["Hanoi University"]|Organization/affiliation supplied by the contact; null if omitted.|
|inquiry_type|yes|string|-|-|["General inquiry"]|Localized inquiry-type label from the contact modal, stored as free text.|
|message|yes|string|-|-|["I would like to know more about the campaign."]|Free-text message body of the inquiry.|
|locale|yes|anyOf<string \| null>|-|-|["vi"]|Locale the inquiry was submitted from; null if unknown.|
|source|yes|string|-|-|["contact_modal"]|Capture source of the inquiry (free text).|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the inquiry was created.|

## CampaignContactInquiryListResponse

Paginated list of contact inquiries for the admin dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignContactInquiryItem>|-|-|[[]]|Page of contact-inquiry rows.|
|total|yes|integer|-|-|[12]|Total number of contact inquiries matching the query.|

## CampaignContentEditRequest

KR content reviewer overlays edits on top of the AI draft. The
body is a JSON object whose keys match the report sections — see
plan-09 §4 for the canonical key list.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|kr_content_edit|yes|object<string, ->|-|-|[{"grammar":"조사 사용에 주의하세요.","summary":"구조가 명확합니다."}]|Edit overlay keyed by report section (see plan-09 §4 for the canonical keys).|
|note|no|anyOf<string \| null>|-|-|["Tightened the grammar section."]|Optional reviewer note recorded with the edit.|

## CampaignInvalidateRequest

Admin request to mark a submission invalid.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|reason|yes|string|-|-|["Answer image was unreadable."]|Reason the submission is being marked invalid.|

## CampaignReviewer

One assignable reviewer for the assign/claim dropdown.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|yes|string|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the reviewer's user profile.|
|email|yes|string|-|-|["reviewer@example.com"]|Reviewer email (may include reserved/dev domains such as .local).|
|display_name|yes|string|-|-|["Reviewer Kim"]|Reviewer display name shown in the assign dropdown.|
|roles|yes|array<string>|-|-|[["content_reviewer","translation_reviewer"]]|Roles granted to the reviewer (e.g. content/translation reviewer).|

## CampaignReviewerListResponse

List of assignable reviewers for the admin dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignReviewer>|-|-|[[]]|All assignable reviewers.|

## CampaignSourceEditRequest

Reviewer correction of the original source fields on a submission.

All fields optional — only the keys explicitly present in the request body
are applied (partial update via ``model_fields_set``), so a client can edit
just the answer text without clearing the question/passage. Editing the
applicant's submitted answer is sensitive, so the route audit-logs a
before/after snapshot.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_topic_text|no|anyOf<string \| null>|-|-|["환경 보호의 중요성에 대해 쓰십시오."]|Corrected Q53/Q54 essay topic; omit to leave unchanged.|
|passage_context|no|anyOf<string \| null>|-|-|["다음 글을 읽고 200~300자로 쓰십시오."]|Corrected reading passage/prompt context; omit to leave unchanged.|
|text|no|anyOf<string \| null>|-|-|["저는 매일 아침 운동을 합니다."]|Corrected applicant answer text; omit to leave unchanged.|
|user_answers|no|anyOf<array<string> \| null>|-|-|[["감사합니다"]]|Corrected Q51/Q52 per-blank answers (max 3); omit to leave unchanged.|
|note|no|anyOf<string \| null>|-|-|["Fixed OCR transcription error."]|Optional reviewer note recorded with the source edit.|
|reviewer_tag|no|anyOf<string \| null>|-|-|[null]|Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label.|

## CampaignStateTransitionRequest

Admin request to move a submission to a new workflow status.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|target_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["pdf_ready"]|Workflow status to transition the submission to.|
|note|no|anyOf<string \| null>|-|-|["Approved after content review."]|Optional reviewer note recorded with the transition.|

## CampaignStatsOverview

Aggregate campaign metrics for the admin overview dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|total_submissions|yes|integer|-|-|[350]|Total number of submissions in the campaign.|
|by_status|yes|object<string, integer>|-|-|[{"delivered":300,"submitted":10}]|Submission counts keyed by workflow status.|
|by_task_type|yes|object<string, integer>|-|-|[{"Q51":40,"Q52":40,"Q53":130,"Q54":140}]|Submission counts keyed by task type.|
|sla_at_risk|yes|integer|-|-|[5]|Number of submissions within 6h of their due_at.|
|sla_breached|yes|integer|-|-|[2]|Number of submissions past their due_at without delivery.|
|total_users|yes|integer|-|-|[120]|Total number of distinct users in the campaign.|

## CampaignSubmissionDetail

Full read-side projection of a submission used by the eval
dashboard and by the PDF/email render pipeline.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f"]|UUID of the submission.|
|user|yes|[CampaignSubmissionUserDetail](./admin-campaign.md#campaignsubmissionuserdetail)|-|-|-|Embedded applicant identity.|
|task_type|yes|enum<"Q51" \| "Q52" \| "Q53" \| "Q54">|"Q51", "Q52", "Q53", "Q54"|-|["Q53"]|TOPIK writing task. One of: 'Q51', 'Q52', 'Q53', 'Q54'.|
|text|yes|string|-|-|["저는 매일 아침 운동을 합니다."]|The applicant's written answer.|
|passage_context|yes|string|-|-|["다음 글을 읽고 200~300자로 쓰십시오."]|Reading passage or prompt context the answer responds to.|
|question_topic_text|yes|anyOf<string \| null>|-|-|["환경 보호의 중요성에 대해 쓰십시오."]|Q53/Q54 essay topic/instruction; null for Q51/Q52.|
|user_answers|yes|anyOf<array<string> \| null>|-|-|[["감사합니다"]]|Q51/Q52 per-blank answers; null for Q53/Q54.|
|provided_question_ids|yes|anyOf<array<string> \| null>|-|-|[["a","b"]]|Q51/Q52 answered blank ids; null for Q53/Q54.|
|provided_question_texts|yes|anyOf<array<ProvidedQuestion> \| null>|-|-|[[{"id":"a","text":"( ㉠ )에 들어갈 말을 쓰십시오."}]]|Q51/Q52 prompt text per blank; null for Q53/Q54.|
|image_url|yes|anyOf<string \| null>|-|-|["https://cdn.example.com/uploads/answer-1.jpg"]|Single uploaded answer image URL; null if none.|
|image_urls|no|anyOf<array<string> \| null>|-|-|[["https://cdn.example.com/uploads/answer-1.jpg"]]|Multi-image answer URLs (up to 3); null if none.|
|ocr_text|no|anyOf<string \| null>|-|-|["저는 매일 아침 운동을 합니다."]|OCR-extracted text from the uploaded image(s); null if not run.|
|feedback|yes|anyOf<object<string, -> \| null>|-|-|[{"summary":"Good structure, minor grammar issues."}]|Structured AI scoring feedback; null until drafted.|
|total_score|yes|anyOf<number \| null>|-|-|[42.5]|Awarded score; null until scoring completes.|
|max_score|yes|anyOf<number \| null>|-|-|[50]|Maximum possible score for this task type.|
|error_message|yes|anyOf<string \| null>|-|-|[null]|Human-readable error if scoring failed; null otherwise.|
|reviewer_tag|no|anyOf<string \| null>|-|-|[null]|Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label.|
|kr_content_edit|yes|anyOf<object<string, -> \| null>|-|-|[{"summary":"구조가 명확합니다."}]|KR reviewer's edit overlay on the AI draft, keyed by report section; null if unedited.|
|kr_reviewed_by|yes|anyOf<string \| null>|-|-|["reviewer@example.com"]|Email of the KR content reviewer; null if not yet reviewed.|
|kr_reviewed_at|yes|anyOf<string \| null>|-|-|["2026-06-08T10:00:00Z"]|ISO-8601 UTC timestamp of KR content review; null if not reviewed.|
|kr_feedback|yes|anyOf<string \| null>|-|-|["전반적으로 잘 작성되었습니다."]|Finalized Korean feedback text; null if not produced.|
|vn_translation|yes|anyOf<string \| null>|-|-|["Bài viết nhìn chung tốt."]|Vietnamese translation of the feedback; null if not produced.|
|vn_reviewed_by|yes|anyOf<string \| null>|-|-|["reviewer@example.com"]|Email of the VN translation reviewer; null if not reviewed.|
|vn_reviewed_at|yes|anyOf<string \| null>|-|-|["2026-06-08T11:00:00Z"]|ISO-8601 UTC timestamp of VN translation review; null if not reviewed.|
|workflow_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["content_review"]|Current workflow state of the submission.|
|assignee_id|yes|anyOf<string \| null>|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the reviewer currently assigned; null if unassigned.|
|due_at|yes|string|-|-|["2026-06-09T09:30:00Z"]|ISO-8601 UTC deadline by which the result is promised.|
|submitted_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the submission was received.|
|is_duplicate|yes|boolean|-|-|[false]|True if this submission was deduplicated against an existing one.|
|invalid_reason|yes|anyOf<string \| null>|-|-|[null]|Reason the submission was marked invalid; null if valid.|
|pdf_url|yes|anyOf<string \| null>|-|-|["https://cdn.example.com/pdf/result-1.pdf"]|URL of the generated result PDF; null until generated.|
|pdf_filename|no|anyOf<string \| null>|-|-|["topik-result-2026-06-08.pdf"]|Filename of the generated result PDF; null until generated.|
|pdf_generated_at|yes|anyOf<string \| null>|-|-|["2026-06-08T11:30:00Z"]|ISO-8601 UTC timestamp when the PDF was generated; null until generated.|
|email_sent_at|yes|anyOf<string \| null>|-|-|["2026-06-08T11:35:00Z"]|ISO-8601 UTC timestamp when the result email was sent; null if not sent.|
|email_attempts|yes|integer|-|-|[1]|Number of result-email delivery attempts made.|
|email_last_error|yes|anyOf<string \| null>|-|-|[null]|Last email delivery error message; null if none.|
|source_channel|yes|anyOf<string \| null>|-|-|["facebook_group"]|Acquisition channel the applicant arrived from; null if unknown.|
|community_group|yes|anyOf<string \| null>|-|-|["TOPIK Study VN"]|Referring community/group name; null if none.|
|community_post_url|yes|anyOf<string \| null>|-|-|["https://facebook.com/groups/topikvn/posts/123"]|URL of the referring community post; null if none.|
|staff_owner|yes|anyOf<string \| null>|-|-|["minh"]|Staff member who owns/referred this lead; null if none.|

## CampaignSubmissionListItem

One submission row in the admin per-user or cross-user queue.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f"]|UUID of the submission.|
|task_type|yes|enum<"Q51" \| "Q52" \| "Q53" \| "Q54">|"Q51", "Q52", "Q53", "Q54"|-|["Q53"]|TOPIK writing task. One of: 'Q51', 'Q52', 'Q53', 'Q54'.|
|workflow_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["ai_drafted"]|Current workflow state of the submission.|
|total_score|yes|anyOf<number \| null>|-|-|[42.5]|Awarded score; null until scoring completes.|
|max_score|yes|anyOf<number \| null>|-|-|[50]|Maximum possible score for this task type.|
|submitted_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the submission was received.|
|due_at|yes|string|-|-|["2026-06-09T09:30:00Z"]|ISO-8601 UTC deadline by which the result is promised.|
|sla_risk|yes|boolean|-|-|[false]|True if this submission is within 6h of its due_at.|
|is_duplicate|yes|boolean|-|-|[false]|True if this submission was deduplicated against an existing one.|
|reviewer_tag|no|anyOf<string \| null>|-|-|[null]|Reviewer flag/note (e.g. suspected AI-generated answer); shown as a label.|
|email|no|anyOf<string \| null>|-|-|["learner@example.com"]|Applicant email; present on the cross-user queue, null on the per-user list.|
|display_name|no|anyOf<string \| null>|-|-|["Nguyen Van A"]|Applicant display name; present on the cross-user queue, null on the per-user list.|

## CampaignSubmissionListResponse

Paginated list of submissions for the admin dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignSubmissionListItem>|-|-|[[]]|Page of submission rows.|
|total|yes|integer|-|-|[350]|Total number of submissions matching the query (across all pages).|

## CampaignSubmissionUserDetail

Embedded applicant identity within a submission detail.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the user profile.|
|email|yes|string|-|-|["learner@example.com"]|Applicant email (display projection of the stored value).|
|display_name|yes|string|-|-|["Nguyen Van A"]|Applicant display name.|
|language|yes|string|-|-|["vi"]|Stored preferred language (free-form; typically 'ko', 'vi', 'en').|

## CampaignTranslationRequest

KR/VN finalized feedback and translation submitted by a reviewer.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|kr_feedback|no|anyOf<string \| null>|-|-|["전반적으로 잘 작성되었습니다."]|Finalized Korean feedback text; omit to leave unchanged.|
|vn_translation|no|anyOf<string \| null>|-|-|["Bài viết nhìn chung tốt."]|Vietnamese translation of the feedback; omit to leave unchanged.|
|note|no|anyOf<string \| null>|-|-|["Reviewed by native speaker."]|Optional reviewer note recorded with the translation.|

## CampaignUserListResponse

Paginated list of campaign users for the admin dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignUserSummary>|-|-|[[]]|Page of user summary rows.|
|total|yes|integer|-|-|[120]|Total number of users matching the query (across all pages).|

## CampaignUserSummary

One row in GET /api/admin/campaign/users.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|yes|string|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the user profile.|
|email|yes|string|-|-|["learner@example.com"]|User email (display projection of the stored value).|
|display_name|yes|string|-|-|["Nguyen Van A"]|User display name.|
|language|yes|string|-|-|["vi"]|Stored preferred language (free-form; typically 'ko', 'vi', 'en').|
|submission_count|yes|integer|-|-|[3]|Number of submissions made by this user.|
|latest_submitted_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp of the user's most recent submission.|
|latest_workflow_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["content_review"]|Workflow status of the user's most recent submission.|
|sla_risk|yes|boolean|-|-|[true]|True if any submission for this user is within 6h of its due_at.|

## CampaignWaitlistItem

One row in the admin waitlist list.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|integer|-|-|[42]|Primary key of the waitlist entry.|
|email|yes|string|-|-|["learner@example.com"]|Waitlist email (display projection of the stored value).|
|locale|yes|anyOf<string \| null>|-|-|["vi"]|Locale the signup came from; null if unknown.|
|source|yes|string|-|-|["landing_hero"]|Capture source of the signup (free text).|
|pathname|yes|anyOf<string \| null>|-|-|["/campaign"]|Page path where the signup occurred; null if not captured.|
|referrer|yes|anyOf<string \| null>|-|-|["https://facebook.com/"]|HTTP referrer at signup time; null if not captured.|
|user_agent|yes|anyOf<string \| null>|-|-|["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"]|Browser user-agent string at signup time; null if not captured.|
|submission_count|yes|integer|-|-|[1]|Number of times this email signed up (deduplicated upsert counter).|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the entry was first created.|
|updated_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the entry was last updated.|

## CampaignWaitlistListResponse

Paginated list of waitlist entries for the admin dashboard.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<CampaignWaitlistItem>|-|-|[[]]|Page of waitlist rows.|
|total|yes|integer|-|-|[500]|Total number of waitlist entries matching the query.|

## OkClaimResponse

Self-claim acknowledgement carrying the new assignee id.

셀프 클레임 성공 응답 (새 담당자 ID 포함).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|ok|yes|boolean|-|-|[true]|True when the claim succeeded.|
|assignee_id|yes|string|-|-|["3f7c1e2a-0b4d-4f9a-9c1e-2a0b4d4f9a9c"]|UUID of the reviewer who now owns the submission (the caller).|

## OkResponse

Generic success acknowledgement for mutation endpoints.

변경 작업 성공 응답.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|ok|yes|boolean|-|-|[true]|True when the operation succeeded.|

## TaskEnqueuedResponse

ARQ enqueue acknowledgement returned by the 202 task endpoints
(PDF render, scoring, email send, resend).

백그라운드 작업 등록 응답 (PDF/채점/메일).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|task_id|yes|string|-|-|["job-abc123"]|ARQ job id; poll GET /tasks/{task_id}/status with it.|
|status|yes|string|-|-|["queued"]|Initial enqueue status (always 'queued').|

## TaskStatusResponse

Current ARQ job status from the task-status poll endpoint. ``result``
is present only once the job is complete; ``error`` only if fetching the
completed job's result failed.

백그라운드 작업 상태 조회 응답.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|task_id|yes|string|-|-|["job-abc123"]|The ARQ job id that was polled.|
|status|yes|string|-|-|["complete"]|ARQ JobStatus value (e.g. deferred/queued/in_progress/complete/not_found).|
|result|no|anyOf<object<string, -> \| null>|-|-|[{}]|Worker return value; present only when status is 'complete'.|
|error|no|anyOf<string \| null>|-|-|[null]|Truncated error string if fetching a completed job's result raised.|

## WorkflowStateResponse

New workflow status after a state transition.

상태 전환 후의 새 워크플로 상태.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|workflow_status|yes|string|-|-|["in_review"]|The submission's workflow status after the transition.|
