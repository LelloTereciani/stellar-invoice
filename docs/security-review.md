# Security audit — StellarInvoice

**Independent reviewer:** GPT-5.6 Sol, high reasoning  
**Audited code baseline:** `fafd712d524cdc4c2fddae27625e92097adbc3bb`  
**Audit date:** 2026-09-01  
**Decision:** **DEPLOY-READY** for EasyPanel, Stellar Testnet and fictitious BRLT. No Critical or High finding remains.

This decision covers repository readiness. It does not claim that the VPS is already deployed: public TLS, attached persistent volumes, scheduled backups and a restore executed in the VPS environment remain post-deployment operational evidence.

Esta decisão cobre a prontidão do repositório. Ela não afirma que a VPS já está implantada: TLS público, volumes persistentes anexados, backups agendados e restauração executada no ambiente da VPS continuam sendo evidências operacionais pós-deploy.

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
| 8 — Operations | Approved in code | Non-root image, only Caddy exposed, nonce CSP, preflight, external backup path, ACL/RLS/RPC restore proof and rollback documentation. |

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

## Residual non-blocking findings

| Severity | Finding | Follow-up |
| --- | --- | --- |
| Medium | Administrative invoice validation does not explicitly cap amounts at Stellar's representable maximum. An extreme value can be stored but not paid. | Add a product-level maximum before accepting non-demo production issuers. |
| Medium | The authenticated verification route has no route-specific throttle; repeated calls can consume Horizon/database capacity. | Add distributed rate limiting before exposing the service beyond the controlled portfolio demo. |
| Medium | The functional specification includes issuer list/create screens; this delivery provides the secure issuer API and complete customer/demo journey, not those issuer screens. | Implement when issuer-facing browser operation enters scope. |
| Low | The demo mutex lease is fixed at two minutes; extreme Horizon latency may create a recoverable sequence collision. | Monitor and tune the lease after VPS observations. |
| Low | CI actions and container images use release versions/tags rather than immutable commit/digest pins. | Pin digests during supply-chain hardening. |
| Low | Preflight could repeat the runtime checks for Testnet name and issuer public-key format. | Add defense-in-depth validation in a maintenance pass. |

## Verification evidence

- Local: TypeScript, 24 test files / 55 tests, production build, 2 Playwright journeys and production dependency audit passed.
- GitHub Actions: [run 33465760020](https://github.com/LelloTereciani/stellar-invoice/actions/runs/33465760020) passed both `application` and `database` jobs, including ShellCheck, operational scripts and backup failure propagation.
- Database CI: all fifteen migrations, RLS/ACL/RPC lifecycle, real PostgREST decimal JSON and isolated backup/restore.
- Production image CI: only Caddy publishes host ports, the application runs as `nextjs`, and the response has the strict CSP.
- Public Testnet: the trustline, distribution and payment hashes are recorded in [testnet-evidence.md](testnet-evidence.md).
- Secret hygiene: no tracked seed/private key; ignored `demo-wallet.json` remains mode `0600`.

This automated independent review is not a substitute for an external organizational audit or a penetration test of the published VPS.
