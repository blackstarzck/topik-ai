# Swagger API 문서

이 폴더는 `https://api.dotoretopik.com/docs` Swagger 내용을 에이전트가 읽기 쉽게 나눈 문서입니다. 기존의 긴 단일 문서 대신, 필요한 API 그룹과 스키마 그룹만 열어볼 수 있도록 분리했습니다.

- Swagger UI: https://api.dotoretopik.com/docs
- OpenAPI JSON: https://api.dotoretopik.com/openapi.json
- 생성 기준일: 2026-06-23

## 먼저 볼 문서

| 문서 | 언제 보나 | 내용 |
| --- | --- | --- |
| [auth-and-errors.md](./auth-and-errors.md) | API 호출 전에 | `Authorization: Bearer <token>`, `X-API-Key`, `Content-Type`, response/error code 정리 |
| [openapi-reference.md](./openapi-reference.md) | 전체 구조를 빠르게 볼 때 | 전체 endpoint/schema 색인과 분리 문서 링크 |
| [writing-api-v13-screen-map.html](./writing-api-v13-screen-map.html) | v13 Writing 화면 연결 판단 시 | 화면 기능별 Writing API 후보, 공백, 현재 코드 근거 |

## 엔드포인트 문서

각 파일에는 해당 그룹 API의 request header/auth, parameter, request body, response, example value가 들어 있습니다.

| 그룹 | 파일 | 간략 설명 | API 수 |
| --- | --- | --- | --- |
| Admin Campaign API | [endpoints/admin-campaign.md](./endpoints/admin-campaign.md) | 내부 캠페인 리뷰어/관리자 대시보드 API입니다. 사용자 앱 화면용이 아닙니다. | 24 |
| Admin Evaluation API | [endpoints/admin-eval.md](./endpoints/admin-eval.md) | 내부 평가 대시보드에서 채점 제출물, 데이터셋, 리뷰, 평가 실행을 관리합니다. | 12 |
| Admin Users API | [endpoints/admin-users.md](./endpoints/admin-users.md) | 관리자/사용자 계정 목록·생성·조회·수정·삭제와 비밀번호 재설정 API입니다. 조회는 `admin`, 모든 변경은 `super_admin` 권한이 필요합니다. | 6 |
| Eval Auth API | [endpoints/eval-auth.md](./endpoints/eval-auth.md) | 내부 평가 대시보드 로그인 API입니다. | 1 |
| Evaluation API | [endpoints/evaluation.md](./endpoints/evaluation.md) | Writing 제출 후 채점 상태와 피드백을 조회합니다. | 2 |
| External Campaign API | [endpoints/external-campaign.md](./endpoints/external-campaign.md) | 랜딩/캠페인 공개 API입니다. `X-API-Key` 인증을 사용합니다. | 6 |
| Listening API | [endpoints/listening.md](./endpoints/listening.md) | TOPIK 듣기 세션, 오디오, 북마크, 이력, SSE 생성 API입니다. | 10 |
| Reading API | [endpoints/reading.md](./endpoints/reading.md) | TOPIK 읽기 문제 생성, 세션(SSE), 북마크, 이력, 제출 API입니다. | 9 |
| Writing API | [endpoints/writing.md](./endpoints/writing.md) | TOPIK 쓰기 문제, 자동저장, 제출, 챗 튜터, 이력, PDF export API입니다. | 9 |

## 스키마 문서

엔드포인트 문서에서 request/response schema 이름을 확인한 뒤, 아래 스키마 파일에서 필드별 `required`, `type`, `enum`, `default`, `example`, `description`을 확인하면 됩니다.

| 그룹 | 파일 | 스키마 수 |
| --- | --- | --- |
| Common/shared | [schemas/common.md](./schemas/common.md) | 3 |
| Admin Campaign API | [schemas/admin-campaign.md](./schemas/admin-campaign.md) | 26 |
| Admin Evaluation API | [schemas/admin-eval.md](./schemas/admin-eval.md) | 18 |
| Admin Users API | [schemas/admin-users.md](./schemas/admin-users.md) | 5 |
| Eval Auth API | [schemas/eval-auth.md](./schemas/eval-auth.md) | 3 |
| Evaluation API | [schemas/evaluation.md](./schemas/evaluation.md) | 9 |
| External Campaign API | [schemas/external-campaign.md](./schemas/external-campaign.md) | 11 |
| Listening API | [schemas/listening.md](./schemas/listening.md) | 17 |
| Reading API | [schemas/reading.md](./schemas/reading.md) | 15 |
| Writing API | [schemas/writing.md](./schemas/writing.md) | 16 |

전체 스키마 이름으로 찾고 싶으면 [schemas/index.md](./schemas/index.md)를 봅니다.

## 추천 읽기 순서

1. [auth-and-errors.md](./auth-and-errors.md)에서 인증 방식과 오류 코드를 먼저 확인합니다.
2. 필요한 API 그룹의 `endpoints/*.md` 파일을 엽니다.
3. endpoint에 적힌 request/response schema 링크를 따라 `schemas/*.md`에서 필드와 example value를 확인합니다.
4. v13 Writing 화면에 실제로 무엇을 연결할지 판단할 때는 [writing-api-v13-screen-map.html](./writing-api-v13-screen-map.html)을 봅니다.

## 현재 v13 Writing 관련 핵심

- 현재 코드에 다시 남긴 외부 Writing API helper는 `POST /api/writing/save-draft` 자동저장 helper뿐입니다.
- `GET /api/writing/tasks/{task_type}`와 `POST /api/writing/submit`은 문서에는 있지만 현재 v13 화면 코드에 연결하지 않았습니다.
- Swagger에는 자동저장된 전체 답안을 다시 불러오는 전용 API가 없습니다. `GET /api/writing/history?status=draft`는 전체 editor 복구용이 아니라 preview 중심입니다.

## 문서 생성 범위

| 항목 | 값 |
| --- | --- |
| OpenAPI paths | 74 |
| Operations | 79 |
| Component schemas | 123 |
| Security schemes | 2 |
