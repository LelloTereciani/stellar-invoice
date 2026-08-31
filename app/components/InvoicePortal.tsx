"use client";

import { useCallback, useEffect, useState } from "react";

import { useFreighter } from "../hooks/useFreighter.js";
import type { CustomerInvoice } from "../lib/invoices/client-types.js";
import { AppHeader } from "./AppHeader.js";
import { DemoStarter } from "./DemoStarter.js";
import { InvoiceList } from "./InvoiceList.js";

export function InvoicePortal() {
  const wallet = useFreighter();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [message, setMessage] = useState("Conecte a carteira devedora ou inicie a demonstração automática.");

  const loadInvoices = useCallback(async () => {
    const response = await fetch("/api/invoices");
    const payload = (await response.json()) as { error?: string; invoices?: CustomerInvoice[] };
    if (!response.ok) {
      setMessage(payload.error || "Autentique sua carteira para consultar faturas.");
      return;
    }
    setInvoices(payload.invoices ?? []);
    setMessage(payload.invoices?.length ? "Faturas destinadas à carteira autenticada." : "Nenhuma fatura foi destinada a esta carteira.");
  }, []);

  useEffect(() => {
    if (wallet.status === "authenticated") void loadInvoices();
  }, [loadInvoices, wallet.status]);

  async function connect() {
    const address = await wallet.connect();
    if (address) await loadInvoices();
  }

  return (
    <div className="app-frame">
      <AppHeader onConnect={connect} walletPublicKey={wallet.walletPublicKey} />
      <section className="intro-band"><div className="shell"><p className="kicker">PORTAL B2B · STELLAR TESTNET</p><h1>Portal de Faturamento</h1><p>Confira dados exatos, assine na sua carteira e valide o pagamento diretamente no ledger da Stellar.</p></div></section>
      <main className="shell workspace">
        <section className="workspace__list">
          <div className="section-heading"><div><p className="kicker">CARTEIRA DEVEDORA</p><h2>Suas faturas</h2></div><span className="count">{invoices.length.toString().padStart(2, "0")}</span></div>
          <p className="section-message" aria-live="polite">{wallet.error || message}</p>
          <InvoiceList invoices={invoices} />
          <div className="demo-callout"><p className="kicker">AMBIENTE DE DEMONSTRAÇÃO</p><h3>Teste sem configurar uma carteira</h3><p>Cria uma chave Testnet descartável somente neste navegador, usa o faucet e provisiona BRLT fictício.</p><DemoStarter /></div>
        </section>
        <section className="panel welcome-panel">
          <div><p className="kicker">FLUXO VERIFICÁVEL</p><h2>Da fatura ao ledger</h2><p>Escolha uma fatura para revisar valor, ativo, emissor, destino, memo e vencimento antes de qualquer assinatura.</p></div>
          <ol className="process-list"><li><span>01</span><div><strong>Autentique</strong><p>Prove posse da carteira com uma mensagem de uso único.</p></div></li><li><span>02</span><div><strong>Revise e assine</strong><p>A transação é construída para o devedor e assinada somente no navegador.</p></div></li><li><span>03</span><div><strong>Verifique</strong><p>O servidor confirma cada campo contra o ledger Testnet.</p></div></li></ol>
          <div className="testnet-stamp"><span>TESTNET</span><strong>BRLT FICTÍCIO</strong><small>SEM VALOR REAL</small></div>
        </section>
      </main>
    </div>
  );
}
