# Listening API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[ListeningAnswerResultResponse](#listeninganswerresultresponse)|object|
|[ListeningBookmarkResponse](#listeningbookmarkresponse)|object|
|[ListeningChoiceDTO](#listeningchoicedto)|object|
|[ListeningChoiceWithStatusDTO](#listeningchoicewithstatusdto)|object|
|[ListeningHistoryItem](#listeninghistoryitem)|object|
|[ListeningHistoryResponse](#listeninghistoryresponse)|object|
|[ListeningProblemDTO](#listeningproblemdto)|object|
|[ListeningQuestionTypeDTO](#listeningquestiontypedto)|object|
|[ListeningScriptDTO](#listeningscriptdto)|object|
|[ListeningScriptLineDTO](#listeningscriptlinedto)|object|
|[ListeningSessionCreateRequest](#listeningsessioncreaterequest)|object|
|[ListeningSessionResponse](#listeningsessionresponse)|object|
|[ListeningSessionResultsResponse](#listeningsessionresultsresponse)|object|
|[ListeningSessionSummary](#listeningsessionsummary)|object|
|[ListeningSubmissionItem](#listeningsubmissionitem)|object|
|[ListeningSubmitRequest](#listeningsubmitrequest)|object|
|[ListeningVocabularyItemDTO](#listeningvocabularyitemdto)|object|

## ListeningAnswerResultResponse

Response after submitting an answer.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"]|Unique submission identifier (UUID).|
|problem_id|yes|string|-|-|["3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the answered problem.|
|question_index|yes|integer|-|-|[0]|0-based index of the answered question within the session.|
|user_answer|yes|integer|-|-|[2]|Choice number the user selected (1-4).|
|correct_answer|yes|integer|-|-|[2]|Correct choice number (1-4).|
|is_correct|yes|boolean|-|-|[true]|True if the user's answer matches the correct answer.|
|explanation|yes|string|-|-|["남자가 '오후 세 시'라고 말했습니다."]|Explanation of why the correct answer is correct, in the session language.|
|wrong_analysis|no|string|-|-|["1번은 약속 시간이 아니라 현재 시간을 가리킵니다."]<br>{"default":""}|Analysis of common wrong choices; empty if the answer was correct or none provided.|
|script|no|anyOf<ListeningScriptDTO \| null>|-|-|[{"context":"","lines":[{"speaker":"male","speaker_label":"남자","text":"회의는 몇 시예요?"}]}]|Full listening script revealed after submission; null if unavailable.|
|choices_with_status|no|array<ListeningChoiceWithStatusDTO>|-|-|[[{"is_correct":true,"is_user_selected":true,"number":2,"status":"correct","text":"오후 세 시"}]]|All choices annotated with correctness and selection status for UI highlighting.|
|related_vocabulary|no|array<ListeningVocabularyItemDTO>|-|-|[[{"definition":"여러 사람이 모여 의논함.","reading":"회의","word":"회의"}]]|Vocabulary items from the script to help the user review.|
|xp_earned|no|integer|-|0|[10]<br>{"default":0}|Experience points awarded for this submission.|

## ListeningBookmarkResponse

Response for POST /api/listening/bookmark.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|problem_id|yes|string|-|-|["3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the bookmarked problem.|
|is_bookmarked|yes|boolean|-|-|[true]|True if the problem is now bookmarked, false if it was un-bookmarked.|

## ListeningChoiceDTO

Single multiple-choice option.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|number|yes|integer|-|-|[1]|Choice number (1-4).|
|text|yes|string|-|-|["오후 세 시"]|Choice text shown to the user, in Korean.|

## ListeningChoiceWithStatusDTO

Choice with correctness status (shown after submission).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|number|yes|integer|-|-|[2]|Choice number (1-4).|
|text|yes|string|-|-|["오후 세 시"]|Choice text shown to the user, in Korean.|
|is_correct|no|boolean|-|false|[true]<br>{"default":false}|True if this choice is the correct answer.|
|is_user_selected|no|boolean|-|false|[true]<br>{"default":false}|True if the user selected this choice.|
|status|no|string|-|neutral|["correct"]<br>{"default":"neutral"}|Display status for the choice. One of: 'correct', 'wrong', 'neutral'.|

## ListeningHistoryItem

Single item in a user's listening history.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"]|Unique submission identifier (UUID).|
|session_id|yes|string|-|-|["8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the session this submission belongs to.|
|problem_id|yes|string|-|-|["3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the answered problem.|
|question_type|yes|string|-|-|["dialogue"]|Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'.|
|level|yes|integer|-|-|[4]|TOPIK level of the problem (1-6).|
|user_answer|yes|integer|-|-|[2]|Choice number the user selected (1-4).|
|correct_answer|yes|integer|-|-|[2]|Correct choice number (1-4).|
|is_correct|yes|boolean|-|-|[true]|True if the user's answer was correct.|
|time_spent_seconds|yes|integer|-|-|[45]|Seconds spent on this question.|
|audio_play_count|yes|integer|-|-|[2]|Number of times the audio was played for this question.|
|submitted_at|yes|string|-|-|["2026-06-08T09:31:00Z"]|ISO 8601 timestamp when the answer was submitted.|

## ListeningHistoryResponse

Response for GET /api/listening/history.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|yes|string|-|-|["user_a1b2c3d4"]|Identifier of the user whose history is returned.|
|total|yes|integer|-|-|[42]|Total number of history items matching the query (across all pages).|
|items|no|array<ListeningHistoryItem>|-|-|[[{"audio_play_count":2,"correct_answer":2,"is_correct":true,"level":4,"problem_id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","question_type":"dialogue","session_id":"8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d","submission_id":"a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d","submitted_at":"2026-06-08T09:31:00Z","time_spent_seconds":45,"user_answer":2}]]|History items in the current page.|

## ListeningProblemDTO

Generated listening problem (answer hidden until submission).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d"]|Unique problem identifier (UUID).|
|question_type|yes|string|-|-|["dialogue"]|Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'.|
|difficulty|yes|string|-|-|["medium"]|Difficulty bucket. One of: 'easy', 'medium', 'hard'.|
|level|yes|integer|-|-|[4]|TOPIK level of the problem (1-6).|
|audio_url|no|anyOf<string \| null>|-|-|["/api/listening/audio/8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d/3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d.mp3?token=ab12cd34"]|HMAC-signed proxy URL for the TTS audio clip, shaped '/api/listening/audio/{session_id}/{problem_id}.mp3?token=...'. Null while audio is still generating.|
|audio_duration_seconds|no|integer|-|0|[18]<br>{"default":0}|Length of the audio clip in seconds; 0 if unknown/not yet generated.|
|question|yes|string|-|-|["남자는 몇 시에 회의를 시작합니까?"]|Question text shown to the user, in Korean.|
|choices|yes|array<ListeningChoiceDTO>|-|-|[[{"number":1,"text":"오후 두 시"},{"number":2,"text":"오후 세 시"},{"number":3,"text":"오후 네 시"},{"number":4,"text":"오후 다섯 시"}]]|The four multiple-choice options.|
|created_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the problem was created.|

## ListeningQuestionTypeDTO

Question type metadata for GET /api/listening/question-types.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|type|yes|string|-|-|["dialogue"]|Question type id. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'.|
|label|yes|string|-|-|["대화 듣기"]|Korean display label for the question type.|
|range|yes|string|-|-|["1-4"]|TOPIK question-number range this type covers.|
|description|no|string|-|-|["짧은 대화를 듣고 알맞은 그림이나 답을 고릅니다."]<br>{"default":""}|Short description of the question type; empty if none.|

## ListeningScriptDTO

Full listening script (shown after answer submission).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|lines|no|array<ListeningScriptLineDTO>|-|-|[[{"speaker":"male","speaker_label":"남자","text":"회의는 몇 시예요?"},{"speaker":"female","speaker_label":"여자","text":"오후 세 시예요."}]]|Ordered script lines making up the audio.|
|context|no|string|-|-|["사무실에서 두 동료가 대화하고 있다."]<br>{"default":""}|Optional scene/context description for the script; empty if none.|

## ListeningScriptLineDTO

Single line of a listening script (dialogue/narration).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|speaker|yes|string|-|-|["male"]|Speaker role driving the TTS voice. One of: 'male', 'female', 'narrator'.|
|speaker_label|no|string|-|-|["남자"]<br>{"default":""}|Human-readable speaker label shown in the UI, e.g. '남자', '여자', '나레이터'.|
|text|yes|string|-|-|["안녕하세요. 오늘 회의는 몇 시에 시작합니까?"]|The spoken text content of this line, in Korean.|

## ListeningSessionCreateRequest

Request body for POST /api/listening/session.
Type: `object`

Schema examples:
```json
[
  {
    "lang": "ko",
    "question_count": 3,
    "question_types": [
      "dialogue",
      "content_match"
    ],
    "target_level": 4
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|target_level|no|integer|-|4|[4]<br>{"default":4}|Target TOPIK level (1-6). Levels 1-2 use TOPIK I question types; 3-6 use TOPIK II.|
|question_types|no|array<string>|-|-|[["dialogue","content_match"]]|Question types to include. Empty list = random mix. Allowed: 'dialogue' (대화 1-4), 'discourse' (담화 5-8), 'chart_graph' (도표/그래프 9-12), 'content_match' (내용 일치 13-16), 'main_idea' (중심 내용 17-20), 'comprehensive' (종합 21-50).|
|question_count|no|integer|-|3|[3]<br>{"default":3}|Number of problems to generate for the session (1-10).|
|lang|no|string|-|ko|["ko"]<br>{"default":"ko"}|UI language code for LLM-generated responses. One of: ko, vi, en.|

## ListeningSessionResponse

Response for a created/retrieved listening session.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d"]|Unique session identifier (UUID).|
|config|yes|object<string, ->|-|-|[{"lang":"ko","question_count":3,"question_types":["dialogue"],"target_level":4}]|Session configuration echoed back (target_level, question_types, question_count, lang).|
|problems|yes|array<ListeningProblemDTO>|-|-|[[{"audio_duration_seconds":18,"choices":[{"number":1,"text":"오후 두 시"},{"number":2,"text":"오후 세 시"}],"created_at":"2026-06-08T09:30:00Z","difficulty":"medium","id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","level":4,"question":"남자는 몇 시에 회의를 시작합니까?","question_type":"dialogue"}]]|Generated problems for the session (correct answers hidden).|
|current_index|no|integer|-|0|[0]<br>{"default":0}|0-based index of the question the user is currently on.|
|total_questions|yes|integer|-|-|[3]|Total number of questions in the session.|
|status|yes|string|-|-|["in_progress"]|Session status. One of: 'in_progress', 'completed', 'abandoned'.|
|started_at|yes|string|-|-|["2026-06-08T09:30:00Z"]|ISO 8601 timestamp when the session started.|
|ai_audio_notice|no|string|-|Âm thanh trong bài luyện nghe này được tạo bởi AI, không phải giọng người thật.|{"default":"Âm thanh trong bài luyện nghe này được tạo bởi AI, không phải giọng người thật."}|Disclosure that audio is AI-generated (OpenRAIL-M model).|

## ListeningSessionResultsResponse

Response for GET session results.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|session_id|yes|string|-|-|["8c1e0b5a-6c7d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the session these results belong to.|
|submissions|no|array<ListeningSubmissionItem>|-|-|[[{"audio_play_count":2,"correct_answer":2,"explanation":"","is_correct":true,"problem_id":"3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d","question_type":"dialogue","submission_id":"a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d","submitted_at":"2026-06-08T09:31:00Z","time_spent_seconds":45,"user_answer":2,"wrong_analysis":""}]]|All submissions recorded for the session, in order.|
|summary|yes|[ListeningSessionSummary](./listening.md#listeningsessionsummary)|-|-|[{"accuracy":0.67,"average_audio_plays":1.5,"correct_count":2,"total_questions":3,"total_time_seconds":135}]|Aggregate statistics for the session.|

## ListeningSessionSummary

Summary statistics for a completed session.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|total_questions|no|integer|-|0|[3]<br>{"default":0}|Total number of questions in the session.|
|correct_count|no|integer|-|0|[2]<br>{"default":0}|Number of questions answered correctly.|
|accuracy|no|number|-|0|[0.67]<br>{"default":0}|Fraction of correct answers (0.0-1.0).|
|total_time_seconds|no|integer|-|0|[135]<br>{"default":0}|Total time spent across all questions, in seconds.|
|average_audio_plays|no|number|-|0|[1.5]<br>{"default":0}|Average number of audio plays per question.|

## ListeningSubmissionItem

Single submission entry within session results.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d"]|Unique submission identifier (UUID).|
|problem_id|yes|string|-|-|["3f9a7c2e-1b4d-4a6e-9c8f-2d1e0b5a6c7d"]|Identifier of the answered problem.|
|question_type|yes|string|-|-|["dialogue"]|Question type. One of: 'dialogue', 'discourse', 'chart_graph', 'content_match', 'main_idea', 'comprehensive'.|
|user_answer|yes|integer|-|-|[2]|Choice number the user selected (1-4).|
|correct_answer|yes|integer|-|-|[2]|Correct choice number (1-4).|
|is_correct|yes|boolean|-|-|[true]|True if the user's answer was correct.|
|time_spent_seconds|yes|integer|-|-|[45]|Seconds spent on this question.|
|audio_play_count|yes|integer|-|-|[2]|Number of times the audio was played for this question.|
|explanation|no|string|-|-|["남자가 '오후 세 시'라고 말했습니다."]<br>{"default":""}|Explanation of the correct answer; empty if none.|
|wrong_analysis|no|string|-|-|["1번은 현재 시간을 가리킵니다."]<br>{"default":""}|Analysis of wrong choices; empty if none.|
|submitted_at|yes|string|-|-|["2026-06-08T09:31:00Z"]|ISO 8601 timestamp when the answer was submitted.|

## ListeningSubmitRequest

Request body for POST /api/listening/session/{session_id}/submit.
Type: `object`

Schema examples:
```json
[
  {
    "audio_play_count": 2,
    "question_index": 0,
    "time_spent_seconds": 45,
    "user_answer": 2
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_index|yes|integer|-|-|[0]|0-based index of the question being answered within the session.|
|user_answer|yes|integer|-|-|[2]|Choice number selected by the user (1-4).|
|time_spent_seconds|no|integer|-|0|[45]<br>{"default":0}|Seconds the user spent on this question before submitting.|
|audio_play_count|no|integer|-|1|[2]<br>{"default":1}|Number of times the user played the audio clip for this question.|

## ListeningVocabularyItemDTO

Vocabulary item extracted from the listening script.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|word|yes|string|-|-|["회의"]|Korean vocabulary word or expression.|
|reading|no|string|-|-|["회의"]<br>{"default":""}|Pronunciation/reading aid for the word; empty if not provided.|
|definition|no|string|-|-|["여러 사람이 모여 의논함."]<br>{"default":""}|Definition or gloss of the word; empty if not provided.|
