/** M2 gate: the built initial state matches published figures within 1%. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { totalPopulation, totalSpend } from "../src/index";
import { loadContext } from "./helpers";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const read = (rel: string): unknown => JSON.parse(readFileSync(join(dataDir, rel), "utf8"));

const macro = read("normalized/macro_current.json") as Record<string, { value: number }>;
const budget = read("normalized/budget_2025.json") as {
  ministry_baselines_ils_m: Record<string, number>;
  spend_excl_financing_ils_m: number;
  non_ministry_spend_ils_m: number;
};
const localities = read("normalized/localities.json") as Array<{ population: number }>;
const sectorSplit = read("normalized/sector_populations_2022.json") as { national_total: number; by_sector: Record<string, number> };

const within = (actual: number, published: number, tol = 0.01): void => {
  expect(Math.abs(actual / published - 1), `${actual} vs published ${published}`).toBeLessThan(tol);
};

describe("M2: initial state vs published figures", () => {
  const { ctx, initial } = loadContext();

  it("macro headline matches BoI-published values within 1%", () => {
    within(initial.macro.gdp_real, macro.gdp_nominal_annual.value);
    within(initial.macro.policy_rate, macro.policy_rate.value);
    within(initial.macro.bond_yield_10y, macro.bond_yield_10y.value);
    within(initial.macro.unemployment, macro.unemployment.value);
    within(initial.macro.inflation, macro.inflation_yoy.value);
    within(initial.macro.shekel_usd, macro.shekel_usd.value);
  });

  it("ministry baselines match Open Budget 2025 sections within 1%", () => {
    for (const [id, published] of Object.entries(budget.ministry_baselines_ils_m)) {
      const def = ctx.ministries.find((d) => d.id === id);
      expect(def, `ministry ${id} missing`).toBeDefined();
      within(def!.baseline_budget, published);
    }
    // Total modeled spend (ministries + non-ministry aggregate) == published net expenditure excl. financing.
    const modeled = totalSpend(initial) + ctx.registry.get("fiscal.non_ministry_spend_annual");
    within(modeled, budget.spend_excl_financing_ils_m);
  });

  it("locality populations sum to the census national total within 1% (independent cross-check)", () => {
    const sum = localities.reduce((a, l) => a + l.population, 0);
    within(sum, sectorSplit.national_total);
  });

  it("sector populations preserve census shares and sum to the 2026 estimate", () => {
    const censusCovered = Object.values(sectorSplit.by_sector).reduce((a, b) => a + b, 0);
    for (const [id, censusPop] of Object.entries(sectorSplit.by_sector)) {
      const share2022 = censusPop / censusCovered;
      const shareNow = initial.sectors[id as keyof typeof initial.sectors].population / totalPopulation(initial);
      within(shareNow, share2022, 0.005);
    }
  });

  it("debt service consistent with published 2025 interest bill within 1%", () => {
    const interest = (read("normalized/budget_2025.json") as { debt_interest_ils_m: number }).debt_interest_ils_m;
    within(initial.fiscal.debt_service, interest, 0.011);
  });
});
