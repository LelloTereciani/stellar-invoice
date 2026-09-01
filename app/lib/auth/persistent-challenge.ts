import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { InvoiceAuthorizationRequest } from "./issuer-message.js";
import {
  buildIssuerChallengeMessage,
  hashInvoiceAuthorizationRequest,
  verifyIssuerMessageSignature,
} from "./issuer-message.js";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type IssuerChallengeRecord = {
  consumedAt?: string;
  expiresAt: string;
  id: string;
  issuerPublicKey: string;
  messageHash: string;
  requestHash: string;
};

export interface IssuerChallengeStore {
  consume(id: string, messageHash: string, now: string): Promise<boolean>;
  insert(record: IssuerChallengeRecord): Promise<void>;
}

export async function issuePersistentIssuerChallenge(
  invoice: InvoiceAuthorizationRequest,
  issuerPublicKey: string,
  origin: string,
  store: IssuerChallengeStore,
  now = new Date(),
): Promise<{ expiresAt: string; id: string; message: string }> {
  const id = randomUUID();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString();
  const requestHash = hashInvoiceAuthorizationRequest(invoice);
  const message = buildIssuerChallengeMessage({
    expiresAt,
    issuerPublicKey,
    nonce: randomBytes(32).toString("hex"),
    origin,
    requestHash,
  });
  await store.insert({ expiresAt, id, issuerPublicKey, messageHash: sha256(message), requestHash });
  return { expiresAt, id, message };
}

export async function verifyAndConsumeIssuerChallenge(
  input: { expiresAt: string; id: string; invoice: InvoiceAuthorizationRequest; message: string; signature: string },
  issuerPublicKey: string,
  origin: string,
  store: IssuerChallengeStore,
  now = new Date(),
): Promise<void> {
  const requestHash = hashInvoiceAuthorizationRequest(input.invoice);
  const lines = input.message.split("\n");
  const structurallyValid =
    lines.length === 8 &&
    lines[0] === "StellarInvoice authorization v2" &&
    lines[1] === `origin:${new URL(origin).origin}` &&
    lines[2] === "network:testnet" &&
    lines[3] === "action:create-invoice" &&
    lines[4] === `issuer:${issuerPublicKey}` &&
    lines[5] === `expires-at:${input.expiresAt}` &&
    /^nonce:[a-f0-9]{64}$/.test(lines[6] ?? "") &&
    lines[7] === `request-sha256:${requestHash}`;
  if (!structurallyValid) throw new Error("Issuer challenge does not match this invoice");
  if (!verifyIssuerMessageSignature(input.message, input.signature, issuerPublicKey)) {
    throw new Error("Issuer signature is invalid");
  }
  if (!(await store.consume(input.id, sha256(input.message), now.toISOString()))) {
    throw new Error("Issuer challenge is invalid or expired");
  }
}
