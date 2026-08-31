import { describe, expect, it } from "vitest";
import { verifyPayment } from "../../app/lib/stellar/payment-verifier.js";

const invoice = { amount: "10.0000000", assetIssuer: "GISSUER", debtorPublicKey: "GDEBTOR", issuerPublicKey: "GISSUER", memo: "inv-123" };
const transaction = { hash: "a".repeat(64), memo: "inv-123", source_account: "GDEBTOR" };
const operation = { amount: "10.0000000", asset_code: "BRLT", asset_issuer: "GISSUER", destination: "GISSUER", type: "payment" };

describe("ledger payment verification", () => {
  it("confirms only an exact invoice payment", () => expect(verifyPayment(invoice, transaction, [operation])).toMatchObject({ status: "confirmed" }));
  it("rejects a wrong memo, amount, asset, destination, or source", () => {
    for (const candidate of [
      [ { ...transaction, memo: "other" }, operation ], [ transaction, { ...operation, amount: "9" } ], [ transaction, { ...operation, asset_code: "USDC" } ], [ transaction, { ...operation, destination: "GOTHER" } ], [ { ...transaction, source_account: "GOTHER" }, operation ],
    ] as const) expect(verifyPayment(invoice, candidate[0], [candidate[1]])).toMatchObject({ status: "rejected" });
  });
});
