# Admin Evaluation API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[DatasetResultsResponse](#datasetresultsresponse)|object|
|[DatasetsResponse](#datasetsresponse)|object|
|[DatasetStatsResponse](#datasetstatsresponse)|object|
|[EvalRunRequest](#evalrunrequest)|object|
|[EvalRunResponse](#evalrunresponse)|object|
|[EvalRunStatusResponse](#evalrunstatusresponse)|object|
|[EvalUserItem](#evaluseritem)|object|
|[EvalUsersResponse](#evalusersresponse)|object|
|[ExpertReview](#expertreview)|object|
|[OverviewStatsResponse](#overviewstatsresponse)|object|
|[ReviewListResponse](#reviewlistresponse)|object|
|[ReviewRequest](#reviewrequest)|object|
|[SubmissionDetailFeedback](#submissiondetailfeedback)|object|
|[SubmissionDetailResponse](#submissiondetailresponse)|object|
|[SubmissionDetailSubmission](#submissiondetailsubmission)|object|
|[SubmissionDetailTask](#submissiondetailtask)|object|
|[UserSubmissionItem](#usersubmissionitem)|object|
|[UserSubmissionsResponse](#usersubmissionsresponse)|object|

## DatasetResultsResponse

Paginated per-case results for an eval run.

Each item mirrors a full `eval_results` row (`SELECT *`) enriched with case
`input_data`, `description`, `title`, a coerced `passed` bool, and parsed
`judge_verdict`/`penalty_results`/`raw_output` JSON; passed through untyped.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<object<string, ->>|-|-|[[{"actual":42.5,"case_id":"tc001","expected_min":40,"score":42.5,"status":"passed"}]]|Enriched per-case result rows (passthrough).|
|total|yes|integer|-|-|[1]|Total matching results.|
|limit|yes|integer|-|-|[100]|Page size echoed back.|
|offset|yes|integer|-|-|[0]|Page offset echoed back.|

## DatasetsResponse

Paginated eval-run records from the SQLite eval database.

Each item mirrors a full `eval_datasets` row (`SELECT *`), so the column set
is schema-defined; items are passed through untyped to avoid dropping fields.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<object<string, ->>|-|-|[[{"created_at":"2024-11-15T10:00:00","id":"run-2024-11-15","mode":"full","passed":18,"pipeline":"writing_scorer","total":20}]]|Eval-run rows (passthrough; all eval_datasets columns).|
|total|yes|integer|-|-|[1]|Total matching eval runs.|
|limit|yes|integer|-|-|[50]|Page size echoed back.|
|offset|yes|integer|-|-|[0]|Page offset echoed back.|

## DatasetStatsResponse

Aggregate statistics for one eval run (from `compute_stats`).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|total|yes|integer|-|-|[20]|Total cases in the run.|
|passed|yes|integer|-|-|[18]|Number of passed cases.|
|failed|yes|integer|-|-|[2]|Number of failed cases.|
|pass_rate|yes|number|-|-|[0.9]|Passed / total, rounded to 4dp.|
|avg_score|yes|number|-|-|[42.3]|Average weighted score, rounded to 3dp.|
|total_cost_usd|yes|number|-|-|[0.0123]|Summed cost in USD, rounded to 6dp.|
|avg_processing_time|yes|number|-|-|[1.45]|Average processing time in seconds, rounded to 2dp.|

## EvalRunRequest

Type: `object`

Schema example:
```json
{
  "dataset": "all",
  "mode": "quick",
  "pipeline": "writing_scorer"
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|pipeline|no|string|-|writing_scorer|["writing_scorer"]<br>{"default":"writing_scorer"}|Pipeline to run. One of: writing_scorer, content_generation, chat_tutor, exam_feedback, chat_modes, q53_dsl.|
|dataset|no|string|-|all|["all"]<br>{"default":"all"}|Dataset name, or `all`. Safe token: alphanumeric start, no path separators or leading '-'.|
|mode|no|string|-|full|["quick"]<br>{"default":"full"}|Run mode. One of: full (all cases), quick (fast subset), stability (repeat runs).|
|case_filter|no|anyOf<string \| null>|-|-|["tc001"]|Optional single case id to run. Safe token: alphanumeric start, no path separators or leading '-'.|

## EvalRunResponse

Acknowledgement returned when an eval subprocess is started.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|run_id|yes|string|-|-|["a1b2c3d4-..."]|Run identifier to poll for status.|
|status|yes|string|-|-|["running"]|Initial run status (always `running`).|
|pipeline|yes|string|-|-|["writing_scorer"]|Pipeline that was started.|
|dataset|yes|string|-|-|["all"]|Dataset name, or `all`.|
|mode|yes|string|-|-|["quick"]|Run mode.|

## EvalRunStatusResponse

Current eval run state stored in Redis (TTL 2h).

Fields vary by phase: a `running` entry carries pipeline/dataset/mode/
triggered_by; a finished entry carries exit_code and stdout/stderr tails;
an internal failure carries `error`. All non-status fields are optional.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|status|yes|string|-|-|["completed"]|Run status: running, completed, failed, or error.|
|exit_code|no|anyOf<integer \| null>|-|-|[0]|Subprocess exit code (finished runs).|
|stdout_tail|no|anyOf<string \| null>|-|-|["Passed: 18/20 cases (90.0%)\nAvg score: 42.3"]|Last ~3000 chars of stdout (finished runs).|
|stderr_tail|no|anyOf<string \| null>|-|-|[""]|Last ~1000 chars of stderr (finished runs).|
|error|no|anyOf<string \| null>|-|-|[null]|Internal error message (status=error only).|
|pipeline|no|anyOf<string \| null>|-|-|["writing_scorer"]|Pipeline name (running entry).|
|dataset|no|anyOf<string \| null>|-|-|["all"]|Dataset name (running entry).|
|mode|no|anyOf<string \| null>|-|-|["quick"]|Run mode (running entry).|
|triggered_by|no|anyOf<string \| null>|-|-|["Admin"]|Display name of the admin who started the run.|

## EvalUserItem

A user who has at least one graded submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["uuid"]|User UUID.|
|email|no|anyOf<string \| null>|-|-|["learner@example.com"]|User email.|
|display_name|no|anyOf<string \| null>|-|-|["홍길동"]|User display name.|
|submission_count|yes|integer|-|-|[5]|Number of graded submissions by this user.|
|avg_score|no|anyOf<number \| null>|-|-|[48.5]|Average total score across graded submissions.|
|last_submitted_at|no|anyOf<string \| null>|-|-|["2024-11-15T10:00:00"]|ISO timestamp of the user's most recent submission.|

## EvalUsersResponse

Paginated list of users with graded submissions.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<EvalUserItem>|-|-|-|Users on the current page.|
|total|yes|integer|-|-|[1]|Total matching users.|
|limit|yes|integer|-|-|[50]|Page size echoed back.|
|offset|yes|integer|-|-|[0]|Page offset echoed back.|

## ExpertReview

A persisted expert review.

All fields are optional because `GET .../my` returns an empty object `{}`
when the current admin has not reviewed the target yet.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|no|anyOf<string \| null>|-|-|["uuid"]|Review UUID.|
|target_type|no|anyOf<string \| null>|-|-|["submission"]|Reviewed target type.|
|target_id|no|anyOf<string \| null>|-|-|["uuid"]|Reviewed target UUID.|
|reviewer_id|no|anyOf<string \| null>|-|-|["uuid"]|Reviewer user UUID.|
|reviewer_name|no|anyOf<string \| null>|-|-|["Admin A"]|Reviewer display name.|
|agreement|no|anyOf<string \| null>|-|-|["mostly_agree"]|Agreement: agree \| mostly_agree \| partial \| disagree \| '' (unset).|
|grade|no|anyOf<string \| null>|-|-|["B"]|Letter grade: A \| B \| C \| D \| F \| '' (unset).|
|disagreed_sections|no|anyOf<array<string> \| null>|-|-|[["expression"]]|Section keys the reviewer disagrees with.|
|section_feedbacks|no|anyOf<object<string, string> \| null>|-|-|[{"expression":"어휘 점수가 낮게 책정됨"}]|Per-section freeform feedback.|
|general_feedback|no|anyOf<string \| null>|-|-|["채점 기준이 다소 엄격하게 적용된 것 같습니다."]|Overall freeform feedback.|
|created_at|no|anyOf<string \| null>|-|-|["2024-11-15T11:00:00"]|ISO creation timestamp.|
|updated_at|no|anyOf<string \| null>|-|-|["2024-11-15T11:00:00"]|ISO last-update timestamp.|

## OverviewStatsResponse

High-level aggregate stats for the eval dashboard header.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|total_users|yes|integer|-|-|[1250]|Distinct users with graded submissions.|
|total_submissions|yes|integer|-|-|[1180]|Total graded submissions.|
|avg_score|no|anyOf<number \| null>|-|-|[42.3]|Average total score across graded submissions.|
|total_reviews|yes|integer|-|-|[70]|Total expert reviews submitted.|

## ReviewListResponse

All expert reviews submitted for a target (multi-reviewer).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<ExpertReview>|-|-|-|Reviews for the target.|
|total|yes|integer|-|-|[1]|Number of reviews returned.|

## ReviewRequest

Type: `object`

Schema example:
```json
{
  "agreement": "mostly_agree",
  "disagreed_sections": [
    "expression"
  ],
  "general_feedback": "전반적으로 적절한 채점이나 표현 부분은 재검토 필요.",
  "grade": "B",
  "section_feedbacks": {
    "expression": "어휘 점수가 낮게 책정됨"
  }
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|agreement|no|enum<"agree" \| "mostly_agree" \| "partial" \| "disagree" \| "">|"agree", "mostly_agree", "partial", "disagree", ""|-|["mostly_agree"]<br>{"default":""}|Reviewer's agreement with the AI grading. Empty string means unset.|
|grade|no|enum<"A" \| "B" \| "C" \| "D" \| "F" \| "">|"A", "B", "C", "D", "F", ""|-|["B"]<br>{"default":""}|Reviewer's letter grade for the output. Empty string means unset.|
|disagreed_sections|no|array<string>|-|-|[["expression"]]|Section keys the reviewer disagrees with (e.g. content, structure, expression).|
|section_feedbacks|no|object<string, string>|-|-|[{"expression":"어휘 점수가 낮게 책정됨"}]|Per-section freeform feedback, keyed by section name.|
|general_feedback|no|string|-|-|["전반적으로 적절한 채점이나 표현 부분은 재검토 필요."]<br>{"default":""}|Overall freeform feedback on the AI grading.|

## SubmissionDetailFeedback

AI feedback record within the detail response.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["uuid"]|Feedback UUID.|
|total_score|no|anyOf<number \| null>|-|-|[58]|Total score awarded.|
|max_score|no|anyOf<number \| null>|-|-|[100]|Maximum possible score.|
|trait_scores|no|object<string, ->|-|-|[{"content":20,"expression":20,"structure":18}]|Per-trait score breakdown (passthrough JSON).|
|errors|no|array<->|-|-|-|Detected errors (passthrough JSON list).|
|error_analysis|no|object<string, ->|-|-|-|Error analysis (passthrough JSON).|
|suggestions|no|array<->|-|-|-|Improvement suggestions (passthrough JSON list).|
|ai_summary|no|string|-|-|["전반적으로 잘 작성된 글입니다..."]<br>{"default":""}|AI summary text.|
|annotations|no|array<->|-|-|-|Inline annotations (passthrough JSON list).|

## SubmissionDetailResponse

Full submission detail: submission record, feedback, and linked task.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission|yes|[SubmissionDetailSubmission](./admin-eval.md#submissiondetailsubmission)|-|-|-|Submission record.|
|feedback|yes|[SubmissionDetailFeedback](./admin-eval.md#submissiondetailfeedback)|-|-|-|AI feedback record.|
|task|no|anyOf<SubmissionDetailTask \| null>|-|-|-|Linked writing task, or null if none.|

## SubmissionDetailSubmission

Core submission record within the detail response.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["uuid"]|Submission UUID.|
|user_id|yes|string|-|-|["uuid"]|Author user UUID.|
|user_email|no|anyOf<string \| null>|-|-|["learner@example.com"]|Author email.|
|user_display_name|no|anyOf<string \| null>|-|-|["홍길동"]|Author display name.|
|task_type|no|anyOf<string \| null>|-|-|["task54"]|Writing task type.|
|text|no|anyOf<string \| null>|-|-|["현대 사회에서..."]|Submitted essay text.|
|character_count|no|anyOf<integer \| null>|-|-|[512]|Character count of the essay.|
|submitted_at|no|anyOf<string \| null>|-|-|["2024-11-15T10:00:00"]|ISO submission timestamp.|
|status|no|anyOf<string \| null>|-|-|["graded"]|Submission status.|

## SubmissionDetailTask

Writing task metadata within the detail response (null when no task linked).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|no|anyOf<string \| null>|-|-|["uuid"]|Task UUID.|
|title|no|string|-|-|["나의 꿈"]<br>{"default":""}|Task title.|
|prompt|no|string|-|-|["..."]<br>{"default":""}|Task prompt text.|
|topic|no|string|-|-|["사회"]<br>{"default":""}|Task topic.|
|task_type|no|anyOf<string \| null>|-|-|["task54"]|Task type.|
|model_answer|no|anyOf<string \| null>|-|-|[null]|Reference model answer.|

## UserSubmissionItem

A single graded writing submission for a user.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["uuid"]|Submission UUID.|
|task_type|no|anyOf<string \| null>|-|-|["task54"]|Writing task type.|
|task_title|no|string|-|-|[""]<br>{"default":""}|Task title (empty if unknown).|
|topic|no|string|-|-|[""]<br>{"default":""}|Task topic (empty if unknown).|
|submitted_at|no|anyOf<string \| null>|-|-|["2024-11-15T10:05:00"]|ISO submission timestamp.|
|total_score|no|anyOf<number \| null>|-|-|[58]|Total score awarded.|
|max_score|no|anyOf<number \| null>|-|-|[100]|Maximum possible score.|
|trait_scores|no|object<string, ->|-|-|[{"content":20,"expression":20,"structure":18}]|Per-trait score breakdown (passthrough JSON).|

## UserSubmissionsResponse

Paginated list of a user's graded submissions.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<UserSubmissionItem>|-|-|-|Submissions on the current page.|
|total|yes|integer|-|-|[1]|Total graded submissions for the user.|
|limit|yes|integer|-|-|[50]|Page size echoed back.|
|offset|yes|integer|-|-|[0]|Page offset echoed back.|
