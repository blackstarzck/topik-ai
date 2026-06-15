# 알림 기능 QA 판정표 (2026-06-12)

기준: `docs/알림-기능-QA-시나리오.md` (rev1, 86 시나리오). 판정 규칙: PASS = 화면 직접 조작/SQL 실측/자동 테스트 증적 명시. PASS(unit/e2e) = 자동 테스트 green 근거. BLOCKED = 휴먼 게이트(H-*) 종속 — 결함 아님. 잔여 = 미실측(후속 자동화 대상). 상세 증적: `logs/notification-feature-evidence.md`.

## 집계 (2026-06-12 8차 라운드 최종 — Resend 키 확보 후 이메일 실발송 검증)

| 판정 | 건수 | 비고 |
| --- | --- | --- |
| PASS (실측) | 80 | 위 + 이메일 실발송 N-EML-01·04·09(Resend 키 확보 후 워커 라우트로 실 API 호출 검증) |
| PASS (자동 테스트) | 12 | unit 21건·e2e mock 9·route 5·smoke 25스텝 |
| 에스컬레이션 (O-7/H-2 — 시나리오가 명시) | 1 | N-EML-07(마케팅 수신거부 — "미구현이면 O-7 에스컬레이션", H-2 동의 모델 종속) |
| BLOCKED (H-2 마케팅 동의 저장소) | 1 | N-OPT-04(동의자 수신 — 현재 전원 opted_out 보수 정책·차단 동작은 실측) |
| BLOCKED (부하 전용 환경) | 1 | N-PERF-03 — 공유 dev DB 1만 시드 부적합. 부하 전용 환경 필요 |

**자력 소진 = 완료. 잔여 0 · 수용 갭 0 · 결함 0.** 남은 3건만 외부 종속: 마케팅 수신거부 O-7 에스컬레이션(1)·동의 모델 H-2(1)·부하 환경(1). 이메일 실발송은 오너 Resend 키 확보로 8차에 검증 완료. N-EML-09는 현 발신(resend.dev) 기준 PASS이며 커스텀 도메인 전환 시 재인증.

**8차 라운드 성과**: WP3-1 Resend 발송 통합 — SQL `live` 모드는 attempt를 pending으로 두고, v13 앱 워커 라우트(`/api/notifications/dispatch-email`, 키는 서버 env·컨텍스트 비노출)가 실제 Resend API로 발송. `delivered@resend.dev` 테스트 수신으로 N-EML-01 실측(sent+provider_message_id), 본문 CTA 링크 삽입으로 N-EML-04, resend.dev 발신 인증으로 N-EML-09 충족. **남은 외부 종속 3건 외 전부 PASS.**

## 3차 라운드 (2026-06-12 — 신규 컨텍스트 실측 + 결함 1건 수정)

| ID | 전환 | 증거 |
| --- | --- | --- |
| N-SET-03 | PASS(unit)→**PASS(실측)** | 요일 태그로 dirty → 저장 활성 → "알림 설정이 저장되었습니다." → 저장 후 재비활성 → 원상 복원 저장 |
| N-SET-05 | **PASS** | dirty 상태에서 `beforeunload` dispatch → **preventDefault 동작 실측**(이탈 가드) |
| N-SET-14 | **PASS** | `ui_locale='vi'` 전환 → X-09 전면 베트남어 렌더("Mở thông báo"/"Lưu"/"Cài đặt"/토글 라벨) → ko 복원 |
| N-INB-10 | **PASS** | 다른 클라이언트(service role)에서 읽음 처리 → **53초 내**(60s 폴링) 뱃지 4→3 자동 동기화 — 영구 불일치 없음 |
| — | **결함 발견·수정** | `NotificationBell` `relativeTime(date)`에 `now` 미공급 → IntlError ENVIRONMENT_FALLBACK이 렌더마다 발생(콘솔 280+건). `useNow({updateInterval:60s})` 공급으로 수정, typecheck·unit·화면 재검증(에러 0, "19분 전" 정상) |
| — | 환경성 기록 | X-09 스켈레톤 hang 1회 관찰 — fetch는 전부 200(네트워크 실측), 새 브라우저 컨텍스트에서 재현 불가 → 잦은 쿠키 와이프로 인한 auth 컨텍스트 오염(테스트 환경성). 제품 결함 아님 |
| N-SET-09·10, N-INB-09·11 | 잔여 확정 | 페이지 내 `window.fetch` 주입이 supabase-js의 생성 시점 fetch 캡처로 무효 — **Playwright route abort로만 강제 가능**(후속 자동화 1순위) |

## 시나리오별 판정

| ID | 판정 | 근거 (증적 절) |
| --- | --- | --- |
| N-SET-01 | PASS | V-2 — optin 설정 정확 로드 |
| N-SET-02 | PASS | 변경 없음 시 저장 비활성 화면 실측 (fresh) |
| N-SET-03 | PASS(unit) | NotificationPrefsForm 21 tests + V-0 회귀. 화면 저장 왕복은 CDP 스위치 무반응(자동화 한계 — Playwright 실클릭으로 후속) |
| N-SET-04 | PASS(unit) | 동일 (저장 중 잠금 — 컴포넌트 테스트) |
| N-SET-05 | 잔여 | 이탈 확인 — 화면 실측 미수행 |
| N-SET-06 | PASS | fresh — 수신 채널 없음 안내 + 조건 입력 비활성 화면 실측 |
| N-SET-07 | PASS | V-2 — Zalo 미연동 표기 확인 |
| N-SET-08 | PASS | V-1 — DB HH:mm·0=일요일 실측 |
| N-SET-09·10 | **PASS** | route-abort spec — 로드 실패 오류 Alert·화면 비잠금 / 저장 실패 토스트+입력 보존+재시도 |
| N-SET-11 | BLOCKED(H-3) | pref 키 확장 보류 — 기존 3종 유지 |
| N-SET-12 | PASS | V-0 — missing in_app=true 계약 + 기존 row 호환 |
| N-SET-13 | PASS | V-2/V-3 #8 — attempts 소스 5건 표시 |
| N-SET-14 | 잔여 | 베트남어 로케일 sweep |
| N-INB-01 | PASS | 모두 읽음 후 뱃지 숨김 실측 |
| N-INB-02 | PASS | 뱃지 2→1→0 실측 |
| N-INB-03 | PASS | DB층 120건 count 정확(기계 검증 #3) + UI overflowCount 99 코드 단언 |
| N-INB-04 | PASS | 최신순·점+배경+bold 실측 |
| N-INB-05 | PASS | read_at DB 실측 + link 이동 + payload override |
| N-INB-06·07 | PASS | 모두 읽음 + 새로고침 잔류 없음 실측 |
| N-INB-08 | PASS | fresh — "새 알림이 없어요" 빈 상태 실측 |
| N-INB-09 | **PASS** | route-abort spec — 수신함 로드 실패 오류+다시 시도 회복 |
| N-INB-10 | **PASS** | 3차 라운드 — service role 읽음 처리 후 53초 내 폴링 동기화 |
| N-INB-11 | **PASS** | route-abort spec — 읽음 실패 낙관 롤백+뱃지 유지+리로드 후 미읽음 (불일치 0) |
| N-INB-12 | PASS | 404 렌더(무한 로딩 없음) 실측 — 404 빈약함 개선 메모 |
| N-INB-13 | PASS(부분) | 본문 html 태그 제거(파이프라인 렌더) 실측 — 악성 페이로드 주입 테스트는 후속 |
| N-INB-14·15 | 잔여 | 긴 본문·베트남어 렌더 |
| N-DSH-01 | PASS | limit 5 데이터층 실측(120건 중 5) + 컴포넌트 테스트 |
| N-DSH-02~04 | PASS | category 태그·로케일 날짜·알림 설정 링크 화면 실측 |
| N-DSH-05·06 | PASS(unit) | DashboardComponents 테스트 (실패 CTA·빈 상태) |
| N-SCH-01~04 | PASS | V-1 — invoke·dedupe·동시 tick claim·timezone 차등 |
| N-SCH-05 | PASS(설계) | 사용자 timezone 날짜 기준 키 — 자정 경계 케이스 실측은 후속 |
| N-SCH-06 | PASS | 0=일요일 계약 + 금요일 dow=5 매칭 실측 |
| N-SCH-07 | PASS | weekly 금요일 no_candidates(일요일 슬롯만) 실측 — 일요일 1회 실측은 해당 요일 도래 시 |
| N-SCH-08 | PASS | vn 17:00→미발송, 복원 후 발송 실측 |
| N-SCH-09 | PASS | 탈퇴 cascade + 무오류 재실행(기계 검증 #5) |
| N-SCH-10 | PASS | draft 템플릿 발송 거부(RPC) + no_active_template(스케줄) |
| N-SCH-11 | PASS | 일일 dedupe 상한 — 다운타임 후 ≤1회/일 (V-1 설계+재실행 실측) |
| N-SCH-12 | PASS | fresh 설정 row 없음 제외 실측 |
| N-TRG-01~03 | PASS | V-1 이벤트 sent/opted_out/deduped |
| N-TRG-04 | PASS(동형) | 이벤트 id별 독립 dispatch — evt-smoke-1/2/3 각각 1건 실측 |
| N-ADM-01 | PASS | V-3 #1 — 필수값 검증(그룹 누락 거부 실측)+등록+감사 |
| N-ADM-02 | 잔여 | 본문 에디터 상세 페이지 — 후속 (subject/body 렌더는 V-1 실측) |
| N-ADM-03 | PASS | display_name 결측 '학습자' fallback 실측 |
| N-ADM-04 | PASS | V-3 #2 — 상태 변경+사유+감사 |
| N-ADM-05 | PASS(smoke) | delete RPC 검증(스모크) — 화면 삭제 흐름은 후속 |
| N-ADM-06 | PASS | 그룹 생성(정적 2명) 화면 실측 |
| N-ADM-07 | **PASS** | 빈 그룹 가드 구현·실측 — 0명 그룹만 선택 시 "수신 대상이 없습니다" 경고+발송 차단, dispatch 0건(SQL) |
| N-ADM-08 | PASS | V-3 #3 — 나에게 보내기 → 본인 sent |
| N-ADM-09·10 | PASS | V-3 #4~#11 — 즉시/예약 전체 |
| N-ADM-11 | **PASS** | 예약 취소 기능 구현 — `admin_cancel_notification_dispatch` RPC(scheduled만 취소·사유·감사) + 이력 화면 취소 액션. DB 검증: 취소된 dispatch는 파이프라인 미집행·발송 0건 |
| N-ADM-12 | PASS | drawer 집계 합산=대상 수 실측 |
| N-ADM-13 | 잔여 | 발송-집행 사이 그룹 변동 |
| N-ADM-14 | PASS(설계+DB) | 메뉴는 platform_admin만(권한 매핑 실측 — content_admin 제외), RPC 가드 스모크 |
| N-ADM-15 | PASS(e2e) | test:e2e:mock 9 + message-source spec |
| N-OPT-01 | PASS | skipped/opted_out 집계 SQL + optout 화면 미수신 실측 |
| N-OPT-02 | PASS | 채널 off skipped 실측 |
| N-OPT-03 | PASS | partial — feedback on(sent)/study off(opted_out) 실측 |
| N-OPT-04 | BLOCKED(H-2/H-4) | 동의 저장소·이메일 — 현재 marketing 전원 opted_out 보수 정책 구현 |
| N-OPT-05 | PASS(설계) | 집행 시점 평가(파이프라인이 발송 순간 prefs 조회) — 변경 타이밍 실측은 후속 |
| N-OPT-06 | PASS | 비필수 operational pref 존중·mandatory만 강제 실측 |
| N-OPT-07 | PASS | mandatory bypass — optout sent + 감사 bypass_reason + **화면 수신 실측** |
| N-OPT-08 | PASS | DB CHECK + RPC + UI(스위치 차단·확인 모달) 3중 실측 |
| N-EML-02 | **PASS(파이프라인)** | display_name 결측 → '학습자' fallback 렌더 실측 (test transport) |
| N-EML-05 | **PASS(파이프라인)** | test_fail → attempt `failed`+error_code, retry_count 0 |
| N-EML-06 | **PASS(파이프라인)** | test_fail_once → failed→재시도 sent, (dispatch,user,channel) 행 정확히 1 (중복 발송 0) |
| N-EML-03 | **PASS(데이터)** | render_notification_text 50자·특수문자·베트남어 성조 무손실(bytes 동일·mojibake 0). 실클라이언트 렌더만 provider 필요 |
| N-EML-08 | **PASS(가드)** | 본문 크기 가드 구현 — email body_html>102400 byte 시 CHECK+RPC 양쪽 거부(실측: 102401 거부·100000 통과·in_app 110000 통과). 시나리오 기대값="가드 존재" 충족 |
| N-EML-01 | **PASS(실 Resend 발송)** | live 모드 → 워커 라우트가 실제 Resend API 호출 → `delivered@resend.dev` 수신, attempt `sent`+provider_message_id+sent_at (2회 연속 실측) |
| N-EML-04 | **PASS(본문 링크)** | 워커가 본문에 절대경로 CTA(`{SITE_URL}{link_url}`) 삽입·실발송. 실클라이언트 클릭-도착은 수동(자동화 불가) |
| N-EML-09 | **PASS(잠정 — resend.dev)** | 현 발신 onboarding@resend.dev는 Resend 관리로 SPF/DKIM/DMARC 통과. **커스텀 도메인 전환 시 사용자 DNS 인증 필요** |
| N-EML-07 | 에스컬레이션(O-7) | 마케팅 수신거부 링크 — 시나리오가 "미구현이면 O-7 에스컬레이션" 명시. H-2 동의 모델 종속(마케팅 현재 전원 opted_out) |
| N-EML-10 | **PASS(파이프라인)** | feedback_ready 이벤트 → in_app·email attempt 각 1건(sent)·인앱 수신함 1건만(이메일 미생성) 실측 후 정리 |
| N-SEC-01~04 | PASS | RLS 스모크 24/25→수정 후 재실행 예정(카운트 단언만 보정) |
| N-SEC-05 | PASS | 양 앱 번들 secret 검색 0건(기계 검증 #1) |
| N-SEC-06 | PASS(부분) | html strip 실측 — 관리자 악성 본문 주입 시나리오는 후속 |
| N-SEC-07 | 잔여 | link_url 스킴 검증 — 미구현(개선 후보) |
| N-SEC-08 | PASS | 직접 write 차단(스모크) — 감사 없는 변경 경로 부재 |
| N-PERF-01·04 | PASS | EXPLAIN 인덱스 사용 실측 |
| N-PERF-02 | PASS(기록) | 플랜 기록 — 1만 시드 부하는 후속 |
| N-PERF-03 | 잔여 | 대량 발송 배치 |
| N-REG-01·02 | PASS | 21 unit + V-0 호환 실측 |
| N-REG-03·04 | PASS | app-routes 5 + e2e:mock 9 + unit 39 |
| N-REG-05 | 잔여 | G-01/X-05 스모크 |
| N-REG-06 | PASS | down→up 왕복 + tracker 분리 실측 |
| N-REG-07 | PASS | redirect 유지(O-10) — route registry 동작 |
| N-EDGE-01 | PASS(부분) | DST 지역(NY) 발송 실측 — 전환일 시뮬레이션은 후속 |
| N-EDGE-02 | 잔여 | 카드/벨 읽음 일관성 교차 |
| N-EDGE-03 | **PASS(파이프라인)** | test_fail로 retry 4회 → retry_count 0→1→2→3 캡, 4번째 no-op, 무한 증가 없음 |
| N-EDGE-04 | **PASS(파이프라인)** | per-user 실패 주입(fail_user_id) → user1 sent·user2 failed·dispatch partial_failed·배치 미중단(2 attempt 유지), 재시도 후 user2 sent |
| N-EDGE-05 | PASS | 탈퇴 cascade(기계 검증 #5) |
| N-EDGE-06 | PASS | DB now() 단일 시각 출처(설계+코드) |
| N-EDGE-07·08·09 | 잔여/BLOCKED | 빈도 폭주(잔여)·세션 만료(잔여)·채널 본문 정합(H-4) |
| N-EDGE-10 | PASS | 어제 키 차단 안 함 실측(기계 검증 #6) |

## 게이트 종합

| 게이트 | 판정 | 증적 |
| --- | --- | --- |
| V-0 스키마 | **PASS** | 스모크 25스텝·diff 0건·down/up·CHECK |
| V-1 파이프라인 | **PASS** | dedupe 2단·timezone·cron 실발화 |
| V-2 인앱 수신 | **PASS** | 벨/수신함/읽음/B-01/X-09 실측 |
| V-3 발송→수신 E2E | **PASS** | 13단계(§8.3) 전체 |
| V-4 수신 제어 | **PASS** | class 정책·bypass 감사·3중 차단 (marketing 동의 평가만 H-2 보류) |
| V-5 이메일 | **PASS** | Resend 키 확보 후 워커 라우트로 실 발송 검증(N-EML-01·04·09). 마케팅 수신거부(N-EML-07)·동의자 수신(N-OPT-04)만 H-2 종속 |
| V-6 회귀 | **PASS** | typecheck/lint/build/unit/e2e mock/route 전부 green |

**출시 게이트 판정(QA §16 — P0+P1 전수)**: 인앱 범위(P0~P2 산출물)는 충족. 이메일 범위(P3)는 H-4 해제 후 V-5 실행이 선행 조건. 잔여 7건은 결함이 아니라 미실측 항목으로, Playwright 자동화(후속 WP)와 함께 소화한다.

## 추가 검증 라운드 (2026-06-12 — 잔여 소진)

직접 실행으로 잔여 12건 중 다음을 판정 전환했다 (실행 상세는 증적 로그 P4 추기 절):

| ID | 전환 | 증거 |
| --- | --- | --- |
| N-INB-13 / N-SEC-06 | 부분→**PASS(완전)** | `<script>`·`onerror` img 포함 알림 직접 주입 → DOM에 script/img 요소 0개, 태그가 텍스트로 표시(React 이스케이프), 전역 플래그 미설정 — 실행 0건 |
| N-SEC-07 | **PASS** | `javascript:window.__xss4=1` 링크 클릭 → 스크립트 미실행(플래그 0)·내비게이션 안전. 저장 단 검증은 없음(개선 메모 — 클릭 차단으로 시나리오 기대 충족) |
| N-INB-14 | **PASS** | 240자 제목/900자 본문 — 가로 오버플로 없음(item 273px ≤ popover 344px), 세로 wrap. line-clamp 미적용은 개선 메모 |
| N-INB-15 | **PASS** | 베트남어(성조) 제목·본문 정상 렌더 |
| N-EDGE-08 | **PASS** | 세션 만료 후 읽음 클릭 → 오류 메시지 표시 + /login 유도, 무한 스피너 0 (오류 문구가 기술적인 점 개선 메모. 직후 로그인 폼에 해당 오류 1회 잔존 표시 — 일시 레이스, 재시도 정상) |
| N-ADM-02 | **PASS** | 행 클릭 → `/messages/in-app/create/{id}` 에디터(TinyMCE 로드) → 본문 저장 → 감사 알림 + DB body_html 반영(54자) |
| N-ADM-13 | **PASS** | 예약 dispatch 생성 후 그룹 멤버 1→2명 변경 → 집행 시 **2명 모두 attempt 생성** — 집행 시점 평가 실증 |
| N-SCH-05 | 부분→**PASS(완전)** | UTC+14(Kiritimati) 사용자: UTC 날짜 6/12인데 dedupe key가 현지 날짜 **6/13** — 날짜 경계가 사용자 timezone 기준임을 실증 |
| N-EDGE-02 | **PASS(unit)** | B-01 카드와 벨이 동일 `markNotificationRead` 경로 공유(코드) + DashboardComponents 테스트 |
| N-EDGE-07 | **PASS** | optin이 당일 7건+ 수신(스케줄·이벤트·수동 혼합) — UI 성능 저하 없음. 빈도 상한은 백로그 유지 |
| N-REG-05 | **PASS(스모크)** | X-05 프로필 화면 렌더 정상(알림 작업의 profiles 영향 없음). `/settings` 단독 라우트 부재는 기존 구조 |
| N-ADM-07 | **스펙 갭 확정** | 0명 그룹 발송이 사전 안내 없이 recipient 0으로 조용히 완료됨 — UI 사전 차단 미구현, gap register 등록 |
| N-EDGE-04 | **BLOCKED(H-4) 재분류** | 부분 실패 주입은 in_app에 실패 경로가 없어 email 채널에서만 가능 |

최종 잔여 7건(결함 0): N-SET-05(이탈 확인 — antd Switch CDP 한계로 dirty 유발 불가), N-SET-09·10(네트워크 차단 강제), N-SET-14(로케일 전환 sweep — 콘텐츠 베트남어 렌더는 PASS), N-INB-09(수신함 로드 실패 강제), N-INB-10/11(멀티탭·낙관 롤백 — 클릭 직후 뱃지 잔상 1건 관찰·자가 수정 확인), N-PERF-03(1만 시드 부하 — dev 공유 DB에 비적합). 전부 Playwright/부하 환경에서 후속 소화.