# TOPIK AI 관리자 — 미개발 부분 정리 및 DB 설계/개발 계획

## 1. 요약

TOPIK AI 관리자 콘솔 전체 **37개 페이지**를 분석한 결과, 페이지 상태와 데이터 소스가 크게 갈린다.

- **페이지 상태**: 구현됨(UI 동작) **25개**, placeholder(자리표시) **12개**(대시보드 포함). 단, "구현됨" 다수가 UI 셸만 완성이고 데이터 계층은 mock인 착시 상태다.
- **데이터 소스**: supabase-backed/hybrid 실연동 **9개**(assessment 문제은행·EPS 미연동, billing 결제·환불, message 4채널, users 회원 본체, system 메타데이터 일부), mock-only **다수**(community 전체, operation 전체, commerce 쿠폰·포인트, system 관리자·권한·로그·감사), 데이터 계층 부재(none) **9개**(placeholder 전부 + dashboard 사실상 mock).
- **핵심 공백 3가지**: ① **감사 로그 화면이 mock SoT** — 라이브 `admin_audit_logs`에 11개 write RPC가 실제 행을 적재 중인데 화면이 이를 안 읽어 모든 실조치 역추적이 끊김(전역 P0/P1 기지 갭). ② **mock-only 도메인의 파괴적 조치가 영속·감사 0** — community·operation·commerce는 정지/숨김/삭제/포인트 조정이 React state/zustand 메모리만 변경해 새로고침 시 소실되고 `admin_audit_logs`에 기록 안 됨. ③ **Target Type 명명 불일치** — UI(Message/Users/Commerce/Admin)와 RPC/계약(Notification/User/CommerceRefund/AdminAccount)이 곳곳에서 어긋나 역추적 딥링크가 깨질 위험.
- **추가 리스크**: `users` 회원 본체가 의존하는 `get_admin_users`/`admin_set_user_status` RPC가 라이브 스키마·repo 마이그레이션 양쪽에 부재(P0) — Supabase 연결 시 프로필 읽기·정지/해제가 런타임 실패한다. content 도메인 6페이지·EPS·레벨테스트·이커머스·챗봇은 기획 계약 자체가 미확정이라 별도 신규 트랙이 필요하다.

---

## 2. 전체 현황표

| 모듈 | 페이지 | 라우트 | 페이지상태 | 데이터소스 | 미개발 최고심각도 | DB설계 필요 |
|---|---|---|---|---|---|---|
| dashboard | 대시보드 | `/dashboard` | placeholder | mock-only | P0 | 아니오(집계 view/RPC) |
| users | 회원 목록 | `/users` | 구현됨 | hybrid | P0 | 아니오(메모 테이블 신규) |
| users | 회원 상세 | `/users/:userId` | 구현됨 | hybrid | P0 | 예(부분) |
| users | 강사 관리 | `/users/groups` | 구현됨 | mock-only | P0 | 예 |
| users | 추천인 관리 | `/users/referrals` | 구현됨 | mock-only | P0 | 예 |
| community | 게시글 관리 | `/community/posts` | 구현됨 | mock-only | P0 | 예 |
| community | 신고 관리 | `/community/reports` | 구현됨 | mock-only | P0 | 예 |
| message | 메일 | `/messages/mail` | 구현됨 | supabase-backed | P1 | 아니오(보강) |
| message | 푸시 | `/messages/push` | 구현됨 | hybrid | P0 | 아니오(보강) |
| message | 인앱 알림 | `/messages/in-app` | 구현됨 | hybrid | P1 | 아니오(완료) |
| message | 대상 그룹 | `/messages/groups` | 구현됨 | supabase-backed | P1 | 아니오(보강) |
| message | 발송 이력 | `/messages/history` | 구현됨 | hybrid | P1 | 아니오(보강) |
| operation | 공지사항 | `/operation/notices` | 구현됨 | mock-only | P0 | 예 |
| operation | FAQ | `/operation/faq` | 구현됨 | mock-only | P0 | 예 |
| operation | 이벤트 | `/operation/events` | 구현됨 | mock-only | P0 | 예 |
| operation | 정책 관리 | `/operation/policies` | 구현됨 | mock-only | P0 | 예 |
| operation | 챗봇 설정 | `/operation/chatbot` | placeholder | none | P0 | 예 |
| billing | 결제 내역 | `/commerce/payments` | 구현됨 | hybrid | P1 | 아니오(v13 reconcile) |
| billing | 환불 관리 | `/commerce/refunds` | 구현됨 | hybrid | P0 | 예 |
| commerce | 쿠폰 관리 | `/commerce/coupons` | 구현됨 | mock-only | P0 | 예 |
| commerce | 포인트 관리 | `/commerce/points` | 구현됨 | mock-only | P0 | 예 |
| commerce | 이커머스 관리 | `/commerce/store` | placeholder | none | P0 | 예 |
| assessment | TOPIK 쓰기 문항 | `/assessment/question-bank` | 구현됨 | hybrid | P0 | 아니오(완료/보강) |
| assessment | EPS TOPIK | `/assessment/question-bank/eps-topik` | placeholder | none | P0 | 예 |
| assessment | 레벨 테스트 | `/assessment/level-tests` | placeholder | none | P0 | 예 |
| content | 콘텐츠 관리 | `/content/library` | placeholder | none | P0 | 예 |
| content | 배지 | `/content/badges` | placeholder | none | P0 | 예 |
| content | 단어장 | `/content/vocabulary` | placeholder | none | P0 | 예 |
| content | 소나기 | `/content/vocabulary/sonagi` | placeholder | none | P1 | 예 |
| content | 객관식 선택 | `/content/vocabulary/multiple-choice` | placeholder | none | P0 | 예 |
| content | 학습 미션 | `/content/missions` | placeholder | none | P0 | 예 |
| analytics | 통계 개요 | `/analytics/overview` | placeholder | mock-only | P1 | 예 |
| system | 관리자 계정 | `/system/admins` | 구현됨 | mock-only | P1 | 예 |
| system | 권한 관리 | `/system/permissions` | 구현됨 | mock-only | P0 | 예(조건부) |
| system | 메타데이터 관리 | `/system/metadata` | 구현됨 | hybrid | P0 | 예 |
| system | 감사 로그 | `/system/audit-logs` | 구현됨 | mock-only | P0 | 아니오(읽기 경로 보강) |
| system | 시스템 로그 | `/system/logs` | 구현됨 | mock-only | P1 | 예 |

---

## 3. 모듈별 상세

### 3.1 Dashboard (대시보드)

#### 대시보드 `/dashboard`
- **현재 상태**: 라우트/렌더는 되지만 사실상 정적 placeholder. 상단 4카드·처리 대기 큐·운영 경고 값이 대부분 페이지 `useMemo` 내부 하드코딩 리터럴이고, 유일한 동적 값은 billing `useCommerceStore`에서 파생한 환불 대기 건수뿐. dashboard 전용 api/service/mock 계층이 전무.
- **미개발 부분**:
  - [P0·데이터계층] dashboard 전용 데이터 계층 부재, KPI/큐/경고가 페이지 useMemo 하드코딩(페이지 소스 직접 소유 위반).
  - [P0·UI] 4카드 중 3개·큐 3건·경고 증감률이 전부 더미값 — 운영자 실수치 오판 위험.
  - [P1·UI] "분석 보기" 버튼이 `/analytics`로 이동하나 라우터엔 `/analytics/overview`만 등록 — 깨진 링크.
  - [P1·데이터계층] billing `useCommerceStore` 직접 import(cross-feature 침범).
  - [P2·API/Service] 기간 필터(period/startDate/endDate)·URL 상태 복원 없음.
  - [P2·UI] 4상태/스켈레톤/재시도 미구현(비동기 fetch 자체 없음).
  - [P2·DB스키마] `dashboard_metrics`/집계 view 미존재, KPI 산식·임계치 미확정.
  - [P3·감사로그] 표준 딥링크 규약 미연동.
- **필요 DB 설계**: `needed=false`. 신규 물리 테이블 비권장. 권장은 원본 도메인 supabase 전환 후 읽기 전용 집계 view 또는 `get_admin_dashboard_summary(period, start_date, end_date)` SECURITY DEFINER **읽기 RPC**(write 없음→감사 미대상, `private.is_admin` select 가드). 반환(camelCase): `{newUsersToday, pendingReports, pendingRefunds, scheduledMessages, failedMessages, permissionReviews, alerts[]}`. 비권장은 배치 적재 `dashboard_metrics` 물질화 테이블. 알림 severity(critical/warning/info)는 code table candidate.
- **개발 계획**:
  1. 집계 계약/SoT 확정(KPI 산식·임계치·기간 정의·severity 코드세트) — 선행.
  2. 원본 도메인 supabase 전환 선행(commerce·community·system·message·users).
  3. dashboard feature 데이터 계층 생성(service facade·mock·types·schema).
  4. 집계 view/RPC 마이그레이션(읽기 전용·무변경 게이트).
  5. data-source 스위치 + supabase 서비스.
  6. UI 배선 + 4상태/기간 필터(useCommerceStore 직접 import 제거).
  7. 네비게이션·역추적 정합화(`/analytics`→`/analytics/overview`).
  8. 문서 동시 갱신·검증.
- **감사 로그 / 리스크 / 미확정**: 조회 전용이라 자체 write 감사 불필요(원본 도메인 타입 재사용). 리스크: '구현됨' 착시로 가짜 지표 오판(P0), 5개 원본 도메인 전환에 후행 의존, cross-feature import 제거 시 환불 카운트 회귀. 미확정: KPI 산식/임계치 정의, view vs 배치 스냅샷, 큐 카운트 소스, "분석 보기" 목적지.

---

### 3.2 Users (회원/강사/추천인)

#### 회원 목록 `/users` — hybrid
- **현재 상태**: 검색·필터·정렬·페이지네이션·4상태·정지/해제(확인+사유)·관리자 메모 모달까지 배선된 완성형. `isSupabaseConfigured` 분기로 연결 시 `get_admin_users`/`admin_set_user_status` RPC, 미연결 시 mock 420건.
- **미개발 부분**:
  - [P0·API/Service] 관리자 메모 저장 경로 전무 — `handleMemoSubmit`이 토스트만 띄우고 service/store/RPC 호출 없음.
  - [P0·감사로그] mock 모드 정지/해제는 no-op 성공이라 감사 미기록인데 AuditLogLink·성공 토스트는 항상 노출.
  - [P1·데이터계층] 구독상태가 실데이터 아닌 tier 휴리스틱 추정.
  - [P1·데이터계층] realName/tier 매핑 PROPOSED(미승인), plan_label 자유 텍스트 기반 분류.
  - [P1·API/Service] 서버측 페이지네이션 부재(RPC 100건 cap + 클라 필터) → >100명 시 목록 누락.
  - [P2·API/Service] 탈퇴(withdraw) 쓰기 하드 차단(D-F).
  - [P2·권한] 클라이언트 역할 기반 게이팅 없음.
  - [P3·데이터계층] Target Type `Users` vs `User` 혼용.
  - [P2·B2C연동] 마이페이지/로그인 가드 노출 '운영상 추정' 미검증.
- **필요 DB 설계**: `needed=false`(회원 본체는 hybrid). 신규는 (1) `user_admin_memos`(id uuid PK, user_id uuid→profiles, admin_user_id, memo, created_at — admin 네임스페이스, select-only RLS), (2) 구독상태 실데이터화를 위한 subscriptions 조인. RPC: `admin_add_user_memo`(신규, SECURITY DEFINER, 가드+memo 필수+감사 `user_memo_added`), `admin_list_user_memos`(선택), 기존 `get_admin_users`/`admin_set_user_status` 보강(조인·페이지네이션·탈퇴 의미). profiles는 수신 FK만(DDL 무변경).
- **개발 계획**:
  1. RPC 소유권/계약 경계 등록(get_admin_users/admin_set_user_status는 v13 객체).
  2. 관리자 메모 테이블 설계 → 3. 마이그레이션(migrations-admin) → 4. RLS+RPC.
  5. 메모 서비스 배선(`addUserMemoSafe`, page handleMemoSubmit 교체).
  6. 구독상태 실데이터화(subscriptions 조인).
  7. 서버측 페이지네이션/검색 전환.
  8. tier/realName 매핑 코드테이블 승격.
  9. 감사 로그 화면 연동 검증 → 10. 탈퇴 의미 확정 → 11. B2C 동기화 검증.
- **감사 로그 / 리스크 / 미확정**: Target Type=`User`(표준 단수, target_id=userId), 메모는 RPC 신설 필요. 리스크: v13 RPC 보강 시 무변경 게이트·소유권 침범, 구독 추정치 오인, mock 모드 감사 미기록 착시, >100명 목록 누락. 미확정: get_admin_users DDL/권한 주체, 메모 네임스페이스, subscriptions source, 탈퇴 의미, plan_label 값 도메인.

#### 회원 상세 `/users/:userId` — hybrid
- **현재 상태**: 프로필 탭·정지/해제는 hybrid 동작. 그러나 활동/결제/커뮤니티/로그/관리자 메모 **5개 탭이 전부 페이지 내부 useMemo 하드코딩 더미**(모달 제목도 "(더미)"). **결정적 P0**: 코드가 호출하는 `get_admin_users`/`admin_set_user_status` RPC가 라이브 스키마 스냅샷·repo 마이그레이션 양쪽에 부재 → Supabase 연결 시 프로필/조치 런타임 실패.
- **미개발 부분**:
  - [P0·API/Service] 의존 RPC 라이브 미배포 — Supabase 모드 프로필 읽기·정지/해제 실패.
  - [P1·데이터계층] 활동/결제 탭 더미(v13 study_events/payment_history 실테이블 존재하나 미배선).
  - [P1·데이터계층] 관리자 메모 탭 더미 + 작성 UI 부재.
  - [P1·API/Service] 5개 탭 page-local seed 직접 소유(금지 패턴 위반).
  - [P2·데이터계층] 커뮤니티/로그 탭 더미 — v13 원천 테이블 부재.
  - [P2·UI] 탭 4상태 미적용.
  - [P2·감사로그] targetType="Users" 비표준.
  - [P3·권한·B2C] 권한 분리 미구현, B2C 경계 page-sync('운영상 추정') vs IA('내부 전용') 상충.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `user_admin_memos`(신규) | 회원별 관리 메모(append-only) | id uuid PK, user_id→profiles, admin_user_id, content, created_at, deleted_at | user-detail memoRows | 내부 전용 |
  | `payment_history`(v13 기존) | 결제 탭 원천 | id, user_id, amount_cents, status, paid_at | paymentRows | 확인됨에 준함(마이페이지 결제) |
  | `study_events`/`problem_attempts`/`writing_submissions`(v13) | 활동 탭 원천 | user_id, event_type, occurred_at 등 | activityRows(ip는 원천 부재→sentinel) | 운영상 추정 |
  | `subscriptions`/`subscription_plans`(v13) | 구독상태 실값 | user_id, plan_key, status, current_period_end | mapTier 휴리스틱 | 확인됨에 준함 |

  RPC: `get_user_admin_memos`, `admin_add_user_admin_memo`, `get_user_payments`, `get_user_activity`(읽기 통합), `get_admin_users`/`admin_set_user_status`(배포 확인). v13 비소유 테이블은 읽기 RPC/뷰로만 접근(DDL 금지).
- **개발 계획**:
  0. **get_admin_users/admin_set_user_status 소유권·배포 규명(최우선)**.
  1. 탭별 원천 경계 확정(활동/결제/구독=재사용, 메모=신규, 커뮤니티/로그=보류).
  2. user_admin_memos 마이그레이션+RLS → 3. 메모 쓰기/읽기 RPC.
  4. 서비스 신설(page-local seed 제거) → 5. UI 배선+4상태/sentinel.
  6. 감사 Target Type 표준화(`User`) → 7. 커뮤니티/로그 후속 → 8. B2C 경계 정합.
- **감사 로그 / 리스크 / 미확정**: Target Type=`User`(현 코드 `Users` 표준화 대상). 리스크: 의존 RPC 부재로 Supabase 환경 런타임 실패(dev mock이 가림), 5개 탭 대수술 필요, 커뮤니티/로그 원천 부재. 미확정: RPC 소유·배포 상태, 메모 append-only/보존, IP 원천, 커뮤니티 탭 원천, B2C 경계 SoT.

#### 강사 관리 `/users/groups` — mock-only
- **현재 상태**: 목록/요약/Drawer/검색·필터/정렬 완성형이나 **100% mock-only**(96건 정적). 정지/해제가 `setInstructorsState`(React state)만 토글 — 새로고침 시 소실, `admin_audit_logs` 미기록. 라이브에 `instructors` 테이블 없음.
- **미개발 부분**:
  - [P0·API/Service] 정지/해제 write 경로 부재(in-memory state만).
  - [P0·감사로그] 사유 입력받으나 admin_audit_logs 미기록.
  - [P0·데이터계층] instructors 전체 mock-only(supabase 서비스·스위치 부재).
  - [P0·DB스키마] instructors/instructor_courses 라이브 부재, 강사 정체성(User subtype vs 별도 엔티티) 미확정.
  - [P2·UI] Create 등록 UI·관리자 메모 쓰기 미구현, 서버 페이지네이션 부재.
  - [P3·UI] Delete/탈퇴 전이 경로 없음.
  - [P1·데이터계층] 담당 과정/메시지 이력 인라인 파생(cross-domain 미연동).
  - [P2·권한·B2C] 클라 권한 가드 없음, B2C '운영상 추정'.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `instructors` | 강사 계정/상태 SoT | id uuid PK, user_id→profiles(unique), real_name, organization(CHECK), country(CHECK), status(active/suspended/withdrawn), activity_status, assignment_status, ... | mockInstructors 96건 | 운영상 추정(강사 프로필/과정) |
  | `instructor_courses` | 담당 과정 요약 | id, instructor_id(FK cascade), title, level, student_count, status(CHECK) | buildCourses | 운영상 추정 |
  | `instructor_admin_notes` | 강사 운영 메모 | id uuid, instructor_id(FK), admin_name, content, created_at | adminNotes | 내부 전용 |

  RPC: `admin_set_instructor_status`(정지/해제·reason 필수·diff 감사, admin_set_user_status 미러링), `admin_upsert_instructor`/`admin_add_instructor_note`(CRUD 확정 후), `get_admin_instructors`(읽기). 네임스페이스/소유권 등록 선행, profiles는 FK만.
- **개발 계획**:
  1. 강사 엔티티 정체성 확정(profiles.app_role subtype vs 별도) → 2. 테이블·마이그레이션 → 3. RLS+읽기 → 4. 쓰기 RPC(감사) → 5. supabase-instructors-service+스위치 → 6. 페이지 조치 배선 교체 → 7. 감사 검증 → 8. Create/Delete/메모 UI(선택) → 9. B2C 합의.
- **감사 로그 / 리스크 / 미확정**: Target Type=`Instructor`(현 코드 일치). 리스크: 정체성 미확정 시 테이블/FK 대수술, profiles DDL 금지, 과정/메시지 cross-domain 미연동, in-memory 조치 오인. 미확정: 강사=User subtype 여부, app_role 값 분포, course 도메인 존재, Create/Delete 지원, 탈퇴 차단 정책.

#### 추천인 관리 `/users/referrals` — mock-only
- **현재 상태**: 검색·요약·테이블·Drawer(원장/정책)·비활성/재활성·이상치검토·보상 수동조정·4상태 모두 UI 완성. **데이터·조치 전부 mock(48건)**. 비활성/재활성/이상치/보상조정이 `setReferralsState`만 변경 — 영속·재조회·service write 계약·DB 0건. **정책 자체 미확정**(confirmationTiming/rewardMethod/회수규칙).
- **미개발 부분**:
  - [P0·API/Service] write 계약 전무(page 로컬 state만).
  - [P0·데이터계층] mock-only(스위치 없음).
  - [P0·DB스키마] referral 도메인 테이블/마이그레이션 0건.
  - [P0·감사로그] admin_audit_logs 미적재(토스트/딥링크만), amount<0 회수=파괴적 RPC 부재.
  - [P1·기타] 정책 미확정(시점/수단/회수/권한) — enum·CHECK·RPC 동결 불가.
  - [P1·B2C·API] B2C '노출 예정', 포인트 원장 정합/중복적립 방지 부재.
  - [P2·데이터계층·권한] 파생값(totalReward 등) page 소유, 권한 가드 없음.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `referrals` | 추천 코드 마스터 | id uuid, code(전역 unique), referrer_user_id→profiles, status(active/inactive), anomaly_status, expires_at, policy_version(nullable) | mockReferrals/ReferralSummary | 노출 예정(코드 유효성) |
  | `referral_relations` | 추천인-피추천인 1:N | id, referral_id(FK cascade), referred_user_id→profiles, joined_at, confirmed_at, status(pending/completed/cancelled), anomaly_flag | buildRelations | 노출 예정(초대 현황) |
  | `referral_reward_ledgers` | 보상 원장 | id, referral_id, relation_id(nullable), entry_type(grant/recover/cancel/manual_adjust), reward_method(nullable), amount(음수=회수), status, reason | buildRewardLedger | 노출 예정(보상 지갑) |

  RPC: `admin_set_referral_status`, `admin_review_referral_anomaly`, `admin_adjust_referral_reward`(amount<0 reason 강제·포인트 연동 후속), 읽기 `get_admin_referrals`/뷰(집계 산출). 정책 미확정 컬럼은 1차 nullable.
- **개발 계획**:
  1. **정책 동결(확정 시점·보상 수단·회수·권한)** → 2. 테이블 3종 마이그레이션 → 3. 인덱스 → 4. RLS(select-only) → 5. 집계 뷰+읽기 RPC → 6. 쓰기 RPC 3종 → 7. supabase 서비스+스위치 → 8. service write 계약 신설+page 배선 교체 → 9. 감사 검증+B2C 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type=`Referral`(코드 배선됨, 적재만 부재). 리스크: 정책 미확정이 최대 블로커, 포인트 원장 이중기록, in-memory→*Safe 전환 시 낙관적 갱신/rollback 재설계, 집계 파생값 불일치, code 전역 unique 충돌. 미확정: 확정 시점, reward_method enum/포인트 연동, 회수 한도/권한, B2C 발급/소비 테이블, anomaly_flag 코드세트.

---

### 3.3 Community (게시글/신고)

#### 게시글 관리 `/community/posts` — mock-only
- **현재 상태**: 검색·요약·정렬·필터·Drawer·HTML 미리보기·메모·게시/숨김 토글·삭제(정책코드+사유)·딥링크 완성. **100% mock-only**(useCommunityStore + sleep). 조치는 store 메모리만 반영(새로고침 시 시드 리셋), admin_audit_logs 미기록.
- **미개발 부분**:
  - [P0·데이터계층] community 전체 mock-only.
  - [P0·DB스키마] community_posts/community_post_admin_notes 테이블·마이그레이션 0건.
  - [P0·API/Service] 쓰기가 RPC 아닌 store 직접 변경.
  - [P1·감사로그] admin_audit_logs 미기록 + Target Type 비표준 `Community`(표준 `CommunityPost`).
  - [P1·권한] community.posts.manage·RLS 가드 없음.
  - [P2·B2C·UI] B2C 반영 경로 없음, Create UI·서버 검색 미설계.
  - [P2·데이터계층] MemoType(7종 한글)·CommunityPolicyCode(6종 영문) 값 체계 상이, memo type 자유 text.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `community_posts` | 게시글 원문/상태/집계 | id text PK(POST- prefix), title, content_html, author_id→profiles?, board(CHECK), status(게시/숨김), last_moderation_policy_code(CHECK), reports(집계 캐시) | initialCommunityPosts | 운영상 추정(숨김/삭제 시 비노출) |
  | `community_post_admin_notes` | 게시글 내부 메모 | id, post_id(FK cascade), title, type(CHECK), author_id, content | adminNotes | 내부 전용 |

  RPC: `admin_hide_community_post`/`admin_show_community_post`/`admin_delete_community_post`(reason 필수·diff 감사)/`admin_add_community_post_memo`. **선행: v13 B2C 소유 community 테이블 존재 여부 확인**(존재 시 신규 생성 금지·FK/뷰만).
- **개발 계획**:
  1. **B2C 소유 테이블 충돌 확인** → 2. 테이블 설계 확정(board/policy_code/memo type 코드테이블화) → 3. 마이그레이션 → 4. RLS+RPC → 5. supabase 서비스+스위치 → 6. 서버 검색/페이지네이션 → 7. 감사 Target Type 정합(`CommunityPost`) → 8. B2C 동기화 검증.
- **감사 로그 / 리스크 / 미확정**: Target Type=`CommunityPost`(현 코드 `Community` 위반·정합 필요), 신고는 `CommunityReport` 분리. 리스크: contentHtml 저장형 XSS(서버 sanitize 필요), v13 소유 중복, memo type↔policy_code 매핑, reports 집계 정합, 삭제 물리/soft. 미확정: v13 community 테이블 존재, Create 지원, 삭제 방식, status 2값 충분성, 네임스페이스, author_id FK.

#### 신고 관리 `/community/reports` — mock-only
- **현재 상태**: 요약·검색·필터·상세 Modal·액션메뉴(숨김/정지)·확인+사유·4상태 완성. **mock-only(3건)**. **P0 핵심 버그**: 신고 액션 확정 시 `resolveCommunityReportSafe`가 신고 행 processStatus만 '처리 완료'로 바꿀 뿐 **대상 게시글 숨김도 사용자 정지도 안 함**인데 토스트는 "완료"라고 단정. 두 액션이 동일 resolveReport만 호출.
- **미개발 부분**:
  - [P0·API/Service] 조치 의미 누락(게시글/사용자 실제 미조치, 토스트 오표시).
  - [P0·감사로그] admin_audit_logs write 부재(딥링크만).
  - [P1·데이터계층] community_reports DB/마이그레이션/RLS/RPC 전무.
  - [P1·권한] community.reports.manage 가드 없음.
  - [P1·감사로그] Target Type 3자 불일치(page-sync=CommunityReport, IA=Community, 코드=Community/Users).
  - [P2·UI] 상세 Modal에 원본 컨텍스트/이력 부족, status 필터 URL 미반영.
  - [P2·데이터계층] reason 자유 텍스트(정책코드 미매핑).
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `community_reports` | 신고 큐 | id text(RP-), target_post_id→community_posts, target_user_id, reporter_id, reason/reason_code(CHECK), process_status(pending/resolved), resolution_action(hide_post/suspend_user/dismiss), resolved_by/at | createInitialCommunityReports | 내부 전용(결과 간접 전파) |
  | `community_posts` | 신고 대상(참조) | id, status, last_moderation_* | initialCommunityPosts | 운영상 추정 |

  RPC: `admin_resolve_community_report(report_id, action, reason)` — **단일 트랜잭션으로 게시글 숨김/사용자 정지 + 신고 종결 + 감사 기록**(현 무동작 버그 정합화).
- **개발 계획**:
  1. **조치 의미 버그 선수정(mock 단계에서 hidePost/정지 배선)** → 2. reason/processStatus 코드테이블화 → 3. 테이블/제약 마이그레이션 → 4. 인덱스 → 5. RLS → 6. RPC(쓰기 단일 경로) → 7. supabase 서비스(hybrid 스위치) → 8. UI 배선 보강 → 9. 감사 Target Type 정합·역추적 검증 → 10. B2C 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `CommunityReport`(reportId) 주 + 부수 조치(CommunityPost/User)를 payload/별도 행. 리스크: 무동작 조치 그대로 DB 전환 시 손상 확대, Target Type 3자 불일치, posts와 store 공유 일관성. 미확정: 신고 처리 시 게시글/사용자 실전이 여부, Target Type SoT, targetUserName 비정규화 vs 조인, reason_code 승격, 사용자 정지에 admin_set_user_status 재사용 여부.

---

### 3.4 Message (메일/푸시/인앱/그룹/이력)

> message 도메인은 `notification_*` 4테이블 + RPC 6종 + select-only RLS + seed가 `supabase/migrations-admin`에 **이미 배포**되어, 5개 페이지 모두 **DB 신규 설계 불필요(보강만)**. 공통 갭은 감사 Target Type 불일치(UI=Message vs RPC=Notification), 감사 화면 mock SoT, 발송 파이프라인 외부 종속.

#### 메일 `/messages/mail` — supabase-backed
- **현재 상태**: 자동/수동 탭·검색·HTML 본문 편집(TinyMCE)·미리보기·나에게 보내기·즉시/예약 발송·삭제 완전 구현. notification 4테이블 읽기 + RPC 6종 쓰기 단일 경로, 이메일 100KB 가드까지 배포 완료.
- **미개발 부분**:
  - [P1·API/Service] 발송 파이프라인 미연동(admin_send_notification은 ledger만 생성, 실제 전송/cron 외부 종속), supabase 모드 재시도 차단.
  - [P2·데이터계층] JSON 본문(bodyJson) 토큰 치환 계약 미확정, variables 항상 '[]'.
  - [P1·감사로그] Target Type 불일치(UI=Message, RPC 저장=Notification).
  - [P2·감사로그] 감사 화면 mock SoT.
  - [P3·데이터계층] 카테고리 enum 이원화(mock 한글 vs supabase ASCII 5종).
  - [P2·B2C] 이메일 수신함 '운영상 추정'.
  - [P3·UI·권한] create 페이지 깨진 한글 fallback(line 140), 채널별 세분 권한 미구현.
- **필요 DB 설계**: `needed=false` — **DB 전환 완료, 보강 항목만**. notification_templates/groups/dispatches/delivery_attempts + RPC 6종 배포됨. 보강: variables 토큰 메타 저장 경로, 재시도 RPC, 카테고리 코드 단일화, 감사 target_table 정렬.
- **개발 계획**: 1.토큰/JSON 본문 계약 확정 → 2.variables 저장+토큰 검증 → 3.감사 Target Type 정렬(Notification 또는 MessageTemplate 세분화) → 4.감사 화면 실연동 → 5.발송 파이프라인 배선(외부) → 6.재시도 RPC → 7.카테고리 SoT 단일화 → 8.B2C 노출 확정 → 9.깨진 문구 수정.
- **감사 로그 / 리스크 / 미확정**: RPC는 target_table='Notification'+diff 기록 중, UI는 'Message' — 통일 필요. 리스크: ledger만 생성 후 미전송 오인, target_table 불일치 역추적 빗나감, 100KB 가드로 대용량 HTML 차단, 카테고리 이원화. 미확정: 토큰 치환 위치, body_json 스키마, Target Type 방향, 재시도/cron 주체.

#### 푸시 `/messages/push` — hybrid
- **현재 상태**: 공용 MessageChannelPage(channel='push') 재사용, 템플릿 CRUD는 supabase 실연동. **단 supabase 모드 push 발송 봉인**(`isSendBlocked`), seed에 push 행 0건.
- **미개발 부분**:
  - [P0·API/Service] 푸시 전송 transport 미연동(FCM/APNs/웹푸시 provider·워커 부재, contract §1 '준비 중').
  - [P1·DB스키마] notification_seed에 push 행 0건(supabase 모드 빈 화면).
  - [P2·데이터계층] 발송 이력·재시도 supabase 미지원.
  - [P1·감사로그] Target Type Message/Notification 불일치.
  - [P2·감사로그·B2C] 감사 화면 mock, B2C 푸시/토큰 모델 '운영상 추정'.
  - [P2·데이터계층] 조건 기반 그룹 recipient 산정 미연동.
- **필요 DB 설계**: `needed=false` — 4테이블이 push 채널을 CHECK로 수용, **보강만**. 보강: push seed 추가, provider 연동 후 attempts 적재 경로, push payload(deep-link/icon) 확장 검토. 토큰 저장소 소유권(admin vs B2C) 미확정.
- **개발 계획**: 1.push contract/소유권 확정 → 2.push seed 추가 → 3.전달 파이프라인 구축(provider+워커, opt-out 존중) → 4.발송 봉인 해제 → 5.감사 Target Type 정합 → 6.감사 화면 연동 → 7.이력/재시도 전환 → 8.조건 그룹 산정 → 9.B2C 승격.
- **감사 로그 / 리스크 / 미확정**: Target Type 통일 필요. 리스크: 봉인 해제 전 동의 무시·사일런트 0건 발송, seed 0건 혼선, 공용 페이지 회귀, mandatory push 금지 가능성(contract §2). 미확정: 토큰 저장소 소유, provider 선정, seed 정책, 산정 파이프라인.

#### 인앱 알림 `/messages/in-app` — hybrid
- **현재 상태**: 완전 구현·실연동(in_app 채널 active). 메타/본문/발송/토글/삭제 모두 사유+확인+딥링크 배선. **데이터 계층 미개발 없음** — 잔여는 외부 종속·감사 화면 갭에 한정.
- **미개발 부분**:
  - [P1·API/Service] 발송 집행(dispatcher+pg_cron)이 v13 소유 외부 종속.
  - [P1·감사로그] 감사 화면 mock SoT라 admin_audit_logs(target='Notification') 미표시.
  - [P3·API/Service] supabase 모드 재시도 throw.
  - [P2·B2C] email/push transport 미연동(Phase 3).
  - [P3·UI·데이터] legacy redirect 제거(O-10), 조건 그룹 member_count 미연동.
- **필요 DB 설계**: `needed=false` — **완료**. 4테이블·RPC 6종·RLS·seed·link_url·email 가드 전부 배포. 보강: 조건 그룹 산정 RPC, attempts 적재(파이프라인), 감사 화면 실연동.
- **개발 계획**: 1.파이프라인 집행 검증(외부) → 2.감사 화면 실데이터 연동 → 3.조건 그룹 산정 → 4.email/push transport(Phase 3) → 5.legacy redirect 제거.
- **감사 로그 / 리스크 / 미확정**: Target Type=Notification(template/dispatch uuid), RPC 기록 중·화면 미표시. 리스크: 미배선 시 발송 미도달 오인, mandatory bypass_reason 화면 미표시. 미확정: dispatcher 동작 여부, 감사 연동 일정, member_count 주체, recipient_count 채움 주체.

#### 대상 그룹 `/messages/groups` — supabase-backed
- **현재 상태**: 검색·Drawer·간편/Query Builder·정적 명단·미리보기/재계산·삭제 완전 구현. notification_groups 읽기 + RPC 2종 실연동. **조건 기반 그룹 인원 산정은 supabase 모드 미연동(P1)**.
- **미개발 부분**:
  - [P1·API/Service] 조건 기반 인원 산정/재계산 미연동(previewCount null, recalculate 읽기만).
  - [P1·B2C연동] 그룹 정의가 실제 발송 타게팅으로 소비되는 경로 미확인.
  - [P2·감사로그] save RPC가 diff 미기록(payload만), Target Type Message vs Notification 드리프트.
  - [P3·감사로그] recalculate가 supabase 모드 감사 미생성인데 딥링크 노출.
  - [P3·DB스키마·데이터] message_groups/rules 후보가 query_config jsonb로 비정규화(명명 드리프트), 채널 mail/push만.
  - [P3·UI] 정적 명단 식별자 검증 없음.
- **필요 DB 설계**: `needed=false`. notification_groups + RPC 2종 존재. 보강: 인원 산정 RPC 신규, save RPC diff 기록, Target Type 분리(MessageGroup), member_count 의미 확정.
- **개발 계획**: 1.Target Type 정합(MessageGroup) → 2.save 감사 diff 보강 → 3.조건 산정 RPC(`admin_recalculate_notification_group_count`, profiles 모집단) → 4.service recalculate/preview 배선 → 5.UI 'P2 미지원' 안내 제거 → 6.B2C 타게팅 소비자 연동+usage-map → 7.정적 명단 검증(선택).
- **감사 로그 / 리스크 / 미확정**: target_table='Notification'(UI=Message). 리스크: filters→profiles SQL 변환 계약, profiles 읽기 전용 경계, Target Type 전환 시 기존 감사 단절, jsonb 비정규화 성능. 미확정: filters→모집단 SQL 계약/컬럼 매핑, 발송 소비 파이프라인, Target Type 방향, in_app/zalo 그룹, member_count 의미.

#### 발송 이력 `/messages/history` — hybrid
- **현재 상태**: hybrid 스위치로 supabase 모드 NotificationDispatchHistoryPage(dispatches/delivery_attempts 읽기 + 예약취소 RPC), mock 모드 MockMessageHistoryPage(시드+재시도). 두 모드 완성형.
- **미개발 부분**:
  - [P2·DB스키마] 감사 Target Type 불일치(mock=Message, supabase 취소=Notification).
  - [P1·API/Service] mock 재시도 가짜 동작, supabase 모드 재시도 액션 부재(파이프라인 몫).
  - [P1·데이터계층] supabase 목록 created_at desc 200건 limit·서버 필터/페이지네이션 부재, mock 대비 UI 격차.
  - [P2·UI] supabase 모드 채널 탭/카드/검색/CSV 부재.
  - [P2·감사로그] 감사 화면 mock SoT.
  - [P3·B2C·데이터] email/push B2C '운영상 추정', 문서 엔티티명(message_histories) 뒤처짐.
- **필요 DB 설계**: `needed=false` — notification_dispatches/delivery_attempts + 취소 RPC 배포. 보강: 재시도 RPC(정책 확정 후), 서버 필터/페이지네이션 RPC/뷰.
- **개발 계획**: 1.page-sync 문서 정합화(notification_* 모델) → 2.Target Type 표준화(Message→Notification) → 3.감사 화면 실연동 → 4.재시도 정책 확정+RPC 설계 → 5.재시도 RPC 마이그레이션+RLS → 6.supabase UI 보강(필터/CSV/재시도) → 7.B2C 확인+승격.
- **감사 로그 / 리스크 / 미확정**: supabase=Notification(dispatch id), mock=Message — 표준화 필요. 리스크: 재시도 멱등성/dedupe 미설계 시 중복발송, limit 200 누락, cron 비실시간 새로고침 의존, attempts FK cascade로 탈퇴 시 이력 단절. 미확정: 재시도 단위(dispatch vs attempt), error_code 코드테이블, mock Message 의도성, target_snapshot 용도.

---

### 3.5 Operation (공지/FAQ/이벤트/정책/챗봇)

> operation 도메인 전체가 mock-only(useOperationStore). 4개 페이지 모두 신규 DB 설계 필요, 챗봇은 placeholder. 공통: operation 네임스페이스(migrations vs migrations-admin)가 SoT에 미등록 — 소유권 등록 선행.

#### 공지사항 `/operation/notices` — mock-only
- **현재 상태**: 목록·미리보기·게시/숨김 토글·삭제·등록/수정 상세(TinyMCE)·4상태·URL 복원·딥링크 완성. **mock-only**(새로고침 시 seed 2건 리셋), 사유는 알림 텍스트로만 소비.
- **미개발 부분**: [P0·DB] operation_notices 테이블 부재 / [P0·API] mock-only·스위치 없음 / [P0·감사] admin_audit_logs 미기록 / [P1·권한] operation.notices.manage 가드 없음 / [P2·감사] Target Type `Operation` 공지·이벤트 공용 / [P2·B2C] '운영상 추정' / [P3·기타] 예약 게시 미지원 / [P3·UI] 키워드 검색·페이지네이션 없음.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `operation_notices` | 사용자 공지 SoT | id text(NOTICE- 또는 uuid), title, body_html, status(published/hidden), author, published_at(P3) | mockOperationNotices | 운영상 추정(공지 목록/상세) |

  RPC: `admin_save_operation_notice`/`admin_toggle_operation_notice_status`(reason 필수·diff)/`admin_delete_operation_notice`.
- **개발 계획**: 1.소유권/네임스페이스 확정+스냅샷 → 2.테이블 → 3.인덱스 → 4.RLS → 5.write RPC 3종 → 6.seed → 7.data-source 스위치+supabase 서비스 → 8.UI 배선(reason RPC 전달, 권한) → 9.감사 검증 → 10.B2C 정의.
- **감사 로그 / 리스크 / 미확정**: Target Type=`Operation`(noticeId), 장기 `OperationNotice` 분리 권장. 리스크: store 4엔티티 공유 분해, NOTICE- 클라 채번 동시성, author 하드코딩, body_html XSS, reason service 미전달. 미확정: id 자연키 vs uuid, author FK, 네임스페이스, 예약 게시, soft delete, 권한 가드.

#### FAQ `/operation/faq` — mock-only
- **현재 상태**: 마스터/노출/지표 3탭, 검색·필터·요약·URL 복원·Drawer·등록/수정·ConfirmAction·4상태 완성(2379줄). **mock-only**. JS 검증규칙(unique surface+rank, 비공개 active 금지, FAQ 비공개 시 curation paused) 존재.
- **미개발 부분**: [P0·데이터·DB·API] 3종 mock-only·테이블 0건·RPC 부재 / [P1·감사] admin_audit_logs 미적재 / [P2·B2C·데이터·권한] surface 미확인, 지표 집계 파이프라인 부재, 권한 가드 없음 / [P3·기타] updatedBy CURRENT_ACTOR 고정.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `operation_faqs` | FAQ 원문 마스터 | id, question, answer, search_keywords[], category(CHECK), status(공개/비공개) | mockOperationFaqs | 고객센터/도움말(운영상 추정) |
  | `operation_faq_curations` | 대표 노출 큐레이션 | id, faq_id(FK cascade), surface(CHECK 4종), curation_mode, display_rank(1~5), exposure_status, unique(surface,display_rank) | mockOperationFaqCurations | 홈/고객센터 노출 순서 |
  | `operation_faq_metrics` | 지표 스냅샷 | faq_id PK(FK), view/search/helpful/not_helpful_count, last_viewed_at | mockOperationFaqMetrics | 내부 운영 지표 |

  RPC: `admin_save_operation_faq`/`admin_toggle_operation_faq_status`(비공개 시 curation paused)/`admin_delete_operation_faq`/`admin_save_operation_faq_curation`(unique·비공개 active 금지)/`admin_delete_operation_faq_curation`.
- **개발 계획**: 1.소유권+스냅샷 → 2.테이블+제약 → 3.인덱스(gin) → 4.RLS → 5.RPC(검증 이식) → 6.seed(선택) → 7.스위치+supabase 서비스 → 8.UI 무변경 검증 → 9.감사 실연동 → 10.B2C 승격+지표 집계.
- **감사 로그 / 리스크 / 미확정**: Target Type=`OperationFaq`(faqId)/`OperationFaqCuration`(curationId)(등록됨, 적재만 부재). 리스크: status 한글 vs ASCII, JS 검증 DB 이식, display_rank unique 재배치 충돌, FAQ-NNN 동시성, 지표 집계 소스 부재. 미확정: surface B2C 위치, status 코드, 지표 이벤트, 권한 가드, PK, 네임스페이스, curationMode auto 로직.

#### 이벤트 `/operation/events` — mock-only
- **현재 상태**: 목록+7단계 등록/수정 폼(TinyMCE·배너 DnD·그룹/템플릿 연동·보상·SEO)·게시 예약/즉시/종료 완성. **mock-only**. 배너 data URL 메모리 보관, 보상 정책 하드코딩, 감사 미영속.
- **미개발 부분**: [P0·데이터·감사] mock-only·admin_audit_logs 미영속(감사 페이지도 mock) / [P1·API·DB·UI] 스위치 없음, 보상 정책 하드코딩, 배너 data URL / [P2·B2C·데이터·권한] B2C '노출 예정', participantCount 0/고정, 권한 가드 없음.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `operation_events` | 이벤트 메타/본문/상태 | id text(EVT-) 또는 uuid+code, title, body_html, slug, event_type(CHECK), visibility_status(노출/숨김/예약), progress_status, start/end_at, reward_type, message_template_id, meta_* | mockOperationEvents | 노출 예정(이벤트 목록/상세/랜딩) |
  | `operation_event_banner_images` | 배너 asset list | id, event_id(FK cascade), display_order, asset_url | toBannerImages | 노출 예정(히어로) |
  | `operation_event_reward_policies` | 보상 정책 코드테이블 | id, name, reward_type(CHECK), description | operationEventRewardPolicyOptions | 내부 전용(연결 메타) |

  RPC: `admin_save_operation_event`/`admin_schedule`/`admin_publish`/`admin_end`(reason 필수)/`admin_delete`(선택).
- **개발 계획**: 1.소유권+스냅샷 → 2.테이블+제약 → 3.인덱스(부분) → 4.RLS → 5.RPC(쓰기+감사) → 6.seed → 7.스위치+서비스 → 8.배너 storage 전환 → 9.감사 화면 연동 → 10.B2C 정의.
- **감사 로그 / 리스크 / 미확정**: Target Type=`Operation`(EVT- eventId, 계약 일치). 리스크: 감사 완전 mock(RPC+화면 동시 필요), EVT- 클라 채번, progressStatus 파생 vs 저장(forceEnded), 배너 전환, 보상 도메인 미연동, operation 네임스페이스 미정. 미확정: 네임스페이스, PK, reward_policy FK, participantCount 소스, B2C 랜딩, Target Type 세분화, 권한 매핑.

#### 정책 관리 `/operation/policies` — mock-only
- **현재 상태**: 목록·Drawer·미리보기·등록/수정/새버전·게시/숨김·삭제·히스토리·'이 버전 게시' 완성. **mock-only**(16건 시드 + PH- 히스토리). updatedBy CURRENT_ACTOR 하드코딩, admin_audit_logs 미기록.
- **미개발 부분**: [P0·데이터·DB·API·감사] mock-only·테이블 0건·supabase 서비스 부재·admin_audit_logs 미적재 / [P1·권한·B2C] actor 하드코딩·requiresConsent 트리거 미구현 / [P2·UI] 버전 모델 약함(currentVersionId 없음, 덮어쓰기) / [P2·데이터] changedAt 문자열 비교·클라 채번.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `operation_policies` | 정책 헤드 | id(POL- 또는 uuid), category(CHECK), policy_type(16종), version_label, effective_date, exposure_surfaces[], requires_consent, tracking_status, status(게시/숨김), current_version_id(권장) | POL-001~016 | 운영상 추정(약관/환불/마이페이지) |
  | `operation_policy_histories` | 변경 이력+스냅샷 | id bigint, policy_id(FK cascade), action(CHECK), version_label, changed_at, changed_by, snapshot jsonb | PH-NNNN | 내부 전용 |

  RPC: `admin_save_operation_policy`/`admin_toggle_operation_policy_status`/`admin_publish_operation_policy_version`(from/toVersionId)/`admin_delete_operation_policy`(소프트 권장).
- **개발 계획**: 1.소유권+스냅샷 → 2.테이블+제약 → 3.인덱스(gin) → 4.RLS(force) → 5.RPC 4종 → 6.멱등 seed+검증 → 7.supabase 서비스+스위치 → 8.actor/권한 배선 → 9.감사 화면 연동+B2C 동기화(동의 재수집).
- **감사 로그 / 리스크 / 미확정**: Target Type=`OperationPolicy`(policyId, 계약·딥링크 배선됨). 리스크: mock 휘발 인식차, 한글 코드값 vs ASCII, 클라 채번 충돌, 덮어쓰기 게시(current_version_id 필요), 감사 화면 mock, actor 하드코딩. 미확정: 코드값 한글/ASCII, 네임스페이스, id 체계, 권한 가드, requires_consent 트리거/B2C 위치, 삭제 방식, 예약 게시.

#### 챗봇 설정 `/operation/chatbot` — placeholder/none
- **현재 상태**: 라우터 placeholder만 등록(공용 PlaceholderPage). 전용 page/mock/service/store/types 0건, DB 0건. 권한키·메뉴 라벨만 배선. 시나리오·응답방식·전환조건 전부 미확정.
- **미개발 부분**: [P1·UI·데이터·API] 전용 페이지·계층 부재 / [P2·DB·감사] 테이블 부재, Target Type 불일치(page-sync=OperationChatbotScenario, IA=Operation) / [P3·B2C·권한] 노출 예정, 권한 미사용.
- **필요 DB 설계**: `needed=true`(추정 기반).

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `operation_chatbot_scenarios` | 시나리오 마스터 | id uuid, name, channel(web/app/help_center), response_mode(rule_based/llm/hybrid), status, active, current_version, handover_condition, fallback_policy | 없음(IA/sync 도출) | 노출 예정(웹/앱 챗봇) |
  | `operation_chatbot_rules` | 응답/전환 규칙 1:N | id uuid, scenario_id(FK cascade), trigger_condition, response_payload jsonb, handover_target, sort_order | 없음 | 노출 예정 |

  RPC: `admin_upsert_chatbot_scenario`/`admin_toggle_chatbot_scenario_active`/`admin_publish_chatbot_scenario_version`/`admin_delete_chatbot_scenario`.
- **개발 계획**: 1.기획/계약 확정(버전 정책·전환 기준·응답 모드·Target Type) → 2.타입/코드테이블/mock 신설 → 3.service facade+store → 4.페이지 UI(placeholder 제거) → 5.DB 테이블·인덱스·RLS → 6.RPC+서비스 supabase 전환 → 7.감사 배선+B2C 합의.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `OperationChatbotScenario`(scenarioId, 신규 등록 필요). 리스크: 기획 공백(응답 모드 종속), Target Type 불일치, operation 도메인 단독 선행 시 정합성, 네임스페이스 미정. 미확정: 룰/LLM/하이브리드, 버전 정책, handover 대상, Target Type, 네임스페이스, B2C 위치, 권한 가드, 도메인 전환 로드맵.

---

### 3.6 Billing / Commerce (결제/환불/쿠폰/포인트/이커머스)

#### 결제 내역 `/commerce/payments` — hybrid(읽기 전용)
- **현재 상태**: 요약·검색·정렬·테이블·상세 Modal·4상태 완성. hybrid 읽기 — 연결 시 v13 `payment_history` SELECT, 미연결 시 mock. **write·감사·조치 버튼 전무**(읽기/링크만). sync 문서의 `commerce_payments`/CRUD는 코드에 없는 후보.
- **미개발 부분**: [P3·DB] commerce_payments 미실재(실제는 v13 payment_history) / [P2·API] 결제 write 경로 없음(PG/정산 영역) / [P1·데이터] method 컬럼 부재→'미확인', failed/pending이 '취소'로 lossy / [P1·감사] 환불 경로 Target Type Commerce vs sync CommercePayment, mock 환불 admin_audit_logs 미기록 / [P1·권한] 환불 write가 RPC 아닌 store / [P3·B2C·UI] '운영상 추정', selected URL 미복원·상태/결제수단 필터 제외.
- **필요 DB 설계**: `needed=false` — v13 payment_history reconcile, **신규 테이블 비대상**. 보강: method 무손실 노출(v13 컬럼 협의), lossy 매핑 검토, 환불 워크플로 source. v13 DDL 금지(읽기 RPC/뷰만).
- **개발 계획**: 1.sync 문서↔코드 정합(읽기 전용·CRUD '비지원' 정정) → 2.감사 Target Type 결정(Commerce vs CommercePayment) → 3.method/status 손실 운영 검토 → 4.환불 write 실DB 승격 결정+RPC → 5.감사 화면 연동 → 6.B2C '운영상 추정'→'확인됨' 승격.
- **감사 로그 / 리스크 / 미확정**: 결제 페이지는 조회 전용(감사 불필요), 환불 경로에서 필요. 리스크: 문서 가짜 테이블로 오작업 유발, v13 DDL 금지, lossy 매핑 CS 오판, 환불 write 양모드 분기. 미확정: method 컬럼 추가 주체, admin 결제 write 비목표 여부, 환불 워크플로 표현, Target Type, selected/필터.

#### 환불 관리 `/commerce/refunds` — hybrid
- **현재 상태**: 검색·요약·테이블·상세·승인/거절(확인+사유)·딥링크·4상태·URL 복원 완성. **환불은 v13 독립 엔티티 없음** — `payment_history.status='refunded'` 행을 읽기 전용 RefundRow(항상 '승인')로 합성. **supabase 모드 승인/거절 버튼 비활성**(읽기 전용), 실 워크플로는 mock 전용 store 변경.
- **미개발 부분**: [P0·DB·API·감사] commerce_refunds 테이블 부재, supabase 모드 write 차단, admin_audit_logs 미적재 / [P1·감사·데이터·권한] Target Type 코드 Commerce vs 문서 CommerceRefund, supabase 합성 항상 '승인'·sentinel, write가 RPC 아닌 store·changedBy='admin_park' 하드코딩 / [P3·UI] Create/Delete 미구현 / [P2·B2C] '운영상 추정'.
- **필요 DB 설계**: `needed=true`.

  | 테이블 | 목적 | 주요 컬럼 | 근거 mock | B2C 영향 |
  |---|---|---|---|---|
  | `commerce_refunds` | 환불 워크플로 SoT | id uuid, refund_code(unique), payment_id text(v13 느슨 참조), user_id→profiles, requested_amount, reason, status(pending/approved/rejected), processed_by/at, review_reason | mockBillingRefunds | 운영상 추정(마이페이지 환불 상태) |

  RPC: `admin_resolve_commerce_refund(refund_id, decision, reason)` — 상태 전이+결제 동기화+감사(target='CommerceRefund'), `admin_create_commerce_refund`(선택). v13 payment_history는 느슨 참조(FK 불가, DDL 금지).
- **개발 계획**: 1.소유권·계약 고정(Target Type CommerceRefund 등록) → 2.테이블·제약 마이그레이션 → 3.RLS+RPC → 4.읽기 서비스 전환(4상태 노출) → 5.write 서비스 배선(차단 제거) → 6.UI 배선 갱신(버튼 재활성·actor·권한) → 7.감사 Target Type 정합 → 8.B2C 확인.
- **감사 로그 / 리스크 / 미확정**: Target Type=`CommerceRefund`(refundId, 코드 Commerce 정정·계약 신규 등록). 리스크: v13 느슨 참조·결제 상태 동기화 권한, status 한글→ASCII 전환 시 page 비교 로직 수정, 합성 환불과 실 워크플로 혼재, actor 하드코딩. 미확정: 환불을 신규 엔티티 vs v13 확장, 결제 동기화 대상/권한, Target Type SoT, 네임스페이스, B2C 위치.

#### 쿠폰 관리 `/commerce/coupons` — mock-only
- **현재 상태**: 목록(2386줄)·쿠폰 등록/수정(1885줄)·정기 템플릿(1315줄) 완전 구현(폼·탭·검증·복제·발행중지/재개·삭제). **전부 mock-only**(useCouponStore). 감사가 store 내 `CouponAuditEvent[]`(AL-CPN-)에만 append(새로고침 소실). 등급/카테고리/상품/메시지/CRM/이벤트 전부 하드코딩 맵.
- **미개발 부분**: [P0·데이터·감사·API] mock-only, CouponAuditEvent store만, supabase 스위치 부재 / [P1·B2C·데이터·DB] 쿠폰함/할인 미확인, 발급/사용 실적 정적, 외부 참조 하드코딩, 정기 cron 부재 / [P2·권한·감사] 권한 RPC 가드 없음, RPC diff 미구현.
- **필요 DB 설계**: `needed=true`. 주요 테이블: `commerce_coupons`(혜택/조건/발행상태/연동), `commerce_coupon_target_groups`(대상 매핑), `commerce_coupon_alerts`(발급/만료 알림), `commerce_coupon_subscription_templates`(정기 발행), `commerce_coupon_template_scope_refs`(적용/제외 매핑). 근거 mock: mock-coupons.ts/coupon-types/coupon-template-types. B2C: 쿠폰함/할인(운영상 추정·노출 예정). RPC: `admin_save/duplicate/set_issue_state/delete_commerce_coupon` + 템플릿 3종(save/set_status/delete), 발급/사용 원장(commerce_coupon_issues/redemptions)은 후속. 명명 `commerce_` 접두(Target Type 정합), enum 한글 ASCII 승격 결정 필요.
- **개발 계획**: 1.소유권/네임스페이스 확정+스냅샷 → 2.테이블+제약(본체+매핑) → 3.인덱스 → 4.RLS → 5.write RPC → 6.seed(선택) → 7.down+무변경 게이트 → 8.스위치+supabase 서비스 → 9.감사 실연동(store→admin_audit_logs) → 10.외부 참조 도메인 연동 → 11.B2C+발급/사용 원장 설계.
- **감사 로그 / 리스크 / 미확정**: Target Type=`CommerceCoupon`(couponId)/`CommerceCouponTemplate`(templateId)(정합). 리스크: 전환 범위 큼(6+테이블·7+RPC), enum 한글 저장 정책, PK 자연키 유지, 외부 도메인 미연동, 실적 집계 출처 부재. 미확정: 네임스페이스/tracker, PK, enum 코드, 발급/사용 원장 범위, 외부 도메인 소스, B2C 위치/적용 우선순위, cron, 권한.

#### 포인트 관리 `/commerce/points` — mock-only
- **현재 상태**: 정책/원장/소멸 3탭, 검색·필터·정렬·Drawer·정책 등록/수정·수동조정·소멸보류·ConfirmAction·딥링크·4상태 완성(3024줄). **전부 mock-only**(모듈 `let` 변수+sleep). write가 메모리 변수만 갱신, admin_audit_logs 미기록. **클라이언트가 잔액 직접 계산**.
- **미개발 부분**: [P0·데이터·DB·감사·API] mock-only, 3테이블 0건, admin_audit_logs 미기록, 클라 잔액 계산(RPC 미이관) / [P1·B2C·데이터] 지갑 SoT 미정, 잔액 추정 / [P2·권한] 가드 없음 / [P3·UI] export stub, 정책 Delete 미지원.
- **필요 DB 설계**: `needed=true`. `commerce_point_policies`(정책 마스터), `commerce_point_ledgers`(증감 원장·balance_after), `commerce_point_expirations`(소멸 예정/보류). 근거 mock: mock-points.ts/point-types. B2C: 지갑/리워드(노출 예정). RPC: `admin_save_commerce_point_policy`/`admin_update_..._status`/`admin_create_manual_point_adjustment`(**서버측 잔액 계산**)/`admin_hold/release_..._expiration`. enum 한글 vs ASCII·PK 결정 필요.
- **개발 계획**: 1.소유권/계약 고정+스냅샷 → 2.테이블+제약 → 3.인덱스(user_id+occurred_at 등) → 4.RLS(force) → 5.write RPC(서버 잔액 계산) → 6.seed → 7.supabase 서비스+스위치 → 8.UI 배선 검증(잔액 서버 산출 매핑) → 9.감사 역추적 검증 → 10.B2C 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type=`CommercePointPolicy`/`CommercePointLedger`/`CommercePointExpiration`(등록됨, 적재 부재). 리스크: 금전성 자산 — 클라 잔액 계산→서버 이관 필수(동시성/이중적립), 한글 enum, 신규 도메인 소유권, 소멸 cron 부재, 표시코드 PK 충돌. 미확정: enum 코드, PK, 네임스페이스, 지갑 SoT, 승인 체계, 차감 우선순위/환불 복구, 소멸 자동 처리, user_id FK.

#### 이커머스 관리 `/commerce/store` — placeholder/none
- **현재 상태**: 순수 placeholder(공용 AdminPlaceholderPage). commerce feature에 상품/패키지 page/service/mock/types 전무, CommerceProduct/commerce_products 식별자 0건. 상태값/상품유형/판매정책 전부 미확정.
- **미개발 부분**: [P0·UI·데이터·API·DB] 전 계층 0% / [P1·권한·감사·B2C] 가드 미정, Target Type page-sync(CommerceProduct) vs IA(Commerce) 충돌, B2C '노출 예정' / [P2·기타] 상태/유형/판매정책 enum 미정.
- **필요 DB 설계**: `needed=true`. `commerce_products`(상품 마스터·product_type/price/sale_status/display_status/sales_count), `commerce_packages`(패키지 구성), `commerce_product_coupon_links`(선택). 근거: IA §6/page-sync §5(mock 없음·도출). B2C: 노출 예정. RPC: `admin_create/update_commerce_product`/`admin_set_sale_status`/`admin_set_display_status`/`admin_delete`. enum ASCII+라벨, 신규 commerce 네임스페이스 등록 선행.
- **개발 계획**: 1.기획/계약 확정(유형/상태/가격/패키지·Target Type 통일·contract 등록) → 2.mock 데이터 계층 → 3.service facade → 4.페이지 UI(placeholder→page) → 5.감사/조치 배선 → 6.DB 스키마+마이그레이션 → 7.supabase 스위치 → 8.B2C 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `CommerceProduct`/`CommercePackage`(contract 신규 등록, IA Commerce와 정렬). 리스크: 전면 신규(기획 선결 시 정체), Target Type 불일치, enum 표준화 vs 기존 한글 관행 트레이드오프, 신규 네임스페이스 결정, sales_count 결제 도메인 의존. 미확정: product_type 세트, 상태 enum, Target Type SoT, packages 모델(1 vs 2테이블), 쿠폰/포인트 연결 방향, sales_count 소스, B2C 흐름, 네임스페이스.

---

### 3.7 Assessment (문항/EPS/레벨테스트)

#### TOPIK 쓰기 문항 `/assessment/question-bank` — hybrid
- **현재 상태**: 목록+조회 전용 상세 모두 실동작. 3-way 스위치(topik_writing 기본/legacy/mock). DB 측 4테이블+source_map+topic/tag_master+question_tags+추천 뷰+select-only RLS+admin RPC(0012/0013/0014)가 **이미 적재** — 목록/상세 기준 데이터 계층 사실상 완성. 쓰기는 형제 `/manage`가 담당.
- **미개발 부분**: [P0·API/Service] 외부 공급 API 수신·적재 파이프라인 부재(question_received 경로 없음, 인터림 466행 고정·D-11 종속) / [P1·감사] 감사 화면 mock SoT라 AssessmentQuestion 행 미표시 / [P1·B2C] v13 사용자 화면이 구 problems 소비(신규 4테이블 미반영) / [P2·API] source_map push 잔여 컬럼 의미 소멸 / [P3·UI·DB] 목록 태그 컬럼/필터 미배선, 0012→0013 down 롤백 시 검수 RPC 부활 위험.
- **필요 DB 설계**: `needed=false` — **DB 전환 완료, 보강만**. topik_writing_51~54_questions·question_source_map·topic_master·tag_master·question_tags·추천 뷰·RLS·RPC 4종 적재. 보강: 수신 적재 RPC(question_received), source_map push 잔여 정리, 0012→0013 down 정합.
- **개발 계획**: 1.외부 공급 API 계약 확정(D-11 회신) → 2.수신 적재 RPC/파이프라인 설계·마이그레이션 → 3.question_received 감사 결선 → 4.감사 화면 실데이터 전환 → 5.v13 사용자 화면 신규 스키마 소비 전환 → 6.롤백 봉인 종료+source_map 정리.
- **감사 로그 / 리스크 / 미확정**: 목록/상세는 조회 전용(쓰기 감사는 /manage), Target Type=`AssessmentQuestion`(questionId)/`AssessmentTagMaster`(tagCode). 리스크: 외부 종속으로 코퍼스 고정, 감사 화면 mock 괴리, v13 이중 소스, 0012→0013 down 롤백 검수 부활, RLS select-only로 수신은 RPC 필수. 미확정: 공급 페이로드/식별자, 감사 화면 전환 시점, v13 소비 전환, push 잔여 컬럼, 목록 태그 노출.

#### EPS TOPIK `/assessment/question-bank/eps-topik` — placeholder/none
- **현재 상태**: placeholder(공용 AdminPlaceholderPage). 전용 page/service/store/mock 부재, DB 0건. 권한키·감사 딥링크(targetType=Assessment+EPS-) 배선. 세트 구조·발행 정책·B2C 미확정.
- **미개발 부분**: [P0·UI·API·DB·기타] 전 계층 미구현, 정책 미확정 / [P1·데이터·감사] mock 부재, RPC+admin_audit_logs 경로 없음 / [P2·권한·B2C·기타] 권한 미연결, B2C '노출 예정', Target Type 충돌(page-sync=AssessmentEpsTopikSet, IA=Assessment+EPS-).
- **필요 DB 설계**: `needed=true`. `assessment_eps_topik_sets`(시험 세트·배점·발행상태), `assessment_eps_topik_questions`(세트-문항 배정). 근거: IA §6/page-sync(mock 없음). B2C: 노출 예정. RPC: `admin_create/update/publish/assign/remove/delete`. 문항 풀 출처(EPS 전용 vs topik_writing 재사용) 미정.
- **개발 계획**: 1.정책 확정(세트 모델·상태·발행/롤백·문항 풀·Target Type) → 2.타입/스키마/mock → 3.service facade+스위치 → 4.페이지 UI(placeholder→page) → 5.DB 테이블+인덱스 → 6.RLS+RPC → 7.supabase 어댑터 전환 → 8.감사 배선 → 9.B2C+usage-map.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `AssessmentEpsTopikSet`(setId, action-log 등록). 리스크: 전면 신규·명명 불일치 고착, 문항 풀 출처 미정으로 FK 흔들림, 발행/롤백 미정, B2C 미확인, 소유권 네임스페이스. 미확정: 문항 풀 출처, Target Type, 상태/발행 정책, 배점 형태, B2C 위치, 네임스페이스, 권한 가드.

#### 레벨 테스트 `/assessment/level-tests` — placeholder/none
- **현재 상태**: 순수 placeholder. 전용 page/component/service/mock/types 0건, 마이그레이션 0건. 권한키·메뉴 라벨·문서 2건만. **점수 산식·결과 코드·추천 콘텐츠 매핑 전부 미확정(IA §14)**.
- **미개발 부분**: [P0·기타] 결과 산식/코드/추천 매핑 미확정 / [P1·UI·API·데이터·DB·감사] 전 계층 미구현 / [P2·UI·감사] 4상태·발행 UI 부재, Target Type 불일치(page-sync=AssessmentLevelTest, IA=Assessment) / [P3·B2C] 노출 예정.
- **필요 DB 설계**: `needed=true`(정책 확정 후 컬럼 확정). `assessment_level_tests`(테스트 세트·대상레벨·상태), `assessment_level_test_results`(점수 구간·결과 코드·추천 콘텐츠). 근거: IA/page-sync(mock 없음). B2C: 노출 예정. RPC: `admin_create/update/publish/delete_level_test`.
- **개발 계획**: 1.정책 확정(산식·결과 코드·구간·추천 매핑·Target Type) → 2.타입/스키마/mock → 3.service facade(mock) → 4.UI 배선 → 5.DB 테이블·인덱스·RLS → 6.쓰기 RPC → 7.service supabase 전환 → 8.감사·Target Type 정합 → 9.B2C·usage-map.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `AssessmentLevelTest`(levelTestId, 신규 등록). 리스크: 정책 미확정이 최대 블로커, 추천 콘텐츠가 Content 모듈(placeholder)에 선행 의존, 명칭 불일치, question-bank에 끼워넣지 말 것. 미확정: 산식/결과 코드, 추천 콘텐츠 식별자, Target Type, 네임스페이스, B2C 위치, serviceStatus 재사용, 미리보기 요구.

---

### 3.8 Content (콘텐츠/배지/단어장/소나기/객관식/미션)

> Content 모듈 6페이지 전부 placeholder, `src/features/content` 폴더 자체가 부재. 데이터소스 none, 전 계층 신규 구축 필요. 공통: 신규 content 네임스페이스/tracker 결정(shared-supabase-schema-ownership.md 등록) 선행, Target Type 문서 불일치(엔티티명 vs Content) 정합 필요.

#### 콘텐츠 관리 `/content/library` — placeholder/none
- **현재 상태**: placeholder. content feature 0건, content_items 테이블 0건. 권한키(content.library.manage)·CONTENT_MANAGER만 등재.
- **미개발 부분**: [P0·UI·데이터·API·DB] 전 계층 0% / [P1·감사] Target Type sync(ContentItem) vs IA(Content), admin_audit_logs 미등록 / [P1·기타] 자산 저장·검수-발행 분리·다형성 미확정 / [P2·권한·B2C] 가드 미적용, B2C '노출 예정'.
- **필요 DB 설계**: `needed=true`. `content_items`(콘텐츠 허브·유형/카테고리/상태/난이도/노출 메타), `content_type_codes`(또는 model schema 코드테이블). 근거: IA §6/sync §5(mock 없음). B2C: 노출 예정. RPC: `admin_create/update/update_status/delete_content_item`.
- **개발 계획**: 1.기획/계약 확정(유형/상태/난이도·자산·검수-발행·Target Type·네임스페이스, v13 기존 테이블 확인) → 2.feature+타입/스키마 → 3.mock+service facade → 4.placeholder→실 UI → 5.DB 테이블+제약 → 6.인덱스+RLS → 7.RPC+감사 → 8.스위치+서비스 전환 → 9.감사 역추적 → 10.B2C+문서.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `ContentItem`(contentId, contract 등록). 리스크: 전면 신규·미확정 계약, v13 기존 콘텐츠 테이블 충돌 가능, Target Type 불일치, B2C 미확정으로 노출 컬럼 변경 위험, 인접 도메인과 허브/분리 결정. 미확정: 유형 값, 상태 분리, 자산 저장, Target Type, v13 테이블, 네임스페이스, 허브 여부, B2C 위치, 권한 가드.

#### 배지 `/content/badges` — placeholder/none
- **현재 상태**: placeholder. content_badges 테이블/페이지/계층 0건. 권한키·배지 메타그룹(META-GRP-006) 초안만.
- **미개발 부분**: [P0·UI·API·데이터·DB] 전 계층 / [P1·감사·B2C] admin_audit_logs 경로·Target Type 등록 부재, 획득 조건 계산 주체 미정 / [P2·권한] 지급/회수 권한 분리 미정 / [P3·Target Type] page-sync(ContentBadge) vs IA(Content).
- **필요 DB 설계**: `needed=true`. `content_badges`(배지 정의·등급/획득조건/노출), `content_badge_awards`(회원별 획득 원장). 근거: page-sync/IA(mock 없음). B2C: 노출 예정(마이페이지 성취). RPC: `admin_upsert_content_badge`/`admin_set_content_badge_status`/`admin_award/revoke_content_badge`.
- **개발 계획**: 1.기획 확정(상태/등급/획득 조건·계산 주체·지급/회수 권한·B2C·Target Type) → 2.SoT 갱신(contract/usage-map/action-log/소유권) → 3.타입+코드테이블 → 4.mock+service → 5.UI 구현 → 6.DB(테이블→인덱스→RLS) → 7.RPC+감사 → 8.supabase 전환+스위치 → 9.B2C 승격.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `ContentBadge`(badgeId)·수동 지급/회수는 `ContentBadgeAward` 검토. 리스크: 기획 공백(자동 획득 여부가 awards/RPC 범위 좌우), 상태/등급 미확정, 신규 네임스페이스, B2C 미확인, page-sync↔IA 불일치. 미확정: 획득 조건(수동/자동), 상태 세트, 등급 값, 네임스페이스/tracker, B2C 위치, Target Type, 미션 연결 FK.

#### 단어장 `/content/vocabulary` — placeholder/none
- **현재 상태**: placeholder. content feature 부재, vocabulary 테이블/mock 0건. 하위 콘텐츠(소나기/객관식) 허브 미구현.
- **미개발 부분**: [P0·UI·API·데이터·DB] 전 계층 / [P1·API·감사] 스위치 부재, Target Type sync(VocabularyEntry) vs IA(Content)·미등록 / [P2·권한·B2C] 가드 미확인, 노출 게이트 미정 / [P3·기타] 하위 콘텐츠 연결 구조 부재.
- **필요 DB 설계**: `needed=true`. `vocabulary_categories`(레벨/언어/상태), `vocabulary_entries`(단어/뜻/예문·status). 근거: page-sync/IA(mock 없음). B2C: 노출 예정(학습 화면). RPC: `admin_upsert_vocabulary_category/entry`/`admin_set_vocabulary_status`/`admin_delete_vocabulary_entry`/`admin_bulk_insert`(선택).
- **개발 계획**: 1.기획/정책 확정(상태·level/language·노출 게이트·대량 등록·발행 분리) → 2.타입·스키마 → 3.mock+service → 4.페이지 UI(mock) → 5.DB 스키마·마이그레이션 → 6.RLS+write RPC → 7.스위치+supabase 서비스 → 8.감사 배선 → 9.B2C+usage-map.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `VocabularyCategory`/`VocabularyEntry`(또는 Content), contract 등록. 리스크: 0→1 신규, 신규 네임스페이스 인프라 결정 선행, page-sync↔IA Target Type 불일치, 상태/노출 게이트 미정, 집계 파생 정규화, 하위 3페이지 동시 의존. 미확정: Target Type, 상태 세트(검수 분리), level/language enum, 네임스페이스, B2C 게이트, 권한, 집계/연결 모델.

#### 소나기 `/content/vocabulary/sonagi` — placeholder/none
- **현재 상태**: placeholder. content 모듈 부재. 권한키 등재. 상위 단어장 테이블도 부재.
- **미개발 부분**: [P1·UI·데이터·DB] 전체 미구현(단어장 부모 부재) / [P1·감사] Target Type 충돌(page-sync=SonagiContent, IA=Content) / [P3·B2C] 노출 예정.
- **필요 DB 설계**: `needed=true`. `vocabulary_sonagi_sets`(세트·노출 상태·연결 단어장), `vocabulary_sonagi_items`(구성 항목·template/payload jsonb). 근거: page-sync/IA(mock 없음). B2C: 노출 예정. RPC: `admin_upsert_sonagi_set`/`admin_set_sonagi_set_status`/`admin_delete_sonagi_set`.
- **개발 계획**: 1.기획·계약 확정(템플릿 구조·상태·연결 단어장·Target Type) → 2.content 스캐폴딩 → 3.placeholder→실 페이지 → 4.DB 테이블·마이그레이션 → 5.RLS+쓰기 RPC → 6.서비스 supabase 전환 → 7.감사 배선+Target Type 등록 → 8.B2C 확정.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `SonagiContent`(또는 Content), action-log 등록. 리스크: 완전 신규, 상위 단어장 부모 부재(고아/임시 nullable FK), Target Type 충돌, 템플릿 구조 미정으로 payload 가설, 네임스페이스. 미확정: 템플릿/구성 스키마, 상태 세트, Target Type, 연결 단어장 원천, B2C 위치, 네임스페이스.

#### 객관식 선택 `/content/vocabulary/multiple-choice` — placeholder/none
- **현재 상태**: placeholder. content feature 부재, 전 계층 0건.
- **미개발 부분**: [P0·UI·데이터·DB·감사] 전 계층 + Target Type 불일치(IA=Content vs page-sync=VocabularyMultipleChoiceQuestion)·레지스트리 미등재 / [P1·API·B2C] 스위치 부재, 노출 예정 / [P2·권한·기타] 가드 미확인, 상태/검수 분리 미정.
- **필요 DB 설계**: `needed=true`. `vocabulary_multiple_choice_questions`(질문/난이도/상태/해설), `vocabulary_multiple_choice_options`(보기/정답 플래그/피드백, 자식 정규화 또는 부모 JSONB). 근거: page-sync/IA(mock 없음). B2C: 노출 예정(퀴즈). RPC: `admin_save_vocabulary_mc_question`/`admin_set_..._status`/`admin_delete`.
- **개발 계획**: 1.SoT 정합 선결(Target Type·상태·정답검증/피드백·네임스페이스) → 2.feature 스캐폴드+mock → 3.placeholder→실 UI → 4.DB 테이블·인덱스·제약 → 5.RLS+RPC → 6.스위치+supabase 서비스 → 7.감사 배선+역추적 → 8.B2C 승격.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `VocabularyMultipleChoiceQuestion`(questionId, 레지스트리 등록). 리스크: 전면 신규·계약 부재, 단어장 부모 미구현, 보기 모델 오선택 시 감사 입자도 불일치, 네임스페이스. 미확정: Target Type, 보기 모델(자식 vs JSONB), 단어장 FK 일정, 상태 세트/검수 분리, 정답 검증/피드백, B2C, 네임스페이스/권한.

#### 학습 미션 `/content/missions` — placeholder/none
- **현재 상태**: placeholder. content 도메인 부재. learning_missions/LearningMission SoT 미등재. Content>배지도 동일 placeholder.
- **미개발 부분**: [P0·UI·데이터·DB·API] 전 계층 + 달성/보상 트리거 정책 미확정(IA §14) / [P1·감사·B2C] Target Type 불일치(page-sync=LearningMission, IA=Content)·미등재, B2C 노출 예정 / [P2·권한] 가드 미확인.
- **필요 DB 설계**: `needed=true`. `learning_missions`(미션 정의·조건/기간/상태), `learning_mission_rewards`(포인트/배지 연결), `learning_mission_progress`(선택·도달률). 근거: page-sync/IA(mock 없음). B2C: 노출 예정. RPC: `admin_create/update/set_status/set_rewards/grant_reward/revoke_reward/delete`.
- **개발 계획**: 0.정책 선확정(달성 계산·보상 트리거·상태·보상 enum·B2C) → 1.Target Type 정합(LearningMission·contract 등록) → 2.mock/types/service 골격 → 3.placeholder→실 UI → 4.DB 스키마·마이그레이션 → 5.인덱스·RLS → 6.쓰기 RPC → 7.supabase 전환·스위치 → 8.감사 배선 → 9.B2C·usage-map.
- **감사 로그 / 리스크 / 미확정**: Target Type 권장 `LearningMission`(missionId, contract 신규 등록). 리스크: 신규 도메인·정책 미확정, 배지/포인트(둘 다 미성숙)에 보상 연결 종속, Target Type 불일치, B2C 추정, 네임스페이스. 미확정: 달성 계산(수동/자동), Target Type, 네임스페이스, 배지/포인트 FK·연동, 도달률 소스, 권한, B2C 위치.

---

### 3.9 Analytics (통계 개요)

#### 통계 개요 `/analytics/overview` — placeholder/mock-only
- **현재 상태**: UI는 동작하는 대시보드(Statistic/Progress/Table·기간 Segmented·URL 복원). 그러나 지표 대부분 페이지 하드코딩 상수(summaryMap/moduleSummaryMap), 유일 실연동은 billing useCommerceStore 직접 읽기. analytics api 계층 부재, 기준 시각 하드코딩, 4상태 없음 → 데이터 계층은 placeholder 판정.
- **미개발 부분**: [P1·데이터] api/service/data-source 전무·cross-feature 직접 import / [P1·데이터] 활성/신고/도달률/alerts 하드코딩 / [P2·API] fetch*Safe 미적용 / [P2·UI] 4상태·fallback 미구현, 기준 시각 하드코딩 / [P3·데이터] startDate/endDate 미지원 / [P2·DB] 집계 view 미존재·갱신 주기 미정 / [P3·B2C] 내부 전용 노출 미정의.
- **필요 DB 설계**: `needed=true`(view 재사용 우선). `analytics_metric_snapshots`(지표키×기간×시점), `analytics_anomaly_alerts`(이상 징후). 근거: summaryMap/moduleSummaryMap(analytics 전용 mock 없음). B2C: 내부 전용. RPC: 조회 전용(write 불필요), 권장 `analytics_overview_view` 또는 `get_analytics_overview(period, start, end)` 읽기 RPC. 진짜 원본은 billing/message/users/community 집계 — view 재사용 우선.
- **개발 계획**: 1.원본 집계 전략 결정(스냅샷 vs view·갱신 주기) → 2.analytics service/data-source 계층 신설(cross-feature import 제거) → 3.페이지 service 계약 리팩터(4상태·fallback) → 4.DB 테이블·인덱스·RLS(또는 view) → 5.적재 경로(배치/cron 또는 view) → 6.mock→supabase 스위치 → 7.문서 동기화.
- **감사 로그 / 리스크 / 미확정**: 조회 전용 — 감사 불필요(원본 도메인 타입 재사용·alerts 딥링크 `?targetType=&targetId=` 보강 필요). 리스크: 자체 스냅샷 시 원본과 이중 소스(개념 중복 위반)·view 우선 권장, billing mock store 직접 읽기로 실 결제와 따로 놂, 기준 시각 제거 시 빈 결과(empty 처리), 갱신 주기 미정, 네임스페이스 미등록. 미확정: 지표 원본/정의, 갱신 주기(실시간/배치), 신설 vs view, 임의 기간 지원, alerts 규칙 편집 가능 여부, B2C 노출, 네임스페이스.

---

### 3.10 System (관리자/권한/메타데이터/감사/시스템 로그)

#### 관리자 계정 `/system/admins` — mock-only
- **현재 상태**: 요약·검색·정렬·상세 Modal 조회형 완성. **mock-only**(usePermissionStore initialAdmins 5건). 생성/수정/삭제 UI 없음(권한 변경은 /system/permissions). admin_accounts 테이블 0건. 딥링크 `targetType=Admin`(계약 `AdminAccount`).
- **미개발 부분**: [P1·데이터·DB·API] mock-only·admin_accounts 테이블 부재·read 서비스 없음(실 role은 v13 profiles.app_role) / [P2·UI·감사·권한] CRUD UI 부재, Target Type Admin/AdminAccount 불일치·미등록, 한글 상태값 / [P1] 세션 1명만 실데이터.
- **필요 DB 설계**: `needed=true`(또는 profiles 뷰). `admin_accounts`(계정 레지스트리·user_id→profiles FK·role_key/status), `admin_account_permissions`(오버라이드, 또는 text[] 단일 컬럼), 감사는 admin_audit_logs 재사용. 근거: permission-store initialAdmins/permission-types. B2C: 내부 전용. RPC: `admin_upsert_admin_account`/`admin_set_admin_account_status`/`admin_set_admin_permissions`.
- **개발 계획**: 1.소유권/계약 결정(신규 테이블 vs profiles 뷰) → 2.read 서비스 facade 신설(시드 mock 이전) → 3.테이블+제약 → 4.인덱스+RLS → 5.읽기 supabase 전환 → 6.조치 RPC+쓰기 전환 → 7.조치 UI 배선 → 8.감사 Target Type 정합(AdminAccount) → 9.문서 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type=`AdminAccount`(adminId, 현 코드 Admin·계약 등록 필요). 리스크: 명명 불일치 역추적 깨짐, profiles와 role 이중 소스, 한글 상태값, /system/permissions와 store 공유·책임 중복, adminId 문자열→uuid 매핑. 미확정: 계정 SoT(테이블 vs 뷰), 초대/회수 정책, Target Type, role 매핑, 오버라이드 정규화, 화면 책임 경계.

#### 권한 관리 `/system/permissions` — mock-only
- **현재 상태**: 4카드·권한 부여/수정/회수 Modal·상세·딥링크 완전 동작. **mock-only**(permission-types 정적 카탈로그 + store 메모리). **P0 모순**: 실 인가 SoT는 v13 profiles.app_role(4값)이고 화면 5 RoleKey+37 permission은 메뉴 게이팅용 클라 번들 — 화면 부여/회수가 실 권한에 반영 안 됨. 라이브에 system_roles/system_permissions 없음. 감사도 store 메모리만.
- **미개발 부분**: [P0·권한] 실 RBAC 불일치(부여/회수 무효) / [P1·데이터·감사·API] mock-only, admin_audit_logs 미연동, service facade 부재 / [P1·UI] CURRENT_ACTOR 하드코딩 / [P2·UI·데이터] 회수 2차 확인 없음, 4상태 미구현, 카탈로그 미코드테이블화·한글 status / [P3·B2C] 내부 전용 미등록.
- **필요 DB 설계**: `needed=true`(RBAC SoT 결정 종속, 후자면 false). `system_permissions`/`system_roles`/`system_role_permissions`(카탈로그), `system_admin_permissions`(계정별 할당·admin_user_id→profiles.id). 감사는 admin_audit_logs(Target Type=Admin). 근거: permission-types/permission-store. B2C: 내부 전용. RPC: `admin_grant/update/revoke_admin_permissions`. **선결: 화면이 실 RBAC SoT인지 vs profiles.app_role 유일 SoT인지** — 후자면 카탈로그/뷰만 DB화.
- **개발 계획**: 0.**RBAC SoT 결정(선결)** → 1.카탈로그 코드테이블화 → 2.(전자 시)할당 테이블+감사 → 3.RLS+RPC → 4.service facade 신설 → 5.UI 배선(store→service·4상태·actor·2차 확인) → 6.감사 화면 연동 → 7.usage-map/문서.
- **감사 로그 / 리스크 / 미확정**: Target Type=`Admin`(adminId, 정식 등록 또는 SystemAdmin 통일). 리스크: 권한 변경 착각(실 인가 미반영), 이중 SoT 공존 붕괴, profiles DDL 금지, actor 하드코딩, adminId 문자열. 미확정: 화면=실 RBAC SoT 여부, app_role↔RoleKey 매핑, 계정별 vs role 단위, 승인 절차, Target Type, status 정규화, adminId↔uuid 매핑.

#### 메타데이터 관리 `/system/metadata` — hybrid
- **현재 상태**: 요약·검색·트리 Drawer·그룹/항목 CRUD·토글·삭제·드래그 정렬·딥링크 완전 구현. **surface별 분기**: 메타데이터 그룹/항목은 **mock-only**(system-metadata-store), 임베드된 AssessmentMasterCatalogSection(topik_writing 주제/태그 마스터)은 **supabase-backed**. 그룹용 admin_audit_logs write 경로 없음(클라 모사).
- **미개발 부분**: [P0·데이터·DB·API] 그룹/항목 mock-only, system_metadata_* 테이블 부재, write가 store mutation / [P1·감사·권한] admin_audit_logs 미적재, 서버 권한 가드 없음 / [P2·B2C·데이터] surface '추정', linkedAdminLocations 중첩 모델링 결정 / [P3·UI] 변경 이력 store 인메모리.
- **필요 DB 설계**: `needed=true`. `system_metadata_groups`(그룹 마스터·manager_type/owner_module/status/sync_status/exposure_status), `system_metadata_group_items`(운영 값·code/label/sort_order/is_default), `system_metadata_admin_locations`(관리자 위치 추적, 또는 jsonb). 근거: system-metadata-store. B2C: 내부 전용. RPC: `admin_save_metadata_group/item`/`admin_toggle_..._status`/`admin_delete_metadata_item`/`admin_reorder_metadata_items`. facade는 이미 표준(구현 교체만).
- **개발 계획**: 1.테이블/제약 설계(unique·is_default 단일성) → 2.마이그레이션(migrations-admin) → 3.RLS+시드 → 4.쓰기 RPC 6종 → 5.supabase 서비스+스위치 → 6.UI 배선 검증 → 7.감사 실연동+무변경 게이트 → 8.usage-map/SoT 동기화.
- **감사 로그 / 리스크 / 미확정**: Target Type=`SystemMetadataGroup`(groupId, 항목 조치도 그룹 단위, AuditLogLink 배선됨). 리스크: 중첩 배열 정규화 시 정렬/기본값 재현, META-GRP- 자연키→uuid 호환(code 보존), 같은 페이지 mock/supabase 두 SoT 공존, 감사 화면 mock, 클라 권한만. 미확정: PK uuid vs 자연키, admin_locations 정규화 vs jsonb, 이력 통합 vs 전용 테이블, 권한 매핑, surface B2C 위치, 시드 분산, 추가 무결성.

#### 감사 로그 `/system/audit-logs` — mock-only
- **현재 상태**: 검색·요약·정렬·상세·원본 딥링크·3상태 완성. **100% mock** — permission/coupon/metadata 3 store audits + 하드코딩 4행 병합. **결정적**: 라이브 `admin_audit_logs` 실테이블 존재·11개 write RPC가 적재 중인데 화면이 안 읽음(베이스라인 기지 갭). 읽기 경로(select RPC/뷰) 라이브에 없음.
- **미개발 부분**: [P0·데이터] 실 admin_audit_logs 미읽음(증적 기능 미수행) / [P0·API] 읽기 경로(select RPC/뷰) 부재 / [P1·API] data-source 스위치 없음 / [P1·감사] Target Type 불일치(RPC PascalCase vs 페이지 레거시 별칭) / [P1·UI] diff/payload 미노출, admin_user_id→표시명 미정 / [P2·UI] 페이지네이션 없음·클라 필터 / [P3·권한] 가드 미확인.
- **필요 DB 설계**: `needed=false` — admin_audit_logs **라이브 존재·적재 중, 읽기 경로 보강만**. 보강: `admin_list_audit_logs(target_type, target_id, keyword, start, end, limit, offset)` 읽기 RPC 또는 admin select 정책, 조회 인덱스(target_table+target_id, created_at desc), admin_user_id 표시명 조인, target_table 컨트랙트 Target Type 표준화.
- **개발 계획**: 1.읽기 경로 설계 확정(RPC vs RLS+PostgREST) → 2.target_table 정합 매핑 표 작성 → 3.인덱스+읽기 RPC/정책 마이그레이션(무변경 게이트) → 4.데이터소스 스위치 도입 → 5.화면 타입·상세 Modal 확장(diff/payload/actor) → 6.역추적 검증 → 7.문서/usage-map 동기화.
- **감사 로그 / 리스크 / 미확정**: 조회 전용 — 자체 감사 없음(모든 도메인 증적의 단일 소비 화면). 표시 대상 Target Type 전체(User/Instructor/Referral/CommunityPost·Report/Operation·정책·FAQ/Commerce*/Assessment*/Notification/SystemMetadataGroup/Admin 등). 리스크: '구현됨' 착시(실 행 미표시), target_table 불일치 역추적 깨짐, actor uuid 노출, 무페이지네이션 성능, 전역 공유 객체 정책/인덱스 추가 시 무변경 게이트, diff/payload 민감정보. 미확정: admin select 정책 존재 여부, mock 병합 3도메인 실적재 여부, actor 표시명 소스, target_table 표준 집합, diff/payload 노출 범위, 네임스페이스, 권한 가드.

#### 시스템 로그 `/system/logs` — mock-only
- **현재 상태**: 요약·검색·날짜 필터·정렬·상세·컴포넌트 딥링크·4상태 조회형 완성. **mock-only**(고정 4행). Supabase 참조·system_logs DDL 0건. 로그 수집/저장 파이프라인 부재. level/component 필터 UI 없음(파라미터 delete만).
- **미개발 부분**: [P1·데이터] system_logs 테이블·수집 파이프라인 부재(영구 더미) / [P2·API] mock↔Supabase facade 없음 / [P3·UI] level/component 필터 UI·페이지네이션 부재 / [P3·기타] 상태값 대소문자 불일치(코드 INFO vs 문서 info) / [P2·DB] traceId/보존기간 미확정 / [P3·B2C] 내부 전용(의도된 비노출).
- **필요 DB 설계**: `needed=true`. `system_logs`(level CHECK·component·message·trace_id·created_at·context jsonb). 근거: mock-system-logs. B2C: 내부 전용. RPC: write 불필요(조회 전용·적재는 백엔드 service-role), 읽기는 admin select 정책. v13 `notification_log`와 prefix 혼동 금지.
- **개발 계획**: 1.문서 정합/상태값 확정(대소문자·필드 세트·level 코드테이블) → 2.로그 적재 소스 결정(인프라/백엔드) → 3.테이블+제약 → 4.인덱스+RLS → 5.supabase 읽기 서비스+스위치 → 6.UI 필터 배선 보강(선택) → 7.무변경 게이트+스모크.
- **감사 로그 / 리스크 / 미확정**: 조회 전용 — 감사 불필요(보존기간 삭제/마스킹 추가 시 Target Type `SystemLog` 등록). 리스크: 소스 부재 시 빈 화면, 고볼륨(서버 페이징/파티셔닝 필요), notification_log 혼동, 상태값 대소문자, 보존정책 미정. 미확정: 로그 생산/적재 주체, trace_id/status 의미, 레벨 코드값, 보존/파티셔닝/PII, 네임스페이스, IA 필터 요구.

---

## 4. 횡단 관심사 (공통 인프라)

여러 페이지가 공유하는 공통 테이블·계약을 묶어 정리한다. 개별 페이지 작업 전 이 공통 인프라부터 닫아야 중복·불일치를 막을 수 있다.

### 4.1 감사 로그 (`admin_audit_logs`) — 전역 P0/P1 기지 갭
- **현황**: 라이브에 실테이블 존재(`id, admin_user_id, action, target_table, target_id, diff, payload, created_at`), 11개 write RPC(문항·태그마스터·알림 등)가 적재 중. 그러나 **감사 로그 화면(`/system/audit-logs`)이 mock SoT**라 실 행이 화면에 안 보인다.
- **두 갈래 갭**: ① mock-only 도메인(community/operation/commerce/referrals/instructors)은 **조치가 admin_audit_logs에 아예 적재되지 않음**(store/state만 변경). ② supabase-backed 도메인(message/assessment/metadata 일부)은 적재되나 **화면이 안 읽음**.
- **공통 작업**: (a) 감사 화면을 admin_audit_logs 실조회로 전환(읽기 RPC `admin_list_audit_logs` 또는 admin select 정책 + 인덱스). (b) **Target Type 표준화** — UI/RPC/문서가 어긋난 사례 다수: Message↔Notification, Users↔User, Commerce↔CommerceRefund/CommerceProduct, Admin↔AdminAccount, Community↔CommunityPost/CommunityReport. PascalCase 엔티티 단수로 통일하고 계약 목록(admin-action-log.md)에 미등록 타입(AdminAccount/SystemMetadata는 일부 등록, Content/Vocabulary/EPS/LevelTest/Chatbot/Refund/Product 등) 추가. (c) actor `admin_user_id`(uuid)→관리자 표시명 조인. (d) diff/payload 화면 노출(민감정보 범위 정책).
- **표준 역추적 딥링크**: `/system/audit-logs?targetType={TargetType}&targetId={TargetId}`.

### 4.2 권한/관리자 계정 — RBAC SoT 모순
- `/system/admins`(계정)·`/system/permissions`(권한)가 같은 `usePermissionStore` mock을 공유. 실 인가 SoT는 **v13 profiles.app_role(4값)**, 화면은 5 RoleKey+37 permission **클라 게이팅 번들**. **선결 결정**: 화면이 실 RBAC SoT가 될지 vs profiles.app_role 유일 SoT로 두고 화면은 카탈로그/뷰만 둘지. 이 결정 없이 테이블 신설 시 이중 인가 SoT 붕괴.

### 4.3 메타데이터/코드테이블 (`system_metadata_*` + model/*-schema.ts)
- 회원 상태·세그먼트·FAQ surface·쿠폰 범위·역할 템플릿·배지 등급 등 고정 집합 값이 페이지별 하드코딩 또는 store 시드에 산재. 베이스라인 A의 `code table candidate`로 `model/*-schema.ts` 단일 SoT 승격 + 일부는 `system_metadata_*`로 DB화. enum은 ASCII 저장 + 한글 라벨 매핑 분리(현재 한글 코드값 저장 도메인 다수 — operation/commerce).

### 4.4 mock → DB 전환 표준 파이프라인 (베이스라인 B)
모든 신규 도메인은 동일 순서:
1. **소유권/계약 고정** — 네임스페이스(`migrations` 쓰기평가 vs `migrations-admin` 운영) 결정, `shared-supabase-schema-ownership.md` 경계 등록, `npm run db:snapshot --out before.json`.
2. **테이블+제약** — `create table if not exists`, uuid/text PK, timestamptz, **CHECK enum(ASCII)**, FK(v13 비소유는 수신 FK만·DDL 금지).
3. **인덱스** — 조회 축 + 부분 인덱스(`where status=...`), jsonb는 gin.
4. **RLS** — `enable`(+`force`) + **admin select 정책만**, INSERT/UPDATE/DELETE 정책 미생성.
5. **RPC** — `SECURITY DEFINER set search_path`, 가드(unauthenticated→forbidden→reason required) → 검증 → DML → **admin_audit_logs diff/payload 기록** → revoke/grant/comment.
6. **seed** — `on conflict do nothing` 멱등.
7. **down 동시 작성** — `down/<같은이름>.sql`.
8. **적용·검증** — `db:(admin:)migrate:status`→`migrate`→재스냅샷 `--diff --exclude-own --exclude-admin=0`(기존 객체 무변경) + 도메인 스모크.
- **service 계약 불변**: page는 `fetch*Safe/create*Safe/...`만 호출(`{ok,data,error}`), data-source 스위치(`resolve*DataSource` 또는 `isSupabaseConfigured`)로 mock↔supabase 전환. JSON fixture fallback 금지.

### 4.5 v13 비소유 테이블 경계
- `profiles`·`payment_history`·`study_events`·`subscriptions`·(존재 시)community/instructors 등은 v13 소유 → **DDL 변경 금지**, 읽기 RPC/뷰·수신 FK만. 결제/환불은 v13 도메인이라 신규 테이블보다 reconcile 우선. `get_admin_users`/`admin_set_user_status`는 라이브 미배포 의혹 → 배포·소유권 확인 선행.

---

## 5. 우선순위 로드맵

의존성과 severity 기반 단계 묶음. **placeholder 신규 트랙**(Content 6·EPS·레벨테스트·이커머스·챗봇)은 기획 선결이 공통 블로커라 별도 분리.

### Phase 0 — 공통 인프라 / 차단 결함 (선행, 다른 모든 작업의 전제)
- **선행조건**: 없음(즉시 착수 가능 항목 + 오너 결정 항목 혼재).
- **포함**:
  - `get_admin_users`/`admin_set_user_status` RPC 소유권·라이브 배포 규명(회원 목록·상세 P0 런타임 실패 원인).
  - 감사 로그 화면 실 `admin_audit_logs` 연동 + 읽기 RPC/인덱스 + **Target Type 표준화 매핑 표**(§4.1).
  - **신고 관리 조치 의미 버그 선수정**(mock 단계 hidePost/정지 배선) — 데이터 손상 확대 방지.
  - RBAC SoT 결정(§4.2) — 권한/관리자 계정 작업의 선결.
  - 대시보드 "분석 보기" 깨진 링크 수정(저위험 즉시).
- **산출물**: RPC 배포 확인 문서, audit-logs 읽기 마이그레이션, Target Type 정합 매핑, 신고 조치 패치.

### Phase 1 — mock-only 핵심 운영 도메인 DB 전환 (P0 다수, 단독 전환 가능)
- **선행조건**: Phase 0(감사 표준·소유권 등록·전환 파이프라인 §4.4).
- **포함(도메인별 신규 테이블+RLS+RPC+스위치)**:
  - **community**(게시글·신고) — v13 소유 테이블 충돌 확인 후.
  - **operation**(공지·FAQ·이벤트·정책) — operation 네임스페이스 등록 선행.
  - **commerce**(쿠폰·포인트·환불) — commerce 네임스페이스/tracker 결정, 포인트는 **서버측 잔액 계산** 필수.
  - **users 보강**(관리자 메모 테이블+RPC, 강사 instructors 3종, 추천인 referrals 3종) — 단, 추천인은 **정책 동결 선행**.
  - **system 메타데이터**(system_metadata_* DB화), **시스템 로그**(적재 소스 결정 후 system_logs).
- **산출물**: 도메인별 마이그레이션(테이블→인덱스→RLS→RPC→seed+down), supabase 서비스+data-source 스위치, 감사 실연동.

### Phase 2 — supabase-backed 도메인 보강 (P1, DB 신규 불필요)
- **선행조건**: Phase 0(감사 표준).
- **포함**:
  - **message** 전반 — 감사 Target Type 정렬(Message→Notification/엔티티 분리), 대상 그룹 인원 산정 RPC + save diff, 발송 이력 서버 필터/재시도 RPC, push seed/전달 파이프라인(외부 종속).
  - **assessment 문항** — 수신 적재 RPC(question_received, D-11 종속), v13 사용자 화면 신규 스키마 소비 전환.
  - **billing 결제/환불** — 문서 정합, 환불 write 실DB 승격 결정.
- **산출물**: 보강 RPC/인덱스 마이그레이션, 파이프라인 배선(일부 인프라/백엔드 종속).

### Phase 3 — 집계·통계 (후행 의존)
- **선행조건**: Phase 1(원본 도메인 supabase 전환 완료 — commerce/community/system).
- **포함**: **대시보드** 집계 view/RPC + feature 데이터 계층, **analytics 통계 개요** view 재사용/스냅샷 + 4상태 리팩터.
- **산출물**: 읽기 집계 view 또는 `get_admin_dashboard_summary`/`analytics_overview_view`, cross-feature import 제거.

### 별도 트랙 A — Placeholder 신규 구축 (기획 선결 블로커)
- **공통 선결**: 데이터 계약·상태값·Target Type·네임스페이스·B2C 노출 구조 확정(전부 미확정).
- **포함**:
  - **Content 6페이지**(콘텐츠/배지/단어장/소나기/객관식/미션) — `src/features/content` 신규, 단어장이 소나기·객관식의 부모이므로 **단어장 우선**, 미션 보상은 배지·포인트 의존.
  - **EPS TOPIK** — 문항 풀 출처(EPS 전용 vs topik_writing 재사용) 결정 후.
  - **레벨 테스트** — 점수 산식·결과 코드·추천 콘텐츠(Content 모듈 의존) 확정 후.
  - **이커머스 관리(commerce/store)** — 상품 유형/판매 정책 확정 후, sales_count는 결제 도메인 의존.
  - **챗봇 설정** — 응답 모드(룰/LLM/하이브리드)·전환 기준 확정 후, operation 도메인 전환 로드맵과 정렬.
- **각 단계 산출물**: 기획 계약 문서 → mock/types/schema/service facade → placeholder→실 UI → DB 마이그레이션 → RPC+감사 → supabase 스위치 → B2C 동기화.

### 별도 트랙 B — 외부 종속 (오너/외부 회신 게이트)
- 알림 발송/전달 파이프라인(cron·provider·동의 H-2), 외부 공급 API 계약(D-11), v13 사용자 화면 신규 스키마 컷오버, B2C 노출 위치 합의(다수 '운영상 추정'/'노출 예정' 승격).

---

## 6. 미확정 항목 종합 (결정 주체 필요)

### 공통/횡단
- **감사 Target Type 표준** — UI/RPC/문서 불일치 다수(Message↔Notification, Users↔User, Commerce↔CommerceRefund/Product, Admin↔AdminAccount, Community↔CommunityPost/Report). PascalCase 단수 통일 + 계약 목록 신규 등록.
- **mock-only 도메인 네임스페이스** — operation/commerce/content는 `migrations` vs `migrations-admin` 어디에도 미등록. 신규 tracker 필요 여부.
- **enum 한글 vs ASCII 저장** — operation(공지/FAQ/이벤트/정책)·commerce(쿠폰/포인트)·system(관리자 status)이 한글 코드값 사용. ASCII 승격 시 페이지 전반 라벨 매핑 동기화 범위.
- **감사 화면 실데이터 전환 시점/담당** — 다수 페이지가 이 후속에 역추적 완결을 의존.

### Users
- get_admin_users/admin_set_user_status DDL·권한·라이브 배포 상태·보강 주체. 관리자 메모 네임스페이스(admin vs v13). subscriptions source. 탈퇴(deleted) 의미·B2C 가드. plan_label 값 도메인. IP/커뮤니티 탭 원천.

### Users(강사/추천인)
- 강사=profiles.app_role subtype vs 별도 엔티티(§13). course 도메인 존재. 추천인 정책 4종(확정 시점·보상 수단·회수 규칙·수동보정 권한) — 최대 블로커. reward_method↔포인트 원장 연동.

### Community
- v13 B2C 소유 community 테이블 존재 여부. 신고 처리 시 게시글/사용자 실전이 여부(의도 vs 버그). Target Type 3자 SoT. 삭제 물리/soft. memo type↔policy_code 통합. author_id FK.

### Message
- 토큰 치환 위치·body_json 스키마·variables 저장. Target Type 통일 방향. push 토큰 저장소 소유(admin vs B2C)·provider 선정. 발송/cron/재시도 주체(외부). 조건 그룹 filters→profiles SQL 계약. B2C 수신함/푸시 위치.

### Operation
- 네임스페이스. id 자연키 vs uuid. 예약 게시·soft delete. 정책 코드값 한글/ASCII·requires_consent 트리거·B2C 위치. FAQ surface B2C·지표 이벤트 소스. 이벤트 reward_policy FK·participantCount 소스·랜딩. 챗봇 응답 모드·버전 정책·handover 대상·Target Type.

### Billing/Commerce
- payment_history method 컬럼 추가 주체. admin 결제 write 비목표 여부. 환불 신규 엔티티 vs v13 확장·결제 동기화 권한. 쿠폰 네임스페이스/PK/발급·사용 원장·외부 도메인 소스·cron. 포인트 enum/PK/지갑 SoT·차감 우선순위·환불 복구·소멸 cron·승인 체계. 이커머스 상품 유형/상태·packages 모델·sales_count 소스·Target Type.

### Assessment
- 외부 공급 API 페이로드/식별자(D-11). v13 사용자 화면 소비 전환 시점. EPS 문항 풀 출처·발행/롤백·Target Type. 레벨 테스트 산식·결과 코드·추천 콘텐츠 식별자(Content 의존)·Target Type.

### Content (6페이지)
- v13 기존 콘텐츠 테이블 존재 여부. 콘텐츠 유형/상태/난이도 값·자산 저장·검수-발행 분리. 단어장 level/language enum·노출 게이트·대량 등록. 소나기 템플릿 구조. 객관식 보기 모델(자식 vs JSONB)·정답 검증. 배지 획득 조건(수동/자동)·등급. 미션 달성 계산·보상 트리거·배지/포인트 연동. **전 페이지 Target Type 문서 불일치**(엔티티명 vs Content). content 네임스페이스/tracker.

### Analytics
- 지표 원본/정의·갱신 주기(실시간 vs 배치)·신설 vs view 재사용·임의 기간 지원·alerts 규칙 편집 가능 여부·네임스페이스.

### System
- **RBAC SoT**(화면 vs profiles.app_role) — 권한/관리자 계정 전제. app_role↔RoleKey 매핑. 관리자 계정 SoT(테이블 vs 뷰)·초대/회수. 메타데이터 PK·admin_locations 정규화·이력 통합. 감사 admin select 정책 존재·mock 병합 3도메인 실적재 여부·actor 표시명 소스·target_table 표준. 시스템 로그 적재 소스·trace_id 의미·레벨 코드값·보존/PII 정책.