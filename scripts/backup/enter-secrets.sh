#!/usr/bin/env bash
# topik-prod 백업 비밀값 입력 도우미 v2 — 단계별 재시도 + 원인 진단
set -uo pipefail
ROOT="${HOME}/topik-backup"
ETC="${ROOT}/etc"
ENVF="${ETC}/backup.env"
export PATH="${HOME}/.local/bin:${PATH}"
umask 077

echo "==============================================="
echo " topik-prod backup secrets (v2)"
echo "==============================================="
echo "Supabase 대시보드(topik-prod)에서 준비:"
echo "  1) Connect -> Session pooler 연결 문자열 (비밀번호 포함)"
echo "  2) Project Settings -> Storage -> S3 access keys"
echo

# ---- [1/5] DB URL (성공할 때까지 재시도) ----
while true; do
  read -rsp "[1/5] SUPABASE_DB_URL (붙여넣기: 마우스 오른쪽 클릭, 화면에 안 보임): " DB_URL; echo
  [[ -n "${DB_URL}" ]] || { echo "  -> 빈 입력입니다. 다시."; continue; }
  if [[ "${DB_URL}" == *"[YOUR-PASSWORD]"* ]]; then
    echo "  -> [YOUR-PASSWORD] 자리를 실제 DB 비밀번호로 바꿔서 다시 붙여넣으세요."
    continue
  fi
  if [[ "${DB_URL}" != *eymlabowhfgtxbiqwxqh* ]]; then
    echo "  -> topik-prod(eymlabowhfgtxbiqwxqh) 연결 문자열이 아닙니다. dev 프로젝트 값일 수 있어요."
    continue
  fi
  HOST="$(python3 -c 'import sys,urllib.parse as u; print(u.urlsplit(sys.argv[1]).hostname or "")' "${DB_URL}" 2>/dev/null)"
  PORT="$(python3 -c 'import sys,urllib.parse as u; print(u.urlsplit(sys.argv[1]).port or 5432)' "${DB_URL}" 2>/dev/null)"
  if [[ -z "${HOST}" ]]; then
    echo "  -> URL 형식을 해석하지 못했습니다. postgres:// 로 시작하는 전체 문자열을 붙여넣으세요."
    echo "     비밀번호에 @ : / ? # % 특수문자가 있으면 URL 인코딩이 필요합니다 (@ -> %40 등)."
    continue
  fi
  echo "  -> ${HOST}:${PORT} 네트워크 확인..."
  if ! timeout 6 bash -c "cat </dev/null >/dev/tcp/${HOST}/${PORT}" 2>/dev/null; then
    echo "  -> 이 서버에서 ${HOST}:${PORT} 에 TCP 연결이 안 됩니다 (방화벽/아웃바운드 차단 가능)."
    echo "     일단 다시 시도하거나, 계속 안 되면 운영 담당자에게 알려주세요."
    continue
  fi
  echo "  -> DB 로그인 확인..."
  PSQL_ERR="$(PGCONNECT_TIMEOUT=10 psql "${DB_URL}" -XAt -c "select 'ok'" 2>&1)"
  if [[ "${PSQL_ERR}" == ok* ]]; then
    echo "  -> DB 인증 OK"
    break
  fi
  echo "  -> psql 실패: ${PSQL_ERR}"
  echo "     힌트: 비밀번호 오타이거나, 특수문자 URL 인코딩 문제일 수 있습니다."
done

# ---- [2~5/5] S3 (묶음 재시도) ----
while true; do
  read -rp  "[2/5] S3 Endpoint URL: " S3_EP
  [[ "${S3_EP}" == https://* ]] || { echo "  -> https:// 로 시작해야 합니다."; continue; }
  read -rp  "[3/5] S3 Region (예: ap-northeast-2): " S3_REGION
  read -rp  "[4/5] S3 Access key ID: " S3_KEY
  read -rsp "[5/5] S3 Secret access key (화면에 안 보임): " S3_SECRET; echo
  cat > "${ETC}/rclone.conf" <<CONF
[topik-prod-storage]
type = s3
provider = Other
access_key_id = ${S3_KEY}
secret_access_key = ${S3_SECRET}
endpoint = ${S3_EP}
region = ${S3_REGION}
force_path_style = true
no_check_bucket = true
CONF
  chmod 600 "${ETC}/rclone.conf"
  echo "  -> 버킷 목록 확인..."
  if RCLONE_CONFIG="${ETC}/rclone.conf" timeout 25 rclone lsd topik-prod-storage: 2>&1; then
    echo "  -> Storage 연결 OK"
    break
  fi
  echo "  -> rclone 실패. Endpoint/Region/키를 다시 확인하세요. (2번부터 재입력)"
done

DB_URL_IN="${DB_URL}" python3 - "${ENVF}" <<'PY'
import os, sys
path = sys.argv[1]
url = os.environ['DB_URL_IN']
lines = open(path, encoding='utf-8').read().splitlines()
out = ['SUPABASE_DB_URL=' + url if ln.startswith('SUPABASE_DB_URL=') else ln for ln in lines]
open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
PY
chmod 600 "${ENVF}"

for f in restic-password report-secret report-mirror-secret; do
  if [[ ! -s "${ETC}/${f}" ]]; then
    openssl rand -base64 48 > "${ETC}/${f}"
    chmod 600 "${ETC}/${f}"
    echo "생성: ${f}"
  fi
done

export RESTIC_REPOSITORY="${ROOT}/repository" RESTIC_PASSWORD_FILE="${ETC}/restic-password"
if [[ ! -f "${RESTIC_REPOSITORY}/config" ]]; then
  echo "restic 저장소 초기화 중..."
  restic init || { echo "restic init 실패 — 운영 담당자에게 알려주세요"; exit 1; }
else
  echo "restic 저장소 이미 초기화됨"
fi

touch "${ETC}/.secrets-ready"
echo
echo "완료! 모든 비밀값이 저장.검증됐습니다. 이 창은 닫아도 됩니다."
echo "(운영 담당자가 확인한 뒤 첫 백업을 시작합니다)"
