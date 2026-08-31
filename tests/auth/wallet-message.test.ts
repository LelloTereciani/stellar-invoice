import { Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  buildWalletChallengeMessage,
  verifyWalletChallengeMessage,
} from "../../app/lib/auth/wallet-message.js";

describe("wallet authentication message", () => {
  it("binds the authorization to the expected wallet, origin, action, and network", () => {
    const wallet = Keypair.random();
    const expiresAt = "2026-08-31T18:05:00.000Z";
    const message = buildWalletChallengeMessage({
      expiresAt,
      nonce: "a".repeat(64),
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    });
    const signature = wallet.sign(Buffer.from(message)).toString("base64");

    expect(verifyWalletChallengeMessage({ expiresAt, message, signature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    })).toBe(true);
    expect(message).toContain("network-passphrase:" + Networks.TESTNET);
    expect(verifyWalletChallengeMessage({ expiresAt, message, signature }, {
      origin: "https://evil.example",
      walletPublicKey: wallet.publicKey(),
    })).toBe(false);
    expect(verifyWalletChallengeMessage({ expiresAt, message, signature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: Keypair.random().publicKey(),
    })).toBe(false);
  });
});
