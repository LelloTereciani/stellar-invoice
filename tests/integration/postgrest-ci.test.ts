import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function runSentinelStep(failSql: boolean) {
  const workflow = await readFile(join(projectRoot, ".github/workflows/ci.yml"), "utf8");
  const runBlock = workflow.match(
    /      - name: Verify exact decimal through real PostgREST JSON\n        run: \|\n((?:          .*\n)+)/,
  )?.[1];
  if (!runBlock) throw new Error("PostgREST CI step is missing");
  const testRoot = await mkdtemp(join(tmpdir(), "stellar-invoice-postgrest-ci-"));
  try {
    // Only the unavailable external commands are doubled; execute the actual CI shell.
    // Apenas comandos externos indisponiveis sao substituidos; o shell real do CI roda.
    await writeFile(join(testRoot, "psql"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const fileIndex = args.findIndex(arg => arg === "--file" || arg === "-f");
const sql = fileIndex < 0 ? fs.readFileSync(0, "utf8") : fs.readFileSync(args[fileIndex + 1], "utf8");
fs.writeFileSync(process.env.CI_SQL_CAPTURE, sql);
const stop = args.some(arg => arg === "ON_ERROR_STOP=1" || arg === "--set=ON_ERROR_STOP=1") || /\\\\set\\s+ON_ERROR_STOP\\s+(?:on|1)/i.test(sql);
if (process.env.CI_SQL_FAIL === "yes") {
  process.stderr.write("ERROR: integration sentinel insert failed\\n");
  process.exit(stop ? 3 : 0);
}
`, { mode: 0o755 });
    await writeFile(join(testRoot, "docker"), `#!${process.execPath}
require("node:fs").writeFileSync(process.env.CI_DOCKER_CAPTURE, "started");
process.exit(99);
`, { mode: 0o755 });
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", runBlock.replace(/^          /gm, "")], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${testRoot}:${process.env.PATH}`,
        CI_SQL_CAPTURE: join(testRoot, "sql"),
        CI_DOCKER_CAPTURE: join(testRoot, "docker-started"),
        CI_SQL_FAIL: failSql ? "yes" : "no",
      },
    });
    const sql = await readFile(join(testRoot, "sql"), "utf8");
    const postgrestStarted = await readFile(join(testRoot, "docker-started"), "utf8").then(() => true, () => false);
    return { ...result, sql, postgrestStarted };
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

describe("PostgREST database CI consumer", () => {
  it("supplies a valid distinct receiver and the exact-decimal sentinel to psql", async () => {
    const result = await runSentinelStep(false);
    expect(result.status).toBe(99);
    expect(result.postgrestStarted).toBe(true);
    const insert = result.sql.match(/insert into public\.invoices\s*\(([^)]+)\)\s*values\s*\(([\s\S]*?)\);/i);
    if (!insert) throw new Error("CI did not send an invoice insert to psql");
    const columns = insert[1].split(",").map(value => value.trim());
    const values = insert[2].split(",").map(value => value.trim().replace(/^'|'$/g, ""));
    const invoice = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
    expect(StrKey.isValidEd25519PublicKey(invoice.receiver_public_key ?? "")).toBe(true);
    expect(invoice.receiver_public_key).not.toBe(invoice.issuer_public_key);
    expect(invoice.receiver_public_key).not.toBe(invoice.debtor_public_key);
    expect(invoice.asset_issuer).toBe(invoice.issuer_public_key);
    expect(invoice.amount).toBe("1234567890123.1234567");
    expect(invoice.memo).toBe("postgrest-exact");
  });

  it("stops at a sentinel SQL error before starting PostgREST", async () => {
    const result = await runSentinelStep(true);
    expect(result.status).toBe(3);
    expect(result.postgrestStarted).toBe(false);
  });
});
