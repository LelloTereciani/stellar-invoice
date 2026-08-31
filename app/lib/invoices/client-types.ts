export type InvoiceStatus = "confirmed" | "expired" | "pending";

export type CustomerInvoice = {
  amount: string;
  assetIssuer: string;
  confirmedTransactionHash: string | null;
  debtorPublicKey: string;
  dueAt: string;
  id: string;
  issuerPublicKey: string;
  memo: string;
  rejectedAttempts?: Array<{ observedAt: string; reason: string; transactionHash: string }>;
  status: InvoiceStatus;
};
