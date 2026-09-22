import { NextResponse } from "next/server.js";

import { assertTrustedOrigin } from "../../lib/auth/request-origin.js";
import { requireWalletSession } from "../../lib/auth/request-session.js";
import { loadStellarConfig, requireServerEnv } from "../../lib/config.js";
import { listWalletInvoices, persistInvoice, type InvoiceListRole } from "../../lib/invoices/service.js";

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

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request, requireServerEnv("APP_ORIGIN", process.env));
    const session = requireWalletSession(request);
    const body = (await request.json()) as {
      amount?: string;
      debtorPublicKey?: string;
      dueAt?: string;
      receiverPublicKey?: string;
    };
    if (!body.debtorPublicKey || !body.receiverPublicKey || !body.amount || !body.dueAt) {
      return NextResponse.json({ error: "Dados incompletos para criação da fatura" }, { status: 400 });
    }
    if (session.walletPublicKey !== body.debtorPublicKey && session.walletPublicKey !== body.receiverPublicKey) {
      return NextResponse.json(
        { error: "A carteira autenticada deve ser o devedor ou o recebedor da fatura" },
        { status: 403 },
      );
    }
    const stellar = loadStellarConfig(process.env);
    const invoice = await persistInvoice(
      { amount: body.amount, debtorPublicKey: body.debtorPublicKey, dueAt: body.dueAt },
      stellar.issuerPublicKey,
      body.receiverPublicKey,
    );
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error: unknown) {
    if (isAuthenticationFailure(error)) {
      return NextResponse.json({ error: "Wallet authentication is required" }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Criação da fatura falhou" },
      { status: 400 },
    );
  }
}
