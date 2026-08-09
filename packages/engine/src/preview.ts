/**
 * Budget preview — spec §5/§13: a one-tick shadow simulation with the
 * proposed budget, diffed against a zero-change shadow tick. Not hardcoded
 * warnings: `diffs` is what actually moves, `breaks` are the degradation
 * rules that the proposed funding ratios would activate (with their delay).
 */

import type { Decisions, EngineEvent, MinistryId, WorldState } from "./state/types";
import type { EngineContext } from "./tick";
import { tick } from "./tick";

export interface PreviewDiff {
  path: string;
  baseline: number;
  proposed: number;
  delta: number;
}

export interface PreviewBreak {
  ministry: MinistryId;
  surfaces_as: string;
  effect: string;
  /** quarters of sustained underfunding before the rule fires */ fires_after_quarters: number;
  triggers_event: string | null;
}

export interface BudgetPreview {
  diffs: PreviewDiff[];
  breaks: PreviewBreak[];
  events: EngineEvent[];
}

const EXCLUDED_ROOTS: ReadonlySet<string> = new Set(["log", "pipeline", "t"]);

function* numericLeaves(value: unknown, prefix: string): Generator<[string, number]> {
  if (typeof value === "number") {
    yield [prefix, value];
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [k, v] of Object.entries(value)) {
    if (prefix === "" && EXCLUDED_ROOTS.has(k)) continue;
    yield* numericLeaves(v, prefix === "" ? k : `${prefix}.${k}`);
  }
}

export function previewBudget(
  state: WorldState,
  decisions: Decisions,
  ctx: EngineContext,
  minAbsDelta = 1e-9,
): BudgetPreview {
  const baseline = tick(state, {}, ctx);
  const proposed = tick(state, decisions, ctx);

  const baseVals = new Map<string, number>(numericLeaves(baseline.state, ""));
  const diffs: PreviewDiff[] = [];
  for (const [path, propVal] of numericLeaves(proposed.state, "")) {
    const baseVal = baseVals.get(path);
    if (baseVal === undefined) continue;
    const delta = propVal - baseVal;
    if (Math.abs(delta) > minAbsDelta) {
      diffs.push({ path, baseline: baseVal, proposed: propVal, delta });
    }
  }
  diffs.sort((a, b) => Math.abs(b.delta / (Math.abs(b.baseline) + 1e-12)) - Math.abs(a.delta / (Math.abs(a.baseline) + 1e-12)));

  const breaks: PreviewBreak[] = [];
  for (const def of ctx.ministries) {
    // Breaks are judged against the REQUESTED funding level, not the first
    // quarter's rigidity-clamped step toward it: the preview answers "what
    // breaks if you drive the budget here", including delayed rules.
    const requested = decisions.budgets?.[def.id];
    const fr = requested !== undefined
      ? requested / def.baseline_budget
      : proposed.state.fiscal.ministries[def.id].funding_ratio;
    for (const rule of def.degradation) {
      if (fr < rule.below) {
        breaks.push({
          ministry: def.id,
          surfaces_as: rule.surfaces_as,
          effect: rule.effect,
          fires_after_quarters: rule.for_quarters ?? 1,
          triggers_event: rule.triggers_event ?? null,
        });
      }
    }
  }

  // Only events the DECISION causes: ambient hazard events fire identically in
  // both shadow ticks (same seed/tick) and are netted out.
  const baseCounts = new Map<string, number>();
  for (const e of baseline.events) baseCounts.set(e.id, (baseCounts.get(e.id) ?? 0) + e.count);
  const causedEvents = proposed.events.filter((e) => {
    const remaining = baseCounts.get(e.id) ?? 0;
    if (remaining >= e.count) {
      baseCounts.set(e.id, remaining - e.count);
      return false;
    }
    return true;
  });

  return { diffs, breaks, events: causedEvents };
}
