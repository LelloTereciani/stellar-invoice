/**
 * Tour visual da aplicação em produção via Playwright.
 * Uso: npx playwright test --config=scripts/tour-live.config.ts
 */

import { chromium } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://portfolio-web3-stellarinvoice.lj9nca.easypanel.host";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../test-results/tour");

async function main() {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  console.log("📸  1/4 — Landing page");
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: true });

  console.log("📸  2/4 — Hover no botão Conectar carteira");
  const connectBtn = page.getByRole("button", { name: /conectar carteira/i });
  if (await connectBtn.isVisible()) {
    await connectBtn.hover();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/02-hover-connect.png` });
  } else {
    console.warn("    Botão de conexão não encontrado");
    await page.screenshot({ path: `${OUT}/02-no-connect.png` });
  }

  console.log("📸  3/4 — Modal / painel de demonstração");
  const demoBtn = page.getByRole("button", { name: /demonstra/i });
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/03-demo-panel.png`, fullPage: true });
  } else {
    console.warn("    Botão demo não encontrado, capturando estado atual");
    await page.screenshot({ path: `${OUT}/03-state.png`, fullPage: true });
  }

  console.log("📸  4/4 — Página de fatura (se acessível sem auth)");
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/04-invoices.png`, fullPage: true });

  await browser.close();
  console.log(`\n✅  Screenshots salvas em: test-results/tour/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
