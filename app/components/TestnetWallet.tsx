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
