import { expect, test } from "@playwright/test";
import { Account, Asset, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const DEMO_STORAGE_KEY = "stellar-invoice-demo-customer-secret";

test("renders the Testnet portal without horizontal overflow on desktop and mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Portal de Faturamento" })).toBeVisible();
  await expect(page.getByText("TESTNET · BRLT FICTÍCIO")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar demonstração automática" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Portal de Faturamento" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("reviews and signs the exact demo invoice in the browser before verification", async ({ page }) => {
  const wallet = Keypair.random();
  const issuer = Keypair.random().publicKey();
  const transactionHash = "a".repeat(64);
  const invoice = {
    amount: "5.0000000",
    assetIssuer: issuer,
    confirmedTransactionHash: null,
    debtorPublicKey: wallet.publicKey(),
    dueAt: "2030-09-30T23:59:00.000Z",
    id: "demo-invoice",
    issuerPublicKey: issuer,
    memo: "demo-payment",
    rejectedAttempts: [],
    status: "pending",
  };
  const xdr = new TransactionBuilder(new Account(wallet.publicKey(), "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addMemo(Memo.text(invoice.memo))
    .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: issuer }))
    .setTimeout(300)
    .build()
    .toXDR();

  await page.addInitScript(({ key, secret }) => localStorage.setItem(key, secret), { key: DEMO_STORAGE_KEY, secret: wallet.secret() });
  await page.route(/\/api\/invoices\/demo-invoice$/, async (route) => route.fulfill({ body: JSON.stringify(invoice), contentType: "application/json" }));
  await page.route(/\/api\/invoices\/demo-invoice\/payment$/, async (route) => route.fulfill({ body: JSON.stringify({ xdr }), contentType: "application/json" }));
  await page.route(/\/api\/invoices\/demo-invoice\/verify$/, async (route) => route.fulfill({ body: JSON.stringify({ status: "confirmed" }), contentType: "application/json" }));
  await page.route("https://horizon-testnet.stellar.org/transactions", async (route) => {
    const encoded = new URLSearchParams(route.request().postData() ?? "").get("tx");
    expect(encoded).toBeTruthy();
    expect(TransactionBuilder.fromXDR(encoded!, Networks.TESTNET).signatures).toHaveLength(1);
    await route.fulfill({ body: JSON.stringify({ hash: transactionHash }), contentType: "application/json" });
  });

  await page.goto("/invoices/demo-invoice");
  await expect(page.getByText("5.0000000 BRLT", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(wallet.publicKey(), { exact: true }).first()).toBeVisible();
  await expect(page.getByText(issuer, { exact: true }).first()).toBeVisible();
  const pay = page.getByRole("button", { name: "Revisar e assinar pagamento →" });
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.getByText("Pagamento confirmado no ledger da Stellar.")).toBeVisible();
  await expect(page.getByText(transactionHash, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir no Stellar Expert ↗" })).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${transactionHash}`);
});
