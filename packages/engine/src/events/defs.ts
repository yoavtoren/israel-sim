/**
 * Declarative events — spec §8.2. Loaded from packages/data/defs/events.json.
 * Hazard: h = base_rate · exp(Σ βᵢ·(offsetᵢ + scaleᵢ·xᵢ)) with every base and β
 * a constants-file entry (C2). No expression strings, no eval — terms are data.
 */

export interface HazardTerm {
  /** StatePath read as xᵢ */ path: string;
  /** constants id supplying βᵢ */ beta_id: string;
  /** xᵢ → offset + scale·xᵢ before multiplying by β */ offset?: number;
  scale?: number;
}

export interface HazardDef {
  /** constants id supplying the base rate (events/quarter) */ base_rate_id: string;
  terms: HazardTerm[];
}

export interface ConditionDef {
  path: string;
  op: "<" | "<=" | ">" | ">=";
  value: number;
}

export interface EffectDef {
  /** StatePath, may end in ".*" */ target: string;
  /** additive delta (× current value when relative) */ delta: number;
  relative?: boolean;
  /** clamp applied after the delta */ clamp?: [number, number];
}

export interface SpawnDef {
  id: string;
  /** probability the follow-on fires next tick */ prob: number;
}

export interface EventDef {
  id: string;
  /** stochastic trigger; null → condition-only */ hazard: HazardDef | null;
  /** deterministic trigger (ANDed thresholds); null → hazard-only */ condition: ConditionDef[] | null;
  /** quarters before this event may fire again */ cooldown: number;
  effects: EffectDef[];
  spawns: SpawnDef[];
  /** false → Poisson count k>1 applies effects k times (capped 5) */ binary: boolean;
  /** fed to the narrator (M8), never shown raw */ narrative_context: string;
}

function req<T>(v: T | undefined, msg: string): T {
  if (v === undefined || v === null) throw new Error(msg);
  return v;
}

const OPS: ReadonlySet<string> = new Set(["<", "<=", ">", ">="]);

export function parseEventDefs(raw: unknown): EventDef[] {
  if (!Array.isArray(raw)) throw new Error("events.json: expected an array");
  const seen = new Set<string>();
  const defs: EventDef[] = [];
  for (const item of raw) {
    const o = item as Record<string, unknown>;
    const id = req(o.id as string, "event missing id");
    if (seen.has(id)) throw new Error(`duplicate event "${id}"`);
    seen.add(id);
    const ctx = `event "${id}"`;

    let hazard: HazardDef | null = null;
    if (o.hazard !== null && o.hazard !== undefined) {
      const h = o.hazard as Record<string, unknown>;
      const terms = (h.terms as Array<Record<string, unknown>>).map((t) => {
        const term: HazardTerm = {
          path: req(t.path as string, `${ctx}: term missing path`),
          beta_id: req(t.beta_id as string, `${ctx}: term missing beta_id`),
        };
        if (typeof t.offset === "number") term.offset = t.offset;
        if (typeof t.scale === "number") term.scale = t.scale;
        return term;
      });
      hazard = { base_rate_id: req(h.base_rate_id as string, `${ctx}: hazard missing base_rate_id`), terms };
    }

    let condition: ConditionDef[] | null = null;
    if (o.condition !== null && o.condition !== undefined) {
      condition = (o.condition as Array<Record<string, unknown>>).map((cnd) => {
        const op = req(cnd.op as string, `${ctx}: condition missing op`);
        if (!OPS.has(op)) throw new Error(`${ctx}: bad op "${op}"`);
        return { path: req(cnd.path as string, `${ctx}: condition missing path`), op: op as ConditionDef["op"], value: req(cnd.value as number, `${ctx}: condition missing value`) };
      });
    }
    // hazard === null && condition === null → spawn-only event (reachable via `spawns`).

    const effects = ((o.effects ?? []) as Array<Record<string, unknown>>).map((e) => {
      const eff: EffectDef = {
        target: req(e.target as string, `${ctx}: effect missing target`),
        delta: req(e.delta as number, `${ctx}: effect missing delta`),
      };
      if (typeof e.relative === "boolean") eff.relative = e.relative;
      if (Array.isArray(e.clamp) && e.clamp.length === 2) eff.clamp = [e.clamp[0] as number, e.clamp[1] as number];
      return eff;
    });

    const spawns = ((o.spawns ?? []) as Array<Record<string, unknown>>).map((sp) => ({
      id: req(sp.id as string, `${ctx}: spawn missing id`),
      prob: req(sp.prob as number, `${ctx}: spawn missing prob`),
    }));

    defs.push({
      id,
      hazard,
      condition,
      cooldown: typeof o.cooldown === "number" ? o.cooldown : 0,
      effects,
      spawns,
      binary: o.binary !== false,
      narrative_context: (o.narrative_context as string) ?? "",
    });
  }
  for (const d of defs) {
    for (const sp of d.spawns) {
      if (!seen.has(sp.id)) throw new Error(`event "${d.id}" spawns unknown event "${sp.id}"`);
    }
  }
  return defs;
}
