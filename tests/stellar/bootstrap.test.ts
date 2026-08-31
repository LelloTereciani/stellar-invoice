import { describe, expect, it } from "vitest";

import { getOrCreateDemoWallets, publicBootstrapSummary } from "../../scripts/bootstrap-issuer.js";

describe("demo issuer bootstrap", () => {
  it("creates issuer and distribution wallets without putting their secrets in the public result", () => {
    const wallets = getOrCreateDemoWallets();
    const summary = publicBootstrapSummary(wallets, "test-transaction");

    expect(wallets.issuerSecret).toMatch(/^S/);
    expect(wallets.distributionSecret).toMatch(/^S/);
    expect(summary).toEqual({
      issuerPublicKey: expect.stringMatching(/^G/),
      distributionPublicKey: expect.stringMatching(/^G/),
      transactionHash: "test-transaction",
    });
    expect(JSON.stringify(summary)).not.toContain(wallets.issuerSecret);
    expect(JSON.stringify(summary)).not.toContain(wallets.distributionSecret);
  });

  it("reuses a valid persisted Testnet wallet pair", () => {
    const created = getOrCreateDemoWallets();
    const wallets = getOrCreateDemoWallets({
      issuerSecret: created.issuerSecret,
      distributionSecret: created.distributionSecret,
    });

    expect(wallets).toEqual(created);
  });
});
