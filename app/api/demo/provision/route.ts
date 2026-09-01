import { NextResponse } from "next/server.js";
import { Keypair } from "@stellar/stellar-sdk";

import { loadDemoConfig, loadStellarConfig } from "../../../lib/config.js";
import { requireServerEnv } from "../../../lib/config.js";
import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { createPersistentDemoSession } from "../../../lib/demo/persistent-session.js";
import { demoRequestFingerprint } from "../../../lib/demo/request-fingerprint.js";
import { fundDemoWallet } from "../../../lib/demo/provisioning.js";
import { buildTrustlineXdr } from "../../../lib/stellar/transactions.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request, requireServerEnv("APP_ORIGIN", process.env));
    loadDemoConfig(process.env);
    const { publicKey } = (await request.json()) as { publicKey?: string };
    if (!publicKey) throw new Error("A Stellar public key is required");
    Keypair.fromPublicKey(publicKey);

    const stellar = loadStellarConfig(process.env);
    const sessionId = await createPersistentDemoSession(publicKey, demoRequestFingerprint(request, requireServerEnv("SESSION_SECRET", process.env)));
    await fundDemoWallet(publicKey);
    const trustlineXdr = await buildTrustlineXdr(publicKey, stellar.issuerPublicKey);

    return NextResponse.json({
      assetCode: stellar.assetCode,
      issuerPublicKey: stellar.issuerPublicKey,
      sessionId,
      trustlineXdr,
    });
  } catch (error: unknown) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
    const status = code === "DEMO_ALREADY_PROVISIONED" ? 409 : code === "DEMO_RATE_LIMIT" ? 429 : 400;
    return NextResponse.json({
      ...(code ? { code } : {}),
      error: error instanceof Error ? error.message : "Demo provisioning failed",
    }, { status });
  }
}
