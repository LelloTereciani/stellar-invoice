import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";

const TTL_MS = 10 * 60 * 1000;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
type DistributionRow = { attempt_key: string | null; customer_public_key: string; signed_xdr: string | null; status: "preparing" | "prepared" | "confirmed"; transaction_hash: string | null };
export type DemoDistribution = { attemptKey: string | null; customerPublicKey: string; signedXdr: string | null; status: "preparing" | "prepared" | "confirmed"; transactionHash: string | null };

function mapDistribution(row: DistributionRow): DemoDistribution {
  return { attemptKey: row.attempt_key, customerPublicKey: row.customer_public_key, signedXdr: row.signed_xdr, status: row.status, transactionHash: row.transaction_hash };
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
  if (error) throw new Error("Demo session limit was reached or this wallet already received BRLT");
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
