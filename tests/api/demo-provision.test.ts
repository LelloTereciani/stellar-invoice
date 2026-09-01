import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  buildTrustlineXdr: vi.fn(),
  createPersistentDemoSession: vi.fn(),
  demoRequestFingerprint: vi.fn(),
  fundDemoWallet: vi.fn(),
  loadDemoConfig: vi.fn(),
  loadStellarConfig: vi.fn(),
  requireServerEnv: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-origin.js", () => ({ assertTrustedOrigin: mocks.assertTrustedOrigin }));
vi.mock("../../app/lib/config.js", () => ({
  loadDemoConfig: mocks.loadDemoConfig,
  loadStellarConfig: mocks.loadStellarConfig,
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/demo/persistent-session.js", () => ({
  createPersistentDemoSession: mocks.createPersistentDemoSession,
}));
vi.mock("../../app/lib/demo/request-fingerprint.js", () => ({ demoRequestFingerprint: mocks.demoRequestFingerprint }));
vi.mock("../../app/lib/demo/provisioning.js", () => ({ fundDemoWallet: mocks.fundDemoWallet }));
vi.mock("../../app/lib/stellar/transactions.js", () => ({ buildTrustlineXdr: mocks.buildTrustlineXdr }));

const publicKey = Keypair.random().publicKey();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireServerEnv.mockImplementation((name: string) => name === "APP_ORIGIN"
    ? "https://invoice.example.com"
    : "session-secret-at-least-32-characters");
  mocks.loadStellarConfig.mockReturnValue({ assetCode: "BRLT", issuerPublicKey: Keypair.random().publicKey() });
  mocks.demoRequestFingerprint.mockReturnValue("a".repeat(64));
});

describe("demo provision API errors", () => {
  it.each([
    ["DEMO_ALREADY_PROVISIONED", 409, "Esta carteira demo já recebeu BRLT. Use Continuar demonstração."],
    ["DEMO_RATE_LIMIT", 429, "O limite diário de demonstrações foi atingido. Tente novamente após a renovação do limite."],
  ])("returns structured %s guidance", async (code, status, message) => {
    mocks.createPersistentDemoSession.mockRejectedValueOnce(Object.assign(new Error(message), { code }));
    const { POST } = await import("../../app/api/demo/provision/route.js");

    const response = await POST(new Request("https://invoice.example.com/api/demo/provision", {
      body: JSON.stringify({ publicKey }),
      headers: { "content-type": "application/json", origin: "https://invoice.example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ code, error: message });
  });
});
