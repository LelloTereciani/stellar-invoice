import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { verifyPayment } from "../../app/lib/stellar/payment-verifier.js";

const debtor = Keypair.random().publicKey();
const issuer = Keypair.random().publicKey();
const receiver = Keypair.random().publicKey();
const invoice = { amount: "10.0000000", assetIssuer: issuer, debtorPublicKey: debtor, issuerPublicKey: issuer, memo: "inv-123", receiverPublicKey: receiver };
const transaction = { created_at: "2029-01-01T00:00:00.000Z", hash: "a".repeat(64), memo: "inv-123", memo_type: "text" as const, source_account: debtor, successful: true };
const operation = { amount: "10.0000000", asset_code: "BRLT", asset_issuer: issuer, source_account: debtor, to: receiver, transaction_successful: true, type: "payment" };

describe("ledger payment verification", () => {
  it("confirms only an exact invoice payment", () => expect(verifyPayment(invoice, transaction, [operation])).toMatchObject({ status: "confirmed" }));
  it("rejects a payment sent to an account other than the invoice receiver", () => {
    expect(verifyPayment(invoice, transaction, [{ ...operation, to: issuer }])).toEqual({ reason: "Unexpected destination", status: "rejected" });
  });
  it("rejects BRLT issued by an account other than the invoice asset issuer", () => {
    expect(verifyPayment(invoice, transaction, [{ ...operation, asset_issuer: Keypair.random().publicKey() }])).toEqual({ reason: "Unexpected asset", status: "rejected" });
  });
  it("rejects a wrong memo, amount, asset code, or source", () => {
    for (const candidate of [
      [ { ...transaction, memo: "other" }, operation ], [ transaction, { ...operation, amount: "9" } ], [ transaction, { ...operation, asset_code: "USDC" } ], [ { ...transaction, source_account: Keypair.random().publicKey() }, operation ], [ { ...transaction, successful: false }, operation ],
    ] as const) expect(verifyPayment(invoice, candidate[0], [candidate[1]])).toMatchObject({ status: "rejected" });
  });
});
