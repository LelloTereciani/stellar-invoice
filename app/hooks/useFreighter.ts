"use client";

import { useCallback, useEffect, useState } from "react";

import {
  authenticateFreighterWallet,
  createTrustlineWithFreighter,
  payInvoiceWithFreighter,
} from "../lib/stellar/freighter-client.js";
import type { PendingInvoice } from "../lib/stellar/transactions.js";
import { authenticateDemoWallet, payInvoiceWithDemoWallet, readDemoWallet } from "../lib/stellar/demo-wallet-client.js";

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
  const [walletPublicKey, setWalletPublicKey] = useState<string>();
  const [status, setStatus] = useState<WalletFlowStatus>("idle");
  const [error, setError] = useState<string>();
  const [transactionHash, setTransactionHash] = useState<string>();
  const [walletKind, setWalletKind] = useState<"demo" | "freighter">();

  useEffect(() => {
    const demoWallet = readDemoWallet();
    if (demoWallet) {
      setWalletPublicKey(demoWallet.publicKey());
      setWalletKind("demo");
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(undefined);
      setStatus("connecting");
      const address = await authenticateFreighterWallet();
      setWalletPublicKey(address);
      setWalletKind("freighter");
      setStatus("authenticated");
      return address;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Wallet connection failed");
      setStatus("error");
      return undefined;
    }
  }, []);

  const connectDemo = useCallback(async () => {
    try {
      setError(undefined);
      setStatus("connecting");
      const wallet = readDemoWallet();
      if (!wallet) throw new Error("No demo wallet exists in this browser");
      const address = await authenticateDemoWallet(wallet);
      setWalletPublicKey(address);
      setWalletKind("demo");
      setStatus("authenticated");
      return address;
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Demo wallet connection failed");
      setStatus("error");
      return undefined;
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
      setStatus("preparing");
      const response = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/payment`);
      const payload = (await response.json()) as { error?: string; xdr?: string };
      if (!response.ok || !payload.xdr) throw new Error(payload.error || "Payment could not be prepared");
      const localWallet = walletKind === "demo" ? readDemoWallet() : undefined;
      if (walletKind === "demo" && (!localWallet || localWallet.publicKey() !== walletPublicKey)) {
        throw new Error("The local demo wallet changed");
      }
      const hash = localWallet
        ? await payInvoiceWithDemoWallet({ invoice, onStage: setStatus, wallet: localWallet, xdr: payload.xdr })
        : await payInvoiceWithFreighter({ invoice, onStage: setStatus, walletPublicKey, xdr: payload.xdr });
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
  }, [walletKind, walletPublicKey]);

  return { connect, connectDemo, createTrustline, error, payInvoice, status, transactionHash, walletKind, walletPublicKey };
}
