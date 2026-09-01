# Security audit — StellarInvoice

**Independent reviewer:** GPT-5.6 Sol, high reasoning

**Audited code baseline:** `f9817dffb62f89fb6ac0a07649b631e34e5b6778`

**Audit date:** 2026-09-01

**Decision:** **DEPLOY-READY** for EasyPanel, Stellar Testnet and fictitious BRLT. No Critical or High finding remains.

This decision covers repository readiness. It does not claim that the VPS is already healthy: public TLS/origin, attached persistent volumes, an exported offsite backup and a restore executed from the VPS backup remain post-deployment operational evidence.

Esta decisão cobre a prontidão do repositório. Ela não afirma que a VPS já está saudável: TLS/origem pública, volumes persistentes anexados, backup exportado para fora da VPS e restauração a partir do backup da VPS continuam sendo evidências operacionais pós-deploy.

## Task-by-task decision

| Implementation task | Status | Audited evidence |
| --- | --- | --- |
| 1 — Configuration | Approved | Immutable Testnet configuration, key validation, server-only secrets and Node.js 22 runtime. |
| 2 — Supabase/schema | Approved | Fifteen migrations; effective RLS, GRANT/REVOKE and RPC tests in PostgreSQL; real PostgREST exact-decimal proof. |
| 3 — Issuer bootstrap | Approved with documented deviation | Separate issuer/distributor, Friendbot, idempotent bootstrap and ignored `0600` secrets file. Public configuration is environment-backed instead of stored in a database. |
| 3A — Demo | Approved | Browser-only customer seed, persistent limits, proof of possession, BRLT reserve, global distributor mutex, expired-XDR recovery and real Testnet evidence. |
| 4 — Issuer auth/API | Approved | Origin/Testnet/payload-bound v2 challenge, durable one-use nonce, expiry and rate limit. |
| 5 — Trustline/payment | Approved | Review before and after signing; fee, sequence, timebounds, trustline limit, source, destination, asset, amount and memo validation. |
| 6 — Ledger verification | Approved | Horizon `payment.to`, successful transaction/operation, exact fields, ledger timestamp validity and retry idempotency. |
| 7 — Customer panel/explorer | Approved for customer/demo flow | Responsive states, exact invoice data, history, strictly validated Explorer link and Playwright retry proof without a second payment. |
| 8 — Operations | Approved in code | Non-root image, zero EasyPanel host ports, Caddy only on generic VPS, nonce CSP, target-specific preflight, private backup sidecar, ACL/RLS/RPC restore proof and rollback documentation. |

## Closed blocking findings

- XDR review now enforces fee `100`, positive sequence, short timebounds and the maximum trustline limit.
- A ledger payment observed before the due time can confirm after the due time; the ledger timestamp is retained.
- A retry after broadcast reuses the stored transaction hash/XDR and does not request another signature.
- PostgreSQL `numeric(20,7)` reaches the application through an exact text projection proven against PostgREST.
- Demo distribution serializes sequence allocation and can recover an expired prepared XDR.
- Preflight checks required Supabase/application secrets and exact `APP_ORIGIN=https://APP_DOMAIN`.
- Explorer links accept only lowercase 64-character transaction hashes.
- Production script CSP has a per-request nonce and no `unsafe-inline`.
- Backups reject failed or empty dumps, preserve ACLs and pass isolated data/RLS/permission restore checks.
- Payment verification uses the real Horizon payment destination field, `to`.
- EasyPanel uses one Compose file, routes only `app:3000`, keeps Supabase private and persists database, storage and backups in separate named volumes.
- The Alpine backup worker uses portable temporary files, PostgreSQL 17 and a fail-closed cleanup path proven before restore.

## Residual non-blocking findings

| Severity | Finding | Follow-up |
| --- | --- | --- |
| Medium | Administrative invoice validation does not explicitly cap amounts at Stellar's representable maximum. An extreme value can be stored but not paid. | Add a product-level maximum before accepting non-demo production issuers. |
| Medium | The authenticated verification route has no route-specific throttle; repeated calls can consume Horizon/database capacity. | Add distributed rate limiting before exposing the service beyond the controlled portfolio demo. |
| Medium | The functional specification includes issuer list/create screens; this delivery provides the secure issuer API and complete customer/demo journey, not those issuer screens. | Implement when issuer-facing browser operation enters scope. |
| Low | The demo mutex lease is fixed at two minutes; extreme Horizon latency may create a recoverable sequence collision. | Monitor and tune the lease after VPS observations. |
| Low | CI actions and container images use release versions/tags rather than immutable commit/digest pins. | Pin digests during supply-chain hardening. |

## Verification evidence

- Local: TypeScript, 24 test files / 55 tests, production build, 2 Playwright journeys and production dependency audit passed.
- GitHub Actions: [run 33500765783](https://github.com/LelloTereciani/stellar-invoice/actions/runs/33500765783) passed both `application` and `database` jobs, including ShellCheck, both Compose topologies, the Alpine backup worker and isolated restore.
- Database CI: all fifteen migrations, RLS/ACL/RPC lifecycle, real PostgREST decimal JSON and isolated backup/restore.
- Production image CI: EasyPanel publishes no Compose host ports, only Caddy publishes in the generic-VPS topology, the application runs as `nextjs`, and the response has the strict CSP.
- Public Testnet: the trustline, distribution and payment hashes are recorded in [testnet-evidence.md](testnet-evidence.md).
- Secret hygiene: no tracked seed/private key; ignored `demo-wallet.json` remains mode `0600`.

This automated independent review is not a substitute for an external organizational audit or a penetration test of the published VPS.
