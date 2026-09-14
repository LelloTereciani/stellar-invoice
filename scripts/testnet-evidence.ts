import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

import { verifyPayment, type LedgerOperation, type LedgerTransaction } from "../app/lib/stellar/payment-verifier.js";
import {
  buildInvoicePaymentXdr,
  buildTrustlineXdr,
  reviewInvoicePaymentXdr,
  reviewTrustlineXdr,
  type PendingInvoice,
} from "../app/lib/stellar/transactions.js";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";

type PersistedDemoWallets = { distributionSecret: string; issuerSecret: string };

type EvidenceSummaryInput = {
  customerAfterDistribution: string;
  customerAfterPayment: string;
  customerPublicKey: string;
  distributionHash: string;
  issuerHasBrltTrustline: boolean;
  issuerPublicKey: string;
  paymentHash: string;
  treasuryAfterDistribution: string;
  treasuryAfterPayment: string;
  treasuryBeforeDistribution: string;
  treasuryPublicKey: string;
  trustlineHash: string;
};

function stroops(value: string): bigint {
  const match = /^(\d+)\.(\d{7})$/.exec(value);
  if (!match) throw new Error("Evidence balance must use seven decimal places");
  return BigInt(match[1]) * 10_000_000n + BigInt(match[2]);
}

function signedAmount(value: bigint): string {
  const sign = value >= 0n ? "+" : "-";
  const absolute = value >= 0n ? value : -value;
  return `${sign}${absolute / 10_000_000n}.${(absolute % 10_000_000n).toString().padStart(7, "0")}`;
}

export function buildEvidenceSummary(input: EvidenceSummaryInput) {
  const customerPaymentDelta = stroops(input.customerAfterPayment) - stroops(input.customerAfterDistribution);
  const treasuryDistributionDelta = stroops(input.treasuryAfterDistribution) - stroops(input.treasuryBeforeDistribution);
  const treasuryPaymentDelta = stroops(input.treasuryAfterPayment) - stroops(input.treasuryAfterDistribution);
  if (
    input.customerAfterDistribution !== "25.0000000" ||
    input.customerAfterPayment !== "20.0000000" ||
    customerPaymentDelta !== -50_000_000n ||
    treasuryDistributionDelta !== -250_000_000n ||
    treasuryPaymentDelta !== 50_000_000n ||
    input.issuerHasBrltTrustline
  ) {
    throw new Error("Evidence balances do not prove the receiver payment flow");
  }
  for (const publicKey of [input.customerPublicKey, input.issuerPublicKey, input.treasuryPublicKey]) {
    Keypair.fromPublicKey(publicKey);
  }
  for (const hash of [input.distributionHash, input.paymentHash, input.trustlineHash]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Evidence contains an invalid transaction hash");
  }

  return {
    balances: {
      customer: {
        afterDistribution: input.customerAfterDistribution,
        afterPayment: input.customerAfterPayment,
        paymentDelta: signedAmount(customerPaymentDelta),
      },
      treasury: {
        afterDistribution: input.treasuryAfterDistribution,
        afterPayment: input.treasuryAfterPayment,
        distributionDelta: signedAmount(treasuryDistributionDelta),
        paymentDelta: signedAmount(treasuryPaymentDelta),
        beforeDistribution: input.treasuryBeforeDistribution,
      },
    },
    customerPublicKey: input.customerPublicKey,
    distributionHash: input.distributionHash,
    issuerHasBrltTrustline: input.issuerHasBrltTrustline,
    issuerPublicKey: input.issuerPublicKey,
    network: "Stellar Testnet" as const,
    paymentHash: input.paymentHash,
    receiverPublicKey: input.treasuryPublicKey,
    trustlineHash: input.trustlineHash,
    verified: true,
  };
}

function safeSubmissionError(label: string, error: unknown): Error {
  const response = (error as { response?: { data?: { extras?: { result_codes?: unknown } }; status?: number } }).response;
  return new Error(`${label} failed (${response?.status ?? "unknown"}): ${JSON.stringify(response?.data?.extras?.result_codes ?? "no result codes")}`);
}

async function fundWithFriendbot(publicKey: string): Promise<void> {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) throw new Error(`Friendbot could not fund the evidence wallet (${response.status})`);
}

async function submitCustomerXdr(server: Horizon.Server, xdr: string): Promise<string> {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  try {
    return (await server.submitTransaction(transaction)).hash;
  } catch (error: unknown) {
    throw safeSubmissionError("Payment submission", error);
  }
}

async function brltBalance(server: Horizon.Server, publicKey: string, issuerPublicKey: string): Promise<string> {
  const account = await server.loadAccount(publicKey);
  const balance = account.balances.find((entry) =>
    entry.asset_type !== "native" &&
    entry.asset_type !== "liquidity_pool_shares" &&
    entry.asset_code === "BRLT" &&
    entry.asset_issuer === issuerPublicKey
  );
  if (!balance) throw new Error(`BRLT trustline is missing for ${publicKey}`);
  return balance.balance;
}

async function hasBrltTrustline(server: Horizon.Server, publicKey: string, issuerPublicKey: string): Promise<boolean> {
  const account = await server.loadAccount(publicKey);
  return account.balances.some((entry) =>
    entry.asset_type !== "native" &&
    entry.asset_type !== "liquidity_pool_shares" &&
    entry.asset_code === "BRLT" &&
    entry.asset_issuer === issuerPublicKey
  );
}

async function main(): Promise<void> {
  const walletPath = path.resolve(process.env.STELLAR_DEMO_WALLET_FILE ?? "demo-wallet.json");
  const persisted = JSON.parse(await readFile(walletPath, "utf8")) as PersistedDemoWallets;
  const issuer = Keypair.fromSecret(persisted.issuerSecret);
  const distributor = Keypair.fromSecret(persisted.distributionSecret);
  const customer = Keypair.random();
  const server = new Horizon.Server(HORIZON_URL);

  await fundWithFriendbot(customer.publicKey());

  const trustlineXdr = await buildTrustlineXdr(customer.publicKey(), issuer.publicKey());
  reviewTrustlineXdr(trustlineXdr, customer.publicKey(), issuer.publicKey());
  const trustlineTransaction = TransactionBuilder.fromXDR(trustlineXdr, Networks.TESTNET);
  trustlineTransaction.sign(customer);
  // Review signed bytes again before submission. / Revise os bytes assinados novamente antes do envio.
  reviewTrustlineXdr(trustlineTransaction.toXDR(), customer.publicKey(), issuer.publicKey());
  let trustlineHash: string;
  try {
    trustlineHash = (await server.submitTransaction(trustlineTransaction)).hash;
  } catch (error: unknown) {
    throw safeSubmissionError("Trustline submission", error);
  }

  const treasuryBeforeDistribution = await brltBalance(server, distributor.publicKey(), issuer.publicKey());

  const distributorAccount = await server.loadAccount(distributor.publicKey());
  const distributionTransaction = new TransactionBuilder(distributorAccount, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        amount: "25.0000000",
        asset: new Asset("BRLT", issuer.publicKey()),
        destination: customer.publicKey(),
      }),
    )
    .setTimeout(180)
    .build();
  distributionTransaction.sign(distributor);
  let distributionHash: string;
  try {
    distributionHash = (await server.submitTransaction(distributionTransaction)).hash;
  } catch (error: unknown) {
    throw safeSubmissionError("Distribution submission", error);
  }
  const customerAfterDistribution = await brltBalance(server, customer.publicKey(), issuer.publicKey());
  const treasuryAfterDistribution = await brltBalance(server, distributor.publicKey(), issuer.publicKey());

  const invoice: PendingInvoice = {
    amount: "5.0000000",
    assetIssuer: issuer.publicKey(),
    debtorPublicKey: customer.publicKey(),
    dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    issuerPublicKey: issuer.publicKey(),
    memo: `evidence-${Date.now()}`,
    receiverPublicKey: distributor.publicKey(),
  };
  const paymentXdr = await buildInvoicePaymentXdr(invoice);
  reviewInvoicePaymentXdr(paymentXdr, invoice, customer.publicKey());
  const paymentTransaction = TransactionBuilder.fromXDR(paymentXdr, Networks.TESTNET);
  paymentTransaction.sign(customer);
  reviewInvoicePaymentXdr(paymentTransaction.toXDR(), invoice, customer.publicKey());
  const expectedHash = paymentTransaction.hash().toString("hex");
  const paymentHash = await submitCustomerXdr(server, paymentTransaction.toXDR());
  if (paymentHash !== expectedHash) throw new Error("Horizon returned an unexpected evidence payment hash");

  const ledgerTransaction = await server.transactions().transaction(paymentHash).call();
  const ledgerOperations = await server.operations().forTransaction(paymentHash).call();
  const verification = verifyPayment(
    invoice,
    ledgerTransaction as unknown as LedgerTransaction,
    ledgerOperations.records as unknown as LedgerOperation[],
  );
  if (verification.status !== "confirmed" || verification.transactionHash !== paymentHash) {
    throw new Error(`The real Testnet payment did not pass the application verifier: ${verification.status === "rejected" ? verification.reason : "unexpected hash"}`);
  }

  const customerAfterPayment = await brltBalance(server, customer.publicKey(), issuer.publicKey());
  const treasuryAfterPayment = await brltBalance(server, distributor.publicKey(), issuer.publicKey());
  const issuerHasBrltTrustline = await hasBrltTrustline(server, issuer.publicKey(), issuer.publicKey());

  // Never print seeds. / Nunca exiba seeds.
  console.log(JSON.stringify(buildEvidenceSummary({
    customerAfterDistribution,
    customerAfterPayment,
    customerPublicKey: customer.publicKey(),
    distributionHash,
    issuerHasBrltTrustline,
    issuerPublicKey: issuer.publicKey(),
    paymentHash,
    treasuryAfterDistribution,
    treasuryAfterPayment,
    treasuryBeforeDistribution,
    treasuryPublicKey: distributor.publicKey(),
    trustlineHash,
  })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Testnet evidence failed");
    process.exitCode = 1;
  });
}
