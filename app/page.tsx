import { TestnetWallet } from "./components/TestnetWallet.js";

// This shell intentionally exposes no administrative data or secrets.
// Esta estrutura não expõe dados administrativos nem segredos.
export default function HomePage() {
  return (
    <main>
      <h1>StellarInvoice</h1>
      <p>Faturamento B2B na Stellar Testnet.</p>
      <TestnetWallet />
    </main>
  );
}
