import { Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  buildWalletChallengeMessage,
  verifyWalletChallengeMessage,
  verifyWalletChallengeSignature,
} from "../../app/lib/auth/wallet-message.js";

function withNonCanonicalPadBits(canonicalBase64: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lastDataCharacter = canonicalBase64.length - 3;
  const canonicalIndex = alphabet.indexOf(canonicalBase64[lastDataCharacter] ?? "");
  return canonicalBase64.slice(0, lastDataCharacter)
    + alphabet[canonicalIndex + 1]
    + canonicalBase64.slice(lastDataCharacter + 1);
}

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
    const signature = wallet.signMessage(message).toString("base64");

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

  it("rejects a raw Ed25519 signature that does not use the SEP-53 envelope", () => {
    const wallet = Keypair.random();
    const expiresAt = "2026-08-31T18:05:00.000Z";
    const message = buildWalletChallengeMessage({
      expiresAt,
      nonce: "b".repeat(64),
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    });
    const rawSignature = wallet.sign(Buffer.from(message)).toString("base64");

    expect(verifyWalletChallengeMessage({ expiresAt, message, signature: rawSignature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    })).toBe(false);
  });

  it("accepts only canonical padded standard Base64 containing a 64-byte signature", () => {
    const wallet = Keypair.random();
    const message = "canonical SEP-53 signature transport";
    const signature = wallet.signMessage(message).toString("base64");
    const nonCanonicalPadBits = withNonCanonicalPadBits(signature);

    expect(signature).toHaveLength(88);
    expect(signature.endsWith("==")).toBe(true);
    expect(Buffer.from(nonCanonicalPadBits, "base64")).toEqual(Buffer.from(signature, "base64"));
    expect(verifyWalletChallengeSignature(wallet.publicKey(), message, signature)).toBe(true);

    const invalidEncodings = [
      ` ${signature}`,
      `!${signature.slice(1)}`,
      signature.slice(0, -2),
      `${signature}=`,
      `-${signature.slice(1)}`,
      Buffer.alloc(63, 1).toString("base64"),
      nonCanonicalPadBits,
    ];
    for (const invalidSignature of invalidEncodings) {
      expect(verifyWalletChallengeSignature(wallet.publicKey(), message, invalidSignature)).toBe(false);
    }
  });
});
