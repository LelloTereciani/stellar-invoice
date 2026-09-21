import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

async function workflowRunBlock(stepName: string): Promise<string> {
  const workflow = await readFile(join(projectRoot, ".github/workflows/ci.yml"), "utf8");
  const lines = workflow.split("\n");
  const stepIndex = lines.indexOf(`      - name: ${stepName}`);
  if (stepIndex < 0 || lines[stepIndex + 1] !== "        run: |") {
    throw new Error(`${stepName} CI step is missing`);
  }
  const runLines: string[] = [];
  for (const line of lines.slice(stepIndex + 2)) {
    if (line.startsWith("          ")) runLines.push(line.slice(10));
    else if (line === "") runLines.push("");
    else break;
  }
  return runLines.join("\n");
}

async function runMigrationStepWithFirstSqlFailure() {
  const runBlock = await workflowRunBlock("Apply migrations");
  const testRoot = await mkdtemp(join(tmpdir(), "stellar-invoice-migration-ci-"));
  try {
    await writeFile(join(testRoot, "psql"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const stop = args.some(arg => arg === "ON_ERROR_STOP=1" || arg === "--set=ON_ERROR_STOP=1");
fs.appendFileSync(process.env.CI_MIGRATION_CAPTURE, args.join(" ") + "\\n");
process.stderr.write("ERROR: migration statement failed\\n");
process.exit(stop ? 3 : 0);
`, { mode: 0o755 });
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", runBlock], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${testRoot}:${process.env.PATH}`,
        CI_MIGRATION_CAPTURE: join(testRoot, "migrations"),
      },
    });
    const invocations = await readFile(join(testRoot, "migrations"), "utf8");
    return { ...result, invocations };
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
}

async function runSentinelStep(failSql: boolean) {
  const runBlock = await workflowRunBlock("Verify exact decimal through real PostgREST JSON");
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
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", runBlock], {
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
  it("stops the main migration loop at the first SQL statement failure", async () => {
    const result = await runMigrationStepWithFirstSqlFailure();

    expect(result.status).toBe(3);
    expect(result.invocations.trim().split("\n")).toHaveLength(1);
    expect(result.invocations).toContain("ON_ERROR_STOP=1");
  });

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
