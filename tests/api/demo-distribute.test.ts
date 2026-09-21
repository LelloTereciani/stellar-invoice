import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireDemoDistributionLock: vi.fn(),
  assertTrustedOrigin: vi.fn(),
  completeDemoDistribution: vi.fn(),
  ensureDemoInvoice: vi.fn(),
  getPersistentDemoSessionWallet: vi.fn(),
  loadDemoDistributionConfig: vi.fn(),
  releaseDemoDistributionLock: vi.fn(),
  requireServerEnv: vi.fn(),
  reserveDemoDistribution: vi.fn(),
  verifyDemoClaimSignature: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-origin.js", () => ({ assertTrustedOrigin: mocks.assertTrustedOrigin }));
vi.mock("../../app/lib/config.js", () => ({
  loadDemoDistributionConfig: mocks.loadDemoDistributionConfig,
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/demo/claim-message.js", () => ({ verifyDemoClaimSignature: mocks.verifyDemoClaimSignature }));
vi.mock("../../app/lib/demo/persistent-session.js", () => ({
  acquireDemoDistributionLock: mocks.acquireDemoDistributionLock,
  completeDemoDistribution: mocks.completeDemoDistribution,
  ensureDemoInvoice: mocks.ensureDemoInvoice,
  getPersistentDemoSessionWallet: mocks.getPersistentDemoSessionWallet,
  releaseDemoDistributionLock: mocks.releaseDemoDistributionLock,
  reserveDemoDistribution: mocks.reserveDemoDistribution,
  resetExpiredDemoDistribution: vi.fn(),
  storePreparedDemoDistribution: vi.fn(),
}));
vi.mock("../../app/lib/demo/provisioning.js", () => ({
  DEMO_ASSET_AMOUNT: "25.0000000",
  demoDistributionExists: vi.fn(),
  demoDistributionExpired: vi.fn(),
  prepareDemoBrltDistribution: vi.fn(),
  submitPreparedDemoDistribution: vi.fn(),
}));

const customerPublicKey = Keypair.random().publicKey();
const issuerPublicKey = Keypair.random().publicKey();
const receiverPublicKey = Keypair.random().publicKey();

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireServerEnv.mockReturnValue("https://invoice.example.com");
  mocks.loadDemoDistributionConfig.mockReturnValue({
    distributionSecret: Keypair.random().secret(),
    issuerPublicKey,
    receiverPublicKey,
  });
  mocks.getPersistentDemoSessionWallet.mockResolvedValue(customerPublicKey);
  mocks.verifyDemoClaimSignature.mockReturnValue(true);
  mocks.reserveDemoDistribution.mockResolvedValue({
    attemptKey: null,
    customerPublicKey,
    invoiceId: null,
    signedXdr: null,
    status: "confirmed",
    transactionHash: "a".repeat(64),
  });
  mocks.ensureDemoInvoice.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000123" });
});

describe("demo distribution API", () => {
  it("creates the demo invoice with the configured issuer and treasury receiver", async () => {
    const { POST } = await import("../../app/api/demo/distribute/route.js");
    const response = await POST(new Request("https://invoice.example.com/api/demo/distribute", {
      body: JSON.stringify({ claimMessage: "claim", sessionId: "session", signedClaim: "signature" }),
      headers: { "content-type": "application/json", origin: "https://invoice.example.com" },
      method: "POST",
    }));

    expect(response.status).toBe(200);
    expect(mocks.ensureDemoInvoice).toHaveBeenCalledWith(customerPublicKey, issuerPublicKey, receiverPublicKey);
    expect(mocks.releaseDemoDistributionLock).toHaveBeenCalledOnce();
  });
});
