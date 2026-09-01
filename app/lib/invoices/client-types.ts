export type InvoiceStatus = "confirmed" | "expired" | "pending";

export type CustomerInvoice = {
  amount: string;
  assetIssuer: string;
  confirmedTransactionHash: string | null;
  createdAt: string;
  debtorPublicKey: string;
  dueAt: string;
  id: string;
  issuerPublicKey: string;
  memo: string;
  preparedPaymentExpiresAt: string | null;
  preparedPaymentHash: string | null;
  preparedPaymentXdr: string | null;
  rejectedAttempts?: Array<{ observedAt: string; reason: string; transactionHash: string }>;
  status: InvoiceStatus;
};
