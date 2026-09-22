"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  authenticateFreighterWallet,
  createTrustlineWithFreighter,
  payInvoiceWithFreighter,
} from "../lib/stellar/freighter-client.js";
import type { PendingInvoice } from "../lib/stellar/transactions.js";
import { authenticateDemoWallet, payInvoiceWithDemoWallet, readDemoWallet } from "../lib/stellar/demo-wallet-client.js";
import {
  clearActiveWalletMode,
  readActiveWalletMode,
  writeActiveWalletMode,
} from "../lib/wallet/active-mode-client.js";
import {
  initialWalletSessionState,
  reduceWalletSession,
} from "../lib/wallet/session-state.js";

export type WalletFlowStatus =
  | "idle"
  | "connecting"
  | "authenticated"
  | "preparing"
  | "reviewing"
  | "awaiting-signature"
  | "submitting"
  | "verifying"
  | "confirmed"
  | "error";

export function useFreighter() {
  const [sessionState, dispatchSession] = useReducer(reduceWalletSession, initialWalletSessionState);
  const [status, setStatus] = useState<WalletFlowStatus>("idle");
  const [error, setError] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<string>();
  const [paymentHash, setPaymentHash] = useState<string>();
  const connectInFlight = useRef<Promise<string | undefined> | undefined>(undefined);
  const attempt = useRef(0);
  const walletPublicKey = sessionState.active?.publicKey;
  const walletKind = sessionState.active?.mode;

  const timestamp = () => new Date().toISOString();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/auth/session");
        const payload = (await response.json()) as { authenticated?: boolean; publicKey?: string };
        const mode = readActiveWalletMode();
        if (!cancelled && response.ok && payload.authenticated && payload.publicKey && mode) {
          dispatchSession({ at: timestamp(), mode, publicKey: payload.publicKey, type: "session-restored" });
          setStatus("authenticated");
        } else if (!cancelled && (!payload.authenticated || !mode)) {
          clearActiveWalletMode();
        }
      } catch {
        if (!cancelled) setError("Não foi possível restaurar a sessão da carteira.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const connect = useCallback(async () => {
    if (connectInFlight.current) return connectInFlight.current;
    const currentAttempt = ++attempt.current;
    const pending = (async () => {
      try {
        setError(undefined);
        setStatus("connecting");
        const address = await authenticateFreighterWallet(undefined, (detectedAddress) => {
          dispatchSession({ at: timestamp(), publicKey: detectedAddress, type: "freighter-detected" });
          dispatchSession({ at: timestamp(), type: "freighter-authentication-started" });
        });
        if (attempt.current !== currentAttempt) return undefined;
        writeActiveWalletMode("freighter");
        dispatchSession({ at: timestamp(), publicKey: address, type: "freighter-authenticated" });
        setStatus("authenticated");
        return address;
      } catch (cause: unknown) {
        if (attempt.current !== currentAttempt) return undefined;
        const detail = cause instanceof Error ? cause.message : "Wallet connection failed";
        const rejected = /denied|refused|rejeit/i.test(detail);
        const message = rejected
          ? "A assinatura foi recusada. A sessão anterior continua ativa."
          : "Não foi possível ativar a Freighter. A sessão anterior continua ativa.";
        dispatchSession({ at: timestamp(), detail, message, type: rejected ? "freighter-rejected" : "freighter-failed" });
        setError(message);
        setStatus("error");
        return undefined;
      } finally {
        if (attempt.current === currentAttempt) connectInFlight.current = undefined;
      }
    })();
    connectInFlight.current = pending;
    return pending;
  }, []);

  const connectDemo = useCallback(async () => {
    try {
      setError(undefined);
      setStatus("connecting");
      const wallet = readDemoWallet();
      if (!wallet) throw new Error("No demo wallet exists in this browser");
      const address = await authenticateDemoWallet(wallet);
      writeActiveWalletMode("demo");
      dispatchSession({ at: timestamp(), publicKey: address, type: "demo-authenticated" });
      setStatus("authenticated");
      return address;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Demo wallet connection failed");
      setStatus("error");
      return undefined;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Wallet logout failed");
      ++attempt.current;
      connectInFlight.current = undefined;
      clearActiveWalletMode();
      dispatchSession({ at: timestamp(), type: "logged-out" });
      setError(undefined);
      setStatus("idle");
      setPaymentHash(undefined);
      setTransactionHash(undefined);
      return true;
    } catch {
      setError("Não foi possível encerrar a sessão da carteira.");
      setStatus("error");
      return false;
    }
  }, []);

  const createTrustline = useCallback(async () => {
    if (!walletPublicKey) throw new Error("Connect the wallet first");
    try {
      setError(undefined);
      setStatus("preparing");
      const response = await fetch("/api/wallet/trustline");
      const payload = (await response.json()) as { assetIssuer?: string; error?: string; xdr?: string };
      if (!response.ok || !payload.assetIssuer || !payload.xdr) throw new Error(payload.error || "Trustline could not be prepared");
      const hash = await createTrustlineWithFreighter({
        issuerPublicKey: payload.assetIssuer,
        onStage: setStatus,
        walletPublicKey,
        xdr: payload.xdr,
      });
      setTransactionHash(hash);
      setStatus("confirmed");
      return hash;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Trustline failed");
      setStatus("error");
      return undefined;
    }
  }, [walletPublicKey]);

  const payInvoice = useCallback(async (invoice: PendingInvoice & { id: string }) => {
    if (!walletPublicKey) throw new Error("Connect the wallet first");
    try {
      setError(undefined);
      let hash = paymentHash;
      if (!hash) {
        setStatus("preparing");
        const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/payment`);
        const payload = (await response.json()) as { error?: string; preparedTransactionHash?: string; transactionHash?: string; xdr?: string };
        if (!response.ok) throw new Error(payload.error || "Payment could not be prepared");
        if (payload.transactionHash) {
          hash = payload.transactionHash;
        } else {
          if (!payload.xdr || !payload.preparedTransactionHash) throw new Error("Payment preparation was incomplete");
          const localWallet = walletKind === "demo" ? readDemoWallet() : undefined;
          if (walletKind === "demo" && (!localWallet || localWallet.publicKey() !== walletPublicKey)) {
            throw new Error("The local demo wallet changed");
          }
          hash = localWallet
            ? await payInvoiceWithDemoWallet({ invoice, onStage: setStatus, wallet: localWallet, xdr: payload.xdr })
            : await payInvoiceWithFreighter({ invoice, onStage: setStatus, walletPublicKey, xdr: payload.xdr });
          if (hash !== payload.preparedTransactionHash) throw new Error("Submitted payment hash differs from the prepared transaction");
        }
        setPaymentHash(hash);
      }
      setTransactionHash(hash);
      setStatus("verifying");
      const verificationResponse = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/verify`, {
        body: JSON.stringify({ transactionHash: hash }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const verification = (await verificationResponse.json()) as { error?: string; status?: string };
      if (!verificationResponse.ok || verification.status !== "confirmed") {
        throw new Error(verification.error || "Payment was submitted but not confirmed");
      }
      setStatus("confirmed");
      return hash;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Payment failed");
      setStatus("error");
      return undefined;
    }
  }, [paymentHash, walletKind, walletPublicKey]);

  return {
    connect,
    connectDemo,
    createTrustline,
    error,
    logout,
    payInvoice,
    sessionState,
    status,
    transactionHash,
    walletKind,
    walletPublicKey,
  };
}
