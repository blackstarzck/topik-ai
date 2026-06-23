# Eval Auth API Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[LoginRequest](#loginrequest)|object|
|[LoginResponse](#loginresponse)|object|
|[LoginUser](#loginuser)|object|

## LoginRequest

Type: `object`

Schema example:
```json
{
  "email": "admin@example.com",
  "password": "yourpassword"
}
```

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|email|yes|string|-|-|["admin@example.com"]|Account email (must hold the DB `admin` role; subject to the optional EVAL_ADMIN_EMAILS allowlist).|
|password|yes|string|-|-|["yourpassword"]|Account password.|

## LoginResponse

JWT access/refresh tokens plus the authenticated user's profile.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|token|yes|string|-|-|["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]|JWT access token carrying the user's real DB roles.|
|refresh_token|yes|string|-|-|["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."]|JWT refresh token used to obtain a new access token.|
|user|yes|[LoginUser](./eval-auth.md#loginuser)|-|-|-|Authenticated user's profile.|

## LoginUser

Authenticated user profile embedded in the login response.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["uuid"]|User UUID.|
|email|yes|string|-|-|["admin@example.com"]|User email.|
|display_name|no|anyOf<string \| null>|-|-|["Admin"]|User display name.|
|roles|no|array<string>|-|-|[["admin"]]|DB-backed roles carried by the JWT (e.g. admin, student).|
