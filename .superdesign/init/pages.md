# Page dependency trees

## `/` — Home

Entry: `app/page.tsx`

Dependencies:

- `app/components/DemoStarter.tsx`
- `app/components/TestnetWallet.tsx`

Shared layout:

- `app/layout.tsx`

The planned authenticated invoice list and `/invoices/[id]` detail screen do not yet have page components. Their server APIs and the reusable `app/hooks/useFreighter.ts` transaction state machine are implemented.
