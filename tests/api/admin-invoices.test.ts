import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertTrustedOrigin: vi.fn(),
  createIssuerChallengeStore: vi.fn(() => ({ store: "issuer-challenges" })),
  issuePersistentIssuerChallenge: vi.fn(),
  loadAccountSummary: vi.fn(),
  loadStellarConfig: vi.fn(),
  persistInvoice: vi.fn(),
  requireServerEnv: vi.fn(),
  verifyAndConsumeIssuerChallenge: vi.fn(),
}));

vi.mock("../../app/lib/auth/issuer-challenge-store.js", () => ({
  createIssuerChallengeStore: mocks.createIssuerChallengeStore,
}));
vi.mock("../../app/lib/auth/persistent-challenge.js", () => ({
  issuePersistentIssuerChallenge: mocks.issuePersistentIssuerChallenge,
  verifyAndConsumeIssuerChallenge: mocks.verifyAndConsumeIssuerChallenge,
}));
vi.mock("../../app/lib/auth/request-origin.js", () => ({ assertTrustedOrigin: mocks.assertTrustedOrigin }));
vi.mock("../../app/lib/config.js", () => ({
  loadStellarConfig: mocks.loadStellarConfig,
  requireServerEnv: mocks.requireServerEnv,
}));
vi.mock("../../app/lib/invoices/service.js", () => ({ persistInvoice: mocks.persistInvoice }));
vi.mock("../../app/lib/stellar/account-summary.js", () => ({ loadAccountSummary: mocks.loadAccountSummary }));

import { POST as createChallenge } from "../../app/api/admin/challenge/route.js";
import { POST as createInvoice } from "../../app/api/admin/invoices/route.js";

const origin = "https://invoice.example.com";
const debtorPublicKey = "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY";
const issuerPublicKey = "GADIFANV34ORRVIANOSDARFXSYFTJOBREOSOL4FPLG56YKMP72RVK2SU";
const receiverPublicKey = "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73";
const invoice = { amount: "5.0000000", debtorPublicKey, dueAt: "2030-01-01T00:00:00.000Z", receiverPublicKey };

function request(path: string, body: Record<string, unknown>) {
  return new Request(`${origin}${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireServerEnv.mockReturnValue(origin);
  mocks.loadStellarConfig.mockReturnValue({ assetCode: "BRLT", horizonUrl: "https://horizon-testnet.stellar.org", issuerPublicKey, receiverPublicKey });
  mocks.loadAccountSummary.mockResolvedValue({ brlt: { authorized: true, trustlinePresent: true } });
  mocks.issuePersistentIssuerChallenge.mockResolvedValue({ id: "challenge-id" });
  mocks.verifyAndConsumeIssuerChallenge.mockResolvedValue(undefined);
  mocks.persistInvoice.mockResolvedValue({ id: "invoice-id", status: "pending" });
});

describe("admin invoice APIs", () => {
  it("validates and signs the receiver supplied for this real invoice", async () => {
    const response = await createChallenge(request("/api/admin/challenge", invoice));

    expect(response.status).toBe(200);
    expect(mocks.loadAccountSummary).toHaveBeenCalledWith(receiverPublicKey, expect.objectContaining({ issuerPublicKey }));
    expect(mocks.issuePersistentIssuerChallenge).toHaveBeenCalledWith(invoice, issuerPublicKey, origin, expect.anything());
    await expect(response.json()).resolves.toEqual({ id: "challenge-id" });
  });

  it("rejects a receiver without an authorized exact-issuer BRLT trustline", async () => {
    mocks.loadAccountSummary.mockResolvedValueOnce({ brlt: { authorized: false, trustlinePresent: true } });

    const response = await createChallenge(request("/api/admin/challenge", invoice));

    expect(response.status).toBe(400);
    expect(mocks.issuePersistentIssuerChallenge).not.toHaveBeenCalled();
  });

  it("persists a signed invoice with the configured payment receiver", async () => {
    const response = await createInvoice(request("/api/admin/invoices", {
      ...invoice,
      challenge: "challenge-message",
      challengeExpiresAt: "2030-01-01T00:05:00.000Z",
      challengeId: "challenge-id",
      signedChallenge: "signed-challenge",
    }));

    expect(response.status).toBe(201);
    expect(mocks.verifyAndConsumeIssuerChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ invoice }),
      issuerPublicKey,
      origin,
      expect.anything(),
    );
    expect(mocks.persistInvoice).toHaveBeenCalledWith(
      { amount: invoice.amount, debtorPublicKey, dueAt: invoice.dueAt },
      issuerPublicKey,
      receiverPublicKey,
    );
  });
});
