import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Asset, Horizon, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const ASSET_CODE = "BRLT";
const INITIAL_DISTRIBUTION_AMOUNT = "10000";

export type DemoWallets = {
  issuerSecret: string;
  issuerPublicKey: string;
  distributionSecret: string;
  distributionPublicKey: string;
};

type PersistedDemoWallets = Pick<DemoWallets, "issuerSecret" | "distributionSecret">;

export function getOrCreateDemoWallets(saved?: PersistedDemoWallets): DemoWallets {
  const issuer = saved ? Keypair.fromSecret(saved.issuerSecret) : Keypair.random();
  const distribution = saved ? Keypair.fromSecret(saved.distributionSecret) : Keypair.random();

  return {
    issuerSecret: issuer.secret(),
    issuerPublicKey: issuer.publicKey(),
    distributionSecret: distribution.secret(),
    distributionPublicKey: distribution.publicKey(),
  };
}

export function publicBootstrapSummary(wallets: DemoWallets, transactionHash: string) {
  return {
    issuerPublicKey: wallets.issuerPublicKey,
    distributionPublicKey: wallets.distributionPublicKey,
    transactionHash,
  };
}

async function readOrCreateWalletFile(walletPath: string): Promise<DemoWallets> {
  try {
    const saved = JSON.parse(await readFile(walletPath, "utf8")) as PersistedDemoWallets;
    return getOrCreateDemoWallets(saved);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const wallets = getOrCreateDemoWallets();
    await writeFile(
      walletPath,
      `${JSON.stringify(
        { issuerSecret: wallets.issuerSecret, distributionSecret: wallets.distributionSecret },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    );
    await chmod(walletPath, 0o600);
    return wallets;
  }
}

async function fundWithFriendbot(publicKey: string) {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`, { method: "GET" });
  if (!response.ok) throw new Error(`Friendbot could not fund Testnet account (${response.status})`);
}

async function ensureFunded(server: Horizon.Server, publicKey: string) {
  try {
    await server.loadAccount(publicKey);
  } catch (error: unknown) {
    if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
    await fundWithFriendbot(publicKey);
  }
}

async function submitSignedTransaction(
  server: Horizon.Server,
  signer: Keypair,
  addOperation: (builder: TransactionBuilder) => TransactionBuilder,
) {
  const source = await server.loadAccount(signer.publicKey());
  const transaction = addOperation(
    new TransactionBuilder(source, { fee: "100", networkPassphrase: Networks.TESTNET }),
  )
    .setTimeout(180)
    .build();
  transaction.sign(signer);
  return server.submitTransaction(transaction);
}

async function distributionAssetBalance(server: Horizon.Server, distributionPublicKey: string, issuerPublicKey: string) {
  const account = await server.loadAccount(distributionPublicKey);
  const balance = account.balances.find(
    (candidate) =>
      (candidate.asset_type === "credit_alphanum4" || candidate.asset_type === "credit_alphanum12") &&
      candidate.asset_code === ASSET_CODE &&
      candidate.asset_issuer === issuerPublicKey,
  );
  return balance?.balance;
}

async function bootstrap() {
  const walletPath = path.resolve(process.env.STELLAR_DEMO_WALLET_FILE ?? "demo-wallet.json");
  const wallets = await readOrCreateWalletFile(walletPath);
  const server = new Horizon.Server(HORIZON_URL);
  const issuer = Keypair.fromSecret(wallets.issuerSecret);
  const distribution = Keypair.fromSecret(wallets.distributionSecret);

  await ensureFunded(server, issuer.publicKey());
  await ensureFunded(server, distribution.publicKey());

  if (!(await distributionAssetBalance(server, distribution.publicKey(), issuer.publicKey()))) {
    await submitSignedTransaction(server, distribution, (builder) =>
      builder.addOperation(Operation.changeTrust({ asset: new Asset(ASSET_CODE, issuer.publicKey()) })),
    );
  }

  const currentBalance = await distributionAssetBalance(server, distribution.publicKey(), issuer.publicKey());
  const transactionHash =
    Number(currentBalance ?? "0") >= Number(INITIAL_DISTRIBUTION_AMOUNT)
      ? "already-funded"
      : (
          await submitSignedTransaction(server, issuer, (builder) =>
            builder.addOperation(
              Operation.payment({
                destination: distribution.publicKey(),
                asset: new Asset(ASSET_CODE, issuer.publicKey()),
                amount: INITIAL_DISTRIBUTION_AMOUNT,
              }),
            ),
          )
        ).hash;

  // Only public identifiers are printed. / Apenas identificadores públicos são exibidos.
  console.log(JSON.stringify(publicBootstrapSummary(wallets, transactionHash)));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  bootstrap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Testnet bootstrap failed");
    process.exitCode = 1;
  });
}
