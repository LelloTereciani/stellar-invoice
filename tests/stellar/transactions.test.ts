import { afterEach, describe, expect, it, vi } from "vitest";
import { Account, Asset, Keypair, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { buildInvoicePaymentXdr, buildTrustlineXdr, reviewInvoicePaymentXdr, reviewTrustlineXdr } from "../../app/lib/stellar/transactions.js";

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
    expect(reviewTrustlineXdr(transaction.toXDR(), customer, issuer)).toEqual({ asset: "BRLT", issuer, source: customer });
    expect(() => reviewTrustlineXdr(transaction.toXDR(), customer, Keypair.random().publicKey())).toThrow("does not match");
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
    expect(reviewInvoicePaymentXdr(transaction.toXDR(), invoice, debtor)).toEqual({
      amount: "10.1234567",
      asset: "BRLT",
      destination: issuer,
      memo: "inv-123",
      source: debtor,
    });

    await expect(buildInvoicePaymentXdr(invoice, Keypair.random().publicKey())).rejects.toThrow("connected wallet is not the invoice debtor");
  });

  it("rejects an XDR whose payment details differ from the invoice", async () => {
    const debtor = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    fundedAccount(debtor);
    const invoice = { amount: "10.0000000", assetIssuer: issuer, debtorPublicKey: debtor, issuerPublicKey: issuer, memo: "inv-123" };
    const xdr = await buildInvoicePaymentXdr(invoice, debtor);

    expect(() => reviewInvoicePaymentXdr(xdr, { ...invoice, amount: "11.0000000" }, debtor)).toThrow("does not match");
    expect(() => reviewInvoicePaymentXdr(xdr, invoice, Keypair.random().publicKey())).toThrow("does not match");
  });

  it("rejects excessive fees, long validity, invalid sequence, and a restricted trustline limit", () => {
    const debtor = Keypair.random().publicKey();
    const issuer = Keypair.random().publicKey();
    const invoice = { amount: "10.0000000", assetIssuer: issuer, debtorPublicKey: debtor, issuerPublicKey: issuer, memo: "inv-safe" };
    const excessiveFee = new TransactionBuilder(new Account(debtor, "10"), { fee: "10000", networkPassphrase: Networks.TESTNET })
      .addMemo(Memo.text(invoice.memo))
      .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: issuer }))
      .setTimeout(180).build().toXDR();
    const longValidity = new TransactionBuilder(new Account(debtor, "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addMemo(Memo.text(invoice.memo))
      .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: issuer }))
      .setTimeout(600).build().toXDR();
    const invalidSequence = new TransactionBuilder(new Account(debtor, "-1"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addMemo(Memo.text(invoice.memo))
      .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: issuer }))
      .setTimeout(180).build().toXDR();
    const restrictedTrustline = new TransactionBuilder(new Account(debtor, "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.changeTrust({ asset: new Asset("BRLT", issuer), limit: "1.0000000" }))
      .setTimeout(180).build().toXDR();
    expect(() => reviewInvoicePaymentXdr(excessiveFee, invoice, debtor)).toThrow("unsafe fee");
    expect(() => reviewInvoicePaymentXdr(longValidity, invoice, debtor)).toThrow("unsafe fee");
    expect(() => reviewInvoicePaymentXdr(invalidSequence, invoice, debtor)).toThrow("unsafe fee");
    expect(() => reviewTrustlineXdr(restrictedTrustline, debtor, issuer)).toThrow("does not match");
  });
});
