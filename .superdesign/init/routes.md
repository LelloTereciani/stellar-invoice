# Route map

| URL | File | Layout | Summary |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | `app/layout.tsx` | Minimal product shell with demo provisioning and Freighter connection. |
| `/api/admin/challenge` | `app/api/admin/challenge/route.ts` | none | Creates an issuer authorization challenge. |
| `/api/admin/invoices` | `app/api/admin/invoices/route.ts` | none | Creates an issuer-authorized invoice. |
| `/api/auth/challenge` | `app/api/auth/challenge/route.ts` | none | Creates a customer wallet challenge. |
| `/api/auth/verify` | `app/api/auth/verify/route.ts` | none | Verifies wallet proof and sets an HttpOnly session. |
| `/api/invoices` | `app/api/invoices/route.ts` | none | Lists invoices for the authenticated debtor. |
| `/api/invoices/[id]` | `app/api/invoices/[id]/route.ts` | none | Returns debtor-bound invoice detail and rejected attempts. |
| `/api/invoices/[id]/payment` | `app/api/invoices/[id]/payment/route.ts` | none | Builds the exact unsigned Testnet payment XDR. |
| `/api/invoices/[id]/verify` | `app/api/invoices/[id]/verify/route.ts` | none | Verifies a submitted transaction hash against the ledger. |
| `/api/wallet/trustline` | `app/api/wallet/trustline/route.ts` | none | Builds the unsigned BRLT trustline XDR. |
| `/api/demo/provision` | `app/api/demo/provision/route.ts` | none | Funds a disposable Testnet demo wallet and prepares its trustline. |
| `/api/demo/distribute` | `app/api/demo/distribute/route.ts` | none | Sends the fixed fake BRLT demo allocation. |

There is no router config beyond Next.js App Router file-based routing.
