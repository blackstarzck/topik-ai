# Reading API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[ReadingBookmarkResponse](#readingbookmarkresponse)|object|
|[ReadingChoiceResponse](#readingchoiceresponse)|object|
|[ReadingGenerateRequest](#readinggeneraterequest)|object|
|[ReadingHistoryItem](#readinghistoryitem)|object|
|[ReadingHistoryResponse](#readinghistoryresponse)|object|
|[ReadingProblemResponse](#readingproblemresponse)|object|
|[ReadingQuestionTypeInfo](#readingquestiontypeinfo)|object|
|[ReadingSessionCreateRequest](#readingsessioncreaterequest)|object|
|[ReadingSessionProblemDTO](#readingsessionproblemdto)|object|
|[ReadingSessionResponse](#readingsessionresponse)|object|
|[ReadingSessionResultsResponse](#readingsessionresultsresponse)|object|
|[ReadingSessionSubmitRequest](#readingsessionsubmitrequest)|object|
|[ReadingSessionSubmitResponse](#readingsessionsubmitresponse)|object|
|[ReadingSubmitRequest](#readingsubmitrequest)|object|
|[ReadingSubmitResponse](#readingsubmitresponse)|object|

## ReadingBookmarkResponse

Response for POST /api/reading/bookmark.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|problem_id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Identifier of the bookmarked problem.|
|is_bookmarked|yes|boolean|-|-|[true]|Bookmark state after the toggle: true if now bookmarked.|

## ReadingChoiceResponse

Single choice option.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|number|yes|integer|-|-|[1]|Choice number, 1-4.|
|text|yes|string|-|-|["글쓴이는 도시 생활을 선호한다."]|Choice display text.|

## ReadingGenerateRequest

Request body for POST /api/reading/generate.
Type: `object`

Schema examples:
```json
[
  {
    "count": 1,
    "difficulty": "medium",
    "lang": "ko",
    "question_number_range": "35-38",
    "question_type": "content_match",
    "topic": "사회",
    "topik_level": 4
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_type|no|anyOf<string \| null>|-|-|["content_match"]|TOPIK II reading question type. One of: fill_in_blank (31-34), content_match (35-38), ordering (39-41), topic_title (42-43), blank_inference (44-45), main_idea (46-47), long_reading (48-50). Null lets the server pick randomly.|
|question_number_range|no|anyOf<string \| null>|-|-|["35-38"]|Original TOPIK question-number range for the type, e.g. '31-34', '35-38'. Null if unspecified.|
|difficulty|no|string|-|medium|["medium"]<br>{"default":"medium"}|Problem difficulty. One of: easy, medium, hard.|
|topik_level|no|anyOf<integer \| null>|-|-|[4]|Target TOPIK level, integer 3-6. Null lets the server decide.|
|topic|no|anyOf<string \| null>|-|-|["사회"]|Optional subject/theme (Korean) to bias generation, e.g. '사회', '경제', '문화'. Null for any topic.|
|count|no|integer|-|1|[1]<br>{"default":1}|Number of problems to generate, 1-10.|
|lang|no|string|-|ko|["ko"]<br>{"default":"ko"}|UI language for LLM-generated text. One of: ko, en, vi.|

## ReadingHistoryItem

Single item in reading history.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["sub_9d8c7b6a"]|Identifier of the submission.|
|problem_id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Identifier of the answered problem.|
|question_type|yes|string|-|-|["content_match"]|Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading.|
|user_answer|yes|integer|-|-|[2]|Choice number the user submitted, 1-4.|
|correct_answer|yes|integer|-|-|[2]|Correct choice number, 1-4.|
|is_correct|yes|boolean|-|-|[true]|Whether the submitted answer was correct.|
|time_spent_seconds|yes|integer|-|-|[45]|Seconds the user spent on the problem.|
|submitted_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the answer was submitted.|

## ReadingHistoryResponse

Response for GET /api/reading/history.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|yes|string|-|-|["user_a1b2c3d4"]|Identifier of the user whose history this is.|
|total|yes|integer|-|-|[42]|Total number of history items for the user.|
|items|no|array<ReadingHistoryItem>|-|-|[[{"correct_answer":2,"is_correct":true,"problem_id":"3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b","question_type":"content_match","submission_id":"sub_9d8c7b6a","submitted_at":"2026-06-08T09:30:00Z","time_spent_seconds":45,"user_answer":2}]]|Reading submission history items, newest first.|

## ReadingProblemResponse

Generated reading problem (answer hidden).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Unique problem identifier.|
|question_type|yes|string|-|-|["content_match"]|Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading.|
|difficulty|yes|string|-|-|["medium"]|Problem difficulty. One of: easy, medium, hard.|
|passage|yes|string|-|-|["요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ..."]|Reading passage text the question is based on.|
|question|yes|string|-|-|["윗글의 내용과 같은 것을 고르십시오."]|Question prompt shown to the student.|
|choices|yes|array<ReadingChoiceResponse>|-|-|[[{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}]]|Multiple-choice options (typically 4).|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the problem was generated.|

## ReadingQuestionTypeInfo

Question type metadata.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|type|yes|string|-|-|["content_match"]|Question type key. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading.|
|label|yes|string|-|-|["내용 일치"]|Human-readable label for the question type.|
|range|yes|string|-|-|["35-38번"]|Original TOPIK question-number range for this type.|
|description|yes|string|-|-|["글의 내용과 일치하는 것을 선택하는 문제"]|Short description of what the question type tests.|

## ReadingSessionCreateRequest

Request body for POST /api/reading/session.
Type: `object`

Schema examples:
```json
[
  {
    "lang": "ko",
    "question_count": 5,
    "question_types": [
      "content_match",
      "main_idea"
    ],
    "target_level": 4
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|target_level|no|integer|-|4|[4]<br>{"default":4}|Target TOPIK level, integer 1-6.|
|question_types|no|array<string>|-|-|[["content_match","main_idea"]]|Question types to include; empty list means random mix. Allowed values: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading.|
|question_count|no|integer|-|5|[5]<br>{"default":5}|Number of questions in the session, 1-20.|
|lang|no|string|-|ko|["ko"]<br>{"default":"ko"}|UI language for LLM-generated text. One of: ko, en, vi.|

## ReadingSessionProblemDTO

Problem within a session (answer hidden).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Unique problem identifier.|
|question_type|yes|string|-|-|["content_match"]|Reading question type. One of: fill_in_blank, content_match, ordering, topic_title, blank_inference, main_idea, long_reading.|
|difficulty|yes|string|-|-|["medium"]|Problem difficulty. One of: easy, medium, hard.|
|passage|yes|string|-|-|["요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ..."]|Reading passage text the question is based on.|
|question|yes|string|-|-|["윗글의 내용과 같은 것을 고르십시오."]|Question prompt shown to the student.|
|choices|yes|array<ReadingChoiceResponse>|-|-|[[{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}]]|Multiple-choice options (typically 4).|

## ReadingSessionResponse

Response for reading session state.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|session_id|yes|string|-|-|["sess_7a6b5c4d"]|Unique session identifier.|
|status|yes|string|-|-|["active"]|Session status. One of: active, completed, abandoned.|
|total_questions|yes|integer|-|-|[5]|Total number of questions in the session.|
|current_index|yes|integer|-|-|[0]|Zero-based index of the next question to answer.|
|problems|yes|array<ReadingSessionProblemDTO>|-|-|[[{"choices":[{"number":1,"text":"도시의 자전거 이용자가 줄고 있다."},{"number":2,"text":"도시의 자전거 이용자가 늘고 있다."}],"difficulty":"medium","id":"3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b","passage":"요즘 도시에서는 자전거를 이용하는 사람들이 늘고 있다. ...","question":"윗글의 내용과 같은 것을 고르십시오.","question_type":"content_match"}]]|Problems in the session (answers hidden).|
|started_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the session started.|
|completed_at|no|anyOf<string \| null>|-|-|["2026-06-08T09:45:00Z"]|ISO 8601 timestamp when the session completed; null while active.|

## ReadingSessionResultsResponse

Response for session results.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|session_id|yes|string|-|-|["sess_7a6b5c4d"]|Unique session identifier.|
|status|yes|string|-|-|["completed"]|Session status. One of: active, completed, abandoned.|
|total_questions|yes|integer|-|-|[5]|Total number of questions in the session.|
|correct_count|yes|integer|-|-|[4]|Number of questions answered correctly.|
|score|yes|number|-|-|[80]|Session score as a percentage, 0-100.|
|per_question|yes|array<object<string, ->>|-|-|[[{"correct_answer":2,"is_correct":true,"question_index":0,"user_answer":2}]]|Per-question result breakdown; each item describes one question's outcome.|
|started_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the session started.|
|completed_at|no|anyOf<string \| null>|-|-|["2026-06-08T09:45:00Z"]|ISO 8601 timestamp when the session completed; null if not finished.|

## ReadingSessionSubmitRequest

Request body for POST /api/reading/session/{id}/submit.
Type: `object`

Schema examples:
```json
[
  {
    "question_index": 0,
    "time_spent_seconds": 45,
    "user_answer": 2
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_index|yes|integer|-|-|[0]|Zero-based index of the question being answered within the session.|
|user_answer|yes|integer|-|-|[2]|Selected choice number, 1-4.|
|time_spent_seconds|no|integer|-|0|[45]<br>{"default":0}|Seconds the user spent on this question.|

## ReadingSessionSubmitResponse

Response after submitting a session answer.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|is_correct|yes|boolean|-|-|[true]|Whether the submitted answer was correct.|
|correct_answer|yes|integer|-|-|[2]|Correct choice number, 1-4.|
|explanation|yes|string|-|-|["지문에서 도시의 자전거 이용자가 늘고 있다고 했으므로 2번이 정답입니다."]|Explanation of why the correct answer is correct.|
|xp_earned|no|integer|-|0|[10]<br>{"default":0}|Experience points awarded for this answer.|
|session_complete|no|boolean|-|false|[false]<br>{"default":false}|True if this answer was the last one and the session is now complete.|
|current_index|no|integer|-|0|[1]<br>{"default":0}|Zero-based index of the next question to answer.|

## ReadingSubmitRequest

Request body for POST /api/reading/submit.
Type: `object`

Schema examples:
```json
[
  {
    "problem_id": "3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b",
    "time_spent_seconds": 45,
    "user_answer": 2
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|problem_id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Identifier of the problem being answered.|
|user_answer|yes|integer|-|-|[2]|Selected choice number, 1-4.|
|time_spent_seconds|no|integer|-|0|[45]<br>{"default":0}|Seconds the user spent on the problem.|

## ReadingSubmitResponse

Response after submitting an answer.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["sub_9d8c7b6a"]|Server-generated identifier for this submission.|
|problem_id|yes|string|-|-|["3f9a1b2c-4d5e-6f70-8a9b-0c1d2e3f4a5b"]|Identifier of the answered problem.|
|is_correct|yes|boolean|-|-|[true]|Whether the submitted answer was correct.|
|user_answer|yes|integer|-|-|[2]|Choice number the user submitted, 1-4.|
|correct_answer|yes|integer|-|-|[2]|Correct choice number, 1-4.|
|explanation|yes|string|-|-|["지문에서 도시의 자전거 이용자가 늘고 있다고 했으므로 2번이 정답입니다."]|Explanation of why the correct answer is correct.|
|xp_earned|no|integer|-|0|[10]<br>{"default":0}|Experience points awarded for this submission.|
