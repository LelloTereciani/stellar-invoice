import { describe, expect, it } from "vitest";

import { loadStellarConfig, requireServerEnv } from "../app/lib/config.js";

describe("loadStellarConfig", () => {
  it("rejects a configuration that points to a network other than Stellar Testnet", () => {
    expect(() =>
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      }),
    ).toThrow("StellarInvoice accepts only Stellar Testnet");
  });

  it("rejects a missing issuer public key instead of building an unusable asset identity", () => {
    expect(() =>
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      }),
    ).toThrow("Missing required environment variable: NEXT_PUBLIC_STELLAR_ISSUER");
  });

  it("returns a Testnet-only BRLT identity when its public configuration is valid", () => {
    expect(
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      }),
    ).toMatchObject({
      assetCode: "BRLT",
      network: "testnet",
      issuerPublicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });
  });
});

describe("requireServerEnv", () => {
  it("rejects a missing administrative secret instead of silently using an empty value", () => {
    expect(() => requireServerEnv("STELLAR_ISSUER_SECRET", {})).toThrow(
      "Missing required environment variable: STELLAR_ISSUER_SECRET",
    );
  });
});
