#!/bin/sh
set -eu

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ] || [ ! -f "$1" ]; then
  echo "Usage: infra/restore-check.sh /absolute/path/to/backup.sql.gz [expected-memo]" >&2
  exit 1
fi
expected_memo=${2:-}
case "$expected_memo" in *[!A-Za-z0-9-]* ) echo "Expected memo contains unsafe characters" >&2; exit 1 ;; esac
gzip -t "$1"

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
restore_container="stellar-invoice-restore-check-$$"
restore_sql=$(mktemp)
cleanup() {
  rm -f "$restore_sql"
  docker rm --force "$restore_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

gzip -dc "$1" > "$restore_sql"
[ -s "$restore_sql" ] || { echo "Restored SQL dump is empty" >&2; exit 1; }

docker run --detach --name "$restore_container" --env POSTGRES_PASSWORD=isolated-restore-only postgres:17-alpine >/dev/null
attempt=0
until docker exec "$restore_container" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo "Restore database did not become ready" >&2; exit 1; fi
  sleep 1
done

docker exec -i "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres < "$project_root/tests/integration/postgres-bootstrap.sql"
docker exec "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --command "drop schema public cascade"
docker exec -i "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres < "$restore_sql"
docker exec -i "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres \
  < "$project_root/tests/integration/restore-verification.sql"
if [ -n "$expected_memo" ]; then
  restored_count=$(docker exec "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres \
    --tuples-only --no-align --command \
    "select count(*) from public.invoices where memo = '$expected_memo' and amount_text = amount::text")
  [ "$restored_count" = 1 ] || { echo "Expected restored invoice data is missing or inexact" >&2; exit 1; }
fi
echo "Isolated restore check passed."
