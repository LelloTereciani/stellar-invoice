#!/bin/sh
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: infra/restore-check.sh /absolute/path/to/backup.sql.gz" >&2
  exit 1
fi
gzip -t "$1"

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
restore_container="stellar-invoice-restore-check-$$"
cleanup() { docker rm --force "$restore_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

docker run --detach --name "$restore_container" --env POSTGRES_PASSWORD=isolated-restore-only postgres:17-alpine >/dev/null
attempt=0
until docker exec "$restore_container" pg_isready --username postgres --dbname postgres >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo "Restore database did not become ready" >&2; exit 1; fi
  sleep 1
done

docker exec -i "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres < "$project_root/tests/integration/postgres-bootstrap.sql"
docker exec "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --command "drop schema public cascade"
gzip -dc "$1" | docker exec -i "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres
docker exec "$restore_container" psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --tuples-only --command \
  "select case when to_regclass('public.invoices') is not null and to_regclass('public.demo_distributions') is not null then 1 else 0 end" \
  | grep -q 1
echo "Isolated restore check passed."
