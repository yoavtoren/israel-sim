/** Assembles normalized/initial_2026.json: placeholder base overridden with
 *  fetched BoI macro, Open Budget fiscal aggregates, and census sector split.
 *  Also recalibrates dependent constants (working-age share, teacher/bed
 *  budget shares) so stocks are consistent with real budgets.
 *  Run AFTER boi_macro.ts, obudget_budget.ts, cbs_localities.ts. */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataRoot, normalizedDir, today } from "./lib";

const read = (p: string): unknown => JSON.parse(readFileSync(p, "utf8"));

const base = read(join(normalizedDir, "placeholder_initial_2026.json")) as Record<string, unknown>;
const macro = read(join(normalizedDir, "macro_current.json")) as Record<string, { value: number; period: string }>;
const budget = read(join(normalizedDir, "budget_2025.json")) as { debt_interest_ils_m: number; non_ministry_spend_ils_m: number };
const sectors2022 = read(join(normalizedDir, "sector_populations_2022.json")) as { national_total: number; by_sector: Record<string, number> };

const gdp = macro.gdp_nominal_annual.value;

// Population: census 2022 national total grown to 2026Q1 (~3.2y at 1.5%/yr — LOW CONFIDENCE).
const POP_GROWTH = 0.015;
const YEARS_SINCE_CENSUS = 3.2;
const pop2026 = sectors2022.national_total * Math.pow(1 + POP_GROWTH, YEARS_SINCE_CENSUS);
const censusCovered = Object.values(sectors2022.by_sector).reduce((a, b) => a + b, 0);
const sectorScale = pop2026 / censusCovered;

// Debt: no BoI SDMX debt-stock series; MoF Accountant General ~69% of GDP end-2024 — LOW CONFIDENCE.
const DEBT_GDP = 0.69;
const debt = DEBT_GDP * gdp;
const debtEffectiveRate = (budget.debt_interest_ils_m) / debt; // published interest bill / debt stock

const m = base.macro as Record<string, number>;
m.gdp_real = gdp;
m.gdp_potential = gdp;
m.inflation = macro.inflation_yoy.value;
m.policy_rate = macro.policy_rate.value;
m.unemployment = macro.unemployment.value;
if (macro.participation) m.participation = macro.participation.value;
m.debt_gdp = DEBT_GDP;
m.bond_yield_10y = macro.bond_yield_10y.value;
m.shekel_usd = macro.shekel_usd.value;
m.capital_stock = Math.round(4.0 * gdp); // K/Y = 4.0 placeholder ratio

const fiscal = base.fiscal as Record<string, unknown>;
fiscal.debt_effective_rate = +debtEffectiveRate.toFixed(5);

const baseSectors = base.sectors as Record<string, Record<string, unknown>>;
for (const [id, sec] of Object.entries(baseSectors)) {
  const census = sectors2022.by_sector[id];
  if (census !== undefined) sec.population = Math.round(census * sectorScale);
}

writeFileSync(join(normalizedDir, "initial_2026.json"), JSON.stringify(base, null, 1));
writeFileSync(join(normalizedDir, "initial_2026.sidecar.json"), JSON.stringify({
  id: "israel-sim.initial_state.2026",
  source_url: "assembled from macro_current.json (BoI), budget_2025.json (Open Budget), sector_populations_2022.json (CBS census)",
  retrieved: today(),
  license: "mixed open data; see component sidecars",
  rows: 1,
  schema: { shape: "InitialStateJson (packages/engine/src/state/init.ts)" },
  known_gaps: [
    `REAL (fetched): gdp_real ₪${Math.round(gdp / 1000)}B (${macro.gdp_nominal_annual.period}), inflation, policy_rate, unemployment, bond_yield_10y, shekel_usd${macro.participation ? ", participation" : ""}; ministry baselines & non-ministry spend & revenue shares (budget 2025); sector populations (census 2022 religiosity split).`,
    `IMPUTED: population grown from census 2022 at ${POP_GROWTH * 100}%/yr for ${YEARS_SINCE_CENSUS}y → ${Math.round(pop2026)}; debt/GDP=${DEBT_GDP} (MoF ~69% end-2024, not fetched); K/Y=4.0; debt_effective_rate = published interest / imputed debt = ${(debtEffectiveRate * 100).toFixed(2)}%.`,
    "CARRIED PLACEHOLDERS: security, diplomacy, politics, infrastructure stocks, environment, sector attributes other than population, fx_reserves, gini, poverty, credit_rating.",
    "GDP is nominal (current prices); engine treats t0 prices as base — acceptable until M9 deflator work.",
  ],
  transform_script: "packages/data/etl/build_initial_state.ts",
}, null, 2));
console.log(`wrote normalized/initial_2026.json (pop ${Math.round(pop2026)}, gdp ${Math.round(gdp)}₪M, debt_eff_rate ${(debtEffectiveRate * 100).toFixed(2)}%)`);

// --- Recalibrate dependent constants in place ---
type Entry = { id: string; value: number; unit?: string; confidence?: string; source: string };
function patchConstants(file: string, patches: Record<string, { value: number; source: string; confidence: string }>): void {
  const path = join(dataRoot, "constants", file);
  const entries = read(path) as Entry[];
  for (const e of entries) {
    const p = patches[e.id];
    if (p) { e.value = p.value; e.source = p.source; e.confidence = p.confidence; }
  }
  writeFileSync(path, JSON.stringify(entries, null, 1));
  console.log(`patched constants/${file}: ${Object.keys(patches).join(", ")}`);
}

const src = `derived ${today()} from BoI LBM / budget 2025 so baseline funding sustains current stocks`;
patchConstants("macro.json", {
  "macro.working_age_share": {
    value: +(macro.workage_population.value / pop2026).toFixed(4),
    source: `BoI LBM work-age population (${macro.workage_population.period}) / imputed 2026 population`,
    confidence: "medium",
  },
});

// teacher/bed budget shares: share = stock × cost_per_unit / real baseline budget.
const infra = (base.infrastructure as Record<string, number>);
const defs = read(join(dataRoot, "defs", "ministries.json")) as Array<{ id: string; baseline_budget: number }>;
const bud = (id: string): number => defs.find((d) => d.id === id)!.baseline_budget;
const eduConsts = read(join(dataRoot, "constants", "education.json")) as Entry[];
const healthConsts = read(join(dataRoot, "constants", "health.json")) as Entry[];
const costTeacher = eduConsts.find((e) => e.id === "education.cost_per_teacher_annual")!.value;
const costBed = healthConsts.find((e) => e.id === "health.cost_per_bed_annual")!.value;
patchConstants("education.json", {
  "education.teacher_budget_share": { value: +((infra.teachers * costTeacher) / bud("education")).toFixed(4), source: src, confidence: "placeholder" },
});
patchConstants("health.json", {
  "health.bed_budget_share": { value: +((infra.hospital_beds * costBed) / bud("health")).toFixed(4), source: src, confidence: "placeholder" },
});
