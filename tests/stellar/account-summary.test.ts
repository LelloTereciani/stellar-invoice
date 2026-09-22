import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  AccountSummaryError,
  loadAccountSummary,
} from "../../app/lib/stellar/account-summary.js";

const publicKey = Keypair.random().publicKey();
const issuerPublicKey = Keypair.random().publicKey();
const otherIssuerPublicKey = Keypair.random().publicKey();
const config = {
  assetCode: "BRLT" as const,
  horizonUrl: "https://horizon-testnet.stellar.org",
  issuerPublicKey,
};
const now = () => new Date("2030-01-02T03:04:05.000Z");

function horizonAccount(balances: unknown[]) {
  return {
    account_id: publicKey,
    balances,
    id: publicKey,
    paging_token: "123",
    sequence: "1",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

describe("loadAccountSummary", () => {
  it("selects the native balance and preserves its exact decimal string", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(horizonAccount([
      { asset_type: "native", balance: "12.3456789", buying_liabilities: "0.0000000", selling_liabilities: "0.0000000" },
    ])));

    const summary = await loadAccountSummary(publicKey, config, fetchImpl, now);

    expect(summary).toEqual({
      publicKey,
      xlmBalance: "12.3456789",
      brlt: {
        authorized: null,
        balance: "0.0000000",
        limit: null,
        trustlinePresent: false,
      },
      refreshedAt: "2030-01-02T03:04:05.000Z",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      `https://horizon-testnet.stellar.org/accounts/${publicKey}`,
      { headers: { accept: "application/json" }, cache: "no-store" },
    );
  });

  it("matches BRLT by both exact asset code and configured issuer", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(horizonAccount([
      { asset_type: "native", balance: "5.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "BRLT",
        asset_issuer: otherIssuerPublicKey,
        balance: "999.0000000",
        is_authorized: true,
        limit: "9999.0000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "brlt",
        asset_issuer: issuerPublicKey,
        balance: "888.0000000",
        is_authorized: true,
        limit: "8888.0000000",
      },
      {
        asset_type: "credit_alphanum4",
        asset_code: "BRLT",
        asset_issuer: issuerPublicKey,
        balance: "7.1234567",
        is_authorized: true,
        limit: "1000.0000000",
      },
    ])));

    const summary = await loadAccountSummary(publicKey, config, fetchImpl, now);

    expect(summary.brlt).toEqual({
      authorized: true,
      balance: "7.1234567",
      limit: "1000.0000000",
      trustlinePresent: true,
    });
  });

  it("represents an absent exact-issuer trustline without fabricating authorization or limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(horizonAccount([
      { asset_type: "native", balance: "5.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "BRLT",
        asset_issuer: otherIssuerPublicKey,
        balance: "9.0000000",
        is_authorized: true,
        limit: "100.0000000",
      },
    ])));

    await expect(loadAccountSummary(publicKey, config, fetchImpl, now)).resolves.toMatchObject({
      brlt: {
        authorized: null,
        balance: "0.0000000",
        limit: null,
        trustlinePresent: false,
      },
    });
  });

  it("reports an unauthorized exact-issuer trustline and its exact limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(horizonAccount([
      { asset_type: "native", balance: "5.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "BRLT",
        asset_issuer: issuerPublicKey,
        balance: "0.0000000",
        is_authorized: false,
        limit: "250.5000000",
      },
    ])));

    await expect(loadAccountSummary(publicKey, config, fetchImpl, now)).resolves.toMatchObject({
      brlt: {
        authorized: false,
        balance: "0.0000000",
        limit: "250.5000000",
        trustlinePresent: true,
      },
    });
  });

  it.each([
    ["missing balances", { account_id: publicKey }],
    ["missing native balance", horizonAccount([])],
    ["invalid native balance", horizonAccount([{ asset_type: "native", balance: 12 }])],
    ["malformed matching trustline", horizonAccount([
      { asset_type: "native", balance: "5.0000000" },
      {
        asset_type: "credit_alphanum4",
        asset_code: "BRLT",
        asset_issuer: issuerPublicKey,
        balance: "1.0000000",
        is_authorized: "yes",
        limit: "10.0000000",
      },
    ])],
  ])("rejects a malformed Horizon response: %s", async (_label, body) => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));

    await expect(loadAccountSummary(publicKey, config, fetchImpl, now)).rejects.toMatchObject({
      code: "MALFORMED_HORIZON_RESPONSE",
      message: "Horizon returned an invalid account response",
    });
  });

  it("represents a missing Horizon account with a stable safe error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ detail: "account does not exist" }, 404));

    await expect(loadAccountSummary(publicKey, config, fetchImpl, now)).rejects.toEqual(
      new AccountSummaryError("ACCOUNT_NOT_FOUND", "Stellar account was not found"),
    );
  });

  it.each([
    ["non-success response", vi.fn().mockResolvedValue(jsonResponse({ internal: "provider detail" }, 503))],
    ["network rejection", vi.fn().mockRejectedValue(new Error("socket host and credential detail"))],
  ])("represents an upstream failure safely: %s", async (_label, fetchImpl) => {
    await expect(loadAccountSummary(publicKey, config, fetchImpl, now)).rejects.toMatchObject({
      code: "HORIZON_UNAVAILABLE",
      message: "Horizon is temporarily unavailable",
    });
  });
});
