import { readFile } from "node:fs/promises";
import path from "node:path";

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

  const distributorAccount = await server.loadAccount(distributor.publicKey());
  const distributionTransaction = new TransactionBuilder(distributorAccount, {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        amount: "5.0000000",
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

  const invoice: PendingInvoice = {
    amount: "5.0000000",
    assetIssuer: issuer.publicKey(),
    debtorPublicKey: customer.publicKey(),
    dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    issuerPublicKey: issuer.publicKey(),
    memo: `evidence-${Date.now()}`,
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

  // Never print seeds. / Nunca exiba seeds.
  console.log(JSON.stringify({
    customerPublicKey: customer.publicKey(),
    distributionHash,
    distributionPublicKey: distributor.publicKey(),
    issuerPublicKey: issuer.publicKey(),
    network: "Stellar Testnet",
    paymentHash,
    trustlineHash,
    verified: true,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Testnet evidence failed");
  process.exitCode = 1;
});
