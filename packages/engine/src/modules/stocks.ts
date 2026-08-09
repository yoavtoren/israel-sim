/**
 * Tick step 6: stock accounting — capital accumulation, human-capital decay,
 * munition shelf-life expiry. Degradation-from-underfunding rules arrive in M3.
 */

import type { MunitionClass, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

export function stocksStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  // Capital: quarterly investment minus depreciation.
  const invest = c.get("macro.investment_rate") * s.macro.gdp_real;
  const dep = c.get("macro.depreciation_annual") * s.macro.capital_stock;
  const dK = (invest - dep) / 4;
  s.macro.capital_stock += dK;
  log.push({ t: s.t, step: 6, fn: "capital_accumulation", target: "macro.capital_stock", delta: dK, constant_id: "macro.investment_rate", note: null });

  // Human capital decays only to the extent education is underfunded: at
  // baseline funding the teaching system replaces cohort attrition (M9 fix —
  // unconditional decay contradicted the 2000-2025 growth record).
  const frEdu = s.fiscal.ministries.education.funding_ratio;
  const dH = -(c.get("macro.hc_decay_annual") / 4) * s.macro.human_capital * Math.max(0, 1 - frEdu);
  s.macro.human_capital += dH;
  if (dH !== 0) log.push({ t: s.t, step: 6, fn: "hc_decay", target: "macro.human_capital", delta: dH, constant_id: "macro.hc_decay_annual", note: null });

  // Housing: starts accumulate into the stock net of demolition.
  const dHousing = (s.infrastructure.housing_starts - c.get("housing.demolition_annual") * s.infrastructure.housing_stock) / 4;
  s.infrastructure.housing_stock += dHousing;
  log.push({ t: s.t, step: 6, fn: "housing_accumulation", target: "infrastructure.housing_stock", delta: dHousing, constant_id: "housing.demolition_annual", note: null });

  // Water deficit relieved by desalination capacity (relative to its t0 level).
  const relief = c.get("water.deficit_relief_quarterly") * (s.infrastructure.desalination_capacity_mcm / c.get("water.desal_ref_capacity")) * s.infrastructure.water_deficit;
  s.infrastructure.water_deficit = Math.max(0, s.infrastructure.water_deficit - relief);
  if (relief > 0) log.push({ t: s.t, step: 6, fn: "water_relief", target: "infrastructure.water_deficit", delta: -relief, constant_id: "water.deficit_relief_quarterly", note: null });

  // Munitions expire (shelf life / training consumption).
  const expiry = c.get("defense.munition_expiry_quarterly");
  for (const cls of Object.keys(s.security.stockpiles) as MunitionClass[]) {
    const loss = s.security.stockpiles[cls] * expiry;
    s.security.stockpiles[cls] -= loss;
    log.push({ t: s.t, step: 6, fn: "munition_expiry", target: `security.stockpiles.${cls}`, delta: -loss, constant_id: "defense.munition_expiry_quarterly", note: null });
  }
}
