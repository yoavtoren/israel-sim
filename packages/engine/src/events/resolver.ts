/**
 * Tick step 11: hazard evaluation & event resolution (spec §8).
 * Order per tick: (1) fire the pending spawn queue from last tick,
 * (2) condition events whose thresholds hold, (3) hazard events by Poisson
 * draw from the forked "hazards" stream. Cooldowns and the spawn queue live
 * in the state so runs are resumable and deterministic.
 */

import type { Rng } from "../rng";
import type { EngineEvent, TickLogEntry, WorldState } from "../state/types";
import type { Registry } from "../constants/registry";
import type { ConditionDef, EventDef } from "./defs";
import { evalHazard, poisson } from "./hazards";
import { addPath, getPath } from "../state/paths";

const MAX_MULTIPLICITY = 5;

function conditionHolds(s: WorldState, conds: ConditionDef[]): boolean {
  for (const cnd of conds) {
    const x = getPath(s, cnd.path);
    const ok =
      cnd.op === "<" ? x < cnd.value :
      cnd.op === "<=" ? x <= cnd.value :
      cnd.op === ">" ? x > cnd.value : x >= cnd.value;
    if (!ok) return false;
  }
  return true;
}

function expandTargets(s: WorldState, target: string): string[] {
  if (!target.endsWith(".*")) return [target];
  const parentPath = target.slice(0, -2);
  const parts = parentPath.split(".");
  let node: unknown = s;
  for (const p of parts) node = (node as Record<string, unknown>)[p];
  return Object.entries(node as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .map(([k]) => `${parentPath}.${k}`);
}

function fire(s: WorldState, def: EventDef, count: number, tickIndex: number, events: EngineEvent[], log: TickLogEntry[], via: string): void {
  for (const eff of def.effects) {
    for (const path of expandTargets(s, eff.target)) {
      const cur = getPath(s, path);
      let delta = (eff.relative === true ? cur * eff.delta : eff.delta) * count;
      if (eff.clamp) {
        const next = Math.min(eff.clamp[1], Math.max(eff.clamp[0], cur + delta));
        delta = next - cur;
      }
      addPath(s, path, delta);
      log.push({ t: s.t, step: 11, fn: `event.${def.id}`, target: path, delta, constant_id: null, note: via });
    }
  }
  s.event_cooldowns[def.id] = tickIndex + def.cooldown;
  events.push({ id: def.id, note: via, count });
}

export function eventsStep(
  s: WorldState,
  defs: EventDef[],
  c: Registry,
  rng: Rng,
  tickIndex: number,
  events: EngineEvent[],
  log: TickLogEntry[],
): void {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const onCooldown = (d: EventDef): boolean => (s.event_cooldowns[d.id] ?? -1) > tickIndex;

  // 1. Spawn queue from last tick (already probability-filtered when queued).
  const queue = s.pending_events;
  s.pending_events = [];
  for (const id of queue) {
    const def = byId.get(id);
    if (!def || onCooldown(def)) continue;
    fire(s, def, 1, tickIndex, events, log, "spawned");
    for (const sp of def.spawns) {
      if (rng.next() < sp.prob) s.pending_events.push(sp.id);
    }
  }

  // 2 + 3. Condition and hazard triggers.
  for (const def of defs) {
    if (onCooldown(def)) continue;
    let count = 0;
    let via = "";
    if (def.condition !== null && conditionHolds(s, def.condition)) {
      count = 1;
      via = "condition";
    } else if (def.hazard !== null) {
      const h = evalHazard(s, def.hazard, c);
      const k = poisson(rng, h);
      if (k > 0) {
        count = def.binary ? 1 : Math.min(k, MAX_MULTIPLICITY);
        via = `hazard h=${h.toFixed(3)}`;
      }
    }
    if (count > 0) {
      fire(s, def, count, tickIndex, events, log, via);
      for (const sp of def.spawns) {
        if (rng.next() < sp.prob) s.pending_events.push(sp.id);
      }
    }
  }
}
