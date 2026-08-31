import { Keypair, Networks } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authenticateFreighterWallet,
  connectFreighterTestnet,
  payInvoiceWithFreighter,
  createTrustlineWithFreighter,
  type FreighterAdapter,
} from "../../app/lib/stellar/freighter-client.js";
import { buildInvoicePaymentXdr } from "../../app/lib/stellar/transactions.js";

afterEach(() => vi.unstubAllGlobals());

function adapter(walletPublicKey: string): FreighterAdapter {
  return {
    getNetwork: vi.fn().mockResolvedValue({ network: "TESTNET", networkPassphrase: Networks.TESTNET }),
    isConnected: vi.fn().mockResolvedValue({ isConnected: true }),
    requestAccess: vi.fn().mockResolvedValue({ address: walletPublicKey }),
    signMessage: vi.fn().mockResolvedValue({ signedMessage: "c2lnbmF0dXJl", signerAddress: walletPublicKey }),
    signTransaction: vi.fn().mockImplementation(async (xdr: string) => ({ signedTxXdr: xdr, signerAddress: walletPublicKey })),
  };
}

describe("Freighter Testnet client", () => {
  it("connects only to Testnet", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    await expect(connectFreighterTestnet(adapter(walletPublicKey))).resolves.toBe(walletPublicKey);
    const wrongNetwork = adapter(walletPublicKey);
    wrongNetwork.getNetwork = vi.fn().mockResolvedValue({ network: "PUBLIC", networkPassphrase: Networks.PUBLIC });
    await expect(connectFreighterTestnet(wrongNetwork)).rejects.toThrow("Testnet");
  });

  it("signs the one-time server challenge and establishes the browser session", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    const walletAdapter = adapter(walletPublicKey);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expiresAt: "2030-01-01T00:05:00.000Z", id: "challenge-id", message: "challenge" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ authenticated: true, walletPublicKey })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(authenticateFreighterWallet(walletAdapter)).resolves.toBe(walletPublicKey);
    expect(walletAdapter.signMessage).toHaveBeenCalledWith("challenge", {
      address: walletPublicKey,
      networkPassphrase: Networks.TESTNET,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reviews, signs, and submits the exact invoice XDR in the customer wallet", async () => {
    const debtorPublicKey = Keypair.random().publicKey();
    const issuerPublicKey = Keypair.random().publicKey();
    const invoice = {
      amount: "10.0000000",
      assetIssuer: issuerPublicKey,
      debtorPublicKey,
      issuerPublicKey,
      memo: "invoice-123",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ account_id: debtorPublicKey, sequence: "123" }))));
    const xdr = await buildInvoicePaymentXdr(invoice, debtorPublicKey);
    const submit = vi.fn().mockResolvedValue({ hash: "a".repeat(64) });

    await expect(payInvoiceWithFreighter({ invoice, walletPublicKey: debtorPublicKey, xdr }, adapter(debtorPublicKey), submit))
      .resolves.toBe("a".repeat(64));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("reviews, signs, and submits the BRLT trustline in the customer wallet", async () => {
    const walletPublicKey = Keypair.random().publicKey();
    const issuerPublicKey = Keypair.random().publicKey();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ account_id: walletPublicKey, sequence: "123" }))));
    const xdr = await (await import("../../app/lib/stellar/transactions.js")).buildTrustlineXdr(walletPublicKey, issuerPublicKey);
    const submit = vi.fn().mockResolvedValue({ hash: "b".repeat(64) });

    await expect(createTrustlineWithFreighter({ issuerPublicKey, walletPublicKey, xdr }, adapter(walletPublicKey), submit))
      .resolves.toBe("b".repeat(64));
  });
});
