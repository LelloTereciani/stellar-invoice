# Task 4 report — demo, pre-signature UI and receiver evidence path

Date: 2026-09-14

Review-fix base commit: `76a276e` (`feat: complete separate receiver demo flow`)

Planned commit subject: `fix: address Task 4 review`

## Status

Local Task 4 implementation and review fix round 1/5 are complete and validated. Public Testnet proof is intentionally incomplete until the user-operated EasyPanel database migration, receiver environment configuration and application redeploy occur. The `AGENTS.md` pending reminder remains unchanged.

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
