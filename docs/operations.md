# Operations

## Deployment gate

Use the three Compose files together, in this order: `infra/supabase/docker-compose.yml`, `infra/supabase/docker-compose.stellar-invoice.yml` and `infra/supabase/docker-compose.app.yml`. Set all values from `infra/supabase/.env.example` plus `infra/.env.example` in EasyPanel; never use template defaults or commit the resulting files. `infra/preflight.sh` accepts a combined local environment file and refuses template values or published services other than Caddy.

Only Caddy may publish ports 80 and 443. Confirm `docker compose config` contains no public Supabase, Postgres, Studio or pooler port.

## Bootstrap

Run `pnpm demo:bootstrap` once with a protected local `demo-wallet.json`. Transfer only the issuer public key and required runtime secrets to EasyPanel. Never paste the wallet file or a seed into Git, logs or chat.

## Backup and restore

Schedule `infra/backup.sh` daily with `BACKUP_DIR` pointing to storage outside the repository and Postgres volume. It creates a compressed logical backup of the application `public` schema, validates gzip integrity, and removes only matching backup files older than `BACKUP_RETENTION_DAYS` (14 by default). Encrypt or snapshot that directory according to the VPS policy.

Quarterly, run `infra/restore-check.sh /absolute/path/to/backup.sql.gz`. It creates a disposable PostgreSQL 17 container, restores the dump, checks the required product tables and always removes the isolated container. A restore check is not a production restore; production recovery requires a maintenance window and a reviewed destination.

## Rollback

Pin the previously known-good Git commit in EasyPanel and redeploy it. Do not roll back database schema by deleting volumes; apply a reviewed forward migration or restore the isolated tested backup. Disable `DEMO_MODE` during incident response.

## New and existing database volumes

All eleven product migrations are mounted into the official Supabase initialization directory and run in order on a new volume. Existing volumes do not replay init scripts: apply only the newly reviewed migration files during a maintenance window, verify the GitHub `database` job, back up first, and never delete the volume as an upgrade mechanism.
