import { Account, Asset, Memo, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { STELLAR_TESTNET } from "./network.js";

export type PendingInvoice = {
  amount: string;
  assetIssuer: string;
  debtorPublicKey: string;
  issuerPublicKey: string;
  memo: string;
};

const accountLoader = async (address: string) => {
  const response = await fetch(`${STELLAR_TESTNET.horizonUrl}/accounts/${address}`);
  if (!response.ok) throw new Error("Could not load Stellar Testnet account");
  const account = await response.json();
  return new Account(account.account_id as string, account.sequence as string);
};

export async function buildTrustlineXdr(customerPublicKey: string, assetIssuer: string): Promise<string> {
  const account = await accountLoader(customerPublicKey);
  return new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: new Asset("BRLT", assetIssuer) }))
    .setTimeout(180)
    .build()
    .toXDR();
}

export function reviewTrustlineXdr(
  xdr: string,
  customerPublicKey: string,
  assetIssuer: string,
): { asset: "BRLT"; issuer: string; source: string } {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  if (!(transaction instanceof Transaction) || transaction.operations.length !== 1) {
    throw new Error("Trustline XDR does not match BRLT");
  }
  const operation = transaction.operations[0];
  if (operation?.type !== "changeTrust" || !(operation.line instanceof Asset)) {
    throw new Error("Trustline XDR does not match BRLT");
  }
  const operationSource = operation.source ?? transaction.source;
  if (
    transaction.source !== customerPublicKey ||
    operationSource !== customerPublicKey ||
    operation.line.getCode() !== "BRLT" ||
    operation.line.getIssuer() !== assetIssuer
  ) {
    throw new Error("Trustline XDR does not match BRLT");
  }
  return { asset: "BRLT", issuer: assetIssuer, source: customerPublicKey };
}

export async function buildInvoicePaymentXdr(invoice: PendingInvoice, customerPublicKey = invoice.debtorPublicKey): Promise<string> {
  if (customerPublicKey !== invoice.debtorPublicKey) {
    throw new Error("The connected wallet is not the invoice debtor");
  }
  const account = await accountLoader(invoice.debtorPublicKey);
  return new TransactionBuilder(account, { fee: "100", networkPassphrase: Networks.TESTNET })
    .addMemo(Memo.text(invoice.memo))
    .addOperation(
      Operation.payment({
        destination: invoice.issuerPublicKey,
        asset: new Asset("BRLT", invoice.assetIssuer),
        amount: invoice.amount,
      }),
    )
    .setTimeout(180)
    .build()
    .toXDR();
}

export function reviewInvoicePaymentXdr(
  xdr: string,
  invoice: PendingInvoice,
  customerPublicKey: string,
): { amount: string; asset: "BRLT"; destination: string; memo: string; source: string } {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  if (!(transaction instanceof Transaction) || transaction.operations.length !== 1) {
    throw new Error("Payment XDR does not match the invoice");
  }
  const operation = transaction.operations[0];
  if (operation?.type !== "payment") throw new Error("Payment XDR does not match the invoice");
  const assetIssuer = operation.asset.getIssuer();
  const memo = transaction.memo.type === "text" ? transaction.memo.value?.toString() : undefined;
  const operationSource = operation.source ?? transaction.source;
  const matches =
    transaction.source === customerPublicKey &&
    customerPublicKey === invoice.debtorPublicKey &&
    operationSource === customerPublicKey &&
    operation.destination === invoice.issuerPublicKey &&
    operation.asset.getCode() === "BRLT" &&
    assetIssuer === invoice.assetIssuer &&
    invoice.assetIssuer === invoice.issuerPublicKey &&
    operation.amount === invoice.amount &&
    memo === invoice.memo;
  if (!matches) throw new Error("Payment XDR does not match the invoice");

  return {
    amount: operation.amount,
    asset: "BRLT",
    destination: operation.destination,
    memo,
    source: customerPublicKey,
  };
}
