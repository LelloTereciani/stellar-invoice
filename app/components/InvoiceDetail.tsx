"use client";

import { useCallback, useEffect, useState } from "react";

import { useFreighter, type WalletFlowStatus } from "../hooks/useFreighter.js";
import type { CustomerInvoice } from "../lib/invoices/client-types.js";
import { payInvoiceDirectlyWithDemo, readDemoWallet } from "../lib/stellar/demo-wallet-client.js";
import { AppHeader } from "./AppHeader.js";
import { ExplorerLink } from "./ExplorerLink.js";
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

  async function connectAndLoad() {
    const address = wallet.walletKind === "demo"
      ? await wallet.connectDemo()
      : await wallet.connect();
    if (address) await loadInvoice();
  }

  async function pay() {
    if (!invoice) return;
    const hash = await wallet.payInvoice(invoice);
    if (hash) await loadInvoice();
  }

  const [demoStage, setDemoStage] = useState<string>();
  const [isPayingDemo, setIsPayingDemo] = useState(false);

  const hash = invoice?.confirmedTransactionHash ?? wallet.transactionHash;
  const canPay = invoice?.status === "pending" && wallet.walletPublicKey === invoice.debtorPublicKey;

  const localDemoWallet = typeof window !== "undefined" ? readDemoWallet() : undefined;
  const canDemoPay = Boolean(
    invoice?.status === "pending" &&
    localDemoWallet &&
    localDemoWallet.publicKey() === invoice.debtorPublicKey,
  );

  async function handlePayWithDemo() {
    if (!invoice || !localDemoWallet) return;
    setIsPayingDemo(true);
    setDemoStage("Iniciando pagamento...");
    try {
      const confirmedHash = await payInvoiceDirectlyWithDemo(localDemoWallet, invoice, (stage) => {
        const labels: Record<string, string> = {
          authenticating: "Autenticando carteira demo no servidor...",
          "awaiting-signature": "Assinando com a chave demo local...",
          confirmed: "Pagamento confirmado!",
          preparing: "Preparando transação de pagamento...",
          reviewing: "Revisando parâmetros da transação...",
          submitting: "Enviando pagamento para a Stellar Testnet...",
          verifying: "Confirmando pagamento no ledger...",
        };
        setDemoStage(labels[stage] || stage);
      });
      if (confirmedHash) {
        await loadInvoice();
      }
    } catch (err) {
      setDemoStage(err instanceof Error ? err.message : "Falha ao pagar com a demo");
    } finally {
      setIsPayingDemo(false);
    }
  }

  return (
    <div className="app-frame">
      <AppHeader onConnect={connectAndLoad} onLogout={wallet.logout} walletKind={wallet.walletKind} walletPublicKey={wallet.walletPublicKey} />
      <section className="intro-band">
        <div className="shell"><p className="kicker">FATURA · VERIFICAÇÃO ON-CHAIN</p><h1>Revise antes de assinar</h1><p>O histórico na rede Stellar é a fonte da verdade. A aplicação não guarda sua chave e nunca inicia o pagamento no servidor.</p></div>
      </section>
      <main className="shell detail-page">
        {loading ? <section className="panel loading-block" aria-live="polite"><p>Carregando os dados autenticados da fatura...</p></section> : null}
        {!loading && loadError ? (
          <section className="panel auth-gate">
            <p className="kicker">ACESSO PROTEGIDO</p><h2>Autentique a carteira devedora</h2>
            <p>{loadError}</p>
            <button className="button button--primary" type="button" onClick={connectAndLoad}>
              {wallet.walletKind === "demo" ? "Continuar demonstração" : "Conectar Freighter"}
            </button>
          </section>
        ) : null}
        {invoice ? (
          <article className="panel invoice-detail">
            <div className="detail-heading"><div><p className="kicker">ID: {invoice.id}</p><h2>Fatura {invoice.memo}</h2></div><StatusBadge status={invoice.status} /></div>
            <div className="ledger-grid">
              <div className="ledger-field"><span className="eyebrow">Valor exato</span><strong className="mono amount">{invoice.amount} BRLT</strong></div>
              <div className="ledger-field"><span className="eyebrow">Vencimento</span><span className="mono">{new Date(invoice.dueAt).toISOString().replace("T", " ").slice(0, 16)} UTC</span></div>
              <CopyField label="Emissor do ativo BRLT" value={invoice.assetIssuer} />
              <CopyField label="Conta recebedora da fatura" value={invoice.receiverPublicKey} />
              <CopyField label="Devedor — origem exata" value={invoice.debtorPublicKey} />
              <div className="ledger-field"><span className="eyebrow">Memo obrigatório</span><code className="memo">{invoice.memo}</code></div>
              <div className="ledger-field"><span className="eyebrow">Rede</span><span className="mono">Stellar Testnet</span></div>
            </div>
            {invoice.rejectedAttempts?.length ? (
              <section className="audit-history"><strong>Histórico de tentativas rejeitadas</strong>{invoice.rejectedAttempts.map((attempt) => <p className="mono" key={attempt.transactionHash}>{attempt.reason} · {new Date(attempt.observedAt).toISOString().slice(0, 16)} UTC</p>)}</section>
            ) : null}
            <section className="review-block">
              <p className="eyebrow">REVISÃO OBRIGATÓRIA</p>
              <p><strong>{invoice.amount} BRLT</strong> sairá de <code>{invoice.debtorPublicKey}</code> para a conta recebedora <code>{invoice.receiverPublicKey}</code>, com o ativo emitido por <code>{invoice.assetIssuer}</code> e memo <code>{invoice.memo}</code>, somente na Stellar Testnet.</p>
            </section>
            <div className="security-note"><strong>TESTNET · SEM VALOR REAL</strong><p>A assinatura acontece na sua carteira. Nunca informe uma seed. Criar uma trustline apenas autoriza receber BRLT fictício; não é pagamento.</p></div>
            {wallet.error ? <p className="error-message" role="alert">{wallet.error}</p> : null}
            {FLOW_LABELS[wallet.status] ? <p className="flow-status" aria-live="polite">{FLOW_LABELS[wallet.status]}</p> : null}
            {hash ? <div className="confirmation"><strong>Hash da transação</strong><code>{hash}</code><ExplorerLink transactionHash={hash} /></div> : null}
            {invoice.status === "pending" && invoice.viewerRole !== "receiver" ? (
              <div className="action-row">
                {wallet.walletKind === "freighter" ? <button className="button button--secondary" type="button" onClick={wallet.createTrustline}>Estabelecer trustline</button> : null}
                <button className="button button--primary" disabled={!canPay || !["authenticated", "confirmed", "idle", "error"].includes(wallet.status)} type="button" onClick={pay}>Revisar e assinar pagamento →</button>
              </div>
            ) : null}
            {canDemoPay ? (
              <div className="demo-callout" style={{ marginTop: "20px" }}>
                <p className="kicker">AÇÃO RÁPIDA · TESTNET</p>
                <h3>Carteira Devedora detectada neste navegador</h3>
                <p>
                  A chave devedora desta fatura (<code>{invoice.debtorPublicKey}</code>) é a sua carteira demo local. Você pode assinar e transferir os <strong>{invoice.amount} BRLT</strong> agora com 1 clique.
                </p>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={handlePayWithDemo}
                  disabled={isPayingDemo}
                >
                  {isPayingDemo ? (demoStage || "Processando pagamento...") : "⚡ Pagar esta fatura com a Carteira Demo (1 clique)"}
                </button>
                {demoStage && !isPayingDemo ? <p className="mono" style={{ fontSize: "12px", marginTop: "10px" }}>{demoStage}</p> : null}
              </div>
            ) : null}
            {invoice.viewerRole === "receiver" ? (
              <div className="receiver-notice">
                <p className="flow-status">Esta carteira é a recebedora. A fatura está disponível para acompanhamento da liquidação.</p>
              </div>
            ) : null}
          </article>
        ) : null}
      </main>
    </div>
  );
}
