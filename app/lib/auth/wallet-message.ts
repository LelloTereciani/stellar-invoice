import { Keypair, Networks } from "@stellar/stellar-sdk";

export type WalletChallenge = {
  expiresAt: string;
  message: string;
  signature: string;
};

export type WalletChallengeContext = {
  origin: string;
  walletPublicKey: string;
};

function normalizedOrigin(origin: string): string {
  return new URL(origin).origin;
}

export function buildWalletChallengeMessage(input: {
  expiresAt: string;
  nonce: string;
  origin: string;
  walletPublicKey: string;
}): string {
  return [
    "StellarInvoice authentication v1",
    `origin:${normalizedOrigin(input.origin)}`,
    "network:testnet",
    `network-passphrase:${Networks.TESTNET}`,
    "action:authenticate-wallet",
    `wallet:${input.walletPublicKey}`,
    `expires-at:${input.expiresAt}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

export function verifyWalletChallengeMessage(
  challenge: WalletChallenge,
  context: WalletChallengeContext,
): boolean {
  const lines = challenge.message.split("\n");
  const structurallyValid =
    lines.length === 8 &&
    lines[0] === "StellarInvoice authentication v1" &&
    lines[1] === `origin:${normalizedOrigin(context.origin)}` &&
    lines[2] === "network:testnet" &&
    lines[3] === `network-passphrase:${Networks.TESTNET}` &&
    lines[4] === "action:authenticate-wallet" &&
    lines[5] === `wallet:${context.walletPublicKey}` &&
    lines[6] === `expires-at:${challenge.expiresAt}` &&
    /^nonce:[a-f0-9]{64}$/.test(lines[7] ?? "");
  if (!structurallyValid) return false;

  try {
    return Keypair.fromPublicKey(context.walletPublicKey).verify(
      Buffer.from(challenge.message),
      Buffer.from(challenge.signature, "base64"),
    );
  } catch {
    return false;
  }
}
