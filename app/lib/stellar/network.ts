import { Networks } from "@stellar/stellar-sdk";

export const STELLAR_TESTNET = {
  horizonUrl: "https://horizon-testnet.stellar.org",
  network: "testnet",
  networkPassphrase: Networks.TESTNET,
} as const;
