import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../supabase/migrations/0001_invoices.sql", import.meta.url);

describe("invoice schema migration", () => {
  it("provides the migration required to persist invoices before the API is built", async () => {
    await expect(readFile(fileURLToPath(migrationUrl), "utf8")).resolves.toContain(
      "create table public.invoices",
    );
  });
});
