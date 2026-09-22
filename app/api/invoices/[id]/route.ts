import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../lib/auth/request-session.js";
import { findWalletInvoice } from "../../../lib/invoices/service.js";

export const runtime = "nodejs";

function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof Error && [
    "Wallet authentication is required",
    "Invalid wallet session",
    "Wallet session expired",
  ].includes(error.message);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireWalletSession(request);
    return NextResponse.json(await findWalletInvoice((await context.params).id, session.walletPublicKey));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invoice could not be loaded";
    if (message === "Invoice was not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (isAuthenticationFailure(error)) {
      return NextResponse.json({ error: "Wallet authentication is required" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invoice could not be loaded" }, { status: 500 });
  }
}
