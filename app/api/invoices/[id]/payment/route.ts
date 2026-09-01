import { NextResponse } from "next/server.js";

import { requireWalletSession } from "../../../../lib/auth/request-session.js";
import { assertPayableByWallet } from "../../../../lib/invoices/access.js";
import { findDebtorInvoice, prepareInvoicePayment } from "../../../../lib/invoices/service.js";
import { STELLAR_TESTNET } from "../../../../lib/stellar/network.js";
import { buildInvoicePaymentXdr, preparedTransactionMetadata, reviewInvoicePaymentXdr } from "../../../../lib/stellar/transactions.js";

export const runtime = "nodejs";

async function paymentExists(transactionHash: string): Promise<boolean> {
  const response = await fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}`);
  if (response.ok) return true;
  if (response.status === 404) return false;
  throw new Error("Stellar Testnet is unavailable; retry verification without signing another payment");
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = requireWalletSession(request);
    const invoice = await findDebtorInvoice((await context.params).id, session.walletPublicKey);
    assertPayableByWallet(invoice, session.walletPublicKey);
    if (invoice.preparedPaymentHash && await paymentExists(invoice.preparedPaymentHash)) {
      return NextResponse.json({ network: STELLAR_TESTNET.network, transactionHash: invoice.preparedPaymentHash });
    }
    if (invoice.preparedPaymentXdr && invoice.preparedPaymentExpiresAt && new Date(invoice.preparedPaymentExpiresAt) > new Date()) {
      return NextResponse.json({ network: STELLAR_TESTNET.network, preparedTransactionHash: invoice.preparedPaymentHash, xdr: invoice.preparedPaymentXdr });
    }
    const xdr = await buildInvoicePaymentXdr(invoice, session.walletPublicKey);
    reviewInvoicePaymentXdr(xdr, invoice, session.walletPublicKey);
    const metadata = preparedTransactionMetadata(xdr);
    const prepared = await prepareInvoicePayment({
      debtorPublicKey: session.walletPublicKey,
      expiresAt: metadata.expiresAt,
      invoiceId: invoice.id,
      transactionHash: metadata.transactionHash,
      xdr,
    });
    if (!prepared.preparedPaymentHash || !prepared.preparedPaymentXdr) throw new Error("Prepared payment is incomplete");
    return NextResponse.json({
      network: STELLAR_TESTNET.network,
      networkPassphrase: STELLAR_TESTNET.networkPassphrase,
      preparedTransactionHash: prepared.preparedPaymentHash,
      xdr: prepared.preparedPaymentXdr,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment could not be prepared" }, { status: 400 });
  }
}
