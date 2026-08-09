/**
 * Tick step 1b: reforms and economic-model switches (spec §10).
 * A reform is data: prerequisites, ongoing fiscal cost, immediate effects,
 * long-lag pipeline effects, per-sector political cost, reversibility.
 * Repeal stops the cost and applies a partial political backlash; effects
 * already paid into the pipeline keep flowing (no refund, per spec).
 */

import type { Decisions, EconomicModelId, EngineEvent, SectorId, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import { addPath } from "../state/paths";
import { parseKernelShares } from "./kernels";

export interface ReformEffect {
  target: string;
  delta: number;
  clamp?: [number, number];
}

export interface ReformPipelineEffect {
  target: string;
  /** total magnitude delivered over the kernel horizon */ magnitude: number;
  /** e.g. "gamma(shape=4, scale=2.2)" | "step(k=2)" */ kernel: string;
}

export interface ReformDef {
  id: string;
  /** reform ids that must be enacted first */ prerequisites: string[];
  /** ₪M/yr while enacted (negative = saves money) */ fiscal_cost: number;
  effects: ReformEffect[];
  pipeline_effects: ReformPipelineEffect[];
  /** applied once to approval_by_sector on enactment; ×(−0.5) on repeal */ political_cost_by_sector: Partial<Record<SectorId, number>>;
  reversible: boolean;
}

export interface ModelDef {
  id: EconomicModelId;
  overrides: Record<string, number>;
  transition: { stability_shock: number; cohesion_shock: number; trust_shock: number };
}

export function parseReformDefs(raw: unknown): ReformDef[] {
  if (!Array.isArray(raw)) throw new Error("reforms.json: expected an array");
  return raw.map((item) => {
    const o = item as ReformDef;
    if (typeof o.id !== "string" || typeof o.fiscal_cost !== "number" || typeof o.reversible !== "boolean") {
      throw new Error(`reforms.json: malformed entry ${JSON.stringify(o).slice(0, 80)}`);
    }
    return {
      id: o.id,
      prerequisites: o.prerequisites ?? [],
      fiscal_cost: o.fiscal_cost,
      effects: o.effects ?? [],
      pipeline_effects: o.pipeline_effects ?? [],
      political_cost_by_sector: o.political_cost_by_sector ?? {},
      reversible: o.reversible,
    };
  });
}

export function parseModelDefs(raw: unknown): ModelDef[] {
  if (!Array.isArray(raw)) throw new Error("economic_models.json: expected an array");
  return raw as ModelDef[];
}

/** Annual ₪M cost of currently-enacted reforms; part of the budget constraint. */
export function enactedReformCost(s: WorldState, defs: ReformDef[]): number {
  let sum = 0;
  for (const def of defs) {
    if (s.reforms[def.id]?.status === "enacted") sum += def.fiscal_cost;
  }
  return sum;
}

function applyPoliticalCost(s: WorldState, costs: Partial<Record<SectorId, number>>, factor: number, log: TickLogEntry[], note: string): void {
  for (const [sector, cost] of Object.entries(costs) as Array<[SectorId, number]>) {
    const delta = cost * factor;
    s.politics.approval_by_sector[sector] = Math.min(1, Math.max(0, s.politics.approval_by_sector[sector] + delta));
    log.push({ t: s.t, step: 1, fn: "reform_political_cost", target: `politics.approval_by_sector.${sector}`, delta, constant_id: null, note });
  }
}

export function reformsStep(
  s: WorldState,
  decisions: Decisions,
  reformDefs: ReformDef[],
  modelDefs: ModelDef[],
  tickIndex: number,
  events: EngineEvent[],
  log: TickLogEntry[],
): void {
  // --- Reform toggles ---
  for (const [id, action] of Object.entries(decisions.reforms ?? {})) {
    const def = reformDefs.find((d) => d.id === id);
    if (!def) throw new Error(`unknown reform "${id}"`);
    const current = s.reforms[id]?.status;

    if (action === "enact" && current !== "enacted") {
      const missing = def.prerequisites.filter((p) => s.reforms[p]?.status !== "enacted");
      if (missing.length > 0) {
        log.push({ t: s.t, step: 1, fn: "reform_blocked", target: `reforms.${id}`, delta: 0, constant_id: null, note: `missing prerequisites: ${missing.join(", ")}` });
        continue;
      }
      s.reforms[id] = { status: "enacted", enacted_tick: tickIndex };
      for (const eff of def.effects) {
        const cur = eff.clamp ? Math.min(eff.clamp[1], Math.max(eff.clamp[0], eff.delta)) : eff.delta;
        addPath(s, eff.target, cur);
        log.push({ t: s.t, step: 1, fn: `reform.${id}`, target: eff.target, delta: cur, constant_id: null, note: "immediate effect" });
      }
      for (const pe of def.pipeline_effects) {
        const shares = parseKernelShares(pe.kernel);
        s.pipeline.push({
          origin: { tick: tickIndex, ministry: null, decision: `reform:${id}` },
          target: pe.target,
          magnitude: pe.magnitude,
          kernel: pe.kernel,
          remaining: shares.map((sh) => sh * pe.magnitude),
          decays_if: null,
        });
        log.push({ t: s.t, step: 1, fn: `reform.${id}`, target: pe.target, delta: pe.magnitude, constant_id: null, note: `pipeline ${pe.kernel}` });
      }
      applyPoliticalCost(s, def.political_cost_by_sector, 1, log, `enact ${id}`);
      events.push({ id: `reform_enacted_${id}`, note: id, count: 1 });
    }

    if (action === "repeal" && current === "enacted") {
      if (!def.reversible) {
        log.push({ t: s.t, step: 1, fn: "reform_blocked", target: `reforms.${id}`, delta: 0, constant_id: null, note: "irreversible" });
        continue;
      }
      s.reforms[id] = { status: "repealed", enacted_tick: s.reforms[id].enacted_tick };
      // Pipeline is NOT refunded (spec §10): delivered and in-flight effects stand.
      applyPoliticalCost(s, def.political_cost_by_sector, -0.5, log, `repeal ${id} (backlash)`);
      events.push({ id: `reform_repealed_${id}`, note: id, count: 1 });
    }
  }

  // --- Economic-model switch: overlay changes + one-time transition shock ---
  if (decisions.economic_model !== undefined && decisions.economic_model !== s.economic_model) {
    const model = modelDefs.find((m) => m.id === decisions.economic_model);
    if (!model) throw new Error(`unknown economic model "${decisions.economic_model}"`);
    const from = s.economic_model;
    s.economic_model = model.id;
    s.politics.coalition.stability = Math.max(0, s.politics.coalition.stability - model.transition.stability_shock);
    s.politics.social_cohesion = Math.max(0, s.politics.social_cohesion - model.transition.cohesion_shock);
    s.politics.institutional_trust = Math.max(0, s.politics.institutional_trust - model.transition.trust_shock);
    log.push({ t: s.t, step: 1, fn: "economic_model_switch", target: "politics.coalition.stability", delta: -model.transition.stability_shock, constant_id: null, note: `${from} → ${model.id}` });
    events.push({ id: "economic_model_switch", note: `${from} → ${model.id}`, count: 1 });
  }
}
