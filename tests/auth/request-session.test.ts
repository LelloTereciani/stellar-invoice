import { Keypair } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requireWalletSession } from "../../app/lib/auth/request-session.js";
import { createWalletSession, WALLET_SESSION_COOKIE } from "../../app/lib/auth/wallet-session.js";

afterEach(() => vi.unstubAllEnvs());

describe("wallet session request boundary", () => {
  it("reads the signed session from the HttpOnly cookie", () => {
    const secret = "s".repeat(48);
    const walletPublicKey = Keypair.random().publicKey();
    vi.stubEnv("SESSION_SECRET", secret);
    const token = createWalletSession(walletPublicKey, secret);
    const request = new Request("https://invoice.example.com/api/invoices", {
      headers: { cookie: `another=value; ${WALLET_SESSION_COOKIE}=${token}` },
    });

    expect(requireWalletSession(request).walletPublicKey).toBe(walletPublicKey);
  });

  it("rejects a request without the session cookie", () => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(48));
    expect(() => requireWalletSession(new Request("https://invoice.example.com/api/invoices"))).toThrow("required");
  });
});
