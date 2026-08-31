import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../lib/auth/request-session.js";
import { loadStellarConfig } from "../../../lib/config.js";
import { buildTrustlineXdr } from "../../../lib/stellar/transactions.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = requireWalletSession(request);
    const stellar = loadStellarConfig(process.env);
    return NextResponse.json({
      assetCode: stellar.assetCode,
      assetIssuer: stellar.issuerPublicKey,
      network: stellar.network,
      xdr: await buildTrustlineXdr(session.walletPublicKey, stellar.issuerPublicKey),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trustline could not be prepared" }, { status: 400 });
  }
}
