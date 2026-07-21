#!/bin/sh
# 드릴 스택 초기화(컨테이너+볼륨 삭제). -y 필수. .env 없이도 동작해야 한다.
set -eu
cd "$(dirname "$0")"
[ "${1:-}" = "-y" ] || { echo "usage: reset.sh -y" >&2; exit 2; }
if [ -f .env ]; then
  docker compose --env-file .env down -v --remove-orphans || true
else
  docker compose down -v --remove-orphans || true
fi
