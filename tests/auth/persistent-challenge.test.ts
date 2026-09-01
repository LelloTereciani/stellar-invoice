import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import {
  issuePersistentIssuerChallenge,
  verifyAndConsumeIssuerChallenge,
  type IssuerChallengeRecord,
  type IssuerChallengeStore,
} from "../../app/lib/auth/persistent-challenge.js";

const invoice = {
  amount: "25.0000000",
  debtorPublicKey: "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY",
  dueAt: "2030-01-01T00:00:00.000Z",
};

class MemoryStore implements IssuerChallengeStore {
  records = new Map<string, IssuerChallengeRecord>();

  async insert(record: IssuerChallengeRecord) { this.records.set(record.id, record); }
  async consume(id: string, messageHash: string, now: string) {
    const record = this.records.get(id);
    if (!record || record.messageHash !== messageHash || record.consumedAt || record.expiresAt <= now) return false;
    record.consumedAt = now;
    return true;
  }
}

describe("persistent issuer challenge", () => {
  it("authorizes the exact invoice once and rejects replay", async () => {
    const issuer = Keypair.random();
    const store = new MemoryStore();
    const challenge = await issuePersistentIssuerChallenge(invoice, issuer.publicKey(), "https://invoice.example.com", store, new Date("2029-01-01T00:00:00.000Z"));
    const signature = issuer.sign(Buffer.from(challenge.message)).toString("base64");

    await expect(verifyAndConsumeIssuerChallenge({ ...challenge, invoice, signature }, issuer.publicKey(), "https://invoice.example.com", store, new Date("2029-01-01T00:01:00.000Z"))).resolves.toBeUndefined();
    await expect(verifyAndConsumeIssuerChallenge({ ...challenge, invoice, signature }, issuer.publicKey(), "https://invoice.example.com", store, new Date("2029-01-01T00:02:00.000Z"))).rejects.toThrow("invalid or expired");
  });

  it("does not authorize a modified invoice", async () => {
    const issuer = Keypair.random();
    const store = new MemoryStore();
    const challenge = await issuePersistentIssuerChallenge(invoice, issuer.publicKey(), "https://invoice.example.com", store, new Date("2029-01-01T00:00:00.000Z"));
    const signature = issuer.sign(Buffer.from(challenge.message)).toString("base64");

    await expect(verifyAndConsumeIssuerChallenge({ ...challenge, invoice: { ...invoice, amount: "26.0000000" }, signature }, issuer.publicKey(), "https://invoice.example.com", store, new Date("2029-01-01T00:01:00.000Z"))).rejects.toThrow("does not match");
  });
});
