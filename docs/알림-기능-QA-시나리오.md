# 알림(Notification) 기능 QA 시나리오

| 항목 | 내용 |
| --- | --- |
| 버전 | rev1 (2026-06-12) |
| 상태 | 초안 — 알림 기능 구현 완료(실행계획안 Phase 4) 시점에 실행 |
| 기준 계획 | [`docs/알림-기능-개발-실행계획안.md`](./알림-기능-개발-실행계획안.md) |
| 화면 기준 | v13 `docs/Wireframe/31-X-09-notification-settings/`, `04-B-01-home-dashboard/` description.md |
| 실행 방법론 | v13 `docs/qa/qa-execution-plan.md` rev6 규칙 준수 (브라우저 직접 조작 + 자동 테스트 + 증거 기록) |
| 증적 위치 | `logs/notification-feature-evidence.md` + 스크린샷 (`docs/qa/reports/` 패턴) |

---

## 1. 판정 규칙

v13 QA 실행계획 rev6의 규칙을 그대로 따른다.

- **PASS / FAIL / UNVERIFIED**: 하이드레이션(실제 화면 동작)이 증명되지 않은 캡처로는 판정하지 않는다. UNVERIFIED는 통과로 집계하지 않는다.
- **출처 라벨**: 각 시나리오의 기대 결과 출처를 `[SPEC]`(와이어프레임/계획안 정의) / `[CODE]`(코드 구현 확인) / `[STD]`(표준 사용성·업계 관행)로 표기한다. 어느 출처에도 기대 동작이 없으면 결함이 아니라 **스펙 갭(UNDEFINED)**으로 기록하고 계획안 미결정 사항(O-*)으로 에스컬레이션한다.
- **실사용 경로 원칙**: 직접 URL 진입은 스모크 용도. 시나리오는 실제 사용자/관리자 경로(로그인 → 메뉴 → 화면)로 수행한다.
- **우선순위**: `P0` = 게이트 차단(미통과 시 해당 Phase 종료 불가), `P1` = 출시 전 필수, `P2` = 권장.
- **게이트 매핑**: 각 시나리오는 실행계획안 §8의 게이트(V-0~V-6)에 귀속된다.

## 2. 검증 환경과 시드 계정

- 로컬 Supabase 인스턴스 1개에 v13(사용자 화면)과 topik-ai(관리자 화면)를 함께 연결한다.
- 시스템 알림(파이프라인·인앱) 검증은 **v13 작업 공간에서 v13 앱을 직접 구동**하며 수행한다 (계획안 §7.0).
- production URL에서는 절대 실행하지 않는다 (v13 시드 가드 준수).

| 계정 | 용도 | 설정 상태 |
| --- | --- | --- |
| `admin-tester` | 관리자 발송·운영 | topik-ai 로그인, message 권한 보유 |
| `admin-limited` | 권한 경계 검증 | 알림 관련 permissionKeys 없음 |
| `user-optin` | 표준 수신자 | 전 유형 on, in_app+email on, timezone `Asia/Seoul`, reminder 설정 |
| `user-optout` | 미수신 검증 | 전 유형 off (변형: 채널만 전부 off) |
| `user-vn` | timezone 검증 | timezone `Asia/Ho_Chi_Minh`, reminder 설정 |
| `user-dst` | DST 엣지 검증 | timezone `America/New_York` (DST 있는 지역) |
| `user-partial` | 유형 매트릭스 | 유형별 on/off 혼합 (예: feedback_ready만 on) |
| `user-fresh` | 신규 row 호환 | `notification_settings` row 없음 / `channels`에 `in_app` 키 없는 기존 row |

## 3. 시나리오 ID 체계

`N-SET`(사용자 설정) · `N-INB`(인앱 수신함) · `N-DSH`(대시보드 카드) · `N-SCH`(스케줄 발송) · `N-TRG`(트리거 발송) · `N-ADM`(관리자 운영) · `N-OPT`(수신 제어) · `N-EML`(이메일) · `N-SEC`(보안/권한) · `N-PERF`(성능) · `N-REG`(회귀) · `N-EDGE`(조사 기반 엣지)

---

## 4. 사용자 알림 설정 (X-09) — N-SET

| ID | P | 시나리오 (상황 + 경로) | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-SET-01 | P0 | user-optin 로그인 → 대시보드 → 설정 → 알림 설정 진입 | 저장된 채널/토글/시간/요일이 정확히 표시, 설정 메뉴 활성 | [SPEC] | V-6 |
| N-SET-02 | P0 | 변경 없이 화면 체류 | 저장 CTA 비활성 | [SPEC] | V-6 |
| N-SET-03 | P0 | 토글 1개 변경 → 저장 → 새로고침 | dirty 시 저장 활성 → 성공 토스트 → 재진입 시 변경값 유지 | [SPEC] | V-6 |
| N-SET-04 | P1 | 저장 클릭 직후 연타 | 중복 요청 차단(버튼 잠금), 단일 저장만 발생 | [SPEC] | V-6 |
| N-SET-05 | P1 | 변경값 있는 상태에서 다른 메뉴 클릭/새로고침 | 이탈 확인 표시, 취소 시 입력 보존 | [SPEC] | V-6 |
| N-SET-06 | P0 | 이메일·Zalo·인앱 채널 모두 off | "수신 채널 없음" 안내 + 리마인더 시간/요일 입력 비활성 | [SPEC] | V-6 |
| N-SET-07 | P1 | Zalo 탭 진입 | "준비 중/미연동" 표시, 발송 가능 상태로 표현되지 않음 | [SPEC] | V-6 |
| N-SET-08 | P1 | 시간 입력 후 저장 → DB 확인 | `HH:mm[:ss]` 저장, 요일은 0–6 정수(0=일요일) | [SPEC] | V-6 |
| N-SET-09 | P1 | 설정 로드 실패 강제(네트워크 차단 후 진입) | 오류 Alert + 재시도 제공, 화면 갇힘 없음 | [SPEC] | V-6 |
| N-SET-10 | P1 | 저장 직전 네트워크 차단 → 저장 | 오류 토스트 + 입력값 보존(재시도 가능) | [SPEC] | V-6 |
| N-SET-11 | P1 | (O-8 확정 후) 새 토글 exam_schedule/notice 표시·저장 | 신규 키가 `notification_prefs`에 저장, 기존 3종과 충돌 없음 | [SPEC] | V-6 |
| N-SET-12 | P0 | user-fresh(기존 row, `in_app` 키 없음)로 진입 | in_app 채널이 **기본 on**으로 해석·표시 (missing=true 계약) | [SPEC] | V-0 |
| N-SET-13 | P1 | 발송 이력 0건/5건/6건 이상 상태 각각 확인 | 빈 상태 표시 / 5건 표시 / 최신 5건만 표시 | [SPEC] | V-6 |
| N-SET-14 | P2 | 베트남어 UI 로케일로 전환 후 알림 설정 사용 | 안내 문구·날짜 로케일 표기 정상 | [STD] | V-6 |

## 5. 인앱 알림센터 — N-INB

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-INB-01 | P0 | 미읽음 0건 상태에서 헤더 확인 | 뱃지 미표시 (읽음 처리 가능할 때만 카운트 노출) | [STD] | V-2 |
| N-INB-02 | P0 | 새 알림 도착 후 헤더 확인 | 뱃지 카운트 +1, 정확한 수 | [SPEC] | V-2 |
| N-INB-03 | P2 | 미읽음 100건 이상 시드 | 뱃지 "99+" 상한 표기 | [SPEC] | V-2 |
| N-INB-04 | P0 | 수신함 열기 | 최신순 정렬, 미읽음은 점 표시+배경으로 구분(색상 외 보조 단서 포함) | [SPEC][STD] | V-2 |
| N-INB-05 | P0 | 미읽음 알림 클릭 | `read_at` 기록 → 뱃지 감소 → `link_url`로 이동 | [SPEC] | V-2 |
| N-INB-06 | P0 | "모두 읽음" 클릭 | 전체 read 처리, 뱃지 0, 목록 시각 상태 갱신 | [SPEC] | V-2 |
| N-INB-07 | P0 | 모두 읽음 후 재로그인/새로고침 | **뱃지 잔류(stuck badge) 없음** — 카운트 0 유지 | [STD] | V-2 |
| N-INB-08 | P1 | 알림 0건 계정으로 수신함 열기 | 빈 상태 안내 표시 | [SPEC] | V-2 |
| N-INB-09 | P1 | 수신함 로드 실패 강제 | 오류 상태 + 재시도, 화면 갇힘 없음 | [SPEC] | V-2 |
| N-INB-10 | P1 | 두 탭(또는 두 기기)에서 동시 로그인 → 한쪽에서 읽음 처리 | 다른 쪽도 갱신 주기(폴링/Realtime) 내 카운트 동기화, 영구 불일치 없음 | [STD] | V-2 |
| N-INB-11 | P1 | 읽음 처리 직전 네트워크 차단 → 클릭 | 낙관적 UI가 실패 시 롤백되거나 오류 표시 — 서버와 화면 상태 불일치 잔존 금지 | [STD] | V-2 |
| N-INB-12 | P1 | `link_url`이 삭제된 리소스(삭제된 첨삭 등)를 가리키는 알림 클릭 | 안내/404 페이지로 유도, 무한 로딩·빈 화면 금지 | [STD] | V-2 |
| N-INB-13 | P0 | 본문에 `<script>`/HTML 태그가 포함된 알림 표시 | 이스케이프되어 텍스트로 표시, 스크립트 실행 0건 | [STD] | V-0·V-2 |
| N-INB-14 | P2 | 제목 100자/본문 500자 알림 | 말줄임/줄수 제한으로 레이아웃 붕괴 없음 | [STD] | V-2 |
| N-INB-15 | P2 | 베트남어 본문(성조 문자) 알림 | 정상 렌더링, 깨짐 없음 | [STD] | V-2 |

## 6. B-01 홈 대시보드 알림 카드 — N-DSH

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-DSH-01 | P0 | 알림 7건 보유 계정으로 대시보드 진입 | **카드 최대 5건만** 표시 (와이어프레임 제약) | [SPEC] | V-2 |
| N-DSH-02 | P1 | 유형 혼합(시험 일정/리마인더/학습 알림) 시드 | category별 구분 표시 | [SPEC] | V-2 |
| N-DSH-03 | P2 | UI 로케일 변경 후 확인 | 날짜 표기 로케일 적용 | [SPEC] | V-2 |
| N-DSH-04 | P1 | 카드 클릭 / 영역의 설정 진입 클릭 | 카드는 `link_url`, 설정 진입은 X-09로 이동 | [SPEC] | V-2 |
| N-DSH-05 | P1 | 알림 로드 실패 강제 | 재시도 + 설정 이동 CTA 표시 (와이어프레임 예외 정의) | [SPEC] | V-2 |
| N-DSH-06 | P1 | 알림 0건 계정 | 빈 상태 표시, 영역 레이아웃 유지 | [SPEC] | V-2 |

## 7. 스케줄 발송 파이프라인 — N-SCH

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-SCH-01 | P0 | user-optin의 reminder 슬롯 도래 | cron 주기 이내에 in_app 1건 도착, dispatch 1건 + delivery attempt `sent` 기록 | [SPEC] | V-1 |
| N-SCH-02 | P0 | 같은 슬롯에서 Edge Function 수동 재실행 | **신규 dispatch·attempt 0건** (dispatch/attempt dedupe_key unique) | [SPEC] | V-1 |
| N-SCH-03 | P0 | Edge Function 2개 동시 실행(겹침 강제) | 중복 발송 0건 — 동시성에서도 idempotency 유지 | [STD] | V-1 |
| N-SCH-04 | P0 | user-optin(Seoul)과 user-vn(Ho Chi Minh)에 같은 `09:00` 설정 | 각자 **현지 시각** 09:00 슬롯에 수신 (2시간 차) | [SPEC] | V-1 |
| N-SCH-05 | P1 | reminder `23:55` 설정, 날짜 경계 교차 슬롯 | 요일 판정이 사용자 timezone 기준 날짜로 정확 (UTC 날짜로 어긋나지 않음) | [STD] | V-1 |
| N-SCH-06 | P1 | reminder_days `[0]`(일요일만) 설정 | 일요일에만 발송 — 0=일요일 계약 일치, 다른 요일 0건 | [SPEC] | V-1 |
| N-SCH-07 | P1 | weekly_summary on 사용자 1주 관찰(또는 시간 조작) | 주 1회 고정 슬롯에만 발송, 주중 중복 0건 | [SPEC] | V-1 |
| N-SCH-08 | P1 | 슬롯 10분 전 reminder 시간 변경 | 다음 슬롯부터 새 시간 반영, 옛 시간으로 발송 안 됨 | [STD] | V-1 |
| N-SCH-09 | P0 | reminder 설정 사용자를 탈퇴/삭제 → 슬롯 도래 | 발송 0건, Edge Function 오류 없음 (FK cascade로 정리 확인) | [CODE] | V-1 |
| N-SCH-10 | P1 | 템플릿을 '비활성'으로 바꾼 뒤 슬롯 도래 | 발송 0건 (비활성 템플릿 미발송 정책) | [SPEC] | V-1 |
| N-SCH-11 | P1 | cron 2회차 분량 다운타임 후 재가동 | **과거 슬롯 소급 폭주(알림 스톰) 없음** — 정책 미정 시 UNDEFINED로 기록하고 O-* 에스컬레이션 | [STD] | V-1 |
| N-SCH-12 | P1 | user-fresh(설정 row 없음) 상태에서 cron 실행 | 대상 산정에서 제외, 오류 없음 | [CODE] | V-1 |

## 8. 트리거 발송 (feedback_ready) — N-TRG

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-TRG-01 | P0 | user-optin이 쓰기 답안 제출 → AI 첨삭 완료 | 첨삭 완료 직후 in_app `feedback_ready` 1건, 클릭 시 해당 피드백 화면 이동 | [SPEC] | V-1 |
| N-TRG-02 | P0 | user-partial(`feedback_ready` off)이 첨삭 완료 | 발송 0건 | [SPEC] | V-4 |
| N-TRG-03 | P0 | 같은 첨삭 완료 이벤트 재처리(재시도 강제) | 중복 알림 0건 (이벤트 단위 dedupe_key) | [SPEC] | V-1 |
| N-TRG-04 | P1 | 답안 2건 연속 제출 → 첨삭 2건 완료 | 알림 정확히 2건, 각각 올바른 피드백으로 링크 | [CODE] | V-1 |

## 9. 관리자 운영 (topik-ai) — N-ADM

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-ADM-01 | P0 | admin-tester 로그인 → 메시지 메뉴 → 템플릿 등록(필수값 누락 시도 포함) | 필수값 검증 동작, 등록 성공 시 목록 반영 + `admin_audit_logs` 기록 + AuditLogLink 동작 | [SPEC][CODE] | V-3 |
| N-ADM-02 | P0 | 등록한 행 클릭 → 본문 작성 → 미리보기 | 본문 저장, 미리보기 HTML 정상 렌더 | [CODE] | V-3 |
| N-ADM-03 | P0 | 변수 포함 본문(`{{display_name}}` 등) 발송 → 수신 확인 | 실제 값 치환. **결측 변수는 fallback 문구로 대체** — `{{변수명}}` 원문 노출 0건 | [STD] | V-3 |
| N-ADM-04 | P1 | 활성↔비활성 토글 (사유 미입력 시도 포함) | 사유 필수, 변경 후 감사 로그 기록 | [CODE] | V-3 |
| N-ADM-05 | P1 | 템플릿 삭제 (사유 입력) | 목록 제거 + 감사 로그, 진행 중 발송 영향 없음 | [CODE] | V-3 |
| N-ADM-06 | P1 | 그룹 생성(정적/조건 기반) → 인원 미리보기 | 조건에 맞는 인원 수 표시, 저장 후 발송 그룹 선택 가능 | [CODE] | V-3 |
| N-ADM-07 | P1 | 0명 그룹으로 발송 시도 | 사전 안내/차단 — 빈 발송이 '완료 0건'으로 조용히 성공하지 않음 | [STD] | V-3 |
| N-ADM-08 | P0 | **나에게 보내기** 실행 | 관리자 본인 계정에서 수신 확인(인앱/이메일), 실수신자 발송 0건 | [SPEC] | V-3 |
| N-ADM-09 | P0 | **즉시 발송 실행 → 사용자 수신 확인** (계획안 §8.3 12단계 전체) | §8.3 표의 #1~#10 전 단계 PASS | [SPEC] | V-3 |
| N-ADM-10 | P0 | **예약 발송** 등록(5분 후) | 예약 시각 전 미발송 → 도래 후 발송 → 이력 '예약'→'완료' 전이 | [SPEC] | V-3 |
| N-ADM-11 | P1 | 예약 발송 취소(기능 존재 시) | 취소 후 발송 0건. 기능 없으면 UNDEFINED → 스펙 갭 등록 | [STD] | V-3 |
| N-ADM-12 | P0 | 발송 후 이력 화면 확인 | 목록 = dispatch 단위(상태 전이 포함), 상세 drawer에서 **대상 수 = sent+failed+skipped+opted_out** 집계와 수신자별 상태·실패/제외 사유 표시 | [SPEC] | V-3 |
| N-ADM-13 | P1 | 발송 등록과 발송 집행 사이 그룹 인원 변동 | 집계 기준 시점이 일관(발송 시점 평가), 이력 수치 불일치 없음 | [STD] | V-3 |
| N-ADM-14 | P0 | admin-limited 계정으로 메뉴/RPC 접근 | 메뉴 미노출 + RPC 직접 호출 거부 | [CODE] | V-0 |
| N-ADM-15 | P1 | env를 mock으로 전환 후 message 화면 사용 | mock 모드 정상 동작(회귀 없음), supabase 모드와 명확히 분리 | [SPEC] | V-6 |

## 10. 수신 제어 / opt-out — N-OPT

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-OPT-01 | P0 | user-optout 대상 포함 그룹에 learning/marketing 발송 + 스케줄/트리거 발생 | **수신 0건** — delivery attempt가 `sent`로 생성되지 않고 `skipped`/`opted_out`으로 집계됨 (계획안 §4.1) | [SPEC] | V-4 |
| N-OPT-02 | P0 | 채널만 전부 off인 변형 계정 | 스케줄/트리거 발송 0건, 제외 집계 동일 | [SPEC] | V-4 |
| N-OPT-03 | P0 | user-partial 유형 매트릭스(각 유형 on/off 조합) | off 유형만 정확히 미수신 — 유형 간 누수 없음 | [SPEC] | V-4 |
| N-OPT-04 | P0 | 마케팅 비동의 사용자 포함 그룹에 marketing 발송 | 비동의자 `opted_out` 집계·미발송, 동의자만 수신 (O-7 결정 반영) | [SPEC] | V-4 |
| N-OPT-05 | P1 | 발송 실행과 집행 사이에 사용자가 opt-out으로 변경 | **집행 시점 평가**로 미수신 — 발송 큐에 남은 옛 설정으로 발송되지 않음 | [STD] | V-4 |
| N-OPT-06 | P1 | 운영 공지성 알림(exam_schedule/notice)의 class 정책 확인 | 계획안 §4.1 정책대로 동작 — 비필수 operational은 pref 존중, mandatory만 in_app 강제 | [SPEC] | V-4 |
| N-OPT-07 | P0 | **mandatory operational 템플릿 발송** (pref off 사용자 포함 그룹) | pref off 사용자도 in_app 수신. bypass가 감사 로그에 template class·mandatory·bypass_reason·actor와 함께 기록 | [SPEC] | V-4 |
| N-OPT-08 | P0 | **marketing 템플릿에 `mandatory=true` 저장 시도** | UI·RPC·DB CHECK 모든 층에서 거부 | [SPEC] | V-0·V-4 |

## 11. 이메일 채널 — N-EML

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-EML-01 | P0 | email on 사용자에게 발송 → Inbucket/sandbox 확인 | 수신, 제목·본문 변수 정확히 렌더링 | [SPEC] | V-5 |
| N-EML-02 | P0 | display_name 없는 사용자에게 발송 | fallback 문구 — `{{name}}` 원문/빈칸 인사말 노출 0건 | [STD] | V-5 |
| N-EML-03 | P1 | 매우 긴 이름(50자)·특수문자·베트남어 문자 데이터 | 렌더링 깨짐·인코딩 오류 없음 | [STD] | V-5 |
| N-EML-04 | P1 | 본문 링크 클릭 | 올바른 v13 페이지 도착 (로그인 필요 시 로그인 후 목적지 보존) | [STD] | V-5 |
| N-EML-05 | P0 | provider 오류 주입(잘못된 API key 등) | `notification_log.status='failed'` + 오류 payload, **재시도 최대 3회 후 종료** | [SPEC] | V-5 |
| N-EML-06 | P0 | 재시도 도중 성공 | 최종 `sent` 1건 — **재시도로 인한 중복 수신 0건** | [SPEC] | V-5 |
| N-EML-07 | P1 | 마케팅 메일 하단 수신거부 링크 | 동작하는 수신거부 제공(법적 요건). 미구현이면 UNDEFINED → O-7 에스컬레이션 | [STD] | V-5 |
| N-EML-08 | P2 | 본문 HTML 100KB 이상 템플릿 | Gmail 102KB 클리핑 경고 — 본문 크기 가드 또는 운영 가이드 존재 확인 | [STD] | V-5 |
| N-EML-09 | P2 | (스테이징 이후) SPF/DKIM/DMARC 정렬 점검 | 발신 도메인 인증 통과 — 스팸함 직행 방지 체크리스트 수행 | [STD] | V-5 |
| N-EML-10 | P1 | in_app+email 둘 다 on 사용자 | 채널별 각 1건씩 — 채널 간 중복 억제로 한쪽이 누락되지 않음 | [SPEC] | V-5 |

## 12. 보안 / 권한 — N-SEC

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-SEC-01 | P0 | user-optin 토큰으로 타 사용자 `user_notifications` 직접 조회(REST) | 0건 반환 (RLS) | [SPEC] | V-0 |
| N-SEC-02 | P0 | user 토큰으로 `read_at` 외 컬럼(title 등) update 시도 | 거부 | [SPEC] | V-0 |
| N-SEC-03 | P0 | anon 키로 알림 테이블 전체 접근 | 전부 차단 | [SPEC] | V-0 |
| N-SEC-04 | P0 | user 토큰으로 `notification_templates`/`groups` write, admin RPC 호출 | 전부 거부 | [SPEC] | V-0 |
| N-SEC-05 | P0 | v13·topik-ai 프로덕션 번들 내 service role key·provider secret 문자열 검색 | 0건 | [SPEC] | V-0 |
| N-SEC-06 | P0 | 관리자가 `<script>`·`onerror` 포함 본문 저장 → 사용자 수신 화면 | 사용자 화면에서 실행 0건(이스케이프/sanitize) — 관리자 입력도 신뢰하지 않음 | [STD] | V-0 |
| N-SEC-07 | P1 | `link_url`에 외부 도메인·`javascript:` 스킴 입력 시도 | 저장 시 검증 거부 또는 클릭 시 차단 (open redirect/XSS 방지) | [STD] | V-0 |
| N-SEC-08 | P1 | 발송·상태 변경을 RPC 우회로 직접 테이블 write 시도 | 거부 — 감사 로그 없는 변경 경로 부재 확인 | [CODE] | V-0 |

## 13. 성능 / 부하 — N-PERF

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-PERF-01 | P1 | 미읽음 count 쿼리 EXPLAIN | 인덱스 사용 (`user_id`, `read_at`) — 순차 스캔 없음 | [STD] | V-6 |
| N-PERF-02 | P1 | cron 슬롯 대상 산정 쿼리 EXPLAIN (사용자 1만 시드) | 인덱스 사용, 슬롯당 처리 시간 기록 | [STD] | V-6 |
| N-PERF-03 | P1 | 1만 명 그룹 즉시 발송 | 배치 처리로 타임아웃 없이 완료, 부분 실패 시 실패분만 `failed` 기록 | [STD] | V-6 |
| N-PERF-04 | P2 | 알림 500건 보유 계정의 수신함 스크롤 | 페이지네이션/지연 로드 — 전체 로드로 인한 멈춤 없음 | [STD] | V-6 |

## 14. 회귀 — N-REG

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-REG-01 | P0 | 기존 3종 토글·스케줄 저장 (구버전과 동일 절차) | 기존 동작 회귀 없음 | [CODE] | V-6 |
| N-REG-02 | P0 | 키 계약 확장 전 생성된 기존 `notification_settings` row 사용자 | 로드·저장 모두 정상 (missing key 해석 계약) | [SPEC] | V-6 |
| N-REG-03 | P0 | topik-ai `tests/e2e/app-routes.spec.ts` 실행 | route registry E2E 전체 통과 | [CODE] | V-6 |
| N-REG-04 | P1 | topik-ai 기존 admin E2E 전체 실행 | 통과 — 알림 작업이 다른 admin 기능을 깨지 않음 | [CODE] | V-6 |
| N-REG-05 | P1 | v13 설정 계열 화면(G-01 언어 설정, X-05 프로필) 스모크 | 회귀 없음 (`profiles` 공유 컬럼 작업 영향 확인) | [CODE] | V-6 |
| N-REG-06 | P1 | migration down → up 왕복(`db:admin:migrate` Management API 경로) 후 N-SET-01·N-INB-02 재실행 | 데이터 정합 유지, `admin_schema_migrations` 추적 정확 — `topik_writing_schema_migrations`에 알림 migration 미혼입 | [SPEC] | V-0 |
| N-REG-07 | P1 | legacy `/notification/send`·`/notification/history` 진입 | O-10 정책대로 동작 (유지 기간 중 redirect → `/messages/*`, 제거 후 404) — route registry E2E와 일치 | [SPEC] | V-6 |

## 15. 조사 기반 엣지 시나리오 — N-EDGE

알림 기능에서 업계에 자주 보고되는 버그를 조사해 도출한 시나리오다. §15.2의 버그→시나리오 매핑과 함께 실행한다.

| ID | P | 시나리오 | 기대 결과 | 출처 | 게이트 |
| --- | --- | --- | --- | --- | --- |
| N-EDGE-01 | P1 | **DST 전환일 시뮬레이션**: user-dst(`America/New_York`)의 reminder를 DST 전환 시각대(02:00~03:00)에 설정하고 전환일 전후 슬롯 확인 | 0회 발송(누락)도 2회 발송(중복)도 아닌 정확히 1회 — 전환일 cron이 0/1/2회 실행되는 고전 버그 방지 | [STD] | V-1 |
| N-EDGE-02 | P1 | **읽음 후 뱃지 잔류**: 알림 수신 → 수신함 아닌 경로(B-01 카드 클릭)로 내용 확인 → 헤더 뱃지 확인 | 읽음 처리 규칙이 일관(카드 클릭도 read 처리 또는 명시적 미처리 정책) — 화면 간 카운트 불일치 없음 | [STD] | V-2 |
| N-EDGE-03 | P0 | **재시도 폭주(retry storm)**: provider 5xx를 지속 주입한 채 cron 3회차 관찰 | 재시도 상한(3회) 준수, 무한 재발송·로그 폭증 없음, 상한 도달 시 종료 상태 기록 | [STD] | V-5 |
| N-EDGE-04 | P1 | **발송 도중 부분 실패**: 100명 발송 중 일부 사용자 row를 의도적으로 깨뜨림 | 실패한 수신자만 `failed`, 나머지는 정상 발송 — 1명 실패가 전체 발송을 중단시키지 않음 | [STD] | V-3 |
| N-EDGE-05 | P1 | **수신 직후 탈퇴**: 알림 수신 → 탈퇴 처리 → 관리자 이력 화면 확인 | FK cascade로 사용자 데이터 정리, 관리자 이력 화면은 깨지지 않고 집계 유지(익명화 또는 '탈퇴 사용자' 표기) | [STD] | V-3 |
| N-EDGE-06 | P2 | **시계 오차**: Edge Function 서버 시각과 DB `now()` 기준 불일치 가정 — 슬롯 판정 로직의 시각 출처 확인 | 슬롯 판정이 단일 시각 출처(DB 또는 함수 한쪽) 기준 — 이중 출처로 인한 경계 누락 없음 | [CODE] | V-1 |
| N-EDGE-07 | P1 | **알림 폭주 빈도**: 한 사용자에게 단시간 다수 발송(관리자 연속 발송 3회) | 모두 도착하되 UI 성능 저하 없음. 빈도 상한(frequency cap)은 백로그 — 미구현은 결함 아님(기록만) | [STD] | V-2 |
| N-EDGE-08 | P2 | **만료된 세션에서 읽음 처리**: 세션 만료 후 수신함에서 클릭 | 로그인 유도 후 원래 동작 복귀, 무한 스피너 금지 | [STD] | V-2 |
| N-EDGE-09 | P1 | **이메일/인앱 본문 불일치**: 같은 template_key의 채널별 본문 확인 | 채널별 본문이 의도된 차이만 가짐(링크 절대경로 등) — 변수 집합 불일치로 한 채널만 깨지지 않음 | [STD] | V-5 |
| N-EDGE-10 | P1 | **dedupe_key 충돌 오설계 검증**: 다른 발송 회차(어제/오늘)의 같은 사용자·같은 템플릿 | 회차가 다르면 **정상 발송됨** — 과도한 dedupe로 정당한 알림이 누락되지 않음 | [SPEC] | V-1 |

### 15.1 조사 출처

- 뱃지 카운트 불일치·잔류(stuck badge) 사례: [Telegram — Badge counter shows unread when all read](https://bugs.telegram.org/c/6131), [Apple Community — badge count](https://discussions.apple.com/thread/255901399), [Cursor Forum — stuck tray badge](https://forum.cursor.com/t/ursor-tray-notification-badge-is-stuck-shows-2-unread-notifications-that-cannot-be-cleared/158573)
- DST/cron 스케줄 사고: [When DST Broke Our Cronjobs in 3 Ways](https://medium.com/@rudra910203/when-daylight-savings-time-broke-our-cronjobs-in-3-different-ways-ee3ce525904f), [Datadog — Agent DST bug](https://github.com/DataDog/dd-agent/wiki/Agent-DST-bug), [Laravel — local-hour notifications with timezones](https://rappasoft.com/blog/sending-laravel-notifications-at-the-right-local-hour-using-timezones-a-command-and-cron)
- idempotency·재시도 설계: [Idempotency in Distributed Systems](https://dev.to/aloknecessary/idempotency-in-distributed-systems-design-patterns-beyond-retry-safely-k66)
- 이메일 QA 체크리스트(변수 fallback, unsubscribe, Gmail 102KB 클리핑, SPF/DKIM/DMARC): [MailSlurp — Email testing checklist](https://www.mailslurp.com/blog/email-testing-checklist/), [Mailpro — HTML Email QA Checklist 2026](https://www.mailpro.com/blog/html-email-qa-checklist-2026), [Litmus — Email testing & QA](https://www.litmus.com/blog/email-testing-and-qa), [Mailtrap — Email test cases](https://mailtrap.io/blog/email-test-cases/), [4TM — Campaign QA checklist](https://4thoughtmarketing.com/articles/campaign-qa-checklist/)

### 15.2 자주 발생하는 버그 → 시나리오 매핑

| 업계 빈발 버그 | 본 문서 대응 시나리오 |
| --- | --- |
| 뱃지 카운트 불일치 / 읽었는데 뱃지 잔류 | N-INB-07, N-INB-10, N-INB-11, N-EDGE-02 |
| DST/timezone으로 0회·2회 발송 | N-SCH-04, N-SCH-05, N-EDGE-01 |
| 재시도·동시 실행으로 중복 발송 | N-SCH-02, N-SCH-03, N-TRG-03, N-EML-06, N-EDGE-03 |
| 과도한 중복 방지로 정당한 알림 누락 | N-EDGE-10 |
| 결측 변수 노출 (`Hi {{firstname}}`) | N-ADM-03, N-EML-02, N-EML-03 |
| 깨진 수신거부/딥링크 | N-EML-04, N-EML-07, N-INB-12 |
| 탈퇴/삭제 사용자 발송 시도 크래시 | N-SCH-09, N-EDGE-05 |
| 다운타임 후 알림 스톰 | N-SCH-11 |
| opt-out 미반영 (큐에 남은 옛 설정으로 발송) | N-OPT-05 |
| 발송 본문 XSS / open redirect | N-INB-13, N-SEC-06, N-SEC-07 |
| 1명 실패로 전체 발송 중단 | N-EDGE-04 |
| Gmail 클리핑·스팸함 직행 | N-EML-08, N-EML-09 |

## 16. 실행 순서와 집계

1. **순서**: N-SEC·N-REG-06(스키마/RLS, V-0) → N-SCH·N-TRG(파이프라인, V-1) → N-SET·N-INB·N-DSH(사용자 UX, V-2·V-6) → N-ADM·N-OPT(관리자·수신 제어, V-3·V-4) → N-EML(V-5) → N-PERF·N-REG(V-6) → N-EDGE는 해당 게이트에 끼워 실행.
2. **P0 전수 + P1 전수 통과**가 출시 게이트. P2는 실패 시 백로그 등록으로 갈음 가능.
3. 결과는 시나리오 ID별 PASS/FAIL/UNVERIFIED/UNDEFINED로 집계해 `logs/notification-feature-evidence.md`에 기록하고, FAIL은 결함 티켓으로, UNDEFINED는 계획안 O-* 미결정 사항으로 에스컬레이션한다.
4. 자동화: N-SET·N-INB·N-DSH·N-ADM의 P0는 Playwright로 자동화(계획안 Phase 4), 파이프라인 계열(N-SCH·N-TRG·N-EML)은 Edge Function 단위 테스트 + 수동 시간 조작 검증을 병행한다.
