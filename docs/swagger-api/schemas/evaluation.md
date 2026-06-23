# Evaluation API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[CombinedFeedbackDetail](#combinedfeedbackdetail)|object|
|[DrillExerciseDetail](#drillexercisedetail)|object|
|[ErrorDetail](#errordetail)|object|
|[EvaluationFeedbackResponse](#evaluationfeedbackresponse)|object|
|[EvaluationStatusResponse](#evaluationstatusresponse)|object|
|[GrammarPointDetail](#grammarpointdetail)|object|
|[InlineAnnotationDetail](#inlineannotationdetail)|object|
|[ModelAnswerDetail](#modelanswerdetail)|object|
|[TraitScoreDetail](#traitscoredetail)|object|

## CombinedFeedbackDetail

Merged learning + drill feedback (single pipeline agent output).
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|grammar_points|yes|array<GrammarPointDetail>|-|-|-|-|
|vocabulary|yes|array<string>|-|-|-|-|
|related_topics|yes|array<string>|-|-|-|-|
|study_tips|yes|string|-|-|-|-|
|exercises|yes|array<DrillExerciseDetail>|-|-|-|-|
|focus_areas|yes|array<string>|-|-|-|-|

## DrillExerciseDetail

Practice exercise.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|exercise_type|yes|string|-|-|-|-|
|question|yes|string|-|-|-|-|
|answer|yes|string|-|-|-|-|
|explanation|yes|string|-|-|-|-|
|target_error_type|yes|string|-|-|-|-|

## ErrorDetail

A single detected error.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|error_type|yes|string|-|-|-|-|
|severity|yes|string|-|-|-|-|
|original|yes|string|-|-|-|-|
|correction|yes|string|-|-|-|-|
|explanation|yes|string|-|-|-|-|

## EvaluationFeedbackResponse

Full evaluation feedback response.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|-|-|
|status|yes|string|-|-|-|-|
|total_score|yes|number|-|-|-|-|
|max_score|yes|number|-|-|-|-|
|processing_time_seconds|yes|number|-|-|-|-|
|trait_scores|yes|array<TraitScoreDetail>|-|-|-|-|
|errors|yes|array<ErrorDetail>|-|-|-|-|
|model_answer|no|anyOf<ModelAnswerDetail \| null>|-|-|-|-|
|combined_feedback|no|anyOf<CombinedFeedbackDetail \| null>|-|-|-|-|
|annotations|no|array<InlineAnnotationDetail>|-|-|-|-|
|ai_summary|no|string|-|-|{"default":""}|Unified AI summary|
|degraded|no|boolean|-|false|{"default":false}|True if 1+ scoring agent fell back to default|
|degraded_traits|no|array<string>|-|-|-|Trait names that used fallback scores|

## EvaluationStatusResponse

Response for evaluation status polling.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|submission_id|yes|string|-|-|-|-|
|status|yes|string|-|-|-|processing \| graded \| failed|
|total_score|no|anyOf<number \| null>|-|-|-|-|
|max_score|no|anyOf<number \| null>|-|-|-|-|
|processing_time_seconds|no|anyOf<number \| null>|-|-|-|-|

## GrammarPointDetail

Grammar point for learning.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|grammar|yes|string|-|-|-|-|
|explanation|yes|string|-|-|-|-|
|example|yes|string|-|-|-|-|

## InlineAnnotationDetail

Inline annotation on essay text.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|start_offset|yes|integer|-|-|-|-|
|end_offset|yes|integer|-|-|-|-|
|text|yes|string|-|-|-|-|
|annotation_type|yes|string|-|-|-|-|
|category|yes|string|-|-|-|-|
|comment|yes|string|-|-|-|-|
|suggestion|no|string|-|-|{"default":""}|-|

## ModelAnswerDetail

Model answer response.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|model_essay|yes|string|-|-|-|-|
|key_points|yes|array<string>|-|-|-|-|
|structure_note|yes|string|-|-|-|-|

## TraitScoreDetail

Detailed trait score with sub-scores.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|trait|yes|string|-|-|-|-|
|trait_korean|yes|string|-|-|-|-|
|weight|yes|number|-|-|-|-|
|score|yes|integer|-|-|-|-|
|feedback|yes|string|-|-|-|-|
|strengths|no|array<string>|-|-|-|-|
|improvements|no|array<string>|-|-|-|-|
