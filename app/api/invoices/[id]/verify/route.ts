import { NextResponse } from "next/server.js";
import { findInvoice, confirmInvoice } from "../../../../lib/invoices/service.js";
import { verifyPayment } from "../../../../lib/stellar/payment-verifier.js";
import { STELLAR_TESTNET } from "../../../../lib/stellar/network.js";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { transactionHash } = (await request.json()) as { transactionHash?: string };
    if (!transactionHash || !/^[a-f0-9]{64}$/i.test(transactionHash)) throw new Error("A valid transaction hash is required");
    const invoice = await findInvoice((await context.params).id);
    const [transactionResponse, operationsResponse] = await Promise.all([
      fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}`),
      fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}/operations`),
    ]);
    if (!transactionResponse.ok || !operationsResponse.ok) throw new Error("Transaction was not found on Stellar Testnet");
    const result = verifyPayment(invoice, await transactionResponse.json(), (await operationsResponse.json())._embedded.records);
    if (result.status !== "confirmed") return NextResponse.json(result, { status: 422 });
    return NextResponse.json(await confirmInvoice(invoice.id, result.transactionHash));
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 400 });
  }
}
