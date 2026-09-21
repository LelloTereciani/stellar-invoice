import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { buildEvidenceSummary } from "../../scripts/testnet-evidence.js";

describe("Testnet receiver evidence", () => {
  it("reports the exact 25 to 20 customer flow and treasury deltas without secrets", () => {
    const issuerPublicKey = Keypair.random().publicKey();
    const treasuryPublicKey = Keypair.random().publicKey();
    const customerPublicKey = Keypair.random().publicKey();
    const summary = buildEvidenceSummary({
      customerAfterDistribution: "25.0000000",
      customerAfterPayment: "20.0000000",
      customerPublicKey,
      distributionHash: "a".repeat(64),
      issuerHasBrltTrustline: false,
      issuerPublicKey,
      paymentHash: "b".repeat(64),
      treasuryAfterDistribution: "75.0000000",
      treasuryAfterPayment: "80.0000000",
      treasuryBeforeDistribution: "100.0000000",
      treasuryPublicKey,
      trustlineHash: "c".repeat(64),
    });

    expect(summary).toEqual({
      balances: {
        customer: { afterDistribution: "25.0000000", afterPayment: "20.0000000", paymentDelta: "-5.0000000" },
        treasury: { afterDistribution: "75.0000000", afterPayment: "80.0000000", distributionDelta: "-25.0000000", paymentDelta: "+5.0000000", beforeDistribution: "100.0000000" },
      },
      customerPublicKey,
      distributionHash: "a".repeat(64),
      issuerHasBrltTrustline: false,
      issuerPublicKey,
      network: "Stellar Testnet",
      paymentHash: "b".repeat(64),
      receiverPublicKey: treasuryPublicKey,
      scope: {
        proves: "Stellar ledger payment semantics",
        doesNotProve: "correlated application, database, migration or deployed-build flow",
      },
      trustlineHash: "c".repeat(64),
      verified: true,
    });
    expect(JSON.stringify(summary)).not.toMatch(/secret|seed/i);
  });

  it("refuses balance snapshots that do not prove both required transitions", () => {
    expect(() => buildEvidenceSummary({
      customerAfterDistribution: "25.0000000",
      customerAfterPayment: "21.0000000",
      customerPublicKey: Keypair.random().publicKey(),
      distributionHash: "a".repeat(64),
      issuerHasBrltTrustline: false,
      issuerPublicKey: Keypair.random().publicKey(),
      paymentHash: "b".repeat(64),
      treasuryAfterDistribution: "75.0000000",
      treasuryAfterPayment: "80.0000000",
      treasuryBeforeDistribution: "100.0000000",
      treasuryPublicKey: Keypair.random().publicKey(),
      trustlineHash: "c".repeat(64),
    })).toThrow("Evidence balances do not prove the receiver payment flow");
  });
});
