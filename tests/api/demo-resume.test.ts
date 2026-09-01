import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  ensureDemoInvoice: vi.fn(),
  loadStellarConfig: vi.fn(),
  requireServerEnv: vi.fn(),
  requireWalletSession: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-origin.js", () => ({
  assertTrustedOrigin: mocks.assertTrustedOrigin,
}));
vi.mock("../../app/lib/auth/request-session.js", () => ({
  requireWalletSession: mocks.requireWalletSession,
}));
vi.mock("../../app/lib/config.js", () => ({
  loadStellarConfig: mocks.loadStellarConfig,
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/demo/persistent-session.js", () => ({
  ensureDemoInvoice: mocks.ensureDemoInvoice,
}));

const debtorPublicKey = Keypair.random().publicKey();
const issuerPublicKey = Keypair.random().publicKey();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireServerEnv.mockReturnValue("https://invoice.example.com");
  mocks.requireWalletSession.mockReturnValue({ network: "testnet", walletPublicKey: debtorPublicKey });
  mocks.loadStellarConfig.mockReturnValue({ assetCode: "BRLT", issuerPublicKey, network: "testnet" });
  mocks.ensureDemoInvoice.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000123" });
});

describe("demo resume API", () => {
  it("returns the idempotent demo invoice only for the authenticated demo wallet", async () => {
    const { POST } = await import("../../app/api/demo/resume/route.js");
    const request = new Request("https://invoice.example.com/api/demo/resume", {
      headers: { origin: "https://invoice.example.com" },
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ invoiceId: "00000000-0000-4000-8000-000000000123" });
    expect(mocks.ensureDemoInvoice).toHaveBeenCalledWith(debtorPublicKey, issuerPublicKey);
  });

  it("reports that an authenticated wallet still needs initial provisioning", async () => {
    mocks.ensureDemoInvoice.mockRejectedValueOnce(Object.assign(
      new Error("Esta carteira demo ainda não recebeu BRLT fictício."),
      { code: "DEMO_NOT_PROVISIONED" },
    ));
    const { POST } = await import("../../app/api/demo/resume/route.js");

    const response = await POST(new Request("https://invoice.example.com/api/demo/resume", {
      headers: { origin: "https://invoice.example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "DEMO_NOT_PROVISIONED",
      error: "Esta carteira demo ainda não recebeu BRLT fictício.",
    });
  });

  it("rejects a resume request without a wallet session", async () => {
    mocks.requireWalletSession.mockImplementationOnce(() => {
      throw new Error("Wallet authentication is required");
    });
    const { POST } = await import("../../app/api/demo/resume/route.js");

    const response = await POST(new Request("https://invoice.example.com/api/demo/resume", {
      headers: { origin: "https://invoice.example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(401);
  });

  it("does not expose unexpected server failures as recoverable conflicts", async () => {
    mocks.ensureDemoInvoice.mockRejectedValueOnce(new Error("database connection details"));
    const { POST } = await import("../../app/api/demo/resume/route.js");

    const response = await POST(new Request("https://invoice.example.com/api/demo/resume", {
      headers: { origin: "https://invoice.example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "A demonstração não pôde ser retomada." });
  });
});
