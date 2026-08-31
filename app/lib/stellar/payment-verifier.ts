import type { PendingInvoice } from "./transactions.js";

export type LedgerTransaction = { hash: string; memo: string; memo_type: "text"; source_account: string; successful: boolean };
export type LedgerOperation = { amount?: string; asset_code?: string; asset_issuer?: string; destination?: string; source_account?: string; transaction_successful?: boolean; type: string };

export function verifyPayment(invoice: PendingInvoice, transaction: LedgerTransaction, operations: LedgerOperation[]) {
  if (!transaction.successful) return { reason: "Transaction was not successful", status: "rejected" as const };
  if (transaction.memo_type !== "text") return { reason: "Transaction memo is not text", status: "rejected" as const };
  const payment = operations.find((operation) => operation.type === "payment");
  if (!payment) return { reason: "No payment operation", status: "rejected" as const };
  if (payment.transaction_successful !== true) return { reason: "Payment operation was not successful", status: "rejected" as const };
  if (payment.source_account !== invoice.debtorPublicKey) return { reason: "Unexpected operation source", status: "rejected" as const };
  if (transaction.source_account !== invoice.debtorPublicKey) return { reason: "Unexpected source account", status: "rejected" as const };
  if (transaction.memo !== invoice.memo) return { reason: "Unexpected memo", status: "rejected" as const };
  if (payment.destination !== invoice.issuerPublicKey) return { reason: "Unexpected destination", status: "rejected" as const };
  if (payment.asset_code !== "BRLT" || payment.asset_issuer !== invoice.assetIssuer) return { reason: "Unexpected asset", status: "rejected" as const };
  if (payment.amount !== invoice.amount) return { reason: "Unexpected amount", status: "rejected" as const };
  return { transactionHash: transaction.hash, status: "confirmed" as const };
}
