# Evaluation API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/evaluation.md)

Learner-facing evaluation status and feedback read APIs after writing submit.

Swagger tag description:

Learner-facing evaluation status and feedback read APIs after writing submit.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`GET`|`/api/evaluation/{submission_id}`|Get Evaluation Status|
|`GET`|`/api/evaluation/{submission_id}/feedback`|Get Evaluation Feedback|

## Endpoint Details

### GET /api/evaluation/{submission_id}

Summary: Get Evaluation Status
Operation ID: `get_evaluation_status_api_evaluation__submission_id__get`

Description:

Poll evaluation status.

DB-first: checks submission status in PostgreSQL.
Arq fallback: if not in DB, checks Arq job info.

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
|application/json|[EvaluationStatusResponse](../schemas/evaluation.md#evaluationstatusresponse)|-|
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/evaluation/{submission_id}/feedback

Summary: Get Evaluation Feedback
Operation ID: `get_evaluation_feedback_api_evaluation__submission_id__feedback_get`

Description:

Get detailed evaluation feedback.

DB-first: fetches feedback from PostgreSQL.
Arq fallback: fetches from Arq job result.

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
|application/json|[EvaluationFeedbackResponse](../schemas/evaluation.md#evaluationfeedbackresponse)|-|
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
