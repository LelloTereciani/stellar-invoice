import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const FRIENDBOT_URL = "https://friendbot.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const DEMO_BRL_AMOUNT = "25";
const DEMO_MINIMUM_RESERVE = "100";

type AssetBalance = { asset_code?: string; asset_issuer?: string; balance: string };

function decimalUnits(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) throw new Error("Demo distributor returned an invalid BRLT balance");
  return BigInt(match[1]) * 10_000_000n + BigInt((match[2] ?? "").padEnd(7, "0"));
}

export function assertDemoDistributionReserve(balances: readonly AssetBalance[], issuerPublicKey: string): void {
  const balance = balances.find((candidate) => candidate.asset_code === "BRLT" && candidate.asset_issuer === issuerPublicKey);
  if (!balance) throw new Error("Demo distributor does not have the required BRLT reserve");
  const required = decimalUnits(DEMO_BRL_AMOUNT) + decimalUnits(DEMO_MINIMUM_RESERVE);
  if (decimalUnits(balance.balance) < required) throw new Error("Demo distributor must retain the minimum BRLT reserve");
}

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

export async function prepareDemoBrltDistribution(customerPublicKey: string, issuerPublicKey: string, distributionSecret: string) {
  const server = new Horizon.Server(HORIZON_URL);
  const distributor = Keypair.fromSecret(distributionSecret);
  const source = await server.loadAccount(distributor.publicKey());
  assertDemoDistributionReserve(source.balances, issuerPublicKey);
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
  return { signedXdr: transaction.toXDR(), transactionHash: transaction.hash().toString("hex") };
}

export async function submitPreparedDemoDistribution(signedXdr: string) {
  const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  return new Horizon.Server(HORIZON_URL).submitTransaction(transaction);
}

export async function demoDistributionExists(transactionHash: string): Promise<boolean> {
  try {
    await new Horizon.Server(HORIZON_URL).transactions().transaction(transactionHash).call();
    return true;
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } }).response?.status === 404) return false;
    throw error;
  }
}

export const DEMO_ASSET_AMOUNT = DEMO_BRL_AMOUNT;
