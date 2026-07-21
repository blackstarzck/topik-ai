# TOPIK 운영 데이터 온프레미스 백업 안내서

## 1. 먼저 이해할 구성

- 실제 운영 원본과 자동 백업 대상은 Supabase `topik-prod` 하나입니다.
- 온프레미스 Linux 서버에는 데이터베이스 덤프와 전체 파일 저장소 백업만 보관합니다.
- `topik-dev` 자체는 백업하지 않습니다.
- 관리자 화면용 비민감 결과 요약은 `topik-prod`와 `topik-dev`에 각각 저장합니다. localhost는 `topik-dev` 복사본을 읽습니다.
- 외부에서 온프레미스로 들어오는 포트는 열지 않습니다. 온프레미스 서버가 Supabase에서 내려받고 Vercel로 결과만 보냅니다.

> 외장 디스크와 외부 저장소가 없으므로 Supabase 원본과 온프레미스 디스크가 동시에 고장 나면 복구할 수 없습니다.

## 2. 기존 AI 운영 환경과 분리

첨부된 AI 운영 문서는 `/opt/app`의 PostgreSQL을 Docker Compose 프로젝트 `topik-ai`로 계속 실행하고, 데이터베이스 포트를 외부에 공개하지 않는 구성입니다. TOPIK 백업은 이 구성을 복제하지 않습니다. 같은 서버와 Docker는 재사용하되, 두 번째 상시 데이터베이스를 만들지 않고 월간 복원 점검 때만 임시 Supabase 환경을 켰다가 끕니다.

| 구분 | 기존 AI 운영 | TOPIK 운영 백업 |
| --- | --- | --- |
| 역할 | 계속 실행되는 서비스와 PostgreSQL | `topik-prod` 자료를 내려받는 백업 |
| 기본 경로 | 문서 예시 `/opt/app` | `/opt/topik-backup`, `/etc/topik-backup`, `/srv/topik-backup` |
| Docker 구분 | `topik-ai` | `topik-prod-backup-drill` |
| 자동 실행 | 기존 cron 유지 | 별도 systemd 예약 작업 |
| 외부 사본 | AI 정책을 그대로 유지 | 사용하지 않음 |

`topik-ai`의 컨테이너·볼륨·예약 작업을 중지하거나 초기화하지 않습니다. 특히 AI 경로에서 `down`, `reset`, 볼륨 삭제 명령을 실행하지 않습니다. TOPIK 설치 전에 다음을 읽기 전용으로 확인하고 결과를 보관합니다.

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
docker ps -a --format '{{.Names}}' | grep '^supabase-' || true
sudo ss -lntp
df -h
free -h
crontab -l || true
sudo crontab -l || true
```

- `topik-ai` 컨테이너는 정상 실행 중이어야 합니다.
- `supabase-`로 시작하는 컨테이너가 이미 있으면 임시 복원 환경과 이름이 겹칠 수 있으므로 설치를 중단하고 별도 서버 또는 컨테이너 이름 조정을 먼저 합니다.
- 포트 `55432`, `56543`, `58000`, `58443`이 비어 있는지 확인합니다. 하나라도 사용 중이면 비어 있는 다른 번호를 정하고 복원 환경과 백업 설정을 함께 바꿉니다.
- AI 서비스가 사용 중인 메모리와 디스크를 뺀 뒤에도 TOPIK 백업과 월간 복원 점검을 실행할 여유가 있어야 합니다.
- 첨부 문서의 외부 사본용 rclone 연결은 기존 AI 정책으로 남겨 둡니다. 외부 사본 전송 기능은 TOPIK 백업에 사용하지 않습니다. TOPIK의 rclone은 Supabase 파일 저장소에서 온프레미스로 내려받는 용도로만 사용합니다.

## 3. 서버 준비

권장 기준은 Ubuntu 24.04 LTS, CPU 4코어, 메모리 8GB 이상입니다. 이 수치는 서버 전체가 아니라 기존 AI 사용량을 제외하고 월간 복원 점검을 실행할 수 있는지를 함께 판단해야 합니다. 백업 영역에는 최소 50GB의 여유 공간이 필요합니다. 실제 권장 용량은 다음 중 큰 값입니다.

- 80GB
- 현재 데이터베이스와 파일 저장소 합계의 2배
- 현재 합계의 2배에 5GB를 더한 값

한국 시간대를 설정하고 디스크가 암호화된 영역인지 확인합니다.

```bash
sudo timedatectl set-timezone Asia/Seoul
timedatectl status
lsblk -f
df -h /srv/topik-backup
```

운영체제 전체 디스크가 암호화되지 않았다면 전용 파티션이나 논리 볼륨을 LUKS로 암호화한 뒤 `/srv/topik-backup`에 연결합니다. 장치 이름은 서버마다 다르므로 확인 없이 포맷 명령을 실행하지 않습니다.

## 4. 전용 계정과 폴더

```bash
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin topikbackup
sudo install -d -m 700 -o topikbackup -g topikbackup /srv/topik-backup
sudo install -d -m 750 -o root -g topikbackup /etc/topik-backup
sudo install -d -m 755 -o root -g root /opt/topik-backup
sudo -u topikbackup touch /srv/topik-backup/.encrypted-volume-ready
```

마지막 표시 파일은 암호화된 저장 위치와 권한을 사람이 확인한 뒤에만 만듭니다. 표시 파일이 없으면 백업 스크립트가 실행을 중단합니다.

## 5. 필요한 도구

- Supabase CLI와 Docker: 데이터베이스 덤프와 격리 복원 점검
- PostgreSQL 도구: 복원 후 구조·행 수 점검
- restic: 암호화, 중복 제거, 7일 보관
- rclone: Supabase 파일 저장소 전체 동기화
- jq, Python 3, gzip

운영에 사용하기 전에 검증한 버전으로 고정합니다.

```bash
supabase --version
docker version
psql --version
restic version
rclone version
jq --version
python3 --version
```

## 6. 준비해야 할 비밀값

`topik-prod`에서 다음 값을 준비합니다.

- 데이터베이스 세션 연결 주소
- 파일 저장소 S3 호환 접속 주소와 전용 접근 키
- restic 저장소 암호
- 운영 보고용 공유 비밀값
- 개발 복사 보고용 공유 비밀값

두 보고용 비밀값은 반드시 서로 달라야 하며 Supabase 키를 재사용하지 않습니다.

```bash
openssl rand -hex 32 | sudo tee /etc/topik-backup/report-secret >/dev/null
openssl rand -hex 32 | sudo tee /etc/topik-backup/report-mirror-secret >/dev/null
openssl rand -base64 48 | sudo tee /etc/topik-backup/restic-password >/dev/null
sudo chown root:topikbackup /etc/topik-backup/report-secret \
  /etc/topik-backup/report-mirror-secret /etc/topik-backup/restic-password
sudo chmod 640 /etc/topik-backup/report-secret \
  /etc/topik-backup/report-mirror-secret /etc/topik-backup/restic-password
```

## 7. Vercel에서 설정할 내용

Production 환경에 다음 종류의 서버 전용 값을 설정한 뒤 새로 배포합니다.

- 운영 보고용 공유 비밀값
- `topik-prod` 서버 연결 주소, 서버 전용 키, 프로젝트 식별값
- 개발 복사 보고용 공유 비밀값
- `topik-dev` 서버 연결 주소, 서버 전용 키, 프로젝트 식별값

브라우저에 노출되는 설정에는 서버 전용 키를 넣지 않습니다. 수신 서버는 운영 보고를 `topik-prod`에만, 개발 복사 보고를 `topik-dev`에만 기록하도록 대상 값을 고정 확인합니다.

## 8. 파일 저장소 연결

rclone에 Supabase Storage의 S3 호환 접속 정보를 TOPIK 전용 설정으로 등록합니다. 기존 AI의 외부 사본 연결과 설정 파일을 공유하지 않습니다. 특정 버킷 이름을 고정하지 않고 루트에서 모든 버킷이 보이게 합니다.

```bash
sudo rclone --config /etc/topik-backup/rclone.conf config
sudo chown root:topikbackup /etc/topik-backup/rclone.conf
sudo chmod 640 /etc/topik-backup/rclone.conf
sudo -u topikbackup rclone --config /etc/topik-backup/rclone.conf lsd topik-prod-storage:
```

## 9. 실행 파일 설치

저장소 파일을 다음 위치로 복사합니다.

- `scripts/backup/topik-backup.sh` → `/opt/topik-backup/topik-backup.sh`
- `scripts/backup/send-report.py` → `/opt/topik-backup/send-report.py`
- `scripts/backup/backup.env.example` → `/etc/topik-backup/backup.env`
- `scripts/backup/systemd/*` → `/etc/systemd/system/`

```bash
sudo chown root:root /opt/topik-backup/topik-backup.sh /opt/topik-backup/send-report.py
sudo chmod 755 /opt/topik-backup/topik-backup.sh /opt/topik-backup/send-report.py
sudo chown root:topikbackup /etc/topik-backup/backup.env
sudo chmod 640 /etc/topik-backup/backup.env
```

`backup.env`에는 `topik-prod` 연결 정보, rclone 연결 이름, Vercel 보고 주소, 두 보고 비밀 파일 경로를 채웁니다. 개발 복사 비밀 파일을 지정하지 않으면 실제 백업과 운영 보고는 계속 실행되지만 localhost 복사본은 갱신되지 않습니다.

restic 저장소는 한 번만 초기화합니다.

```bash
sudo -u topikbackup RESTIC_REPOSITORY=/srv/topik-backup/repository \
  RESTIC_PASSWORD_FILE=/etc/topik-backup/restic-password restic init
```

## 10. 격리 복원 점검 환경

Supabase 공식 자체 호스팅 Docker 구성을 `/srv/topik-backup/drill-stack` 아래에만 설치합니다. 기존 AI의 PostgreSQL 대신 이 임시 환경에 복원하며, 점검이 끝나면 자동으로 중지합니다. 공식 구성은 여러 서비스가 함께 동작하므로 기존 AI 사용량을 제외하고도 CPU 4코어, 메모리 8GB 수준의 여유가 있는 시간에 점검합니다.

```bash
sudo install -d -m 700 -o topikbackup -g topikbackup /srv/topik-backup/drill-stack
sudo -u topikbackup touch /srv/topik-backup/drill-stack/.topik-backup-drill
```

공식 Docker 파일을 위 폴더에 복사하고 공식 도구로 점검 전용 비밀값을 생성합니다. 예제 비밀값을 그대로 사용하면 안 됩니다. 생성된 설정은 `/etc/topik-backup/drill.env`에 두고 권한을 `640`, 소유자를 `root:topikbackup`으로 제한합니다. 점검 스크립트는 전용 표시 파일과 공식 초기화 파일이 모두 있을 때만 동작합니다.

점검 설정의 대표 값은 다음과 같이 분리합니다. 아래 포트는 예시이며, 앞 단계에서 모두 비어 있음을 확인한 경우에만 사용합니다.

```dotenv
POSTGRES_PORT=55432
POOLER_PROXY_PORT_TRANSACTION=56543
KONG_HTTP_PORT=58000
KONG_HTTPS_PORT=58443
POOLER_TENANT_ID=topik-drill
SUPABASE_PUBLIC_URL=http://127.0.0.1:58000
API_EXTERNAL_URL=http://127.0.0.1:58000/auth/v1
SITE_URL=http://127.0.0.1:58000
```

공식 Docker 구성의 공개 포트 네 줄도 호스트 전체가 아니라 로컬 주소에만 연결되도록 바꿉니다.

```yaml
# API 게이트웨이
- 127.0.0.1:${KONG_HTTP_PORT}:8000/tcp
- 127.0.0.1:${KONG_HTTPS_PORT}:8443/tcp

# 데이터베이스 연결 풀
- 127.0.0.1:${POSTGRES_PORT}:5432
- 127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543
```

`/etc/topik-backup/backup.env`의 점검용 데이터베이스 주소는 같은 암호·세션 포트·점검 식별자를 사용해야 합니다. Docker 프로젝트 이름은 `topik-prod-backup-drill`로 고정합니다. 설정 후 실제 시작 전에 공개 범위를 확인합니다.

```bash
cd /srv/topik-backup/drill-stack
sudo -u topikbackup COMPOSE_PROJECT_NAME=topik-prod-backup-drill \
  docker compose --env-file /etc/topik-backup/drill.env config --format json \
  | jq '.services | to_entries[] | select(.value.ports) | {service: .key, ports: .value.ports}'
```

출력되는 네 포트의 호스트 주소가 모두 `127.0.0.1`이어야 합니다. `0.0.0.0` 또는 서버의 외부 주소가 보이면 예약 작업을 켜지 않습니다.

## 11. 예약 실행 전 수동 점검

```bash
sudo -u topikbackup /opt/topik-backup/topik-backup.sh backup
sudo -u topikbackup /opt/topik-backup/topik-backup.sh drill
sudo -u topikbackup /opt/topik-backup/topik-backup.sh flush
```

다음을 모두 확인합니다.

- 역할·구조·데이터 덤프가 검사에 통과함
- 핵심 테이블 행 수 비교가 통과함
- 전체 버킷 파일 개수와 용량 비교가 통과함
- restic 최신 스냅샷에 `topik-prod`와 작업 번호가 표시됨
- `/srv/topik-backup/outbox/primary`와 `/srv/topik-backup/outbox/mirror`에 미전송 파일이 없음
- 운영 관리자 화면과 localhost 관리자 화면에 5분 안에 같은 작업 결과가 표시됨
- localhost 화면에는 개발환경 복사본 안내와 마지막 복사 시각이 표시됨
- 완료 결과가 `시스템 로그`에 연결되고 `감사 로그`에는 생기지 않음

## 12. 예약 작업 켜기

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now topik-backup.timer
sudo systemctl enable --now topik-backup-drill.timer
sudo systemctl enable --now topik-backup-report-retry.timer
systemctl list-timers 'topik-backup*'
```

기존 AI crontab은 수정하지 않습니다. TOPIK 예약 이름은 모두 `topik-backup`으로 시작하므로 서로 별도로 조회하고 중지할 수 있습니다.

- 백업: 매일 한국 시간 `00:30`, `06:30`, `12:30`, `18:30`
- 복원 점검: 매월 첫째 일요일 한국 시간 `03:00`
- 서버가 꺼져 일정을 놓치면 부팅 뒤 한 번 보충 실행
- 이전 실행이 끝나지 않았으면 새 실행은 시작하지 않고 `지연` 보고
- 보내지 못한 운영 보고와 개발 복사 보고는 각각 5분마다 재시도

## 13. 보관과 장애 확인

- 실제 restic 백업은 7일 보관합니다.
- 관리자 화면용 실행 이력은 90일, 복원 점검 이력은 13개월 보관합니다.
- 보고 실패는 실제 백업 성공 여부를 바꾸지 않습니다.
- 운영과 개발 복사 대기열은 서로 독립적입니다.
- 디스크 사용률 80%는 주의, 90%는 위험입니다.
- 여유 공간이 50GB 미만이면 새 백업을 시작하지 않습니다.
- 같은 디스크를 쓰는 AI 데이터베이스의 증가량도 함께 확인합니다. TOPIK 백업이 7일 보관 기준을 지켜도 AI 데이터 증가로 디스크가 가득 찰 수 있습니다.

```bash
journalctl -u topik-backup.service --since today
journalctl -u topik-backup-drill.service --since '40 days ago'
sudo -u topikbackup RESTIC_REPOSITORY=/srv/topik-backup/repository \
  RESTIC_PASSWORD_FILE=/etc/topik-backup/restic-password restic snapshots
find /srv/topik-backup/outbox/primary /srv/topik-backup/outbox/mirror -type f
```

## 14. 운영 완료 조건

1. 기존 AI 컨테이너·예약 작업·사용 포트·디스크·메모리 기준값을 기록합니다.
2. TOPIK 경로·계정·Docker 프로젝트·systemd 예약이 기존 AI와 분리되었는지 확인합니다.
3. 백업 관리 migration을 `topik-prod`에 적용합니다.
4. Vercel의 운영·개발 복사용 서버 연결과 서로 다른 보고 비밀값을 설정하고 새로 배포합니다.
5. 실제 백업 1회와 격리 복원 점검 1회를 성공시킵니다.
6. 복원 점검 중에도 기존 AI 컨테이너가 정상이고 네 포트가 로컬 주소에만 열렸는지 확인합니다.
7. 핵심 테이블 행 수와 전체 파일 개수·용량 검사를 통과시킵니다.
8. 24시간 동안 4회 연속 결과가 5분 안에 운영 화면과 localhost 화면에 반영되는지 확인합니다.

코드와 문서만 준비된 상태는 운영 완료가 아닙니다. 위 여덟 단계의 실제 증거가 모두 있어야 완료로 봅니다.
