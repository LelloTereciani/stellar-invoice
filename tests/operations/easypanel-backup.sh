#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
backup_script="$project_root/infra/easypanel-backup.sh"
test_root=$(mktemp -d)
cleanup() { rm -rf "$test_root"; }
trap cleanup EXIT INT TERM

mkdir -p "$test_root/bin" "$test_root/backups"
cp "$project_root/tests/operations/bin/docker" "$test_root/bin/pg_dump"
[ -x "$backup_script" ] || { echo "Missing executable EasyPanel backup worker" >&2; exit 1; }

if PATH="$test_root/bin:$PATH" \
  BACKUP_DIR="$test_root/backups" BACKUP_RUN_ONCE=enabled \
  PGHOST=db PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGPASSWORD=test-only \
  "$backup_script"; then
  echo "EasyPanel backup unexpectedly succeeded after pg_dump failure" >&2
  exit 1
fi

if find "$test_root/backups" -type f -name 'stellar-invoice-*.sql.gz' -print -quit | grep -q .; then
  echo "Failed EasyPanel backup left a misleading archive" >&2
  exit 1
fi

echo "EasyPanel backup failure propagation passed."
