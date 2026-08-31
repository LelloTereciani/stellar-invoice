import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { assertPayableByWallet } from "../../app/lib/invoices/access.js";

const debtorPublicKey = Keypair.random().publicKey();
const invoice = {
  debtorPublicKey,
  dueAt: "2030-01-01T00:00:00.000Z",
  status: "pending" as const,
};

describe("invoice customer access", () => {
  it("allows only the debtor to prepare a pending, unexpired payment", () => {
    expect(() => assertPayableByWallet(invoice, debtorPublicKey, new Date("2029-01-01T00:00:00.000Z"))).not.toThrow();
    expect(() => assertPayableByWallet(invoice, Keypair.random().publicKey(), new Date("2029-01-01T00:00:00.000Z"))).toThrow("not the invoice debtor");
  });

  it("rejects confirmed and expired invoices", () => {
    expect(() => assertPayableByWallet({ ...invoice, status: "confirmed" }, debtorPublicKey)).toThrow("not pending");
    expect(() => assertPayableByWallet(invoice, debtorPublicKey, new Date("2030-01-01T00:00:00.000Z"))).toThrow("expired");
  });
});
