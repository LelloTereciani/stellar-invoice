import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../lib/auth/request-session.js";
import { findDebtorInvoice } from "../../../lib/invoices/service.js";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireWalletSession(request);
    return NextResponse.json(await findDebtorInvoice((await context.params).id, session.walletPublicKey));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invoice could not be loaded";
    return NextResponse.json({ error: message }, { status: message === "Invoice was not found" ? 404 : 401 });
  }
}
