import { NextResponse } from "next/server.js";
import { Keypair } from "@stellar/stellar-sdk";

import { loadDemoConfig, loadStellarConfig } from "../../../lib/config.js";
import { createDemoSession } from "../../../lib/demo/session.js";
import { fundDemoWallet } from "../../../lib/demo/provisioning.js";
import { buildTrustlineXdr } from "../../../lib/stellar/transactions.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    loadDemoConfig(process.env);
    const { publicKey } = (await request.json()) as { publicKey?: string };
    if (!publicKey) throw new Error("A Stellar public key is required");
    Keypair.fromPublicKey(publicKey);

    const stellar = loadStellarConfig(process.env);
    await fundDemoWallet(publicKey);
    const session = createDemoSession(publicKey);
    const trustlineXdr = await buildTrustlineXdr(publicKey, stellar.issuerPublicKey);

    return NextResponse.json({
      assetCode: stellar.assetCode,
      issuerPublicKey: stellar.issuerPublicKey,
      sessionId: session.id,
      trustlineXdr,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo provisioning failed" }, { status: 400 });
  }
}
