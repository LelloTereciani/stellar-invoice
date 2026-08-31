import { NextResponse } from "next/server.js";

import { loadDemoDistributionConfig } from "../../../lib/config.js";
import { consumePersistentDemoSession, recordDemoDistribution } from "../../../lib/demo/persistent-session.js";
import { DEMO_ASSET_AMOUNT, distributeDemoBrlt } from "../../../lib/demo/provisioning.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: string };
    if (!sessionId) throw new Error("A demo session is required");

    const demo = loadDemoDistributionConfig(process.env);
    const customerPublicKey = await consumePersistentDemoSession(sessionId);
    const result = await distributeDemoBrlt(customerPublicKey, demo.issuerPublicKey, demo.distributionSecret);
    await recordDemoDistribution(customerPublicKey, result.hash);

    return NextResponse.json({ amount: DEMO_ASSET_AMOUNT, transactionHash: result.hash });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo distribution failed" }, { status: 400 });
  }
}
