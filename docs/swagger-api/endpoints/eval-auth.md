# Eval Auth API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/eval-auth.md)

Internal evaluation dashboard login endpoint.

Swagger tag description:

**Eval Dashboard Auth / 평가 대시보드 인증**

Login for the internal AI evaluation dashboard. Only accounts in `EVAL_ADMIN_EMAILS` can authenticate.

내부 AI 평가 대시보드 로그인. `EVAL_ADMIN_EMAILS` 허용 목록의 계정만 인증 가능합니다.

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`POST`|`/api/eval/auth/login`|Eval dashboard login|

## Endpoint Details

### POST /api/eval/auth/login

Summary: Eval dashboard login
Operation ID: `eval_login_api_eval_auth_login_post`

Description:

Eval dashboard login / 평가 대시보드 로그인

**EN:** Authenticates with email + password and returns the user's normal JWT,
which carries their real DB roles. Access requires the DB-backed `admin` role
(granted via `scripts/bootstrap_admin.py`); an optional `EVAL_ADMIN_EMAILS`
allowlist further restricts who may sign in. No `admin` role is ever injected.

**KR:** 이메일 + 비밀번호로 인증하고 실제 DB 역할이 담긴 일반 JWT를 반환합니다.
DB의 `admin` 역할(`scripts/bootstrap_admin.py`로 부여)이 필요하며, 선택적
`EVAL_ADMIN_EMAILS` 허용 목록으로 추가 제한할 수 있습니다. `admin` 역할을 임의로 부여하지 않습니다.

**Request example / 요청 예시:**
```json
{ "email": "admin@example.com", "password": "yourpassword" }
```

**Response example / 응답 예시:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": "uuid", "email": "admin@example.com", "display_name": "Admin" }
}
```

- `401` — Invalid credentials / 이메일 또는 비밀번호 오류
- `403` — Account not in allowlist / 허용 목록에 없는 계정

Required request headers / auth:
- No auth scheme declared for this operation.

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[LoginRequest](../schemas/eval-auth.md#loginrequest)|-|

Responses:
- `200` Authenticated. Returns the user's JWT, refresh token, and profile.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[LoginResponse](../schemas/eval-auth.md#loginresponse)|{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","refresh_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{"id":"uuid","email":"admin@example.com","display_name":"Admin"}}|
- `401` Invalid email or password.
- `403` Account not in EVAL_ADMIN_EMAILS allowlist, or missing the DB `admin` role.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|
