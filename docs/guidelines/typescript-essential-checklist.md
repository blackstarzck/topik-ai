아래는 “TypeScript를 100% 활용”을 전제로, 실무에서 바로 팀 규칙으로 쓸 수 있는 가이드라인이다. (React + Admin 기준)

## 1) 컴파일러 옵션 표준(강제)

`tsconfig.json`은 아래를 기본으로 한다.

* `"strict": true`
* `"noImplicitAny": true`
* `"strictNullChecks": true`
* `"noUncheckedIndexedAccess": true` (가능하면)
* `"exactOptionalPropertyTypes": true` (가능하면)
* `"noFallthroughCasesInSwitch": true`
* `"noImplicitOverride": true`
* `"forceConsistentCasingInFileNames": true`

핵심 원칙: “빌드가 되는 any”를 없애고, null/undefined를 코드에서 명시적으로 다루게 만든다.

## 2) any 금지, 대신 이걸 쓴다(강제)

* `any` 금지 (예외: 외부 라이브러리 타입이 완전히 깨질 때, 임시로만 허용)
* 대체 규칙

  * 모를 때: `unknown`
  * JSON 파싱 결과: `unknown` → `zod` 같은 런타임 스키마로 검증 후 타입 확정
  * 이벤트/콜백: 제네릭으로 타입 전달
* `as` 단언은 “최후의 수단”

  * 허용: 좁히기가 가능한데 TS가 못 따라오는 경우
  * 금지: “귀찮아서” 단언

## 3) 타입은 “도메인”을 표현해야 한다(가장 중요)

* 단순 `string` 대신 의미 있는 타입으로 구분

  * 예: `type UserId = string & { readonly brand: unique symbol }`
  * 또는 최소한 DTO 계층에서라도 별도 타입 명시
* 날짜는 무조건 규칙화

  * 서버가 ISO 문자열이면: `type ISODateString = string`
  * UI에서 Date 객체로 쓰면 변환 레이어를 둔다

## 4) DTO(서버 응답)와 UI 모델을 분리(강제)

실무에서 가장 많이 망가지는 지점.

* `UserDto`(API 응답)와 `User`(UI에서 쓰는 모델)를 분리
* 변환 함수는 한 곳에서만

  * `mapUserDtoToModel(dto): User`
* UI는 “정제된 모델”만 받는다(널 처리/기본값 처리 포함)

## 5) API 타입은 “요청/응답/에러”까지 포함(강제)

* 모든 API 함수는 반환 타입을 명시

  * `Promise<UserDto>` 같은 형태
* 에러 타입(최소 3종)은 구분

  * ValidationError(400)
  * AuthError(401/403)
  * ConflictError(409)
* 프론트는 에러에 따라 UX를 다르게 보여준다

## 6) 유니온 + 타입가드로 상태값/권한을 안전하게(관리자 핵심)

상태값은 문자열 나열이 아니라 “유니온”으로 고정.

* `type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED'`
* 상태 전이는 “테이블”로 표현

  * `const allowedActionsByStatus: Record<UserStatus, Action[]> = ...`
* 타입가드

  * `function isUserStatus(x: string): x is UserStatus { ... }`

## 7) enum은 가급적 지양, const object + as const 권장

* `enum`은 번들/런타임 부작용이 생길 수 있어 실무에선 덜 선호
* 권장 패턴

  * `const UserStatus = { ACTIVE:'ACTIVE', ... } as const`
  * `type UserStatus = typeof UserStatus[keyof typeof UserStatus]`

## 8) 함수 시그니처에서 타입을 “설계”한다

* “입력은 넓게, 출력은 좁게”
* 옵션 인자 남발 금지 → 객체 파라미터로 전환

  * `fn(userId, page, size, sort, filter)` 금지
  * `fn({ userId, page, size, sort, filter })` 권장

## 9) 제네릭은 2단계까지만(가독성 룰)

* 제네릭이 3중 이상 중첩되면 이해 비용이 폭증
* 공통 유틸은 “타입 테스트(예시)”와 함께 제공

## 10) React 실무 규칙(타입 안정성)

* 컴포넌트 props는 `interface` 또는 `type`으로 명시(암묵적 금지)
* 이벤트 타입을 정확히

  * `React.ChangeEvent<HTMLInputElement>`
* 상태는 “가능한 좁게”

  * `useState<UserStatus>('ACTIVE')`처럼 초기값 기반 추론 활용
* 비동기 데이터는 “로딩/에러/성공”을 타입으로 보장

  * TanStack Query 사용 시 `data` nullable 처리 규칙 통일

## 11) 폼/테이블 타입 표준(관리자에서 자주 필요)

* Form 값 타입과 API 요청 타입을 분리

  * Form은 string 기반이 많음(입력), API는 number/date 등
* Table column 정의도 제네릭으로 고정

  * `ColumnDef<User>` 형태로 “row 타입”을 강제

## 12) 금지 패턴(실무에서 사고 나는 것들)

* `as any`
* `as unknown as T` (이중 단언)
* DTO를 그대로 화면에서 사용(널/타입 불일치로 런타임 버그)
* `string`로 상태값 처리(오타가 런타임까지 감)

## 13) 팀 운영 규칙(린트/리뷰 강제)

* ESLint + typescript-eslint 룰로 강제:

  * `@typescript-eslint/no-explicit-any: error`
  * `@typescript-eslint/consistent-type-imports: error`
  * `@typescript-eslint/no-floating-promises: error`
  * `@typescript-eslint/no-misused-promises: error`
* PR 체크리스트:

  * any/단언 사용했으면 이유 주석
  * DTO→Model 변환 레이어 지켰는지
  * 상태값/권한 유니온 적용했는지