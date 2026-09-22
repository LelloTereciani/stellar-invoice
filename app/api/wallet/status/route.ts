import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../lib/auth/request-session.js";
import { loadStellarConfig } from "../../../lib/config.js";
import { loadAccountSummary } from "../../../lib/stellar/account-summary.js";

export const runtime = "nodejs";

function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof Error && [
    "Wallet authentication is required",
    "Invalid wallet session",
    "Wallet session expired",
  ].includes(error.message);
}

export async function GET(request: Request) {
  let walletPublicKey: string;
  try {
    walletPublicKey = requireWalletSession(request).walletPublicKey;
  } catch (error: unknown) {
    if (isAuthenticationFailure(error)) {
      return NextResponse.json({
        error: {
          code: "WALLET_AUTHENTICATION_REQUIRED",
          message: "Wallet authentication is required",
        },
      }, { status: 401 });
    }

    return NextResponse.json({
      error: {
        code: "WALLET_STATUS_INTERNAL_ERROR",
        message: "Wallet status could not be inspected",
      },
    }, { status: 500 });
  }

  try {
    const stellar = loadStellarConfig(process.env);
    const summary = await loadAccountSummary(walletPublicKey, stellar);
    return NextResponse.json({
      assetCode: stellar.assetCode,
      assetIssuer: stellar.issuerPublicKey,
      network: stellar.network,
      ...summary,
    });
  } catch {
    return NextResponse.json({
      degraded: true,
      error: {
        code: "WALLET_STATUS_UNAVAILABLE",
        message: "Wallet status is temporarily unavailable",
      },
    }, { status: 503 });
  }
}
