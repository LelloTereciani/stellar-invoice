export type VerificationInvoice = {
  amount: string;
  assetIssuer: string;
  confirmedTransactionHash: string | null;
  createdAt: string;
  debtorPublicKey: string;
  dueAt: string;
  id: string;
  issuerPublicKey: string;
  memo: string;
  status: "pending" | "confirmed" | "expired";
};

type LedgerResult = {
  operations: LedgerOperation[];
  transaction: LedgerTransaction;
};

export interface VerificationRepository {
  confirm(invoiceId: string, transactionHash: string, observedAt: string): Promise<unknown>;
  expire(invoiceId: string): Promise<unknown>;
  recordRejected(invoiceId: string, transactionHash: string, reason: string): Promise<void>;
}

export async function processInvoiceVerification(
  invoice: VerificationInvoice,
  transactionHash: string,
  loadLedger: () => Promise<LedgerResult>,
  repository: VerificationRepository,
  now = new Date(),
): Promise<unknown> {
  if (invoice.status === "confirmed") {
    if (invoice.confirmedTransactionHash !== transactionHash) throw new Error("Invoice is already confirmed by another transaction");
    return { status: "confirmed", transactionHash };
  }
  const ledger = await loadLedger();
  let verification = ledger.transaction.hash === transactionHash
    ? verifyPayment(invoice, ledger.transaction, ledger.operations)
    : { reason: "Ledger returned an unexpected transaction", status: "rejected" as const };
  const observedAt = new Date(ledger.transaction.created_at);
  if (verification.status === "confirmed" && (
    Number.isNaN(observedAt.valueOf()) ||
    observedAt < new Date(invoice.createdAt) ||
    observedAt > new Date(invoice.dueAt)
  )) {
    verification = { reason: "Payment was not observed within the invoice validity window", status: "rejected" as const };
  }
  if (verification.status === "rejected") {
    await repository.recordRejected(invoice.id, transactionHash, verification.reason);
    if (invoice.status === "pending" && new Date(invoice.dueAt) <= now) await repository.expire(invoice.id);
    return verification;
  }
  return repository.confirm(invoice.id, verification.transactionHash, observedAt.toISOString());
}
import { verifyPayment, type LedgerOperation, type LedgerTransaction } from "../stellar/payment-verifier.js";
