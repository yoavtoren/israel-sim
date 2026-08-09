/** M9 sensitivity sweep (spec §12.3): perturb every constant ±1 SD (from its
 *  ci when present, else ±20%), run 10 years, measure the response of seven
 *  headline outputs. Ranks the coefficients that dominate outcomes — those
 *  deserve real econometric work first. Writes docs/SENSITIVITY.md. Offline. */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataRoot, normalizedDir } from "./lib";
import {
  buildInitialState, buildRegistry, parseEventDefs, parseMinistryDefs, parseModelDefs, parseReformDefs,
  tick, withOverrides,
  type ConstantEntry, type InitialStateJson, type LocalityInitRow, type Registry, type WorldState,
} from "../../engine/src/index";
import type { EngineContext } from "../../engine/src/tick";

const constantsDir = join(dataRoot, "constants");
const groups = readdirSync(constantsDir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(constantsDir, f), "utf8")) as unknown[]);
const registry = buildRegistry(groups);
const ministries = parseMinistryDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "ministries.json"), "utf8")));
const events = parseEventDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "events.json"), "utf8")));
const reforms = parseReformDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "reforms.json"), "utf8")));
const models = parseModelDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "economic_models.json"), "utf8")));
const raw = JSON.parse(readFileSync(join(normalizedDir, "initial_2026.json"), "utf8")) as InitialStateJson;
const localities = JSON.parse(readFileSync(join(normalizedDir, "localities.json"), "utf8")) as LocalityInitRow[];

function outputs(s: WorldState): number[] {
  return [
    s.macro.gdp_real, s.macro.debt_gdp, s.macro.unemployment, s.macro.poverty_rate,
    s.politics.social_cohesion, s.security.force_readiness, s.macro.human_capital,
  ];
}
const OUTPUT_NAMES = ["gdp", "debt_gdp", "unemployment", "poverty", "cohesion", "readiness", "human_capital"];

function run(reg: Registry): number[] {
  const ctx: EngineContext = { registry: reg, ministries, events, reforms, models, start_year: raw.start_year };
  let s = buildInitialState(raw, ministries, reg, "sweep-seed", { localities });
  for (let i = 0; i < 40; i++) s = tick(s, {}, ctx).state;
  return outputs(s);
}

const base = run(registry);
console.log("baseline outputs:", OUTPUT_NAMES.map((n, i) => `${n}=${base[i].toFixed(3)}`).join(" "));

interface Row { id: string; confidence: string; sd_rel: number; sensitivity: number; top_output: string }
const rows: Row[] = [];
const entries = registry.all();
const t0 = performance.now();
for (const e of entries) {
  const sd = e.ci ? (e.ci[1] - e.ci[0]) / 4 : Math.abs(e.value) * 0.2;
  if (sd === 0 || e.value === 0) continue;
  const rel = sd / Math.abs(e.value);
  const up = run(withOverrides(registry, { [e.id]: e.value + sd }));
  const dn = run(withOverrides(registry, { [e.id]: e.value - sd }));
  let worst = 0;
  let worstIdx = 0;
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    const d = (Math.abs(up[i] - base[i]) + Math.abs(dn[i] - base[i])) / 2 / Math.abs(base[i]);
    sum += d;
    if (d > worst) { worst = d; worstIdx = i; }
  }
  rows.push({ id: e.id, confidence: e.confidence, sd_rel: rel, sensitivity: sum / base.length / rel, top_output: OUTPUT_NAMES[worstIdx] });
}
console.log(`${rows.length} constants swept in ${((performance.now() - t0) / 1000).toFixed(0)}s`);

rows.sort((a, b) => b.sensitivity - a.sensitivity);
const lines = [
  "# SENSITIVITY — ±1 SD sweep over all constants (spec §12.3)",
  "",
  "Sensitivity = mean relative change across 7 headline outputs (GDP, debt/GDP, unemployment, poverty, cohesion, readiness, human capital) after a 10-year zero-change run, per unit relative parameter change. SD from the constant's ci where present, else ±20%.",
  "",
  "Hazard-driven runs share one seed; rankings are indicative, not exact. **The top rows with `placeholder` confidence are the priority list for real econometric work.**",
  "",
  "| rank | constant | confidence | sensitivity | dominates |",
  "|---|---|---|---|---|",
  ...rows.slice(0, 30).map((r, i) => `| ${i + 1} | \`${r.id}\` | ${r.confidence} | ${r.sensitivity.toFixed(3)} | ${r.top_output} |`),
  "",
  `Swept ${rows.length} constants. Bottom ${rows.filter((r) => r.sensitivity < 0.01).length} have sensitivity <0.01 — rough values are fine there (spec §12.3).`,
];
writeFileSync(join(dataRoot, "..", "..", "docs", "SENSITIVITY.md"), lines.join("\n") + "\n");
console.log("wrote docs/SENSITIVITY.md — top 10:");
for (const r of rows.slice(0, 10)) console.log(`  ${r.id} (${r.confidence}) ${r.sensitivity.toFixed(3)} → ${r.top_output}`);
