#!/bin/sh
set -eu

project_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
test_root=$(mktemp -d)
cleanup() { rm -rf "$test_root"; }
trap cleanup EXIT INT TERM

if PATH="$project_root/tests/operations/bin:$PATH" \
  BACKUP_DIR="$test_root/backups" BACKUP_LOCAL_POSTGRES=enabled \
  "$project_root/infra/backup.sh"; then
  echo "Backup unexpectedly succeeded after pg_dump failure" >&2
  exit 1
fi

if find "$test_root/backups" -type f -name 'stellar-invoice-*.sql.gz' -print -quit | grep -q .; then
  echo "Failed backup left a misleading archive" >&2
  exit 1
fi

echo "Backup failure propagation passed."
