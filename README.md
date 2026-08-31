# StellarInvoice

MVP de faturamento B2B na Stellar Testnet com o ativo fictício `BRLT`.

## Estado atual

O backend Testnet, autenticação por carteira, faturas, XDR assinado pelo cliente, verificação no ledger, demonstração limitada e Supabase auto-hospedado estão implementados. O painel visual aprovado no Superdesign ainda é o gate explícito para concluir a interface.

## Desenvolvimento local

1. Use Node.js 22 ou superior.
2. Copie `.env.example` para `.env.local` e informe somente chaves públicas de Testnet.
3. Execute `pnpm install`, `pnpm test`, `pnpm typecheck` e `pnpm build`.

## Deploy no EasyPanel

O repositório contém o Dockerfile Node 22 e a pilha Supabase Docker em `infra/supabase/`. No EasyPanel, use os três arquivos Compose indicados em [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md). Configure os valores dos dois exemplos de ambiente como segredos; execute `pnpm demo:bootstrap` uma vez em Testnet e copie somente chaves públicas e variáveis operacionais necessárias. Preflight, backup, restauração isolada e rollback estão em [docs/operations.md](docs/operations.md).

The production image excludes local environment files and `demo-wallet.json`, so Testnet seeds never enter the build context.

Nunca versione seeds, chaves privadas ou arquivos `.env` com valores reais.
