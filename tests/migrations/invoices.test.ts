import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../supabase/migrations/0001_invoices.sql", import.meta.url);
const receiverMigrationUrl = new URL("../../supabase/migrations/0018_invoice_payment_receiver.sql", import.meta.url);

describe("invoice schema migration", () => {
  it("provides the migration required to persist invoices before the API is built", async () => {
    await expect(readFile(fileURLToPath(migrationUrl), "utf8")).resolves.toContain(
      "create table public.invoices",
    );
  });

  it("backfills the original destination before requiring a payment receiver", async () => {
    const migration = await readFile(fileURLToPath(receiverMigrationUrl), "utf8");

    expect(migration).toContain("alter table public.invoices add column receiver_public_key text;");
    expect(migration).toContain("update public.invoices set receiver_public_key = issuer_public_key where receiver_public_key is null;");
    expect(migration).toContain("alter table public.invoices alter column receiver_public_key set not null;");
    expect(migration).toContain("check (receiver_public_key ~ '^G[A-Z2-7]{55}$');");
  });
});
