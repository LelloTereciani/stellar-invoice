export type InvoiceAuthorizationRequest = {
  amount: string;
  debtorPublicKey: string;
  dueAt: string;
};

export function hashInvoiceAuthorizationRequest(request: InvoiceAuthorizationRequest): string {
  // Fixed field order prevents equivalent payloads from producing ambiguous signatures.
  // A ordem fixa dos campos evita que payloads equivalentes produzam assinaturas ambíguas.
  const canonical = JSON.stringify({
    amount: request.amount,
    debtorPublicKey: request.debtorPublicKey,
    dueAt: request.dueAt,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildIssuerChallengeMessage(input: {
  expiresAt: string;
  issuerPublicKey: string;
  nonce: string;
  origin: string;
  requestHash: string;
}): string {
  return [
    "StellarInvoice authorization v2",
    `origin:${new URL(input.origin).origin}`,
    "network:testnet",
    "action:create-invoice",
    `issuer:${input.issuerPublicKey}`,
    `expires-at:${input.expiresAt}`,
    `nonce:${input.nonce}`,
    `request-sha256:${input.requestHash}`,
  ].join("\n");
}

export function verifyIssuerMessageSignature(message: string, signature: string, issuerPublicKey: string): boolean {
  try {
    return Keypair.fromPublicKey(issuerPublicKey).verify(Buffer.from(message), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
import { createHash } from "node:crypto";

import { Keypair } from "@stellar/stellar-sdk";
