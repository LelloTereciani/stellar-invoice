#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
supabase_dir="$project_root/infra/supabase"
environment_file=${1:-"$supabase_dir/.env"}
deployment_target=${2:-vps}

case "$deployment_target" in
  vps|easypanel) ;;
  *) echo "Deployment target must be 'vps' or 'easypanel'" >&2; exit 1 ;;
esac

if [ ! -f "$environment_file" ]; then
  echo "Missing deployment environment file: $environment_file" >&2
  exit 1
fi

for required in APP_DOMAIN APP_ORIGIN SESSION_SECRET NEXT_PUBLIC_STELLAR_ISSUER SERVICE_ROLE_KEY POSTGRES_PASSWORD JWT_SECRET ANON_KEY DASHBOARD_PASSWORD SECRET_KEY_BASE REALTIME_DB_ENC_KEY VAULT_ENC_KEY PG_META_CRYPTO_KEY LOGFLARE_PUBLIC_ACCESS_TOKEN LOGFLARE_PRIVATE_ACCESS_TOKEN S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET; do
  if ! grep -Eq "^${required}=.+" "$environment_file"; then
    echo "Missing required deployment variable: $required" >&2
    exit 1
  fi
done

# Generated deployment values must differ from every credential shipped in the template.
# Valores gerados para deploy devem diferir de toda credencial incluida no template.
for generated in ANON_KEY SERVICE_ROLE_KEY SECRET_KEY_BASE REALTIME_DB_ENC_KEY S3_PROTOCOL_ACCESS_KEY_ID S3_PROTOCOL_ACCESS_KEY_SECRET; do
  template_value=$(sed -n "s/^${generated}=//p" "$supabase_dir/.env.example" | tail -n 1)
  deployment_value=$(sed -n "s/^${generated}=//p" "$environment_file" | tail -n 1)
  if [ "$deployment_value" = "$template_value" ]; then
    echo "Deployment variable still uses the documented default: $generated" >&2
    exit 1
  fi
done

for jwt_variable in ANON_KEY SERVICE_ROLE_KEY; do
  jwt_value=$(sed -n "s/^${jwt_variable}=//p" "$environment_file" | tail -n 1)
  if ! printf '%s\n' "$jwt_value" | grep -Eq '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'; then
    echo "$jwt_variable must be a compact three-segment JWT" >&2
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
if ! grep -Eq '^NEXT_PUBLIC_STELLAR_ISSUER=G[A-Z2-7]{55}$' "$environment_file"; then
  echo "NEXT_PUBLIC_STELLAR_ISSUER must be a valid public Stellar account" >&2
  exit 1
fi
demo_mode=$(sed -n 's/^DEMO_MODE=//p' "$environment_file" | tail -n 1)
if [ "$demo_mode" = "enabled" ] && ! grep -Eq '^STELLAR_DISTRIBUTION_SECRET=S[A-Z2-7]{55}$' "$environment_file"; then
  echo "Enabled demo mode requires a valid STELLAR_DISTRIBUTION_SECRET" >&2
  exit 1
fi
if [ "$deployment_target" = easypanel ]; then
  compose_file="$project_root/docker-compose.easypanel.yml"
  docker compose --project-directory "$project_root" --env-file "$environment_file" \
    --file "$compose_file" config --quiet
  topology=$(docker compose --project-directory "$project_root" --env-file "$environment_file" \
    --file "$compose_file" config --format json)

  published=$(printf '%s' "$topology" | jq -r '.services | to_entries[] | select(.value.ports != null and (.value.ports | length > 0)) | .key')
  [ -z "$published" ] || { echo "EasyPanel services must not publish host ports: $published" >&2; exit 1; }
  [ "$(printf '%s' "$topology" | jq -r '.services.app.expose[0]')" = 3000 ] || { echo "EasyPanel app must expose port 3000" >&2; exit 1; }
  [ "$(printf '%s' "$topology" | jq -r '.services.app.environment.HOSTNAME')" = 0.0.0.0 ] || { echo "EasyPanel app must listen on 0.0.0.0" >&2; exit 1; }
  [ "$(printf '%s' "$topology" | jq -r '.services.app.environment.SUPABASE_URL')" = http://api-gw:8000 ] || { echo "EasyPanel app must use the private Supabase gateway" >&2; exit 1; }
  [ "$(printf '%s' "$topology" | jq -r '.services.backup.environment.PGHOST')" = db ] || { echo "EasyPanel backup must use the private database" >&2; exit 1; }

  fixed_names=$(printf '%s' "$topology" | jq -r '.services | to_entries[] | select(.value.container_name != null) | .key')
  [ -z "$fixed_names" ] || { echo "EasyPanel services must not fix container names: $fixed_names" >&2; exit 1; }
  migration_count=$(printf '%s' "$topology" | jq '[.services.db.volumes[] | select(.target | test("/zzz-stellar-invoice-[0-9]{4}\\.sql$"))] | length')
  [ "$migration_count" -eq 16 ] || { echo "EasyPanel topology must mount all 16 application migrations" >&2; exit 1; }

  echo "EasyPanel deployment preflight passed; route the primary HTTPS domain to app:3000."
  exit 0
fi

if ! grep -Eq '^BACKUP_DIR=/.+' "$environment_file"; then
  echo "BACKUP_DIR must be an absolute persistent path" >&2
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

echo "VPS deployment preflight passed; only Caddy publishes host ports."
