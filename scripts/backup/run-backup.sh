#!/usr/bin/env bash
# 수동 실행용 래퍼: backup.env를 로드한 뒤 topik-backup.sh를 실행한다.
# 사용: ~/topik-backup/bin/run-backup.sh [backup|drill|flush]
set -euo pipefail
ENV_FILE="${HOME}/topik-backup/etc/backup.env"
[[ -f "${ENV_FILE}" ]] || { echo "missing ${ENV_FILE}" >&2; exit 2; }
set -a
# shellcheck disable=SC1090
. "${ENV_FILE}"
set +a
export PATH="${HOME}/.local/bin:${PATH}"
exec "${HOME}/topik-backup/bin/topik-backup.sh" "${1:-backup}"
