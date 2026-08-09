/**
 * MinistryDef — spec §5. Loaded from packages/data/defs/ministries.json and
 * validated here. Adding depth = adding output rows, not code.
 */

import type { MinistryId, MunitionClass } from "../state/types";

/** Stock adjusts toward the level the budget can sustain: level = budget·share/cost. */
export interface FundedStockOutput {
  kind: "funded_stock";
  target: string;
  budget_share_id: string;
  cost_per_unit_id: string;
  adjust_rate_id: string;
  /** saturation: max relative growth per quarter */ max_growth_id: string;
}

/** Stock tracks a share of another stock (e.g. ICU beds as share of beds). */
export interface DerivedStockOutput {
  kind: "derived_stock";
  target: string;
  source_path: string;
  share_id: string;
  adjust_rate_id: string;
}

/** 0–1 level adjusts toward base·funding_ratio^crowding (crowding from the ministry). */
export interface ReadinessOutput {
  kind: "readiness";
  target: string;
  base_id: string;
  adjust_rate_id: string;
}

/** domestic_production[class] = baseline·funding_ratio; stockpile += production. */
export interface ProductionOutput {
  kind: "production";
  munition_class: MunitionClass;
  baseline_id: string;
}

/** Long-lag effect via the pipeline; kernel and magnitude come from the elasticity entry. */
export interface PipelineOutput {
  kind: "pipeline";
  target: string;
  elasticity_id: string;
  /** cancel remainder if funding_ratio falls below this */ decays_below: number;
}

/** Flow set each tick: target = base + budget·share/cost (e.g. housing starts). */
export interface FundedFlowOutput {
  kind: "funded_flow";
  target: string;
  /** flow that exists regardless of this budget */ base_id: string;
  budget_share_id: string;
  cost_per_unit_id: string;
}

/** Level falls as funding rises: level = base·fr^(−elasticity) (e.g. poverty, protest). */
export interface InverseLevelOutput {
  kind: "inverse_level";
  target: string;
  base_id: string;
  elasticity_id: string;
  adjust_rate_id: string;
}

export type OutputDef =
  | FundedStockOutput
  | DerivedStockOutput
  | ReadinessOutput
  | ProductionOutput
  | PipelineOutput
  | FundedFlowOutput
  | InverseLevelOutput;

/**
 * Failure mode when underfunded (spec §5). `rate` is per-year: multiplicative
 * (fraction of current value) unless `additive`, then absolute target units.
 * Fires each quarter while funding_ratio < below has held for `for_quarters`
 * consecutive quarters (default 1). `effect` may end in ".*" to hit every key
 * of a record (e.g. "politics.approval_by_sector.*").
 */
export interface DegradationDef {
  below: number;
  for_quarters?: number;
  effect: string;
  rate: number;
  additive?: boolean;
  surfaces_as: string;
  triggers_event?: string | null;
}

export interface MinistryDef {
  id: MinistryId;
  /** ₪M/yr */ baseline_budget: number;
  /** 0–1 share uncuttable within a year */ rigidity: number;
  /** diminishing-returns exponent, 0–1 */ crowding: number;
  political_weight: Record<string, number>;
  outputs: OutputDef[];
  degradation: DegradationDef[];
}

const MINISTRY_IDS: ReadonlySet<string> = new Set([
  "defense", "education", "health", "transport", "culture_sport",
  "foreign_affairs", "hasbara", "environment", "water_agriculture",
  "welfare", "housing", "internal_security", "justice", "economy",
  "science", "religious_services", "immigration",
]);

const OUTPUT_KINDS: ReadonlySet<string> = new Set([
  "funded_stock", "derived_stock", "readiness", "production", "pipeline",
  "funded_flow", "inverse_level",
]);

function requireString(o: Record<string, unknown>, field: string, ctx: string): string {
  const v = o[field];
  if (typeof v !== "string" || v.length === 0) throw new Error(`${ctx}: missing "${field}"`);
  return v;
}

function requireNumber(o: Record<string, unknown>, field: string, ctx: string): number {
  const v = o[field];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`${ctx}: missing numeric "${field}"`);
  return v;
}

function parseOutput(raw: unknown, ctx: string): OutputDef {
  if (typeof raw !== "object" || raw === null) throw new Error(`${ctx}: output is not an object`);
  const o = raw as Record<string, unknown>;
  const kind = requireString(o, "kind", ctx);
  if (!OUTPUT_KINDS.has(kind)) throw new Error(`${ctx}: unknown output kind "${kind}"`);
  switch (kind) {
    case "funded_stock":
      return {
        kind,
        target: requireString(o, "target", ctx),
        budget_share_id: requireString(o, "budget_share_id", ctx),
        cost_per_unit_id: requireString(o, "cost_per_unit_id", ctx),
        adjust_rate_id: requireString(o, "adjust_rate_id", ctx),
        max_growth_id: requireString(o, "max_growth_id", ctx),
      };
    case "derived_stock":
      return {
        kind,
        target: requireString(o, "target", ctx),
        source_path: requireString(o, "source_path", ctx),
        share_id: requireString(o, "share_id", ctx),
        adjust_rate_id: requireString(o, "adjust_rate_id", ctx),
      };
    case "readiness":
      return {
        kind,
        target: requireString(o, "target", ctx),
        base_id: requireString(o, "base_id", ctx),
        adjust_rate_id: requireString(o, "adjust_rate_id", ctx),
      };
    case "production": {
      const cls = requireString(o, "munition_class", ctx);
      if (cls !== "interceptors" && cls !== "precision_guided" && cls !== "artillery_shells") {
        throw new Error(`${ctx}: unknown munition_class "${cls}"`);
      }
      return { kind, munition_class: cls, baseline_id: requireString(o, "baseline_id", ctx) };
    }
    case "funded_flow":
      return {
        kind,
        target: requireString(o, "target", ctx),
        base_id: requireString(o, "base_id", ctx),
        budget_share_id: requireString(o, "budget_share_id", ctx),
        cost_per_unit_id: requireString(o, "cost_per_unit_id", ctx),
      };
    case "inverse_level":
      return {
        kind,
        target: requireString(o, "target", ctx),
        base_id: requireString(o, "base_id", ctx),
        elasticity_id: requireString(o, "elasticity_id", ctx),
        adjust_rate_id: requireString(o, "adjust_rate_id", ctx),
      };
    default:
      return {
        kind: "pipeline",
        target: requireString(o, "target", ctx),
        elasticity_id: requireString(o, "elasticity_id", ctx),
        decays_below: requireNumber(o, "decays_below", ctx),
      };
  }
}

function parseDegradation(raw: unknown, ctx: string): DegradationDef {
  if (typeof raw !== "object" || raw === null) throw new Error(`${ctx}: degradation rule is not an object`);
  const o = raw as Record<string, unknown>;
  const rule: DegradationDef = {
    below: requireNumber(o, "below", ctx),
    effect: requireString(o, "effect", ctx),
    rate: requireNumber(o, "rate", ctx),
    surfaces_as: requireString(o, "surfaces_as", ctx),
  };
  if (typeof o.for_quarters === "number") rule.for_quarters = o.for_quarters;
  if (typeof o.additive === "boolean") rule.additive = o.additive;
  if (typeof o.triggers_event === "string") rule.triggers_event = o.triggers_event;
  return rule;
}

export function parseMinistryDefs(raw: unknown): MinistryDef[] {
  if (!Array.isArray(raw)) throw new Error("ministries.json: expected an array");
  const defs: MinistryDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) throw new Error("ministries.json: entry is not an object");
    const o = item as Record<string, unknown>;
    const id = requireString(o, "id", "ministry");
    if (!MINISTRY_IDS.has(id)) throw new Error(`ministries.json: unknown ministry id "${id}"`);
    if (seen.has(id)) throw new Error(`ministries.json: duplicate ministry "${id}"`);
    seen.add(id);
    const ctx = `ministry "${id}"`;
    const outputsRaw = o.outputs;
    if (!Array.isArray(outputsRaw)) throw new Error(`${ctx}: missing outputs array`);
    const pw = o.political_weight;
    const political_weight: Record<string, number> = {};
    if (typeof pw === "object" && pw !== null) {
      for (const [k, v] of Object.entries(pw as Record<string, unknown>)) {
        if (typeof v === "number") political_weight[k] = v;
      }
    }
    const degradationRaw = o.degradation;
    defs.push({
      id: id as MinistryId,
      baseline_budget: requireNumber(o, "baseline_budget", ctx),
      rigidity: requireNumber(o, "rigidity", ctx),
      crowding: requireNumber(o, "crowding", ctx),
      political_weight,
      outputs: outputsRaw.map((out, i) => parseOutput(out, `${ctx} output[${i}]`)),
      degradation: Array.isArray(degradationRaw)
        ? degradationRaw.map((d, i) => parseDegradation(d, `${ctx} degradation[${i}]`))
        : [],
    });
  }
  if (defs.length !== MINISTRY_IDS.size) {
    throw new Error(`ministries.json: expected ${MINISTRY_IDS.size} ministries, got ${defs.length}`);
  }
  return defs;
}
