# Stellar Invoice

**Classification:** Independent Project · Testnet · Production-oriented prototype

A full-stack invoice payment prototype built on Stellar Testnet. It explores wallet authentication, invoice creation, XDR review, browser signing, transaction submission, and ledger-backed payment verification using the fictional BRLT test asset.

## Scope

- Stellar Testnet only; no mainnet or commercial usage is claimed.
- Self-hosted Supabase and application services can run through Docker Compose.
- Demo flows use disposable Testnet accounts and Friendbot-funded assets.
- Operational and Testnet evidence is documented in [docs/testnet-evidence.md](docs/testnet-evidence.md).

This repository represents independent study and engineering practice. It is not presented as audited software or as a production service.

## Local development

Requirements: Node.js 22+ and pnpm.

```bash
cp .env.example .env.local
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

For the disposable Testnet demonstration:

```bash
pnpm demo:bootstrap
pnpm evidence:testnet
```

Never commit real secrets, private keys, wallet seeds, or populated `.env` files. Use the example environment files as templates.

## Deployment notes

The repository includes Docker Compose and EasyPanel/VPS documentation. Read [docs/operations.md](docs/operations.md) and [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md) before attempting a deployment.

## Technology

TypeScript, Next.js, Stellar SDK, Freighter-compatible wallet flows, Supabase/Postgres, Docker Compose, Vitest, Playwright, and GitHub Actions.

## License

MIT. See [LICENSE](LICENSE).

## Author

Lello Tereciani
