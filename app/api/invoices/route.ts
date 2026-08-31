import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../lib/auth/request-session.js";
import { listDebtorInvoices } from "../../lib/invoices/service.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = requireWalletSession(request);
    return NextResponse.json({ invoices: await listDebtorInvoices(session.walletPublicKey) });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invoices could not be loaded" }, { status: 401 });
  }
}
