/**
 * Tick step 9: macro aggregation — augmented Cobb-Douglas
 *   Y = A · K^α · (L·H)^(1−α) · Ω
 * plus Okun's law, a Phillips relation with anchoring, and a smoothed Taylor
 * rule. Ω (disruption) is 1 until the security module lands (M6).
 */

import type { Rng } from "../rng";
import type { TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { totalPopulation } from "./demography";
import { totalFrontIntensity } from "./security";
import { tradeWeightedAccess } from "./diplomacy";

/**
 * Ω disruption multiplier (spec §7.2): war mobilization and active fronts
 * suppress output; lost trade access scales exports down (normalized to 1 at
 * the t0 access level). Uses last tick's security/diplomacy state (macro runs
 * at step 9, security/diplomacy at step 10 — a one-quarter lag by spec order).
 */
export function disruptionOmega(s: WorldState, c: Registry): number {
  const security = Math.min(1, Math.max(0.5,
    1 - c.get("macro.omega_mobilization") * s.security.reserve_mobilization - c.get("macro.omega_front") * totalFrontIntensity(s)));
  const exp = c.get("macro.export_share_gdp");
  const trade = (1 - exp * (1 - tradeWeightedAccess(s, c))) / (1 - exp * (1 - c.get("diplomacy.trade_access_ref")));
  return security * Math.min(1.05, Math.max(0.4, trade));
}

/** Employed labour input at unemployment rate u. */
function labourInput(s: WorldState, c: Registry, u: number): number {
  const workingAge = totalPopulation(s) * c.get("macro.working_age_share");
  return workingAge * s.macro.participation * (1 - u);
}

export function computePotential(s: WorldState, c: Registry): number {
  const alpha = c.get("macro.alpha");
  const uStar = c.get("macro.natural_unemployment");
  const L = labourInput(s, c, uStar);
  return s.macro.productivity_index * Math.pow(s.macro.capital_stock, alpha) * Math.pow(L * s.macro.human_capital, 1 - alpha);
}

/** Called once at init so Y = potential holds exactly at t0. */
export function calibrateTfp(s: WorldState, c: Registry): void {
  const alpha = c.get("macro.alpha");
  const uStar = c.get("macro.natural_unemployment");
  const L = labourInput(s, c, uStar);
  s.macro.productivity_index = s.macro.gdp_real / (Math.pow(s.macro.capital_stock, alpha) * Math.pow(L * s.macro.human_capital, 1 - alpha));
}

export function macroStep(s: WorldState, c: Registry, rng: Rng, log: TickLogEntry[]): void {
  // TFP drift.
  const tfpGrowth = Math.pow(1 + c.get("macro.tfp_growth_annual"), 0.25) - 1;
  const dA = s.macro.productivity_index * tfpGrowth;
  s.macro.productivity_index += dA;
  log.push({ t: s.t, step: 9, fn: "tfp_drift", target: "macro.productivity_index", delta: dA, constant_id: "macro.tfp_growth_annual", note: null });

  // Demand gap: AR(1) with a small shock, stored in state so the Ω disruption
  // factor never feeds back into it (that would compound the war shock).
  const shock = rng.normal() * c.get("macro.demand_shock_sigma_quarterly");
  const gap = c.get("macro.output_gap_persistence_quarterly") * s.macro.output_gap + shock;
  s.macro.output_gap = gap;

  const potential = computePotential(s, c);
  const dPot = potential - s.macro.gdp_potential;
  s.macro.gdp_potential = potential;
  log.push({ t: s.t, step: 9, fn: "potential_output", target: "macro.gdp_potential", delta: dPot, constant_id: "macro.alpha", note: null });

  const omega = disruptionOmega(s, c);
  const gdp = potential * (1 + gap) * omega;
  const dY = gdp - s.macro.gdp_real;
  s.macro.gdp_real = gdp;
  log.push({ t: s.t, step: 9, fn: "output_gap", target: "macro.gdp_real", delta: dY, constant_id: "macro.output_gap_persistence_quarterly", note: `gap=${(gap * 100).toFixed(2)}% Ω=${omega.toFixed(3)}` });

  // Okun's law on the EFFECTIVE gap (demand gap plus war/trade disruption).
  const gapEff = (1 + gap) * omega - 1;
  const u = Math.max(0.005, c.get("macro.natural_unemployment") - c.get("macro.okun_coefficient") * gapEff);
  const dU = u - s.macro.unemployment;
  s.macro.unemployment = u;
  log.push({ t: s.t, step: 9, fn: "okun", target: "macro.unemployment", delta: dU, constant_id: "macro.okun_coefficient", note: null });

  // Phillips relation with anchoring toward target.
  const target = c.get("macro.inflation_target");
  const dPi = c.get("macro.phillips_slope") * gap + c.get("macro.inflation_anchoring_quarterly") * (target - s.macro.inflation);
  s.macro.inflation += dPi;
  log.push({ t: s.t, step: 9, fn: "phillips", target: "macro.inflation", delta: dPi, constant_id: "macro.phillips_slope", note: null });

  // Taylor rule with smoothing.
  const neutralNominal = c.get("macro.neutral_real_rate") + s.macro.inflation;
  const taylor = neutralNominal + c.get("macro.taylor_inflation_coef") * (s.macro.inflation - target) + c.get("macro.taylor_gap_coef") * gap;
  const smooth = c.get("macro.policy_rate_smoothing_quarterly");
  const newRate = Math.max(0, smooth * s.macro.policy_rate + (1 - smooth) * taylor);
  const dR = newRate - s.macro.policy_rate;
  s.macro.policy_rate = newRate;
  log.push({ t: s.t, step: 9, fn: "taylor_rule", target: "macro.policy_rate", delta: dR, constant_id: "macro.taylor_inflation_coef", note: null });
}
