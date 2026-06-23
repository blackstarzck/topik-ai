# Admin Campaign API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/admin-campaign.md)

Internal campaign reviewer dashboard endpoints. Not for learner UI.

Swagger tag description:

**Admin Campaign Dashboard / 관리자 캠페인 대시보드**

Internal reviewer dashboard: browse the submission queue, edit source/content/translation, assign and claim submissions, trigger AI scoring, and generate result PDFs and emails.

내부 검토자 대시보드: 제출 큐 조회, 원문·콘텐츠·번역 편집, 제출물 할당·클레임, AI 채점 실행, 결과 PDF·이메일 생성.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`GET`|`/api/admin/campaign/contact-inquiries`|List contact-us inquiries|
|`GET`|`/api/admin/campaign/reviewers`|List campaign reviewers|
|`GET`|`/api/admin/campaign/stats/overview`|Get campaign stats overview|
|`GET`|`/api/admin/campaign/submissions`|List submission review queue|
|`DELETE`|`/api/admin/campaign/submissions/{submission_id}`|Delete submission|
|`GET`|`/api/admin/campaign/submissions/{submission_id}`|Get submission detail|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/assign`|Assign submission to a reviewer|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/attachments/{idx}`|Download answer attachment|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/audit-log`|Get submission audit log|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/claim`|Self-claim submission|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/content-edit`|Save KR content edit|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/email`|Enqueue result email|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/invalidate`|Force-invalidate submission|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/pdf`|Enqueue PDF render|
|`GET`|`/api/admin/campaign/submissions/{submission_id}/pdf/download`|Download generated PDF|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/resend-email`|Re-enqueue result email|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/score`|Enqueue AI scoring|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/source-edit`|Edit original source fields|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/state`|Transition submission workflow state|
|`POST`|`/api/admin/campaign/submissions/{submission_id}/translation`|Save VN translation / reviewer feedback|
|`GET`|`/api/admin/campaign/tasks/{task_id}/status`|Poll background task status|
|`GET`|`/api/admin/campaign/users`|List campaign users|
|`GET`|`/api/admin/campaign/users/{email}/submissions`|List a user's submissions|
|`GET`|`/api/admin/campaign/waitlist`|List waitlist signups|

## Endpoint Details

### GET /api/admin/campaign/contact-inquiries

Summary: List contact-us inquiries
Operation ID: `list_contact_inquiries_api_admin_campaign_contact_inquiries_get`

Description:

List leads captured from the landing-page "Contact us" form.

랜딩 페이지 문의(Contact us) 리드 목록.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignContactInquiryListResponse](../schemas/admin-campaign.md#campaigncontactinquirylistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/admin/campaign/reviewers

Summary: List campaign reviewers
Operation ID: `list_reviewers_api_admin_campaign_reviewers_get`

Description:

Users in the campaign role allowlists, for the assign/claim dropdown.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignReviewerListResponse](../schemas/admin-campaign.md#campaignreviewerlistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role

### GET /api/admin/campaign/stats/overview

Summary: Get campaign stats overview
Operation ID: `stats_overview_api_admin_campaign_stats_overview_get`

Description:

Aggregate campaign metrics: totals, status/type breakdowns, SLA risk.

캠페인 통계 요약 (총계, 상태/유형 분포, SLA 위험).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignStatsOverview](../schemas/admin-campaign.md#campaignstatsoverview)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role

### GET /api/admin/campaign/submissions

Summary: List submission review queue
Operation ID: `list_submissions_queue_api_admin_campaign_submissions_get`

Description:

Flat cross-user submission queue, filterable by status and task type.

상태/유형 필터가 가능한 전체 제출 검토 큐.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|status|query|no|anyOf<string \| null>|-|-|
|task_type|query|no|anyOf<string \| null>|-|-|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignSubmissionListResponse](../schemas/admin-campaign.md#campaignsubmissionlistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### DELETE /api/admin/campaign/submissions/{submission_id}

Summary: Delete submission
Operation ID: `delete_submission_api_admin_campaign_submissions__submission_id__delete`

Description:

Hard-delete a submission. Audit-log rows cascade away with it
(FK ondelete=CASCADE). Restricted to ops/dev admins.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Submission deleted
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks ops_admin/dev_admin role
- `404` Submission not found
- `422` Invalid submission UUID

### GET /api/admin/campaign/submissions/{submission_id}

Summary: Get submission detail
Operation ID: `get_submission_api_admin_campaign_submissions__submission_id__get`

Description:

Get the full review detail for a single submission.

단일 제출의 전체 검토 상세 정보.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignSubmissionDetail](../schemas/admin-campaign.md#campaignsubmissiondetail)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `404` Submission not found
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/assign

Summary: Assign submission to a reviewer
Operation ID: `assign_api_admin_campaign_submissions__submission_id__assign_post`

Description:

Assign (or clear) the reviewer for a submission. ops_admin only.

제출 담당 검토자 지정/해제 (운영자 전용).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignAssignRequest](../schemas/admin-campaign.md#campaignassignrequest)|-|

Responses:
- `200` Assignee updated
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks ops_admin role
- `404` Submission not found
- `422` Invalid submission or assignee UUID

### GET /api/admin/campaign/submissions/{submission_id}/attachments/{idx}

Summary: Download answer attachment
Operation ID: `get_attachment_api_admin_campaign_submissions__submission_id__attachments__idx__get`

Description:

Proxy an uploaded answer image through the API so the dashboard can render it.

The raw SeaweedFS URL is internal infra; we proxy behind campaign-role auth.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|
|idx|path|yes|integer|-|-|

Request body:
- None declared.

Responses:
- `200` Attachment image (or PDF) bytes
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|-|-|
|application/octet-stream|-|-|
- `400` Invalid storage key prefix
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `404` Submission not found, index out of range, or empty object
- `422` Invalid submission UUID
- `502` Could not fetch image from storage

### GET /api/admin/campaign/submissions/{submission_id}/audit-log

Summary: Get submission audit log
Operation ID: `get_audit_log_api_admin_campaign_submissions__submission_id__audit_log_get`

Description:

Return the recent audit-log entries for a submission.

제출의 최근 감사 로그 항목.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignAuditLogResponse](../schemas/admin-campaign.md#campaignauditlogresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/claim

Summary: Self-claim submission
Operation ID: `claim_api_admin_campaign_submissions__submission_id__claim_post`

Description:

Self-claim: assign the submission to the calling reviewer.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Submission claimed by caller
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkClaimResponse](../schemas/admin-campaign.md#okclaimresponse)|{"ok":true,"assignee_id":"3f...uuid"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks kr_content/vn_translator/ops_admin role
- `404` Submission not found
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/content-edit

Summary: Save KR content edit
Operation ID: `save_content_edit_api_admin_campaign_submissions__submission_id__content_edit_post`

Description:

Save the KR reviewer's edited Korean content for a submission.

KR 검토자가 수정한 한국어 콘텐츠 저장.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignContentEditRequest](../schemas/admin-campaign.md#campaigncontenteditrequest)|-|

Responses:
- `200` Edit saved
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks kr_content/ops_admin role
- `404` Submission not found
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/email

Summary: Enqueue result email
Operation ID: `request_email_api_admin_campaign_submissions__submission_id__email_post`

Description:

Enqueue an ARQ job to email the generated PDF report to the applicant.

생성된 PDF 리포트를 응시자에게 메일로 발송하는 작업을 큐에 등록.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `202` Email job queued
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse)|{"task_id":"email:job-abc123","status":"queued"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks an email-capable campaign role
- `404` Submission not found
- `409` PDF not generated yet (POST /pdf first), or an email job is already in progress
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/invalidate

Summary: Force-invalidate submission
Operation ID: `invalidate_api_admin_campaign_submissions__submission_id__invalidate_post`

Description:

Force a submission into the invalid state with a reason. ops/dev only.

제출을 사유와 함께 무효 처리 (운영/개발자 전용).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignInvalidateRequest](../schemas/admin-campaign.md#campaigninvalidaterequest)|-|

Responses:
- `200` Submission invalidated
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks ops_admin/dev_admin role
- `404` Submission not found
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/pdf

Summary: Enqueue PDF render
Operation ID: `request_pdf_api_admin_campaign_submissions__submission_id__pdf_post`

Description:

Enqueue an ARQ job to render the submission's report PDF.

제출 리포트 PDF 렌더링 작업을 큐에 등록.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `202` Render job queued
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse)|{"task_id":"job-abc123","status":"queued"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a PDF-capable campaign role
- `404` Submission not found
- `422` Invalid submission UUID
- `503` ARQ enqueue failed

### GET /api/admin/campaign/submissions/{submission_id}/pdf/download

Summary: Download generated PDF
Operation ID: `download_pdf_api_admin_campaign_submissions__submission_id__pdf_download_get`

Description:

Proxy the generated PDF through the API as an authenticated attachment.

The raw SeaweedFS URL is internal infra (unreachable in production) and
serves files inline. This endpoint adds campaign-role auth and sets
Content-Disposition so the browser downloads a properly named file.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` PDF file as an attachment
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|-|-|
|application/pdf|-|-|
- `400` Invalid storage key prefix
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `404` Submission not found, PDF not generated, or empty object
- `422` Invalid submission UUID
- `502` Could not fetch PDF from storage

### POST /api/admin/campaign/submissions/{submission_id}/resend-email

Summary: Re-enqueue result email
Operation ID: `resend_email_api_admin_campaign_submissions__submission_id__resend_email_post`

Description:

Re-send the result email (ops/dev only); reuses the existing PDF.

결과 메일 재발송 (운영/개발자 전용); 기존 PDF 재사용.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `202` Resend job queued
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse)|{"task_id":"job-abc123","status":"queued"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks ops_admin/dev_admin role
- `404` Submission not found
- `409` No PDF to attach
- `422` Invalid submission UUID
- `503` ARQ enqueue failed

### POST /api/admin/campaign/submissions/{submission_id}/score

Summary: Enqueue AI scoring
Operation ID: `request_score_api_admin_campaign_submissions__submission_id__score_post`

Description:

Manually trigger AI evaluation for a submission still in `submitted`.

Scoring is not auto-enqueued on intake (token-cost control); a reviewer
inspects the submission first, then triggers eval on demand.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `202` Scoring job queued
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TaskEnqueuedResponse](../schemas/admin-campaign.md#taskenqueuedresponse)|{"task_id":"job-abc123","status":"queued"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a scoring-capable campaign role
- `404` Submission not found
- `409` Submission is not in 'submitted' status
- `422` Invalid submission UUID
- `503` ARQ enqueue failed

### POST /api/admin/campaign/submissions/{submission_id}/source-edit

Summary: Edit original source fields
Operation ID: `save_source_edit_api_admin_campaign_submissions__submission_id__source_edit_post`

Description:

Reviewer correction of the original source fields (question topic,
passage, applicant answer text, or Q51/Q52 answers).

Partial update — only the fields present in the request body are written.
Editing the applicant's submitted answer is sensitive, so a before/after
snapshot is written to the audit log.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignSourceEditRequest](../schemas/admin-campaign.md#campaignsourceeditrequest)|-|

Responses:
- `200` Source fields updated
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks kr_content/ops_admin/dev_admin role
- `404` Submission not found
- `422` Invalid UUID, no fields to update, or empty text

### POST /api/admin/campaign/submissions/{submission_id}/state

Summary: Transition submission workflow state
Operation ID: `transition_state_api_admin_campaign_submissions__submission_id__state_post`

Description:

Move a submission to a new workflow status (with audit + SLA effects).

제출을 새 워크플로 상태로 전환.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignStateTransitionRequest](../schemas/admin-campaign.md#campaignstatetransitionrequest)|-|

Responses:
- `200` New workflow status after transition
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[WorkflowStateResponse](../schemas/admin-campaign.md#workflowstateresponse)|{"workflow_status":"in_review"}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `404` Submission not found
- `409` Invalid state transition
- `422` Invalid submission UUID

### POST /api/admin/campaign/submissions/{submission_id}/translation

Summary: Save VN translation / reviewer feedback
Operation ID: `save_translation_api_admin_campaign_submissions__submission_id__translation_post`

Description:

Save the Vietnamese translation (and optionally kr_feedback for KR/ops).

베트남어 번역 저장 (KR/운영자는 kr_feedback도 수정 가능).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|submission_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignTranslationRequest](../schemas/admin-campaign.md#campaigntranslationrequest)|-|

Responses:
- `200` Translation saved
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OkResponse](../schemas/admin-campaign.md#okresponse)|{"ok":true}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks vn_translator/ops_admin role, or a vn_translator attempted to edit kr_feedback
- `404` Submission not found
- `422` Invalid submission UUID

### GET /api/admin/campaign/tasks/{task_id}/status

Summary: Poll background task status
Operation ID: `task_status_api_admin_campaign_tasks__task_id__status_get`

Description:

Dashboard polls this every ~1s after kicking off /pdf or /email
so it can refresh the submission row once the worker writes the
result back to the DB.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|task_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Current ARQ job status (with result when complete)
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TaskStatusResponse](../schemas/admin-campaign.md#taskstatusresponse)|{"task_id":"job-abc123","status":"complete","result":{}}|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/admin/campaign/users

Summary: List campaign users
Operation ID: `list_users_api_admin_campaign_users_get`

Description:

List campaign applicants with their submission counts and latest status.

캠페인 응시자 목록 (제출 수 / 최신 상태 포함).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|limit|query|no|integer|-|{"default":100}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignUserListResponse](../schemas/admin-campaign.md#campaignuserlistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/admin/campaign/users/{email}/submissions

Summary: List a user's submissions
Operation ID: `list_user_submissions_api_admin_campaign_users__email__submissions_get`

Description:

List all submissions for a given user (by email).

특정 사용자(이메일)의 제출 목록.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|email|path|yes|string|-|-|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignSubmissionListResponse](../schemas/admin-campaign.md#campaignsubmissionlistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `404` User not found
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/admin/campaign/waitlist

Summary: List waitlist signups
Operation ID: `list_waitlist_api_admin_campaign_waitlist_get`

Description:

List landing-page pre-registration (사전 등록) waitlist signups.

랜딩 페이지 사전 등록 대기자 목록.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Successful Response
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[CampaignWaitlistListResponse](../schemas/admin-campaign.md#campaignwaitlistlistresponse)|-|
- `401` Missing or invalid admin JWT
- `403` Caller lacks a campaign role
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
