import { describe, expect, it } from "vitest";
import { mapInvoiceRow } from "../../app/lib/invoices/service.js";

describe("invoice database mapper", () => {
  it("maps Supabase snake_case rows into the verifier contract", () => {
    expect(mapInvoiceRow({ id: "a", amount: "1.0000000", asset_issuer: "GISSUER", debtor_public_key: "GDEBTOR", due_at: "2030-01-01T00:00:00Z", issuer_public_key: "GISSUER", memo: "inv-1", status: "pending" })).toMatchObject({
      assetIssuer: "GISSUER", debtorPublicKey: "GDEBTOR", issuerPublicKey: "GISSUER", dueAt: "2030-01-01T00:00:00Z",
    });
  });
});
