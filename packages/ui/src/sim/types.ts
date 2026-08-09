/** Types crossing the worker boundary. Everything here must survive structured clone. */

import type {
  BudgetPreview, Decisions, MinistryId, MunitionClass, SectorId, TickLogEntry, WorldState,
} from "@engine";

export interface FrameSector {
  population: number;
  poverty_rate: number;
  grievance: number;
  income_median: number;
  approval: number;
  participation_men: number;
  participation_women: number;
}

/** One quarter of run history, compact enough to keep for a whole run. */
export interface HistoryFrame {
  tickIndex: number;
  year: number;
  quarter: 1 | 2 | 3 | 4;

  gdp_real: number;
  gdp_potential: number;
  unemployment: number;
  inflation: number;
  debt_gdp: number;
  bond_yield_10y: number;
  policy_rate: number;
  credit_rating: number;
  poverty_rate: number;
  participation: number;
  gini: number;
  shekel_usd: number;

  revenue_total: number;
  spend_total: number;
  deficit: number;
  debt: number;
  debt_service: number;

  funding_ratio: Record<MinistryId, number>;

  readiness: number;
  deterrence: number;
  mobilization: number;
  war_casualties: number;
  quarters_of_supply: number;
  stockpiles: Record<MunitionClass, number>;
  fronts: Array<{ id: string; intensity: number }>;
  threat: Record<string, number>;

  stability: number;
  cohesion: number;
  trust: number;
  protest: number;
  civil_war_pressure: number;

  sectors: Record<SectorId, FrameSector>;
  events: Array<{ id: string; note: string; count: number }>;

  /** locality columns, index-aligned with RunMeta.localities */
  loc_population: Float64Array;
  loc_employment: Float64Array;
  loc_service_access: Float64Array;
  loc_migration: Float64Array;
}

export interface MinistryMeta {
  id: MinistryId;
  baseline_budget: number;
  rigidity: number;
}

export interface ReformMeta {
  id: string;
  fiscal_cost: number;
  reversible: boolean;
  prerequisites: string[];
}

export interface ConstantMeta {
  id: string;
  confidence: string;
  source: string;
}

export interface RunMeta {
  seed: string;
  start_year: number;
  ministries: MinistryMeta[];
  reforms: ReformMeta[];
  models: string[];
  localities: {
    code: number[];
    name_he: string[];
    cluster: number[];
    /** WGS84; NaN when the locality has no coordinate (dropped from the map layer) */
    lon: Float64Array;
    lat: Float64Array;
  };
  /** constants with placeholder confidence — drives the "assumption" dotted underline */
  placeholder_ids: string[];
}

export interface InitPayload {
  meta: RunMeta;
  frame: HistoryFrame;
  state: WorldState;
}

export interface AdvancePayload {
  frames: HistoryFrame[];
  state: WorldState;
  /** causal log of the most recent tick (state.log) */
  log: TickLogEntry[];
}

export interface SimApi {
  init(seed: string): InitPayload;
  advance(quarters: number, decisions: Decisions): AdvancePayload;
  preview(decisions: Decisions): BudgetPreview;
  /** zero-decision replay from t0 over the same number of ticks (post-mortem baseline) */
  counterfactual(): HistoryFrame[];
}
