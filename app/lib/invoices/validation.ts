import { Keypair } from "@stellar/stellar-sdk";

export type InvoiceInput = { debtorPublicKey: string; amount: string; dueAt: string };
export type InvoiceDraft = InvoiceInput & { assetCode: "BRLT"; assetIssuer: string; issuerPublicKey: string; memo: string; status: "pending" };

function assertPublicKey(value: string, label: string) {
  try { Keypair.fromPublicKey(value); } catch { throw new Error(`${label} must be a valid Stellar public key`); }
}

export function createInvoiceDraft(input: InvoiceInput, issuerPublicKey: string, now = new Date()): InvoiceDraft {
  assertPublicKey(input.debtorPublicKey, "Debtor");
  assertPublicKey(issuerPublicKey, "Issuer");
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(input.amount) || /^0(?:\.0+)?$/.test(input.amount)) throw new Error("Amount must be positive with at most seven decimals");
  const dueAt = new Date(input.dueAt);
  if (Number.isNaN(dueAt.valueOf()) || dueAt <= now) throw new Error("Due date must be in the future");
  return { ...input, assetCode: "BRLT", assetIssuer: issuerPublicKey, issuerPublicKey, memo: `inv-${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`, status: "pending" };
}
