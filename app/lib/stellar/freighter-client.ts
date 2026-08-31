"use client";

import {
  getNetwork,
  isConnected,
  requestAccess,
  signMessage,
  signTransaction,
} from "@stellar/freighter-api";
import { Horizon, Networks, TransactionBuilder } from "@stellar/stellar-sdk";

import { STELLAR_TESTNET } from "./network.js";
import { reviewInvoicePaymentXdr, reviewTrustlineXdr, type PendingInvoice } from "./transactions.js";

type WalletError = { message?: string };
type WalletResult = { error?: WalletError };

export type FreighterAdapter = {
  getNetwork(): Promise<{ network: string; networkPassphrase: string } & WalletResult>;
  isConnected(): Promise<{ isConnected: boolean } & WalletResult>;
  requestAccess(): Promise<{ address: string } & WalletResult>;
  signMessage(message: string, options: { address: string; networkPassphrase: string }): Promise<{
    error?: WalletError;
    signedMessage: null | string | Uint8Array;
    signerAddress: string;
  }>;
  signTransaction(xdr: string, options: { address: string; networkPassphrase: string }): Promise<{
    error?: WalletError;
    signedTxXdr: string;
    signerAddress: string;
  }>;
};

const browserFreighter: FreighterAdapter = {
  getNetwork,
  isConnected,
  requestAccess,
  signMessage,
  signTransaction,
};

function walletError(error: WalletError | undefined, fallback: string): Error {
  return new Error(error?.message || fallback);
}

export async function connectFreighterTestnet(adapter = browserFreighter): Promise<string> {
  const installation = await adapter.isConnected();
  if (installation.error || !installation.isConnected) throw walletError(installation.error, "Freighter is not installed");
  const access = await adapter.requestAccess();
  if (access.error || !access.address) throw walletError(access.error, "Freighter access was denied");
  const network = await adapter.getNetwork();
  if (network.error || network.network !== "TESTNET" || network.networkPassphrase !== Networks.TESTNET) {
    throw walletError(network.error, "Change Freighter to Stellar Testnet");
  }
  return access.address;
}

export async function authenticateFreighterWallet(adapter = browserFreighter): Promise<string> {
  const walletPublicKey = await connectFreighterTestnet(adapter);
  const challengeResponse = await fetch("/api/auth/challenge", {
    body: JSON.stringify({ walletPublicKey }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const challenge = (await challengeResponse.json()) as { error?: string; expiresAt?: string; id?: string; message?: string };
  if (!challengeResponse.ok || !challenge.expiresAt || !challenge.id || !challenge.message) {
    throw new Error(challenge.error || "Wallet challenge could not be created");
  }

  const signed = await adapter.signMessage(challenge.message, {
    address: walletPublicKey,
    networkPassphrase: Networks.TESTNET,
  });
  if (signed.error || !signed.signedMessage || signed.signerAddress !== walletPublicKey) {
    throw walletError(signed.error, "Wallet authentication signature was refused");
  }
  const signature = typeof signed.signedMessage === "string"
    ? signed.signedMessage
    : btoa(String.fromCharCode(...signed.signedMessage));
  const verificationResponse = await fetch("/api/auth/verify", {
    body: JSON.stringify({
      expiresAt: challenge.expiresAt,
      id: challenge.id,
      message: challenge.message,
      signature,
      walletPublicKey,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const verification = (await verificationResponse.json()) as { error?: string };
  if (!verificationResponse.ok) throw new Error(verification.error || "Wallet authentication failed");
  return walletPublicKey;
}

async function submitSignedXdr(signedXdr: string): Promise<{ hash: string }> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  const result = await new Horizon.Server(STELLAR_TESTNET.horizonUrl).submitTransaction(transaction);
  return { hash: result.hash };
}

export async function payInvoiceWithFreighter(
  input: { invoice: PendingInvoice; onStage?: (stage: "reviewing" | "awaiting-signature" | "submitting") => void; walletPublicKey: string; xdr: string },
  adapter = browserFreighter,
  submit: (signedXdr: string) => Promise<{ hash: string }> = submitSignedXdr,
): Promise<string> {
  const connectedWallet = await connectFreighterTestnet(adapter);
  if (connectedWallet !== input.walletPublicKey) throw new Error("The connected wallet changed");
  input.onStage?.("reviewing");
  reviewInvoicePaymentXdr(input.xdr, input.invoice, connectedWallet);
  input.onStage?.("awaiting-signature");
  const signed = await adapter.signTransaction(input.xdr, {
    address: connectedWallet,
    networkPassphrase: Networks.TESTNET,
  });
  if (signed.error || !signed.signedTxXdr || signed.signerAddress !== connectedWallet) {
    throw walletError(signed.error, "Payment signature was refused");
  }
  // Re-reviewing the signed envelope detects any transaction-body mutation by the wallet boundary.
  // Revisar novamente o envelope assinado detecta alteração do corpo da transação no limite da carteira.
  reviewInvoicePaymentXdr(signed.signedTxXdr, input.invoice, connectedWallet);
  input.onStage?.("submitting");
  const result = await submit(signed.signedTxXdr);
  if (!/^[a-f0-9]{64}$/i.test(result.hash)) throw new Error("Horizon returned an invalid transaction hash");
  return result.hash;
}

export async function createTrustlineWithFreighter(
  input: { issuerPublicKey: string; onStage?: (stage: "reviewing" | "awaiting-signature" | "submitting") => void; walletPublicKey: string; xdr: string },
  adapter = browserFreighter,
  submit: (signedXdr: string) => Promise<{ hash: string }> = submitSignedXdr,
): Promise<string> {
  const connectedWallet = await connectFreighterTestnet(adapter);
  if (connectedWallet !== input.walletPublicKey) throw new Error("The connected wallet changed");
  input.onStage?.("reviewing");
  reviewTrustlineXdr(input.xdr, connectedWallet, input.issuerPublicKey);
  input.onStage?.("awaiting-signature");
  const signed = await adapter.signTransaction(input.xdr, {
    address: connectedWallet,
    networkPassphrase: Networks.TESTNET,
  });
  if (signed.error || !signed.signedTxXdr || signed.signerAddress !== connectedWallet) {
    throw walletError(signed.error, "Trustline signature was refused");
  }
  reviewTrustlineXdr(signed.signedTxXdr, connectedWallet, input.issuerPublicKey);
  input.onStage?.("submitting");
  const result = await submit(signed.signedTxXdr);
  if (!/^[a-f0-9]{64}$/i.test(result.hash)) throw new Error("Horizon returned an invalid transaction hash");
  return result.hash;
}
