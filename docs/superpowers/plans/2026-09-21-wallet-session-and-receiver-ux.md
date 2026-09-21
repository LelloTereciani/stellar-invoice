# Wallet Session and Receiver UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Every functional change starts with a failing focused test and receives an independent Sol/high review before completion.

**Goal:** Make the authenticated StellarInvoice identity explicit, switch atomically between demo and Freighter, expose wallet balances and payable/receivable invoices, and bind a validated receiver to every real invoice.

**Architecture:** The server cookie is the source of truth for the active application identity. Browser storage may retain a dormant demo secret, but an explicit mode marker and a valid server session are required before it becomes active. Wallet status and invoice roles are derived from that authenticated public key. Real invoice authorization includes the receiver in its canonical signed payload; the autonomous demo keeps using its configured distribution/treasury receiver.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, `@stellar/stellar-sdk` 16, Freighter API 6, Horizon Testnet, self-hosted Supabase/PostgreSQL, Vitest 4, and Playwright 1.62.

**Spec:** `docs/superpowers/specs/2026-09-21-wallet-session-and-receiver-ux-design.md`

## Global Constraints

- Keep the product on Stellar Testnet with fictitious BRLT only.
- Never send, persist, log, or commit a personal Freighter secret or reusable wallet signature.
- Preserve the currently valid application session until replacement authentication succeeds.
- Treat the session cookie, not Freighter account detection or local storage, as proof of an active identity.
- Keep `STELLAR_PAYMENT_RECEIVER` as the autonomous-demo receiver/default only; it must not override a receiver signed into a real invoice.
- Do not rewrite existing invoice receivers or add a destructive database migration.
- Do not change EasyPanel, the VPS, production secrets, or the active database in this implementation.
- Preserve and do not stage the pre-existing edits in `.github/workflows/ci.yml` and `tests/integration/postgrest-ci.test.ts`.
- Use focused tests after each red/green cycle. Run the full suite once after all functional changes or earlier only when shared infrastructure changes make focused evidence insufficient.

## Review Focus

Every task review must check:

1. authentication cannot be granted by client state alone;
2. demo and Freighter cannot both be represented as active;
3. receiver access never grants debtor payment authority;
4. canonical signatures cover every mutable invoice field, including the receiver;
5. no secret, session cookie, challenge signature, or private ledger material is logged.

---

### Task 1: Correct SEP-53 wallet challenge verification

**Files:**

- Modify: `app/lib/auth/wallet-message.ts`
- Modify: `app/lib/stellar/demo-wallet-client.ts`
- Test: `tests/auth/persistent-wallet-challenge.test.ts`
- Test: `tests/auth/wallet-message.test.ts`
- Test: `tests/stellar/demo-wallet-client.test.ts`
- Test: `tests/stellar/freighter-client.test.ts`

**Interfaces:**

- `verifyWalletChallengeSignature(publicKey, message, signatureBase64): boolean` verifies a SEP-53 signed message.
- Demo authentication signs the same SEP-53 payload as Freighter through `Keypair.signMessage(message)`.
- Existing nonce, expiry, one-time-consumption, origin, and account-binding checks remain unchanged.

- [ ] **Step 1: Add focused failing tests for the installed Freighter signing format**

  Build signatures with `Keypair.signMessage(challenge.message)` and assert that verification succeeds. Sign the raw UTF-8 message with `Keypair.sign(Buffer.from(message))` and assert that it does not satisfy the SEP-53 verifier.

- [ ] **Step 2: Run the focused tests and confirm the expected failure**

  Run: `pnpm vitest run tests/auth/wallet-message.test.ts tests/auth/persistent-wallet-challenge.test.ts tests/stellar/demo-wallet-client.test.ts tests/stellar/freighter-client.test.ts`

- [ ] **Step 3: Implement SEP-53 verification and demo signing**

  Use Stellar SDK `Keypair.fromPublicKey(publicKey).verifyMessage(message, signatureBytes)` on the server and `wallet.signMessage(challenge.message)` in the demo client. Keep Base64 only as the transport encoding for the signature bytes.

- [ ] **Step 4: Run the focused tests and confirm success**

  Run the command from Step 2.

- [ ] **Step 5: Review the diff and commit the isolated fix**

  Run: `git diff --check`

  Commit only the files listed in this task with message `fix(auth): verify wallet challenges with SEP-53`.

---

### Task 2: Add authoritative session inspection and logout APIs

**Files:**

- Create: `app/api/auth/session/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Modify: `app/lib/auth/wallet-session.ts`
- Test: `tests/api/wallet-auth.test.ts`

**Interfaces:**

- `GET /api/auth/session` returns `{ authenticated: false }` or `{ authenticated: true, publicKey }` from the verified HTTP-only session cookie.
- `POST /api/auth/logout` validates the request origin, clears `stellar_invoice_session`, and returns `{ authenticated: false }`.
- Neither route accepts a client-provided public key as proof of identity.

- [ ] **Step 1: Add failing route tests**

  Cover valid session inspection, missing/invalid/expired cookie, successful logout, untrusted origin rejection, and deletion-cookie attributes.

- [ ] **Step 2: Run the focused tests and confirm failure**

  Run: `pnpm vitest run tests/api/wallet-auth.test.ts`

- [ ] **Step 3: Implement the routes using Next.js 16 cookie APIs**

  Read the installed Next.js route-handler/cookie guidance before editing. Reuse the existing signed-session verifier and cookie configuration. Clear the cookie with the same path and security attributes used when it is created.

- [ ] **Step 4: Run the focused tests and confirm success**

  Run the command from Step 2.

- [ ] **Step 5: Review and commit**

  Run: `git diff --check`

  Commit only this task with message `feat(auth): expose wallet session and logout`.

---

### Task 3: Implement the atomic active-wallet state machine

**Files:**

- Create: `app/lib/wallet/session-state.ts`
- Create: `app/lib/wallet/active-mode-client.ts`
- Modify: `app/hooks/useFreighter.ts`
- Modify: `app/lib/stellar/freighter-client.ts`
- Modify: `app/lib/stellar/demo-wallet-client.ts`
- Test: `tests/wallet/session-state.test.ts`
- Test: `tests/wallet/active-mode-client.test.ts`
- Test: `tests/stellar/freighter-client.test.ts`
- Test: `tests/stellar/demo-wallet-client.test.ts`

**Interfaces:**

- Active identity: `none | demo(publicKey) | freighter(publicKey)`.
- Freighter state: `unavailable | detected | authenticating | authenticated | rejected | failed` with detected public key kept separate from the active identity.
- Transition metadata: action, timestamp, Portuguese user-safe message, and optional technical detail.
- Browser mode storage contains only `demo | freighter`; the existing demo secret stays dormant unless the user explicitly enters/resumes demo.

- [ ] **Step 1: Add pure reducer/state tests**

  Cover demo-active plus detected Freighter, pending switch retaining demo, successful replacement, rejection retaining demo, logout to none, refresh with valid server session, and dormant demo key not reactivating itself.

- [ ] **Step 2: Run the focused tests and confirm failure**

  Run: `pnpm vitest run tests/wallet/session-state.test.ts tests/wallet/active-mode-client.test.ts tests/stellar/freighter-client.test.ts tests/stellar/demo-wallet-client.test.ts`

- [ ] **Step 3: Implement the pure state machine and mode storage**

  Make impossible combinations unrepresentable where practical. Keep transition functions pure and use timestamp injection in tests.

- [ ] **Step 4: Integrate session restoration and atomic switching in `useFreighter`**

  On load, inspect `/api/auth/session`; do not infer authentication from a demo secret. During Freighter authentication, expose the detected address while retaining the current active session. Only replace active mode after `/api/auth/verify` succeeds. On failure, retain the prior session and expose a Portuguese retry state. On logout, call the server endpoint, clear active mode/state, and leave any demo key dormant.

- [ ] **Step 5: Prevent duplicate prompts and stale-account completion**

  Deduplicate concurrent connect attempts. If the selected Freighter account changes while authentication is pending, discard that attempt and require a fresh challenge.

- [ ] **Step 6: Run focused tests and confirm success**

  Run the command from Step 2.

- [ ] **Step 7: Review and commit**

  Run: `git diff --check`

  Commit only this task with message `feat(wallet): make active session switching atomic`.

---

### Task 4: Add authenticated wallet balances and trustline status

**Files:**

- Create: `app/lib/stellar/account-summary.ts`
- Create: `app/api/wallet/status/route.ts`
- Test: `tests/stellar/account-summary.test.ts`
- Test: `tests/api/wallet-status.test.ts`

**Interfaces:**

- `loadAccountSummary(publicKey, config, fetchImpl)` returns XLM balance, exact-issuer BRLT balance, trustline presence, authorization state, limit, and refreshed timestamp.
- `GET /api/wallet/status` derives the public key from the valid session cookie and never accepts an address query parameter.
- Horizon outage returns a recoverable service error without invalidating the wallet session.

- [ ] **Step 1: Add failing account-summary tests**

  Cover XLM selection, exact asset-code and issuer matching, absent trustline, unauthorized trustline, trustline limit, malformed Horizon response, not-found account, and upstream failure.

- [ ] **Step 2: Add failing route tests**

  Cover unauthenticated rejection, session-derived address, ignored/rejected arbitrary-address input, successful response, and degraded Horizon response.

- [ ] **Step 3: Run the focused tests and confirm failure**

  Run: `pnpm vitest run tests/stellar/account-summary.test.ts tests/api/wallet-status.test.ts`

- [ ] **Step 4: Implement the Horizon adapter and authenticated route**

  Validate response fields before returning them. Use the configured Testnet Horizon endpoint and exact configured BRLT issuer.

- [ ] **Step 5: Run focused tests and confirm success**

  Run the command from Step 3.

- [ ] **Step 6: Review and commit**

  Run: `git diff --check`

  Commit only this task with message `feat(wallet): expose authenticated account status`.

---

### Task 5: Add server-enforced payable and receivable invoice views

**Files:**

- Modify: `app/lib/invoices/service.ts`
- Modify: `app/lib/invoices/client-types.ts`
- Modify: `app/api/invoices/route.ts`
- Modify: `app/api/invoices/[id]/route.ts`
- Test: `tests/api/customer-invoices.test.ts`
- Test: `tests/invoices/mapper.test.ts`

**Interfaces:**

- `GET /api/invoices?role=payable|receivable` filters by authenticated wallet as debtor or receiver respectively.
- `GET /api/invoices/:id` permits the authenticated debtor or receiver and returns `viewerRole: "debtor" | "receiver"`.
- Payment creation, submission, and verification routes continue requiring the debtor role.

- [ ] **Step 1: Add failing role-authorization tests**

  Cover payable and receivable filters, invalid role rejection, unrelated-wallet denial, receiver detail access, debtor detail access, and receiver denial on every payment endpoint.

- [ ] **Step 2: Run focused tests and confirm failure**

  Run: `pnpm vitest run tests/api/customer-invoices.test.ts tests/invoices/mapper.test.ts`

- [ ] **Step 3: Implement role-aware service methods and routes**

  Keep the authenticated wallet server-derived. For detail lookup, fetch the row by ID and return it only after checking that the session wallet equals debtor or receiver. Preserve debtor-only helpers for payment routes.

- [ ] **Step 4: Run focused tests and confirm success**

  Run the command from Step 2.

- [ ] **Step 5: Review and commit**

  Run: `git diff --check`

  Commit only this task with message `feat(invoices): separate payables and receivables`.

---

### Task 6: Bind a validated receiver into real invoice authorization

**Files:**

- Modify: `app/lib/auth/issuer-message.ts`
- Modify: `app/lib/auth/persistent-challenge.ts`
- Modify: `app/api/admin/challenge/route.ts`
- Modify: `app/api/admin/invoices/route.ts`
- Modify: `app/lib/invoices/validation.ts`
- Reuse or modify: `app/lib/stellar/account-summary.ts`
- Test: `tests/auth/issuer-message.test.ts`
- Test: `tests/auth/persistent-challenge.test.ts`
- Test: `tests/api/admin-invoices.test.ts`
- Test: `tests/invoices/validation.test.ts`

**Interfaces:**

- `InvoiceAuthorizationRequest` includes `receiverPublicKey`.
- The canonical signed hash includes amount, debtor public key, receiver public key, due date, issuer, network, action, nonce, and expiry through the existing authorization envelope.
- Admin challenge creation verifies that the receiver exists and has an authorized BRLT trustline for the exact issuer.
- Invoice creation persists the signed receiver and never substitutes the global receiver.

- [ ] **Step 1: Add failing canonical-signature tests**

  Assert deterministic canonical output, receiver inclusion, and verification failure when only the receiver is changed after signing.

- [ ] **Step 2: Add failing route and validation tests**

  Cover required receiver, malformed receiver, receiver equal to issuer, receiver equal to debtor, missing account, missing/wrong-issuer/unauthorized trustline, valid receiver, signed receiver persistence, and rejection when challenge/create receivers differ.

- [ ] **Step 3: Run focused tests and confirm failure**

  Run: `pnpm vitest run tests/auth/issuer-message.test.ts tests/auth/persistent-challenge.test.ts tests/api/admin-invoices.test.ts tests/invoices/validation.test.ts tests/stellar/account-summary.test.ts`

- [ ] **Step 4: Extend the canonical request and durable challenge data**

  Ensure challenge consumption compares the exact request hash containing the receiver. Do not log the issuer signature or secret.

- [ ] **Step 5: Validate the receiver and persist the signed snapshot**

  Reuse the exact-issuer trustline parser from Task 4. Continue binding autonomous demo invoices to the configured distribution receiver through their separate demo path.

- [ ] **Step 6: Run focused tests and confirm success**

  Run the command from Step 3.

- [ ] **Step 7: Review and commit**

  Run: `git diff --check`

  Commit only this task with message `feat(invoices): sign and validate invoice receivers`.

---

### Task 7: Present persistent wallet status and role-aware invoice UI

**Files:**

- Create: `app/components/WalletStatusPanel.tsx`
- Modify: `app/components/AppHeader.tsx`
- Modify: `app/components/InvoicePortal.tsx`
- Modify: `app/components/DemoStarter.tsx`
- Modify: `app/components/InvoiceList.tsx`
- Modify: `app/components/InvoiceDetail.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/invoice-flow.spec.ts`

**Interfaces:**

- The page always names the active session (`Demonstração`, `Freighter`, or none), full active address, detected Freighter state, Testnet, and the latest user-safe Portuguese transition result.
- Wallet overview shows XLM, exact-issuer BRLT, trustline status/limit, and refresh/degraded status.
- Invoice portal has explicit `A pagar` and `A receber` views.
- Receiver detail is read-only and never renders payment/trustline submission controls.

- [ ] **Step 1: Add failing browser tests with mocked APIs**

  Cover no-session authentication prompt, demo active with failed Freighter activation, successful atomic replacement, logout with dormant demo key, Portuguese error/status text, balance/trustline summary, payables/receivables tabs, authenticated empty states, and receiver read-only detail.

- [ ] **Step 2: Run the focused Playwright test and confirm failure**

  Run: `pnpm playwright test tests/e2e/invoice-flow.spec.ts`

- [ ] **Step 3: Implement the accessible status and wallet overview UI**

  Use semantic buttons, visible focus, `aria-live` for asynchronous state, compact/full address presentation, copy feedback, and an optional details disclosure for technical errors. Do not surface raw English errors as the primary message.

- [ ] **Step 4: Implement role-aware invoice views and detail actions**

  Fetch each role through its server-enforced API. Gate empty text by authenticated session and identify the wallet whose invoices are displayed. Hide debtor actions for `viewerRole: "receiver"`.

- [ ] **Step 5: Run the focused browser test and confirm success**

  Run the command from Step 2.

- [ ] **Step 6: Review responsive and accessibility behavior, then commit**

  Run: `git diff --check`

  Commit only this task with message `feat(ui): show wallet session and invoice roles`.

---

### Task 8: Integrate, independently review, and verify locally

**Files:**

- Modify only when a verified integration defect requires it.
- Keep `AGENTS.md` pending reminder until visible browser and fresh correlated Testnet evidence are complete.

- [ ] **Step 1: Run all focused regression groups once**

  Run: `pnpm test`

- [ ] **Step 2: Run static and production-build validation**

  Run: `pnpm typecheck`

  Run: `pnpm build`

- [ ] **Step 3: Run browser automation**

  Run: `pnpm test:e2e`

- [ ] **Step 4: Run repository hygiene checks**

  Run: `git diff --check`

  Run: `git status --short`

  Confirm that the two pre-existing CI/integration edits remain untouched and excluded from task commits.

- [ ] **Step 5: Perform independent Sol/high specification and security reviews**

  Review every task against the approved spec and the five review-focus points. Fix only verified findings, add a regression test first for behavioral defects, and rerun only affected checks before the final suite if production code changes.

- [ ] **Step 6: Perform visible browser verification without signing on behalf of the user**

  Demonstrate the mocked/local UI states automatically. For a real Freighter prompt, stop for the user to approve/reject the signature. Record no signatures, cookies, or secrets.

- [ ] **Step 7: Commit and push the validated implementation**

  Confirm focused commit contents, branch SHA, and remote update. Do not deploy or mutate the active database.

## Completion Gate

- [ ] Freighter challenge verification matches SEP-53 and retains all challenge security checks.
- [ ] Demo-to-Freighter switching is atomic; logout does not auto-restore demo.
- [ ] Frontend always distinguishes active identity from detected-but-inactive Freighter.
- [ ] Wallet overview shows session-derived Testnet balances and exact-issuer BRLT trustline state.
- [ ] Payable and receivable reads are enforced server-side; receiver cannot pay as debtor.
- [ ] Real invoice signatures and durable challenges bind the immutable receiver.
- [ ] Focused tests, full tests, typecheck, production build, and Playwright pass.
- [ ] Independent Sol/high reviews report no unresolved critical or high findings.
- [ ] Branch commits are pushed without the unrelated pre-existing worktree changes.
- [ ] Deployment, active migration, and fresh public-Testnet ledger proof remain explicitly separate.
