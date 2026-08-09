/**
 * Initial-state builder. Takes parsed placeholder/normalized data (the engine
 * never touches the filesystem), ministry defs and the constants registry,
 * and returns a consistent t0 WorldState: ministries at baseline, TFP
 * calibrated so Y = potential exactly, debt stock derived from debt/GDP.
 */

import type { EconomicModelId, SectorId, SectorState, TaxPolicy, WorldState } from "./types";
import type { MinistryDef } from "../ministries/defs";
import type { Registry } from "../constants/registry";
import { calibrateTfp, computePotential } from "../modules/macro";

export interface InitialStateJson {
  start_year: number;
  macro: WorldState["macro"];
  fiscal: {
    tax_policy: TaxPolicy;
    /** fraction/yr */ debt_effective_rate: number;
    /** ₪M */ emergency_reserve: number;
  };
  sectors: Record<SectorId, SectorState>;
  security: WorldState["security"];
  diplomacy: WorldState["diplomacy"];
  politics: WorldState["politics"];
  infrastructure: WorldState["infrastructure"];
  environment: WorldState["environment"];
  economic_model: EconomicModelId;
}

export function buildInitialState(
  raw: InitialStateJson,
  defs: MinistryDef[],
  registry: Registry,
  seed: string,
): WorldState {
  const ministries = {} as WorldState["fiscal"]["ministries"];
  for (const def of defs) {
    ministries[def.id] = {
      budget: def.baseline_budget,
      funding_ratio: 1,
      degradation_counters: def.degradation.map(() => 0),
    };
  }

  const debt = raw.macro.debt_gdp * raw.macro.gdp_real;

  const state: WorldState = {
    t: { year: raw.start_year, quarter: 1 },
    seed,
    macro: { ...raw.macro },
    fiscal: {
      revenue: { income: 0, vat: 0, corporate: 0, capital: 0, customs: 0 },
      tax_policy: { ...raw.fiscal.tax_policy },
      ministries,
      debt,
      debt_effective_rate: raw.fiscal.debt_effective_rate,
      debt_service: debt * raw.fiscal.debt_effective_rate,
      deficit: 0,
      emergency_reserve: raw.fiscal.emergency_reserve,
    },
    sectors: structuredClone(raw.sectors),
    localities: [],
    security: structuredClone(raw.security),
    diplomacy: structuredClone(raw.diplomacy),
    politics: structuredClone(raw.politics),
    infrastructure: structuredClone(raw.infrastructure),
    environment: structuredClone(raw.environment),
    reforms: {},
    economic_model: raw.economic_model,
    pipeline: [],
    log: [],
  };

  calibrateTfp(state, registry);
  state.macro.gdp_potential = computePotential(state, registry);
  state.macro.gdp_real = state.macro.gdp_potential;
  return state;
}
