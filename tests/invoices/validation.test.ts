import { describe, expect, it } from "vitest";
import { createInvoiceDraft } from "../../app/lib/invoices/validation.js";

const debtor = "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY";
const issuer = "GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU";
const receiver = "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73";

describe("invoice validation", () => {
  it("creates a pending BRLT invoice with server-owned fields", () => {
    expect(createInvoiceDraft({ debtorPublicKey: debtor, amount: "12.3456789", dueAt: "2030-01-01T00:00:00.000Z" }, issuer, receiver)).toMatchObject({
      debtorPublicKey: debtor, issuerPublicKey: issuer, receiverPublicKey: receiver, amount: "12.3456789", assetCode: "BRLT", status: "pending",
    });
  });

  it("rejects invalid keys, non-positive values, precision beyond seven decimals and past due dates", () => {
    for (const input of [
      { debtorPublicKey: "invalid", amount: "1", dueAt: "2030-01-01T00:00:00.000Z" },
      { debtorPublicKey: debtor, amount: "0", dueAt: "2030-01-01T00:00:00.000Z" },
      { debtorPublicKey: debtor, amount: "1.12345678", dueAt: "2030-01-01T00:00:00.000Z" },
      { debtorPublicKey: debtor, amount: "1", dueAt: "2020-01-01T00:00:00.000Z" },
    ]) expect(() => createInvoiceDraft(input, issuer, receiver, new Date("2029-01-01T00:00:00.000Z"))).toThrow();
    expect(() => createInvoiceDraft(
      { debtorPublicKey: debtor, amount: "1", dueAt: "2030-01-01T00:00:00.000Z" },
      issuer,
      "invalid",
      new Date("2029-01-01T00:00:00.000Z"),
    )).toThrow("Receiver must be a valid Stellar public key");
  });
});
