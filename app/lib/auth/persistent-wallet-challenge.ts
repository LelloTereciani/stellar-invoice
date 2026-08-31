import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  buildWalletChallengeMessage,
  verifyWalletChallengeMessage,
  type WalletChallenge,
  type WalletChallengeContext,
} from "./wallet-message.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type WalletChallengeRecord = {
  consumedAt?: string;
  expiresAt: string;
  id: string;
  messageHash: string;
  walletPublicKey: string;
};

export interface WalletChallengeStore {
  consume(id: string, messageHash: string, walletPublicKey: string, now: string): Promise<boolean>;
  insert(record: WalletChallengeRecord): Promise<void>;
}

export async function issuePersistentWalletChallenge(
  walletPublicKey: string,
  origin: string,
  store: WalletChallengeStore,
  now = new Date(),
): Promise<{ expiresAt: string; id: string; message: string }> {
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const message = buildWalletChallengeMessage({
    expiresAt,
    nonce: randomBytes(32).toString("hex"),
    origin,
    walletPublicKey,
  });
  const record = {
    expiresAt,
    id: randomUUID(),
    messageHash: sha256(message),
    walletPublicKey,
  };
  await store.insert(record);
  return { expiresAt, id: record.id, message };
}

export async function verifyAndConsumeWalletChallenge(
  challenge: WalletChallenge & { id: string },
  context: WalletChallengeContext,
  store: WalletChallengeStore,
  now = new Date(),
): Promise<void> {
  if (!verifyWalletChallengeMessage(challenge, context)) {
    throw new Error("Wallet challenge signature is invalid");
  }
  if (!(await store.consume(challenge.id, sha256(challenge.message), context.walletPublicKey, now.toISOString()))) {
    throw new Error("Wallet challenge is invalid or expired");
  }
}
