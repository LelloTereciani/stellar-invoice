# StellarInvoice autonomous delivery

## Authority

- Work autonomously inside this repository: implement the approved specification and implementation plan, add tests, run validation, perform code/security review, commit, and push to `origin/main` without requesting per-task confirmation.
- Keep the project restricted to Stellar Testnet, fictitious BRLT, Docker-hosted Supabase, and the user-approved autonomous demonstration mode.
- Generate client demo keys only in the browser; never send, persist, log, or commit customer seed phrases.
- Use English and Portuguese for comments that explain non-obvious business, security, or technical decisions. Do not add redundant comments.

## Pending implementation reminder

- At the start of the next work session in this repository, point to `docs/superpowers/specs/2026-09-21-wallet-session-and-receiver-ux-design.md` and continue from its approved design. The user explicitly deferred correction and implementation to that session.
- Start by reproducing and diagnosing the live `Wallet challenge signature is invalid` failure. The observed state was a demo wallet active in StellarInvoice while Freighter account `GDAD6...ZJRF` was detected but not authenticated or active.
- Implement an atomic demo-to-Freighter session switch, real demo logout after successful replacement, persistent Portuguese frontend status, wallet balances/trustline, separate **A pagar** and **A receber** views, and a receiver snapshot signed per real invoice.
- Preserve a dormant demo key only for explicit recovery; never auto-reactivate it after logout. Keep the demo's configured receiver bound to its distribution account and never place a personal Freighter secret on the server.
- Remove this reminder only after the implementation, independent review, visible browser verification, and fresh correlated Stellar Testnet evidence are complete. Deployment and active-database changes remain separately controlled.

## Deployment boundary

- The user configures EasyPanel from the GitHub repository. Do not alter VPS services, Docker runtime, EasyPanel configuration, DNS, domains, or production secrets directly.
- If the execution environment requires an approval prompt for network, package installation, Docker, or remote Git, make the scoped request and continue after it is granted.

## Delivery

- Keep commits focused and push validated increments to GitHub.
- Never publish or enable Stellar mainnet, real-money handling, client-key custody, or Supabase Cloud.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
