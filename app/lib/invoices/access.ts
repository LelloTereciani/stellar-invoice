export type CustomerInvoiceAccess = {
  debtorPublicKey: string;
  dueAt: string;
  status: "pending" | "confirmed" | "expired";
};

export function assertPayableByWallet(
  invoice: CustomerInvoiceAccess,
  walletPublicKey: string,
  now = new Date(),
): void {
  if (invoice.debtorPublicKey !== walletPublicKey) {
    throw new Error("The authenticated wallet is not the invoice debtor");
  }
  if (invoice.status !== "pending") throw new Error("Invoice is not pending");
  if (new Date(invoice.dueAt) <= now) throw new Error("Invoice is expired");
}
