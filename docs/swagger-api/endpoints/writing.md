# Writing API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/writing.md)

TOPIK writing tasks, draft save, submit, tutor chat, history, generation, and feedback PDF export.

Swagger tag description:

**Writing Practice / 쓰기 연습**

Submit TOPIK II essays for AI scoring, generate writing prompts, use the AI chat tutor for real-time feedback, and manage drafts and history.

TOPIK II 작문 AI 채점 제출, 작문 주제 생성, AI 채팅 튜터로 실시간 피드백, 초안 및 이력 관리.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`POST`|`/api/writing/chat`|AI writing chat tutor (SSE stream)|
|`GET`|`/api/writing/feedback/{submission_id}/export-pdf`|Export feedback as PDF|
|`POST`|`/api/writing/generate`|Generate & persist a TOPIK II writing problem (v2)|
|`GET`|`/api/writing/history`|Get writing submission history|
|`DELETE`|`/api/writing/history/{submission_id}`|Delete writing submission|
|`POST`|`/api/writing/save-draft`|Auto-save writing draft|
|`POST`|`/api/writing/submit`|Submit writing for AI evaluation|
|`GET`|`/api/writing/tasks`|List writing questions across types (§7.9 view, 노출 가능 only)|
|`GET`|`/api/writing/tasks/{task_type}`|List TOPIK II writing questions of a type (메타데이터 적용)|

## Endpoint Details

### POST /api/writing/chat

Summary: AI writing chat tutor (SSE stream)
Operation ID: `writing_chat_api_writing_chat_post`

Description:

AI writing chat tutor (SSE) / AI 작문 채팅 튜터 (SSE 스트리밍)

**EN:** Sends a student message to the AI writing tutor and streams the response
via Server-Sent Events. The tutor provides contextual feedback on the student's
draft essay, corrects grammar, suggests improvements, and encourages the learner.

Connect as `EventSource` or read `text/event-stream`. Each chunk is a partial
text token; the stream ends with `data: [DONE]`.

**KR:** 학생 메시지를 AI 작문 튜터에 전송하고 Server-Sent Events로 응답을 스트리밍합니다.
튜터는 초안에 대한 맥락적 피드백 제공, 문법 수정, 개선 제안, 학습자 격려를 수행합니다.

`EventSource`로 연결하거나 `text/event-stream`을 읽으세요. 각 청크는 부분 텍스트이며
스트림은 `data: [DONE]`으로 종료됩니다.

**Rate limit / 속도 제한:** 20 requests/minute

**Request example / 요청 예시:**
```json
{
  "message": "이 문장이 자연스러운가요?",
  "essay_text": "환경 문제를 해결하기 위해서 우리는 노력해야 한다.",
  "task_id": "Q53",
  "topic": "환경 보호",
  "lang": "ko",
  "conversation_history": []
}
```

**SSE stream example / SSE 스트림 예시:**
```
data: 네, 문장이 자연스럽습니다

data: . 다만 더

data:  구체적인 예시를 추가하면

data: [DONE]
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[WritingChatRequest](../schemas/writing.md#writingchatrequest)|-|

Responses:
- `200` Server-Sent Events stream (`text/event-stream`). Each event is `data: <partial text>` with embedded newlines escaped as `\n`; `: keep-alive` comments are sent periodically; the stream ends with `data: [DONE]`. Errors are delivered in-stream as `data: {"error": "..."}` before `[DONE]`.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|-|-|
|text/event-stream|-|data: 네, 문장이 자연스럽습니다<br><br>data: . 다만 더<br><br>data: [DONE]<br><br>|
- `401` Missing or invalid JWT.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
- `429` Rate limit exceeded (20 requests/minute).

### GET /api/writing/feedback/{submission_id}/export-pdf

Summary: Export feedback as PDF
Operation ID: `export_feedback_pdf_api_writing_feedback__submission_id__export_pdf_get`

Description:

Export feedback as PDF / 피드백 PDF 내보내기

**EN:** Generates and downloads a PDF document containing the full AI evaluation
feedback for the specified submission. The PDF includes scores, annotated corrections,
and study recommendations.

**KR:** 지정된 제출에 대한 전체 AI 평가 피드백이 포함된 PDF를 생성하고 다운로드합니다.
PDF에는 점수, 주석이 달린 수정 사항, 학습 권장 사항이 포함됩니다.

**Response:** `application/pdf` — file download `feedback-{submission_id}.pdf`

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
- `200` PDF file download (feedback-{submission_id}.pdf).
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|-|-|
|application/pdf|-|-|
- `400` Invalid submission ID format, or feedback not yet available.
- `401` Missing or invalid JWT.
- `404` Submission not found (or not owned by the user).
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### POST /api/writing/generate

Summary: Generate & persist a TOPIK II writing problem (v2)
Operation ID: `generate_writing_problem_api_writing_generate_post`

Description:

Generate a rich-metadata v2 writing problem (Q51/52/53/54), persist it with
review_status='검수 필요', and return the reference-key JSON for the item_number.

topic is server-selected from the 17 fixed 종합주제 (topic_master); the request's
free ``topic`` field is not used. Rate limit: 10 requests/minute.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[WritingGenerateRequestV2](../schemas/writing.md#writinggeneraterequestv2)|-|

Responses:
- `200` Generated rich-metadata problem (review_status='검수 필요'); the body keys match the reference schema for the requested item_number.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|oneOf<TopikWriting51Response \| TopikWriting52Response \| TopikWriting53Response \| TopikWriting54Response>|{"question_id":"topik-writing-53-0063","item_number":53,"topic_main":"사회","topic_detail":"경제","prompt_text":"다음 자료를 보고 200~300자로 쓰십시오.","review_status":"검수 필요","service_status":"내부 테스트"}|
- `401` Missing or invalid JWT.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
- `429` Rate limit exceeded (10 requests/minute).
- `500` AI prompt generation failed.

### GET /api/writing/history

Summary: Get writing submission history
Operation ID: `get_writing_history_api_writing_history_get`

Description:

Get writing submission history / 작문 제출 이력 조회

**EN:** Returns a paginated list of the current user's writing submissions, sorted
newest-first. Filter by task type, evaluation status, or date range.

**KR:** 현재 사용자의 작문 제출 목록을 최신순으로 반환합니다.
문제 유형, 평가 상태, 날짜 범위로 필터링 가능합니다.

**Filters / 필터:**
- `task_type`: `Q51` | `Q53` | `Q54`
- `status`: `processing` | `graded` | `failed` | `draft`
- `date_from` / `date_to`: `YYYY-MM-DD`

**Example response / 응답 예시:**
```json
{
  "submissions": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "task_type": "Q53",
      "content_preview": "현대 사회에서 스트레스를 관리하는 방법에는...",
      "total_score": 42.5,
      "status": "graded",
      "submitted_at": "2024-11-15T09:30:00"
    }
  ],
  "total": 1
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|limit|query|no|integer|-|{"default":20}|
|offset|query|no|integer|-|{"default":0}|
|task_type|query|no|anyOf<string \| null>|-|-|
|status|query|no|anyOf<string \| null>|-|-|
|date_from|query|no|anyOf<string \| null>|-|-|
|date_to|query|no|anyOf<string \| null>|-|-|

Request body:
- None declared.

Responses:
- `200` Paginated submission history, newest first.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[WritingHistoryResponse](../schemas/writing.md#writinghistoryresponse)|{"submissions":[{"id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","task_type":"Q53","content_preview":"현대 사회에서 스트레스를 관리하는 방법에는...","total_score":42.5,"status":"graded","submitted_at":"2024-11-15T09:30:00"}],"total":1}|
- `401` Missing or invalid JWT.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### DELETE /api/writing/history/{submission_id}

Summary: Delete writing submission
Operation ID: `delete_writing_submission_api_writing_history__submission_id__delete`

Description:

Delete writing submission / 작문 제출 삭제

**EN:** Permanently deletes a writing submission and its evaluation data from the
user's history. Only the submission owner can delete it.

**KR:** 사용자의 이력에서 작문 제출과 평가 데이터를 영구적으로 삭제합니다.
제출 소유자만 삭제할 수 있습니다.

**Response example / 응답 예시:**
```json
{ "success": true, "deleted_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

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
- `200` Submission deleted.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[DeleteSubmissionResponse](../schemas/writing.md#deletesubmissionresponse)|{"success":true,"deleted_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479"}|
- `400` Invalid submission ID format.
- `401` Missing or invalid JWT.
- `404` Submission not found (or not owned by the user).
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### POST /api/writing/save-draft

Summary: Auto-save writing draft
Operation ID: `save_draft_api_writing_save_draft_post`

Description:

Auto-save writing draft / 작문 초안 자동 저장

**EN:** Saves the current draft text for a writing task. Call periodically (e.g. every 30s)
while the user is typing. Returns the draft ID and character count.

**KR:** 현재 작문 초안 텍스트를 저장합니다. 사용자가 입력하는 동안 주기적으로 호출하세요
(예: 30초마다). 초안 ID와 글자 수를 반환합니다.

**Request example / 요청 예시:**
```json
{
  "task_type": "Q53",
  "task_id": "abc123",
  "text": "현대 사회에서 스트레스를 관리하는 방법...",
  "time_spent": 120
}
```

**Response example / 응답 예시:**
```json
{
  "submission_id": "draft-f47ac10b",
  "saved_at": "2024-11-15T09:35:22",
  "character_count": 45
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[SaveDraftRequest](../schemas/writing.md#savedraftrequest)|-|

Responses:
- `200` Draft saved; returns draft ID and character count.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[SaveDraftResponse](../schemas/writing.md#savedraftresponse)|{"submission_id":"draft-f47ac10b","saved_at":"2024-11-15T09:35:22","character_count":45}|
- `401` Missing or invalid JWT.
- `404` No active writing task found for the given task_type.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### POST /api/writing/submit

Summary: Submit writing for AI evaluation
Operation ID: `submit_writing_api_writing_submit_post`

Description:

Submit writing for AI evaluation / 작문 AI 평가 제출

Queues a TOPIK II answer and returns `202 {submission_id, status, message}`
immediately. Poll `GET /api/evaluation/{submission_id}` until `status` is
`graded`.

**Common to every task type:**
- Auth: `Authorization: Bearer <token>`. `user_id` comes from the JWT — don't send it.
- `question_id` (from `GET /api/writing/tasks`): the backend loads that question's
  passage, model answer, and rubric to grade against — you don't send the question
  content. Omit it for ad-hoc grading by `task_type`.
- `lang` (`ko`/`en`/`vi`): language of the feedback you get back.
- Rate limit: 5 requests/minute.

Pick the block for your `task_type`. A full example per type is in the request
body **Examples** dropdown.

---
**Q51 · 문장 완성 (sentence blank-fill)**
- Send: `blanks` — `{"ㄱ": "...", "ㄴ": "..."}`, keyed by the labels in the passage.
  (Legacy: a single `text` string is still accepted.)
- Also send: `passage_context` — the passage with `( ㄱ )` `( ㄴ )` so the grader
  sees where each blank sits. Filled from `question_id` if you omit it; a value you
  send wins.
- Limits: min 5 chars, each blank ≤ 300 chars.
- Output: each blank scored 0–5 → **total 0–10** (ㄱ→blank_1, ㄴ→blank_2).

**Q52 · 단락 완성 (paragraph blank-fill)** — same shape as Q51 (`blanks` +
`passage_context`), **total 0–10**.

**Q53 · 정보 에세이 (~200–300자)**
- Send: `text` (the whole answer). `blanks`/`passage_context` ignored.
- Limits: min 20 chars.
- Output: **total 0–30**.

**Q54 · 논증 에세이 (~600–700자)**
- Send: `text` (the whole answer). `blanks`/`passage_context` ignored.
- Limits: min 100 chars.
- Output: **total 0–50**.

**Request example — Q53/Q54 (text) / 요청 예시:**
```json
{
  "task_type": "Q53",
  "question_id": "topik-writing-53-0001",
  "text": "현대 사회에서 스트레스를 관리하는 방법에는 여러 가지가 있다. 첫째, 규칙적인 운동은...",
  "lang": "ko"
}
```

**Request example — Q51/Q52 (blanks) / 요청 예시:**
```json
{
  "task_type": "Q51",
  "question_id": "topik-writing-51-0001",
  "blanks": { "ㄱ": "잘 수 없습니다", "ㄴ": "알려 주시면" },
  "passage_context": "저는 현재 기숙사를 이용하고 있는 외국인 유학생입니다. ... 잠을 ( ㄱ ). ... 방법을 ( ㄴ ) 감사하겠습니다.",
  "lang": "ko"
}
```

**Response example / 응답 예시 (202):**
```json
{
  "submission_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "status": "processing",
  "message": "Writing submitted for evaluation. Poll GET /api/evaluation/{submission_id} for results."
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[WritingSubmitRequest](../schemas/writing.md#writingsubmitrequest)|-|

Responses:
- `202` Submission accepted and enqueued for async evaluation.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[SubmissionResponse](../schemas/writing.md#submissionresponse)|{"submission_id":"f47ac10b-58cc-4372-a567-0e02b2c3d479","status":"processing","message":"Writing submitted for evaluation. Poll GET /api/evaluation/{submission_id} for results."}|
- `400` Invalid request body (validation error).
- `401` Missing or invalid JWT.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
- `429` Rate limit exceeded (5 requests/minute).

### GET /api/writing/tasks

Summary: List writing questions across types (§7.9 view, 노출 가능 only)
Operation ID: `list_writing_tasks_api_writing_tasks_get`

Description:

List writing questions across types / 유형 통합 작문 문제 목록 (§7.9 추천 뷰)

**EN:** Paginated cross-type list of TOPIK II writing questions read from the guide
§7.9 recommendation view (`topik_writing_question_recommendation_view`) — common
columns only (no prompt body). Only `service_status = '노출 가능'` rows are returned.
For the full per-number metadata of one question, use GET /api/writing/tasks/{task_type}.

**KR:** 51~54번을 한 번에 조회하는 추천 뷰 기반 목록입니다(§7.9). 공통 컬럼만 포함하며
`노출 가능` 문제만 반환합니다. 문제 본문·세부 메타데이터는 /api/writing/tasks/{task_type}에서 조회합니다.

**Filters / 필터:** `item_number`(51|52|53|54, optional), `topic_main`, `topic_detail`,
`difficulty_level`(1~6). Invalid `item_number` → 422. Empty result → 200 with `items: []`.

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|item_number|query|no|anyOf<string \| null>|Filter by item type 51\|52\|53\|54 (accepts Q53/task53).|-|
|topic_main|query|no|anyOf<string \| null>|Filter by 종합 주제 (exact match).|-|
|topic_detail|query|no|anyOf<string \| null>|Filter by 세부 주제 (exact match).|-|
|difficulty_level|query|no|anyOf<integer \| null>|Filter by 내부 난이도 1~6.|-|
|limit|query|no|integer|Page size.|{"default":10}|
|offset|query|no|integer|Pagination offset.|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Paginated cross-type list of serviceable writing questions.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[WritingRecommendationListResponse](../schemas/writing.md#writingrecommendationlistresponse)|{"items":[{"question_id":"topik-writing-53-0063","item_number":53,"target_level":"3급","difficulty_level":3,"topic_main":"사회","topic_detail":"경제","speech_act":null,"scenario_type":"자료 설명","recommendation_keys":[],"avoid_repeat_keys":[],"review_status":"검수 완료","service_status":"노출 가능"}],"total":128,"limit":10,"offset":0}|
- `401` Missing or invalid JWT.
- `422` Invalid item_number filter (must be 51\|52\|53\|54).

### GET /api/writing/tasks/{task_type}

Summary: List TOPIK II writing questions of a type (메타데이터 적용)
Operation ID: `get_writing_task_api_writing_tasks__task_type__get`

Description:

List writing questions of a type / 유형별 작문 문제 목록 (메타데이터 적용)

**EN:** Returns a paginated list of TOPIK II writing questions for the given item type
(`51|52|53|54`) from the rich-metadata tables (`topik_writing_5X_questions`). Each item
is shaped by the §7 discriminated union, keyed by `item_number`. No status gating — all
rows are returned. Empty results return `200` with `items: []` (not 404).

**KR:** 지정한 유형(`51|52|53|54`)의 작문 문제를 리치 메타데이터 테이블에서
페이지네이션 리스트로 반환합니다. 각 item은 §7 판별 유니온 구조(`item_number` 기준)이며,
검수/서비스 상태 필터링은 하지 않습니다(전부 반환). 결과가 없으면 `items: []`로 200을 반환합니다.

**Path / 경로 파라미터:** `task_type` = `51` | `52` | `53` | `54` (also accepts `Q53`, `task53`).

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|task_type|path|yes|string|`51` \| `52` \| `53` \| `54` (also accepts `Q53`, `task53`).|-|
|topic_main|query|no|anyOf<string \| null>|Filter by 종합 주제 (exact match).|-|
|topic_detail|query|no|anyOf<string \| null>|Filter by 세부 주제 (exact match).|-|
|difficulty_level|query|no|anyOf<integer \| null>|Filter by 내부 난이도 1~6.|-|
|limit|query|no|integer|Page size.|{"default":10}|
|offset|query|no|integer|Pagination offset.|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Paginated list of rich-metadata questions for the item type.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[TopikWritingQuestionListResponse](../schemas/writing.md#topikwritingquestionlistresponse)|{"items":[{"question_id":"topik-writing-53-0063","item_number":53,"topic_main":"사회","topic_detail":"경제","prompt_text":"다음 자료를 보고 200~300자로 쓰십시오.","review_status":"검수 완료","service_status":"노출 가능"}],"total":62,"limit":10,"offset":0}|
- `401` Missing or invalid JWT.
- `422` Invalid task_type (must be 51\|52\|53\|54).
