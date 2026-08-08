/**
 * Tick step 3: financial markets. Deficit and debt/GDP set the 10y yield;
 * the effective rate on the stock reprices toward it slowly; rating drifts
 * toward a fundamentals-implied level. Debt service is set for next period.
 */

import type { TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

export function marketsStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  const gdp = s.macro.gdp_real;
  s.macro.debt_gdp = s.fiscal.debt / gdp;
  const deficitGdp = s.fiscal.deficit / gdp;

  const yieldTarget =
    c.get("fiscal.yield_base") +
    c.get("fiscal.yield_beta_debt") * s.macro.debt_gdp +
    c.get("fiscal.yield_beta_deficit") * deficitGdp;
  const dYield = yieldTarget - s.macro.bond_yield_10y;
  s.macro.bond_yield_10y = yieldTarget;
  log.push({ t: s.t, step: 3, fn: "bond_pricing", target: "macro.bond_yield_10y", delta: dYield, constant_id: "fiscal.yield_beta_debt", note: null });

  const reprice = c.get("fiscal.debt_repricing_quarterly");
  s.fiscal.debt_effective_rate += reprice * (s.macro.bond_yield_10y - s.fiscal.debt_effective_rate);

  const prevService = s.fiscal.debt_service;
  s.fiscal.debt_service = s.fiscal.debt * s.fiscal.debt_effective_rate;
  log.push({ t: s.t, step: 3, fn: "debt_service", target: "fiscal.debt_service", delta: s.fiscal.debt_service - prevService, constant_id: "fiscal.debt_repricing_quarterly", note: null });

  const ratingTarget = Math.min(20, Math.max(0,
    20 - c.get("fiscal.rating_debt_coef") * s.macro.debt_gdp - c.get("fiscal.rating_deficit_coef") * deficitGdp));
  const adj = c.get("fiscal.rating_adjust_quarterly");
  const dRating = adj * (ratingTarget - s.macro.credit_rating);
  s.macro.credit_rating += dRating;
  log.push({ t: s.t, step: 3, fn: "credit_rating", target: "macro.credit_rating", delta: dRating, constant_id: "fiscal.rating_debt_coef", note: null });
}
