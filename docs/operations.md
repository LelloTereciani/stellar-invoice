# Operations

## Deployment gate

Use the three Compose files together: `infra/supabase/docker-compose.yml`, `infra/supabase/docker-compose.stellar-invoice.yml` and `infra/supabase/docker-compose.app.yml`. Set all values from both environment examples in EasyPanel; never use template defaults or commit the resulting files.

Only Caddy may publish ports 80 and 443. Confirm `docker compose config` contains no public Supabase, Postgres, Studio or pooler port.

## Bootstrap

Run `pnpm demo:bootstrap` once with a protected local `demo-wallet.json`. Transfer only the issuer public key and required runtime secrets to EasyPanel. Never paste the wallet file or a seed into Git, logs or chat.

## Backup and restore

Run a daily logical backup from the database container to storage outside the Postgres volume. Encrypt and retain backups according to the VPS policy. Quarterly, restore one backup into an isolated disposable stack, run the RLS/privilege checks from `docs/security-review.md`, then destroy that stack.

## Rollback

Pin the previously known-good Git commit in EasyPanel and redeploy it. Do not roll back database schema by deleting volumes; apply a reviewed forward migration or restore the isolated tested backup. Disable `DEMO_MODE` during incident response.
