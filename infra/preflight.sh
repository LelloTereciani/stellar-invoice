#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
supabase_dir="$project_root/infra/supabase"
environment_file=${1:-"$supabase_dir/.env"}

if [ ! -f "$environment_file" ]; then
  echo "Missing deployment environment file: $environment_file" >&2
  exit 1
fi

for required in APP_DOMAIN APP_ORIGIN BACKUP_DIR SESSION_SECRET NEXT_PUBLIC_STELLAR_ISSUER SERVICE_ROLE_KEY POSTGRES_PASSWORD JWT_SECRET ANON_KEY DASHBOARD_PASSWORD SECRET_KEY_BASE REALTIME_DB_ENC_KEY VAULT_ENC_KEY PG_META_CRYPTO_KEY LOGFLARE_PUBLIC_ACCESS_TOKEN LOGFLARE_PRIVATE_ACCESS_TOKEN S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET; do
  if ! grep -Eq "^${required}=.+" "$environment_file"; then
    echo "Missing required deployment variable: $required" >&2
    exit 1
  fi
done

if grep -Eq 'your-super-secret|example\.com|this_password_is_insecure|your-32-character|your-encryption-key|supa-storage|secret1234|fake_|sk-proj-|^SESSION_SECRET=$' "$environment_file"; then
  echo "Deployment environment still contains template values" >&2
  exit 1
fi
app_domain=$(sed -n 's/^APP_DOMAIN=//p' "$environment_file" | tail -n 1)
app_origin=$(sed -n 's/^APP_ORIGIN=//p' "$environment_file" | tail -n 1)
if [ "$app_origin" != "https://$app_domain" ]; then
  echo "APP_ORIGIN must exactly equal https://APP_DOMAIN" >&2
  exit 1
fi
session_secret=$(sed -n 's/^SESSION_SECRET=//p' "$environment_file" | tail -n 1)
if [ "${#session_secret}" -lt 32 ]; then
  echo "SESSION_SECRET must contain at least 32 characters" >&2
  exit 1
fi
demo_mode=$(sed -n 's/^DEMO_MODE=//p' "$environment_file" | tail -n 1)
if [ "$demo_mode" = "enabled" ] && ! grep -Eq '^STELLAR_DISTRIBUTION_SECRET=S[A-Z2-7]{55}$' "$environment_file"; then
  echo "Enabled demo mode requires a valid STELLAR_DISTRIBUTION_SECRET" >&2
  exit 1
fi
backup_dir=$(sed -n 's/^BACKUP_DIR=//p' "$environment_file" | tail -n 1)
case "$backup_dir" in /*) ;; *) echo "BACKUP_DIR must be an absolute persistent path" >&2; exit 1 ;; esac

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
