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
    expect(migration.indexOf("update public.invoices set receiver_public_key")).toBeLessThan(
      migration.indexOf("alter table public.invoices alter column receiver_public_key set not null"),
    );
  });

  it("applies the receiver migration as one atomic transaction", async () => {
    const migration = await readFile(fileURLToPath(receiverMigrationUrl), "utf8");
    const statements = migration
      .split(";")
      .map((statement) => statement.trim().toLowerCase())
      .filter(Boolean);

    expect(statements[0]).toBe("begin");
    expect(statements.at(-1)).toBe("commit");
  });

  it("reloads an already-warm PostgREST schema cache only when the migration commits", async () => {
    const migration = await readFile(fileURLToPath(receiverMigrationUrl), "utf8");
    const normalized = migration.toLowerCase();

    expect(normalized).toContain("notify pgrst, 'reload schema';");
    expect(normalized.indexOf("notify pgrst, 'reload schema';")).toBeLessThan(
      normalized.lastIndexOf("commit;"),
    );
  });

  it("replaces the demo invoice RPC with a receiver-bound service-role-only signature", async () => {
    const migration = await readFile(fileURLToPath(receiverMigrationUrl), "utf8");
    const normalized = migration.replace(/\s+/g, " ");

    expect(migration).toContain("demo_receiver_public_key text");
    expect(migration).toContain("or demo_receiver_public_key !~ '^G[A-Z2-7]{55}$'");
    expect(migration).toContain("or demo_customer_public_key = demo_issuer_public_key");
    expect(migration).toContain("or demo_customer_public_key = demo_receiver_public_key");
    expect(migration).toContain("or demo_issuer_public_key = demo_receiver_public_key");
    expect(migration).toContain("receiver_public_key");
    expect(migration).toContain("values (demo_customer_public_key, demo_issuer_public_key, demo_receiver_public_key");
    expect(migration).toContain("drop function public.ensure_demo_invoice(text, text, numeric, text, timestamptz)");
    expect(normalized).toContain("revoke execute on function public.ensure_demo_invoice(text, text, numeric, text, timestamptz) from public, anon, authenticated, service_role");
    expect(normalized).toContain("revoke execute on function public.ensure_demo_invoice(text, text, text, numeric, text, timestamptz) from public, anon, authenticated");
    expect(normalized).toContain("grant execute on function public.ensure_demo_invoice(text, text, text, numeric, text, timestamptz) to service_role");
  });
});
