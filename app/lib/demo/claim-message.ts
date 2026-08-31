import { Keypair, Networks } from "@stellar/stellar-sdk";

export function buildDemoClaimMessage(walletPublicKey: string, sessionId: string): string {
  return [
    "StellarInvoice demo claim v1",
    "domain:stellar-invoice",
    "network:testnet",
    `network-passphrase:${Networks.TESTNET}`,
    "action:claim-demo-brlt",
    `wallet:${walletPublicKey}`,
    `session:${sessionId}`,
  ].join("\n");
}

export function verifyDemoClaimSignature(
  message: string,
  signature: string,
  walletPublicKey: string,
  sessionId: string,
): boolean {
  if (message !== buildDemoClaimMessage(walletPublicKey, sessionId)) return false;
  try {
    return Keypair.fromPublicKey(walletPublicKey).verify(Buffer.from(message), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
