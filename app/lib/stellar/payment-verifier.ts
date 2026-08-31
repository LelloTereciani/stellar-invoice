import type { PendingInvoice } from "./transactions.js";

type LedgerTransaction = { hash: string; memo: string; source_account: string };
type LedgerOperation = { amount?: string; asset_code?: string; asset_issuer?: string; destination?: string; type: string };

export function verifyPayment(invoice: PendingInvoice, transaction: LedgerTransaction, operations: LedgerOperation[]) {
  const payment = operations.find((operation) => operation.type === "payment");
  if (!payment) return { reason: "No payment operation", status: "rejected" as const };
  if (transaction.source_account !== invoice.debtorPublicKey) return { reason: "Unexpected source account", status: "rejected" as const };
  if (transaction.memo !== invoice.memo) return { reason: "Unexpected memo", status: "rejected" as const };
  if (payment.destination !== invoice.issuerPublicKey) return { reason: "Unexpected destination", status: "rejected" as const };
  if (payment.asset_code !== "BRLT" || payment.asset_issuer !== invoice.assetIssuer) return { reason: "Unexpected asset", status: "rejected" as const };
  if (payment.amount !== invoice.amount) return { reason: "Unexpected amount", status: "rejected" as const };
  return { transactionHash: transaction.hash, status: "confirmed" as const };
}
