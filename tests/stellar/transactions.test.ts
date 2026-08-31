import { afterEach, describe, expect, it, vi } from "vitest";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { buildInvoicePaymentXdr, buildTrustlineXdr } from "../../app/lib/stellar/transactions.js";

afterEach(() => vi.unstubAllGlobals());

function fundedAccount(publicKey: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ account_id: publicKey, sequence: "123" }), { status: 200 })));
}

describe("Stellar Testnet transaction builders", () => {
  it("builds a BRLT trustline for the customer on Testnet", async () => {
    const customer = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    fundedAccount(customer);

    const transaction = TransactionBuilder.fromXDR(await buildTrustlineXdr(customer, issuer), Networks.TESTNET) as Transaction;
    expect(transaction.source).toBe(customer);
    expect(transaction.operations[0]).toMatchObject({ type: "changeTrust" });
    expect((transaction.operations[0] as { line?: { code?: string; issuer?: string } }).line).toMatchObject({ code: "BRLT", issuer });
  });

  it("builds the exact debtor-authorized invoice payment and rejects another wallet", async () => {
    const debtor = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    fundedAccount(debtor);
    const invoice = { amount: "10.1234567", assetIssuer: issuer, debtorPublicKey: debtor, issuerPublicKey: issuer, memo: "inv-123" };

    const transaction = TransactionBuilder.fromXDR(await buildInvoicePaymentXdr(invoice, debtor), Networks.TESTNET) as Transaction;
    expect(transaction.source).toBe(debtor);
    expect(transaction.memo.value?.toString()).toBe("inv-123");
    expect(transaction.operations[0]).toMatchObject({ amount: "10.1234567", destination: issuer, type: "payment" });
    expect((transaction.operations[0] as { asset?: { code?: string; issuer?: string } }).asset).toMatchObject({ code: "BRLT", issuer });

    await expect(buildInvoicePaymentXdr(invoice, Keypair.random().publicKey())).rejects.toThrow("connected wallet is not the invoice debtor");
  });
});
