/**
 * Tick steps 1–2: resolve player budget decisions (rigidity floors), then the
 * budget constraint — revenue, deficit, debt issuance.
 * Accounting identity (invariant): revenue − spend − debt_service = −deficit.
 */

import type { Decisions, MinistryId, TickLogEntry, WorldState } from "../state/types";
import type { MinistryDef } from "../ministries/defs";
import type { Registry } from "../constants/registry";

export function resolveDecisions(
  s: WorldState,
  decisions: Decisions,
  defs: MinistryDef[],
  log: TickLogEntry[],
): void {
  for (const def of defs) {
    const ms = s.fiscal.ministries[def.id];
    const proposed = decisions.budgets?.[def.id];
    if (proposed !== undefined) {
      // Rigidity = share that cannot be cut within one year (spec §5); per
      // quarter that is rigidity^(1/4) of the CURRENT budget, so multi-year
      // sustained cuts compound below it while one-year cuts cannot.
      const floor = ms.budget * Math.pow(def.rigidity, 0.25);
      const applied = Math.max(proposed, floor);
      if (applied !== ms.budget) {
        log.push({
          t: s.t, step: 1, fn: "budget_decision", target: `fiscal.ministries.${def.id}.budget`,
          delta: applied - ms.budget, constant_id: null,
          note: applied !== proposed ? `rigidity floor ${floor} applied` : null,
        });
        ms.budget = applied;
      }
    }
    ms.funding_ratio = ms.budget / def.baseline_budget;
  }

  if (decisions.periphery !== undefined) {
    const prev = s.fiscal.periphery_spend;
    s.fiscal.periphery_spend = Math.max(0, decisions.periphery.annual_budget);
    s.fiscal.periphery_target_clusters = [...decisions.periphery.target_clusters];
    if (s.fiscal.periphery_spend !== prev) {
      log.push({ t: s.t, step: 1, fn: "periphery_program", target: "fiscal.periphery_spend", delta: s.fiscal.periphery_spend - prev, constant_id: null, note: `clusters ${s.fiscal.periphery_target_clusters.join(",")}` });
    }
  }
}

export function totalSpend(s: WorldState): number {
  let sum = 0;
  for (const id of Object.keys(s.fiscal.ministries) as MinistryId[]) {
    sum += s.fiscal.ministries[id].budget;
  }
  return sum;
}

export function totalRevenue(s: WorldState): number {
  const r = s.fiscal.revenue;
  return r.income + r.vat + r.corporate + r.capital + r.customs;
}

export function fiscalStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  const gdp = s.macro.gdp_real;
  const mult = s.fiscal.tax_policy.revenue_multiplier;
  const prevDeficit = s.fiscal.deficit;

  s.fiscal.revenue.income = gdp * c.get("fiscal.revenue_share_income") * mult;
  s.fiscal.revenue.vat = gdp * c.get("fiscal.revenue_share_vat") * mult;
  s.fiscal.revenue.corporate = gdp * c.get("fiscal.revenue_share_corporate") * mult;
  s.fiscal.revenue.capital = gdp * c.get("fiscal.revenue_share_capital") * mult;
  s.fiscal.revenue.customs = gdp * c.get("fiscal.revenue_share_customs") * mult;

  const revenue = totalRevenue(s);
  // Non-ministry spend (pensions, Knesset, local-authority grants, reserves…)
  // is a published aggregate the player cannot currently steer; M3+ decomposes it.
  const spend = totalSpend(s) + c.get("fiscal.non_ministry_spend_annual") + s.fiscal.periphery_spend;
  s.fiscal.deficit = spend + s.fiscal.debt_service - revenue;

  // Quarterly debt issuance covers a quarter of the annualized deficit.
  const issued = s.fiscal.deficit / 4;
  s.fiscal.debt += issued;

  log.push({ t: s.t, step: 2, fn: "budget_constraint", target: "fiscal.deficit", delta: s.fiscal.deficit - prevDeficit, constant_id: null, note: `revenue=${Math.round(revenue)} spend=${Math.round(spend)}` });
  log.push({ t: s.t, step: 2, fn: "debt_issuance", target: "fiscal.debt", delta: issued, constant_id: null, note: null });
}
