import { describe, expect, it } from "vitest";

import { stellarExpertTransactionUrl } from "../../app/components/ExplorerLink.js";

describe("Stellar Expert Testnet links", () => {
  it("accepts only a canonical hexadecimal transaction hash", () => {
    const hash = "a".repeat(64);
    expect(stellarExpertTransactionUrl(hash)).toBe(`https://stellar.expert/explorer/testnet/tx/${hash}`);
    expect(() => stellarExpertTransactionUrl("javascript:alert(1)")).toThrow("Invalid Stellar transaction hash");
    expect(() => stellarExpertTransactionUrl("A".repeat(64))).toThrow("Invalid Stellar transaction hash");
  });
});
