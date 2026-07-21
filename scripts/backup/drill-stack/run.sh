#!/bin/sh
# 드릴 스택 시작/중지 래퍼. topik-backup.sh(reset_drill_stack)가 호출한다.
# 준비 완료 판정은 호출 측(psql 폴링)이 담당하므로 여기서는 기동만 한다.
set -eu
cd "$(dirname "$0")"
case "${1:-}" in
  start)
    docker compose --env-file .env up -d db auth storage
    ;;
  stop)
    docker compose --env-file .env stop
    ;;
  *)
    echo "usage: run.sh start|stop" >&2
    exit 2
    ;;
esac
