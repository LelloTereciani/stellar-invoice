import { createHmac, timingSafeEqual } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";

const SESSION_TTL_SECONDS = 60 * 60;

export const WALLET_SESSION_COOKIE = "stellar_invoice_session";

export type WalletSession = {
  expiresAt: number;
  issuedAt: number;
  network: "testnet";
  walletPublicKey: string;
};

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function assertSecret(secret: string): void {
  if (secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
}

export function createWalletSession(walletPublicKey: string, secret: string, now = new Date()): string {
  assertSecret(secret);
  Keypair.fromPublicKey(walletPublicKey);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const session: WalletSession = {
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
    issuedAt,
    network: "testnet",
    walletPublicKey,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyWalletSession(token: string, secret: string, now = new Date()): WalletSession {
  assertSecret(secret);
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) throw new Error("Invalid wallet session");
  const expectedSignature = sign(payload, secret);
  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Invalid wallet session");
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as WalletSession;
    Keypair.fromPublicKey(session.walletPublicKey);
    if (session.network !== "testnet" || !Number.isInteger(session.issuedAt) || !Number.isInteger(session.expiresAt)) {
      throw new Error("Invalid wallet session");
    }
    if (session.expiresAt - session.issuedAt !== SESSION_TTL_SECONDS) throw new Error("Invalid wallet session");
    if (session.expiresAt <= Math.floor(now.getTime() / 1000)) throw new Error("Wallet session expired");
    return session;
  } catch (error) {
    if (error instanceof Error && error.message === "Wallet session expired") throw error;
    throw new Error("Invalid wallet session");
  }
}
