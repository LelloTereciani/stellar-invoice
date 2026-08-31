import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../../lib/auth/request-session.js";
import { assertPayableByWallet } from "../../../../lib/invoices/access.js";
import { findDebtorInvoice } from "../../../../lib/invoices/service.js";
import { STELLAR_TESTNET } from "../../../../lib/stellar/network.js";
import { buildInvoicePaymentXdr } from "../../../../lib/stellar/transactions.js";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireWalletSession(request);
    const invoice = await findDebtorInvoice((await context.params).id, session.walletPublicKey);
    assertPayableByWallet(invoice, session.walletPublicKey);
    return NextResponse.json({
      network: STELLAR_TESTNET.network,
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
      xdr: await buildInvoicePaymentXdr(invoice, session.walletPublicKey),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment could not be prepared" }, { status: 400 });
  }
}
