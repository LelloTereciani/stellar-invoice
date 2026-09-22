import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  buildInvoicePaymentXdr: vi.fn(),
  confirmInvoice: vi.fn(),
  expireInvoice: vi.fn(),
  findDebtorInvoice: vi.fn(),
  findWalletInvoice: vi.fn(),
  listWalletInvoices: vi.fn(),
  prepareInvoicePayment: vi.fn(),
  preparedTransactionMetadata: vi.fn(),
  processInvoiceVerification: vi.fn(),
  recordRejectedPayment: vi.fn(),
  requireServerEnv: vi.fn(),
  requireWalletSession: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-session.js", () => ({
  requireWalletSession: mocks.requireWalletSession,
}));
vi.mock("../../app/lib/invoices/service.js", () => ({
  confirmInvoice: mocks.confirmInvoice,
  expireInvoice: mocks.expireInvoice,
  findDebtorInvoice: mocks.findDebtorInvoice,
  findWalletInvoice: mocks.findWalletInvoice,
  listWalletInvoices: mocks.listWalletInvoices,
  prepareInvoicePayment: mocks.prepareInvoicePayment,
  recordRejectedPayment: mocks.recordRejectedPayment,
}));
vi.mock("../../app/lib/auth/request-origin.js", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
}));
vi.mock("../../app/lib/config.js", () => ({
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/invoices/verification-service.js", () => ({
  processInvoiceVerification: mocks.processInvoiceVerification,
}));
vi.mock("../../app/lib/stellar/transactions.js", () => ({
  buildInvoicePaymentXdr: mocks.buildInvoicePaymentXdr,
  preparedTransactionMetadata: mocks.preparedTransactionMetadata,
  reviewInvoicePaymentXdr: vi.fn(),
}));

import { GET as getInvoice } from "../../app/api/invoices/[id]/route.js";
import { GET as getPayment } from "../../app/api/invoices/[id]/payment/route.js";
import { POST as verifyPayment } from "../../app/api/invoices/[id]/verify/route.js";
import { GET as listInvoices } from "../../app/api/invoices/route.js";

const walletPublicKey = Keypair.random().publicKey();
const invoice = {
  amount: "12.0000000",
  assetIssuer: Keypair.random().publicKey(),
  debtorPublicKey: walletPublicKey,
  dueAt: "2030-01-01T00:00:00.000Z",
  issuerPublicKey: Keypair.random().publicKey(),
  memo: "invoice-1",
  preparedPaymentExpiresAt: null,
  preparedPaymentHash: null,
  preparedPaymentXdr: null,
  receiverPublicKey: Keypair.random().publicKey(),
  status: "pending" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireWalletSession.mockReturnValue({ network: "testnet", walletPublicKey });
  mocks.findDebtorInvoice.mockResolvedValue(invoice);
  mocks.findWalletInvoice.mockResolvedValue({ ...invoice, viewerRole: "debtor" });
  mocks.listWalletInvoices.mockResolvedValue([invoice]);
  mocks.buildInvoicePaymentXdr.mockResolvedValue("AAAA-XDR");
  mocks.prepareInvoicePayment.mockResolvedValue({ ...invoice, preparedPaymentExpiresAt: "2030-01-01T00:03:00.000Z", preparedPaymentHash: "a".repeat(64), preparedPaymentXdr: "AAAA-XDR" });
  mocks.preparedTransactionMetadata.mockReturnValue({ expiresAt: "2030-01-01T00:03:00.000Z", transactionHash: "a".repeat(64) });
  mocks.requireServerEnv.mockReturnValue("https://invoice.example.com");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
});

describe("customer invoice API", () => {
  it("lists payable invoices for the authenticated wallet by default", async () => {
    const response = await listInvoices(new Request("https://invoice.example.com/api/invoices"));

    expect(response.status).toBe(200);
    expect(mocks.listWalletInvoices).toHaveBeenCalledWith(walletPublicKey, "payable");
  });

  it("lists receivable invoices for the authenticated wallet", async () => {
    const response = await listInvoices(new Request("https://invoice.example.com/api/invoices?role=receivable"));

    expect(response.status).toBe(200);
    expect(mocks.listWalletInvoices).toHaveBeenCalledWith(walletPublicKey, "receivable");
  });

  it("rejects an unsupported invoice role", async () => {
    const response = await listInvoices(new Request("https://invoice.example.com/api/invoices?role=admin"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invoice role is invalid" });
    expect(mocks.listWalletInvoices).not.toHaveBeenCalled();
  });

  it("loads invoice details for a debtor or receiver and exposes the viewer role", async () => {
    const response = await getInvoice(new Request("https://invoice.example.com/api/invoices/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findWalletInvoice).toHaveBeenCalledWith("abc", walletPublicKey);
    await expect(response.json()).resolves.toMatchObject({ viewerRole: "debtor" });
  });

  it("returns receiver details without debtor-only payment telemetry", async () => {
    mocks.findWalletInvoice.mockResolvedValueOnce({
      ...invoice,
      preparedPaymentExpiresAt: null,
      preparedPaymentHash: null,
      preparedPaymentXdr: null,
      viewerRole: "receiver",
    });

    const response = await getInvoice(new Request("https://invoice.example.com/api/invoices/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.viewerRole).toBe("receiver");
    expect(body.preparedPaymentExpiresAt).toBeNull();
    expect(body.preparedPaymentHash).toBeNull();
    expect(body.preparedPaymentXdr).toBeNull();
    expect(body.rejectedAttempts).toBeUndefined();
  });

  it("returns not found for an unrelated wallet", async () => {
    mocks.findWalletInvoice.mockRejectedValueOnce(new Error("Invoice was not found"));

    const response = await getInvoice(new Request("https://invoice.example.com/api/invoices/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(404);
  });

  it("builds a payment XDR only for the authenticated debtor", async () => {
    const response = await getPayment(new Request("https://invoice.example.com/api/invoices/abc/payment"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.buildInvoicePaymentXdr).toHaveBeenCalledWith(invoice, walletPublicKey);
    await expect(response.json()).resolves.toMatchObject({ network: "testnet", preparedTransactionHash: "a".repeat(64), xdr: "AAAA-XDR" });
  });

  it("does not broaden payment access when the wallet is only the receiver", async () => {
    mocks.findDebtorInvoice.mockRejectedValueOnce(new Error("Invoice was not found"));

    const response = await getPayment(new Request("https://invoice.example.com/api/invoices/abc/payment"), {
      params: Promise.resolve({ id: "abc" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.findDebtorInvoice).toHaveBeenCalledWith("abc", walletPublicKey);
    expect(mocks.findWalletInvoice).not.toHaveBeenCalled();
    expect(mocks.buildInvoicePaymentXdr).not.toHaveBeenCalled();
  });

  it("does not broaden payment verification access when the wallet is only the receiver", async () => {
    mocks.findDebtorInvoice.mockRejectedValueOnce(new Error("Invoice was not found"));

    const response = await verifyPayment(new Request("https://invoice.example.com/api/invoices/abc/verify", {
      body: JSON.stringify({ transactionHash: "a".repeat(64) }),
      headers: { "content-type": "application/json", origin: "https://invoice.example.com" },
      method: "POST",
    }), { params: Promise.resolve({ id: "abc" }) });

    expect(response.status).toBe(400);
    expect(mocks.findDebtorInvoice).toHaveBeenCalledWith("abc", walletPublicKey);
    expect(mocks.findWalletInvoice).not.toHaveBeenCalled();
    expect(mocks.processInvoiceVerification).not.toHaveBeenCalled();
  });

  it("reports invoice storage failures as server errors, not expired authentication", async () => {
    mocks.listWalletInvoices.mockRejectedValueOnce(new Error("Invoices could not be loaded"));
    const listResponse = await listInvoices(new Request("https://invoice.example.com/api/invoices"));
    expect(listResponse.status).toBe(500);

    mocks.findWalletInvoice.mockRejectedValueOnce(new Error("Invoice attempts could not be loaded"));
    const detailResponse = await getInvoice(new Request("https://invoice.example.com/api/invoices/abc"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(detailResponse.status).toBe(500);
  });

  it("reconciles an already submitted prepared hash instead of building another payment", async () => {
    mocks.findDebtorInvoice.mockResolvedValue({ ...invoice, preparedPaymentExpiresAt: "2000-01-01T00:00:00.000Z", preparedPaymentHash: "b".repeat(64), preparedPaymentXdr: "AAAA-XDR" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ hash: "b".repeat(64) }))));
    const response = await getPayment(new Request("https://invoice.example.com/api/invoices/abc/payment"), { params: Promise.resolve({ id: "abc" }) });

    await expect(response.json()).resolves.toMatchObject({ transactionHash: "b".repeat(64) });
    expect(mocks.buildInvoicePaymentXdr).not.toHaveBeenCalled();
  });
});
