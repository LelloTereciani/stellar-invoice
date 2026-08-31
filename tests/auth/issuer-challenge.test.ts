import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { createIssuerChallenge, verifyIssuerChallenge } from "../../app/lib/auth/issuer-challenge.js";

describe("issuer challenge", () => {
  it("accepts one valid issuer signature and rejects reuse", () => {
    const issuer = Keypair.random();
    const challenge = createIssuerChallenge(1_000);
    const signature = issuer.sign(Buffer.from(challenge.value)).toString("base64");
    expect(() => verifyIssuerChallenge(challenge.id, signature, issuer.publicKey(), 1_001)).not.toThrow();
    expect(() => verifyIssuerChallenge(challenge.id, signature, issuer.publicKey(), 1_002)).toThrow("invalid or expired");
  });
});
