export type VerificationInvoice = {
  amount: string;
  assetIssuer: string;
  confirmedTransactionHash: string | null;
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
  confirm(invoiceId: string, transactionHash: string): Promise<unknown>;
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
  if (invoice.status === "expired" || new Date(invoice.dueAt) <= now) {
    if (invoice.status === "pending") await repository.expire(invoice.id);
    return { status: "expired" };
  }

  const ledger = await loadLedger();
  const verification = ledger.transaction.hash === transactionHash
    ? verifyPayment(invoice, ledger.transaction, ledger.operations)
    : { reason: "Ledger returned an unexpected transaction", status: "rejected" as const };
  if (verification.status === "rejected") {
    await repository.recordRejected(invoice.id, transactionHash, verification.reason);
    return verification;
  }
  return repository.confirm(invoice.id, verification.transactionHash);
}
import { verifyPayment, type LedgerOperation, type LedgerTransaction } from "../stellar/payment-verifier.js";
