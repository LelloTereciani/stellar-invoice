# Security audit — StellarInvoice

**Auditor:** GPT-5.6 Sol, high reasoning.  
**Baseline reviewed:** `e4638d7`.  
**Decision:** deployment blocked until every blocking finding is remediated and independently revalidated.

## Findings and remediation record

| Plan task | Audit status | Evidence | Required remediation before approval |
| --- | --- | --- | --- |
| 1 — Configuration | Partial | Testnet guard and key validation exist. | Validate the complete runtime contract and bootstrap identity at startup; add asset and Horizon tests. |
| 2 — Supabase/schema | Blocked | Tables, RLS skeleton and private-port overlay exist. | Verify effective SQL privileges/RLS in real Postgres, provide wallet identity/JWT path, insert rejected attempts and connect app to the private network. |
| 3 — Issuer bootstrap | Partial | Separate Testnet issuer/distributor, Friendbot, trustline and local `0600` secret file. | Persist public configuration safely, make partial issuance idempotent and record two-run evidence. |
| 3A — Demo | Blocked | Browser-local seed, local trustline signature and fixed BRLT distribution exist. | Replace process memory with durable atomic sessions, wallet/IP limits, daily caps, reserve checks and proof of wallet possession. |
| 4 — Issuer API | Blocked | One-use signature challenge and server-owned invoice fields exist. | Replace raw in-memory UUID challenge with domain-bound Testnet authentication, durable nonce/session, CSRF/origin protections and rate limiting. |
| 5 — Customer payment | Blocked | Testnet XDR builders and Freighter connection exist. | Implement decoded transaction review, debtor enforcement, signing/submission UX and browser tests. |
| 6 — Ledger verification | Blocked | Horizon lookup and exact-field verifier exist. | Add row mapper, status/expiry/idempotency/rejected-attempt handling and route integration tests. |
| 7 — Invoice panel | Blocked | Minimal home page only. | Implement authenticated read API, invoice detail/status/history, explorer-link validation and E2E evidence. |
| 8 — Production operation | Blocked | Standalone Dockerfile and hidden Supabase ports exist. | Add unified app/Caddy TLS topology, non-root health-checked runtime, backups/restore/rollback documentation and deployment tests. |

## Critical findings

1. **C-01 — RPC privilege bypass.** `confirm_invoice` is `SECURITY DEFINER`; PostgreSQL grants function execution to `PUBLIC` by default. The follow-up migration explicitly revokes it from `PUBLIC`, `anon` and `authenticated`, granting only `service_role`. Real Postgres privilege proof remains required.
2. **C-02 — Failed ledger transaction confirmation.** Verification now rejects transactions or operations marked unsuccessful and validates an operation-level source when Horizon provides it. Remaining cases require integration tests.

## High findings

- Database rows use snake_case while the verifier expected camelCase; introduce a validated mapper and route-level test.
- Demo distribution and issuer challenges are unbounded process-local memory maps; they are not safe across replicas or against abuse.
- Expiry, rejected-attempt recording and idempotent confirmation are incomplete. The follow-up migration adds an expiry guard; lifecycle work remains.
- RLS lacks a verified wallet identity issuance and issuer-read path.
- No production app/Caddy topology, TLS, backup/restore drill, rollback path, health checks, or browser E2E evidence exists.

## Approval gates

The release is approved only after all task rows are marked complete, the critical/high findings are independently rechecked against the final commit, the real Postgres privilege/RLS tests pass, and the stack exposes only one HTTPS entrypoint.
