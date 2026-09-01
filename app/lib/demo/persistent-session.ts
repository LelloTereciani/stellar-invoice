import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";

const TTL_MS = 10 * 60 * 1000;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
type DistributionRow = { attempt_key: string | null; customer_public_key: string; invoice_id: string | null; signed_xdr: string | null; status: "preparing" | "prepared" | "confirmed"; transaction_hash: string | null };
export type DemoDistribution = { attemptKey: string | null; customerPublicKey: string; invoiceId: string | null; signedXdr: string | null; status: "preparing" | "prepared" | "confirmed"; transactionHash: string | null };

export class DemoNotProvisionedError extends Error {
  readonly code = "DEMO_NOT_PROVISIONED";
}

export class DemoSessionError extends Error {
  constructor(
    readonly code: "DEMO_ALREADY_PROVISIONED" | "DEMO_RATE_LIMIT" | "DEMO_SESSION_FAILED",
    message: string,
  ) {
    super(message);
  }
}

export function mapDemoSessionError(error: { message?: string }): DemoSessionError {
  if (error.message?.includes("Demo wallet has already received its BRLT allowance")) {
    return new DemoSessionError(
      "DEMO_ALREADY_PROVISIONED",
      "Esta carteira demo já recebeu BRLT. Use Continuar demonstração.",
    );
  }
  if (error.message?.includes("Demo request limit exceeded") || error.message?.includes("Daily demo session limit exceeded")) {
    return new DemoSessionError(
      "DEMO_RATE_LIMIT",
      "O limite diário de demonstrações foi atingido. Tente novamente após a renovação do limite.",
    );
  }
  return new DemoSessionError("DEMO_SESSION_FAILED", "A sessão demo não pôde ser criada com segurança.");
}

function mapDistribution(row: DistributionRow): DemoDistribution {
  return { attemptKey: row.attempt_key, customerPublicKey: row.customer_public_key, invoiceId: row.invoice_id, signedXdr: row.signed_xdr, status: row.status, transactionHash: row.transaction_hash };
}

function database() {
  return createClient(requireServerEnv("SUPABASE_URL", process.env), requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env), { auth: { persistSession: false } });
}

export async function createPersistentDemoSession(customerPublicKey: string, requestFingerprint: string) {
  const token = randomUUID();
  const { error } = await database().rpc("create_demo_session", {
    session_customer_public_key: customerPublicKey,
    session_expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    session_id: randomUUID(),
    session_request_fingerprint: requestFingerprint,
    session_token_hash: tokenHash(token),
  });
  if (error) throw mapDemoSessionError(error);
  return token;
}

export async function getPersistentDemoSessionWallet(token: string): Promise<string> {
  const { data, error } = await database().from("demo_sessions").select("customer_public_key").eq("token_hash", tokenHash(token)).maybeSingle();
  if (error || !data) throw new Error("Demo session is invalid or expired");
  return data.customer_public_key as string;
}

export async function reserveDemoDistribution(token: string, attemptKey: string): Promise<DemoDistribution> {
  const { data, error } = await database().rpc("reserve_demo_distribution", { distribution_attempt_key: attemptKey, requested_at: new Date().toISOString(), session_token_hash: tokenHash(token) });
  if (error || !data) throw new Error("Demo session is invalid, expired, or already in use");
  return mapDistribution(data as DistributionRow);
}

export async function storePreparedDemoDistribution(customerPublicKey: string, attemptKey: string, signedXdr: string, transactionHash: string) {
  const { data, error } = await database().rpc("store_demo_distribution_xdr", {
    distribution_attempt_key: attemptKey,
    distribution_customer_public_key: customerPublicKey,
    distribution_signed_xdr: signedXdr,
    distribution_transaction_hash: transactionHash,
  });
  if (error || !data) throw new Error("Demo distribution could not be prepared safely");
  return mapDistribution(data as DistributionRow);
}

export async function completeDemoDistribution(customerPublicKey: string, transactionHash: string) {
  const { data, error } = await database().rpc("complete_demo_distribution", { distribution_customer_public_key: customerPublicKey, distribution_transaction_hash: transactionHash });
  if (error || !data) throw new Error("Demo distribution could not be completed");
  return mapDistribution(data as DistributionRow);
}

export async function ensureDemoInvoice(customerPublicKey: string, issuerPublicKey: string) {
  const { data, error } = await database().rpc("ensure_demo_invoice", {
    demo_amount: "5.0000000",
    demo_customer_public_key: customerPublicKey,
    demo_due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    demo_issuer_public_key: issuerPublicKey,
    demo_memo: randomUUID().replaceAll("-", "").slice(0, 28),
  });
  if (error?.message.includes("Demo distribution is not confirmed")) {
    throw new DemoNotProvisionedError("Esta carteira demo ainda não recebeu BRLT fictício.");
  }
  if (error || !data) throw new Error("Demo invoice could not be created");
  return data as { id: string; memo: string; status: "pending" };
}

export async function acquireDemoDistributionLock(ownerKey: string) {
  const { error } = await database().rpc("acquire_demo_distribution_lock", { lock_owner: ownerKey, requested_at: new Date().toISOString() });
  if (error) throw new Error("Another demo distribution is in progress; retry shortly");
}

export async function releaseDemoDistributionLock(ownerKey: string) {
  const { error } = await database().rpc("release_demo_distribution_lock", { lock_owner: ownerKey });
  if (error) throw new Error("Demo distribution lock could not be released");
}

export async function resetExpiredDemoDistribution(customerPublicKey: string, transactionHash: string, attemptKey: string) {
  const { data, error } = await database().rpc("reset_expired_demo_distribution", {
    distribution_customer_public_key: customerPublicKey,
    expected_transaction_hash: transactionHash,
    replacement_attempt_key: attemptKey,
  });
  if (error || !data) throw new Error("Expired demo distribution could not be recovered");
  return mapDistribution(data as DistributionRow);
}
