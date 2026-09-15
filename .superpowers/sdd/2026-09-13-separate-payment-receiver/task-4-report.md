# Task 4 report — demo, pre-signature UI and receiver evidence path

Date: 2026-09-14

Review-fix base commit: `76a276e` (`feat: complete separate receiver demo flow`)

Planned commit subject: `fix: address Task 4 review`

## Status

Local Task 4 implementation and review fixes through round 2/5 are implemented and validated; independent re-review of round 2 remains pending. Public Testnet proof is intentionally incomplete until the user-operated EasyPanel database migration, receiver environment configuration and application redeploy occur. The `AGENTS.md` pending reminder remains unchanged.

No active database, EasyPanel service, Docker runtime, deployment or public Testnet state was mutated. An explicitly named isolated database was created in the existing VPS PostgreSQL container for migration/integration testing and removed after verification.

## TDD evidence

### RED

Tests were added/changed before production code. The focused command was:

```sh
pnpm test tests/api/demo-resume.test.ts tests/api/demo-distribute.test.ts tests/migrations/invoices.test.ts tests/scripts/testnet-evidence.test.ts
```

Result: exit `1`; 4 test files failed, with 5 expected failures:

- distribute and resume routes called `ensureDemoInvoice` with only customer and issuer;
- migration `0018` lacked the receiver-aware function signature;
- `buildEvidenceSummary` did not exist and the old script attempted to read `demo-wallet.json` on import.

Operational RED:

```sh
sh tests/operations/easypanel-preflight.sh
sh tests/operations/easypanel-compose.sh
```

Result: exit `1`; preflight accepted a malformed receiver and Compose did not pass `STELLAR_PAYMENT_RECEIVER`.

Browser RED, run with local-loopback permission:

```sh
pnpm test:e2e --grep "reviews and signs the exact demo invoice"
```

Result: exit `1`; `Conta recebedora da fatura` was absent from the real rendered review surface.

### GREEN

Focused unit/API/migration/evidence tests:

```sh
pnpm test tests/api/demo-resume.test.ts tests/api/demo-distribute.test.ts tests/migrations/invoices.test.ts tests/scripts/testnet-evidence.test.ts
```

Result: exit `0`; 4 files, 10 tests passed.

Focused browser test:

```sh
pnpm test:e2e --grep "reviews and signs the exact demo invoice"
```

Result: exit `0`; 1 test passed. It supplied an issuer-destination XDR first, observed the application reject it before any Horizon submission, then supplied the receiver-destination XDR and observed one signed submission and confirmation.

### Review fix round 1/5

- Resume-route RED: the mismatch regression received HTTP 200 because the route bypassed `loadDemoDistributionConfig`; GREEN: `tests/api/demo-resume.test.ts` passed 5/5 and the RPC was not called for the rejected configuration.
- Atomic-migration RED: migration `0018` began with `ALTER TABLE`; GREEN: its first/last commands are now `BEGIN`/`COMMIT`, and `tests/migrations/invoices.test.ts` passed 4/4.
- Retry coverage: the restored independent E2E passed with one preparation, one Horizon submission and two verification attempts. A temporary mutation that stopped reusing `paymentHash` made the test fail with two preparations; after restoring the implementation, the test passed again.

## Final verification

| Command | Result |
| --- | --- |
| `pnpm vitest run tests/api/demo-resume.test.ts tests/migrations/invoices.test.ts` | exit `0`; 2 files, 9 tests passed |
| `pnpm test` | exit `0`; 30 files, 86 tests passed |
| `pnpm typecheck` | exit `0`; `tsc --noEmit` |
| `pnpm build` | exit `0`; Next.js 16.3.3 compiled, typechecked and generated 12 routes/pages |
| all four `tests/operations/*.sh` scripts | exit `0` |
| `pnpm test:e2e` | exit `0`; 5/5 browser tests passed |
| `git diff --check` | exit `0` |

Playwright emitted only the existing `NO_COLOR`/`FORCE_COLOR` warning. The build emitted only the configured experimental-option notice.

The authorized database integration ran only in `stellar_invoice_task4_fix_20260914`, an isolated database in PostgreSQL 17.6 inside `portfolio_web3_stellarinvoice-compose-db-1`. A new database initially exposed the expected missing Supabase bootstrap dependency at migration `0002`; it was recreated and received only an empty `auth` schema plus the standard `auth.jwt()` definition, with no tables or data copied from the active database. Migrations `0001` through `0018` then passed in order, including the visible `BEGIN`/`COMMIT` around `0018`, and this command completed with all assertions followed by its intended rollback:

```sh
docker exec -i portfolio_web3_stellarinvoice-compose-db-1 psql --set ON_ERROR_STOP=1 --username postgres --dbname stellar_invoice_task4_fix_20260914 < tests/integration/database.sql
```

An isolated atomicity probe deliberately failed with division by zero after adding a column inside a transaction (exit `3`); a fresh connection found zero `atomicity_probe` columns, proving the preceding DDL rolled back. The exact temporary database was then dropped, and a final `pg_database` query returned `0` matches.

No public `pnpm evidence:testnet` run was made: fresh on-chain proof must follow migration `0018`, environment configuration and application redeploy, and fabricated/reused hashes are prohibited.

## Implemented files

Application and UI:

- `app/lib/demo/persistent-session.ts`
- `app/api/demo/distribute/route.ts`
- `app/api/demo/resume/route.ts`
- `app/components/InvoiceDetail.tsx`
- `app/components/InvoicePortal.tsx`

Database and deployment:

- `supabase/migrations/0018_invoice_payment_receiver.sql`
- `docker-compose.easypanel.yml`
- `infra/supabase/docker-compose.stellar-invoice.yml`
- `infra/supabase/docker-compose.app.yml`
- `infra/preflight.sh`
- `.env.example`
- `infra/.env.example`

Evidence and operations documentation:

- `scripts/testnet-evidence.ts`
- `docs/testnet-evidence.md`
- `docs/operations.md`
- `infra/supabase/STELLAR_INVOICE.md`

Tests:

- `tests/api/demo-distribute.test.ts`
- `tests/api/demo-resume.test.ts`
- `tests/e2e/invoice-flow.spec.ts`
- `tests/integration/database.sql`
- `tests/migrations/invoices.test.ts`
- `tests/operations/easypanel-compose.sh`
- `tests/operations/easypanel-preflight.sh`
- `tests/scripts/testnet-evidence.test.ts`

## Security and UI self-review

- The replacement `SECURITY DEFINER` RPC validates customer, issuer and receiver G-key formats, inserts the receiver, preserves the existing invoice on retry, revokes the obsolete signature from `PUBLIC`, `anon`, `authenticated` and `service_role`, drops it, revokes the new signature from `PUBLIC`, `anon` and `authenticated`, and grants only `service_role`.
- Existing RLS is preserved. Migration `0018` remains additive: historical rows are backfilled before `NOT NULL` is applied.
- `STELLAR_PAYMENT_RECEIVER` is required, format-checked, passed only to the server app and never renamed `NEXT_PUBLIC_*`. Demo configuration still enforces receiver equals the public key derived from `STELLAR_DISTRIBUTION_SECRET`.
- Both demo distribution and resume routes now consume that receiver-to-distributor binding before they can call the receiver-aware RPC.
- The customer seed remains process-local in the evidence script and browser-local in the demo client; it is never printed or persisted by the evidence path. The evidence summary accepts and outputs only public keys, public hashes, a non-secret issuer trustline boolean and balance transitions.
- The actual pre-signature screen displays the full BRLT issuer, invoice receiver, exact debtor source, exact BRLT amount, memo and Stellar Testnet. Long public keys wrap instead of truncating. The existing explicit user action, pending-state lock and error/status announcements remain intact.
- Desktop/mobile overflow coverage and all browser flows passed. The focused E2E proves a wrong issuer destination never reaches Horizon and the receiver destination is signed once.
- The code-review subagent workflow was not used because the Task 4 instruction explicitly prohibited dispatching subagents; this report records the required direct self-review instead.

## Remaining concerns and handoff

1. Apply migration `0018` backup-first to the existing private database, verify the old/new signatures and privileges, and set `STELLAR_PAYMENT_RECEIVER` before redeploying the app.
2. After redeploy, use a fresh demo customer and run the revised evidence path. Record only new public hashes/keys and the measured treasury/customer balance transitions in `docs/testnet-evidence.md`.
3. Until that fresh Horizon evidence exists, the repository must not claim full receiver-separation completion and the `AGENTS.md` reminder must remain.

## Review fix round 2/5 — CI sentinel receiver and fail-fast SQL

Date: 2026-09-15. Base: `d7c4e078ac11161750d3640260243b0b97dafaa0`.

The single Important finding in `task-4-rereview-report.md` is addressed by three narrowly scoped files:

- `.github/workflows/ci.yml` now calls `psql --set ON_ERROR_STOP=1 --file tests/integration/postgrest-exact.sql`.
- `tests/integration/postgrest-exact.sql` supplies a checksum-valid Stellar receiver distinct from both debtor and issuer. It preserves the exact amount `1234567890123.1234567` and memo `postgrest-exact` without a float conversion.
- `tests/integration/postgrest-ci.test.ts` executes the actual extracted CI shell block, doubling only the external psql/Docker boundary unavailable locally. It checks the SQL consumed by psql, valid/distinct receiver, amount/memo, and the shell's failure exit before Docker starts. This does not replace the real database proof below.

TDD RED: `pnpm test tests/integration/postgrest-ci.test.ts` exited 1, with 2 expected failures: the original inline SQL supplied no receiver, and a sentinel SQL error continued into Docker (99 rather than SQL exit 3). GREEN: the same command passed 2/2. A later mutation removing only the workflow's `--set ON_ERROR_STOP=1` failed the fail-fast test (99 rather than 3); restoring the flag returned 2/2 passing.

Fresh final local verification for this round:

| Command | Result |
| --- | --- |
| `pnpm test tests/integration/postgrest-ci.test.ts tests/migrations/invoices.test.ts` | exit 0; 2 files / 6 tests |
| `pnpm test` | exit 0; 31 files / 88 tests |
| `pnpm typecheck` | exit 0 |
| all four existing `tests/operations/*.sh` scripts | exit 0; expected simulated backup failure still propagated |
| `git diff --check` | exit 0 |

Build and browser E2E were intentionally not rerun in round 2: only workflow SQL consumption and integration test/fixture files changed; there are no app/UI/runtime/bundler changes. The successful round-1 build and 5/5 E2E above are historical evidence, not round-2 executions. `shellcheck` is unavailable locally and was not installed; no shell production files changed.

### Fully disposable PostgreSQL/PostgREST/backup/restore proof

The VPS Docker daemon was used only to create fresh temporary targets, never to exec into or connect to the active Supabase cluster. The round-1 existing-container database evidence above is historical and was not repeated. No existing roles/passwords, production DB, services, deployment, secrets or public Testnet state were modified in round 2.

The two required images were already present and no pulls/downloads were needed:

- `postgres:17-alpine`: `sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73`.
- `postgrest/postgrest:v14.12`: `sha256:54000f24847d01a2c2302e0041cf0618b875c57fb48507d743cfa9aaa50bf43c`.

Exact targets (absence checked before creating them): database container `stellar-invoice-fix2-20260915-db`, REST container `stellar-invoice-fix2-20260915-postgrest`, one-shot backup worker `stellar-invoice-fix2-20260915-backup`, internal Docker network `stellar-invoice-fix2-20260915-net`, named volumes `stellar-invoice-fix2-20260915-data` and `stellar-invoice-fix2-20260915-restore-data`, and directory `/tmp/stellar-invoice-fix2-ci-20260915`. All container runs omitted port publication. Network `Internal=true` and database/REST `HostConfig.PortBindings={}` were checked during execution.

Sequence executed successfully twice, with fresh disposable Postgres state on each run (the second run explicitly named the backup worker):

1. Start fresh `postgres:17-alpine` on the internal network, database `stellar_invoice_test`, using integration-only credentials; wait for an actual SQL connection.
2. Apply `tests/integration/postgres-bootstrap.sql` only to this disposable cluster. Apply all 18 repository migrations in filename order with `psql --set ON_ERROR_STOP=1`; migration 0018 visibly completed `BEGIN` through `COMMIT`.
3. Run `tests/integration/database.sql`: all lifecycle/RLS/privilege assertions passed and the script ended in its intended `ROLLBACK`.
4. Run the exact reusable CI fixture with fail-fast psql. SQL verified `1234567890123.1234567|true` (receiver differs from issuer/debtor). Deliberately rerunning the fixture hit duplicate memo and real psql exited 3, proving SQL fail-fast at the actual boundary.
5. Start isolated PostgREST with disposable authenticator credentials and an integration-only HS256 JWT secret. Query it from the database container over the internal network. The literal response was `[{"amount_text":"1234567890123.1234567"}]`; the comparison passed without numeric coercion.
6. Run the unchanged real `infra/easypanel-backup.sh` in the named one-shot Postgres worker. The final backup was `stellar-invoice-20260915T101914Z.sql.gz` and `gzip -t` passed.
7. Run the unchanged real `infra/restore-check.sh "$backup" postgrest-exact`, including its role bootstrap, public-schema restore, `restore-verification.sql` and one-row exact-data assertion. A narrow task-only Docker wrapper added the internal network and separate named restore volume to the script's disposable `docker run`; it did not alter the production script. Result: `Isolated restore check passed.` Restore target: `stellar-invoice-restore-check-3677691` (first run: `stellar-invoice-restore-check-3670795`). No restore retry was needed.
8. Trapped cleanup removed only the exact temporary containers, both named volumes, network and directory. Post-cleanup inspections confirmed every exact target was absent; the driver exited 0 with `Cleanup verified for exact fix2 containers, network, volumes and directory; exit=0`.

This is an equivalent isolated execution of the database/PostgREST/backup/restore job sequence with private networking, not a GitHub Actions run or deployment. Network-host/public-port settings of the original CI job were intentionally not reused on the VPS. No push, deployment, active migration or original-checkout change was made.
