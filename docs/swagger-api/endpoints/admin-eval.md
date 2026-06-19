# Admin Evaluation API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/admin-eval.md)

Internal evaluation dashboard endpoints for graded submissions, datasets, reviews, and runs.

Swagger tag description:

**Admin Evaluation / 관리자 평가**

Browse graded submissions, review AI scoring quality, manage golden datasets, and trigger evaluation pipeline runs.

채점된 제출물 조회, AI 채점 품질 검토, 골든 데이터셋 관리, 평가 파이프라인 실행.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`GET`|`/api/admin/eval/datasets`|List golden datasets (eval runs)|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/results`|Get dataset case results|
|`GET`|`/api/admin/eval/datasets/{dataset_id}/stats`|Get dataset statistics|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}`|List all expert reviews|
|`POST`|`/api/admin/eval/reviews/{target_type}/{target_id}`|Submit or update expert review|
|`GET`|`/api/admin/eval/reviews/{target_type}/{target_id}/my`|Get my expert review|
|`POST`|`/api/admin/eval/run`|Trigger evaluation pipeline run|
|`GET`|`/api/admin/eval/run/{run_id}/status`|Poll eval run status|
|`GET`|`/api/admin/eval/stats/overview`|Dashboard overview statistics|
|`GET`|`/api/admin/eval/submissions/{submission_id}`|Get submission detail|
|`GET`|`/api/admin/eval/users`|List users with graded submissions|
|`GET`|`/api/admin/eval/users/{user_id}/submissions`|List a user's graded submissions|

## Endpoint Details

### GET /api/admin/eval/datasets

Summary: List golden datasets (eval runs)
Operation ID: `list_datasets_api_admin_eval_datasets_get`

Description:

List golden datasets / 골든 데이터셋 목록 조회

**EN:** Returns evaluation run records stored in the SQLite eval database.
Filter by pipeline name. Each record corresponds to one completed eval run.

**KR:** SQLite 평가 데이터베이스에 저장된 평가 실행 기록을 반환합니다.
파이프라인 이름으로 필터링 가능합니다. 각 레코드는 완료된 평가 실행 하나에 해당합니다.

**Response example / 응답 예시:**
```json
{
  "items": [
    { "id": "run-2024-11-15", "pipeline": "writing_scorer",
      "mode": "full", "passed": 18, "total": 20, "created_at": "2024-11-15T10:00:00" }
  ],
  "total": 1, "limit": 50, "offset": 0
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|pipeline|query|no|anyOf<string \| null>|-|-|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Eval run records from the SQLite eval database, optionally filtered by pipeline.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[DatasetsResponse](../schemas/admin-eval.md#datasetsresponse)|{"items":[{"id":"run-2024-11-15","pipeline":"writing_scorer","mode":"full","passed":18,"total":20,"created_at":"2024-11-15T10:00:00"}],"total":1,"limit":50,"offset":0}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid pagination parameters.

### GET /api/admin/eval/datasets/{dataset_id}/results

Summary: Get dataset case results
Operation ID: `get_dataset_results_api_admin_eval_datasets__dataset_id__results_get`

Description:

Get dataset case results / 데이터셋 케이스 결과 조회

**EN:** Returns individual test case results for a given eval run.
Filter by `status=passed|failed|all`. Each item contains the input, expected output,
actual AI output, and pass/fail verdict.

**KR:** 주어진 평가 실행의 개별 테스트 케이스 결과를 반환합니다.
`status=passed|failed|all`로 필터링 가능합니다.
각 항목에는 입력, 예상 출력, 실제 AI 출력, 합격/불합격 판정이 포함됩니다.

**Response example / 응답 예시:**
```json
{
  "items": [
    { "case_id": "tc001", "status": "passed", "score": 42.5,
      "expected_min": 40.0, "actual": 42.5 }
  ],
  "total": 1, "limit": 100, "offset": 0
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|dataset_id|path|yes|string|-|-|
|status|query|no|enum<"all" \| "passed" \| "failed">|-|{"default":"all"}|
|limit|query|no|integer|-|{"default":100}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Individual test case results for the eval run, filtered by status.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[DatasetResultsResponse](../schemas/admin-eval.md#datasetresultsresponse)|{"items":[{"case_id":"tc001","status":"passed","score":42.5,"expected_min":40,"actual":42.5}],"total":1,"limit":100,"offset":0}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid status filter or pagination parameters.

### GET /api/admin/eval/datasets/{dataset_id}/stats

Summary: Get dataset statistics
Operation ID: `get_dataset_stats_api_admin_eval_datasets__dataset_id__stats_get`

Description:

Get dataset statistics / 데이터셋 통계 조회

**EN:** Returns aggregate statistics for an eval run: pass rate, average score,
score distribution, and per-pipeline breakdown.

**KR:** 평가 실행의 집계 통계를 반환합니다: 합격률, 평균 점수,
점수 분포, 파이프라인별 분류.

**Response example / 응답 예시:**
```json
{
  "dataset_id": "run-2024-11-15",
  "pipeline": "writing_scorer",
  "total_cases": 20,
  "passed": 18,
  "pass_rate": 0.9,
  "avg_score": 42.3,
  "score_distribution": { "30-40": 2, "40-50": 16, "50-60": 2 }
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|dataset_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Aggregate statistics for the eval run: pass rate, average score, distribution.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[DatasetStatsResponse](../schemas/admin-eval.md#datasetstatsresponse)|{"dataset_id":"run-2024-11-15","pipeline":"writing_scorer","total_cases":20,"passed":18,"pass_rate":0.9,"avg_score":42.3,"score_distribution":{"30-40":2,"40-50":16,"50-60":2}}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `404` Dataset not found or empty.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### GET /api/admin/eval/reviews/{target_type}/{target_id}

Summary: List all expert reviews
Operation ID: `list_reviews_api_admin_eval_reviews__target_type___target_id__get`

Description:

List all expert reviews / 전문가 리뷰 전체 목록 조회

**EN:** Returns all admin reviews submitted for a specific submission or eval result.
Useful for comparing multiple reviewers' opinions on the same AI output.

**KR:** 특정 제출 또는 평가 결과에 대해 제출된 모든 관리자 리뷰를 반환합니다.
같은 AI 출력에 대한 여러 검토자의 의견을 비교하는 데 유용합니다.

**Response example / 응답 예시:**
```json
{
  "items": [
    { "reviewer_name": "Admin A", "agreement": "agree", "grade": "A",
      "general_feedback": "정확한 채점입니다.", "reviewed_at": "2024-11-15T11:00:00" }
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
|target_type|path|yes|enum<"submission" \| "eval_result">|-|-|
|target_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` All admin reviews submitted for the target.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[ReviewListResponse](../schemas/admin-eval.md#reviewlistresponse)|{"items":[{"reviewer_name":"Admin A","agreement":"agree","grade":"A","general_feedback":"정확한 채점입니다.","reviewed_at":"2024-11-15T11:00:00"}],"total":1}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid target_type.

### POST /api/admin/eval/reviews/{target_type}/{target_id}

Summary: Submit or update expert review
Operation ID: `upsert_review_api_admin_eval_reviews__target_type___target_id__post`

Description:

Submit or update expert review / 전문가 리뷰 제출 또는 수정

**EN:** Creates or updates the current admin's review for a submission or eval result.
If a review already exists it is overwritten (upsert). Agreement and grade fields
are optional — submit partial reviews freely.

**KR:** 현재 관리자의 제출 또는 평가 결과에 대한 리뷰를 생성하거나 업데이트합니다.
리뷰가 이미 있으면 덮어씁니다 (upsert). 동의 및 등급 필드는 선택 사항입니다.

**Request example / 요청 예시:**
```json
{
  "agreement": "mostly_agree",
  "grade": "B",
  "disagreed_sections": ["expression"],
  "section_feedbacks": { "expression": "어휘 점수가 낮게 책정됨" },
  "general_feedback": "전반적으로 적절한 채점이나 표현 부분은 재검토 필요."
}
```

**`agreement` values:** `agree` | `mostly_agree` | `partial` | `disagree`

**`grade` values:** `A` | `B` | `C` | `D` | `F`

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|target_type|path|yes|enum<"submission" \| "eval_result">|-|-|
|target_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[ReviewRequest](../schemas/admin-eval.md#reviewrequest)|-|

Responses:
- `200` The created or updated review (upsert).
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[ExpertReview](../schemas/admin-eval.md#expertreview)|{"agreement":"mostly_agree","grade":"B","disagreed_sections":["expression"],"section_feedbacks":{"expression":"어휘 점수가 낮게 책정됨"},"general_feedback":"전반적으로 적절한 채점이나 표현 부분은 재검토 필요.","reviewed_at":"2024-11-15T11:00:00"}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid target_type or malformed review body.

### GET /api/admin/eval/reviews/{target_type}/{target_id}/my

Summary: Get my expert review
Operation ID: `get_my_review_api_admin_eval_reviews__target_type___target_id__my_get`

Description:

Get my expert review / 내 전문가 리뷰 조회

**EN:** Fetches the current admin's review for a specific submission or eval result.
Returns an empty object `{}` if no review has been submitted yet.

**KR:** 특정 제출 또는 평가 결과에 대한 현재 관리자의 리뷰를 가져옵니다.
아직 제출된 리뷰가 없으면 빈 객체 `{}`를 반환합니다.

**Path parameters / 경로 파라미터:**
- `target_type`: `submission` | `eval_result`
- `target_id`: UUID of the target

**Response example / 응답 예시:**
```json
{
  "agreement": "mostly_agree", "grade": "B",
  "disagreed_sections": ["expression"],
  "general_feedback": "채점 기준이 다소 엄격하게 적용된 것 같습니다.",
  "reviewed_at": "2024-11-15T11:00:00"
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|target_type|path|yes|enum<"submission" \| "eval_result">|-|-|
|target_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` The current admin's review for the target, or `{}` if none submitted yet.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[ExpertReview](../schemas/admin-eval.md#expertreview)|{"agreement":"mostly_agree","grade":"B","disagreed_sections":["expression"],"general_feedback":"채점 기준이 다소 엄격하게 적용된 것 같습니다.","reviewed_at":"2024-11-15T11:00:00"}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid target_type.

### POST /api/admin/eval/run

Summary: Trigger evaluation pipeline run
Operation ID: `trigger_eval_run_api_admin_eval_run_post`

Description:

Trigger evaluation pipeline run / 평가 파이프라인 실행 시작

**EN:** Starts an async evaluation subprocess for a given pipeline and dataset.
Returns a `run_id` immediately; poll `GET /api/admin/eval/run/{run_id}/status` for progress.

Available pipelines: `writing_scorer`, `content_generation`, `chat_tutor`,
`exam_feedback`, `chat_modes`, `q53_dsl`.

Modes: `full` (all cases), `quick` (fast subset), `stability` (repeat runs).

**KR:** 지정된 파이프라인과 데이터셋으로 비동기 평가 서브프로세스를 시작합니다.
`run_id`를 즉시 반환하고 `GET /api/admin/eval/run/{run_id}/status`로 진행 상황을 폴링합니다.

**Request example / 요청 예시:**
```json
{
  "pipeline": "writing_scorer",
  "dataset": "all",
  "mode": "quick",
  "case_filter": null
}
```

**Response example / 응답 예시:**
```json
{
  "run_id": "a1b2c3d4-...",
  "status": "running",
  "pipeline": "writing_scorer",
  "dataset": "all",
  "mode": "quick"
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
|application/json|[EvalRunRequest](../schemas/admin-eval.md#evalrunrequest)|-|

Responses:
- `200` Run started. Returns the run_id to poll for status.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[EvalRunResponse](../schemas/admin-eval.md#evalrunresponse)|{"run_id":"a1b2c3d4-...","status":"running","pipeline":"writing_scorer","dataset":"all","mode":"quick"}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid `pipeline` or `mode` (not in allowlist), or malformed `dataset`/`case_filter`.

### GET /api/admin/eval/run/{run_id}/status

Summary: Poll eval run status
Operation ID: `get_run_status_api_admin_eval_run__run_id__status_get`

Description:

Poll eval run status / 평가 실행 상태 조회

    **EN:** Returns the current status of an eval run. Status is stored in Redis
    for up to 2 hours after completion. Possible values: `running`, `completed`, `failed`, `error`.

    **KR:** 평가 실행의 현재 상태를 반환합니다. 상태는 완료 후 최대 2시간 동안 Redis에 저장됩니다.
    가능한 값: `running`, `completed`, `failed`, `error`.

    **Response example (completed) / 응답 예시 (완료):**
    ```json
    {
      "status": "completed",
      "exit_code": 0,
      "stdout_tail": "Passed: 18/20 cases (90.0%)
Avg score: 42.3",
      "stderr_tail": ""
    }
    ```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|run_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` Current run status. Values: running, completed, failed, error.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[EvalRunStatusResponse](../schemas/admin-eval.md#evalrunstatusresponse)|{"status":"completed","exit_code":0,"stdout_tail":"Passed: 18/20 cases (90.0%)\nAvg score: 42.3","stderr_tail":""}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `404` Run not found or expired (Redis TTL is 2 hours).
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
- `503` Redis unavailable.

### GET /api/admin/eval/stats/overview

Summary: Dashboard overview statistics
Operation ID: `get_overview_stats_api_admin_eval_stats_overview_get`

Description:

Dashboard overview statistics / 대시보드 개요 통계

**EN:** Returns high-level aggregate stats for the eval dashboard: total submissions,
graded count, average scores by task type, and recent activity.

**KR:** 평가 대시보드의 고수준 집계 통계를 반환합니다: 총 제출 수,
채점 수, 문제 유형별 평균 점수, 최근 활동.

**Response example / 응답 예시:**
```json
{
  "total_submissions": 1250,
  "graded": 1180,
  "pending": 70,
  "avg_score_by_task": { "task51": 38.2, "task53": 42.5, "task54": 55.1 },
  "submissions_last_7d": 320
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
- None declared.

Request body:
- None declared.

Responses:
- `200` High-level aggregate stats for the eval dashboard.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[OverviewStatsResponse](../schemas/admin-eval.md#overviewstatsresponse)|{"total_submissions":1250,"graded":1180,"pending":70,"avg_score_by_task":{"task51":38.2,"task53":42.5,"task54":55.1},"submissions_last_7d":320}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.

### GET /api/admin/eval/submissions/{submission_id}

Summary: Get submission detail
Operation ID: `get_submission_detail_api_admin_eval_submissions__submission_id__get`

Description:

Get submission detail / 제출 상세 조회

**EN:** Returns full detail for a single submission: the essay text, task metadata,
AI evaluation scores (per section), and all feedback objects.

**KR:** 단일 제출의 전체 상세 정보를 반환합니다: 에세이 텍스트, 문제 메타데이터,
AI 평가 점수 (섹션별), 모든 피드백 객체.

**Response example / 응답 예시:**
```json
{
  "submission_id": "uuid",
  "task_type": "task54",
  "text": "현대 사회에서...",
  "total_score": 58.0,
  "section_scores": { "content": 20, "structure": 18, "expression": 20 },
  "feedback": { "summary": "전반적으로 잘 작성된 글입니다..." },
  "graded_at": "2024-11-15T10:05:00"
}
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
- `200` Full submission detail: essay text, task metadata, section scores, and feedback.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[SubmissionDetailResponse](../schemas/admin-eval.md#submissiondetailresponse)|{"submission_id":"uuid","task_type":"task54","text":"현대 사회에서...","total_score":58,"section_scores":{"content":20,"structure":18,"expression":20},"feedback":{"summary":"전반적으로 잘 작성된 글입니다..."},"graded_at":"2024-11-15T10:05:00"}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `404` Submission not found.
- `422` Invalid submission_id (not a UUID).

### GET /api/admin/eval/users

Summary: List users with graded submissions
Operation ID: `list_eval_users_api_admin_eval_users_get`

Description:

List users with graded submissions / 채점된 제출이 있는 사용자 목록

**EN:** Returns a paginated list of users who have at least one graded submission.
Useful for browsing which learners have been evaluated.

**KR:** 채점된 제출이 하나 이상 있는 사용자의 페이지네이션 목록을 반환합니다.
어떤 학습자가 평가를 받았는지 탐색하는 데 유용합니다.

**Response example / 응답 예시:**
```json
{
  "items": [
    { "user_id": "uuid", "display_name": "홍길동", "submission_count": 5,
      "last_submitted_at": "2024-11-15T10:00:00" }
  ],
  "total": 1, "limit": 50, "offset": 0
}
```

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
- `200` Paginated list of users who have at least one graded submission.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[EvalUsersResponse](../schemas/admin-eval.md#evalusersresponse)|{"items":[{"user_id":"uuid","display_name":"홍길동","submission_count":5,"last_submitted_at":"2024-11-15T10:00:00"}],"total":1,"limit":50,"offset":0}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid pagination parameters.

### GET /api/admin/eval/users/{user_id}/submissions

Summary: List a user's graded submissions
Operation ID: `list_user_submissions_api_admin_eval_users__user_id__submissions_get`

Description:

List user's graded submissions / 사용자 채점 제출 목록

**EN:** Returns all graded writing submissions for a specific user, ordered
newest first. Includes scores and task metadata.

**KR:** 특정 사용자의 모든 채점된 작문 제출 목록을 최신순으로 반환합니다.
점수와 문제 메타데이터가 포함됩니다.

**Response example / 응답 예시:**
```json
{
  "items": [
    { "submission_id": "uuid", "task_type": "task54",
      "total_score": 58.0, "graded_at": "2024-11-15T10:05:00" }
  ],
  "total": 1, "limit": 50, "offset": 0
}
```

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token. Dashboard tokens come from POST /api/eval/auth/login.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|user_id|path|yes|string|-|-|
|limit|query|no|integer|-|{"default":50}|
|offset|query|no|integer|-|{"default":0}|

Request body:
- None declared.

Responses:
- `200` All graded writing submissions for the user, newest first.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[UserSubmissionsResponse](../schemas/admin-eval.md#usersubmissionsresponse)|{"items":[{"submission_id":"uuid","task_type":"task54","total_score":58,"graded_at":"2024-11-15T10:05:00"}],"total":1,"limit":50,"offset":0}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the `admin` role.
- `422` Invalid user_id (not a UUID) or invalid pagination parameters.
