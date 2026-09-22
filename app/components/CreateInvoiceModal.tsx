"use client";

import { Keypair } from "@stellar/stellar-sdk";
import { useEffect, useState } from "react";

type CreateInvoiceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  walletPublicKey: string;
  onInvoiceCreated: (invoice: { id: string; memo: string; receiver_public_key: string }) => void;
};

function isValidPublicKey(key: string): boolean {
  try {
    Keypair.fromPublicKey(key);
    return true;
  } catch {
    return false;
  }
}

function formatAmount(raw: string): string {
  const clean = raw.trim();
  if (!clean) return "";
  if (!clean.includes(".")) {
    return `${clean}.0000000`;
  }
  const [whole, dec] = clean.split(".");
  return `${whole}.${(dec + "0000000").slice(0, 7)}`;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  walletPublicKey,
  onInvoiceCreated,
}: CreateInvoiceModalProps) {
  const [roleMode, setRoleMode] = useState<"receive" | "pay">("receive");
  const [debtorPublicKey, setDebtorPublicKey] = useState("");
  const [receiverPublicKey, setReceiverPublicKey] = useState(walletPublicKey);
  const [amount, setAmount] = useState("5.0000000");
  const [dueHours, setDueHours] = useState(24);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (roleMode === "receive") {
      setReceiverPublicKey(walletPublicKey);
      if (debtorPublicKey === walletPublicKey) setDebtorPublicKey("");
    } else {
      setDebtorPublicKey(walletPublicKey);
      if (receiverPublicKey === walletPublicKey) setReceiverPublicKey("");
    }
  }, [roleMode, walletPublicKey]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);

    const activeDebtor = debtorPublicKey.trim();
    const activeReceiver = receiverPublicKey.trim();

    if (!isValidPublicKey(activeDebtor)) {
      setError("A chave pública da carteira devedora é inválida.");
      return;
    }
    if (!isValidPublicKey(activeReceiver)) {
      setError("A chave pública da conta recebedora é inválida.");
      return;
    }
    if (activeDebtor === activeReceiver) {
      setError("A carteira devedora e a recebedora devem ser contas diferentes.");
      return;
    }

    const formattedAmount = formatAmount(amount);
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(formattedAmount) || Number(formattedAmount) <= 0) {
      setError("O valor deve ser um número positivo em BRLT.");
      return;
    }

    const dueAt = new Date(Date.now() + dueHours * 3600 * 1000).toISOString();

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/invoices", {
        body: JSON.stringify({
          amount: formattedAmount,
          debtorPublicKey: activeDebtor,
          dueAt,
          receiverPublicKey: activeReceiver,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      const data = (await response.json()) as { error?: string; invoice?: { id: string; memo: string; receiver_public_key: string } };
      if (!response.ok || !data.invoice) {
        throw new Error(data.error || "Não foi possível emitir a fatura");
      }

      onInvoiceCreated(data.invoice);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao emitir fatura");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="kicker">EMISSÃO DE FATURA TESTNET</p>
            <h2 id="modal-title">Nova Fatura BRLT</h2>
          </div>
          <button className="text-button" type="button" onClick={onClose} aria-label="Fechar">✕ Fechar</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-role-selector">
            <span className="eyebrow">Objetivo desta fatura:</span>
            <div className="role-tabs">
              <button
                aria-pressed={roleMode === "receive"}
                type="button"
                onClick={() => setRoleMode("receive")}
              >
                📥 Quero Receber (Cobrar alguém)
              </button>
              <button
                aria-pressed={roleMode === "pay"}
                type="button"
                onClick={() => setRoleMode("pay")}
              >
                📤 Quero Pagar (Pagar alguém)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="eyebrow" htmlFor="debtor-key">
              Carteira Devedora (Quem vai pagar)
            </label>
            <input
              id="debtor-key"
              className="form-input mono"
              value={debtorPublicKey}
              onChange={(e) => setDebtorPublicKey(e.target.value)}
              placeholder="G..."
              disabled={roleMode === "pay" || isSubmitting}
              required
            />
            {roleMode === "pay" ? (
              <small className="form-hint">Sua carteira conectada está selecionada como devedora.</small>
            ) : (
              <small className="form-hint">Informe a chave pública Stellar de quem deve pagar esta fatura.</small>
            )}
          </div>

          <div className="form-group">
            <label className="eyebrow" htmlFor="receiver-key">
              Conta Recebedora (Quem vai receber)
            </label>
            <input
              id="receiver-key"
              className="form-input mono"
              value={receiverPublicKey}
              onChange={(e) => setReceiverPublicKey(e.target.value)}
              placeholder="G..."
              disabled={roleMode === "receive" || isSubmitting}
              required
            />
            {roleMode === "receive" ? (
              <small className="form-hint">Sua carteira conectada receberá os BRLT desta fatura.</small>
            ) : (
              <small className="form-hint">Informe a chave pública Stellar que receberá os fundos.</small>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="eyebrow" htmlFor="amount-input">
                Valor (BRLT)
              </label>
              <input
                id="amount-input"
                className="form-input mono"
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5.0000000"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label className="eyebrow" htmlFor="due-select">
                Prazo de Vencimento
              </label>
              <select
                id="due-select"
                className="form-input"
                value={dueHours}
                onChange={(e) => setDueHours(Number(e.target.value))}
                disabled={isSubmitting}
              >
                <option value={24}>24 horas (1 dia)</option>
                <option value={72}>72 horas (3 dias)</option>
                <option value={168}>7 dias (1 semana)</option>
              </select>
            </div>
          </div>

          {error ? <p className="error-message" role="alert">{error}</p> : null}

          <div className="modal-actions">
            <button className="button button--secondary" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button className="button button--primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Emitindo..." : "Emitir Fatura →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
