import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const DEMO_BRL_AMOUNT = "25";

async function fundWithFriendbot(publicKey: string) {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`);
  if (!response.ok) throw new Error("Friendbot could not fund the Testnet wallet");
}

export async function fundDemoWallet(publicKey: string) {
  const server = new Horizon.Server(HORIZON_URL);
  try {
    await server.loadAccount(publicKey);
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
    await fundWithFriendbot(publicKey);
  }
}

export async function distributeDemoBrlt(customerPublicKey: string, issuerPublicKey: string, distributionSecret: string) {
  const server = new Horizon.Server(HORIZON_URL);
  const distributor = Keypair.fromSecret(distributionSecret);
  const source = await server.loadAccount(distributor.publicKey());
  const transaction = new TransactionBuilder(source, { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(
      Operation.payment({
        destination: customerPublicKey,
        asset: new Asset("BRLT", issuerPublicKey),
        amount: DEMO_BRL_AMOUNT,
      }),
    )
    .setTimeout(180)
    .build();
  transaction.sign(distributor);
  return server.submitTransaction(transaction);
}

export const DEMO_ASSET_AMOUNT = DEMO_BRL_AMOUNT;
