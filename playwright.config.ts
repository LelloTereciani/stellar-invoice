import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3210",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3210",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:3210",
  },
  workers: process.env.CI ? 1 : undefined,
});
