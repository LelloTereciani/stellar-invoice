import { NextResponse } from "next/server.js";

import { assertTrustedOrigin } from "../../../lib/auth/request-origin.js";
import { requireWalletSession } from "../../../lib/auth/request-session.js";
import { loadStellarConfig, requireServerEnv } from "../../../lib/config.js";
import { ensureDemoInvoice } from "../../../lib/demo/persistent-session.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = requireServerEnv("APP_ORIGIN", process.env);
  try {
    assertTrustedOrigin(request, origin);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Untrusted demo resume request" },
      { status: 400 },
    );
  }

  let session;
  try {
    session = requireWalletSession(request);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Wallet authentication is required" },
      { status: 401 },
    );
  }

  try {
    const stellar = loadStellarConfig(process.env);
    const invoice = await ensureDemoInvoice(session.walletPublicKey, stellar.issuerPublicKey);
    return NextResponse.json({ invoiceId: invoice.id });
  } catch (error: unknown) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
    if (code !== "DEMO_NOT_PROVISIONED") {
      return NextResponse.json(
        { error: "A demonstração não pôde ser retomada." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      {
        code,
        error: error instanceof Error ? error.message : "Demo could not be resumed",
      },
      { status: 409 },
    );
  }
}
