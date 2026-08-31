import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildInvoicePaymentXdr: vi.fn(),
  findDebtorInvoice: vi.fn(),
  listDebtorInvoices: vi.fn(),
  requireWalletSession: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-session.js", () => ({
  requireWalletSession: mocks.requireWalletSession,
}));
vi.mock("../../app/lib/invoices/service.js", () => ({
  findDebtorInvoice: mocks.findDebtorInvoice,
  listDebtorInvoices: mocks.listDebtorInvoices,
}));
vi.mock("../../app/lib/stellar/transactions.js", () => ({
  buildInvoicePaymentXdr: mocks.buildInvoicePaymentXdr,
}));

import { GET as getInvoice } from "../../app/api/invoices/[id]/route.js";
import { GET as getPayment } from "../../app/api/invoices/[id]/payment/route.js";
import { GET as listInvoices } from "../../app/api/invoices/route.js";

const walletPublicKey = Keypair.random().publicKey();
const invoice = {
  amount: "12.0000000",
  assetIssuer: Keypair.random().publicKey(),
  debtorPublicKey: walletPublicKey,
  dueAt: "2030-01-01T00:00:00.000Z",
  issuerPublicKey: Keypair.random().publicKey(),
  memo: "invoice-1",
  status: "pending" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireWalletSession.mockReturnValue({ network: "testnet", walletPublicKey });
  mocks.findDebtorInvoice.mockResolvedValue(invoice);
  mocks.listDebtorInvoices.mockResolvedValue([invoice]);
  mocks.buildInvoicePaymentXdr.mockResolvedValue("AAAA-XDR");
});

describe("customer invoice API", () => {
  it("lists only invoices selected for the authenticated wallet", async () => {
    const response = await listInvoices(new Request("https://invoice.example.com/api/invoices"));

    expect(response.status).toBe(200);
    expect(mocks.listDebtorInvoices).toHaveBeenCalledWith(walletPublicKey);
  });

  it("loads invoice details through an id and debtor-bound query", async () => {
    const response = await getInvoice(new Request("https://invoice.example.com/api/invoices/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findDebtorInvoice).toHaveBeenCalledWith("abc", walletPublicKey);
  });

  it("builds a payment XDR only for the authenticated debtor", async () => {
    const response = await getPayment(new Request("https://invoice.example.com/api/invoices/abc/payment"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.buildInvoicePaymentXdr).toHaveBeenCalledWith(invoice, walletPublicKey);
    await expect(response.json()).resolves.toMatchObject({ network: "testnet", xdr: "AAAA-XDR" });
  });
});
