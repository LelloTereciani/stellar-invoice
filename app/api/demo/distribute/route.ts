import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";

import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { loadDemoDistributionConfig, requireServerEnv } from "../../../lib/config.js";
import { verifyDemoClaimSignature } from "../../../lib/demo/claim-message.js";
import { completeDemoDistribution, getPersistentDemoSessionWallet, reserveDemoDistribution, storePreparedDemoDistribution } from "../../../lib/demo/persistent-session.js";
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
    if (distribution.status === "confirmed" && distribution.transactionHash) {
      return NextResponse.json({ amount: DEMO_ASSET_AMOUNT, transactionHash: distribution.transactionHash });
    }
    if (!distribution.signedXdr || !distribution.transactionHash) {
      if (distribution.attemptKey !== attemptKey) throw new Error("Demo distribution is already being prepared");
      const prepared = await prepareDemoBrltDistribution(customerPublicKey, demo.issuerPublicKey, demo.distributionSecret);
      distribution = await storePreparedDemoDistribution(customerPublicKey, attemptKey, prepared.signedXdr, prepared.transactionHash);
    }
    if (!distribution.signedXdr || !distribution.transactionHash) throw new Error("Demo distribution is not prepared");
    if (!(await demoDistributionExists(distribution.transactionHash))) {
      const submitted = await submitPreparedDemoDistribution(distribution.signedXdr);
      if (submitted.hash !== distribution.transactionHash) throw new Error("Horizon returned an unexpected demo transaction hash");
    }
    await completeDemoDistribution(customerPublicKey, distribution.transactionHash);
    return NextResponse.json({ amount: DEMO_ASSET_AMOUNT, transactionHash: distribution.transactionHash });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo distribution failed" }, { status: 400 });
  }
}
