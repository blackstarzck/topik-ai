# TalkPik AI Service API 레퍼런스

> TOPIK II AI 학습 플랫폼 백엔드(`TalkPik AI Service`)의 외부 공개 API 명세를 정리한 문서다.
> 관리자(`topik-ai`) 문서들이 참조하는 상류 서비스의 계약을 한 곳에서 확인하기 위해 작성했다.

> **admin 통합 방향 주석 (2026-06-11 갱신)**: 아래 엔드포인트 스펙은 상류 API 스냅샷 원문이며 수정 대상이 아니다. 종전 admin 문서들이 전제하던 "검수 완료 문항의 상류 업로드(push 배포)" 통합 방향은 2026-06-11 인바운드 전환(결정 기록 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)으로 **폐기**됐다. Writing 파트(§7)의 작문 과제 API는 v13 사용자 노출용이며, admin의 TOPIK 쓰기 문항 통합 방향은 **인바운드 수신**(문항 공급 API 신설 요청 중 — **미개발**, 본 스냅샷에 미포함)이다. admin은 이 문서의 어떤 엔드포인트로도 문항을 업로드/배포하지 않는다.

## 1. 문서 메타

| 항목 | 값 |
|------|----|
| 서비스명 | TalkPik AI Service |
| API 버전 | `0.1.0` |
| OpenAPI 버전 | `3.1.0` |
| Swagger UI | `http://58.236.187.135:9009/docs#/` |
| OpenAPI JSON | `http://58.236.187.135:9009/openapi.json` |
| Base URL | `http://58.236.187.135:9009` |
| 스냅샷 일자 | 2026-06-09 |
| 엔드포인트 수 | 경로 69개 / 오퍼레이션 71개 |
| 스키마 수 | 106개 |
| 태그(그룹) | 7개 (External Campaign · Writing · reading · listening · eval-auth · admin-eval · Admin Campaign) |

> 이 스키마는 **외부에서 호출하는** API 표면만 다룬다: 랜딩 사이트용 캠페인 API, 작문 연습 API, 내부 평가·캠페인 검토 대시보드 API. 그 외 앱 내부 엔드포인트(reading/listening/vocabulary/analysis 일부)는 의도적으로 제외되었으나, 스키마에 노출된 reading/listening 엔드포인트는 본 문서에 포함했다.

---

## 2. 인증 (Authentication)

엔드포인트 그룹에 따라 두 가지 독립적인 인증 방식을 사용한다.

| 그룹 | 방식 | 헤더 |
|------|------|------|
| **External Campaign** (`/api/external/campaign/*`) | API Key | `X-API-Key: <campaign_api_key>` |
| **Writing**, **reading**, **listening**, **Admin Campaign**, **Admin Evaluation** | JWT Bearer | `Authorization: Bearer <jwt>` |

- 평가·캠페인 대시보드용 JWT는 `POST /api/eval/auth/login`으로 발급받는다. `EVAL_ADMIN_EMAILS` 허용 목록에 있고 DB `admin` 역할을 가진 계정만 로그인 가능하다.
- 보안 스킴 정의
  - `BearerAuth`: `type=http`, `scheme=bearer`
  - `CampaignApiKey`: `type=apiKey`, `in=header`, `name=X-API-Key`

```http
Authorization: Bearer <your_access_token>
X-API-Key: <campaign_api_key>
```

### 역할(Role) 모델

캠페인 관리 엔드포인트는 호출자의 역할에 따라 권한이 분기된다.

| 역할 | 주요 권한 |
|------|-----------|
| `ops_admin` | 배정, 강제 무효화, 재발송, 거의 모든 변경 |
| `dev_admin` | 삭제, 강제 무효화, 재발송 |
| `kr_content` | KR 콘텐츠 편집, 원본 필드 편집 |
| `vn_translator` | VN 번역 저장 (단, `kr_feedback` 편집 불가) |
| `admin` | 평가(eval) 대시보드 전체 |

---

## 3. Rate Limits (요청 속도 제한)

초과 시 `429 Too Many Requests`를 반환한다.

| 엔드포인트 | 제한 |
|-----------|------|
| `POST /api/writing/submit` | 5 req/min |
| `POST /api/writing/generate` | 10 req/min |
| `POST /api/writing/chat` | 20 req/min |
| `POST /api/reading/generate` | 10 req/min |
| `POST /api/reading/session` | 5 req/min |
| `POST /api/reading/session/stream` | 5 req/min |
| `POST /api/listening/session` | 5 req/min |
| `POST /api/listening/session/stream` | 5 req/min |
| `POST /api/listening/session/{id}/submit` | 30 req/min |
| `POST /api/external/campaign/uploads` | 50 req/min |
| `POST /api/external/campaign/submissions` | 50 req/min |
| `POST /api/external/campaign/waitlist` | 50 req/min |
| `POST /api/external/campaign/follow-up` | 50 req/min |
| `POST /api/external/campaign/contact` | 50 req/min |

---

## 4. 공통 에러 코드

| 코드 | 의미 |
|------|------|
| 200 | 성공 |
| 201 | 생성됨 |
| 202 | 비동기 처리 시작됨 (accepted) |
| 400 | 잘못된 요청 / 검증 오류 |
| 401 | 인증 실패 — 토큰·API 키 누락 또는 무효 |
| 403 | 권한 없음 |
| 404 | 리소스를 찾을 수 없음 |
| 409 | 충돌 — 잘못된 상태 전이 |
| 413 | 업로드 용량 초과 |
| 415 | 지원하지 않는 파일 형식 |
| 422 | 처리 불가 엔터티 (Pydantic 검증 실패) |
| 429 | 요청 횟수 초과 (rate limited) |
| 500 | 내부 서버 오류 |
| 502 | 업스트림·스토리지 오류 |
| 503 | 서비스 이용 불가 (큐·캐시 다운) |

`422` 응답 본문은 표준 FastAPI 형식(`HTTPValidationError`)을 따른다.

```json
{ "detail": [ { "loc": ["body", "field"], "msg": "...", "type": "..." } ] }
```

---

## 5. 스트리밍 (SSE)

일부 엔드포인트는 `text/event-stream`을 반환한다. `EventSource`로 연결해 종료 마커까지 named 이벤트를 읽는다.

| 엔드포인트 | SSE 이벤트 |
|-----------|-----------|
| `POST /api/writing/chat` | `data:` 청크 → `data: [DONE]` |
| `POST /api/reading/session/stream` | `meta`, `problem`, `error`, `done` |
| `POST /api/listening/session/stream` | `meta`, `problem`, `error`, `done` |

- **writing/chat**: 각 이벤트는 `data: <부분 텍스트>` (개행은 `\n`으로 이스케이프). 주기적으로 `: keep-alive` 코멘트 전송. 오류는 `data: {"error": "..."}` 후 `[DONE]`으로 마감.
- **reading·listening session/stream**:
  - `event: meta` — `{session_id, total_questions, status}` 최초 1회.
  - `event: problem` — 생성된 문제 1건씩 (`{index, id, question_type, difficulty, passage, question, choices}`).
  - `event: error` — `{index, message}` 단일 문제 실패·타임아웃 (스트림은 다음 인덱스로 계속).
  - `event: done` — 종료 마커 `{session_id, total_generated}`. 항상 스트림을 닫는다.

---

## 6. 엔드포인트 — External Campaign

랜딩 사이트가 호출하는 공개 캠페인 API. 인증은 `X-API-Key`. 작문 답안 제출은 2단계(업로드 → 제출)이며, 제출 후 상태 폴링으로 결과를 받는다.

| 메서드 | 경로 | 설명 | 성공 |
|--------|------|------|------|
| POST | `/api/external/campaign/uploads` | 답안지 첨부 업로드 (제출 1단계) | 201 |
| POST | `/api/external/campaign/submissions` | 캠페인 제출 생성 (제출 2단계, 검토 접수) | 202 |
| GET | `/api/external/campaign/submissions/{submission_id}` | 제출 상태·결과 폴링 | 200 |
| POST | `/api/external/campaign/waitlist` | 랜딩 대기자 명단 등록 (퍼널 최상단 리드) | 201 |
| POST | `/api/external/campaign/follow-up` | 결과 후 만족도 설문 제출 | 201 |
| POST | `/api/external/campaign/contact` | 'Contact us' 문의 제출 (일반 리드·지원) | 201 |

### 6.1 업로드 → 제출 흐름

1. `POST /uploads` (`multipart/form-data`, 필드 `file`) → 응답 `CampaignUploadResponse`의 `url`을 받는다.
   - 20MB 제한(413), 매직바이트 검증(415), 빈 파일(400), 스토리지(SeaweedFS) 실패(502).
2. `POST /submissions`에 1단계의 `url`을 `image_url`로 넣어 제출(`CampaignSubmitRequest`).
   - 캠페인 기간 종료 시 `400` (`CAMPAIGN_WINDOW_CLOSED`).
   - 과제별 규칙(422): **Q51/Q52**는 `user_answers`/`provided_question_texts`/`provided_question_ids` 각각 정확히 3개. **Q53/Q54**는 이미지(`image_url`/`image_urls`) 또는 텍스트 100자 이상 필요.
3. `GET /submissions/{id}`로 상태 폴링 → `CampaignStatusResponse`. 채점 완료 시 `feedback`/점수 채워짐.

### 6.2 주요 요청 본문 — `CampaignSubmitRequest`

| 필드 | 타입 | 필수 | 비고 |
|------|------|:----:|------|
| `email` | string | ✓ | 그림자 사용자 프로필 upsert·결과 전달용 |
| `display_name` | string | ✓ | 결과 PDF·대시보드 표시명 |
| `language` | enum `ko\|vi\|en` | | 결과/UI 언어 |
| `marketing_consent` | boolean | | 마케팅 후속 메일 동의 |
| `task_type` | enum `Q51\|Q52\|Q53\|Q54` | ✓ | TOPIK 작문 과제 |
| `text` | string | ✓ | 채점 대상 답안 |
| `passage_context` | string | | 답안이 응답하는 지문/프롬프트 |
| `provided_question_ids` | array<string> | | Q51/Q52 전용, 최대 3 |
| `provided_question_texts` | array<ProvidedQuestion> | | Q51/Q52 전용, 최대 3 |
| `user_answers` | array<string> | | Q51/Q52 전용, 최대 3 |
| `question_topic_text` | string | | Q53/Q54 전용 (서비스 계층 필수) |
| `image_url` / `image_urls` | string / array | | 손글씨 답안 사진, 최대 3장 |
| `source_channel` · `community_group` · `community_post_url` · `staff_owner` | string | | 유입 출처 attribution |
| `webhook_url` | string | | 워크플로 완료 콜백 |

`CampaignSubmitResponse`: `submission_id`, `user_id`, `workflow_status`, `is_duplicate`, `due_at`, `estimated_seconds`.

### 6.3 리드 캡처 엔드포인트

- **waitlist** (`CampaignWaitlistRequest`): `email`(필수) + `locale`/`source`/`pathname`/`referrer`/`user_agent`. 이메일별 멱등(upsert) — 응답에 `submission_count`(중복 등록 카운터).
- **contact** (`CampaignContactRequest`): `name`/`email`/`inquiry_type`/`message`(필수). append-only, 한 사람이 여러 번 가능. `inquiry_type`은 모달 셀렉트의 현지화 라벨(자유 텍스트).
- **follow-up** (`CampaignFollowUpRequest`): `email` + `helpfulness_score`(1–5) + `most_helpful_part`/`retry_interest`/`ai_feedback_interest_after_result`/`paid_beta_interest`(필수). 이메일로만 연결, append-only.

---

## 7. 엔드포인트 — Writing (작문)

JWT 인증. AI 작문 프롬프트 생성, 제출·비동기 채점, 채팅 튜터, 기록 관리.

> **admin 관점 주석 (2026-06-11)**: 이 그룹은 v13 사용자 기능(작문 연습)의 노출 표면이다. `GET /api/writing/tasks`를 admin "검수 완료 문항 업로드(push)"의 배포 대상으로 보던 구판 서술은 인바운드 전환으로 폐기됐다 — admin은 본 API에 문항을 쓰지 않으며, 문항 유입은 별도의 외부 공급(인바운드) API(신설 요청 중 — 미개발)로 받아 Supabase에 적재한다.

| 메서드 | 경로 | 설명 | 성공 |
|--------|------|------|------|
| POST | `/api/writing/generate` | TOPIK II 작문 프롬프트 생성 | 200 |
| POST | `/api/writing/submit` | 작문 제출 → 비동기 AI 평가 | 202 |
| POST | `/api/writing/chat` | AI 작문 채팅 튜터 (SSE) | 200 |
| POST | `/api/writing/save-draft` | 작문 초안 자동 저장 | 200 |
| GET | `/api/writing/history` | 작문 제출 이력 | 200 |
| DELETE | `/api/writing/history/{submission_id}` | 작문 제출 삭제 | 200 |
| GET | `/api/writing/feedback/{submission_id}/export-pdf` | 피드백 PDF 내보내기 | 200 |
| GET | `/api/writing/tasks` | 작문 과제 목록 | 200 |
| GET | `/api/writing/tasks/{task_type}` | 특정 작문 과제 조회 (DB 또는 AI fallback) | 200 |

### 핵심 본문

- **`WritingSubmitRequest`**: `task_type`(`Q51\|Q52\|Q53\|Q54`, 필수), `text`(필수, 최소 길이 과제별 상이: Q51/Q52=5, Q53=20, Q54=100자), `lang`(`ko\|en\|vi`), `user_id`/`task_id`(nullable), `passage_context`(Q51/Q52 지문). → `SubmissionResponse`(`submission_id`, `status`, `message`).
- **`WritingGenerateRequest`**: `task_type`(`task51\|task53\|task54`, 필수), `topic`/`context_type`(nullable), `difficulty`(`easy\|medium\|hard`). → `GenerateProblemResponse`(폴리모픽 passthrough: `task_type`/`title`/`instruction`/`topic`/`max_score`/`difficulty` + 과제별 추가 키).
- **`WritingChatRequest`** (SSE): `message`(필수), `task_id`(`Q51..Q54`), `essay_text`/`previous_draft`/`conversation_history`(최대 30턴 `{role,content}`)/`topic`/`passage_context`/`active_blank`/`lang`/`consecutive_wrong`(0–10).
- **`SaveDraftRequest`**: `task_type`(`task51\|task53\|task54`, 필수), `text`(필수), `task_id`(nullable), `time_spent`. → `SaveDraftResponse`(`submission_id`, `saved_at`, `character_count`).
- **이력 필터**(`GET /history`): `limit`/`offset`/`task_type`/`status`/`date_from`/`date_to`.

> 점수 배점: Q51/Q52 = 10, Q53 = 30, Q54 = 50.

---

## 8. 엔드포인트 — reading (읽기)

JWT 인증. 단건 문제 생성·제출과 세션 기반(여러 문제) 흐름을 모두 제공한다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/reading/generate` | 읽기 문제 생성 (10/min, 502 가능) |
| POST | `/api/reading/submit` | 단건 읽기 답안 제출 |
| POST | `/api/reading/session` | 읽기 세션 생성 (5/min, 502 가능) |
| POST | `/api/reading/session/stream` | 읽기 세션 생성 (SSE) |
| GET | `/api/reading/session/{session_id}` | 세션 상태 조회 |
| GET | `/api/reading/session/{session_id}/results` | 세션 결과 조회 |
| POST | `/api/reading/session/{session_id}/submit` | 세션 답안 제출 |
| POST | `/api/reading/bookmark/{problem_id}` | 읽기 북마크 토글 |
| GET | `/api/reading/history` | 읽기 제출 이력 |
| GET | `/api/reading/question-types` | 읽기 문제 유형 목록 |

- **읽기 문제 유형**: `fill_in_blank`(31–34), `content_match`(35–38), `ordering`(39–41), `topic_title`(42–43), `blank_inference`(44–45), `main_idea`(46–47), `long_reading`(48–50).
- **`ReadingGenerateRequest`**: `question_type`(nullable=랜덤), `difficulty`(`easy\|medium\|hard`), `topik_level`(3–6), `topic`, `count`(1–10), `lang`(`ko\|en\|vi`).
- **`ReadingSessionCreateRequest`**: `target_level`(1–6), `question_types`(빈 배열=랜덤 믹스), `question_count`(1–20), `lang`.
- 세션 상태: `active`/`completed`/`abandoned`.

---

## 9. 엔드포인트 — listening (듣기)

JWT 인증. 구조는 reading과 유사하며, TTS 오디오를 HMAC 서명 프록시 URL로 제공한다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/listening/session` | 듣기 세션 생성 (블로킹, 5/min) |
| POST | `/api/listening/session/stream` | 듣기 세션 생성 (SSE) |
| GET | `/api/listening/session/{session_id}` | 세션 상태 조회 |
| GET | `/api/listening/session/{session_id}/results` | 세션 결과 조회 |
| POST | `/api/listening/session/{session_id}/submit` | 답안 제출 (30/min) |
| GET | `/api/listening/audio/{session_id}/{filename}` | 오디오 스트림 (서명 프록시, `?token=` 필수) |
| POST | `/api/listening/bookmark/{problem_id}` | 듣기 북마크 토글 |
| GET | `/api/listening/history` | 듣기 제출 이력 |
| GET | `/api/listening/question-types` | 레벨별 듣기 문제 유형 |

- **듣기 문제 유형**: `dialogue`(대화 1–4), `discourse`(담화 5–8), `chart_graph`(도표/그래프 9–12), `content_match`(내용 일치 13–16), `main_idea`(중심 내용 17–20), `comprehensive`(종합 21–50).
- 오디오 URL은 `/api/listening/audio/{session_id}/{problem_id}.mp3?token=...` 형태의 서명 프록시. 생성 중이면 `audio_url`은 null.
- 답안 제출 응답(`ListeningAnswerResultResponse`)은 정오답·해설·오답 분석·스크립트(`ListeningScriptDTO`)·관련 어휘·획득 XP를 포함한다.

---

## 10. 엔드포인트 — eval-auth (평가 대시보드 로그인)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/eval/auth/login` | 평가·캠페인 대시보드 로그인 |

- **`LoginRequest`**: `email`, `password`. → **`LoginResponse`**: `token`(JWT access), `refresh_token`, `user`(`id`/`email`/`display_name`/`roles`).
- `403`: `EVAL_ADMIN_EMAILS` 허용 목록 미포함 또는 DB `admin` 역할 없음.

---

## 11. 엔드포인트 — admin-eval (평가 대시보드)

JWT 인증 + `admin` 역할 필요. 골든 데이터셋(eval run), 케이스 결과·통계, 전문가 리뷰, 파이프라인 실행 제어.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/eval/datasets` | 골든 데이터셋(eval run) 목록 (`pipeline` 필터) |
| GET | `/api/admin/eval/datasets/{dataset_id}/results` | 데이터셋 케이스 결과 (`status` 필터) |
| GET | `/api/admin/eval/datasets/{dataset_id}/stats` | 데이터셋 통계 (합격률·평균·분포) |
| GET | `/api/admin/eval/reviews/{target_type}/{target_id}` | 대상의 모든 전문가 리뷰 |
| POST | `/api/admin/eval/reviews/{target_type}/{target_id}` | 전문가 리뷰 제출·갱신 (upsert) |
| GET | `/api/admin/eval/reviews/{target_type}/{target_id}/my` | 내 전문가 리뷰 (`{}` 가능) |
| POST | `/api/admin/eval/run` | 평가 파이프라인 실행 트리거 |
| GET | `/api/admin/eval/run/{run_id}/status` | 실행 상태 폴링 (Redis TTL 2h, 404/503 가능) |
| GET | `/api/admin/eval/stats/overview` | 대시보드 개요 통계 |
| GET | `/api/admin/eval/submissions/{submission_id}` | 제출 상세 (에세이·점수·피드백) |
| GET | `/api/admin/eval/users` | 채점된 제출이 있는 사용자 목록 |
| GET | `/api/admin/eval/users/{user_id}/submissions` | 특정 사용자의 채점된 제출 |

- **`EvalRunRequest`**: `pipeline`(`writing_scorer\|content_generation\|chat_tutor\|exam_feedback\|chat_modes\|q53_dsl`), `dataset`(이름 또는 `all`), `mode`(`full\|quick\|stability`), `case_filter`(단일 케이스 id). → `EvalRunResponse`(`run_id`, `status`=`running`, `pid` …).
- 실행 상태(`EvalRunStatusResponse`): `running`/`completed`/`failed`/`error`. 완료 시 `exit_code`/`stdout_tail`/`stderr_tail`.
- **`ReviewRequest`**(upsert): `agreement`(`agree\|mostly_agree\|partial\|disagree\|''`), `grade`(`A\|B\|C\|D\|F\|''`), `disagreed_sections`, `section_feedbacks`, `general_feedback`.
- 데이터셋·결과 목록은 SQLite 컬럼을 그대로 통과(passthrough)시키는 untyped 페이로드다.

---

## 12. 엔드포인트 — Admin Campaign (캠페인 운영)

JWT 인증 + 캠페인 역할 필요. 제출 검토 큐, 워크플로 상태 전이, 채점·PDF·메일 비동기 작업, 감사 로그.

### 조회·목록

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/admin/campaign/stats/overview` | 캠페인 통계 개요 | 캠페인 역할 |
| GET | `/api/admin/campaign/submissions` | 제출 검토 큐 (`status`/`task_type` 필터) | 캠페인 역할 |
| GET | `/api/admin/campaign/submissions/{submission_id}` | 제출 상세 | 캠페인 역할 |
| GET | `/api/admin/campaign/submissions/{submission_id}/audit-log` | 제출 감사 로그 | 캠페인 역할 |
| GET | `/api/admin/campaign/submissions/{submission_id}/attachments/{idx}` | 답안 첨부 다운로드 | 캠페인 역할 |
| GET | `/api/admin/campaign/submissions/{submission_id}/pdf/download` | 생성된 PDF 다운로드 | 캠페인 역할 |
| GET | `/api/admin/campaign/users` | 캠페인 사용자 목록 | 캠페인 역할 |
| GET | `/api/admin/campaign/users/{email}/submissions` | 특정 사용자 제출 목록 | 캠페인 역할 |
| GET | `/api/admin/campaign/reviewers` | 배정 가능 리뷰어 목록 | 캠페인 역할 |
| GET | `/api/admin/campaign/waitlist` | 대기자 명단 | 캠페인 역할 |
| GET | `/api/admin/campaign/contact-inquiries` | Contact us 문의 목록 | 캠페인 역할 |
| GET | `/api/admin/campaign/tasks/{task_id}/status` | 백그라운드 작업 상태 폴링 | 캠페인 역할 |

### 변경·조치

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/admin/campaign/submissions/{id}/assign` | 리뷰어 배정 | `ops_admin` |
| POST | `/api/admin/campaign/submissions/{id}/claim` | 셀프 클레임 | `kr_content`/`vn_translator`/`ops_admin` |
| POST | `/api/admin/campaign/submissions/{id}/content-edit` | KR 콘텐츠 편집 저장 | `kr_content`/`ops_admin` |
| POST | `/api/admin/campaign/submissions/{id}/source-edit` | 원본 필드 편집 | `kr_content`/`ops_admin`/`dev_admin` |
| POST | `/api/admin/campaign/submissions/{id}/translation` | VN 번역·리뷰 피드백 저장 | `vn_translator`/`ops_admin` |
| POST | `/api/admin/campaign/submissions/{id}/state` | 워크플로 상태 전이 | 캠페인 역할 |
| POST | `/api/admin/campaign/submissions/{id}/score` | AI 채점 작업 등록 (202) | 채점 가능 역할 |
| POST | `/api/admin/campaign/submissions/{id}/pdf` | PDF 렌더 작업 등록 (202) | PDF 가능 역할 |
| POST | `/api/admin/campaign/submissions/{id}/email` | 결과 메일 작업 등록 (202) | 메일 가능 역할 |
| POST | `/api/admin/campaign/submissions/{id}/resend-email` | 결과 메일 재발송 (202) | `ops_admin`/`dev_admin` |
| POST | `/api/admin/campaign/submissions/{id}/invalidate` | 강제 무효화 | `ops_admin`/`dev_admin` |
| DELETE | `/api/admin/campaign/submissions/{submission_id}` | 제출 삭제 | `ops_admin`/`dev_admin` |

### 워크플로 상태(`workflow_status`) 머신

```
submitted → ai_drafted → content_review → translation_review → pdf_ready → delivered → followup_sent
                                                                    ↘ invalid
                                                                    ↘ resend_required
```

전체 enum: `submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required`. 잘못된 전이는 `409`.

### 비동기 작업 패턴

`score`/`pdf`/`email`/`resend-email`은 `202`로 `TaskEnqueuedResponse`(`task_id`, `status=queued`)를 반환한다. `GET /tasks/{task_id}/status`로 ARQ 작업 상태(`TaskStatusResponse`: `status`, 완료 시 `result`)를 폴링한다.

- 채점은 제출이 `submitted` 상태일 때만 가능(409).
- 메일은 PDF 생성 후에만 가능, 진행 중 메일 작업이 있으면 409.
- ARQ 등록 실패 시 503.

### SLA

`CampaignStatsOverview`는 `sla_at_risk`(due_at 6시간 이내), `sla_breached`(due_at 경과·미전달)를 집계한다. 목록 행에도 `sla_risk` 불리언이 포함된다.

---

## 13. 주요 enum 정리

| 도메인 | enum 값 |
|--------|---------|
| 작문 과제(캠페인) | `Q51`, `Q52`, `Q53`, `Q54` |
| 작문 과제(연습) | `task51`, `task53`, `task54` |
| 난이도 | `easy`, `medium`, `hard` |
| 언어 | `ko`, `vi`, `en` |
| 캠페인 워크플로 | `submitted`, `ai_drafted`, `content_review`, `translation_review`, `pdf_ready`, `delivered`, `followup_sent`, `invalid`, `resend_required` |
| 읽기 문제 유형 | `fill_in_blank`, `content_match`, `ordering`, `topic_title`, `blank_inference`, `main_idea`, `long_reading` |
| 듣기 문제 유형 | `dialogue`, `discourse`, `chart_graph`, `content_match`, `main_idea`, `comprehensive` |
| eval 파이프라인 | `writing_scorer`, `content_generation`, `chat_tutor`, `exam_feedback`, `chat_modes`, `q53_dsl` |
| eval 실행 모드 | `full`, `quick`, `stability` |
| 리뷰 동의 | `agree`, `mostly_agree`, `partial`, `disagree`, `''` |
| 리뷰 등급 | `A`, `B`, `C`, `D`, `F`, `''` |

---

## 14. 페이지네이션 관례

목록 엔드포인트는 대부분 `limit`/`offset` 쿼리 파라미터를 받고, 응답에 `total`(전체 매칭 수)을 포함한다. eval 계열은 `limit`/`offset`을 응답에도 echo back 한다. 일반적인 제약: `limit` 1–100, `offset` ≥ 0.

---

## 15. 참고

- 본 문서는 `http://58.236.187.135:9009/openapi.json` (OpenAPI 3.1.0) 스냅샷(2026-06-09)을 기준으로 정리했다. 서버 스펙 변경 시 재생성이 필요하다.
- 스키마 필드 단위의 전체 정의(106개 스키마)는 위 OpenAPI JSON 또는 Swagger UI(`/docs`)에서 직접 확인한다.
