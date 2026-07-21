#!/usr/bin/env bash
# stdin으로 받은 DB URL을 backup.env에 주입하고 접속을 검증한다(값 미출력).
set -euo pipefail
read -r NEWURL
NEWURL="${NEWURL%$'\r'}"
[[ "${NEWURL}" == *eymlabowhfgtxbiqwxqh* ]] || { echo "WRONG-REF"; exit 1; }
export NEWURL
python3 - <<'PY'
import os
p = os.path.expanduser('~/topik-backup/etc/backup.env')
url = os.environ['NEWURL']
lines = open(p, encoding='utf-8').read().splitlines()
out = ['SUPABASE_DB_URL=' + url if l.startswith('SUPABASE_DB_URL=') else l for l in lines]
open(p, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
PY
chmod 600 ~/topik-backup/etc/backup.env
HOST=$(python3 -c 'import os,urllib.parse as u; print(u.urlsplit(os.environ["NEWURL"]).hostname)')
PORT=$(python3 -c 'import os,urllib.parse as u; print(u.urlsplit(os.environ["NEWURL"]).port or 5432)')
timeout 6 bash -c "cat </dev/null >/dev/tcp/${HOST}/${PORT}" || { echo "TCP-FAIL ${HOST}:${PORT}"; exit 1; }
R=''
for i in 1 2 3; do
  R=$(PGCONNECT_TIMEOUT=10 psql "${NEWURL}" -XAt -c "select 'psql-ok'" 2>&1) && { echo "${R}"; exit 0; }
  sleep 5
done
echo "PSQL-FAIL: ${R}"
exit 1
