import { describe, expect, it } from "vitest";

import {
  clearActiveWalletMode,
  readActiveWalletMode,
  writeActiveWalletMode,
} from "../../app/lib/wallet/active-mode-client.js";

function storage(initial?: string) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set("stellar-invoice-active-wallet-mode", initial);
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("active wallet mode storage", () => {
  it("stores only an explicit demo or Freighter mode", () => {
    const localStorage = storage();
    writeActiveWalletMode("demo", localStorage);
    expect(readActiveWalletMode(localStorage)).toBe("demo");
    writeActiveWalletMode("freighter", localStorage);
    expect(readActiveWalletMode(localStorage)).toBe("freighter");
  });

  it("does not interpret a dormant demo secret or invalid value as active mode", () => {
    expect(readActiveWalletMode(storage("secret-or-invalid"))).toBeUndefined();
  });

  it("clears mode on logout", () => {
    const localStorage = storage("demo");
    clearActiveWalletMode(localStorage);
    expect(readActiveWalletMode(localStorage)).toBeUndefined();
  });
});
