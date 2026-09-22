import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  loadStellarConfig: vi.fn(),
  persistInvoice: vi.fn(),
  requireServerEnv: vi.fn(),
  requireWalletSession: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-session.js", () => ({
  requireWalletSession: mocks.requireWalletSession,
}));
vi.mock("../../app/lib/auth/request-origin.js", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
}));
vi.mock("../../app/lib/config.js", () => ({
  loadStellarConfig: mocks.loadStellarConfig,
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/invoices/service.js", () => ({
  listWalletInvoices: vi.fn(),
  persistInvoice: mocks.persistInvoice,
}));

import { POST as createInvoice } from "../../app/api/invoices/route.js";

const issuerPublicKey = Keypair.random().publicKey();
const walletPublicKey = Keypair.random().publicKey();
const otherPublicKey = Keypair.random().publicKey();

function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/invoices", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      origin,
    },
    method: "POST",
  });
}

describe("POST /api/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireServerEnv.mockReturnValue("http://localhost:3000");
    mocks.loadStellarConfig.mockReturnValue({
      assetCode: "BRLT",
      issuerPublicKey,
      network: "testnet",
      receiverPublicKey: Keypair.random().publicKey(),
    });
    mocks.requireWalletSession.mockReturnValue({
      authenticatedAt: new Date().toISOString(),
      walletPublicKey,
    });
  });

  it("creates an invoice when the authenticated wallet is the receiver", async () => {
    mocks.persistInvoice.mockResolvedValueOnce({
      id: "inv-123",
      memo: "inv-memo",
      receiver_public_key: walletPublicKey,
      status: "pending",
    });

    const response = await createInvoice(request({
      amount: "5.0000000",
      debtorPublicKey: otherPublicKey,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      receiverPublicKey: walletPublicKey,
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.invoice.id).toBe("inv-123");
    expect(mocks.persistInvoice).toHaveBeenCalledWith(
      {
        amount: "5.0000000",
        debtorPublicKey: otherPublicKey,
        dueAt: expect.any(String),
      },
      issuerPublicKey,
      walletPublicKey,
    );
  });

  it("creates an invoice when the authenticated wallet is the debtor", async () => {
    mocks.persistInvoice.mockResolvedValueOnce({
      id: "inv-456",
      memo: "inv-memo-2",
      receiver_public_key: otherPublicKey,
      status: "pending",
    });

    const response = await createInvoice(request({
      amount: "10.0000000",
      debtorPublicKey: walletPublicKey,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      receiverPublicKey: otherPublicKey,
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.invoice.id).toBe("inv-456");
  });

  it("rejects creation when the authenticated wallet is neither debtor nor receiver", async () => {
    const thirdPartyKey = Keypair.random().publicKey();
    const response = await createInvoice(request({
      amount: "5.0000000",
      debtorPublicKey: otherPublicKey,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      receiverPublicKey: thirdPartyKey,
    }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("devedor ou o recebedor");
  });

  it("rejects when required fields are missing", async () => {
    const response = await createInvoice(request({
      amount: "5.0000000",
      debtorPublicKey: otherPublicKey,
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Dados incompletos");
  });

  it("returns 401 when the wallet session is missing", async () => {
    mocks.requireWalletSession.mockImplementationOnce(() => {
      throw new Error("Wallet authentication is required");
    });

    const response = await createInvoice(request({
      amount: "5.0000000",
      debtorPublicKey: otherPublicKey,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      receiverPublicKey: walletPublicKey,
    }));

    expect(response.status).toBe(401);
  });
});
