# Separate Payment Receiver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar a conta emissora do BRLT da conta credora/recebedora, para que empréstimos reduzam o saldo da tesouraria, pagamentos reduzam o saldo do cliente e recebimentos aumentem o saldo da tesouraria.

**Architecture:** A conta emissora continuará identificando o ativo `BRLT`. A conta distribuidora será também a tesouraria/recebedora das faturas de demonstração. Cada nova fatura persistirá `receiver_public_key`; transações e verificação compararão o destino com esse campo, sem exigir que ele seja igual ao emissor do ativo.

**Tech Stack:** Next.js App Router, TypeScript, `@stellar/stellar-sdk`, Horizon Testnet, Supabase/PostgreSQL auto-hospedado, Vitest e Playwright.

**Spec:** `docs/specs/2026-08-31-stellar-invoice-especificacao-funcional.md`

**Status:** Planejado em 13/09/2026; nenhuma parte abaixo foi implementada.

## Global Constraints

- Manter exclusivamente Stellar Testnet e BRLT fictício.
- Nunca enviar, persistir, registrar ou publicar seeds de clientes.
- `assetIssuer` identifica quem emite BRLT; `receiverPublicKey` identifica quem recebe a fatura.
- Para a demonstração, `receiverPublicKey` deve ser a chave pública derivada de `STELLAR_DISTRIBUTION_SECRET`.
- Faturas já confirmadas permanecem imutáveis e verificáveis com seu hash atual.
- A migration deve ser aditiva; não apagar nem recriar o volume `postgres-data`.

---

### Task 1: Atualizar a especificação e a configuração de contas

**Files:**
- Modify: `docs/specs/2026-08-31-stellar-invoice-especificacao-funcional.md`
- Modify: `app/lib/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: `StellarConfig.receiverPublicKey: string` carregado de `STELLAR_PAYMENT_RECEIVER`.
- Produces: validação de que emissor, distribuidor e recebedor são chaves públicas Stellar válidas.

- [ ] **Step 1: Escrever testes que exijam uma conta recebedora separada**

```ts
expect(loadStellarConfig({
  NEXT_PUBLIC_STELLAR_ISSUER: issuer,
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  STELLAR_PAYMENT_RECEIVER: receiver,
})).toMatchObject({ issuerPublicKey: issuer, receiverPublicKey: receiver });
```

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `pnpm vitest run tests/config.test.ts`

- [ ] **Step 3: Adicionar `receiverPublicKey` ao carregamento de configuração**

```ts
export type StellarConfig = {
  assetCode: "BRLT";
  horizonUrl: string;
  issuerPublicKey: string;
  receiverPublicKey: string;
  network: "testnet";
  networkPassphrase: string;
};
```

- [ ] **Step 4: Corrigir a especificação funcional**

Registrar explicitamente: emissor cria o ativo; tesouraria distribui e recebe; cliente paga a `receiver_public_key`; enviar BR ao emissor representa resgate/queima e não é o fluxo normal da fatura.

- [ ] **Step 5: Executar `pnpm vitest run tests/config.test.ts` e confirmar sucesso**

### Task 2: Persistir o recebedor em cada fatura

**Files:**
- Create: `supabase/migrations/0018_invoice_payment_receiver.sql`
- Modify: `app/lib/invoices/validation.ts`
- Modify: `app/lib/invoices/service.ts`
- Modify: `app/lib/invoices/client-types.ts`
- Modify: `app/lib/stellar/transactions.ts`
- Test: `tests/migrations/invoices.test.ts`
- Test: `tests/invoices/validation.test.ts`
- Test: `tests/invoices/mapper.test.ts`

**Interfaces:**
- Produces: coluna `public.invoices.receiver_public_key text`.
- Produces: `PendingInvoice.receiverPublicKey: string`.
- Consumes: `StellarConfig.receiverPublicKey` da Task 1.

- [ ] **Step 1: Escrever testes para persistência e mapeamento de `receiverPublicKey`**

```ts
expect(invoice).toMatchObject({
  assetIssuer: issuer,
  issuerPublicKey: issuer,
  receiverPublicKey: receiver,
});
```

- [ ] **Step 2: Executar os testes afetados e confirmar a falha**

Run: `pnpm vitest run tests/migrations/invoices.test.ts tests/invoices/validation.test.ts tests/invoices/mapper.test.ts`

- [ ] **Step 3: Criar a migration aditiva**

```sql
alter table public.invoices add column receiver_public_key text;
update public.invoices set receiver_public_key = issuer_public_key where receiver_public_key is null;
alter table public.invoices alter column receiver_public_key set not null;
alter table public.invoices add constraint invoices_receiver_public_key_format
  check (receiver_public_key ~ '^G[A-Z2-7]{55}$');
```

Faturas antigas preservam o destino original; novas faturas recebem a tesouraria configurada.

- [ ] **Step 4: Passar `receiverPublicKey` por draft, persistência, mapper e tipos do cliente**

Alterar `createInvoiceDraft(input, issuerPublicKey, receiverPublicKey)` e incluir `receiver_public_key` no insert/select.

- [ ] **Step 5: Executar novamente os três arquivos de teste e confirmar sucesso**

### Task 3: Pagar e verificar contra o recebedor

**Files:**
- Modify: `app/lib/stellar/transactions.ts`
- Modify: `app/lib/stellar/payment-verifier.ts`
- Modify: `app/lib/invoices/verification-service.ts`
- Modify: `app/api/admin/invoices/route.ts`
- Test: `tests/stellar/transactions.test.ts`
- Test: `tests/stellar/payment-verifier.test.ts`
- Test: `tests/invoices/verification-service.test.ts`
- Test: `tests/stellar/freighter-client.test.ts`
- Test: `tests/stellar/demo-wallet-client.test.ts`

**Interfaces:**
- Consumes: `PendingInvoice.receiverPublicKey`.
- Produces: payment XDR com destino exato `receiverPublicKey`.
- Produces: confirmação somente quando `payment.to === receiverPublicKey` e `asset_issuer === assetIssuer`.

- [ ] **Step 1: Escrever testes em que emissor e recebedor são contas diferentes**

```ts
expect(transaction.operations[0]).toMatchObject({
  destination: receiver,
  amount: "5.0000000",
  type: "payment",
});
```

- [ ] **Step 2: Executar os testes e confirmar que o destino antigo falha**

Run: `pnpm vitest run tests/stellar/transactions.test.ts tests/stellar/payment-verifier.test.ts tests/invoices/verification-service.test.ts tests/stellar/freighter-client.test.ts tests/stellar/demo-wallet-client.test.ts`

- [ ] **Step 3: Substituir o destino usado na construção e revisão do XDR**

```ts
Operation.payment({
  destination: invoice.receiverPublicKey,
  asset: new Asset("BRLT", invoice.assetIssuer),
  amount: invoice.amount,
});
```

Remover a condição `invoice.assetIssuer === invoice.issuerPublicKey`; manter validações independentes de ativo, emissor, origem, destino, valor e memo.

- [ ] **Step 4: Atualizar o verificador do Horizon**

```ts
if (payment.to !== invoice.receiverPublicKey) {
  return { reason: "Unexpected destination", status: "rejected" as const };
}
```

- [ ] **Step 5: Executar novamente os cinco arquivos de teste e confirmar sucesso**

### Task 4: Ajustar a demonstração, interface e prova on-chain

**Files:**
- Modify: `app/lib/demo/persistent-session.ts`
- Modify: `app/api/demo/distribute/route.ts`
- Modify: `app/api/demo/resume/route.ts`
- Modify: `app/components/InvoicePortal.tsx`
- Modify: `tests/api/demo-provision.test.ts`
- Modify: `tests/api/demo-resume.test.ts`
- Modify: `tests/e2e/invoice-flow.spec.ts`
- Modify: `docs/testnet-evidence.md`
- Modify: `docs/operations.md`

**Interfaces:**
- Consumes: recebedor derivado da conta distribuidora.
- Produces: demonstração `tesouraria -25`, `cliente +25`, depois `cliente -5`, `tesouraria +5`.

- [ ] **Step 1: Escrever teste E2E com emissor, recebedor e cliente distintos**

O teste deve rejeitar pagamento ao emissor e aceitar somente pagamento à tesouraria configurada.

- [ ] **Step 2: Atualizar `ensureDemoInvoice` para receber emissor e recebedor**

```ts
ensureDemoInvoice(customerPublicKey, issuerPublicKey, receiverPublicKey);
```

A migration `0018` deve substituir a função SQL correspondente, revogar a assinatura antiga e conceder execução apenas a `service_role`.

- [ ] **Step 3: Atualizar a interface**

Exibir separadamente “Emissor do ativo BRLT” e “Conta recebedora da fatura”, com revisão explícita antes da assinatura.

- [ ] **Step 4: Executar validação completa**

Run: `pnpm test && pnpm typecheck && pnpm build`

Run: `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/integration/database.sql`

- [ ] **Step 5: Validar na Testnet após deploy**

Confirmar no Horizon, usando uma sessão nova:

1. tesouraria envia `25 BRLT` ao cliente;
2. cliente passa de `25` para `20 BRLT` após pagar `5`;
3. tesouraria recebe os `5 BRLT` de volta;
4. emissor continua sem trustline do próprio ativo;
5. hash, origem, destino, ativo, valor e memo coincidem com o banco.

- [ ] **Step 6: Registrar os hashes e saldos em `docs/testnet-evidence.md`**

Não reutilizar as contas/hashes da evidência de 13/09/2026 como prova da nova implementação.

## Completion Gate

- [ ] Especificação aprovada reflete três papéis distintos.
- [ ] Migration `0018` aplicada sem apagar dados existentes.
- [ ] Testes, typecheck e build passam.
- [ ] Revisão de segurança confirma que seeds continuam somente no cliente/servidor autorizado.
- [ ] Uma nova demonstração pública prova os três saldos no Horizon Testnet.
