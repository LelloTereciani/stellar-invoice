# StellarInvoice Design System

## Product context

StellarInvoice is a Portuguese-language B2B invoice demonstration on Stellar Testnet. It uses a fictional `BRLT` asset and proves invoice payment against the ledger. It never handles mainnet value, fiat exchange, KYC, customer seed custody, automatic charges, or server-signed customer payments.

Primary jobs:

1. Connect and cryptographically authenticate a Freighter wallet on Testnet.
2. See only invoices addressed to that wallet.
3. Inspect the exact amount, `BRLT` issuer, destination, memo, due date, and status.
4. Create the BRLT trustline in the customer wallet when needed.
5. Review, sign, and submit a payment in the customer wallet, then verify the transaction hash on-chain.
6. Start a disposable faucet-backed demonstration without sending the browser-local seed to the server.

Key screens are the authenticated invoice dashboard and invoice detail/payment flow. The UI must work from 360px mobile through wide desktop and remain fully keyboard accessible.

## Visual direction

Use one coherent “technical minimalist / ledger blueprint” style. The interface should feel credible, calm, precise, and B2B—never speculative, casino-like, or cryptocurrency-hype driven.

- Page background `#F7F7F5` (Paper).
- Primary ink and actions `#1A3C2B` (Forest).
- Main text `#17231D`; secondary text `#59625D`.
- Hairline grid/divider `rgba(58, 58, 56, 0.20)`.
- Surface white `#FFFFFF`; subdued surface `#EFF1ED`.
- Pending and Testnet accent Gold `#F4D35E` with dark readable text.
- Confirmed accent Mint `#9EFFBF` with dark readable text.
- Expired/rejected accent Coral `#FF8C69` with dark readable text.
- Focus ring `#286548`, 3px, with 2px Paper offset.
- No gradients, glassmorphism, glow, neon, blur, or box shadows.
- Border radius is 0 or 2px. Use 1px borders and structural dividers.

## Typography

- Display and section headings: `Space Grotesk`, weights 500–700, tight tracking.
- Body and controls: `Space Grotesk`, weights 400–600.
- Technical labels, hashes, memos, amounts, network names, and addresses: `JetBrains Mono`, weights 400–600.
- Desktop display sizes may reach 56px; application page headings should stay 32–44px. Body is 15–16px with at least 1.5 line height. Technical metadata is never below 11px.
- Use tabular numerals for amounts and dates.

## Spacing and layout

- Base spacing unit: 4px. Primary steps: 8, 12, 16, 24, 32, 48, 64.
- Desktop shell maximum width: 1440px. Header 64px high.
- Dashboard uses a 12-column structural grid. Invoice list occupies 4–5 columns and selected detail 7–8 columns. Collapse to one column below 900px.
- Section and card padding: 24–32px desktop, 16px mobile.
- A subtle fixed mosaic grid may be made only from hairlines and Paper fills; it must never reduce text contrast.

## Component rules

- Primary button: Forest background, Paper text, 44px minimum height, square/2px corners, clear hover and disabled states.
- Secondary button: transparent Paper background, Forest 1px border, 44px minimum height.
- Destructive/error controls use Coral as an accent, never as large solid background behind body text.
- Status badge: 1px border, 8px square status marker, uppercase JetBrains Mono label. Status must use both text and color.
- Invoice rows/cards: visible selected state using a 3px Forest left border and subdued surface. Each row shows amount, status, due date, and shortened memo; never hide the full detail from the selected view.
- Full Stellar addresses and transaction hashes must be available in detail, wrap safely, and have explicit Copy and Explorer controls. Do not rely on hover-only disclosure.
- Inputs have persistent labels above them, not placeholder-only labels. Error text is adjacent and programmatically associated.
- Loading uses descriptive status text and restrained skeleton blocks; no indefinite spinner without explanation.

## Web3 safety requirements

- Keep a persistent `TESTNET · BRLT FICTÍCIO` indicator in the shell and another explicit warning near signing actions.
- Before wallet signing, show a review block with exact source wallet, destination, amount string, asset code plus issuer, memo, network, and due date.
- Never display or request a secret key/seed. Never imply that connecting a wallet transfers funds.
- Distinguish these states in Portuguese: carteira ausente, acesso recusado, rede errada, preparando, revisando, aguardando assinatura, enviando, verificando, confirmado, vencido, rejeitado.
- Signing and submission actions must be explicit user buttons. No automatic payment or pre-checked consent.
- The trustline action explains that it authorizes holding fake BRLT on Testnet; it is not a payment.
- The confirmed state includes the transaction hash and an external Stellar Expert Testnet link. External-link semantics must be visible.
- Rejected attempts remain secondary audit history and must not visually imply that the invoice itself is permanently failed.

## Motion

- Use 120–180ms ease-out transitions for hover, focus, row selection, and disclosure.
- Respect `prefers-reduced-motion` and remove nonessential motion.
- No looping decorative animations. Progress changes may fade/slide by at most 8px.

## Required dashboard composition

- Technical top bar: StellarInvoice mark/name, navigation label `FATURAS`, persistent Testnet badge, connected wallet control.
- Intro band: concise title and explanation that ledger verification is the source of truth.
- Main workspace: searchable/filterable invoice list on the left; selected invoice ledger-like detail on the right.
- Detail includes status, exact 7-decimal BRLT amount, memo, due date, debtor, issuer/destination, rejected-attempt history, trustline action, and payment action.
- A compact demo setup callout remains available but visually secondary.
- Use realistic fake Testnet example data labeled as demonstration data. Never fabricate balances, yield, market price, fiat value, or compliance claims.

Use ONLY the fonts, colors, spacing, and component styles defined here. Do not introduce any fonts, colors, gradients, shadows, glass effects, or visual styles not in this design system.
