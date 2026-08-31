"use client";

import { useCallback, useEffect, useState } from "react";

import { useFreighter, type WalletFlowStatus } from "../hooks/useFreighter.js";
import type { CustomerInvoice } from "../lib/invoices/client-types.js";
import { AppHeader } from "./AppHeader.js";
import { StatusBadge } from "./StatusBadge.js";

const FLOW_LABELS: Record<WalletFlowStatus, string> = {
  authenticated: "Carteira autenticada.",
  "awaiting-signature": "Aguardando sua assinatura na carteira...",
  confirmed: "Pagamento confirmado no ledger da Stellar.",
  connecting: "Autenticando carteira...",
  error: "A operação não foi concluída.",
  idle: "",
  preparing: "Preparando a transação...",
  reviewing: "Revisando os dados exatos do pagamento...",
  submitting: "Enviando a transação assinada...",
  verifying: "Verificando a transação no ledger...",
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="ledger-field ledger-field--wide">
      <span className="eyebrow">{label}</span>
      <div className="copy-line"><code>{value}</code><button className="text-button" type="button" onClick={copy}>{copied ? "Copiado" : "Copiar"}</button></div>
    </div>
  );
}

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const wallet = useFreighter();
  const [invoice, setInvoice] = useState<CustomerInvoice>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`);
    const payload = (await response.json()) as CustomerInvoice & { error?: string };
    if (!response.ok) {
      setLoadError(payload.error || "Não foi possível carregar a fatura");
      setLoading(false);
      return false;
    }
    setInvoice(payload);
    setLoadError(undefined);
    setLoading(false);
    return true;
  }, [invoiceId]);

  useEffect(() => {
    void loadInvoice();
  }, [loadInvoice]);

  useEffect(() => {
    if (loadError && wallet.walletKind === "demo") {
      void wallet.connectDemo().then((address) => { if (address) void loadInvoice(); });
    }
    // connectDemo is stable; limiting dependencies prevents repeated challenge issuance.
    // connectDemo é estável; limitar dependências evita emitir desafios repetidos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadError, wallet.walletKind]);

  async function connectAndLoad() {
    const address = await wallet.connect();
    if (address) await loadInvoice();
  }

  async function pay() {
    if (!invoice) return;
    const hash = await wallet.payInvoice(invoice);
    if (hash) await loadInvoice();
  }

  const hash = invoice?.confirmedTransactionHash ?? wallet.transactionHash;
  const canPay = invoice?.status === "pending" && wallet.walletPublicKey === invoice.debtorPublicKey;

  return (
    <div className="app-frame">
      <AppHeader onConnect={connectAndLoad} walletPublicKey={wallet.walletPublicKey} />
      <section className="intro-band">
        <div className="shell"><p className="kicker">FATURA · VERIFICAÇÃO ON-CHAIN</p><h1>Revise antes de assinar</h1><p>O histórico na rede Stellar é a fonte da verdade. A aplicação não guarda sua chave e nunca inicia o pagamento no servidor.</p></div>
      </section>
      <main className="shell detail-page">
        {loading ? <section className="panel loading-block" aria-live="polite"><p>Carregando os dados autenticados da fatura...</p></section> : null}
        {!loading && loadError ? (
          <section className="panel auth-gate">
            <p className="kicker">ACESSO PROTEGIDO</p><h2>Autentique a carteira devedora</h2>
            <p>{loadError}</p>
            <button className="button button--primary" type="button" onClick={connectAndLoad}>Conectar Freighter</button>
          </section>
        ) : null}
        {invoice ? (
          <article className="panel invoice-detail">
            <div className="detail-heading"><div><p className="kicker">ID: {invoice.id}</p><h2>Fatura {invoice.memo}</h2></div><StatusBadge status={invoice.status} /></div>
            <div className="ledger-grid">
              <div className="ledger-field"><span className="eyebrow">Valor exato</span><strong className="mono amount">{invoice.amount} BRLT</strong></div>
              <div className="ledger-field"><span className="eyebrow">Vencimento</span><span className="mono">{new Date(invoice.dueAt).toISOString().replace("T", " ").slice(0, 16)} UTC</span></div>
              <CopyField label="Emissor do ativo BRLT" value={invoice.assetIssuer} />
              <CopyField label="Destino do pagamento" value={invoice.issuerPublicKey} />
              <CopyField label="Devedor — sua carteira" value={invoice.debtorPublicKey} />
              <div className="ledger-field"><span className="eyebrow">Memo obrigatório</span><code className="memo">{invoice.memo}</code></div>
              <div className="ledger-field"><span className="eyebrow">Rede</span><span className="mono">Stellar Testnet</span></div>
            </div>
            {invoice.rejectedAttempts?.length ? (
              <section className="audit-history"><strong>Histórico de tentativas rejeitadas</strong>{invoice.rejectedAttempts.map((attempt) => <p className="mono" key={attempt.transactionHash}>{attempt.reason} · {new Date(attempt.observedAt).toISOString().slice(0, 16)} UTC</p>)}</section>
            ) : null}
            <section className="review-block">
              <p className="eyebrow">REVISÃO OBRIGATÓRIA</p>
              <p><strong>{invoice.amount} BRLT</strong> sairá de <code>{invoice.debtorPublicKey}</code> para <code>{invoice.issuerPublicKey}</code>, com memo <code>{invoice.memo}</code>, somente na Stellar Testnet.</p>
            </section>
            <div className="security-note"><strong>TESTNET · SEM VALOR REAL</strong><p>A assinatura acontece na sua carteira. Nunca informe uma seed. Criar uma trustline apenas autoriza receber BRLT fictício; não é pagamento.</p></div>
            {wallet.error ? <p className="error-message" role="alert">{wallet.error}</p> : null}
            {FLOW_LABELS[wallet.status] ? <p className="flow-status" aria-live="polite">{FLOW_LABELS[wallet.status]}</p> : null}
            {hash ? <div className="confirmation"><strong>Hash da transação</strong><code>{hash}</code><a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} rel="noreferrer" target="_blank">Abrir no Stellar Expert ↗</a></div> : null}
            {invoice.status === "pending" ? (
              <div className="action-row">
                {wallet.walletKind === "freighter" ? <button className="button button--secondary" type="button" onClick={wallet.createTrustline}>Estabelecer trustline</button> : null}
                <button className="button button--primary" disabled={!canPay || !["authenticated", "confirmed", "idle", "error"].includes(wallet.status)} type="button" onClick={pay}>Revisar e assinar pagamento →</button>
              </div>
            ) : null}
          </article>
        ) : null}
      </main>
    </div>
  );
}
