import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";

import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { loadDemoDistributionConfig, requireServerEnv } from "../../../lib/config.js";
import { verifyDemoClaimSignature } from "../../../lib/demo/claim-message.js";
import { completeDemoDistribution, ensureDemoInvoice, getPersistentDemoSessionWallet, reserveDemoDistribution, storePreparedDemoDistribution } from "../../../lib/demo/persistent-session.js";
import { DEMO_ASSET_AMOUNT, demoDistributionExists, prepareDemoBrltDistribution, submitPreparedDemoDistribution } from "../../../lib/demo/provisioning.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request, requireServerEnv("APP_ORIGIN", process.env));
    const { claimMessage, sessionId, signedClaim } = (await request.json()) as { claimMessage?: string; sessionId?: string; signedClaim?: string };
    if (!sessionId || !claimMessage || !signedClaim) throw new Error("A signed demo claim is required");
    const demo = loadDemoDistributionConfig(process.env);
    const customerPublicKey = await getPersistentDemoSessionWallet(sessionId);
    if (!verifyDemoClaimSignature(claimMessage, signedClaim, customerPublicKey, sessionId)) throw new Error("Demo wallet signature is invalid");

    const attemptKey = randomUUID();
    let distribution = await reserveDemoDistribution(sessionId, attemptKey);
    if (distribution.status !== "confirmed" && (!distribution.signedXdr || !distribution.transactionHash)) {
      if (distribution.attemptKey !== attemptKey) throw new Error("Demo distribution is already being prepared");
      const prepared = await prepareDemoBrltDistribution(customerPublicKey, demo.issuerPublicKey, demo.distributionSecret);
      distribution = await storePreparedDemoDistribution(customerPublicKey, attemptKey, prepared.signedXdr, prepared.transactionHash);
    }
    const transactionHash = distribution.transactionHash;
    if (!transactionHash) throw new Error("Demo distribution is not prepared");
    if (distribution.status !== "confirmed") {
      const signedXdr = distribution.signedXdr;
      if (!signedXdr) throw new Error("Demo distribution XDR is unavailable");
      if (!(await demoDistributionExists(transactionHash))) {
        const submitted = await submitPreparedDemoDistribution(signedXdr);
        if (submitted.hash !== transactionHash) throw new Error("Horizon returned an unexpected demo transaction hash");
      }
    }
    await completeDemoDistribution(customerPublicKey, transactionHash);
    const invoice = await ensureDemoInvoice(customerPublicKey, demo.issuerPublicKey);
    return NextResponse.json({ amount: DEMO_ASSET_AMOUNT, invoiceId: invoice.id, transactionHash });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo distribution failed" }, { status: 400 });
  }
}
