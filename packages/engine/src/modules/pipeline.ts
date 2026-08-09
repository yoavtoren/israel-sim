/**
 * Tick step 5: mature pipeline effects. Applies each effect's current-quarter
 * share; cancels the undelivered remainder when the origin ministry's funding
 * drops below the effect's decay threshold (spec §7.3 — cutting later forfeits
 * the payoff still in flight).
 */

import type { TickLogEntry, WorldState } from "../state/types";
import { addPath } from "../state/paths";

export function pipelineStep(s: WorldState, log: TickLogEntry[]): void {
  const kept: typeof s.pipeline = [];
  for (const effect of s.pipeline) {
    const fr = effect.origin.ministry !== null ? s.fiscal.ministries[effect.origin.ministry].funding_ratio : 1;
    if (effect.decays_if !== null && effect.origin.ministry !== null && fr < effect.decays_if.ministry_funding_below) {
      const forfeited = effect.remaining.reduce((a, b) => a + b, 0);
      log.push({ t: s.t, step: 5, fn: "pipeline_decay", target: effect.target, delta: -forfeited, constant_id: null, note: `origin ${effect.origin.ministry} funding below ${effect.decays_if.ministry_funding_below}` });
      continue;
    }
    const dueRaw = effect.remaining[0];
    const due = dueRaw === undefined ? 0 : dueRaw;
    if (due !== 0) {
      addPath(s, effect.target, due);
      log.push({ t: s.t, step: 5, fn: "pipeline_mature", target: effect.target, delta: due, constant_id: null, note: `origin tick ${effect.origin.tick} (${effect.origin.ministry})` });
    }
    const remaining = effect.remaining.slice(1);
    if (remaining.some((v) => v !== 0)) {
      kept.push({ ...effect, remaining });
    }
  }
  s.pipeline = kept;
}
