import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";
import type { IssuerChallengeRecord, IssuerChallengeStore } from "./persistent-challenge.js";

function database() {
  return createClient(
    requireServerEnv("SUPABASE_URL", process.env),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env),
    { auth: { persistSession: false } },
  );
}

export function createIssuerChallengeStore(): IssuerChallengeStore {
  return {
    async insert(record: IssuerChallengeRecord) {
      const { error } = await database().rpc("create_issuer_challenge", {
        challenge_expires_at: record.expiresAt,
        challenge_hash: record.messageHash,
        challenge_id: record.id,
      });
      if (error) throw new Error("Could not persist issuer challenge");
    },
    async consume(id: string, messageHash: string, now: string) {
      const { data, error } = await database()
        .from("issuer_challenges")
        .update({ consumed_at: now })
        .eq("id", id)
        .eq("nonce_hash", messageHash)
        .is("consumed_at", null)
        .gt("expires_at", now)
        .select("id")
        .maybeSingle();
      if (error) throw new Error("Could not consume issuer challenge");
      return Boolean(data);
    },
  };
}
