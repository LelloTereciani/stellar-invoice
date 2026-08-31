import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { assertDemoDistributionReserve } from "../../app/lib/demo/provisioning.js";

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
});
