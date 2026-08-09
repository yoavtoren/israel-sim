/**
 * Initial-state builder. Takes parsed placeholder/normalized data (the engine
 * never touches the filesystem), ministry defs and the constants registry,
 * and returns a consistent t0 WorldState: ministries at baseline, TFP
 * calibrated so Y = potential exactly, debt stock derived from debt/GDP.
 */

import type { EconomicModelId, LocalitySoA, SectorId, SectorState, TaxPolicy, WorldState } from "./types";
import type { MinistryDef } from "../ministries/defs";
import type { Registry } from "../constants/registry";
import { calibrateTfp, computePotential } from "../modules/macro";
import { aggregatePoverty, participationCurve, SECTOR_IDS } from "../modules/sectors";

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

/** One row of normalized/localities.json (the fields init consumes). */
export interface LocalityInitRow {
  code: number;
  name_he: string;
  population: number;
  socioeconomic_cluster: number | null;
  employment_pcnt: number | null;
}

export interface InitOptions {
  /** locality rows from normalized/localities.json; omitted → count 0 */
  localities?: LocalityInitRow[];
  /** override t0 year (backtests); sector participation is set from the calibrated curves at this year */
  startYear?: number;
}

function buildLocalities(rows: LocalityInitRow[], totalPop: number): LocalitySoA {
  const soa: LocalitySoA = {
    count: rows.length,
    code: [], name_he: [], cluster: [], population: [],
    employment: [], emp_base: [], service_access: [], service_base: [], migration_balance: [],
  };
  const censusSum = rows.reduce((a, r) => a + r.population, 0);
  const scale = totalPop / censusSum;
  for (const r of rows) {
    const cluster = r.socioeconomic_cluster ?? 0;
    const emp = r.employment_pcnt !== null ? r.employment_pcnt / 100 : 0.6;
    // Service access from the socio-economic cluster (0.4–1.0); 0-cluster → mid.
    const svc = cluster > 0 ? 0.4 + 0.06 * cluster : 0.7;
    soa.code.push(r.code);
    soa.name_he.push(r.name_he);
    soa.cluster.push(cluster);
    soa.population.push(r.population * scale);
    soa.employment.push(emp);
    soa.emp_base.push(emp);
    soa.service_access.push(svc);
    soa.service_base.push(svc);
    soa.migration_balance.push(0);
  }
  return soa;
}

export function buildInitialState(
  raw: InitialStateJson,
  defs: MinistryDef[],
  registry: Registry,
  seed: string,
  opts: InitOptions = {},
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
  const startYear = opts.startYear ?? raw.start_year;

  const state: WorldState = {
    t: { year: startYear, quarter: 1 },
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
      periphery_spend: 0,
      periphery_target_clusters: [],
    },
    sectors: structuredClone(raw.sectors),
    localities: { count: 0, code: [], name_he: [], cluster: [], population: [], employment: [], emp_base: [], service_access: [], service_base: [], migration_balance: [] },
    security: structuredClone(raw.security),
    diplomacy: structuredClone(raw.diplomacy),
    politics: structuredClone(raw.politics),
    infrastructure: structuredClone(raw.infrastructure),
    environment: structuredClone(raw.environment),
    reforms: {},
    economic_model: raw.economic_model,
    pipeline: [],
    pending_events: [],
    event_cooldowns: {},
    log: [],
  };

  // Sector participation from the calibrated trend curves at t0 (spec §6.1);
  // sector poverty rescaled so the aggregate matches the published headline.
  for (const id of SECTOR_IDS) {
    const sec = state.sectors[id];
    sec.labour_participation.men = participationCurve(registry, id, "men", startYear);
    sec.labour_participation.women = participationCurve(registry, id, "women", startYear);
  }
  const povScale = raw.macro.poverty_rate / aggregatePoverty(state);
  for (const id of SECTOR_IDS) state.sectors[id].poverty_rate *= povScale;

  const totalPop = Object.values(state.sectors).reduce((a, sec) => a + sec.population, 0);
  if (opts.localities && opts.localities.length > 0) {
    state.localities = buildLocalities(opts.localities, totalPop);
  }

  calibrateTfp(state, registry);
  state.macro.gdp_potential = computePotential(state, registry);
  state.macro.gdp_real = state.macro.gdp_potential;
  return state;
}
