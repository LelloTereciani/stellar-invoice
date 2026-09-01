"use client";

import { Horizon, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { useEffect, useRef, useState } from "react";

import { buildDemoClaimMessage } from "../lib/demo/claim-message.js";
import { authenticateDemoWallet, getOrCreateDemoWallet, readDemoWallet, resumeDemoWallet } from "../lib/stellar/demo-wallet-client.js";
import { reviewTrustlineXdr } from "../lib/stellar/transactions.js";

const HORIZON_URL = "https://horizon-testnet.stellar.org";

type ProvisionResponse = {
  issuerPublicKey: string;
  sessionId: string;
  trustlineXdr: string;
};

export function DemoStarter() {
  const [message, setMessage] = useState("Crie uma demonstração Testnet com BRLT fictício.");
  const [publicKey, setPublicKey] = useState<string>();
  const [canResume, setCanResume] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startInProgress = useRef(false);

  useEffect(() => {
    const wallet = readDemoWallet();
    if (!wallet) return;
    setCanResume(true);
    setPublicKey(wallet.publicKey());
    setMessage("Uma carteira demo existente foi encontrada neste navegador.");
  }, []);

  async function startDemo() {
    if (startInProgress.current) return;
    startInProgress.current = true;
    setIsStarting(true);
    try {
      const existingWallet = readDemoWallet();
      if (existingWallet) {
        setMessage("Autenticando a carteira demo e recuperando sua fatura...");
        const invoiceId = await resumeDemoWallet(existingWallet);
        if (invoiceId) {
          window.location.assign(`/invoices/${encodeURIComponent(invoiceId)}`);
          return;
        }
        setMessage("Retomando o provisionamento inicial desta carteira demo...");
      }

      const wallet = existingWallet ?? getOrCreateDemoWallet();
      if (!existingWallet) setMessage("Criando carteira e solicitando XLM de teste...");
      setPublicKey(wallet.publicKey());
      const response = await fetch("/api/demo/provision", {
        body: JSON.stringify({ publicKey: wallet.publicKey() }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const provision = (await response.json()) as ProvisionResponse & { error?: string };
      if (!response.ok) throw new Error(provision.error ?? "Não foi possível provisionar a demonstração");

      setMessage("Assinando a trustline BRLT na carteira local...");
      reviewTrustlineXdr(provision.trustlineXdr, wallet.publicKey(), provision.issuerPublicKey);
      const transaction = TransactionBuilder.fromXDR(provision.trustlineXdr, Networks.TESTNET);
      transaction.sign(wallet);
      reviewTrustlineXdr(transaction.toXDR(), wallet.publicKey(), provision.issuerPublicKey);
      await new Horizon.Server(HORIZON_URL).submitTransaction(transaction);

      const claimMessage = buildDemoClaimMessage(wallet.publicKey(), provision.sessionId);
      const signedClaim = wallet.sign(Buffer.from(claimMessage)).toString("base64");
      const distribution = await fetch("/api/demo/distribute", {
        body: JSON.stringify({ claimMessage, sessionId: provision.sessionId, signedClaim }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await distribution.json()) as { amount?: string; error?: string; invoiceId?: string };
      if (!distribution.ok) throw new Error(result.error ?? "Não foi possível receber BRLT de demonstração");
      setMessage("Autenticando sua carteira descartável...");
      await authenticateDemoWallet(wallet);
      setMessage(`Demonstração pronta: ${result.amount} BRLT fictícios foram enviados à sua carteira Testnet.`);
      if (result.invoiceId) window.location.assign(`/invoices/${encodeURIComponent(result.invoiceId)}`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "A demonstração não pôde ser concluída");
    } finally {
      startInProgress.current = false;
      setIsStarting(false);
    }
  }

  return (
    <section>
      <button aria-busy={isStarting} disabled={isStarting} type="button" onClick={startDemo}>{canResume ? "Continuar demonstração" : "Iniciar demonstração automática"}</button>
      <p>{message}</p>
      {publicKey ? <code>{publicKey}</code> : null}
    </section>
  );
}
