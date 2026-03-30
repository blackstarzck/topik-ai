# Commerce > 쿠폰 관리 상세 IA

## 1. 문서 목적

- 이 문서는 `Commerce > 쿠폰 관리`의 현재 기준 정보구조, 입력 UX, 운영 조치, 검증 규칙을 정의한다.
- 기준 소스는 두 가지다.
  - 실제 아임웹 관리자 쿠폰 화면을 직접 클릭하며 확인한 입력 UX와 운영 정책
  - TOPIK AI Admin에서 이번 작업으로 구현한 `/commerce/coupons`, `/commerce/coupons/create`, `/commerce/coupons/create/:couponId`
- 기존 placeholder 수준 문서를 폐기하고, 목록 운영형 + 등록 상세형 혼합 화면으로 다시 정의한다.

## 2. 문서 메타

| 항목             | 내용                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 모듈             | Commerce                                                                                                                      |
| 페이지명         | 쿠폰                                                                                                                          |
| 작업 분류        | 특정 페이지 작업                                                                                                              |
| 분류 근거        | 쿠폰 유형, 발행 정책, 유효성 검증, CRM/메시지 연동은 커머스 도메인 맥락 의존성이 강하고 전역 공통 레이아웃 변경이 아니기 때문 |
| 현재 상태        | 구현됨                                                                                                                        |
| 기본 라우트      | `/commerce/coupons`                                                                                                           |
| 등록 상세 라우트 | `/commerce/coupons/create`, `/commerce/coupons/create/:couponId`, `/commerce/coupons/template/create`                         |
| 주요 권한        | `SUPER_ADMIN`, `OPS_ADMIN`                                                                                                    |
| 감사 로그 계약   | `Target Type = CommerceCoupon`, `Target ID = couponId`                                                                        |

## 3. 운영 목표

- 운영자는 쿠폰을 `고객 다운로드`, `자동 발행`, `쿠폰 코드 생성`, `지정 발행` 네 가지 유형으로 생성하고 관리할 수 있어야 한다.
- 운영자는 목록에서 빠르게 검색하고, 상세 Drawer에서 검수하고, 등록 상세 페이지에서 수정하고, 조치 이후 감사 로그까지 바로 추적할 수 있어야 한다.
- 파괴적 조치(`발행 중지`, `발행 재개`, `삭제`)는 반드시 사유를 남기고 실행해야 한다.
- 네트워크 실패나 검증 실패가 발생해도 목록과 직전 성공 상태를 최대한 유지해 운영 흐름이 끊기지 않아야 한다.

## 4. 실제 아임웹 기준 확인사항

### 4.1 직접 확인한 입력 UX

- 상단 구조는 `쿠폰 목록`, `정기 쿠폰 템플릿` 메인 탭 1행과, 그 아래 `SearchBar(summary + actions)` 2행으로 구성된다.
- 쿠폰 만들기 진입 시 선택 가능한 유형은 `고객 다운로드`, `자동 발행`, `쿠폰 코드 생성`, `지정 발행` 4가지다.
- 유형 선택 카드는 hover 강조를 두지 않고, 클릭 순간의 ripple만 인터랙션 피드백으로 사용한다.
- 목록 상태 필터는 `전체`, `대기`, `진행 중`, `종료` 요약 카드다.
- `고객 다운로드`는 `기본 설정`, `혜택 설정`, `운영 설정`, `알림 설정` 섹션으로 구성된다.
- `자동 발행`은 발행 대상이 `첫 회원가입`, `첫 주문 완료`, `쇼핑 등급 변경`, `생일`로 나뉜다.
- `쿠폰 코드 생성`은 `단일 생성`, `여러 개 생성`을 구분한다.
- `지정 발행`은 `특정 그룹`, `특정 회원`을 받는다.

### 4.2 직접 확인한 검증/오류 시나리오

- `고객 다운로드` 저장 시 빈 값이면 `쿠폰명`, `할인 금액`, `최소 주문 금액` 검증이 걸린다.
- `지정 발행 > 특정 회원`에서 존재하지 않는 회원 ID로 저장하면 `존재하지 않는 회원입니다. 다시 확인해주세요.` 오류가 난다.
- 무료 플랜 제한은 생성 진입 시점이 아니라 저장 시점에 걸린다.
- 무료 플랜 제한 문구는 저장 시점에 `쿠폰 기능은 Free 버전에서 생성 갯수가 1개로 제한됩니다. Pro, Global 버전에서만 무제한으로 생성이 가능합니다.` 형태로 노출된다.
- `쿠폰 코드 생성`은 생성 후 코드 수정이 불가하다.

### 4.3 실운영 정책 메모

- `자동 발행 > 첫 회원가입`은 기존 가입 이력/동일 인증 재가입 사용자를 제외한다.
- `자동 발행 > 첫 주문 완료`는 전체 취소/중복 주문 방지 정책을 함께 고려해야 한다.
- `자동 발행 > 쇼핑 등급 변경`은 등급 상승/하락 모두 발급될 수 있으므로 등급 정책과 함께 검토해야 한다.
- `자동 발행 > 생일`은 연 1회 발급이며 생성 다음 날부터 발급된다.
- 아임웹 기준 `자동 발행 쿠폰`만 일시 `발행 중지/발행 재개`를 지원하고, 다른 유형은 사용기간으로 관리한다.
- `고객 다운로드`는 다운로드 링크를 복사해 외부 채널 CTA에 연결하는 운영이 핵심이다.
- `쿠폰 코드 생성`은 코드 오입력 시 수정이 아니라 재생성이 필요하다.

## 5. TOPIK AI 구현 방향

- 실제 아임웹 입력 항목과 정책은 최대한 유지한다.
- 다만 운영 UX는 아래처럼 개선한다.
  - 목록 행 클릭 시 전체 수정 페이지로 바로 보내지 않고 상세 Drawer로 먼저 검수한다.
  - 파괴적 조치는 확인 모달 + 사유 입력을 강제한다.
  - 무료 플랜 제한은 저장 전에 상단 경고 배너로도 예고한다.
  - 직전 성공 목록을 fallback으로 유지해 네트워크 실패 시 화면 전체가 비지 않게 한다.

## 6. 라우트와 URL 복원

### 6.1 목록

- 기본 라우트: `/commerce/coupons`
- 목록 쿼리
  - `view`: `list | subscriptionTemplate`
  - `statusTab`: `all | waiting | active | ended`
  - `templateStatus`: `all | active | paused`
  - `keyword`
  - `selected`: 상세 Drawer 대상 `couponId | templateId`

### 6.2 등록 상세

- 생성 라우트: `/commerce/coupons/create`
- 수정 라우트: `/commerce/coupons/create/:couponId`
- 정기 쿠폰 템플릿 생성 라우트: `/commerce/coupons/template/create`
- 정기 쿠폰 템플릿 수정 라우트: `/commerce/coupons/template/create/:templateId`
- 생성 쿼리
  - `type`: `customerDownload | autoIssue | couponCode | manualIssue`
- 목록에서 진입한 경우 기존 목록 검색 쿼리를 유지해 복귀 시 복원한다.

## 7. 목록 페이지 정보구조

### 7.1 상단 제목

- `PageTitle`: `쿠폰`

### 7.2 본문 상단 UI

- `PageTitle` 아래에는 현재 메인 탭 맥락에 맞는 `ListSummaryCards` 요약 카드를 둔다.
  - `쿠폰 목록` 탭: `전체 쿠폰`, `대기 쿠폰`, `진행 중 쿠폰`, `종료 쿠폰`
  - `정기 쿠폰 템플릿` 탭: `전체 템플릿`, `진행 중 템플릿`, `발행 중지 템플릿`
- 요약 카드 아래 `AdminListCard.toolbar`는 공통 목록 패턴대로 `Tabs -> SearchBar(summary + actions)` 2행을 사용한다.
- 1행
  - 메인 탭: `쿠폰 목록`, `정기 쿠폰 템플릿`
- 2행
  - `쿠폰 목록` 탭
    - 좌측: `전체` 1옵션 선택기 + `쿠폰명` 검색 입력
    - 우측 summary: `총 N건`
    - 우측 actions: `쿠폰 만들기`
  - `정기 쿠폰 템플릿` 탭
    - 좌측: `전체` 1옵션 선택기 + `정기 쿠폰명` 검색 입력
    - 우측 summary: `총 N건`
    - 우측 actions: `쿠폰 만들기`
- 각 탭의 상단 요약 카드는 카드 클릭으로 동일 탭 내 상태 필터를 즉시 전환한다.
  - `쿠폰 목록` 탭: `statusTab`
  - `정기 쿠폰 템플릿` 탭: `templateStatus`
- `쿠폰 만들기`는 바로 생성하지 않고 드롭다운 메뉴를 연다.
  - `일반 쿠폰 만들기`
  - `정기 쿠폰 템플릿 만들기`
- 쿠폰 목록은 실제 검색 필드가 `쿠폰명` 1개뿐이어도 공통 목록형 레이아웃 일관성을 위해 좌측 선택기를 숨기지 않고 `전체` 1옵션으로 유지한다.

### 7.3 목록 테이블 컬럼

| 컬럼             | 설명                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 쿠폰명           | 기본 식별 컬럼. 파란 링크를 쓰지 않고 텍스트 + `couponId` 보조 정보만 표시한다. 상세 확인은 행 클릭으로 처리한다.                                                                                                    |
| 형식             | `고객 다운로드`, `자동 발행`, `쿠폰 코드`, `지정 발행` 배지. 헤더 필터와 정렬을 제공한다.                                                                                                                            |
| 발행 정보        | 발행 대상, 자동 발행 트리거, 대상 그룹/회원 요약만 노출한다.                                                                                                                                                         |
| 혜택 / 사용 조건 | 할인 방식/금액과 최소 주문 금액, 적용 범위, 중복 할인 허용 여부를 한 컬럼에 묶는다.                                                                                                                                  |
| 유효 기간        | 고정 기간 또는 `발급 후 N일 만료` 요약. 헤더 정렬을 제공한다.                                                                                                                                                        |
| 상태             | `대기`, `진행 중`, `종료` 중 하나의 대표 상태만 표시한다. 헤더 필터와 정렬을 제공하며, 상단 요약 카드와 같은 상태 집합을 사용한다.                                                                                   |
| 발행 상태        | `자동 발행` 유형만 `발행` / `발행 중지` 2상태를 `BinaryStatusSwitch`로 직접 조치한다. 다른 유형은 disabled switch를 두지 않고 `해당 없음`으로 표시한다. 토글 시 확인 단계와 사유 입력을 거친 뒤 반영한다.            |
| 발급 / 사용      | `issueCount / useCount` 요약. 다운로드 수치는 상세 Drawer에서 확인한다.                                                                                                                                              |
| 액션             | shared `TableActionMenu` 기반 `더보기`. 행 클릭이 상세 Drawer의 단일 진입 경로이므로 `상세 보기`는 두지 않는다. 일반 액션은 `수정`, `복제`, `링크/코드 복사`만 두고, 파괴적 액션은 `삭제`만 하단 분리 영역으로 둔다. |

### 7.3-1 정기 쿠폰 템플릿 탭 컬럼

| 컬럼             | 설명                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 템플릿명 / 혜택  | 기본 식별 컬럼. 템플릿명과 혜택 요약을 한 셀에 묶고, 상세 확인은 행 클릭으로 처리한다.                                 |
| 상태             | `진행 중`, `발행 중지` 배지. 파괴적 상태 전환은 목록 액션 또는 Drawer 푸터에서 확인 모달과 사유 입력을 거친다.         |
| 쿠폰 사용 종료일 | `usageEndSchedule` 기준 월별 종료 시점을 `N일 HH시 MM분` 형식으로 표시한다.                                            |
| 등록일           | 템플릿 생성 시각.                                                                                                      |
| 수정일           | 최근 수정 시각과 `updatedBy`를 함께 노출한다.                                                                          |
| 액션             | shared `TableActionMenu` 기반 `더보기`. `수정`, `발행 중지/재개`, `삭제`를 제공하고, `삭제`는 하단 분리 영역으로 둔다. |

### 7.4 빈 상태와 오류 상태

- `pending`
  - 목록 전체 skeleton 대신 표 로딩 상태를 사용한다.
- `empty`
  - `아직 생성한 쿠폰이 없어요`
  - `할인, 생일, 배송비 무료 등 다양한 쿠폰을 만들어 보세요`
  - `쿠폰은 왜 만들어야 할까요?` 보조 버튼으로 운영 가이드를 펼칠 수 있다.
- `filtered empty`
  - `선택한 조건에 맞는 쿠폰이 없어요` 안내를 보여준다.
- `error`
  - 에러 메시지, 에러 코드, `다시 시도` 버튼을 보여준다.
  - 기존 데이터가 있으면 마지막 성공 상태 목록을 유지한다.

## 8. 상세 Drawer 구조

### 8.1 헤더

- 제목: `쿠폰 상세 · {couponId}`
- 헤더 메타
  - `쿠폰 상태` 배지
  - 필요 시 `발행 중지` 배지
  - `쿠폰 형식` 태그

### 8.2 푸터

- 좌측
  - `감사 로그 확인`
- 우측
  - 조건부 `링크 복사`
  - 조건부 `코드 복사`
  - `수정`
  - `자동 발행` 유형에서만 조건부 `발행 중지` 또는 `발행 재개`
  - `삭제`

### 8.3 본문 섹션

- `기본 정보`
  - 쿠폰 ID, 쿠폰명, 형식, 상태, 최종 수정
- `혜택 / 사용 조건`
  - 할인 방식, 최소 주문 금액, 적용 범위, 중복 할인, 사용 횟수
- `발행 정책`
  - 발행 대상/트리거, 시크릿 쿠폰 여부, 발행 수량 제한, 다운로드 제한
- `링크 / 코드 / 연동`
  - 다운로드 URL, 쿠폰 코드, 메시지/CRM/이벤트 연동, 발급 알림, 만료 알림
- `사용 현황`
  - 발급/다운로드/사용 수치, 최근 발급/다운로드/사용 시각
- `운영 메모 / 정책 메모`
  - 관리자 메모
  - 유형별 정책 메모

## 9. 등록 상세 페이지 구조

### 9.1 일반 쿠폰 생성/수정 공통 구조

- 상단 액션은 이벤트 등록 상세와 같은 shell을 사용하며, `AdminListCard.toolbar` 우측에 `목록으로`와 primary 저장 버튼만 둔다.
- 생성 라우트의 `PageTitle`은 선택한 쿠폰 유형 이름을 앞에 붙여 `고객 다운로드 쿠폰 등록`, `자동 발행 쿠폰 등록`, `쿠폰 코드 생성 쿠폰 등록`, `지정 발행 쿠폰 등록`처럼 표시한다.
- 본문은 `AdminListCard` 내부 단일 스크롤 페이지로 배치하고, 내부 shell은 `좌측 Steps(progressDot, vertical) + 우측 현재 section 패널` 구조를 유지한다.
- `Steps` 순서는 `기본 정보 -> 혜택 설정 -> 운영 설정 -> 알림 설정 -> 관리자 메모`를 기본으로 사용한다.
- `쿠폰 코드 생성`은 `알림 설정` step을 노출하지 않고 `관리자 메모`로 바로 이어진다.
- `기본 정보` step의 정책 안내는 shell 바깥 hero로 분리하지 않고 현재 section 내부 상단 `운영 가이드 Alert`로만 노출한다.
- 입력은 `Descriptions` 기반 설정 테이블을 section별로 구성하고, 이벤트 등록 상세와 같은 section title/spacing baseline을 사용한다.
- `지정 발행`은 `알림 설정`에서 `웹·앱 푸시` placeholder만 보여준다.
- `적용 제외 상품`, 알림 preview, 시간 단위 제어처럼 아직 계약이 없는 항목은 disabled placeholder로 표현한다.

### 9.2 정기 쿠폰 템플릿 생성 구조

- 별도 라우트 `/commerce/coupons/template/create`를 사용한다.
- 수정 라우트 `/commerce/coupons/template/create/:templateId`를 함께 사용한다.
- 상단 shell은 일반 쿠폰 생성 페이지와 같은 `PageTitle + AdminListCard.toolbar` 구조를 사용하고, toolbar 우측 액션은 `목록으로`, `템플릿 생성/저장` 2개만 유지한다. 본문 상단 주요 액션 버튼은 모두 `large` 크기를 사용한다.
- 본문은 별도 커스텀 카드 묶음이 아니라 `AdminEditorForm(progressDot, vertical)` step shell을 사용한다.
- step 순서는 `기본 설정 -> 혜택 설정 -> 운영 설정 -> 알림 설정 -> 관리자 메모`를 유지한다.
- step 전환은 수동 클릭과 저장 시 검증 실패 이동을 모두 지원한다. 현재 보이지 않는 step의 필수값이 비어 있으면 해당 step으로 이동시켜 오류를 먼저 노출한다.
- 저장 시 `saveCouponTemplateSafe()`를 호출해 목록 탭으로 복귀하고, 성공 notification에는 `Target Type = CommerceCouponTemplate`, `Target ID = templateId`, 감사 로그 링크를 함께 노출한다.
- `기본 설정`
  - `정기 쿠폰명`
  - `발행 대상`: 현재 구현은 `쇼핑 등급` 선택형 입력이며, option source는 `coupon-template-form-schema.ts`의 `shopping_grades code table candidate`를 따른다.
  - step 본문 상단에 `운영 가이드` alert를 두고, 선택한 쇼핑 등급 기준의 정책 메모를 함께 노출한다.
- `혜택 설정`
  - `혜택`
  - `할인 금액/할인 비율/고정가`
  - `최대 할인 금액`
  - `최소 주문 금액`
  - `쿠폰 적용 범위`
  - `적용 제외 상품`
  - `중복 할인`: 일반 쿠폰 생성 페이지와 동일하게 boolean switch 대신 `Radio.Group` 기반 선택형 입력을 사용한다.
- `운영 설정`
  - `정기 발행 시점`: 포커스되지 않는 read-only 표시로 `매월 1일 오전 7시` 고정 정책을 안내한다.
  - `쿠폰 사용 종료일`: `DatePicker + hour/minute` 조합으로 입력하고, 선택한 날짜가 없는 달은 말일까지 사용 가능한 정책 안내를 함께 노출한다.
- `알림 설정`
  - `발급 알림`
  - `만료 알림`
  - `알림 채널`
  - 알림 on/off와 채널 선택은 일반 쿠폰 생성 페이지와 동일하게 `Radio.Group` 패턴으로 맞춘다.
- `관리자 메모`
  - `운영 메모`
  - 기존 알림 step 내부 메모를 별도 step으로 분리해 일반 쿠폰 생성 페이지의 `관리자 메모` 구조와 맞춘다.
- 카테고리/상품/등급 목록은 현재 mock code table candidate 기반이고, 이후 API/DB 단계에서 참조형 select source로 교체한다.

### 9.3 일반 쿠폰 섹션별 필드

#### 기본 설정

- `couponName`
- 유형별 분기
  - `issueTargetType`
  - `targetGroupId`
  - `targetUserIdsText`
  - `autoIssueTriggerType`
  - `codeGenerationMode`
  - `couponCode`
  - `codeCount`
  - `audience`
  - `isSecretCoupon`

#### 혜택 설정

- `benefitType`
- `benefitValue`
- `minOrderAmount`
- `maxDiscountAmount`
- `applicableScope`
- `excludedProducts` placeholder
- `isStackable`
- `benefitType = amountDiscount | fixedPrice`이면 `benefitValue`는 원 단위 숫자 입력이다.
- `benefitType = rateDiscount`이면 `benefitValue`는 `1~100` 범위의 비율 입력이고, `maxDiscountAmount` 입력이 함께 활성화된다.
- `benefitType = freeShipping`이면 `benefitValue`는 직접 입력하지 않고, 배송비 무료 혜택 안내 문구만 노출한다.
- `적용 제외 상품`은 현재 상품 엔티티와 검색/선택 UI가 확정되지 않아 disabled placeholder로만 노출한다.

#### 운영 설정

- `customerDownload`
  - `issueLimitMode`, `issueLimit`
  - `usageLimitMode`, `usageLimit`
  - `validityMode`
  - `validityRange`
  - `expireAfterDays`
- `autoIssue`
  - `usageLimitMode`, `usageLimit`
  - `validityMode = afterIssued | unlimited`
  - `expireAfterDays`
- `couponCode`
  - `usageLimitMode`, `usageLimit`
  - `validityMode = fixedDate | unlimited`
  - `validityRange`
- `manualIssue`
  - `validityRange`
  - 시간 단위는 placeholder 안내로만 둔다.

#### 알림 설정

- `customerDownload | autoIssue`
  - `linkedMessageTemplateId`
  - `linkedCrmCampaignId`
  - `issueAlertEnabled`
  - `issueAlertChannel`
  - `expireAlertEnabled`
  - `expireAlertChannel`
  - `adminMemo`
- `manualIssue`
  - `웹·앱 푸시` preview placeholder만 노출
- `couponCode`
  - 알림 섹션을 노출하지 않음

## 10. 유형별 입력 체크리스트

### 10.1 고객 다운로드

- 필수
  - `couponName`
  - `benefitType`
  - `benefitValue`
  - `minOrderAmount`
  - `applicableScope`
- 선택/운영
  - `isSecretCoupon`
  - `issueLimitMode`, `issueLimit`
  - `usageLimitMode`, `usageLimit`
  - `validityMode = afterIssued | fixedDate | unlimited`
  - `expireAfterDays`
  - `linkedMessageTemplateId`
  - `linkedCrmCampaignId`
- 저장 후 파생값
  - `downloadUrl`

### 10.2 자동 발행

- 필수
  - `couponName`
  - `autoIssueTriggerType`
  - `benefitType`
  - `benefitValue`
  - `minOrderAmount`
  - `applicableScope`
- 선택/운영
  - `validityMode`
  - `expireAfterDays`
  - `usageLimitMode`, `usageLimit`
  - `issueAlertEnabled`
  - `expireAlertEnabled`
  - `linkedMessageTemplateId`
  - `linkedCrmCampaignId`

### 10.3 쿠폰 코드 생성

- 필수
  - `couponName`
  - `codeGenerationMode`
  - `audience`
  - `benefitType`
  - `benefitValue`
  - `minOrderAmount`
  - `applicableScope`
  - `validityMode`
- 분기
  - `single`: `couponCode`는 비워두면 자동 생성 가능
  - `bulk`: `codeCount` 필수, 최대 10,000
- 정책
  - 생성 후 `couponCode` 수정 불가
  - 알림 섹션을 노출하지 않는다.

### 10.4 지정 발행

- 필수
  - `couponName`
  - `issueTargetType`
  - `benefitType`
  - `benefitValue`
  - `minOrderAmount`
  - `applicableScope`
  - `validityRange`
- 분기
  - `specificGroup`: `targetGroupId`
  - `specificMembers`: `targetUserIdsText`
  - `전체 회원`: 추가 대상 필드 없음

## 11. 유효성 검증 규칙

### 11.1 성공 조건

- `couponName`이 비어 있지 않다.
- `benefitType !== freeShipping`이면 `benefitValue >= 1`
- `benefitType = rateDiscount`이면 `1 <= benefitValue <= 100`
- `minOrderAmount >= 1`
- `validityMode = fixedDate`이면 `validFrom`, `validUntil`이 모두 존재한다.
- `validityMode = afterIssued`이면 `expireAfterDays >= 1`
- `issueLimitMode = limited`이면 `issueLimit >= 1`
- `downloadLimitMode = limited`이면 `downloadLimit >= 1`
- `usageLimitMode = limited`이면 `usageLimit >= 1`
- `couponCode + bulk`면 `1 <= codeCount <= 10000`
- `manualIssue + specificMembers`면 모든 회원 ID가 유효해야 한다.

### 11.2 실패 시나리오

- 빈 이름 저장
- 할인 금액 0 또는 음수
- 최소 주문 금액 0 또는 음수
- 고정 기간 미입력
- 발급 후 만료 일수 미입력
- 수량 제한 모드인데 수량 값 미입력
- 지정 발행에서 존재하지 않는 회원 ID 입력
- 무료 플랜에서 두 번째 쿠폰 생성 시도

## 12. 운영/정책 메모 노출 규칙

- 정책 메모는 `getCouponPolicyNotes()`를 기준으로 유형/트리거에 따라 노출한다.
- 최소 포함 메모
  - 고객 다운로드: 시크릿 링크, 쿠폰팩 제약
  - 자동 발행: 첫 회원가입/첫 주문 완료/등급 변경/생일 정책
  - 쿠폰 코드: 단일/여러 개 생성, 코드 수정 불가
  - 지정 발행: 특정 회원 ID 검증, 운영 사유 기록 필요

## 13. 파괴적 조치와 감사 로그

| 조치      | 확인 단계        | 사유 입력 | 감사 로그                   |
| --------- | ---------------- | --------- | --------------------------- |
| 발행 중지 | 필수             | 필수      | `CommerceCoupon + couponId` |
| 발행 재개 | 필수             | 필수      | `CommerceCoupon + couponId` |
| 삭제      | 필수             | 필수      | `CommerceCoupon + couponId` |
| 생성      | 저장 성공 피드백 | 선택      | `CommerceCoupon + couponId` |
| 수정      | 저장 성공 피드백 | 선택      | `CommerceCoupon + couponId` |
| 복제      | 즉시 생성        | 선택      | `CommerceCoupon + couponId` |

## 14. B2C 영향

- `고객 다운로드`
  - 다운로드 링크가 랜딩/이벤트/채널 CTA로 연결될 수 있다.
- `자동 발행`
  - 회원가입, 첫 구매, 생일, 등급 변경 메시지에 직접 영향을 준다.
- `쿠폰 코드 생성`
  - 결제 단계 코드 입력 UX와 바로 연결된다.
- `지정 발행`
  - 특정 그룹 대상 프로모션/리텐션 운영에 영향을 준다.

## 15. 상태 UX와 fail-safe

- 조회/저장/조치 요청은 `pending`, `success`, `empty`, `error`를 구분한다.
- 목록 조회 실패 시 직전 성공 목록을 유지한다.
- 상세 대상이 삭제되면 `selected` 쿼리를 비우고 Drawer를 닫는다.
- 정기 쿠폰 템플릿 탭은 테이블 헤더 + empty 안내 구조를 유지하면서, 생성/수정/발행 중지/재개/삭제와 감사 로그 확인까지 같은 운영 흐름으로 닫는다.

## 16. 이번 구현 기준 남은 갭

- 실제 API/DB 연동은 아직 mock `Zustand` store 기준이다.
- 메시지 템플릿, CRM, 이벤트 연결은 참조형 mock 데이터 수준이다.
- 무료 플랜/Pro 플랜 차이는 현재 store 설정값으로만 시뮬레이션한다.
- 실제 알림 발송, 다운로드 URL 외부 공개, 결제 단계 연동은 후속 구현 범위다.
- 상품/카테고리/쇼핑 등급 참조 데이터는 현재 `coupon-template-form-schema.ts`의 code table candidate 수준이며, 실검색/실엔티티 연결은 후속 구현 범위다.
