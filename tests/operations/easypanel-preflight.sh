#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
test_root=$(mktemp -d)
environment_file="$test_root/easypanel.env"
cleanup() { rm -rf "$test_root"; }
trap cleanup EXIT INT TERM

# Replace every documented placeholder before exercising the production preflight.
# Substitui cada placeholder documentado antes de executar o preflight de producao.
sed \
  -e 's/your-super-secret/integration-secret/g' \
  -e 's/example\.com/invalid.test/g' \
  -e 's/this_password_is_insecure/integration-password/g' \
  -e 's/your-32-character/integration-32-character/g' \
  -e 's/your-encryption-key/integration-encryption-key/g' \
  -e 's/supa-storage/integration-storage/g' \
  -e 's/secret1234/integration-password/g' \
  -e 's/fake_/integration-/g' \
  -e 's/sk-proj-/disabled-/g' \
  -e 's/^SESSION_SECRET=$/SESSION_SECRET=integration-session-secret-at-least-32-characters/' \
  "$project_root/infra/supabase/.env.example" "$project_root/infra/.env.example" > "$environment_file"

{
  # EasyPanel expands this literal macro after the primary domain is assigned.
  # O EasyPanel expande esta macro literal depois que o dominio primario e atribuido.
  # shellcheck disable=SC2016
  printf '%s\n' 'APP_DOMAIN=$(PRIMARY_DOMAIN)'
  # shellcheck disable=SC2016
  printf '%s\n' 'APP_ORIGIN=https://$(PRIMARY_DOMAIN)'
  printf '%s\n' 'SESSION_SECRET=integration-session-secret-at-least-32-characters'
  printf '%s\n' 'NEXT_PUBLIC_STELLAR_ISSUER=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
  printf '%s\n' 'ANON_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl'
  printf '%s\n' 'SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl'
  printf '%s\n' 'SECRET_KEY_BASE=integration-secret-key-base-that-is-not-the-documented-default-value'
  printf '%s\n' 'REALTIME_DB_ENC_KEY=integrtestkey1234'
  printf '%s\n' 'S3_PROTOCOL_ACCESS_KEY_ID=11111111111111111111111111111111'
  printf '%s\n' 'S3_PROTOCOL_ACCESS_KEY_SECRET=2222222222222222222222222222222222222222222222222222222222222222'
} >> "$environment_file"

output=$("$project_root/infra/preflight.sh" "$environment_file" easypanel)
printf '%s\n' "$output" | grep -q 'EasyPanel deployment preflight passed'

malformed_environment="$test_root/malformed.env"
sed 's/^SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.*/SERVICE_ROLE_KEY=not-a-jwt/' "$environment_file" > "$malformed_environment"
if "$project_root/infra/preflight.sh" "$malformed_environment" easypanel >/dev/null 2>&1; then
  echo "EasyPanel preflight accepted a malformed service-role JWT" >&2
  exit 1
fi

echo "EasyPanel preflight regression passed."
