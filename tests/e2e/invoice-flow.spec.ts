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

test("resumes an existing browser demo wallet without requesting another BRLT allowance", async ({ page }) => {
  const wallet = Keypair.random();
  const invoiceId = "00000000-0000-4000-8000-000000000123";

  await page.addInitScript(({ key, secret }) => localStorage.setItem(key, secret), {
    key: DEMO_STORAGE_KEY,
    secret: wallet.secret(),
  });
  await page.route(/\/api\/auth\/challenge$/, async (route) => route.fulfill({
    body: JSON.stringify({
      expiresAt: "2030-01-01T00:05:00.000Z",
      id: "resume-challenge",
      message: "resume this demo wallet",
    }),
    contentType: "application/json",
  }));
  await page.route(/\/api\/auth\/verify$/, async (route) => route.fulfill({
    body: JSON.stringify({ authenticated: true, walletPublicKey: wallet.publicKey() }),
    contentType: "application/json",
  }));
  await page.route(/\/api\/demo\/resume$/, async (route) => route.fulfill({
    body: JSON.stringify({ invoiceId }),
    contentType: "application/json",
  }));
  await page.route(new RegExp(`/api/invoices/${invoiceId}$`), async (route) => route.fulfill({
    body: JSON.stringify({ error: "Authentication refresh in progress" }),
    contentType: "application/json",
    status: 401,
  }));

  await page.goto("/");
  const continueButton = page.getByRole("button", { name: "Continuar demonstração" });
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  await expect(page).toHaveURL(new RegExp(`/invoices/${invoiceId}$`));
});

test("reuses a stored wallet that was saved before initial demo provisioning completed", async ({ page }) => {
  const wallet = Keypair.random();
  let provisionRequests = 0;

  await page.addInitScript(({ key, secret }) => localStorage.setItem(key, secret), {
    key: DEMO_STORAGE_KEY,
    secret: wallet.secret(),
  });
  await page.route(/\/api\/auth\/challenge$/, async (route) => route.fulfill({
    body: JSON.stringify({
      expiresAt: "2030-01-01T00:05:00.000Z",
      id: "resume-challenge",
      message: "resume this demo wallet",
    }),
    contentType: "application/json",
  }));
  await page.route(/\/api\/auth\/verify$/, async (route) => route.fulfill({
    body: JSON.stringify({ authenticated: true, walletPublicKey: wallet.publicKey() }),
    contentType: "application/json",
  }));
  await page.route(/\/api\/demo\/resume$/, async (route) => route.fulfill({
    body: JSON.stringify({
      code: "DEMO_NOT_PROVISIONED",
      error: "Esta carteira demo ainda não recebeu BRLT fictício.",
    }),
    contentType: "application/json",
    status: 409,
  }));
  await page.route(/\/api\/demo\/provision$/, async (route) => {
    provisionRequests += 1;
    await route.fulfill({
      body: JSON.stringify({ error: "Provisionamento inicial retomado pelo teste." }),
      contentType: "application/json",
      status: 400,
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Continuar demonstração" }).click();

  await expect.poll(() => provisionRequests).toBe(1);
  await expect(page.getByText("Provisionamento inicial retomado pelo teste.")).toBeVisible();
});

test("reviews and signs the exact demo invoice in the browser before verification", async ({ page }) => {
  const wallet = Keypair.random();
  const issuer = Keypair.random().publicKey();
  const invoice = {
    amount: "5.0000000",
    assetIssuer: issuer,
    confirmedTransactionHash: null,
    createdAt: "2029-01-01T00:00:00.000Z",
    debtorPublicKey: wallet.publicKey(),
    dueAt: "2030-09-30T23:59:00.000Z",
    id: "demo-invoice",
    issuerPublicKey: issuer,
    memo: "demo-payment",
    preparedPaymentExpiresAt: null,
    preparedPaymentHash: null,
    preparedPaymentXdr: null,
    rejectedAttempts: [],
    status: "pending",
  };
  const xdr = new TransactionBuilder(new Account(wallet.publicKey(), "10"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addMemo(Memo.text(invoice.memo))
    .addOperation(Operation.payment({ amount: invoice.amount, asset: new Asset("BRLT", issuer), destination: issuer }))
    .setTimeout(180)
    .build()
    .toXDR();
  const transactionHash = TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString("hex");
  let horizonSubmissions = 0;
  let verificationAttempts = 0;

  await page.addInitScript(({ key, secret }) => localStorage.setItem(key, secret), { key: DEMO_STORAGE_KEY, secret: wallet.secret() });
  await page.route(/\/api\/invoices\/demo-invoice$/, async (route) => route.fulfill({ body: JSON.stringify(invoice), contentType: "application/json" }));
  await page.route(/\/api\/invoices\/demo-invoice\/payment$/, async (route) => route.fulfill({ body: JSON.stringify({ preparedTransactionHash: transactionHash, xdr }), contentType: "application/json" }));
  await page.route(/\/api\/invoices\/demo-invoice\/verify$/, async (route) => {
    verificationAttempts += 1;
    await route.fulfill(verificationAttempts === 1
      ? { body: JSON.stringify({ error: "Temporary verification failure" }), contentType: "application/json", status: 503 }
      : { body: JSON.stringify({ status: "confirmed" }), contentType: "application/json" });
  });
  await page.route("https://horizon-testnet.stellar.org/transactions", async (route) => {
    horizonSubmissions += 1;
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
  await expect(page.getByText("Temporary verification failure")).toBeVisible();
  await expect(pay).toBeEnabled();
  await pay.click();
  await expect(page.getByText("Pagamento confirmado no ledger da Stellar.")).toBeVisible();
  await expect(page.getByText(transactionHash, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir no Stellar Expert ↗" })).toHaveAttribute("href", `https://stellar.expert/explorer/testnet/tx/${transactionHash}`);
  expect(horizonSubmissions).toBe(1);
});
