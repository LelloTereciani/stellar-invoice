# StellarInvoice

MVP de faturamento B2B na Stellar Testnet com o ativo fictício `BRLT`.

## Estado atual

O fluxo Testnet está implementado de ponta a ponta: autenticação por carteira, painel responsivo, fatura destinada ao devedor, revisão do XDR, assinatura no navegador, submissão e verificação no ledger. O modo demonstração cria uma chave descartável somente no navegador, usa Friendbot, configura a trustline BRLT, distribui ativos fictícios e abre uma fatura pronta para pagamento. Supabase e aplicação são auto-hospedados na mesma pilha Docker; Caddy é usado apenas na variante de VPS genérica, enquanto o EasyPanel fornece o proxy e TLS.

A jornada também foi executada contra a Stellar Testnet real; hashes públicos e o comando reproduzível estão em [docs/testnet-evidence.md](docs/testnet-evidence.md).

## Desenvolvimento local

1. Use Node.js 22 ou superior.
2. Copie `.env.example` para `.env.local` e informe somente chaves públicas de Testnet.
3. Execute `pnpm install`, `pnpm test`, `pnpm typecheck`, `pnpm build` e `pnpm test:e2e`.
4. Opcionalmente, após `pnpm demo:bootstrap`, execute `pnpm evidence:testnet` para uma jornada descartável na rede pública de testes.

## Deploy no EasyPanel

Use um serviço **Compose** com o arquivo único `docker-compose.easypanel.yml`. Configure o domínio primário do EasyPanel para o serviço interno `app`, protocolo `HTTP` e porta `3000`; depois defina a origem HTTPS e faça o deploy/redeploy final. Não publique `80`, `443` ou portas do Supabase no Compose. As instruções exatas estão em [infra/supabase/STELLAR_INVOICE.md](infra/supabase/STELLAR_INVOICE.md).

Configure os valores dos dois exemplos de ambiente como segredos; execute `pnpm demo:bootstrap` uma vez em Testnet e copie somente chaves públicas e variáveis operacionais necessárias. Preflight, backup, restauração isolada e rollback estão em [docs/operations.md](docs/operations.md).

The production image excludes local environment files and `demo-wallet.json`, so Testnet seeds never enter the build context.

Nunca versione seeds, chaves privadas ou arquivos `.env` com valores reais.
