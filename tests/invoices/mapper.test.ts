import { describe, expect, it } from "vitest";
import { mapInvoiceRow } from "../../app/lib/invoices/service.js";

describe("invoice database mapper", () => {
  it("maps Supabase snake_case rows into the verifier contract", () => {
    expect(mapInvoiceRow({ id: "a", amount_text: "1.0000000", asset_issuer: "GISSUER", created_at: "2029-01-01T00:00:00Z", debtor_public_key: "GDEBTOR", due_at: "2030-01-01T00:00:00Z", issuer_public_key: "GISSUER", memo: "inv-1", status: "pending" })).toMatchObject({
      amount: "1.0000000", assetIssuer: "GISSUER", createdAt: "2029-01-01T00:00:00Z", debtorPublicKey: "GDEBTOR", issuerPublicKey: "GISSUER", dueAt: "2030-01-01T00:00:00Z",
    });
  });

  it("rejects a decimal value that did not arrive through the exact text projection", () => {
    expect(() => mapInvoiceRow({ id: "a", amount_text: 1 as unknown as string, asset_issuer: "GISSUER", created_at: "2029-01-01T00:00:00Z", debtor_public_key: "GDEBTOR", due_at: "2030-01-01T00:00:00Z", issuer_public_key: "GISSUER", memo: "inv-1", status: "pending" })).toThrow("exact decimal text");
  });
});
