import { NextResponse } from "next/server.js";

import { loadDemoDistributionConfig } from "../../../lib/config.js";
import { consumeDemoSession } from "../../../lib/demo/session.js";
import { DEMO_ASSET_AMOUNT, distributeDemoBrlt } from "../../../lib/demo/provisioning.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: string };
    if (!sessionId) throw new Error("A demo session is required");

    const demo = loadDemoDistributionConfig(process.env);
    const session = consumeDemoSession(sessionId);
    const result = await distributeDemoBrlt(session.customerPublicKey, demo.issuerPublicKey, demo.distributionSecret);

    return NextResponse.json({ amount: DEMO_ASSET_AMOUNT, transactionHash: result.hash });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Demo distribution failed" }, { status: 400 });
  }
}
