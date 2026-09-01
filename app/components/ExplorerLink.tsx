export function stellarExpertTransactionUrl(transactionHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(transactionHash)) throw new Error("Invalid Stellar transaction hash");
  return `https://stellar.expert/explorer/testnet/tx/${transactionHash}`;
}

export function ExplorerLink({ transactionHash }: { transactionHash: string }) {
  return <a href={stellarExpertTransactionUrl(transactionHash)} rel="noreferrer" target="_blank">Abrir no Stellar Expert ↗</a>;
}
