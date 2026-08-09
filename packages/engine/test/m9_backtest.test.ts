/** M9 gate: 2000→2025 macro backtest with GDP-tracking budgets and known
 *  exogenous shocks (2001 recession, 2008 crisis, COVID, 2023-24 war).
 *  MAPE reported per series against BoI/MoF/NII history. Honest misses are
 *  reported, not hidden (spec §12.2). */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildInitialState, buildRegistry, parseEventDefs, parseMinistryDefs, parseModelDefs, parseReformDefs,
  tick, withOverrides, type Decisions, type InitialStateJson, type MinistryDef, type WorldState,
} from "../src/index";
import type { EngineContext } from "../src/tick";
import { readdirSync } from "node:fs";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const read = (rel: string): unknown => JSON.parse(readFileSync(join(dataDir, rel), "utf8"));

interface HistoryRow { year: number; real_gdp_index: number | null; unemployment: number | null; debt_gdp: number; poverty: number }
const history = read("normalized/history/macro_history.json") as HistoryRow[];

describe("M9: 2000→2025 macro backtest", () => {
  it("GATE: MAPE reported per series; bands enforced", () => {
    // --- Context with era-scaled data ---
    const constantsDir = join(dataDir, "constants");
    const groups = readdirSync(constantsDir).filter((f) => f.endsWith(".json")).sort()
      .map((f) => JSON.parse(readFileSync(join(constantsDir, f), "utf8")) as unknown[]);
    const baseRegistry = buildRegistry(groups);
    const baseDefs = parseMinistryDefs(read("defs/ministries.json"));
    const events = parseEventDefs(read("defs/events.json"));
    const reforms = parseReformDefs(read("defs/reforms.json"));
    const models = parseModelDefs(read("defs/economic_models.json"));

    const raw = structuredClone(read("normalized/initial_2026.json")) as InitialStateJson;
    const h2000 = history.find((r) => r.year === 2000)!;
    const h2025 = history.find((r) => r.year === 2025)!;
    const gdp2000 = raw.macro.gdp_real * (h2000.real_gdp_index! / h2025.real_gdp_index!);
    const gdpScale = gdp2000 / raw.macro.gdp_real;
    const popScale = 6.29e6 / Object.values(raw.sectors).reduce((a, s) => a + s.population, 0);

    raw.macro.gdp_real = gdp2000;
    raw.macro.gdp_potential = gdp2000;
    raw.macro.unemployment = h2000.unemployment!;
    raw.macro.debt_gdp = h2000.debt_gdp;
    raw.macro.poverty_rate = h2000.poverty;
    raw.macro.capital_stock = 2.6 * gdp2000;
    raw.macro.inflation = 0.03;
    for (const sec of Object.values(raw.sectors)) sec.population *= popScale;
    const infra = raw.infrastructure;
    for (const k of ["teachers", "hospital_beds", "icu_beds", "classrooms", "housing_stock", "housing_starts"] as const) {
      infra[k] *= popScale;
    }
    infra.desalination_capacity_mcm = 100;
    for (const cls of Object.keys(raw.security.stockpiles) as Array<keyof typeof raw.security.stockpiles>) {
      raw.security.stockpiles[cls] *= popScale;
    }

    const scaledDefs = (factor: number): MinistryDef[] =>
      baseDefs.map((d) => ({ ...d, baseline_budget: d.baseline_budget * factor }));
    const scaledRegistry = (factor: number) =>
      withOverrides(baseRegistry, { "fiscal.non_ministry_spend_annual": baseRegistry.get("fiscal.non_ministry_spend_annual") * factor });

    let ctx: EngineContext = { registry: scaledRegistry(gdpScale), ministries: scaledDefs(gdpScale), events, reforms, models, start_year: 2000 };
    let s: WorldState = buildInitialState(raw, ctx.ministries, ctx.registry, "m9-backtest", { startYear: 2000 });
    // Backtest-era tax level: 2000s tax/GDP ran well above the 2025-calibrated
    // shares (consolidation era; tax/GDP ~34% in 2000 vs ~30% today). 1.08× is
    // a conservative approximation — without it era deficits are overstated
    // and debt/GDP cannot fall the way it actually did.
    s.fiscal.tax_policy.revenue_multiplier = 1.08;

    // --- Run 2000→2025: budgets track GDP; known shocks injected ---
    const sim: Record<number, { gdp: number; u: number; debt: number; pov: number }> = {};
    for (let q = 0; q < 26 * 4; q++) {
      let decisions: Decisions = {};
      if (s.t.quarter === 1) {
        const factor = gdpScale * (s.macro.gdp_real / gdp2000);
        ctx = { ...ctx, registry: scaledRegistry(factor), ministries: scaledDefs(factor) };
        const budgets: Record<string, number> = {};
        for (const d of ctx.ministries) budgets[d.id] = d.baseline_budget;
        decisions = { budgets };
      }
      // Exogenous shocks (state injection between pure ticks).
      if (s.t.year === 2001 && s.t.quarter === 3) s.macro.output_gap -= 0.03;
      if (s.t.year === 2008 && s.t.quarter === 4) s.macro.output_gap -= 0.045;
      if (s.t.year === 2020 && s.t.quarter === 1) s.macro.output_gap -= 0.09;
      if (s.t.year === 2023 && s.t.quarter === 4) s.security.active_fronts.push({ id: "gaza_war", intensity: 0.65 });
      if (s.t.year === 2025 && s.t.quarter === 1) s.security.active_fronts = [];

      s = tick(s, decisions, ctx).state;
      if (s.t.quarter === 1) {
        sim[s.t.year - 1] = { gdp: s.macro.gdp_real, u: s.macro.unemployment, debt: s.macro.debt_gdp, pov: s.macro.poverty_rate };
      }
    }

    // --- MAPE per series ---
    const mape = (pairs: Array<[number, number]>): number =>
      pairs.reduce((a, [simV, act]) => a + Math.abs(simV - act) / Math.abs(act), 0) / pairs.length;

    const gdpPairs: Array<[number, number]> = [];
    const uPairs: Array<[number, number]> = [];
    const debtPairs: Array<[number, number]> = [];
    const povPairs: Array<[number, number]> = [];
    for (const row of history) {
      const sv = sim[row.year];
      if (!sv) continue;
      if (row.real_gdp_index !== null) gdpPairs.push([sv.gdp, gdp2000 * (row.real_gdp_index / h2000.real_gdp_index!)]);
      if (row.unemployment !== null) uPairs.push([sv.u, row.unemployment]);
      debtPairs.push([sv.debt, row.debt_gdp]);
      povPairs.push([sv.pov, row.poverty]);
    }
    const results = {
      real_gdp: mape(gdpPairs),
      unemployment: mape(uPairs),
      debt_gdp: mape(debtPairs),
      poverty: mape(povPairs),
    };
    console.log("M9 backtest MAPE per series (2000→2025):");
    for (const [name, v] of Object.entries(results)) console.log(`  ${name.padEnd(14)} ${(v * 100).toFixed(1)}%`);
    console.log(`  sim 2025: GDP ×${(sim[2025].gdp / gdp2000).toFixed(2)} (actual ×${(h2025.real_gdp_index! / h2000.real_gdp_index!).toFixed(2)}), u ${(sim[2025].u * 100).toFixed(1)}%, debt ${(sim[2025].debt * 100).toFixed(0)}%, poverty ${(sim[2025].pov * 100).toFixed(1)}%`);
    console.log("  (participation backtest: see m4_backtest — overall MAPE 0.97%)");

    // Bands: GDP/debt/poverty must track; unemployment is an HONEST MISS
    // (no time-varying NAIRU — the 2000s 9-11% era cannot be reproduced; documented).
    expect(results.real_gdp).toBeLessThan(0.12);
    expect(results.debt_gdp).toBeLessThan(0.18);
    expect(results.poverty).toBeLessThan(0.2);
    expect(results.unemployment).toBeLessThan(0.5);
  });
});
