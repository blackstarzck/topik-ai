# External Campaign API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[Body_upload_attachment_api_external_campaign_uploads_post](#bodyuploadattachmentapiexternalcampaignuploadspost)|object|
|[CampaignContactRequest](#campaigncontactrequest)|object|
|[CampaignContactResponse](#campaigncontactresponse)|object|
|[CampaignFollowUpRequest](#campaignfollowuprequest)|object|
|[CampaignFollowUpResponse](#campaignfollowupresponse)|object|
|[CampaignStatusResponse](#campaignstatusresponse)|object|
|[CampaignSubmitRequest](#campaignsubmitrequest)|object|
|[CampaignSubmitResponse](#campaignsubmitresponse)|object|
|[CampaignUploadResponse](#campaignuploadresponse)|object|
|[CampaignWaitlistRequest](#campaignwaitlistrequest)|object|
|[CampaignWaitlistResponse](#campaignwaitlistresponse)|object|

## Body_upload_attachment_api_external_campaign_uploads_post

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|file|yes|string|-|-|-|-|

## CampaignContactRequest

Landing-page "Contact us" inquiry (general lead / support capture).

Independent of submissions/scoring. Append-only — a person may send
multiple inquiries. ``inquiry_type`` is the localized display label from
the modal's select, stored as free text.
Type: `object`

Schema examples:
```json
[
  {
    "affiliation": "Hanoi University",
    "email": "learner@example.com",
    "inquiry_type": "General inquiry",
    "locale": "vi",
    "message": "I would like to know more about the campaign.",
    "name": "Nguyen Van A",
    "pathname": "/campaign",
    "source": "contact_modal"
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|name|yes|string|-|-|["Nguyen Van A"]|Name of the person submitting the inquiry.|
|email|yes|string|-|-|["learner@example.com"]|Contact email for replies.|
|affiliation|no|anyOf<string \| null>|-|-|["Hanoi University"]|Organization/affiliation; null if omitted.|
|inquiry_type|yes|string|-|-|["General inquiry"]|Localized inquiry-type label from the modal's select, stored as free text.|
|message|yes|string|-|-|["I would like to know more about the campaign."]|Free-text message body of the inquiry.|
|locale|no|anyOf<string \| null>|-|-|["vi"]|Locale the inquiry was submitted from; null if unknown.|
|source|no|string|-|contact_modal|["contact_modal"]<br>{"default":"contact_modal"}|Capture source of the inquiry (free text).|
|pathname|no|anyOf<string \| null>|-|-|["/campaign"]|Page path where the inquiry was submitted; null if not captured.|
|referrer|no|anyOf<string \| null>|-|-|["https://facebook.com/"]|HTTP referrer at submit time; null if not captured.|
|user_agent|no|anyOf<string \| null>|-|-|["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"]|Browser user-agent string at submit time; null if not captured.|

## CampaignContactResponse

Acknowledgement returned after a contact inquiry submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|integer|-|-|[42]|Primary key of the stored inquiry.|
|email|yes|string|-|-|["learner@example.com"]|Email of the person who submitted the inquiry.|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the inquiry was created.|

## CampaignFollowUpRequest

Post-result satisfaction / willingness-to-pay survey.

Linked to the user by email only (no FK to submissions). Append-only.
Type: `object`

Schema examples:
```json
[
  {
    "ai_feedback_interest_after_result": "very_interested",
    "email": "learner@example.com",
    "freeform_feedback": "The feedback was very detailed, thank you!",
    "helpfulness_score": 4,
    "most_helpful_part": "grammar_feedback",
    "paid_beta_interest": "maybe",
    "pathname": "/result",
    "retry_interest": "yes",
    "source": "follow_up"
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["learner@example.com"]|Email of the respondent (links the survey to the user).|
|helpfulness_score|yes|integer|-|-|[4]|How helpful the result was, on a 1–5 scale.|
|most_helpful_part|yes|string|-|-|["grammar_feedback"]|Which part of the result the respondent found most helpful (free text).|
|retry_interest|yes|string|-|-|["yes"]|Respondent's interest in retrying/resubmitting (free text).|
|ai_feedback_interest_after_result|yes|string|-|-|["very_interested"]|Interest in AI feedback after seeing the result (free text).|
|paid_beta_interest|yes|string|-|-|["maybe"]|Interest in joining a paid beta (free text).|
|freeform_feedback|no|anyOf<string \| null>|-|-|["The feedback was very detailed, thank you!"]|Optional open-ended feedback; null if omitted.|
|source|no|string|-|follow_up|["follow_up"]<br>{"default":"follow_up"}|Capture source of the survey response (free text).|
|pathname|no|anyOf<string \| null>|-|-|["/result"]|Page path where the survey was submitted; null if not captured.|
|referrer|no|anyOf<string \| null>|-|-|["https://landing.example.com/result"]|HTTP referrer at submit time; null if not captured.|
|user_agent|no|anyOf<string \| null>|-|-|["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"]|Browser user-agent string at submit time; null if not captured.|

## CampaignFollowUpResponse

Acknowledgement returned after a follow-up survey submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|integer|-|-|[42]|Primary key of the stored survey response.|
|email|yes|string|-|-|["learner@example.com"]|Email of the respondent.|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the response was created.|

## CampaignStatusResponse

Polling endpoint used as a fallback when the dashboard wants a
fresh read without going through the admin auth path.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f"]|UUID of the submission being polled.|
|workflow_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["ai_drafted"]|Current workflow state of the submission.|
|feedback|no|anyOf<object<string, -> \| null>|-|-|[{"summary":"Good structure, minor grammar issues."}]|Structured scoring feedback once available; null while pending.|
|total_score|no|anyOf<number \| null>|-|-|[42.5]|Awarded score; null until scoring completes.|
|max_score|no|anyOf<number \| null>|-|-|[50]|Maximum possible score for this task type.|
|error_message|no|anyOf<string \| null>|-|-|[null]|Human-readable error if scoring failed; null otherwise.|
|submitted_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the submission was received.|
|completed_at|no|anyOf<string \| null>|-|-|["2026-06-08T09:35:00Z"]|ISO-8601 UTC timestamp when scoring/delivery completed; null if pending.|
|due_at|yes|string|-|-|["2026-06-09T09:30:00Z"]|ISO-8601 UTC deadline by which the result is promised.|

## CampaignSubmitRequest

Body posted by the Next.js form route after the user submits.
Type: `object`

Schema examples:
```json
[
  {
    "community_group": "TOPIK Study VN",
    "display_name": "Nguyen Van A",
    "email": "learner@example.com",
    "image_urls": [
      "https://cdn.example.com/uploads/answer-1.jpg"
    ],
    "language": "vi",
    "marketing_consent": true,
    "passage_context": "",
    "question_topic_text": "환경 보호의 중요성에 대해 쓰십시오.",
    "source_channel": "facebook_group",
    "task_type": "Q53",
    "text": "현대 사회에서 환경 보호는 매우 중요합니다. 첫째, ..."
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["learner@example.com"]|Applicant email; used to upsert a shadow user profile and to deliver results.|
|display_name|yes|string|-|-|["Nguyen Van A"]|Applicant display name shown on the result PDF and dashboard.|
|language|no|enum<"ko" \| "vi" \| "en">|"ko", "vi", "en"|vi|["vi"]<br>{"default":"vi"}|Preferred result/UI language. One of: 'ko', 'vi', 'en'.|
|marketing_consent|no|boolean|-|false|[true]<br>{"default":false}|Whether the applicant opted in to marketing follow-up emails.|
|task_type|yes|enum<"Q51" \| "Q52" \| "Q53" \| "Q54">|"Q51", "Q52", "Q53", "Q54"|-|["Q53"]|TOPIK writing task being submitted. One of: 'Q51', 'Q52', 'Q53', 'Q54'.|
|text|yes|string|-|-|["저는 매일 아침 운동을 합니다. 건강을 위해서 운동이 중요하다고 생각합니다."]|The applicant's written answer to be scored.|
|passage_context|no|string|-|-|["다음 글을 읽고 200~300자로 쓰십시오."]<br>{"default":""}|Optional reading passage or prompt context the answer responds to.|
|provided_question_ids|no|anyOf<array<string> \| null>|-|-|[["a","b"]]|Q51/Q52 only: ids of the blanks being answered (max 3). Omit for Q53/Q54.|
|provided_question_texts|no|anyOf<array<ProvidedQuestion> \| null>|-|-|[[{"id":"a","text":"( ㉠ )에 들어갈 말을 쓰십시오."}]]|Q51/Q52 only: prompt text for each answered blank (max 3). Omit for Q53/Q54.|
|user_answers|no|anyOf<array<string> \| null>|-|-|[["감사합니다","다음에 또 오겠습니다"]]|Q51/Q52 only: the applicant's text per blank, aligned to provided_question_ids (max 3).|
|question_topic_text|no|anyOf<string \| null>|-|-|["현대 사회에서 환경 보호의 중요성에 대해 자신의 생각을 쓰십시오."]|Q53/Q54 only: the essay topic/instruction. Required for Q53/Q54 at the service layer.|
|image_url|no|anyOf<string \| null>|-|-|["https://cdn.example.com/uploads/answer-1.jpg"]|Optional single uploaded answer image (handwritten answer photo).|
|image_urls|no|anyOf<array<string> \| null>|-|-|[["https://cdn.example.com/uploads/answer-1.jpg"]]|Optional multi-image superset of image_url; up to 3 answer images per submission.|
|image_readable|no|anyOf<boolean \| null>|-|-|[true]|Client hint indicating whether the uploaded image was legible enough to read.|
|survey_response|no|anyOf<object<string, -> \| null>|-|-|[{"goal":"study_abroad","target_level":4}]|Free-form intake survey answers, stored as JSONB.|
|source_channel|no|anyOf<string \| null>|-|-|["facebook_group"]|Acquisition channel the applicant arrived from (free text).|
|community_group|no|anyOf<string \| null>|-|-|["TOPIK Study VN"]|Name of the community/group that referred the applicant.|
|community_post_url|no|anyOf<string \| null>|-|-|["https://facebook.com/groups/topikvn/posts/123"]|URL of the referring community post, if any.|
|staff_owner|no|anyOf<string \| null>|-|-|["minh"]|Staff member who owns/referred this lead (free text).|
|external_ref|no|anyOf<string \| null>|-|-|["landing-2026-06-000123"]|Optional external reference id for cross-host parity; rarely set.|
|webhook_url|no|anyOf<string \| null>|-|-|["https://landing.example.com/api/webhooks/campaign"]|Optional callback URL to notify when the workflow completes.|

## CampaignSubmitResponse

Acknowledgement returned after a submission is accepted.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["3f9c1a2e-7b4d-4e1a-9c2f-0a1b2c3d4e5f"]|UUID of the created submission, used for status polling.|
|user_id|yes|string|-|-|["a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d"]|UUID of the (shadow) user profile the submission was attached to.|
|workflow_status|yes|enum<"submitted" \| "ai_drafted" \| "content_review" \| "translation_review" \| "pdf_ready" \| "delivered" \| "followup_sent" \| "invalid" \| "resend_required">|"submitted", "ai_drafted", "content_review", "translation_review", "pdf_ready", "delivered", "followup_sent", "invalid", "resend_required"|-|["submitted"]|Current workflow state, e.g. 'submitted' immediately after intake.|
|is_duplicate|yes|boolean|-|-|[false]|True if this submission matched an existing one and was deduplicated.|
|due_at|yes|string|-|-|["2026-06-09T09:30:00Z"]|ISO-8601 UTC deadline by which the result is promised.|
|estimated_seconds|no|integer|-|20|[20]<br>{"default":20}|Rough estimated seconds until an AI draft is available.|

## CampaignUploadResponse

Returned after a successful multipart file upload.

The landing site stores ``url`` and posts it back as ``image_url``
on the following /submissions call.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|url|yes|string|-|-|["https://cdn.example.com/uploads/answer-1.jpg"]|Public URL of the stored upload, posted back as image_url on /submissions.|
|key|yes|string|-|-|["campaign/2026-06/answer-1.jpg"]|Storage object key (path within the bucket).|
|content_type|yes|string|-|-|["image/jpeg"]|MIME type of the uploaded file.|
|bytes|yes|integer|-|-|[245678]|Size of the uploaded file in bytes.|

## CampaignWaitlistRequest

Landing-page waitlist signup (top-of-funnel lead capture).

Independent of submissions/scoring — email + attribution only.
Type: `object`

Schema examples:
```json
[
  {
    "email": "learner@example.com",
    "locale": "vi",
    "pathname": "/campaign",
    "referrer": "https://facebook.com/",
    "source": "landing_hero",
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["learner@example.com"]|Email to add to the waitlist.|
|locale|no|anyOf<string \| null>|-|-|["vi"]|Locale the signup came from; null if unknown.|
|source|no|string|-|unknown|["landing_hero"]<br>{"default":"unknown"}|Capture source of the signup (free text).|
|pathname|no|anyOf<string \| null>|-|-|["/campaign"]|Page path where the signup occurred; null if not captured.|
|referrer|no|anyOf<string \| null>|-|-|["https://facebook.com/"]|HTTP referrer at signup time; null if not captured.|
|user_agent|no|anyOf<string \| null>|-|-|["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"]|Browser user-agent string at signup time; null if not captured.|

## CampaignWaitlistResponse

Acknowledgement returned after a waitlist signup.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["learner@example.com"]|The email that was added to (or updated on) the waitlist.|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the entry was first created.|
|updated_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO-8601 UTC timestamp when the entry was last updated.|
|submission_count|yes|integer|-|-|[1]|Number of times this email signed up (deduplicated upsert counter).|
