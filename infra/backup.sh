#!/bin/sh
set -eu
umask 077

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
supabase_dir="$project_root/infra/supabase"
environment_file=${ENV_FILE:-"$supabase_dir/.env"}
backup_dir=${BACKUP_DIR:-}
retention_days=${BACKUP_RETENTION_DAYS:-14}

if [ -z "$backup_dir" ]; then echo "BACKUP_DIR must point to persistent storage outside the repository" >&2; exit 1; fi
case "$backup_dir" in
  /|"$project_root"|"$project_root/"|"$project_root"/*) echo "Refusing unsafe backup directory" >&2; exit 1 ;;
  /*) ;;
  *) echo "BACKUP_DIR must be an absolute path" >&2; exit 1 ;;
esac
mkdir -p "$backup_dir"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$backup_dir/stellar-invoice-$timestamp.sql.gz"

if [ "${BACKUP_LOCAL_POSTGRES:-disabled}" = "enabled" ]; then
  # Match the PostgreSQL 17 server client in CI. / Use o cliente da mesma versão 17 do servidor no CI.
  docker run --rm --network host \
    --env PGHOST --env PGPORT --env PGDATABASE --env PGUSER --env PGPASSWORD \
    postgres:17-alpine pg_dump --schema public --format plain --no-owner --no-privileges \
    | gzip -9 > "$destination"
else
  docker compose --env-file "$environment_file" -f "$supabase_dir/docker-compose.yml" \
    exec -T db pg_dump --username postgres --dbname postgres --schema public --format plain --no-owner --no-privileges \
    | gzip -9 > "$destination"
fi
gzip -t "$destination"
find "$backup_dir" -type f -name 'stellar-invoice-*.sql.gz' -mtime "+$retention_days" -delete
echo "Backup created: $destination"
