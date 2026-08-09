/**
 * WorldState — CONTRACT C3: plain, JSON-serializable, immutable between ticks.
 * Units convention (see PLAN.md §13): money in ₪ millions (₪M), flows annualized
 * (₪M/yr) unless noted; population in persons; rates/shares as fractions 0–1;
 * tick = one quarter. Every field's unit is in its JSDoc.
 */

export type MinistryId =
  | "defense" | "education" | "health" | "transport" | "culture_sport"
  | "foreign_affairs" | "hasbara" | "environment" | "water_agriculture"
  | "welfare" | "housing" | "internal_security" | "justice" | "economy"
  | "science" | "religious_services" | "immigration";

export type SectorId = "secular" | "national_religious" | "haredi" | "arab" | "other";

export type MunitionClass = "interceptors" | "precision_guided" | "artillery_shells";

export type EconomicModelId =
  | "libertarian" | "capitalist" | "mixed" | "social_democratic" | "socialist" | "statist_command";

export interface RevenueBreakdown {
  /** ₪M/yr */ income: number;
  /** ₪M/yr */ vat: number;
  /** ₪M/yr */ corporate: number;
  /** ₪M/yr */ capital: number;
  /** ₪M/yr */ customs: number;
}

export interface TaxPolicy {
  /** Multiplier on all revenue shares; player lever, 1 = current law. M3 replaces with rates+brackets. */
  revenue_multiplier: number;
}

export interface MinistryState {
  /** ₪M/yr, approved annual budget */ budget: number;
  /** budget / baseline_budget, dimensionless */ funding_ratio: number;
  /** consecutive quarters below each degradation rule's threshold, aligned with MinistryDef.degradation */ degradation_counters: number[];
}

export interface SectorState {
  /** persons */ population: number;
  /** fraction/yr */ growth_rate: number;
  /** shares [0-14, 15-64, 65+], sum 1 */ age_structure: number[];
  labour_participation: { /** fraction */ men: number; /** fraction */ women: number };
  /** mean years of schooling */ education_years: number;
  /** fraction of workforce with vocational training */ vocational_share: number;
  /** ₪/month, median gross income */ income_median: number;
  /** fraction below poverty line */ poverty_rate: number;
  /** fraction of households mainly on transfers */ welfare_dependency: number;
  /** fraction of cohort serving */ military_service_rate: number;
  /** Knesset seats attributable */ political_representation: number;
  /** 0–1, drives protest/unrest hazards */ grievance: number;
  /** 0–1 */ trust_in_state: number;
  /** children per woman */ fertility: number;
}

/**
 * Locality agents, structure-of-arrays (PLAN §4: plain parallel arrays keep
 * the state JSON-serializable while 10-year runs stay fast). Index i is one
 * locality across all arrays.
 */
export interface LocalitySoA {
  count: number;
  /** CBS locality code */ code: number[];
  name_he: string[];
  /** CBS socio-economic cluster 1–10; 0 = unknown */ cluster: number[];
  /** persons */ population: number[];
  /** fraction of working-age employed */ employment: number[];
  /** census employment baseline, fraction */ emp_base: number[];
  /** 0–1+ composite service access */ service_access: number[];
  /** initial service access (t0 reference) */ service_base: number[];
  /** persons/yr net internal migration */ migration_balance: number[];
}

export interface Front {
  id: string;
  /** 0–1 */ intensity: number;
}

export interface Sanction {
  id: string;
  /** 0–1 */ severity: number;
}

export interface PartyState {
  id: string;
  seats: number;
}

export interface ReformState {
  status: "enacted" | "repealed" | "pending";
  /** absolute tick index or null */ enacted_tick: number | null;
}

/** CONTRACT §7.3 — delayed-payoff pipeline entry. */
export interface PendingEffect {
  origin: { /** absolute tick index */ tick: number; ministry: MinistryId; decision: string };
  /** dot StatePath, must resolve to a number */ target: string;
  /** total effect, in target's unit */ magnitude: number;
  /** kernel spec string, e.g. "gamma(shape=4, scale=2.2)" */ kernel: string;
  /** per-quarter deltas still to apply, target unit */ remaining: number[];
  /** cancel remainder if origin ministry funding_ratio drops below this */ decays_if: { ministry_funding_below: number } | null;
}

export interface TickLogEntry {
  t: { year: number; quarter: 1 | 2 | 3 | 4 };
  /** tick pipeline step 1–13 */ step: number;
  /** transfer function name */ fn: string;
  /** StatePath written */ target: string;
  /** delta applied, target unit */ delta: number;
  /** constants-file id that produced it, or null */ constant_id: string | null;
  note: string | null;
}

export interface WorldState {
  t: { year: number; quarter: 1 | 2 | 3 | 4 };
  /** run seed; part of state so replays are self-describing */ seed: string;

  macro: {
    /** ₪M/yr, real */ gdp_real: number;
    /** ₪M/yr, real */ gdp_potential: number;
    /** fraction/yr */ inflation: number;
    /** fraction/yr, BoI rate */ policy_rate: number;
    /** fraction of labour force */ unemployment: number;
    /** fraction of working-age population */ participation: number;
    /** debt / GDP, dimensionless */ debt_gdp: number;
    /** fraction/yr */ bond_yield_10y: number;
    /** 0–20 (20 = AAA-equivalent) */ credit_rating: number;
    /** ₪ per USD */ shekel_usd: number;
    /** ₪M */ fx_reserves: number;
    /** TFP level A (index; also mirrored as production-function A) */ productivity_index: number;
    /** ₪M */ capital_stock: number;
    /** human capital index H, 1.0 at t0 */ human_capital: number;
    /** 0–1 */ gini: number;
    /** fraction of persons */ poverty_rate: number;
  };

  fiscal: {
    revenue: RevenueBreakdown;
    tax_policy: TaxPolicy;
    ministries: Record<MinistryId, MinistryState>;
    /** ₪M, gross government debt (absolute; debt_gdp is derived) */ debt: number;
    /** fraction/yr, average interest actually paid on the stock */ debt_effective_rate: number;
    /** ₪M/yr */ debt_service: number;
    /** ₪M/yr, spend + service − revenue (positive = shortfall) */ deficit: number;
    /** ₪M */ emergency_reserve: number;
    /** ₪M/yr, active periphery-program budget (0 = no program) */ periphery_spend: number;
    /** clusters (1–10) targeted by the active periphery program */ periphery_target_clusters: number[];
  };

  sectors: Record<SectorId, SectorState>;
  /** ~1,500 locality agents (SoA); count 0 when locality data not loaded */ localities: LocalitySoA;

  security: {
    /** units */ stockpiles: Record<MunitionClass, number>;
    /** units/quarter at current funding */ domestic_production: Record<MunitionClass, number>;
    /** 0–1 */ force_readiness: number;
    /** fraction of reserves mobilized */ reserve_mobilization: number;
    /** 0–1 */ intel_capability: number;
    active_fronts: Front[];
    /** 0–1 */ deterrence_index: number;
    /** 0–1 per adversary */ threat_level: Record<string, number>;
  };

  diplomacy: {
    /** −1 hostile … +1 allied */ alignment: Record<string, number>;
    sanctions: Sanction[];
    arms_embargo: boolean;
    /** 0–1 export multiplier per region */ trade_access: Record<string, number>;
    /** −1 … +1 */ un_standing: number;
    us_support: { /** ₪M/yr */ military_aid: number; /** 0–1 */ veto_reliability: number };
  };

  politics: {
    coalition: { seats: number; parties: PartyState[]; /** 0–1 */ stability: number };
    /** 0–1 per sector */ approval_by_sector: Record<SectorId, number>;
    /** 0–1 */ protest_intensity: number;
    /** 0–1 */ social_cohesion: number;
    /** 0–1 */ institutional_trust: number;
    /** 0–1 hazard accumulator */ civil_war_pressure: number;
  };

  infrastructure: {
    /** index, 1.0 at t0 */ road_capacity: number;
    /** km */ rail_km: number;
    /** 0–1 */ congestion_index: number;
    /** beds */ hospital_beds: number;
    /** beds */ icu_beds: number;
    /** per 1,000 persons */ physicians_per_1000: number;
    /** rooms */ classrooms: number;
    /** FTE teachers */ teachers: number;
    /** index, 1.0 at t0 */ teacher_quality_index: number;
    /** million m³/yr */ desalination_capacity_mcm: number;
    /** million m³/yr unmet demand */ water_deficit: number;
    /** MW */ generation_capacity_mw: number;
    /** fraction of generation */ renewable_share: number;
    /** dwelling units */ housing_stock: number;
    /** units/yr */ housing_starts: number;
  };

  environment: {
    /** MtCO₂e/yr */ emissions: number;
    /** 0–1 (1 = clean) */ air_quality_index: number;
    /** 0–1 */ open_space_index: number;
  };

  reforms: Record<string, ReformState>;
  economic_model: EconomicModelId;

  pipeline: PendingEffect[];
  /** event ids force-fired next tick (escalation spawns, spec §8.2) */ pending_events: string[];
  /** per event id: absolute tick index before which it may not refire */ event_cooldowns: Record<string, number>;
  /** log of the most recent tick */ log: TickLogEntry[];
}

/** Player decisions for one tick. Absent fields keep the current policy. */
export interface Decisions {
  /** ₪M/yr, proposed annual budget per ministry */ budgets?: Partial<Record<MinistryId, number>>;
  /** Periphery incentive program: targeted flow to localities in the given clusters. annual_budget 0 cancels. */
  periphery?: { annual_budget: number; target_clusters: number[] };
}

export interface EngineEvent {
  id: string;
  note: string;
  /** incident multiplicity (Poisson count for non-binary events); 1 otherwise */ count: number;
}

export interface TickResult {
  state: WorldState;
  events: EngineEvent[];
  log: TickLogEntry[];
}
