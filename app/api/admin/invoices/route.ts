import { NextResponse } from "next/server.js";

import { createIssuerChallengeStore } from "../../../lib/auth/issuer-challenge-store.js";
import { verifyAndConsumeIssuerChallenge } from "../../../lib/auth/persistent-challenge.js";
import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { loadStellarConfig, requireServerEnv } from "../../../lib/config.js";
import { persistInvoice } from "../../../lib/invoices/service.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = requireServerEnv("APP_ORIGIN", process.env);
    assertTrustedOrigin(request, origin);
    const body = (await request.json()) as { amount?: string; challenge?: string; challengeExpiresAt?: string; challengeId?: string; debtorPublicKey?: string; dueAt?: string; signedChallenge?: string };
    if (!body.challengeId || !body.challenge || !body.challengeExpiresAt || !body.signedChallenge || !body.debtorPublicKey || !body.amount || !body.dueAt) throw new Error("Incomplete invoice request");
    const stellar = loadStellarConfig(process.env);
    await verifyAndConsumeIssuerChallenge({
      expiresAt: body.challengeExpiresAt,
      id: body.challengeId,
      invoice: { amount: body.amount, debtorPublicKey: body.debtorPublicKey, dueAt: body.dueAt },
      message: body.challenge,
      signature: body.signedChallenge,
    }, stellar.issuerPublicKey, origin, createIssuerChallengeStore());
    return NextResponse.json(await persistInvoice({ amount: body.amount, debtorPublicKey: body.debtorPublicKey, dueAt: body.dueAt }, stellar.issuerPublicKey), { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice creation failed" }, { status: 400 });
  }
}
