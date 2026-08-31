# Shared UI components

## `app/components/DemoStarter.tsx`

Browser-only guided Testnet wallet provisioning component. It retains the disposable demo seed in localStorage and never sends it to the server.

```tsx
"use client";

import { Horizon, Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import { useState } from "react";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const LOCAL_KEY = "stellar-invoice-demo-customer-secret";

type ProvisionResponse = {
  sessionId: string;
  trustlineXdr: string;
};

function demoWallet() {
  const existing = window.localStorage.getItem(LOCAL_KEY);
  if (existing) return Keypair.fromSecret(existing);
  const wallet = Keypair.random();
  // The browser alone retains this disposable Testnet seed. / Somente o navegador retém esta seed Testnet descartável.
  window.localStorage.setItem(LOCAL_KEY, wallet.secret());
  return wallet;
}

export function DemoStarter() {
  const [message, setMessage] = useState("Crie uma demonstração Testnet com BRLT fictício.");
  const [publicKey, setPublicKey] = useState<string>();

  async function startDemo() {
    try {
      setMessage("Criando carteira e solicitando XLM de teste...");
      const wallet = demoWallet();
      setPublicKey(wallet.publicKey());
      const response = await fetch("/api/demo/provision", {
        body: JSON.stringify({ publicKey: wallet.publicKey() }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const provision = (await response.json()) as ProvisionResponse & { error?: string };
      if (!response.ok) throw new Error(provision.error ?? "Não foi possível provisionar a demonstração");

      setMessage("Assinando a trustline BRLT na carteira local...");
      const transaction = TransactionBuilder.fromXDR(provision.trustlineXdr, Networks.TESTNET);
      transaction.sign(wallet);
      await new Horizon.Server(HORIZON_URL).submitTransaction(transaction);

      const distribution = await fetch("/api/demo/distribute", {
        body: JSON.stringify({ sessionId: provision.sessionId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const result = (await distribution.json()) as { amount?: string; error?: string };
      if (!distribution.ok) throw new Error(result.error ?? "Não foi possível receber BRLT de demonstração");
      setMessage(`Demonstração pronta: ${result.amount} BRLT fictícios foram enviados à sua carteira Testnet.`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "A demonstração não pôde ser concluída");
    }
  }

  return (
    <section>
      <button type="button" onClick={startDemo}>Iniciar demonstração automática</button>
      <p>{message}</p>
      {publicKey ? <code>{publicKey}</code> : null}
    </section>
  );
}
```

## `app/components/TestnetWallet.tsx`

Minimal Freighter connector that exposes wallet state and Testnet network errors.

```tsx
"use client";

import { getAddress, getNetwork, isConnected, requestAccess } from "@stellar/freighter-api";
import { useState } from "react";

export function TestnetWallet() {
  const [address, setAddress] = useState<string>();
  const [message, setMessage] = useState("Conecte uma carteira Stellar Testnet.");

  async function connect() {
    const installation = await isConnected();
    if (!installation.isConnected) {
      setMessage("Instale a extensão Freighter para usar sua carteira.");
      return;
    }
    const access = await requestAccess();
    if (access.error || !access.address) {
      setMessage(access.error?.message ?? "A carteira recusou o acesso.");
      return;
    }
    const network = await getNetwork();
    if (network.error || network.network !== "TESTNET") {
      setMessage("Troque a carteira para Stellar Testnet antes de continuar.");
      return;
    }
    const current = await getAddress();
    setAddress(current.address || access.address);
    setMessage("Carteira Testnet conectada.");
  }

  return (
    <section>
      <button type="button" onClick={connect}>Conectar carteira Testnet</button>
      <p>{message}</p>
      {address ? <code>{address}</code> : null}
    </section>
  );
}
```
