import { describe, expect, it } from "vitest";

import { processInvoiceVerification, type VerificationRepository } from "../../app/lib/invoices/verification-service.js";

const hash = "a".repeat(64);
const baseInvoice = {
  amount: "10.0000000",
  assetIssuer: "GISSUER",
  confirmedTransactionHash: null,
  createdAt: "2028-01-01T00:00:00.000Z",
  debtorPublicKey: "GDEBTOR",
  dueAt: "2030-01-01T00:00:00.000Z",
  id: "invoice-1",
  issuerPublicKey: "GISSUER",
  memo: "inv-123",
  status: "pending" as const,
};
const transaction = { created_at: "2029-01-01T00:00:00.000Z", hash, memo: "inv-123", memo_type: "text" as const, source_account: "GDEBTOR", successful: true };
const operations = [{ amount: "10.0000000", asset_code: "BRLT", asset_issuer: "GISSUER", source_account: "GDEBTOR", to: "GISSUER", transaction_successful: true, type: "payment" }];

function repository() {
  const calls = { confirmed: 0, expired: 0, rejected: 0 };
  const value: VerificationRepository = {
    async confirm() { calls.confirmed += 1; return { status: "confirmed" }; },
    async expire() { calls.expired += 1; return { status: "expired" }; },
    async recordRejected() { calls.rejected += 1; },
  };
  return { calls, value };
}

describe("invoice verification lifecycle", () => {
  it("confirms an exact successful payment", async () => {
    const repo = repository();
    await expect(processInvoiceVerification(baseInvoice, hash, async () => ({ operations, transaction }), repo.value, new Date("2029-01-01"))).resolves.toMatchObject({ status: "confirmed" });
    expect(repo.calls).toEqual({ confirmed: 1, expired: 0, rejected: 0 });
  });

  it("records a divergent payment without confirming the invoice", async () => {
    const repo = repository();
    const result = await processInvoiceVerification(baseInvoice, hash, async () => ({ operations, transaction: { ...transaction, memo: "other" } }), repo.value, new Date("2029-01-01"));
    expect(result).toMatchObject({ status: "rejected" });
    expect(repo.calls).toEqual({ confirmed: 0, expired: 0, rejected: 1 });
  });

  it("confirms a payment observed before the due date even when verification happens later", async () => {
    const repo = repository();
    let ledgerCalled = false;
    const result = await processInvoiceVerification(baseInvoice, hash, async () => { ledgerCalled = true; return { operations, transaction }; }, repo.value, new Date("2031-01-01"));
    expect(result).toMatchObject({ status: "confirmed" });
    expect(ledgerCalled).toBe(true);
    expect(repo.calls).toEqual({ confirmed: 1, expired: 0, rejected: 0 });
  });

  it("records and expires a payment observed after the due date", async () => {
    const repo = repository();
    const lateTransaction = { ...transaction, created_at: "2031-01-01T00:00:00.000Z" };
    const result = await processInvoiceVerification(baseInvoice, hash, async () => ({ operations, transaction: lateTransaction }), repo.value, new Date("2031-01-02"));
    expect(result).toMatchObject({ status: "rejected" });
    expect(repo.calls).toEqual({ confirmed: 0, expired: 1, rejected: 1 });
  });

  it("returns an already confirmed invoice idempotently for the same hash", async () => {
    const repo = repository();
    const result = await processInvoiceVerification({ ...baseInvoice, confirmedTransactionHash: hash, status: "confirmed" }, hash, async () => { throw new Error("ledger must not be called"); }, repo.value);
    expect(result).toMatchObject({ status: "confirmed", transactionHash: hash });
    expect(repo.calls).toEqual({ confirmed: 0, expired: 0, rejected: 0 });
  });
});
