# StellarInvoice

MVP de faturamento B2B na Stellar Testnet com o ativo fictício `BRLT`.

## Estado atual

O projeto inicia com configuração exclusiva de Testnet e testes da fronteira de configuração. A implementação completa segue o [plano de implementação](docs/superpowers/plans/2026-08-31-stellar-invoice.md) e a [especificação funcional](docs/specs/2026-08-31-stellar-invoice-especificacao-funcional.md).

## Desenvolvimento local

1. Use Node.js 22 ou superior.
2. Copie `.env.example` para `.env.local` e informe somente chaves públicas de Testnet.
3. Execute `pnpm install`, `pnpm test`, `pnpm typecheck` e `pnpm build`.

Nunca versione seeds, chaves privadas ou arquivos `.env` com valores reais.
