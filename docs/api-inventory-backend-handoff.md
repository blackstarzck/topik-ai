# v13 · topik-ai API 안내서 (백엔드 전달용)

> 학습자 앱(v13)과 어드민(topik-ai)이 쓰는 모든 API를 **쉬운 한 줄 설명**과 함께 정리했습니다. 각 API는 「쉬운 설명 → 자세한 목적 → 요청 → 기대 Response → 비고」 순서입니다. 기대 Response는 프론트가 실제로 받는 형태이며 RPC는 SQL `RETURNS`/`json_build_object` 정의가 근거입니다. 더 읽기 좋은 버전은 같은 폴더의 `.html`을 브라우저로 여세요.

## 한눈에 보기

| 구분 | v13 (talkpik-ai) | topik-ai |
|---|---|---|
| 무엇 | 학습자가 쓰는 서비스 앱 | 운영자가 쓰는 어드민 |
| 기술 | Next.js 16, React 19 | Vite + React |
| 백엔드 | 같은 Supabase 1개 (RPC + 테이블 + 로그인) · 외부: AI 쓰기채점, 메일(SMTP) | 동일 |
| 권한 | 로그인 사용자가 자기 데이터만(RLS) | 모든 변경은 `admin_*` 함수로만(관리자 등급 확인) |

- 도메인 15개 · API 179개 · 릴레이 6개. 참고: `avatars`, `export_files` 는 직접 호출 API가 아니라 타입참조/서버기록용.


---

# A. v13 (학습자 앱) — `topik-project/v13`

## writing (작성/외부 AI 채점/피드백)
_학습자가 쓴 작문을 외부 AI 채점 서버로 보내고, 점수·문장별 첨삭 결과를 받아 화면에 보여주는 영역입니다. 채점은 외부에서 비동기로 돌아가므로 결과가 나올 때까지 잠깐씩 다시 물어보는(폴링) 구조입니다._

### `create_external_writing_submission` · RPC · rpc
> 🟢 **쉬운 설명**: 외부 채점에 보낸 답안을 우리 기록에 남긴다
> 🔵 **돌아오는 값(쉽게)**: 새로 만든(또는 기존) 제출 건의 식별 번호가 돌아온다

**자세한 목적**: 외부 채점 API(TALKPIK)로 큐잉된 쓰기 제출에 대해 로컬 writing_submissions 행을 analyzing/failed 상태로 생성한다. 외부 제출이 정상 큐잉되면 analyzing, 외부 호출이 복구 가능 오류(네트워크/5xx)로 실패하면 failed로 로컬에만 기록한다. draft 단위 멱등(이미 활성 제출이 있으면 새 행 없이 기존 id 반환).

**사용 위치**:
- `src/lib/writing/server-actions.ts:71 createFailedLocalSubmission — 외부 호출 미설정/복구가능실패 시 feedback_status:'failed'로 호출`
- `src/lib/writing/server-actions.ts:150 submitWritingAction — 외부 submit 성공 후 external.submission_id를 external_submission_id로, nextStatus(analyzing|failed)로 호출`
- `src/lib/writing/mutations.ts:108 useSubmitWriting → submitWritingAction (server action) 진입점`
- `src/components/writing/WritingEditor.tsx:75 / ShortAnswerWriting51Workspace.tsx:116 / EssayWriting54Workspace.tsx:113 등 제출 버튼`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `submission` | jsonb | 필수 | 제출 페이로드 단일 jsonb 객체. 키: external_submission_id(string uuid, 필수·로컬 row의 PK가 됨), user_id(string uuid, 필수), problem_id(string uuid, 필수), question_no(51\|52\|53\|54), answer_text(text), answer_json(object\|null), char_count(int), draft_id(string uuid\|null), feedback_status('analyzing'\|'failed', 미지정 시 'analyzing') |

**기대 Response**:
```ts
string (uuid) — 생성/기존 writing_submissions.id. 멱등 경로에서는 이번 호출의 external_submission_id와 다른 기존 id를 반환할 수 있으므로 반환값을 신뢰해야 함. 실패 생성 경로는 createFailedLocalSubmission에서 data가 자신이 넘긴 submissionId와 같아야 함을 검증.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | uuid string | 로컬 writing_submissions 행의 id. 호출자(server-actions.ts submitWritingAction)는 이 반환 id를 submissionId로 사용하고 /writing/feedback/[id]로 라우팅. |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 권한: public REVOKE, service_role만 EXECUTE — 반드시 service-role 클라이언트(createSupabaseServiceRoleClient)로 호출. 내부에서 private.assert_submission_payload(submission,'[]','[]')와 private.assert_writing_problem_submittable(problem_id, question_no) 검증 통과 필요. 검증 실패 시 예외: 'submission.user_id required (string uuid)', 'submission.external_submission_id required (string uuid)', 'submission.feedback_status must be analyzing or failed', 'draft_not_owned'(draft_id가 동일 user/problem/question에 속하지 않음), 'problem_not_submittable'(errcode P0001 — 미발행/비공개/비활성/non-writing/문항번호 불일치 문제). 호출자는 error.message에 'problem_not_submittable' 포함 시 한국어 사용자 메시지로 치환. 정상 생성 시 같은 (user,problem)의 기존 활성 draft를 autosave_status='superseded'로 마킹. draft_id 단위 partial unique index(writing_submissions_draft_active_unique: feedback_status<>'failed')로 중복 방지, unique_violation 시 기존 활성 제출 id로 수렴 반환. 정의 2곳: 20260520... 없음 → 최초 20260618143000_external_writing_submission_sync.sql, 재선언(멱등화) 20260619150000_writing_submission_draft_dedup.sql(현행). 시그니처: (jsonb) returns uuid.

### `sync_external_writing_feedback` · RPC · rpc
> 🟢 **쉬운 설명**: 외부 채점 결과를 우리 시스템에 옮겨 저장한다
> 🔵 **돌아오는 값(쉽게)**: 현재 채점 진행 상태(완료/진행중 등)가 돌아온다

**자세한 목적**: 외부 채점 API의 평가 상태/결과를 로컬 피드백 테이블(writing_feedback, feedback_dimension_scores, sentence_feedback)과 writing_submissions.feedback_status로 동기화한다. /api/writing/evaluation-status 라우트가 폴링 중 외부 상태에 따라 호출.

**사용 위치**:
- `src/app/api/writing/evaluation-status/route.ts:71 — 외부 status==='failed' → next_status:'failed', feedback:null`
- `src/app/api/writing/evaluation-status/route.ts:87 — 외부 status!=='graded'(processing→'analyzing', 그외→'pending'), feedback:null`
- `src/app/api/writing/evaluation-status/route.ts:111 — 외부 status==='graded' → next_status:'complete', feedback={...mapped.feedback, raw_ai_result: externalFeedback}, dimensions/sentences는 mapExternalEvaluationFeedback 결과`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `target_submission_id` | uuid | 필수 | 동기화 대상 로컬 writing_submissions.id |
| `next_status` | text | 필수 | 'pending'\|'analyzing'\|'complete'\|'failed' 중 하나. 그 외 값은 예외. |
| `feedback` | jsonb\|null | - | complete일 때 필수(object). 키: status, score_total, score_max, overall_summary, ai_model, ai_model_version, raw_ai_result. complete 외 상태에서는 null. |
| `dimensions` | jsonb (array) | - | 기본 '[]'. 각 원소 키: dimension('grammar'\|'vocab'\|'structure'\|'content'\|'expression'\|'topic_fit'), score, score_max, summary, weakness_level(1~5) |
| `sentences` | jsonb (array) | - | 기본 '[]'. 각 원소 키: sentence_index(int), original_text, corrected_text, comment |

**기대 Response**:
```ts
string (text) — 적용된 상태 문자열. complete가 아니면 입력한 next_status를 그대로 반환, complete면 'complete' 반환. (라우트는 반환값을 직접 쓰지 않고 syncError 유무만 확인.)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 적용된 feedback_status('pending'\|'analyzing'\|'complete'\|'failed') |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 권한: public REVOKE, service_role만 EXECUTE — createSupabaseServiceRoleClient로 호출. next_status 미허용값 시 예외 'invalid feedback_status: %'. 대상 제출 없으면 'submission_not_found'. complete인데 feedback가 null/비-object면 'feedback payload required for complete status'. complete 아닐 때는 private.set_submission_feedback_status로 상태만 갱신 후 즉시 반환. complete일 때: writing_feedback에 ON CONFLICT(submission_id) UPSERT(score_total/max는 nullif('')::numeric, ai_model 기본 'talkpik-writing-api', ai_model_version 기본 'openapi', generated_at=now()), feedback_dimension_scores·sentence_feedback는 해당 submission+owner 행을 DELETE 후 재삽입(전치환). user_id는 submission에서 조회한 owner_id로 강제 — 페이로드의 user_id는 무시. 정의: supabase/migrations/20260618143000_external_writing_submission_sync.sql. 시그니처: (uuid, text, jsonb default null, jsonb default '[]', jsonb default '[]') returns text.

### `writing_drafts` · 테이블 · select/insert/update
> 🟢 **쉬운 설명**: 작성 중인 답안을 자동으로 임시 저장한다
> 🔵 **돌아오는 값(쉽게)**: 저장된 임시 답안과 작성 상태가 돌아온다

**자세한 목적**: 자동저장되는 가변 임시 답안(draft). (user_id, problem_id) 당 superseded가 아닌 활성 draft 1개를 partial unique index로 보장. 작성 화면이 autosave로 upsert, 제출 시 RPC가 superseded 처리.

**사용 위치**:
- `src/lib/writing/queries.ts:42 fetchDraft (브라우저) / src/lib/writing/server.ts:29 getActiveDraft (서버)`
- `src/lib/writing/mutations.ts:18 upsertDraft (findActiveDraftId/updateActiveDraft/insertDraft), useUpsertDraft`
- `src/components/writing/WritingEditor.tsx:74 등 모든 작성 워크스페이스 autosave`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(fetchDraft/getActiveDraft)` | filter | - | .eq('user_id', userId).eq('problem_id', problemId).neq('autosave_status','superseded').maybeSingle() — select('*') |
| `insert/update(upsertDraft)` | row | - | WritingDraftInsert: user_id, problem_id, question_no(51\|52\|53\|54), answer_text?, answer_json?, char_count?, autosave_status?, last_saved_at?. onConflict 미지원(partial predicate)이라 활성 draft id 선조회 후 update, 없으면 insert, 23505 충돌 시 재조회·update. |

**기대 Response**:
```ts
Tables<'writing_drafts'> 행. { id: uuid; user_id: uuid; problem_id: uuid; question_no: 51|52|53|54; answer_text: string|null; answer_json: Json|null; char_count: number|null; autosave_status: 'clean'|'dirty'|'syncing'|'failed'|'superseded'; last_saved_at: string|null; created_at: string; updated_at: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `autosave_status` | text enum | 'clean'\|'dirty'\|'syncing'\|'failed'\|'superseded' — 'superseded'는 제출/재시작으로 비활성화된 draft. 조회는 항상 neq 'superseded'. |
| `answer_json` | jsonb\|null | 문항별 구조화 답안(51.v1 blanks / 53.v1 sections / 54.v1 text+checklist). 미사용 시 null. |
| `char_count` | int\|null | 현재 글자수(하드/권장 제한 계산용) |

**비고(권한·예외)**: RLS: 소유자 전체권한(writing_drafts_owner_all, FOR ALL to authenticated, USING/WITH CHECK user_id = auth.uid()). authenticated 세션 필수. partial unique writing_drafts_active_unique (user_id, problem_id) WHERE autosave_status<>'superseded' — PostgREST upsert로 이 predicate를 타깃 불가하므로 코드가 명시적으로 활성행 조회→update 처리, insert 시 23505(unique_violation) catch 후 재조회. 정의: supabase/migrations/20260520120400_writing.sql.

### `writing_submissions` · 테이블 · select
> 🟢 **쉬운 설명**: 제출이 끝난 답안 한 건을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 제출한 답안 내용과 채점 진행 상태가 돌아온다

**자세한 목적**: 제출된 불변 답안. 프론트는 SELECT만(INSERT/상태전이는 service-role RPC 경로). 비교 리포트·피드백 페이지·평가상태 라우트가 단건 조회.

**사용 위치**:
- `src/lib/writing/queries.ts:58 fetchSubmission / src/lib/writing/server.ts:45 getSubmission`
- `src/lib/writing/queries.ts:116 fetchFeedbackStatus (DB 폴백)`
- `src/lib/writing/server-actions.ts:208,217 createComparisonReportAction (current/prev 조회)`
- `src/app/api/writing/evaluation-status/route.ts:35 소유권 확인`
- `src/app/(workspace)/writing/feedback/short|long/[id]/page.tsx, reports/[id]/compare/page.tsx`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(fetchSubmission/getSubmission)` | filter | - | .eq('id', submissionId).maybeSingle(), select('*') |
| `select(feedback_status only)` | filter | - | queries.ts fetchFeedbackStatus 폴백: .select('feedback_status').eq('id', submissionId).maybeSingle() |
| `select(route ownership)` | filter | - | route.ts: select('*').eq('id', submissionId).maybeSingle() 후 submission.user_id !== user.id면 404 |

**기대 Response**:
```ts
Tables<'writing_submissions'> 행. { id: uuid; user_id: uuid; problem_id: uuid; draft_id: uuid|null; question_no: 51|52|53|54; answer_text: string; answer_json: Json|null; char_count: number; submitted_at: string; feedback_status: 'pending'|'analyzing'|'complete'|'failed'; parent_submission_id: uuid|null }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `feedback_status` | text enum | 'pending'\|'analyzing'\|'complete'\|'failed'. isFeedbackComplete = complete\|failed. 폴링 종료 신호. |
| `char_count` | int (not null) | 비교 메트릭(computeComparisonMetrics) 입력 |
| `parent_submission_id` | uuid\|null | 재응시 체인 추적 |

**비고(권한·예외)**: RLS: writing_submissions_owner_select(FOR SELECT to authenticated USING user_id=auth.uid() OR private.is_admin(auth.uid())), writing_submissions_owner_insert(WITH CHECK user_id=auth.uid()). UPDATE/DELETE 정책 없음 → 불변, 상태전이는 service_role 코드경로(sync RPC)만. 프론트는 INSERT 직접 안 하고 RPC 경유. 정의: supabase/migrations/20260520120400_writing.sql, RLS 20260520121100_rls_policies.sql.

### `writing_feedback` · 테이블 · select
> 🟢 **쉬운 설명**: 제출 답안의 AI 종합 피드백을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 총점과 전체 총평이 돌아온다

**자세한 목적**: 제출 1:1 AI 종합 피드백. 프론트 읽기 전용(쓰기는 sync RPC=service_role). 피드백 번들/비교 리포트 메트릭 입력으로 단건 조회.

**사용 위치**:
- `src/lib/writing/queries.ts:74 fetchFeedbackBundle / src/lib/writing/server.ts:61 getFeedbackBundle (Promise.all 첫 요소)`
- `src/lib/writing/server-actions.ts:224,238 createComparisonReportAction (current/prev score_total)`
- `src/lib/writing/external-feedback.ts:38 raw_ai_result 파싱`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(bundle)` | filter | - | .eq('submission_id', submissionId).maybeSingle(), select('*') |

**기대 Response**:
```ts
Tables<'writing_feedback'> 행. { submission_id: uuid (PK); user_id: uuid; status: 'partial'|'complete'|'failed'; score_total: number|null; score_max: number|null; overall_summary: string|null; ai_model: string|null; ai_model_version: string|null; raw_ai_result: Json|null; generated_at: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `raw_ai_result` | jsonb\|null | 외부 채점 원본(ExternalEvaluationFeedback 전체). extractExternalFeedbackSupplement가 combined_feedback에서 focus_areas/study_tips/grammar_points/vocabulary/exercises를 학습 보조 모델로 추출. |
| `status` | text enum | 'partial'\|'complete'\|'failed' — writing_submissions.feedback_status와 별개의 피드백 자체 상태. |
| `score_total/score_max` | numeric(5,2)\|null | 총점/만점. nullif('')::numeric로 적재되어 null 가능. |

**비고(권한·예외)**: RLS: writing_feedback_owner_select (FOR SELECT to authenticated USING user_id=auth.uid() OR private.is_admin). 쓰기 정책 없음 → service_role(sync_external_writing_feedback)만 작성. submission_id가 PK(1:1). 정의: supabase/migrations/20260520120500_feedback.sql.

### `feedback_dimension_scores` · 테이블 · select
> 🟢 **쉬운 설명**: 문법·어휘·구조 등 항목별 점수를 불러온다
> 🔵 **돌아오는 값(쉽게)**: 항목마다 점수와 간단한 평가가 돌아온다

**자세한 목적**: 정규화된 차원별 점수(문법/어휘/구조/내용/표현/주제적합). 프론트 읽기 전용. 피드백 번들·비교 메트릭 입력으로 다건 조회.

**사용 위치**:
- `src/lib/writing/queries.ts:80 fetchFeedbackBundle / src/lib/writing/server.ts:67 getFeedbackBundle (Promise.all 둘째)`
- `src/lib/writing/server-actions.ts:230,243 createComparisonReportAction (currentDims/previousDims)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(bundle)` | filter | - | .eq('submission_id', submissionId), select('*') (다건, 정렬 없음) |

**기대 Response**:
```ts
Tables<'feedback_dimension_scores'>[] 배열. 각 행 { id: uuid; submission_id: uuid; user_id: uuid; dimension: 'grammar'|'vocab'|'structure'|'content'|'expression'|'topic_fit'; score: number|null; score_max: number|null; summary: string|null; weakness_level: number|null }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `dimension` | text enum | 6종 고정. (submission_id, dimension) unique. 외부 trait→dimension 매핑은 evaluation.ts TRAIT_TO_DIMENSION(vocabulary→vocab, organization→structure, topic→topic_fit 등). |
| `weakness_level` | smallint(1~5)\|null | 약점 강도. 매핑 시 score<70→4, <85→3, 그외 1, null→3. |

**비고(권한·예외)**: RLS: feedback_dimension_owner_select (FOR SELECT to authenticated USING user_id=auth.uid() OR is_admin). 쓰기는 sync RPC(service_role)가 DELETE+재삽입(전치환). unique index feedback_dimension_unique (submission_id, dimension). 정의: supabase/migrations/20260520120500_feedback.sql.

### `sentence_feedback` · 테이블 · select
> 🟢 **쉬운 설명**: 문장마다 고쳐 준 첨삭 내용을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 문장별 원문·교정문·코멘트가 순서대로 돌아온다

**자세한 목적**: 문장 단위 교정(장문 피드백 E-02). 프론트 읽기 전용. 피드백 번들에서 sentence_index 오름차순 다건 조회.

**사용 위치**:
- `src/lib/writing/queries.ts:84 fetchFeedbackBundle / src/lib/writing/server.ts:71 getFeedbackBundle (Promise.all 셋째, order 적용)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(bundle)` | filter | - | .eq('submission_id', submissionId).order('sentence_index', {ascending:true}), select('*') |

**기대 Response**:
```ts
Tables<'sentence_feedback'>[] 배열. 각 행 { id: uuid; submission_id: uuid; user_id: uuid; sentence_index: number; original_text: string|null; corrected_text: string|null; comment: string|null }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `sentence_index` | int | 0-base 순서. 외부 annotations 배열 인덱스로 매핑(evaluation.ts mapExternalEvaluationFeedback). |
| `corrected_text` | text\|null | 외부 annotation.corrected_text ?? suggestion ?? original_text로 채워짐. |

**비고(권한·예외)**: RLS: sentence_feedback_owner_select (FOR SELECT to authenticated USING user_id=auth.uid() OR is_admin). 쓰기는 sync RPC(service_role)가 DELETE+재삽입. 정의: supabase/migrations/20260520120500_feedback.sql.

### `GET /api/writing/evaluation-status` · 라우트 · GET
> 🟢 **쉬운 설명**: 답안 채점이 끝났는지 주기적으로 확인한다
> 🔵 **돌아오는 값(쉽게)**: 채점 상태(대기/채점중/완료/실패)가 돌아온다

**자세한 목적**: 제출의 채점 상태를 폴링하는 Next 라우트 핸들러. 외부 TALKPIK API에서 상태/피드백을 가져와 sync RPC로 로컬에 반영하고 최신 feedback_status를 돌려준다. useFeedbackStatus가 5초 간격 최대 12회 폴링.

**사용 위치**:
- `src/lib/writing/queries.ts:103 fetchFeedbackStatus (fetch, cache:'no-store')`
- `src/lib/writing/queries.ts:134 useFeedbackStatus (react-query, refetchInterval 5000ms, 최대 12회, complete/failed면 중지)`
- `src/components/feedback/FeedbackPendingPanel.tsx:47, src/components/writing/SubmittedAnalysisPanel.tsx:47`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `submissionId` | string (query) | 필수 | ?submissionId=... 쿼리 파라미터. 누락 시 400. |

**기대 Response**:
```ts
200: { feedback_status: 'pending'|'analyzing'|'complete'|'failed' | null } ; 에러: { error: string } (400 submissionId required / 401 unauthorized / 403 account_inactive / 404 not found / 500 db error). 프론트(queries.ts fetchFeedbackStatus)는 body.feedback_status가 truthy면 사용, 아니면 writing_submissions DB 직접 조회로 폴백.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `feedback_status` | string\|null | 현행 제출 상태. 외부 미설정이거나 이미 complete/failed면 DB값 그대로. 외부 graded면 sync 후 'complete', processing→'analyzing', 기타→'pending', failed→'failed'. |
| `error` | string | 에러 메시지(상태코드별) |

**비고(권한·예외)**: 인증: supabase.auth.getUser() 없으면 401. fetchProfileStatus+isActiveStatus로 탈퇴/차단 계정 403(account_inactive) — /api/* 는 proxy 매처 제외라 라우트가 독립 검증. 소유권: submission.user_id !== user.id면 404. 외부 호출은 getTalkpikApiBaseUrl()(env TALKPIK_API_BASE_URL || TALKPIK_WRITING_API_BASE_URL) 설정 시에만, 세션 access_token으로 GET /api/evaluation/{id} 및 /feedback. 외부 호출 실패/불일치(submission_id mismatch)는 모두 catch되어 기존 DB feedback_status를 그대로 반환(친화적 degrade). sync는 service-role 클라이언트로 sync_external_writing_feedback 호출, syncError 시에도 기존 상태 반환. 파일: src/app/api/writing/evaluation-status/route.ts.

### `POST {TALKPIK_BASE}/api/writing/submit (external grader submit)` · 외부 · POST
> 🟢 **쉬운 설명**: 답안을 외부 채점 서비스에 제출한다
> 🔵 **돌아오는 값(쉽게)**: 외부 제출 번호와 접수 상태가 돌아온다

**자세한 목적**: 외부 TALKPIK 채점 API에 답안을 제출(큐잉)한다. submitWritingAction이 로컬 submission 생성 전에 호출하여 external submission_id를 확보.

**사용 위치**:
- `src/lib/writing-api/evaluation.ts:188 submitExternalWriting`
- `src/lib/writing/server-actions.ts:120 submitWritingAction`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `task_type` | string | 필수 | 문항번호를 3자리 0패딩 문자열로 변환(toExternalTaskType: 51→'051', 54→'054') |
| `task_id` | string | 필수 | problem_id (문제 uuid) |
| `text` | string | 필수 | answer_text (제출 답안 본문) |
| `user_id` | string\|null | - | 제출 사용자 uuid (auth user.id) |

**기대 Response**:
```ts
ExternalSubmitWritingResponse: { submission_id: string; status: string; message: string }. status==='failed'면 로컬 nextStatus='failed', 그 외엔 'analyzing'. submission_id를 create_external_writing_submission의 external_submission_id로 사용.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `submission_id` | string | 외부가 발급한 제출 id. 로컬 writing_submissions.id로 차용됨. |
| `status` | string | 외부 초기 상태('failed'면 즉시 로컬 failed) |
| `message` | string | 외부 메시지(현재 로컬 미사용) |

**비고(권한·예외)**: URL: `${baseUrl}/api/writing/submit`, baseUrl=getTalkpikApiBaseUrl(). 헤더 Authorization: Bearer {세션 access_token}, Content-Type: application/json. 비정상 응답은 ExternalEvaluationApiError(status, body) throw. 복구 가능 오류(TypeError 네트워크 또는 status 5xx)는 submitWritingAction이 catch하여 createFailedLocalSubmission(failed)로 graceful fallback, 그 외 오류는 전파. env 미설정(getTalkpikApiBaseUrl null)이면 외부 호출 없이 바로 로컬 failed 생성. 프로덕션에선 https 강제. 파일: src/lib/writing-api/evaluation.ts.

### `GET {TALKPIK_BASE}/api/evaluation/{submissionId} (external status)` · 외부 · GET
> 🟢 **쉬운 설명**: 외부 채점 서비스에 현재 채점 상태를 물어본다
> 🔵 **돌아오는 값(쉽게)**: 채점 상태와 점수(있으면)가 돌아온다

**자세한 목적**: 외부 TALKPIK API에서 제출의 현재 채점 상태를 조회. evaluation-status 라우트가 폴링 시 호출.

**사용 위치**:
- `src/lib/writing-api/evaluation.ts:207 getExternalEvaluationStatus`
- `src/app/api/writing/evaluation-status/route.ts:61`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `submissionId` | string (path) | 필수 | 외부 제출 id (URL 인코딩됨) |

**기대 Response**:
```ts
ExternalEvaluationStatus: { submission_id: string; status: 'processing'|'graded'|'failed'|string; total_score?: number|null; max_score?: number|null; processing_time_seconds?: number|null }. status 매핑 → graded:피드백 fetch 후 complete, processing:'analyzing', failed:'failed', 기타:'pending'.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `submission_id` | string | 요청 id와 불일치 시 라우트는 동기화 생략하고 기존 상태 반환 |
| `status` | string | 'processing'\|'graded'\|'failed' 등 외부 상태 |

**비고(권한·예외)**: URL: `${baseUrl}/api/evaluation/{encodeURIComponent(submissionId)}`. 헤더 Authorization: Bearer {access_token}. 비정상 응답 시 ExternalEvaluationApiError. 라우트는 try/catch로 모든 외부 오류를 흡수해 기존 DB 상태 반환. 파일: src/lib/writing-api/evaluation.ts.

### `GET {TALKPIK_BASE}/api/evaluation/{submissionId}/feedback (external feedback)` · 외부 · GET
> 🟢 **쉬운 설명**: 채점이 끝난 답안의 상세 피드백을 받아온다
> 🔵 **돌아오는 값(쉽게)**: 점수와 항목별·문장별 첨삭이 돌아온다

**자세한 목적**: 외부 채점 완료(graded) 시 상세 피드백(점수/차원/주석)을 가져온다. mapExternalEvaluationFeedback로 로컬 페이로드로 변환 후 sync RPC에 전달.

**사용 위치**:
- `src/lib/writing-api/evaluation.ts:224 getExternalEvaluationFeedback`
- `src/app/api/writing/evaluation-status/route.ts:101 (graded 분기)`
- `src/lib/writing/external-feedback.ts:38 raw_ai_result(combined_feedback) 학습보조 추출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `submissionId` | string (path) | 필수 | 외부 제출 id (URL 인코딩됨) |

**기대 Response**:
```ts
ExternalEvaluationFeedback: { submission_id: string; status: string; total_score: number; max_score: number; processing_time_seconds: number; time_spent?: number|null; time_spent_seconds?: number|null; trait_scores: Array<{trait?|name?, score?, max_score?, feedback?, comment?}>; errors: unknown[]; model_answer?: unknown; combined_feedback?: unknown; annotations?: Array<{start?,end?,start_offset?,end_offset?,text?,suggestion?,annotation_type?,category?,original_text?,corrected_text?,comment?}>; ai_summary?: string|null; degraded?: boolean; degraded_traits?: string[] }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `trait_scores[]` | array | trait/name을 TRAIT_TO_DIMENSION으로 매핑(매핑 안 되는 trait은 드롭). score_max 없으면 max_score, 없으면 100. → feedback_dimension_scores 행. |
| `annotations[]` | array | 문장 교정 → sentence_feedback(sentence_index=배열인덱스, original_text=original_text\|\|text, corrected_text=corrected_text\|\|suggestion\|\|original). |
| `ai_summary` | string\|null | → writing_feedback.overall_summary(없으면 '') |
| `degraded` | boolean | true면 ai_model_version='degraded', 아니면 'openapi'. ai_model 고정 'talkpik-writing-api'. |

**비고(권한·예외)**: URL: `${baseUrl}/api/evaluation/{id}/feedback`. 헤더 Authorization: Bearer {access_token}. 원본 응답 전체는 sync RPC에 feedback.raw_ai_result로 저장(writing_feedback.raw_ai_result). submission_id 불일치 시 라우트는 sync 생략. mapExternalEvaluationFeedback 산출 EvaluationFeedbackPayload(feedback.status='complete', score_total=total_score, score_max=max_score, dimensions[], sentences[])가 sync 입력. 파일: src/lib/writing-api/evaluation.ts.

### `POST {TALKPIK_BASE}/api/writing/save-draft (external draft, STUB/미배선)` · 외부 · POST
> 🟢 **쉬운 설명**: 임시 답안을 외부 서비스에 저장한다(아직 미사용)
> 🔵 **돌아오는 값(쉽게)**: 저장된 제출 번호와 저장 시각이 돌아온다

**자세한 목적**: 외부 TALKPIK API에 임시저장(draft)을 동기화하는 클라이언트 함수. 현재 도메인 코드 내 호출부 없음(정의만 존재) — 향후 외부 autosave 연동용 placeholder.

**사용 위치**:
- `src/lib/writing-api/save-draft.ts:25 saveExternalWritingDraft (정의만, src 내 호출자 없음 — grep 결과 import 0건)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `task_type` | string | 필수 | 문항번호 매핑 문자열(submit과 동일 규칙 예상) |
| `task_id` | string | 필수 | problem_id |
| `text` | string | 필수 | draft 본문 |

**기대 Response**:
```ts
ExternalSaveDraftResponse: { submission_id: string; saved_at?: string; character_count?: number }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `submission_id` | string | 외부 draft 식별자 |
| `saved_at` | string? | 저장 시각(옵셔널) |
| `character_count` | number? | 글자수(옵셔널) |

**비고(권한·예외)**: STUB/미배선 주의: 함수는 구현돼 있으나 현재 어떤 페이지/액션도 호출하지 않음(로컬 autosave는 writing_drafts 테이블 upsert로 처리). URL `${baseUrl}/api/writing/save-draft`, Authorization: Bearer {accessToken}, Content-Type: application/json. 비정상 응답 시 ExternalWritingApiError(status, body). 백엔드는 엔드포인트 계약만 합의해두고 프론트 배선은 추후. 파일: src/lib/writing-api/save-draft.ts.

## problems + learning (문제풀이/학습이벤트)
_학습자가 풀 문제를 받아오고, 푼 기록과 학습 활동(언제 무엇을 했는지)을 저장하는 영역입니다._

### `list_user_problems` · RPC · rpc
> 🟢 **쉬운 설명**: 내가 풀 수 있는 문제 목록을 풀이 진행 상태와 함께 보여준다
> 🔵 **돌아오는 값(쉽게)**: 필터·정렬·페이지가 적용된 문제 목록과 정확한 전체 개수, 문제별 풀이 상태가 돌아온다

**자세한 목적**: C-02 문제 목록 화면용. 인증된 사용자(auth.uid())의 시점에서 published 문제 목록을 필터/정렬/페이지네이션하고, 각 문제에 사용자별 풀이 상태(객관식 attempt + writing draft/submission)를 결합해 반환한다. 클라이언트 후처리 필터의 페이지 카운트 오류를 없애기 위해 SQL window total_count로 정확한 전체 건수를 같이 내려준다.

**사용 위치**:
- `src/components/practice/problem-list-data.ts:161 — supabase.rpc('list_user_problems', { filter, sort, page, page_size }) 호출 (fetchUserProblemsRpc)`
- `src/components/practice/problem-list-data.ts:213 — useUserProblemsRpc react-query 훅`
- `src/components/practice/ProblemListView.tsx:183 — C-02 문제 목록 화면이 useUserProblemsRpc 소비`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `filter` | jsonb | - | 기본 '{}'. 인식 키: domain(text), topik_level(int), question_no(int, 51~54), difficulty(int), status('solved'\|'attempted'\|'unattempted'), search(text, title ilike), recommended(boolean, active+미만료 recommendation만), review_set_id(uuid, study_events.id의 'review_set_created' 세트). 프론트는 exclude_seed:true도 항상 넣지만 RPC는 이 키를 읽지 않고 클라이언트가 tags 'seed:' 접두 row를 직접 제거함. |
| `sort` | text | - | 기본 'newest'. 허용값 newest\|oldest\|difficulty-asc\|difficulty-desc. 레거시 별칭 recent\|difficulty도 수용. difficulty 정렬은 difficulty asc/desc 후 created_at desc 보조정렬. |
| `page` | int | - | 기본 1. 1 미만은 1로 클램프. |
| `page_size` | int | - | 기본 20. 1~100 범위로 클램프(>100이면 100). |

**기대 Response**:
```ts
returns table — 0..N rows. 각 row(SQL 컬럼명): { problem_id: uuid, title: text, domain: text, topik_level: smallint|null, question_no: smallint|null, difficulty: smallint|null, tags: text[]|null, attempt_count: int (writing이면 submission+draft 보정수, 아니면 객관식 attempt 수), is_solved: boolean, last_attempt_at: timestamptz|null (writing은 max(submission_at,draft_at), 아니면 객관식 last attempt), created_at: timestamptz, total_count: bigint (필터 적용 후 전체 건수, 모든 row 동일값), solve_state: text 'none'|'attempted'|'submitted', has_draft: boolean, draft_status: text|null, writing_submission_count: int, latest_submission_id: uuid|null, latest_submission_at: timestamptz|null, writing_feedback_status: text|null, lifecycle_status: text, lifecycle_reason: text|null, publish_status: text, review_status: text }. 프론트(UserProblemRow)는 이를 camelCase로 매핑: { problemId, title, domain, topikLevel, questionNo, difficulty, tags:string[], attemptCount, isSolved(=solveState==='submitted'), lastAttemptAt, createdAt, solveState, latestSubmissionId, lifecycleStatus:'active'|'inactive'|'expired', lifecycleReason, publishStatus:'draft'|'published'|'archived', reviewStatus:'pending'|'approved'|'rejected' }. total은 'seed:' tag row 제거 후 보정(첫 row의 total_count 또는 가시 row 수).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `total_count` | bigint | 필터 적용 후 전체 건수(window count). 페이지네이션의 총 건수 소스. 모든 row에 동일. |
| `solve_state` | text | 'none'\|'attempted'\|'submitted'. writing 도메인은 submission>0→submitted, draft 있으면 attempted; 그 외 도메인은 객관식 is_solved/attempt_count 기준. |
| `latest_submission_id` | uuid\|null | submitted writing의 최신 writing_submissions.id. RetryModal '결과 보기' 딥링크용. |
| `writing_feedback_status` | text\|null | 최신 submission의 feedback_status. |
| `last_attempt_at / latest_submission_at / created_at` | timestamptz | KST 변환 없이 timestamptz(ISO)로 반환됨. 클라이언트가 string으로 받음. |

### `problems` · 테이블 · select
> 🟢 **쉬운 설명**: 공개된 문제들의 목록과 기본 정보를 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 문제 제목·영역·급수·난이도·태그 같은 정보와 전체 개수가 돌아온다

**자세한 목적**: 문제 카탈로그(AI 생성 + 큐레이션 통합). 문제풀이 도메인은 published 문제를 목록/추천/다음문제 후보로 읽기만 한다(쓰기는 admin/작성자 경로, 이 도메인 프론트에서는 select 전용).

**사용 위치**:
- `src/lib/practice/queries.ts:99 — fetchProblemList (.from('problems').select(...,{count:'exact'}).eq('publish_status','published'))`
- `src/lib/practice/next.ts:221 — pickProblemExcluding (Tier 2/3 next-problem 후보)`
- `src/lib/practice/next.ts:504 — fetchPublishedProblemAlternatives (대안 문제 폴백)`
- `src/lib/practice/weakness.ts:306 — tag-overlap 폴백 추천`
- `RLS: 20260520121100_rls_policies.sql:67 problems_visible_select — for select to authenticated, published+public 또는 author_id=auth.uid() 또는 is_admin`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `publish_status` | filter eq | 필수 | .eq('publish_status','published') 항상 적용. |
| `question_no` | filter eq | - | 51\|52\|53\|54 (writing). next.ts/queries.ts는 writing set만 사용. |
| `difficulty / topik_level` | filter eq | - | 목록 필터. |
| `title` | filter ilike | - | 검색어 '%term%'. |
| `lifecycle_status` | filter eq | - | weakness.ts tag-fallback에서 .eq('lifecycle_status','active'). |
| `tags` | filter overlaps | - | weakness.ts에서 .overlaps('tags', weakDimensions). |

**기대 Response**:
```ts
select 컬럼 집합은 호출처마다 다름. (A) queries.ts fetchProblemList: { id, domain, question_no, topik_level, difficulty, title, publish_status, review_status, tags, updated_at } + { count:'exact' }. (B) next.ts pickProblemExcluding/fetchPublishedProblemAlternatives: { id, title, domain, question_no, difficulty }. (C) recommendation_items 임베드 조인 시 problems!inner(id, title, domain, question_no, difficulty, publish_status, lifecycle_status). 도메인 enum='reading'|'listening'|'writing'; publish_status='draft'|'published'|'archived'; review_status='pending'|'approved'|'rejected'; difficulty=smallint 1..5 or null; question_no=smallint in (51,52,53,54) or null; tags=text[].
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `domain` | text | 'reading'\|'listening'\|'writing' (check 제약). |
| `question_no` | smallint\|null | 51~54만 허용. 프론트 isWritingQuestionNo로 writing set 필터. |
| `difficulty` | smallint\|null | 1~5. R-02 난이도 배지. |
| `publish_status` | text | RLS는 published+public(또는 본인 author/admin)만 select 허용. |

### `problem_attempts` · 테이블 · select
> 🟢 **쉬운 설명**: 이미 풀어본 객관식 문제 기록을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 내가 시도한 문제와 시도 시각 정보가 돌아온다

**자세한 목적**: 객관식(reading/listening) 시도 기록. 이 도메인 프론트(문제풀이/학습)에서는 '이미 시도한 문제 제외'와 '최근 시도 question_no' 신호용으로 select만 한다. (writing 흐름은 problem_attempts가 아니라 writing_submissions/writing_drafts 사용 — 이 도메인 프론트에서 problem_attempts INSERT/UPDATE 호출은 발견되지 않음. list_user_problems RPC 내부 lateral join으로도 읽힘.)

**사용 위치**:
- `src/lib/practice/next.ts:133 — getNextProblem 시도이력 조회(attemptedIds, latestQuestionNo)`
- `src/lib/practice/next.ts:480 — fetchPublishedProblemAlternatives 동일 패턴`
- `supabase/migrations/20260617183000_list_user_problems_recommended_sort.sql:123 — RPC lateral join 집계`
- `RLS: 20260520121100_rls_policies.sql:140 attempts_owner_all — for all to authenticated user_id=auth.uid(); attempts_admin_select(line 147) — admin select 가능`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | filter eq | 필수 | .eq('user_id', userId). RLS owner-scoped. |
| `select cols` | string | 필수 | 'problem_id, started_at, problems!inner(id, question_no)' — next.ts. 임베드로 problems 조인. |
| `order` | string | - | .order('started_at',{ascending:false}) — 최신 시도 먼저. |

**기대 Response**:
```ts
next.ts select 결과 row: { problem_id: uuid, started_at: timestamptz, problems: { id: uuid, question_no: number|null } | { ... }[] | null }. 테이블 전체 컬럼: { id uuid, user_id uuid, problem_id uuid, selected_answer jsonb|null, is_correct boolean|null, score numeric(5,2)|null, status text 'started'|'submitted'|'reviewed', started_at timestamptz, submitted_at timestamptz|null, bookmarked boolean, time_spent_seconds int|null }. list_user_problems RPC 내부에서는 count(*), bool_or(is_correct), max(started_at) 집계로 사용.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `problem_id` | uuid | 시도한 문제 id (제외 집합 구성). |
| `is_correct` | boolean\|null | RPC 내부 objective_is_solved=bool_or(is_correct). |
| `started_at` | timestamptz | 최근 시도 정렬/last_attempt 집계. |

### `study_events` · 테이블 · insert
> 🟢 **쉬운 설명**: 사용자의 학습 활동 기록을 남긴다
> 🔵 **돌아오는 값(쉽게)**: 저장만 하고 받는 값은 없다(실패해도 그냥 넘어간다)

**자세한 목적**: 사용자별 학습 이벤트 시계열 원장. 분석/대시보드용. 프론트는 fire-and-forget으로 INSERT만 한다(읽기는 admin org dashboard RPC 등 다른 경로). PII 계약: payload는 primitive(string|number|boolean|null)만 허용하고 raw 글쓰기 내용 키(answer/content/draft/narrative 등)는 클라이언트에서 차단/삭제 후 insert. review_set 필터(list_user_problems)에서는 event_type='review_set_created' row를 SELECT로도 사용.

**사용 위치**:
- `src/lib/events/study-events.ts:209 — supabase.from('study_events').insert(row) (logStudyEvent)`
- `src/components/practice/NextProblemView.tsx:134 — recommendation_clicked 등 로깅`
- `src/components/practice/WeaknessView.tsx:156 — 이벤트 로깅`
- `src/components/writing/*Workspace.tsx / WritingEditor.tsx / LongFormEditor.tsx — practice_started/draft_autosaved/submission_submitted 등 다수`
- `supabase/migrations/20260617183000_list_user_problems_recommended_sort.sql:82 — review_set_created 이벤트 payload->'item_ids'를 review_set_id 필터에서 SELECT`
- `RLS: 20260520121100_rls_policies.sql:286 study_events_owner_select(user 또는 admin), :292 study_events_owner_insert(with check user_id=auth.uid())`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | auth.getUser()에서 파생. 세션 없으면 no-op. |
| `event_type` | text | 필수 | 동결 카탈로그: practice_started\|attempt_submitted\|draft_autosaved\|submission_submitted\|feedback_viewed\|report_viewed\|recommendation_clicked\|export_downloaded. (review_set_created는 라이브러리 경로에서 생성) |
| `problem_id` | uuid | - | null 허용. 전용 컬럼(payload에 넣지 않음). |
| `submission_id` | uuid | - | null 허용. |
| `attempt_id` | uuid | - | null 허용. |
| `session_id` | uuid | - | null 허용. |
| `payload` | jsonb | - | primitive-only Record. forbidden 키/200자 초과 string 제거(sanitizePayloadForInsert) 후 빈 객체면 null로 insert. dev/test에서는 위반 시 throw(assertSafePayload), prod는 warn 후 strip. |

**기대 Response**:
```ts
INSERT는 반환값을 사용하지 않음(.insert(row), error만 확인). fire-and-forget: error 시 console.warn만 하고 Promise는 reject하지 않음. 테이블 row 컬럼: { id uuid pk, user_id uuid, event_type text, occurred_at timestamptz default now(), problem_id uuid|null, submission_id uuid|null, attempt_id uuid|null, session_id uuid|null, payload jsonb|null }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `occurred_at` | timestamptz | DB default now(). insert payload에 미포함. |
| `payload` | jsonb\|null | PII 계약상 raw 콘텐츠/네스티드 객체 금지. ID는 전용 컬럼 사용. |

### `learning_goals` · 테이블 · upsert
> 🟢 **쉬운 설명**: 사용자의 토픽 학습 목표를 저장하거나 불러온다
> 🔵 **돌아오는 값(쉽게)**: 목표 급수·목표 등급·시험일·주간 학습시간 같은 저장된 목표가 돌아온다

**자세한 목적**: 사용자당 1개 활성 TOPIK 학습 목표(A-03/X-05). user_id PK 1:1. 프론트는 select(목표 조회) + upsert(저장)만. 대시보드/성장 페이지의 목표 달성률 계산(goalProgress) 입력으로도 사용.

**사용 위치**:
- `src/lib/learning/mutations.ts:20 — .from('learning_goals').upsert(input).select('*').single() (saveLearningGoal)`
- `src/lib/learning/queries.ts:21 — .select('*').eq('user_id',userId).maybeSingle() (fetchLearningGoal)`
- `src/lib/learning/server.ts:22 — count head (hasLearningGoal), :38 select maybeSingle (getLearningGoal, server)`
- `src/components/profile/ExamGoalForm.tsx:126 — saveLearningGoal upsert(user_id,topik_level,target_grade,exam_date,weekly_goal_minutes,weak_areas,is_active)`
- `src/components/learning/LearningGoalForm.tsx:20 — useSaveLearningGoal`
- `RLS: 20260520121100_rls_policies.sql:54 learning_goals_owner_all — for all to authenticated user_id=auth.uid() (owner only, admin bypass 없음)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | PK, profiles(id) FK. upsert 키. RLS user_id=auth.uid(). |
| `topik_level` | text | 필수 | 'TOPIK_I'\|'TOPIK_II' (check). |
| `target_grade` | smallint | 필수 | 1~6 (check). TOPIK_I=1,2 / TOPIK_II=3~6 (프론트 검증). |
| `exam_date` | date | - | null 허용. 과거 날짜 프론트 거부. |
| `weekly_goal_minutes` | int | - | null 허용(프론트 15~2000). |
| `weak_areas` | text[] | - | 기본 '{}'. 약점 영역 태그. |
| `is_active` | boolean | - | 기본 true. |

**기대 Response**:
```ts
upsert(...).select('*').single() → 전체 row 반환: { user_id: uuid, topik_level: 'TOPIK_I'|'TOPIK_II', target_grade: number(1~6), exam_date: string|null (date), weekly_goal_minutes: number|null, weak_areas: string[], is_active: boolean, updated_at: string (timestamptz) }. fetchLearningGoal/getLearningGoal은 select('*').maybeSingle() → 동일 row 또는 null. hasLearningGoal은 count head로 boolean.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `topik_level + target_grade` | text + smallint | goalProgress.calculateGoalProgress 입력. TOPIK_II 등급별 총점 cutoff(3:120,4:150,5:190,6:230)/3섹션으로 writing 100점 환산 목표 산출. |
| `weak_areas` | text[] | 기본 빈 배열. GIN 인덱스. |
| `updated_at` | timestamptz | DB default now(). |

### `src/lib/practice/next.ts (getNextProblem / getNextProblemBundle)` · 라우트 · select
> 🟢 **쉬운 설명**: 다음에 풀면 좋을 문제를 추천해 준다
> 🔵 **돌아오는 값(쉽게)**: 추천 문제 1개와 학습 요약, 대체 문제 후보들이 돌아온다

**자세한 목적**: 다음 문제 추천(R-02) 서버 전용 헬퍼. 별도 HTTP 라우트가 아니라 RSC/서버 컴포넌트(dashboard, practice/next page)에서 직접 호출하는 server client(RLS-bound, service role 아님) 조합 함수. 4-tier 폴백으로 primary 1문제 + summary 신호 + alternatives 3문제 번들을 만든다. 외부 LLM 호출 없음(기존 테이블 신호만 사용).

**사용 위치**:
- `src/app/(workspace)/dashboard/page.tsx:46 — getNextProblemBundle(user.id)`
- `src/app/(workspace)/practice/next/page.tsx:17 — getNextProblemBundle(user.id)`
- `src/components/dashboard/DashboardRecommendations.tsx:16 — 번들 데이터로 추천 카드 렌더`
- `consume 경로: src/lib/practice/consume.ts:29 — recommendation_items.update({status:'consumed'}) (fire-and-forget owner-update)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `userId` | string(uuid) | 필수 | 인증된 사용자 id. createClient는 기본 createSupabaseServerClient. |

**기대 Response**:
```ts
NextProblemBundle = { primary: NextProblemSuggestion|null, primaryTier: 1|2|3|4, summary: { recentSubmissions: number, averageScore: number|null, weakestDimensions: {dimension:string,score:number}[] }, alternatives: AlternativeProblem[] }. NextProblemSuggestion = { problemId:string, title:string, domain:string, questionNo:number|null, source:'recommendation'|'same_question_no'|'random', reason:string|null, difficulty?:number|null, estimatedMinutes?:number|null, itemId?:string|null }. AlternativeProblem = { id:string, title:string, questionNo:number|null, domain:string, reason:string|null, itemId?:string|null, estimatedMinutes?:number|null, difficulty?:number|null, locked?:boolean }. 소비 테이블: recommendation_items(+recommendation_runs!inner, problems!inner), problem_attempts, problems, writing_submissions(count), writing_feedback(score_total), feedback_dimension_scores(dimension,score), profiles(plan_label).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `primaryTier` | 1\|2\|3\|4 | 1=recommendation, 2=same_question_no, 3=random(미시도 published), 4=없음(null). |
| `summary.weakestDimensions` | {dimension,score}[] | feedback_dimension_scores 차원별 평균 하위 3개. |
| `alternatives[].locked` | boolean | R-02 §3 — free plan은 첫 대안만 unlock, 나머지 locked(profiles.plan_label로 isPaidPlan 판정: premium/pro/team/yearly/quarterly/monthly). |
| `itemId` | string\|null | recommendation_items.id — '학습 시작' 시 consumeRecommendationItem이 status='consumed'로 owner-update. |

### `src/lib/events/study-events.ts (logStudyEvent + PII guard)` · 라우트 · insert
> 🟢 **쉬운 설명**: 학습 활동 기록을 안전하게 남기는 도우미다(글 내용은 빼고)
> 🔵 **돌아오는 값(쉽게)**: 받는 값은 없다(로그인 안 했으면 아무 일도 안 한다)

**자세한 목적**: study_events INSERT 클라이언트 래퍼. 별도 HTTP 라우트 아님(브라우저 client 직접 insert). PII 계약 강제 계층: assertSafePayload(forbidden 키/200자 초과/네스티드 거부)+sanitizePayloadForInsert(prod에서 실제 strip). 백엔드 관점에서 study_events row contract와 동일.

**사용 위치**:
- `src/lib/events/study-events.ts:169 — logStudyEvent 정의, :209 insert`
- `src/components/practice/NextProblemView.tsx:134, src/components/practice/WeaknessView.tsx:156 — 문제풀이 화면 이벤트 로깅`
- `src/components/writing/(ShortAnswerWriting51/52, LongFormWriting53, EssayWriting54)Workspace.tsx / WritingEditor.tsx / LongFormEditor.tsx — practice_started/draft_autosaved/submission_submitted 다수 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `input` | LogStudyEventInput | 필수 | { eventType: StudyEventType, problemId?, submissionId?, attemptId?, sessionId?, payload?: Record<string, string\|number\|boolean\|null> }. |

**기대 Response**:
```ts
Promise<void> — 반환값 없음. 계약: 절대 reject하지 않음(dev/test의 'study-events:' assertion만 re-throw). 세션 없으면 silently no-op. 내부적으로 TablesInsert<'study_events'> row를 만들어 insert(상위 study_events 테이블 항목의 INSERT shape와 동일).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `FORBIDDEN_PAYLOAD_KEYS` | string[] | answer_text/answer/content/draft/draft_text/narrative/summary/overall_summary/comment/corrected_text/original_text — org_admin이 study_events를 읽으므로 raw 글쓰기 PII 차단. |
| `MAX_STRING_VALUE_CHARS` | number | 200자 초과 string은 raw 콘텐츠로 간주해 제거. |

### `src/lib/growth/goalProgress.ts (calculateGoalProgress)` · 라우트 · GET
> 🟢 **쉬운 설명**: 목표 대비 얼마나 달성했는지 퍼센트를 계산한다
> 🔵 **돌아오는 값(쉽게)**: 0~100 사이 달성률 숫자가 돌아온다(목표나 점수가 없으면 없음)

**자세한 목적**: 목표 달성률 순수 계산 함수(네트워크/DB 호출 없음 — 외부 API 아님). learning_goals(topik_level,target_grade) + writing_feedback(score_total,score_max) 입력을 받아 0~100 달성률(%)을 산출. dashboard/growth 페이지에서 호출. 백엔드는 이 함수에 들어가는 두 테이블의 필드 정합성만 보장하면 됨(STUB/외부엔드포인트 아님, 클라이언트 계산).

**사용 위치**:
- `src/app/(workspace)/dashboard/page.tsx:95 — calculateGoalProgress({goal, feedbacks}) (goalAchievementPct)`
- `src/app/(workspace)/growth/page.tsx:205 — calculateGoalProgress (성장 페이지 달성률)`
- `입력 소스: learning_goals 테이블 + writing_feedback(score_total/score_max) — 이 도메인 외 테이블이나 계산 입력으로 결합됨`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `goal` | {topikLevel:string\|null, targetGrade:number\|null}\|null | 필수 | learning_goals에서 파생. TOPIK_II + targetGrade(3~6)만 목표점수 산출 가능, 그 외 null. |
| `feedbacks` | {scoreTotal:number\|null, scoreMax:number\|null}[] | 필수 | writing_feedback 배열. score_max 없으면 100 가정, 0..100 정규화. |

**기대 Response**:
```ts
number|null. null = 목표 없음/TOPIK_II 아님/targetGrade 없음/피드백 점수 없음. 그 외 Math.min(100, round((평균정규화점수 / 목표점수) * 100)). 보조 export: getTopikWritingTargetScore(level,grade)→number|null (TOPIK_II 총점 cutoff/3섹션: grade 3=120,4=150,5=190,6=230 → /3); normalizeFeedbackScoreTo100({scoreTotal,scoreMax})→number|null (0..100 클램프).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `TOPIK_II_TOTAL_CUTOFF_BY_GRADE` | Record<3\|4\|5\|6, number> | 공식 TOPIK II 300점 만점 등급 cutoff. writing은 3섹션 중 1개라 /3으로 100점 환산 투영(현재 writing만 채점하는 STUB성 근사). |
| `TOPIK_II_SECTION_COUNT` | number=3 | 총점→writing 100점 환산 분모. |

## dashboard + recommendations (대시보드/추천/리포트)
_학습자 홈 화면의 요약 지표, 추천 문제, 비교 리포트를 만들어 보여주는 영역입니다._

### `get_dashboard_kpi` · RPC · rpc
> 🟢 **쉬운 설명**: 대시보드 위쪽 핵심 숫자 4개를 한 번에 가져온다
> 🔵 **돌아오는 값(쉽게)**: 오늘 응시수, 누적 응시수, 시험 D-day, 연속 학습일이 돌아온다

**자세한 목적**: 대시보드 상단 KPI 4종(오늘 응시수·누적 응시수·시험 D-day·연속 학습일)을 1회 왕복으로 반환. Phase 6에서 기존 4개 쿼리를 단일 RPC로 통합. KST(Asia/Seoul) 기준 하루 경계 계산을 SQL 내부에서 수행.

**사용 위치**:
- `src/lib/learning/kpi.ts:38 — getDashboardKpi() 가 supabase.rpc("get_dashboard_kpi") 호출, _userId 인자는 호환용으로 무시(RPC가 auth.uid()로 본인 식별)`
- `src/app/(workspace)/dashboard/page.tsx:43 — 대시보드 RSC에서 getDashboardKpi(user.id, supabase) 호출 → KPI 타일 렌더`

**기대 Response**:
```ts
// RETURNS TABLE — supabase-js는 단일행 setof를 Array<{...}>로 받음(프론트는 Array.isArray ? data[0] : data 로 1행 추출)
{
  today_attempts: number,   // int, problem_attempts에서 오늘(KST) started_at 카운트
  total_attempts: number,   // int, problem_attempts 전체 카운트
  exam_days_left: number | null, // int, learning_goals.exam_date - today_kst (음수면 null)
  streak_days: number       // int, 오늘/어제로 끝나는 연속 KST 학습일
}
// 프론트 매핑(kpi.ts) → DashboardKpi { todayAttempts, totalAttempts, examDaysLeft(null가능), streakDays, recentFeedback: null(항상 placeholder) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `today_attempts` | int | 오늘(KST 00:00~24:00) problem_attempts.started_at 카운트. 행 없으면 0 |
| `total_attempts` | int | 해당 사용자 problem_attempts 전체 카운트 |
| `exam_days_left` | int \| null | learning_goals.exam_date - 오늘(KST) 일수. exam_date 없음/과거면 null |
| `streak_days` | int | 오늘 또는 어제로 끝나는 연속된 KST 학습일 수. 없으면 0 |

**비고(권한·예외)**: 인자 없음(no-arg). SECURITY DEFINER + auth.uid()로 호출자 본인만 집계(크로스유저 누수 방지, Codex Round1 P1-1). 미인증 시 'unauthenticated' 예외(throw). grant execute to authenticated. ⚠️주의: SQL 본문 streak 계산 CTE에 'Asia\Seoul'(백슬래시) 오타가 있음(line 453, 정상 'Asia/Seoul'과 불일치) — streak_days 계산이 서버 로컬TZ로 falling back될 수 있음, 백엔드 검토 필요. recentFeedback은 RPC가 반환하지 않으며 프론트에서 항상 null로 채움(미사용 placeholder). 정의: supabase/migrations/20260521140000_phase_6_rpc_and_admin.sql:400-488

### `recommendation_items` · 테이블 · select
> 🟢 **쉬운 설명**: 사용자에게 추천할 문제 목록을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 추천 순위, 추천 이유, 예상 풀이시간, 약점 정보와 문제 제목/유형이 돌아온다

**자세한 목적**: 사용자별 추천 문제 아이템(rank·이유·예상시간·취약태그). 대시보드/추천 페이지/약점 페이지/다음문제 추천의 핵심 소스. problems 테이블과 !inner 조인으로 제목·유형 노출.

**사용 위치**:
- `src/lib/practice/queries.ts:71-76,196-202 — fetchUserSolveMap(추천 problem_id 집합)·fetchProblemRecommendations(상위5, problems!inner 조인)`
- `src/components/practice/recommendations-data.ts:105-117 — queryRecommendationBundle: status=active + problems.publish_status=published, rank asc, limit 8`
- `src/lib/practice/next.ts:91-104,408-417 — getNextProblem(recommendation_runs!inner+problems!inner, expires_at 필터, limit8)·fetchAlternatives(rank asc limit4)`
- `src/lib/practice/weakness.ts:260-273 — getWeaknessRecommendations(recommendation_runs!inner expires 필터 + problems!inner, limit4)`
- `src/lib/practice/consume.ts:42-45 — UPDATE status='consumed' (id+user_id+status='active' 매칭)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | text filter | 필수 | .eq('status','active') — 활성 추천만(active/consumed/expired 중) |
| `user_id` | uuid filter | - | 서버 경로에서 .eq('user_id', userId) 명시(브라우저 경로는 RLS auth.uid()로 자동 스코프) |
| `rank` | order | - | .order('rank', ascending:true) — rank 오름차순 |
| `problems.question_no` | embedded filter | - | .eq('problems.question_no', questionNo) — 특정 유형(51~54) 필터(선택) |
| `problems.publish_status` | embedded filter | - | .eq('problems.publish_status','published') — recommendations-data.ts 경로 |

**기대 Response**:
```ts
// select("id, problem_id, rank, reason, estimated_minutes, weakness_tags, problems!inner(title, question_no, publish_status, domain, difficulty)")
{
  id: string,                    // recommendation_items.id (uuid) — consume 시 사용
  problem_id: string,            // uuid → problems.id
  rank: number,                  // int (not null)
  reason: string | null,
  estimated_minutes: number | null, // int
  weakness_tags: string[] | null,   // text[]
  problems: { title: string; question_no: number|null; publish_status?: string; domain?: string; difficulty?: number|null } // 1:1 embed(배열로 올 수도 있어 normalizeJoined로 단일화)
}
// 프론트 매핑 → RecommendationItemCard / RecommendationCard / NextProblemSuggestion / AlternativeProblem / WeaknessRecommendation
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 추천 아이템 PK. consumeRecommendationItem에서 status='consumed' 업데이트 키 |
| `problem_id` | uuid | 추천 대상 problems.id |
| `rank` | int | 추천 순위(대표=rank1). order by rank asc |
| `reason` | text\|null | 이 문제를 추천한 이유 문구 |
| `estimated_minutes` | int\|null | 예상 풀이 시간(분) 배지 |
| `weakness_tags` | text[]\|null | 취약 태그 근거(추천 페이지에서 노출) |

**비고(권한·예외)**: RLS: recommendation_items_owner_select(select, user_id=auth.uid())·recommendation_items_owner_update(update, owner). INSERT 정책 없음 → 추천 생성은 service_role/배치가 담당(프론트는 읽기+소비만). status CHECK: active/consumed/expired. ⚠️쓰기는 consume(status→consumed)만 가능. expires_at 필터는 referencedTable:'recommendation_runs' 옵션으로 run 쪽 컬럼 사용(.or expires_at.is.null,expires_at.gt.now). PostgREST embed가 1객체/배열 둘 다 올 수 있어 프론트가 normalizeJoined로 방어. 정의: supabase/migrations/20260520120600_recommendations.sql:30-54, RLS: 20260520121100_rls_policies.sql:250-265

### `recommendation_runs` · 테이블 · select
> 🟢 **쉬운 설명**: 추천을 만든 기록과 왜 추천했는지 요약을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 추천 출처, 추천 이유 요약, 생성/만료 시각이 돌아온다

**자세한 목적**: 추천 생성 이벤트(run) 레코드. run 단위 '왜 추천했나' 요약(reason_summary)·source_type·만료시각(expires_at) 제공. 한 run이 여러 recommendation_items를 낳음.

**사용 위치**:
- `src/components/practice/recommendations-data.ts:97-102 — 최신 active run 1건(maybeSingle) → reasonSummary/sourceType/createdAt`
- `src/lib/practice/next.ts:95 — recommendation_items 쿼리에서 recommendation_runs!inner(expires_at) 조인 + 만료 필터`
- `src/lib/practice/weakness.ts:264 — 동일하게 recommendation_runs!inner(expires_at) 조인으로 미만료 run의 item만 선별`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `created_at` | order | - | .order('created_at', ascending:false).limit(1).maybeSingle() — 최신 run 1건 |
| `expires_at` | embedded filter | - | items 쿼리에서 recommendation_runs!inner(expires_at) 조인 후 .or(expires_at.is.null,expires_at.gt.now)로 미만료 run만 |

**기대 Response**:
```ts
// recommendations-data.ts select("id, source_type, reason_summary, created_at, expires_at")
{
  id: string,            // uuid
  source_type: string,   // 'dashboard'|'feedback'|'weakness'|'next_problem'
  reason_summary: string | null,
  created_at: string,    // timestamptz ISO
  expires_at: string | null // timestamptz ISO (null=무기한)
}
// 프론트 매핑 → RecommendationRunSummary { reasonSummary, sourceType, createdAt }
// next.ts/weakness.ts 조인 시엔 { expires_at: string|null } 만 select
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | run PK |
| `source_type` | text | 추천 트리거 출처. CHECK: dashboard/feedback/weakness/next_problem |
| `reason_summary` | text\|null | run 단위 추천 근거 요약 |
| `created_at` | timestamptz | 생성 시각(ISO). 최신 run 정렬 기준 |
| `expires_at` | timestamptz\|null | 만료 시각. null이면 무기한. items 유효성 판단에 사용 |

**비고(권한·예외)**: RLS: recommendation_runs_owner_select(select only, user_id=auth.uid()). 주석상 '읽기 전용(owner), 쓰기는 service_role' — INSERT/UPDATE 정책 없음(프론트는 읽기만). source_type CHECK 4종. 정의: supabase/migrations/20260520120600_recommendations.sql:10-19, RLS: 20260520121100_rls_policies.sql:238-245

### `comparison_reports` · 테이블 · select
> 🟢 **쉬운 설명**: 답안 비교 리포트(점수 변화와 AI 분석 글)를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 리포트 생성 시각과 AI가 쓴 분석 내용이 돌아온다

**자세한 목적**: R-01 답안 비교 리포트 스냅샷(점수/차원 델타 metrics + AI 내러티브). 라이브러리 '리포트' 탭에서 generated_at·narrative 발췌 노출, 단건 조회로 상세 표시. AI 내러티브는 재현성 위해 보존.

**사용 위치**:
- `src/lib/library/server.ts:130-132 — joinReports: comparison_reports에서 id/generated_at/narrative 일괄 조회(.in)`
- `src/lib/library/queries.ts:109-111 — 브라우저 동일 join(narrative_excerpt 160자)`
- `src/lib/writing/server.ts:91-95 — getComparisonReport(reportId) 단건 select('*')`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid filter | - | .eq('id', reportId).maybeSingle() — 단건 조회(getComparisonReport) |
| `id` | in filter | - | .in('id', reportIds) — 라이브러리 reports 탭 일괄 조회 |

**기대 Response**:
```ts
// 라이브러리: select("id, generated_at, narrative")
// 단건(writing/server.ts): select("*") → ComparisonReportRow 전체
{
  id: string,                     // uuid
  user_id: string,                // uuid
  current_submission_id: string,  // uuid (not null)
  previous_submission_id: string | null, // uuid
  metrics: Json,                  // jsonb (not null) — {score_delta, dimension_deltas, char_delta, no_previous} 형태(computeComparisonMetrics 산출)
  narrative: string | null,       // AI 비교 서술
  ai_model: string | null,
  generated_at: string            // timestamptz ISO
}
// 라이브러리 매핑 → LibraryReportView { kind:'report', id, generated_at, narrative_excerpt(앞 160자+...), item_id, tags }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 리포트 PK |
| `metrics` | jsonb | 비교 지표. ComparisonMetrics 형태: score_delta(number\|null), dimension_deltas(Record<string,number\|null>), char_delta(number\|null), no_previous(boolean) |
| `narrative` | text\|null | AI 생성 비교 내러티브(라이브러리는 160자 발췌) |
| `generated_at` | timestamptz | 리포트 생성 시각(ISO) |
| `ai_model` | text\|null | 내러티브 생성에 쓴 모델 식별자 |

**비고(권한·예외)**: RLS: comparison_reports_owner_select(select only, user_id=auth.uid() OR private.is_admin). INSERT/UPDATE/DELETE 정책 없음 → 리포트 생성/저장은 프론트 비노출(service_role/서버 측 추정, 도메인 코드 내 insert 없음). metrics/narrative 산출 로직은 src/lib/writing/comparison-service.ts(computeComparisonMetrics·generateNarrative)에 있으나 DB write 호출부는 이 도메인에 없음. 정의: supabase/migrations/20260520120500_feedback.sql:77-95, RLS: 20260520121100_rls_policies.sql:226-233, 타입: src/lib/supabase/types.ts:759-789

### `library_items` · 테이블 · select
> 🟢 **쉬운 설명**: 내 서재에 저장한 항목 목록을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 저장한 답안/리포트/문제/내보내기 항목들이 종류별로 돌아온다

**자세한 목적**: F-01 '내 서재' 다형성 저장 원장. item_type별로 submission/report/problem/export(/attempt) 중 정확히 하나를 가리킴. 4개 탭 목록 조회 + 저장/태그수정/삭제.

**사용 위치**:
- `src/lib/library/server.ts:47-52 — listLibraryItems: user_id+item_type 필터, saved_at desc, select('*')`
- `src/lib/library/queries.ts:35-39 — 브라우저 fetchLibraryItems(동일)`
- `src/lib/library/mutations.ts:31-36 — saveLibraryItem INSERT`
- `src/lib/library/mutations.ts:45-49 — deleteLibraryItem DELETE(.eq id)`
- `src/lib/library/mutations.ts:59-64 — updateItemTags UPDATE({tags})`

**기대 Response**:
```ts
// select("*") → LibraryItemRow(Tables<'library_items'>)
{
  id: string,             // uuid (item_id, 삭제/태그수정 키)
  user_id: string,
  item_type: 'attempt'|'submission'|'report'|'export'|'problem',
  attempt_id: string | null,
  submission_id: string | null,
  report_id: string | null,
  export_id: string | null,
  problem_id: string | null,
  note: string | null,
  tags: string[],         // not null default '{}'
  saved_at: string        // timestamptz ISO
}
// JS-side join 후 → LibrarySubmissionView/ReportView/ProblemView/ExportView(kind 구분 + 대상 엔티티 필드 + item_id + tags)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 서재 행 PK(=item_id). delete/updateItemTags 대상 |
| `item_type` | text | CHECK: attempt/submission/report/export/problem. 탭 매핑(attempt는 Phase6 미노출) |
| `submission_id/report_id/problem_id/export_id/attempt_id` | uuid\|null | 다형성 타겟. 정확히 하나만 non-null(CHECK 강제). 후속 JS join으로 대상 엔티티 조회 |
| `tags` | text[] | 사용자 태그(기본 빈배열). updateItemTags로 수정 |
| `saved_at` | timestamptz | 저장 시각. 목록 정렬 기준(desc) |

**비고(권한·예외)**: RLS: library_items_owner_all(for ALL, user_id=auth.uid() using+with check) → 브라우저에서 직접 insert/update/delete 가능(service_role/RPC 불필요). DB CHECK 2종: 정확히 하나의 *_id non-null + item_type↔*_id 일치. (user,target)별 부분 unique index로 중복 저장 방지(INSERT 시 23505 가능). 대상 엔티티는 nested select 대신 JS-side join(server.ts/queries.ts) — writing_submissions(id,problem_id,question_no,submitted_at,char_count)+problems(id,title) / comparison_reports(id,generated_at,narrative) / problems(id,title,question_no) / export_files(id,source_type,storage_path,status,options). 정의: supabase/migrations/20260520120700_library_events_exports.sql:38-90, RLS: 20260520121100_rls_policies.sql:270-278

### `library_items` · 테이블 · insert
> 🟢 **쉬운 설명**: 답안이나 리포트, 문제를 내 서재에 저장한다
> 🔵 **돌아오는 값(쉽게)**: 방금 저장한 서재 항목 정보가 돌아온다

**자세한 목적**: 서재에 항목 저장(submission/report/problem/export). 정확히 한 개의 *_id를 item_type에 맞춰 설정.

**사용 위치**:
- `src/lib/library/mutations.ts:31-36 — saveLibraryItem(useSaveLibraryItem 훅)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | 소유자(=auth.uid()). RLS with check 강제 |
| `item_type` | text | 필수 | 저장 종류 |
| `<target>_id` | uuid | 필수 | item_type에 매칭되는 단 하나의 FK(submission_id 등) |
| `tags` | text[] | - | 초기 태그(선택) |
| `note` | text | - | 메모(선택) |

**기대 Response**:
```ts
.insert(input).select('*').single() → LibraryItemRow 전체(위 select shape와 동일)
```

**비고(권한·예외)**: RLS library_items_owner_all with check가 user_id=auth.uid() + FK 소유권(타인 submission 저장 차단)까지 검증. 중복 저장은 부분 unique index 위반(23505).

### `library_items` · 테이블 · update
> 🟢 **쉬운 설명**: 서재에 저장한 항목의 태그를 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 태그가 수정된 서재 항목 정보가 돌아온다

**자세한 목적**: 서재 항목 태그 수정.

**사용 위치**:
- `src/lib/library/mutations.ts:59-64 — updateItemTags(useUpdateItemTags 훅)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid filter | 필수 | .eq('id', itemId) |
| `tags` | text[] | 필수 | 교체할 태그 배열 |

**기대 Response**:
```ts
.update({tags}).eq('id',itemId).select('*').single() → LibraryItemRow
```

**비고(권한·예외)**: RLS owner_all. id만으로 필터(user 스코프는 RLS가 보장).

### `library_items` · 테이블 · delete
> 🟢 **쉬운 설명**: 서재에 저장한 항목을 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 돌아오는 데이터는 없고 삭제만 된다

**자세한 목적**: 서재 항목 삭제.

**사용 위치**:
- `src/lib/library/mutations.ts:45-49 — deleteLibraryItem(useDeleteLibraryItem 훅)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | uuid filter | 필수 | .eq('id', itemId) |

**기대 Response**:
```ts
void(.delete().eq('id',itemId), 반환 데이터 없음)
```

**비고(권한·예외)**: RLS owner_all로 본인 행만 삭제 가능.

### `avatars (storage bucket)` · 저장소 · upsert
> 🟢 **쉬운 설명**: 프로필 사진을 올리고 내 계정에 연결한다
> 🔵 **돌아오는 값(쉽게)**: 올린 사진의 저장 위치와 보여줄 수 있는 사진 주소가 돌아온다

**자세한 목적**: X-05 프로필 아바타 업로드. avatars/{userId}/avatar-<ts>.<ext> 경로로 업로드(upsert) 후 public URL 도출, profiles.avatar_path에 경로 저장. 실제 Supabase Storage 연동(스텁 아님).

**사용 위치**:
- `src/components/profile/avatar-upload.ts:86-94 — storage.from('avatars').upload(path, file, {upsert,contentType}) + getPublicUrl`
- `src/components/profile/avatar-upload.ts:96-99 — profiles.update({avatar_path: path}).eq('id', userId)`
- `src/components/profile/avatar-upload.ts:121-123 — storage.from('avatars').remove([path]) (removeAvatar)`
- `src/components/profile/avatar-upload.ts:107-108 — avatarPublicUrl(path): getPublicUrl`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `path` | string | 필수 | `${userId}/avatar-${Date.now()}.${ext}` (ext=png\|jpg) |
| `file` | Blob | 필수 | 정사각 크롭된 이미지 blob |
| `upsert` | boolean | 필수 | true(덮어쓰기) |
| `contentType` | string | 필수 | image/png 또는 image/jpeg |

**기대 Response**:
```ts
// upload → { error } / getPublicUrl(path) → { data: { publicUrl: string } }
// uploadAvatar 반환: AvatarUploadResult { path: string; publicUrl: string }
// 이후 profiles.update({avatar_path: path}).eq('id', userId)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `path` | string | 저장된 객체 경로(profiles.avatar_path에 보존) |
| `publicUrl` | string | public 버킷에서 도출한 표시용 URL |

**비고(권한·예외)**: 버킷 정의: public=true, 5MB, mime png/jpeg/webp(클라는 jpg/png만 허용·5MB 검증). Storage RLS: avatars_public_read(anon+authenticated select), avatars_owner_insert/update/delete((storage.foldername(name))[1] = auth.uid()::text → 본인 폴더만 쓰기). 클라이언트 추가검증: AVATAR_MAX_BYTES=5MB, AVATAR_ALLOWED_TYPES=[image/jpeg,image/png]. profiles.avatar_path 갱신은 별도 update 호출(아바타와 한 트랜잭션 아님). 정의: supabase/migrations/20260520121200_storage_buckets.sql:10, 정책: 20260520121300_storage_policies.sql:19-54

## auth + account + affiliation (로그인/회원/탈퇴/기관코드)
_로그인·소셜 로그인 콜백·닉네임 중복확인·약관 동의·계정 탈퇴, 그리고 박람회/기관 코드 등록을 처리하는 영역입니다._

### `request_account_deletion` · RPC · rpc
> 🟢 **쉬운 설명**: 로그인한 본인이 직접 회원 탈퇴를 한다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아온다(별도 데이터 없음)

**자세한 목적**: 로그인한 본인 계정을 셀프서비스로 소프트 삭제(회원 탈퇴)한다. 호출자 본인 profiles.status='deleted', deleted_at=now()로 멱등 전환. 복구(deleted->active)와 하드삭제는 범위 밖.

**사용 위치**:
- `src/app/auth/account-delete/route.ts:41 — POST /auth/account-delete route handler가 supabase.rpc('request_account_deletion') 호출 후 전역 signOut`
- `src/components/profile/AccountDeletionCard.tsx — 설정 danger-zone 모달 폼이 /auth/account-delete로 POST(간접 호출)`

**기대 Response**:
```ts
void (반환값 없음 / Returns: undefined). 성공 시 data=null, error=null. 실패 시 PostgrestError(error.message/code). 프론트는 error 유무만 검사한다.
```

**비고(권한·예외)**: 정의: supabase/migrations/20260622120000_account_deletion_soft_delete.sql:100. SECURITY DEFINER, search_path=pg_catalog,public. authenticated에게만 grant(public/anon revoke). 인자 없음(auth.uid()로 호출자 식별). 동작: ①auth.uid() null이면 raise 'unauthenticated' ②profile 없으면 raise 'profile not found' ③이미 deleted면 deleted_at 재스탬프 없이 멱등 성공 반환(30일 복구시계 보호) ④status<>'active'(예: blocked)면 raise 'account is not active (status=%)' ⑤active면 status='deleted', deleted_at=now() UPDATE. UPDATE는 private.protect_profile_columns 트리거의 '본인 active->deleted 단방향' 예외를 통과. 백엔드 주의: 진짜 삭제(storage/auth.users 하드삭제 30일 cron)와 복구 RPC는 미구현(후속). admin_audit_logs 기록도 안함(deleted_at로 충분).

### `is_nickname_available` · RPC · rpc
> 🟢 **쉬운 설명**: 입력한 닉네임을 다른 사람이 쓰는지 확인한다
> 🔵 **돌아오는 값(쉽게)**: 사용 가능하면 참, 이미 쓰이면 거짓이 돌아온다

**자세한 목적**: 닉네임 후보가 사용 가능한지(다른 회원이 쓰지 않는지) 다른 profiles 행을 노출하지 않고 확인. 프로필 편집 화면의 닉네임 실시간 중복검사.

**사용 위치**:
- `src/lib/settings/mutations.ts:48 — checkNicknameAvailability(nickname)가 supabase.rpc('is_nickname_available',{candidate})`
- `src/components/profile/ProfileForm.tsx:340 — 닉네임 입력 디바운스 후 checkNicknameAvailability 호출로 available/taken/failed 상태 표시`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `candidate` | text | 필수 | 검사할 닉네임 후보. 프론트는 nickname.trim()으로 보내고, 함수 내부에서 lower(btrim(candidate))로 정규화. |

**기대 Response**:
```ts
boolean — 사용 가능하면 true, 불가/빈값이면 false. 프론트는 data === true로 비교(checkNicknameAvailability).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(scalar)` | boolean | true=사용 가능, false=이미 사용 중 또는 후보가 빈 문자열 |

**비고(권한·예외)**: 정의: supabase/migrations/20260617214000_nickname_availability_rpc.sql:5. SECURITY DEFINER, STABLE, search_path=pg_catalog,public. authenticated에게만 grant. 동작: ①auth.uid() null이면 raise 'unauthenticated' ②정규화 후 빈값이면 false ③profiles에서 lower(nickname)=정규화값 AND id<>caller_id 행이 없으면 true. 즉 '본인이 이미 쓰는 닉네임'은 available로 본다(자기 행 제외). 실제 저장 시 유일성은 profiles_nickname_lower_uniq 인덱스(23505)가 최종 강제 — RPC 통과해도 동시성으로 update 시 NicknameTakenError 가능(mutations.ts:118).

### `claim_affiliation_code` · RPC · rpc
> 🟢 **쉬운 설명**: 가입 때 못 받은 기관(QR) 코드를 내 계정에 채워 넣는다
> 🔵 **돌아오는 값(쉽게)**: 적용된 코드가 돌아오고, 형식이 틀리면 빈 값이 온다

**자세한 목적**: OAuth 가입 등 가입 메타데이터로 affiliation_code를 못 받은 경로에서, 로그인 직후 클라이언트가 localStorage에 보관해둔 기관(박람회 QR) 코드를 본인 profiles.affiliation_code에 1회 백필. 이미 설정돼 있으면 no-op.

**사용 위치**:
- `src/lib/auth/affiliation-code.ts:119 — claimStoredAffiliationCode()가 supabase.rpc('claim_affiliation_code',{p_code: affiliationCode})`
- `src/components/auth/ClaimAffiliationRedirect.tsx:22 — /auth/claim-affiliation 페이지가 마운트 시 claim 후 nextPath로 router.replace`
- `src/app/auth/claim-affiliation/page.tsx:22 — ClaimAffiliationRedirect 렌더(OAuth 가입 후 진입점)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_code` | text | 필수 | 기관/박람회 코드. 함수가 btrim 후 정규식 ^[A-Za-z0-9_-]{2,64}$ 검증. 불일치면 아무것도 안 하고 null 반환. |

**기대 Response**:
```ts
text | null — 적용된(검증 통과한) 코드 문자열을 그대로 반환, 형식 불일치면 null. 프론트(affiliation-code.ts)는 반환값을 쓰지 않고 error 유무만으로 'claimed'|'failed'|'empty' 결과를 만든다.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(scalar)` | text\|null | 정규식 통과한 코드 v_code(=btrim(p_code)) 그대로 반환. 형식 불일치 시 null. UPDATE가 0행이어도(이미 코드 있음) 코드 문자열은 반환됨. |

**비고(권한·예외)**: 정의: supabase/migrations/20260619140000_profiles_affiliation_code.sql:128. SECURITY DEFINER, search_path=pg_catalog,public. authenticated에게만 grant. 동작: ①auth.uid() null이면 raise 'unauthenticated' ②코드 정규식 불일치면 return null ③set_config('app.claim_affiliation_code','1',true)로 트랜잭션 로컬 플래그 set → protect_profile_columns 트리거가 신뢰 경로로 인식 ④UPDATE profiles SET affiliation_code=v_code WHERE id=caller AND (affiliation_code IS NULL OR ''): write-once(이미 있으면 0행). 코드 '의미'(라벨/종류/유효성)는 검증하지 않음 — v13은 admin institution_codes 카탈로그와 디커플. 클라 정규식: ^[A-Za-z0-9_-]{2,64}$, localStorage 키 'talkpik:affiliation-code', TTL 24h. 이메일 가입 경로는 이 RPC 대신 handle_new_user 트리거가 raw_user_meta_data.affiliation_code에서 seed.

### `profiles` · 테이블 · select
> 🟢 **쉬운 설명**: 내 회원 정보(이름/닉네임/언어/등급 등)를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 내 프로필 한 건(이름·닉네임·언어·권한·요금제 등)이 돌아온다

**자세한 목적**: auth.users와 1:1 미러. 신뢰 속성(app_role/plan_label/status)과 사용자 편집 속성(display_name/nickname/ui_locale/nationality_country_code/bio/notification_prefs/avatar_path) + 가입 출처 affiliation_code/탈퇴시각 deleted_at. INSERT는 클라가 못함(on_auth_user_created 트리거가 생성). 본인 행만 select/update(보호컬럼 제외).

**사용 위치**:
- `src/lib/auth/profile.ts:45 bootstrapProfile — select('*').eq('id',userId).maybeSingle()`
- `src/lib/auth/profile.ts:126 fetchProfileStatus — select('status') (비활성 게이트)`
- `src/lib/settings/mutations.ts:65/113/150/171 — updateLocale/updateProfile/updateNotificationPrefs`
- `src/lib/legal/consent.ts:193 backfillOAuthDisplayName — update(patch).select('*')`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select '*'` | select | - | bootstrapProfile/getCurrentProfile: id로 단일 행 전체 조회(maybeSingle) |
| `select 'status'` | select | - | fetchProfileStatus: 비활성(deleted/blocked) 게이트용 status만 조회 |
| `select 'notification_prefs'` | select | - | 알림설정 read-modify-write 전 현재 jsonb 조회 |
| `update {ui_locale}` | update | - | updateLocale: ui_locale(ko\|en\|vi) 변경 |
| `update {display_name,nickname,nationality_country_code,bio}` | update | - | updateProfile: 제공된 키만 부분 패치(나머지 컬럼 보존) |
| `update {notification_prefs}` | update | - | updateNotificationPrefs: 화이트리스트 키 병합 후 전체 jsonb 재기록 |
| `update {display_name,nickname} .select('*')` | update | - | backfillOAuthDisplayName: OAuth 가입자 빈 display_name/nickname 백필 후 갱신 행 반환 |

**기대 Response**:
```ts
Tables<'profiles'> Row: { id: uuid; display_name: string|null; nickname: string|null (citext); avatar_path: string|null; ui_locale: 'ko'|'en'|'vi'; app_role: 'learner'|'content_admin'|'org_admin'|'platform_admin'; plan_label: string; status: 'active'|'blocked'|'deleted'; affiliation_code: string|null; deleted_at: string|null (timestamptz); notification_prefs: jsonb; nationality_country_code: string|null; bio: string|null; created_at: string; updated_at: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `app_role` | 'learner'\|'content_admin'\|'org_admin'\|'platform_admin' | 인가 역할. JWT/메타데이터에서 절대 가져오지 않음. 본인 update로는 변경 불가(트리거 차단). |
| `status` | 'active'\|'blocked'\|'deleted' | active만 접근 허용. deleted=탈퇴, blocked=차단. 본인 update로 변경 불가(단, request_account_deletion RPC만 active->deleted 예외). |
| `nickname` | citext\|null | lower(nickname) 유일 인덱스. 중복 시 23505 / profiles_nickname_lower_uniq. |
| `affiliation_code` | string\|null | 박람회/기관 코드. 일반 update로 변경 불가(claim_affiliation_code RPC만 set). non-null=기관회원 마커. |
| `deleted_at` | timestamptz\|null | 탈퇴 요청 시각. status=deleted 전환 시 기록. active면 null. |

**비고(권한·예외)**: 정의: 20260520120100_profiles_goals.sql:10. RLS(20260520121100_rls_policies.sql): profiles_self_select(id=auth.uid() OR is_admin) / profiles_self_update(id=auth.uid()) / profiles_admin_all(is_admin). 보호컬럼 트리거 private.protect_profile_columns(BEFORE UPDATE, 20260622120000 최신본): 비관리자가 app_role/plan_label/status/affiliation_code 변경 시 42501 raise — 단 ①본인 active->deleted ②app.claim_affiliation_code='1' 플래그 시 affiliation_code 예외. INSERT 정책 없음 — 클라 insert 불가, on_auth_user_created 트리거(handle_new_user, SECURITY DEFINER)가 raw_user_meta_data에서 display_name/nationality_country_code/affiliation_code seed. null 반환은 (a)트리거 실패 또는 (b)RLS로 비소유 행 숨김 둘 중 하나 — 모두 'row missing'으로 오해 금지(profile.ts 주석).

### `user_consents` · 테이블 · insert
> 🟢 **쉬운 설명**: 약관·개인정보 동의 내역을 한 줄 기록한다
> 🔵 **돌아오는 값(쉽게)**: 기록 성공 여부가 돌아온다(언제·어떤 버전 동의했는지 저장됨)

**자세한 목적**: 약관/개인정보(legal_documents) 동의 이력 추가전용 원장. 어떤 문서 버전을 언제, 어떤 출처(signup/re_consent/settings)로 수락했는지 1행씩 기록. 가입/재동의 플로우에서 사용. 본인 행 read + insert만, update/delete 없음(불변).

**사용 위치**:
- `src/lib/legal/consent.ts:113 getMissingRequiredConsentDocuments — select('document_id').eq('user_id').in('document_id',ids)`
- `src/lib/legal/consent.ts:143 recordRequiredConsents — insert(rows)`
- `src/app/auth/consent/actions.ts:44 acceptRequiredConsentsAction — recordRequiredConsents(...,'signup') 호출(서버 액션)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select 'document_id'` | select | - | getMissingRequiredConsentDocuments: user_id + document_id IN (필수문서들)로 이미 동의한 문서 조회 |
| `insert rows[]` | insert | - | recordRequiredConsents: 미동의 문서마다 {user_id,document_id,doc_type,version,source} 한 행씩 일괄 insert |

**기대 Response**:
```ts
TablesInsert<'user_consents'> 입력: { user_id: uuid; document_id: uuid; doc_type: 'terms'|'privacy'; version: string; source: 'signup'|'re_consent'|'settings' (default 'signup') }. select 시 Row 추가 필드: { id: uuid; accepted_at: timestamptz; created_at: timestamptz }. 코드에서는 select('document_id')만 읽음 → { document_id: string }[].
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `document_id` | uuid | legal_documents.id FK(ON DELETE RESTRICT). 누락 동의 계산의 키. |
| `doc_type` | 'terms'\|'privacy' | 감사 안정성 위해 비정규화 저장(문서 변경돼도 보존). |
| `version` | string | 수락한 문서 버전 비정규화. |
| `source` | 'signup'\|'re_consent'\|'settings' | 동의 출처. 기본 'signup'. |

**비고(권한·예외)**: 정의: 20260608120000_legal_documents_and_consents.sql:69. RLS: user_consents_owner_select(user_id=auth.uid() OR is_platform_admin) / user_consents_owner_insert(with check user_id=auth.uid()). UPDATE/DELETE 정책 없음 → 행 불변(append-only 원장). service_role은 RLS 우회(가입/백필). 동의 누락 계산은 legal_documents에서 locale+status='published'+requires_consent=true 행을 doc_type별 최신으로 추린 뒤 user_consents.document_id와 차집합.

### `user_marketing_consent` · 테이블 · select
> 🟢 **쉬운 설명**: 마케팅 알림 수신 동의 여부를 확인한다
> 🔵 **돌아오는 값(쉽게)**: 동의 시점·수신거부 시점·수신거부 링크용 토큰이 돌아온다

**자세한 목적**: 마케팅 알림 EXPLICIT opt-in 동의/수신거부 저장(H-2). 유효 동의 = consented_at IS NOT NULL AND unsubscribed_at IS NULL. unsubscribe_token(uuid)은 세션 없는 이메일 수신거부 링크의 인증 수단. profiles 미변경 가산형 테이블.

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:158 resolveUnsubscribeToken — select('unsubscribe_token').eq('user_id')`
- `src/app/api/notifications/unsubscribe/route.ts:98 — select('user_id, unsubscribed_at').eq('unsubscribe_token')`
- `src/app/api/notifications/unsubscribe/route.ts:119 — update({unsubscribed_at}).eq('unsubscribe_token').is('unsubscribed_at',null)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select 'unsubscribe_token'` | select | - | dispatch-email: user_id로 수신자 토큰 해석(service_role) |
| `select 'user_id, unsubscribed_at'` | select | - | unsubscribe: token으로만 행 조회(user_id 입력받지/노출하지 않음, service_role) |
| `update {unsubscribed_at}` | update | - | unsubscribe: token + unsubscribed_at IS NULL 조건으로 수신거부 시각 기록(멱등, service_role) |

**기대 Response**:
```ts
Row: { user_id: uuid (PK, profiles FK ON DELETE CASCADE); consented_at: timestamptz|null; unsubscribed_at: timestamptz|null; unsubscribe_token: uuid (NOT NULL, default gen_random_uuid(), UNIQUE); source: text|null; updated_at: timestamptz }. 라우트에서 실제 읽는 필드는 select에 따라 {unsubscribe_token} 또는 {user_id, unsubscribed_at}.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `consented_at` | timestamptz\|null | EXPLICIT opt-in 시각. null=동의한 적 없음 → 마케팅 발송 자격 없음(opted_out). |
| `unsubscribed_at` | timestamptz\|null | 수신거부 시각. not null이면 동의 있어도 발송 자격 없음. |
| `unsubscribe_token` | uuid | 수신거부 링크 토큰. 이메일 본문 링크에 포함. 서버 service_role 플로우 인증 수단(세션 불필요). |
| `source` | text\|null | 동의 출처(signup/settings/import), 감사용. |

**비고(권한·예외)**: 정의: 20260612200000_user_marketing_consent.sql:24. RLS: owner select/insert/update(user_id=auth.uid()) 3정책 + force. anon 정책 없음 — 토큰 수신거부는 서버 service_role(RLS 우회)로만 실행, 토큰 자체가 인증. 주의: 이 auth/account 도메인 코드에서는 직접 쓰기 경로가 없고, 위 사용처는 모두 notifications API(service_role)다. 설정화면 opt-in/out 사용자 세션 쓰기 경로(owner update 정책 대상)는 이 도메인 src/lib에는 미발견 — 백엔드 계약상 owner RLS는 정의돼 있으나 현재 프론트 호출자는 service_role 라우트뿐. v13 Database 타입에 아직 없어 라우트가 최소 스키마(UnsubscribeSchema)를 인라인 선언.

### `GET /auth/callback` · 라우트 · GET
> 🟢 **쉬운 설명**: 이메일 인증·비번 재설정·소셜 로그인 후 로그인 상태를 만든다
> 🔵 **돌아오는 값(쉽게)**: 로그인되면 원래 가던 화면으로, 실패하면 오류 화면으로 이동시킨다

**자세한 목적**: 이메일 인증/비밀번호 재설정/OAuth 콜백 처리 Route Handler. token_hash+type(PKCE), code(OAuth code), provider error, 또는 fragment(implicit) 분기 처리 후 세션 쿠키를 Set-Cookie로 emit하고 next(또는 /auth/error)로 303 redirect.

**사용 위치**:
- `src/app/auth/callback/route.ts:129 export async function GET`
- `src/components/auth/SignUpForm.tsx:294 — emailRedirectTo=/auth/callback?next=/onboarding/learning-goal`
- `tests/app/auth/callback-route.test.ts — 분기 단위 테스트`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `token_hash` | query string | - | PKCE 메인 플로우 OTP 해시. type과 함께 와야 함. |
| `type` | query 'signup'\|'recovery'\|'email_change'\|'email' | - | verifyOtp 타입. 허용 4종 외(또는 token_hash 있는데 invalid)면 /auth/error?reason=unknown. |
| `code` | query string | - | OAuth code 플로우. exchangeCodeForSession 대상. |
| `error_code` | query string | - | 일부 OAuth provider의 에러코드. 있으면 mapSupabaseErrorCode 후 /auth/error. |
| `error_description` | query string | - | provider 에러 설명(로깅). |
| `next` | query string | - | 성공 후 이동 경로. sanitizeNext로 검증/정규화. 기본 미지정. |

**기대 Response**:
```ts
HTTP 302/307 Redirect (NextResponse.redirect). 본문 JSON 아님. 성공: Location=next(0.0.0.0->localhost 보정), Set-Cookie=세션쿠키. 실패: Location=/auth/error?reason=<mapped>[&retry_after_seconds=<n>]. 토큰 없음(implicit): Location=/auth/callback-fragment?next=<next> (브라우저가 #fragment 자동 보존).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `Location (success)` | header | sanitize된 next 경로로 redirect. 세션쿠키 동봉. |
| `reason (error)` | query | mapSupabaseErrorCode 결과(AuthErrorReason). rate-limit 계열은 retry_after_seconds=60(RATE_LIMIT_FALLBACK_SECONDS) 동봉. |

**비고(권한·예외)**: dynamic='force-dynamic'. @supabase/ssr createServerClient를 쿠키 getAll/setAll 수집 패턴으로 만들어 withAuthCookies(response)로 응답에 Set-Cookie 실제 emit(Server Component였을 때 silent fail하던 Phase8 P0 버그 회피). OAuth code 재방문(stale callback)+기존 세션 있으면 에러 무시하고 next로 진행. supabase-js v2가 Retry-After 헤더를 노출 안 해 rate-limit 시 60초 고정 fallback forward. mapSupabaseErrorCode/sanitizeNext는 src/lib/auth/error-mapping.ts.

### `POST /auth/sign-out` · 라우트 · POST
> 🟢 **쉬운 설명**: 서버에서 안전하게 로그아웃시킨다
> 🔵 **돌아오는 값(쉽게)**: 로그아웃 후 로그인 화면으로 이동시킨다

**자세한 목적**: 서버사이드 로그아웃. supabase.auth.signOut()으로 세션 쿠키 무효화 후 /login으로 303 redirect. POST 전용(CSRF 보호 — GET 링크/img 태그로 로그아웃 트리거 차단).

**사용 위치**:
- `src/app/auth/sign-out/route.ts:30 POST / :47 GET(405)`
- `ProfileLogoutForm 등 클라 폼/페치가 POST(동일 full-page submit 철학)`

**기대 Response**:
```ts
POST: HTTP 303 Redirect → Location=/login (next 쿼리 있어도 무시, 항상 /login). 본문 없음. GET: 405 JSON { error: 'Method Not Allowed', allow: ['POST'] } + Allow: POST 헤더.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `Location` | header | 항상 /login(새 세션 경계를 명확히). |

**비고(권한·예외)**: dynamic='force-dynamic'. body 불필요(현재 세션 쿠키 읽어 signOut). signOut 에러는 콘솔 로깅만 하고 그대로 /login redirect. createSupabaseServerClient(@/lib/supabase/server)는 Route Handler에서 쿠키 쓰기 가능.

### `POST /auth/account-delete` · 라우트 · POST
> 🟢 **쉬운 설명**: 설정 화면에서 회원 탈퇴를 실제로 처리한다
> 🔵 **돌아오는 값(쉽게)**: 성공하면 모든 기기에서 로그아웃되고 로그인 화면으로 이동한다

**자세한 목적**: 회원 탈퇴 실행 Route Handler. 설정 danger-zone 모달 폼 submit. getUser로 본인 확인 → request_account_deletion RPC(소프트삭제) → signOut({scope:'global'})(전기기 refresh token 폐기) → /login?reason=withdrawn 303.

**사용 위치**:
- `src/app/auth/account-delete/route.ts:30 POST / :72 GET(405)`
- `src/components/profile/AccountDeletionCard.tsx:81 — <form method=post action=/auth/account-delete>`
- `src/lib/routes.ts:25 authAccountDelete`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `(form submit)` | form POST | - | 폼 본문은 서버에서 재검증하지 않음(type-to-confirm 키워드 검증은 클라가 차단). 세션 쿠키로 본인 식별. |

**기대 Response**:
```ts
POST: 성공 303 → /login?reason=withdrawn (전역 signOut). 미인증 303 → /login. RPC 실패 303 → /settings/account?delete=error (세션 유지, danger-zone이 인라인 에러 표시). GET: 405 JSON { error:'Method Not Allowed', allow:['POST'] } + Allow:POST.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `Location (success)` | header | /login?reason=withdrawn |
| `Location (rpc error)` | header | /settings/account?delete=error — AccountDeletionCard가 delete=error 감지해 message.error 표시 |

**비고(권한·예외)**: dynamic='force-dynamic'. RPC 자체가 authenticated 전용 + auth.uid() 본인 행만. service-role 불필요(세션 무효화는 본인 세션 scope:'global'). signOut 실패해도 status=deleted 이미 기록돼 다른 기기는 다음 이동 시 workspace layout status 게이트가 /auth/account-inactive로 정리하므로 치명적이지 않음. 구현 브리프: docs/sot-change-proposals/2026-06-22-account-deletion-self-service.md.

### `GET /auth/account-inactive` · 라우트 · GET
> 🟢 **쉬운 설명**: 탈퇴·차단된 계정의 남은 로그인 정보를 정리한다
> 🔵 **돌아오는 값(쉽게)**: 세션을 지우고 사유(탈퇴/차단)와 함께 로그인 화면으로 보낸다

**자세한 목적**: 탈퇴(deleted)/차단(blocked) 계정이 아직 만료 안 된 access token을 들고 있을 때 로컬 세션 쿠키를 정리하는 Route Handler. workspace layout이 비활성 status 감지 후 여기로 redirect(Server Component는 쿠키 못 지움). signOut({scope:'local'}) 후 /login?reason= 으로 303.

**사용 위치**:
- `src/app/auth/account-inactive/route.ts:29 export async function GET`
- `workspace layout: status!=='active' → redirect /auth/account-inactive?status=<status>`
- `src/lib/auth/profile.ts:158 requireActiveSession / consent/actions.ts:36 — ACCOUNT_INACTIVE_PATH?status=로 redirect`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | query 'deleted'\|'blocked' 등 | - | layout이 넘긴 profiles.status. 'blocked'면 reason=blocked, 그 외(deleted 포함)는 reason=withdrawn. |

**기대 Response**:
```ts
HTTP 303 Redirect → /login?reason=withdrawn (status!=blocked) | /login?reason=blocked (status=blocked). 본문 없음. 로컬 세션 쿠키 정리.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `reason` | query | blocked\|withdrawn — /login의 안내 메시지 분기 |

**비고(권한·예외)**: dynamic='force-dynamic'. GET 사용 이유: layout redirect(navigation)로 도달, 파괴적 서버 변경 없음(로컬 쿠키 정리만)이라 CSRF 비대상. scope:'local'은 현재 기기 쿠키만 정리(refresh token은 탈퇴 시 이미 global 폐기). /login 직행 시 proxy가 still-authenticated 사용자를 /dashboard로 튕겨 루프 → 이 라우트가 쿠키 먼저 정리하고 /login 착지.

## notifications (인앱/이메일/구독해지)
_사용자에게 앱 안 알림과 이메일을 실제로 보내고(워커), 이메일 수신거부를 처리하는 영역입니다._

### `user_notifications` · 테이블 · select
> 🟢 **쉬운 설명**: 내 알림함의 알림 목록을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 내 알림들(제목·내용·읽음여부)과 안 읽은 개수를 화면에 보여줄 수 있다

**자세한 목적**: 인앱 알림 함(벨 뱃지 / 팝오버 인박스 / B-01 대시보드 알림 카드)의 표시 데이터. 로그인 사용자 본인 알림만 조회.

**사용 위치**:
- `src/components/notifications/notifications-data.ts:55 fetchNotifications (select id,template_key,category,title,body,link_url,read_at,created_at)`
- `src/components/notifications/notifications-data.ts:38 fetchUnreadNotificationCount (select id, count exact head, is read_at null)`
- `src/components/notifications/NotificationBell.tsx:72 벨 팝오버 인박스 + 60초 주기 미읽음 카운트 폴링`
- `src/components/dashboard/DashboardAlertsCard.tsx:73 B-01 대시보드 알림 카드 (limit 5)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id (eq)` | uuid | 필수 | 조회 대상 = 본인 id. RLS가 auth.uid()로 강제하므로 필터와 정책이 동일해야 함 |
| `read_at (is null)` | filter | - | 미읽음 카운트 조회 시에만 추가(count exact, head true) |
| `order created_at desc / limit` | modifier | - | 목록은 created_at 내림차순, limit 5(대시보드)/20(벨) |

**기대 Response**:
```ts
UserNotification = { id: string; template_key: string; category: 'study'|'exam_schedule'|'notice'|'event'|'marketing'; title: string; body: string; link_url: string | null; read_at: string | null; created_at: string }  // 미읽음 카운트 쿼리는 { count: number | null } 만 반환
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 알림 PK (읽음 처리 키) |
| `template_key` | text | 발송 템플릿 키 (study_reminder, weekly_summary, feedback_ready 등) |
| `category` | text enum | study \| exam_schedule \| notice \| event \| marketing (체크 제약). 프론트는 NotificationCategory 유니온으로 좁힘 |
| `title` | text | {{display_name}} 치환·HTML strip 완료된 제목(파이프라인이 render_notification_text로 기록) |
| `body` | text \| null | 본문 텍스트(plain). DB 컬럼은 nullable이나 프론트 타입은 string |
| `link_url` | text \| null | 클릭 시 router.push 대상 내부 경로 |
| `read_at` | timestamptz \| null | null이면 미읽음(점 표시). 읽음 처리로 set |
| `created_at` | timestamptz | 생성 시각. 프론트가 relativeTime/dateTime 포맷에 사용 |

**비고(권한·예외)**: RLS: owner SELECT (user_id = auth.uid()). insert/delete는 anon·authenticated에서 revoke됨(파이프라인 service_role만 insert). 클라이언트는 절대 insert/delete 불가. body/link_url은 DB상 nullable. category 체크 제약 위반 값이 오면 프론트 유니온 밖이라 라벨 매핑이 깨질 수 있음.

### `user_notifications (read_at update)` · 테이블 · update
> 🟢 **쉬운 설명**: 알림을 읽음으로 표시한다(하나 또는 전체)
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아온다(실패하면 화면을 원래대로 되돌림)

**자세한 목적**: 알림 읽음 처리. 단건(항목 클릭) 및 전체 읽음(markAllRead). read_at 컬럼만 갱신 가능.

**사용 위치**:
- `src/components/notifications/notifications-data.ts:74 markNotificationRead(id)`
- `src/components/notifications/notifications-data.ts:86 markAllNotificationsRead(userId) — eq user_id + is read_at null`
- `src/components/notifications/NotificationBell.tsx:90 handleItemClick / 115 handleMarkAll (낙관적 갱신)`
- `src/components/dashboard/DashboardAlertsCard.tsx:90 handleNotificationClick`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id (eq)` | uuid | - | 단건 읽음 처리 시 대상 알림 id |
| `user_id (eq) + read_at is null` | filter | - | 전체 읽음 처리 시 본인의 미읽음 행 전부 |
| `read_at (set)` | timestamptz | 필수 | new Date().toISOString() 기록. 컬럼-레벨 grant상 read_at만 쓰기 가능 |

**기대 Response**:
```ts
{ error: { message: string } | null }  // 반환 행 없음(void). 프론트는 낙관적 업데이트 후 에러 시 롤백
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | object \| null | 성공 시 null. 실패 시 message 문자열만 사용(throw) |

**비고(권한·예외)**: RLS: owner UPDATE (using/with check user_id=auth.uid()). 테이블-레벨 update는 anon·authenticated에서 revoke 후 grant update(read_at) 단일 컬럼만 부여 → 다른 컬럼 갱신 시도는 권한 거부. insert/delete 불가. markNotificationRead는 user_id 필터 없이 id만으로 update하지만 RLS가 소유자 행으로 한정.

### `notification_settings` · 테이블 · select
> 🟢 **쉬운 설명**: 내 알림 설정값을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 리마인더 시각·요일·채널(앱/이메일/Zalo)·시간대가 돌아온다(없으면 기본값)

**자세한 목적**: X-09 알림 설정 화면 로드. 사용자별 리마인더 시각/요일/채널/타임존(인앱·이메일·Zalo 토글의 영속 상태).

**사용 위치**:
- `src/components/settings/learning-settings-data.ts:166 fetchNotificationSettings (select reminder_time,reminder_days,channels,timezone)`
- `src/components/settings/NotificationPrefsForm.tsx:218 설정 화면 로드 effect`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id (eq)` | uuid | 필수 | 본인 행(1:1). maybeSingle — 행 없으면 기본값 사용 |

**기대 Response**:
```ts
NotificationSettings = { reminder_time: string | null /* HH:mm:ss */; reminder_days: number[] /* 0..6 */; channels: { in_app: boolean; email: boolean; zalo: boolean }; timezone: string }  // 행 없으면 기본 { reminder_time:null, reminder_days:[], channels:{in_app:true,email:false,zalo:false}, timezone:'Asia/Seoul' }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `reminder_time` | time \| null | DB time 타입 → 'HH:mm:ss' 문자열. 프론트가 dayjs로 파싱 |
| `reminder_days` | jsonb (array) | 요일 인덱스 배열 [0=일..6=토]. 비배열이면 [] 로 coerce |
| `channels` | jsonb (object) | {in_app,email,zalo} bool. 누락 in_app 키는 true로 해석(레거시 기본 수신) |
| `timezone` | text | IANA tz, 기본 Asia/Seoul |

**비고(권한·예외)**: RLS: notification_settings_owner_all (FOR ALL, user_id=auth.uid()) — 소유자 전체 권한. DB 컬럼 제약: reminder_days는 jsonb array, channels는 jsonb object 체크. DB 기본 channels는 {email:false,zalo:false}(in_app 키 없음) → 프론트가 in_app 누락을 true로 보정. email/zalo 채널 토글은 현재 화면에서 disabled('준비 중')이나 스키마는 이미 영속 가능.

### `notification_settings (upsert)` · 테이블 · upsert
> 🟢 **쉬운 설명**: 내 알림 설정을 저장한다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아온다

**자세한 목적**: X-09 알림 설정 저장. 리마인더 시각/요일/채널/타임존을 user_id 충돌 기준 upsert.

**사용 위치**:
- `src/components/settings/learning-settings-data.ts:194 upsertNotificationSettings`
- `src/components/settings/NotificationPrefsForm.tsx:359 handleFinish 저장(설정이 dirty일 때만)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | PK. onConflict 키 |
| `reminder_time` | string \| null | 필수 | 'HH:mm:ss' 또는 null |
| `reminder_days` | number[] | 필수 | 요일 인덱스 배열 (jsonb로 저장) |
| `channels` | object | 필수 | {in_app,email,zalo} bool 객체 |
| `timezone` | string | 필수 | IANA tz 문자열 |

**기대 Response**:
```ts
{ error: { message: string } | null }  // 반환 행 없음(void). onConflict: 'user_id'
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | object \| null | 성공 시 null |

**비고(권한·예외)**: RLS: owner_all with check user_id=auth.uid() → 타인 행 upsert 불가. updated_at은 trg_notification_settings_touch_updated_at 트리거가 자동 갱신. 별개로 3개 boolean 알림조건(weekly_summary/feedback_ready/study_reminder)은 profiles.notification_prefs(jsonb)에 useUpdateNotificationPrefs로 저장 — 이 테이블이 아님.

### `notification_log` · 테이블 · select
> 🟢 **쉬운 설명**: [폐기 예정] 옛날 발송 이력을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 채널·상태·발송시각이 담긴 이력 목록이 돌아온다(현재는 새 이력으로 대체됨)

**자세한 목적**: [DEPRECATED] X-09 발송 이력 패널. 현재는 notification_delivery_attempts로 대체됨(fetchDeliveryHistory). notification_log 테이블 폐기 전까지 코드만 잔존.

**사용 위치**:
- `src/components/settings/learning-settings-data.ts:230 fetchNotificationLog (deprecated, 현재 미호출)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id (eq)` | uuid | 필수 | 본인 이력 |
| `order created_at desc / limit` | modifier | - | 최신순 기본 5건 |

**기대 Response**:
```ts
NotificationLogEntry = { id: string; channel: string; template_key: string; status: 'sent'|'failed'|'pending'; sent_at: string | null; created_at: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 로그 PK |
| `channel` | text | 발송 채널 |
| `template_key` | text | 템플릿 키 |
| `status` | text | sent \| failed \| pending (체크 제약) |
| `sent_at` | timestamptz \| null | 발송 시각 |
| `created_at` | timestamptz | 생성 시각 |

**비고(권한·예외)**: RLS: notification_log_owner_select — 소유자 또는 platform_admin SELECT. 클라이언트 write 없음(service_role 기록). ⚠️@deprecated: 호출부 없음(현행 발송이력 = notification_delivery_attempts). payload(jsonb) 컬럼은 select하지 않음. 백엔드는 이 테이블을 신규로 의존하지 말 것 — 폐기 예정.

### `notification_delivery_attempts` · 테이블 · select
> 🟢 **쉬운 설명**: 내 알림이 채널별로 어떻게 발송됐는지 이력을 본다
> 🔵 **돌아오는 값(쉽게)**: 채널·상태(성공/실패/대기 등)·발송시각 목록이 돌아온다

**자세한 목적**: X-09 채널별 발송 이력(현행). 사용자별 최근 전송 시도 N건을 읽기 전용으로 표시.

**사용 위치**:
- `src/components/notifications/notifications-data.ts:106 fetchDeliveryHistory (select id,channel,template_key,status,sent_at,created_at)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id (eq)` | uuid | 필수 | 본인 시도 이력 |
| `order created_at desc / limit` | modifier | - | 최신순 기본 5건 |

**기대 Response**:
```ts
DeliveryHistoryEntry = { id: string; channel: string; template_key: string; status: 'sent'|'failed'|'pending'|'skipped'|'opted_out'|'deduped'; sent_at: string | null; created_at: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 시도 PK |
| `channel` | text | in_app \| email 등 |
| `template_key` | text | 템플릿 키 |
| `status` | text | sent \| failed \| pending \| skipped \| opted_out \| deduped (프론트 유니온) |
| `sent_at` | timestamptz \| null | 성공 발송 시각(sent일 때만 set) |
| `created_at` | timestamptz | 시도 생성 시각 |

**비고(권한·예외)**: ⚠️소유권: 이 테이블은 topik-ai(admin) 스키마 소유 — admin_schema_migrations가 생성. v13 마이그레이션에는 DDL 없음(생성된 Database 타입에도 없어 (supabase as any)로 캐스팅). RLS는 owner read-only(작성자 주석). 프론트는 SELECT만. 추가 status 값(skipped/opted_out/deduped)은 파이프라인 정책 평가 결과. 동일 테이블을 dispatch-email 라우트가 service-role로 update함(아래 항목 참조).

### `notification_delivery_attempts (worker update)` · 테이블 · update
> 🟢 **쉬운 설명**: 이메일 발송기가 대기중인 메일을 실제로 보내고 결과를 기록한다
> 🔵 **돌아오는 값(쉽게)**: 보낼 메일 목록을 먼저 받고, 발송 후 성공/실패 결과를 기록한다

**자세한 목적**: 이메일 워커가 pending email attempt를 transport 결과로 종결(sent/failed/pending 재시도). dispatch-email 라우트 내부 service-role 사용.

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:232 pending email attempt 조회(BATCH_LIMIT 50)`
- `src/app/api/notifications/dispatch-email/route.ts:303 성공 → status='sent'+provider_message_id+sent_at`
- `src/app/api/notifications/dispatch-email/route.ts:433 applyFailure → retry_count+1, 캡 미만이면 pending 복귀 else failed`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id (eq)` | uuid | 필수 | 종결할 attempt id |
| `status` | text | 필수 | 성공→'sent', 실패+재시도캡 미만→'pending', 캡 도달→'failed' |
| `provider_message_id` | string \| null | - | nodemailer info.messageId(성공 시) |
| `error_code / error_message` | string \| null | - | 실패 시 코드(no_recipient_email/no_template/smtp_error)와 message(최대 500자) |
| `retry_count` | number | - | 실패 시 +1. MAX_RETRY=3 |
| `sent_at` | string \| null | - | 성공 시 ISO, 실패 시 null |

**기대 Response**:
```ts
// SELECT 단계: { data: Array<{ id, user_id, dispatch_id, template_key, retry_count }>, error } — channel='email' AND status='pending' ORDER BY created_at ASC LIMIT 50.  UPDATE 단계: { error: { message } | null }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | object \| null | update 실패 시 console.error만(워커는 계속 진행) |

**비고(권한·예외)**: service-role 클라이언트(RLS 우회, persistSession:false). 정직성 경계: SMTP send가 resolve된 경우에만 'sent' 기록. SMTP 미구성이면 attempt를 일절 건드리지 않음(503 반환). live 모드에서 SQL dispatcher가 남긴 status='pending'(channel=email)만 워커가 집어감. 재시도 캡(3회)은 SQL retry_failed_email_attempts와 동일 로직 미러.

### `notification_dispatches` · 테이블 · select
> 🟢 **쉬운 설명**: 이메일 발송기가 보낼 알림에 맞는 템플릿을 찾는다
> 🔵 **돌아오는 값(쉽게)**: 사용할 템플릿 식별값이 돌아온다

**자세한 목적**: 이메일 워커가 attempt의 dispatch_id → template_id를 해석하기 위해 조회(템플릿 본문 찾기 1차 경로). service-role.

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:379 resolveContent — dispatch_id로 template_id 조회`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id (eq)` | uuid | 필수 | attempt.dispatch_id |

**기대 Response**:
```ts
{ template_id: string | null }  // maybeSingle
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `template_id` | uuid \| null | 연결된 notification_templates.id. null이면 template_key 폴백 |

**비고(권한·예외)**: ⚠️소유권: topik-ai(admin) 스키마 소유 — v13 마이그레이션에 DDL 없음(워커가 최소 스키마 {id, template_id}만 선언). 워커 SELECT만. 발송 디스패처(SQL private 함수)가 INSERT/UPDATE(target_type, status, dedupe_key, channels, recipient_count, scheduled_at, actor_id 등 다수 컬럼) — 프론트/워커는 그 컬럼 미사용. 프론트(브라우저)는 이 테이블에 접근 안 함.

### `notification_templates` · 테이블 · select
> 🟢 **쉬운 설명**: 이메일 발송기가 보낼 제목·본문·링크를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 메일 제목·본문·링크가 돌아온다

**자세한 목적**: 이메일 워커가 발송할 제목/본문/링크/class를 조회. dispatch.template_id 경유(1차) 또는 template_key+channel='email'+status='active' 폴백(2차).

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:386 template_id로 subject,body_html,link_url,class 조회`
- `src/app/api/notifications/dispatch-email/route.ts:402 폴백: template_key+channel='email'+status='active'`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id (eq)` | uuid | - | dispatch.template_id로 직접 조회(1차) |
| `template_key (eq) + channel='email' + status='active'` | filter | - | 폴백(2차) — active email 템플릿 |

**기대 Response**:
```ts
{ subject: string | null; body_html: string | null; link_url: string | null; class: string | null }  // maybeSingle. 워커가 ResolvedContent로 매핑(+ profiles.display_name 추가)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `subject` | text \| null | 이메일 제목. {{display_name}} 치환 대상 |
| `body_html` | text \| null | HTML 본문(워커가 HTML 그대로 발송) |
| `link_url` | text \| null | CTA 링크 경로. 본문에 '알림 확인하기' 앵커로 부착 |
| `class` | text \| null | transactional\|operational\|learning\|marketing. 'marketing'이면 수신거부 링크 부착 |

**비고(권한·예외)**: ⚠️소유권: topik-ai(admin) 스키마 소유 — v13 DDL 없음(워커 최소 스키마 선언). 워커 SELECT만. 전체 컬럼(template_key, channel, status, class, subject, body_html, link_url, mandatory, category 등)은 admin 발송 화면/SQL 디스패처 소유. class='marketing'이면 워커가 appendUnsubscribeLink로 수신거부 링크(user_marketing_consent.unsubscribe_token) 부착. 프론트(브라우저)는 접근 안 함.

### `user_marketing_consent (worker select)` · 테이블 · select
> 🟢 **쉬운 설명**: 광고 메일에 붙일 수신거부 링크용 코드를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 수신거부에 쓸 코드가 돌아온다

**자세한 목적**: 이메일 워커가 marketing class 메일에 붙일 수신거부 토큰을 해석. service-role.

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:153 resolveUnsubscribeToken`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id (eq)` | uuid | 필수 | 수신자 id |

**기대 Response**:
```ts
{ unsubscribe_token: string | null }  // maybeSingle
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `unsubscribe_token` | uuid | 수신거부 링크 토큰. 행 없으면 null → 링크 미부착 |

**비고(권한·예외)**: v13 마이그레이션 20260612200000 생성. 워커는 service-role(RLS 우회). 토큰 못 찾으면 깨진 링크 대신 원문 반환(마케팅은 자격상 발송 불가 상태라 정상경로엔 미발생). 소유자 RLS는 owner select/insert/update(user_id=auth.uid()). 유효 동의 = consented_at is not null AND unsubscribed_at is null.

### `user_marketing_consent (unsubscribe select+update)` · 테이블 · update
> 🟢 **쉬운 설명**: 수신거부 링크로 광고 메일 수신을 끈다
> 🔵 **돌아오는 값(쉽게)**: 처리 완료(또는 이미 처리됨) 여부가 돌아온다

**자세한 목적**: 마케팅 수신거부 처리. 이메일 링크 클릭(세션 없음) → 토큰으로만 조회 후 unsubscribed_at 기록. 멱등.

**사용 위치**:
- `src/app/api/notifications/unsubscribe/route.ts:97 select user_id,unsubscribed_at by token`
- `src/app/api/notifications/unsubscribe/route.ts:118 update unsubscribed_at where token + is unsubscribed_at null`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `unsubscribe_token (eq)` | uuid | 필수 | URL ?token= 또는 JSON body.token. UUID 형식 사전검사 후 조회/갱신. user_id는 받지도 노출도 안 함 |
| `unsubscribed_at (set) + is null 조건` | timestamptz | 필수 | new Date().toISOString(). 이미 set이면 갱신 안 함(멱등) |

**기대 Response**:
```ts
// 라우트 응답(테이블 행 아님): GET→HTML 페이지(200 완료/이미됨, 400 잘못된토큰, 500 오류).  POST→ { ok:true, status:'수신거부 처리되었습니다.'|'이미 수신거부됨.' } 또는 { ok:false, error:'invalid_token'|'server_misconfigured'|'unsubscribe_failed' }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id, unsubscribed_at` | select | 내부 분기용 조회(응답엔 미노출) |
| `error` | object \| null | lookup/update 실패 분기 |

**비고(권한·예외)**: 인증 모델: 토큰 소지가 인증(세션 없음). service-role RLS 우회. 정보 누출 방지 — 행 없음/형식 오류는 invalid_token(400)으로 통일, 계정 정보 일절 미노출. 멱등: 이미 수신거부된 토큰도 200. UUID 정규식(rfc4122) 사전검사로 DB 조회 전 단락.

### `POST /api/notifications/dispatch-email` · 라우트 · POST
> 🟢 **쉬운 설명**: 대기중인 알림 이메일을 실제로 발송한다
> 🔵 **돌아오는 값(쉽게)**: 몇 건을 처리하고 몇 건 성공·실패했는지가 돌아온다

**자세한 목적**: 앱-사이드 이메일 워커. pg_net 미설치로 SQL이 발송 못 하는 live 모드의 pending email attempt를 nodemailer(Daou Office SMTP)로 실제 발송하고 결과를 기록. cron이 호출.

**사용 위치**:
- `src/app/api/notifications/dispatch-email/route.ts:183 POST 핸들러`
- `src/lib/routes.ts:740 API-NOTIFICATIONS-DISPATCH-EMAIL 라우트 스펙(미들웨어 excluded). cron이 호출하는 서비스 엔드포인트(프론트 UI 호출 없음)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `x-worker-secret (header)` | string | 필수 | NOTIFICATION_WORKER_SECRET와 일치해야 함. 불일치/미설정 시 401 |
| `(body)` | none | - | 요청 바디 없음. 처리 배치는 DB의 pending attempt(최대 50)에서 산정 |

**기대 Response**:
```ts
성공: { ok: true, processed: number, sent: number, failed: number } (200)  |  실패: { ok: false, error: 'unauthorized' }(401) | { ok:false, error:'smtp_not_configured' }(503) | { ok:false, error:'server_misconfigured' }(500) | { ok:false, error:'query_failed' }(500).  GET → 405 { error:'Method Not Allowed', allow:['POST'] }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `ok` | boolean | 성공 true / 가드 실패 false |
| `processed` | number | 처리한 attempt 수 |
| `sent` | number | SMTP 발송 성공 수 |
| `failed` | number | 발송 실패(수신자/템플릿 미해석 또는 SMTP 오류) 수 |
| `error` | string | 실패 코드: unauthorized \| smtp_not_configured \| server_misconfigured \| query_failed |

**비고(권한·예외)**: runtime=nodejs, dynamic=force-dynamic. AuthZ=worker secret 헤더(사용자 세션 아님). 의존 env: NOTIFICATION_WORKER_SECRET, SMTP_HOST/SMTP_USER/SMTP_PASS/SMTP_PORT(기본465)/SMTP_FROM(기본 '도토리 토픽 <guest@keduall.com>'), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL(기본 https://app.talkpik.ai). 정직성: SMTP 미구성→503 no-op(attempt 무변경). 발송 대상 이메일은 auth.users(supabase.auth.admin.getUserById)로만 해석(profiles에 email 없음, 가입 사용자만 발송). 465=implicit TLS. keduall.com SPF가 _spf.daouoffice.com 포함. body_html은 HTML 그대로 발송, {{display_name}}만 치환(미존재 시 '학습자'). CTA 링크 + (marketing이면)수신거부 링크 부착.

### `GET /api/notifications/unsubscribe` · 라우트 · GET
> 🟢 **쉬운 설명**: 메일의 수신거부 링크를 눌렀을 때 처리한다
> 🔵 **돌아오는 값(쉽게)**: 수신거부 완료 안내 화면(웹페이지)이 보인다

**자세한 목적**: 마케팅 이메일 본문의 수신거부 링크 클릭(브라우저 네비게이션) 처리. 토큰으로만 인증, HTML 확인 페이지 반환. 멱등.

**사용 위치**:
- `src/app/api/notifications/unsubscribe/route.ts:132 GET 핸들러`
- `src/lib/routes.ts:749 API-NOTIFICATIONS-UNSUBSCRIBE 라우트 스펙(미들웨어 excluded)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `token (query ?token=)` | uuid | 필수 | user_marketing_consent.unsubscribe_token. 없거나 비-uuid면 400 |

**기대 Response**:
```ts
HTML 페이지(Content-Type text/html): 200 '수신거부 완료'(신규 처리/이미됨) | 400 '잘못된 요청'(유효하지 않은 링크) | 500 '일시적 오류'(misconfigured/error)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(HTML body)` | text/html | 한국어 확인 페이지. 상태별 제목/문구 상이 |

**비고(권한·예외)**: runtime=nodejs, dynamic=force-dynamic. 세션 없음 — 토큰 소지가 인증. service-role(RLS 우회). 정보 누출 방지: 미존재/형식오류 토큰을 동일하게 invalid 처리, 계정 정보 미노출. 멱등(이미 수신거부=200). 의존 env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

### `POST /api/notifications/unsubscribe` · 라우트 · POST
> 🟢 **쉬운 설명**: 폼/프로그램 방식으로 광고 수신을 끈다
> 🔵 **돌아오는 값(쉽게)**: 처리 완료 여부가 돌아온다

**자세한 목적**: 프로그램적/폼 제출 방식 수신거부. GET과 동일 로직, JSON 응답.

**사용 위치**:
- `src/app/api/notifications/unsubscribe/route.ts:153 POST 핸들러`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `token` | uuid | 필수 | query ?token= 또는 JSON body { token }. 비-uuid/누락 시 invalid_token |

**기대 Response**:
```ts
성공: { ok: true, status: string }(200)  |  실패: { ok:false, error:'invalid_token' }(400) | { ok:false, error:'server_misconfigured' }(500) | { ok:false, error:'unsubscribe_failed' }(500)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `ok` | boolean | 성공 true |
| `status` | string | 성공 시 한국어 안내('수신거부 처리되었습니다.'\|'이미 수신거부됨.') |
| `error` | string | invalid_token \| server_misconfigured \| unsubscribe_failed |

**비고(권한·예외)**: GET과 동일 service-role/토큰 인증/멱등 모델. 토큰은 쿼리 우선, 없으면 JSON body.token. 바디가 비-JSON이면 token=null → invalid_token.

### `private.dispatch_notifications / dispatch_scheduled_notifications / dispatch_admin_notifications / dispatch_notification_event / retry_failed_email_attempts / notification_email_transport / finalize_email_attempt / render_notification_text` · RPC · rpc
> 🟢 **쉬운 설명**: 정해진 시간에 알림을 자동으로 만들어 발송한다(시스템 전용)
> 🔵 **돌아오는 값(쉽게)**: 무엇을 몇 건 발송·재시도했는지 집계 결과가 돌아온다

**자세한 목적**: [프론트 비호출 — pg_cron 전용] 알림 발송 SQL 디스패처 일체. 스케줄형(study_reminder/weekly_summary) in_app·email, 관리자 발송, 이벤트형(feedback_ready), 이메일 재시도. 시각 출처=DB now() 단일.

**사용 위치**:
- `supabase/migrations/20260612180000_notification_dispatcher.sql (in_app 디스패처)`
- `supabase/migrations/20260612190000_notification_email_pipeline.sql (email 확장)`
- `supabase/migrations/20260612190200_email_live_defer.sql (live→app worker defer)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_template_key` | text | - | dispatch_scheduled_notifications/dispatch_notification_event 인자 |
| `p_channel` | text | - | 'in_app'\|'email' (스케줄형), null=전 활성 채널(이벤트형) |
| `p_user_id / p_event_id / p_payload` | uuid/text/jsonb | - | 이벤트형 디스패치 인자(event_id 기반 dedupe) |

**기대 Response**:
```ts
jsonb 집계 객체 (예: { at, study_reminder:{...}, weekly_summary:{...}, admin:{processed,dispatches}, email_retry:{retried,succeeded,still_failed,deferred} }). 프론트 타입 매핑 없음 — cron/관리자 백엔드 전용.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(jsonb)` | jsonb | 집계 결과: sent/skipped/opted_out/failed/deduped 카운트, dispatch_id, attempt_id 등. 프론트가 소비하지 않음 |

**비고(권한·예외)**: ⚠️중요: 이 함수들은 모두 topik-ai `admin_schema_migrations` 소유 private 스키마(PostgREST 미노출) 함수이며 public/anon/authenticated에서 EXECUTE가 REVOKE됨 → 프론트엔드(.rpc())에서 호출 불가/호출 안 함. pg_cron 10분 tick(dispatch_notifications)으로만 실행. v13 src 전체에 .rpc() 알림 호출 0건. live 모드 email은 SQL이 'sent'로 만들지 않고 attempt를 'pending'으로 두어 dispatch-email 워커 라우트에 위임(정직성 경계). 백엔드 참고용으로만 기재 — 프론트 호출 계약 아님.

## export (PDF 내보내기)
_학습 결과나 리포트를 PDF 파일로 만들어 내려받게 해주는 영역입니다._

### `POST /api/export/pdf` · 라우트 · POST
> 🟢 **쉬운 설명**: 답안·리포트를 PDF 파일로 만들어 저장한다
> 🔵 **돌아오는 값(쉽게)**: 성공하면 만들어진 PDF의 식별값·저장위치·파일명이 돌아오고, 실패하면 한국어 오류 메시지가 돌아온다

**자세한 목적**: 서버 측에서 react-pdf로 실제 PDF 파일을 동기 생성하는 메인 라우트(F-M1). 한 요청 안에서: ①세션/계정상태 확인 ②월 한도 검사 ③export_files row(status='queued') 삽입 ④대상 데이터(submission/report/library_selection) 조회+렌더 ⑤generated-exports 버킷 업로드 ⑥status='ready'+ready_at 갱신 ⑦study_events('export_downloaded') 텔레메트리. 실패 시 row를 status='failed'로 남기고 4xx/5xx JSON 반환 → 클라이언트는 브라우저 인쇄 폴백으로 전환.

**사용 위치**:
- `src/lib/export/pdf-export-client.ts:72 requestServerPdfExport — fetch('/api/export/pdf', POST) 후 응답 storagePath로 downloadStoredPdfExport 호출`
- `src/lib/export/pdf-export-client.ts:108 exportPdfWithPrintFallback — requestServerPdfExport 성공=mode:'file', 실패 catch 시 triggerPdfExport(브라우저 인쇄)로 폴백=mode:'print'`
- `src/components/library/PdfExportModal.tsx:172 handleExport — library_selection + itemIds로 호출(PDF 출력 설정 모달)`
- `src/components/library/ExportPdfButton.tsx:112 — submission/report 단건 PDF 버튼`
- `src/components/feedback/NextActionBar.tsx:103 onPdf — 피드백 화면 'PDF로 저장' 액션(sourceType:'submission')`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `sourceType` | "submission" \| "report" \| "library_selection" | 필수 | 내보내기 대상 유형. discriminatedUnion 판별자. zod 검증(pdfExportRequestSchema) |
| `sourceId` | uuid | - | sourceType='submission'\|'report'일 때 필수. 대상 writing_submissions.id 또는 comparison_reports.id. UUID 정규식 검증. library_selection에는 이 필드 자체가 없음 |
| `itemIds` | uuid[] (1~6개) | - | sourceType='library_selection'일 때만 필수. library_items.id 배열. min(1)·max(6=PDF_EXPORT_MAX_ITEMS). RLS가 본인 소유만 반환하므로 서버에서 재검증됨 |
| `options.filename` | string (1~60자) | 필수 | 다운로드 표시용 파일명. trim 후 1~60자(PDF_FILENAME_MAX). 서버가 sanitizePdfFilename으로 경로구분자/예약문자/제어문자 제거(한글 허용) |
| `options.includeAnswers` | boolean | 필수 | 내 답안 포함 여부 |
| `options.includeFeedback` | boolean | 필수 | AI 피드백 포함 여부. true면 getFeedbackBundle로 점수/차원/문장교정까지 PDF 항목에 채움 |
| `options.layout` | "paged" \| "continuous" | 필수 | 두 페이지(문제별 페이지 구분) / 한 페이지(연속) 레이아웃 |
| `options.orientation` | "portrait" \| "landscape" | 필수 | 페이지 방향 |

**기대 Response**:
```ts
성공(200): { exportId: string(uuid); storagePath: string(="exports/{user_id}/{export_id}.pdf"); filename: string(="{sanitized}.pdf") }  // 클라이언트 타입 ServerPdfExportResult
실패: { error: string } (한국어 사용자 메시지). 400=잘못된 JSON/옵션 검증 실패, 401=미로그인('로그인이 필요해요.'), 403={error:'account_inactive'}(탈퇴/차단), 404='답안/리포트/저장답안을 찾을 수 없어요.', 429='PDF 내보내기는 월 3회까지...', 500=기록생성/생성실패
GET 405: { error:'Method Not Allowed', allow:['POST'] } (Allow: POST 헤더)
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `exportId` | string(uuid) | 생성된 export_files row의 id. 성공 응답 + 폴백 결과에 사용 |
| `storagePath` | string | generated-exports 버킷 내 경로 exports/{user_id}/{export_id}.pdf. 클라이언트가 이 경로로 storage.download() 호출 |
| `filename` | string | 다운로드 시 저장될 파일명({sanitized}.pdf) |
| `error` | string | 실패 시 한국어 사용자 노출 메시지. 클라이언트는 throw new Error로 폴백 트리거 |

**비고(권한·예외)**: runtime='nodejs' 강제(react-pdf yoga + 폰트 fs 접근 → Edge 불가), dynamic='force-dynamic'. 인증=createSupabaseServerClient + supabase.auth.getUser()(쿠키 세션), 미인증 401. 계정상태=fetchProfileStatus+isActiveStatus, deleted/blocked는 403 'account_inactive'. /api/* 는 proxy 매처 제외라 라우트가 직접 status 검증. 월 한도=assertMonthlyPdfExportLimit(status≠'failed' row count, PDF_EXPORT_MONTHLY_LIMIT=3, 초과 시 429). 모든 시도가 새 row(재시도 포함, §3-H) → 실패 이력이 ledger에 남음. react-pdf renderToBuffer + buildPdfDocument/registerPdfFonts(@/lib/export/pdf-document). 텔레메트리 실패는 swallow(.then(noop,noop))되어 내보내기를 막지 않음. 모든 DB 조회는 세션 클라이언트로 실행되어 RLS(본인 소유)가 강제됨.

### `@react-pdf/renderer (renderToBuffer)` · 외부 · POST
> 🟢 **쉬운 설명**: 화면 내용을 실제 PDF 데이터로 그려낸다
> 🔵 **돌아오는 값(쉽게)**: 완성된 PDF 데이터가 돌아와 곧바로 저장소에 올린다

**자세한 목적**: 서버 라우트 내부에서 PDF 바이너리를 메모리 버퍼로 렌더링하는 외부 라이브러리. buildPdfDocument(@/lib/export/pdf-document)가 만든 React PDF 문서 트리를 renderToBuffer로 Buffer화한 뒤 generated-exports 버킷에 application/pdf로 업로드. registerPdfFonts()로 폰트 파일(fs) 사전 등록 필요(Edge 런타임 불가 사유).

**사용 위치**:
- `src/app/api/export/pdf/route.ts:17 import { renderToBuffer } from '@react-pdf/renderer'`
- `src/app/api/export/pdf/route.ts:124 renderToBuffer(buildPdfDocument({ title, generatedAtLabel, items, options }))`
- `src/lib/export/pdf-document.tsx buildPdfDocument/registerPdfFonts(문서 트리·폰트 등록)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `document` | ReactPdfDocument | 필수 | buildPdfDocument({ title, generatedAtLabel(YYYY-MM-DD), items: PdfExportItem[], options }) 반환 트리 |

**기대 Response**:
```ts
renderToBuffer(document) → Promise<Buffer> (PDF 바이너리). 이후 supabase.storage.from('generated-exports').upload(path, buffer, {contentType:'application/pdf', upsert:false})로 저장.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(buffer)` | Buffer | 생성된 PDF 바이너리. 그대로 스토리지 업로드 페이로드 |

**비고(권한·예외)**: PdfExportItem 항목 형태(resolvePdfExportItems가 조립): submission 항목 = { kind:'submission', questionNo, problemTitle:string|null(problems published만 읽혀 회수 시 null 가능), submittedAt(YYYY-MM-DD), answerText, charCount, feedback: null | { scoreTotal, scoreMax, overallSummary, dimensions:[{dimension,score,scoreMax,summary}], sentences:[{sentenceIndex,originalText,correctedText,comment}] } }. report 항목 = { kind:'report', generatedAt(YYYY-MM-DD), narrative }. 백엔드 관점에서는 외부 npm 의존(package.json)이며 별도 엔드포인트 아님 — DB/스토리지 호출은 route.ts가 수행.

### `export_files (insert — queued)` · 테이블 · insert
> 🟢 **쉬운 설명**: PDF 만들기를 시작했다는 기록을 새로 남긴다
> 🔵 **돌아오는 값(쉽게)**: 새로 만든 기록의 식별값이 돌아오고, 실패하면 기록을 못 만들었다는 오류가 돌아온다

**자세한 목적**: 서버 PDF 생성 시작 시 ledger row 생성. status='queued', storage_path는 임시 placeholder(server-render://{uuid}), options에 {source:'server_render', ...요청옵션} 저장. 업로드 성공 후 별도 update로 실경로/ready 전환. 재시도 포함 모든 시도가 새 row(§3-H).

**사용 위치**:
- `src/app/api/export/pdf/route.ts:85-100 supabase.from('export_files').insert({...status:'queued'}).select('id').single()`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | auth.getUser().id. RLS with check가 = auth.uid() 강제 |
| `source_type` | "submission"\|"report"\|"library_selection" | 필수 | 요청 sourceType 그대로 |
| `source_id` | uuid \| null | - | library_selection이면 null, 그 외 요청 sourceId. RLS가 source_type별 본인 소유(writing_submissions/comparison_reports) 검증 |
| `storage_path` | string | 필수 | queued 단계 placeholder = `server-render://${crypto.randomUUID()}` (NOT NULL 제약 충족용) |
| `options` | jsonb | - | { source:'server_render', filename, includeAnswers, includeFeedback, layout, orientation } |
| `status` | "queued" | 필수 | 초기 상태. CHECK(queued\|ready\|failed) |

**기대 Response**:
```ts
.insert({...}).select('id').single() → { id: string(uuid) }. insertError 또는 빈 결과면 500 '내보내기 기록을 만들지 못했어요.'
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | 생성된 export row id = exportId. 이후 update/storage 경로/study_events payload에 사용 |

**비고(권한·예외)**: RLS: export_files_owner_insert(20260521140000 §4.2) — user_id=auth.uid() AND (source_type='submission' AND source_id 본인 writing_submissions) OR (source_type='report' AND source_id 본인 comparison_reports) OR (source_type='library_selection' AND source_id IS NULL). 컬럼(20260520120700): id uuid PK, user_id NOT NULL FK→profiles(cascade), source_type text CHECK, source_id uuid, storage_path text NOT NULL, options jsonb, status text default 'queued' CHECK, created_at timestamptz default now(), ready_at timestamptz. updated_by/author 컬럼 없음. 인덱스: (user_id, created_at desc), partial (status) where queued|failed.

### `export_files (insert — browser_print, ready)` · 테이블 · insert
> 🟢 **쉬운 설명**: 브라우저 인쇄용 내보내기 기록을 바로 완료 상태로 남긴다
> 🔵 **돌아오는 값(쉽게)**: 내보내기 기록의 식별값이 돌아와 곧이어 인쇄창을 띄운다

**자세한 목적**: 브라우저 인쇄(Tier1 MVP / 서버생성 실패 폴백) 경로에서 곧바로 status='ready' ledger row 삽입. storage_path='browser-print://{uuid}'(실제 파일 없음), options={source:'browser_print'}, ready_at=now. 큐 워커 없음(OOS-6). 이후 window.print() 호출.

**사용 위치**:
- `src/lib/export/pdf-export.ts:84-96 triggerPdfExport — createSupabaseBrowserClient().from('export_files').insert(...).select('id').single()`
- `src/components/library/LibraryExportsTab.tsx:115 RetryPrintButton(다시 인쇄)`
- `src/lib/export/pdf-export-client.ts:116 exportPdfWithPrintFallback 폴백 경로`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | browser client auth.getUser().id |
| `source_type` | "submission"\|"report"\|"library_selection" | 필수 | 내보내기 대상 유형 |
| `source_id` | uuid \| null | - | library_selection이면 null(클라이언트가 사전 검증), 그 외 필수 |
| `storage_path` | string | 필수 | browser-print://{randomUUID} opaque 마커 |
| `options` | jsonb | - | { source:'browser_print' } |
| `status` | "ready" | 필수 | 즉시 ready |
| `ready_at` | timestamptz(ISO) | - | new Date().toISOString() |

**기대 Response**:
```ts
.insert({...}).select('id').single() → { id: string(uuid) }. error throw, 빈 결과면 'triggerPdfExport: empty insert result'. 클라이언트 반환 PdfExportResult = { exportId: string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | 생성된 export row id = exportId 반환 |

**비고(권한·예외)**: 브라우저 클라이언트(createSupabaseBrowserClient)에서 직접 PostgREST insert → 위 export_files_owner_insert RLS가 그대로 적용(본인 source 소유 검증). 클라이언트가 라운드트립 전에 library_selection+source_id!=null, 또는 비-library_selection+source_id 누락을 throw로 사전 차단(RLS 낭비 방지). 인쇄 경로는 generated-exports 스토리지 업로드 안 함.

### `export_files (update — ready / failed)` · 테이블 · update
> 🟢 **쉬운 설명**: PDF 만들기 결과를 완료 또는 실패로 표시한다
> 🔵 **돌아오는 값(쉽게)**: 성공/실패만 반영되고 별도 데이터는 돌아오지 않는다

**자세한 목적**: 서버 생성 라우트에서 PDF 업로드 성공 후 storage_path를 실경로로 갱신하고 status='ready'+ready_at 기록. 생성 실패(markFailed) 시 status='failed'로 전환(에러 swallow).

**사용 위치**:
- `src/app/api/export/pdf/route.ts:144-151 update({storage_path,status:'ready',ready_at})`
- `src/app/api/export/pdf/route.ts:109-118 markFailed — update({status:'failed'}).eq('id',exportId)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `storage_path` | string | - | 성공 시 exports/{user_id}/{export_id}.pdf |
| `status` | "ready" \| "failed" | 필수 | ready(업로드 성공) 또는 failed(생성 실패) |
| `ready_at` | timestamptz(ISO) | - | ready 전환 시 new Date().toISOString() |

**기대 Response**:
```ts
.update({...}).eq('id', exportId) → { error }. updateError면 throw 'export_files update: ...' → catch에서 markFailed + 500. markFailed는 .then(noop,noop)로 결과 무시.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | PostgrestError \| null | 갱신 실패 시 throw 트리거(ready 경로), failed 경로는 swallow |

**비고(권한·예외)**: RLS: export_files_owner_update — using/with check 모두 user_id=auth.uid(). 라우트는 세션 클라이언트라 본인 row만 갱신 가능. ready 전환은 immutable이 아님(컬럼 갱신은 허용), 단 스토리지 객체는 owner_update 정책 없음=불변.

### `export_files (select — monthly limit count)` · 테이블 · select
> 🟢 **쉬운 설명**: 이번 달 PDF를 몇 번 만들었는지 세어 한도(월 3회)를 확인한다
> 🔵 **돌아오는 값(쉽게)**: 이번 달 사용 횟수가 돌아오고, 3회 이상이면 한도 초과 안내가 나간다

**자세한 목적**: 월 PDF 내보내기 한도 검사. 이번 달(UTC 월초~익월초) 내 status≠'failed' row 수를 head count로 세어 PDF_EXPORT_MONTHLY_LIMIT(3) 이상이면 429 throw.

**사용 위치**:
- `src/lib/export/pdf-export-server.ts:37-43 assertMonthlyPdfExportLimit`
- `src/app/api/export/pdf/route.ts:73 await assertMonthlyPdfExportLimit(supabase, user.id)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | 'id', {count:'exact', head:true} | 필수 | row 본문 없이 count만 |
| `user_id eq` | uuid | 필수 | 본인 row |
| `status neq` | 'failed' | 필수 | 실패 제외(성공/진행만 한도 소진) |
| `created_at gte/lt` | timestamptz | 필수 | monthStart(UTC) ≤ created_at < nextMonthStart(UTC) |

**기대 Response**:
```ts
{ count: number | null, error }. count≥3이면 PdfExportRequestError(429,'PDF 내보내기는 월 3회까지 사용할 수 있어요.'). error면 throw 'pdf export limit: ...' → 라우트가 500.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `count` | number \| null | 이번 달 비실패 export 수. ?? 0 처리 |

**비고(권한·예외)**: RLS export_files_owner_select(user_id=auth.uid())로도 본인만 보이지만 명시적 .eq('user_id') 추가. PDF_EXPORT_MONTHLY_LIMIT=3(pdf-export-server.ts:10). 월 경계는 UTC 기준(KST 아님).

### `export_files (select — library exports tab join)` · 테이블 · select
> 🟢 **쉬운 설명**: 내 서재의 '내보내기' 탭에 보여줄 내보낸 파일 목록을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 내보낸 파일 목록과 각각의 상태·종류·다운로드 정보가 돌아온다

**자세한 목적**: 내 서재 '내보내기' 탭 렌더용. library_items(item_type='export')의 export_id로 export_files를 일괄 조회해 JS-side 조인. 상태 배지/소스 라벨/storage_path/다운로드 버튼 노출.

**사용 위치**:
- `src/lib/library/server.ts:188-218 joinExports — supabase.from('export_files').select('id,source_type,storage_path,status,options').in('id', ids)`
- `src/lib/library/server.ts:39 listLibraryItems('exports')`
- `src/components/library/LibraryExportsTab.tsx — LibraryExportView 소비, DownloadButton/RetryPrintButton 렌더`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | 'id, source_type, storage_path, status, options' | 필수 | 탭 카드에 필요한 컬럼만 |
| `id in` | uuid[] | 필수 | library_items.export_id 목록(중복 제거) |

**기대 Response**:
```ts
rows → LibraryExportView[] (server.ts joinExports 매핑): { kind:'export'; id:string; source_type:'submission'|'report'|'library_selection'; storage_path:string; status:'queued'|'ready'|'failed'; options:Json|null; item_id:string(=library_items.id); tags:string[] }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string(uuid) | export_files.id |
| `source_type` | enum | 소스 라벨(sourceSubmission/Report/LibrarySelection) i18n 키 결정 |
| `storage_path` | string | 다운로드 가능 판정(ready + browser-print:// 아님)에 사용, 행에 표시 |
| `status` | enum | Badge 상태(ready=success, failed=error, else processing) |
| `options` | Json\|null | options.source==='browser_print' → 재인쇄 버튼, options.filename → 다운로드 파일명 |

**비고(권한·예외)**: RLS export_files_owner_select로 본인 row만 조인됨. listLibraryItems는 server-only(RSC/route). library_selection 행은 재인쇄 불가(source_id null이라 RetryPrintButton.reprintable=false).

### `generated-exports (Storage upload)` · 저장소 · POST
> 🟢 **쉬운 설명**: 완성된 PDF 파일을 보관함에 올린다
> 🔵 **돌아오는 값(쉽게)**: 올리기 성공/실패가 돌아오고, 실패하면 오류가 발생한다

**자세한 목적**: 서버 라우트가 렌더된 PDF Buffer를 비공개 버킷 generated-exports의 exports/{user_id}/{export_id}.pdf 경로에 업로드. contentType application/pdf, upsert=false(중복 방지). 실패 시 throw → row failed + 500.

**사용 위치**:
- `src/app/api/export/pdf/route.ts:39 const BUCKET='generated-exports'`
- `src/app/api/export/pdf/route.ts:134-139 supabase.storage.from(BUCKET).upload(storagePath, buffer, {...})`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `path` | string | 필수 | exports/{user_id}/{export_id}.pdf |
| `body` | Buffer | 필수 | renderToBuffer 결과 PDF 바이너리 |
| `options` | {contentType:'application/pdf', upsert:false} | 필수 | mime 고정, 덮어쓰기 금지 |

**기대 Response**:
```ts
supabase.storage.from('generated-exports').upload(path, buffer, opts) → { data, error }. uploadError면 throw new Error(`storage upload: ${error.message}`).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `error` | StorageError \| null | 업로드 실패 시 catch → markFailed + 500 'PDF 생성에 실패했어요...' |

**비고(권한·예외)**: 버킷 정의(20260520121200): generated-exports public=false, file_size_limit 50MB, allowed_mime ['application/pdf']. Storage RLS(20260520121300 + 20260527113000): exports_owner_insert = bucket=generated-exports AND foldername[1]='exports' AND foldername[2]=auth.uid()::text AND private.is_email_confirmed(auth.uid()). exports_owner_select/delete 동일 경로 소유 검사. owner_update 정책 없음=업로드 후 불변. 라우트는 세션 클라이언트라 본인 경로+이메일인증 필요(server-side service_role 재생성 시엔 RLS bypass). 미인증 이메일 사용자는 업로드 차단.

### `generated-exports (Storage download)` · 저장소 · GET
> 🟢 **쉬운 설명**: 보관함의 PDF 파일을 내려받는다
> 🔵 **돌아오는 값(쉽게)**: PDF 파일이 돌아와 사용자 기기로 다운로드된다

**자세한 목적**: 클라이언트가 서버 생성 응답의 storagePath로 PDF Blob을 내려받아 브라우저 다운로드(a[download] 트리거). 내 서재 다운로드 버튼도 동일 경로 사용.

**사용 위치**:
- `src/lib/export/pdf-export-client.ts:48-66 downloadStoredPdfExport — storage.from('generated-exports').download(storagePath)`
- `src/lib/export/pdf-export-client.ts:89 requestServerPdfExport 성공 후 자동 다운로드`
- `src/components/library/LibraryExportsTab.tsx:170 DownloadButton(내 서재 다운로드, browser-print://·non-ready row는 disabled)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `path` | string | 필수 | exports/{user_id}/{export_id}.pdf (서버 응답 storagePath 또는 export_files.storage_path) |

**기대 Response**:
```ts
supabase.storage.from('generated-exports').download(path) → { data: Blob | null, error }. error||!data면 throw Error(error.message ?? 'download failed'). data Blob을 URL.createObjectURL로 다운로드.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `data` | Blob | PDF 바이너리. triggerBrowserDownload(blob, filename)로 저장 |
| `error` | StorageError \| null | download 실패 메시지 |

**비고(권한·예외)**: RLS exports_owner_select: 본인 exports/{uid}/ 경로만 다운로드 가능. browser-print:// storage_path는 실파일이 없어 다운로드 불가(LibraryExportsTab에서 disabled). filenameFromStoragePath 폴백 'talkpik-export.pdf'.

### `study_events (insert — export_downloaded)` · 테이블 · insert
> 🟢 **쉬운 설명**: PDF를 내보냈다는 사용 기록을 통계용으로 남긴다
> 🔵 **돌아오는 값(쉽게)**: 기록만 남기고 결과는 따로 받지 않는다(흐름을 막지 않음)

**자세한 목적**: PDF 내보내기 텔레메트리 ledger. 서버 생성 성공 시 + 브라우저 인쇄 시 각각 event_type='export_downloaded' row 1건 삽입. KPI 집계용. 실패는 swallow(.then(noop,noop))되어 내보내기/인쇄 흐름을 막지 않음. 버튼이 직접 로깅하지 않음(이중 집계 방지).

**사용 위치**:
- `src/app/api/export/pdf/route.ts:157-175 supabase.from('study_events').insert({event_type:'export_downloaded', payload:{...export_id, source:'server_render'}})`
- `src/lib/export/pdf-export.ts:107-120 void supabase.from('study_events').insert({...})`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `user_id` | uuid | 필수 | 본인 id |
| `event_type` | 'export_downloaded' | 필수 | frozen 카탈로그 이벤트 |
| `payload` | jsonb | - | 서버: {source_type, source_id(library_selection이면 null), export_id, source:'server_render'}. 브라우저: {source_type, source_id} |

**기대 Response**:
```ts
.insert({...}).then(noop, noop) — 반환값/에러 무시(fire-and-forget). 응답 미사용.
```

**비고(권한·예외)**: RLS study_events_owner_insert(20260521140000 §4.3): user_id=auth.uid() + FK 본인 소유 검사(problem_id/submission_id가 null이면 통과). 여기선 problem/submission/attempt 컬럼을 쓰지 않고 payload에만 source_id를 담으므로 FK 검사 우회. study_events.event_type은 text(카탈로그는 src/lib/events/study-events.ts). supabase-js는 PromiseLike라 .catch 없음 → .then(onFulfilled,onRejected)로 reject swallow.

### `writing_submissions / comparison_reports / problems (read for PDF items)` · 테이블 · select
> 🟢 **쉬운 설명**: PDF에 담을 답안·리포트·서재 항목의 내용을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 문항번호·답안·글자수·첨삭 점수 등 PDF에 넣을 실제 내용이 돌아온다

**자세한 목적**: 서버 생성 시 PDF 본문 데이터를 모으는 읽기. submission 항목=getSubmission(+problems.title 조회 + includeFeedback면 getFeedbackBundle), report 항목=comparison_reports(id,narrative,generated_at). library_selection은 library_items(id,item_type,submission_id,report_id,saved_at)를 itemIds로 조회 후 각 항목 로드.

**사용 위치**:
- `src/lib/export/pdf-export-server.ts:58-108 loadSubmissionItem(getSubmission+problems.select('title')+getFeedbackBundle)`
- `src/lib/export/pdf-export-server.ts:110-128 loadReportItem(comparison_reports.select('id,narrative,generated_at'))`
- `src/lib/export/pdf-export-server.ts:167-170 library_items.select('id,item_type,submission_id,report_id,saved_at').in('id', itemIds)`
- `src/app/api/export/pdf/route.ts:121 resolvePdfExportItems(supabase, exportRequest)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `library_items.in(itemIds)` | uuid[] | - | select 'id,item_type,submission_id,report_id,saved_at' — library_selection 경로 |
| `problems.eq(problem_id)` | uuid | - | select 'title' maybeSingle — published만 읽힘(회수 시 title null) |
| `comparison_reports.eq(reportId)` | uuid | - | select 'id,narrative,generated_at' maybeSingle |

**기대 Response**:
```ts
PdfExportItem[]: submission → {kind:'submission', questionNo, problemTitle:string|null, submittedAt(YYYY-MM-DD), answerText, charCount, feedback:null|{scoreTotal,scoreMax,overallSummary,dimensions:[{dimension,score,scoreMax,summary}],sentences:[{sentenceIndex,originalText,correctedText,comment}]}}; report → {kind:'report', generatedAt(YYYY-MM-DD), narrative}. submission 없으면 404 '답안을 찾을 수 없어요.', report 없으면 404 '리포트를 찾을 수 없어요.', library 선택 0건이면 404 '내보낼 수 있는 저장 답안을 찾지 못했어요.', 6개 초과면 400.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `problemTitle` | string\|null | problems.title — published RLS라 회수된 문제면 null(제목 없이도 PDF 생성) |
| `submittedAt/generatedAt` | string(YYYY-MM-DD) | dayjs format. 파싱 실패 시 원본 문자열 |
| `feedback` | object\|null | includeFeedback=true + getFeedbackBundle 존재 시에만. 점수/차원/문장교정 포함 |

**비고(권한·예외)**: 모든 조회는 세션 클라이언트라 RLS 본인 소유 강제(library_items_owner_select, writing_submissions/comparison_reports owner, problems published 공개정책). getSubmission/getFeedbackBundle은 @/lib/writing/server(별도 writing 도메인). library_selection 항목은 saved_at 최신순 정렬(라이브러리 목록과 동일 순서). PDF_EXPORT_MAX_ITEMS=6. report 경로에 inline 중복 블록은 주석처리(loadReportItem로 통일됨). export 도메인에는 Supabase RPC(.rpc) 호출이 전혀 없음 — 전부 직접 PostgREST 테이블/스토리지 호출.

---

# B. topik-ai (어드민) — `topik-ai`

## assessment (문항/태그/쓰기)
_관리자가 시험 문항의 노출 상태(공개/제외/내부테스트)를 바꾸고, 운영 태그를 붙이거나 떼는 영역입니다._

### `admin_update_topik_question` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 문항을 노출/제외/내부테스트로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아오고, 바뀐 내용은 다시 조회해서 보여준다

**자세한 목적**: 문항 노출 통제(service_status) 등 가변 컬럼을 화이트리스트 patch로 갱신하고 admin_audit_logs에 diff를 남기는 단일 쓰기 경로. assessment 도메인에서는 service_status 변경(노출/제외/내부테스트 전환)에만 사용한다(검수 축은 화이트리스트에 있으나 프론트는 미사용).

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:452 (callUpdateRpc — rpc 호출)`
- `src/features/assessment/api/topik-writing-question-bank-service.ts:462 (setTopikWritingServiceStatus)`
- `src/features/assessment/api/assessment-question-bank-service.ts:313 (updateAssessmentQuestionServiceStatusSafe facade)`
- `src/features/assessment/pages/assessment-question-manage-page.tsx:254 (노출 상태 전환 액션)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_question_id` | text | 필수 | 문항 ID (예: topik-writing-51-9901). 프론트가 question_id를 그대로 전달 |
| `p_item_number` | smallint | 필수 | 51/52/53/54 중 하나. 프론트는 추천 뷰에서 조회한 `item_number`를 Number(kind)로 전달합니다. 기존 `topik-writing-{번호}-*` ID는 빠른 경로로만 해석하며 외부 공급 `question_id`는 opaque 값으로 취급합니다. 51/52/53/54 외 값이면 예외 |
| `p_patch` | jsonb | 필수 | 갱신 patch 객체. 화이트리스트 키: review_status / review_workflow_status / service_status / content_team_memo. 예약 키 __note는 컬럼에 닿지 않고 감사 payload.review_note로만 기록. 프론트 실제 전송 형태: { service_status: 'available'\|'excluded'\|'internal_test', __note: 사유 } |

**기대 Response**:
```ts
void (RETURNS void) — 성공 시 반환값 없음. 변경분이 없으면(diff='{}') 감사 행도 남기지 않고 그냥 return. 프론트(setTopikWritingServiceStatus)는 반환을 쓰지 않고, 이어서 loadDetail로 상세를 재조회해 AssessmentQuestionDetail을 갱신함. 오류는 PostgREST error.message로 throw.
```

**비고(권한·예외)**: 가드: SECURITY DEFINER + private.is_content_admin(auth.uid()) 필수(미인증 'unauthenticated', 비-content_admin 'forbidden: content_admin required'). RLS는 직접 write 전면 차단 → 반드시 이 RPC 경유. 핵심 비즈니스 가드: service_status='available' 전환은 (전이 후 기준) review_status='approved' 여야 하며 아니면 'service_status=available requires review_status=approved (POL-018)' 예외. 문항 미존재 시 'question not found: %'. 감사: admin_audit_logs(action 파생='service_status_changed' 등, target_table='AssessmentQuestion', target_id=question_id, diff={col:{from,to}}, payload={review_note}). grant execute to authenticated. 정의: supabase/migrations/20260610201200_topik_writing_admin_rpcs.sql:19. ⚠️주의: 함수 시그니처상 p_item_number 타입은 smallint, 그리고 화이트리스트에 검수 2축이 남아있으나 프론트는 service_status만 보냄.

### `admin_assign_question_tag` · RPC · rpc
> 🟢 **쉬운 설명**: 문항에 운영 태그를 붙이고 사유를 적는다
> 🔵 **돌아오는 값(쉽게)**: 부여된 태그 번호가 돌아오며, 화면은 태그 목록을 다시 불러와 보여준다

**자세한 목적**: 문항에 운영 태그를 부여(이력 보존형). P4 관리 포인트 — 추천/반복방지/운영주의 등 tag_master 활성 사전에서 고른 태그를 부여하고 사유(memo)를 question_tags.memo에 기록.

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:477 (assignTopikWritingQuestionTag — rpc 호출)`
- `src/features/assessment/api/assessment-question-bank-service.ts:320 (assignQuestionTagSafe facade, memo 필수 검증)`
- `src/features/assessment/ui/question-tag-edit-modal.tsx:120 (handleAssign)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_question_id` | text | 필수 | 대상 문항 ID |
| `p_item_number` | smallint | 필수 | 51/52/53/54. 추천 뷰에서 조회한 `item_number`의 Number(kind). 기존 접두형 ID 파싱은 조회 생략용 최적화일 뿐 계약이 아님 |
| `p_tag_code` | text | 필수 | 부여할 태그 코드(tag_master.tag_code). '서비스_노출상태' 그룹 태그는 차단됨 |
| `p_tag_value` | text | - | 태그 값(선택, default null). ⚠️프론트는 이 인자를 전달하지 않음 → 항상 null로 들어감 |
| `p_memo` | text | - | 부여 사유(default null이나 프론트·facade에서 trim 후 빈값이면 호출 전 차단 — 사실상 필수). question_tags.memo + 감사 payload.tag_memo에 기록 |

**기대 Response**:
```ts
bigint (RETURNS bigint = 신규 tag_assignment_id). ⚠️프론트(assignTopikWritingQuestionTag)는 Promise<void>로 타입하고 반환값을 무시함 — 부여 후 useQuestionBankTags.reload()로 활성 태그 전수를 재조회. 오류는 error.message throw.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `tag_assignment_id` | bigint | 새로 삽입된 부여 행의 식별자(프론트 미사용) |

**비고(권한·예외)**: 가드: SECURITY DEFINER + private.is_content_admin. item_number 51~54 검증. tag_master 사전 존재('unknown tag_code') + is_active('tag is inactive') 검증. '서비스_노출상태' 그룹 부여 차단('exposure-status tag group is blocked: use service_status column (D-6)'). (question_id, item_number) 합성 참조 실재 검증('question not found'). 중복 활성 부여 차단 — 부분 유니크 인덱스(question_id, tag_code) where is_active 위반 시 'tag already active on this question'. assigned_by에는 profiles.display_name(또는 id) 기록. 감사: action='tag_assigned', target_table='AssessmentQuestion', diff={tag:{from:null,to:tag_code}, tag_value:{...}}, payload={tag_memo}. 정의: supabase/migrations/20260610201200_topik_writing_admin_rpcs.sql:127.

### `admin_remove_question_tag` · RPC · rpc
> 🟢 **쉬운 설명**: 문항에서 태그를 떼고 사유를 남긴다(기록은 보존)
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아오고, 화면은 태그 목록을 다시 불러온다

**자세한 목적**: 문항 태그 제거(이력 보존형 — is_active=false + removed_at 갱신). 사유 필수.

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:498 (removeTopikWritingQuestionTag — rpc 호출)`
- `src/features/assessment/api/assessment-question-bank-service.ts:324 (removeQuestionTagSafe facade, memo 필수 검증)`
- `src/features/assessment/ui/question-tag-edit-modal.tsx:142 (handleConfirmRemove)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_tag_assignment_id` | bigint | 필수 | 제거할 부여 행의 tag_assignment_id(목록 조회에서 받은 값) |
| `p_memo` | text | - | 제거 사유(default null이나 facade에서 trim 후 빈값이면 호출 전 차단 → 사실상 필수). 빈값이 아니면 question_tags.memo 덮어쓰기 + 감사 payload.tag_memo |

**기대 Response**:
```ts
void (RETURNS void). 프론트(removeTopikWritingQuestionTag)는 반환 없음을 기대하고 이후 reload로 재조회. 오류는 error.message throw.
```

**비고(권한·예외)**: 가드: SECURITY DEFINER + private.is_content_admin. 부여 행 미존재 시 'tag assignment not found'. 이미 제거된 행이면 'tag assignment already removed'. 물리 삭제가 아니라 is_active=false + removed_at=now() 갱신(이력 보존). 감사: action='tag_removed', target_table='AssessmentQuestion', target_id=원 question_id, diff={tag:{from:tag_code,to:null}}, payload={tag_memo}. 정의: supabase/migrations/20260610201200_topik_writing_admin_rpcs.sql:197.

### `admin_update_tag_master_status` · RPC · rpc
> 🟢 **쉬운 설명**: 태그 사전의 태그를 켜거나 끈다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 돌아오고, 화면은 태그 카탈로그를 다시 보여준다

**자세한 목적**: 태그 마스터(tag_master) 사전의 활성/비활성 토글 — /system/metadata 마스터 카탈로그 화면(P5-3)에서 사용. 비활성화는 신규 부여 옵션 노출만 중단하며 기존 부여 행은 그대로 유지.

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:519 (setTopikWritingTagMasterStatus — rpc 호출)`
- `src/features/assessment/api/assessment-question-bank-service.ts:291 (updateTagMasterStatusSafe facade, reason 필수 검증)`
- `src/features/assessment/ui/master-catalog-section.tsx:95 (태그 마스터 토글 액션)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_tag_code` | text | 필수 | 토글 대상 태그 코드 |
| `p_next_active` | boolean | 필수 | 전환할 활성 상태(true=활성화/false=비활성화). null이면 'next_active required' |
| `p_note` | text | 필수 | 변경 사유 — RPC 레벨에서 강제 필수(btrim 후 빈값이면 'note required'). 프론트·facade도 trim 검증 |

**기대 Response**:
```ts
void (RETURNS void). 프론트(setTopikWritingTagMasterStatus)는 반환 없음 기대 → 성공 후 카탈로그 재조회. 오류는 error.message throw.
```

**비고(권한·예외)**: 가드: SECURITY DEFINER + private.is_platform_admin(auth.uid()) — 문항 RPC들의 content_admin보다 상위 권한(마스터 변경은 전 문항 부여 옵션에 영향). 미인증 'unauthenticated', 비-platform 'forbidden: platform_admin required'. 태그 미존재 'unknown tag_code'. 무변경 토글 거부('tag_master already active/inactive'). 데이터 영향: is_active 토글만(부여 이력 question_tags 유지). 감사: action='tag_master_status_changed', target_table='AssessmentTagMaster', target_id=tag_code, diff={is_active:{from,to}}, payload={note, active_assignment_count(토글 시점 활성 부여 수)}. 정의: supabase/migrations/20260611210100_topik_writing_tag_master_admin_rpc.sql:16.

### `topik_writing_question_recommendation_view` · 테이블 · select
> 🟢 **쉬운 설명**: 문항 목록 화면에 보여줄 문항들을 한 번에 가져온다
> 🔵 **돌아오는 값(쉽게)**: 문항별 번호/등급/주제 등 요약 목록이 돌아온다

**자세한 목적**: 문항 목록(manage/bank) 화면의 단일 조회원 — 51~54 4개 테이블의 공통 컬럼을 UNION ALL한 읽기 전용 뷰. 목록 1회 조회로 AssessmentQuestionSummary[] 생성.

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:212 (loadTopikWritingSummaries)`
- `src/features/assessment/model/use-assessment-question-list.ts:37 (fetchAssessmentQuestionSummariesSafe 소비)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | 프론트가 실제 select하는 16컬럼: question_id, item_number, target_level, difficulty_level, topic_main, topic_detail, speech_act, scenario_type, recommendation_keys, avoid_repeat_keys, service_status, situation_summary, question_type_name, content_team_memo, created_at, updated_at. (뷰 자체는 review_status, review_workflow_status도 노출하나 프론트는 미선택) |
| `order` | order | - | .order('question_id') — question_id 오름차순 |

**기대 Response**:
```ts
ViewRow[] (PostgREST raw): { question_id: string; item_number: number; target_level: string|null; difficulty_level: number|null; topic_main: string; topic_detail: string; speech_act: string|null; scenario_type: string; recommendation_keys: unknown(jsonb 배열); avoid_repeat_keys: unknown(jsonb 배열); service_status: string('available'|'excluded'|'internal_test'); situation_summary: string; question_type_name: string; content_team_memo: string|null; created_at: string|null(timestamptz); updated_at: string|null }[]. → 프론트 매핑 AssessmentQuestionSummary: { questionId, questionNumber:'51'|'52'|'53'|'54'(String(item_number)), targetLevel(''폴백), difficultyLevel:number|null, topicMain, topicDetail, speechAct(''폴백), scenarioType, situationSummary, questionTypeName, recommendationKeys:string[], avoidRepeatKeys:string[], serviceStatus:AssessmentServiceStatus, contentTeamMemo(''폴백), createdAt, updatedAt }. ⚠️createdAt/updatedAt은 'YYYY-MM-DD HH:mm' KST-유사 텍스트로 절단(ts.slice(0,16).replace('T',' ')).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `recommendation_keys` | jsonb | 추천 키 배열(예: ['topic:교육','type:writing_51_blank_completion']). 프론트는 string[]로 변환 |
| `avoid_repeat_keys` | jsonb | 반복 회피 키 배열. string[]로 변환 |
| `service_status` | text | 물리 노출 상태(available/excluded/internal_test). 기본 internal_test |

**비고(권한·예외)**: 읽기 전용 뷰. security_invoker=true → 베이스 테이블 RLS 상속(미설정 시 anon 노출 보안 구멍이라 필수). 베이스 테이블 select 정책 = private.is_admin(auth.uid()) 즉 content_admin/platform_admin + status active만. anon/비-admin은 0행. 정의: supabase/migrations/20260610200900_topik_writing_question_recommendation_view.sql. ⚠️뷰는 18컬럼 노출(review_status·review_workflow_status 포함)이나 프론트는 16컬럼만 select.

### `topik_writing_question_tags` · 테이블 · select
> 🟢 **쉬운 설명**: 지금 붙어 있는 모든 태그를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 문항별 태그 목록(태그명/사유 등)이 돌아와 화면에 보여준다

**자세한 목적**: 활성 태그 전수 조회 — 목록 화면 문항별 태그 수 표시 + 태그 편집 모달의 활성 태그 소스. (insert/update/delete는 직접 하지 않고 admin_assign/remove_question_tag RPC 단일 경로)

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:404 (loadTopikWritingActiveQuestionTags)`
- `src/features/assessment/model/use-question-bank-masters.ts:83 (useQuestionBankTags)`
- `src/features/assessment/ui/question-tag-edit-modal.tsx (activeTags prop으로 소비)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | tag_assignment_id, question_id, tag_code, tag_value, assigned_at, memo |
| `eq` | filter | 필수 | .eq('is_active', true) — 활성 부여 행만 |

**기대 Response**:
```ts
raw rows: { tag_assignment_id: number(bigint); question_id: string; tag_code: string; tag_value: string|null; assigned_at: string(timestamptz); memo: string|null }[]. → 프론트 매핑 TopikWritingQuestionTagRow: { tagAssignmentId:number, questionId:string, tagCode:string, tagValue:string|null, assignedAt:string('YYYY-MM-DD HH:mm' 절단), memo:string('' 폴백) }. 훅에서 tagsByQuestionId(Record<string,row[]>) + tagCountByQuestionId(Record<string,number>)로 가공.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `tag_assignment_id` | bigint | 부여 행 PK(generated always as identity). 제거 RPC 인자로 재사용 |
| `is_active` | boolean | 활성 여부(필터 조건). 제거는 false로 갱신(이력 보존) |

**비고(권한·예외)**: RLS: select만 허용(private.is_admin). INSERT/UPDATE/DELETE 정책 없음 → 직접 write 불가, RPC 전용. 부분 유니크 인덱스 (question_id, tag_code) where is_active로 중복 활성 부여 차단. (question_id, item_number) 합성 FK는 4분할 부모라 DB FK 불가 → RPC에서 검증. 테이블 정의: supabase/migrations/20260610200700_topik_writing_question_tags.sql.

### `topik_writing_tag_master` · 테이블 · select
> 🟢 **쉬운 설명**: 고를 수 있는 태그 사전 값들을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 태그 후보 목록이나 전체 태그 카탈로그가 돌아온다

**자세한 목적**: 태그 값 사전 조회. 두 가지 surface: (1) 태그 편집 옵션 축(활성만, 6컬럼) — POL-018 그룹 판정용, (2) /system/metadata 마스터 카탈로그 전수(비활성·전 그룹 포함, 9컬럼) — 토글 화면용. (상태 변경은 admin_update_tag_master_status RPC)

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:281 (loadTopikWritingTagMaster, 옵션 축)`
- `src/features/assessment/api/topik-writing-question-bank-service.ts:362 (loadTopikWritingTagMasterCatalog, 카탈로그)`
- `src/features/assessment/model/use-question-bank-masters.ts:131 (useQuestionBankTagMaster)`
- `src/features/assessment/ui/master-catalog-section.tsx:149 (fetchQuestionBankTagMasterCatalogSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(옵션 축)` | columns | 필수 | loadTopikWritingTagMaster: tag_code, tag_name_ko, tag_group, description, usage_rule, is_active + .eq('is_active', true) + order(tag_group, tag_code). facade에서 추가로 tag_group='서비스_노출상태' 행 필터 제거 |
| `select(카탈로그)` | columns | 필수 | loadTopikWritingTagMasterCatalog: tag_code, tag_name_ko, tag_group, description, usage_rule, example_question_id, is_active, created_at, updated_at + order(tag_group, tag_code) (is_active 필터 없음) |

**기대 Response**:
```ts
옵션 축 → TopikWritingTagMasterRow: { tagCode:string, tagNameKo:string, tagGroup:string, description:string, usageRule:string('' 폴백), isActive:boolean }[]. 카탈로그 → TopikWritingTagMasterCatalogRow: { tagCode, tagNameKo, tagGroup, description, usageRule(''폴백), exampleQuestionId:string|null, isActive:boolean, updatedAt:string('YYYY-MM-DD HH:mm', updated_at 없으면 created_at으로 폴백 후 절단) }[].
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `tag_group` | text | 그룹명(추천사용/대표문제/추천목적/반복방지/학습흐름/운영주의). '서비스_노출상태' 그룹은 시드 제외(D-6) + 옵션 축에서도 필터 제거 |
| `usage_rule` | text(nullable) | 태그별 운영 가이드(POL-018 노출 제외 기준 등) |
| `is_active` | boolean | 활성 여부. 옵션 축은 true만, 카탈로그는 전수 |

**비고(권한·예외)**: RLS: select만(private.is_admin). 쓰기 정책 없음. PK=tag_code(text). 시드 19개 태그 6그룹(20260610200200). 정의: supabase/migrations/20260610200200_topik_writing_tag_master.sql.

### `topik_writing_topic_master` · 테이블 · select
> 🟢 **쉬운 설명**: 문항에 쓰는 주제와 세부내용 사전을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 주제 필터 후보나 전체 주제 카탈로그가 돌아온다

**자세한 목적**: 17개 고정 종합 주제 × 세부 내용 마스터 조회. 두 surface: (1) 문항 필터 주제 축(활성만, 3컬럼), (2) /system/metadata 마스터 카탈로그 전수(7컬럼, 비활성 포함).

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:255 (loadTopikWritingTopicMaster, 필터 축)`
- `src/features/assessment/api/topik-writing-question-bank-service.ts:321 (loadTopikWritingTopicMasterCatalog, 카탈로그)`
- `src/features/assessment/model/use-question-bank-masters.ts:29 (useQuestionBankTopicMaster)`
- `src/features/assessment/ui/master-catalog-section.tsx:130 (fetchQuestionBankTopicMasterCatalogSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select(필터 축)` | columns | 필수 | loadTopikWritingTopicMaster: topic_main, topic_detail, sort_order + .eq('is_active', true) + order(sort_order asc nullsFirst:false).order(topic_detail) |
| `select(카탈로그)` | columns | 필수 | loadTopikWritingTopicMasterCatalog: topic_id, topic_main, topic_detail, source_name, is_active, sort_order, memo + order(sort_order, topic_detail) (is_active 필터 없음) |

**기대 Response**:
```ts
필터 축 → TopikWritingTopicMasterRow: { topicMain:string, topicDetail:string, sortOrder:number|null }[] → 훅에서 topicMain별 details 그룹핑(TopicAxisOption). 카탈로그 → TopikWritingTopicMasterCatalogRow: { topicId:number(bigint), topicMain:string, topicDetail:string, sourceName:string, isActive:boolean, sortOrder:number|null, memo:string|null }[].
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `topic_id` | bigint | PK(generated always as identity). 카탈로그에서만 노출 |
| `source_name` | text | 시드 출처 표기(메신저 전달 항목 ...) |
| `sort_order` | smallint(nullable) | 정렬 순서(101~1704 코드형) |

**비고(권한·예외)**: RLS: select만(private.is_admin), 쓰기 정책 없음(이 도메인에 토픽 마스터 토글 쓰기 RPC 없음 — 읽기 전용). UNIQUE(topic_main, topic_detail) — 51~54 문항 테이블의 topic FK 대상. 시드 85쌍 고정(20260610200100). 정의: supabase/migrations/20260610200100_topik_writing_topic_master.sql.

### `topik_writing_51_questions / _52_ / _53_ / _54_questions` · 테이블 · select
> 🟢 **쉬운 설명**: 문항 하나의 자세한 내용을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 문항의 모든 상세 정보(주제/지문/난이도 등)가 돌아온다

**자세한 목적**: 문항 상세(AssessmentQuestionDetail) 단건 조회. 기존 접두형 ID는 번호를 바로 추론하고, 그 밖의 외부 공급 `question_id`는 추천 뷰에서 `item_number`를 조회한 뒤 번호별 테이블로 라우팅해 `.select('*').eq('question_id',...).maybeSingle()`을 수행합니다. 공통 컬럼 + 번호별 전용 content를 매핑합니다.

**사용 위치**:
- `src/features/assessment/api/topik-writing-question-bank-service.ts:229 (loadTopikWritingDetail, TABLE_BY_NUMBER 라우팅)`
- `src/features/assessment/pages/assessment-question-detail-page.tsx:453 (fetchAssessmentQuestionDetailSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | .select('*') — 전 컬럼 |
| `eq` | filter | 필수 | .eq('question_id', questionId).maybeSingle() |

**기대 Response**:
```ts
raw row 전 컬럼(공통 35+ : question_id, item_number, target_level, difficulty_level, topic_main/detail, secondary_topic_main/detail, text_type, speech_act, scenario_type, situation_summary, learning_goal_summary, prompt_text, resolved_text, model_answer, answer_key(jsonb), review_status, review_workflow_status, service_status, auto_checks_passed, recommendation_keys/avoid_repeat_keys(jsonb), content_team_memo, created_at, updated_at + 번호별 전용). → AssessmentQuestionDetail = AssessmentQuestionSummary & { secondaryTopicMain:string|null, secondaryTopicDetail:string|null, textType, learningGoalSummary, promptText, resolvedText, modelAnswer, autoChecksPassed:boolean|null, content:AssessmentQuestionContent }. content는 kind별: 51={blankCount:number|null, blank1/blank2:{position,role,blankFunction,answerType,canonicalAnswer,acceptedAnswers:string[],targetNote}} / 52={completionUnit,connectionFunction,requiredExpressionFunction,clueBeforeText,clueAfterText,answerScopeType,blank1CanonicalAnswer,blank2CanonicalAnswer,scoringNotes} / 53={dataType,dataTopic,chartTitle,chartUnit,comparisonType,changeType,interpretationDifficulty,keyFindings:string[],requiredStructure:string[],wordCountMin/Max:number|null,sourceData:unknown(jsonb 원본),dataAssetUrl,scoringFocus:string[]} / 54={essayType,issueTopic,promptQuestions:string[],stanceRequirement,requiredStructure:string[],reasoningPattern,argumentKeywords:string[],wordCountMin/Max:number|null,scoringFocus:string[],prohibitedElements:string[]}.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `service_status` | text | 노출 상태(available/excluded/internal_test, 기본 internal_test) |
| `auto_checks_passed` | boolean(nullable) | 수신·적재 자동 정합 검사 표식(검수 아님). boolean 아니면 null |
| `source_data(53번)` | jsonb | 차트 원시 데이터 JSONB — 프론트는 sourceData:unknown 그대로 전달(D-13 1차) |

**비고(권한·예외)**: 스코프 명시 테이블은 아니나 상세 조회의 실 소스라 포함. RLS: select만(private.is_admin), 직접 write 차단 → service_status 변경은 admin_update_topik_question RPC 경유. topic_main/detail은 topic_master FK. 공통 컬럼 블록은 4테이블 동결 계약(변경은 4테이블 동시 마이그). 정의: supabase/migrations/20260610200300~200600_topik_writing_5x_questions.sql.

## billing (환불 심사)
_관리자가 사용자의 결제 환불 요청을 검토해 승인하거나 반려하는 영역입니다._

### `admin_approve_billing_refund` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 환불 요청을 '승인'으로 바꾼다.
> 🔵 **돌아오는 값(쉽게)**: 승인 처리된 그 환불 건의 최신 내용이 돌아온다.

**자세한 목적**: 환불 요청을 '승인(approved)' 상태로 전환하는 관리자 워크플로 RPC. SECURITY DEFINER로 commerce_refunds 행을 잠그고(for update) status='approved', processed_by=caller uid, processed_at=now(), review_reason=사유로 업데이트한 뒤 admin_audit_logs에 'refund_approved' 감사 로그를 남긴다. v13 payment_history로 환불 금액을 되돌려쓰지 않음(의도만 기록, payload.intent_only_v13_payment_history_pending=true).

**사용 위치**:
- `src/features/billing/api/supabase-billing-service.ts:171 approveBillingRefundViaRpc — client.rpc('admin_approve_billing_refund', { p_refund_id, p_reason }) 호출 후 loadRefund로 재조회`
- `src/features/billing/api/billing-service.ts:41 approveBillingRefund — commerceRefundsDataSource==='supabase'면 RPC, 아니면 useCommerceStore.approveRefund(mock)`
- `src/features/billing/pages/billing-refunds-page.tsx:230 handleResolveRefund — 승인 모달 확정 시 approveBillingRefundSafe({ refundId, changedBy:'admin_park', reason }) 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_refund_id` | text | 필수 | 대상 환불 ID (commerce_refunds.id, 형식 'RF-숫자' 예: RF-0001). 프론트는 payload.refundId를 그대로 전달 |
| `p_reason` | text | 필수 | 운영 처리 사유/근거. 프론트(requireReason)와 서버(btrim 후 빈 문자열 거부) 모두 필수. 비어있으면 RPC가 'reason required (operational reason)' 예외 |

**기대 Response**:
```ts
RPC 자체는 RETURNS void (반환값 없음). 성공 시 프론트(approveBillingRefundViaRpc)는 즉시 loadRefund(refundId)로 commerce_refunds를 재조회하여 RefundRow를 만들어 반환함. RefundRow = { id: string; paymentId: string; userId: string; userNickname: string; requestedAmount: number; reason: string; status: '승인'(UI 라벨, DB 'approved' 매핑); requestedAt: string('YYYY-MM-DD HH:mm', timestamptz를 slice(0,16) 가공); processedAt?: string('YYYY-MM-DD HH:mm'); processedBy?: string(승인한 관리자 auth.uid()의 text); reviewReason?: string }
```

**비고(권한·예외)**: 인증/RLS 게이트: caller_id=auth.uid() NULL이면 'unauthenticated', private.is_admin(caller_id) 아니면 'forbidden: admin required'. 상태 가드: 행이 없으면 'unknown commerce refund id: %', status<>'pending'이면 'commerce refund is not pending: %' 예외(즉, pending 건만 승인 가능, 재승인 불가). 프론트 payload의 changedBy(='admin_park' 하드코딩)는 RPC로 전달되지 않고 무시됨 — processed_by는 서버가 auth.uid()::text로 채움. 단일 정의 파일: supabase/migrations-admin/20260617203000_commerce_refunds.sql:70. 에러는 PostgREST RpcError로 오고 프론트는 error.message를 throw→notification으로 노출.

### `admin_reject_billing_refund` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 환불 요청을 '거절'로 바꾼다.
> 🔵 **돌아오는 값(쉽게)**: 거절 처리된 그 환불 건의 최신 내용이 돌아온다.

**자세한 목적**: 환불 요청을 '거절(rejected)' 상태로 전환하는 관리자 워크플로 RPC. commerce_refunds 행을 잠그고 status='rejected', processed_by=caller uid, processed_at=now(), review_reason=사유로 업데이트한 뒤 admin_audit_logs에 'refund_rejected' 감사 로그를 남긴다. 승인과 달리 payment_history 의도 플래그는 없음.

**사용 위치**:
- `src/features/billing/api/supabase-billing-service.ts:185 rejectBillingRefundViaRpc — client.rpc('admin_reject_billing_refund', { p_refund_id, p_reason })`
- `src/features/billing/api/billing-service.ts:57 rejectBillingRefund — supabase 분기에서 RPC 호출`
- `src/features/billing/pages/billing-refunds-page.tsx:235 handleResolveRefund — 거절 모달 확정 시 rejectBillingRefundSafe({ refundId, changedBy:'admin_park', reason })`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_refund_id` | text | 필수 | 대상 환불 ID (commerce_refunds.id, 'RF-숫자'). 프론트 payload.refundId |
| `p_reason` | text | 필수 | 거절 사유/근거. 필수(빈값이면 'reason required (operational reason)' 예외) |

**기대 Response**:
```ts
RPC 자체는 RETURNS void. 성공 시 프론트(rejectBillingRefundViaRpc)가 loadRefund(refundId)로 재조회하여 RefundRow 반환. RefundRow = { id; paymentId; userId; userNickname; requestedAmount:number; reason:string; status:'거절'(DB 'rejected' 매핑); requestedAt:'YYYY-MM-DD HH:mm'; processedAt?:'YYYY-MM-DD HH:mm'; processedBy?:string(auth.uid() text); reviewReason?:string }
```

**비고(권한·예외)**: 승인과 동일한 인증/RLS/상태 가드: auth.uid() NULL→'unauthenticated', private.is_admin 아님→'forbidden: admin required', 없는 ID→'unknown commerce refund id', status<>'pending'→'commerce refund is not pending'. pending 건만 거절 가능. changedBy 프론트 인자는 무시(서버 auth.uid() 사용). 정의: supabase/migrations-admin/20260617203000_commerce_refunds.sql:120.

### `commerce_refunds` · 테이블 · select
> 🟢 **쉬운 설명**: 환불 요청 내역을 불러온다.
> 🔵 **돌아오는 값(쉽게)**: 환불 요청 목록과 각 건의 상태(대기/승인/거절)가 돌아온다.

**자세한 목적**: 환불 요청 워크플로 상태를 보관하는 admin-owned 테이블(SoT). 환불 목록 조회와 승인/거절 후 단건 재조회에 사용. 쓰기는 직접 INSERT/UPDATE가 아니라 위 두 SECURITY DEFINER RPC를 통해서만 일어남.

**사용 위치**:
- `src/features/billing/api/supabase-billing-service.ts:156 loadRefundsFromSupabase — .from('commerce_refunds').select(REFUND_COLUMNS).order('requested_at', desc)`
- `src/features/billing/api/supabase-billing-service.ts:128 loadRefund — .select(REFUND_COLUMNS).eq('id', refundId).maybeSingle() (RPC 성공 후 재조회)`
- `src/features/billing/pages/billing-refunds-page.tsx:89 useEffect — fetchRefundsSafe로 목록 로드`
- `src/features/billing/pages/billing-payments-page.tsx:90 — 결제 화면에서도 환불 목록 동반 조회`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, payment_id, user_id, user_nickname, requested_amount, reason, status, requested_at, processed_by, processed_at, review_reason |
| `order` | string | - | 목록: requested_at desc. 단건: eq('id', refundId).maybeSingle() |

**기대 Response**:
```ts
select 후 CommerceRefundRow(raw) = { id:string; payment_id:string; user_id:string; user_nickname:string; requested_amount:number; reason:string; status:string('pending'|'approved'|'rejected'); requested_at:string(ISO timestamptz); processed_by:string|null; processed_at:string|null; review_reason:string|null }. mapRefundRow가 RefundRow로 변환 = { id; paymentId; userId; userNickname; requestedAmount; reason; status:RefundStatus(한글라벨); requestedAt:string; processedAt?:string; processedBy?:string; reviewReason?:string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 환불 ID PK, 형식 '^RF-[0-9]+$' (예 RF-0001). next_commerce_refund_id()가 RF-#### 생성 |
| `payment_id` | text | 연결된 결제 ID(느슨한 참조, FK 없음) |
| `user_id` | text | 요청 회원 ID(느슨한 참조) |
| `user_nickname` | text | 회원 표시명 스냅샷(NOT NULL). 프론트는 supabase 모드에서 이 값을 그대로 userNickname으로 사용 |
| `requested_amount` | integer | 환불 요청 금액(원 단위, >=0 체크). 결제의 cents 변환 없이 그대로 사용 |
| `reason` | text | 회원이 제출한 환불 사유(NOT NULL) |
| `status` | text | ASCII enum: pending\|approved\|rejected. UI 매핑: pending=처리 대기, approved=승인, rejected=거절 |
| `requested_at` | timestamptz | 요청 일시. 프론트 toDateTime이 slice(0,16) 'YYYY-MM-DD HH:mm'로 가공(주의: KST 텍스트 아님, UTC ISO 앞 16자 그대로라 타임존 미보정) |
| `processed_by` | text\|null | 처리 관리자 식별자. RPC가 auth.uid()::text로 기록 |
| `processed_at` | timestamptz\|null | 처리 일시(미처리 시 null→processedAt undefined) |
| `review_reason` | text\|null | 관리자 처리 근거(p_reason btrim 저장) |
| `created_at` | timestamptz | 행 생성 시각(default now()). select 컬럼에는 포함 안 함 |

**비고(권한·예외)**: RLS: enable + force row level security. 정책 commerce_refunds_admin_select = for select to authenticated using private.is_admin(auth.uid()) — 비관리자 인증유저는 select도 0행. INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 쓰기 차단, 모든 쓰기는 RPC(SECURITY DEFINER)로만. 제약: id 정규식 체크, requested_amount>=0, status in(pending/approved/rejected). 인덱스: status, requested_at desc. 시드 3행(RF-0001 pending / RF-0002 approved / RF-0003 rejected) 존재하나 2026-06-22 dev DB 전면 TRUNCATE로 데이터 소멸(스키마/RPC는 생존) — 검증 전 재시드 필요.

### `payment_history` · 테이블 · select
> 🟢 **쉬운 설명**: 회원들의 결제 내역을 불러온다.
> 🔵 **돌아오는 값(쉽게)**: 결제 목록과 함께 회원명·상품명이 돌아온다.

**자세한 목적**: 결제 내역 조회(읽기 전용). v13 소유 테이블에 대한 느슨한 통합 — 환불 워크플로는 이 테이블을 쓰지 않고(환불 승인해도 되돌려쓰지 않음) 결제 목록 표시용으로만 조회. profiles/subscriptions를 임베드 조인해 회원명/상품명을 함께 가져온다.

**사용 위치**:
- `src/features/billing/api/supabase-billing-service.ts:141 loadPaymentsFromSupabase — .from('payment_history').select(PAYMENT_SELECT).order('paid_at', desc)`
- `src/features/billing/pages/billing-payments-page.tsx:77 useEffect — fetchPaymentsSafe로 결제 목록 로드`
- `src/features/billing/api/billing-service.ts:27 loadPayments — isSupabaseConfigured면 supabase, 아니면 mock store`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | string | 필수 | id, user_id, subscription_id, amount_cents, currency, status, paid_at, created_at, profiles(display_name, nickname), subscriptions(plan_key, subscription_plans(name)) |
| `order` | string | - | paid_at desc |

**기대 Response**:
```ts
raw PaymentHistoryRow = { id; user_id; subscription_id:string|null; amount_cents:number; currency:string; status:string; paid_at:string|null; created_at:string; profiles?:{display_name:string|null; nickname:string|null}|null; subscriptions?:{plan_key:string|null; subscription_plans?:{name:string|null}|null}|null }. mapPaymentRow → PaymentRow = { id; userId; userNickname:string; product:string; amount:number(원); method:'미확인'(하드코딩, DB에 결제수단 없음); paidAt:'YYYY-MM-DD'; status:PaymentStatus(한글라벨) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 결제 ID → PaymentRow.id |
| `user_id` | string | 회원 ID → userId |
| `subscription_id` | string\|null | 연결 구독 ID |
| `amount_cents` | number | 결제액(센트). 프론트는 Math.round(amount_cents/100)으로 원 단위 amount 산출 |
| `currency` | string | 통화 코드(매핑에 직접 사용 안 함) |
| `status` | string | DB 상태 → UI 매핑(PAYMENT_STATUS_MAP): paid=완료, refunded=환불, failed=취소, pending=취소, 그 외 기본 '완료' |
| `paid_at` | string\|null | 결제일(없으면 created_at fallback). toDate로 slice(0,10) 'YYYY-MM-DD' |
| `created_at` | string | 생성일(paid_at 폴백 소스) |
| `profiles` | object\|null | 임베드: { display_name, nickname }. nickname → display_name → user_id.slice(0,8) 순으로 userNickname 결정(nicknameOf) |
| `subscriptions` | object\|null | 임베드: { plan_key, subscription_plans:{ name } }. subscription_plans.name → product, 없으면 '(미연동)'(productOf) |

**비고(권한·예외)**: v13 소유 테이블(스키마/RLS는 이 리포 마이그레이션에 정의 없음 — 외부 의존). 읽기 전용: 환불 승인/거절이 payment_history로 write-back 하지 않음(RPC payload에 intent_only_v13_payment_history_pending=true로 의도만 기록). method 필드는 DB에 없어 항상 '미확인' 하드코딩, product는 조인 실패 시 '(미연동)'. RLS는 v13 측 정책에 의존하므로 백엔드 확인 필요(이 리포에서 가드 불명). 결제 목록 데이터소스 분기는 commerceRefundsDataSource가 아니라 isSupabaseConfigured 단독으로 결정됨.

## commerce (쿠폰/포인트)
_관리자가 쿠폰과 포인트 정책을 만들고, 발급 상태나 만료를 조정하는 영역입니다._

### `admin_save_commerce_coupon` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 쿠폰을 새로 만들거나 내용을 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 쿠폰의 전체 정보가 돌아와 화면에 보여줄 수 있다

**자세한 목적**: 쿠폰 생성/수정(upsert). p_id가 null/빈문자열이면 생성(서버가 CPN-#### 신규 ID 채번), 값이 있으면 해당 쿠폰을 잠그고 수정. 저장 후 admin_audit_logs에 coupon_saved 기록. 반환은 쿠폰 ID 문자열뿐이라 프론트는 곧바로 commerce_coupons를 단건 select해서 전체 모델로 재매핑한다.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:486 saveCouponViaRpc — rpc 호출 후 loadCoupon(id) 재조회`
- `src/features/commerce/api/coupons-service.ts:634 saveCouponSafe(isSupabaseSource 분기, validate+free플랜 제한 후 호출)`
- `src/features/commerce/pages/commerce-coupon-create-page.tsx:782 저장 버튼 핸들러`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 쿠폰 ID(CPN-####). null 또는 빈문자열이면 신규 생성 |
| `p_coupon` | jsonb | 필수 | 쿠폰 본문. 필수 키: coupon_name(빈값 거부), coupon_kind, benefit_type. 선택: coupon_status(기본 waiting), issue_state(기본 normal), issue_target_type, target_group_ids[](기본 []), target_user_ids[](기본 []), auto_issue_trigger_type, code_generation_mode, coupon_code, code_count, audience, benefit_value(int 기본0), min_order_amount(int 기본0), max_discount_amount, applicable_scope(기본 allProducts), is_stackable, is_secret_coupon, issue_limit_mode/issue_limit, download_limit_mode/download_limit, usage_limit_mode/usage_limit, validity_mode(기본 fixedDate), valid_from/valid_until(date 또는 null), expire_after_days, linked_message_template_id, linked_crm_campaign_id, linked_event_id, admin_memo, issue_alert(jsonb obj), expire_alert(jsonb obj). 주의: applicable_scope_reference_ids/excluded_product_ids/target_group_names/linked_*_name 등은 프론트가 보내지 않으며 RPC도 insert하지 않음(이름 컬럼은 매핑/seed에만 존재). |
| `p_reason` | text | 필수 | 운영 사유. 빈값이면 'reason required' 예외. 프론트는 생성/수정 시 고정 문구를 자동 전송('쿠폰 등록 상세에서 생성/수정') |

**기대 Response**:
```ts
RPC returns `text` = 저장된 쿠폰 id (예: "CPN-0007"). 프론트(saveCouponViaRpc)는 이 id로 commerce_coupons를 다시 select하여 CommerceCoupon 모델로 반환한다. CommerceCoupon = { id:string; couponName:string; couponKind:'customerDownload'|'autoIssue'|'couponCode'|'manualIssue'; couponStatus:'대기'|'진행 중'|'종료'; issueState:'정상'|'발행 중지'; issueTargetType; targetGroupIds:string[]; targetGroupNames:string[]; targetUserIds:string[]; autoIssueTriggerType; codeGenerationMode; couponCode:string; codeCount:number|null; audience; benefitType; benefitValue:number; minOrderAmount:number; maxDiscountAmount:number|null; applicableScope; isStackable:boolean; isSecretCoupon:boolean; issueLimitMode; issueLimit:number|null; downloadLimitMode; downloadLimit:number|null; usageLimitMode; usageLimit:number|null; validityMode; validFrom:string(YYYY-MM-DD); validUntil:string; expireAfterDays:number|null; linkedMessageTemplateId/Name:string; linkedCrmCampaignId/Name:string; linkedEventId/Name:string; downloadUrl:string; issueCount/downloadCount/useCount:number; lastIssuedAt/lastDownloadedAt/lastUsedAt:string('YYYY-MM-DD HH:mm'); policyNotes:string[]; adminMemo:string; createdAt/updatedAt:string; updatedBy:string; issueAlert:{enabled:boolean;channel;templateId;templateName;timingLabel}; expireAlert:{동일} }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 저장된 쿠폰 ID. 생성 시 서버 채번(CPN-#### 4자리 zero-pad) |
| `updated_by(저장 결과)` | text | RPC가 caller_id(auth.uid())::text로 기록 → 후속 select에서 updatedBy로 노출 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: auth.uid() null→'unauthenticated', private.is_admin(caller) false→'forbidden: admin required', p_reason 빈값→예외, coupon_name 빈값→예외. 생성 시 pg_advisory_xact_lock으로 ID 채번 직렬화. CHECK 제약: coupon_kind/coupon_status/issue_state/issue_target_type/auto_issue_trigger_type/code_generation_mode/audience/benefit_type/applicable_scope/limit_modes/validity_mode 모두 ASCII enum값 검증 → 잘못된 값은 23514 위반. 테이블 자체는 RLS로 admin select만 허용(쓰기는 이 RPC 경유). diff에는 수정 시 coupon_status from/to만 기록.

### `admin_duplicate_commerce_coupon` · RPC · rpc
> 🟢 **쉬운 설명**: 기존 쿠폰을 똑같이 복사해 새 쿠폰을 만든다
> 🔵 **돌아오는 값(쉽게)**: 발급/사용 횟수가 0으로 초기화된 새 복사본 쿠폰 정보가 돌아온다

**자세한 목적**: 기존 쿠폰을 복제. 원본을 잠그고 새 CPN-#### ID로 INSERT...SELECT. 복제본은 coupon_name+' 복사본', coupon_status='waiting', issue_state='normal', 사용/발급 카운트(issue_count/download_count/use_count)와 last_*_at은 0/null로 초기화. admin_audit_logs에 coupon_duplicated 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:536 duplicateCouponViaRpc`
- `src/features/commerce/api/coupons-service.ts:646 duplicateCouponSafe(free플랜 제한 검사 후 호출)`
- `src/features/commerce/pages/commerce-coupons-page.tsx:1112 복제 액션`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_coupon_id` | text | 필수 | 복제 원본 쿠폰 ID |
| `p_reason` | text | 필수 | 운영 사유(필수). 프론트는 requireReason으로 빈값 차단(빈값이면 클라이언트에서 에러) |

**기대 Response**:
```ts
RPC returns `text` = 새로 생성된 복제 쿠폰 id. 프론트(duplicateCouponViaRpc)는 loadCoupon(id)로 재조회하여 CommerceCoupon 전체 모델 반환(shape는 admin_save_commerce_coupon 항목과 동일).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 복제로 생성된 신규 쿠폰 ID |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden(is_admin)/reason required. 원본 미존재 시 'unknown commerce coupon id: %'. 복제는 applicable_scope_reference_ids/excluded_product_ids/target_group_names/policy_notes/issue_alert/expire_alert 등 원본 값을 그대로 복사(저장 RPC와 달리 이름 컬럼·reference 컬럼도 복사됨). pg_advisory_xact_lock으로 ID 채번 직렬화.

### `admin_set_commerce_coupon_issue_state` · RPC · rpc
> 🟢 **쉬운 설명**: 자동 발행 쿠폰의 발급을 멈추거나 다시 시작한다
> 🔵 **돌아오는 값(쉽게)**: 발급 상태가 바뀐 쿠폰의 전체 정보가 돌아온다

**자세한 목적**: 쿠폰 발행 상태 토글(발행 중지/재개). p_state는 'paused' 또는 'normal'. autoIssue(자동 발행) 쿠폰만 허용 — coupon_kind<>'autoIssue'면 예외. 상태 전환 시 admin_audit_logs에 coupon_paused/coupon_resumed 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:549 setCouponIssueStateViaRpc`
- `src/features/commerce/api/coupons-service.ts:657 pauseCouponSafe / :665 resumeCouponSafe`
- `src/features/commerce/pages/commerce-coupons-page.tsx:1161 일시 중지 / :1163 재개`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_coupon_id` | text | 필수 | 대상 쿠폰 ID |
| `p_state` | text | 필수 | 'paused'(발행 중지) 또는 'normal'(재개). 그 외 값은 'invalid coupon issue state' 예외. 프론트는 pauseCouponSafe→'paused', resumeCouponSafe→'normal'로 고정 전달 |
| `p_reason` | text | 필수 | 운영 사유(필수). 프론트 requireReason으로 빈값 차단 |

**기대 Response**:
```ts
RPC returns `text` = p_coupon_id(변경된 쿠폰 ID 에코). 프론트(setCouponIssueStateViaRpc)는 loadCoupon(couponId)로 재조회 → CommerceCoupon 전체 모델 반환(shape 동일).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 상태 변경된 쿠폰 ID(입력값 그대로 반환) |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/state 검증/대상 미존재('unknown commerce coupon id')/autoIssue 아닌 경우('only autoIssue coupons can change issue state'). diff에 issue_state from/to 기록. 비-autoIssue 쿠폰에서 호출하면 DB 예외이므로 프론트는 mock 경로에서 사전 검증(autoIssue만 허용)함.

### `admin_delete_commerce_coupon` · RPC · rpc
> 🟢 **쉬운 설명**: 쿠폰을 완전히 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제 직전에 받아둔 쿠폰 정보가 돌아온다

**자세한 목적**: 쿠폰 영구 삭제(하드 딜리트). 대상 행을 잠그고 DELETE. admin_audit_logs에 coupon_deleted + 삭제 직전 전체 행 스냅샷(to_jsonb(v_old))을 diff로 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:564 deleteCouponViaRpc(삭제 전 loadCoupon으로 스냅샷 확보)`
- `src/features/commerce/api/coupons-service.ts:673 deleteCouponSafe`
- `src/features/commerce/pages/commerce-coupons-page.tsx:1167 삭제 액션`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_coupon_id` | text | 필수 | 삭제 대상 쿠폰 ID |
| `p_reason` | text | 필수 | 운영 사유(필수) |

**기대 Response**:
```ts
RPC returns `text` = p_coupon_id(삭제된 ID 에코). 프론트(deleteCouponViaRpc)는 RPC 호출 전에 loadCoupon으로 삭제 대상 스냅샷을 미리 받아두고, 삭제 성공 후 그 스냅샷(CommerceCoupon)을 반환한다(삭제 후엔 select 불가하므로).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 삭제된 쿠폰 ID |

**비고(권한·예외)**: SECURITY DEFINER, 하드 딜리트(soft delete 아님). 가드: unauthenticated/forbidden/reason required/대상 미존재. 감사로그 diff에 전체 행이 JSON으로 남으므로 복원 근거는 audit_logs에 의존.

### `admin_save_commerce_point_policy` · RPC · rpc
> 🟢 **쉬운 설명**: 포인트 적립/차감/소멸 규칙을 만들거나 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 포인트 정책의 전체 정보가 돌아온다

**자세한 목적**: 포인트 정책 생성/수정. p_id 없으면 신규(POL-#### 채번, status='draft' 고정 시작) / 있으면 수정. category 컬럼은 policy_type와 동일 값으로 자동 동기화. description도 condition_summary로 동기화 저장. admin_audit_logs에 point_policy_saved 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:387 savePointPolicyViaRpc`
- `src/features/commerce/api/points-service.ts:410 savePointPolicySafe`
- `src/features/commerce/pages/commerce-points-page.tsx:1161 정책 저장`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 정책 ID(POL-####). 빈값/null이면 신규 생성 |
| `p_policy` | jsonb | 필수 | 정책 본문. 필수: name(빈값 거부), policy_type('earn'\|'debit'\|'expire' 외 값 거부). 선택(모두 text, 기본 ''): condition_summary, earn_debit_rule, expiration_rule, target_condition, trigger_source, duplication_rule, manual_adjustment_rule, note. 주의: 프론트는 amount/points는 보내지 않으며 status도 보내지 않음(생성 시 항상 draft). |
| `p_reason` | text | 필수 | 운영 사유(필수). 프론트는 payload.note가 있으면 note, 없으면 '포인트 정책 저장' 문구 전송 |

**기대 Response**:
```ts
RPC returns `text` = 저장된 정책 id (POL-####). 프론트(savePointPolicyViaRpc)는 loadPointPolicy(id)로 commerce_point_policies 단건 select 후 PointPolicy 모델 반환. PointPolicy = { id:string; name:string; policyType:'적립'|'차감'|'소멸'; conditionSummary:string; earnDebitRule:string; expirationRule:string; status:'초안'|'운영 중'|'중지'; updatedAt:string('YYYY-MM-DD HH:mm'); updatedBy:string; targetCondition:string; triggerSource:string; duplicationRule:string; manualAdjustmentRule:string; note:string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 저장된 포인트 정책 ID |
| `status(저장 결과)` | text | 신규는 항상 'draft'(UI '초안'). 운영중/중지 전환은 별도 RPC(admin_update_commerce_point_policy_status)에서만 가능 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/name required/policy_type enum 검증. 생성 경로는 pg_advisory_xact_lock으로 채번 직렬화. 매핑 주의: DB policy_type(earn/debit/expire)↔UI(적립/차감/소멸). condition_summary↔description 동일값 저장. amount/points 컬럼은 테이블에 있으나 이 RPC로는 갱신 안 됨(기본 0).

### `admin_hold_commerce_point_expiration` · RPC · rpc
> 🟢 **쉬운 설명**: 곧 사라질 예정인 포인트의 소멸을 잠시 보류한다
> 🔵 **돌아오는 값(쉽게)**: 보류 상태로 바뀐 소멸 예정 건의 정보가 돌아온다

**자세한 목적**: 포인트 소멸 예정 건 보류(hold). status를 'held'로 전환(단, 이미 'completed'면 completed 유지), hold_reason/held_by/held_at 설정, calculation_memo에 '[시각 / 관리자] hold - 사유' 한 줄 append. admin_audit_logs에 point_expiration_held 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:455 savePointExpirationHoldViaRpc`
- `src/features/commerce/api/points-service.ts:436 savePointExpirationHoldSafe`
- `src/features/commerce/pages/commerce-points-page.tsx:1239 소멸 보류 등록`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_expiration_id` | text | 필수 | 소멸 예정 건 ID(EXP-####) |
| `p_reason` | text | 필수 | 보류 사유(필수). 프론트 requireReason으로 빈값 차단. held_at은 서버 now()로 설정 |

**기대 Response**:
```ts
RPC returns `text` = p_expiration_id(에코). 프론트(savePointExpirationHoldViaRpc)는 loadPointExpiration(id)로 commerce_point_expirations 재조회 → PointExpiration 모델 반환. PointExpiration = { id:string; scheduledAt:string('YYYY-MM-DD HH:mm', expire_at 기반); userId:string; userName:string; sourceType:'추천'|'미션'|'이벤트'|'결제'|'환불'|'관리자'|'시스템'; expiringPoint:number(scheduled_amount); availablePoint:number(available_amount); status:'예정'|'보류'|'완료'|'취소'; holdReason:string; heldBy:string; processedAt:string; relatedLedgerId:string; policyId:string; policyName:string; calculationMemo:string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 보류 처리된 소멸 건 ID(입력 에코) |
| `status(결과)` | text | 'held'로 전환(원래 completed면 그대로 completed) |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/대상 미존재('unknown commerce point expiration id'). 'completed' 건은 상태 변경 없이 메모/사유만 갱신(소멸 완료분은 다시 예정으로 못 되돌림). diff에 status from/to 기록.

### `admin_release_commerce_point_expiration` · RPC · rpc
> 🟢 **쉬운 설명**: 보류했던 포인트 소멸을 다시 예정 상태로 되돌린다
> 🔵 **돌아오는 값(쉽게)**: 예정 상태로 복귀한 소멸 건의 정보가 돌아온다

**자세한 목적**: 포인트 소멸 보류 해제. status를 무조건 'scheduled'(예정)로 되돌리고 hold_reason/held_by/held_at을 null로 초기화, calculation_memo에 '[시각 / 관리자] release - 사유' append. admin_audit_logs에 point_expiration_released 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:470 releasePointExpirationHoldViaRpc`
- `src/features/commerce/api/points-service.ts:446 releasePointExpirationHoldSafe`
- `src/features/commerce/pages/commerce-points-page.tsx:1318 보류 해제`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_expiration_id` | text | 필수 | 소멸 예정 건 ID |
| `p_reason` | text | 필수 | 해제 사유(필수) |

**기대 Response**:
```ts
RPC returns `text` = p_expiration_id(에코). 프론트(releasePointExpirationHoldViaRpc)는 loadPointExpiration(id) 재조회 → PointExpiration 모델 반환(shape는 admin_hold_commerce_point_expiration 항목과 동일, status는 '예정'으로 복귀).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 보류 해제된 소멸 건 ID |
| `status(결과)` | text | 무조건 'scheduled'(UI '예정')로 전환 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/대상 미존재. completed 여부 무관하게 scheduled로 set하므로 hold RPC와 비대칭(주의). diff에 status from/to('scheduled') 기록.

### `admin_save_commerce_coupon_template` · RPC · rpc
> 🟢 **쉬운 설명**: 정기적으로 발급되는 구독 쿠폰의 양식을 만들거나 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 구독 쿠폰 양식의 전체 정보가 돌아온다

**자세한 목적**: (인접 RPC, 동일 파일/도메인) 정기 쿠폰 구독 템플릿 생성/수정(upsert). p_id 없으면 CPT-#### 채번 생성. issue_schedule/usage_end_schedule jsonb 객체와 등급/카테고리/제외상품 reference id 배열을 저장. admin_audit_logs에 coupon_template_saved 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:601 saveCouponTemplateViaRpc`
- `src/features/commerce/api/coupons-service.ts:703 saveCouponTemplateSafe`
- `src/features/commerce/pages/commerce-coupon-template-create-page.tsx:1038 템플릿 저장`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 템플릿 ID(CPT-####). 빈값/null이면 신규 |
| `p_template` | jsonb | 필수 | 필수: template_name(빈값 거부), benefit_type. 선택: target_grade_ids[], benefit_value(int), min_order_amount(int), max_discount_amount, applicable_scope(기본 allProducts), applicable_scope_reference_ids[], excluded_product_mode(기본 none), excluded_product_ids[], is_stackable, issue_schedule(obj 기본 {dayOfMonth:1,hour:7,minute:0}), usage_end_schedule(obj 기본 {dayOfMonth:28,hour:23,minute:59}), status(기본 active, 'active'\|'paused'), issue_alert_enabled, expire_alert_enabled, alert_channel(기본 webAppPush, 'webAppPush'만 허용), admin_memo. issue_target_type는 항상 'shoppingGrade' 고정. |
| `p_reason` | text | 필수 | 운영 사유(필수). 프론트가 고정 문구 자동 전송 |

**기대 Response**:
```ts
RPC returns `text` = 저장된 템플릿 id (CPT-####). 프론트(saveCouponTemplateViaRpc)는 commerce_coupon_subscription_templates 단건 select 후 CommerceCouponSubscriptionTemplate 모델 반환: { id; templateName; issueTargetType:'shoppingGrade'; targetGradeIds:string[]; targetGradeNames:string[]; benefitType; benefitValue:number; minOrderAmount:number; maxDiscountAmount:number|null; applicableScope; applicableScopeReferenceIds:string[]; applicableScopeReferenceNames:string[]; excludedProductMode; excludedProductIds:string[]; excludedProductNames:string[]; isStackable:boolean; issueSchedule:{dayOfMonth;hour;minute}; usageEndSchedule:{동일}; status:'진행 중'|'발행 중지'; issuedCouponCount:number; lastIssuedAt/nextIssuedAt:string('YYYY-MM-DD HH:mm'); issueAlertEnabled/expireAlertEnabled:boolean; alertChannel; adminMemo:string; policyNotes:string[]; createdAt/updatedAt:string; updatedBy:string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 저장된 템플릿 ID |

**비고(권한·예외)**: 스코프 외 명시였으나 동일 도메인/파일에서 호출되어 함께 문서화. SECURITY DEFINER. *_names/policy_notes 컬럼은 INSERT하지 않으며(저장 RPC), 프론트 매핑이 비어있으면 클라이언트 헬퍼(resolveCouponTemplate*Names/getCouponTemplatePolicyNotes)로 보강. alert_channel CHECK는 'webAppPush'만 허용.

### `admin_set_commerce_coupon_template_status` · RPC · rpc
> 🟢 **쉬운 설명**: 정기 쿠폰 양식의 발행을 멈추거나 다시 시작한다
> 🔵 **돌아오는 값(쉽게)**: 상태가 바뀐 구독 쿠폰 양식의 전체 정보가 돌아온다

**자세한 목적**: (인접 RPC) 정기 쿠폰 템플릿 발행 상태 토글('active'|'paused'). admin_audit_logs에 coupon_template_paused/resumed 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:639 setCouponTemplateStatusViaRpc`
- `src/features/commerce/api/coupons-service.ts:718 pauseCouponTemplateSafe / :729 resumeCouponTemplateSafe`
- `src/features/commerce/pages/commerce-coupons-page.tsx:1172 중지 / :1177 재개`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_template_id` | text | 필수 | 템플릿 ID |
| `p_status` | text | 필수 | 'active'(재개) 또는 'paused'(중지). 그 외 거부. 프론트 pause→paused, resume→active |
| `p_reason` | text | 필수 | 운영 사유(필수) |

**기대 Response**:
```ts
RPC returns `text` = p_template_id 에코. 프론트는 loadTemplate(id) 재조회 → CommerceCouponSubscriptionTemplate 모델(shape는 admin_save_commerce_coupon_template 항목과 동일).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 상태 변경된 템플릿 ID |

**비고(권한·예외)**: 스코프 외 명시였으나 동일 도메인에서 호출. SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/status enum 검증/대상 미존재. diff에 status from/to 기록.

### `admin_delete_commerce_coupon_template` · RPC · rpc
> 🟢 **쉬운 설명**: 정기 쿠폰 양식을 완전히 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제 직전에 받아둔 양식 정보가 돌아온다

**자세한 목적**: (인접 RPC) 정기 쿠폰 템플릿 하드 딜리트. admin_audit_logs에 coupon_template_deleted + 삭제 직전 전체 행(to_jsonb) diff 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:657 deleteCouponTemplateViaRpc`
- `src/features/commerce/api/coupons-service.ts:740 deleteCouponTemplateSafe`
- `src/features/commerce/pages/commerce-coupons-page.tsx:1181 삭제`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_template_id` | text | 필수 | 템플릿 ID |
| `p_reason` | text | 필수 | 운영 사유(필수) |

**기대 Response**:
```ts
RPC returns `text` = p_template_id 에코. 프론트(deleteCouponTemplateViaRpc)는 삭제 전 loadTemplate으로 받은 스냅샷(CommerceCouponSubscriptionTemplate)을 삭제 성공 후 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 삭제된 템플릿 ID |

**비고(권한·예외)**: 스코프 외 명시였으나 동일 도메인에서 호출. SECURITY DEFINER, 하드 딜리트. 가드 동일.

### `admin_update_commerce_point_policy_status` · RPC · rpc
> 🟢 **쉬운 설명**: 포인트 정책을 사용 중 또는 중지 상태로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 상태가 바뀐 포인트 정책의 전체 정보가 돌아온다

**자세한 목적**: (인접 RPC) 포인트 정책 운영 상태 전환('active'|'inactive'). note 컬럼에 '[시각 / 관리자] status <상태> - 사유' append. admin_audit_logs에 point_policy_status_changed 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:414 updatePointPolicyStatusViaRpc`
- `src/features/commerce/api/points-service.ts:416 updatePointPolicyStatusSafe`
- `src/features/commerce/pages/commerce-points-page.tsx:1282 정책 상태 전환`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_policy_id` | text | 필수 | 정책 ID |
| `p_next_status` | text | 필수 | 'active'(운영 중) 또는 'inactive'(중지). 'draft'로는 전환 불가. 프론트는 UI 상태(운영 중/중지)를 DB값으로 매핑해 전달 |
| `p_reason` | text | 필수 | 운영 사유(필수) |

**기대 Response**:
```ts
RPC returns `text` = p_policy_id 에코. 프론트(updatePointPolicyStatusViaRpc)는 loadPointPolicy(id) 재조회 → PointPolicy 모델(shape는 admin_save_commerce_point_policy 항목과 동일).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 상태 변경된 정책 ID |
| `status(결과)` | text | active/inactive (UI 운영 중/중지) |

**비고(권한·예외)**: 스코프 외였으나 포인트 정책 화면에서 호출. SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/status enum('active','inactive')/대상 미존재. UI '초안'(draft)→운영 전환 시 next_status는 active만.

### `admin_create_manual_point_adjustment` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 회원 포인트를 직접 더하거나 뺀다
> 🔵 **돌아오는 값(쉽게)**: 새로 기록된 포인트 거래 내역 한 건이 돌아온다(잔액 음수 불가)

**자세한 목적**: (인접 RPC) 회원 포인트 수동 적립/차감 조정. 대상 회원의 최신 원장 잔액을 잠그고 amount를 더해 새 잔액 계산 → 음수가 되면 'point balance cannot be negative' 예외(적자 미허용). entry_type은 amount<0이면 'debit', 아니면 'earn'. PL-#### 채번 후 commerce_point_ledgers INSERT. admin_audit_logs에 point_manual_adjusted 기록.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:433 createManualPointAdjustmentViaRpc`
- `src/features/commerce/api/points-service.ts:426 createManualPointAdjustmentSafe`
- `src/features/commerce/pages/commerce-points-page.tsx:1198 수동 포인트 조정`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_user_id` | text | 필수 | 대상 회원 ID(빈값 거부) |
| `p_amount` | integer | 필수 | 0이면 예외. 프론트가 부호 처리: ledgerType이 '차감'\|'회수'이면 -abs(amount), 그 외('적립'\|'복구')이면 +abs(amount)로 변환해 전송 |
| `p_reason` | text | 필수 | 운영 사유(필수). reason과 approval_memo 모두 이 값으로 저장됨 |

**기대 Response**:
```ts
RPC returns `text` = 생성된 원장 id (PL-####). 프론트(createManualPointAdjustmentViaRpc)는 loadPointLedger(id)로 commerce_point_ledgers 단건 select → PointLedger 모델 반환. PointLedger = { id:string; occurredAt:string('YYYY-MM-DD HH:mm'); userId:string; userName:string; ledgerType:'적립'|'차감'|'회수'|'복구'|'소멸'; sourceType:'관리자'(고정); pointDelta:number(amount); balanceAfter:number; availableBalanceAfter:number; status:'완료'; expirationAt:string('YYYY-MM-DD', +90일 또는 ''); sourceId:string; sourceLabel:string; policyId:string('POL-1002'); policyName:string; reason:string; approvalMemo:string; actedBy:string }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성된 포인트 원장 ID |
| `balance_after / available_balance_after` | integer | 조정 후 잔액(동일 값으로 기록). 음수 불가 |
| `expiration_at` | date | 적립(+)이면 현재일+90일, 차감/회수(-)이면 null |

**비고(권한·예외)**: 스코프 외였으나 포인트 원장 화면에서 호출. SECURITY DEFINER. 가드: unauthenticated/forbidden/reason required/user_id required/amount≠0/잔액 음수 금지. 2중 advisory lock(회원별+ID채번)으로 동시성 직렬화. 하드코딩 STUB값: source='manual_adjustment', source_label/policy_name='운영 수동 조정', policy_id='POL-1002', user_name도 p_user_id로 저장(실명 미조인). UI sourceType은 무조건 '관리자'. 회수/복구 구분은 DB entry_type에 없음(earn/debit만 기록).

### `commerce_coupons` · 테이블 · select
> 🟢 **쉬운 설명**: 등록된 쿠폰 목록이나 한 건을 조회한다
> 🔵 **돌아오는 값(쉽게)**: 쿠폰 목록이 돌아와 화면에 보여줄 수 있다(관리자만 조회 가능)

**자세한 목적**: 쿠폰 마스터 테이블. 프론트는 PostgREST로 SELECT만 직접 수행(목록/단건). 모든 쓰기는 SECURITY DEFINER RPC 경유. RLS: authenticated 중 private.is_admin(auth.uid())인 관리자만 SELECT 가능.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:463 loadCouponsFromSupabase(목록, order updated_at desc)`
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:435 loadCoupon(단건, eq id maybeSingle)`
- `src/features/commerce/pages/commerce-coupons-page.tsx:523 목록 로드`
- `src/features/commerce/pages/commerce-coupon-create-page.tsx:591 단건 로드(수정 화면)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 53개 컬럼 명시 select(COUPON_COLUMNS): id, coupon_name, coupon_kind, coupon_status, issue_state, issue_target_type, target_group_ids, target_group_names, target_user_ids, auto_issue_trigger_type, code_generation_mode, coupon_code, code_count, audience, benefit_type, benefit_value, min_order_amount, max_discount_amount, applicable_scope, applicable_scope_reference_ids, excluded_product_ids, is_stackable, is_secret_coupon, issue_limit_mode, issue_limit, download_limit_mode, download_limit, usage_limit_mode, usage_limit, validity_mode, valid_from, valid_until, expire_after_days, linked_message_template_id/name, linked_crm_campaign_id/name, linked_event_id/name, download_url, issue_count, download_count, use_count, last_issued_at, last_downloaded_at, last_used_at, policy_notes, admin_memo, issue_alert, expire_alert, created_at, updated_at, updated_by |
| `order` | string | - | 목록은 updated_at desc 정렬 |
| `eq.id / maybeSingle` | string | - | 단건 조회는 .eq('id', couponId).maybeSingle() |

**기대 Response**:
```ts
Row[] → mapCouponRow로 CommerceCoupon[]로 변환. 행 컬럼 타입: id text; coupon_name text; coupon_kind/coupon_status/issue_state text(ASCII enum); target_group_ids/target_group_names/target_user_ids/applicable_scope_reference_ids/excluded_product_ids/policy_notes jsonb array; benefit_value/min_order_amount/max_discount_amount/code_count/issue_limit/download_limit/usage_limit/expire_after_days/issue_count/download_count/use_count integer(nullable 일부); is_stackable/is_secret_coupon boolean; valid_from/valid_until date; last_*_at/created_at/updated_at timestamptz; issue_alert/expire_alert jsonb object{enabled,channel,templateId,templateName,timingLabel}; updated_by text(관리자 uid). 매핑: 상태/이슈상태는 KO 라벨로, date는 'YYYY-MM-DD', timestamptz는 'YYYY-MM-DD HH:mm'(slice, KST 변환 아님 — 문자열 앞 16자만 취함)로 가공.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `coupon_status` | text | waiting/active/ended → UI 대기/진행 중/종료 |
| `issue_state` | text | normal/paused → UI 정상/발행 중지 |
| `issue_alert / expire_alert` | jsonb | {enabled, channel, templateId, templateName, timingLabel} 객체 |
| `*_at` | timestamptz | 프론트는 raw 문자열의 앞 16자만 slice(타임존 변환 없이 표시) — 백엔드가 KST(+09)로 저장하므로 표기도 KST |

**비고(권한·예외)**: RLS 정책: commerce_coupons_admin_select(for select to authenticated using private.is_admin(auth.uid())). enable+force RLS. INSERT/UPDATE/DELETE 정책 없음 → PostgREST 직접 쓰기 불가, RPC만. 다수 CHECK 제약(enum/ jsonb array typeof) 존재. seed 6건(CPN-0001~0006) 있으나 dev DB는 2026-06-22 전면 TRUNCATE됨(메모리 참조) — 재시드 전엔 비어있을 수 있음.

### `commerce_coupon_subscription_templates` · 테이블 · select
> 🟢 **쉬운 설명**: 정기 구독 쿠폰 양식 목록이나 한 건을 조회한다
> 🔵 **돌아오는 값(쉽게)**: 구독 쿠폰 양식 목록이 돌아온다(관리자만 조회 가능)

**자세한 목적**: 정기(구독) 쿠폰 템플릿 마스터. 프론트는 SELECT만 직접 수행(목록/단건). 쓰기는 RPC 경유. RLS: 관리자(is_admin) SELECT만 허용.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:578 loadCouponTemplatesFromSupabase(목록)`
- `src/features/commerce/api/supabase-commerce-coupons-service.ts:448 loadTemplate(단건)`
- `src/features/commerce/pages/commerce-coupons-page.tsx:559 템플릿 목록 로드`
- `src/features/commerce/pages/commerce-coupon-template-create-page.tsx 템플릿 단건 로드(수정)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 30개 컬럼(TEMPLATE_COLUMNS): id, template_name, issue_target_type, target_grade_ids, target_grade_names, benefit_type, benefit_value, min_order_amount, max_discount_amount, applicable_scope, applicable_scope_reference_ids, applicable_scope_reference_names, excluded_product_mode, excluded_product_ids, excluded_product_names, is_stackable, issue_schedule, usage_end_schedule, status, issued_coupon_count, last_issued_at, next_issued_at, issue_alert_enabled, expire_alert_enabled, alert_channel, admin_memo, policy_notes, created_at, updated_at, updated_by |
| `order` | string | - | 목록은 updated_at desc |
| `eq.id / maybeSingle` | string | - | 단건 .eq('id',templateId).maybeSingle() |

**기대 Response**:
```ts
Row[] → mapTemplateRow로 CommerceCouponSubscriptionTemplate[]. 컬럼 타입: target_grade_ids/target_grade_names/applicable_scope_reference_ids/applicable_scope_reference_names/excluded_product_ids/excluded_product_names/policy_notes jsonb array; issue_schedule/usage_end_schedule jsonb object{dayOfMonth,hour,minute}; benefit_value/min_order_amount/max_discount_amount/issued_coupon_count integer; is_stackable/issue_alert_enabled/expire_alert_enabled boolean; status text('active'|'paused'→UI '진행 중'|'발행 중지'); alert_channel text('webAppPush'); last_issued_at/next_issued_at/created_at/updated_at timestamptz; issue_target_type 항상 'shoppingGrade'.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | text | active/paused → UI 진행 중/발행 중지 |
| `issue_schedule / usage_end_schedule` | jsonb | {dayOfMonth, hour, minute} 객체 |
| `*_names / policy_notes` | jsonb | 비어있으면 프론트가 클라이언트 옵션 카탈로그로 이름/정책노트 보강 |

**비고(권한·예외)**: RLS: commerce_coupon_templates_admin_select(admin select). enable+force RLS, 직접 쓰기 불가. CHECK: issue_target_type='shoppingGrade' 고정, benefit_type/applicable_scope/excluded_product_mode/status/alert_channel enum, 다수 jsonb typeof(array/object) 검증. seed 2건(CPT-0001~0002).

### `commerce_point_policies` · 테이블 · select
> 🟢 **쉬운 설명**: 포인트 정책 목록이나 한 건을 조회한다
> 🔵 **돌아오는 값(쉽게)**: 포인트 정책 목록이 돌아온다(관리자만 조회 가능)

**자세한 목적**: 포인트 정책 마스터. 프론트는 스냅샷 로드 및 정책 저장 후 재조회 시 SELECT. 쓰기는 RPC 경유. RLS: 관리자 SELECT만.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:350 loadPointsSnapshotFromSupabase(Promise.all 첫 항목)`
- `src/features/commerce/api/supabase-commerce-points-service.ts:299 loadPointPolicy(단건, 저장 후 재조회)`
- `src/features/commerce/pages/commerce-points-page.tsx:725 스냅샷 로드(정책 탭)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 19개(POLICY_COLUMNS): id, name, policy_type, category, amount, points, status, description, condition_summary, earn_debit_rule, expiration_rule, target_condition, trigger_source, duplication_rule, manual_adjustment_rule, note, created_at, updated_at, updated_by |
| `order` | string | - | 스냅샷에서 updated_at desc |

**기대 Response**:
```ts
Row[] → mapPolicyRow로 PointPolicy[]. 컬럼: policy_type/category/status text(ASCII enum: earn/debit/expire, draft/active/inactive); amount/points integer(프론트 미사용); name/condition_summary/earn_debit_rule/expiration_rule/target_condition/trigger_source/duplication_rule/manual_adjustment_rule/note/description text; created_at/updated_at timestamptz; updated_by text. 매핑: policy_type→UI 적립/차감/소멸, status→UI 초안/운영 중/중지, conditionSummary는 condition_summary||description, updatedAt='YYYY-MM-DD HH:mm'.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `policy_type` | text | earn/debit/expire → UI 적립/차감/소멸. category는 policy_type와 동일값 동기화 |
| `status` | text | draft/active/inactive → UI 초안/운영 중/중지 |
| `amount / points` | integer | 테이블에 존재하나 프론트 모델/매핑에서 미사용(기본 0) |

**비고(권한·예외)**: RLS: commerce_point_policies_admin_select. enable+force RLS, 직접 쓰기 불가. CHECK: policy_type/category in (earn,debit,expire), status in (draft,active,inactive). seed 4건(POL-1001~1004).

### `commerce_point_ledgers` · 테이블 · select
> 🟢 **쉬운 설명**: 회원 포인트 거래 내역을 조회한다
> 🔵 **돌아오는 값(쉽게)**: 적립/차감/회수 등 포인트 거래 내역이 돌아온다(관리자만 조회 가능)

**자세한 목적**: 포인트 원장(거래 내역). 프론트는 스냅샷 로드 및 수동 조정 후 단건 재조회 시 SELECT. 쓰기는 admin_create_manual_point_adjustment RPC 경유. RLS: 관리자 SELECT만.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:359 loadPointsSnapshotFromSupabase(Promise.all)`
- `src/features/commerce/api/supabase-commerce-points-service.ts:316 loadPointLedger(단건, 조정 후 재조회)`
- `src/features/commerce/pages/commerce-points-page.tsx:725 스냅샷 로드(원장 탭)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 20개(LEDGER_COLUMNS): id, user_id, user_name, entry_type, source_type, amount, balance_after, available_balance_after, status, expiration_at, source, source_id, source_label, policy_id, policy_name, reason, approval_memo, occurred_at, created_at, created_by |
| `order` | string | - | 스냅샷에서 occurred_at desc |

**기대 Response**:
```ts
Row[] → mapLedgerRow로 PointLedger[]. 컬럼: entry_type text(earn/debit/revoke/restore/expire→UI 적립/차감/회수/복구/소멸); source_type text(referral/mission/event/payment/refund/admin/system→UI 추천/미션/이벤트/결제/환불/관리자/시스템); amount/balance_after/available_balance_after integer(잔액 음수 불가 CHECK); status text(completed/held/cancelled→완료/보류/취소); expiration_at date('YYYY-MM-DD'); occurred_at/created_at timestamptz('YYYY-MM-DD HH:mm'); created_by text→actedBy. user_name null이면 user_id로 폴백.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `entry_type` | text | DB는 5종이나 수동 조정 RPC는 earn/debit만 기록(회수/복구는 프론트 입력 시 부호로만 처리) |
| `source_type` | text | 7종 enum → UI 한글 라벨. 수동 조정은 항상 'admin'(관리자) |
| `available_balance_after` | integer | 수동 조정 시 최신 잔액 기준 누적 계산값 |

**비고(권한·예외)**: RLS: commerce_point_ledgers_admin_select. enable+force RLS, 직접 쓰기 불가. CHECK: entry_type/source_type/status enum, balance_after>=0 AND available_balance_after>=0. 인덱스 (user_id, occurred_at desc). seed 8건(PL-2001~2008).

### `commerce_point_expirations` · 테이블 · select
> 🟢 **쉬운 설명**: 포인트 소멸 예정 및 이력을 조회한다
> 🔵 **돌아오는 값(쉽게)**: 소멸 예정 포인트와 상태 목록이 돌아온다(관리자만 조회 가능)

**자세한 목적**: 포인트 소멸 예정/이력. 프론트는 스냅샷 로드 및 보류/해제 후 단건 재조회 시 SELECT. 쓰기는 hold/release RPC 경유. RLS: 관리자 SELECT만.

**사용 위치**:
- `src/features/commerce/api/supabase-commerce-points-service.ts:363 loadPointsSnapshotFromSupabase(Promise.all)`
- `src/features/commerce/api/supabase-commerce-points-service.ts:333 loadPointExpiration(단건, 보류/해제 후 재조회)`
- `src/features/commerce/pages/commerce-points-page.tsx:725 스냅샷 로드(소멸 탭)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 17개(EXPIRATION_COLUMNS): id, user_id, user_name, source_type, scheduled_amount, available_amount, expire_at, status, hold_reason, held_by, held_at, processed_at, related_ledger_id, policy_id, policy_name, calculation_memo, created_at |
| `order` | string | - | 스냅샷에서 expire_at asc(만료 임박 순) |

**기대 Response**:
```ts
Row[] → mapExpirationRow로 PointExpiration[]. 컬럼: source_type text(7종 enum→UI 한글); scheduled_amount/available_amount integer(>=0 CHECK)→UI expiringPoint/availablePoint; expire_at timestamptz→scheduledAt('YYYY-MM-DD HH:mm'); status text(scheduled/held/completed/cancelled→예정/보류/완료/취소); hold_reason/held_by/calculation_memo text; processed_at timestamptz('YYYY-MM-DD HH:mm'); related_ledger_id/policy_id/policy_name text. user_name null→user_id 폴백, available_amount null→scheduled_amount 폴백.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | text | scheduled/held/completed/cancelled → UI 예정/보류/완료/취소 |
| `expire_at` | timestamptz | 만료 예정 시각. UI scheduledAt으로 'YYYY-MM-DD HH:mm' 표시, 목록은 이 값 asc 정렬 |
| `held_by / held_at / hold_reason` | text/timestamptz | 보류 시 RPC가 설정, 해제 시 null로 초기화 |

**비고(권한·예외)**: RLS: commerce_point_expirations_admin_select. enable+force RLS, 직접 쓰기 불가. CHECK: status/source_type enum, scheduled_amount>=0 AND available_amount>=0. 인덱스 (user_id), (expire_at). seed 5건(EXP-3001~3005). exportPointExpirationsFromSupabase는 네트워크 호출 없는 클라이언트 STUB(현재 시각+itemCount만 반환, 실제 export 미구현).

## community (게시글/신고)
_관리자가 커뮤니티 글을 숨기거나 삭제하고, 신고를 처리하며 메모를 남기는 영역입니다._

### `community_posts` · 테이블 · select
> 🟢 **쉬운 설명**: 커뮤니티 게시글 목록이나 한 건을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 제목·내용·작성자·상태와 관리자 메모가 함께 돌아온다

**자세한 목적**: 커뮤니티 게시글 목록/단건 조회. 관리자 게시글 관리 화면의 기본 읽기 경로. community_post_admin_notes(관리자 메모)를 임베디드로 함께 조회한다.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:187 loadCommunityPosts (목록, created_at desc)`
- `src/features/community/api/supabase-community-service.ts:204 loadCommunityPost (단건, eq id + maybeSingle — 모든 RPC write 후 재조회에 사용)`
- `src/features/community/pages/community-posts-page.tsx:192 fetchCommunityPostsSafe 호출 (게시글 관리 화면 진입 시)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | string | 필수 | PostgREST select 컬럼 목록. id, title, content_html, author_id, author_name, board, status, last_moderation_policy_code, reports_count, created_at, updated_at, updated_by, community_post_admin_notes(id, post_id, title, type, author_id, author_name, content, created_at) |
| `order` | created_at.desc | - | 목록 조회 시 created_at 내림차순. 단건 조회 시 .eq('id', postId).maybeSingle() |
| `id (eq)` | text | - | 단건 조회 시 id 필터 (loadCommunityPost). 예: POST-001 |

**기대 Response**:
```ts
Row: { id: string; title: string; content_html: string|null; author_id: string; author_name: string; board: string; status: string('published'|'hidden'); last_moderation_policy_code: string|null('SPAM'|'ABUSE'|'AD'|'PRIVACY'|'DUPLICATE'|'OTHER'); reports_count: number|null; created_at: string|null(timestamptz ISO); updated_at: string|null; updated_by: string|null; community_post_admin_notes: { id; post_id; title; type; author_id; author_name; content; created_at }[] }. 프론트 mapPostRow 매핑 결과 CommunityPost: { id; title; content(=content_html); contentHtml; authorName; authorId; board; createdAt(YYYY-MM-DD, created_at 앞10자); views:0(하드코딩); comments:0(하드코딩); reports(=reports_count??0); status('게시'|'숨김' 한글 라벨); adminNotes: CommunityAdminMemo[](created_at desc 정렬); lastModerationPolicyCode; lastModeratedAt(updated_at YYYY-MM-DD HH:mm); lastModerationReason: undefined(항상 미설정) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | string | DB값 'published'\|'hidden'. 프론트에서 '게시'\|'숨김' 한글 라벨로 변환(매핑에 없으면 '숨김' 폴백) |
| `reports_count` | integer | 신고 누적 수. null이면 프론트에서 0 처리. CHECK >= 0 |
| `last_moderation_policy_code` | text\|null | 마지막 조치 정책 코드. CHECK: SPAM/ABUSE/AD/PRIVACY/DUPLICATE/OTHER 또는 null |
| `board` | text | 게시판. CHECK: '자유게시판'\|'질문'\|'후기' (한글값) |
| `community_post_admin_notes` | object[] | 임베디드 관리자 메모 배열. type CHECK: 'SPAM'\|'욕설/혐오'\|'성인/불법'\|'광고/홍보'\|'개인정보 노출'\|'중복 게시'\|'기타'. 프론트는 created_at desc 정렬 후 CommunityAdminMemo로 매핑 |
| `views / comments` | number | STUB: DB 컬럼 없음. 프론트 mapPostRow가 항상 0으로 하드코딩 |

**비고(권한·예외)**: RLS: SELECT는 authenticated 중 private.is_admin(auth.uid())만 허용(community_posts_admin_select, force RLS). INSERT/UPDATE/DELETE 정책 없음 → 프론트 직접 쓰기 불가, 반드시 SECURITY DEFINER RPC 경유. content_html은 NOT NULL default ''. id는 text PK(POST-001 형식, next_community_post_id로 생성). datetime은 timestamptz raw ISO를 반환하고 프론트가 문자열 slice로 자른다(KST 변환 아님).

### `community_reports` · 테이블 · select
> 🟢 **쉬운 설명**: 신고 접수 목록이나 한 건을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 신고 대상·신고자·사유·처리 상태가 돌아온다

**자세한 목적**: 커뮤니티 신고 목록/단건 조회. 신고 관리 화면의 기본 읽기 경로.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:223 loadCommunityReports (목록, created_at desc)`
- `src/features/community/api/supabase-community-service.ts:240 loadCommunityReport (단건, eq id + maybeSingle — resolve RPC 후 재조회)`
- `src/features/community/pages/community-reports-page.tsx:106 fetchCommunityReportsSafe 호출 (신고 관리 화면 진입 시)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | string | 필수 | id, target_post_id, target_user_id, target_user_name, reporter_id, reporter_name, reason, reason_code, process_status, resolution_action, resolved_by, resolved_at, created_at |
| `order` | created_at.desc | - | 목록 조회 시 created_at 내림차순 |
| `id (eq)` | text | - | 단건 조회 시 id 필터 (loadCommunityReport, resolve 후 재조회). 예: RP-001 |

**기대 Response**:
```ts
Row: { id: string; target_post_id: string|null; target_user_id: string; target_user_name: string; reporter_id: string; reporter_name: string; reason: string; reason_code: string|null; process_status: string('pending'|'resolved'); resolution_action: string|null('hide_post'|'suspend_user'|'dismiss'); resolved_by: string|null; resolved_at: string|null; created_at: string|null }. 프론트 mapReportRow 매핑 결과 CommunityReport: { id; targetPostId(=target_post_id??''); targetUserId; targetUserName; reporterId; reporterName; reason; reasonCode(?); createdAt(YYYY-MM-DD HH:mm); processStatus('처리 대기'|'처리 완료' 한글 라벨); resolutionAction?; resolvedBy?; resolvedAt(YYYY-MM-DD HH:mm) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `process_status` | string | DB값 'pending'\|'resolved'. 프론트는 '처리 대기'\|'처리 완료'로 변환(폴백 '처리 대기'). CHECK 제약 |
| `resolution_action` | text\|null | CHECK: null\|'hide_post'\|'suspend_user'\|'dismiss' |
| `target_post_id` | text\|null | 신고 대상 게시글 id. community_posts(id) FK, on delete set null. null 가능(게시글 외 신고). 프론트는 '' 폴백 |
| `reason_code` | text\|null | 신고 사유 코드(SPAM/ABUSE/AD 등 자유 텍스트, 표시용). resolve hide_post 시 community_posts.last_moderation_policy_code 폴백값으로 사용됨 |
| `resolved_by` | text\|null | 처리한 관리자 uid 문자열(caller_id::text). 미처리 시 null |

**비고(권한·예외)**: RLS: SELECT는 private.is_admin(auth.uid())만 허용(community_reports_admin_select, force RLS). 쓰기 정책 없음 → admin_resolve_community_report RPC로만 갱신. id는 text PK(RP-001 형식, 시드값). datetime은 timestamptz raw ISO 반환 후 프론트 slice(KST 변환 아님).

### `admin_hide_community_post` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 게시글을 숨긴다
> 🔵 **돌아오는 값(쉽게)**: 성공 후 숨김 처리된 게시글 정보가 돌아온다

**자세한 목적**: 게시글을 '숨김(hidden)' 상태로 전환하고 마지막 조치 정책 코드를 기록. 감사 로그(post_hidden)를 남긴다.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:279 hideCommunityPost — client.rpc('admin_hide_community_post', {p_post_id, p_reason, p_policy_code})`
- `src/features/community/pages/community-posts-page.tsx:392 hideCommunityPostSafe ({postId, reason, policyCode})`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_post_id` | text | 필수 | 대상 게시글 id (예: POST-002) |
| `p_reason` | text | 필수 | 운영 사유. 공백/빈문자열 불가(서버 검증 + 프론트 requireReason). 미입력 시 'reason required (operational reason)' 예외 |
| `p_policy_code` | text | - | 정책 코드. null 허용. 값이 있으면 'SPAM'\|'ABUSE'\|'AD'\|'PRIVACY'\|'DUPLICATE'\|'OTHER' 중 하나여야 함(아니면 예외). community_posts.last_moderation_policy_code에 그대로 저장 |

**기대 Response**:
```ts
RETURNS text — 갱신된 p_post_id 문자열 그대로 반환. ⚠️프론트는 이 반환값을 사용하지 않고, 성공 시 loadCommunityPost(postId)로 community_posts 행을 재조회하여 CommunityPost를 반환한다(supabase-community-service.ts:259-277).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 성공 시 p_post_id. 프론트 미사용(재조회로 대체) |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 가드: auth.uid() null이면 'unauthenticated', private.is_admin 아니면 'forbidden: admin required', 사유 빈값이면 예외, 알 수 없는 id면 'unknown community post id: %'. SELECT ... FOR UPDATE로 행 잠금. 부수효과: status='hidden', last_moderation_policy_code=p_policy_code, updated_by=caller_id::text, updated_at=now(). admin_audit_logs에 action='post_hidden', target_table='CommunityPost', diff={status:{from,to}}, payload={reason,policy_code,title} 기록. grant execute to authenticated(실권한은 is_admin 게이트).

### `admin_show_community_post` · RPC · rpc
> 🟢 **쉬운 설명**: 숨긴 게시글을 다시 보이게 되돌린다
> 🔵 **돌아오는 값(쉽게)**: 성공 후 게시 상태로 복원된 게시글 정보가 돌아온다

**자세한 목적**: 숨김 게시글을 '게시(published)' 상태로 복원하고 정책 코드를 갱신. 감사 로그(post_shown) 기록.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:259 showCommunityPost — client.rpc('admin_show_community_post', {p_post_id, p_reason, p_policy_code})`
- `src/features/community/pages/community-posts-page.tsx:387 showCommunityPostSafe ({postId, reason, policyCode})`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_post_id` | text | 필수 | 대상 게시글 id |
| `p_reason` | text | 필수 | 운영 사유. 공백 불가(서버/프론트 검증) |
| `p_policy_code` | text | - | 정책 코드. null 허용, 값 있으면 허용 6종만. last_moderation_policy_code에 저장(복원 시에도 코드를 덮어씀) |

**기대 Response**:
```ts
RETURNS text — p_post_id 반환. ⚠️프론트 미사용, 성공 후 loadCommunityPost(postId) 재조회 결과(CommunityPost)를 반환(supabase-community-service.ts:259-277).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 성공 시 p_post_id. 프론트는 재조회로 갱신된 행 사용 |

**비고(권한·예외)**: admin_hide_community_post와 동일 가드/구조. 차이는 status='published'로 설정하는 점. admin_audit_logs action='post_shown', diff={status:{from,to}}, payload={reason,policy_code,title}. SECURITY DEFINER, grant to authenticated.

### `admin_delete_community_post` · RPC · rpc
> 🟢 **쉬운 설명**: 게시글을 완전히 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 게시글의 마지막 정보가 돌아온다

**자세한 목적**: 게시글을 영구 삭제(하드 delete). 삭제 전 감사 로그(post_deleted)를 기록. 연결된 admin_notes는 FK on delete cascade로 함께 삭제됨.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:299 deleteCommunityPost — client.rpc('admin_delete_community_post', {p_post_id, p_reason})`
- `src/features/community/pages/community-posts-page.tsx:397 deleteCommunityPostSafe (actionState.post.id, reason)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_post_id` | text | 필수 | 삭제 대상 게시글 id |
| `p_reason` | text | 필수 | 운영 사유. 공백 불가. (정책 코드 파라미터 없음 — 이 RPC만 인자 2개) |

**기대 Response**:
```ts
RETURNS text — 삭제된 p_post_id 반환. ⚠️프론트는 RPC 호출 '직전에' loadCommunityPost로 대상 행을 미리 읽어두고(target), 삭제 성공 후 그 사전 스냅샷(target)을 CommunityPost로 반환한다(행이 이미 삭제되어 재조회 불가, supabase-community-service.ts:299-317).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 성공 시 p_post_id. 프론트는 삭제 직전 스냅샷을 반환 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/사유 빈값/unknown id. SELECT ... FOR UPDATE로 잠금 후, delete 전에 admin_audit_logs action='post_deleted', target_table='CommunityPost', diff={deleted:{from:false,to:true}}, payload={reason,title} 먼저 기록 → 이후 DELETE 실행. cascade로 community_post_admin_notes 동반 삭제, community_reports.target_post_id는 set null. grant to authenticated.

### `admin_add_community_post_memo` · RPC · rpc
> 🟢 **쉬운 설명**: 게시글에 관리자 메모를 남긴다
> 🔵 **돌아오는 값(쉽게)**: 메모가 추가된 게시글 정보가 돌아온다

**자세한 목적**: 게시글에 관리자 메모(community_post_admin_notes)를 추가. 메모 id를 서버에서 자동 생성하고 게시글 updated_at/by를 갱신, 감사 로그(post_memo_added)를 남긴다.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:319 addCommunityPostMemo — client.rpc('admin_add_community_post_memo', {p_post_id, p_memo:{title,type,author_id,author_name,content}, p_reason: content})`
- `src/features/community/pages/community-posts-page.tsx:484 addCommunityPostMemoSafe ({postId,title,type,authorId,authorName,content})`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_post_id` | text | 필수 | 메모를 달 게시글 id |
| `p_memo` | jsonb | 필수 | 메모 객체. 필드: title(필수, 공백불가), content(필수, 공백불가), type(선택, 빈값이면 '기타' 기본; CHECK: SPAM/욕설·혐오/성인·불법/광고·홍보/개인정보 노출/중복 게시/기타 한글값), author_id(선택, 빈값이면 caller uid), author_name(선택, 빈값이면 '관리자'). 프론트는 {title,type,author_id,author_name,content}로 전달 |
| `p_reason` | text | - | default null. 프론트는 메모 content를 그대로 p_reason으로도 전달. 감사 payload.reason에 기록(빈값이면 null) |

**기대 Response**:
```ts
RETURNS text — 새로 생성된 메모 id(v_note_id, '<postId>-MEMO-NN' 형식, next_community_post_admin_note_id로 생성). ⚠️프론트는 반환 id를 쓰지 않고 loadCommunityPost(postId)로 게시글을 재조회하여 갱신된 adminNotes 포함 CommunityPost를 반환(supabase-community-service.ts:319-342).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성된 메모 id 예: POST-002-MEMO-03. 프론트는 재조회로 대체 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden, p_memo->>'title' 빈값이면 'memo title required', content 빈값이면 'memo content required', unknown id 예외. 부수효과: community_post_admin_notes insert + community_posts.updated_by/updated_at 갱신(status 변경 없음). admin_audit_logs action='post_memo_added', payload={reason,memo_id,memo_title,memo_type}. type/author 기본값 보정은 서버에서 수행. grant to authenticated.

### `admin_resolve_community_report` · RPC · rpc
> 🟢 **쉬운 설명**: 신고를 처리완료로 바꾸고 조치를 기록한다
> 🔵 **돌아오는 값(쉽게)**: 처리 완료된 신고 정보가 돌아온다

**자세한 목적**: 신고를 처리완료(resolved)로 전환하고 조치(action)를 기록. action='hide_post'이고 대상 게시글이 있으면 해당 게시글을 숨김 처리까지 수행. 감사 로그(report_resolved) 기록.

**사용 위치**:
- `src/features/community/api/supabase-community-service.ts:344 resolveCommunityReport — client.rpc('admin_resolve_community_report', {p_report_id, p_action, p_reason})`
- `src/features/community/pages/community-reports-page.tsx:206 resolveCommunityReportSafe (reportId, action, reason)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_report_id` | text | 필수 | 처리할 신고 id (예: RP-001) |
| `p_action` | text | 필수 | 조치 종류. 'hide_post'\|'suspend_user'\|'dismiss' 중 하나(아니면 'invalid report action' 예외). 프론트 기본값 'hide_post' |
| `p_reason` | text | 필수 | 운영 사유. 공백 불가(프론트 기본 '신고 처리') |

**기대 Response**:
```ts
RETURNS text — p_report_id 반환. ⚠️프론트 미사용, 성공 후 loadCommunityReport(reportId)로 community_reports 행을 재조회하여 CommunityReport를 반환(supabase-community-service.ts:344-361).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 성공 시 p_report_id. 프론트는 재조회로 갱신된 신고 행 사용 |

**비고(권한·예외)**: SECURITY DEFINER. 가드: unauthenticated/forbidden/사유 빈값/action 화이트리스트/unknown id. 부수효과: community_reports를 process_status='resolved', resolution_action=p_action, resolved_by=caller uid, resolved_at=now()로 갱신. action='hide_post' AND target_post_id 존재 시 community_posts.status='hidden' + last_moderation_policy_code=coalesce(report.reason_code,'OTHER')로 동반 갱신. ⚠️STUB: p_action='suspend_user'는 회원 정지를 실제 수행하지 않고 감사 payload.user_suspend_integration='intent_only_v13_admin_set_user_status_pending' 로만 의도 기록(v13 연동 미배선). admin_audit_logs action='report_resolved', diff={process_status:{from,to}}, payload={action,reason,affected_post_id,affected_user_id,user_suspend_integration}. grant to authenticated.

## message + auth-email (인증메일 템플릿)
_관리자가 가입 인증메일 등 시스템 메일의 템플릿을 편집하고, 실제 메일 발송 설정(Supabase)에 적용(동기화)하는 영역입니다._

### `auth_email_templates` · 테이블 · select
> 🟢 **쉬운 설명**: 회원가입 등에 쓰는 인증 메일 6종의 편집 내용과 상태를 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 메일 제목, 본문, 작성 상태, 동기화 상태가 담긴 목록(또는 한 건)이 돌아온다

**자세한 목적**: Supabase Auth 인증 메일 6종(가입인증/매직링크/비밀번호재설정/이메일변경/초대/재인증)의 편집본 + 동기화 상태를 읽는 테이블. 관리자 화면(/messages/mail 인증 메일 탭)이 목록/단건 조회에 사용한다. 쓰기는 PostgREST가 아니라 RPC 단일 경로로만 일어난다(테이블에 admin select RLS만 있고 insert/update/delete 정책 없음).

**사용 위치**:
- `src/features/message/api/supabase-auth-email-service.ts:57 listSupabaseAuthEmailTemplates() — .from('auth_email_templates').select(COLUMNS) 전체 목록`
- `src/features/message/api/supabase-auth-email-service.ts:68 loadOne(authType) — .select(COLUMNS).eq('auth_type', authType).maybeSingle() 저장/동기화 후 재조회`
- `api/auth-email/sync.ts:101 서버 — .from('auth_email_templates').select('subject, body_html').eq('auth_type', authType).maybeSingle() (편집 SoT 읽기, service-role 클라이언트)`
- `src/features/message/pages/auth-email-panel.tsx:101 reload() → fetchAuthEmailTemplatesSafe() 화면 진입 시 목록 로드`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | 프론트가 고정 컬럼 세트만 select: id, auth_type, subject, body_html, status, sync_status, synced_at, sync_error, last_live_checked_at, updated_at. (서버 /api/auth-email/sync 내부에서는 subject, body_html 만 select.) |
| `.eq('auth_type', authType)` | filter | - | 단건 조회 시 auth_type으로 필터 후 .maybeSingle(). authType ∈ confirmation\|magic_link\|recovery\|email_change\|invite\|reauthentication |

**기대 Response**:
```ts
Row[] (또는 maybeSingle 시 Row|null). DB 컬럼(select 한 것만): { id: uuid(string), auth_type: text, subject: text(default ''), body_html: text(default ''), status: text('draft'|'ready'|'published'|'archived'), sync_status: text('draft'|'synced'|'error'|'drift'|'conflict'), synced_at: timestamptz|null, sync_error: text|null, last_live_checked_at: timestamptz|null, updated_at: timestamptz }. 프론트 mapRow가 이를 AuthEmailTemplate으로 매핑: { id:string, authType:AuthEmailType, subject:string, bodyHtml:string, status:AuthEmailStatus, syncStatus:AuthEmailSyncStatus, syncedAt?:string, syncError?:string, lastLiveCheckedAt?:string, updatedAt?:string }. ⚠️ timestamptz는 프론트에서 toDateTime()으로 ISO 문자열 앞 16자만 잘라 'YYYY-MM-DD HH:mm' 텍스트로 변환(KST 변환 아님, 그냥 슬라이스). 목록은 AUTH_EMAIL_TYPE_ORDER 순서로 클라이언트 정렬.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 행 PK (gen_random_uuid 기본값) |
| `auth_type` | text | 인증 메일 유형(unique). 6종 체크 제약: confirmation/magic_link/recovery/email_change/invite/reauthentication |
| `subject` | text | 메일 제목. default '' |
| `body_html` | text | 메일 본문 HTML. default '', octet_length <= 102400(100KB, Gmail clipping 가드) 제약 |
| `status` | text | 편집 상태: draft/ready/published/archived |
| `sync_status` | text | 동기화 상태: draft(미동기화)/synced/error/drift(라이브가 편집본과 불일치)/conflict |
| `synced_at` | timestamptz\|null | 최근 성공 동기화 시각. 프론트는 16자 슬라이스 텍스트로 노출 |
| `sync_error` | text\|null | 마지막 동기화 실패 메시지 |
| `last_live_checked_at` | timestamptz\|null | Management API GET으로 live 상태 마지막 확인 시각 |
| `updated_at` | timestamptz | 행 갱신 시각 |

**비고(권한·예외)**: RLS: enable + FORCE row level security. select 정책 auth_email_templates_admin_select = `for select to authenticated using (private.is_admin(auth.uid()))` — 관리자(content_admin/platform_admin = private.is_admin 집합)만 읽기. INSERT/UPDATE/DELETE 정책 없음 → PostgREST 직접 쓰기 불가, 모든 쓰기는 SECURITY DEFINER RPC 경유. 추가 DB 전용 컬럼(프론트가 select 안 함): body_json jsonb, local_hash text(md5(subject||\n||body_html)), last_synced_live_hash text, last_live_hash text, last_live_snapshot jsonb, synced_by uuid, updated_by uuid, created_at timestamptz. ⚠️ dev DB는 2026-06-22 전면 TRUNCATE됨(스키마/시드 마이그레이션은 유지되나 데이터는 재적용 필요). 시드: 6종 빈 템플릿(subject/body_html='') on conflict do nothing.

### `admin_save_auth_email_template` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 인증 메일 한 종류의 제목과 본문을 저장한다
> 🔵 **돌아오는 값(쉽게)**: 저장된 메일 한 건의 내용이 돌아온다(본문을 바꾸면 다시 동기화하기 전까지 발송에 반영 안 됨)

**자세한 목적**: 인증 메일 템플릿 1종(auth_type 단위)을 upsert 저장하는 쓰기 RPC. 본문(subject/body_html)이 바뀌면 sync_status를 draft로 되돌려 '동기화 전까지 발송 미반영' 상태를 강제한다. admin_audit_logs에 사유와 함께 감사 기록을 남기는 쓰기 단일 경로.

**사용 위치**:
- `src/features/message/api/supabase-auth-email-service.ts:97 saveSupabaseAuthEmailTemplate() — client.rpc('admin_save_auth_email_template', { p_auth_type, p_template:{subject,body_html,(status)}, p_reason })`
- `src/features/message/api/auth-email-service.ts:42 saveAuthEmailTemplate() 파사드(useSupabase 분기) → saveAuthEmailTemplateSafe()`
- `src/features/message/pages/auth-email-panel.tsx:148 handleSave() — '저장' 및 '저장 후 동기화' 버튼. 후자는 status:'ready'로 저장 후 sync 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_auth_type` | text | 필수 | 6종 중 하나. 그 외 값은 'invalid auth_type' 예외 |
| `p_template` | jsonb | 필수 | { subject?:string, body_html?:string, status?:string, body_json?:jsonb }. 프론트는 { subject, body_html, (status) }만 보냄(body_json 미전송). subject/body_html 누락 시 coalesce로 '' 처리. status는 있을 때만 검증(draft/ready/published/archived) |
| `p_reason` | text | 필수 | 운영 사유. 공백/빈문자는 'reason required' 예외. 프론트 requireReason()이 클라이언트에서도 선검증 |

**기대 Response**:
```ts
returns uuid — upsert된 행의 id 한 개(스칼라). ⚠️ 갱신된 행 전체를 반환하지 않음. 프론트(saveSupabaseAuthEmailTemplate)는 이 uuid를 무시하고 직후 loadOne(authType)으로 테이블을 다시 select 해서 AuthEmailTemplate을 만들어 반환한다. 따라서 화면이 받는 최종 shape는 auth_email_templates 행 매핑 결과와 동일.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(uuid)` | uuid | upsert RETURNING id. 프론트는 사용하지 않고 재조회로 대체 |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 가드: auth.uid() null → 'unauthenticated'; private.is_admin(caller) 아니면 'forbidden: admin required'; p_reason 빈값 'reason required'; auth_type 6종 외 예외; octet_length(body_html)>102400 'body_html too large (>100KB)'; status 화이트리스트 외 예외. 동작: 행 FOR UPDATE 잠금 → v_local_hash=md5(subject||chr(10)||body_html) 계산 → sync_status는 v_old.last_synced_live_hash와 local_hash가 같으면 'synced' 아니면 'draft'(즉 본문 변경=draft 강등). on conflict(auth_type) do update로 upsert. updated_by=caller, updated_at=now(). 감사: admin_audit_logs(action='auth_email_template_saved', target_table='AuthEmailTemplate', target_id=auth_type, diff={subject:{from,to}, body_changed:bool}, payload={reason, auth_type, status}). grant execute to authenticated(가드는 함수 내부). mock 경로(saveMockAuthEmailTemplate)는 항상 sync_status='draft'로 리셋하며 동일 모델 반환.

### `admin_mark_auth_email_synced` · RPC · rpc
> 🟢 **쉬운 설명**: 편집한 인증 메일을 실제 메일 시스템에 반영한 결과를 기록한다
> 🔵 **돌아오는 값(쉽게)**: 동기화 결과(성공/실패)가 반영된 메일 한 건의 내용이 돌아온다

**자세한 목적**: 서버 /api/auth-email/sync가 Management API로 실제 PATCH+GET 검증을 끝낸 뒤, 그 결과(성공/실패)를 DB에 감사 기록하는 RPC. 성공 시 sync_status를 synced(또는 live가 편집본과 다르면 drift)로, 실패 시 error로 기록한다. 성공/실패 모두 호출되는 단일 감사 경로.

**사용 위치**:
- `src/features/message/api/supabase-auth-email-service.ts:145 syncSupabaseAuthEmailTemplate() — fetch('/api/auth-email/sync') 결과를 받아 client.rpc('admin_mark_auth_email_synced', { p_auth_type, p_result:{ok,live_hash,snapshot,error}, p_reason }) (성공/실패 모두 호출)`
- `src/features/message/api/auth-email-service.ts:50 syncAuthEmailTemplate() 파사드 → syncAuthEmailTemplateSafe()`
- `src/features/message/pages/auth-email-panel.tsx:162 handleSave(alsoSync=true) 및 :195 handleSync() — '저장 후 동기화' / '동기화' 모달`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_auth_type` | text | 필수 | 6종 중 하나. 행이 없으면 'unknown auth_type' 예외(not found) |
| `p_result` | jsonb | 필수 | { ok:boolean, live_hash:text\|null, snapshot:jsonb\|null, error:text\|null }. 프론트가 서버 응답으로부터 조립: ok = httpOk && result.ok; live_hash=result.live_hash; snapshot=result.snapshot; error=result.error 또는 `HTTP <status>` |
| `p_reason` | text | 필수 | 운영 사유. 빈값 'reason required' 예외 |

**기대 Response**:
```ts
returns uuid — 갱신된 행의 id 한 개(스칼라). ⚠️ 행 전체 미반환. 프론트는 RPC 성공 후(실패 시 throw) loadOne(authType)으로 재조회하여 AuthEmailTemplate을 반환한다.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(uuid)` | uuid | UPDATE RETURNING id. 프론트는 사용하지 않고 재조회로 대체 |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 가드: unauthenticated/forbidden(private.is_admin)/reason required/invalid auth_type, 행 없으면 'unknown auth_type'. 파싱: v_ok=(p_result->>'ok')::bool default false; v_live_hash, v_error는 btrim+nullif. 성공(v_ok) 분기: sync_status = live_hash null이거나 live_hash==local_hash면 'synced', 아니면 'drift'(거짓 synced 방지). update set synced_at=now(), synced_by=caller, last_synced_live_hash=coalesce(live_hash,local_hash), last_live_hash=동일, last_live_snapshot=coalesce(p_result->'snapshot', 기존), last_live_checked_at=now(), sync_error=null, status= status in (draft,ready)면 'published'로 승격, updated_by/at. 실패 분기: sync_status='error', sync_error=v_error, last_live_checked_at=now(). 감사: admin_audit_logs(action= v_ok?'auth_email_synced':'auth_email_sync_failed', target_table='AuthEmailTemplate', target_id=auth_type, diff={sync_status:{from,to}}, payload={reason, auth_type, ok, error}). grant execute to authenticated. mock 경로(markMockAuthEmailSynced)는 항상 synced+published 승격 시뮬레이션, syncedAt='동기화(mock)'.

### `POST /api/auth-email/sync` · 라우트 · POST
> 🟢 **쉬운 설명**: 관리자가 편집한 인증 메일을 실제 발송 시스템에 적용한다
> 🔵 **돌아오는 값(쉽게)**: 적용 성공 여부와 이전 내용(되돌리기용 백업)이 돌아온다

**자세한 목적**: 관리자가 편집한 인증 메일 템플릿(auth_email_templates의 DB 편집본)을 Supabase Auth 내장 템플릿에 실제로 push 동기화하는 서버 엔드포인트. Management API 토큰/Service Role 키는 서버 전용이므로 브라우저는 자신의 access_token만 Bearer로 전달한다. 흐름: 관리자 JWT 검증 → profiles.app_role 게이트 → DB 템플릿 읽기 → Management API GET(롤백 스냅샷) → PATCH(mailer_subjects/templates_content) → GET 재검증(live==푸시값). 실제 DB 기록은 호출 측이 admin_mark_auth_email_synced로 수행.

**사용 위치**:
- `api/auth-email/sync.ts:46 syncAuthEmailTemplate(request) — 엔드포인트 본체`
- `api/auth-email/sync.ts:195 POST / :199 default export fetch — POST만 허용, 그 외 405`
- `src/features/message/api/supabase-auth-email-service.ts:130 호출 측 fetch('/api/auth-email/sync', { method:'POST', headers:{Content-Type, Authorization:Bearer <access_token>}, body: JSON.stringify({auth_type, reason}) })`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `Authorization` | header | 필수 | `Bearer <supabase access_token>` — 브라우저 세션 토큰. 없으면 401 unauthenticated |
| `Content-Type` | header | 필수 | application/json |
| `auth_type` | string (body) | 필수 | 6종 중 하나(confirmation\|magic_link\|recovery\|email_change\|invite\|reauthentication). 그 외 400 invalid_auth_type |
| `reason` | string (body) | - | 프론트는 보내지만 서버는 본문에서 읽지 않음(감사 사유는 브라우저가 admin_mark_auth_email_synced로 별도 기록). 서버 동작에는 영향 없음 |

**기대 Response**:
```ts
200 OK: { ok: boolean, snapshot: { mailer_subjects_<authType>: <prev>|null, mailer_templates_<authType>_content: <prev>|null }|null, error?: string }. ok=true는 PATCH 후 GET 재검증에서 live subject/body가 푸시값과 정확히 일치할 때만. live 불일치 시 200이지만 ok:false + error:'live config does not match pushed template'(+snapshot). 에러 응답(모두 { ok:false, error:string }, 일부는 snapshot 포함): 500 server_misconfigured | 500 management_token_missing | 401 unauthenticated | 401 invalid_session | 500 role_check_failed | 403 forbidden | 400 bad_request | 400 invalid_auth_type | 500 template_read_failed | 404 template_not_found | 400 template_empty | 502 management_get_failed/management_get_error | 502 management_patch_failed/management_patch_error(+snapshot) | 502 management_verify_failed/management_verify_error(+snapshot). 405 Method Not Allowed(POST 외, { error, allow:['POST'] } + Allow 헤더).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `ok` | boolean | PATCH 후 GET 재검증에서 live subject==pushed subject AND live body==pushed body 일 때만 true |
| `snapshot` | object\|null | PATCH 직전 GET으로 캡처한 롤백용 live 값: { mailer_subjects_<authType>, mailer_templates_<authType>_content }. PATCH/verify 단계 실패 응답에도 포함될 수 있음 |
| `error` | string? | 실패 사유 코드/메시지. ok=true면 undefined. Management 오류는 status+본문 앞 200자 스니펫 포함 |

**비고(권한·예외)**: 런타임: Web Fetch 핸들러(export function POST(request: Request) + default { fetch }). 비-Next 표준 Request/Response(Response.json). 보안 게이트: ① Bearer 토큰 추출 → service-role 클라이언트로 supabase.auth.getUser(token) → userId 검증 ② profiles.select('app_role').eq('id',userId).maybeSingle() → ADMIN_ROLES=Set{content_admin, platform_admin} 포함해야 통과(아니면 403 forbidden). private.is_admin과 동일 집합이라 명시. env 의존: SUPABASE_URL|VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY, SUPABASE_MANAGEMENT_API_TOKEN|SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF(기본 'fglggyfvzjdsbyckinqa'). Management 엔드포인트: GET/PATCH https://api.supabase.com/v1/projects/<ref>/config/auth, 키 = mailer_subjects_<authType> / mailer_templates_<authType>_content. ⚠️ 토큰/시크릿은 응답·로그에 노출 금지(설계 명시). dev SMTP 미설정 시 실수신(G2) 검증 차단(메모리). 단순 push만 하고 롤백은 자동 수행 안 함(snapshot은 수동 롤백 자료).

## operation (공지/FAQ/약관/이벤트)
_관리자가 공지사항·FAQ·이용약관·이벤트를 등록하고 노출/발행 상태를 관리하는 영역입니다. 약관은 버전을 발행하면 사용자 앱에도 반영됩니다._

### `operation_notices` · 테이블 · select
> 🟢 **쉬운 설명**: 공지사항 목록과 내용을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 공지 제목, 본문, 게시/숨김 상태, 작성자 정보가 돌아온다

**자세한 목적**: 공지사항 SoT 테이블. 목록/단건 읽기 전용(쓰기는 RPC 단일 경로). status는 published/hidden ASCII 저장, UI는 게시/숨김으로 매핑.

**사용 위치**:
- `src/features/operation/api/supabase-operation-notices-service.ts:71 loadOperationNotices (목록 select)`
- `src/features/operation/api/supabase-operation-notices-service.ts:88 loadOperationNotice (단건 maybeSingle)`
- `src/features/operation/pages/operation-notices-page.tsx 목록 화면`
- `src/features/operation/pages/operation-notice-create-page.tsx 단건 편집`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, title, body_html, status, author, created_at, updated_at, updated_by |
| `order` | string | - | 목록은 created_at desc |
| `eq.id` | string | - | 단건은 id로 maybeSingle |

**기대 Response**:
```ts
OperationNoticeRow { id: string; title: string; body_html: string; status: 'published'|'hidden'; author: string; created_at: string|null (timestamptz ISO); updated_at: string|null; updated_by: string|null } — 프론트는 mapNoticeRow로 OperationNotice{ id,title,author,createdAt(YYYY-MM-DD),status('게시'|'숨김'),bodyHtml,updatedAt(YYYY-MM-DD HH:mm),updatedBy }로 변환. createdAt=created_at 앞 10자, updatedAt=updated_at 앞16자 T→공백.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | string | published/hidden ASCII. 알 수 없는 값은 프론트에서 '숨김'으로 폴백 |
| `updated_by` | string\|null | null이면 프론트는 author로 폴백. RPC는 caller uuid를 text로 기록 |

**비고(권한·예외)**: RLS: SELECT는 authenticated AND private.is_admin(auth.uid())만. force row level security. INSERT/UPDATE/DELETE 정책 없음 → 직접 쓰기 불가, RPC만. PK는 text('NOTICE-NNN'). 정의: supabase/migrations-admin/20260617120000_operation_notices.sql:13

### `admin_save_operation_notice` · RPC · rpc
> 🟢 **쉬운 설명**: 공지사항을 새로 만들거나 내용을 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 공지의 번호가 돌아온다(이걸로 다시 불러와 화면에 보여준다)

**자세한 목적**: 공지 생성/수정 단일 write 경로. p_id 없으면 신규(NOTICE-NNN 자동 채번, status='hidden'), 있으면 수정. 감사 로그(notice_saved) 적재.

**사용 위치**:
- `src/features/operation/api/supabase-operation-notices-service.ts:118 saveOperationNotice`
- `src/features/operation/pages/operation-notice-create-page.tsx:135 saveNoticeSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 공지 id. null/빈문자면 신규 생성 |
| `p_notice` | jsonb | 필수 | { title: string(필수, 공백불가), body_html: string(필수, 공백불가) } |
| `p_reason` | text | 필수 | 운영 사유. 공백 불가(프론트 requireReason). 감사 payload.reason에 기록 |

**기대 Response**:
```ts
text — 저장된 공지 id (예: 'NOTICE-003'). 프론트는 이 id로 loadOperationNotice 재조회하여 OperationNotice를 화면에 반영.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성/수정된 notice id 문자열 |

**비고(권한·예외)**: SECURITY DEFINER, search_path=pg_catalog,public. 가드: caller_id null→'unauthenticated', not private.is_admin→'forbidden: admin required', 빈 reason→'reason required'. title null→'title required', body_html 공백→'body_html required'. 신규는 status 강제 'hidden'(노출은 toggle로). updated_by=caller uuid::text. grant execute to authenticated. 정의: 20260617120000_operation_notices.sql:71

### `admin_toggle_operation_notice_status` · RPC · rpc
> 🟢 **쉬운 설명**: 공지를 게시 상태와 숨김 상태로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 바뀐 공지 번호가 돌아온다(다시 불러와 화면에 반영한다)

**자세한 목적**: 공지 노출 상태 전환(게시↔숨김). 동일 상태로의 전환은 거부. 감사 로그(notice_status_changed).

**사용 위치**:
- `src/features/operation/api/supabase-operation-notices-service.ts:145 setOperationNoticeStatus`
- `src/features/operation/pages/operation-notices-page.tsx:329 toggleNoticeStatusSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_notice_id` | text | 필수 | 대상 공지 id |
| `p_next_status` | text | 필수 | 'published' 또는 'hidden' (UI 게시/숨김을 프론트가 매핑) |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
text — 대상 notice id. 프론트는 반환 무시하고 loadOperationNotice로 재조회한 OperationNotice를 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | notice id |

**비고(권한·예외)**: p_next_status not in (published,hidden)→'invalid status'. 이미 같은 상태면 'notice already %' 예외. unknown id→'unknown notice id'. is_admin 가드. 정의: 20260617120000_operation_notices.sql:167

### `admin_delete_operation_notice` · RPC · rpc
> 🟢 **쉬운 설명**: 공지사항을 완전히 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 공지 번호와 삭제 직전 내용이 돌아온다

**자세한 목적**: 공지 영구 삭제(hard delete). 삭제 전 스냅샷을 감사 payload(notice_deleted)에 기록.

**사용 위치**:
- `src/features/operation/api/supabase-operation-notices-service.ts:159 deleteOperationNotice`
- `src/features/operation/pages/operation-notices-page.tsx:290 deleteNoticeSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_notice_id` | text | 필수 | 삭제 대상 공지 id |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
text — 삭제된 notice id. 프론트는 삭제 직전 loadOperationNotice로 받아둔 OperationNotice 스냅샷을 반환(삭제 후 재조회 아님).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 삭제된 notice id |

**비고(권한·예외)**: DELETE 후 admin_audit_logs에 title/status/author/created_at/updated_at 보존. unknown id→예외. is_admin 가드. 프론트는 RPC 호출 전에 단건을 미리 읽어 반환값으로 쓰므로 RPC 자체는 id만 반환. 정의: 20260617120000_operation_notices.sql:221

### `operation_faqs` · 테이블 · select
> 🟢 **쉬운 설명**: 자주 묻는 질문 목록과 내용을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 질문, 답변, 검색어, 분류, 공개/비공개 상태가 돌아온다

**자세한 목적**: FAQ 원문 SoT. 목록/단건 읽기. category는 한글 enum(계정/결제/커뮤니티/메시지), status는 published/hidden.

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:201 loadOperationFaqs`
- `src/features/operation/api/supabase-operation-faqs-service.ts:218 loadOperationFaq`
- `src/features/operation/pages/operation-faq-page.tsx FAQ 화면`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, question, answer, search_keywords, category, status, created_at, updated_at, updated_by |
| `order` | string | - | 목록은 created_at desc |

**기대 Response**:
```ts
OperationFaqRow { id: string; question: string; answer: string; search_keywords: jsonb(string[]); category: '계정'|'결제'|'커뮤니티'|'메시지'; status: 'published'|'hidden'; created_at/updated_at: string|null; updated_by: string|null } → OperationFaq{ id,question,answer,searchKeywords:string[],category,status('공개'|'비공개'),createdAt,updatedAt,updatedBy }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `search_keywords` | jsonb array | 문자열 배열만 유효. 프론트는 비문자 항목 필터링 |
| `status` | string | published→공개, hidden→비공개 |

**비고(권한·예외)**: RLS: admin SELECT only, force RLS. CHECK: category in (계정/결제/커뮤니티/메시지), status in (published/hidden), search_keywords jsonb array. PK text('FAQ-NNN'). 정의: supabase/migrations-admin/20260617123000_operation_faqs.sql:13

### `operation_faq_curations` · 테이블 · select
> 🟢 **쉬운 설명**: 화면별 대표 FAQ 노출 규칙을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 어느 화면에 몇 번째로 보일지, 노출 여부, 고정 기간이 돌아온다

**자세한 목적**: FAQ 대표 노출(큐레이션) 규칙 SoT. surface별 표시 순위/노출 상태/고정 기간 관리. surface+display_rank 전역 유니크.

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:237 loadOperationFaqCurations`
- `src/features/operation/api/supabase-operation-faqs-service.ts:257 loadOperationFaqCuration`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, faq_id, surface, curation_mode, display_rank, exposure_status, pinned_start_at, pinned_end_at, updated_at, updated_by |
| `order` | string | - | surface asc, display_rank asc |

**기대 Response**:
```ts
OperationFaqCurationRow { id: string; faq_id: string; surface: 'help_center'|'home_top'|'payment_help'|'onboarding'; curation_mode: 'manual'|'auto'; display_rank: number(smallint>0); exposure_status: 'active'|'paused'; pinned_start_at: date|null; pinned_end_at: date|null; updated_at: string|null; updated_by: string|null } → OperationFaqCuration{ id,faqId,surface,curationMode,displayRank,exposureStatus,pinnedStartAt(YYYY-MM-DD|null),pinnedEndAt,updatedAt,updatedBy }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `pinned_start_at/pinned_end_at` | date\|null | 프론트는 앞 10자 날짜 또는 null |
| `display_rank` | smallint | 양수만. surface 내 유니크 |

**비고(권한·예외)**: RLS: admin SELECT only. FK faq_id→operation_faqs(on delete cascade). UNIQUE(surface,display_rank). CHECK pinned_start_at<=pinned_end_at. 정의: 20260617123000_operation_faqs.sql:53

### `operation_faq_metrics` · 테이블 · select
> 🟢 **쉬운 설명**: FAQ가 얼마나 조회·검색·도움됐는지 수치를 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 조회수, 검색 노출수, 도움/도움안됨 수, 마지막 조회 시각이 돌아온다

**자세한 목적**: FAQ 조회/검색/도움 카운트 read-model. 관리자 write RPC 없음(시드+읽기 전용 표시용).

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:276 loadOperationFaqMetrics`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | faq_id, view_count, search_hit_count, helpful_count, not_helpful_count, last_viewed_at |
| `order` | string | - | faq_id asc |

**기대 Response**:
```ts
OperationFaqMetricRow { faq_id: string; view_count: number; search_hit_count: number; helpful_count: number; not_helpful_count: number; last_viewed_at: string|null } → OperationFaqMetric{ faqId,viewCount,searchHitCount,helpfulCount,notHelpfulCount,lastViewedAt(YYYY-MM-DD HH:mm|null) }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `last_viewed_at` | timestamptz\|null | 프론트는 앞16자 T→공백 또는 null |

**비고(권한·예외)**: READ-ONLY 표시용 read model. 전용 write RPC 미존재(migration seed/read only 명시). PK=faq_id(FK on delete cascade). 모든 카운트 >=0 CHECK. 정의: 20260617123000_operation_faqs.sql:109

### `admin_save_operation_faq` · RPC · rpc
> 🟢 **쉬운 설명**: 자주 묻는 질문을 새로 만들거나 내용을 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 질문의 번호가 돌아온다(이걸로 다시 불러온다)

**자세한 목적**: FAQ 원문 생성/수정. 신규는 FAQ-NNN 채번+status='hidden'. 수정 시 status='hidden'으로 바꾸면 연결 큐레이션을 paused로 강제. 감사(faq_saved).

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:307 saveOperationFaq`
- `src/features/operation/pages/operation-faq-page.tsx:859 saveFaqSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 id. null/빈문자면 신규 |
| `p_faq` | jsonb | 필수 | { question:string(필수), answer:string(필수), search_keywords:string[](array), category:'계정'\|'결제'\|'커뮤니티'\|'메시지'(필수), status:'published'\|'hidden'(기본 hidden) } |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
text — 저장된 FAQ id (예: 'FAQ-004'). 프론트는 이 id로 loadOperationFaq 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | FAQ id |

**비고(권한·예외)**: 가드: is_admin, reason, question/answer 필수, search_keywords jsonb array 검증, category enum 검증('invalid category'), status enum 검증. 수정 시 status=hidden이면 operation_faq_curations.exposure_status를 paused로 일괄 변경. SECURITY DEFINER. 정의: 20260617123000_operation_faqs.sql:241

### `admin_toggle_operation_faq_status` · RPC · rpc
> 🟢 **쉬운 설명**: FAQ를 공개 상태와 비공개 상태로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 바뀐 질문 번호가 돌아온다(다시 불러와 화면에 보여준다)

**자세한 목적**: FAQ 공개/비공개 전환. hidden 전환 시 active 큐레이션을 paused로 일괄 변경하고 paused된 id 목록을 감사 payload(faq_status_changed)에 기록.

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:338 setOperationFaqStatus`
- `src/features/operation/pages/operation-faq-page.tsx:1037 toggleFaqStatusSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_faq_id` | text | 필수 | 대상 FAQ id |
| `p_next_status` | text | 필수 | 'published'\|'hidden' |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — FAQ id. 프론트는 loadOperationFaq로 재조회한 OperationFaq 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | FAQ id |

**비고(권한·예외)**: 이미 같은 상태면 'faq already %' 예외. invalid status 예외. hidden 전환 시 큐레이션 cascade paused. 감사 payload.paused_curation_ids는 jsonb 배열. 정의: 20260617123000_operation_faqs.sql:380

### `admin_delete_operation_faq` · RPC · rpc
> 🟢 **쉬운 설명**: 자주 묻는 질문을 완전히 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 질문 번호와 삭제 직전 내용이 돌아온다

**자세한 목적**: FAQ 영구 삭제(연결 큐레이션/메트릭은 FK cascade). 삭제 전 큐레이션/메트릭 개수와 스냅샷을 감사(faq_deleted)에 기록.

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:358 deleteOperationFaq`
- `src/features/operation/pages/operation-faq-page.tsx:1005 deleteFaqSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_faq_id` | text | 필수 | 삭제 대상 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 삭제된 FAQ id. 프론트는 삭제 직전 읽어둔 OperationFaq 스냅샷을 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | FAQ id |

**비고(권한·예외)**: FK cascade로 operation_faq_curations/operation_faq_metrics 동시 삭제. 감사에 curation_count/metric_count 기록. unknown id 예외. 정의: 20260617123000_operation_faqs.sql:454

### `admin_save_operation_faq_curation` · RPC · rpc
> 🟢 **쉬운 설명**: 화면별 대표 FAQ 노출 규칙을 만들거나 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 노출 규칙의 번호가 돌아온다(이걸로 다시 불러온다)

**자세한 목적**: FAQ 대표 노출 규칙 생성/수정. 신규는 FAQCUR-NNN 채번. surface+display_rank 중복 거부, 비공개 FAQ는 active 큐레이션 불가. 감사(faq_curation_saved).

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:379 saveOperationFaqCuration`
- `src/features/operation/pages/operation-faq-page.tsx:921 saveFaqCurationSafe`
- `src/features/operation/pages/operation-faq-page.tsx:1116 saveFaqCurationSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 id. null/빈문자면 신규 |
| `p_curation` | jsonb | 필수 | { faq_id:string(필수), surface:'help_center'\|'home_top'\|'payment_help'\|'onboarding', curation_mode:'manual'\|'auto', display_rank:number(smallint>0), exposure_status:'active'\|'paused', pinned_start_at:date\|null(빈문자→null), pinned_end_at:date\|null } |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 저장된 큐레이션 id (예: 'FAQCUR-004'). 프론트는 loadOperationFaqCuration 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | curation id |

**비고(권한·예외)**: 검증: faq_id 필수+존재, surface/mode/exposure enum, display_rank smallint 양수, pinned_start<=end. exposure='active'이고 FAQ status='hidden'이면 'hidden faq cannot have active curation' 예외(프론트 INVALID_STATE 400 매핑). surface/display_rank 중복→'duplicate faq curation surface/display_rank'(프론트 CONFLICT 409 매핑). 정의: 20260617123000_operation_faqs.sql:514

### `admin_delete_operation_faq_curation` · RPC · rpc
> 🟢 **쉬운 설명**: 대표 FAQ 노출 규칙을 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 규칙 번호와 삭제 직전 설정이 돌아온다

**자세한 목적**: FAQ 대표 노출 규칙 삭제. 삭제 전 surface/display_rank/exposure 스냅샷을 감사(faq_curation_deleted)에 기록.

**사용 위치**:
- `src/features/operation/api/supabase-operation-faqs-service.ts:414 deleteOperationFaqCuration`
- `src/features/operation/pages/operation-faq-page.tsx:1079 deleteFaqCurationSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_curation_id` | text | 필수 | 삭제 대상 큐레이션 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 삭제된 curation id. 프론트는 삭제 직전 읽어둔 OperationFaqCuration 스냅샷 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | curation id |

**비고(권한·예외)**: unknown id→'unknown faq curation id'. is_admin 가드. 정의: 20260617123000_operation_faqs.sql:705

### `operation_policies` · 테이블 · select
> 🟢 **쉬운 설명**: 약관·정책 목록과 내용을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 제목, 버전, 시행일, 노출 위치, 동의 필요 여부 등이 한국어·영어로 돌아온다

**자세한 목적**: 정책/약관 SoT(법률/약관, 결제/리워드 등 16종). 다국어(ko 본문 + title_en/body_html_en/summary_en). 읽기 전용, 쓰기는 RPC.

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:316 loadOperationPolicies`
- `src/features/operation/api/supabase-operation-policies-service.ts:333 loadOperationPolicy`
- `src/features/operation/pages/operation-policies-page.tsx 정책 목록`
- `src/features/operation/pages/operation-policy-create-page.tsx 정책 편집`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, category, policy_type, title, version_label, effective_date, exposure_surfaces, requires_consent, tracking_status, status, related_admin_pages, related_user_pages, source_documents, legal_references, summary, body_html, title_en, body_html_en, summary_en, admin_memo, current_version_id, created_at, updated_at, updated_by |
| `order` | string | - | 목록은 created_at desc |

**기대 Response**:
```ts
OperationPolicyRow { id; category; policy_type; title; version_label:string|null; effective_date:date|null; exposure_surfaces:jsonb(string[]); requires_consent:boolean|null; tracking_status:string|null('코드 반영'|'문서 추적'|'정책 미확정'); status:'published'|'hidden'; related_admin_pages/related_user_pages/source_documents/legal_references:jsonb(string[]); summary:string|null; body_html:string; title_en/body_html_en/summary_en:string|null; admin_memo:string|null; current_version_id:string|null; created_at/updated_at; updated_by } → OperationPolicy(camelCase, status '게시'|'숨김').
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `title_en/body_html_en/summary_en` | string\|null | 영문 미러용. 20260622140000 마이그레이션으로 추가된 컬럼 |
| `current_version_id` | string\|null | 최신 history id(PH-NNNN). RPC가 자동 갱신 |
| `tracking_status` | string\|null | 코드반영/문서추적/정책미확정 — 정책 미확정은 STUB 표시용 |

**비고(권한·예외)**: RLS: admin SELECT only, force RLS. category/policy_type/tracking_status/status CHECK(한글 enum). 배열 5종 jsonb array CHECK. PK text('POL-NNN'). title_en 등은 20260622140000_operation_policies_en_content.sql에서 추가(.codex-artifacts/terms/apply-p1.mjs로 dev 적용). 정의: supabase/migrations-admin/20260617170000_operation_policies.sql:11

### `operation_policy_histories` · 테이블 · select
> 🟢 **쉬운 설명**: 약관·정책의 버전별 변경 이력을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 언제 누가 어떻게 바꿨는지와 그때의 내용 스냅샷이 돌아온다

**자세한 목적**: 정책 버전 이력. action별 스냅샷(camelCase OperationPolicy) 보관. 버전 복원(publish version)의 소스.

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:352 loadOperationPolicyHistory`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id, policy_id, action, version_label, changed_at, changed_by, snapshot |
| `eq.policy_id` | string | 필수 | 정책 id로 필터 |
| `order` | string | - | changed_at desc |

**기대 Response**:
```ts
OperationPolicyHistoryRow { id:string; policy_id:string; action:'created'|'updated'|'status_changed'|'version_published'|'deleted'; version_label:string|null; changed_at:string|null; changed_by:string|null; snapshot:jsonb(operation_policy_snapshot camelCase) } → OperationPolicyHistoryEntry{ id,policyId,action,versionLabel,status,trackingStatus,changedAt(YYYY-MM-DD HH:mm),changedBy,note:'',snapshot:OperationPolicy }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `snapshot` | jsonb | operation_policy_snapshot()가 만든 camelCase 객체. updatedAt은 KST(Asia/Seoul) 'YYYY-MM-DD HH24:MI' 텍스트, createdAt은 date 텍스트 |

**비고(권한·예외)**: RLS: admin SELECT only. action CHECK. FK policy_id→operation_policies(on delete cascade). PK text('PH-NNNN'). snapshot 내 updatedAt이 KST 텍스트(to_char at time zone 'Asia/Seoul')인 점 주의. 정의: 20260617170000_operation_policies.sql:35 / snapshot 함수 :103

### `admin_save_operation_policy` · RPC · rpc
> 🟢 **쉬운 설명**: 약관·정책을 새로 만들거나 내용을 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 정책 번호가 돌아온다(이걸로 다시 불러온다)

**자세한 목적**: 정책 생성/수정. 신규는 POL-NNN 채번+status='hidden'. mode='version'이면 수정 시에도 status='hidden'으로 재설정(새 버전 초안). 매 저장마다 history(PH-NNNN) append + current_version_id 갱신. 감사(policy_saved).

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:373 saveOperationPolicy`
- `src/features/operation/pages/operation-policy-create-page.tsx:951 savePolicySafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 id. null/빈문자면 신규 |
| `p_policy` | jsonb | 필수 | { category(필수 enum), policy_type(필수 enum), title(필수), version_label, effective_date(date\|''), exposure_surfaces:string[], requires_consent:boolean, tracking_status, related_admin_pages/related_user_pages/source_documents/legal_references:string[], summary, body_html, admin_memo, mode:'create'\|'edit'\|'version' } |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 저장된 정책 id (예: 'POL-017'). 프론트는 loadOperationPolicy 재조회. 단 p_policy에는 영문(title_en 등) 미포함 → 영문 컬럼은 이 RPC로 쓰이지 않음(현재 SQL에 영문 update 없음).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | policy id |

**비고(권한·예외)**: category/policy_type enum 위반→'invalid policy category'/'invalid policy_type'. title 필수. history_action은 신규='created', 수정='updated'(mode='version'도 updated로 기록되나 status='hidden'으로 강등). SECURITY DEFINER. 주의: 프론트 페이로드에 영문 필드가 없어 영문 컬럼은 별도 경로(legal sync) 외에는 미반영. 정의: 20260617170000_operation_policies.sql:212

### `admin_toggle_operation_policy_status` · RPC · rpc
> 🟢 **쉬운 설명**: 약관·정책을 게시 상태와 숨김 상태로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 바뀐 정책 번호가 돌아온다(약관·개인정보는 사용자 화면용 복사본도 함께 갱신한다)

**자세한 목적**: 정책 게시/숨김 전환. status_changed history append. 게시(이용약관/개인정보 처리방침)면 프론트가 후속으로 legal_documents 동기화 RPC 호출. 감사(policy_status_changed).

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:415 setOperationPolicyStatus`
- `src/features/operation/pages/operation-policies-page.tsx:757 togglePolicyStatusSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_policy_id` | text | 필수 | 대상 정책 id |
| `p_next_status` | text | 필수 | 'published'\|'hidden' |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — policy id. 프론트는 loadOperationPolicy 재조회 후, 약관/개인정보+게시 상태면 admin_sync_legal_document_from_operation_policy를 추가 호출.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | policy id |

**비고(권한·예외)**: invalid status 예외. 동일 상태 가드는 없음(공지/FAQ와 달리). history+current_version_id 갱신. 후속 syncLegalProjection은 프론트 책임. 정의: 20260617170000_operation_policies.sql:352

### `admin_delete_operation_policy` · RPC · rpc
> 🟢 **쉬운 설명**: 약관·정책을 삭제한다(삭제 전 기록은 남긴다)
> 🔵 **돌아오는 값(쉽게)**: 삭제된 정책 번호와 삭제 직전 내용이 돌아온다

**자세한 목적**: 정책 삭제. 삭제 전 'deleted' history append(스냅샷 보존) + 감사(policy_deleted, payload에 snapshot 포함) 후 hard delete.

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:437 deleteOperationPolicy`
- `src/features/operation/pages/operation-policies-page.tsx:815 deletePolicySafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_policy_id` | text | 필수 | 삭제 대상 정책 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 삭제된 policy id. 프론트는 삭제 직전 읽어둔 OperationPolicy 스냅샷 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | policy id |

**비고(권한·예외)**: history에 'deleted' 액션 기록 후 delete(FK cascade로 나머지 history도 삭제됨에 주의 — 단 삭제 직전 insert한 deleted history도 cascade로 함께 사라짐). unknown id 예외. 정의: 20260617170000_operation_policies.sql:399

### `admin_publish_operation_policy_version` · RPC · rpc
> 🟢 **쉬운 설명**: 예전 버전의 약관·정책을 되살려 다시 게시한다
> 🔵 **돌아오는 값(쉽게)**: 되살린 정책 번호가 돌아온다(다시 불러와 화면에 보여준다)

**자세한 목적**: 특정 history 스냅샷을 정책 본문으로 복원하며 status='published'로 발행. version_published history append. 발행 후 프론트가 legal 동기화 호출. 감사(policy_version_published).

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:457 publishOperationPolicyHistoryVersion`
- `src/features/operation/pages/operation-policies-page.tsx:918 publishPolicyHistoryVersionSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_policy_id` | text | 필수 | 대상 정책 id |
| `p_history_id` | text | 필수 | 복원할 history id(PH-NNNN, 같은 policy_id 소속) |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — policy id. 프론트는 loadOperationPolicy 재조회 + syncLegalProjection 호출.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | policy id |

**비고(권한·예외)**: snapshot(camelCase)에서 operation_policies 컬럼으로 역매핑하여 update(status='published'). unknown history id→예외. 정의: 20260617170000_operation_policies.sql:438

### `admin_sync_legal_document_from_operation_policy` · RPC · rpc
> 🟢 **쉬운 설명**: 게시된 약관 내용을 사용자가 보는 화면용으로 복사한다
> 🔵 **돌아오는 값(쉽게)**: 복사된 문서 종류, 버전, 만들어진 문서 정보가 돌아온다

**자세한 목적**: (v13 소유 RPC) operation_policies(SoT) 게시 본문을 사용자측 legal_documents 미러에 투영. 이용약관→terms, 개인정보 처리방침→privacy. ko 항상 + en은 영문 title+body가 있을 때만. 같은 (doc_type,version,locale) 다른 본문 재발행은 거부(불변).

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:290 syncLegalProjection (setOperationPolicyStatus/publishOperationPolicyHistoryVersion 후속)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_source_policy_id` | text | 필수 | 출처 정책 id(POL-NNN). provenance 기록 |
| `p_source_policy_history_id` | text\|null | - | 출처 history id. 프론트는 항상 null 전달 |
| `p_policy_type` | text | 필수 | '이용약관'\|'개인정보 처리방침' (그 외는 'unsupported policy_type' 예외) |
| `p_version` | text | 필수 | 버전 라벨(필수, 공백불가) |
| `p_effective_date` | date\|null | - | 시행일. null이면 now() |
| `p_requires_consent` | boolean | 필수 | 동의 필요 여부(null이면 true 폴백) |
| `p_title_ko` | text | 필수 | 한국어 제목(필수) |
| `p_body_ko` | text | 필수 | 한국어 본문 HTML(필수) |
| `p_summary_ko` | text | - | 한국어 요약 |
| `p_title_en` | text\|null | - | 영문 제목(있으면 en 로케일 발행) |
| `p_body_en` | text\|null | - | 영문 본문(있으면 en 발행, 없으면 en 스킵) |
| `p_summary_en` | text\|null | - | 영문 요약 |

**기대 Response**:
```ts
jsonb { doc_type: 'terms'|'privacy'; version: string; written: uuid[] (생성/갱신된 legal_documents.id 배열) }. 프론트(syncLegalProjection)는 반환값을 사용하지 않고 에러만 처리.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `doc_type` | string | terms 또는 privacy |
| `written` | jsonb(uuid[]) | 이번 호출로 쓰인 legal_documents 행 id 목록(ko/en) |

**비고(권한·예외)**: 이 RPC는 topik-ai가 아니라 v13(topik-project/v13)이 소유. 정의: topik-project/v13/supabase/migrations/20260622150000_legal_documents_projection.sql:39. 가드: private.is_platform_admin(auth.uid()) (다른 운영 RPC의 is_admin보다 강함). 'immutable version conflict' 예외는 프론트가 '이미 게시된 동일 버전 변경 불가, 새 버전 발행' 메시지로 변환. 프론트는 status='게시'이고 policy_type이 약관/개인정보일 때만 호출.

### `admin_send_terms_change_notification` · RPC · rpc
> 🟢 **쉬운 설명**: 약관이 바뀌었다고 모든 활성 회원에게 알림을 보낸다
> 🔵 **돌아오는 값(쉽게)**: 받는 사람 수와 앱 알림·이메일 발송 건이 만들어졌다는 정보가 돌아온다

**자세한 목적**: 이용약관 버전 변경 알림(인앱+이메일)을 전체 활성 사용자에게 수동 발송. 활성 회원 스냅샷을 '전체 활성 사용자' 정적 그룹에 적재 후 in_app/email 디스패치 2건 생성. 실제 집행은 topik-ai 소유 pg_cron 디스패처.

**사용 위치**:
- `src/features/operation/api/supabase-operation-policies-service.ts:487 sendTermsChangeNotification`
- `src/features/operation/pages/operation-policies-page.tsx:882 sendTermsChangeNotificationSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
jsonb { group_id: uuid; recipients: number(int); in_app_dispatch: uuid; email_dispatch: uuid } → 프론트 TermsChangeNotificationResult{ recipients:number, inAppDispatch:string|null(=in_app_dispatch), emailDispatch:string|null(=email_dispatch) }. group_id는 프론트에서 미사용.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `recipients` | int | 발송 시점 profiles.status='active' 회원 수(스냅샷) |
| `in_app_dispatch` | uuid | 인앱 채널 디스패치 id (admin_send_notification 반환) |
| `email_dispatch` | uuid | 이메일 채널 디스패치 id. 이메일은 pref_on+email_on 사용자만 실제 발송 |

**비고(권한·예외)**: is_admin 가드. notification_templates(template_key='legal_terms_changed', channel in_app/email) 2종 의존 — 없으면 'legal_terms_changed templates missing' 예외. profiles는 read-only 참조. 내부적으로 public.admin_send_notification(템플릿,그룹,...)을 2회 호출(notification_groups/dispatch는 v13 알림 인프라 소유 테이블). CTA link_url=/terms-agreement. 정의: supabase/migrations-admin/20260622170000_legal_terms_change_notification.sql:37

### `operation_events` · 테이블 · select
> 🟢 **쉬운 설명**: 운영 이벤트(프로모션·출석·챌린지 등) 목록을 읽어온다
> 🔵 **돌아오는 값(쉽게)**: 제목, 종류, 노출/진행 상태, 기간, 배너, 보상 정보가 돌아온다

**자세한 목적**: 운영 이벤트 SoT(프로모션/출석/챌린지/리워드). 노출/진행 상태, 기간, 배너, 보상/메시지템플릿(denormalized), SEO 메타 보관. 읽기 전용.

**사용 위치**:
- `src/features/operation/api/supabase-operation-events-service.ts:291 loadOperationEvents`
- `src/features/operation/api/supabase-operation-events-service.ts:308 loadOperationEvent`
- `src/features/operation/pages/operation-events-page.tsx 목록`
- `src/features/operation/pages/operation-event-create-page.tsx 편집`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select columns` | string | 필수 | id,title,summary,body_html,slug,event_type,visibility_status,progress_status,start_at,end_at,exposure_channels,target_group_id,target_group_name,participant_count,participant_limit,reward_type,reward_policy_id,reward_policy_name,message_template_id,message_template_name,banner_image_url,banner_image_source_type,banner_image_file_name,banner_images,landing_url,meta_title,meta_description,og_image_url,canonical_url,indexing_policy,admin_memo,created_at,updated_at,updated_by |
| `order` | string | - | 목록은 created_at desc |

**기대 Response**:
```ts
OperationEventRow { id; title; summary:string|null; body_html; slug:string|null; event_type:'프로모션'|'출석'|'챌린지'|'리워드'; visibility_status:'exposed'|'hidden'|'scheduled'; progress_status:'ongoing'|'upcoming'|'ended'; start_at/end_at:date|null; exposure_channels:jsonb(한글 채널 배열); target_group_id/name:string|null; participant_count:int; participant_limit:int|null; reward_type:string|null('없음'|'쿠폰'|'포인트'|'배지'); reward_policy_id/name:string|null; message_template_id/name:string|null; banner_image_url/source_type('file'|'url')/file_name:string|null; banner_images:jsonb([{uid,name,url}]); landing_url/meta_title/meta_description/og_image_url/canonical_url:string|null; indexing_policy:'index'|'noindex'|null; admin_memo:string|null; created_at/updated_at; updated_by } → OperationEvent(camelCase). progressStatus는 프론트가 start/end+오늘 날짜로 재계산(deriveProgressStatus), rewardPolicySummary 파생.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `exposure_channels` | jsonb | 한글 코드값 배열('앱 홈','이벤트 탭' 등) |
| `banner_images` | jsonb | [{uid,name,url}] 객체 배열. uid/url 없으면 프론트가 항목 제거 |
| `reward_policy_id/name` | string\|null | 외부 보상/메시지 도메인 미구축 → FK 없는 denormalized 문자열(STUB) |
| `progress_status` | string | DB값이지만 프론트는 ended 외엔 날짜로 재계산해 표시 |

**비고(권한·예외)**: RLS: admin SELECT only, force RLS. enum CHECK: event_type/reward_type/exposure_channels는 한글, visibility/progress/indexing/banner_source는 ASCII. 보상정책·메시지템플릿은 FK 없음(denormalized, page-sync 미확정 STUB). PK text('EVT-NNN'). 정의: supabase/migrations-admin/20260617152000_operation_events.sql:17

### `admin_save_operation_event` · RPC · rpc
> 🟢 **쉬운 설명**: 운영 이벤트를 새로 만들거나 내용을 고친다
> 🔵 **돌아오는 값(쉽게)**: 저장된 이벤트 번호가 돌아온다(이걸로 다시 불러온다)

**자세한 목적**: 이벤트 생성/수정. 신규는 EVT-NNN 채번+progress_status='upcoming', participant_count=0 강제. 감사(event_saved). visibility는 페이로드 값 사용(상태전이 RPC와 별개).

**사용 위치**:
- `src/features/operation/api/supabase-operation-events-service.ts:341 saveOperationEvent`
- `src/features/operation/pages/operation-event-create-page.tsx:733 saveEventSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | text\|null | - | 수정 대상 id. null/빈문자면 신규 |
| `p_event` | jsonb | 필수 | { title(필수), summary, body_html, slug, event_type(enum,기본 프로모션), visibility_status('exposed'\|'hidden'\|'scheduled',기본 hidden), start_at/end_at(date\|''), exposure_channels:string[], target_group_id/name, participant_limit(int\|''), reward_type(enum\|null), reward_policy_id/name, message_template_id/name, banner_image_url, banner_image_source_type('file'\|'url'), banner_image_file_name, banner_images:[{uid,name,url}], landing_url, meta_title, meta_description, og_image_url, canonical_url, indexing_policy('index'\|'noindex'), admin_memo } |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — 저장된 이벤트 id (예: 'EVT-004'). 프론트는 loadOperationEvent 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | event id |

**비고(권한·예외)**: title 필수. event_type/visibility_status/reward_type/indexing_policy/banner_image_source_type 각각 enum 검증('invalid ...'). 신규 시 participant_count는 항상 0(페이로드 무시), progress_status='upcoming'. 빈문자 → null/0으로 정규화. 정의: 20260617152000_operation_events.sql:197

### `admin_schedule_operation_event` · RPC · rpc
> 🟢 **쉬운 설명**: 이벤트를 나중에 게시되도록 예약한다
> 🔵 **돌아오는 값(쉽게)**: 예약된 이벤트 번호가 돌아온다(다시 불러와 화면에 보여준다)

**자세한 목적**: 이벤트 게시 예약: visibility_status='scheduled'로 전환. 감사(event_scheduled).

**사용 위치**:
- `src/features/operation/api/supabase-operation-events-service.ts:395 scheduleOperationEvent`
- `src/features/operation/pages/operation-events-page.tsx:449 scheduleEventPublishSafe`
- `src/features/operation/pages/operation-event-create-page.tsx:787 scheduleEventPublishSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_event_id` | text | 필수 | 대상 이벤트 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — event id. 프론트는 loadOperationEvent 재조회한 OperationEvent 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | event id |

**비고(권한·예외)**: unknown id→예외. is_admin/reason 가드. diff에 visibility_status from→scheduled 기록. 정의: 20260617152000_operation_events.sql:369

### `admin_publish_operation_event` · RPC · rpc
> 🟢 **쉬운 설명**: 이벤트를 지금 바로 게시한다
> 🔵 **돌아오는 값(쉽게)**: 게시된 이벤트 번호가 돌아온다(다시 불러와 화면에 보여준다)

**자세한 목적**: 이벤트 즉시 게시: visibility_status='exposed'로 전환. 감사(event_published).

**사용 위치**:
- `src/features/operation/api/supabase-operation-events-service.ts:414 publishOperationEvent`
- `src/features/operation/pages/operation-events-page.tsx:454 publishEventSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_event_id` | text | 필수 | 대상 이벤트 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — event id. 프론트는 loadOperationEvent 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | event id |

**비고(권한·예외)**: unknown id→예외. progress_status는 변경 안 함(프론트가 날짜로 재계산). 정의: 20260617152000_operation_events.sql:403

### `admin_end_operation_event` · RPC · rpc
> 🟢 **쉬운 설명**: 진행 중인 이벤트를 종료하고 숨긴다
> 🔵 **돌아오는 값(쉽게)**: 종료된 이벤트 번호가 돌아온다(진행 상태는 종료로 표시된다)

**자세한 목적**: 이벤트 종료: progress_status='ended' + visibility_status='hidden' 동시 전환. 감사(event_ended).

**사용 위치**:
- `src/features/operation/api/supabase-operation-events-service.ts:433 endOperationEvent`
- `src/features/operation/pages/operation-events-page.tsx:458 endEventSafe`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_event_id` | text | 필수 | 대상 이벤트 id |
| `p_reason` | text | 필수 | 운영 사유 |

**기대 Response**:
```ts
text — event id. 프론트는 loadOperationEvent 재조회한 OperationEvent 반환(progressStatus는 ended로 고정 표시).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | event id |

**비고(권한·예외)**: diff에 progress_status→ended, visibility_status→hidden 둘 다 기록. unknown id→예외. 종료된 이벤트는 deriveProgressStatus가 항상 '종료' 표시. 정의: 20260617152000_operation_events.sql:437

## system (감사로그/관리자/메타데이터/권한)
_관리자 계정과 권한 등급, 시스템 로그(감사 추적), 공통 코드(메타데이터)를 관리하는 영역입니다._

### `admin_list_audit_logs` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자 활동 기록(감사 로그)을 조건에 맞게 찾아본다
> 🔵 **돌아오는 값(쉽게)**: 기록 목록과 총 건수가 돌아오고, 민감한 변경 내역은 최고관리자에게만 보인다

**자세한 목적**: 감사 로그(admin_audit_logs) 읽기 전용 조회. /system/audit-logs 화면이 단일 소스로 사용. 필터(대상유형/대상ID/키워드/기간)·페이지네이션·총건수를 함께 반환. diff/payload 민감정보는 platform_admin에게만 노출.

**사용 위치**:
- `src/features/system/api/supabase-system-audit-logs-service.ts:54 — client.rpc('admin_list_audit_logs', {p_target_type:null,...,p_limit:100,p_offset:0}), 결과를 mapSupabaseAuditLogRow로 매핑`
- `src/features/system/api/system-audit-logs-service.ts:106 — supabase 소스일 때 loadSystemAuditLogsFromSupabase 호출(mock은 zustand 스토어 audits 병합)`
- `src/features/system/pages/system-audit-logs-page.tsx:200 — fetchSystemAuditLogsSafe(controller.signal)로 화면 로드`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_type` | text (nullable, default null) | - | 대상 테이블/유형 필터(admin_audit_logs.target_table 정확 일치). 프론트는 항상 null 전달 |
| `p_target_id` | text (nullable, default null) | - | 대상 ID 정확 일치 필터. 프론트는 null |
| `p_keyword` | text (nullable, default null) | - | action/target_id(전체 admin)·payload(platform_admin만) ILIKE 부분검색. 프론트는 null |
| `p_start` | timestamptz (nullable, default null) | - | created_at >= 시작 시각. 프론트는 null |
| `p_end` | timestamptz (nullable, default null) | - | created_at <= 종료 시각. 프론트는 null |
| `p_limit` | int (default 100) | - | 최대 반환 건수. 1~500로 clamp. 프론트는 100 전달 |
| `p_offset` | int (default 0) | - | 오프셋(>=0). 프론트는 0 전달 |

**기대 Response**:
```ts
RETURNS TABLE → 행 배열(rows). 각 행: { log_id: text; target_type: text; target_id: text; action: text; actor: text; reason: text|null; diff: jsonb|null; payload: jsonb|null; created_at: timestamptz(ISO 문자열); total_count: bigint }. created_at desc 정렬. 프론트 매핑(mapSupabaseAuditLogRow) 후 SystemAuditLogRow: { logId; targetType; targetId; action(한글 라벨로 decorate); actor(빈문자열 fallback); reason(빈문자열 fallback); createdAt('YYYY-MM-DD HH:MM:SS' 문자열로 변환); diff?: unknown; payload?: unknown }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `log_id` | text | admin_audit_logs.id::text |
| `target_type` | text | 감사 대상 테이블명(target_table). 예: 'AdminAccount','SystemMetadataGroup','Users' |
| `target_id` | text | 감사 대상 ID |
| `action` | text | 행위 코드(예: admin_role_changed, metadata_group_saved). 프론트가 한글 라벨로 치환 |
| `actor` | text | 수행자 표시명. profiles.display_name → 없으면 admin_user_id::text → 'system' 순 coalesce |
| `reason` | text\|null | payload->>'reason'. 전체 admin에게 노출 |
| `diff` | jsonb\|null | 변경 전/후 diff. platform_admin만 실제 값, 그 외 NULL(서버 게이팅) |
| `payload` | jsonb\|null | 전체 payload(민감정보 포함 가능). platform_admin만 실제 값, 그 외 NULL |
| `created_at` | timestamptz | 발생 시각(ISO). 프론트가 'YYYY-MM-DD HH:MM:SS'로 slice 변환(KST 변환 아님, 단순 자르기) |
| `total_count` | bigint | 필터 적용 후 전체 건수(window count). 페이지네이션용. 프론트 현재 미사용(100개만 로드) |

**비고(권한·예외)**: SECURITY DEFINER, STABLE, search_path=pg_catalog,public. GRANT execute to authenticated, public revoke. 가드: auth.uid() null → 'unauthenticated' 예외; private.is_admin(caller) 실패 → 'forbidden: admin required'. diff/payload 및 payload 키워드 검색 분기는 private.is_platform_admin(caller)=true일 때만(방어적 심층 게이팅, 비-platform admin에게는 와이어로 전송 안 됨). 정의 파일: supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql(초기) → supabase/migrations-admin/20260618095000_audit_logs_diff_payload_platform_only.sql(diff/payload 게이팅 추가, CREATE OR REPLACE 최종본). admin_audit_logs 테이블은 topik-ai 소유. 쓰기는 별도 admin RPC들의 INSERT(이 RPC는 읽기전용). 프론트는 필터 파라미터를 전부 null/100/0 고정으로 호출(화면 클라이언트 사이드 필터).

### `admin_list_admins` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자 계정 명단을 본다
> 🔵 **돌아오는 값(쉽게)**: 관리자 계정 목록(이메일, 이름, 등급, 상태, 마지막 로그인 등)이 돌아온다

**자세한 목적**: 관리자 계정 디렉터리(읽기 전용). /system/admins 화면 목록. v13 소유 public.profiles + auth.users 조인하여 app_role <> 'learner'인 계정 반환.

**사용 위치**:
- `src/features/system/api/system-admins-service.ts:68 — supabaseClient.rpc('admin_list_admins', {p_search:null}), mapAdminRow로 매핑`
- `src/features/system/pages/system-admins-page.tsx:73 — fetchSystemAdminsSafe(controller.signal)로 화면 로드`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_search` | text (nullable, default null) | - | email/display_name/nickname ILIKE 부분검색. 프론트는 null 전달 |

**기대 Response**:
```ts
RETURNS TABLE → 행 배열. 각 행: { user_id: uuid; email: text|null; display_name: text|null; nickname: text|null; app_role: text|null; status: text|null; last_sign_in_at: timestamptz|null; created_at: timestamptz|null; updated_at: timestamptz|null }. 프론트 매핑(mapAdminRow) → AdminPermissionAssignment: { adminId(user_id); name(display_name→nickname→email→user_id fallback); role(app_role→RoleKey 매핑, 기본 'READ_ONLY'); permissions(role 기반 파생 권한키 배열); status('활성'|'비활성'|'탈퇴' 한글 매핑: active/blocked/deleted); lastLoginAt('YYYY-MM-DD HH:MM:SS'); updatedAt('YYYY-MM-DD HH:MM:SS'); updatedBy('' 고정) }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | uuid | profiles.id (= auth.users.id) |
| `email` | text\|null | auth.users.email |
| `display_name` | text\|null | profiles.display_name |
| `nickname` | text\|null | profiles.nickname |
| `app_role` | text\|null | profiles.app_role (platform_admin/content_admin/org_admin 등). 프론트가 RoleKey로 매핑(없으면 READ_ONLY) |
| `status` | text\|null | profiles.status. active→활성, blocked→비활성, deleted→탈퇴로 매핑 |
| `last_sign_in_at` | timestamptz\|null | auth.users.last_sign_in_at. 프론트 lastLoginAt |
| `created_at` | timestamptz\|null | profiles.created_at |
| `updated_at` | timestamptz\|null | profiles.updated_at. 프론트 updatedAt |

**비고(권한·예외)**: SECURITY DEFINER, STABLE, search_path=pg_catalog,public. GRANT to authenticated. 가드: auth.uid() null → 'unauthenticated'; private.is_admin(caller) 실패 → 'forbidden: admin required'(이 RPC는 platform_admin 전용 아님, 모든 admin 읽기 가능). WHERE app_role <> 'learner'. 정렬: lower(coalesce(display_name,email)) asc nulls last, created_at desc. 정의: supabase/migrations-admin/20260618123000_admin_list_admins.sql. v13 DDL/트리거 변경 없음. 프론트 권한키(permissions)는 DB가 아니라 app-role-mapping.ts의 permissionKeysForRole로 파생.

### `admin_list_admin_app_roles` · RPC · rpc
> 🟢 **쉬운 설명**: 권한 등급을 바꿀 수 있는 관리자 명단을 본다
> 🔵 **돌아오는 값(쉽게)**: 권한 변경 화면에 쓸 관리자 목록(이름, 등급, 상태 등)이 돌아온다

**자세한 목적**: 권한 변경 화면(/system/permissions) 전용 관리자 계정 목록. 등급 변경 대상 staff 모집단(app_role<>learner)을 SQL에서 필터해 learner 페이지 잠식 방지. platform_admin 전용 조회.

**사용 위치**:
- `src/features/system/api/system-permissions-service.ts:103 — supabaseClient.rpc('admin_list_admin_app_roles', {p_search:null}), mapRpcRow 후 learner 필터`
- `src/features/system/pages/system-permissions-page.tsx:143 — fetchAdminAppRolesSafe(signal)로 화면 로드`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_search` | text (nullable, default null) | - | email/display_name/nickname ILIKE 부분검색(lower 처리). 프론트는 null |

**기대 Response**:
```ts
RETURNS TABLE → 행 배열. 각 행: { user_id: uuid; email: text|null; display_name: text|null; nickname: text|null; app_role: text; status: text; last_sign_in_at: timestamptz|null; created_at: timestamptz }. 프론트 매핑(mapRpcRow) → AdminAppRoleRow: { adminId(user_id); email(''); displayName(display_name→nickname→email→user_id); appRole(V13AppRole); roleKey(RoleKey|null); permissionCount(roleKey 기반 권한 수, 파생); status; lastLoginAt('YYYY-MM-DD HH:MM:SS'); updatedAt(created_at 변환) }. 매핑 후 appRole==='learner' 행은 추가 필터(방어적 no-op).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | uuid | profiles.id |
| `email` | text\|null | auth.users.email |
| `display_name` | text\|null | profiles.display_name |
| `nickname` | text\|null | profiles.nickname |
| `app_role` | text | profiles.app_role. 프론트가 RoleKey/permissionCount 파생 |
| `status` | text | profiles.status (활성/비활성 등 가공 전 원본) |
| `last_sign_in_at` | timestamptz\|null | auth.users.last_sign_in_at → lastLoginAt |
| `created_at` | timestamptz | profiles.created_at → updatedAt로 사용(주의: updated_at 아님) |

**비고(권한·예외)**: SECURITY DEFINER, STABLE. GRANT to authenticated. 가드: auth.uid() null → 'unauthenticated'; private.is_platform_admin(caller) 실패 → 'forbidden: platform_admin required'(admin_list_admins와 달리 platform_admin 전용). WHERE app_role <> 'learner'. learner→admin 승격은 이 목록 범위 밖(Users 디렉터리에서 처리). admin_list_admins와 차이: (1)updated_at 미반환 (2)platform_admin 게이트 (3)권한 변경 화면 전용. 정의: supabase/migrations-admin/20260618094000_admin_list_admin_app_roles.sql. 이전엔 get_admin_users 재사용했으나 learner 페이지 잠식 문제로 분리.

### `admin_set_admin_app_role` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자의 권한 등급을 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 확인하고, 화면이 명단을 다시 불러온다

**자세한 목적**: 관리자 계정의 app_role(권한 등급) 변경. /system/permissions 화면의 실 등급 변경 액션. profiles.app_role(RBAC SoT)에 쓰고 admin_audit_logs에 감사 기록. platform_admin 전용, 사유 필수.

**사용 위치**:
- `src/features/system/api/system-permissions-service.ts:139 — supabaseClient.rpc('admin_set_admin_app_role', {p_target_user_id, p_new_app_role, p_reason})`
- `src/features/system/pages/system-permissions-page.tsx:188 — changeAdminAppRoleSafe({targetUserId,newAppRole,reason}) 후 목록 재조회`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_user_id` | uuid | 필수 | 변경 대상 사용자 id(profiles.id) |
| `p_new_app_role` | text | 필수 | 새 등급. 허용값: 'platform_admin'\|'content_admin'\|'org_admin'\|'learner'. 그 외 → 'invalid app_role' 예외 |
| `p_reason` | text | 필수 | 변경 사유(공백 불가). 비어있으면 'reason required' 예외. 프론트도 RPC 호출 전 필수 검증 |

**기대 Response**:
```ts
RETURNS uuid → 변경된 대상 user_id(p_target_user_id). 프론트(changeAdminAppRole)는 반환값을 사용하지 않고 error만 확인(Promise<void>). 성공 시 화면이 목록 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | uuid | 변경 완료된 대상 사용자 id. 프론트 미사용 |

**비고(권한·예외)**: SECURITY DEFINER(STABLE 아님, 쓰기), search_path=pg_catalog,public. GRANT to authenticated. 가드 순서: auth.uid() null→'unauthenticated'; private.is_platform_admin 실패→'forbidden: platform_admin required'; p_target_user_id null→'target user id required'; app_role 허용값 외→'invalid app_role: %'; reason 공백→'reason required'; 대상 미존재→'unknown user id: %'; 동일 등급→'admin app_role already %'; 자기 자신 platform_admin 강등→'cannot demote your own platform_admin role'; 마지막 platform_admin 강등→'cannot demote the last platform_admin'(방어적, 사실상 도달불가). UPDATE profiles SET app_role + RETURNING 자기검증(protect_profile_columns가 쓰기 억제하면 errcode 42501로 loud abort). 감사: admin_audit_logs INSERT(action='admin_role_changed', target_table='AdminAccount', target_id=user_id, diff={app_role:{from,to}}, payload={reason,target_email,target_display,session_policy:'next_login'}). 기존 세션 미무효화, 다음 로그인에 반영. profiles 쓰기는 protect_profile_columns의 is_admin 우회에 의존(status 토글 선례). 정의: supabase/migrations-admin/20260618093000_admin_set_app_role.sql.

### `admin_save_metadata_group` · RPC · rpc
> 🟢 **쉬운 설명**: 코드/옵션을 묶는 묶음을 새로 만들거나 수정한다
> 🔵 **돌아오는 값(쉽게)**: 저장된 묶음의 전체 내용이 돌아와 화면에 보인다

**자세한 목적**: 메타데이터 그룹 생성/수정(upsert). /system/metadata 화면. p_group_id null이면 신규(서버에서 META-GRP-NNN 생성), 있으면 수정. 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:225 — client.rpc('admin_save_metadata_group', {p_group_id, p_group:{...}, p_reason}) 후 loadGroup 재조회`
- `src/features/system/api/system-metadata-service.ts:302 — saveMetadataGroupSafe(supabase 분기)`
- `src/features/system/pages/system-metadata-page.tsx:803 — saveMetadataGroupSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_group_id` | text (nullable) | - | 수정 대상 그룹 id. null/공백이면 신규 생성(서버가 next_system_metadata_group_id로 채번) |
| `p_group` | jsonb | 필수 | 그룹 본문 객체. 키: group_name(필수), description, manager_type(codeTable\|selectOption\|exposureRule\|segmentField), owner_module(Users\|Message\|Operation\|Commerce\|Content\|System), owner_role, sync_status(live\|review\|draft), exposure_status(confirmed\|inferred\|internalOnly\|planned), linked_admin_pages(배열), linked_user_surfaces(배열), schema_candidate_notes(배열), item_code_prefix, updated_by |
| `p_reason` | text | 필수 | 운영 사유(공백 불가). 프론트 requireReason로 trim 후 필수 |

**기대 Response**:
```ts
RETURNS text → 저장된 그룹 id(group_id). 프론트(saveMetadataGroupViaRpc)는 이 id로 loadGroup(String(data)) 재조회하여 SystemMetadataGroup 전체를 반환: { groupId; groupName; description; managerType; ownerModule; ownerRole; status; syncStatus; exposureStatus; linkedAdminPages: string[]; linkedAdminLocations: [](DB는 항상 빈배열); linkedUserSurfaces: string[]; schemaCandidateNotes: string[]; itemCodePrefix; items: SystemMetadataItem[]; history: [{historyId,action,reason:'Supabase metadata snapshot',changedBy,createdAt}](1건 합성); updatedAt; updatedBy; lastReviewedAt }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 저장된 group_id (예: 'META-GRP-007'). 프론트가 재조회 키로 사용 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). GRANT to authenticated. 가드: unauthenticated; private.is_admin 실패→'forbidden: admin required'(platform 전용 아님); reason 공백→'reason required'; group_name 공백→'group_name required'; manager_type/owner_module/sync_status/exposure_status enum 검증; linked_admin_pages 비배열→예외; group_name 중복(lower 유니크)→'duplicated group_name'. 신규는 pg_advisory_xact_lock + next_system_metadata_group_id() 채번. status는 신규 'active', 수정 시 기존값 유지(payload로 변경 불가). 감사: admin_audit_logs INSERT(action='metadata_group_saved', target_table='SystemMetadataGroup'). 정의: supabase/migrations-admin/20260617211000_system_metadata.sql. 응답으로 그룹 전체를 주지 않고 id만 → 프론트가 별도 select 재조회(2-스텝).

### `admin_save_metadata_item` · RPC · rpc
> 🟢 **쉬운 설명**: 묶음 안의 코드/옵션 항목을 새로 만들거나 수정한다
> 🔵 **돌아오는 값(쉽게)**: 항목이 반영된 묶음 전체 내용이 돌아와 화면에 보인다

**자세한 목적**: 메타데이터 그룹 항목(코드/옵션) 생성/수정(upsert). p_item_id null이면 신규 채번, 있으면 수정. is_default=true면 그룹 내 타 항목 default 해제. 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:252 — client.rpc('admin_save_metadata_item', {p_item_id, p_item:{...}, p_reason}) 후 loadGroup`
- `src/features/system/pages/system-metadata-page.tsx:857 — saveMetadataItemSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_item_id` | text (nullable) | - | 수정 대상 item id. null/공백이면 신규(next_system_metadata_item_id 채번) |
| `p_item` | jsonb | 필수 | 항목 본문. 키: group_id(필수, 신규시 사용), code(upper 저장), label, description, status(active\|inactive), sort_order(>=1), is_default(boolean), exposure_status(confirmed\|inferred\|internalOnly\|planned), updated_by |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
RETURNS text → 항목이 속한 group_id. 프론트는 loadGroup(group_id) 재조회로 SystemMetadataGroup 전체 반환(items 포함). 단일 SystemMetadataItem: { itemId; code; label; description; status('active'|'inactive'); sortOrder: number; isDefault: boolean; exposureStatus; updatedAt('YYYY-MM-DD HH:MM:SS'); updatedBy }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 항목이 속한 group_id(수정 시 서버가 기존 item의 group_id로 보정). 프론트 재조회 키 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). 가드: unauthenticated; is_admin; reason 공백; group_id 공백→'group_id required'; 그룹 미존재→'unknown metadata group id'; status enum; exposure_status enum; sort_order<1→예외; code 중복(group+upper(code) 유니크)→'duplicated item code'; label 중복(group+lower(label))→'duplicated item label'. 신규는 advisory lock+채번. is_default=true 저장 시 같은 그룹 타 항목 is_default=false 처리. 항목 저장 후 그룹 updated_at/updated_by 갱신. 감사: action='metadata_item_saved', target_table='SystemMetadataGroup', target_id=group_id, payload={reason,item_id,label}. 정의: supabase/migrations-admin/20260617211000_system_metadata.sql.

### `admin_delete_metadata_item` · RPC · rpc
> 🟢 **쉬운 설명**: 묶음 안의 코드/옵션 항목을 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 남은 항목들이 정리된 묶음 전체 내용이 돌아온다

**자세한 목적**: 메타데이터 항목 삭제. 삭제 항목이 default였으면 잔여 항목 첫번째를 default로 승계, sort_order 재정렬. 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:304 — client.rpc('admin_delete_metadata_item', {p_item_id, p_reason}) 후 loadGroup`
- `src/features/system/pages/system-metadata-page.tsx:1060 — deleteMetadataItemSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_item_id` | text | 필수 | 삭제할 item id |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
RETURNS text → 항목이 속했던 group_id. 프론트는 loadGroup으로 SystemMetadataGroup 전체(잔여 items, 재정렬된 sortOrder) 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 삭제 항목의 group_id. 프론트 재조회 키 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). 가드: unauthenticated; is_admin; reason 공백; 항목 미존재→'unknown metadata item id'. 삭제 후: default였으면 sort_order asc, label asc 첫 항목 승계; row_number로 sort_order 1..N 재채번; 그룹 updated_at/updated_by 갱신. 감사: action='metadata_item_deleted', diff=to_jsonb(삭제전 row 전체), payload={reason,item_id,label}. 정의: supabase/migrations-admin/20260617211000_system_metadata.sql.

### `admin_reorder_metadata_items` · RPC · rpc
> 🟢 **쉬운 설명**: 묶음 안 항목들의 순서를 다시 정렬한다
> 🔵 **돌아오는 값(쉽게)**: 새 순서로 정리된 묶음 전체 내용이 돌아온다

**자세한 목적**: 메타데이터 그룹 내 항목 순서 재배치. 전달된 id 순서대로 sort_order(1..N) 재부여. 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:317 — client.rpc('admin_reorder_metadata_items', {p_group_id, p_ordered_item_ids:orderedItemIds, p_reason}) 후 loadGroup`
- `src/features/system/pages/system-metadata-page.tsx:917 — reorderMetadataItemsSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_group_id` | text | 필수 | 대상 그룹 id |
| `p_ordered_item_ids` | jsonb (string[]) | 필수 | 새 순서의 item id 배열. 그룹의 전체 항목과 정확히 일치해야 함(개수·구성). 프론트는 orderedItemIds 배열 전달 |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
RETURNS text → group_id. 프론트는 loadGroup으로 SystemMetadataGroup 전체(재정렬된 items) 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 재정렬된 그룹의 group_id. 프론트 재조회 키 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). 가드: unauthenticated; is_admin; reason 공백; p_ordered_item_ids 비배열→예외; 그룹 미존재→예외; 기존 항목수 ≠ distinct 전달 id 수→'ordered item ids do not match group item count'; 전달 id 중 그룹에 없는 항목→'ordered item ids contain unknown item'. jsonb_array_elements_text WITH ORDINALITY로 sort_order 채번, 그룹 updated_at/updated_by 갱신. 감사: action='metadata_items_reordered', diff={ordered_item_ids:[...]}, payload={reason}. 정의: supabase/migrations-admin/20260617211000_system_metadata.sql. 프론트(system-metadata-service.ts)도 호출 전 개수/누락 검증.

### `admin_toggle_metadata_group_status` · RPC · rpc
> 🟢 **쉬운 설명**: 코드/옵션 묶음을 켜거나 끈다(사용/미사용)
> 🔵 **돌아오는 값(쉽게)**: 상태가 바뀐 묶음 전체 내용이 돌아온다

**자세한 목적**: 메타데이터 그룹 활성/비활성(status) 토글. 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:276 — client.rpc('admin_toggle_metadata_group_status', {p_group_id, p_next_status:nextStatus, p_reason}) 후 loadGroup`
- `src/features/system/pages/system-metadata-page.tsx:1098 — toggleMetadataGroupStatusSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_group_id` | text | 필수 | 대상 그룹 id |
| `p_next_status` | text | 필수 | 'active' 또는 'inactive'. 그 외 → 'invalid metadata group status' 예외 |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
RETURNS text → group_id. 프론트는 loadGroup으로 SystemMetadataGroup 전체(갱신된 status) 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 그룹 id. 프론트 재조회 키 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). 가드: unauthenticated; is_admin; reason 공백; status enum; 그룹 미존재(FOR UPDATE)→예외. UPDATE status + updated_at/updated_by. 감사: action='metadata_group_status_changed', diff={status:{from,to}}, payload={reason}. 정의: supabase/migrations-admin/20260617211000_system_metadata.sql.

### `admin_toggle_metadata_item_status` · RPC · rpc
> 🟢 **쉬운 설명**: 코드/옵션 항목을 켜거나 끈다(사용/미사용)
> 🔵 **돌아오는 값(쉽게)**: 상태가 바뀐 항목이 포함된 묶음 전체 내용이 돌아온다

**자세한 목적**: 메타데이터 항목 활성/비활성(status) 토글. 항목 소속 그룹 updated_at 갱신, 감사 기록 동반.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:290 — client.rpc('admin_toggle_metadata_item_status', {p_item_id, p_next_status:nextStatus, p_reason}) 후 loadGroup`
- `src/features/system/pages/system-metadata-page.tsx:1104 — toggleMetadataItemStatusSafe 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_item_id` | text | 필수 | 대상 item id |
| `p_next_status` | text | 필수 | 'active' 또는 'inactive'. 그 외 → 'invalid metadata item status' 예외 |
| `p_reason` | text | 필수 | 운영 사유(공백 불가) |

**기대 Response**:
```ts
RETURNS text → 항목이 속한 group_id. 프론트는 loadGroup으로 SystemMetadataGroup 전체(갱신된 item status) 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(returns)` | text | 항목의 group_id. 프론트 재조회 키 |

**비고(권한·예외)**: SECURITY DEFINER(쓰기). 가드: unauthenticated; is_admin; reason 공백; status enum; 항목 미존재(FOR UPDATE)→'unknown metadata item id'. UPDATE 항목 status + 그룹 updated_at/updated_by 갱신. 감사: action='metadata_item_status_changed', target_id=group_id, diff={item_id, status:{from,to}}, payload={reason,label}. 정의: supabase/migrations-admin/20260617211000_system_metadata.sql.

### `system_logs` · 테이블 · select
> 🟢 **쉬운 설명**: 시스템에서 일어난 일(정보/경고/오류) 기록을 본다
> 🔵 **돌아오는 값(쉽게)**: 최신순으로 정리된 시스템 기록 목록이 돌아온다

**자세한 목적**: 시스템 로그(INFO/WARN/ERROR) 읽기 전용 조회. /system/logs 화면. PostgREST select로 created_at 내림차순 전체 조회.

**사용 위치**:
- `src/features/system/api/supabase-system-logs-service.ts:64 — client.from('system_logs').select(SYSTEM_LOG_COLUMNS).order('created_at', {ascending:false})`
- `src/features/system/api/system-logs-service.ts:34 — supabase 소스일 때 loadSystemLogsFromSupabase`
- `src/features/system/pages/system-logs-page.tsx:77 — fetchSystemLogsSafe(controller.signal)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | id, level, component, message, trace_id, context, created_at |
| `order` | created_at.desc | - | created_at 내림차순 정렬(ascending:false) |

**기대 Response**:
```ts
SystemLogDbRow[] → 프론트 매핑(mapSystemLogRow) → SystemLogRow[]: { id: string; level: 'INFO'|'WARN'|'ERROR'(WARN/ERROR 외엔 INFO로 정규화); component: string; message: string; traceId?: string(trace_id null→undefined); context?: unknown(jsonb 그대로); createdAt: string('YYYY-MM-DD HH:MM:SS', timestamptz slice 변환) }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text (pk) | 로그 id (예: 'SYS-001') |
| `level` | text | INFO\|WARN\|ERROR (CHECK 제약). 프론트는 WARN/ERROR 외 모두 INFO로 fallback |
| `component` | text | 발생 컴포넌트명 (예: 'notification-worker','billing-sync') |
| `message` | text | 로그 메시지 |
| `trace_id` | text\|null | 추적 id. null이면 프론트 traceId undefined |
| `context` | jsonb\|null | 부가 컨텍스트 객체. 프론트 context(unknown)로 그대로 전달 |
| `created_at` | timestamptz | 발생 시각. 프론트가 'YYYY-MM-DD HH:MM:SS'로 자름(KST 변환 아님) |

**비고(권한·예외)**: RLS: SELECT to authenticated USING private.is_admin(auth.uid()) — 관리자만 읽기. force row level security. INSERT/UPDATE/DELETE 정책·RPC 없음(쓰기 경로/적재 소스는 admin 마이그레이션 범위 밖, 미정). 인덱스: created_at desc, level(WARN/ERROR 부분), component. 정의: supabase/migrations-admin/20260617213000_system_logs.sql. mock 모드일 땐 createMockSystemLogs() 사용. ⚠️dev DB 전면 TRUNCATE(2026-06-22)로 seed 4행 소멸(스키마/RLS는 생존).

### `system_metadata_groups` · 테이블 · select
> 🟢 **쉬운 설명**: 코드/옵션 묶음들의 목록을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 최근 수정순으로 정리된 묶음 목록이 돌아온다

**자세한 목적**: 메타데이터 그룹 목록 읽기. /system/metadata 화면 로드 시 PostgREST select(updated_at desc). 쓰기는 admin_save/toggle RPC를 통해서만.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:194 — client.from('system_metadata_groups').select(GROUP_COLUMNS).order('updated_at',{ascending:false})`
- `src/features/system/pages/system-metadata-page.tsx:614 — fetchMetadataGroupsSafe(controller.signal)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | group_id, group_name, description, owner_role, item_code_prefix, manager_type, owner_module, status, sync_status, exposure_status, linked_admin_pages, linked_user_surfaces, schema_candidate_notes, created_at, updated_at, updated_by |
| `order` | updated_at.desc | - | updated_at 내림차순 |

**기대 Response**:
```ts
MetadataGroupRow[] → 프론트 매핑(mapGroupRow, items와 결합) → SystemMetadataGroup[]: { groupId; groupName; description; managerType; ownerModule; ownerRole; status('active'|'inactive'); syncStatus('live'|'review'|'draft'); exposureStatus('confirmed'|'inferred'|'internalOnly'|'planned'); linkedAdminPages: string[]; linkedAdminLocations: [](DB 소스는 항상 빈배열); linkedUserSurfaces: string[]; schemaCandidateNotes: string[]; itemCodePrefix; items: SystemMetadataItem[]; history: [{historyId:`${groupId}-DB-HIS`, action:'group_created'|'group_updated'(created_at≠updated_at 추정), reason:'Supabase metadata snapshot', changedBy, createdAt}](1건 합성); updatedAt('YYYY-MM-DD HH:MM:SS'); updatedBy(null→'system'); lastReviewedAt(=updatedAt) }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `group_id` | text (pk) | META-GRP-NNN 패턴(CHECK) |
| `group_name` | text | 그룹명. lower 유니크 |
| `description` | text | 설명 |
| `owner_role` | text | 관리 책임 역할(자유 텍스트, 예 'OPS_ADMIN') |
| `item_code_prefix` | text | 항목 코드 prefix |
| `manager_type` | text | codeTable\|selectOption\|exposureRule\|segmentField (CHECK) |
| `owner_module` | text | Users\|Message\|Operation\|Commerce\|Content\|System (CHECK) |
| `status` | text | active\|inactive (CHECK) |
| `sync_status` | text | live\|review\|draft (CHECK) |
| `exposure_status` | text | confirmed\|inferred\|internalOnly\|planned (CHECK) |
| `linked_admin_pages` | jsonb (string[]) | 연관 관리자 화면 경로 배열 |
| `linked_user_surfaces` | jsonb (string[]) | 사용자 노출 surface 배열 |
| `schema_candidate_notes` | jsonb (string[]) | 스키마 후보 메모 배열 |
| `created_at` | timestamptz | 생성 시각 |
| `updated_at` | timestamptz | 수정 시각. 정렬 키 및 프론트 updatedAt |
| `updated_by` | text\|null | 마지막 수정자(텍스트, null→'system') |

**비고(권한·예외)**: RLS: SELECT only to authenticated USING private.is_admin(auth.uid()). force RLS. INSERT/UPDATE/DELETE 정책 없음 → 쓰기는 전부 SECURITY DEFINER RPC. CHECK: group_id 패턴, manager_type/owner_module/status/sync_status/exposure_status enum, 3개 jsonb 배열 타입. 유니크: lower(group_name). 프론트는 그룹+항목을 Promise.all로 병렬 select 후 group_id로 결합. linkedAdminLocations는 DB 모델엔 없어 프론트가 빈배열, history는 1건으로 합성(실제 변경 이력 아님). 정의: supabase/migrations-admin/20260617211000_system_metadata.sql(seed 6 그룹 포함, dev DB는 TRUNCATE로 소멸 가능).

### `system_metadata_group_items` · 테이블 · select
> 🟢 **쉬운 설명**: 묶음 안에 들어 있는 코드/옵션 항목들을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 순서대로 정리된 항목 목록이 돌아와 묶음과 합쳐진다

**자세한 목적**: 메타데이터 그룹 항목(코드/옵션) 목록 읽기. 그룹 select와 병렬로 sort_order asc 조회하여 그룹별로 결합. 쓰기는 admin_*_metadata_item RPC만.

**사용 위치**:
- `src/features/system/api/supabase-system-metadata-service.ts:198 — client.from('system_metadata_group_items').select(ITEM_COLUMNS).order('sort_order',{ascending:true})`
- `src/features/system/pages/system-metadata-page.tsx:614 — fetchMetadataGroupsSafe (그룹과 함께 로드)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | columns | 필수 | item_id, group_id, code, label, description, sort_order, status, exposure_status, is_default, created_at, updated_at, updated_by |
| `order` | sort_order.asc | - | sort_order 오름차순 |

**기대 Response**:
```ts
MetadataItemRow[] → 프론트 매핑(mapItemRow) → SystemMetadataItem: { itemId; code; label; description; status('active'|'inactive'); sortOrder: number; isDefault: boolean; exposureStatus('confirmed'|'inferred'|'internalOnly'|'planned'); updatedAt('YYYY-MM-DD HH:MM:SS', updated_at null이면 created_at fallback); updatedBy(null→'system') }. group_id로 그룹에 묶임.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `item_id` | text (pk) | META-ITEM-NNN 패턴(CHECK) |
| `group_id` | text (fk) | system_metadata_groups.group_id (on delete cascade) |
| `code` | text | 항목 코드(upper 저장, group+upper(code) 유니크) |
| `label` | text | 표시 라벨(group+lower(label) 유니크) |
| `description` | text | 설명 |
| `sort_order` | smallint | 정렬 순서(>0 CHECK). 정렬 키 |
| `status` | text | active\|inactive (CHECK) |
| `exposure_status` | text | confirmed\|inferred\|internalOnly\|planned (CHECK) |
| `is_default` | boolean | 그룹 내 기본값 여부 |
| `created_at` | timestamptz | 생성 시각 |
| `updated_at` | timestamptz | 수정 시각 |
| `updated_by` | text\|null | 마지막 수정자(null→'system') |

**비고(권한·예외)**: RLS: SELECT only to authenticated USING private.is_admin(auth.uid()). force RLS. 쓰기 정책 없음(RPC 전용). 유니크: (group_id, upper(code)), (group_id, lower(label)). 인덱스: (group_id, sort_order). 정의: supabase/migrations-admin/20260617211000_system_metadata.sql(seed 13 항목, dev DB TRUNCATE 시 소멸).

## users (회원/강사/추천인/기관코드)
_관리자가 회원·강사·추천인·기관코드를 조회하고 상태를 바꾸거나 상세 활동(결제/접속/커뮤니티 등)을 들여다보는 영역입니다._

### `get_admin_users` · RPC · rpc
> 🟢 **쉬운 설명**: 회원 목록을 한 줄에 필요한 정보 다 묶어 가져온다
> 🔵 **돌아오는 값(쉽게)**: 이메일·등급·상태·소셜로그인·약관동의·기관소속까지 포함된 회원 목록이 돌아온다

**자세한 목적**: 회원 목록 read. profiles + auth.users 조인에 더해 writing_submissions 제출 집계, social_providers(auth.identities, email 제외), 약관 동의(legal_documents⋈user_consents) 집계, 박람회/기관 유입(profiles.affiliation_code ⋈ institution_codes.label)을 한 행으로 반환. 회원 목록 화면과 회원 상세 헤더(목록에서 find)에 사용.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:264 (loadUsersFromSupabase — rpc('get_admin_users',{search:null,sort:'activity',page:1,page_size:100}))`
- `src/features/users/pages/users-page.tsx:213 (fetchUsersSafe — 회원 목록)`
- `src/features/users/pages/user-detail-page.tsx:178 (fetchUserByIdSafe — 목록 로드 후 id로 find)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `search` | text \| null | - | display_name/nickname/email ILIKE 검색어. 프론트는 항상 null 전송(목록 화면이 클라이언트 필터). 인자명 고정(PostgREST 이름 매칭). |
| `sort` | text | - | 'activity'(기본) \| 'name'. 'name'=표시명 오름차순, 그 외=last_sign_in_at desc→created_at desc. 프론트는 'activity' 전송. |
| `page` | integer | - | 1-base 페이지(기본 1). 프론트는 1 고정 전송. |
| `page_size` | integer | - | 페이지 크기(기본 100, 1~500 clamp). 프론트는 100 전송. dev 한정 단일 페이지 — prod(>100명)는 서버 페이지네이션 후속 필요. |

**기대 Response**:
```ts
set of rows (RETURNS TABLE). 각 행: { user_id: uuid; email: text|null; display_name: text|null; nickname: text|null; app_role: text; plan_label: text|null; status: text; nationality_country_code: text|null; social_providers: text[]; affiliation_code: text|null; affiliation_label: text|null; submission_count: bigint; last_activity: timestamptz|null; last_sign_in_at: timestamptz|null; created_at: timestamptz; consent_status: 'consented'|'partial'|'none'; consent_accepted_at: timestamptz|null; total_count: bigint }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `user_id` | uuid | profiles.id (= auth.users.id). 프론트 UserSummary.id. |
| `email` | text\|null | auth.users.email. |
| `display_name` | text\|null | profiles.display_name → realName(빈값은 ''). |
| `nickname` | text\|null | profiles.nickname. NULL/빈값이면 프론트가 profiles 직접 select로 보강(loadProfileNicknameMap). |
| `app_role` | text | profiles.app_role(권한). 목록 행에 포함되나 UserSummary로는 매핑 안 됨. |
| `plan_label` | text\|null | profiles.plan_label(자유 텍스트). 프론트가 free/basic/일반/빈값→'일반', 그외→'프리미엄'(UserTier)으로 변환. subscriptionStatus도 여기서 파생(GAP: 실제 구독 조인 아님, PROPOSED 휴리스틱). |
| `status` | text | profiles.status: active\|blocked\|deleted → 정상\|정지\|탈퇴. |
| `nationality_country_code` | text\|null | ISO 3166-1 alpha-2 국적 코드 원본. 빈값은 ''로 보존, 국가명 변환은 UI. |
| `social_providers` | text[] | auth.identities에서 'email' 제외 provider 알파벳순 배열(예 ['google','kakao']). 소셜 미연동이면 빈 배열 {}. |
| `affiliation_code` | text\|null | profiles.affiliation_code(박람회/기관 유입 코드 원본). v13 컬럼 적용 전엔 NULL. |
| `affiliation_label` | text\|null | institution_codes.label로 해석한 표시명. 미등록 코드면 NULL(코드만 노출). |
| `submission_count` | bigint | writing_submissions 제출 건수 집계(없으면 0). |
| `last_activity` | timestamptz\|null | writing_submissions.submitted_at 최대값. 현재 UserSummary 매핑엔 사용 안 됨. |
| `last_sign_in_at` | timestamptz\|null | auth.users.last_sign_in_at → lastLoginAt(YYYY-MM-DD slice). |
| `created_at` | timestamptz | profiles.created_at → joinedAt(YYYY-MM-DD slice). |
| `consent_status` | text | 현재 필수 published 약관(doc_type별 최신) 충족도: consented\|partial\|none → 동의 완료\|일부 동의\|미동의. 필수 문서 0개면 항상 consented. |
| `consent_accepted_at` | timestamptz\|null | 필수 약관 동의 중 최종 동의일 → termsConsentAt(YYYY-MM-DD). |
| `total_count` | bigint | 필터 적용 후 전체 행 수(window count). 페이지네이션용. |

**비고(권한·예외)**: platform_admin 전용(private.is_platform_admin). caller NULL→'unauthenticated', 비-platform admin→'forbidden: platform_admin required' 예외. SECURITY DEFINER, STABLE. 정의 최신본: supabase/migrations-admin/20260619150000_admin_users_affiliation.sql (초기본 20260617210000은 affiliation/social/consent/nationality 컬럼 없음 — 이후 마이그가 drop+recreate로 누적 확장). 인자명 search/sort/page/page_size 변경 금지(PostgREST 매칭). dev DB는 2026-06-22 전면 TRUNCATE되어 재seed 전까지 빈 결과.

### `get_admin_user_learning_overview` · RPC · rpc
> 🟢 **쉬운 설명**: 회원 한 명의 학습 현황을 한눈에 모아 보여준다
> 🔵 **돌아오는 값(쉽게)**: 문제 풀이량·정답률·평균점수·취약점·최근 풀이/작문 요약이 돌아온다

**자세한 목적**: 회원 상세 > 학습 현황 탭. v13 학습 테이블(problem_attempts/problems/writing_submissions/writing_feedback/feedback_dimension_scores/learning_goals) 읽기 집계. KPI/도메인 정확도/취약점/최근 풀이/최근 작문을 jsonb 5컬럼으로 반환. 작문 답안 본문·문장 피드백 텍스트(PII)는 제외.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:313 (loadUserLearningOverviewFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:214 (fetchUserLearningOverviewSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `target_id` | uuid | 필수 | 대상 회원 user_id. 프론트가 보내는 키 = target_id. |

**기대 Response**:
```ts
단일 행(RETURNS TABLE, 프론트는 Array면 [0] 취함). { kpis: jsonb; domain_accuracy: jsonb; weaknesses: jsonb; recent_attempts: jsonb; recent_writing: jsonb }. kpis={ totalAttempts:int; solvedProblems:int; correctRate:number|null; averageScore:number|null; totalStudyMinutes:int; bookmarkedCount:int; writingSubmissionCount:int; writingFeedbackCount:int; latestActivityAt:string('YYYY-MM-DD'|'') }. domain_accuracy=[{ domain:string; attempts:int; correctRate:number|null; averageScore:number|null }]. weaknesses=[{ label:string; source:'domain'|'tag'|'writing_dimension'|'goal'; severity:int; evidenceCount:int }]. recent_attempts(최대10)=[{ id; problemId; domain; questionNo:int|null; topikLevel:string; difficulty:string; title; isCorrect:bool|null; score:number|null; status; submittedAt:'YYYY-MM-DD'|''; timeSpentSeconds:int }]. recent_writing(최대5)=[{ submissionId; questionNo:int; submittedAt:'YYYY-MM-DD'; feedbackStatus:string; scoreTotal:number|null; scoreMax:number|null; weaknessDimensions:string[] }]
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `kpis` | jsonb(object) | 집계 KPI 객체. camelCase 키(jsonb_build_object). latestActivityAt는 최근 풀이/작문 중 최댓값을 'YYYY-MM-DD' 텍스트로, 둘 다 없으면 빈 문자열. |
| `domain_accuracy` | jsonb(array) | 도메인별 시도수/정답률/평균점수. 빈 경우 []. |
| `weaknesses` | jsonb(array) | 도메인(정답률<70)+오답 태그 top5+작문 차원 top5+학습목표 weak_areas 합산. severity desc 정렬. |
| `recent_attempts` | jsonb(array) | 최근 풀이 10건. submittedAt은 'YYYY-MM-DD' 텍스트(null이면 ''). |
| `recent_writing` | jsonb(array) | 최근 작문 제출 5건. weaknessDimensions는 feedback_dimension_scores에서 weakness_level>0 차원 jsonb 배열. |

**비고(권한·예외)**: platform_admin 전용. NULL caller→unauthenticated, 비-platform→'forbidden: platform_admin required'. SECURITY DEFINER, STABLE, read-only(쓰기/감사 없음). PII 제외 설계(writing_submissions.answer_text, sentence_feedback 텍스트 미노출). 프론트는 빈 결과 시 0/[] 기본값으로 채움. 정의: supabase/migrations-admin/20260618120000_admin_user_learning_overview.sql. types.ts의 UserLearningOverview와 1:1.

### `admin_set_user_status` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 회원을 정지하거나 정지 해제한다
> 🔵 **돌아오는 값(쉽게)**: 성공 여부만 확인하면 된다(반환값은 화면에서 안 씀)

**자세한 목적**: 회원 정지(blocked)/해제(active) write. active|blocked만 허용(deleted 차단). admin_audit_logs에 user_status_changed 기록.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:296 (setUserStatusViaRpc)`
- `src/features/users/pages/users-page.tsx:294 (setUserStatusSafe — 목록 정지/해제)`
- `src/features/users/pages/user-detail-page.tsx:402 (setUserStatusSafe — 상세 정지/해제)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `target_id` | uuid | 필수 | 대상 회원 id. |
| `new_status` | text | 필수 | 'active' 또는 'blocked'만. 프론트는 UserStatus '정지'→'blocked', 그외→'active'로 변환 후 전송. '탈퇴'는 프론트(D-F)와 서버 양쪽에서 차단. |

**기대 Response**:
```ts
uuid — 변경된 target_id를 그대로 반환. 프론트는 반환값 미사용(에러만 체크).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | uuid | 변경된 회원 id. |

**비고(권한·예외)**: platform_admin 전용. 예외: unauthenticated / 'forbidden: platform_admin required' / 'target_id required' / 'invalid status: X (only active|blocked)' / 'unknown user id' / 'cannot change status of a deleted user' / 'user already <status>'. profiles.status를 FOR UPDATE 잠금 후 갱신. protect_profile_columns 트리거가 platform_admin의 status 토글을 bypass 허용(SECURITY DEFINER 경로). 감사 diff={status:{from,to}}, payload={app_role}. 정의: supabase/migrations-admin/20260617210000_admin_users_directory.sql. mock 모드에서는 no-op 성공.

### `admin_list_user_memos` · RPC · rpc
> 🟢 **쉬운 설명**: 회원에게 남긴 관리자 메모 목록을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 메모 작성자·내용·작성일이 최신순으로 돌아온다

**자세한 목적**: 회원 상세 > 관리자 메모 탭 목록. admin-owned public.user_admin_memos를 user_id로 조회(created_at desc).

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:380 (getUserMemosFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:255,267 (getUserMemos)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_user_id` | text | 필수 | 대상 회원 user_id(text — uuid 문자열). 메모 테이블은 v13 profiles에 FK 없는 loose ref. |

**기대 Response**:
```ts
set of rows: { id: text; admin_name: text; content: text; created_at: timestamptz }. 프론트 매핑 → UserAdminMemo { id; admin(=admin_name); content; createdAt('YYYY-MM-DD' slice) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 메모 id('UMEMO-...'). |
| `admin_name` | text | 작성 관리자 표시명(작성 시점 display_name/nickname/uid). |
| `content` | text | 메모 본문. |
| `created_at` | timestamptz | 작성 시각(프론트가 YYYY-MM-DD로 slice). |

**비고(권한·예외)**: is_admin 가드(content_admin 포함 모든 admin). NULL caller→unauthenticated, 비-admin→'forbidden: admin required'. SECURITY DEFINER, STABLE. 테이블 RLS=admin select만, 쓰기는 RPC 전용. 정의: supabase/migrations-admin/20260618125000_user_admin_memos.sql.

### `admin_add_user_memo` · RPC · rpc
> 🟢 **쉬운 설명**: 회원에게 관리자 메모를 새로 남긴다
> 🔵 **돌아오는 값(쉽게)**: 새로 만든 메모의 번호가 돌아온다

**자세한 목적**: 회원 상세 메모 추가(write). user_admin_memos insert + admin_audit_logs(user_memo_added) 기록.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:553 (addUserMemoViaRpc)`
- `src/features/users/pages/user-detail-page.tsx:312 (addUserMemo)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_user_id` | text | 필수 | 대상 회원 user_id(text). |
| `p_content` | text | 필수 | 메모 본문(공백 불가). |
| `p_reason` | text | 필수 | 작성 사유(감사 기록용, 공백 불가). |

**기대 Response**:
```ts
text — 생성된 메모 id('UMEMO-...'). 프론트는 String(data)로 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성된 메모 id. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'user id required' / 'content required' / 'reason required'. SECURITY DEFINER. admin_name은 호출자 profiles.display_name/nickname/uid에서 산출. 감사 payload에 content_preview(앞 80자). mock 모드에서는 가짜 id 반환. 정의: 20260618125000_user_admin_memos.sql.

### `admin_delete_user_memo` · RPC · rpc
> 🟢 **쉬운 설명**: 회원에게 남긴 관리자 메모를 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제한 메모의 번호가 돌아온다(성공 확인용)

**자세한 목적**: 회원 상세 메모 삭제(write). user_admin_memos delete + admin_audit_logs(user_memo_deleted) 기록.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:577 (deleteUserMemoViaRpc)`
- `src/features/users/pages/user-detail-page.tsx:333 (deleteUserMemo)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_memo_id` | text | 필수 | 삭제할 메모 id. |
| `p_reason` | text | 필수 | 삭제 사유(감사용, 공백 불가). |

**기대 Response**:
```ts
text — 삭제된 메모 id를 그대로 반환. 프론트는 String(data).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 삭제된 메모 id(p_memo_id). |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'reason required' / 'unknown memo id: X'(존재하지 않으면). SECURITY DEFINER. 감사 target_id=메모가 속한 user_id. 정의: 20260618125000_user_admin_memos.sql.

### `admin_get_user_community_posts` · RPC · rpc
> 🟢 **쉬운 설명**: 회원이 쓴 커뮤니티 글 목록을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 글 제목·게시판·상태·신고 수·작성일이 최신순으로 돌아온다

**자세한 목적**: 회원 상세 > 커뮤니티 탭. admin-owned public.community_posts를 author_id로 read-only 조회(created_at desc).

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:351 (getUserCommunityPostsFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:243 (getUserCommunityPosts)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_user_id` | text | 필수 | 대상 회원 author_id(text). 프론트가 userId 전송. |
| `p_limit` | int | - | 최대 건수(기본 100, 1~500 clamp). 프론트는 100 전송. |

**기대 Response**:
```ts
set of rows: { id: text; title: text; board: text; status: text; reports_count: int; created_at: timestamptz }. 프론트 매핑 → UserCommunityPost { id; title; board; createdAt('YYYY-MM-DD'); reports(=reports_count); status(published→게시, hidden→숨김, 그외 원본) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 게시글 id. |
| `title` | text | 제목. |
| `board` | text | 게시판. |
| `status` | text | 게시 상태(published/hidden 등). 프론트가 한글 라벨로 변환. |
| `reports_count` | int | 신고 수. |
| `created_at` | timestamptz | 작성 시각(프론트 YYYY-MM-DD slice). |

**비고(권한·예외)**: is_admin 가드. NULL caller→unauthenticated, 비-admin→'forbidden: admin required'. SECURITY DEFINER, STABLE, read-only. ⚠️주의: dev seed의 community_posts.author_id가 mock text id라 실제 profiles uuid로는 빈 결과(author_id↔profiles 연결은 후속 데이터 작업). 정의: 20260618124000_admin_user_community_posts.sql.

### `admin_get_user_activity` · RPC · rpc
> 🟢 **쉬운 설명**: 회원의 활동 내역을 가져온다(보기 전용)
> 🔵 **돌아오는 값(쉽게)**: 활동 종류·내용·IP·발생 시각이 최신순으로 돌아온다

**자세한 목적**: 회원 상세 > 활동 탭. admin-owned public.user_activity_events를 user_id로 read-only 조회(created_at desc). 표시 전용(쓰기/감사 없음).

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:406 (getUserActivityFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:281 (getUserActivity)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_user_id` | uuid | 필수 | 대상 회원 user_id(uuid). community/memo와 달리 uuid 타입. |
| `p_limit` | int | - | 최대 건수(기본 100, 최소 1). 프론트는 100 전송. |

**기대 Response**:
```ts
set of rows: { id: text; event_type: text; content: text; ip: text; created_at: text }. created_at은 KST 텍스트('YYYY-MM-DD HH24:MI'). 프론트 매핑 → UserActivityEvent { id; type(=event_type); content; createdAt(=created_at 그대로); ip }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 이벤트 id. |
| `event_type` | text | 이벤트 종류(로그인/게시글 등). |
| `content` | text | 이벤트 내용. |
| `ip` | text | IP. |
| `created_at` | text (KST) | 발생 시각 KST 표시 문자열 'YYYY-MM-DD HH24:MI'(timestamptz 아님). |

**비고(권한·예외)**: is_admin 가드. NULL caller→unauthenticated, 비-admin→'forbidden: admin required'. SECURITY DEFINER, STABLE, read-only(표시 탭이라 write/audit RPC 없음 — system_logs 선례). datetime은 Asia/Seoul 변환 후 to_char. 정의: supabase/migrations-admin/20260619130000_user_detail_tabs.sql.

### `admin_get_user_payments` · RPC · rpc
> 🟢 **쉬운 설명**: 회원의 결제 내역을 가져온다(보기 전용)
> 🔵 **돌아오는 값(쉽게)**: 상품명·금액·결제수단·상태·결제일이 최신순으로 돌아온다

**자세한 목적**: 회원 상세 > 결제 탭. admin-owned public.user_payment_records를 user_id로 read-only 조회(paid_at desc). 표시 전용.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:494 (getUserPaymentsFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:286 (getUserPayments)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_user_id` | uuid | 필수 | 대상 회원 user_id(uuid). |
| `p_limit` | int | - | 최대 건수(기본 100, 최소 1). 프론트는 100 전송. |

**기대 Response**:
```ts
set of rows: { id: text; product: text; amount_krw: int; method: text; status: text; paid_at: text|null }. paid_at은 'YYYY-MM-DD' 텍스트(date를 to_char). 프론트 매핑 → UserPaymentRecord { id; product; amount(='₩'+amount_krw.toLocaleString()); method; paidAt(=paid_at ?? ''); status }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 결제 레코드 id. |
| `product` | text | 상품명. |
| `amount_krw` | int | 결제 금액(원). 프론트가 ₩ 포맷팅. |
| `method` | text | 결제 수단(카드/계좌이체 등). |
| `status` | text | 결제 상태(완료/환불 등). |
| `paid_at` | text\|null | 결제일 'YYYY-MM-DD' 문자열(date 컬럼 to_char). null이면 ''. |

**비고(권한·예외)**: is_admin 가드, SECURITY DEFINER, STABLE, read-only. 정렬 paid_at desc nulls last → id desc. 정의: 20260619130000_user_detail_tabs.sql.

### `admin_get_user_access_logs` · RPC · rpc
> 🟢 **쉬운 설명**: 회원의 접속 기록을 가져온다(보기 전용)
> 🔵 **돌아오는 값(쉽게)**: 접속 종류·IP·기기·접속 시각이 최신순으로 돌아온다

**자세한 목적**: 회원 상세 > 접속 로그 탭. admin-owned public.user_access_logs를 user_id로 read-only 조회(created_at desc). 표시 전용.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:523 (getUserAccessLogsFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:291 (getUserAccessLogs)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_target_user_id` | uuid | 필수 | 대상 회원 user_id(uuid). |
| `p_limit` | int | - | 최대 건수(기본 100, 최소 1). 프론트는 100 전송. |

**기대 Response**:
```ts
set of rows: { id: text; log_type: text; ip: text; device: text; created_at: text }. created_at은 KST 텍스트('YYYY-MM-DD HH24:MI'). 프론트 매핑 → UserAccessLog { id; type(=log_type); ip; device; createdAt(=created_at) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | text | 로그 id. |
| `log_type` | text | 로그 종류(로그인/API 등). |
| `ip` | text | IP. |
| `device` | text | 기기/브라우저. |
| `created_at` | text (KST) | 접속 시각 KST 표시 'YYYY-MM-DD HH24:MI'. |

**비고(권한·예외)**: is_admin 가드, SECURITY DEFINER, STABLE, read-only. datetime Asia/Seoul 변환. 정의: 20260619130000_user_detail_tabs.sql.

### `admin_get_user_legal_consents` · RPC · rpc
> 🟢 **쉬운 설명**: 회원이 동의한 약관 내역을 가져온다
> 🔵 **돌아오는 값(쉽게)**: 이용약관·개인정보 동의 버전과 지금 버전과 같은지 여부가 돌아온다

**자세한 목적**: 회원 상세 > 약관 동의 탭. v13 user_consents⋈legal_documents를 read-only 참조해 회원이 동의한 doc_type(이용약관/개인정보)별 최신 동의 1건 + 현재 게시 버전 일치 여부(is_current)를 반환.

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:465 (getUserLegalConsentsFromSupabase)`
- `src/features/users/pages/user-detail-page.tsx:296 (getUserLegalConsents)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_user_id` | uuid | 필수 | 대상 회원 user_id(uuid). |

**기대 Response**:
```ts
set of rows: { doc_type: text; version: text; title: text; source: text; accepted_at: text(KST 'YYYY-MM-DD HH24:MI'); is_current: boolean }. 프론트 매핑 → UserLegalConsent { docType; docLabel(terms→이용약관/privacy→개인정보 처리방침/그외 원본); version; title; source(signup→가입 시/re_consent→재동의/settings→설정 변경/그외 원본); acceptedAt(=accepted_at); isCurrent }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `doc_type` | text | 약관 종류(terms/privacy 등). 프론트가 한글 라벨로 변환. |
| `version` | text | 회원이 동의한 버전. |
| `title` | text | legal_documents.title(없으면 doc_type). |
| `source` | text | 동의 경로(signup/re_consent/settings). 프론트가 한글 변환. |
| `accepted_at` | text (KST) | 동의 시각 KST 표시 'YYYY-MM-DD HH24:MI'. |
| `is_current` | boolean | 동의한 버전이 현재 published 최신 버전과 일치하는지. |

**비고(권한·예외)**: is_admin 가드(NULL→unauthenticated, 비-admin→'forbidden: admin required'). SECURITY DEFINER, STABLE, read-only(get_admin_users 선례). distinct on(doc_type)으로 doc_type별 최신 1건. 정의: supabase/migrations-admin/20260622160000_user_legal_consents_read.sql.

### `admin_list_instructors` · RPC · rpc
> 🟢 **쉬운 설명**: 강사 목록을 상세 정보까지 묶어 가져온다
> 🔵 **돌아오는 값(쉽게)**: 강사 이름·이메일·소속·상태·수업/수강생 수 등 상세 목록이 돌아온다

**자세한 목적**: 강사 관리 목록. admin-owned public.instructors 전체 상세(중첩 jsonb + 강사 메모 포함) 반환 — 목록/상세 드로어를 데이터소스 교체만으로 동작시키기 위해 list가 full detail을 반환.

**사용 위치**:
- `src/features/users/api/supabase-instructors-service.ts:95 (loadInstructorsFromSupabase — rpc('admin_list_instructors',{p_search:null,p_status:null,p_activity_status:null,p_organization:null,p_country:null}))`
- `src/features/users/pages/instructor-management-page.tsx:337 (fetchInstructorsSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_search` | text\|null | - | id/real_name/email ILIKE 검색. 프론트는 null 전송. |
| `p_status` | text\|null | - | 상태 필터(정상/정지/탈퇴). 프론트는 null. |
| `p_activity_status` | text\|null | - | 활동 상태 필터(활성/주의/휴면). 프론트는 null. |
| `p_organization` | text\|null | - | 소속 필터. 프론트는 null. |
| `p_country` | text\|null | - | 국가 필터. 프론트는 null. |

**기대 Response**:
```ts
set of rows(InstructorRow): { id:text; real_name:text; email:text; nickname:text; organization:text; country:text; status:text; activity_status:text; assignment_status:text; course_count:int|null; student_count:int|null; last_activity_at:text|null; last_action_at:text|null; message_group_id:text|null; message_group_name:text|null; specialties:jsonb(string[]); introduction:text|null; assigned_courses:jsonb([{id,title,level,studentCount,status}]); recent_messages:jsonb([{id,channel,title,sentAt,status}]); admin_notes:jsonb([{id,adminName,content,createdAt:'YYYY-MM-DD'}]) }. 프론트 매핑 → InstructorDetail(camelCase, null→''/0/[]).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `specialties` | jsonb(string[]) | 전문 분야 배열. |
| `assigned_courses` | jsonb(array) | 담당 과정 요약(denormalized). InstructorCourseSummary 형태. |
| `recent_messages` | jsonb(array) | 최근 메시지 이력(denormalized). InstructorMessageHistory 형태. |
| `admin_notes` | jsonb(array) | instructor_admin_notes 조인 집계. {id, adminName, content, createdAt} — createdAt은 'YYYY-MM-DD'. |
| `last_activity_at / last_action_at` | text\|null | 표시용 텍스트 타임스탬프(timestamptz 아님, 테이블에 text로 저장). |

**비고(권한·예외)**: is_admin 가드. NULL→unauthenticated, 비-admin→'forbidden: admin required'. SECURITY DEFINER, STABLE. ⚠️계약 진화: 초기본(20260619100000)은 중첩 jsonb/admin_notes 없는 summary였고, 20260619110000이 drop+recreate로 full detail 반환(CREATE OR REPLACE는 반환형 확장 불가). ⚠️seed 값(country '대한민국', organization '본사 직속/파트너 기관')이 TS union(InstructorCountry='한국'..., InstructorOrganization='서울 TOPIK 센터'...)과 불일치 — 프론트는 as 캐스팅으로 통과시키지만 표시/필터 불일치 가능. 정의: 20260619100000_instructors.sql, 20260619110000_instructors_list_full.sql.

### `admin_get_instructor` · RPC · rpc
> 🟢 **쉬운 설명**: 강사 한 명의 상세 정보를 가져온다
> 🔵 **돌아오는 값(쉽게)**: 그 강사의 이름·소속·상태·메모 등 상세 정보가 돌아온다

**자세한 목적**: 강사 상세 단건 조회. instructors + instructor_admin_notes 집계 1행 반환. 상태 변경(set_instructor_status) 후 재조회에 사용.

**사용 위치**:
- `src/features/users/api/supabase-instructors-service.ts:116 (loadInstructorFromSupabase)`
- `src/features/users/api/supabase-instructors-service.ts:148 (setInstructorStatusViaRpc 내부 재조회)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_instructor_id` | text | 필수 | 강사 id(예 'INS-0001'). |

**기대 Response**:
```ts
set of rows(0 or 1) — admin_list_instructors와 동일한 full detail 컬럼셋: { id; real_name; email; nickname; organization; country; status; activity_status; assignment_status; course_count:int; student_count:int; last_activity_at:text; last_action_at:text; message_group_id; message_group_name; specialties:jsonb; introduction:text; assigned_courses:jsonb; recent_messages:jsonb; admin_notes:jsonb }. 프론트는 rows[0]→InstructorDetail, 없으면 null.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(all)` | (same as admin_list_instructors row) | list와 동일 컬럼/형식. admin_notes는 {id,adminName,content,createdAt:'YYYY-MM-DD'} 배열. |

**비고(권한·예외)**: is_admin 가드, SECURITY DEFINER, STABLE. 미존재 id면 0행→프론트 null. 정의: 20260619100000_instructors.sql.

### `admin_set_instructor_status` · RPC · rpc
> 🟢 **쉬운 설명**: 강사를 정지·해제·탈퇴 처리한다
> 🔵 **돌아오는 값(쉽게)**: 처리 후 바뀐 강사 상세 정보를 다시 받아 화면에 보여준다

**자세한 목적**: 강사 정지/해제/탈퇴 처리(write). instructors.status 갱신 + admin_audit_logs(instructor_status_changed) 기록. 프론트는 성공 후 admin_get_instructor로 재조회.

**사용 위치**:
- `src/features/users/api/supabase-instructors-service.ts:137 (setInstructorStatusViaRpc)`
- `src/features/users/pages/instructor-management-page.tsx:440 (setInstructorStatusSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_instructor_id` | text | 필수 | 강사 id. |
| `p_status` | text | 필수 | '정상'\|'정지'\|'탈퇴'. InstructorStatus 한글값 그대로 전송. |
| `p_reason` | text | 필수 | 변경 사유(공백 불가). 프론트가 trim 후 빈값이면 클라이언트에서 먼저 차단. |

**기대 Response**:
```ts
text — 변경된 p_instructor_id 반환. 단, 프론트 setInstructorStatusViaRpc는 이 반환을 무시하고 admin_get_instructor 결과(InstructorDetail|null)를 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 강사 id(서버 RPC 반환). 프론트는 재조회 후 InstructorDetail로 대체. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'invalid status: X' / 'reason required' / 'unknown instructor id' / 'instructor already <status>'. FOR UPDATE 잠금. 감사 diff={status:{from,to}}, payload={reason}, target_table='Instructor'. 정의: 20260619100000_instructors.sql.

### `admin_list_referrals` · RPC · rpc
> 🟢 **쉬운 설명**: 추천인(추천 코드) 목록을 집계와 함께 가져온다
> 🔵 **돌아오는 값(쉽게)**: 추천 코드·추천인·추천/확정 수·총 보상·이상치 여부가 돌아온다

**자세한 목적**: 추천인 관리 목록. admin-owned referrals + 중첩 relations/reward_ledger + 읽기 시 파생 집계(추천/확정 수, 총 보상, 이상치 플래그, last_used_at)를 반환. 보상 정책은 미확정(STUB).

**사용 위치**:
- `src/features/users/api/supabase-referrals-service.ts:102 (loadReferralsFromSupabase — rpc('admin_list_referrals',{p_search:null,p_status:null,p_anomaly_status:null}))`
- `src/features/users/pages/users-referrals-page.tsx:391 (fetchReferralsSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_search` | text\|null | - | code/referrer_user_id/referrer_name ILIKE 검색. 프론트는 null. |
| `p_status` | text\|null | - | 상태 필터(활성/비활성). 프론트는 null. |
| `p_anomaly_status` | text\|null | - | 이상치 상태 필터(없음/검토 필요/검토 완료). 프론트는 null. |

**기대 Response**:
```ts
set of rows(ReferralRow): { id:text; code:text; referrer_user_id:text|null; referrer_name:text|null; referrer_email:text|null; created_at:text|null; expires_at:text|null; last_used_at:text(파생, relations 최대 confirmed_at/joined_at); last_action_at:text|null; status:text; anomaly_status:text; anomaly_flags:jsonb(string[], 파생); referred_count:int(파생); confirmed_count:int(파생, status='완료'); total_reward_amount:int(파생, ledger status='완료' 합); admin_memo:text; relations:jsonb([{id,referredUserId,referredUserName,joinedAt,confirmedAt,status,anomalyFlag,reviewNote}]); reward_ledger:jsonb([{id,relationId,entryType,rewardMethodLabel,amount,status,actedAt,reason}]); policy_snapshot:jsonb({version,confirmationTiming,rewardMethod,manualAdjustmentAuthority,rollbackRule,note}) }. 프론트 매핑 → ReferralSummary(camelCase, policy_snapshot null이면 DEFAULT_POLICY).
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `last_used_at` | text (derived) | relations의 max(confirmed_at\|joined_at). 없으면 ''. |
| `anomaly_flags` | jsonb(string[], derived) | relations.anomaly_flag distinct(빈값 제외). 없으면 []. |
| `referred_count` | int (derived) | relations 행 수. |
| `confirmed_count` | int (derived) | relations status='완료' 수. |
| `total_reward_amount` | int (derived) | reward_ledger status='완료' amount 합. |
| `reward_ledger` | jsonb(array) | 보상 원장. rewardMethodLabel은 STUB='정책 미확정'. |
| `policy_snapshot` | jsonb(object) | 정책 스냅샷 — 전부 '미확정' STUB(confirmationTiming/rewardMethod/manualAdjustmentAuthority/rollbackRule). |

**비고(권한·예외)**: is_admin 가드, SECURITY DEFINER, STABLE. 파생 필드는 denormalize 없이 읽기 시 계산. referrer/referred user id는 v13 profiles loose text ref(FK 없음). 보상 정책 미확정(page-sync §13) — 구조만 구축. 정의: supabase/migrations-admin/20260619120000_referrals.sql.

### `admin_set_referral_status` · RPC · rpc
> 🟢 **쉬운 설명**: 추천 코드를 활성 또는 비활성으로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 성공 후 목록을 다시 불러와 바뀐 상태를 보여준다

**자세한 목적**: 추천 코드 활성/비활성(write). referrals.status + last_action_at 갱신 + admin_audit_logs(referral_status_changed) 기록.

**사용 위치**:
- `src/features/users/api/supabase-referrals-service.ts:124 (setReferralStatusViaRpc)`
- `src/features/users/pages/users-referrals-page.tsx:564 (setReferralStatusSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_referral_id` | text | 필수 | 추천 id(예 'REF-0001'). |
| `p_status` | text | 필수 | '활성'\|'비활성'. ReferralStatus 한글값. |
| `p_reason` | text | 필수 | 사유(공백 불가). |

**기대 Response**:
```ts
text — p_referral_id 반환. 프론트 setReferralStatusViaRpc는 반환 무시(void), 페이지가 재조회.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 추천 id. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'invalid status: X' / 'reason required' / 'unknown referral id' / 'referral already <status>'. FOR UPDATE. 감사 target_table='Referral'. 정의: 20260619120000_referrals.sql.

### `admin_review_referral_anomaly` · RPC · rpc
> 🟢 **쉬운 설명**: 이상해 보이는 추천 건을 검토 완료로 표시한다
> 🔵 **돌아오는 값(쉽게)**: 검토 완료로 바뀌며 목록을 다시 불러와 보여준다

**자세한 목적**: 추천 이상치 검토 완료 처리(write). anomaly_status='검토 완료'로 변경 + admin_memo에 검토 내역 append + admin_audit_logs(referral_anomaly_reviewed) 기록.

**사용 위치**:
- `src/features/users/api/supabase-referrals-service.ts:143 (reviewReferralAnomalyViaRpc)`
- `src/features/users/pages/users-referrals-page.tsx:560 (reviewReferralAnomalySafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_referral_id` | text | 필수 | 추천 id. |
| `p_reason` | text | 필수 | 검토 사유/근거(공백 불가). admin_memo에 줄 추가됨. |

**기대 Response**:
```ts
text — p_referral_id 반환. 프론트는 void 취급, 재조회로 갱신.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 추천 id. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'reason required' / 'unknown referral id'. FOR UPDATE. admin_memo += '\n- <KST> 이상치 검토 완료: <reason>'. 감사 diff={anomaly_status:{from,to:'검토 완료'}}. 정의: 20260619120000_referrals.sql.

### `admin_adjust_referral_reward` · RPC · rpc
> 🟢 **쉬운 설명**: 추천 보상을 관리자가 수동으로 더하거나 회수한다
> 🔵 **돌아오는 값(쉽게)**: 보정 기록 한 건이 남고 그 기록 번호가 돌아온다

**자세한 목적**: 추천 보상 수동 보정(write, POLICY STUB). referral_reward_ledgers에 감사 원장 1건 insert만 — 확정/회수 자동화 없음. amount 부호로 entry_type 결정(>=0 '수동 보정', <0 '회수'). admin_audit_logs(referral_reward_adjusted) 기록.

**사용 위치**:
- `src/features/users/api/supabase-referrals-service.ts:162 (adjustReferralRewardViaRpc)`
- `src/features/users/pages/users-referrals-page.tsx:642 (adjustReferralRewardSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_referral_id` | text | 필수 | 추천 id. |
| `p_amount` | int | 필수 | 보정 금액(원). 음수=회수. null 불가. |
| `p_reason` | text | 필수 | 사유(공백 불가). |

**기대 Response**:
```ts
text — 생성된 ledger id('ADJ-<uuid hex>'). 프론트는 String(data)로 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성된 보상 원장 id. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'amount required'(null) / 'reason required' / 'unknown referral id'. STUB: reward_method_label='정책 미확정', status='완료' 원장만 기록(보상 확정/회수 정책 미구현). referrals.last_action_at 갱신. 정의: 20260619120000_referrals.sql.

### `admin_list_institution_codes` · RPC · rpc
> 🟢 **쉬운 설명**: 기관/박람회 코드 목록을 소속 회원 수와 함께 가져온다
> 🔵 **돌아오는 값(쉽게)**: 코드·이름·종류·상태·소속 회원 수가 돌아온다

**자세한 목적**: 기관/박람회 코드 카탈로그 목록. admin-owned public.institution_codes + member_count(profiles.affiliation_code 집계) 반환.

**사용 위치**:
- `src/features/users/api/supabase-institution-codes-service.ts:66 (loadInstitutionCodesFromSupabase)`
- `src/features/users/pages/institution-codes-page.tsx (목록 — institution-codes-service 경유)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_search` | text\|null | - | code/label ILIKE 검색. 프론트는 입력값 trim 후 빈값이면 null. |
| `p_status` | text\|null | - | 상태 필터('활성'\|'종료'). 프론트는 status ?? null. |

**기대 Response**:
```ts
set of rows(InstitutionCodeRow): { code:text; label:text; kind:text; status:text; note:text|null; member_count:bigint|null; created_at:timestamptz|null; updated_at:timestamptz|null }. 프론트 매핑 → InstitutionCode { code; label; kind('박람회'|'기관'|'캠페인'|'기타'); status('활성'|'종료'); note(=note ?? ''); memberCount(=member_count ?? 0); createdAt('YYYY-MM-DD' slice); updatedAt('YYYY-MM-DD' slice) }
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `code` | text | 코드(PK, ^[A-Za-z0-9_-]{2,64}$). QR/가입 시 profiles.affiliation_code 값. |
| `label` | text | 표시명. |
| `kind` | text | 박람회\|기관\|캠페인\|기타. |
| `status` | text | 활성\|종료. |
| `note` | text\|null | 비고. |
| `member_count` | bigint | 이 코드로 가입한 회원 수(profiles.affiliation_code=code 카운트). v13 컬럼 적용 전엔 0. |
| `created_at / updated_at` | timestamptz\|null | 생성/수정 시각(프론트가 YYYY-MM-DD slice). |

**비고(권한·예외)**: is_admin 가드, SECURITY DEFINER, STABLE. created_at desc 정렬. member_count는 v13 profiles.affiliation_code 컬럼이 먼저 존재해야 정상 집계(없으면 호출 실패 가능). 정의: supabase/migrations-admin/20260619140000_institution_codes.sql.

### `admin_create_institution_code` · RPC · rpc
> 🟢 **쉬운 설명**: 기관/박람회 코드를 새로 만든다
> 🔵 **돌아오는 값(쉽게)**: 새로 만든 코드 값이 돌아온다

**자세한 목적**: 기관/박람회 코드 생성(write). institution_codes insert + admin_audit_logs(institution_code_created) 기록.

**사용 위치**:
- `src/features/users/api/supabase-institution-codes-service.ts:85 (createInstitutionCodeViaRpc)`
- `src/features/users/pages/institution-codes-page.tsx:173 (createInstitutionCodeSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_code` | text | 필수 | 코드. ^[A-Za-z0-9_-]{2,64}$ 검증. 프론트가 trim 후 전송. |
| `p_label` | text | 필수 | 표시명(빈값 불가). |
| `p_kind` | text | - | '박람회'(기본)\|'기관'\|'캠페인'\|'기타'. 프론트는 input.kind 전송. |
| `p_note` | text\|null | - | 비고. 프론트는 trim 후 빈값이면 null. |

**기대 Response**:
```ts
text — 생성된 code 반환. 프론트는 data ?? 입력 code.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 생성된 코드(PK). |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'invalid code (letters/digits/-/_ , 2-64 chars)' / 'label required' / 'invalid kind' / 'code already exists'. created_by=호출자 uid. 정의: 20260619140000_institution_codes.sql.

### `admin_update_institution_code` · RPC · rpc
> 🟢 **쉬운 설명**: 기관/박람회 코드의 이름·종류·상태·메모를 수정한다
> 🔵 **돌아오는 값(쉽게)**: 수정한 코드 값이 돌아온다(코드 자체는 못 바꿈)

**자세한 목적**: 기관/박람회 코드 수정(write). label/kind/status/note 갱신 + admin_audit_logs(institution_code_updated) 기록. code(PK)는 변경 불가.

**사용 위치**:
- `src/features/users/api/supabase-institution-codes-service.ts:112 (updateInstitutionCodeViaRpc)`
- `src/features/users/pages/institution-codes-page.tsx:236 (updateInstitutionCodeSafe)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_code` | text | 필수 | 수정 대상 코드(PK, 식별자). |
| `p_label` | text | 필수 | 표시명(빈값 불가). |
| `p_kind` | text | 필수 | '박람회'\|'기관'\|'캠페인'\|'기타'. |
| `p_status` | text | 필수 | '활성'\|'종료'. |
| `p_note` | text\|null | - | 비고. 프론트는 trim 후 빈값이면 null. |
| `p_reason` | text | 필수 | 수정 사유(감사용, 공백 불가). |

**기대 Response**:
```ts
text — p_code 반환. 프론트는 data ?? input.code.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(return)` | text | 수정된 코드. |

**비고(권한·예외)**: is_admin 가드. 예외: unauthenticated / 'forbidden: admin required' / 'reason required' / 'label required' / 'invalid kind' / 'invalid status' / 'unknown code'. FOR UPDATE. 감사 diff={label/kind/status:{from,to}}, payload={reason}. 정의: 20260619140000_institution_codes.sql.

### `profiles` · 테이블 · select
> 🟢 **쉬운 설명**: 비어 있는 회원 닉네임을 따로 조회해 채워 넣는다
> 🔵 **돌아오는 값(쉽게)**: 회원 번호와 닉네임 짝이 돌아와 목록의 빈 닉네임을 보완한다

**자세한 목적**: 회원 닉네임 보강용 직접 select. get_admin_users 결과에서 nickname이 NULL/빈값인 행을 채우기 위해 id 배열로 profiles.id,nickname을 조회(loadProfileNicknameMap).

**사용 위치**:
- `src/features/users/api/supabase-users-service.ts:227 (loadProfileNicknameMap — supabaseClient.from('profiles').select('id,nickname').in('id', userIds))`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `select` | string | 필수 | 'id,nickname' 컬럼만 선택. |
| `.in('id', userIds)` | uuid[] | 필수 | get_admin_users로 받은 user_id 목록(빈 배열이면 호출 생략). |

**기대 Response**:
```ts
{ id: string; nickname: string|null }[] — 프론트는 Map<id, nickname(trim 후 빈값은 null)>으로 변환해 AdminUserRow.nickname 보강.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | 회원 id. |
| `nickname` | text\|null | 닉네임. trim 후 빈값은 null로 정규화. |

**비고(권한·예외)**: v13 소유 테이블, PostgREST 직접 select(RPC 아님). 인증된 사용자 세션의 RLS가 적용됨(SECURITY DEFINER 우회 없음) — error 시 빈 Map 반환(닉네임 보강 실패해도 목록은 표시). 회원 목록 외 다른 도메인 화면에서도 profiles를 다양하게 참조하나, users 도메인에서의 직접 테이블 접근은 이 한 곳뿐(나머지는 모두 RPC 경유). v13 profiles RLS가 다른 회원의 nickname 읽기를 허용하는지 백엔드 확인 필요(허용 안 되면 보강이 조용히 실패).

## notifications (알림 발송/템플릿/그룹)
_관리자가 알림을 작성해 발송하고, 알림 템플릿과 발송 대상 그룹을 관리하는 영역입니다._

### `admin_send_notification` · RPC · rpc
> 🟢 **쉬운 설명**: 관리자가 알림 발송을 실행하거나 예약한다
> 🔵 **돌아오는 값(쉽게)**: 새로 만든 발송 건의 고유 번호가 돌아온다

**자세한 목적**: 활성 템플릿의 발송 실행(dispatch)을 생성한다. 즉시 발송(scheduled_at=null → status=running)과 예약 발송(scheduled_at 지정 → status=scheduled), '나에게 보내기' 테스트(target_type=test, 그룹 없이 본인 대상)를 모두 처리. 실제 대상 산정·전달은 별도 발송 파이프라인이 수행하고, 이 RPC는 ledger 행 1개만 생성한다.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:715 sendNotification() — client.rpc('admin_send_notification', { p_template_id, p_group_ids, p_scheduled_at, p_reason, p_target_type }); test일 때 p_group_ids=[]`
- `src/features/message/api/messages-service.ts:208 sendTemplate() → sendMessageTemplateSafe (supabase 모드만)`
- `src/features/message/pages/message-channel-page.tsx:546 '나에게 보내기'(targetType:'test'), :631 실제 그룹 발송(targetType:'group')`
- `supabase/migrations-admin/20260622170000_legal_terms_change_notification.sql:105 admin_send_terms_change_notification가 내부에서 in_app/email 각 1회 호출(약관변경 공지)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_template_id` | uuid | 필수 | 발송할 notification_templates.id. 반드시 status='active'여야 함(아니면 예외). |
| `p_group_ids` | jsonb (string[]) | 필수 | 대상 그룹 id 배열(JSON 배열). 프런트는 JS string[]을 전달하며 supabase-js가 jsonb로 직렬화. target_type='group'이면 1개 이상 필수(빈 배열/null이면 예외). target_type='test'는 빈 배열([]) 전달. |
| `p_scheduled_at` | timestamptz \| null | 필수 | 예약 시각(ISO). null이면 즉시(running). 프런트는 'YYYY-MM-DD HH:mm' 로컬시각을 toISOString()으로 변환해 전달. |
| `p_reason` | text | 필수 | 운영 사유. 빈 문자열/공백이면 서버가 거부(클라이언트도 선차단). 감사 로그에 기록되며 mandatory 템플릿이면 bypass_reason으로도 기록. |
| `p_target_type` | text | - | 기본값 'group'. 허용값 'group'\|'test'만(서버 CHECK; schedule/event는 admin 경로에서 거부). |

**기대 Response**:
```ts
uuid — 생성된 notification_dispatches.id 단일 스칼라. 프런트 어댑터(sendNotification)는 String(data)로 받아 { id: string }로 래핑해 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(scalar)` | uuid | 새로 생성된 dispatch 행 id. 어댑터가 { id: string }으로 감싼다. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170100_notification_admin_rpcs.sql:292. SECURITY DEFINER, search_path=pg_catalog,public. 가드: auth.uid() 필수, private.is_admin(content_admin/platform_admin) 필수, p_reason 필수, 템플릿 status='active' 필수, group이면 그룹 1개+ 필수. dedupe_key='admin:'+gen_random_uuid()로 매번 신규(중복 차단 안 함). channels는 템플릿 channel 1개로 jsonb_build_array. 감사: admin_audit_logs action='notification_dispatch_created', target_table='Notification', target_id=dispatch id, payload에 template_key/channel/class/mandatory/bypass_reason/target_type/target_group_ids/scheduled_at. grant execute to authenticated. 에러는 supabase error.message가 그대로 throw됨(예: 'forbidden: admin required', 'template not active...', 'group dispatch requires at least one group id').

### `admin_cancel_notification_dispatch` · RPC · rpc
> 🟢 **쉬운 설명**: 예약해 둔 알림 발송을 취소한다
> 🔵 **돌아오는 값(쉽게)**: 취소한 발송 건의 번호가 돌아온다(별도 결과값은 없음)

**자세한 목적**: 예약(scheduled) 상태의 발송 실행을 취소한다(QA N-ADM-11). status를 'canceled'로 전이하면 발송 파이프라인이 더 이상 집행하지 않아 발송 0건. 이미 실행/완료된 건은 취소 불가.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:736 cancelNotificationDispatch() — client.rpc('admin_cancel_notification_dispatch', { p_dispatch_id, p_reason })`
- `src/features/message/api/messages-service.ts:399 cancelDispatch() → cancelNotificationDispatchSafe (멱등성 없어 재시도 안 함)`
- `src/features/message/pages/message-history-page.tsx:931 예약 발송 취소 확인 모달에서 호출`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_dispatch_id` | uuid | 필수 | 취소할 notification_dispatches.id. 존재하지 않으면 'unknown dispatch' 예외. |
| `p_reason` | text | 필수 | 취소 사유. 빈 값이면 거부. 감사 로그에 기록. |

**기대 Response**:
```ts
void (returns void) — RPC 자체는 값을 반환하지 않음. 어댑터(cancelNotificationDispatch)는 입력 dispatchId를 그대로 { id: dispatchId }로 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(none)` | void | 반환값 없음. 성공 시 error만 null. 어댑터가 입력 id를 { id } 로 되돌려줌. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612180000_cancel_dispatch_rpc.sql:16. SECURITY DEFINER. 가드: auth.uid()·private.is_admin·p_reason 필수 + status='scheduled'만 허용('only scheduled dispatches can be canceled (status=%)'). 성공 시 status='canceled', completed_at=now(). 감사: action='notification_dispatch_canceled', target_table='Notification', payload={reason, template_key}. mock 모드에선 예약 lifecycle이 없어 호출 자체가 막힘.

### `admin_save_notification_template` · RPC · rpc
> 🟢 **쉬운 설명**: 알림 템플릿을 새로 만들거나 수정해 저장한다
> 🔵 **돌아오는 값(쉽게)**: 저장된 템플릿 내용(채널/제목/대상 그룹 등)이 돌아온다

**자세한 목적**: 알림 템플릿 insert/update 겸용 저장(upsert). p_id=null이면 신규, 있으면 갱신. 쓰기 단일 경로(직접 INSERT/UPDATE는 RLS 차단). link_url 및 이메일 본문 100KB 가드 포함.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:538 saveNotificationTemplate() — p_template은 DB enum(email/active 등)으로 매핑 후 전달, marketing이면 mandatory 강제 false`
- `src/features/message/api/messages-service.ts:171 saveTemplate() → saveMessageTemplateSafe`
- `src/features/message/pages/message-channel-page.tsx (저장 후 AuditLogLink targetType='Message'), message-template-create-page.tsx`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | uuid \| null | 필수 | null이면 신규 생성, 값이 있으면 해당 행 갱신(없으면 'unknown template id' 예외). |
| `p_template` | jsonb | 필수 | 템플릿 본문 객체. 키: template_key, channel('in_app'\|'email'\|'push'\|'zalo'), class('transactional'\|'operational'\|'learning'\|'marketing'), mandatory(bool), mode('auto'\|'manual'), category('study'\|'exam_schedule'\|'notice'\|'event'\|'marketing'), name, summary, subject, body_html, body_json, variables(jsonb배열), trigger_key, target_group_ids(jsonb배열), status('active'\|'inactive'\|'draft'), link_url. UPDATE는 coalesce로 부분 갱신(단 mandatory는 항상 덮어씀). |
| `p_reason` | text | 필수 | 운영 사유. 빈 값이면 거부. |

**기대 Response**:
```ts
uuid — 저장된 notification_templates.id 단일 스칼라. 어댑터(saveNotificationTemplate)는 이 id로 loadNotificationTemplate를 재호출해 매핑된 MessageTemplate { id, channel('mail'|'push'|'in_app'), mode, category, name, summary, subject, targetGroupIds:string[], status('활성'|'비활성'|'초안'), triggerLabel?, bodyHtml, bodyJson(문자열화 JSON), lastSentAt?(KST텍스트), updatedAt(KST텍스트 'YYYY-MM-DD HH:mm'), updatedBy, templateKey, templateClass, mandatory, linkUrl }를 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(scalar)` | uuid | 저장된 템플릿 행 id. 프런트는 이 id로 SELECT 재조회해 한글 라벨로 매핑. |

**비고(권한·예외)**: 정의 최신본: supabase/migrations-admin/20260612180100_email_body_size_guard.sql:21 (admin-0006/170500에서 link_url 반영, 180100에서 이메일 본문 크기 가드 추가). 가드: auth.uid()·is_admin·reason 필수, class 필수, class='marketing'+mandatory=true 저장 차단(DB CHECK + RPC raise), email 채널 body_html이 102400 bytes 초과 시 차단(Gmail 102KB 클리핑). unique(template_key, channel). 감사: action='notification_template_created'|'notification_template_updated', target_table='Notification'. ⚠️ body_json/변수는 UPDATE 시 coalesce라 명시 안 하면 보존됨. updated_by=caller_id 자동 세팅.

### `admin_delete_notification_template` · RPC · rpc
> 🟢 **쉬운 설명**: 알림 템플릿을 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 템플릿의 마지막 내용이 돌아온다

**자세한 목적**: 알림 템플릿 삭제. 어댑터는 삭제 직전에 행을 한 번 읽어 두고 삭제 후 그 스냅샷을 반환한다(UI에서 삭제된 대상 정보 표시용).

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:601 deleteNotificationTemplate() — 삭제 전 행 스냅샷 read 후 client.rpc('admin_delete_notification_template', { p_id, p_reason })`
- `src/features/message/api/messages-service.ts:195 deleteTemplate() → deleteMessageTemplateSafe`
- `src/features/message/pages/message-channel-page.tsx:469 삭제 결과 AuditLogLink`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | uuid | 필수 | 삭제할 notification_templates.id. 없으면 'unknown template id' 예외. |
| `p_reason` | text | 필수 | 삭제 사유. 빈 값이면 거부. |

**기대 Response**:
```ts
void (returns void). 어댑터(deleteNotificationTemplate)는 삭제 전 loadNotificationTemplate로 읽어둔 MessageTemplate | null을 반환(삭제된 행의 스냅샷). RPC 자체는 값 반환 없음.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(none)` | void | 반환값 없음. 성공 시 error만 null. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170100_notification_admin_rpcs.sql:149. SECURITY DEFINER. 가드: auth.uid()·is_admin·reason 필수. DELETE 시 dispatches.template_id는 ON DELETE SET NULL이므로 발송 이력은 보존. 감사: action='notification_template_deleted', payload={reason, template_key}.

### `admin_set_notification_template_status` · RPC · rpc
> 🟢 **쉬운 설명**: 알림 템플릿을 활성/비활성/초안으로 바꾼다
> 🔵 **돌아오는 값(쉽게)**: 상태가 바뀐 템플릿 내용이 돌아온다

**자세한 목적**: 템플릿 상태 전환(활성/비활성/초안). UI에서는 '활성'/'비활성' 토글에 사용. 동일 상태로의 전환은 거부.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:583 setNotificationTemplateStatus() — client.rpc('admin_set_notification_template_status', { p_id, p_next, p_reason })`
- `src/features/message/api/messages-service.ts:183 toggleTemplate() → toggleMessageTemplateSafe (ToggleMessageTemplatePayload: nextStatus는 '활성'|'비활성'만)`
- `src/features/message/pages/message-channel-page.tsx:1220 상태 변경 확인 모달`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | uuid | 필수 | 대상 notification_templates.id. 없으면 'unknown template id' 예외. |
| `p_next` | text | 필수 | 전환할 상태 'active'\|'inactive'\|'draft'. 프런트는 한글('활성'\|'비활성')을 DB enum으로 매핑해 전달. 현재 상태와 같으면 'template already %' 예외. |
| `p_reason` | text | 필수 | 변경 사유. 빈 값이면 거부. |

**기대 Response**:
```ts
void (returns void). 어댑터(setNotificationTemplateStatus)는 전환 후 loadNotificationTemplate(p_id)로 재조회한 MessageTemplate | null을 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(none)` | void | 반환값 없음. 성공 후 프런트가 SELECT 재조회. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170100_notification_admin_rpcs.sql:106. SECURITY DEFINER. 가드: auth.uid()·is_admin·reason 필수, p_next ∈ {active,inactive,draft}, 현재==next 거부. 감사: action='notification_template_status_changed', diff={status:{from,to}}, payload={reason} — diff/payload는 다른 RPC와 달리 분리 기록.

### `admin_save_notification_group` · RPC · rpc
> 🟢 **쉬운 설명**: 알림 받을 대상 그룹을 새로 만들거나 수정한다
> 🔵 **돌아오는 값(쉽게)**: 저장된 그룹 내용(이름/조건/인원수 등)이 돌아온다

**자세한 목적**: 발송 대상 그룹(정적 명단/조건 기반) insert/update 겸용 저장. p_id=null이면 신규. 쓰기 단일 경로.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:644 saveNotificationGroup() — channels는 DB enum 매핑, 정적 그룹이면 member_count=명단길이, query-builder면 query_config 첨부`
- `src/features/message/api/messages-service.ts:220 saveGroup() → saveMessageGroupSafe`
- `src/features/message/pages/message-groups-page.tsx:1321 저장 결과 AuditLogLink (예상 대상 수=memberCount 표시)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | uuid \| null | 필수 | null이면 신규, 있으면 갱신(없으면 'unknown group id' 예외). |
| `p_group` | jsonb | 필수 | 그룹 객체. 키: name, description, definition_type('static'\|'query'), builder_mode('simple'\|'query-builder'), channels(jsonb배열, DB enum), member_count(int; 정적 그룹만 어댑터가 명단 길이로 세팅), rule_summary(어댑터가 buildGroupRuleSummary로 생성), filters(jsonb), query_config(jsonb; query-builder만), static_member_ids(jsonb 문자열배열), status('active'\|'draft'). UPDATE는 coalesce 부분 갱신. |
| `p_reason` | text | 필수 | 운영 사유. 빈 값이면 거부. |

**기대 Response**:
```ts
uuid — 저장된 notification_groups.id 단일 스칼라. 어댑터(saveNotificationGroup)는 이 id로 loadNotificationGroup 재조회해 MessageGroup { id, name, description, definitionType('정적 그룹'|'조건 기반 그룹'), builderMode, channels:('mail'|'push'|'in_app')[], memberCount, ruleSummary, status('사용중'|'초안'), staticMembers:string[], filters(MessageGroupFilters; normalizeFilters로 보정), queryBuilderText?, queryBuilderConfig?, lastCalculatedAt(KST텍스트), updatedAt(KST텍스트), updatedBy }를 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(scalar)` | uuid | 저장된 그룹 행 id. 프런트가 재조회해 한글 라벨로 매핑. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170100_notification_admin_rpcs.sql:182. SECURITY DEFINER. 가드: auth.uid()·is_admin·reason 필수. last_calculated_at=now() 자동. 감사: action='notification_group_created'|'notification_group_updated', payload={reason, name}. ⚠️조건 기반 그룹의 실제 회원 산정 파이프라인은 미연동(P2): member_count는 정적 그룹만 신뢰 가능, query 그룹은 previewNotificationGroupCount가 null 반환. 약관변경 RPC는 '전체 활성 사용자' 그룹을 직접 INSERT/UPDATE(SECURITY DEFINER 내부 경로).

### `admin_delete_notification_group` · RPC · rpc
> 🟢 **쉬운 설명**: 알림 받을 대상 그룹을 삭제한다
> 🔵 **돌아오는 값(쉽게)**: 삭제된 그룹의 마지막 내용이 돌아온다

**자세한 목적**: 발송 대상 그룹 삭제. 어댑터는 삭제 직전 행을 읽어 두고 삭제 후 스냅샷을 반환.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:686 deleteNotificationGroup() — 삭제 전 스냅샷 read 후 client.rpc('admin_delete_notification_group', { p_id, p_reason })`
- `src/features/message/api/messages-service.ts:257 deleteGroup() → deleteMessageGroupSafe`
- `src/features/message/pages/message-groups-page.tsx:1415 삭제 결과 AuditLogLink, :2028 삭제 확인 모달`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `p_id` | uuid | 필수 | 삭제할 notification_groups.id. 없으면 'unknown group id' 예외. |
| `p_reason` | text | 필수 | 삭제 사유. 빈 값이면 거부. |

**기대 Response**:
```ts
void (returns void). 어댑터(deleteNotificationGroup)는 삭제 전 읽어둔 MessageGroup | null을 반환.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `(none)` | void | 반환값 없음. 성공 시 error만 null. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170100_notification_admin_rpcs.sql:258. SECURITY DEFINER. 가드: auth.uid()·is_admin·reason 필수. 감사: action='notification_group_deleted', payload={reason, name}. 그룹 삭제 시 dispatches.target_group_ids는 FK가 아니라 jsonb 배열이라 자동 정리 안 됨(템플릿에서 새 선택만 차단).

### `notification_templates` · 테이블 · select
> 🟢 **쉬운 설명**: 저장된 알림 템플릿 목록을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 채널별 템플릿의 제목/본문/설정값이 돌아온다

**자세한 목적**: 알림 템플릿 원본 테이블. channel별 변형 행(unique(template_key, channel)). 프런트는 채널별 목록/단건 조회에 직접 SELECT(읽기)하며, 쓰기는 전부 admin RPC 단일 경로(직접 INSERT/UPDATE/DELETE는 RLS로 차단).

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:434 loadNotificationTemplates(channel) — 채널별 목록`
- `src/features/message/api/notification-supabase-adapter.ts:449 loadNotificationTemplate(id) — 단건`
- `api/notifications/dispatch-email.ts:173/189 워커가 subject/body_html/link_url/class 조회(template_id 우선, 없으면 template_key+channel='email'+status='active')`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `channel` | filter eq | - | loadNotificationTemplates: .eq('channel', DB채널). 'in_app'\|'email'\|'push'\|'zalo'. |
| `id` | filter eq | - | loadNotificationTemplate: .eq('id', templateId).maybeSingle(). |
| `order` | order | - | 목록은 updated_at desc 정렬. |

**기대 Response**:
```ts
SELECT 컬럼(TEMPLATE_COLUMNS): { id:uuid, template_key:text, channel:text, class:text, mandatory:boolean, mode:text, category:text, name:text, summary:text, subject:text, body_html:text, body_json:jsonb, variables:jsonb, trigger_key:text|null, target_group_ids:jsonb, status:text, link_url:text|null, last_sent_at:timestamptz|null, updated_by:uuid|null, created_at:timestamptz|null, updated_at:timestamptz|null }. 프런트(mapTemplateRow)가 MessageTemplate(한글 status/채널 라벨, KST텍스트 datetime, bodyJson 문자열화)로 매핑.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `class` | text | 'transactional'\|'operational'\|'learning'\|'marketing'. CHECK 강제. |
| `mandatory` | boolean | 필수 알림 여부. class='marketing'+true는 CHECK로 저장 차단. |
| `status` | text | 'active'\|'inactive'\|'draft'. 발송은 active만 가능. |
| `body_html` | text | email 채널은 octet_length<=102400(100KB) CHECK. |
| `link_url` | text\|null | 인앱 알림 클릭 이동 경로(v13 라우트). 기본 ''. |
| `target_group_ids` | jsonb | 기본 대상 그룹 id 배열(jsonb). |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170000_notification_admin_tables.sql:18. RLS: SELECT는 private.is_admin(authenticated)만, INSERT/UPDATE/DELETE 정책 없음(RPC가 SECURITY DEFINER로 우회). FORCE RLS. CHECK 제약: channel/class/mode/category/status enum, marketing_not_mandatory, email_body_size(102400). 워커는 service_role 키로 접근하므로 RLS 우회. 시드 약관 템플릿 2종(template_key='legal_terms_changed', in_app/email)은 20260622170000에서 적재.

### `notification_groups` · 테이블 · select
> 🟢 **쉬운 설명**: 알림 받을 대상 그룹 목록을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 그룹 이름/조건/인원수 등이 돌아온다

**자세한 목적**: 발송 대상 그룹(정적 명단/조건 기반) 테이블. 프런트가 목록/단건 직접 SELECT(읽기). 쓰기는 admin RPC 단일 경로.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:460 loadNotificationGroups() — 전체 목록`
- `src/features/message/api/notification-supabase-adapter.ts:475 loadNotificationGroup(id) — 단건(저장/재계산 후 재조회)`
- `src/features/message/pages/message-groups-page.tsx 그룹 관리 화면`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | filter eq | - | loadNotificationGroup: .eq('id', groupId).maybeSingle(). |
| `order` | order | - | 목록은 updated_at desc. |

**기대 Response**:
```ts
SELECT 컬럼(GROUP_COLUMNS): { id:uuid, name:text, description:text, definition_type:text('static'|'query'), builder_mode:text('simple'|'query-builder'), channels:jsonb, member_count:integer, rule_summary:text, filters:jsonb, query_config:jsonb|null, static_member_ids:jsonb, status:text('active'|'draft'), last_calculated_at:timestamptz|null, updated_by:uuid|null, created_at:timestamptz|null, updated_at:timestamptz|null }. mapGroupRow가 MessageGroup(한글 definitionType/status, UI 채널, normalizeFilters 보정, KST텍스트 datetime)로 매핑.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `definition_type` | text | 'static'(정적 그룹)\|'query'(조건 기반 그룹). CHECK 강제. |
| `member_count` | integer | 정적 그룹은 명단 길이로 신뢰. 조건 그룹은 산정 파이프라인 미연동(P2). |
| `static_member_ids` | jsonb | 정적 명단 사용자 id 배열. |
| `filters` | jsonb | 조건 기반 필터 객체(country/memberTypes/ageRange 등). UI 스키마와 다를 수 있어 normalizeFilters로 보정. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170000_notification_admin_tables.sql:85. RLS: SELECT는 is_admin만, 쓰기 정책 없음(RPC 경유). FORCE RLS. CHECK: definition_type/builder_mode/status enum. ⚠️ recalculateGroup은 supabase 모드에서 쓰기 없이 단건 재조회만 함(조건 산정 미연동).

### `notification_dispatches` · 테이블 · select
> 🟢 **쉬운 설명**: 관리자 알림 발송 이력을 불러온다
> 🔵 **돌아오는 값(쉽게)**: 최근 발송 건들의 대상/상태/시각 등이 돌아온다

**자세한 목적**: 발송 실행 ledger(관리자 발송 이력 화면의 SoT 1계층). 관리자 1회 발송/스케줄러 1슬롯당 1행. 프런트는 최근 200건 목록을 직접 SELECT(읽기). 행 생성은 admin_send_notification RPC만.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:501 loadNotificationDispatches() — 발송 이력 목록(최근 200)`
- `src/features/message/api/messages-service.ts:380 fetchNotificationDispatchesSafe`
- `src/features/message/pages/message-history-page.tsx:830 이력 테이블 로드, targetType/status 라벨 표시`
- `api/notifications/dispatch-email.ts:166 워커가 dispatch.template_id 조회`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `order` | order | - | created_at desc 정렬, .limit(200). |
| `id` | filter eq (worker) | - | 워커가 .eq('id', dispatch_id)로 template_id 조회(maybeSingle). |

**기대 Response**:
```ts
SELECT 컬럼(DISPATCH_COLUMNS): { id:uuid, template_id:uuid|null, template_key:text, channels:jsonb, target_type:text, target_group_ids:jsonb, recipient_count:integer, status:text, actor_id:uuid|null, reason:text|null, scheduled_at:timestamptz|null, started_at:timestamptz|null, completed_at:timestamptz|null, created_at:timestamptz|null }. mapDispatchRow가 NotificationDispatchListItem { id, createdAt(KST텍스트), templateKey, channels:string[], targetType('group'|'schedule'|'event'|'test'), targetGroupIds:string[], recipientCount, status('draft'|'scheduled'|'running'|'completed'|'partial_failed'|'failed'|'canceled'), actorId, reason, scheduledAt?, startedAt?, completedAt? }로 매핑.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | text | draft\|scheduled\|running\|completed\|partial_failed\|failed\|canceled. CHECK 강제. 즉시=running, 예약=scheduled. |
| `target_type` | text | group\|schedule\|event\|test. CHECK 강제. |
| `recipient_count` | integer | 수신자 수. 생성 시 0(파이프라인이 산정 후 갱신). |
| `dedupe_key` | text unique | (SELECT 미노출) 슬롯/캠페인 재실행 차단용 unique. admin 발송은 'admin:'+uuid로 항상 신규. |
| `target_snapshot` | jsonb | (SELECT 미노출) 발송 시점 대상 스냅샷. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170000_notification_admin_tables.sql:128. RLS: SELECT는 is_admin만, 쓰기 정책 없음(RPC/service_role). FORCE RLS. template_id FK→notification_templates ON DELETE SET NULL. 인덱스: created_at desc, (status) where scheduled/running. 워커 스키마는 Update:never로 표시(워커는 dispatches를 읽기만).

### `notification_delivery_attempts` · 테이블 · select
> 🟢 **쉬운 설명**: 수신자별 알림 전달 결과를 불러온다
> 🔵 **돌아오는 값(쉽게)**: 사람·채널별 성공/실패와 발송 시각이 돌아온다

**자세한 목적**: 수신자×채널 전달 결과(SoT 2계층). 관리자 상세 drawer가 dispatch별 시도 목록을 SELECT(읽기). 이메일 워커는 pending 행을 SELECT 후 status/provider_message_id/error/sent_at을 UPDATE(전달 결과 기록). v13 X-09 발송 이력 패널은 본인 행만 읽는 공유 객체.

**사용 위치**:
- `src/features/message/api/notification-supabase-adapter.ts:517 loadNotificationDispatchAttempts(dispatchId) — 상세 drawer`
- `src/features/message/api/messages-service.ts:386 fetchNotificationDispatchAttemptsSafe`
- `src/features/message/pages/message-history-page.tsx:875 dispatch 상세에서 attempt 로드`
- `api/notifications/dispatch-email.ts:271 워커 pending SELECT, :336/:227 워커 sent/failure UPDATE`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `dispatch_id` | filter eq (admin) | - | loadNotificationDispatchAttempts: .eq('dispatch_id', dispatchId).order(created_at asc). |
| `channel,status (worker)` | filter eq | - | 워커 SELECT: .eq('channel','email').eq('status','pending').order(created_at asc).limit(50). |
| `id (worker update)` | filter eq | - | 워커 UPDATE: .eq('id', attempt.id). |

**기대 Response**:
```ts
admin SELECT 컬럼(ATTEMPT_COLUMNS): { id:uuid, dispatch_id:uuid, user_id:uuid, channel:text, template_key:text|null, status:text, error_code:text|null, error_message:text|null, retry_count:integer, sent_at:timestamptz|null, created_at:timestamptz|null }. mapAttemptRow가 NotificationDeliveryAttemptItem { id, userId, channel, templateKey, status('pending'|'sent'|'failed'|'skipped'|'opted_out'|'deduped'), errorCode?, errorMessage?, retryCount, sentAt?(KST텍스트), createdAt(KST텍스트) }로 매핑. 워커 SELECT는 { id, user_id, dispatch_id, template_key, retry_count, created_at }만 읽음.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `status` | text | pending\|sent\|failed\|skipped\|opted_out\|deduped. CHECK 강제. 워커가 sent/failed/pending(재시도)로 전이. |
| `provider_message_id` | text | (워커 UPDATE 전용 컬럼; admin SELECT엔 미포함) SMTP 전송 성공 시 messageId 기록. |
| `retry_count` | integer | 워커가 실패 시 +1. MAX_RETRY(3) 도달 시 status='failed'(terminal), 미만이면 'pending'으로 되돌려 재시도. |
| `dedupe_key` | text\|null | (SELECT 미노출) 스케줄/이벤트형 중복 차단(부분 unique). 관리자 수동 발송은 null. |

**비고(권한·예외)**: 정의: supabase/migrations-admin/20260612170000_notification_admin_tables.sql:174. RLS: SELECT는 본인(user_id=auth.uid()) 또는 admin(공유 계약 — v13 X-09). 쓰기 정책 없음(service_role 워커가 UPDATE). FORCE RLS. dispatch_id FK→dispatches CASCADE, user_id FK→profiles CASCADE. unique(dispatch_id, user_id, channel). 인덱스: (user_id, created_at desc), (dispatch_id, status). ⚠️ INSERT는 admin RPC가 아니라 발송 파이프라인/디스패처가 생성(이 도메인 코드엔 INSERT 경로 없음).

### `/api/notifications/dispatch-email` · 외부 · POST
> 🟢 **쉬운 설명**: 대기 중인 이메일을 실제로 모아서 발송한다
> 🔵 **돌아오는 값(쉽게)**: 처리·성공·실패 건수가 돌아온다

**자세한 목적**: 이메일 발송 워커(서버리스 핸들러). notification_delivery_attempts에서 channel='email'·status='pending' 행을 배치(최대 50)로 가져와 SMTP로 실제 메일을 전송하고 결과를 기록한다. GET=cron 트리거(Authorization Bearer CRON_SECRET), POST=수동 트리거(x-worker-secret 헤더). 파일: api/notifications/dispatch-email.ts.

**사용 위치**:
- `api/notifications/dispatch-email.ts:377 GET(cron), :385 POST(manual), :393 default fetch 핸들러`
- `frontend 호출 없음 — cron/외부 트리거 전용 워커(프런트 서비스 레이어에서 호출하지 않음)`

**요청 파라미터**:
| 이름 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `Authorization` | header (GET only) | - | GET: 'Bearer <CRON_SECRET>'. 일치해야 200, 아니면 401 unauthorized. |
| `x-worker-secret` | header (POST only) | - | POST: NOTIFICATION_WORKER_SECRET과 일치해야 실행, 아니면 401. |
| `(body)` | none | - | 요청 본문 없음. 대상은 DB의 pending 행. |

**기대 Response**:
```ts
성공: 200 { ok: true, processed: number, sent: number, failed: number }. 인증 실패: 401 { ok: false, error: 'unauthorized' }. SMTP 미구성: 503 { ok: false, error: 'smtp_not_configured' }(attempt 미변경 no-op). 서버 설정 누락: 500 { ok: false, error: 'server_misconfigured' }. pending 조회 실패: 500 { ok: false, error: 'query_failed' }. 메서드 외: 405 { error:'Method Not Allowed', allow:['GET','POST'] }.
```
| 필드 | 타입 | 설명 |
|---|---|---|
| `processed` | number | 이번 배치에서 처리 시도한 attempt 수(<=50). |
| `sent` | number | SMTP 전송 성공으로 status='sent' 기록한 수. |
| `failed` | number | 수신자 이메일 없음/템플릿 없음/SMTP 오류로 실패한 수. |

**비고(권한·예외)**: Vercel/서버리스 함수. transport=커스텀 SMTP(예: Daou Office, nodemailer). 필요 ENV: SMTP_HOST/SMTP_USER/SMTP_PASS(필수, 없으면 503 no-op), SMTP_PORT(기본465, 465=implicit TLS), SMTP_FROM(기본 '도토리 토픽 <guest@keduall.com>'), SUPABASE_URL(또는 VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_SECRET_KEY), CRON_SECRET, NOTIFICATION_WORKER_SECRET, SITE_URL(CTA/수신거부 링크 베이스, 기본 https://app.talkpik.ai). 동작: 각 attempt마다 (1) auth.admin.getUserById로 수신자 이메일 resolve(없으면 'no_recipient_email' 실패), (2) dispatch.template_id→template 또는 template_key+channel=email+status=active로 content resolve(없으면 'no_template' 실패), (3) subject/body의 {{display_name}}을 profiles.display_name(기본 '학습자')로 치환, (4) link_url CTA 링크 추가, class='marketing'이면 user_marketing_consent.unsubscribe_token으로 수신거부 링크 추가, (5) sendMail 성공 시 status='sent'+provider_message_id+sent_at, 실패 시 retry_count+1(>=3이면 'failed' terminal, 미만이면 'pending' 재시도)+error_code('smtp_error')+error_message(500자 절단). 정직성 경계: SMTP resolve 성공 시에만 'sent' 기록. 읽는 테이블: notification_delivery_attempts, notification_dispatches, notification_templates, profiles, user_marketing_consent(전부 service_role RLS 우회).

---

# C. 릴레이 시퀀스 (여러 API가 이어지는 흐름)

## C1. v13 외부 쓰기평가(Writing Evaluation) end-to-end 릴레이  _(v13)_
**한 줄 요약**: 작문 제출 → 외부 AI 채점 → 결과 폴링 → 저장 → 화면 표시까지의 7단계 흐름.
- **언제 시작**: 학습자가 쓰기(작문) 답안을 작성한 뒤 제출 버튼을 누름 → React가 서버 액션 submitWritingAction(input)을 호출(input: draft_id, problem_id, question_no, answer_text, answer_json, char_count). 제출 직후 화면은 FeedbackPendingPanel/SubmittedAnalysisPanel(분석 로딩 모달)로 전환되어 폴링을 시작한다.
- **전체 흐름**: 제출은 두 외부 호출과 두 RPC가 직렬로 엮인 릴레이다. (1) 서버 액션이 먼저 외부 채점기(TALKPIK Writing API)의 POST /api/writing/submit에 답안을 던져 external submission_id와 상태를 받고, (2) 그 id로 로컬 RPC create_external_writing_submission을 호출해 writing_submissions 행을 feedback_status='analyzing'(외부 즉시 failed면 'failed')로 만든 뒤, RPC가 반환한 로컬 submissionId를 클라이언트에 돌려준다(이 id는 draft 멱등성 때문에 external.submission_id와 다를 수 있어 반드시 RPC 반환값을 신뢰). (3) 프론트는 5초 간격·최대 12회로 /api/writing/evaluation-status?submissionId=...를 폴링한다. 이 라우트가 매 호출마다 외부 GET /api/evaluation/{id}로 채점 상태를 묻고, 아직이면 processing→'analyzing'로, 끝났으면(graded) 다시 외부 GET /api/evaluation/{id}/feedback로 점수·trait·annotation을 받아 mapExternalEvaluationFeedback로 우리 스키마(feedback/dimensions/sentences)로 변환한 뒤 (4) RPC sync_external_writing_feedback로 writing_feedback·feedback_dimension_scores·sentence_feedback 세 테이블에 upsert/replace하고 feedback_status='complete'로 승격한다. 외부 채점이 비동기이므로 점수 산출 주체는 우리 DB가 아니라 외부 API이고, 우리 라우트는 그 결과를 폴링으로 끌어와 동기화하는 미러 역할이다. (5) 상태가 complete가 되면 폴링이 멈추고 화면이 새로고침/이동되어 fetchFeedbackBundle이 세 테이블을 읽어 최종 피드백을 렌더한다.

**1. submitWritingAction (Next.js Server Action, "use server")**
   - 입력: SubmitWritingInput { draft_id?, problem_id, question_no, answer_text, answer_json?, char_count }. 내부에서 getUser()로 인증, fetchProfileStatus로 active 계정 검증(deleted/blocked면 redirect), getSession().access_token 확보(없으면 throw).
   - 출력: 최종 반환 SubmitWritingResult { submissionId, questionNo } — submissionId는 step3 RPC가 반환한 로컬 id.
   - → 다음으로: 외부 BASE URL(getTalkpikApiBaseUrl)이 있으면 access_token과 함께 step2(외부 submit)로 진행. URL이 없으면 외부를 건너뛰고 createFailedLocalSubmission으로 feedback_status='failed' 행만 만들어 바로 반환(:180-185).
   - 코드: `src/lib/writing/server-actions.ts:94 (외부 호출 분기 진입 :108-129)`

**2. 외부 채점기 POST {TALKPIK_WRITING_API_BASE_URL}/api/writing/submit (HTTP, Bearer access_token)**
   - 입력: ExternalSubmitWritingRequest { task_type = toExternalTaskType(question_no)=question_no를 3자리 zero-pad('001' 등), task_id = problem_id, text = answer_text, user_id = user.id }. 헤더 Authorization: Bearer <supabase access_token>.
   - 출력: ExternalSubmitWritingResponse { submission_id, status, message }. status가 'failed'면 로컬 상태도 'failed', 그 외엔 'analyzing'으로 매핑(nextStatus, :148).
   - → 다음으로: 받은 external.submission_id를 step3 RPC의 external_submission_id로 넘겨 로컬 행을 만든다. 네트워크 오류(TypeError) 또는 5xx ExternalEvaluationApiError는 recoverable로 보고 throw 대신 createFailedLocalSubmission으로 'failed' 행 생성 후 반환(:130-146) — 즉 retry 루프는 없고 단발 시도 후 실패 폴백(로컬 멱등 새 submissionId 발급, randomUUID). 4xx 등 비복구 오류는 그대로 throw.
   - 코드: `submitExternalWriting — src/lib/writing-api/evaluation.ts:188 (requestJson :199); 호출부 server-actions.ts:120`

**3. RPC create_external_writing_submission(submission jsonb) → uuid (Postgres, security definer, service_role 전용)**
   - 입력: submission jsonb { external_submission_id(=step2 external.submission_id), user_id, problem_id, draft_id, question_no, answer_text, answer_json, char_count, feedback_status=nextStatus('analyzing'|'failed') }. RPC 내부에서 assert_submission_payload·assert_writing_problem_submittable(problem_not_submittable 차단), draft 소유권(draft_not_owned) 검증.
   - 출력: uuid = 로컬 writing_submissions.id. INSERT 성공 시 external_submission_id 그대로, 그러나 같은 draft에 이미 활성(non-failed) 제출이 있으면 새 행 없이 기존 id를 멱등 반환(select-before-insert :91-100). 동시 제출 레이스로 partial unique index(writing_submissions_draft_active_unique) 위반 시 unique_violation을 catch해 먼저 들어간 활성 행 id로 수렴(:122-134). 행 생성과 동시에 같은 problem의 writing_drafts를 autosave_status='superseded'로 표시.
   - → 다음으로: 반환 id를 SubmitWritingResult.submissionId로 클라이언트에 돌려준다. 코드는 external.submission_id가 아니라 RPC 반환값을 신뢰해야 함을 명시(:166-172): 멱등 분기에서 둘이 달라질 수 있기 때문. 이 submissionId가 step4 폴링의 키가 된다.
   - 코드: `호출부 server-actions.ts:149-162 (serviceSupabase.rpc); SQL def supabase/migrations/20260619150000_writing_submission_draft_dedup.sql:25 (베이스라인 20260618143000_external_writing_submission_sync.sql:5)`

**4. GET /api/writing/evaluation-status?submissionId=... (Next.js Route Handler) — 클라이언트 폴링 진입점**
   - 입력: 쿼리스트링 submissionId. 라우트는 cache:'no-store'로 호출됨. 폴링 정책: POLL_INTERVAL_MS=5000ms, POLL_MAX_ATTEMPTS=12 (queries.ts:131-132). 라우트 내부에서 getUser·active 검증(403 account_inactive), writing_submissions 조회 후 submission.user_id===user.id 소유권 확인(아니면 404).
   - 출력: { feedback_status: 'pending'|'analyzing'|'complete'|'failed' }. 외부 URL 없거나 이미 complete/failed면 DB의 현재 status를 그대로 반환(route.ts:47-49). access_token 없거나 외부 호출 try/catch가 throw하면 기존 status로 안전 폴백(catch :126-128).
   - → 다음으로: feedback_status가 complete 또는 failed면 isFeedbackComplete=true가 되어 refetchInterval이 false를 반환해 폴링 종료(queries.ts:143); status===null이거나 12회 도달 시에도 종료(:139). complete 도달 시 FeedbackPendingPanel→AnalysisLoadingModal onComplete가 router.refresh()/replace로 결과 화면으로 전환되어 step6으로. 아직 진행 중이면 5초 뒤 다시 이 라우트를 호출(=step5 외부 조회 반복). 참고로 클라 fetchFeedbackStatus는 라우트가 200이 아니거나 feedback_status 없으면 writing_submissions.feedback_status를 직접 SELECT하는 폴백 경로도 가짐(queries.ts:114-121).
   - 코드: `폴링 훅 useFeedbackStatus — src/lib/writing/queries.ts:134 (fetch :103, refetchInterval :138); 라우트 def src/app/api/writing/evaluation-status/route.ts:15. UI 소비: src/components/feedback/FeedbackPendingPanel.tsx:47`

**5. 외부 채점기 GET /api/evaluation/{id} (상태) 및 GET /api/evaluation/{id}/feedback (결과) (HTTP, Bearer)**
   - 입력: 경로변수 = 로컬 submissionId(외부 submission_id와 동일 가정; status.submission_id !== submissionId면 무시하고 기존 status 반환, route.ts:66). 헤더 Authorization: Bearer <access_token>.
   - 출력: status: ExternalEvaluationStatus { submission_id, status:'processing'|'graded'|'failed', total_score?, max_score? }. graded일 때만 feedback 호출 → ExternalEvaluationFeedback { submission_id, status, total_score, max_score, processing_time_seconds, trait_scores[](trait/score/max_score/feedback), annotations[](original_text/corrected_text/suggestion/comment), ai_summary, degraded, ... }.
   - → 다음으로: status별 분기로 step6 RPC 호출: (a) 'failed' → sync(next_status='failed', feedback=null) 후 {feedback_status:'failed'} (route.ts:70-82); (b) 'graded' 아님 → processing이면 'analyzing', 그 외 'pending'으로 매핑, 현재 status와 다를 때만 sync 호출(:84-99); (c) 'graded' → getExternalEvaluationFeedback로 결과 받아 mapExternalEvaluationFeedback(evaluation.ts:141)로 trait→dimension(TRAIT_TO_DIMENSION 매핑, weakness_level은 score 구간으로 계산)·annotation→sentence(index 부여)·total/max/ai_summary→feedback로 변환해 step6로(:101-120). 외부가 비동기 채점 큐이므로 graded가 될 때까지 step4-5가 5초 주기로 반복된다.
   - 코드: `getExternalEvaluationStatus — evaluation.ts:207 (route.ts:61 호출); getExternalEvaluationFeedback — evaluation.ts:224 (route.ts:101 호출). 라우트가 매 폴링마다 서버 측에서 외부로 프록시한다.`

**6. RPC sync_external_writing_feedback(target_submission_id uuid, next_status text, feedback jsonb, dimensions jsonb, sentences jsonb) → text (Postgres, security definer, service_role 전용)**
   - 입력: complete 케이스: next_status='complete', feedback={ status,score_total,score_max,overall_summary,ai_model='talkpik-writing-api',ai_model_version,raw_ai_result=원본 외부응답 통째 }, dimensions[](dimension,score,score_max,summary,weakness_level), sentences[](sentence_index,original_text,corrected_text,comment). 진행/실패 케이스: feedback=null, 빈 배열.
   - 출력: text = 적용된 status. next_status가 complete가 아니면 private.set_submission_feedback_status만 호출하고 반환(테이블 미기록, SQL :131-134). complete면: writing_feedback에 submission_id 기준 upsert(on conflict do update, generated_at 갱신, :140-164) → feedback_dimension_scores를 submission/user로 전량 delete 후 재삽입(:166-187) → sentence_feedback도 delete 후 재삽입(:189-209) → 마지막에 set_submission_feedback_status(target,'complete')로 writing_submissions 상태 승격(:211).
   - → 다음으로: writing_submissions.feedback_status='complete'가 되어 다음 폴링(step4)에서 isFeedbackComplete=true로 폴링이 멈춘다. delete-then-insert + upsert 구조라 같은 submission으로 중복/재호출돼도 결과가 수렴(멱등) — 폴링이 graded 응답을 여러 번 받아 sync를 반복해도 안전. submission_not_found면 예외. 이렇게 채워진 세 테이블이 step7의 읽기 대상이 된다.
   - 코드: `호출부 route.ts:71/87/111 (serviceSupabase.rpc); SQL def supabase/migrations/20260618143000_external_writing_submission_sync.sql:102`

**7. fetchFeedbackBundle — writing_feedback / feedback_dimension_scores / sentence_feedback 직접 SELECT (Supabase browser client, RLS=소유자 읽기)**
   - 입력: submissionId. 세 쿼리를 Promise.all: writing_feedback.maybeSingle(), feedback_dimension_scores(submission_id eq), sentence_feedback(submission_id eq, sentence_index asc 정렬).
   - 출력: FeedbackBundle { feedback: WritingFeedbackRow(score_total/score_max/overall_summary/ai_model 등), dimensions: FeedbackDimensionScoreRow[], sentences: SentenceFeedbackRow[] } — writing_feedback 행이 없으면 null 반환(:91).
   - → 다음으로: 릴레이 종착점. 사용자에게 총점·차원별 점수·문장별 첨삭(original→corrected+comment)을 렌더한다. failed로 끝난 경우엔 이 번들이 비어 모달이 실패/재시도 UI(onRetry=router.refresh)를 노출한다.
   - 코드: `src/lib/writing/queries.ts:67 (fetchFeedbackBundle). 폴링 종료·화면 전환 후 결과 패널이 소비. (비교 리포트 경로는 server-actions.ts:223-233에서 동일 테이블을 서버에서 읽음)`

> 참고: 비동기/폴링: 외부 채점은 큐 기반 비동기. 클라이언트는 react-query refetchInterval로 5초 간격·최대 12회(약 60초) 폴링하며 complete/failed/null 도달 또는 12회 소진 시 정지(queries.ts:131-147, refetchIntervalInBackground:false라 백그라운드 탭에선 폴링 멈춤). 점수의 실제 산출 주체는 외부 TALKPIK Writing API이고 우리 DB는 동기화 미러. 멱등성: create_external_writing_submission은 draft당 활성 제출 1건 불변식(partial unique index writing_submissions_draft_active_unique)+select-before-insert+unique_violation catch-and-reselect로 멱등(반환 id가 external id와 다를 수 있으니 RPC 반환값 신뢰 필수). sync_external_writing_feedback은 writing_feedback upsert(on conflict)와 dimension/sentence의 delete-then-insert로 멱등이라 폴링 중복 sync에도 안전. 재시도/폴백: 제출 단계엔 자동 retry 루프 없음 — 외부 submit이 네트워크 오류/5xx면 단발 실패 후 로컬 'failed' 행 폴백(recoverable만, 4xx는 throw). failed 제출은 dedup index에서 제외되어 사용자가 다시 제출하면 재시도 허용(새 draft_id 재응시도 허용). evaluation-status 라우트는 외부 호출 실패/토큰부재/submission_id 불일치 시 모두 기존 DB status로 안전 폴백해 폴링을 깨뜨리지 않음. 시크릿/권한: 두 RPC 모두 security definer + service_role grant(public revoke)라 서버 측 service-role client로만 호출; 외부 API는 사용자의 Supabase access_token을 Bearer로 전달(TALKPIK_API_BASE_URL 또는 TALKPIK_WRITING_API_BASE_URL env, production은 https 강제). 라우트/액션 모두 deleted/blocked 계정과 타인 submission 접근을 차단.

## C2. In-app notification dispatch (admin manual send → in-app card)  _(both)_
**한 줄 요약**: 관리자가 보낸 알림이 사용자 앱 안 알림 카드로 뜨기까지.
- **언제 시작**: 관리자가 topik-ai 관리 화면 '메시지/알림' 발송 패널에서 활성(active) in_app 템플릿 + 대상 그룹(또는 '나에게 보내기'=test)을 골라 발송하면 시작된다. UI는 sendNotification(payload)을 호출한다 (src/features/message/api/messages-service.ts:63 → notification-supabase-adapter.ts:715 sendNotification).
- **전체 흐름**: 관리자 발송은 두 단계로 갈린다. 1단계(topik-ai): admin_send_notification RPC가 notification_dispatches에 '발송 실행 원장' 행 1개만 만든다. 즉시발송은 status='running', 예약은 status='scheduled'(scheduled_at). 이 RPC는 실제 수신자에게 아무것도 보내지 않고 ledger만 만들고 끝난다. 2단계(topik-ai 소유 DB 파이프라인): Supabase pg_cron이 10분마다 private.dispatch_notifications()를 돌리고, 그 안의 private.dispatch_admin_notifications()가 running(또는 도래한 scheduled) dispatch를 집어 템플릿 channel로 분기한다. in_app 템플릿이면 대상 명단(test=actor 본인, group=정적 명단)을 산정하고, 사용자별 선호(notification_prefs)·채널토글(channels.in_app)·class(marketing/mandatory) 규칙으로 sent/skipped/opted_out을 판정해 notification_delivery_attempts에 기록하고, status='sent'인 사람만 v13 소유 public.user_notifications(인앱 알림함 카드)에 INSERT한다. 끝나면 dispatch.status를 completed(실패 0건) 또는 partial_failed로 닫는다. in_app은 큐가 아니라 cron tick 한 번에 즉시 종결된다 — 별도 워커/SMTP 없음.

**1. admin_send_notification (Supabase RPC, SQL SECURITY DEFINER, topik-ai)**
   - 입력: p_template_id(uuid), p_group_ids(jsonb; test면 []), p_scheduled_at(timestamptz|null), p_reason(text 필수), p_target_type('group'|'test'). 가드: auth.uid() 필수 + private.is_admin, 사유 필수, 템플릿 status='active'여야 함, group이면 group id 최소 1개.
   - 출력: 신규 notification_dispatches.id(uuid) 반환. 행: status = 즉시면 'running'(started_at=now()) / 예약이면 'scheduled', channels=[template.channel], dedupe_key='admin:'+uuid, actor_id=caller. + admin_audit_logs 'notification_dispatch_created' 1행.
   - → 다음으로: 이 RPC는 ledger 행만 만들고 즉시 종료한다(수신자 전달 0건). status='running' 행이 topik-ai 소유 DB cron tick이 집어가길 기다리는 '미집행 큐'가 된다. 예약이면 scheduled_at이 도래해야 집어간다.
   - 코드: `src/features/message/api/notification-supabase-adapter.ts:721 (sendNotification)`

**2. private.dispatch_notifications() (pg_cron 10분 주기, topik-ai admin migration)**
   - 입력: 인자 없음. now() 기준으로 스케줄형·관리자·재시도 서브함수를 순차 호출하는 메인 tick.
   - 출력: jsonb 집계(at=now(), study_reminder, weekly_summary, ..., admin=dispatch_admin_notifications() 결과, email_retry).
   - → 다음으로: 이 tick이 private.dispatch_admin_notifications()를 호출해 1단계에서 쌓인 running/scheduled dispatch를 집행하게 한다. 시각 출처는 DB now() 단일 기준.
   - 코드: `cron.schedule('dispatch_notifications','*/10 * * * *', ...) — topik-ai supabase/migrations-admin/20260723011242_notification_pipeline_ownership_transfer.sql`

**3. private.dispatch_admin_notifications() (SQL SECURITY DEFINER, topik-ai migration 20260723011242_notification_pipeline_ownership_transfer.sql)**
   - 입력: 인자 없음. SELECT ... FOR UPDATE SKIP LOCKED 로 (status='running' AND target_type in group|test) OR (status='scheduled' AND scheduled_at<=now()) 행을 잠금 집어온다. scheduled면 먼저 running으로 올린다.
   - 출력: 각 dispatch에 대해: 대상 명단 temp 테이블(_ntf_audience) 산정 후 v_tpl.channel='in_app' 분기에서 notification_delivery_attempts에 (channel='in_app', status=sent/skipped/opted_out) INSERT, sent인 사람만 public.user_notifications INSERT. dispatch는 completed(또는 failed>0이면 partial_failed)로 닫고 recipient_count 집계. 반환 jsonb {dispatch, channel:'in_app', sent, skipped, opted_out, failed}.
   - → 다음으로: in_app은 여기서 끝이다 — 사용자 알림함(user_notifications) 카드가 즉시 생성되고, 사용자가 v13 앱에서 읽는다. 외부 전송(SMTP/이메일 워커) 단계가 없다. 상태 전이: running→completed/partial_failed, attempt는 곧장 sent/skipped/opted_out (pending 단계 없음, 큐 없음).
   - 코드: `private.dispatch_notifications():715`

> 참고: 비동기 경계: admin RPC와 topik-ai 소유 DB cron 집행은 분리돼 있고 최대 10분 지연. 멱등성: dispatch.dedupe_key(unique 'admin:'+uuid)로 재실행 차단 + attempt unique(dispatch_id,user_id,channel)로 사용자 중복 차단. 예약 취소는 admin_cancel_notification_dispatch(p_dispatch_id,p_reason): status='scheduled'인 것만 'canceled'+completed_at으로 전이(이미 running/completed면 거부), cron의 WHERE가 scheduled_at<=now()+status=scheduled만 집행하므로 취소 후 발송 0건. 실패 처리: 템플릿 누락 시 dispatch failed. in_app은 pending/SMTP 없음 — 시크릿/네트워크 불필요. 핵심 분리: 쓰기 단일경로 = admin RPC(topik-ai 소유 테이블), 집행 = topik-ai private 파이프라인(service_role/SECURITY DEFINER, bypassrls), 사용자 수신함 객체 owner = v13. admin_send_notification은 절대 직접 전송하지 않는다(흔한 오해).

## C3. Email notification dispatch (admin/scheduled/event → SMTP via app worker)  _(both)_
**한 줄 요약**: 관리자가 보낸 알림이 실제 이메일로 발송되기까지(워커 + SMTP).
- **언제 시작**: (a) 관리자가 active email 템플릿으로 발송(admin_send_notification, target group|test) → notification_dispatches 행 생성, 또는 (b) topik-ai 소유 DB cron의 스케줄형/이벤트형 email 경로가 dispatch를 생성. 어느 쪽이든 결국 channel='email' 인 notification_delivery_attempts 행이 만들어진다.
- **전체 흐름**: 이메일은 in-app보다 한 홉 더 길다. (1) admin_send_notification(topik-ai)이 dispatch 행을 만들고(running/scheduled), (2) topik-ai 소유 DB cron tick의 private.dispatch_admin_notifications()가 email 템플릿 분기에서 자격(pref+channels.email+class)을 평가해 자격 미달자는 opted_out/skipped로 종결하고 자격 통과자는 notification_delivery_attempts에 channel='email', status='pending'으로 적재한다. 핵심: in-DB SQL은 HTTP 호출이 불가(pg_net 미설치)하고 SMTP 시크릿을 DB/LLM 밖에 둬야 하므로, transport mode='live'에서 finalize_email_attempt는 DEFER 신호를 받아 attempt를 'pending'으로 그대로 둔다(거짓 sent 금지 — canonical migration 20260723011242). (3) 실제 발송은 앱-사이드 워커 라우트(v13 src/app/api/notifications/dispatch-email/route.ts, 동일 로직이 topik-ai api/notifications/dispatch-email.ts에도 존재)가 한다. 워커는 NOTIFICATION_WORKER_SECRET(x-worker-secret 헤더)로 인증하고, SMTP_* 미설정 시 정직하게 503 no-op(아무것도 안 건드림), service-role 클라이언트로 status='pending' & channel='email' attempt를 최대 50건 조회해 수신자 이메일(auth.admin.getUserById)·템플릿(dispatch.template_id→notification_templates, 폴백 template_key)·display_name을 해석하고 nodemailer로 Daou Office SMTP 발송한다. 성공 시에만 attempt를 'sent'(provider_message_id, sent_at) 갱신, 실패는 retry_count++ 후 캡(3) 미만이면 'pending' 유지(다음 호출 재시도)·캡 도달이면 'failed'. 이메일은 user_notifications(인앱 카드)에 기록하지 않는다.

**1. admin_send_notification (Supabase RPC, topik-ai) — email 템플릿**
   - 입력: in-app 릴레이와 동일. 단 선택된 템플릿의 channel='email'.
   - 출력: notification_dispatches 행(status running/scheduled, channels=['email']) + 감사로그. 전달 0건.
   - → 다음으로: in-app과 동일하게 ledger만 생성. topik-ai 소유 DB cron이 집어가 email 자격평가+attempt 적재를 하게 한다. (스케줄형/이벤트형 email은 이 step 없이 cron 서브함수가 직접 dispatch를 만든다.)
   - 코드: `src/features/message/api/notification-supabase-adapter.ts:721`

**2. private.dispatch_admin_notifications() email 분기 + private.finalize_email_attempt → private.notification_email_transport (topik-ai admin migration)**
   - 입력: 집어온 dispatch + _ntf_audience. email 분기: status = test→pending, marketing→opted_out, learning/transactional/operational & not pref_on→opted_out, not email_on→skipped, else→pending. pending 행마다 finalize_email_attempt(attempt_id, null, subject, body) 호출.
   - 출력: notification_delivery_attempts에 channel='email' 행 INSERT. transport mode='live'면 finalize가 DEFER({ok:false,defer:true,reason:'app_worker'})를 받아 attempt를 status='pending'으로 유지(error 필드 정리, sent_at/provider_message_id=null). test_*/disabled 모드면 여기서 sent/skipped/failed로 즉시 종결. dispatch는 completed/partial_failed. user_notifications INSERT 없음.
   - → 다음으로: live 모드 핵심: SQL은 절대 'sent'를 만들지 않는다. status='pending' & channel='email' attempt들이 앱 워커가 처리할 큐가 된다. retry_failed_email_attempts도 live에서 defer를 받으면 pending으로 되돌려 워커 소관으로 이관한다.
   - 코드: `private.dispatch_notifications() (pg_cron */10) → dispatch_admin_notifications():418 email 분기`

**3. POST /api/notifications/dispatch-email (v13 Next.js route, runtime=nodejs; 동형 핸들러 topik-ai api/notifications/dispatch-email.ts GET=cron/POST=manual)**
   - 입력: 헤더 x-worker-secret === process.env.NOTIFICATION_WORKER_SECRET (불일치/미설정 → 401). 그다음 SMTP_HOST/SMTP_USER/SMTP_PASS 검사(미설정 → 503 smtp_not_configured, attempt 무변경). service-role 클라이언트(NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)로 notification_delivery_attempts where channel='email' AND status='pending' ORDER BY created_at LIMIT 50 조회.
   - 출력: 각 attempt: 수신자 이메일(supabase.auth.admin.getUserById(user_id).email; profiles엔 email 없음), 템플릿(dispatch.template_id→notification_templates subject/body_html/link_url/class, 폴백=template_key+channel='email'+status='active'), display_name(profiles) 해석 → {{display_name}} 치환 + appendCtaLink(link_url) + marketing이면 appendUnsubscribeLink(unsubscribe_token) → nodemailer.sendMail(from=SMTP_FROM 기본 '도토리 토픽 <guest@keduall.com>', SMTP_PORT 465=implicit TLS). HTTP 응답 {ok:true, processed, sent, failed}.
   - → 다음으로: 발송 성공(transporter.sendMail resolve) 시에만 attempt를 status='sent', provider_message_id=info.messageId, sent_at=now()로 갱신(정직성 경계). 실패(수신자 이메일 없음=no_recipient_email / 템플릿 없음=no_template / SMTP 예외=smtp_error)는 applyFailure: retry_count+1 후 nextRetry>=3이면 status='failed'(terminal), 미만이면 status='pending' 유지 → 다음 워커 호출에서 자동 재시도. 이메일은 여기서 종결(인앱 카드 없음).
   - 코드: `외부 cron/스케줄러가 x-worker-secret 헤더로 호출 (잔여 종속: cron 배선 미완료). v13은 POST만, topik-ai 버전은 GET(Authorization: Bearer CRON_SECRET)+POST(x-worker-secret) 둘 다.`

> 참고: 워커 인증 시크릿 = NOTIFICATION_WORKER_SECRET (헤더 x-worker-secret). topik-ai 핸들러는 추가로 GET 경로에 CRON_SECRET(Authorization: Bearer)도 지원. 상태 전이(이메일): admin_send_notification이 만든 dispatch는 running/scheduled, attempt는 SQL 파이프라인에서 pending으로 적재(live) → 워커가 sent(성공) 또는 retry_count<3이면 pending 유지(재시도)·>=3이면 failed. (사용자가 말한 queued→sending→sent/failed의 실제 enum은 pending→sent/failed이며, '큐 대기'='pending', '발송중'은 명시 상태 없이 워커 처리 구간이다.) 멱등성: dispatch.dedupe_key unique + attempt unique(dispatch_id,user_id,channel) + 스케줄/이벤트형은 attempt.dedupe_key(user:key:email:date 또는 :event_id). 시크릿 격리: SMTP 자격증명·service-role 키는 서버 env에만, DB/LLM 컨텍스트 밖. 정직성: SMTP 미구성=503 no-op(상태 무변경), live SQL은 절대 sent로 위장 안 함. 실패/재시도: SQL retry_failed_email_attempts(최대3, dispatch_notifications tick에서)와 워커 applyFailure 둘 다 캡=3 미러. in_app vs email 분리: in_app은 cron tick 한 번에 즉시 sent + user_notifications 카드 생성, 외부 워커/SMTP 없음 / email은 pending 큐 + 별도 앱 워커가 SMTP 발송, user_notifications에 기록 안 함. 잔여 외부 종속: 워커 cron 배선(H-2 동의 저장소 미구현으로 marketing은 전원 opted_out).

## C4. 인증 메일 템플릿 동기화(Auth Email Template Sync)  _(topik-ai)_
**한 줄 요약**: 관리자가 편집한 인증메일 템플릿이 Supabase 실제 메일 설정에 반영되기까지.
- **언제 시작**: 관리자가 /messages/mail의 '인증 메일' 탭에서 6종 auth 메일 템플릿(confirmation/magic_link/recovery/email_change/invite/reauthentication) 중 하나의 제목/본문을 편집·저장한 뒤 '동기화' 버튼을 누르면 시작된다. 저장과 동기화는 두 개의 분리된 사용자 액션이며, 동기화 액션이 이 릴레이를 구동한다.
- **전체 흐름**: 관리자가 편집한 인증 메일 템플릿(편집 SoT = public.auth_email_templates 테이블)을 Supabase Auth의 내장 GoTrue 템플릿으로 밀어넣는(push) 3단계 릴레이다. (1) 브라우저가 admin_save_auth_email_template RPC로 편집본을 upsert하고 local_hash를 계산해 sync_status를 draft/synced로 세팅한다. (2) 브라우저가 자신의 access_token만 들고 POST /api/auth-email/sync(api/auth-email/sync.ts)를 호출한다. 서버는 service-role로 JWT/role(content_admin·platform_admin) 검증 후 DB 편집본을 읽고, Supabase Management API(https://api.supabase.com/v1/projects/{ref}/config/auth)에 GET(스냅샷)→PATCH(mailer_subjects_{type}, mailer_templates_{type}_content)→GET(재검증)을 수행하고 토큰·시크릿을 노출하지 않고 { ok, snapshot, error }만 돌려준다. (3) 성공/실패 무관하게 브라우저가 admin_mark_auth_email_synced RPC로 결과를 기록한다 — 성공이면 sync_status=synced(live가 editor copy와 다르면 drift), 실패면 error. 멱등성/동기화 상태는 md5(subject+\n+body_html) 해시 비교와 PATCH 후 live GET 재검증으로 보장된다. Management 토큰/Service Role은 서버 전용이고 브라우저는 자신의 세션 토큰만 전달하는 것이 핵심 보안 경계다.

**1. admin_save_auth_email_template (Postgres SECURITY DEFINER RPC, supabase-js client.rpc)**
   - 입력: p_auth_type(6종 중 하나), p_template={subject, body_html, status?}, p_reason(필수 운영 사유). 게이트: auth.uid() not null + private.is_admin. body_html ≤102400바이트(Gmail clipping 가드).
   - 출력: returns uuid (템플릿 행 id). 부수효과: auth_email_templates에 auth_type 단위 upsert; local_hash=md5(subject||chr(10)||body_html) 재계산; sync_status = (last_synced_live_hash가 있고 local_hash와 같으면) 'synced' else 'draft'; admin_audit_logs에 action='auth_email_template_saved'(subject from/to + body_changed diff, reason payload) 1행 기록.
   - → 다음으로: 저장 직후 sync_status가 draft로 떨어지면(본문이 바뀐 경우) 화면에 '미동기화' 상태가 보이고, 관리자가 동기화 버튼을 누르면 동일 authType이 2단계 syncSupabaseAuthEmailTemplate로 전달된다. 이 단계는 편집본(편집 SoT)을 DB에 확정해 두는 것이 목적이며, 실제 GoTrue push는 아직 일어나지 않는다.
   - 코드: `src/features/message/api/supabase-auth-email-service.ts:97 (saveSupabaseAuthEmailTemplate)`

**2. POST /api/auth-email/sync (서버 엔드포인트, fetch). 내부에서 Supabase Management API REST 호출: GET·PATCH·GET https://api.supabase.com/v1/projects/{projectRef}/config/auth, 인증=Authorization: Bearer {SUPABASE_MANAGEMENT_API_TOKEN ?? SUPABASE_ACCESS_TOKEN}. projectRef 기본값 'fglggyfvzjdsbyckinqa'. POST만 허용(그 외 405). PATCH 키는 authType별 동적: mailer_subjects_{authType}/mailer_templates_{authType}_content.**
   - 입력: 브라우저→서버: 헤더 Authorization: Bearer {사용자 access_token}, 바디 { auth_type, reason }. 서버→Management API PATCH 바디 { mailer_subjects_{authType}: subject, mailer_templates_{authType}_content: body_html }. 서버 측 시크릿: SUPABASE_SERVICE_ROLE_KEY(JWT 검증·DB 읽기), Management 토큰, projectRef.
   - 출력: 서버는 JWT 검증(getUser)→profiles.app_role ∈ {content_admin, platform_admin}→auth_email_templates에서 subject/body_html 읽기→Management GET(이전값 스냅샷)→PATCH→GET 재검증 후 JSON { ok: boolean, snapshot: {mailer_subjects_{type}, mailer_templates_{type}_content}|null, error?: string } 반환. 실패 코드: unauthenticated/invalid_session(401), forbidden(403), bad_request/invalid_auth_type/template_empty(400), template_not_found(404), server_misconfigured/management_token_missing(500), management_get/patch/verify_failed(502). ok는 PATCH 후 live GET 값이 푸시값과 정확히 일치할 때만 true.
   - → 다음으로: 브라우저는 res.ok(httpOk) AND result.ok로 succeeded를 계산한다(supabase-auth-email-service.ts:142). 토큰/시크릿은 응답·로그에 절대 포함되지 않으므로 브라우저는 ok/snapshot/error만 받는다. 이 결과(succeeded, snapshot, error, live_hash)가 3단계 admin_mark_auth_email_synced의 p_result로 그대로 전달되어 — 즉 서버의 검증 결과가 DB 동기화 상태 기록의 입력이 된다.
   - 코드: `src/features/message/api/supabase-auth-email-service.ts:130 (syncSupabaseAuthEmailTemplate가 fetch 호출); 서버 핸들러 api/auth-email/sync.ts:46 syncAuthEmailTemplate (export POST/default fetch)`

**3. admin_mark_auth_email_synced (Postgres SECURITY DEFINER RPC, supabase-js client.rpc)**
   - 입력: p_auth_type, p_result={ ok: succeeded, live_hash: result.live_hash ?? null, snapshot: result.snapshot ?? null, error: result.error ?? (httpOk ? null : 'HTTP {status}') }, p_reason(필수). 게이트: auth.uid()+private.is_admin.
   - 출력: returns uuid. 성공(ok=true)이면 auth_email_templates 업데이트: sync_status= (live_hash null이거나 local_hash와 같으면) 'synced' else 'drift', synced_at/synced_by/last_synced_live_hash/last_live_hash/last_live_snapshot/last_live_checked_at 갱신, sync_error=null, status가 draft/ready면 'published'로 승격. 실패(ok=false)면 sync_status='error', sync_error=메시지, last_live_checked_at만 갱신. admin_audit_logs에 action='auth_email_synced'|'auth_email_sync_failed'(sync_status from/to diff, reason/ok/error payload) 1행 기록.
   - → 다음으로: 브라우저는 markError가 없으면 succeeded가 false일 때 throw(사용자 에러 토스트), true면 loadOne(authType)으로 갱신된 행을 다시 읽어 화면 상태(synced/drift/error 배지, synced_at 등)를 최신화한다. 이로써 릴레이가 닫힌다 — 편집본 저장(1) → GoTrue로 push+검증(2) → DB에 검증된 동기화 상태 확정 기록(3)이 단일 감사 추적(admin_audit_logs)으로 이어진다.
   - 코드: `src/features/message/api/supabase-auth-email-service.ts:145 (syncSupabaseAuthEmailTemplate)`

> 참고: 비동기/폴링: 폴링 없음. 동기화는 단일 동기 요청-응답이며 서버가 GET→PATCH→GET을 순차 수행 후 한 번에 결과 반환, 브라우저는 곧바로 admin_mark_auth_email_synced로 기록. 멱등성/동기화 상태: (a) md5(subject||chr(10)||body_html) 해시(local_hash)로 편집본 식별, save 시 local_hash==last_synced_live_hash면 sync_status='synced' 유지해 불필요한 재동기화 방지. (b) PATCH 후 서버가 live GET 재검증하여 live==푸시값일 때만 ok=true(거짓 성공 방지). (c) mark RPC는 ok=true라도 live_hash가 editor copy(local_hash)와 다르면 'drift'로 표시. (d) PATCH는 동일 키 멱등 설정이므로 재호출 안전. 시크릿: SUPABASE_SERVICE_ROLE_KEY(또는 SECRET_KEY)와 Management 토큰(SUPABASE_MANAGEMENT_API_TOKEN/SUPABASE_ACCESS_TOKEN)은 서버 전용, 응답·로그 노출 금지(에러 텍스트도 200자로 잘라 반환). 브라우저는 자신의 access_token만 서버에 전달. 6종 템플릿: confirmation, magic_link, recovery, email_change, invite, reauthentication (테이블 CHECK 제약·서버 AUTH_TYPES·RPC 검증 3중으로 동일 집합 강제; sole-writer 정책 — topik-ai만 auth 템플릿 변경, drift/conflict는 안전 경보). 실패 처리: 서버는 단계별 HTTP 상태 구분 반환(401/403/400/404/500/502), PATCH 실패 시에도 snapshot 반환해 롤백 근거 제공; 브라우저는 성공·실패 모두 admin_mark_auth_email_synced로 감사 기록 후 실패면 throw. 권한 게이트는 서버(profiles.app_role ∈ content_admin/platform_admin)와 두 RPC(private.is_admin)에서 이중 적용. 라우팅은 파일경로 기반(api/auth-email/sync.ts → /api/auth-email/sync).

## C5. v13 SIGNUP / AUTH-CALLBACK / consent / affiliation relay  _(v13)_
**한 줄 요약**: 소셜/이메일 로그인 → 프로필 생성 → 닉네임/동의 → 기관코드 등록까지의 가입 흐름.
- **언제 시작**: 사용자가 가입을 시작할 때 두 진입점 중 하나로 체인이 시작된다. (1) 이메일 가입: /sign-up 폼 제출 → supabase.auth.signUp. (2) Google OAuth 가입/로그인: '구글로 시작' 버튼 → supabase.auth.signInWithOAuth. 박람회/기관 회원은 그 전에 QR URL의 ?aff=<코드> 파라미터가 localStorage(talkpik:affiliation-code, TTL 24h)에 캡처되어 있다. 두 경로 모두 결국 /auth/callback이 OAuth 'code' 또는 PKCE 'token_hash'를 세션으로 교환하는 지점으로 수렴한다.
- **전체 흐름**: 가입 릴레이는 6개의 바통(API 호출)이 순서대로 이어진다. ① 클라이언트(SignUpForm)가 buildAffiliationMetadata()로 localStorage의 기관코드를 모아 user_metadata에 실어 supabase.auth.signUp을 호출한다. OAuth 경로는 signInWithOAuth가 redirectTo에 next 경로를 미리 박아둔다. ② 인증 링크/OAuth 리다이렉트가 /auth/callback(Route Handler)으로 돌아오면 verifyOtp(token_hash) 또는 exchangeCodeForSession(code)로 코드를 세션으로 바꾼다 — 이 핸들러가 Route Handler여야만 Set-Cookie가 응답에 실제로 emit된다(과거 Server Component 버전은 쿠키가 silent-fail해 /login으로 튕기던 P0 버그). ③ auth.users INSERT가 DB 트리거 on_auth_user_created → handle_new_user()를 발화시켜 public.profiles 행을 생성하고 이메일 가입이면 메타데이터의 affiliation_code까지 seed한다. ④ /auth/post-auth가 세션+프로필을 확정하고(requireActiveSession→backfillOAuthDisplayName) 누락 동의가 있으면 /auth/consent로 보낸다. ⑤ 동의 페이지의 acceptRequiredConsentsAction이 user_consents에 INSERT한다. ⑥ OAuth 가입은 메타데이터가 없으므로 next 경로 앞에 /auth/claim-affiliation을 끼워 claimStoredAffiliationCode()가 claim_affiliation_code RPC로 기관코드를 one-shot 백필한다. 마지막으로 학습목표 유무에 따라 /onboarding/learning-goal 또는 /dashboard로 안착하며, 닉네임 중복검사는 온보딩/프로필 화면에서 is_nickname_available RPC로 별도 수행된다.

**1. supabase.auth.signUp (이메일) / supabase.auth.signInWithOAuth provider:google (OAuth) — Supabase Auth 클라이언트 호출**
   - 입력: 이메일 경로: { email, password, options.data: { display_name, nationality_country_code, ...buildAffiliationMetadata() } , emailRedirectTo: /auth/callback?next=/onboarding/learning-goal }. buildAffiliationMetadata()(affiliation-code.ts:106)가 localStorage talkpik:affiliation-code를 읽어 { affiliation_code }를 합친다. OAuth 경로: { provider:'google', options.redirectTo: buildClientAuthCallbackUrl(buildOAuthNextPath('sign-up')) } — next가 /auth/claim-affiliation?next=/auth/post-auth?intent=sign-up 으로 래핑됨.
   - 출력: 이메일: 인증 메일 발송(에러 없으면). 클라이언트는 localStorage 코드 clear 후 /auth/verify-email?email=...로 push. OAuth: 브라우저가 Google 동의화면으로 리다이렉트되고 인증 후 redirectTo(/auth/callback?next=...)로 돌아온다.
   - → 다음으로: 두 경로 모두 인증이 완료되면 브라우저가 /auth/callback으로 도착한다 — 이메일은 메일 링크 클릭(token_hash 동봉), OAuth는 Google에서 code 쿼리를 달고 리다이렉트. 즉 다음 바통은 callback Route Handler가 받는다.
   - 코드: `src/components/auth/SignUpForm.tsx:283 (handleSignUp) / src/lib/auth/oauth.ts:119 (startGoogleOAuth, SignUpForm.tsx:340 handleGoogleSignUp에서 호출)`

**2. supabase.auth.verifyOtp({token_hash,type}) (PKCE) / supabase.auth.exchangeCodeForSession(code) (OAuth) — GET /auth/callback Route Handler**
   - 입력: 쿼리스트링의 token_hash+type(signup/recovery/email_change/email 화이트리스트) 또는 code, 그리고 sanitizeNext로 검증한 next. provider error_code가 있으면 즉시 /auth/error로 매핑 리다이렉트.
   - 출력: 성공 시 세션 토큰을 setAll 콜백이 pendingCookies에 모으고 withAuthCookies(response)가 NextResponse 응답에 Set-Cookie로 emit → 302 redirect(next). 실패 시 /auth/error?reason=<mapSupabaseErrorCode>(&retry_after_seconds). exchangeCodeForSession 실패라도 getUser()로 활성세션 있으면 next로 통과(stale 콜백 멱등 처리).
   - → 다음으로: 이 단계에서 브라우저가 인증 쿠키를 갖게 되어 이후 모든 서버 컴포넌트/액션이 인증 컨텍스트로 동작한다. 응답의 Location(next)을 따라 OAuth는 /auth/claim-affiliation(→/auth/post-auth), 이메일은 /onboarding/learning-goal(post-auth 경유 가능)로 이동. 동시에 auth.users에 새 행이 INSERT된 상태라 DB 트리거가 다음 바통을 받는다.
   - 코드: `src/app/auth/callback/route.ts:169 (verifyOtp) / route.ts:199 (exchangeCodeForSession), 클라이언트는 createAuthCallbackClient(route.ts:98)`

**3. DB 트리거 on_auth_user_created → public.handle_new_user() (Postgres SECURITY DEFINER 함수, INSERT on auth.users)**
   - 입력: new.raw_user_meta_data — display_name, nationality_country_code, affiliation_code(이메일 가입 시 signUp이 실어준 값; OAuth는 비어있음).
   - 출력: public.profiles 행을 idempotent(on conflict id do nothing) 생성. affiliation_code는 정규식 ^[A-Za-z0-9_-]{2,64}$ 통과 시만 seed, 아니면 NULL. nationality는 upper()로 정규화.
   - → 다음으로: 이제 profiles 행이 존재하므로 bootstrapProfile/getCurrentProfile이 null이 아닌 행을 돌려줄 수 있다(null이면 트리거 실패 또는 RLS 비가시 둘 중 하나로 진단). post-auth 페이지가 이 프로필을 읽어 동의/온보딩 분기로 넘어간다.
   - 코드: `supabase/migrations/20260619140000_profiles_affiliation_code.sql:35 (함수), :67 (트리거). bootstrapProfile(src/lib/auth/profile.ts:40)이 이후 이 행을 RLS-bound SELECT로 읽음.`

**4. requireActiveSession() + backfillOAuthDisplayName() + getMissingRequiredConsentDocuments() — Server Component /auth/post-auth**
   - 입력: intent(login|sign-up) 쿼리, 인증 세션(쿠키), profile.ui_locale. legal_documents에서 status=published & requires_consent=true 행을 locale별로 조회(없으면 ko 폴백), user_consents와 대조.
   - 출력: 탈퇴/차단 계정이면 /auth/account-inactive로 리다이렉트. OAuth로 display_name/nickname이 빈 경우 backfill(없으면 generateRandomNickname 'talkpik-xxxxxx'). 미동의 필수문서가 있으면 /auth/consent?next=...로 리다이렉트, 없으면 다음 단계.
   - → 다음으로: 누락 동의가 있으면 바통을 /auth/consent(5단계)로 넘기고, 없으면 동의 단계를 건너뛰어 hasLearningGoal 결과에 따라 /onboarding/learning-goal 또는 /dashboard로 addGoogleLinkedNotice를 붙여 최종 리다이렉트. (OAuth는 이 post-auth에 닿기 전 claim-affiliation을 이미 통과 — 6단계 참조.)
   - 코드: `src/app/auth/post-auth/page.tsx:33-50. requireActiveSession(profile.ts:152), backfillOAuthDisplayName(consent.ts:170), getMissingRequiredConsentDocuments(consent.ts:100).`

**5. recordRequiredConsents() → supabase.from('user_consents').insert(rows) — Server Action acceptRequiredConsentsAction**
   - 입력: FormData(accept 체크, next). requireUser+bootstrapProfile로 사용자/프로필 확정, getMissingRequiredConsentDocuments로 아직 동의 안 한 문서만 추림. 각 문서당 { user_id, document_id, doc_type, version, source:'signup' }.
   - 출력: user_consents에 누락분만 INSERT(이미 동의분 제외 → 멱등). accept 미체크면 /auth/consent?error=required로 되돌림. 탈퇴/차단이면 account-inactive. 성공 후 redirect(next=대개 /auth/post-auth?intent=...).
   - → 다음으로: 동의 기록이 남으면 next(post-auth)로 되돌아가 4단계가 다시 실행되며, 이번엔 missingDocuments가 0이라 동의 루프를 빠져나가 온보딩/대시보드로 진행한다. (마케팅 동의 user_marketing_consent는 이 필수동의 경로와 별개 — 여기 필수문서 셋에는 requires_consent=true인 법적문서만 포함된다.)
   - 코드: `src/app/auth/consent/actions.ts:44 (recordRequiredConsents at consent.ts:127). 폼은 src/app/auth/consent/page.tsx → AuthConsentPanel.`

**6. supabase.rpc('claim_affiliation_code', { p_code }) — claim_affiliation_code(text) Postgres RPC (OAuth 가입 전용 보정)**
   - 입력: readStoredAffiliationCode()로 localStorage talkpik:affiliation-code(TTL 24h, charset 검증)에서 읽은 p_code. 코드 없으면 RPC 미호출('empty').
   - 출력: RPC가 set_config('app.claim_affiliation_code','1',true)로 트랜잭션 플래그를 세운 뒤 profiles.affiliation_code가 NULL/빈값일 때만 UPDATE(one-shot). protect_profile_columns 트리거는 이 플래그가 있을 때만 변경 허용. 성공 시 localStorage clear('claimed'), 실패해도 'failed' 반환만.
   - → 다음으로: claim 결과와 무관하게 ClaimAffiliationRedirect가 try/finally로 router.replace(nextPath=/auth/post-auth?intent=sign-up)를 실행해 4단계(post-auth)로 합류 → 동의/온보딩 분기로 마무리. 이메일 가입은 3단계 handle_new_user에서 이미 seed됐으므로 이 보정 단계를 거치지 않는다. (닉네임 중복검사는 이후 온보딩/프로필 화면에서 ProfileForm.tsx:340 checkNicknameAvailability → is_nickname_available RPC로 비동기 수행되며, 저장 시 23505/profiles_nickname_lower_uniq 충돌은 NicknameTakenError로 매핑된다.)
   - 코드: `src/lib/auth/affiliation-code.ts:119 (claimStoredAffiliationCode) ← src/components/auth/ClaimAffiliationRedirect.tsx:22 ← /auth/claim-affiliation 페이지(oauth.ts:67 buildOAuthNextPath가 sign-up next 앞에 끼움). RPC 정의: 20260619140000_profiles_affiliation_code.sql:128.`

> 참고: 세션 쿠키 핸들링: createSupabaseServerClient(server.ts)의 setAll은 Server Component에서 cookieStore.set이 던지는 예외를 try/catch로 삼킨다(주석상 '의도된 동작' — 미들웨어가 세션을 갱신하므로 OK). 그러나 /auth/callback은 이 한계 때문에 별도 클라이언트(createAuthCallbackClient)를 쓴다: setAll이 pendingCookies 배열에 모았다가 withAuthCookies(response)가 NextResponse.cookies.set으로 실제 응답 헤더에 emit한다. Route Handler에서만 Set-Cookie가 살아남기 때문(파일 상단 P0 주석). exchangeCodeForSession 실패 시 getUser()로 기존 활성 세션이 있으면(중복 클릭/stale 콜백 재방문) 에러로 안 보고 next로 그대로 통과시키는 멱등 처리가 있다. fragment(implicit) flow는 서버가 읽을 토큰이 없어 /auth/callback-fragment로 넘겨 클라이언트가 window.location.hash를 파싱한다(RFC 7231 fragment 보존 트릭). 멱등성: handle_new_user는 on conflict (id) do nothing, claim_affiliation_code는 affiliation_code가 비어있을 때만 UPDATE(one-shot). 동의 기록은 getMissingRequiredConsentDocuments가 이미 동의한 document_id를 빼고 INSERT하므로 재방문 시 중복 안 남김. affiliation_code claim 엣지케이스(코드/주석 명시): 이메일 가입은 signUp metadata→handle_new_user가 seed하지만, OAuth 가입은 가입 시점 metadata를 못 실으므로 affiliation_code가 NULL로 생성된다. 그래서 OAuth만 oauth.ts의 buildOAuthNextPath가 next 경로를 buildClaimAffiliationPath로 감싸 /auth/claim-affiliation을 인증 직후에 강제 통과시키고, 거기서 claim_affiliation_code RPC가 localStorage 코드를 백필한다(이것이 메모에 언급된 'Google OAuth claim 보정'). 보안: protect_profile_columns 트리거가 affiliation_code를 일반 프로필 수정으로는 못 바꾸게 막고, claim_affiliation_code가 set_config('app.claim_affiliation_code','1',true)로 트랜잭션-로컬 플래그를 세운 경우에만 변경을 허용(write-once, 사용자 직접 편집 불가). claim_affiliation_code는 charset만 검증하고 admin institution_codes 카탈로그와 대조하지 않음(v13 decoupled, admin 앱이 미지 코드 reconcile). 실패 처리: claimStoredAffiliationCode는 'empty'/'claimed'/'failed'를 반환하지만 ClaimAffiliationRedirect는 try/finally로 결과와 무관하게 항상 router.replace(nextPath)로 진행(실패해도 가입 흐름은 막지 않음).

## C6. 이용약관/정책 변경 릴레이 (admin 발행 -> v13 legal_documents 투영 -> 전체 알림 -> 사용자 재동의)  _(both)_
**한 줄 요약**: 관리자가 약관 새 버전을 발행 → 사용자 앱 약관 페이지에 반영 → 전체 알림 → 재동의까지.
- **언제 시작**: topik-ai 관리자(platform_admin)가 Operation > 정책 관리 화면에서 이용약관(POL-001) 또는 개인정보 처리방침(POL-002)의 특정 히스토리 버전을 '게시(발행)'하고, 이어서 '약관 변경 알림 발송'을 수동 실행할 때 체인이 시작된다. SoT=operation_policies(topik-ai 소유), legal_documents는 v13이 보유한 사용자 표시용 미러.
- **전체 흐름**: 관리자가 약관 버전을 발행하면 topik-ai의 admin_publish_operation_policy_version RPC가 operation_policies(단일 진실원천)의 해당 행을 선택된 히스토리 스냅샷으로 되돌려 status=published로 만들고 새 version_published 히스토리·감사 로그를 남긴다. 발행 직후 프론트 서비스(supabase-operation-policies-service.ts)는 정책을 재조회해 syncLegalProjection을 호출하는데, 이용약관/개인정보 타입이며 게시 상태일 때만 v13 소유 SECURITY DEFINER RPC admin_sync_legal_document_from_operation_policy에 ko/en 본문을 넘긴다. 이 v13 RPC는 operation_policies를 직접 읽지 않고 전달받은 내용을 legal_documents에 기록한다: 같은 doc_type의 다른 버전 published 행을 archived로 강등하고, ko는 항상, en은 제목+본문이 있을 때만 새 (doc_type, version, locale) 행을 published로 적재한다(vi 등 행 없는 로케일은 앱에서 ko 폴백). 동일 (doc_type,version,locale)에 다른 본문 재발행은 immutable version conflict로 거부된다. 그 다음 관리자가 admin_send_terms_change_notification을 실행하면 발송 시점의 활성 회원 전원을 '전체 활성 사용자' 정적 그룹 스냅샷으로 적재하고 legal_terms_changed 템플릿(in_app=mandatory, email=수신설정 대상) 두 채널에 대해 admin_send_notification을 호출해 notification_dispatches 행 2건(즉시 running)을 만든다. 실제 수신자 산정은 topik-ai 소유 pg_cron 디스패처가, 실제 SMTP 전달은 topik-ai 워커가 집행한다. 사용자 측에서는 /terms 페이지(force-dynamic)가 legal_documents의 published 행을 로케일별(요청 로케일→ko 폴백)로 읽어 최신 약관을 표시하고, 알림 CTA(/terms-agreement)로 진입한 로그인 사용자는 동의 화면에서 acceptRequiredConsentsAction을 통해 새 버전의 누락 동의를 user_consents에 기록하여 재동의를 완료한다. 알림 대상=전체 활성 사용자.

**1. admin_publish_operation_policy_version(p_policy_id, p_history_id, p_reason) — Postgres SECURITY DEFINER RPC (topik-ai, is_admin 게이트)**
   - 입력: p_policy_id(예 'POL-001'), p_history_id(되돌릴 히스토리 스냅샷 id 예 'PH-0001'), p_reason(운영 사유 필수)
   - 출력: p_policy_id(text) 반환. 부수효과: operation_policies 행을 히스토리 snapshot 값으로 갱신+status='published', current_version_id 갱신, operation_policy_histories에 'version_published' 행 추가, admin_audit_logs에 'policy_version_published' 기록(version from/to·status from/to). 정의 위치 migrations-admin/20260617170000_operation_policies.sql:438
   - → 다음으로: RPC가 성공하면 서비스가 곧바로 loadOperationPolicy(payload.policyId)로 갱신된 정책을 재조회한다(:474). 이 재조회 결과(status='게시', policyType, title, bodyHtml, versionLabel, effectiveDate, requiresConsent, en 필드)가 다음 단계 투영의 입력이 된다 — 정책이 SoT, legal_documents는 이 내용을 받아 적는 미러.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-ai/src/features/operation/api/supabase-operation-policies-service.ts:463 (publishOperationPolicyHistoryVersion)`

**2. admin_sync_legal_document_from_operation_policy(p_source_policy_id, p_source_policy_history_id, p_policy_type, p_version, p_effective_date, p_requires_consent, p_title_ko, p_body_ko, p_summary_ko, p_title_en, p_body_en, p_summary_en) — Postgres SECURITY DEFINER RPC (v13 소유, is_platform_admin 게이트)**
   - 입력: 재조회한 정책에서 매핑: p_policy_type(이용약관/개인정보 처리방침), p_version=versionLabel, p_title_ko=title, p_body_ko=bodyHtml, p_summary_ko=summary, en 3종(있으면), p_requires_consent, p_effective_date. 게시 상태이고 policyType이 이용약관/개인정보일 때만 호출(LEGAL_DOC_TYPE_BY_POLICY_TYPE 가드).
   - 출력: jsonb { doc_type, version, written:[id...] } 반환. 부수효과: 같은 doc_type의 다른 version published 행을 'archived'로 강등; (doc_type, version, locale) 단위로 ko 항상·en 선택 upsert -> status='published'. 동일 키 다른 본문이면 'immutable version conflict' 예외. 정의 위치 v13/supabase/migrations/20260622150000_legal_documents_projection.sql:39
   - → 다음으로: 이 단계로 v13 legal_documents에 현재 버전 약관이 published 상태로 1개만 남는다(이전 버전 archived). 이제 사용자 측 /terms 읽기(5단계)와 재동의 누락 판정(getMissingRequiredConsentDocuments)이 이 새 행을 보게 된다. 단, 사용자에게 변경을 알리는 것은 별도 액션(3단계)이 담당.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-ai/src/features/operation/api/supabase-operation-policies-service.ts:290 (syncLegalProjection, publishOperationPolicyHistoryVersion이 :475에서 호출)`

**3. admin_send_terms_change_notification(p_reason) — Postgres SECURITY DEFINER RPC (topik-ai, is_admin 게이트)**
   - 입력: p_reason(운영 사유 필수). 별도 수동 발송 액션 — 발행과 트랜잭션으로 묶이지 않음.
   - 출력: jsonb { group_id, recipients, in_app_dispatch, email_dispatch }. 부수효과: profiles.status='active' 전원을 '전체 활성 사용자' notification_groups 정적 그룹 static_member_ids에 스냅샷 적재; legal_terms_changed 템플릿 in_app/email 각각에 대해 admin_send_notification 호출. 정의 위치 migrations-admin/20260622170000_legal_terms_change_notification.sql:37
   - → 다음으로: 내부적으로 admin_send_notification을 2번 호출해(:105, :108) notification_dispatches 행 2건을 생성한다 — 이것이 다음 단계.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-ai/src/features/operation/api/supabase-operation-policies-service.ts:493 (sendTermsChangeNotification)`

**4. admin_send_notification(p_template_id, p_group_ids, p_scheduled_at, p_reason, p_target_type) — Postgres SECURITY DEFINER RPC (topik-ai, is_admin 게이트)**
   - 입력: in_app/email 각 template_id, p_group_ids=[전체 활성 사용자 그룹 id], p_scheduled_at=null(즉시), p_target_type='group', p_reason
   - 출력: 각 호출이 dispatch uuid 반환. 부수효과: notification_dispatches 행 INSERT(status='running', channels, target_group_ids, dedupe_key='admin:'+uuid, started_at=now); admin_audit_logs에 'notification_dispatch_created' 기록(mandatory면 bypass_reason 포함). 정의 위치 migrations-admin/20260612170100_notification_admin_rpcs.sql:331(INSERT)
   - → 다음으로: notification_dispatches는 발송 대기 큐 레코드. 실제 수신자 산정과 user_notifications(인앱 카드) 생성은 topik-ai 소유 pg_cron 디스패처가, 이메일 발송은 topik-ai 워커가 비동기로 집행한다. 인앱은 mandatory(전원 수신, 수신거부 불가), 이메일은 pref_on+email_on 사용자만 발송. 알림 CTA는 /terms-agreement로, 사용자를 약관 확인/재동의로 유도.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-ai/supabase/migrations-admin/20260622170000_legal_terms_change_notification.sql:105,108 (admin_send_terms_change_notification 내부)`

**5. legal_documents SELECT (PostgREST, anon-readable RLS legal_documents_published_read) — v13 서버에서 published 약관 조회**
   - 입력: doc_type='terms', locale=요청 로케일(없으면 ko), status='published', effective_at desc/created_at desc limit 1. 요청 로케일 행이 없고 ko가 아니면 ko로 폴백(vi -> ko).
   - 출력: PublishedLegalDocument(id, doc_type, version, locale, title, body, summary, effective_at, is_placeholder) 1건 또는 null. /terms는 doc가 있고 !is_placeholder면 TermsDocument로 DB 본문 표시, 없으면 i18n placeholder 폴백.
   - → 다음으로: 사용자는 2단계에서 투영된 최신 published 약관 본문을 본다. requires_consent=true인 약관(이용약관/개인정보)은 재동의 대상 — 로그인 사용자는 누락 동의 판정으로 넘어간다.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-project/v13/src/lib/legal/documents.ts:46 (fetchPublished, /terms 페이지 src/app/terms/page.tsx:26에서 getPublishedLegalDocument('terms', locale) 호출)`

**6. user_consents INSERT (PostgREST) + 선행 getMissingRequiredConsentDocuments(legal_documents/user_consents SELECT) — v13 재동의 기록**
   - 입력: getMissingRequiredConsentDocuments(userId, locale): requires_consent=true·published 문서를 doc_type별 최신으로 추리고, user_consents에 이미 동의한 document_id를 빼서 '누락' 문서 산출. 그 후 user_consents에 {user_id, document_id(새 버전 행 id), doc_type, version, source} INSERT.
   - 출력: user_consents 신규 동의 행(들). 새 약관 버전 document_id로 동의가 기록되어 누락 목록이 비워짐. 이후 next 경로로 redirect.
   - → 다음으로: 릴레이 종료: 사용자가 새 버전에 재동의 완료. admin 측은 admin_get_user_legal_consents(20260622160000_user_legal_consents_read.sql)로 회원 상세에서 동의 버전과 현재 published 버전 일치 여부(is_current)를 READ-ONLY로 확인할 수 있어 추적 루프가 닫힌다. 동의하지 않은 사용자는 누락 목록에 남아 재진입 시 다시 동의 요구.
   - 코드: `C:/Users/admin/Desktop/workspace/topik-project/v13/src/app/auth/consent/actions.ts:44 (acceptRequiredConsentsAction -> recordRequiredConsents, src/lib/legal/consent.ts:143 INSERT)`

> 참고: 동기/비동기·멱등·실패 처리: ①발행과 legal 투영은 프론트에서 순차 동기 호출(publish RPC 성공 -> 재조회 -> syncLegalProjection)이며 별도 트랜잭션이라 투영 실패 시 정책은 published인데 미러가 갱신 안 되는 부분 일관성 위험이 존재(서비스가 한국어 에러 메시지로 표면화). ②알림 발송은 별도 수동 액션(sendTermsChangeNotification)으로, 발행과 묶이지 않음 -> 관리자가 발행 후 알림을 따로 눌러야 함. ③멱등성: legal 투영은 동일 (doc_type,version,locale) 동일 본문이면 update로 재동기 OK, 본문 다르면 immutable conflict로 거부(append-only 계약). ④알림 멱등: dedupe_key='admin:'+uuid로 dispatch마다 신규(중복 방지는 디스패처/수신자 단). ⑤권한: publish/notify/dispatch는 private.is_admin, legal sync는 더 강한 private.is_platform_admin 게이트(v13 소유 테이블 쓰기). ⑥소유권 경계: topik-ai는 legal_documents/user_consents를 직접 쓰지 않고 v13 RPC만 호출, admin 측 admin_get_user_legal_consents는 READ-ONLY 참조. ⑦로케일: ko 필수·en 선택, vi 등은 ko 폴백(legal_documents 행 없음). ⑧실집행 비동기: notification_dispatches는 큐 레코드일 뿐이고 user_notifications 생성은 topik-ai 소유 pg_cron 디스패처, 이메일 전달은 topik-ai 워커가 수행한다. v13은 user_notifications 객체와 사용자 UI를 소유한다. ⑨시크릿: 본 체인 자체엔 외부 시크릿 없음(SMTP는 후속 워커 단계). 활성 회원 정의=profiles.status='active' 스냅샷.
