import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadAccountSummary: vi.fn(),
  loadStellarConfig: vi.fn(),
  requireWalletSession: vi.fn(),
}));

vi.mock("../../app/lib/auth/request-session.js", () => ({
  requireWalletSession: mocks.requireWalletSession,
}));
vi.mock("../../app/lib/config.js", () => ({
  loadStellarConfig: mocks.loadStellarConfig,
}));
vi.mock("../../app/lib/stellar/account-summary.js", () => ({
  loadAccountSummary: mocks.loadAccountSummary,
}));

import { GET } from "../../app/api/wallet/status/route.js";

const walletPublicKey = Keypair.random().publicKey();
const attackerPublicKey = Keypair.random().publicKey();
const issuerPublicKey = Keypair.random().publicKey();
const config = {
  assetCode: "BRLT" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  issuerPublicKey,
  network: "testnet" as const,
  networkPassphrase: "Test SDF Network ; September 2015",
  receiverPublicKey: Keypair.random().publicKey(),
};
const summary = {
  publicKey: walletPublicKey,
  xlmBalance: "12.3456789",
  brlt: {
    authorized: true,
    balance: "7.0000000",
    limit: "1000.0000000",
    trustlinePresent: true,
  },
  refreshedAt: "2030-01-02T03:04:05.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireWalletSession.mockReturnValue({ network: "testnet", walletPublicKey });
  mocks.loadStellarConfig.mockReturnValue(config);
  mocks.loadAccountSummary.mockResolvedValue(summary);
});

describe("wallet status API", () => {
  it("rejects requests without a valid wallet session", async () => {
    mocks.requireWalletSession.mockImplementationOnce(() => {
      throw new Error("Invalid wallet session");
    });

    const response = await GET(new Request("https://invoice.example.com/api/wallet/status"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "WALLET_AUTHENTICATION_REQUIRED",
        message: "Wallet authentication is required",
      },
    });
    expect(mocks.loadStellarConfig).not.toHaveBeenCalled();
    expect(mocks.loadAccountSummary).not.toHaveBeenCalled();
  });

  it("does not misreport an internal session inspection failure as logged out", async () => {
    mocks.requireWalletSession.mockImplementationOnce(() => {
      throw new Error("Missing required environment variable: SESSION_SECRET");
    });

    const response = await GET(new Request("https://invoice.example.com/api/wallet/status"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "WALLET_STATUS_INTERNAL_ERROR",
        message: "Wallet status could not be inspected",
      },
    });
    expect(JSON.stringify(body)).not.toContain("SESSION_SECRET");
    expect(mocks.loadStellarConfig).not.toHaveBeenCalled();
    expect(mocks.loadAccountSummary).not.toHaveBeenCalled();
  });

  it("loads Testnet status only for the address derived from the session", async () => {
    const response = await GET(new Request("https://invoice.example.com/api/wallet/status"));

    expect(response.status).toBe(200);
    expect(mocks.loadStellarConfig).toHaveBeenCalledWith(process.env);
    expect(mocks.loadAccountSummary).toHaveBeenCalledWith(walletPublicKey, config);
    await expect(response.json()).resolves.toEqual({
      assetCode: "BRLT",
      assetIssuer: issuerPublicKey,
      network: "testnet",
      ...summary,
    });
  });

  it("does not let an arbitrary address query parameter redirect the account lookup", async () => {
    const response = await GET(new Request(
      `https://invoice.example.com/api/wallet/status?address=${attackerPublicKey}`,
    ));

    expect(response.status).toBe(200);
    expect(mocks.loadAccountSummary).toHaveBeenCalledTimes(1);
    expect(mocks.loadAccountSummary).toHaveBeenCalledWith(walletPublicKey, config);
    expect(mocks.loadAccountSummary).not.toHaveBeenCalledWith(attackerPublicKey, expect.anything());
  });

  it("returns a recoverable degraded response without leaking Horizon details or clearing the session", async () => {
    mocks.loadAccountSummary.mockRejectedValueOnce(new Error(
      "https://horizon.internal/accounts/private returned provider credentials",
    ));

    const response = await GET(new Request("https://invoice.example.com/api/wallet/status"));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      degraded: true,
      error: {
        code: "WALLET_STATUS_UNAVAILABLE",
        message: "Wallet status is temporarily unavailable",
      },
    });
    expect(JSON.stringify(body)).not.toContain("horizon.internal");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.requireWalletSession).toHaveBeenCalledTimes(1);
  });
});
