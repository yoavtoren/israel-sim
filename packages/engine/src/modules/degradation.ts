/**
 * Tick step 6b: degradation — what breaks when a ministry is underfunded
 * (spec §5). A rule fires each quarter once funding_ratio has been below its
 * threshold for `for_quarters` consecutive quarters. Consecutive-quarter
 * counters live in MinistryState.degradation_counters (state-serializable).
 * The moment a rule first activates, its `triggers_event` id (if any) is
 * emitted as an engine event.
 */

import type { EngineEvent, TickLogEntry, WorldState } from "../state/types";
import type { MinistryDef } from "../ministries/defs";
import { addPath, getPath } from "../state/paths";

/** Expand "a.b.*" to all numeric keys of the record at a.b. */
function expandEffectPaths(s: WorldState, effect: string): string[] {
  if (!effect.endsWith(".*")) return [effect];
  const parentPath = effect.slice(0, -2);
  const parts = parentPath.split(".");
  let node: unknown = s;
  for (const p of parts) {
    if (typeof node !== "object" || node === null) throw new Error(`degradation path "${effect}" broken at "${p}"`);
    node = (node as Record<string, unknown>)[p];
  }
  if (typeof node !== "object" || node === null) throw new Error(`degradation path "${effect}" has no record parent`);
  return Object.entries(node as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => `${parentPath}.${k}`);
}

export function degradationStep(
  s: WorldState,
  defs: MinistryDef[],
  events: EngineEvent[],
  log: TickLogEntry[],
): void {
  for (const def of defs) {
    const ms = s.fiscal.ministries[def.id];
    if (ms.degradation_counters.length !== def.degradation.length) {
      ms.degradation_counters = def.degradation.map(() => 0);
    }
    def.degradation.forEach((rule, i) => {
      if (ms.funding_ratio < rule.below) {
        ms.degradation_counters[i] += 1;
      } else {
        ms.degradation_counters[i] = 0;
        return;
      }
      const needed = rule.for_quarters ?? 1;
      if (ms.degradation_counters[i] < needed) return;
      if (ms.degradation_counters[i] === needed && rule.triggers_event) {
        events.push({ id: rule.triggers_event, note: `${def.id}: ${rule.surfaces_as}`, count: 1 });
      }
      for (const path of expandEffectPaths(s, rule.effect)) {
        const delta = rule.additive === true ? rule.rate / 4 : (getPath(s, path) * rule.rate) / 4;
        addPath(s, path, delta);
        log.push({ t: s.t, step: 6, fn: `${def.id}.degradation`, target: path, delta, constant_id: null, note: rule.surfaces_as });
      }
    });
  }
}
