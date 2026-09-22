"use client";

import type { WalletSessionState } from "../lib/wallet/session-state.js";

export type WalletStatusSummary = {
  brlt: { authorized: boolean | null; balance: string; limit: string | null; trustlinePresent: boolean };
  network: "testnet";
  publicKey: string;
  refreshedAt: string;
  xlmBalance: string;
};

export function WalletStatusPanel({ session, summary }: { session: WalletSessionState; summary?: WalletStatusSummary }) {
  const active = session.active;
  return (
    <section className="wallet-status" aria-live="polite">
      <div>
        <p className="kicker">SESSÃO ATIVA</p>
        <strong>{active ? (active.mode === "demo" ? "Demonstração" : "Freighter") : "Nenhuma"}</strong>
        {active ? <code>{active.publicKey}</code> : <p>Autentique uma carteira para consultar dados e faturas.</p>}
      </div>
      {session.freighter.publicKey && session.freighter.status !== "authenticated" ? (
        <div><p className="kicker">FREIGHTER DETECTADA, NÃO ATIVA</p><code>{session.freighter.publicKey}</code></div>
      ) : null}
      <p className="wallet-status__message">{session.transition.message}</p>
      {session.transition.detail ? <details><summary>Detalhes técnicos</summary><code>{session.transition.detail}</code></details> : null}
      {active && summary ? (
        <div className="balance-grid">
          <span><small>Rede</small><strong>Stellar Testnet</strong></span>
          <span><small>XLM</small><strong className="mono">{summary.xlmBalance}</strong></span>
          <span><small>BRLT</small><strong className="mono">{summary.brlt.balance}</strong></span>
          <span><small>Trustline BRLT</small><strong>{summary.brlt.trustlinePresent ? (summary.brlt.authorized ? "Autorizada" : "Não autorizada") : "Ausente"}</strong></span>
          <span><small>Limite</small><strong className="mono">{summary.brlt.limit ?? "—"}</strong></span>
          <span><small>Atualizado</small><strong>{new Date(summary.refreshedAt).toLocaleTimeString("pt-BR")}</strong></span>
        </div>
      ) : null}
    </section>
  );
}
