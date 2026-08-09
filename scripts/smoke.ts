/** Headless smoke run: 10 simulated years, zero-change decisions.
 *  Prints per-year headline figures and enforces the sanity rules.
 *  Exit 1 on any violation. Run with: pnpm smoke */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInitialState, buildRegistry, parseMinistryDefs, tick, totalPopulation, totalSpend,
  type InitialStateJson, type LocalityInitRow, type WorldState,
} from "../packages/engine/src/index";
import type { EngineContext } from "../packages/engine/src/tick";

const dataDir = fileURLToPath(new URL("../packages/data", import.meta.url));
const constantsDir = join(dataDir, "constants");
const groups: unknown[][] = readdirSync(constantsDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(join(constantsDir, f), "utf8")) as unknown[]);
const registry = buildRegistry(groups);
const ministries = parseMinistryDefs(JSON.parse(readFileSync(join(dataDir, "defs", "ministries.json"), "utf8")));
const initialRaw = JSON.parse(readFileSync(join(dataDir, "normalized", "initial_2026.json"), "utf8")) as InitialStateJson;
const localityRows = JSON.parse(readFileSync(join(dataDir, "normalized", "localities.json"), "utf8")) as LocalityInitRow[];
const initial = buildInitialState(initialRaw, ministries, registry, "smoke-seed", { localities: localityRows });
const ctx: EngineContext = { registry, ministries, start_year: initialRaw.start_year };

let violations = 0;
function check(ok: boolean, msg: string): void {
  if (!ok) {
    violations++;
    console.error(`  SANITY VIOLATION: ${msg}`);
  }
}

function walkNumbers(value: unknown, prefix: string, visit: (path: string, v: number) => void): void {
  if (typeof value === "number") { visit(prefix, value); return; }
  if (typeof value !== "object" || value === null) return;
  for (const [k, v] of Object.entries(value)) walkNumbers(v, `${prefix}.${k}`, visit);
}

console.log("year  GDP(₪B)  debt/GDP  unemp  pop(M)  spend(₪B)");
let s: WorldState = initial;
let prev: WorldState = initial;
for (let i = 0; i < 40; i++) {
  prev = s;
  s = tick(s, {}, ctx).state;

  walkNumbers(s, "state", (path, v) => check(Number.isFinite(v), `${path} = ${v}`));
  for (const [cls, v] of Object.entries(s.security.stockpiles)) check(v >= 0, `stockpile ${cls} negative`);
  check(s.infrastructure.teachers >= 0 && s.infrastructure.hospital_beds >= 0, "negative infrastructure stock");
  check(s.macro.capital_stock >= 0 && s.fiscal.debt >= 0, "negative capital or debt");

  const popGrowthAnnual = Math.pow(totalPopulation(s) / totalPopulation(prev), 4) - 1;
  check(Math.abs(popGrowthAnnual) < 0.02, `population moving ${(popGrowthAnnual * 100).toFixed(2)}%/yr`);

  for (const p of ["macro.gdp_real", "macro.debt_gdp", "infrastructure.teachers", "security.force_readiness"]) {
    const get = (st: WorldState): number => p.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)[k], st) as number;
    const rel = Math.abs(get(s) - get(prev)) / Math.abs(get(prev));
    check(rel < 0.5, `${p} moved ${(rel * 100).toFixed(1)}% in one tick`);
  }

  if (s.t.quarter === 1) {
    const spend = totalSpend(s) + registry.get("fiscal.non_ministry_spend_annual") + s.fiscal.debt_service;
    console.log(
      `${(s.t.year - 1).toString().padEnd(5)} ${(s.macro.gdp_real / 1000).toFixed(0).padStart(7)} ` +
      `${(s.macro.debt_gdp * 100).toFixed(1).padStart(8)}% ${(s.macro.unemployment * 100).toFixed(2).padStart(5)}% ` +
      `${(totalPopulation(s) / 1e6).toFixed(2).padStart(6)} ${(spend / 1000).toFixed(0).padStart(9)}`,
    );
  }
}

if (violations > 0) {
  console.error(`\nsmoke: FAILED with ${violations} violation(s)`);
  process.exit(1);
}
console.log("\nsmoke: OK (10y, no NaN/Inf, no negative stocks, population within ±2%/yr, no >50% tick moves)");
