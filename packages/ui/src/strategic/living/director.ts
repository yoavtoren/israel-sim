/** The director decides WHEN the map moves. It watches campaign transitions
 *  and starts the matching scenes only when something happens:
 *
 *    - a dilemma is put on the table   → its scene (the attack, the protest…)
 *    - the Prime Minister decides      → the decision's scene, and the exodus it
 *                                         triggers when it hits cohesion/economy
 *    - a consequence card comes up     → that consequence's scene
 *
 *  Each scene runs once for its own duration, then its damage becomes a scar
 *  on the still map and the map stops. `activeAt(now)` is what the map loops
 *  ask before requesting another frame. */

import { create } from "zustand";
import { strategic } from "@engine";
import type { Camera } from "../geo";
import { hashString } from "../scenarios";
import { makeFrame } from "./draw";
import { CONSEQUENCE_SCENES, DILEMMA_SCENES, OPTION_SCENES, emigrationFor, fromVisual, infer, type SceneItem } from "./catalog";
import { DEMOLISH_SECONDS, barrierProgressAt, drawScene, sceneBounds, sceneDuration, sceneScars, type SoundKind } from "./scenes";
import type { LonLat } from "../geo";
import { drawStill, worldFromGame, type LivingWorld, type Scar } from "./static";

type Game = strategic.CampaignState;

export interface RunningScene {
  id: string;
  item: SceneItem;
  /** ms timestamp at which the scene's clock reads 0 */ start: number;
  /** seconds */ duration: number;
  seed: number;
  /** the world as it was when the scene was triggered */ world: LivingWorld;
  replay: boolean;
}

interface LivingStore {
  running: RunningScene[];
  scars: Scar[];
  lastHead: string | null;
  lastDilemma: string | null;
  lastChoices: number;
  /** the most recent trigger, for "show again" */ lastTrigger: { items: SceneItem[]; key: string; world: LivingWorld } | null;
  observe(prev: Game | null, next: Game, now: number): void;
  replay(now: number): void;
  /** start a list of scenes directly (dev tooling, tests) */ play(items: SceneItem[], key: string, world: LivingWorld, now: number): void;
  /** retire finished scenes and turn their damage into scars */ settle(now: number): void;
  activeAt(now: number): boolean;
  /** the area the most recently started, still-running scene takes place in */ boundsAt(now: number): [LonLat, LonLat] | null;
}

const endOf = (r: RunningScene) => r.start + r.duration * 1000;

function start(items: SceneItem[], key: string, world: LivingWorld, now: number, lead = 0, replay = false): RunningScene[] {
  return items.map((it, i) => {
    const seed = hashString(`${key}:${i}:${it.spec.kind}`);
    return {
      id: `${key}:${i}`,
      item: it,
      start: now + (lead + it.delay) * 1000,
      duration: sceneDuration(it.spec, seed, world),
      seed,
      world,
      replay,
    };
  });
}

function optionItems(def: strategic.DilemmaDef, opt: strategic.DilemmaOption, branch: strategic.GambleBranch | null): SceneItem[] {
  if (def.crisisId !== undefined) return [];
  const listed = OPTION_SCENES[opt.id];
  const deltas: Partial<strategic.SimulationMetrics> = { ...opt.deltas };
  if (opt.gamble !== undefined && branch !== null) {
    for (const [k, v] of Object.entries(opt.gamble[branch].deltas) as Array<[strategic.MetricKey, number]>) deltas[k] = (deltas[k] ?? 0) + v;
  }
  const base = listed ?? (opt.visual !== undefined ? fromVisual(opt.visual, opt.label) : infer({ headline: opt.label, severity: "info", focus: def.focus, visual: null, deltas, quits: [], threats: [] }, opt.flags, partyColor));
  return [...base, ...emigrationFor(deltas)];
}

function consequenceItems(game: Game, head: strategic.ConsequenceEvent): SceneItem[] {
  const listed = CONSEQUENCE_SCENES[head.headline.en];
  if (listed !== undefined) return listed;
  // find the authored consequence to read the flags it set
  const last = game.choices[game.choices.length - 1];
  const def = last === undefined ? undefined : strategic.DILEMMAS[last.dilemma];
  if (def?.crisisId !== undefined) return [];
  const opt = def?.options.find((o) => o.id === last?.option);
  const authored = opt?.consequences?.find((c) => c.headline.en === head.headline.en);
  return infer(head, authored?.flags, partyColor);
}

function dilemmaItems(def: strategic.DilemmaDef): SceneItem[] {
  if (def.crisisId !== undefined) return [];
  return DILEMMA_SCENES[def.id] ?? fromVisual(def.visual, def.title);
}

function partyColor(p: strategic.PartyId): string {
  return strategic.PARTIES[p].color;
}

export const useLiving = create<LivingStore>((set, get) => ({
  running: [],
  scars: [],
  lastHead: null,
  lastDilemma: null,
  lastChoices: 0,
  lastTrigger: null,

  observe(prev, next, now) {
    const st = get();
    const setup = next.phase === "party" || next.phase === "coalition";
    if (setup) {
      if (st.running.length > 0 || st.scars.length > 0 || st.lastChoices > 0 || st.lastHead !== null) {
        set({ running: [], scars: [], lastHead: null, lastDilemma: null, lastChoices: 0, lastTrigger: null });
      }
      return;
    }
    if (prev !== null && prev.seed !== next.seed) {
      set({ running: [], scars: [], lastHead: null, lastDilemma: null, lastChoices: 0, lastTrigger: null });
    }
    const world = worldFromGame(next);
    let running = get().running;
    let lastTrigger = get().lastTrigger;
    let lead = 0;

    // 1. a decision was taken
    if (next.choices.length > get().lastChoices) {
      const c = next.choices[next.choices.length - 1];
      const def = strategic.DILEMMAS[c.dilemma];
      const opt = def?.options.find((o) => o.id === c.option);
      if (def !== undefined && opt !== undefined) {
        const items = optionItems(def, opt, c.branch);
        if (items.length > 0) {
          const key = `${next.seed}:choice:${next.choices.length}`;
          running = [...running, ...start(items, key, world, now)];
          lastTrigger = { items, key, world };
          lead = 2.5;
        }
      }
    }
    // 2. a consequence card came up
    const head = next.phase === "consequences" ? next.queue[0] : undefined;
    let lastHead = get().lastHead;
    if (head !== undefined && head.id !== lastHead) {
      lastHead = head.id;
      const items = consequenceItems(next, head);
      if (items.length > 0) {
        const key = `${next.seed}:event:${head.id}`;
        running = [...running, ...start(items, key, world, now, lead)];
        lastTrigger = { items, key, world };
      }
    }
    // 3. a new question is on the table
    const dilemma = next.phase === "dilemma" || next.phase === "policy" ? strategic.currentDilemma(next) : null;
    const dKey = dilemma === null ? null : `${next.seed}:${next.step}:${dilemma.id}`;
    let lastDilemma = get().lastDilemma;
    if (dilemma !== null && dKey !== lastDilemma) {
      lastDilemma = dKey;
      const items = dilemmaItems(dilemma);
      if (items.length > 0 && dKey !== null) {
        running = [...running, ...start(items, dKey, world, now, lead)];
        lastTrigger = { items, key: dKey, world };
      }
    }
    set({ running, lastHead, lastDilemma, lastChoices: next.choices.length, lastTrigger });
  },

  replay(now) {
    const lt = get().lastTrigger;
    if (lt === null) return;
    // drop anything still running from that trigger and play it again from zero
    const others = get().running.filter((r) => !r.id.startsWith(`${lt.key}:`));
    set({ running: [...others, ...start(lt.items, lt.key, lt.world, now, 0, true)] });
  },

  play(items, key, world, now) {
    set({ running: [...get().running, ...start(items, key, world, now)], lastTrigger: { items, key, world } });
  },

  settle(now) {
    const { running, scars } = get();
    const done = running.filter((r) => now >= endOf(r));
    if (done.length === 0) return;
    const known = new Set(scars.map((s) => s.id));
    const fresh: Scar[] = [];
    for (const r of done) {
      for (const s of sceneScars(r.item.spec, r.seed, r.world, r.world.step, r.id)) {
        if (!known.has(s.id)) {
          known.add(s.id);
          fresh.push(s);
        }
      }
    }
    set({ running: running.filter((r) => now < endOf(r)), scars: fresh.length > 0 ? [...scars, ...fresh].slice(-160) : scars });
  },

  activeAt(now) {
    return get().running.some((r) => now < endOf(r));
  },

  boundsAt(now) {
    let best: RunningScene | null = null;
    for (const r of get().running) {
      if (now < r.start - 800 || now >= endOf(r)) continue;
      if (best === null || r.start > best.start) best = r;
    }
    return best === null ? null : sceneBounds(best.item.spec);
  },
}));

// ---------------------------------------------------------------------------
// drawing entry points
// ---------------------------------------------------------------------------

export interface LivingDrawEnv {
  cam: Camera;
  w: number;
  h: number;
  lang: "he" | "en";
  now: number;
  game: Game;
  sound?: (kind: SoundKind) => void;
}

const lastClock = new Map<string, number>();

/** The still map (plus in-progress overrides from running scenes). */
export function drawLivingStill(ctx: CanvasRenderingContext2D, env: LivingDrawEnv): void {
  const f = makeFrame(ctx, env.cam, env.w, env.h, env.lang);
  const store = useLiving.getState();
  const world = worldFromGame(env.game);
  let barrierProgress: number | null = null;
  let settlementsInScene = false;
  for (const r of store.running) {
    const t = (env.now - r.start) / 1000;
    if (t < 0 || t > r.duration) continue;
    if (r.item.spec.kind === "barrier" && r.item.spec.mode === "demolish") barrierProgress = t > DEMOLISH_SECONDS ? 1 : barrierProgressAt(t);
    if (r.item.spec.kind === "withdrawal") settlementsInScene = true;
  }
  // a demolition scheduled but not yet begun keeps the wall standing
  if (barrierProgress === null && store.running.some((r) => r.item.spec.kind === "barrier" && r.item.spec.mode === "demolish" && env.now < r.start)) barrierProgress = 0;
  // scars from scenes still in progress are not shown until those scenes end
  drawStill(f, world, store.scars, { barrierProgress, settlementsInScene });
}

/** Every scene whose clock is running. */
export function drawLivingScenes(ctx: CanvasRenderingContext2D, env: LivingDrawEnv): void {
  const store = useLiving.getState();
  if (store.running.length === 0) return;
  const f = makeFrame(ctx, env.cam, env.w, env.h, env.lang);
  for (const r of store.running) {
    const t = (env.now - r.start) / 1000;
    if (t < 0 || t > r.duration) continue;
    const prevT = lastClock.get(r.id + (r.replay ? ":r" : "")) ?? t;
    lastClock.set(r.id + (r.replay ? ":r" : ""), t);
    drawScene({ f, t, prevT: Math.min(prevT, t), seed: r.seed, world: r.world, caption: r.item.caption, sound: env.sound ?? (() => undefined) }, r.item.spec);
  }
  if (lastClock.size > 200) lastClock.clear();
}

// Dev-only QA hook: lets a headless browser run any catalogued scene. Stripped from production builds.
if (import.meta.env.DEV && typeof window !== "undefined") {
  void import("./catalog").then((catalog) => {
    (window as unknown as Record<string, unknown>).__living = { useLiving, catalog, worldFromGame };
  });
}
