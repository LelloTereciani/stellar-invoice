import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../lib/auth/request-session.js";
import { listWalletInvoices, type InvoiceListRole } from "../../lib/invoices/service.js";

export const runtime = "nodejs";

function isAuthenticationFailure(error: unknown): boolean {
  return error instanceof Error && [
    "Wallet authentication is required",
    "Invalid wallet session",
    "Wallet session expired",
  ].includes(error.message);
}

export async function GET(request: Request) {
  try {
    const session = requireWalletSession(request);
    const role = new URL(request.url).searchParams.get("role") ?? "payable";
    if (role !== "payable" && role !== "receivable") {
      return NextResponse.json({ error: "Invoice role is invalid" }, { status: 400 });
    }
    return NextResponse.json({
      invoices: await listWalletInvoices(session.walletPublicKey, role as InvoiceListRole),
    });
  } catch (error: unknown) {
    if (isAuthenticationFailure(error)) {
      return NextResponse.json({ error: "Wallet authentication is required" }, { status: 401 });
    }
    return NextResponse.json({ error: "Invoices could not be loaded" }, { status: 500 });
  }
}
