#!/usr/bin/env bash
set -uo pipefail

# topik-prod -> encrypted on-premise restic repository.
# Modes: backup | drill | flush
# Secrets and connection strings are read from the systemd EnvironmentFile and
# secret files. Reports contain aggregate metadata only.

MODE="${1:-backup}"
SOURCE_PROJECT="topik-prod"
SOURCE_PROJECT_REF="eymlabowhfgtxbiqwxqh"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/topik-backup}"
WORK_ROOT="${BACKUP_ROOT}/work"
OUTBOX_DIR="${BACKUP_ROOT}/outbox"
LOCK_FILE="${BACKUP_ROOT}/backup.lock"
RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-${BACKUP_ROOT}/repository}"
RESTIC_PASSWORD_FILE="${RESTIC_PASSWORD_FILE:-/etc/topik-backup/restic-password}"
REPORT_SECRET_FILE="${REPORT_SECRET_FILE:-/etc/topik-backup/report-secret}"
REPORT_MIRROR_SECRET_FILE="${REPORT_MIRROR_SECRET_FILE:-}"
MIN_FREE_BYTES="${MIN_FREE_BYTES:-53687091200}"
KEY_TABLES=(public.profiles public.admin_accounts public.notification_templates)
ACTIVE_WORK_DIR=''
MIRROR_REPORTING_ENABLED=0

export RESTIC_REPOSITORY RESTIC_PASSWORD_FILE

cleanup_work_dir() {
  if [[ -n "${ACTIVE_WORK_DIR}" && "${ACTIVE_WORK_DIR}" == "${WORK_ROOT}/"* && -d "${ACTIVE_WORK_DIR}" ]]; then
    rm -rf -- "${ACTIVE_WORK_DIR}"
  fi
}
trap cleanup_work_dir EXIT

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*" >&2
}

fail_setup() {
  log "$1"
  exit 2
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail_setup "required command missing: $1"
}

uuid() {
  cat /proc/sys/kernel/random/uuid
}

next_schedule_iso() {
  local today candidate epoch now_epoch
  today="$(TZ=Asia/Seoul date +%F)"
  now_epoch="$(date +%s)"
  for clock in 00:30 06:30 12:30 18:30; do
    candidate="$(TZ=Asia/Seoul date -d "${today} ${clock}" --iso-8601=seconds)"
    epoch="$(date -d "${candidate}" +%s)"
    if (( epoch > now_epoch )); then
      date -u -d "@${epoch}" +%Y-%m-%dT%H:%M:%SZ
      return
    fi
  done
  epoch="$(TZ=Asia/Seoul date -d "tomorrow 00:30" +%s)"
  date -u -d "@${epoch}" +%Y-%m-%dT%H:%M:%SZ
}

disk_used_percent() {
  df -P "${BACKUP_ROOT}" | awk 'NR == 2 { gsub(/%/, "", $5); print $5 + 0 }'
}

free_bytes() {
  df -PB1 "${BACKUP_ROOT}" | awk 'NR == 2 { print $4 }'
}

validate_environment() {
  [[ "${BACKUP_ROOT}" == /* ]] || fail_setup "BACKUP_ROOT must be absolute"
  [[ "${BACKUP_ROOT}" != "/" ]] || fail_setup "BACKUP_ROOT cannot be the filesystem root"
  [[ "${RESTIC_REPOSITORY}" == "${BACKUP_ROOT}/"* ]] || fail_setup "restic repository must stay inside BACKUP_ROOT"
  [[ -f "${BACKUP_ROOT}/.encrypted-volume-ready" ]] || fail_setup "encrypted-volume marker missing"
  [[ -s "${RESTIC_PASSWORD_FILE}" ]] || fail_setup "restic password file missing"
  [[ -s "${REPORT_SECRET_FILE}" ]] || fail_setup "report secret file missing"
  [[ -n "${REPORT_URL:-}" ]] || fail_setup "REPORT_URL missing"
  [[ "${REPORT_URL}" == https://* ]] || fail_setup "REPORT_URL must use HTTPS"
  if [[ -n "${REPORT_MIRROR_SECRET_FILE}" && -s "${REPORT_MIRROR_SECRET_FILE}" ]]; then
    MIRROR_REPORTING_ENABLED=1
  else
    log "development mirror reporting is disabled"
  fi
  mkdir -p "${WORK_ROOT}" "${OUTBOX_DIR}" "${OUTBOX_DIR}/primary" "${OUTBOX_DIR}/mirror"
  chmod 700 "${WORK_ROOT}" "${OUTBOX_DIR}" "${OUTBOX_DIR}/primary" "${OUTBOX_DIR}/mirror"
}

queue_report_target() {
  local payload="$1" report_id="$2" destination="$3" secret_file="$4" target_dir="$5" queued
  queued="${target_dir}/$(date -u +%Y%m%dT%H%M%S)-${report_id}.json"
  install -m 600 "${payload}" "${queued}"
  if python3 "${SCRIPT_DIR}/send-report.py" "${destination}" "${REPORT_URL}" "${secret_file}" "${queued}"; then
    rm -f -- "${queued}"
  else
    log "${destination} report queued for retry: ${report_id}"
  fi
}

queue_report() {
  local payload="$1" report_id="$2"
  queue_report_target "${payload}" "${report_id}" primary "${REPORT_SECRET_FILE}" "${OUTBOX_DIR}/primary"
  if (( MIRROR_REPORTING_ENABLED == 1 )); then
    queue_report_target "${payload}" "${report_id}" mirror "${REPORT_MIRROR_SECRET_FILE}" "${OUTBOX_DIR}/mirror"
  fi
}

flush_outbox_target() {
  local destination="$1" secret_file="$2" target_dir="$3" queued
  shopt -s nullglob
  for queued in "${target_dir}"/*.json; do
    if python3 "${SCRIPT_DIR}/send-report.py" "${destination}" "${REPORT_URL}" "${secret_file}" "${queued}"; then
      rm -f -- "${queued}"
    else
      break
    fi
  done
  shopt -u nullglob
}

flush_outbox() {
  flush_outbox_target primary "${REPORT_SECRET_FILE}" "${OUTBOX_DIR}"
  flush_outbox_target primary "${REPORT_SECRET_FILE}" "${OUTBOX_DIR}/primary"
  if (( MIRROR_REPORTING_ENABLED == 1 )); then
    flush_outbox_target mirror "${REPORT_MIRROR_SECRET_FILE}" "${OUTBOX_DIR}/mirror"
  fi
}

write_start_report() {
  local output="$1" report_id="$2" run_id="$3" started_at="$4" next_at="$5" disk="$6"
  jq -n \
    --arg report_type backup_started \
    --arg report_id "${report_id}" \
    --arg run_id "${run_id}" \
    --arg source_project "${SOURCE_PROJECT}" \
    --arg started_at "${started_at}" \
    --arg next_scheduled_at "${next_at}" \
    --argjson disk_used_percent "${disk}" \
    '{report_type:$report_type,report_id:$report_id,run_id:$run_id,source_project:$source_project,started_at:$started_at,next_scheduled_at:$next_scheduled_at,disk_used_percent:$disk_used_percent}' \
    > "${output}"
}

component_json() {
  local status="$1" size="$2" validation="$3" error_code="$4" object_count="${5:-}"
  if [[ -n "${object_count}" ]]; then
    jq -n \
      --arg status "${status}" \
      --argjson size_bytes "${size}" \
      --argjson object_count "${object_count}" \
      --arg validation_status "${validation}" \
      --arg error_code "${error_code}" \
      '{status:$status,size_bytes:$size_bytes,object_count:$object_count,validation_status:$validation_status} + (if $error_code == "" then {} else {error_code:$error_code} end)'
  else
    jq -n \
      --arg status "${status}" \
      --argjson size_bytes "${size}" \
      --arg validation_status "${validation}" \
      --arg error_code "${error_code}" \
      '{status:$status,size_bytes:$size_bytes,validation_status:$validation_status} + (if $error_code == "" then {} else {error_code:$error_code} end)'
  fi
}

write_completion_report() {
  local output="$1" report_id="$2" run_id="$3" started_at="$4" completed_at="$5" next_at="$6" overall="$7" database="$8" storage="$9" disk="${10}" error_code="${11}"
  jq -n \
    --arg report_type backup_completed \
    --arg report_id "${report_id}" \
    --arg run_id "${run_id}" \
    --arg source_project "${SOURCE_PROJECT}" \
    --arg started_at "${started_at}" \
    --arg completed_at "${completed_at}" \
    --arg next_scheduled_at "${next_at}" \
    --arg status "${overall}" \
    --argjson database "${database}" \
    --argjson storage "${storage}" \
    --argjson disk_used_percent "${disk}" \
    --arg error_code "${error_code}" \
    '{report_type:$report_type,report_id:$report_id,run_id:$run_id,source_project:$source_project,started_at:$started_at,completed_at:$completed_at,next_scheduled_at:$next_scheduled_at,status:$status,database:$database,storage:$storage,disk_used_percent:$disk_used_percent} + (if $error_code == "" then {} else {error_code:$error_code} end)' \
    > "${output}"
}

record_key_table_counts() {
  local output="$1" table count result='{}'
  for table in "${KEY_TABLES[@]}"; do
    [[ "${table}" =~ ^[a-z_]+\.[a-z_]+$ ]] || return 1
    count="$(psql "${SUPABASE_DB_URL}" -XAt -v ON_ERROR_STOP=1 -c "select count(*) from ${table}")" || return 1
    result="$(jq -c --arg table "${table}" --argjson count "${count}" '. + {($table):$count}' <<<"${result}")"
  done
  printf '%s\n' "${result}" > "${output}"
}

run_database_backup() {
  local stage="$1" combined_size=0 file
  mkdir -p "${stage}/database"
  if ! supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${stage}/database/roles.sql" --role-only >&2; then
    return 1
  fi
  if ! supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${stage}/database/schema.sql" >&2; then
    return 1
  fi
  if ! supabase db dump --db-url "${SUPABASE_DB_URL}" -f "${stage}/database/data.sql" --use-copy --data-only >&2; then
    return 1
  fi
  record_key_table_counts "${stage}/database/key-table-counts.json" || return 1

  for file in roles schema data; do
    gzip -9 "${stage}/database/${file}.sql" || return 1
    gzip -t "${stage}/database/${file}.sql.gz" || return 1
    combined_size=$((combined_size + $(stat -c %s "${stage}/database/${file}.sql.gz")))
  done
  (( combined_size >= 1024 )) || return 1
  zgrep -q "PostgreSQL database dump" "${stage}/database/schema.sql.gz" || return 1
  printf '%s\n' "${combined_size}"
}

run_storage_backup() {
  local stage="$1" source_json target_json source_count source_bytes target_count target_bytes
  mkdir -p "${stage}/storage"
  rclone sync "${STORAGE_RCLONE_REMOTE}:" "${stage}/storage" --fast-list --checksum || return 1
  source_json="$(rclone size "${STORAGE_RCLONE_REMOTE}:" --json)" || return 1
  target_json="$(rclone size "${stage}/storage" --json)" || return 1
  source_count="$(jq -r '.count' <<<"${source_json}")"
  source_bytes="$(jq -r '.bytes' <<<"${source_json}")"
  target_count="$(jq -r '.count' <<<"${target_json}")"
  target_bytes="$(jq -r '.bytes' <<<"${target_json}")"
  [[ "${source_count}" == "${target_count}" && "${source_bytes}" == "${target_bytes}" ]] || return 1
  printf '%s %s\n' "${target_count}" "${target_bytes}"
}

write_manifest() {
  local output="$1" run_id="$2" database_size="$3" storage_count="$4" storage_size="$5"
  jq -n \
    --arg run_id "${run_id}" \
    --arg source_project "${SOURCE_PROJECT}" \
    --argjson database_size_bytes "${database_size}" \
    --argjson storage_object_count "${storage_count}" \
    --argjson storage_size_bytes "${storage_size}" \
    '{run_id:$run_id,source_project:$source_project,database_size_bytes:$database_size_bytes,storage_object_count:$storage_object_count,storage_size_bytes:$storage_size_bytes}' \
    > "${output}"
}

report_delayed_run() {
  local started_at next_at run_id start_report completion_report database storage
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  next_at="$(next_schedule_iso)"
  run_id="$(uuid)"
  start_report="$(mktemp "${WORK_ROOT}/start.XXXXXX.json")"
  completion_report="$(mktemp "${WORK_ROOT}/complete.XXXXXX.json")"
  write_start_report "${start_report}" "$(uuid)" "${run_id}" "${started_at}" "${next_at}" "$(disk_used_percent)"
  queue_report "${start_report}" "$(jq -r '.report_id' "${start_report}")"
  database="$(component_json not_run 0 not_run BACKUP_LOCKED)"
  storage="$(component_json not_run 0 not_run BACKUP_LOCKED 0)"
  write_completion_report "${completion_report}" "$(uuid)" "${run_id}" "${started_at}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${next_at}" delayed "${database}" "${storage}" "$(disk_used_percent)" BACKUP_LOCKED
  queue_report "${completion_report}" "$(jq -r '.report_id' "${completion_report}")"
  rm -f -- "${start_report}" "${completion_report}"
}

run_backup() {
  local run_id started_at completed_at next_at stage start_report completion_report
  local db_status=failed db_validation=failed db_error=DATABASE_DUMP_FAILED db_size=0
  local storage_status=failed storage_validation=failed storage_error=STORAGE_SYNC_FAILED storage_size=0 storage_count=0
  local overall error_code='' database_json storage_json repository_ok=true storage_result

  if ! exec 9>"${LOCK_FILE}" || ! flock -n 9; then
    report_delayed_run
    return 0
  fi

  flush_outbox
  run_id="$(uuid)"
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  next_at="$(next_schedule_iso)"
  stage="${WORK_ROOT}/${run_id}"
  ACTIVE_WORK_DIR="${stage}"
  mkdir -p "${stage}"
  chmod 700 "${stage}"

  start_report="${stage}/backup-start.json"
  write_start_report "${start_report}" "$(uuid)" "${run_id}" "${started_at}" "${next_at}" "$(disk_used_percent)"
  queue_report "${start_report}" "$(jq -r '.report_id' "${start_report}")"

  if (( $(free_bytes) < MIN_FREE_BYTES )); then
    db_error=DISK_SPACE_LOW
    storage_error=DISK_SPACE_LOW
  else
    if db_size="$(run_database_backup "${stage}")"; then
      db_status=succeeded
      db_validation=passed
      db_error=''
    else
      db_size=0
      db_error=DATABASE_VALIDATION_FAILED
    fi

    if storage_result="$(run_storage_backup "${stage}")"; then
      read -r storage_count storage_size <<<"${storage_result}"
      storage_status=succeeded
      storage_validation=passed
      storage_error=''
    else
      storage_count=0
      storage_size=0
      storage_error=STORAGE_VALIDATION_FAILED
    fi
  fi

  write_manifest "${stage}/manifest.json" "${run_id}" "${db_size}" "${storage_count}" "${storage_size}"
  if [[ "${db_status}" == succeeded || "${storage_status}" == succeeded ]]; then
    local snapshot_kind=partial
    if [[ "${db_status}" == succeeded && "${storage_status}" == succeeded ]]; then
      snapshot_kind=complete
    fi
    if ! (cd "${stage}" && restic backup . --tag topik-prod --tag "${snapshot_kind}" --tag "run:${run_id}" --host topik-backup); then
      repository_ok=false
      db_status=failed
      db_validation=failed
      db_error=BACKUP_REPOSITORY_FAILED
      storage_status=failed
      storage_validation=failed
      storage_error=BACKUP_REPOSITORY_FAILED
    else
      restic forget --tag topik-prod --keep-within 7d --prune || log "restic retention cleanup failed"
    fi
  fi

  if [[ "${db_status}" == succeeded && "${storage_status}" == succeeded && "${repository_ok}" == true ]]; then
    overall=succeeded
  elif [[ "${db_status}" == succeeded || "${storage_status}" == succeeded ]]; then
    overall=partial_failure
    error_code="${db_error:-${storage_error}}"
  else
    overall=failed
    error_code="${db_error:-${storage_error}}"
  fi

  database_json="$(component_json "${db_status}" "${db_size}" "${db_validation}" "${db_error}")"
  storage_json="$(component_json "${storage_status}" "${storage_size}" "${storage_validation}" "${storage_error}" "${storage_count}")"
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  completion_report="${stage}/backup-complete.json"
  write_completion_report "${completion_report}" "$(uuid)" "${run_id}" "${started_at}" "${completed_at}" "${next_at}" "${overall}" "${database_json}" "${storage_json}" "$(disk_used_percent)" "${error_code}"
  queue_report "${completion_report}" "$(jq -r '.report_id' "${completion_report}")"
  flush_outbox
  [[ "${overall}" == succeeded ]]
}

validate_drill_stack_path() {
  local resolved_root resolved_stack
  [[ -n "${DRILL_STACK_DIR:-}" ]] || fail_setup "DRILL_STACK_DIR missing"
  resolved_root="$(realpath -e "${BACKUP_ROOT}")"
  resolved_stack="$(realpath -e "${DRILL_STACK_DIR}")"
  [[ "${resolved_stack}" == "${resolved_root}/drill-stack" ]] || fail_setup "drill stack must be BACKUP_ROOT/drill-stack"
  [[ -f "${resolved_stack}/.topik-backup-drill" ]] || fail_setup "drill stack marker missing"
  [[ -x "${resolved_stack}/run.sh" && -f "${resolved_stack}/reset.sh" ]] || fail_setup "official Supabase drill stack scripts missing"
}

reset_drill_stack() {
  validate_drill_stack_path
  [[ -s "${DRILL_ENV_TEMPLATE:-}" ]] || fail_setup "DRILL_ENV_TEMPLATE missing"
  [[ "${DRILL_COMPOSE_PROJECT:-}" == topik-prod-backup-drill ]] || fail_setup "unexpected drill compose project"
  (cd "${DRILL_STACK_DIR}" && COMPOSE_PROJECT_NAME="${DRILL_COMPOSE_PROJECT}" sh reset.sh -y) || return 1
  install -m 600 "${DRILL_ENV_TEMPLATE}" "${DRILL_STACK_DIR}/.env" || return 1
  (cd "${DRILL_STACK_DIR}" && COMPOSE_PROJECT_NAME="${DRILL_COMPOSE_PROJECT}" sh run.sh start) || return 1
  for _ in $(seq 1 60); do
    if psql "${DRILL_DB_URL}" -XAt -c 'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

verify_restored_counts() {
  local expected_file="$1" table expected actual
  for table in "${KEY_TABLES[@]}"; do
    expected="$(jq -r --arg table "${table}" '.[$table]' "${expected_file}")"
    actual="$(psql "${DRILL_DB_URL}" -XAt -v ON_ERROR_STOP=1 -c "select count(*) from ${table}")" || return 1
    [[ "${actual}" == "${expected}" ]] || return 1
  done
}

write_drill_report() {
  local output="$1" report_id="$2" drill_id="$3" source_run_id="$4" started_at="$5" completed_at="$6" status="$7" database_validation="$8" storage_validation="$9" error_code="${10}"
  jq -n \
    --arg report_type restore_drill_completed \
    --arg report_id "${report_id}" \
    --arg drill_id "${drill_id}" \
    --arg source_run_id "${source_run_id}" \
    --arg source_project "${SOURCE_PROJECT}" \
    --arg started_at "${started_at}" \
    --arg completed_at "${completed_at}" \
    --arg status "${status}" \
    --arg database_validation_status "${database_validation}" \
    --arg storage_validation_status "${storage_validation}" \
    --arg error_code "${error_code}" \
    '{report_type:$report_type,report_id:$report_id,drill_id:$drill_id,source_project:$source_project,started_at:$started_at,completed_at:$completed_at,status:$status,database_validation_status:$database_validation_status,storage_validation_status:$storage_validation_status} + (if $source_run_id == "" then {} else {source_run_id:$source_run_id} end) + (if $error_code == "" then {} else {error_code:$error_code} end)' \
    > "${output}"
}

run_drill() {
  local drill_id started_at completed_at work source_run_id report status=failed error_code=''
  local database_validation=failed storage_validation=failed source_storage_count source_storage_size restored_size_json
  drill_id="$(uuid)"
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  work="${WORK_ROOT}/drill-${drill_id}"
  ACTIVE_WORK_DIR="${work}"
  mkdir -p "${work}/restore" "${work}/sql"
  chmod 700 "${work}"

  source_run_id="$(restic snapshots --tag complete --latest 1 --json | jq -r '.[0].tags[]? | select(startswith("run:")) | sub("^run:";"")' | head -n 1)"
  if [[ ! "${source_run_id}" =~ ^[0-9a-f-]{36}$ ]]; then
    error_code=RESTORE_DATABASE_FAILED
  elif ! restic check --read-data; then
    error_code=RESTORE_STORAGE_FAILED
  elif ! restic restore latest --tag complete --target "${work}/restore"; then
    error_code=RESTORE_STORAGE_FAILED
  else
    local snapshot_root="${work}/restore"
    if [[ ! -f "${snapshot_root}/manifest.json" ]]; then
      error_code=RESTORE_STORAGE_FAILED
    else
      source_storage_count="$(jq -r '.storage_object_count' "${snapshot_root}/manifest.json")"
      source_storage_size="$(jq -r '.storage_size_bytes' "${snapshot_root}/manifest.json")"
      restored_size_json="$(rclone size "${snapshot_root}/storage" --json)"
      if [[ "$(jq -r '.count' <<<"${restored_size_json}")" == "${source_storage_count}" && "$(jq -r '.bytes' <<<"${restored_size_json}")" == "${source_storage_size}" ]]; then
        storage_validation=passed
      else
        error_code=RESTORE_STORAGE_FAILED
      fi

      if reset_drill_stack; then
        if gzip -dc "${snapshot_root}/database/roles.sql.gz" > "${work}/sql/roles.sql" \
          && gzip -dc "${snapshot_root}/database/schema.sql.gz" > "${work}/sql/schema.sql" \
          && gzip -dc "${snapshot_root}/database/data.sql.gz" > "${work}/sql/data.sql" \
          && psql \
          --single-transaction \
          --variable ON_ERROR_STOP=1 \
          --file "${work}/sql/roles.sql" \
          --file "${work}/sql/schema.sql" \
          --command 'SET session_replication_role = replica' \
          --file "${work}/sql/data.sql" \
          --dbname "${DRILL_DB_URL}" \
          && verify_restored_counts "${snapshot_root}/database/key-table-counts.json"; then
          database_validation=passed
        else
          error_code=RESTORE_DATABASE_FAILED
        fi
      else
        error_code=RESTORE_DATABASE_FAILED
      fi
    fi
  fi

  if [[ "${database_validation}" == passed && "${storage_validation}" == passed ]]; then
    status=succeeded
    error_code=''
  fi
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  report="${work}/restore-drill.json"
  write_drill_report "${report}" "$(uuid)" "${drill_id}" "${source_run_id:-}" "${started_at}" "${completed_at}" "${status}" "${database_validation}" "${storage_validation}" "${error_code}"
  queue_report "${report}" "$(jq -r '.report_id' "${report}")"
  if [[ -n "${DRILL_STACK_DIR:-}" && -x "${DRILL_STACK_DIR}/run.sh" ]]; then
    (cd "${DRILL_STACK_DIR}" && COMPOSE_PROJECT_NAME="${DRILL_COMPOSE_PROJECT}" sh run.sh stop) || true
  fi
  [[ "${status}" == succeeded ]]
}

for command in jq python3 flock df stat realpath; do
  require_command "${command}"
done
validate_environment

case "${MODE}" in
  backup)
    for command in supabase psql gzip zgrep rclone restic; do require_command "${command}"; done
    [[ -n "${SUPABASE_DB_URL:-}" ]] || fail_setup "SUPABASE_DB_URL missing"
    [[ -n "${STORAGE_RCLONE_REMOTE:-}" ]] || fail_setup "STORAGE_RCLONE_REMOTE missing"
    [[ "${SUPABASE_DB_URL}" == *"${SOURCE_PROJECT_REF}"* ]] || fail_setup "SUPABASE_DB_URL must target topik-prod"
    [[ "${STORAGE_RCLONE_REMOTE}" == topik-prod-storage ]] || fail_setup "storage remote must be topik-prod-storage"
    run_backup
    ;;
  drill)
    for command in psql gzip rclone restic; do require_command "${command}"; done
    [[ -n "${DRILL_DB_URL:-}" ]] || fail_setup "DRILL_DB_URL missing"
    [[ "${DRILL_DB_URL}" != "${SUPABASE_DB_URL:-}" ]] || fail_setup "drill database cannot equal production"
    [[ "${DRILL_DB_URL}" == *"@127.0.0.1:"* ]] || fail_setup "drill database must be local only"
    run_drill
    ;;
  flush)
    flush_outbox
    ;;
  *)
    fail_setup "unknown mode: ${MODE}"
    ;;
esac
