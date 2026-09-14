import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  insertedInvoice: undefined as Record<string, unknown> | undefined,
  selectedColumns: undefined as string | undefined,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: (invoice: Record<string, unknown>) => {
        database.insertedInvoice = invoice;
        return {
          select: (columns: string) => {
            database.selectedColumns = columns;
            return {
              single: async () => ({
                data: {
                  id: "invoice-id",
                  memo: invoice.memo,
                  ...(columns.split(",").includes("receiver_public_key") ? { receiver_public_key: invoice.receiver_public_key } : {}),
                  status: "pending",
                },
                error: null,
              }),
            };
          },
        };
      },
    }),
  }),
}));

import { mapInvoiceRow, persistInvoice } from "../../app/lib/invoices/service.js";

const debtor = "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY";
const issuer = "GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU";
const receiver = "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73";

beforeEach(() => {
  database.insertedInvoice = undefined;
  database.selectedColumns = undefined;
  vi.stubEnv("SUPABASE_URL", "https://database.example.com");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
});

afterEach(() => vi.unstubAllEnvs());

describe("invoice database mapper", () => {
  it("maps Supabase snake_case rows into the verifier contract", () => {
    expect(mapInvoiceRow({ id: "a", amount_text: "1.0000000", asset_issuer: "GISSUER", created_at: "2029-01-01T00:00:00Z", debtor_public_key: "GDEBTOR", due_at: "2030-01-01T00:00:00Z", issuer_public_key: "GISSUER", memo: "inv-1", receiver_public_key: "GRECEIVER", status: "pending" })).toMatchObject({
      amount: "1.0000000", assetIssuer: "GISSUER", createdAt: "2029-01-01T00:00:00Z", debtorPublicKey: "GDEBTOR", issuerPublicKey: "GISSUER", receiverPublicKey: "GRECEIVER", dueAt: "2030-01-01T00:00:00Z",
    });
  });

  it("rejects a decimal value that did not arrive through the exact text projection", () => {
    expect(() => mapInvoiceRow({ id: "a", amount_text: 1 as unknown as string, asset_issuer: "GISSUER", created_at: "2029-01-01T00:00:00Z", debtor_public_key: "GDEBTOR", due_at: "2030-01-01T00:00:00Z", issuer_public_key: "GISSUER", memo: "inv-1", receiver_public_key: "GRECEIVER", status: "pending" })).toThrow("exact decimal text");
  });

  it("persists the configured receiver independently from the asset issuer", async () => {
    await expect(persistInvoice(
      { amount: "5.0000000", debtorPublicKey: debtor, dueAt: "2030-01-01T00:00:00.000Z" },
      issuer,
      receiver,
    )).resolves.toMatchObject({ id: "invoice-id", receiver_public_key: receiver, status: "pending" });

    expect(database.insertedInvoice).toMatchObject({
      asset_issuer: issuer,
      issuer_public_key: issuer,
      receiver_public_key: receiver,
    });
  });
});
