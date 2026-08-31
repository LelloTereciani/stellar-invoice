import { createClient } from "@supabase/supabase-js";

import { requireServerEnv } from "../config.js";
import type { WalletChallengeRecord, WalletChallengeStore } from "./persistent-wallet-challenge.js";

function database() {
  return createClient(
    requireServerEnv("SUPABASE_URL", process.env),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY", process.env),
    { auth: { persistSession: false } },
  );
}

export function createWalletChallengeStore(): WalletChallengeStore {
  return {
    async insert(record: WalletChallengeRecord) {
      const { error } = await database().rpc("create_wallet_challenge", {
        challenge_expires_at: record.expiresAt,
        challenge_hash: record.messageHash,
        challenge_id: record.id,
        challenge_wallet_public_key: record.walletPublicKey,
      });
      if (error) throw new Error("Could not persist wallet challenge");
    },
    async consume(id: string, messageHash: string, walletPublicKey: string, now: string) {
      const { data, error } = await database()
        .from("wallet_challenges")
        .update({ consumed_at: now })
        .eq("id", id)
        .eq("message_hash", messageHash)
        .eq("wallet_public_key", walletPublicKey)
        .is("consumed_at", null)
        .gt("expires_at", now)
        .select("id")
        .maybeSingle();
      if (error) throw new Error("Could not consume wallet challenge");
      return Boolean(data);
    },
  };
}
