/**
 * Tick step 7 (M1 slice): sector population growth. Flows are logged
 * explicitly so the population-conservation invariant can audit them:
 * Σ pop_after == Σ pop_before + Σ logged natural-growth flows, exactly.
 * Participation/income/grievance dynamics arrive in M4.
 */

import type { SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";

export function demographyStep(s: WorldState, c: Registry, log: TickLogEntry[]): void {
  for (const id of Object.keys(s.sectors) as SectorId[]) {
    const sec = s.sectors[id];
    const gAnnual = c.get(`demography.growth_annual_${id}`);
    sec.growth_rate = gAnnual;
    const factor = Math.pow(1 + gAnnual, 0.25);
    const flow = sec.population * (factor - 1);
    sec.population += flow;
    log.push({ t: s.t, step: 7, fn: "natural_growth", target: `sectors.${id}.population`, delta: flow, constant_id: `demography.growth_annual_${id}`, note: null });
  }
}

export function totalPopulation(s: WorldState): number {
  let sum = 0;
  for (const id of Object.keys(s.sectors) as SectorId[]) sum += s.sectors[id].population;
  return sum;
}
