import { NextResponse } from "next/server.js";
import { assertTrustedOrigin } from "../../../../lib/auth/request-origin.js";
import { requireServerEnv } from "../../../../lib/config.js";
import { findInvoice, confirmInvoice } from "../../../../lib/invoices/service.js";
import { verifyPayment } from "../../../../lib/stellar/payment-verifier.js";
import { STELLAR_TESTNET } from "../../../../lib/stellar/network.js";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request, requireServerEnv("APP_ORIGIN", process.env));
    const { transactionHash } = (await request.json()) as { transactionHash?: string };
    if (!transactionHash || !/^[a-f0-9]{64}$/i.test(transactionHash)) throw new Error("A valid transaction hash is required");
    const invoice = await findInvoice((await context.params).id);
    if (invoice.status !== "pending") throw new Error("Invoice is not pending");
    if (new Date(invoice.dueAt) <= new Date()) throw new Error("Invoice has expired");
    const [transactionResponse, operationsResponse] = await Promise.all([
      fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}`),
      fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}/operations`),
    ]);
    if (!transactionResponse.ok || !operationsResponse.ok) throw new Error("Transaction was not found on Stellar Testnet");
    const transaction = await transactionResponse.json();
    if (transaction.hash !== transactionHash) throw new Error("Ledger returned an unexpected transaction");
    const result = verifyPayment(invoice, transaction, (await operationsResponse.json())._embedded.records);
    if (result.status !== "confirmed") return NextResponse.json(result, { status: 422 });
    return NextResponse.json(await confirmInvoice(invoice.id, result.transactionHash));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 400 });
  }
}
