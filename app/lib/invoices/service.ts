import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";
import { createInvoiceDraft, type InvoiceInput } from "./validation.js";

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
