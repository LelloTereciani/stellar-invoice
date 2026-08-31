import { NextResponse } from "next/server.js";

import { loadStellarConfig } from "../../../lib/config.js";
import { verifyIssuerChallenge } from "../../../lib/auth/issuer-challenge.js";
import { persistInvoice } from "../../../lib/invoices/service.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { amount?: string; challengeId?: string; debtorPublicKey?: string; dueAt?: string; signedChallenge?: string };
    if (!body.challengeId || !body.signedChallenge || !body.debtorPublicKey || !body.amount || !body.dueAt) throw new Error("Incomplete invoice request");
    const stellar = loadStellarConfig(process.env);
    verifyIssuerChallenge(body.challengeId, body.signedChallenge, stellar.issuerPublicKey);
    return NextResponse.json(await persistInvoice({ amount: body.amount, debtorPublicKey: body.debtorPublicKey, dueAt: body.dueAt }, stellar.issuerPublicKey), { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoice creation failed" }, { status: 400 });
  }
}
