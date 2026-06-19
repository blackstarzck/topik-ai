# Common And Shared Schemas

[Back to Swagger API README](../README.md) | [Schema index](./index.md)

Each table shows field required status, type, enum, default, example value, and OpenAPI description.

## Schema Index

|Schema|Type|
|---|---|
|[HTTPValidationError](#httpvalidationerror)|object|
|[ProvidedQuestion](#providedquestion)|object|
|[ValidationError](#validationerror)|object|

## HTTPValidationError

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|detail|no|array<ValidationError>|-|-|-|-|

## ProvidedQuestion

A single prompt blank shown to the applicant for Q51/Q52 fill-in tasks.
Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|id|yes|string|-|-|["a"]|Stable identifier of the blank/sub-question (e.g. 'a', 'b').|
|text|yes|string|-|-|["다음을 읽고 ( ㉠ )에 들어갈 말을 쓰십시오."]|Korean prompt text surrounding the blank the applicant must fill.|

## ValidationError

Type: `object`

|name|required|type|enum|default|example|description|
|---|---|---|---|---|---|---|
|loc|yes|array<anyOf<string \| integer>>|-|-|-|-|
|msg|yes|string|-|-|-|-|
|type|yes|string|-|-|-|-|
|input|no|-|-|-|-|-|
|ctx|no|object|-|-|-|-|
