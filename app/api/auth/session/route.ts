import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../lib/auth/request-session.js";

export const runtime = "nodejs";

function isUnauthenticatedSessionError(error: unknown): boolean {
  return error instanceof Error && [
    "Wallet authentication is required",
    "Invalid wallet session",
    "Wallet session expired",
  ].includes(error.message);
}

export async function GET(request: Request) {
  try {
    const session = requireWalletSession(request);
    return NextResponse.json({ authenticated: true, publicKey: session.walletPublicKey });
  } catch (error: unknown) {
    if (isUnauthenticatedSessionError(error)) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ error: "Wallet session inspection failed" }, { status: 500 });
  }
}
