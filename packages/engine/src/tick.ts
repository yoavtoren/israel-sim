/**
 * The tick — CONTRACT C4: tick(state, decisions, ctx) → { state, events, log }
 * is pure. No I/O, no Date.now(), no Math.random(). The 13-step order is fixed
 * (spec §7.1). Steps 8 and 10–12 are typed no-ops until their milestones.
 */

import type { Decisions, TickResult, TickLogEntry, WorldState } from "./state/types";
import type { MinistryDef } from "./ministries/defs";
import type { Registry } from "./constants/registry";
import { makeTickStreams } from "./rng";
import { resolveDecisions, fiscalStep } from "./modules/fiscal";
import { marketsStep } from "./modules/markets";
import { ministriesStep } from "./ministries/executor";
import { pipelineStep } from "./modules/pipeline";
import { stocksStep } from "./modules/stocks";
import { demographyStep } from "./modules/demography";
import { macroStep } from "./modules/macro";

export interface EngineContext {
  registry: Registry;
  ministries: MinistryDef[];
  /** t0 of the run; defines the absolute tick index */
  start_year: number;
}

export function tickIndexOf(s: WorldState, startYear: number): number {
  return (s.t.year - startYear) * 4 + (s.t.quarter - 1);
}

export function tick(prev: WorldState, decisions: Decisions, ctx: EngineContext): TickResult {
  const s: WorldState = structuredClone(prev);
  const log: TickLogEntry[] = [];
  const idx = tickIndexOf(s, ctx.start_year);
  const streams = makeTickStreams(s.seed, `t${idx}`);

  resolveDecisions(s, decisions, ctx.ministries, log);          // 1
  fiscalStep(s, ctx.registry, log);                             // 2
  marketsStep(s, ctx.registry, log);                            // 3
  ministriesStep(s, ctx.ministries, ctx.registry, idx, log);    // 4
  pipelineStep(s, log);                                         // 5
  stocksStep(s, ctx.registry, log);                             // 6
  demographyStep(s, ctx.registry, log);                         // 7
  // 8 localities — M4
  macroStep(s, ctx.registry, streams("macro"), log);            // 9
  // 10 security & diplomacy — M6
  // 11 hazards & events — M5
  // 12 politics — M7

  // 13 log & advance clock.
  s.log = log;
  if (s.t.quarter === 4) {
    s.t = { year: s.t.year + 1, quarter: 1 };
  } else {
    s.t = { year: s.t.year, quarter: (s.t.quarter + 1) as 2 | 3 | 4 };
  }

  return { state: s, events: [], log };
}
