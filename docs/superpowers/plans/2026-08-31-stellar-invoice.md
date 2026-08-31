# StellarInvoice Implementation Plan

**Status:** Aprovado para execução em 31/08/2026.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar na VPS um MVP de faturamento B2B na Stellar Testnet, com ativo fictício `BRLT`, trustline, pagamento assinado pelo cliente e confirmação verificável no ledger.

**Architecture:** Um único Docker Compose na VPS executará o Next.js (interface e rotas HTTP), um Supabase auto-hospedado (Postgres/Auth/API) e um proxy Caddy com TLS. O Postgres armazena a fatura e sua trilha de confirmação; Stellar Testnet continua sendo a fonte de verdade para o ativo e o pagamento. Nenhuma chave de cliente transita pelo servidor.

**Tech Stack:** Node.js 22, Next.js/TypeScript, `@stellar/stellar-sdk`, `@stellar/freighter-api`, Supabase auto-hospedado por Docker Compose/Postgres, Caddy, Vitest e Playwright.

**Spec:** `../../specs/2026-08-31-stellar-invoice-especificacao-funcional.md`

## Global Constraints

- Aceitar exclusivamente `StellarSdk.Networks.TESTNET`; mainnet e dinheiro real não fazem parte do produto.
- O ativo é identificado sempre pelo par imutável `asset_code=BRLT` e `asset_issuer` configurado; código isolado nunca é suficiente.
- Valores são strings decimais positivas de no máximo sete casas, sem conversão para `number` JavaScript.
- O servidor só usa a seed do emissor em rotina administrativa; ela nunca é enviada ao navegador, logada ou retornada pela API.
- Cada fatura recebe memo textual único, valor, devedor, emissor, vencimento UTC e estado `pending`, `confirmed` ou `expired`; tentativas rejeitadas são registros separados.
- A confirmação exige uma operação `payment` concluída na Testnet com destino, ativo, valor e memo exatamente iguais aos da fatura; uma transação não pode confirmar duas faturas.
- O Postgres fica em volume persistente na VPS. Kong/Studio/PostgREST não são publicados diretamente na internet; somente Caddy expõe HTTPS para o app.
- Comentários necessários para explicar regras, segurança ou decisões não óbvias são bilingues: inglês e português.
- O modo demonstração é Testnet-only, desabilitado por padrão e mantém a seed do cliente exclusivamente no navegador; Friendbot fornece apenas XLM e a distribuidora envia BRLT de valor fixo e limitado.
- Não implementar mainnet, KYC, câmbio, cobrança automática, custódia de seed de cliente, pagamento iniciado pelo servidor ou Supabase Cloud.

---

## File Structure

- `app/`: Next.js App Router, telas, rotas de API e middleware de sessão administrativa.
- `app/lib/stellar/`: configuração imutável da Testnet, construção de transações e leitor Horizon.
- `app/lib/invoices/`: regras puras de validação, criação e transição de estado de faturas.
- `scripts/bootstrap-issuer.ts`: rotina administrativa idempotente para criar/reutilizar conta emissora e emitir o ativo de teste.
- `supabase/migrations/`: esquema SQL, índices, RLS e permissões do banco de faturas.
- `infra/`: Compose do app, Caddy e instruções de operação da VPS; os segredos ficam apenas em arquivos não versionados na VPS.
- `tests/`: testes unitários, de rotas e de navegador separados da aplicação.

### Task 1: Inicializar o projeto e os contratos de configuração

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.gitignore`, `README.md`
- Create: `app/lib/config.ts`, `app/lib/stellar/network.ts`, `tests/config.test.ts`

**Interfaces:**
- Produces `stellarConfig: { horizonUrl: string; networkPassphrase: string; assetCode: "BRLT"; issuerPublicKey: string }`.
- Produces `requireServerEnv(name: string): string`, que recusa variáveis vazias.

- [x] Escrever testes que rejeitem rede diferente de Testnet, chave pública ausente e código de ativo diferente de `BRLT`.
- [x] Implementar o carregamento de configuração com `NEXT_PUBLIC_STELLAR_ISSUER`, `NEXT_PUBLIC_STELLAR_HORIZON_URL` e apenas a seed administrativa `STELLAR_ISSUER_SECRET` no ambiente de servidor.
- [x] Documentar os requisitos Node 22, Docker Compose e carteira Freighter; versionar somente `.env.example`, sem valores reais.
- [x] Executar `pnpm test tests/config.test.ts` e `pnpm build`.

### Task 2: Provisionar Supabase auto-hospedado e o modelo de faturas

**Files:**
- Create: `supabase/migrations/0001_invoices.sql`, `supabase/migrations/0002_policies.sql`
- Create: `infra/supabase/README.md`, `infra/supabase/.env.example`
- Create: `tests/migrations/invoices.test.ts`

**Interfaces:**
- Produces tabelas `invoices(id uuid, debtor_public_key text, issuer_public_key text, asset_code text, asset_issuer text, amount numeric(20,7), memo text unique, due_at timestamptz, status text, confirmed_transaction_hash text unique null, confirmed_at timestamptz null, created_at timestamptz)` e `rejected_payment_attempts(id uuid, invoice_id uuid, transaction_hash text unique, reason text, observed_at timestamptz)`.
- Produces RPC transacional `confirm_invoice(invoice_id uuid, transaction_hash text, confirmed_at timestamptz)` que só permite `pending -> confirmed` uma vez.

- [ ] Criar restrições para chaves `G...`, valor positivo, memo não vazio, os três estados permitidos e consistência entre `asset_issuer` e emissor configurado.
- [ ] Aplicar RLS: o cliente autenticado lê somente faturas cujo `debtor_public_key` é sua carteira vinculada; o papel de serviço não é exposto ao navegador; criação e confirmação ocorrem exclusivamente por rotas servidoras autorizadas.
- [ ] Preparar o Compose oficial auto-hospedado em `infra/supabase/`, com volumes nomeados, credenciais substituídas na VPS, rede interna e sem portas públicas para Postgres, Studio ou Kong.
- [ ] Executar migrações em stack Docker local e testes que comprovem unicidade de memo/hash, transição única e bloqueio de leitura cruzada.

### Task 3: Implementar bootstrap idempotente do emissor e do ativo

**Files:**
- Create: `scripts/bootstrap-issuer.ts`, `app/lib/stellar/bootstrap.ts`, `tests/stellar/bootstrap.test.ts`

**Interfaces:**
- Produces `bootstrapIssuer(input): Promise<{ issuerPublicKey: string; assetCode: "BRLT"; distributionPublicKey: string }>`.
- Consumes `STELLAR_ISSUER_SECRET` apenas no processo Node administrativo.

- [ ] Testar execução repetida sem criar uma segunda configuração, ausência de trustline do distribuidor e falha do Horizon/Friendbot.
- [ ] Implementar conta emissora separada da conta de distribuição, financiamento apenas na Testnet, trustline da distribuição e emissão inicial de BRLT para ela.
- [ ] Fazer o script persistir somente chaves públicas e configuração de ativo no banco; encerrar com erro antes de registrar configuração se a transação não for bem-sucedida.
- [ ] Executar o script duas vezes em Testnet e registrar hashes e chaves públicas no README, sem seeds.

### Task 3A: Automatizar a demonstração de Testnet

**Files:**
- Create: `app/lib/demo/session.ts`, `app/api/demo/provision/route.ts`, `app/components/DemoStarter.tsx`
- Modify: `scripts/bootstrap-issuer.ts`, `app/lib/stellar/transactions.ts`
- Test: `tests/demo/session.test.ts`, `tests/api/demo-provision.test.ts`

**Interfaces:**
- `createDemoWallet()` gera uma carteira cliente somente no navegador.
- `POST /api/demo/provision` aceita apenas a chave pública da carteira e retorna os dados públicos da sessão; não aceita nem retorna seed.

- [ ] Testar bloqueio fora de Testnet, modo desabilitado, chave inválida, provisão duplicada e vazamento de seed em resposta/log.
- [ ] Implementar Friendbot para XLM, trustline assinada pelo navegador e distribuição de BRLT com valor fixo e limite por sessão.
- [ ] Criar fluxo guiado que deixa o usuário com fatura, saldo BRLT e pagamento pronto para assinatura.
- [ ] Executar uma demonstração Testnet completa e registrar somente chaves públicas e hashes no README.

### Task 4: Implementar autenticação de emissor e API de faturas

**Files:**
- Create: `app/lib/auth/issuer-challenge.ts`, `app/lib/invoices/service.ts`
- Create: `app/api/admin/challenge/route.ts`, `app/api/admin/invoices/route.ts`
- Create: `tests/api/admin-invoices.test.ts`

**Interfaces:**
- `POST /api/admin/challenge` retorna desafio aleatório de uso único e expiração de cinco minutos.
- `POST /api/admin/invoices` recebe `{ challengeId, signedChallenge, debtorPublicKey, amount, dueAt }` e retorna `{ id, memo, status: "pending" }`.

- [ ] Testar assinatura válida do emissor, assinatura de outra carteira, desafio expirado/reutilizado, devedor inválido, valor impreciso/zero e vencimento no passado.
- [ ] Validar a assinatura do desafio contra a chave pública configurada do emissor antes de criar uma fatura.
- [ ] Gerar memo com UUID textual, armazenar a fatura `pending` e nunca aceitar `assetCode`, emissor ou status fornecidos pelo cliente HTTP.
- [ ] Executar os testes da rota e testar manualmente que respostas e logs não contêm segredos.

### Task 5: Construir pagamento e trustline assinados pela carteira do cliente

**Files:**
- Create: `app/lib/stellar/transactions.ts`, `app/hooks/useFreighter.ts`
- Create: `app/components/ConnectWallet.tsx`, `app/components/TrustlineButton.tsx`, `app/components/PayInvoiceButton.tsx`
- Create: `tests/stellar/transactions.test.ts`, `tests/components/payment-flow.test.tsx`

**Interfaces:**
- `buildTrustlineXdr(customerPublicKey: string): Promise<string>`.
- `buildInvoicePaymentXdr(invoice: PendingInvoice, customerPublicKey: string): Promise<string>`.
- A carteira recebe XDR, assina e submete; nenhuma rota do app assina em nome do cliente.

- [ ] Testar XDR com Testnet passphrase, ativo BRLT+emissor correto, destino emissor correto, valor string exato e memo da fatura.
- [ ] Implementar estados de UX: carteira ausente, acesso negado, rede errada, carregando, assinatura recusada, submissão pendente e hash confirmado.
- [ ] Impedir pagamento se a carteira conectada não for o devedor da fatura; mostrar trustline ausente e permitir criá-la pelo próprio cliente.
- [ ] Executar testes unitários e validar o fluxo em Playwright visível com Freighter de Testnet.

### Task 6: Verificar pagamentos no ledger e atualizar o estado de forma segura

**Files:**
- Create: `app/lib/stellar/payment-verifier.ts`, `app/api/invoices/[id]/verify/route.ts`
- Create: `tests/stellar/payment-verifier.test.ts`, `tests/api/verify-invoice.test.ts`

**Interfaces:**
- `verifyInvoicePayment(invoice: PendingInvoice): Promise<VerificationResult>` retorna `confirmed`, `pending` ou `expired`; tentativa divergente é retornada com seu motivo e gravada em `rejected_payment_attempts` sem alterar o estado da fatura.
- `POST /api/invoices/:id/verify` é idempotente.

- [ ] Testar transação correta, ativo errado, emissor errado, destino errado, valor errado, memo errado, hash duplicado, fatura vencida e indisponibilidade do Horizon.
- [ ] Consultar operações/transações do devedor após a criação da fatura; decodificar e comparar todos os campos do pagamento antes de chamar `confirm_invoice`.
- [ ] Ao expirar sem pagamento válido, alterar somente `pending -> expired`; ao encontrar tentativa divergente, gravar a evidência sem marcar a transferência como confirmada nem impedir uma confirmação posterior válida.
- [ ] Executar testes de integração com respostas Horizon simuladas e um cenário Testnet real documentado.

### Task 7: Criar painel de faturas e histórico verificável

**Files:**
- Create: `app/page.tsx`, `app/invoices/[id]/page.tsx`, `app/components/InvoiceStatus.tsx`, `app/components/ExplorerLink.tsx`
- Create: `tests/e2e/invoice.spec.ts`

**Interfaces:**
- A página de detalhes consome `GET /api/invoices/:id` e exibe apenas os estados e campos públicos necessários.
- `ExplorerLink` aceita somente hash Stellar hexadecimal e gera URL do explorador em Testnet.

- [ ] Exibir claramente pendente, confirmado e vencido, além de valor, BRLT, emissor, memo, vencimento, hash quando houver e tentativas rejeitadas quando existirem.
- [ ] Testar renderização de cada estado, escape de dados de devedor/memo e rejeição de hash inválido.
- [ ] Rodar Playwright visível contra o app Dockerizado e salvar captura de uma fatura confirmada para a evidência de portfólio.

### Task 8: Empacotar, publicar na VPS e revisar a segurança

**Files:**
- Create: `infra/docker-compose.yml`, `infra/caddy/Caddyfile`, `infra/.env.example`, `infra/deploy.sh`
- Create: `docs/operations.md`, `docs/security-review.md`

**Interfaces:**
- Caddy expõe somente `https://<dominio>/` para Next.js; Supabase só está acessível na rede Docker.
- `infra/deploy.sh` executa build, sobe containers com health checks e não imprime variáveis secretas.

- [ ] Configurar containers com usuário não-root quando suportado, restart policy, volumes persistentes, health checks e rede Docker interna.
- [ ] Configurar Caddy para TLS, redirecionamento HTTP->HTTPS e headers básicos; restringir CORS do Supabase ao domínio do app.
- [ ] Criar backup lógico diário do Postgres na VPS, armazenado fora do volume do banco, e ensaiar restauração em ambiente isolado.
- [ ] Executar `pnpm lint`, `pnpm test`, `pnpm build`, Playwright visível, revisão de dependências, revisão de autorização/RLS e revisão manual para segredos antes da publicação.
- [ ] Registrar no README a URL publicada, hashes de bootstrap/pagamento, chaves públicas, data da evidência e procedimento de rollback; não registrar credenciais.

## Acceptance Evidence

- Um `BRLT` de Testnet, seu emissor e a conta de distribuição são criados/reutilizados por bootstrap repetível.
- Uma carteira cliente cria trustline, recebe BRLT de teste e paga uma fatura com o memo único.
- A verificação confirma exclusivamente esse pagamento e associa seu hash a uma única fatura.
- O painel na VPS exibe a fatura confirmada e o link de explorador; tentativas com rede, memo, ativo, destino ou valor incorretos não a confirmam e ficam registradas sem bloquear pagamento válido posterior.
- O Supabase não usa serviço Cloud, persiste dados em volume Docker e não está exposto diretamente à internet.
