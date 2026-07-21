# TOPIK 운영 데이터 온프레미스 백업 안내서

2026-07-21 실제 설치·검증 기준의 현행판이다. 초안(커밋 `22a7ef3`)과 달라진
지점은 §9(변경 이력)에 근거와 함께 정리했다. 서버 주소·계정 등 접속 정보는
문서에 기록하지 않는다.

## 1. 구성 개요

- 원본과 백업 대상은 Supabase `topik-prod`(`eymlabowhfgtxbiqwxqh`, ap-southeast-1, PostgreSQL 17) 하나다.
- 온프레미스 Linux 서버가 데이터베이스 덤프 4종과 Storage 전체 파일을 내려받아
  restic 저장소(암호화)에 보관한다. 서버는 운영 DB에 **읽기만** 한다.
- 백업 계정은 전용 롤 `topik_backup`(LOGIN + `pg_read_all_data` + `BYPASSRLS`)이며
  운영의 어떤 테이블에도 쓰기 권한이 없다(§4).
- 복원 점검(드릴)은 서버 안의 격리 Supabase 스택(127.0.0.1 전용)에서만 수행하며,
  스크립트가 드릴 대상 주소를 루프백으로 하드 가드한다.
- ⚠️ topik-prod는 현재 Free 플랜이라 Supabase 내장 일일 백업·PITR이 없다.
  **이 온프레미스 백업이 유일한 백업이다.** 오프사이트 사본 부재로 서버 디스크와
  Supabase가 동시에 소실되면 복구할 수 없다(보완 계획의 결정 게이트).

## 2. 저장소 파일 맵

| 리포 경로 | 서버 배치 위치 | 역할 |
| --- | --- | --- |
| `scripts/backup/topik-backup.sh` | `${BACKUP_ROOT}/bin/` | 본체(backup/drill/flush) |
| `scripts/backup/run-backup.sh` | 〃 | env 로드 수동 실행 래퍼 |
| `scripts/backup/send-report.py` | 〃 | HMAC 서명 보고 전송 |
| `scripts/backup/enter-secrets.sh` | 〃 | 비밀값 대화형 입력(재시도·진단) |
| `scripts/backup/set-db-url.sh` | 〃 | stdin으로 DB URL 주입(값 미출력) |
| `scripts/backup/backup.env.example` | `${BACKUP_ROOT}/etc/backup.env` | 설정(600) |
| `scripts/backup/drill-stack/*` | `${BACKUP_ROOT}/drill-stack/` | 드릴 스택(compose·roles-init·run/reset) |
| `scripts/backup/systemd-user/*` | `~/.config/systemd/user/` | 사용자 타이머 6종 |

사용자 권한(비루트) 구성이 현행이다: `BACKUP_ROOT=$HOME/topik-backup`,
비밀값은 `${BACKUP_ROOT}/etc`(700/600). 루트가 확보되면 초안의
`/srv·/etc/topik-backup` 배치로 승격할 수 있다(데이터 이동만으로 충분).

## 3. 필요 도구 (버전 핀)

- Docker + docker compose v2 (드릴 스택·덤프 컨테이너 실행, 계정은 docker 그룹)
- 덤프 도구: `public.ecr.aws/supabase/postgres:17.6.1.132` 컨테이너의
  pg_dump/pg_dumpall — **prod PG major와 일치**시키고 사전 pull 한다
- restic 0.19.x, rclone 1.74.x — 사용자 영역(`~/.local/bin`) 설치 가능
- psql 클라이언트 16+, jq, python3, gzip
- supabase CLI는 **덤프에 사용하지 않는다**(§9-1). 설치돼 있어도 무해하다.

## 4. 백업 전용 DB 롤

Management API `POST /v1/projects/{ref}/database/query`로 1회 실행한다
(postgres 자체 비밀번호는 변경하지 않으므로 기존 시스템 영향이 없다):

```sql
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'topik_backup') then
    execute format('alter role topik_backup with login password %L', :새비밀번호);
  else
    execute format('create role topik_backup with login password %L', :새비밀번호);
  end if;
end $$;
grant pg_read_all_data to topik_backup;
alter role topik_backup bypassrls;
```

- `BYPASSRLS`가 없으면 FORCE RLS 테이블(admin_*)에서 pg_dump가 실패한다.
  postgres 자격의 query 엔드포인트에서 부여 가능함을 확인했다.
- 연결 문자열은 세션 풀러(포트 5432)를 사용한다:
  `postgres://topik_backup.<ref>:<pw>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
- 검증: `has_table_privilege('topik_backup', ..., 'insert/update/delete')` 전부
  false, `rolsuper/rolcreaterole/rolcreatedb` 전부 false여야 한다.

## 5. 백업 동작 (매일 KST 00:30/06:30/12:30/18:30)

1. flock(backup.lock) — 중복 실행이면 `지연` 보고만 남기고 종료
2. 디스크 여유 50GB 미만이면 `DISK_SPACE_LOW` 실패 보고
3. DB 덤프 4종(컨테이너 pg 도구, 스텝별 timeout):
   - `pg_dumpall --roles-only --no-role-passwords` → roles.sql
   - `pg_dump --schema-only -N <관리 스키마 목록>` → schema.sql
   - `pg_dump --data-only -N <관리 스키마 목록>` → data.sql
   - `pg_dump --data-only -n auth -n storage` → auth-storage-data.sql
     (**회원 인증·스토리지 메타 포함이 복구 가능성의 핵심**)
4. 재발 방지 하드게이트: `COPY auth.users`·`COPY storage.objects`·
   `COPY public.profiles` 블록이 덤프에 실재해야 성공 처리
5. 핵심 8테이블 행수 기록(key-table-counts.json) + 참조 메타(reference.json:
   server_version·확장 목록·cron.job·auth/storage 장부 버전)
6. rclone으로 전체 버킷 동기화 후 개수·바이트 일치 검증
7. restic 스냅샷(태그 topik-prod / complete|partial / run:<uuid>) +
   `--keep-within 7d --prune`
8. 시작·완료 보고를 HMAC 서명해 Vercel 수신부로 전송(운영/미러 각각,
   실패 시 outbox 적재 → 5분 재시도 타이머가 드레인)

## 6. 복원 점검 드릴 (매월 첫째 일요일 03:00)

`drill-stack/`의 최소 3서비스 compose(supabase/postgres 17.6.1.132 +
gotrue v2.193.1 + storage-api)를 리셋 후 기동한다. DB 포트만
127.0.0.1:55433에 노출한다(55432는 이 서버의 기존 서비스가 사용 중).

절차: restic `check --read-data`(전체 무결성) → 최신 complete 스냅샷 복원 →
파일 개수·바이트 대조 → 스택 리셋·기동(auth.users/storage.objects 스키마
준비 대기) → publication·event trigger 사전 정리 → roles(관용 적용+사후
실재 검증) → schema(엄격) → TRUNCATE(덤프 COPY 헤더에서 동적 생성, 관리
장부 2테이블 제외) → auth/storage 데이터 → public 데이터 → 8테이블 행수
대조 + storage.objects↔파일수 허용오차(max(5, 0.1%)) 대사 → 보고 → 스택 정지.

드릴은 backup.lock을 공유 대기(-w 3600)하므로 진행 중 백업과 충돌하지 않는다.

## 7. 예약과 운영

```bash
systemctl --user list-timers 'topik-backup*'
journalctl --user -u topik-backup.service --since today
~/topik-backup/bin/run-backup.sh backup   # 수동 실행
```

- 사용자 타이머 + `loginctl enable-linger`로 재부팅에도 유지된다.
- 보존: restic 7일 / 실행 이력 90일 / 드릴 이력 13개월(수신부 RPC가 강제)
- 디스크 80%=주의·90%=위험(화면 표시), 50GB 미만=신규 백업 거부(스크립트)
- 보고 실패는 백업 성공 여부를 바꾸지 않는다. 수신 API가 배포되기 전까지는
  outbox 적재가 정상 상태다. 배포 시 서버의 `report-secret`·
  `report-mirror-secret` 값을 Vercel 환경변수(`BACKUP_REPORT_SECRET`/
  `BACKUP_MIRROR_REPORT_SECRET`)로 복사해야 연결된다.
- **능동 경보 2단**: ① 운영 보고가 실패(백업 failed/partial, 드릴 failed,
  디스크 ≥90%)를 담으면 수신부(`api/backups/report.ts`)가 즉시
  `BACKUP_ALERT_EMAILS`로 이메일을 보낸다(SMTP 재사용, 발송 실패는 보고
  수신에 영향 없음). ② 보고 자체가 끊긴 경우(dead-man)는 일일 알림 워커
  (`api/notifications/dispatch-email.ts`)가 `admin_backup_report_events`
  최근 수신 시각을 검사해 `BACKUP_DEADMAN_HOURS`(기본 26h) 초과 시 같은
  수신자에게 경보한다 — 서버 전원·네트워크 사망까지 잡는 외부 감시다
  (일일 크론 편승이라 최악 감지 지연 ≈ 24h+임계).

## 8. 실증 기록 (2026-07-21)

| 항목 | 결과 |
| --- | --- |
| 첫 완전 백업 | 스냅샷 `86707982`(complete), DB 덤프 4종 + storage 45파일 |
| restic 무결성 | `check --read-data` 통과 |
| 드릴 복원 | `succeeded` (database/storage validation 모두 passed) |
| 행수 대조 | profiles 200 · admin_accounts 1 · notification_templates 14 · auth.users 200(비밀번호 해시 보존 확인) · identities 209 · buckets 4 · objects 43(파일수 delta 0) |
| 프로드 영향 | 읽기 전용 — 쓰기 권한 부재를 카탈로그로 증명 |
| 예약 | backup·drill·report-retry 타이머 활성, linger 설정 |

미완(후속): 수신 API·마이그레이션 배포(리포 쪽), 실패 능동 알림, 오프사이트
사본 결정, 클라우드 신규 프로젝트 재구축(S2) 런북과 게임데이, Free 플랜
quota 초과(2026-08-11 grace 만료) 대응 결정.

## 9. 초안 대비 변경 이력 (근거)

1. **supabase CLI 덤프 폐기 → 컨테이너 pg 도구 직접 호출**: CLI가 내부에서
   `SET ROLE postgres`를 강제하는데, supautils가 `alter role postgres`와
   `grant postgres` 를 모두 차단해 전용 롤이 postgres 멤버가 될 수 없다.
   관리 스키마 제외 목록은 스크립트의 `MANAGED_SCHEMAS`로 명시했다.
   (참고: CLI v2.105.0 타르볼은 shim+`supabase-go` 2파일 구조라 shim만
   복사하면 동작하지 않는다.)
2. **auth/storage 데이터 덤프 추가**: 초안은 관리 스키마가 통째로 빠져
   복원 시 전 회원 로그인 불가였다. 4번째 덤프와 COPY 하드게이트로 재발을
   차단하고, 드릴 검증 테이블에 auth/storage 4종을 추가했다.
3. **드릴 스택 구성 확정**: 공식 풀스택 대신 최소 3서비스 compose를
   리포에 포함했다. 함정 3건 반영 — ① roles-init은 존재하는 롤만 조건부
   ALTER(없는 롤이면 initdb가 exit 3으로 죽는다) ② run.sh는 폴백 재기동
   금지(반초기화 볼륨 재사용 사고) ③ 덤프의 publication·event trigger가
   이미지 기본값과 충돌하므로 복원 전 `prepare_drill_database()`로 정리.
4. **실행 시간 상한**: systemd oneshot은 기본 타임아웃이 비활성이라 행이
   무한 대기한다. 스텝별 `timeout`(주) + 유닛 `TimeoutStartSec`(백스톱,
   backup 2h/drill 3h/retry 4min)을 명시했다.
5. **잠금 보강**: drill은 backup.lock 공유 대기, flush는 별도 outbox.lock
   비대기. 드릴 error_code는 최초 원인만 보존(first-wins).
6. **사용자 권한 구성**: 서버에 sudo가 없어 비루트 배치로 설치했다(오너
   승인). 디스크 LUKS 부재는 restic 자체 암호화로 수용하고 마커 파일에
   결정을 기록했다(평문은 실행 중 스테이징에만 잠시 존재).
