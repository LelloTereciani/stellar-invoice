import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { createWalletSession, verifyWalletSession } from "../../app/lib/auth/wallet-session.js";

describe("wallet sessions", () => {
  const secret = "s".repeat(48);
  const now = new Date("2026-08-31T18:00:00.000Z");

  it("creates a short-lived signed session for one Testnet wallet", () => {
    const walletPublicKey = Keypair.random().publicKey();
    const token = createWalletSession(walletPublicKey, secret, now);

    expect(verifyWalletSession(token, secret, now)).toMatchObject({
      network: "testnet",
      walletPublicKey,
    });
  });

  it("rejects tampering, another secret, and expired sessions", () => {
    const token = createWalletSession(Keypair.random().publicKey(), secret, now);

    expect(() => verifyWalletSession(token + "x", secret, now)).toThrow("Invalid wallet session");
    expect(() => verifyWalletSession(token, "x".repeat(48), now)).toThrow("Invalid wallet session");
    expect(() => verifyWalletSession(token, secret, new Date("2026-08-31T19:00:01.000Z"))).toThrow("Wallet session expired");
  });
});
