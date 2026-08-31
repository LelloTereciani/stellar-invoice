import { Keypair } from "@stellar/stellar-sdk";

import { STELLAR_TESTNET } from "./stellar/network.js";

type PublicEnvironment = {
  NEXT_PUBLIC_STELLAR_ISSUER?: string;
  NEXT_PUBLIC_STELLAR_NETWORK?: string;
};

type ServerEnvironment = Record<string, string | undefined>;

export type StellarConfig = {
  assetCode: "BRLT";
  horizonUrl: string;
  issuerPublicKey: string;
  network: "testnet";
  networkPassphrase: string;
};

// Administrative secrets must remain in server-only execution contexts.
// Segredos administrativos devem permanecer apenas em contextos de execução no servidor.
export function requireServerEnv(name: string, environment: ServerEnvironment): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadStellarConfig(environment: PublicEnvironment): StellarConfig {
  if (environment.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
    throw new Error("StellarInvoice accepts only Stellar Testnet");
  }

  const issuerPublicKey = environment.NEXT_PUBLIC_STELLAR_ISSUER;
  if (!issuerPublicKey) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_STELLAR_ISSUER");
  }

  try {
    Keypair.fromPublicKey(issuerPublicKey);
  } catch {
    throw new Error("NEXT_PUBLIC_STELLAR_ISSUER must be a valid Stellar public key");
  }

  return {
    assetCode: "BRLT",
    horizonUrl: STELLAR_TESTNET.horizonUrl,
    issuerPublicKey,
    network: STELLAR_TESTNET.network,
    networkPassphrase: STELLAR_TESTNET.networkPassphrase,
  };
}
