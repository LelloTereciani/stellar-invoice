import { requireServerEnv } from "../config.js";
import { verifyWalletSession, WALLET_SESSION_COOKIE, type WalletSession } from "./wallet-session.js";

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((entry) => entry.trim().split("="))
    .find(([key]) => key === name)
    ?.slice(1)
    .join("=");
}

export function requireWalletSession(request: Request): WalletSession {
  const token = readCookie(request.headers.get("cookie"), WALLET_SESSION_COOKIE);
  if (!token) throw new Error("Wallet authentication is required");
  return verifyWalletSession(token, requireServerEnv("SESSION_SECRET", process.env));
}
