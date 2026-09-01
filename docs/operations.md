# Operations

## Deployment gate

For EasyPanel, use only `docker-compose.easypanel.yml` and route its primary domain to `app:3000`; the platform owns TLS and no Compose service publishes host ports. Assign the primary domain before the final deploy, set `APP_ORIGIN=https://$(PRIMARY_DOMAIN)` and `APP_DOMAIN=$(PRIMARY_DOMAIN)`, then run `infra/preflight.sh /absolute/path/to/combined.env easypanel`. If the domain was assigned after an initial deploy, redeploy before testing any mutating route. Never use template defaults or commit the resulting environment file.

For a generic VPS without EasyPanel's proxy, use the three Compose files together, in this order: `infra/supabase/docker-compose.yml`, `infra/supabase/docker-compose.stellar-invoice.yml` and `infra/supabase/docker-compose.app.yml`. `infra/preflight.sh` accepts a combined local environment file and refuses template values or published services other than Caddy.

Only Caddy may publish ports 80 and 443. Confirm `docker compose config` contains no public Supabase, Postgres, Studio or pooler port.

## Bootstrap

Run `pnpm demo:bootstrap` once with a protected local `demo-wallet.json`. Transfer only the issuer public key and required runtime secrets to EasyPanel. Never paste the wallet file or a seed into Git, logs or chat.

## Backup and restore

On EasyPanel, the private `backup` sidecar runs at startup and daily, and writes to the separate `postgres-backups` named volume. It creates a compressed logical backup of the application `public` schema including its security ACLs, rejects empty/failed dumps, validates gzip integrity, and removes only matching backup files older than `BACKUP_RETENTION_DAYS` (14 by default). Configure encrypted offsite export or platform/VPS snapshots of that volume; keeping the only backup on the application VPS does not provide disaster recovery.

On a generic VPS, schedule `infra/backup.sh` daily with `BACKUP_DIR` pointing to persistent storage outside the repository and Postgres volume. This host-side script uses the same audited logical format. `BACKUP_DIR` applies to the generic VPS flow; EasyPanel uses the `postgres-backups` volume instead.

Quarterly, run `infra/restore-check.sh /absolute/path/to/backup.sql.gz`. It creates a disposable PostgreSQL 17 container, restores the dump, checks tables, RLS and effective table/RPC privileges, and always removes the isolated container. CI additionally verifies a data sentinel and its exact decimal projection. A restore check is not a production restore; production recovery requires a maintenance window and a reviewed destination.

## Rollback

Pin the previously known-good Git commit in EasyPanel and redeploy it. Do not roll back database schema by deleting volumes; apply a reviewed forward migration or restore the isolated tested backup. Disable `DEMO_MODE` during incident response.

## New and existing database volumes

All sixteen product migrations are mounted into the official Supabase initialization directory and run in order on a new volume. Existing volumes do not replay init scripts: apply only the newly reviewed migration files during a maintenance window, verify the GitHub `database` job, back up first, and never delete the volume as an upgrade mechanism.

For an existing EasyPanel database created before migration `0016`, first confirm a recent validated backup, deploy the reviewed Compose so the migration is mounted, then open the private `db` service terminal and run:

```sh
psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --file /docker-entrypoint-initdb.d/init-scripts/zzz-stellar-invoice-0016.sql
```

The command is idempotent because the migration replaces the existing function without deleting data. Do not delete or recreate `postgres-data` to apply it. Confirm the installed definition with:

```sh
psql --set ON_ERROR_STOP=1 --username postgres --dbname postgres --tuples-only --command "select pg_get_functiondef('public.create_demo_session(uuid,text,text,text,timestamptz)'::regprocedure) like '%>= 10%';"
```

The result must be `t` before retesting the public demo.
