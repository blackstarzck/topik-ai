# TOPIK 쓰기 51~54 문항 Payload Contract

문서 버전: v0.2  
작성일: 2026-06-11  
범위: 외부 공급 API, 내부 수신/적재 서버, admin 프론트엔드가 공유할 TOPIK 쓰기 51~54번 문항 payload 계약

## 1. 목적

이 문서는 `topik_writing_51_questions`, `topik_writing_52_questions`, `topik_writing_53_questions`, `topik_writing_54_questions` 테이블에 저장될 문항 데이터를 어떤 wire payload로 주고받을지 정의한다.

`DTO`라는 이름은 여기서 중심 용어로 쓰지 않는다. 이 프로젝트의 문항 흐름은 ORM 엔티티를 class로 관리하는 구조가 아니라, 외부 API의 JSON payload를 내부 서버가 검증한 뒤 Supabase row 객체로 정규화하고, admin 프론트엔드가 Supabase row를 화면 모델로 매핑하는 구조다.

기준 문서:

- `docs/metadata-tag-schema-rule.md` §7
- `docs/specs/admin-data-contract.md` §9.6, §12.6
- `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0

## 2. 전송 원칙

- wire key는 `snake_case`를 사용한다. 백엔드와 Supabase 컬럼 매핑을 단순하게 유지하기 위해서다.
- admin 화면 모델은 기존처럼 service adapter에서 `camelCase`로 변환해 사용한다.
- `question_id`가 전역 고유 ID다. API 응답에서 별도 `id` 필드를 중복 추가하지 않는다.
- `item_number`는 라우터 역할을 한다. 값은 `51`, `52`, `53`, `54` 중 하나이며, 백엔드는 이 값으로 `detail` 타입을 판별할 수 있게 내려준다.
- `created_at`, `updated_at`은 서버가 기록한 값을 내려준다. 관리자 저장 요청에서 클라이언트가 직접 작성하지 않는다.
- `review_status`, `review_passed`, `review_workflow_status`, `validation_result` 등 검수 필드는 2026-06-11 인바운드 전환 후 계약에서 제외한다.
- `review_workflow`, `approved_topic_seed`, `approved_graph_logic`, `edit_history` 같은 생성/검수 과정 산출물은 기본 문항 payload에 넣지 않는다. 필요하면 별도 이력 API 또는 감사/소스 컨텍스트 API로 분리한다.
- `situation_summary`, `prompt_text`, `resolved_text`, `model_answer`처럼 문장형 필드라도 문제 자체를 설명하거나 학습자에게 노출되는 콘텐츠라면 payload에 포함한다.
- `topic_source`는 현재 51~54 테이블 컬럼이 `TEXT`이므로 상세 payload에 포함한다. 향후 출처 마스터가 생기면 `topic_source_id`를 추가하고 `topic_source`는 표시 label로만 내려주는 방향을 권장한다.

## 3. API 응답 Payload

목록은 추천 뷰 기준의 얇은 payload를 사용한다. 상세는 공통 필드와 번호별 전용 필드를 분리한다.

```ts
export type TopikWritingItemNumber = 51 | 52 | 53 | 54;

export type TopikWritingServiceStatus =
  | 'available'
  | 'excluded'
  | 'internal_test';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type TopikWritingQuestionListPayload = {
  question_id: string;
  item_number: TopikWritingItemNumber;
  target_level: string | null;
  difficulty_level: number | null;
  topic_main: string;
  topic_detail: string;
  speech_act: string | null;
  scenario_type: string;
  situation_summary: string;
  question_type_name: string;
  recommendation_keys: string[];
  avoid_repeat_keys: string[];
  service_status: TopikWritingServiceStatus;
  content_team_memo: string | null;
  created_at: string;
  updated_at: string | null;
  active_tag_count?: number;
};
```

```ts
export type TopikWritingQuestionCommonPayload = {
  source_exam_reference: string | null;
  source_reference: string | null;
  exam_name: 'TOPIK';
  section: '쓰기';
  question_type_code: string;
  question_type_name: string;
  target_level: string | null;
  difficulty_level: number | null;
  topic_main: string;
  topic_detail: string;
  secondary_topic_main: string | null;
  secondary_topic_detail: string | null;
  topic_source: string;
  text_type: string | null;
  speech_act: string | null;
  relation: string | null;
  scenario_type: string;
  situation_summary: string;
  learning_goal_summary: string | null;
  prompt_text: string;
  resolved_text: string | null;
  model_answer: string | null;
  answer_key: JsonValue | null;
  service_status: TopikWritingServiceStatus;
  auto_checks_passed: boolean | null;
  recommendation_keys: string[];
  avoid_repeat_keys: string[];
  content_team_memo: string | null;
};
```

```ts
export type TopikWritingQuestionTagPayload = {
  tag_assignment_id: number;
  tag_code: string;
  tag_name_ko: string;
  tag_group: string;
  tag_value: string | null;
  is_active: boolean;
  assigned_at: string;
};
```

```ts
export type TopikWritingQuestionDetailResponsePayload = {
  question_id: string;
  item_number: TopikWritingItemNumber;
  schema_version: string;
  created_at: string;
  updated_at: string | null;
  common: TopikWritingQuestionCommonPayload;
  detail:
    | TopikWritingQuestion51DetailPayload
    | TopikWritingQuestion52DetailPayload
    | TopikWritingQuestion53DetailPayload
    | TopikWritingQuestion54DetailPayload;
  tags: TopikWritingQuestionTagPayload[];
};
```

## 4. 번호별 detail Payload

### 4.1 51번

```ts
export type TopikWritingQuestion51DetailPayload = {
  kind: 51;
  blank_count: number;
  text_state: string | null;
  blank_notation_policy: string | null;
  grammar_patterns: string[];
  blank_1_position: string;
  blank_1_role: string;
  blank_1_function: string;
  blank_1_answer_type: string;
  blank_1_canonical_answer: string;
  blank_1_accepted_answers: string[];
  blank_1_accepted_synonyms: string[];
  blank_1_target_note: string | null;
  blank_2_position: string;
  blank_2_role: string;
  blank_2_function: string;
  blank_2_answer_type: string;
  blank_2_canonical_answer: string;
  blank_2_accepted_answers: string[];
  blank_2_accepted_synonyms: string[];
  blank_2_target_note: string | null;
};
```

### 4.2 52번

```ts
export type TopikWritingQuestion52DetailPayload = {
  kind: 52;
  completion_unit: string;
  required_sentence_count: number | null;
  blank_count: number | null;
  connection_function: string;
  clue_before_text: string | null;
  clue_after_text: string | null;
  required_expression_function: string;
  sentence_complexity: string | null;
  answer_scope_type: string;
  grammar_patterns: string[];
  paragraph_role: string | null;
  cohesion_focus: string | null;
  blank_1_canonical_answer: string | null;
  blank_1_accepted_answers: string[];
  blank_2_canonical_answer: string | null;
  blank_2_accepted_answers: string[];
  scoring_notes: string | null;
};
```

### 4.3 53번

```ts
export type TopikWritingQuestion53DetailPayload = {
  kind: 53;
  data_type: string;
  data_topic: string;
  chart_title: string | null;
  chart_unit: string | null;
  comparison_target_count: number | null;
  data_series_count: number | null;
  number_expression_required: boolean;
  comparison_type: string;
  change_type: string | null;
  key_findings: string[];
  required_structure: string[];
  expression_set: string[];
  word_count_min: number | null;
  word_count_max: number | null;
  interpretation_difficulty: string | null;
  prohibited_elements: string[];
  source_data: JsonValue | null;
  data_asset_url: string | null;
  scoring_focus: string[];
};
```

### 4.4 54번

```ts
export type TopikWritingQuestion54DetailPayload = {
  kind: 54;
  essay_type: string;
  issue_topic: string;
  prompt_questions: string[];
  stance_requirement: string;
  required_structure: string[];
  required_reason_count: number | null;
  example_requirement: string | null;
  word_count_min: number | null;
  word_count_max: number | null;
  reasoning_pattern: string;
  argument_keywords: string[];
  vocabulary_level: string | null;
  scoring_focus: string[];
  prohibited_elements: string[];
  model_outline: JsonValue | null;
  rubric: JsonValue | null;
};
```

## 5. 저장/수정 요청 Payload 원칙

관리자 UI가 문항 본문·메타데이터를 직접 수정하지 않는 현재 정책에서는 문항 상세 payload 전체를 `PATCH` 요청으로 되돌려 보내지 않는다.

허용 write는 다음 2종이다.

```ts
export type TopikWritingQuestionServiceStatusUpdatePayload = {
  question_id: string;
  item_number: TopikWritingItemNumber;
  next_service_status: TopikWritingServiceStatus;
  note: string;
};

export type TopikWritingQuestionTagMutationPayload = {
  question_id: string;
  item_number: TopikWritingItemNumber;
  tag_code: string;
  tag_value?: string | null;
};
```

문항 수신/적재 API가 별도로 생기면 `TopikWritingQuestionDetailResponsePayload`와 동일한 구조를 기반으로 하되, `created_at`, `updated_at`, `tags[].tag_assignment_id`, `tags[].assigned_at`처럼 서버가 생성하는 필드는 요청 payload에서 제외한다.

```ts
export type TopikWritingQuestionInboundPayload = Omit<
  TopikWritingQuestionDetailResponsePayload,
  'created_at' | 'updated_at' | 'tags'
> & {
  question_id?: string;
  idempotency_key: string;
};
```

## 6. 예시 파일

- `examples/question-51.json`
- `examples/question-52.json`
- `examples/question-53.json`
- `examples/question-54.json`
