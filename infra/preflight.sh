#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
supabase_dir="$project_root/infra/supabase"
environment_file=${1:-"$supabase_dir/.env"}

if [ ! -f "$environment_file" ]; then
  echo "Missing deployment environment file: $environment_file" >&2
  exit 1
fi

for required in APP_DOMAIN APP_ORIGIN SESSION_SECRET NEXT_PUBLIC_STELLAR_ISSUER SERVICE_ROLE_KEY POSTGRES_PASSWORD JWT_SECRET; do
  if ! grep -Eq "^${required}=.+" "$environment_file"; then
    echo "Missing required deployment variable: $required" >&2
    exit 1
  fi
done

if grep -Eq 'your-super-secret|example\.com|^SESSION_SECRET=$' "$environment_file"; then
  echo "Deployment environment still contains template values" >&2
  exit 1
fi
session_secret=$(sed -n 's/^SESSION_SECRET=//p' "$environment_file" | tail -n 1)
if [ "${#session_secret}" -lt 32 ]; then
  echo "SESSION_SECRET must contain at least 32 characters" >&2
  exit 1
fi

docker compose --env-file "$environment_file" \
  -f "$supabase_dir/docker-compose.yml" \
  -f "$supabase_dir/docker-compose.stellar-invoice.yml" \
  -f "$supabase_dir/docker-compose.app.yml" config --quiet

published=$(docker compose --env-file "$environment_file" \
  -f "$supabase_dir/docker-compose.yml" \
  -f "$supabase_dir/docker-compose.stellar-invoice.yml" \
  -f "$supabase_dir/docker-compose.app.yml" config --format json \
  | jq -r '.services | to_entries[] | select(.value.ports != null and (.value.ports | length > 0)) | .key' | sort -u)
if [ "$published" != "caddy" ]; then
  echo "Only Caddy may publish host ports; found: $published" >&2
  exit 1
fi

echo "Deployment preflight passed; only Caddy publishes host ports."
