# Writing API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[DeleteSubmissionResponse](#deletesubmissionresponse)|object|
|[SaveDraftRequest](#savedraftrequest)|object|
|[SaveDraftResponse](#savedraftresponse)|object|
|[SubmissionResponse](#submissionresponse)|object|
|[TopikWriting51Response](#topikwriting51response)|object|
|[TopikWriting52Response](#topikwriting52response)|object|
|[TopikWriting53Response](#topikwriting53response)|object|
|[TopikWriting54Response](#topikwriting54response)|object|
|[TopikWritingQuestionListResponse](#topikwritingquestionlistresponse)|object|
|[WritingChatRequest](#writingchatrequest)|object|
|[WritingGenerateRequestV2](#writinggeneraterequestv2)|object|
|[WritingHistoryItem](#writinghistoryitem)|object|
|[WritingHistoryResponse](#writinghistoryresponse)|object|
|[WritingRecommendationItem](#writingrecommendationitem)|object|
|[WritingRecommendationListResponse](#writingrecommendationlistresponse)|object|
|[WritingSubmitRequest](#writingsubmitrequest)|object|

## DeleteSubmissionResponse

Result of deleting a writing submission / 작문 제출 삭제 결과.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|success|yes|boolean|-|-|[true]|Whether the deletion succeeded / 삭제 성공 여부|
|deleted_id|yes|string|-|-|["f47ac10b-58cc-4372-a567-0e02b2c3d479"]|UUID of the deleted submission / 삭제된 제출 UUID|

## SaveDraftRequest

Type: `object`

Schema example:
```json
{
  "task_id": "abc123",
  "task_type": "Q53",
  "text": "현대 사회에서 스트레스를 관리하는 방법...",
  "time_spent": 120
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|task_type|yes|string|-|-|["Q53"]|Task type the draft belongs to / 초안이 속한 문제 유형 (Q51 \| Q53 \| Q54)|
|task_id|no|anyOf<string \| null>|-|-|["abc123"]|Optional specific task UUID; a random task of task_type is chosen if omitted / 문제 UUID (생략 시 무작위 선택)|
|text|yes|string|-|-|["현대 사회에서 스트레스를 관리하는 방법..."]|Current draft essay text to persist / 저장할 작문 초안 텍스트|
|time_spent|no|integer|-|0|[120]<br>{"default":0}|Seconds the user has spent on this draft so far / 초안에 소요한 시간(초)|

## SaveDraftResponse

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["draft-f47ac10b"]|UUID of the saved draft submission / 저장된 초안 제출 UUID|
|saved_at|yes|string|-|-|["2024-11-15T09:35:22"]|ISO-8601 timestamp when the draft was saved / 초안 저장 시각 (ISO-8601)|
|character_count|yes|integer|-|-|[45]|Character count of the saved draft text / 저장된 초안 텍스트의 글자 수|

## SubmissionResponse

Response acknowledging an accepted writing submission.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|["sub_9d8c7b6a"]|Server-generated identifier for the submission; use to poll for feedback.|
|status|yes|string|-|-|["queued"]|Current processing status, e.g. 'queued', 'processing', 'completed'.|
|message|yes|string|-|-|["Submission received and queued for evaluation."]|Human-readable status message for display to the user.|

## TopikWriting51Response

Q51 실용문 빈칸 완성형 (56 keys).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_id|yes|string|-|-|-|-|
|created_at|yes|string|-|-|-|-|
|updated_at|no|anyOf<string \| null>|-|-|-|-|
|schema_version|yes|string|-|-|-|-|
|source_exam_reference|no|anyOf<string \| null>|-|-|-|-|
|source_reference|no|anyOf<string \| null>|-|-|-|-|
|exam_name|yes|string|-|-|-|-|
|section|yes|string|-|-|-|-|
|question_type_code|yes|string|-|-|-|-|
|question_type_name|yes|string|-|-|-|-|
|target_level|no|anyOf<string \| null>|-|-|-|-|
|difficulty_level|no|anyOf<integer \| null>|-|-|-|-|
|topic_main|yes|string|-|-|-|-|
|topic_detail|yes|string|-|-|-|-|
|secondary_topic_main|no|anyOf<string \| null>|-|-|-|-|
|secondary_topic_detail|no|anyOf<string \| null>|-|-|-|-|
|topic_source|yes|string|-|-|-|-|
|text_type|no|anyOf<string \| null>|-|-|-|-|
|speech_act|no|anyOf<string \| null>|-|-|-|-|
|relation|no|anyOf<string \| null>|-|-|-|-|
|scenario_type|yes|string|-|-|-|-|
|situation_summary|yes|string|-|-|-|-|
|learning_goal_summary|no|anyOf<string \| null>|-|-|-|-|
|prompt_text|yes|string|-|-|-|-|
|resolved_text|no|anyOf<string \| null>|-|-|-|-|
|model_answer|no|anyOf<string \| null>|-|-|-|-|
|answer_key|no|anyOf<object<string, -> \| null>|-|-|-|-|
|review_status|yes|string|-|-|-|-|
|service_status|yes|string|-|-|-|-|
|auto_checks_passed|no|anyOf<boolean \| null>|-|-|-|-|
|review_passed|no|anyOf<boolean \| null>|-|-|-|-|
|recommendation_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|avoid_repeat_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|content_team_memo|no|anyOf<string \| null>|-|-|-|-|
|item_number|yes|const<51>|-|-|-|-|
|blank_count|no|anyOf<integer \| null>|-|-|-|-|
|text_state|no|anyOf<string \| null>|-|-|-|-|
|blank_notation_policy|no|anyOf<string \| null>|-|-|-|-|
|grammar_patterns|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_1_position|no|anyOf<string \| null>|-|-|-|-|
|blank_1_role|no|anyOf<string \| null>|-|-|-|-|
|blank_1_function|no|anyOf<string \| null>|-|-|-|-|
|blank_1_answer_type|no|anyOf<string \| null>|-|-|-|-|
|blank_1_canonical_answer|no|anyOf<string \| null>|-|-|-|-|
|blank_1_accepted_answers|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_1_accepted_synonyms|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_1_target_note|no|anyOf<string \| null>|-|-|-|-|
|blank_2_position|no|anyOf<string \| null>|-|-|-|-|
|blank_2_role|no|anyOf<string \| null>|-|-|-|-|
|blank_2_function|no|anyOf<string \| null>|-|-|-|-|
|blank_2_answer_type|no|anyOf<string \| null>|-|-|-|-|
|blank_2_canonical_answer|no|anyOf<string \| null>|-|-|-|-|
|blank_2_accepted_answers|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_2_accepted_synonyms|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_2_target_note|no|anyOf<string \| null>|-|-|-|-|
|validation_result|no|anyOf<object<string, -> \| null>|-|-|-|-|

## TopikWriting52Response

Q52 문장·문단 완성형 (52 keys).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_id|yes|string|-|-|-|-|
|created_at|yes|string|-|-|-|-|
|updated_at|no|anyOf<string \| null>|-|-|-|-|
|schema_version|yes|string|-|-|-|-|
|source_exam_reference|no|anyOf<string \| null>|-|-|-|-|
|source_reference|no|anyOf<string \| null>|-|-|-|-|
|exam_name|yes|string|-|-|-|-|
|section|yes|string|-|-|-|-|
|question_type_code|yes|string|-|-|-|-|
|question_type_name|yes|string|-|-|-|-|
|target_level|no|anyOf<string \| null>|-|-|-|-|
|difficulty_level|no|anyOf<integer \| null>|-|-|-|-|
|topic_main|yes|string|-|-|-|-|
|topic_detail|yes|string|-|-|-|-|
|secondary_topic_main|no|anyOf<string \| null>|-|-|-|-|
|secondary_topic_detail|no|anyOf<string \| null>|-|-|-|-|
|topic_source|yes|string|-|-|-|-|
|text_type|no|anyOf<string \| null>|-|-|-|-|
|speech_act|no|anyOf<string \| null>|-|-|-|-|
|relation|no|anyOf<string \| null>|-|-|-|-|
|scenario_type|yes|string|-|-|-|-|
|situation_summary|yes|string|-|-|-|-|
|learning_goal_summary|no|anyOf<string \| null>|-|-|-|-|
|prompt_text|yes|string|-|-|-|-|
|resolved_text|no|anyOf<string \| null>|-|-|-|-|
|model_answer|no|anyOf<string \| null>|-|-|-|-|
|answer_key|no|anyOf<object<string, -> \| null>|-|-|-|-|
|review_status|yes|string|-|-|-|-|
|service_status|yes|string|-|-|-|-|
|auto_checks_passed|no|anyOf<boolean \| null>|-|-|-|-|
|review_passed|no|anyOf<boolean \| null>|-|-|-|-|
|recommendation_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|avoid_repeat_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|content_team_memo|no|anyOf<string \| null>|-|-|-|-|
|item_number|yes|const<52>|-|-|-|-|
|completion_unit|no|anyOf<string \| null>|-|-|-|-|
|required_sentence_count|no|anyOf<integer \| null>|-|-|-|-|
|blank_count|no|anyOf<integer \| null>|-|-|-|-|
|connection_function|no|anyOf<string \| null>|-|-|-|-|
|clue_before_text|no|anyOf<string \| null>|-|-|-|-|
|clue_after_text|no|anyOf<string \| null>|-|-|-|-|
|required_expression_function|no|anyOf<string \| null>|-|-|-|-|
|sentence_complexity|no|anyOf<string \| null>|-|-|-|-|
|answer_scope_type|no|anyOf<string \| null>|-|-|-|-|
|grammar_patterns|no|anyOf<array<-> \| null>|-|-|-|-|
|paragraph_role|no|anyOf<string \| null>|-|-|-|-|
|cohesion_focus|no|anyOf<string \| null>|-|-|-|-|
|blank_1_canonical_answer|no|anyOf<string \| null>|-|-|-|-|
|blank_1_accepted_answers|no|anyOf<array<-> \| null>|-|-|-|-|
|blank_2_canonical_answer|no|anyOf<string \| null>|-|-|-|-|
|blank_2_accepted_answers|no|anyOf<array<-> \| null>|-|-|-|-|
|scoring_notes|no|anyOf<string \| null>|-|-|-|-|

## TopikWriting53Response

Q53 자료 설명형 (53 keys — reference omits scoring_focus).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_id|yes|string|-|-|-|-|
|created_at|yes|string|-|-|-|-|
|updated_at|no|anyOf<string \| null>|-|-|-|-|
|schema_version|yes|string|-|-|-|-|
|source_exam_reference|no|anyOf<string \| null>|-|-|-|-|
|source_reference|no|anyOf<string \| null>|-|-|-|-|
|exam_name|yes|string|-|-|-|-|
|section|yes|string|-|-|-|-|
|question_type_code|yes|string|-|-|-|-|
|question_type_name|yes|string|-|-|-|-|
|target_level|no|anyOf<string \| null>|-|-|-|-|
|difficulty_level|no|anyOf<integer \| null>|-|-|-|-|
|topic_main|yes|string|-|-|-|-|
|topic_detail|yes|string|-|-|-|-|
|secondary_topic_main|no|anyOf<string \| null>|-|-|-|-|
|secondary_topic_detail|no|anyOf<string \| null>|-|-|-|-|
|topic_source|yes|string|-|-|-|-|
|text_type|no|anyOf<string \| null>|-|-|-|-|
|speech_act|no|anyOf<string \| null>|-|-|-|-|
|relation|no|anyOf<string \| null>|-|-|-|-|
|scenario_type|yes|string|-|-|-|-|
|situation_summary|yes|string|-|-|-|-|
|learning_goal_summary|no|anyOf<string \| null>|-|-|-|-|
|prompt_text|yes|string|-|-|-|-|
|resolved_text|no|anyOf<string \| null>|-|-|-|-|
|model_answer|no|anyOf<string \| null>|-|-|-|-|
|answer_key|no|anyOf<object<string, -> \| null>|-|-|-|-|
|review_status|yes|string|-|-|-|-|
|service_status|yes|string|-|-|-|-|
|auto_checks_passed|no|anyOf<boolean \| null>|-|-|-|-|
|review_passed|no|anyOf<boolean \| null>|-|-|-|-|
|recommendation_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|avoid_repeat_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|content_team_memo|no|anyOf<string \| null>|-|-|-|-|
|item_number|yes|const<53>|-|-|-|-|
|data_type|no|anyOf<string \| null>|-|-|-|-|
|data_topic|no|anyOf<string \| null>|-|-|-|-|
|chart_title|no|anyOf<string \| null>|-|-|-|-|
|chart_unit|no|anyOf<string \| null>|-|-|-|-|
|comparison_target_count|no|anyOf<integer \| null>|-|-|-|-|
|data_series_count|no|anyOf<integer \| null>|-|-|-|-|
|number_expression_required|no|anyOf<boolean \| null>|-|-|-|-|
|comparison_type|no|anyOf<string \| null>|-|-|-|-|
|change_type|no|anyOf<string \| null>|-|-|-|-|
|key_findings|no|anyOf<array<-> \| null>|-|-|-|-|
|required_structure|no|anyOf<array<-> \| null>|-|-|-|-|
|expression_set|no|anyOf<array<-> \| null>|-|-|-|-|
|word_count_min|no|anyOf<integer \| null>|-|-|-|-|
|word_count_max|no|anyOf<integer \| null>|-|-|-|-|
|interpretation_difficulty|no|anyOf<string \| null>|-|-|-|-|
|prohibited_elements|no|anyOf<array<-> \| null>|-|-|-|-|
|source_data|no|anyOf<object<string, -> \| null>|-|-|-|-|
|data_asset_url|no|anyOf<string \| null>|-|-|-|-|

## TopikWriting54Response

Q54 논술·의견 제시형 (51 keys).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_id|yes|string|-|-|-|-|
|created_at|yes|string|-|-|-|-|
|updated_at|no|anyOf<string \| null>|-|-|-|-|
|schema_version|yes|string|-|-|-|-|
|source_exam_reference|no|anyOf<string \| null>|-|-|-|-|
|source_reference|no|anyOf<string \| null>|-|-|-|-|
|exam_name|yes|string|-|-|-|-|
|section|yes|string|-|-|-|-|
|question_type_code|yes|string|-|-|-|-|
|question_type_name|yes|string|-|-|-|-|
|target_level|no|anyOf<string \| null>|-|-|-|-|
|difficulty_level|no|anyOf<integer \| null>|-|-|-|-|
|topic_main|yes|string|-|-|-|-|
|topic_detail|yes|string|-|-|-|-|
|secondary_topic_main|no|anyOf<string \| null>|-|-|-|-|
|secondary_topic_detail|no|anyOf<string \| null>|-|-|-|-|
|topic_source|yes|string|-|-|-|-|
|text_type|no|anyOf<string \| null>|-|-|-|-|
|speech_act|no|anyOf<string \| null>|-|-|-|-|
|relation|no|anyOf<string \| null>|-|-|-|-|
|scenario_type|yes|string|-|-|-|-|
|situation_summary|yes|string|-|-|-|-|
|learning_goal_summary|no|anyOf<string \| null>|-|-|-|-|
|prompt_text|yes|string|-|-|-|-|
|resolved_text|no|anyOf<string \| null>|-|-|-|-|
|model_answer|no|anyOf<string \| null>|-|-|-|-|
|answer_key|no|anyOf<object<string, -> \| null>|-|-|-|-|
|review_status|yes|string|-|-|-|-|
|service_status|yes|string|-|-|-|-|
|auto_checks_passed|no|anyOf<boolean \| null>|-|-|-|-|
|review_passed|no|anyOf<boolean \| null>|-|-|-|-|
|recommendation_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|avoid_repeat_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|content_team_memo|no|anyOf<string \| null>|-|-|-|-|
|item_number|yes|const<54>|-|-|-|-|
|essay_type|no|anyOf<string \| null>|-|-|-|-|
|issue_topic|no|anyOf<string \| null>|-|-|-|-|
|prompt_questions|no|anyOf<array<-> \| null>|-|-|-|-|
|stance_requirement|no|anyOf<string \| null>|-|-|-|-|
|required_structure|no|anyOf<array<-> \| null>|-|-|-|-|
|required_reason_count|no|anyOf<integer \| null>|-|-|-|-|
|example_requirement|no|anyOf<string \| null>|-|-|-|-|
|word_count_min|no|anyOf<integer \| null>|-|-|-|-|
|word_count_max|no|anyOf<integer \| null>|-|-|-|-|
|reasoning_pattern|no|anyOf<string \| null>|-|-|-|-|
|argument_keywords|no|anyOf<array<-> \| null>|-|-|-|-|
|vocabulary_level|no|anyOf<string \| null>|-|-|-|-|
|scoring_focus|no|anyOf<array<-> \| null>|-|-|-|-|
|prohibited_elements|no|anyOf<array<-> \| null>|-|-|-|-|
|model_outline|no|anyOf<object<string, -> \| null>|-|-|-|-|
|rubric|no|anyOf<object<string, -> \| null>|-|-|-|-|

## TopikWritingQuestionListResponse

Paginated list of TOPIK writing questions (rich §7 metadata, per item type).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<oneOf<TopikWriting51Response \| TopikWriting52Response \| TopikWriting53Response \| TopikWriting54Response>>|-|-|-|Questions of the requested item type; each item is the §7 discriminated union shape (keyed by item_number).|
|total|yes|integer|-|-|[62]|Total questions matching the filters, ignoring pagination.|
|limit|yes|integer|-|-|[10]|Page size applied.|
|offset|yes|integer|-|-|[0]|Offset applied.|

## WritingChatRequest

Request for chat tutor interaction.
Type: `object`

Schema examples:
```json
[
  {
    "active_blank": "",
    "consecutive_wrong": 2,
    "conversation_history": [
      {
        "content": "이 표현이 맞나요?",
        "role": "user"
      },
      {
        "content": "네, 자연스럽습니다.",
        "role": "assistant"
      }
    ],
    "essay_text": "현대 사회에서 의사소통은 매우 중요하다. ...",
    "lang": "ko",
    "message": "이 문장을 더 자연스럽게 고치려면 어떻게 해야 하나요?",
    "passage_context": "",
    "previous_draft": "현대 사회에서 의사소통이 중요하다. ...",
    "task_id": "Q54",
    "topic": "의사소통의 중요성",
    "user_id": "user_a1b2c3d4"
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|no|anyOf<string \| null>|-|-|["user_a1b2c3d4"]|Authenticated user identifier; null for anonymous/guest sessions.|
|task_id|no|enum<"Q51" \| "Q52" \| "Q53" \| "Q54">|"Q51", "Q52", "Q53", "Q54"|Q54|["Q54"]<br>{"default":"Q54"}|TOPIK II writing task type the chat is about. One of: Q51, Q52, Q53, Q54.|
|message|yes|string|-|-|["이 문장을 더 자연스럽게 고치려면 어떻게 해야 하나요?"]|Student's chat message to the tutor.|
|essay_text|no|string|-|-|["현대 사회에서 의사소통은 매우 중요하다. ..."]<br>{"default":""}|Current essay draft the student is working on.|
|previous_draft|no|string|-|-|["현대 사회에서 의사소통이 중요하다. ..."]<br>{"default":""}|Previous version of the essay draft, used for diff comparison against essay_text.|
|conversation_history|no|array<object<string, ->>|-|-|[[{"content":"이 표현이 맞나요?","role":"user"},{"content":"네, 자연스럽습니다.","role":"assistant"}]]|Prior chat turns (max 30). Each item is {role, content}; role must be 'user' or 'assistant'.|
|topic|no|string|-|-|["의사소통의 중요성"]<br>{"default":""}|Topic of the writing task being discussed.|
|passage_context|no|string|-|-|["다음을 읽고 ㉠과 ㉡에 들어갈 말을 각각 쓰십시오. ..."]<br>{"default":""}|Full passage text supplied for additional context (e.g. Q51/Q52 blank-fill prompt).|
|active_blank|no|string|-|-|["ㄱ"]<br>{"default":""}|Currently active blank label for blank-fill tasks, e.g. 'ㄱ' or 'ㄴ'.|
|lang|no|enum<"ko" \| "vi" \| "en">|"ko", "vi", "en"|ko|["ko"]<br>{"default":"ko"}|Interface language code. One of: ko, vi, en.|
|consecutive_wrong|no|integer|-|0|[2]<br>{"default":0}|Number of consecutive wrong/stuck attempts by the student (0-10), used to adjust tutor tone.|

## WritingGenerateRequestV2

v2 generate 요청 — task_type 문자열을 item_number:int 로 교체 (라우트 연결은 Step 8).
Type: `object`

Schema example:
```json
{
  "context_type": "social",
  "difficulty": "medium",
  "item_number": 53,
  "topic": "환경 보호"
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|item_number|yes|integer|-|-|[53]|문제 번호 / 51~54|
|topic|no|anyOf<string \| null>|-|-|["환경 보호"]|주제 / topic (server may ignore — topic_main is server-selected)|
|difficulty|no|enum<"easy" \| "medium" \| "hard">|"easy", "medium", "hard"|medium|["medium"]<br>{"default":"medium"}|easy\|medium\|hard|
|context_type|no|anyOf<string \| null>|-|-|["안내문"]|Q51 전용 지문 유형 / context type|

## WritingHistoryItem

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["f47ac10b-58cc-4372-a567-0e02b2c3d479"]|Submission UUID / 제출 UUID|
|task_type|yes|string|-|-|["Q53"]|TOPIK II writing task type / 작문 문제 유형 (Q51 \| Q53 \| Q54)|
|content_preview|yes|string|-|-|["현대 사회에서 스트레스를 관리하는 방법에는..."]|Truncated preview of the submitted essay text / 제출한 작문 텍스트 미리보기|
|total_score|no|anyOf<number \| null>|-|-|[42.5]|Total evaluation score; null while processing or for drafts / 총 평가 점수 (처리 중·초안은 null)|
|status|yes|string|-|-|["graded"]|Evaluation status / 평가 상태 (processing \| graded \| failed \| draft)|
|submitted_at|yes|string|-|-|["2024-11-15T09:30:00"]|ISO-8601 submission timestamp / 제출 시각 (ISO-8601)|

## WritingHistoryResponse

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submissions|yes|array<WritingHistoryItem>|-|-|-|Page of submissions, newest first / 제출 목록 (최신순)|
|total|yes|integer|-|-|[1]|Total number of submissions matching the filters / 필터에 일치하는 전체 제출 수|

## WritingRecommendationItem

One row of the guide §7.9 recommendation view — common columns only (no prompt body).
Maps `topik_writing_question_recommendation_view`: the cross-type list/filter shape.
Full per-number metadata (prompt_text, essay_type, blanks, …) is served by
GET /api/writing/tasks/{task_type}.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|question_id|yes|string|-|-|-|-|
|item_number|yes|integer|-|-|-|-|
|target_level|no|anyOf<string \| null>|-|-|-|-|
|difficulty_level|no|anyOf<integer \| null>|-|-|-|-|
|topic_main|yes|string|-|-|-|-|
|topic_detail|yes|string|-|-|-|-|
|speech_act|no|anyOf<string \| null>|-|-|-|-|
|scenario_type|yes|string|-|-|-|-|
|recommendation_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|avoid_repeat_keys|no|anyOf<array<-> \| null>|-|-|-|-|
|review_status|yes|string|-|-|-|-|
|service_status|yes|string|-|-|-|-|

## WritingRecommendationListResponse

Paginated cross-type list of writing questions (guide §7.9 view, 노출 가능 only).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<WritingRecommendationItem>|-|-|-|Questions across item types 51–54 (common §7.9 columns only).|
|total|yes|integer|-|-|[128]|Total questions matching the filters, ignoring pagination.|
|limit|yes|integer|-|-|[10]|Page size applied.|
|offset|yes|integer|-|-|[0]|Offset applied.|

## WritingSubmitRequest

Request to submit a writing for evaluation.

Q53/Q54 send the essay in `text`. Q51/Q52 (blank-fill) should send `blanks`
— a per-blank answer dict keyed by the labels the student sees (ㄱ, ㄴ). `text`
still works for Q51/Q52 as a fallback for older clients, but `blanks` is
preferred: it lets the backend validate each blank and grade them precisely.
Type: `object`

Schema examples:
```json
[
  {
    "task_type": "Q51",
    "question_id": "topik-writing-51-0001",
    "blanks": { "ㄱ": "잘 수 없습니다", "ㄴ": "알려 주시면" },
    "passage_context": "저는 현재 기숙사를 이용하고 있는 외국인 유학생입니다. 지금 사용하고 있는 방은 도로와 가까워서 너무 시끄럽습니다. 특히 밤에는 자동차 소리 때문에 잠을 ( ㄱ ). 그래서 조용한 방으로 바꾸고 싶은데, 어떻게 해야 합니까? 방법을 ( ㄴ ) 감사하겠습니다.",
    "lang": "ko"
  },
  {
    "task_type": "Q52",
    "question_id": "topik-writing-52-0001",
    "blanks": { "ㄱ": "중요하기 때문이다", "ㄴ": "수면의 질을 높이려면" },
    "passage_context": "사람들은 보통 피곤할 때 잠을 오래 자면 피로가 풀릴 것이라고 생각한다. ... 몸을 회복하는 데에는 수면 시간보다 수면의 질이 더 ( ㄱ ). 따라서 ( ㄴ ) 잠들기 전에 스마트폰 사용을 줄이고 매일 비슷한 시간에 잠자리에 드는 것이 좋다.",
    "lang": "ko"
  },
  {
    "task_type": "Q51",
    "question_id": "topik-writing-51-0001",
    "text": "ㄱ: 잘 수 없습니다\nㄴ: 알려 주시면",
    "lang": "ko"
  },
  {
    "task_type": "Q53",
    "question_id": "topik-writing-53-0001",
    "text": "중소벤처기업부 조사에 따르면 청년 창업 비율은 2024년 28%에서 2025년 36%, 2026년 45%로 꾸준히 상승하였다. ...",
    "lang": "ko"
  },
  {
    "task_type": "Q54",
    "question_id": "topik-writing-54-0001",
    "text": "디지털 시민성은 온라인 공간에서 다른 사람과 함께 살아가기 위한 기본 태도이다. ...",
    "lang": "ko"
  }
]
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|user_id|no|anyOf<string \| null>|-|-|["user_a1b2c3d4"]|Authenticated user identifier; null for anonymous/guest submissions.|
|question_id|no|anyOf<string \| null>|-|-|["topik-writing-54-0001"]|Rich §7 question being answered, as returned by GET /api/writing/tasks (e.g. 'topik-writing-54-0001'). Scoring uses this exact question's prompt, model answer, and rubric. Null for an ad-hoc submission (a random question of task_type is used).|
|task_type|yes|enum<"Q51" \| "Q52" \| "Q53" \| "Q54">|"Q51", "Q52", "Q53", "Q54"|-|["Q54"]|TOPIK II writing task type. One of: Q51, Q52 (short blank-fill), Q53 (~300-char paragraph), Q54 (600-700 char essay).|
|text|no|string|-|-|["현대 사회에서 의사소통의 중요성은 점점 더 커지고 있다. 사람들은 다양한 매체를 통해 서로의 생각을 나누며 관계를 형성한다. 그러나 정보가 넘쳐나는 환경에서는 정확하고 진실한 소통이 더욱 어려워지기도 한다. 따라서 우리는 상대를 존중하는 태도로 경청하고 명확하게 표현하는 능력을 길러야 한다."]<br>{"default":""}|Student's writing content (Q53/Q54). For Q51/Q52 prefer `blanks`; `text` is accepted as a fallback. Minimum length depends on task_type (Q51/Q52: 5, Q53: 20, Q54: 100 chars).|
|blanks|no|anyOf<object<string, string> \| null>|-|-|[{"ㄱ":"잘 수 없습니다","ㄴ":"알려 주시면"}]|Q51/Q52 only: the student's answer per blank, keyed by the blank label shown in the passage (ㄱ, ㄴ). Preferred over `text` for blank-fill tasks. Each answer is a short phrase/clause (max 300 chars), not an essay. Ignored for Q53/Q54.|
|lang|no|string|-|ko|["ko"]<br>{"default":"ko"}|User interface language code. One of: ko, en, vi.|
|passage_context|no|string|-|-|["저는 현재 기숙사를 이용하고 있는 외국인 유학생입니다. ... 잠을 ( ㄱ ). ... 방법을 ( ㄴ ) 감사하겠습니다."]<br>{"default":""}|Q51/Q52 only: original passage with ( ㄱ ) / ( ㄴ ) blanks. Sent from frontend if not stored in DB; when a valid question_id is given the backend loads it from the question, but a non-empty value here wins.|
