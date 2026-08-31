"use client";

type AppHeaderProps = {
  onConnect: () => void;
  walletPublicKey?: string;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 5)}…${address.slice(-4)}`;
}

export function AppHeader({ onConnect, walletPublicKey }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <a className="brand" href="/" aria-label="StellarInvoice — início">
          <span className="brand__mark" aria-hidden="true">SI</span>
          <span>StellarInvoice</span>
        </a>
        <nav className="main-nav" aria-label="Navegação principal">
          <a aria-current="page" href="/">FATURAS</a>
        </nav>
      </div>
      <div className="topbar__actions">
        <span className="network-badge"><span aria-hidden="true" />TESTNET · BRLT FICTÍCIO</span>
        <button className="button button--secondary wallet-button" type="button" onClick={onConnect}>
          <span aria-hidden="true">◈</span>
          <span className="mono">{walletPublicKey ? shortAddress(walletPublicKey) : "Conectar carteira"}</span>
        </button>
      </div>
    </header>
  );
}
