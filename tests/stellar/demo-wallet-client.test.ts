import { Account, Asset, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  authenticateDemoWallet,
  getOrCreateDemoWallet,
  payInvoiceDirectlyWithDemo,
  payInvoiceWithDemoWallet,
  readDemoWallet,
  resumeDemoWallet,
} from "../../app/lib/stellar/demo-wallet-client.js";

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("disposable browser demo wallet", () => {
  it("creates one Testnet wallet and restores the same local key", () => {
    const localStorage = storage();
    const created = getOrCreateDemoWallet(localStorage);

    expect(getOrCreateDemoWallet(localStorage).publicKey()).toBe(created.publicKey());
    expect(readDemoWallet(localStorage)?.publicKey()).toBe(created.publicKey());
  });

  it("signs the server authentication challenge without sending its seed", async () => {
    const wallet = Keypair.random();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: "2030-01-01T00:05:00.000Z", id: "challenge-id", message: "authenticate me" })))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { message: string; signature: string; walletPublicKey: string };
        expect(body.walletPublicKey).toBe(wallet.publicKey());
        expect(Keypair.fromPublicKey(wallet.publicKey()).verifyMessage(body.message, Buffer.from(body.signature, "base64"))).toBe(true);
        expect(JSON.stringify(body)).not.toContain(wallet.secret());
        return new Response(JSON.stringify({ authenticated: true }));
      });

    await expect(authenticateDemoWallet(wallet, fetcher)).resolves.toBe(wallet.publicKey());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("allows initial provisioning when the stored demo wallet has no BRLT distribution", async () => {
    const wallet = Keypair.random();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        expiresAt: "2030-01-01T00:05:00.000Z",
        id: "challenge-id",
        message: "authenticate me",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        code: "DEMO_NOT_PROVISIONED",
        error: "Esta carteira demo ainda não recebeu BRLT fictício.",
      }), { status: 409 }));

    await expect(resumeDemoWallet(wallet, fetcher)).resolves.toBeUndefined();
  });

  it("reviews, locally signs, and submits only the exact invoice payment", async () => {
    const wallet = Keypair.random();
    const issuer = Keypair.random().publicKey();
    const receiver = Keypair.random().publicKey();
    const invoice = {
      amount: "25.0000000",
      assetIssuer: issuer,
      debtorPublicKey: wallet.publicKey(),
      issuerPublicKey: issuer,
      memo: "demo-invoice",
      receiverPublicKey: receiver,
    };
    const xdr = new TransactionBuilder(new Account(wallet.publicKey(), "10"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addMemo(Memo.text(invoice.memo))
      .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: receiver }))
      .setTimeout(180)
      .build()
      .toXDR();
    const expectedHash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString("hex");
    const submit = vi.fn().mockImplementation(async (signedXdr: string) => {
      const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
      expect(signed.signatures).toHaveLength(1);
      return { hash: expectedHash };
    });

    await expect(payInvoiceWithDemoWallet({ invoice, wallet, xdr }, submit)).resolves.toBe(expectedHash);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("authenticates, prepares, signs, and verifies invoice payment in one flow", async () => {
    const wallet = Keypair.random();
    const issuer = Keypair.random().publicKey();
    const receiver = Keypair.random().publicKey();
    const invoice = {
      amount: "5.0000000",
      assetIssuer: issuer,
      debtorPublicKey: wallet.publicKey(),
      id: "inv-test-direct",
      issuerPublicKey: issuer,
      memo: "memo-direct",
      receiverPublicKey: receiver,
    };
    const xdr = new TransactionBuilder(new Account(wallet.publicKey(), "10"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addMemo(Memo.text(invoice.memo))
      .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: receiver }))
      .setTimeout(180)
      .build()
      .toXDR();
    const expectedHash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString("hex");

    const fetcher = vi.fn()
      // challenge
      .mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: "2030-01-01T00:05:00.000Z", id: "challenge-id", message: "authenticate me" })))
      // verify challenge
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true })))
      // payment prep
      .mockResolvedValueOnce(new Response(JSON.stringify({ preparedTransactionHash: expectedHash, xdr })))
      // payment verify
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "confirmed" })));

    // Mock Horizon submitTransaction via prototype or fetch
    vi.spyOn(Horizon.Server.prototype, "submitTransaction").mockResolvedValueOnce({ hash: expectedHash } as any);

    const stages: string[] = [];
    const hash = await payInvoiceDirectlyWithDemo(wallet, invoice, (s) => stages.push(s), fetcher);

    expect(hash).toBe(expectedHash);
    expect(stages).toEqual(["authenticating", "preparing", "reviewing", "awaiting-signature", "submitting", "verifying", "confirmed"]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
