# StellarInvoice

MVP de faturamento B2B na Stellar Testnet com o ativo fictício `BRLT`.

## Estado atual

O projeto inicia com configuração exclusiva de Testnet e testes da fronteira de configuração. A implementação completa segue o [plano de implementação](docs/superpowers/plans/2026-08-31-stellar-invoice.md) e a [especificação funcional](docs/specs/2026-08-31-stellar-invoice-especificacao-funcional.md).

## Desenvolvimento local

1. Use Node.js 22 ou superior.
2. Copie `.env.example` para `.env.local` e informe somente chaves públicas de Testnet.
3. Execute `pnpm install`, `pnpm test`, `pnpm typecheck` e `pnpm build`.

## Deploy no EasyPanel

O repositório já contém `Dockerfile` de produção para Node 22 e a pilha Supabase Docker em `infra/supabase/`. No EasyPanel, use o Dockerfile na raiz para a aplicação e os dois arquivos Compose indicados em [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md) para o banco auto-hospedado. Configure os valores de `.env.example` como segredos do ambiente; execute `pnpm demo:bootstrap` uma vez em ambiente Testnet e copie somente as chaves públicas e as variáveis operacionais necessárias.

The production image excludes local environment files and `demo-wallet.json`, so Testnet seeds never enter the build context.

Nunca versione seeds, chaves privadas ou arquivos `.env` com valores reais.
