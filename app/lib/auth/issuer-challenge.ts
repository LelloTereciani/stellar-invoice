import { Keypair } from "@stellar/stellar-sdk";

type Challenge = { expiresAt: number; id: string; value: string; used: boolean };
const challenges = new Map<string, Challenge>();
const TTL_MS = 5 * 60 * 1000;

export function createIssuerChallenge(now = Date.now()) {
  const challenge = { expiresAt: now + TTL_MS, id: crypto.randomUUID(), used: false, value: crypto.randomUUID() };
  challenges.set(challenge.id, challenge);
  return { expiresAt: challenge.expiresAt, id: challenge.id, value: challenge.value };
}

export function verifyIssuerChallenge(id: string, signature: string, issuerPublicKey: string, now = Date.now()) {
  const challenge = challenges.get(id);
  if (!challenge || challenge.used || challenge.expiresAt <= now) throw new Error("Issuer challenge is invalid or expired");
  const verified = Keypair.fromPublicKey(issuerPublicKey).verify(Buffer.from(challenge.value), Buffer.from(signature, "base64"));
  if (!verified) throw new Error("Issuer signature is invalid");
  challenge.used = true;
}
