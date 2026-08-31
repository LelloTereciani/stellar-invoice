import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { buildDemoClaimMessage, verifyDemoClaimSignature } from "../../app/lib/demo/claim-message.js";

describe("demo BRLT claim proof", () => {
  it("proves possession of the exact session wallet", () => {
    const wallet = Keypair.random();
    const message = buildDemoClaimMessage(wallet.publicKey(), "6600f188-e1ea-42c7-9563-8d3a49f87630");
    const signature = wallet.sign(Buffer.from(message)).toString("base64");

    expect(verifyDemoClaimSignature(message, signature, wallet.publicKey(), "6600f188-e1ea-42c7-9563-8d3a49f87630")).toBe(true);
    expect(verifyDemoClaimSignature(message, signature, wallet.publicKey(), "7600f188-e1ea-42c7-9563-8d3a49f87630")).toBe(false);
    expect(verifyDemoClaimSignature(message, signature, Keypair.random().publicKey(), "6600f188-e1ea-42c7-9563-8d3a49f87630")).toBe(false);
  });
});
