import { Account, Asset, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

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
