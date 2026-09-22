import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  filters: [] as Array<{ column: string; table: string; value: string }>,
  insertedInvoice: undefined as Record<string, unknown> | undefined,
  rows: new Map<string, unknown[]>(),
  selectedColumns: undefined as string | undefined,
  singleRow: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const query = {
        eq: (column: string, value: string) => {
          database.filters.push({ column, table, value });
          return query;
        },
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
        limit: async () => ({ data: database.rows.get(table) ?? [], error: null }),
        maybeSingle: async () => ({ data: database.singleRow ?? null, error: null }),
        order: () => query,
        select: () => query,
      };
      return query;
    },
  }),
}));

import {
  findWalletInvoice,
  listWalletInvoices,
  mapInvoiceRow,
  persistInvoice,
} from "../../app/lib/invoices/service.js";

const debtor = "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY";
const issuer = "GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU";
const receiver = "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73";

beforeEach(() => {
  database.filters = [];
  database.insertedInvoice = undefined;
  database.rows = new Map();
  database.selectedColumns = undefined;
  database.singleRow = undefined;
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

  it.each([
    ["payable", "debtor_public_key"],
    ["receivable", "receiver_public_key"],
  ] as const)("filters %s invoices by the authenticated wallet column", async (role, column) => {
    database.rows.set("invoices", []);

    await listWalletInvoices(debtor, role);

    expect(database.filters).toContainEqual({ column, table: "invoices", value: debtor });
  });

  it("authorizes receiver detail without exposing debtor-only payment telemetry", async () => {
    database.singleRow = {
      id: "invoice-id",
      amount_text: "5.0000000",
      asset_issuer: issuer,
      created_at: "2029-01-01T00:00:00.000Z",
      debtor_public_key: debtor,
      due_at: "2030-01-01T00:00:00.000Z",
      issuer_public_key: issuer,
      memo: "invoice-id",
      prepared_payment_expires_at: "2030-01-01T00:03:00.000Z",
      prepared_payment_hash: "a".repeat(64),
      prepared_payment_xdr: "AAAA-XDR",
      receiver_public_key: receiver,
      status: "pending",
    };
    database.rows.set("rejected_payment_attempts", [{
      observed_at: "2029-01-02T00:00:00.000Z",
      reason: "private debtor detail",
      transaction_hash: "b".repeat(64),
    }]);

    const result = await findWalletInvoice("invoice-id", receiver);

    expect(result).toMatchObject({
      preparedPaymentExpiresAt: null,
      preparedPaymentHash: null,
      preparedPaymentXdr: null,
      viewerRole: "receiver",
    });
    expect(result.rejectedAttempts).toBeUndefined();
    expect(database.filters).not.toContainEqual(expect.objectContaining({ table: "rejected_payment_attempts" }));
  });

  it("denies an unrelated wallet before loading payment attempts", async () => {
    database.singleRow = {
      id: "invoice-id",
      amount_text: "5.0000000",
      asset_issuer: issuer,
      created_at: "2029-01-01T00:00:00.000Z",
      debtor_public_key: debtor,
      due_at: "2030-01-01T00:00:00.000Z",
      issuer_public_key: issuer,
      memo: "invoice-id",
      receiver_public_key: receiver,
      status: "pending",
    };

    await expect(findWalletInvoice("invoice-id", "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"))
      .rejects.toThrow("Invoice was not found");
    expect(database.filters).not.toContainEqual(expect.objectContaining({ table: "rejected_payment_attempts" }));
  });
});
