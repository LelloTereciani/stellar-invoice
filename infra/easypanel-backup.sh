#!/bin/sh
set -eu
umask 077

backup_dir=${BACKUP_DIR:-/backups}
retention_days=${BACKUP_RETENTION_DAYS:-14}
interval_seconds=${BACKUP_INTERVAL_SECONDS:-86400}

for required in PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD; do
  eval "required_value=\${$required:-}"
  [ -n "$required_value" ] || { echo "Missing backup variable: $required" >&2; exit 1; }
done

case "$retention_days" in ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 1 ;; esac
case "$interval_seconds" in ''|*[!0-9]*) echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 1 ;; esac
[ "$retention_days" -ge 1 ] || { echo "BACKUP_RETENTION_DAYS must be at least 1" >&2; exit 1; }
[ "$interval_seconds" -ge 3600 ] || { echo "BACKUP_INTERVAL_SECONDS must be at least 3600" >&2; exit 1; }

mkdir -p "$backup_dir"

create_backup() {
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  destination="$backup_dir/stellar-invoice-$timestamp.sql.gz"
  temporary_dump=$(mktemp "$backup_dir/.stellar-invoice-XXXXXX.sql")
  temporary_archive=$(mktemp "$backup_dir/.stellar-invoice-XXXXXX.sql.gz")
  backup_complete=false

  cleanup_backup() {
    rm -f "$temporary_dump" "$temporary_archive"
    if [ "$backup_complete" != true ]; then rm -f "$destination"; fi
  }
  trap cleanup_backup EXIT INT TERM

  # Preserve application ACLs; the Supabase platform schemas come from its pinned image.
  # Preserva ACLs da aplicacao; os schemas da plataforma Supabase vem da imagem fixada.
  if ! pg_dump --schema public --format plain --no-owner > "$temporary_dump"; then
    echo "PostgreSQL backup failed" >&2
    return 1
  fi
  [ -s "$temporary_dump" ] || { echo "Database dump is empty" >&2; return 1; }
  gzip -9 < "$temporary_dump" > "$temporary_archive"
  gzip -t "$temporary_archive"
  mv "$temporary_archive" "$destination"
  chmod 600 "$destination"
  backup_complete=true
  rm -f "$temporary_dump"
  trap - EXIT INT TERM
  find "$backup_dir" -type f -name 'stellar-invoice-*.sql.gz' -mtime "+$retention_days" -delete
  echo "Backup created: $destination"
}

create_backup
[ "${BACKUP_RUN_ONCE:-disabled}" = enabled ] && exit 0

while :; do
  sleep "$interval_seconds"
  create_backup
done
