"use client";

export type ActiveWalletMode = "demo" | "freighter";

export const ACTIVE_WALLET_MODE_STORAGE_KEY = "stellar-invoice-active-wallet-mode";

type ModeStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function browserStorage(): ModeStorage {
  return window.localStorage;
}

export function readActiveWalletMode(storage: ModeStorage = browserStorage()): ActiveWalletMode | undefined {
  const value = storage.getItem(ACTIVE_WALLET_MODE_STORAGE_KEY);
  return value === "demo" || value === "freighter" ? value : undefined;
}

export function writeActiveWalletMode(mode: ActiveWalletMode, storage: ModeStorage = browserStorage()): void {
  storage.setItem(ACTIVE_WALLET_MODE_STORAGE_KEY, mode);
}

export function clearActiveWalletMode(storage: ModeStorage = browserStorage()): void {
  storage.removeItem(ACTIVE_WALLET_MODE_STORAGE_KEY);
}
