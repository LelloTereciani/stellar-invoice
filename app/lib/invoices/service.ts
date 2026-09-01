import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";
import { createInvoiceDraft, type InvoiceInput } from "./validation.js";

type InvoiceRow = { id: string; amount_text: string; asset_issuer: string; confirmed_transaction_hash?: string | null; created_at: string; debtor_public_key: string; due_at: string; issuer_public_key: string; memo: string; prepared_payment_expires_at?: string | null; prepared_payment_hash?: string | null; prepared_payment_xdr?: string | null; status: "pending" | "confirmed" | "expired" };
type RejectedAttemptRow = { observed_at: string; reason: string; transaction_hash: string };

export function mapInvoiceRow(row: InvoiceRow) {
  if (typeof row.amount_text !== "string" || !/^\d+\.\d{7}$/.test(row.amount_text)) {
    throw new Error("Invoice amount did not use the exact decimal text projection");
  }
  return {
    amount: row.amount_text,
    assetIssuer: row.asset_issuer,
    confirmedTransactionHash: row.confirmed_transaction_hash ?? null,
    createdAt: row.created_at,
    debtorPublicKey: row.debtor_public_key,
    dueAt: row.due_at,
    id: row.id,
    issuerPublicKey: row.issuer_public_key,
    memo: row.memo,
    preparedPaymentExpiresAt: row.prepared_payment_expires_at ?? null,
    preparedPaymentHash: row.prepared_payment_hash ?? null,
    preparedPaymentXdr: row.prepared_payment_xdr ?? null,
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

export async function listDebtorInvoices(debtorPublicKey: string) {
  const { data, error } = await serverDatabase()
    .from("invoices")
    .select("*")
    .eq("debtor_public_key", debtorPublicKey)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Invoices could not be loaded");
  return (data as InvoiceRow[]).map(mapInvoiceRow);
}

export async function findDebtorInvoice(id: string, debtorPublicKey: string) {
  const database = serverDatabase();
  const { data, error } = await database
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("debtor_public_key", debtorPublicKey)
    .maybeSingle();
  if (error || !data) throw new Error("Invoice was not found");
  const { data: attempts, error: attemptsError } = await database
    .from("rejected_payment_attempts")
    .select("transaction_hash,reason,observed_at")
    .eq("invoice_id", id)
    .order("observed_at", { ascending: false })
    .limit(20);
  if (attemptsError) throw new Error("Invoice attempts could not be loaded");
  return {
    ...mapInvoiceRow(data as InvoiceRow),
    rejectedAttempts: ((attempts ?? []) as RejectedAttemptRow[]).map((attempt) => ({
      observedAt: attempt.observed_at,
      reason: attempt.reason,
      transactionHash: attempt.transaction_hash,
    })),
  };
}

export async function confirmInvoice(id: string, transactionHash: string, observedAt: string) {
  const { data, error } = await serverDatabase().rpc("confirm_invoice", { confirmed_at: observedAt, invoice_id: id, transaction_hash: transactionHash });
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

export async function prepareInvoicePayment(input: {
  debtorPublicKey: string;
  expiresAt: string;
  invoiceId: string;
  transactionHash: string;
  xdr: string;
}) {
  const { data, error } = await serverDatabase().rpc("prepare_invoice_payment", {
    debtor_public_key: input.debtorPublicKey,
    invoice_id: input.invoiceId,
    payment_expires_at: input.expiresAt,
    payment_hash: input.transactionHash,
    payment_xdr: input.xdr,
    requested_at: new Date().toISOString(),
  });
  if (error || !data) throw new Error("Payment could not be prepared safely");
  return mapInvoiceRow(data as InvoiceRow);
}
