import { Account, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { assertDemoDistributionReserve, demoDistributionExpired } from "../../app/lib/demo/provisioning.js";

describe("demo distribution reserve", () => {
  it("keeps at least 100 BRLT after the fixed 25 BRLT allowance", () => {
    const issuer = Keypair.random().publicKey();
    expect(() => assertDemoDistributionReserve([
      { asset_code: "BRLT", asset_issuer: issuer, balance: "125.0000000" },
    ], issuer)).not.toThrow();
    expect(() => assertDemoDistributionReserve([
      { asset_code: "BRLT", asset_issuer: issuer, balance: "124.9999999" },
    ], issuer)).toThrow("reserve");
  });

  it("does not count another issuer or malformed balance", () => {
    const issuer = Keypair.random().publicKey();
    expect(() => assertDemoDistributionReserve([
      { asset_code: "BRLT", asset_issuer: Keypair.random().publicKey(), balance: "999.0000000" },
    ], issuer)).toThrow("reserve");
    expect(() => assertDemoDistributionReserve([
      { asset_code: "BRLT", asset_issuer: issuer, balance: "Infinity" },
    ], issuer)).toThrow("balance");
  });

  it("detects a prepared distribution whose Stellar time bound elapsed", () => {
    const source = Keypair.random().publicKey();
    const expired = new TransactionBuilder(new Account(source, "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .setTimebounds(0, 100)
      .build()
      .toXDR();
    const active = new TransactionBuilder(new Account(source, "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .setTimebounds(0, 300)
      .build()
      .toXDR();

    expect(demoDistributionExpired(expired, new Date(200_000))).toBe(true);
    expect(demoDistributionExpired(active, new Date(200_000))).toBe(false);
  });
});
