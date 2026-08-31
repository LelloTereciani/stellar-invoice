import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";
import { createInvoiceDraft, type InvoiceInput } from "./validation.js";

type InvoiceRow = { id: string; amount: string; asset_issuer: string; confirmed_transaction_hash?: string | null; debtor_public_key: string; due_at: string; issuer_public_key: string; memo: string; status: "pending" | "confirmed" | "expired" };

export function mapInvoiceRow(row: InvoiceRow) {
  return {
    amount: row.amount,
    assetIssuer: row.asset_issuer,
    confirmedTransactionHash: row.confirmed_transaction_hash ?? null,
    debtorPublicKey: row.debtor_public_key,
    dueAt: row.due_at,
    id: row.id,
    issuerPublicKey: row.issuer_public_key,
    memo: row.memo,
    status: row.status,
  };
}

export async function persistInvoice(input: InvoiceInput, issuerPublicKey: string) {
  const draft = createInvoiceDraft(input, issuerPublicKey);
  const database = createClient(
    requireServerEnv("SUPABASE_URL", process.env),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env),
    { auth: { persistSession: false } },
  );
  const { data, error } = await database
    .from("invoices")
    .insert({
      amount: draft.amount,
      asset_code: draft.assetCode,
      asset_issuer: draft.assetIssuer,
      debtor_public_key: draft.debtorPublicKey,
      due_at: draft.dueAt,
      issuer_public_key: draft.issuerPublicKey,
      memo: draft.memo,
    })
    .select("id,memo,status")
    .single();
  if (error) throw new Error("Could not persist invoice");
  return data;
}

function serverDatabase() {
  return createClient(
    requireServerEnv("SUPABASE_URL", process.env),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env),
    { auth: { persistSession: false } },
  );
}

export async function findInvoice(id: string) {
  const { data, error } = await serverDatabase().from("invoices").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Invoice was not found");
  return mapInvoiceRow(data as InvoiceRow);
}

export async function confirmInvoice(id: string, transactionHash: string) {
  const { data, error } = await serverDatabase().rpc("confirm_invoice", { confirmed_at: new Date().toISOString(), invoice_id: id, transaction_hash: transactionHash });
  if (error) throw new Error("Invoice could not be confirmed");
  return data;
}

export async function expireInvoice(id: string) {
  const { data, error } = await serverDatabase().rpc("expire_invoice", { invoice_id: id });
  if (error) throw new Error("Invoice could not be expired");
  return data;
}

export async function recordRejectedPayment(invoiceId: string, transactionHash: string, reason: string) {
  const { error } = await serverDatabase().rpc("record_rejected_payment_attempt", {
    invoice_id: invoiceId,
    rejection_reason: reason,
    transaction_hash: transactionHash,
  });
  if (error) throw new Error("Rejected payment attempt could not be recorded");
}
