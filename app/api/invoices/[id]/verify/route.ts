import { NextResponse } from "next/server.js";
import { assertTrustedOrigin } from "../../../../lib/auth/request-origin.js";
import { requireServerEnv } from "../../../../lib/config.js";
import { confirmInvoice, expireInvoice, findInvoice, recordRejectedPayment } from "../../../../lib/invoices/service.js";
import { processInvoiceVerification } from "../../../../lib/invoices/verification-service.js";
import { STELLAR_TESTNET } from "../../../../lib/stellar/network.js";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request, requireServerEnv("APP_ORIGIN", process.env));
    const { transactionHash } = (await request.json()) as { transactionHash?: string };
    if (!transactionHash || !/^[a-f0-9]{64}$/i.test(transactionHash)) throw new Error("A valid transaction hash is required");
    const invoice = await findInvoice((await context.params).id);
    const result = await processInvoiceVerification(invoice, transactionHash, async () => {
      const [transactionResponse, operationsResponse] = await Promise.all([
        fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}`),
        fetch(`${STELLAR_TESTNET.horizonUrl}/transactions/${transactionHash}/operations`),
      ]);
      if (!transactionResponse.ok || !operationsResponse.ok) throw new Error("Transaction was not found on Stellar Testnet");
      return { transaction: await transactionResponse.json(), operations: (await operationsResponse.json())._embedded.records };
    }, {
      confirm: confirmInvoice,
      expire: expireInvoice,
      recordRejected: recordRejectedPayment,
    });
    return NextResponse.json(result, { status: (result as { status?: string }).status === "rejected" ? 422 : 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Verification failed" }, { status: 400 });
  }
}
