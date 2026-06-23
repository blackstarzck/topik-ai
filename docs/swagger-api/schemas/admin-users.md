# Admin Users API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[AdminCreateUserRequest](#admincreateuserrequest)|object|
|[AdminResetPasswordRequest](#adminresetpasswordrequest)|object|
|[AdminUpdateUserRequest](#adminupdateuserrequest)|object|
|[AdminUserListResponse](#adminuserlistresponse)|object|
|[AdminUserResponse](#adminuserresponse)|object|

## AdminCreateUserRequest

Type: `object`

Schema example:
```json
{
  "display_name": "New Admin",
  "email": "newadmin@keduall.com",
  "password": "Str0ng!Pass#2026",
  "roles": ["admin"]
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["newadmin@keduall.com"]|Login email (format-validated, max 255 chars); normalized to lowercase. Must be unique.|
|password|yes|string|-|-|["Str0ng!Pass#2026"]|Strong password: 12-128 chars, upper+lower+digit+special, no whitespace.|
|display_name|yes|string|-|-|["New Admin"]|Display name (1-100 chars).|
|roles|no|array<string>|-|-|[["admin"]]|Subset of {super_admin, admin, student}. Defaults to ['admin'].|

## AdminResetPasswordRequest

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|new_password|yes|string|-|-|["N3w!Str0ng#Pass"]|Strong password (same policy as create: 12-128 chars, upper+lower+digit+special, no whitespace).|

## AdminUpdateUserRequest

Type: `object`

Schema example:
```json
{
  "display_name": "Renamed Admin",
  "roles": ["admin"]
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|display_name|no|anyOf<string \| null>|-|-|["Renamed Admin"]|New display name (1-100 chars); omit to leave unchanged.|
|roles|no|anyOf<array<string> \| null>|-|-|[["super_admin","admin"]]|Replacement role list, subset of {super_admin, admin, student}; omit to leave unchanged.|

## AdminUserListResponse

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|items|yes|array<AdminUserResponse>|-|-|-|Users in the current page, newest first.|
|total|yes|integer|-|-|[3]|Total matching rows (ignoring pagination).|
|limit|yes|integer|-|-|[20]|Page size applied.|
|offset|yes|integer|-|-|[0]|Offset applied.|

## AdminUserResponse

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["3f2504e0-4f89-41d3-9a0c-0305e82c3301"]|User UUID.|
|email|yes|string|-|-|["newadmin@keduall.com"]|Login email.|
|display_name|yes|string|-|-|["New Admin"]|Display name.|
|roles|yes|array<string>|-|-|[["admin"]]|Assigned roles, subset of {super_admin, admin, student}.|
|is_deleted|yes|boolean|-|-|[false]|Whether the account is soft-deleted.|
|account_source|yes|string|-|-|["admin_created"]|'admin_created' for accounts made via this API.|
|activated_at|no|anyOf<string \| null>|-|-|["2026-06-22T08:30:00Z"]|ISO-8601 activation timestamp; null if not activated.|
|created_at|no|anyOf<string \| null>|-|-|["2026-06-22T08:30:00Z"]|ISO-8601 creation timestamp.|
|last_active_at|no|anyOf<string \| null>|-|-|[null]|ISO-8601 last-active timestamp; null if never active.|
