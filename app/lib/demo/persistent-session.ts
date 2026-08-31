import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";

const TTL_MS = 10 * 60 * 1000;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function database() {
  return createClient(requireServerEnv("SUPABASE_URL", process.env), requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env), { auth: { persistSession: false } });
}

export async function createPersistentDemoSession(customerPublicKey: string) {
  const token = randomUUID();
  const { error } = await database().from("demo_sessions").insert({ customer_public_key: customerPublicKey, expires_at: new Date(Date.now() + TTL_MS).toISOString(), token_hash: tokenHash(token) });
  if (error) throw new Error("Demo wallet already has an active session");
  return token;
}

export async function consumePersistentDemoSession(token: string) {
  const db = database();
  const now = new Date().toISOString();
  const { data, error } = await db.from("demo_sessions").update({ consumed_at: now }).eq("token_hash", tokenHash(token)).is("consumed_at", null).gt("expires_at", now).select("customer_public_key").single();
  if (error || !data) throw new Error("Demo session is invalid or expired");
  return data.customer_public_key as string;
}

export async function recordDemoDistribution(customerPublicKey: string, transactionHash: string) {
  const { error } = await database().from("demo_distributions").insert({ customer_public_key: customerPublicKey, transaction_hash: transactionHash });
  if (error) throw new Error("Demo wallet has already received its BRLT allowance");
}
