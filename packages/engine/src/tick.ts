/**
 * The tick — CONTRACT C4: tick(state, decisions, ctx) → { state, events, log }
 * is pure. No I/O, no Date.now(), no Math.random(). The 13-step order is fixed
 * (spec §7.1). Steps 8 and 10–12 are typed no-ops until their milestones.
 */

import type { Decisions, EngineEvent, TickResult, TickLogEntry, WorldState } from "./state/types";
import type { MinistryDef } from "./ministries/defs";
import type { EventDef } from "./events/defs";
import type { Registry } from "./constants/registry";
import { makeTickStreams } from "./rng";
import { resolveDecisions, fiscalStep } from "./modules/fiscal";
import { marketsStep } from "./modules/markets";
import { ministriesStep } from "./ministries/executor";
import { pipelineStep } from "./modules/pipeline";
import { stocksStep } from "./modules/stocks";
import { degradationStep } from "./modules/degradation";
import { demographyStep } from "./modules/demography";
import { sectorsStep } from "./modules/sectors";
import { localitiesStep } from "./modules/localities";
import { macroStep } from "./modules/macro";
import { securityStep } from "./modules/security";
import { diplomacyStep } from "./modules/diplomacy";
import { redlinesStep } from "./modules/redlines";
import { eventsStep } from "./events/resolver";
import { politicsStep } from "./modules/politics";
import { enactedReformCost, reformsStep, type ModelDef, type ReformDef } from "./modules/reforms";
import { withOverrides } from "./constants/registry";

export interface EngineContext {
  registry: Registry;
  ministries: MinistryDef[];
  /** declarative event definitions (empty array → no events) */
  events: EventDef[];
  /** reform definitions (empty array → no reforms available) */
  reforms: ReformDef[];
  /** economic-model overlays (spec §10); "mixed" needs no entry */
  models: ModelDef[];
  /** t0 of the run; defines the absolute tick index */
  start_year: number;
}

export function tickIndexOf(s: WorldState, startYear: number): number {
  return (s.t.year - startYear) * 4 + (s.t.quarter - 1);
}

export function tick(prev: WorldState, decisions: Decisions, ctx: EngineContext): TickResult {
  // A terminated run (red line / collapse) is frozen: tick is a no-op.
  if (prev.outcome.ended) {
    return { state: structuredClone(prev), events: [], log: [] };
  }
  const s: WorldState = structuredClone(prev);
  const log: TickLogEntry[] = [];
  const events: EngineEvent[] = [];
  const idx = tickIndexOf(s, ctx.start_year);
  const streams = makeTickStreams(s.seed, `t${idx}`);

  resolveDecisions(s, decisions, ctx.ministries, log);          // 1a budgets, periphery
  reformsStep(s, decisions, ctx.reforms, ctx.models, idx, events, log); // 1b reforms + model switch
  // The economic model is a constants overlay (spec §10) for everything downstream.
  const model = ctx.models.find((m) => m.id === s.economic_model);
  const c = withOverrides(ctx.registry, model?.overrides ?? {});
  fiscalStep(s, c, enactedReformCost(s, ctx.reforms), log);     // 2
  marketsStep(s, c, log);                                       // 3
  ministriesStep(s, ctx.ministries, c, idx, log);               // 4
  pipelineStep(s, log);                                         // 5
  stocksStep(s, c, log);                                        // 6
  degradationStep(s, ctx.ministries, events, log);              // 6b
  demographyStep(s, c, log);                                    // 7a demography
  sectorsStep(s, c, log);                                       // 7b sector dynamics
  localitiesStep(s, c, log);                                    // 8
  macroStep(s, c, streams("macro"), log);                       // 9
  securityStep(s, c, events, log);                              // 10a
  diplomacyStep(s, c, log);                                     // 10b
  redlinesStep(s, decisions, c, idx, events, log);              // 10c
  eventsStep(s, ctx.events, c, streams("hazards"), idx, events, log); // 11
  politicsStep(s, c, events, log);                              // 12 coalition, cohesion, civil-war pressure

  // 13 log & advance clock.
  s.log = log;
  if (s.t.quarter === 4) {
    s.t = { year: s.t.year + 1, quarter: 1 };
  } else {
    s.t = { year: s.t.year, quarter: (s.t.quarter + 1) as 2 | 3 | 4 };
  }

  return { state: s, events, log };
}
