#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
compose_file="$project_root/docker-compose.easypanel.yml"

[ -f "$compose_file" ] || { echo "Missing single-file EasyPanel Compose deployment" >&2; exit 1; }
if grep -Eq '^name:' "$compose_file"; then
  echo "EasyPanel Compose must not fix the top-level project name" >&2
  exit 1
fi

docker compose --project-directory "$project_root" \
  --env-file "$project_root/infra/supabase/.env.example" \
  --env-file "$project_root/infra/.env.example" \
  --file "$compose_file" config --quiet

services=$(docker compose --project-directory "$project_root" \
  --env-file "$project_root/infra/supabase/.env.example" \
  --env-file "$project_root/infra/.env.example" \
  --file "$compose_file" config --services)
printf '%s\n' "$services" | grep -qx app
printf '%s\n' "$services" | grep -qx backup
printf '%s\n' "$services" | grep -qx db
printf '%s\n' "$services" | grep -qx api-gw
if printf '%s\n' "$services" | grep -qx caddy; then
  echo "EasyPanel Compose must use the platform domain proxy, not an embedded Caddy" >&2
  exit 1
fi

published=$(docker compose --project-directory "$project_root" \
  --env-file "$project_root/infra/supabase/.env.example" \
  --env-file "$project_root/infra/.env.example" \
  --file "$compose_file" config --format json \
  | jq -r '.services | to_entries[] | select(.value.ports != null and (.value.ports | length > 0)) | .key')
[ -z "$published" ] || { echo "EasyPanel Compose must not publish host ports: $published" >&2; exit 1; }

app_port=$(docker compose --project-directory "$project_root" \
  --env-file "$project_root/infra/supabase/.env.example" \
  --env-file "$project_root/infra/.env.example" \
  --file "$compose_file" config --format json | jq -r '.services.app.expose[0]')
[ "$app_port" = 3000 ] || { echo "EasyPanel domain target must be app:3000" >&2; exit 1; }

topology=$(docker compose --project-directory "$project_root" \
  --env-file "$project_root/infra/supabase/.env.example" \
  --env-file "$project_root/infra/.env.example" \
  --file "$compose_file" config --format json)
database_volume=$(printf '%s' "$topology" | jq -r '.services.db.volumes[] | select(.target == "/var/lib/postgresql/data") | .source')
storage_volume=$(printf '%s' "$topology" | jq -r '.services.storage.volumes[] | select(.target == "/var/lib/storage") | .source')
backup_volume=$(printf '%s' "$topology" | jq -r '.services.backup.volumes[] | select(.target == "/backups") | .source')
[ "$database_volume" = postgres-data ] || { echo "PostgreSQL data must use a scoped named volume" >&2; exit 1; }
[ "$storage_volume" = storage-data ] || { echo "Storage data must use a scoped named volume" >&2; exit 1; }
[ "$backup_volume" = postgres-backups ] || { echo "Database backups must use a separate named volume" >&2; exit 1; }

[ "$(printf '%s' "$topology" | jq -r '.services.app.environment.HOSTNAME')" = 0.0.0.0 ] || { echo "App must listen on every container interface" >&2; exit 1; }
[ "$(printf '%s' "$topology" | jq -r '.services.app.environment.SUPABASE_URL')" = http://api-gw:8000 ] || { echo "App must use private Supabase routing" >&2; exit 1; }
[ "$(printf '%s' "$topology" | jq -r '.services.backup.environment.PGHOST')" = db ] || { echo "Backup must use the private PostgreSQL service" >&2; exit 1; }
[ "$(printf '%s' "$topology" | jq -r '.services.backup.environment.BACKUP_DIR')" = /backups ] || { echo "Backup must write only to its mounted volume" >&2; exit 1; }

fixed_names=$(printf '%s' "$topology" | jq -r '.services | to_entries[] | select(.value.container_name != null) | .key')
[ -z "$fixed_names" ] || { echo "EasyPanel Compose must not fix container names: $fixed_names" >&2; exit 1; }

migration_count=$(printf '%s' "$topology" | jq '[.services.db.volumes[] | select(.target | test("/zzz-stellar-invoice-[0-9]{4}\\.sql$"))] | length')
[ "$migration_count" -eq 16 ] || { echo "Expected all 16 application migrations, found $migration_count" >&2; exit 1; }

echo "Single-file EasyPanel topology passed."
