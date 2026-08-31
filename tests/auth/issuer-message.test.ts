import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";

import {
  buildIssuerChallengeMessage,
  hashInvoiceAuthorizationRequest,
  verifyIssuerMessageSignature,
} from "../../app/lib/auth/issuer-message.js";

const invoice = {
  amount: "25.0000000",
  debtorPublicKey: "GAC7JSXMBOC5F2MOE7NT3VC3YLSQRKVS2OGF3PWLOSHX3QWPAG2RZ4OY",
  dueAt: "2030-01-01T00:00:00.000Z",
};

describe("issuer authorization message", () => {
  it("binds a signature to the domain, Testnet, action, issuer, expiry and exact invoice", () => {
    const issuer = Keypair.random();
    const requestHash = hashInvoiceAuthorizationRequest(invoice);
    const message = buildIssuerChallengeMessage({
      expiresAt: "2029-12-31T23:59:00.000Z",
      issuerPublicKey: issuer.publicKey(),
      nonce: "aa".repeat(32),
      requestHash,
    });
    const signature = issuer.sign(Buffer.from(message)).toString("base64");

    expect(message).toContain("domain:stellar-invoice");
    expect(message).toContain("network:testnet");
    expect(message).toContain("action:create-invoice");
    expect(verifyIssuerMessageSignature(message, signature, issuer.publicKey())).toBe(true);
    expect(hashInvoiceAuthorizationRequest({ ...invoice, amount: "26.0000000" })).not.toBe(requestHash);
  });
});
