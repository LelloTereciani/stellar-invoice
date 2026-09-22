"use client";

import { useCallback, useEffect, useState } from "react";

import { useFreighter } from "../hooks/useFreighter.js";
import type { CustomerInvoice } from "../lib/invoices/client-types.js";
import { AppHeader } from "./AppHeader.js";
import { CreateInvoiceModal } from "./CreateInvoiceModal.js";
import { DemoStarter } from "./DemoStarter.js";
import { InvoiceList } from "./InvoiceList.js";
import { WalletStatusPanel, type WalletStatusSummary } from "./WalletStatusPanel.js";

export function InvoicePortal() {
  const wallet = useFreighter();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [role, setRole] = useState<"payable" | "receivable">("payable");
  const [summary, setSummary] = useState<WalletStatusSummary>();
  const [message, setMessage] = useState("Conecte a carteira devedora ou inicie a demonstração automática.");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadInvoices = useCallback(async (selectedRole: "payable" | "receivable" = role) => {
    const response = await fetch(`/api/invoices?role=${selectedRole}`);
    const payload = (await response.json()) as { error?: string; invoices?: CustomerInvoice[] };
    if (!response.ok) {
      setMessage(payload.error || "Autentique sua carteira para consultar faturas.");
      return;
    }
    setInvoices(payload.invoices ?? []);
    setMessage(payload.invoices?.length
      ? (selectedRole === "payable" ? "Faturas a pagar desta carteira." : "Faturas a receber desta carteira.")
      : `Nenhuma fatura ${selectedRole === "payable" ? "a pagar" : "a receber"} foi encontrada para ${wallet.walletPublicKey}.`);
  }, [role, wallet.walletPublicKey]);

  const loadWalletStatus = useCallback(async () => {
    const response = await fetch("/api/wallet/status");
    if (!response.ok) { setSummary(undefined); return; }
    setSummary(await response.json() as WalletStatusSummary);
  }, []);

  useEffect(() => {
    if (wallet.walletPublicKey) {
      void loadInvoices(role);
      void loadWalletStatus();
    } else {
      setInvoices([]);
      setSummary(undefined);
      setMessage("Autentique uma carteira para consultar faturas.");
    }
  }, [loadInvoices, loadWalletStatus, role, wallet.walletPublicKey]);

  async function connect() {
    const address = await wallet.connect();
    if (address) await loadInvoices(role);
  }

  function selectRole(nextRole: "payable" | "receivable") {
    setRole(nextRole);
  }

  async function handleInvoiceCreated(created: { id: string; memo: string; receiver_public_key: string }) {
    const nextRole = created.receiver_public_key === wallet.walletPublicKey ? "receivable" : "payable";
    setRole(nextRole);
    await loadInvoices(nextRole);
    setMessage(`Fatura ${created.memo} criada com sucesso!`);
  }

  return (
    <div className="app-frame">
      <AppHeader onConnect={connect} onLogout={wallet.logout} walletKind={wallet.walletKind} walletPublicKey={wallet.walletPublicKey} />
      <section className="intro-band"><div className="shell"><p className="kicker">PORTAL B2B · STELLAR TESTNET</p><h1>Portal de Faturamento</h1><p>Confira dados exatos, assine na sua carteira e valide o pagamento diretamente no ledger da Stellar.</p></div></section>
      <main className="shell workspace">
        <section className="workspace__list">
          <WalletStatusPanel session={wallet.sessionState} summary={summary} />
          <div className="section-heading">
            <div>
              <p className="kicker">{role === "payable" ? "CARTEIRA DEVEDORA" : "CARTEIRA RECEBEDORA"}</p>
              <h2>Suas faturas</h2>
            </div>
            <div className="section-actions">
              {wallet.walletPublicKey ? (
                <button
                  className="btn-new-invoice"
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  + Nova fatura
                </button>
              ) : null}
              <span className="count">{invoices.length.toString().padStart(2, "0")}</span>
            </div>
          </div>
          <div className="role-tabs" aria-label="Papel da carteira"><button aria-pressed={role === "payable"} type="button" onClick={() => selectRole("payable")}>A pagar</button><button aria-pressed={role === "receivable"} type="button" onClick={() => selectRole("receivable")}>A receber</button></div>
          <p className="section-message" aria-live="polite">{wallet.error || message}</p>
          <InvoiceList invoices={invoices} />
          {wallet.walletKind !== "freighter" ? <div className="demo-callout"><p className="kicker">AMBIENTE DE DEMONSTRAÇÃO</p><h3>Teste sem configurar uma carteira</h3><p>Cria uma chave Testnet descartável somente neste navegador, usa o faucet e provisiona BRLT fictício.</p><DemoStarter /></div> : null}
        </section>
        <section className="panel welcome-panel">
          <div><p className="kicker">FLUXO VERIFICÁVEL</p><h2>Da fatura ao ledger</h2><p>Escolha uma fatura para revisar valor, ativo, emissor, conta recebedora, memo e vencimento antes de qualquer assinatura.</p></div>
          <ol className="process-list"><li><span>01</span><div><strong>Autentique</strong><p>Prove posse da carteira com uma mensagem de uso único.</p></div></li><li><span>02</span><div><strong>Revise e assine</strong><p>A transação é construída para o devedor e assinada somente no navegador.</p></div></li><li><span>03</span><div><strong>Verifique</strong><p>O servidor confirma cada campo contra o ledger Testnet.</p></div></li></ol>
          <div className="testnet-stamp"><span>TESTNET</span><strong>BRLT FICTÍCIO</strong><small>SEM VALOR REAL</small></div>
        </section>
      </main>
      {wallet.walletPublicKey ? (
        <CreateInvoiceModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          walletPublicKey={wallet.walletPublicKey}
          onInvoiceCreated={handleInvoiceCreated}
        />
      ) : null}
    </div>
  );
}
