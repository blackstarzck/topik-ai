# Evaluation API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/evaluation.md)

Learner-facing evaluation status and feedback read APIs after writing submit.

Swagger tag description:

Learner-facing evaluation status and feedback read APIs after writing submit.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`GET`|`/api/evaluation/{submission_id}`|Poll writing evaluation status|
|`GET`|`/api/evaluation/{submission_id}/feedback`|Get detailed writing evaluation feedback|

## Endpoint Details

### GET /api/evaluation/{submission_id}

Summary: Poll writing evaluation status
Operation ID: `get_evaluation_status_api_evaluation__submission_id__get`

Description:

Poll writing evaluation status / 작문 평가 상태 조회

**EN:** Returns the current grading status for a submission created via
`POST /api/writing/submit`. Scoring runs asynchronously on a worker, so
poll this endpoint until `status` becomes `graded`, then fetch the full
result from `GET /api/evaluation/{submission_id}/feedback`.

Status values: `processing` (still grading) | `graded` (done) | `failed`.
Score fields are `null` until grading completes.

**KR:** `POST /api/writing/submit`로 생성한 제출의 채점 상태를 반환합니다.
채점은 워커에서 비동기로 실행되므로 `status`가 `graded`가 될 때까지 폴링한 뒤
`GET /api/evaluation/{submission_id}/feedback`로 전체 결과를 가져오세요.

**DB-first:** checks submission status in PostgreSQL; falls back to the
Arq job info when the row is not yet persisted.

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
- `200` Current evaluation status. Poll until `status` is `graded`.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[EvaluationStatusResponse](../schemas/evaluation.md#evaluationstatusresponse)|-|
- `401` Missing or invalid JWT.
- `403` Submission belongs to another user.
- `404` Submission not found.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/evaluation/{submission_id}/feedback

Summary: Get detailed writing evaluation feedback
Operation ID: `get_evaluation_feedback_api_evaluation__submission_id__feedback_get`

Description:

Get detailed writing evaluation feedback / 작문 평가 상세 피드백 조회

**EN:** Returns the full AI scoring result for a graded submission:
per-trait scores (content / organization / language use), detected errors
with corrections, inline annotations, and an overall summary. Call this
only once `GET /api/evaluation/{submission_id}` reports `graded`. While the
worker is still scoring, this returns **HTTP 202** `{"status": "processing"}`
(a status, not an error) so typed clients get a stable envelope.

**KR:** 채점이 끝난 제출의 전체 AI 결과를 반환합니다: 항목별 점수(내용/구성/
언어사용), 교정이 포함된 오류, 인라인 주석, 종합 요약. 상태 조회가 `graded`가 된
뒤에만 호출하세요. 채점 중이면 **HTTP 202** `{"status": "processing"}`를 반환합니다.

**DB-first:** fetches feedback from PostgreSQL; falls back to the Arq job
result when the row is not yet persisted.

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
- `200` Full AI feedback (only when grading is complete).
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[EvaluationFeedbackResponse](../schemas/evaluation.md#evaluationfeedbackresponse)|-|
- `202` Still grading — poll again shortly.
- `401` Missing or invalid JWT.
- `403` Submission belongs to another user.
- `404` Submission not found.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
- `500` Scoring failed.
