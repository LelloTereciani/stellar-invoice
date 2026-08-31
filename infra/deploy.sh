#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
supabase_dir="$project_root/infra/supabase"
environment_file=${1:-"$supabase_dir/.env"}

"$project_root/infra/preflight.sh" "$environment_file"
docker compose --env-file "$environment_file" \
  -f "$supabase_dir/docker-compose.yml" \
  -f "$supabase_dir/docker-compose.stellar-invoice.yml" \
  -f "$supabase_dir/docker-compose.app.yml" build app
docker compose --env-file "$environment_file" \
  -f "$supabase_dir/docker-compose.yml" \
  -f "$supabase_dir/docker-compose.stellar-invoice.yml" \
  -f "$supabase_dir/docker-compose.app.yml" up --detach
docker compose --env-file "$environment_file" \
  -f "$supabase_dir/docker-compose.yml" \
  -f "$supabase_dir/docker-compose.stellar-invoice.yml" \
  -f "$supabase_dir/docker-compose.app.yml" ps
