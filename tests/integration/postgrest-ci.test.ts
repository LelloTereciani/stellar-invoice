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

async function runMigrationStepWithUpgradeFixture() {
  const runBlock = await workflowRunBlock("Apply migrations");
  const testRoot = await mkdtemp(join(tmpdir(), "stellar-invoice-upgrade-fixture-ci-"));
  const statePath = join(testRoot, "state.json");
  try {
    await writeFile(statePath, JSON.stringify({
      rows: [{ memo: "unrelated-fixture" }],
      events: [],
    }));
    await writeFile(join(testRoot, "psql"), `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.CI_WORKFLOW_STATE, "utf8"));
const stop = args.some(arg => arg === "ON_ERROR_STOP=1" || arg === "--set=ON_ERROR_STOP=1");
const fileIndex = args.findIndex(arg => arg === "--file" || arg === "-f");
const commandIndex = args.findIndex(arg => arg === "--command" || arg === "-c");
if (fileIndex >= 0) {
  const filename = path.basename(args[fileIndex + 1]);
  if (filename === "legacy-invoice-before-0018.sql") {
    state.rows.push({ memo: "legacy-before-0018", issuer: "GISSUER", receiver: null });
    state.events.push("fixture-inserted");
  }
  if (filename === "0018_invoice_payment_receiver.sql") {
    const legacy = state.rows.find(row => row.memo === "legacy-before-0018");
    if (legacy) legacy.receiver = legacy.issuer;
    state.events.push("receiver-backfilled");
  }
}
if (commandIndex >= 0) {
  const sql = args[commandIndex + 1];
  const targeted = sql.match(/delete\\s+from\\s+public\\.invoices\\s+where\\s+memo\\s*=\\s*'([^']+)'/i);
  if (/delete\\s+from\\s+public\\.invoices/i.test(sql)) {
    state.rows = targeted ? state.rows.filter(row => row.memo !== targeted[1]) : [];
    state.events.push("fixture-deleted:" + (targeted?.[1] ?? "all") + ":stop=" + stop);
  }
}
fs.writeFileSync(process.env.CI_WORKFLOW_STATE, JSON.stringify(state));
`, { mode: 0o755 });
    await writeFile(join(testRoot, "docker"), `#!${process.execPath}
process.exit(0);
`, { mode: 0o755 });
    await writeFile(join(testRoot, "curl"), `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.CI_WORKFLOW_STATE, "utf8"));
const url = args.find(arg => arg.startsWith("http://") || arg.startsWith("https://")) ?? "";
const legacy = state.rows.find(row => row.memo === "legacy-before-0018");
if (url.includes("select=id")) {
  process.stdout.write(JSON.stringify(legacy ? [{ id: "legacy" }] : []));
} else if (url.includes("issuer_public_key,receiver_public_key")) {
  state.events.push("upgraded-receiver-read");
  fs.writeFileSync(process.env.CI_WORKFLOW_STATE, JSON.stringify(state));
  process.stdout.write(JSON.stringify(legacy ? [{
    issuer_public_key: legacy.issuer,
    receiver_public_key: legacy.receiver,
  }] : []));
} else {
  process.stdout.write("{}");
}
`, { mode: 0o755 });
    const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", runBlock], {
      cwd: projectRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${testRoot}:${process.env.PATH}`,
        CI_WORKFLOW_STATE: statePath,
      },
    });
    const state = JSON.parse(await readFile(statePath, "utf8")) as {
      rows: Array<{ memo: string }>;
      events: string[];
    };
    return { ...result, state };
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

  it("removes only the legacy upgrade fixture after verifying its receiver backfill", async () => {
    const result = await runMigrationStepWithUpgradeFixture();

    expect(result.status).toBe(0);
    expect(result.state.rows).toEqual([{ memo: "unrelated-fixture" }]);
    expect(result.state.events.indexOf("upgraded-receiver-read")).toBeGreaterThan(
      result.state.events.indexOf("receiver-backfilled"),
    );
    expect(result.state.events.at(-1)).toBe("fixture-deleted:legacy-before-0018:stop=true");
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
