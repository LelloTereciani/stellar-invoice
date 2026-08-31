import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import {
  issuePersistentWalletChallenge,
  verifyAndConsumeWalletChallenge,
  type WalletChallengeRecord,
  type WalletChallengeStore,
} from "../../app/lib/auth/persistent-wallet-challenge.js";

class MemoryStore implements WalletChallengeStore {
  records = new Map<string, WalletChallengeRecord>();

  async insert(record: WalletChallengeRecord) { this.records.set(record.id, record); }
  async consume(id: string, messageHash: string, walletPublicKey: string, now: string) {
    const record = this.records.get(id);
    if (!record || record.messageHash !== messageHash || record.walletPublicKey !== walletPublicKey || record.consumedAt || record.expiresAt <= now) return false;
    record.consumedAt = now;
    return true;
  }
}

describe("persistent wallet challenge", () => {
  it("authenticates the bound wallet once and rejects replay", async () => {
    const wallet = Keypair.random();
    const store = new MemoryStore();
    const challenge = await issuePersistentWalletChallenge(
      wallet.publicKey(),
      "https://invoice.example.com",
      store,
      new Date("2026-08-31T18:00:00.000Z"),
    );
    const signature = wallet.sign(Buffer.from(challenge.message)).toString("base64");

    await expect(verifyAndConsumeWalletChallenge({ ...challenge, signature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    }, store, new Date("2026-08-31T18:01:00.000Z"))).resolves.toBeUndefined();
    await expect(verifyAndConsumeWalletChallenge({ ...challenge, signature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    }, store, new Date("2026-08-31T18:02:00.000Z"))).rejects.toThrow("invalid or expired");
  });

  it("does not consume a challenge signed by another wallet", async () => {
    const wallet = Keypair.random();
    const attacker = Keypair.random();
    const store = new MemoryStore();
    const challenge = await issuePersistentWalletChallenge(wallet.publicKey(), "https://invoice.example.com", store);
    const signature = attacker.sign(Buffer.from(challenge.message)).toString("base64");

    await expect(verifyAndConsumeWalletChallenge({ ...challenge, signature }, {
      origin: "https://invoice.example.com",
      walletPublicKey: wallet.publicKey(),
    }, store)).rejects.toThrow("signature is invalid");
    expect(store.records.get(challenge.id)?.consumedAt).toBeUndefined();
  });
});
