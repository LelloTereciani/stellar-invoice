"use client";

import { Horizon, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";

import { STELLAR_TESTNET } from "./network.js";
import { reviewInvoicePaymentXdr, type PendingInvoice } from "./transactions.js";

export const DEMO_WALLET_STORAGE_KEY = "stellar-invoice-demo-customer-secret";

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function browserStorage(): BrowserStorage {
  return window.localStorage;
}

export function readDemoWallet(storage: BrowserStorage = browserStorage()): Keypair | undefined {
  const secret = storage.getItem(DEMO_WALLET_STORAGE_KEY);
  if (!secret) return undefined;
  try {
    return Keypair.fromSecret(secret);
  } catch {
    return undefined;
  }
}

export function getOrCreateDemoWallet(storage: BrowserStorage = browserStorage()): Keypair {
  const existing = readDemoWallet(storage);
  if (existing) return existing;
  const wallet = Keypair.random();
  // The disposable Testnet seed never crosses the browser boundary. / A seed Testnet descartável nunca sai do navegador.
  storage.setItem(DEMO_WALLET_STORAGE_KEY, wallet.secret());
  return wallet;
}

export async function authenticateDemoWallet(wallet: Keypair, fetcher: Fetcher = fetch): Promise<string> {
  const walletPublicKey = wallet.publicKey();
  const challengeResponse = await fetcher("/api/auth/challenge", {
    body: JSON.stringify({ walletPublicKey }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const challenge = (await challengeResponse.json()) as { error?: string; expiresAt?: string; id?: string; message?: string };
  if (!challengeResponse.ok || !challenge.expiresAt || !challenge.id || !challenge.message) {
    throw new Error(challenge.error || "Demo wallet challenge could not be created");
  }
  const verificationResponse = await fetcher("/api/auth/verify", {
    body: JSON.stringify({
      expiresAt: challenge.expiresAt,
      id: challenge.id,
      message: challenge.message,
      signature: wallet.sign(Buffer.from(challenge.message)).toString("base64"),
      walletPublicKey,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const verification = (await verificationResponse.json()) as { error?: string };
  if (!verificationResponse.ok) throw new Error(verification.error || "Demo wallet authentication failed");
  return walletPublicKey;
}

export async function resumeDemoWallet(wallet: Keypair, fetcher: Fetcher = fetch): Promise<string | undefined> {
  await authenticateDemoWallet(wallet, fetcher);
  const response = await fetcher("/api/demo/resume", { method: "POST" });
  const result = (await response.json()) as { code?: string; error?: string; invoiceId?: string };
  if (response.status === 409 && result.code === "DEMO_NOT_PROVISIONED") return undefined;
  if (!response.ok || !result.invoiceId) throw new Error(result.error || "Demo invoice could not be recovered");
  return result.invoiceId;
}

async function submitSignedXdr(signedXdr: string): Promise<{ hash: string }> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const result = await new Horizon.Server(STELLAR_TESTNET.horizonUrl).submitTransaction(transaction);
  return { hash: result.hash };
}

export async function payInvoiceWithDemoWallet(
  input: {
    invoice: PendingInvoice;
    onStage?: (stage: "reviewing" | "awaiting-signature" | "submitting") => void;
    wallet: Keypair;
    xdr: string;
  },
  submit: (signedXdr: string) => Promise<{ hash: string }> = submitSignedXdr,
): Promise<string> {
  const walletPublicKey = input.wallet.publicKey();
  input.onStage?.("reviewing");
  reviewInvoicePaymentXdr(input.xdr, input.invoice, walletPublicKey);
  const expectedHash = TransactionBuilder.fromXDR(input.xdr, Networks.TESTNET).hash().toString("hex");
  input.onStage?.("awaiting-signature");
  const transaction = TransactionBuilder.fromXDR(input.xdr, Networks.TESTNET);
  transaction.sign(input.wallet);
  const signedXdr = transaction.toXDR();
  // Re-review after signing to keep the same transaction-integrity boundary as Freighter.
  // Revisamos após assinar para manter a mesma barreira de integridade usada no Freighter.
  reviewInvoicePaymentXdr(signedXdr, input.invoice, walletPublicKey);
  input.onStage?.("submitting");
  const result = await submit(signedXdr);
  if (!/^[a-f0-9]{64}$/i.test(result.hash)) throw new Error("Horizon returned an invalid transaction hash");
  if (result.hash !== expectedHash) throw new Error("Horizon returned an unexpected transaction hash");
  return result.hash;
}
