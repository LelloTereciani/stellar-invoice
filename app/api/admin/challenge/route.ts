import { NextResponse } from "next/server.js";

import { createIssuerChallengeStore } from "../../../lib/auth/issuer-challenge-store.js";
import { issuePersistentIssuerChallenge } from "../../../lib/auth/persistent-challenge.js";
import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { loadStellarConfig, requireServerEnv } from "../../../lib/config.js";
import { createInvoiceDraft } from "../../../lib/invoices/validation.js";
import { loadAccountSummary } from "../../../lib/stellar/account-summary.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const origin = requireServerEnv("APP_ORIGIN", process.env);
    assertTrustedOrigin(request, origin);
    const input = (await request.json()) as { amount?: string; debtorPublicKey?: string; dueAt?: string; receiverPublicKey?: string };
    if (!input.amount || !input.debtorPublicKey || !input.dueAt || !input.receiverPublicKey) throw new Error("Incomplete invoice request");
    const stellar = loadStellarConfig(process.env);
    createInvoiceDraft(
      { amount: input.amount, debtorPublicKey: input.debtorPublicKey, dueAt: input.dueAt },
      stellar.issuerPublicKey,
      input.receiverPublicKey,
    );
    const receiver = await loadAccountSummary(input.receiverPublicKey, stellar);
    if (!receiver.brlt.trustlinePresent || receiver.brlt.authorized !== true) {
      throw new Error("Receiver must have an authorized BRLT trustline for the configured issuer");
    }
    return NextResponse.json(await issuePersistentIssuerChallenge(
      { amount: input.amount, debtorPublicKey: input.debtorPublicKey, dueAt: input.dueAt, receiverPublicKey: input.receiverPublicKey },
      stellar.issuerPublicKey,
      origin,
      createIssuerChallengeStore(),
    ));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Challenge creation failed" }, { status: 400 });
  }
}
