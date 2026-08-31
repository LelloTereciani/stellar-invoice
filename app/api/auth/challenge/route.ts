import { Keypair } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server.js";

import { issuePersistentWalletChallenge } from "../../../lib/auth/persistent-wallet-challenge.js";
import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { createWalletChallengeStore } from "../../../lib/auth/wallet-challenge-store.js";
import { requireServerEnv } from "../../../lib/config.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = requireServerEnv("APP_ORIGIN", process.env);
    assertTrustedOrigin(request, origin);
    const { walletPublicKey } = (await request.json()) as { walletPublicKey?: string };
    if (!walletPublicKey) throw new Error("Wallet public key is required");
    Keypair.fromPublicKey(walletPublicKey);
    return NextResponse.json(await issuePersistentWalletChallenge(
      walletPublicKey,
      origin,
      createWalletChallengeStore(),
    ));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Challenge creation failed" }, { status: 400 });
  }
}
