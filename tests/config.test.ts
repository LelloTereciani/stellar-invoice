import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { loadDemoConfig, loadDemoDistributionConfig, loadStellarConfig, requireServerEnv } from "../app/lib/config.js";

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

  it("rejects an invalid issuer public key instead of accepting a malformed asset identity", () => {
    expect(() =>
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "not-a-stellar-public-key",
        STELLAR_PAYMENT_RECEIVER: "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73",
      }),
    ).toThrow("NEXT_PUBLIC_STELLAR_ISSUER must be a valid Stellar public key");
  });

  it("rejects a missing payment receiver instead of building an invoice without a destination", () => {
    expect(() =>
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      }),
    ).toThrow("Missing required environment variable: STELLAR_PAYMENT_RECEIVER");
  });

  it("rejects an invalid payment receiver instead of accepting a malformed destination", () => {
    expect(() =>
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        STELLAR_PAYMENT_RECEIVER: "not-a-stellar-public-key",
      }),
    ).toThrow("STELLAR_PAYMENT_RECEIVER must be a valid Stellar public key");
  });

  it("returns a Testnet-only BRLT identity when its public configuration is valid", () => {
    expect(
      loadStellarConfig({
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        STELLAR_PAYMENT_RECEIVER: "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73",
      }),
    ).toMatchObject({
      assetCode: "BRLT",
      network: "testnet",
      issuerPublicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      receiverPublicKey: "GAHRN27DIWCP7J3OFLE4NY7GF2FJUAWQ2MJJZQYS6JCP2QBPXBW2IB73",
    });
  });

  it("rejects using the asset issuer as the payment receiver", () => {
    const issuerPublicKey = Keypair.random().publicKey();

    expect(() => loadStellarConfig({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_ISSUER: issuerPublicKey,
      STELLAR_PAYMENT_RECEIVER: issuerPublicKey,
    })).toThrow("Stellar issuer and payment receiver must be different accounts");
  });
});

describe("requireServerEnv", () => {
  it("rejects a missing administrative secret instead of silently using an empty value", () => {
    expect(() => requireServerEnv("STELLAR_ISSUER_SECRET", {})).toThrow(
      "Missing required environment variable: STELLAR_ISSUER_SECRET",
    );
  });
});

describe("loadDemoConfig", () => {
  it("rejects a disabled demo mode instead of making test funding public by default", () => {
    expect(() =>
      loadDemoConfig({
        DEMO_MODE: "disabled",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      }),
    ).toThrow("Demo mode is disabled");
  });

  it("allows demo provisioning only when it is explicitly enabled on Testnet", () => {
    expect(
      loadDemoConfig({
        DEMO_MODE: "enabled",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      }),
    ).toEqual({ enabled: true, network: "testnet" });
  });
});

describe("loadDemoDistributionConfig", () => {
  it("rejects an invalid distribution secret instead of deriving a malformed distributor public key", () => {
    expect(() =>
      loadDemoDistributionConfig({
        DEMO_MODE: "enabled",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        STELLAR_DISTRIBUTION_SECRET: "not-a-stellar-secret-key",
      }),
    ).toThrow("Demo distribution configuration contains an invalid Stellar key");
  });

  it("rejects a payment receiver that differs from the demo distributor", () => {
    const distributor = Keypair.random();

    expect(() =>
      loadDemoDistributionConfig({
        DEMO_MODE: "enabled",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        STELLAR_DISTRIBUTION_SECRET: distributor.secret(),
        STELLAR_PAYMENT_RECEIVER: Keypair.random().publicKey(),
      }),
    ).toThrow("Demo payment receiver must match the distribution account");
  });

  it("rejects using the issuer as the demo distributor and receiver", () => {
    const issuerAndDistributor = Keypair.random();

    expect(() => loadDemoDistributionConfig({
      DEMO_MODE: "enabled",
      NEXT_PUBLIC_STELLAR_ISSUER: issuerAndDistributor.publicKey(),
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      STELLAR_DISTRIBUTION_SECRET: issuerAndDistributor.secret(),
      STELLAR_PAYMENT_RECEIVER: issuerAndDistributor.publicKey(),
    })).toThrow("Demo issuer and distribution account must be different accounts");
  });

  it("returns the matching receiver derived from the demo distribution account", () => {
    const distributor = Keypair.random();
    const distributionPublicKey = distributor.publicKey();

    expect(
      loadDemoDistributionConfig({
        DEMO_MODE: "enabled",
        NEXT_PUBLIC_STELLAR_ISSUER: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
        NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
        STELLAR_DISTRIBUTION_SECRET: distributor.secret(),
        STELLAR_PAYMENT_RECEIVER: distributionPublicKey,
      }),
    ).toMatchObject({ distributionPublicKey, receiverPublicKey: distributionPublicKey });
  });
});
