# Admin Users API

[Back to Swagger API README](../README.md) | [Auth and errors](../auth-and-errors.md) | [Related schemas](../schemas/admin-users.md)

Admin user-account management: list/search accounts, create admin/user accounts, update name and roles, soft-delete, and reset passwords.

Swagger tag: `admin-users` (no tag-level description is declared in the spec)

**Admin User Management / 관리자 계정 관리**

List and search platform accounts, create immediately-activated admin/user accounts, update display name and roles, soft-delete accounts, and reset passwords. Read endpoints require the `admin` role (read-only); all mutations require `super_admin`. Mutations are recorded in `admin_audit_log` (the reset-password secret is never written to the log). Roles are a subset of `{super_admin, admin, student}`.

계정 목록·검색, 즉시 활성화 계정 생성, 이름·역할 수정, 소프트 삭제, 비밀번호 재설정. 조회는 `admin`(읽기 전용), 모든 변경은 `super_admin` 권한이 필요합니다. 변경 작업은 `admin_audit_log`에 기록됩니다(비밀번호는 미기록).

## Endpoint Index

|Method|Path|Summary|
|---|---|---|
|`GET`|`/api/admin/users`|List users (paginated, searchable)|
|`POST`|`/api/admin/users`|Create an admin/user account|
|`GET`|`/api/admin/users/{user_id}`|Get one user by id|
|`PATCH`|`/api/admin/users/{user_id}`|Update a user's name and/or roles|
|`DELETE`|`/api/admin/users/{user_id}`|Soft-delete a user|
|`POST`|`/api/admin/users/{user_id}/password`|Reset a user's password (admin-set)|

## Endpoint Details

### GET /api/admin/users

Summary: List users (paginated, searchable)
Operation ID: `list_users_api_admin_users_get`

Description:

List users newest-first, with optional role filter and substring search.
Soft-deleted users are excluded. **Requires `admin`** (read-only).

사용자 목록 (역할 필터 + 이메일/이름 검색, 페이지네이션).

**Required role:** `admin` (read-only)

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|role|query|no|anyOf<string \| null>|Filter by role: super_admin \| admin \| student|"admin"|
|q|query|no|anyOf<string \| null>|Search email or display_name (substring, case-insensitive)|-|
|limit|query|no|integer|1-100|{"default":20}|
|offset|query|no|integer|>= 0|{"default":0}|

Request body:
- None declared.

Responses:
- `200` Paginated user list, newest first.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminUserListResponse](../schemas/admin-users.md#adminuserlistresponse)|{"items":[{"id":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","email":"newadmin@keduall.com","display_name":"New Admin","roles":["admin"],"is_deleted":false,"account_source":"admin_created","activated_at":"2026-06-22T08:30:00Z","created_at":"2026-06-22T08:30:00Z","last_active_at":null}],"total":3,"limit":20,"offset":0}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`admin`).
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### POST /api/admin/users

Summary: Create an admin/user account
Operation ID: `create_user_api_admin_users_post`

Description:

Create a new, immediately-activated account. **Requires `super_admin`.**

The account is created with `account_source='admin_created'` and the given roles
(default `['admin']`). The action is recorded in `admin_audit_log`.

관리자 계정 생성 (super_admin 전용, 감사 로그 기록).

**Required role:** `super_admin`

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
- None declared.

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminCreateUserRequest](../schemas/admin-users.md#admincreateuserrequest)|{"email":"newadmin@keduall.com","password":"Str0ng!Pass#2026","display_name":"New Admin","roles":["admin"]}|

Responses:
- `201` Account created and activated.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminUserResponse](../schemas/admin-users.md#adminuserresponse)|{"id":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","email":"newadmin@keduall.com","display_name":"New Admin","roles":["admin"],"is_deleted":false,"account_source":"admin_created","activated_at":"2026-06-22T08:30:00Z","created_at":"2026-06-22T08:30:00Z","last_active_at":null}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`super_admin`).
- `409` Email already registered.
- `422` Weak password or invalid role.

### GET /api/admin/users/{user_id}

Summary: Get one user by id
Operation ID: `get_user_api_admin_users__user_id__get`

Description:

Fetch a single user's detail. **Requires `admin`** (read-only).

사용자 상세 조회.

**Required role:** `admin` (read-only)

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|user_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `200` User detail.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminUserResponse](../schemas/admin-users.md#adminuserresponse)|{"id":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","email":"newadmin@keduall.com","display_name":"New Admin","roles":["admin"],"is_deleted":false,"account_source":"admin_created","activated_at":"2026-06-22T08:30:00Z","created_at":"2026-06-22T08:30:00Z","last_active_at":null}|
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`admin`).
- `404` User not found.
- `422` Validation Error
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[HTTPValidationError](../schemas/common.md#httpvalidationerror)|-|

### PATCH /api/admin/users/{user_id}

Summary: Update a user's name and/or roles
Operation ID: `update_user_api_admin_users__user_id__patch`

Description:

Update `display_name` and/or replace `roles`. **Requires `super_admin`.**

Guards: you cannot remove your own `super_admin` role, and you cannot remove the
`super_admin` role from the last remaining super_admin. Audited.

이름/역할 수정 (super_admin 전용, 자기 자신·마지막 super_admin 강등 차단).

**Required role:** `super_admin`

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|user_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminUpdateUserRequest](../schemas/admin-users.md#adminupdateuserrequest)|{"display_name":"Renamed Admin","roles":["admin"]}|

Responses:
- `200` Updated user detail.
  - Response content:
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminUserResponse](../schemas/admin-users.md#adminuserresponse)|{"id":"3f2504e0-4f89-41d3-9a0c-0305e82c3301","email":"newadmin@keduall.com","display_name":"Renamed Admin","roles":["admin"],"is_deleted":false,"account_source":"admin_created","activated_at":"2026-06-22T08:30:00Z","created_at":"2026-06-22T08:30:00Z","last_active_at":null}|
- `400` Guard violation (e.g. cannot remove/delete the last super_admin or self).
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`super_admin`).
- `404` Target user not found.
- `422` Validation error (weak password / invalid role).

### DELETE /api/admin/users/{user_id}

Summary: Soft-delete a user
Operation ID: `delete_user_api_admin_users__user_id__delete`

Description:

Soft-delete (scrub email/name, clear password, set `is_deleted`).
**Requires `super_admin`.** Cannot delete yourself or the last super_admin.

사용자 소프트 삭제 (super_admin 전용, 자기 자신·마지막 super_admin 삭제 차단).

**Required role:** `super_admin`

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|user_id|path|yes|string|-|-|

Request body:
- None declared.

Responses:
- `204` User soft-deleted. No response body.
- `400` Guard violation (e.g. cannot remove/delete the last super_admin or self).
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`super_admin`).
- `404` Target user not found.
- `422` Validation error (weak password / invalid role).

### POST /api/admin/users/{user_id}/password

Summary: Reset a user's password (admin-set)
Operation ID: `reset_password_api_admin_users__user_id__password_post`

Description:

Set a new password for the target (no current-password needed).
**Requires `super_admin`.** The secret is never written to the audit log.

비밀번호 재설정 (super_admin 전용, 현재 비번 불필요, 비밀번호는 감사 로그에 미기록).

**Required role:** `super_admin`

Required request headers / auth:
|Scheme|Header|Description|
|---|---|---|
|BearerAuth|`Authorization: Bearer <jwt>`|JWT Bearer token (admin session). Role-gated per endpoint.|

Parameters:
|name|in|required|type|description|example|
|---|---|---|---|---|---|
|user_id|path|yes|string|-|-|

Request body:
- Required: yes
|mediaType|schema|example|
|---|---|---|
|application/json|[AdminResetPasswordRequest](../schemas/admin-users.md#adminresetpasswordrequest)|{"new_password":"N3w!Str0ng#Pass"}|

Responses:
- `204` Password reset. No response body.
- `400` Guard violation (e.g. cannot remove/delete the last super_admin or self).
- `401` Missing or invalid JWT.
- `403` Caller lacks the required role (`super_admin`).
- `404` Target user not found.
- `422` Validation error (weak password / invalid role).
