# StellarInvoice wallet session and receiver UX design

**Status:** approved for implementation in a future session

**Date:** 2026-09-21

**Network and asset:** Stellar Testnet, fictitious BRLT only

## Purpose

Make a connected Freighter wallet useful and unambiguous in StellarInvoice. The application must distinguish a wallet selected in the Freighter extension from the wallet session that is authenticated and active in the application. Demo and Freighter identities must never appear active at the same time.

The same authenticated wallet must be able to see invoices in which it is the debtor and invoices in which it is the receiver. New real invoices must snapshot their intended receiver instead of forcing every payment to the single server-wide receiver. The autonomous demo remains isolated and continues to pay its configured distribution/treasury account.

## Confirmed current problem

The observed browser state was:

- active StellarInvoice identity: demo wallet `GB55B...ZHXZ`;
- Freighter account detected: `GDAD6...ZJRF`;
- Freighter account not active in StellarInvoice;
- authentication error shown as raw English text: `Wallet challenge signature is invalid`;
- the page then showed an empty invoice state without explaining which wallet it represented.

The current client initializes the demo wallet whenever its local secret exists. A failed Freighter authentication therefore leaves the demo address in the application state. The interface does not distinguish extension connectivity, application authentication, active identity, or the last failed transition.

## Product requirements

### One active application identity

Model these concepts separately:

- **Active session:** `none`, `demo(publicKey)`, or `freighter(publicKey)`.
- **Freighter connection:** unavailable, detected, authenticating, authenticated, rejected, or failed.
- **Last transition:** action, timestamp, and user-safe result message.

A Freighter account being visible to the extension does not make it active in StellarInvoice. It becomes active only after the wallet challenge is signed and the server creates a valid wallet session.

Switching from demo to Freighter is atomic:

1. Keep the valid demo session active while the new challenge is pending.
2. Display that the Freighter account is detected but not yet active.
3. On successful verification, replace the application session with the Freighter session, remove the demo from active client state, and mark the demo logged out.
4. On rejection, expiry, or verification failure, keep the demo active and show that Freighter activation failed.
5. Never silently report the Freighter account as active after a failed challenge.

Logging out clears the application wallet-session cookie and sets the active mode to `none`. It must not automatically reactivate the demo. Returning to the demo requires an explicit **Entrar na demonstração** action.

### Demo logout and recovery

Logging out the demo means:

- it is not the active identity;
- its authenticated cookie is replaced or cleared;
- its invoices and balances are removed from active UI state;
- it cannot sign or submit application actions;
- it is not restored merely because a demo secret exists in browser storage.

The existing demo key may remain dormant in browser storage so the user can explicitly resume it later. Preserving the key is not an authenticated session and must not make the demo visible as the current wallet.

### Persistent frontend status

The frontend always displays the effective state. It must never show only a raw backend error.

When the observed mixed state occurs, show both facts:

> **Sessão ativa: Demonstração**
>
> Carteira `GB55B...ZHXZ`

> **Freighter conectada, mas não autenticada**
>
> Carteira `GDAD6...ZJRF` detectada. A última tentativa de autenticação falhou.
>
> **Tentar ativar Freighter**

After success, show:

> **Sessão ativa: Freighter**
>
> Carteira `GDAD6...ZJRF` · Stellar Testnet

Every wallet or payment action exposes a Portuguese status for disconnected, connecting, awaiting signature, authenticated, rejected, expired, submitted, confirming, confirmed, and failed states. Technical messages and codes may appear only in an optional details disclosure.

The empty invoice state is gated by authentication:

- no active session: request authentication; do not claim that the wallet has no invoices;
- active wallet with no matching invoices: identify the wallet and say that no invoices were found for it;
- failed switch with demo still active: identify the demo as the source of the visible invoice list.

Status changes use semantic controls and an appropriate live region so keyboard and assistive-technology users receive asynchronous updates.

### Wallet overview

For the active wallet, display:

- full address with copy action and compact form for secondary display;
- active mode: Freighter or demonstração;
- Stellar Testnet network label;
- XLM balance;
- BRLT balance for the exact configured issuer;
- BRLT trustline status and limit;
- last successful refresh time and a recoverable degraded state if Horizon is unavailable.

The server derives the queried public key from the authenticated session. A client-supplied arbitrary address must not be accepted as authorization to read private application data.

### Payables and receivables

The authenticated wallet receives two explicit views:

- **A pagar:** invoices whose `debtor_public_key` matches the active wallet.
- **A receber:** invoices whose `receiver_public_key` matches the active wallet.

The API must enforce the same role filter server-side. Authentication as a receiver permits reading its receivable invoices but never permits signing or submitting payment as the debtor.

### Receiver per real invoice

For real invoice creation, the issuer/admin selects `receiverPublicKey`. The issuer authorization must bind the receiver into the canonical signed invoice payload together with amount, debtor, due date, network, issuer, expiry, and nonce. The server validates the exact signed receiver and snapshots it into the existing `receiver_public_key` column.

Rules:

- receiver, debtor, and asset issuer must be distinct accounts;
- the receiver must be a valid Stellar Testnet public key;
- before creation, verify that the receiver account exists and has an authorized trustline for BRLT from the exact configured issuer;
- an existing invoice's receiver is immutable;
- payment construction, review, submission, and ledger verification continue to use the invoice snapshot;
- existing invoices are not rewritten.

`STELLAR_PAYMENT_RECEIVER` remains the controlled receiver for the autonomous demo and may be used as an admin-form default. It must not silently override the receiver signed into a real invoice. The demo continues to require its receiver to match the distribution account derived from `STELLAR_DISTRIBUTION_SECRET`. A personal Freighter secret must never be placed on the server.

## Components and API changes

Expected implementation areas:

- `app/hooks/useFreighter.ts`: replace implicit demo initialization with an explicit wallet-session state machine.
- `app/lib/stellar/freighter-client.ts`: diagnose and correct the real Freighter message-signature verification failure without weakening challenge validation.
- `app/lib/stellar/demo-wallet-client.ts`: separate dormant demo-key recovery from active demo authentication.
- `app/components/AppHeader.tsx`: show the effective active identity and network.
- `app/components/InvoicePortal.tsx`: persistent wallet/status summary and authentication-gated empty states.
- `app/components/DemoStarter.tsx`: explicit demo login/resume; no automatic activation while Freighter is active.
- `app/api/auth/logout/route.ts`: clear the wallet-session cookie.
- authenticated wallet-status API: return session-derived balances and trustline state.
- invoice list/service APIs: support server-enforced debtor and receiver views.
- admin invoice challenge and creation APIs: include the receiver in the signed canonical payload.

Names and file boundaries may be refined during implementation, but the trust boundaries and externally visible behavior in this specification are required.

## Authentication failure diagnosis

The next session starts by reproducing `Wallet challenge signature is invalid` with a fresh challenge and the current Freighter version. Capture only non-secret structural evidence: message bytes/encoding, public key, challenge identifier, expiry, response types, and verification result. Never log reusable signatures, session cookies, private keys, or extension secrets.

Do not assume the cause. Verify message normalization, byte/base64/hex conversion, Freighter API response shape, selected account, challenge expiry, one-time challenge consumption, and server verification against the exact issued message.

## Error handling

- Map technical failures to actionable Portuguese messages.
- Preserve the currently valid session until a replacement authentication succeeds.
- Expired or consumed challenges produce a new explicit retry; they are never reused.
- Account or network changes invalidate the pending intent and require fresh authentication.
- Prevent duplicate wallet prompts while a challenge is pending.
- A Horizon failure degrades balance display without falsely logging out a valid wallet session.

## Verification requirements

Implementation follows test-driven development and adds coverage for:

- valid, invalid, expired, consumed, and wrong-account Freighter challenges;
- exact message encoding used by the installed Freighter API;
- demo-active plus Freighter-detected mixed status;
- successful atomic demo-to-Freighter switch;
- rejected/failed switch retaining the demo and showing the failure;
- logout leaving no active session and not auto-restoring the demo;
- refresh behavior for dormant demo keys and active Freighter sessions;
- Portuguese status and authentication-gated empty states;
- XLM/BRLT balance and trustline presentation;
- server-side authorization for **A pagar** and **A receber**;
- receiver included in issuer signature and immutable invoice snapshot;
- rejection of receiver equal to issuer or debtor and of a receiver without the exact BRLT trustline;
- wallet rejection, challenge expiry, slow Horizon, and duplicate-click behavior.

Visible browser verification must demonstrate:

1. demo active and identified;
2. Freighter `GDAD6...ZJRF` detected but not active after a failed challenge;
3. a successful fresh authentication switching the active identity to Freighter and logging out the demo;
4. wallet address, network, XLM, BRLT, and trustline shown correctly;
5. separate payable and receivable empty/results states;
6. a new Testnet invoice whose signed receiver is the connected receiver wallet;
7. exact ledger payment reaching that receiver, with the debtor, receiver, issuer, amount, memo, transaction hash, database state, and resulting balances correlated.

Local tests, browser proof, database migration proof, deployment, and public-ledger proof remain separate completion claims. Do not redeploy or modify EasyPanel as part of local implementation without the user's deployment authorization.

## Implementation sequence for the next session

1. Reinspect worktree and preserve unrelated CI/test changes.
2. Reproduce and diagnose the Freighter challenge failure.
3. Add failing authentication and wallet-state tests.
4. Implement the explicit session state machine and logout endpoint.
5. Implement persistent frontend status and wallet overview.
6. Add server-authorized **A pagar** and **A receber** views.
7. Bind a per-invoice receiver into issuer authorization and invoice creation.
8. Run affected tests first, then the full required suite after functional changes.
9. Perform independent code/security review and visible browser verification.
10. Commit and push the validated implementation. Keep live migration, EasyPanel configuration, redeploy, and public Testnet proof as separately controlled steps.

## Out of scope

- Stellar Mainnet or assets with real monetary value;
- custody of personal Freighter secrets;
- automatically choosing a receiver from whichever browser wallet happens to be selected;
- rewriting receiver addresses on existing invoices;
- automatically returning to demo after a Freighter failure or logout;
- deployment or active database mutation during this specification-only session.
