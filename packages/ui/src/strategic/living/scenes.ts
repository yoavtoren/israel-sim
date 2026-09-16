/** Scenes: one-shot choreographies played when something happens in the game.
 *  Every scene is a pure function of its own clock `t` (seconds since it
 *  started) and a seed — so it can be replayed, scrubbed and tested — and each
 *  one ends: when `t` passes `sceneDuration`, it stops drawing and its lasting
 *  damage (`sceneScars`) becomes part of the still map. */

import type { LonLat, Pt } from "../geo";
import { hash01, hashString } from "../scenarios";
import {
  BLUE, OLIVE_DARK, RED, TEAL, airliner, along, arcPoint, arcTrail, box, clamp01, drone, ease, explosion, fallingBomb, fillRing,
  fire, flash, helicopter, house, icon, jet, jitter, label, lerp, mushroom, person, pill, puff, raisedMissile,
  roundRect, ship, sirenZone, smokeColumn, smooth, tracer, vehicle, window01, type Frame, type ShipKind, type VehicleKind,
} from "./draw";
import { AREA_C, BARRIER, OUTPOSTS, P, SEA_LANES, AIR_ROUTES, SETTLEMENTS, WATER_PIPE, type PlaceId } from "./places";
import { drawSettlement, type LivingWorld, type Scar } from "./static";

type Bi = { he: string; en: string };
const tr = (b: Bi, lang: "he" | "en") => b[lang];
const L = (id: PlaceId): LonLat => P[id];

export type Front = "gaza" | "lebanon" | "west_bank" | "iran" | "yemen" | "iraq";
export type StrikeArea = "gaza" | "lebanon" | "iran" | "yemen" | "west_bank" | "dahiya";
export type IconKind = Parameters<typeof icon>[2];

export type SceneSpec =
  | { kind: "barrage"; front: Front; count: number; weapon: "rocket" | "precision" | "ballistic" | "drone"; targets: PlaceId[] }
  | { kind: "airstrike"; area: StrikeArea; sorties: number; bombs: number; wide: boolean }
  | { kind: "ground"; theater: "gaza" | "lebanon" | "west_bank"; mode: "occupy" | "raid" | "pullback" | "sweep" }
  | { kind: "infiltration"; front: "gaza" | "lebanon" | "west_bank"; squads: number; tunnel: boolean }
  | { kind: "terror"; place: PlaceId }
  | { kind: "crowd"; place: PlaceId; size: number; mode: "protest" | "right_rally" | "refusal" | "haredi" | "crackdown" | "disperse" | "amman" }
  | { kind: "flights"; count: number; mode: "emigration" | "riyadh" }
  | { kind: "airlift"; mode: "arrive" | "halt" | "pact" }
  | { kind: "trade"; mode: "sanctions" | "resume" }
  | { kind: "red_sea"; mode: "attack" | "hodeidah" | "task_force" | "reroute" }
  | { kind: "barrier"; mode: "demolish" | "seal" }
  | { kind: "withdrawal"; mode: "immediate" | "staged" | "un" }
  | { kind: "settlers"; mode: "build" | "sovereignty" | "freeze" | "violence" | "revolt" | "enforce" }
  | { kind: "siege"; mode: "close" | "aid" }
  | { kind: "transfer" }
  | { kind: "boats" }
  | { kind: "nuclear" }
  | { kind: "diplomacy"; links: Array<{ from: PlaceId; to: PlaceId; tone: -1 | 0 | 1; icon: IconKind }> }
  | { kind: "mobilize" }
  | { kind: "ceasefire" }
  | { kind: "egypt_army" }
  | { kind: "iran_tels" }
  | { kind: "economy"; mode: "downgrade" | "austerity" | "deficit" | "factories" | "boost" }
  | { kind: "knesset"; mode: "quit" | "threat" | "fall" | "election"; color: string }
  | { kind: "water"; mode: "cut" | "resume" }
  | { kind: "pa_forces"; mode: "enter_gaza" | "collapse" }
  | { kind: "demolitions" };

export type SoundKind = "alert" | "launch" | "intercept" | "impact";

export interface SceneEnv {
  f: Frame;
  /** seconds since the scene started */ t: number;
  /** the scene clock at the previous frame (for one-off beats like sounds) */ prevT: number;
  seed: number;
  world: LivingWorld;
  caption: Bi | null;
  sound(kind: SoundKind): void;
}

const crossed = (env: SceneEnv, x: number) => env.prevT < x && env.t >= x;

// ---------------------------------------------------------------------------
// shared motion helpers
// ---------------------------------------------------------------------------

/** Position on a path between t0 and t0+dur (eased), holding at the ends. */
function travel(path: LonLat[], t: number, t0: number, dur: number): { p: Pt; a: number; k: number; moving: boolean } {
  const k = ease((t - t0) / dur);
  const { p, a } = along(path, k);
  return { p, a, k, moving: t > t0 && t < t0 + dur };
}

// ---------------------------------------------------------------------------
// barrage: sirens, launches, Iron Dome / Arrow, impacts, tally
// ---------------------------------------------------------------------------

const LAUNCH_SITES: Record<Front, PlaceId[]> = {
  gaza: ["gaza_city", "jabalia", "khan_younis", "deir_balah", "rafah"],
  lebanon: ["tyre", "bint_jbeil", "nabatieh", "litani"],
  west_bank: ["jenin", "tulkarm", "nablus"],
  iran: ["isfahan", "kermanshah", "tehran"],
  yemen: ["sanaa", "hodeidah"],
  iraq: ["kermanshah"],
};

const FRONT_NAME: Record<Front, Bi> = {
  gaza: { he: "מעזה", en: "from Gaza" }, lebanon: { he: "מלבנון", en: "from Lebanon" }, west_bank: { he: "מיהודה ושומרון", en: "from the West Bank" },
  iran: { he: "מאיראן", en: "from Iran" }, yemen: { he: "מתימן", en: "from Yemen" }, iraq: { he: "מעיראק", en: "from Iraq" },
};

const BATTERIES: PlaceId[] = ["dome_south", "dome_gushdan", "dome_north", "dome_negev"];

interface Shot {
  i: number;
  from: LonLat;
  to: LonLat;
  target: PlaceId;
  t0: number;
  flight: number;
  kill: number | null;
  open: boolean;
  battery: LonLat;
}

function interceptRate(world: LivingWorld, weapon: string): number {
  const aid = world.metrics.usMilitaryAid;
  let r = 0.62 + aid * 0.0033;
  if (world.flags.usArmsHold) r -= 0.12;
  if (weapon === "drone") r += 0.03;
  if (weapon === "precision") r -= 0.08;
  return Math.max(0.45, Math.min(0.95, r));
}

function planBarrage(spec: Extract<SceneSpec, { kind: "barrage" }>, seed: number, world: LivingWorld): Shot[] {
  const sites = LAUNCH_SITES[spec.front];
  const n = Math.max(1, Math.min(24, spec.count));
  const gap = spec.weapon === "ballistic" ? 1.1 : spec.weapon === "drone" ? 1.4 : Math.max(0.28, Math.min(0.9, 8 / n));
  const rate = interceptRate(world, spec.weapon);
  return Array.from({ length: n }, (_, i) => {
    const from = jitter(L(sites[i % sites.length]), 0.02, seed, i);
    const target = spec.targets[Math.floor(hash01(seed, i + 50) * spec.targets.length)] ?? "tel_aviv";
    // ~1 in 4 rockets is heading for open ground: Iron Dome lets those fall
    const open = spec.weapon === "rocket" && hash01(seed, i + 70) < 0.25;
    const aim = jitter(L(target), open ? 0.07 : 0.015, seed, i + 100);
    const d = Math.hypot(aim[0] - from[0], aim[1] - from[1]) * 100;
    const flight = spec.weapon === "ballistic" ? 10 : spec.weapon === "drone" ? 9 + d / 60 : spec.weapon === "precision" ? 3.5 + d / 30 : 2.4 + d / 38;
    const intercepted = !open && hash01(seed, i + 90) < rate;
    let best: LonLat = L("dome_south");
    let bestD = Infinity;
    for (const b of BATTERIES) {
      const bd = Math.hypot(L(b)[0] - aim[0], L(b)[1] - aim[1]);
      if (bd < bestD) {
        bestD = bd;
        best = L(b);
      }
    }
    if (spec.weapon === "ballistic") best = L("arrow");
    return { i, from, to: aim, target, t0: 1.6 + i * gap, flight, kill: intercepted ? (spec.weapon === "ballistic" ? 0.62 : 0.74) : null, open, battery: best };
  });
}

function barrageDuration(spec: Extract<SceneSpec, { kind: "barrage" }>, seed: number, world: LivingWorld): number {
  const shots = planBarrage(spec, seed, world);
  return Math.max(...shots.map((s) => s.t0 + s.flight)) + 8;
}

function runBarrage(env: SceneEnv, spec: Extract<SceneSpec, { kind: "barrage" }>): void {
  const { f, t, seed, world } = env;
  const { ctx, u } = f;
  const shots = planBarrage(spec, seed, world);
  const lastImpact = Math.max(...shots.map((s) => s.t0 + s.flight));
  const ballistic = spec.weapon === "ballistic";

  // sirens over the target towns
  const towns = [...new Set(shots.filter((s) => !s.open).map((s) => s.target))];
  const sirenA = window01(t, 0.6, lastImpact + 2.5, 0.5);
  for (const id of towns) {
    const p = f.L(L(id));
    if (f.on(p, 60)) sirenZone(f, p, t, 16 * u, sirenA, f.lang === "he" ? `צבע אדום · ${townName(id).he}` : `Red alert · ${townName(id).en}`);
  }
  if (crossed(env, 0.7)) env.sound("alert");

  for (const s of shots) {
    const tl = t - s.t0;
    if (tl < -3) continue;
    const a = f.L(s.from);
    const b = f.L(s.to);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const H = ballistic ? Math.min(150, dist * 0.3) : spec.weapon === "drone" ? 8 * u : Math.min(70, dist * 0.33 + 6);
    // the launcher
    if (ballistic && tl > -3 && tl < 0.5 && f.on(a, 40)) {
      vehicle(f, a, 0.4, "tel", t, false);
      raisedMissile(f, { x: a.x + 2 * u, y: a.y - 1 * u }, smooth(-3, -1, tl));
    }
    if (tl >= 0 && tl < 0.6 && f.on(a, 30)) {
      flash(f, a, u * 1.3, 1 - tl / 0.6);
      puff(ctx, a, (3 + tl * 12) * u, `rgba(190,170,140,${(0.5 * (1 - tl / 0.6)).toFixed(3)})`);
    }
    if (crossed(env, s.t0) && s.i % 4 === 0) env.sound("launch");
    if (tl < 0) continue;
    const k = tl / s.flight;
    const endK = s.kill ?? 1;
    if (k <= endK) {
      const head = arcPoint(a, b, k, H);
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = "rgba(200,55,45,0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(head.ground.x, head.ground.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(40,34,24,0.25)";
      ctx.beginPath();
      ctx.ellipse(head.ground.x + head.alt * 0.3, head.ground.y + head.alt * 0.15, 2 * u, 1 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      if (spec.weapon === "drone") {
        const next = arcPoint(a, b, Math.min(1, k + 0.01), H).ground;
        drone(f, head.ground, Math.atan2(next.y - head.ground.y, next.x - head.ground.x), 8, true);
      } else {
        arcTrail(f, a, b, Math.max(0, k - (ballistic ? 0.3 : 0.45)), k, H, ballistic ? "217,106,28" : "115,105,95", (ballistic ? 2.2 : 1.4) * u);
        if (ballistic && k > 0.8) puff(ctx, head.air, 7 * u, "rgba(255,170,90,0.85)");
        puff(ctx, head.air, 3.2 * u, ballistic ? "rgba(217,106,28,0.95)" : "rgba(240,140,60,0.95)");
        ctx.fillStyle = "#3A2A20";
        ctx.beginPath();
        ctx.arc(head.air.x, head.air.y, 1.2 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (s.kill !== null) {
      const killPt = arcPoint(a, b, s.kill, H).air;
      const tKill = s.kill * s.flight;
      const tLaunch = tKill - (ballistic ? 4 : 1.7);
      const bat = f.L(s.battery);
      if (tl >= tLaunch && tl <= tKill) {
        const kk = (tl - tLaunch) / (tKill - tLaunch);
        if (kk < 0.15) flash(f, bat, u, 1 - kk / 0.15);
        const ctrl = { x: lerp(bat.x, killPt.x, 0.3), y: Math.min(bat.y, killPt.y) - 30 * u };
        const q = (x: number) => ({ x: (1 - x) * (1 - x) * bat.x + 2 * (1 - x) * x * ctrl.x + x * x * killPt.x, y: (1 - x) * (1 - x) * bat.y + 2 * (1 - x) * x * ctrl.y + x * x * killPt.y });
        ctx.strokeStyle = "rgba(14,138,148,0.6)";
        ctx.lineWidth = 1.3 * u;
        ctx.beginPath();
        for (let i = 0; i <= 10; i++) {
          const pt = q(Math.max(0, kk - 0.45) + (i / 10) * Math.min(kk, 0.45));
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        const h = q(kk);
        puff(ctx, h, 3 * u, "rgba(120,230,235,0.95)");
        ctx.fillStyle = TEAL;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 1.2 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      const since = tl - tKill;
      if (crossed(env, s.t0 + tKill) && s.i % 2 === 0) env.sound("intercept");
      if (since > 0 && since < 6) {
        if (since < 0.45) puff(ctx, killPt, (6 + since * 26) * u, `rgba(255,240,180,${(1 - since / 0.45).toFixed(3)})`);
        if (since < 1.4) {
          ctx.strokeStyle = `rgba(14,138,148,${(0.65 * (1 - since / 1.4)).toFixed(3)})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(killPt.x, killPt.y, (3 + since * 13) * u, 0, Math.PI * 2);
          ctx.stroke();
        }
        puff(ctx, { x: killPt.x + since * 3 * u, y: killPt.y + since * 0.8 * u }, (4 + since * 3) * u, `rgba(125,120,115,${(0.42 * (1 - since / 6)).toFixed(3)})`);
        // debris falling back to the ground, with shadows
        for (let d = 0; d < 3; d++) {
          const fall = clamp01(since / 2.2);
          const gx = killPt.x + (hash01(seed + s.i, d) - 0.5) * 14 * u;
          const groundY = lerp(a.y, b.y, s.kill) + (hash01(seed + s.i, d + 3) - 0.5) * 6 * u;
          const y = lerp(killPt.y, groundY, fall * fall);
          if (fall < 1) {
            ctx.fillStyle = "rgba(60,50,40,0.85)";
            ctx.fillRect(gx, y, 1.2 * u, 1.2 * u);
          }
        }
      }
    } else {
      const since = tl - s.flight;
      if (crossed(env, s.t0 + s.flight) && (!s.open || s.i % 3 === 0)) env.sound("impact");
      if (since > 0) explosion(f, b, since, s.open ? 0.7 : ballistic ? 1.5 : 1, seed + s.i, s.open ? 4 : 9);
    }
  }

  // caption, then the tally
  const anchor = L(LAUNCH_SITES[spec.front][0]);
  const pa = f.L(anchor);
  const weaponName: Bi = spec.weapon === "ballistic" ? { he: "טילים בליסטיים", en: "ballistic missiles" } : spec.weapon === "drone" ? { he: "כטב\"מים", en: "drones" } : spec.weapon === "precision" ? { he: "טילים מדויקים", en: "precision missiles" } : { he: "רקטות", en: "rockets" };
  if (f.on(pa, 300)) {
    pill(f, f.lang === "he" ? `שיגור ${FRONT_NAME[spec.front].he} · ${shots.length} ${weaponName.he}` : `Launch ${FRONT_NAME[spec.front].en} · ${shots.length} ${weaponName.en}`, { x: pa.x, y: pa.y - 40 }, RED, "#FFFFFF", window01(t, 0.8, lastImpact + 1, 0.6));
    const killed = shots.filter((s) => s.kill !== null).length;
    const open = shots.filter((s) => s.kill === null && s.open).length;
    const hits = shots.length - killed - open;
    const tally = f.lang === "he" ? `יורטו ${killed} · שטח פתוח ${open} · פגיעות ${hits}` : `Intercepted ${killed} · open ground ${open} · hits ${hits}`;
    pill(f, tally, { x: pa.x, y: pa.y - 40 }, hits > 0 ? "#8A2E2A" : "#1F6B5E", "#FFFFFF", window01(t, lastImpact + 1.2, lastImpact + 8, 0.6));
  }
}

const TOWN_NAMES: Partial<Record<PlaceId, Bi>> = {
  tel_aviv: { he: "תל אביב", en: "Tel Aviv" }, haifa: { he: "חיפה", en: "Haifa" }, ashkelon: { he: "אשקלון", en: "Ashkelon" }, ashdod: { he: "אשדוד", en: "Ashdod" },
  sderot: { he: "שדרות", en: "Sderot" }, netivot: { he: "נתיבות", en: "Netivot" }, beersheba: { he: "באר שבע", en: "Be'er Sheva" }, kiryat_shmona: { he: "קריית שמונה", en: "Kiryat Shmona" },
  nahariya: { he: "נהריה", en: "Nahariya" }, metula: { he: "מטולה", en: "Metula" }, afula: { he: "עפולה", en: "Afula" }, netanya: { he: "נתניה", en: "Netanya" },
  kfar_saba: { he: "כפר סבא", en: "Kfar Saba" }, eilat: { he: "אילת", en: "Eilat" }, dimona: { he: "דימונה", en: "Dimona" }, jerusalem: { he: "ירושלים", en: "Jerusalem" },
  kfar_aza: { he: "כפר עזה", en: "Kfar Aza" }, shlomi: { he: "שלומי", en: "Shlomi" },
};
const townName = (id: PlaceId): Bi => TOWN_NAMES[id] ?? { he: id, en: id };

// ---------------------------------------------------------------------------
// airstrike: ISR drone, target designation, sorties, bombs, secondaries, BDA
// ---------------------------------------------------------------------------

const STRIKE: Record<StrikeArea, { center: LonLat; spread: [number, number]; base: PlaceId; route: LonLat[] | null; name: Bi }> = {
  gaza: { center: [34.4, 31.44], spread: [0.1, 0.13], base: "hatzerim", route: null, name: { he: "רצועת עזה", en: "the Gaza Strip" } },
  lebanon: { center: [35.43, 33.28], spread: [0.14, 0.12], base: "ramat_david", route: null, name: { he: "דרום לבנון", en: "southern Lebanon" } },
  dahiya: { center: [35.5, 33.85], spread: [0.03, 0.03], base: "ramat_david", route: null, name: { he: "הדאחייה", en: "Dahiyeh" } },
  west_bank: { center: [35.3, 32.46], spread: [0.03, 0.03], base: "ramat_david", route: null, name: { he: "ג'נין", en: "Jenin" } },
  iran: { center: [51.5, 33.2], spread: [0.8, 0.6], base: "nevatim", route: [[35.01, 31.21], [36.8, 32.4], [40.5, 33.3], [45.5, 33.6], [51.5, 33.2]], name: { he: "איראן", en: "Iran" } },
  yemen: { center: [42.95, 14.8], spread: [0.06, 0.05], base: "nevatim", route: [[35.01, 31.21], [34.9, 27.6], [38.4, 20.6], [42.95, 14.8]], name: { he: "נמל חודיידה", en: "Hodeidah port" } },
};

function strikePlan(spec: Extract<SceneSpec, { kind: "airstrike" }>, seed: number) {
  const s = STRIKE[spec.area];
  const pairs = Math.max(1, Math.min(6, Math.ceil(spec.sorties / 2)));
  const long = s.route !== null;
  const ingress = long ? 9 : 4.5;
  const bombs = Math.max(2, Math.min(40, spec.bombs));
  const aims: LonLat[] = Array.from({ length: bombs }, (_, i) => {
    const sx = spec.wide ? s.spread[0] : s.spread[0] * 0.55;
    const sy = spec.wide ? s.spread[1] : s.spread[1] * 0.55;
    return [s.center[0] + (hash01(seed, i * 2 + 7) - 0.5) * 2 * sx, s.center[1] + (hash01(seed, i * 2 + 8) - 0.5) * 2 * sy];
  });
  const release = 3.5 + ingress;
  const hitTimes = aims.map((_, i) => release + 1.3 + i * (spec.wide ? 0.12 : 0.28) + Math.floor(i / Math.ceil(bombs / pairs)) * 0.6);
  return { s, pairs, long, ingress, aims, release, hitTimes, end: Math.max(...hitTimes) + (long ? 12 : 9) };
}

function runAirstrike(env: SceneEnv, spec: Extract<SceneSpec, { kind: "airstrike" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const plan = strikePlan(spec, seed);
  const { s } = plan;
  const target = f.L(s.center);
  const base = L(s.base);
  // ISR drone circling the target, sensor cone, then designation brackets
  const droneA = window01(t, 0, plan.hitTimes[plan.hitTimes.length - 1] + 3, 0.8);
  if (droneA > 0 && f.on(target, 120)) {
    ctx.save();
    ctx.globalAlpha *= droneA;
    const ang = t * 0.5;
    const r = 26 * u;
    const dp = { x: target.x + Math.cos(ang) * r, y: target.y + Math.sin(ang) * r * 0.55 };
    ctx.fillStyle = "rgba(47,99,176,0.07)";
    ctx.beginPath();
    ctx.moveTo(dp.x, dp.y - 12 * u);
    ctx.lineTo(target.x - 12 * u, target.y);
    ctx.lineTo(target.x + 12 * u, target.y);
    ctx.closePath();
    ctx.fill();
    drone(f, dp, ang + Math.PI / 2, 12);
    ctx.restore();
    for (let i = 0; i < Math.min(plan.aims.length, spec.wide ? 6 : plan.aims.length); i++) {
      const ta = 1.5 + i * 0.25;
      const hit = plan.hitTimes[i];
      const a = window01(t, ta, hit + 0.1, 0.25);
      if (a <= 0) continue;
      const p = f.L(plan.aims[i]);
      const sz = (5 - 1.5 * smooth(ta, ta + 0.6, t)) * u;
      ctx.strokeStyle = `rgba(200,55,45,${(0.85 * a).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(p.x + sx * sz, p.y + sy * sz * 0.4);
        ctx.lineTo(p.x + sx * sz, p.y + sy * sz);
        ctx.lineTo(p.x + sx * sz * 0.4, p.y + sy * sz);
        ctx.stroke();
      }
    }
  }
  // sorties
  const route: LonLat[] = plan.s.route ?? [base, [lerp(base[0], s.center[0], 0.5) + 0.12, lerp(base[1], s.center[1], 0.5) + 0.05], s.center];
  const tanker: LonLat = route[Math.floor(route.length / 2)];
  if (plan.long) {
    const tp = f.L(tanker);
    const ta = window01(t, 2, plan.release + 6, 1);
    if (ta > 0 && f.on(tp, 80)) {
      ctx.save();
      ctx.globalAlpha *= ta;
      airliner(f, { x: tp.x + Math.cos(t * 0.3) * 20 * u, y: tp.y + Math.sin(t * 0.3) * 10 * u }, t * 0.3 + Math.PI / 2, 24, "tanker");
      label(f, f.lang === "he" ? "תדלוק אווירי" : "Aerial refuelling", { x: tp.x, y: tp.y - 40 * u }, "#35506E", 10.5);
      ctx.restore();
    }
  }
  for (let pi = 0; pi < plan.pairs; pi++) {
    const tTake = 0.6 + pi * 0.8;
    const outDur = plan.release - tTake + 0.4;
    const backStart = plan.release + 1.2;
    const backDur = plan.long ? 10 : 5.5;
    for (let j = 0; j < 2; j++) {
      const off = j * 5 * u;
      let leg: { pos: Pt; heading: number; alt: number } | null = null;
      if (t >= tTake && t < plan.release + 0.4) {
        const m = travel(route, t, tTake, outDur);
        leg = { pos: f.S(m.p), heading: m.a, alt: 22 * smooth(0, 0.08, m.k) };
      } else if (t >= plan.release + 0.4 && t < backStart) {
        const end = along(route, 1);
        leg = { pos: f.S(end.p), heading: end.a + (t - plan.release) * 2.5, alt: 22 };
      } else if (t >= backStart && t < backStart + backDur) {
        const m = travel([...route].reverse(), t, backStart, backDur);
        leg = { pos: f.S(m.p), heading: m.a, alt: 22 * (1 - smooth(0.9, 1, m.k)) };
      }
      if (leg === null) continue;
      const q = { x: leg.pos.x - Math.sin(leg.heading) * off, y: leg.pos.y + Math.cos(leg.heading) * off };
      if (f.on(q, 40)) jet(f, q, leg.heading, leg.alt, t, t < plan.release);
    }
  }
  // bombs, detonations, secondaries, fires
  plan.aims.forEach((ll, i) => {
    const p = f.L(ll);
    if (!f.on(p, 80)) return;
    const hit = plan.hitTimes[i];
    if (t > hit - 1.3 && t < hit) fallingBomb(f, p, (t - (hit - 1.3)) / 1.3, 24);
    if (crossed(env, hit) && i % 3 === 0) env.sound("impact");
    const age = t - hit;
    if (age >= 0) {
      explosion(f, p, age, spec.wide ? 1.1 : 1.3, seed + i, spec.wide ? 14 : 10);
      if (hash01(seed, i + 200) < 0.3) explosion(f, { x: p.x + 4 * u, y: p.y - 2 * u }, age - 1.4 - hash01(seed, i + 201), 0.7, seed + i + 500, 6);
      if (spec.wide && age > 1) fire(f, p, t, u, seed + i, 1 - smooth(plan.end - 4, plan.end, t));
    }
  });
  const pa = target;
  if (f.on(pa, 300)) {
    pill(f, f.lang === "he" ? `תקיפת חיל האוויר · ${s.name.he}` : `IAF strike · ${s.name.en}`, { x: pa.x, y: pa.y - 50 }, "#35506E", "#FFFFFF", window01(t, 0.5, plan.hitTimes[plan.hitTimes.length - 1] + 1, 0.6));
    const bda = f.lang === "he" ? `${plan.aims.length} נקודות הותקפו${spec.wide ? " · נזק רחב" : ""}` : `${plan.aims.length} aim points struck${spec.wide ? " · wide damage" : ""}`;
    pill(f, bda, { x: pa.x, y: pa.y - 50 }, spec.wide ? "#8A2E2A" : "#35506E", "#FFFFFF", window01(t, plan.hitTimes[plan.hitTimes.length - 1] + 1.2, plan.end, 0.6));
  }
}

// ---------------------------------------------------------------------------
// ground operation: artillery, breaching, armor columns, infantry, contact
// ---------------------------------------------------------------------------

const AXES: Record<"gaza" | "lebanon" | "west_bank", { axes: LonLat[][]; objective: LonLat; name: Bi }> = {
  gaza: {
    axes: [
      [[34.64, 31.53], [34.55, 31.535], [34.47, 31.52]],
      [[34.63, 31.41], [34.51, 31.43], [34.4, 31.45]],
      [[34.5, 31.24], [34.41, 31.29], [34.31, 31.34]],
    ],
    objective: [34.42, 31.45], name: { he: "רצועת עזה", en: "the Gaza Strip" },
  },
  lebanon: {
    axes: [
      [[35.3, 32.96], [35.34, 33.08], [35.38, 33.22]],
      [[35.5, 32.98], [35.52, 33.1], [35.48, 33.28]],
      [[35.15, 32.99], [35.2, 33.1], [35.24, 33.2]],
    ],
    objective: [35.4, 33.24], name: { he: "דרום לבנון", en: "southern Lebanon" },
  },
  west_bank: {
    axes: [
      [[35.02, 32.36], [35.16, 32.42], [35.29, 32.455]],
      [[34.98, 32.18], [35.12, 32.2], [35.25, 32.215]],
    ],
    objective: [35.29, 32.45], name: { he: "צפון השומרון", en: "northern Samaria" },
  },
};

function runGround(env: SceneEnv, spec: Extract<SceneSpec, { kind: "ground" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const th = AXES[spec.theater];
  const raid = spec.mode === "raid";
  const pull = spec.mode === "pullback";
  const axes = raid ? th.axes.slice(0, 1) : th.axes;
  const obj = f.L(th.objective);

  // artillery preparation from behind the line
  if (!raid && !pull) {
    axes.forEach((ax, ai) => {
      const gun = f.L(jitter(ax[0], 0.01, seed, ai + 300));
      if (!f.on(gun, 120)) return;
      const aim = th.objective;
      vehicle(f, gun, Math.atan2(f.L(aim).y - gun.y, f.L(aim).x - gun.x), "howitzer", t, false, Math.atan2(f.L(aim).y - gun.y, f.L(aim).x - gun.x), ai);
      for (let r = 0; r < 7; r++) {
        const tf = 0.5 + r * 0.9 + ai * 0.3;
        const since = t - tf;
        if (since < 0 || since > 12) continue;
        if (since < 0.3) flash(f, gun, u * 1.4, 1 - since / 0.3);
        if (crossed(env, tf) && r === 0 && ai === 0) env.sound("launch");
        const impact = f.L(jitter(ax[2], 0.035, seed, ai * 10 + r));
        const flight = 1.8;
        if (since < flight) {
          const hp = arcPoint(gun, impact, since / flight, 30 * u).air;
          ctx.fillStyle = "#2B2B2B";
          ctx.beginPath();
          ctx.arc(hp.x, hp.y, 0.9 * u, 0, Math.PI * 2);
          ctx.fill();
        } else explosion(f, impact, since - flight, 0.75, seed + ai * 10 + r, 5);
      }
    });
  }
  // columns
  const colStart = pull ? 1 : raid ? 1 : 6;
  const colDur = pull ? 14 : raid ? 7 : 14;
  axes.forEach((ax0, ai) => {
    const ax = pull ? [...ax0].reverse() : ax0;
    const kinds: VehicleKind[] = raid ? ["humvee", "apc", "humvee"] : ["dozer", "tank", "tank", "apc", "apc"];
    kinds.forEach((kind, vi) => {
      const t0 = colStart + ai * 0.6 + vi * 1.1;
      let path = ax;
      if (raid && t > t0 + colDur + 9) {
        // the raid pulls back out
        const m = travel([...ax].reverse(), t, t0 + colDur + 9, colDur);
        const p = f.S(m.p);
        if (f.on(p)) vehicle(f, p, m.a, kind, t, m.moving, m.a, vi);
        return;
      }
      const m = travel(path, t, t0, colDur);
      if (t < t0) return;
      const pathPx = path.slice(1).reduce((acc, ll, j) => {
        const a = f.L(path[j]);
        const b = f.L(ll);
        return acc + Math.hypot(b.x - a.x, b.y - a.y);
      }, 0);
      const back = (vi * 13 * u) / Math.max(1, pathPx);
      const pos = along(path, Math.max(0, m.k - back));
      const p = f.S(pos.p);
      if (!f.on(p)) return;
      const aimAng = Math.atan2(obj.y - p.y, obj.x - p.x);
      vehicle(f, p, pos.a, kind, t, m.moving, m.k > 0.95 ? aimAng : pos.a, vi + ai * 7);
      // the bulldozer opens the fence at the first waypoint
      if (kind === "dozer" && !pull) {
        const breach = f.L(ax[1]);
        const tb = t0 + colDur * 0.45;
        if (t > tb && t < tb + 3) puff(ctx, breach, (6 + (t - tb) * 5) * u, `rgba(190,170,130,${(0.5 * (1 - (t - tb) / 3)).toFixed(3)})`);
        if (ai === 0 && window01(t, tb, tb + 4, 0.4) > 0 && f.ppd > 110) label(f, f.lang === "he" ? "פריצת גדר" : "Fence breached", { x: breach.x, y: breach.y - 12 * u }, OLIVE_DARK, 10.5);
      }
    });
    // infantry dismount and move up
    if (!pull) {
      const td = colStart + colDur + ai * 0.6;
      const end = f.L(ax[ax.length - 1]);
      for (let s = 0; s < 5; s++) {
        if (t < td) break;
        const k = smooth(td, td + 5, t);
        const q = { x: end.x + (hash01(seed, ai * 20 + s) - 0.3) * 18 * u * k, y: end.y + (hash01(seed, ai * 20 + s + 5) - 0.5) * 10 * u * k };
        if (f.on(q)) person(f, q, t * 1.5 + s * 0.2, { color: OLIVE_DARK, armed: true });
      }
    }
  });
  // helicopters and a drone over the objective
  if (!pull && f.on(obj, 200)) {
    const ha = window01(t, raid ? 3 : 5, raid ? 26 : 34, 1);
    if (ha > 0) {
      ctx.save();
      ctx.globalAlpha *= ha;
      for (let i = 0; i < (raid ? 1 : 2); i++) {
        const ang = t * 0.35 + i * Math.PI;
        const hp = { x: obj.x + Math.cos(ang) * 22 * u - 20 * u, y: obj.y + Math.sin(ang) * 10 * u + 10 * u };
        helicopter(f, hp, ang + Math.PI / 2, 14, t);
        const fireT = (t + i * 1.7) % 3.4;
        if (fireT < 0.6) {
          const tgt = f.L(jitter(th.objective, 0.02, seed, Math.floor(t / 3.4) + i));
          const k = fireT / 0.6;
          ctx.strokeStyle = "rgba(255,200,120,0.9)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(hp.x, hp.y - 14 * u);
          ctx.lineTo(lerp(hp.x, tgt.x, k), lerp(hp.y - 14 * u, tgt.y, k));
          ctx.stroke();
        } else if (fireT < 2.6) explosion(f, f.L(jitter(th.objective, 0.02, seed, Math.floor(t / 3.4) + i)), fireT - 0.6, 0.6, seed + i, 3);
      }
      drone(f, { x: obj.x + Math.cos(t * 0.4) * 34 * u, y: obj.y + Math.sin(t * 0.4) * 16 * u }, t * 0.4 + Math.PI / 2, 22);
      ctx.restore();
    }
    // contact: tracers between our troops and fighters in the buildings
    const contactA = window01(t, raid ? 9 : 18, raid ? 17 : 32, 0.4);
    if (contactA > 0) {
      for (let i = 0; i < (raid ? 3 : 6); i++) {
        const ours = f.L(jitter(th.objective, 0.03, seed, i + 400));
        const theirs = f.L(jitter(th.objective, 0.02, seed, i + 450));
        tracer(f, ours, theirs, t + i * 0.37, seed + i);
        tracer(f, theirs, ours, t + i * 0.51 + 0.3, seed + i + 9, "rgba(255,120,60,0.9)");
        if (f.people > 0) person(f, theirs, 0, { color: "#2B2B2B", armed: true, down: t > (raid ? 15 : 28) + i * 0.4 });
      }
      if (raid && t > 12 && t < 14) flash(f, obj, 2.5 * u, 1 - (t - 12) / 2);
    }
  }
  const capText: Bi = pull ? { he: "כוחות צה\"ל יוצאים", en: "IDF forces pull out" } : raid ? { he: "פשיטה ממוקדת", en: "Targeted raid" } : { he: `כוחות צה"ל נכנסים ל${th.name.he}`, en: `IDF forces enter ${th.name.en}` };
  if (f.on(obj, 300)) {
    pill(f, tr(env.caption ?? capText, f.lang), { x: obj.x, y: obj.y - 56 }, OLIVE_DARK, "#FFFFFF", window01(t, 0.3, sceneLen(spec) - 6, 0.6));
    if (spec.mode === "occupy") pill(f, f.lang === "he" ? "השליטה במרחב הושלמה" : "Area under control", { x: obj.x, y: obj.y - 56 }, OLIVE_DARK, "#FFFFFF", window01(t, sceneLen(spec) - 5.5, sceneLen(spec), 0.6));
  }
}

// ---------------------------------------------------------------------------
// infiltration: breach or tunnel, squad, alert, response team, firefight
// ---------------------------------------------------------------------------

const INFIL: Record<"gaza" | "lebanon" | "west_bank", Array<{ breach: LonLat; to: PlaceId; response: PlaceId }>> = {
  gaza: [{ breach: [34.505, 31.49], to: "kfar_aza", response: "gaza_staging" }, { breach: [34.44, 31.36], to: "netivot", response: "gaza_staging" }],
  lebanon: [{ breach: [35.3, 33.075], to: "shlomi", response: "north_staging" }, { breach: [35.55, 33.2], to: "metula", response: "north_staging" }],
  west_bank: [{ breach: [35.25, 32.52], to: "afula", response: "wb_staging" }, { breach: [35.0, 32.28], to: "netanya", response: "wb_staging" }],
};

function runInfiltration(env: SceneEnv, spec: Extract<SceneSpec, { kind: "infiltration" }>): void {
  const { f, t, seed, world } = env;
  const { ctx, u } = f;
  const routes = INFIL[spec.front].slice(0, Math.max(1, Math.min(2, spec.squads)));
  const barrierHolds = spec.front === "west_bank" && !world.flags.annexationLaw;
  routes.forEach((r, ri) => {
    const t0 = ri * 2.5;
    const breach = f.L(r.breach);
    const town = f.L(L(r.to));
    // the squad stops at an intact barrier; otherwise it reaches the community
    const dest = barrierHolds ? breach : { x: lerp(breach.x, town.x, 0.85), y: lerp(breach.y, town.y, 0.85) };
    const start = { x: breach.x - (town.x - breach.x) * 0.25, y: breach.y - (town.y - breach.y) * 0.25 };
    if (!f.on(breach, 150)) return;
    // entry
    if (spec.tunnel && spec.front === "gaza") {
      const ta = window01(t, t0, t0 + 26, 0.3);
      ctx.fillStyle = `rgba(30,24,18,${(0.8 * ta).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(breach.x + 6 * u, breach.y + 2 * u, 2.4 * u, 1.3 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      if (t > t0 && t < t0 + 2) puff(ctx, { x: breach.x + 6 * u, y: breach.y }, (4 + (t - t0) * 6) * u, `rgba(170,150,120,${(0.5 * (1 - (t - t0) / 2)).toFixed(3)})`);
    } else if (t > t0 && t < t0 + 2.2 && Math.floor(t * 12) % 2 === 0) {
      puff(ctx, breach, 3 * u, "rgba(255,230,140,0.95)");
    }
    const walk = smooth(t0 + 1.5, t0 + 10, t);
    const lead = { x: lerp(start.x, dest.x, walk), y: lerp(start.y, dest.y, walk) };
    const dir = Math.atan2(dest.y - start.y, dest.x - start.x);
    const downAt = t0 + (barrierHolds ? 13 : 17);
    if (f.people > 0) {
      for (let i = 0; i < 5; i++) {
        const back = i * 5 * u;
        const q = { x: lead.x - Math.cos(dir) * back + (i % 2 ? 1.5 : -1.5) * u, y: lead.y - Math.sin(dir) * back };
        if (t > t0 + 1) person(f, q, t * 1.8 + i * 0.3, { color: "#2B2B2B", armed: true, down: t > downAt + i * 0.35 });
      }
    }
    // alert ring at the community / barrier
    sirenZone(f, barrierHolds ? breach : town, t, 14 * u, window01(t, t0 + 2.5, downAt + 3, 0.5), ri === 0 ? (f.lang === "he" ? "חדירת מחבלים" : "Infiltration") : null);
    if (crossed(env, t0 + 2.6)) env.sound("alert");
    // the response team
    const base = f.L(L(r.response));
    for (let v = 0; v < 2; v++) {
      const m = smooth(t0 + 4 + v * 0.8, t0 + 11 + v * 0.8, t);
      if (m <= 0) continue;
      const vp = { x: lerp(base.x, dest.x + (15 + v * 7) * u * Math.cos(dir), m), y: lerp(base.y, dest.y + (15 + v * 7) * u * Math.sin(dir), m) };
      if (f.on(vp)) vehicle(f, vp, Math.atan2(dest.y - base.y, dest.x - base.x), "humvee", t, m < 1, undefined, v);
    }
    const heli = smooth(t0 + 6, t0 + 12, t);
    if (heli > 0 && t < downAt + 6) helicopter(f, { x: lerp(base.x, dest.x - 12 * u, heli), y: lerp(base.y, dest.y - 8 * u, heli) }, dir, 16, t);
    if (t > t0 + 11 && f.people > 0) {
      for (let s = 0; s < 4; s++) {
        const q = { x: dest.x + Math.cos(dir) * (12 + s * 3) * u + (s - 1.5) * 3 * u, y: dest.y + Math.sin(dir) * (12 + s * 3) * u };
        person(f, q, t * 1.4 + s, { color: "#4E5A30", armed: true });
        if (t < downAt + 1) tracer(f, q, { x: lead.x, y: lead.y - 3 * u }, t + s * 0.4, seed + s);
      }
      if (t < downAt + 1) for (let s = 0; s < 2; s++) tracer(f, { x: lead.x, y: lead.y - 3 * u }, { x: dest.x + Math.cos(dir) * 14 * u, y: dest.y + Math.sin(dir) * 14 * u }, t + s * 0.6 + 0.3, seed + 40 + s, "rgba(255,120,60,0.9)");
    }
    // a house burns if the squad got in
    if (!barrierHolds && world.metrics.securityThreat >= 60 && t > t0 + 12) {
      const hp = { x: town.x + 6 * u, y: town.y - 2 * u };
      house(ctx, hp, 0.9 * u, "#B5523B", "#EFE7D6", smooth(t0 + 12, t0 + 18, t));
      fire(f, { x: hp.x, y: hp.y - 3 * u }, t, u, seed, 1 - smooth(t0 + 22, t0 + 26, t));
      smokeColumn(f, hp, t - t0 - 12, u, seed, 14);
    }
  });
  const first = f.L(routes[0].breach);
  if (f.on(first, 300)) {
    const text: Bi = barrierHolds ? { he: "ניסיון חדירה נבלם בגדר", en: "Infiltration stopped at the barrier" } : { he: "חוליה חדרה ליישוב · כוח כוננות בדרך", en: "Squad inside a community · response team en route" };
    pill(f, tr(env.caption ?? text, f.lang), { x: first.x, y: first.y - 52 }, RED, "#FFFFFF", window01(t, 0.5, 16, 0.6));
    pill(f, f.lang === "he" ? "המחבלים נוטרלו" : "Attackers neutralized", { x: first.x, y: first.y - 52 }, OLIVE_DARK, "#FFFFFF", window01(t, 17, 28, 0.6));
  }
}

// ---------------------------------------------------------------------------
// terror attack in a city
// ---------------------------------------------------------------------------

function runTerror(env: SceneEnv, spec: Extract<SceneSpec, { kind: "terror" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const c = f.L(L(spec.place));
  if (!f.on(c, 150)) return;
  const street = { x: c.x - 16 * u, y: c.y + 6 * u };
  // street and bystanders
  ctx.strokeStyle = "rgba(90,90,90,0.35)";
  ctx.lineWidth = 3 * u;
  ctx.beginPath();
  ctx.moveTo(street.x - 30 * u, street.y);
  ctx.lineTo(street.x + 30 * u, street.y);
  ctx.stroke();
  const shootFrom = 3;
  const downAt = 8.5;
  const attacker = { x: street.x - 22 * u + smooth(0, shootFrom, t) * 14 * u, y: street.y - 1 * u };
  if (f.people > 0 || f.ppd > 100) {
    for (let i = 0; i < 14; i++) {
      const home = { x: street.x + (hash01(seed, i) - 0.5) * 50 * u, y: street.y + (hash01(seed, i + 1) - 0.5) * 8 * u };
      const flee = smooth(shootFrom, shootFrom + 4, t);
      const dx = home.x - attacker.x;
      const dy = home.y - attacker.y;
      const dl = Math.hypot(dx, dy) || 1;
      const q = { x: home.x + (dx / dl) * 22 * u * flee, y: home.y + (dy / dl) * 10 * u * flee };
      const hurt = i < 2 && t > shootFrom + 0.4;
      person(f, hurt ? home : q, t * (flee > 0 && flee < 1 ? 3 : 0.2) + i * 0.3, { color: ["#3B4A63", "#6E5A4A", "#2F5E8C", "#8A4B4B"][i % 4], down: hurt });
    }
    person(f, attacker, t * 1.2, { color: "#2B2B2B", armed: true, down: t > downAt });
    if (t > shootFrom && t < downAt && Math.floor(t * 9) % 3 === 0) flash(f, { x: attacker.x + 3 * u, y: attacker.y - 5 * u }, u * 0.9);
  }
  if (crossed(env, shootFrom)) env.sound("alert");
  // police converge, ambulances follow, a cordon goes up
  const police: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1]];
  police.forEach(([sx, sy], i) => {
    const m = smooth(4.5 + i * 0.6, 9 + i * 0.6, t);
    if (m <= 0) return;
    const from = { x: street.x + sx * 70 * u, y: street.y + sy * 40 * u };
    const to = { x: attacker.x + sx * 9 * u, y: attacker.y + sy * 5 * u };
    vehicle(f, { x: lerp(from.x, to.x, m), y: lerp(from.y, to.y, m) }, Math.atan2(to.y - from.y, to.x - from.x), "police", t, m < 1);
  });
  for (let i = 0; i < 2; i++) {
    const m = smooth(10 + i, 15 + i, t);
    if (m <= 0) continue;
    const from = { x: street.x + 80 * u, y: street.y + (i ? 30 : -30) * u };
    const to = { x: street.x + (6 + i * 8) * u, y: street.y + 4 * u };
    vehicle(f, { x: lerp(from.x, to.x, m), y: lerp(from.y, to.y, m) }, Math.atan2(to.y - from.y, to.x - from.x), "ambulance", t, m < 1);
  }
  const cordon = smooth(11, 13, t);
  if (cordon > 0) {
    ctx.strokeStyle = `rgba(230,190,30,${(0.9 * cordon).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.ellipse(attacker.x, attacker.y, 24 * u, 11 * u, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  pill(f, tr(env.caption ?? { he: "פיגוע ירי", en: "Shooting attack" }, f.lang), { x: c.x, y: c.y - 46 }, RED, "#FFFFFF", window01(t, 0.4, 20, 0.6));
}

// ---------------------------------------------------------------------------
// crowds: protests, rallies, refusal, crackdown
// ---------------------------------------------------------------------------

function runCrowd(env: SceneEnv, spec: Extract<SceneSpec, { kind: "crowd" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const c = f.L(L(spec.place));
  if (!f.on(c, 200)) return;
  const n = Math.max(12, Math.min(90, spec.size));
  const disperse = spec.mode === "disperse";
  const palette = spec.mode === "haredi" ? ["#1C1C1C", "#2A2A2A", "#F2F2F2"] : spec.mode === "refusal" ? ["#5F6B3E", "#4E5A30", "#7C8A52"] : spec.mode === "amman" ? ["#3B3B3B", "#6E5A4A", "#EDEAE0"] : ["#3B4A63", "#6E5A4A", "#2F5E8C", "#8A4B4B", "#4A6B4A"];
  const flag = spec.mode === "amman" ? "#1E7B3E" : spec.mode === "haredi" ? null : spec.mode === "right_rally" ? BLUE : BLUE;
  const scale = Math.min(u, 3.6);
  if (f.people > 0 || f.ppd > 90) {
    for (let i = 0; i < n; i++) {
      const ang = hash01(seed, i) * Math.PI * 2;
      const r = Math.sqrt(hash01(seed, i + 100)) * 13 * scale;
      const spot = { x: c.x + Math.cos(ang) * r * 1.5, y: c.y + Math.sin(ang) * r * 0.7 };
      const street = Math.floor(hash01(seed, i + 200) * 4);
      const dir = [[-1, 0], [1, 0], [0, -1], [0, 1]][street];
      const far = { x: c.x + dir[0] * 60 * scale + (hash01(seed, i + 300) - 0.5) * 8 * scale, y: c.y + dir[1] * 34 * scale + (hash01(seed, i + 301) - 0.5) * 6 * scale };
      const arrive = 0.5 + hash01(seed, i + 400) * 9;
      const k = disperse ? 1 - smooth(3 + hash01(seed, i + 500) * 6, 9 + hash01(seed, i + 500) * 6, t) : smooth(arrive, arrive + 5, t);
      if (k <= 0) continue;
      const q = { x: lerp(far.x, spot.x, k), y: lerp(far.y, spot.y, k) };
      const moving = k > 0 && k < 1;
      const arrested = spec.mode === "crackdown" && i % 9 === 0 && t > 14;
      const qa = arrested ? { x: lerp(q.x, c.x + 30 * scale, smooth(14, 18, t)), y: lerp(q.y, c.y + 16 * scale, smooth(14, 18, t)) } : q;
      person(f, qa, moving ? t * 1.6 + i * 0.2 : 0.25, {
        color: palette[i % palette.length],
        flag: flag !== null && i % 6 === 0 ? flag : null,
        sign: spec.mode === "refusal" && i % 5 === 1 ? "#F5F1E6" : spec.mode === "protest" && i % 11 === 3 ? "#FFE8A0" : null,
      });
    }
  }
  if (spec.mode === "crackdown") {
    // police line forms, water cannon sprays
    for (let i = 0; i < 9; i++) {
      const k = smooth(4, 8, t);
      const q = { x: c.x - 26 * scale + i * 6.5 * scale, y: lerp(c.y + 40 * scale, c.y + 15 * scale, k) };
      person(f, q, k < 1 ? t * 1.6 : 0.1, { color: "#1F3F8A" });
    }
    const wc = smooth(6, 11, t);
    const truck = { x: lerp(c.x - 70 * scale, c.x - 34 * scale, wc), y: c.y + 4 * scale };
    vehicle(f, truck, 0, "water_cannon", t, wc < 1);
    if (t > 11 && t < 21) {
      for (let j = 0; j < 3; j++) {
        const ph = (t * 1.8 + j / 3) % 1;
        const tip = { x: lerp(truck.x + 5 * scale, c.x - 6 * scale, ph), y: truck.y - Math.sin(Math.PI * ph) * 10 * scale };
        puff(ctx, tip, (1.5 + ph * 3) * scale, `rgba(210,230,245,${(0.8 * (1 - ph)).toFixed(3)})`);
      }
    }
    const van = smooth(12, 15, t);
    if (van > 0) vehicle(f, { x: lerp(c.x + 80 * scale, c.x + 30 * scale, van), y: c.y + 16 * scale }, Math.PI, "police", t, van < 1);
  }
  if (spec.mode === "amman" || spec.mode === "protest") {
    // police watch from the edges
    for (let i = 0; i < 2; i++) vehicle(f, { x: c.x + (i ? 36 : -36) * scale, y: c.y + 20 * scale }, i ? Math.PI : 0, "police", t * (spec.mode === "amman" ? 1 : 0), false);
  }
  const text: Bi = spec.mode === "right_rally" ? { he: "עצרת ימין בירושלים", en: "Right-wing rally in Jerusalem" }
    : spec.mode === "refusal" ? { he: "מחאת סרבנות מילואים", en: "Reservist refusal protest" }
      : spec.mode === "haredi" ? { he: "הפגנת חרדים נגד הגיוס", en: "Haredi protest against the draft" }
        : spec.mode === "crackdown" ? { he: "תקנות חירום: פיזור בכוח", en: "Emergency rule: forcible dispersal" }
          : spec.mode === "disperse" ? { he: "המפגינים מתפזרים", en: "Protesters disperse" }
            : spec.mode === "amman" ? { he: "הפגנות בעמאן", en: "Protests in Amman" } : { he: "הפגנת ענק", en: "Mass protest" };
  pill(f, tr(env.caption ?? text, f.lang), { x: c.x, y: c.y - 58 }, spec.mode === "crackdown" ? RED : BLUE, "#FFFFFF", window01(t, 0.4, 24, 0.6));
}

// ---------------------------------------------------------------------------
// flights: emigration wave, Riyadh
// ---------------------------------------------------------------------------

function runFlights(env: SceneEnv, spec: Extract<SceneSpec, { kind: "flights" }>): void {
  const { f, t } = env;
  const { u } = f;
  const bg = f.L(P.ben_gurion);
  if (spec.mode === "riyadh") {
    const route: LonLat[] = [P.ben_gurion, [35.6, 31.6], [38.5, 29.5], [46.72, 24.71]];
    const m = travel(route, t, 1, 20);
    const p = f.S(m.p);
    const alt = 24 * smooth(0, 0.08, m.k) * (1 - smooth(0.92, 1, m.k));
    airliner(f, p, m.a, alt);
    for (let j = 0; j < 2; j++) jet(f, { x: p.x - Math.cos(m.a) * 14 * u + (j ? 9 : -9) * u * Math.sin(m.a), y: p.y - Math.sin(m.a) * 14 * u - (j ? 9 : -9) * u * Math.cos(m.a) }, m.a, alt + 2, t, false);
    const r = f.L(P.riyadh);
    if (t > 20 && f.on(r, 80)) icon(f, { x: r.x, y: r.y - 22 }, "pen", "#1F7A4A", smooth(20, 21, t));
    pill(f, tr(env.caption ?? { he: "טיסה רשמית לריאד", en: "Official flight to Riyadh" }, f.lang), { x: bg.x, y: bg.y - 46 }, "#1F7A4A", "#FFFFFF", window01(t, 0.3, 24, 0.6));
    return;
  }
  const routes = [AIR_ROUTES.europe, AIR_ROUTES.usa, AIR_ROUTES.north];
  const n = Math.max(2, Math.min(16, spec.count));
  for (let i = 0; i < n; i++) {
    const t0 = 1 + i * 1.6;
    const tl = t - t0;
    if (tl < 0) {
      // waiting at the gates
      if (f.on(bg, 40)) airliner(f, { x: bg.x + (-10 + (i % 4) * 5) * u, y: bg.y + (6 + Math.floor(i / 4) * 5) * u }, -0.45, 0);
      continue;
    }
    const route = routes[i % routes.length];
    const k = Math.pow(clamp01(tl / 26), 1.5);
    const { p, a } = along(route, k);
    const sp = f.S(p);
    if (!f.on(sp, 60)) continue;
    const alt = 26 * smooth(0.002, 0.06, k);
    f.ctx.save();
    f.ctx.globalAlpha *= 1 - smooth(0.85, 1, k);
    if (alt > 5) {
      const back = f.S(along(route, Math.max(0, k - 0.015)).p);
      f.ctx.strokeStyle = "rgba(150,160,175,0.3)";
      f.ctx.lineWidth = 1.4 * u;
      f.ctx.beginPath();
      f.ctx.moveTo(back.x, back.y - alt * u);
      f.ctx.lineTo(sp.x - Math.cos(a) * 9 * u, sp.y - Math.sin(a) * 9 * u - alt * u);
      f.ctx.stroke();
    }
    airliner(f, sp, a, alt);
    f.ctx.restore();
  }
  const text = f.lang === "he" ? `גל עזיבה · ${n} טיסות יוצאות` : `Emigration wave · ${n} departing flights`;
  pill(f, env.caption !== null ? tr(env.caption, f.lang) : text, { x: bg.x - 30, y: bg.y - 50 }, BLUE, "#FFFFFF", window01(t, 0.3, 1 + n * 1.6 + 16, 0.6));
}

// ---------------------------------------------------------------------------
// US airlift / hold / pact
// ---------------------------------------------------------------------------

const AIRLIFT_ROUTE: LonLat[] = [[-75.47, 39.13], [-60, 41.5], [-35, 41], [-10, 37], [12, 35.5], [28, 33.6], [34.3, 31.6], [35.01, 31.21]];

function runAirlift(env: SceneEnv, spec: Extract<SceneSpec, { kind: "airlift" }>): void {
  const { f, t } = env;
  const { u, ctx } = f;
  const nev = f.L(P.nevatim);
  const dover = f.L(AIRLIFT_ROUTE[0]);
  if (spec.mode === "pact") {
    const m = travel([[22, 34.4], [29, 33.8], P.east_med], t, 0.5, 18);
    const cp = f.S(m.p);
    ship(f, cp, m.a, "carrier", m.moving, 1);
    ship(f, { x: cp.x - 28 * u, y: cp.y + 12 * u }, m.a, "destroyer", m.moving, 2);
    ship(f, { x: cp.x - 22 * u, y: cp.y - 16 * u }, m.a, "destroyer", m.moving, 3);
  }
  const flight = 22;
  for (let i = 0; i < 4; i++) {
    const t0 = 0.5 + i * 1.6;
    if (t < t0) {
      // loading on the ramp at Dover
      if (f.on(dover, 40)) airliner(f, { x: dover.x + i * 6 * u, y: dover.y + 4 * u }, 0.2, 0, "transport");
      continue;
    }
    let k: number;
    let back = false;
    if (spec.mode === "halt") {
      // out over the Atlantic, then the order comes and they turn around
      const out = smooth(t0, t0 + 9, t) * 0.3;
      const ret = smooth(t0 + 10, t0 + 19, t);
      k = out * (1 - ret);
      back = ret > 0;
    } else {
      k = smooth(t0, t0 + flight, t);
    }
    const { p, a } = along(AIRLIFT_ROUTE, k);
    const sp = f.S(p);
    const alt = 26 * smooth(0, 0.02, k) * (spec.mode === "halt" ? 1 - smooth(0.9, 1, smooth(t0 + 10, t0 + 19, t)) : 1 - smooth(0.96, 1, k));
    if (f.on(sp, 60)) airliner(f, sp, back ? a + Math.PI : a, alt, "transport");
    // pallets unloaded on the apron at Nevatim
    if (spec.mode !== "halt" && k >= 1 && f.on(nev, 60)) {
      const pallets = Math.floor(smooth(t0 + flight, t0 + flight + 5, t) * 4);
      for (let b = 0; b < pallets; b++) box(ctx, { x: nev.x + (8 + i * 4) * u, y: nev.y + (6 + b * 2.2) * u }, 2.2 * u, 1.6 * u, 1.4 * u, "#9A8A62", "#7B6D4A", "#63573A");
    }
  }
  // a munitions ship at Norfolk sails or turns back
  const norfolk: LonLat[] = [[-76.3, 36.9], [-70, 37.5], [-55, 38.5]];
  const sk = spec.mode === "halt" ? smooth(1, 10, t) * 0.5 * (1 - smooth(12, 22, t)) : smooth(1, 26, t);
  const sm = along(norfolk, sk);
  const shipPt = f.S(sm.p);
  if (f.on(shipPt, 40)) ship(f, shipPt, spec.mode === "halt" && t > 12 ? sm.a + Math.PI : sm.a, "cargo", true, 9);
  const wash = f.L(P.washington);
  if (f.on(wash, 100)) icon(f, { x: wash.x, y: wash.y - 20 }, spec.mode === "halt" ? "lock" : "money", spec.mode === "halt" ? RED : "#1F7A4A", smooth(0.5, 1.5, t));
  const text: Bi = spec.mode === "halt" ? { he: "משלוח החימוש הוקפא", en: "Munitions shipment frozen" } : spec.mode === "pact" ? { he: "ברית הגנה: כוחות אמריקניים מגיעים", en: "Defense pact: US forces arrive" } : { he: "רכבת אווירית אמריקנית", en: "US airlift" };
  const bg = spec.mode === "halt" ? RED : "#35506E";
  pill(f, tr(env.caption ?? text, f.lang), { x: wash.x, y: wash.y - 48 }, bg, "#FFFFFF", window01(t, 0.3, spec.mode === "halt" ? 30 : 16, 0.6));
  if (spec.mode !== "halt") pill(f, tr(env.caption ?? text, f.lang), { x: nev.x, y: nev.y - 48 }, bg, "#FFFFFF", window01(t, 16, 30, 0.6));
}

// ---------------------------------------------------------------------------
// trade, Red Sea
// ---------------------------------------------------------------------------

function shipsOnLane(f: Frame, lane: LonLat[], t: number, count: number, turnAt: number | null, t0: number, kinds: ShipKind[], dur = 22): void {
  for (let i = 0; i < count; i++) {
    const s0 = t0 + i * 1.8;
    const offset = i * 0.06;
    let k: number;
    let back = false;
    if (turnAt === null) k = offset + smooth(s0, s0 + dur, t) * (1 - offset);
    else {
      const out = smooth(s0, s0 + dur * 0.6, t) * (turnAt - offset) + offset;
      const ret = smooth(s0 + dur * 0.65, s0 + dur * 1.3, t);
      k = ret > 0 ? out - ret * (out - offset * 0.5) : out;
      back = ret > 0;
    }
    const { p, a } = along(lane, k);
    const sp = f.S(p);
    if (f.on(sp, 40)) ship(f, sp, back ? a + Math.PI : a, kinds[i % kinds.length], true, 20 + i);
  }
}

function runTrade(env: SceneEnv, spec: Extract<SceneSpec, { kind: "trade" }>): void {
  const { f, t } = env;
  const sanctions = spec.mode === "sanctions";
  shipsOnLane(f, SEA_LANES.haifa, t, 3, sanctions ? 0.78 : null, 0.5, ["cargo", "tanker"]);
  shipsOnLane(f, SEA_LANES.ashdod, t, 2, sanctions ? 0.8 : null, 1.4, ["cargo"]);
  const br = f.L(P.brussels);
  if (f.on(br, 100)) icon(f, { x: br.x, y: br.y - 20 }, sanctions ? "lock" : "envelope", sanctions ? RED : "#1F7A4A", 1);
  const port = f.L(P.haifa_port);
  pill(f, tr(env.caption ?? (sanctions ? { he: "סנקציות: אוניות מסחר מסתובבות", en: "Sanctions: cargo ships turn back" } : { he: "הסחר חוזר לנמלים", en: "Trade returns to the ports" }), f.lang), { x: port.x - 60, y: port.y - 40 }, sanctions ? RED : "#1F7A4A", "#FFFFFF", window01(t, 0.3, 30, 0.6));
}

function runRedSea(env: SceneEnv, spec: Extract<SceneSpec, { kind: "red_sea" }>): void {
  const { f, t, seed } = env;
  const { u } = f;
  const lane = SEA_LANES.red;
  const coast = f.L([43.1, 14.3]);
  if (spec.mode === "hodeidah") {
    runAirstrike({ ...env, caption: env.caption ?? { he: "תקיפה ארוכת טווח בנמל חודיידה", en: "Long-range strike on Hodeidah port" } }, { kind: "airstrike", area: "yemen", sorties: 6, bombs: 10, wide: false });
    const port = f.L(P.hodeidah);
    // fuel tanks burn after the strike
    const plan = strikePlan({ kind: "airstrike", area: "yemen", sorties: 6, bombs: 10, wide: false }, seed);
    const tHit = plan.hitTimes[0];
    if (t > tHit && f.on(port, 100)) {
      for (let i = 0; i < 3; i++) {
        const p = { x: port.x + (i - 1) * 8 * u, y: port.y + 6 * u };
        fire(f, p, t, 1.6 * u, seed + i, 1 - smooth(plan.end - 3, plan.end, t));
        smokeColumn(f, p, t - tHit - i * 0.5, 1.4 * u, seed + i, 30, 0.55);
      }
    }
    return;
  }
  if (spec.mode === "reroute") {
    shipsOnLane(f, lane, t, 3, 0.25, 0.5, ["cargo", "tanker"]);
    shipsOnLane(f, SEA_LANES.haifa, t, 2, null, 6, ["cargo"]);
    pill(f, tr(env.caption ?? { he: "הסחר מנותב לנמלי הים התיכון", en: "Trade rerouted to Mediterranean ports" }, f.lang), { x: coast.x, y: coast.y - 60 }, "#35506E", "#FFFFFF", window01(t, 0.3, 26, 0.6));
    return;
  }
  // merchant convoy heading north through Bab el-Mandeb
  const shipPos: Pt[] = [];
  for (let i = 0; i < 3; i++) {
    const k = 0.03 + i * 0.05 + smooth(0, 30, t) * 0.08;
    const hit = spec.mode === "attack" && i === 1;
    const turn = spec.mode === "attack" && i !== 1 ? smooth(12, 20, t) : 0;
    const { p, a } = along(lane, k - turn * 0.05);
    const sp = f.S(p);
    shipPos.push(sp);
    if (f.on(sp, 60)) ship(f, sp, turn > 0.5 ? a + Math.PI : a, i === 1 ? "tanker" : "cargo", !hit || t < 9, 60 + i, hit ? smooth(9, 11, t) : 0, t);
  }
  // Houthi drones and an anti-ship missile from the coast
  for (let d = 0; d < 4; d++) {
    const t0 = 1.5 + d * 1.3;
    const target = shipPos[d % 3];
    const k = clamp01((t - t0) / 7);
    if (t < t0) continue;
    const killed = spec.mode === "task_force" || (spec.mode === "attack" && d !== 1);
    const killK = 0.7;
    if (k < (killed ? killK : 1)) {
      const pos = { x: lerp(coast.x, target.x, k), y: lerp(coast.y, target.y, k) };
      drone(f, pos, Math.atan2(target.y - coast.y, target.x - coast.x), 7, true);
    } else if (killed) {
      const kp = { x: lerp(coast.x, target.x, killK), y: lerp(coast.y, target.y, killK) };
      const since = t - (t0 + killK * 7);
      if (since < 1.2) puff(f.ctx, kp, (4 + since * 14) * u, `rgba(255,230,160,${(1 - since / 1.2).toFixed(3)})`);
    } else if (d === 1) {
      explosion(f, target, t - (t0 + 7), 1.3, seed, 3);
      if (crossed(env, t0 + 7)) env.sound("impact");
    }
  }
  if (spec.mode === "task_force") {
    const dp = f.L([41.2, 16.6]);
    ship(f, dp, 1.9, "destroyer", false, 90);
    ship(f, { x: dp.x + 20 * u, y: dp.y + 14 * u }, 1.9, "destroyer", false, 91);
    for (let m = 0; m < 4; m++) {
      const t0 = 3 + m * 1.3;
      const k = smooth(t0, t0 + 3.8, t);
      if (k <= 0 || k >= 1) continue;
      const target = { x: lerp(coast.x, shipPos[m % 3].x, 0.7), y: lerp(coast.y, shipPos[m % 3].y, 0.7) };
      const hp = arcPoint(dp, target, k, 30 * u);
      arcTrail(f, dp, target, Math.max(0, k - 0.3), k, 30 * u, "14,138,148", 1.2);
      puff(f.ctx, hp.air, 2.4 * u, "rgba(120,230,235,0.95)");
    }
  }
  const text: Bi = spec.mode === "task_force" ? { he: "כוח משימה ימי מיירט כטב\"מים", en: "Naval task force intercepts drones" } : { he: "החות'ים תוקפים אוניות בבאב אל-מנדב", en: "Houthis attack ships at Bab el-Mandeb" };
  pill(f, tr(env.caption ?? text, f.lang), { x: coast.x, y: coast.y - 70 }, spec.mode === "task_force" ? "#35506E" : RED, "#FFFFFF", window01(t, 0.3, 26, 0.6));
}

// ---------------------------------------------------------------------------
// barrier demolition / sealing
// ---------------------------------------------------------------------------

export const DEMOLISH_SECONDS = 26;
export function barrierProgressAt(t: number): number {
  return smooth(2, DEMOLISH_SECONDS, t);
}

function runBarrier(env: SceneEnv, spec: Extract<SceneSpec, { kind: "barrier" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  if (spec.mode === "demolish") {
    const k = barrierProgressAt(t);
    for (let d = 0; d < 3; d++) {
      const kd = Math.max(0, k - d * 0.02);
      const { p, a } = along(BARRIER, kd);
      const sp = f.S(p);
      if (!f.on(sp, 40)) continue;
      vehicle(f, { x: sp.x + d * 4 * u, y: sp.y + d * 3 * u }, a, "dozer", t, t < DEMOLISH_SECONDS, undefined, d);
      if (t < DEMOLISH_SECONDS + 1) {
        for (let j = 0; j < 3; j++) {
          const age = (t * 0.9 + j / 3 + d * 0.2) % 1;
          puff(ctx, { x: sp.x + (hash01(seed, j + d * 5) - 0.5) * 10 * u, y: sp.y - age * 10 * u }, (3 + age * 7) * u, `rgba(175,155,120,${(0.4 * (1 - age)).toFixed(3)})`);
        }
      }
    }
    const mid = f.S(along(BARRIER, 0.3).p);
    pill(f, tr(env.caption ?? { he: "פירוק גדר ההפרדה", en: "Tearing down the separation barrier" }, f.lang), { x: mid.x - 40, y: mid.y - 30 }, "#6B6456", "#FFFFFF", window01(t, 0.3, DEMOLISH_SECONDS + 4, 0.6));
    return;
  }
  // seal: gates close, patrols run, queues back up
  const gates: LonLat[] = [[35.21, 31.86], [35.0, 32.3], [35.28, 32.53], [35.08, 31.63]];
  gates.forEach((g, i) => {
    const p = f.L(g);
    if (!f.on(p, 60)) return;
    box(ctx, p, 4 * u, 2.4 * u, 2 * u, "#E8E2D4", "#C9C0AE", "#AFA592");
    const closed = t > 2 + i * 0.8;
    ctx.fillStyle = closed ? RED : "#3C9A66";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 5 * u, 1.5 * u, 0, Math.PI * 2);
    ctx.fill();
    const queue = Math.floor(smooth(3 + i, 14 + i, t) * 6);
    for (let c = 0; c < queue; c++) vehicle(f, { x: p.x + (6 + c * 5) * u, y: p.y + c * 1.2 * u }, Math.PI, "car", t, false, undefined, c + i);
  });
  for (let v = 0; v < 3; v++) {
    const c = ((t / 16 + v / 3) % 1);
    const k = 0.1 + 0.8 * (c < 0.5 ? c * 2 : 2 - c * 2);
    const { p, a } = along(BARRIER, k);
    const sp = f.S(p);
    if (f.on(sp)) vehicle(f, { x: sp.x - 3 * u, y: sp.y + 3 * u }, c < 0.5 ? a : a + Math.PI, "humvee", t, true, undefined, v);
  }
  const mid = f.S(along(BARRIER, 0.4).p);
  pill(f, tr(env.caption ?? { he: "סגר מלא בקו הגדר", en: "Full closure on the barrier line" }, f.lang), { x: mid.x - 40, y: mid.y - 30 }, RED, "#FFFFFF", window01(t, 0.3, 24, 0.6));
}

// ---------------------------------------------------------------------------
// withdrawal and settlements
// ---------------------------------------------------------------------------

function runWithdrawal(env: SceneEnv, spec: Extract<SceneSpec, { kind: "withdrawal" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const exits: LonLat[] = [[34.95, 32.15], [35.02, 31.85], [35.0, 31.55]];
  SETTLEMENTS.forEach((id, si) => {
    const ll = L(id);
    const t0 = 2 + si * 1.6;
    // houses empty out
    const fade = 1 - smooth(t0 + 6, t0 + 14, t);
    if (fade > 0) {
      ctx.save();
      ctx.globalAlpha *= fade;
      drawSettlement(f, ll, hashString(id), 6);
      ctx.restore();
    }
    // buses and army trucks leave toward the Green Line
    const exit = exits[si % exits.length];
    for (let v = 0; v < 3; v++) {
      const kind: VehicleKind = v === 0 ? "bus" : v === 1 ? "truck" : spec.mode === "un" ? "apc" : "bus";
      const m = travel([ll, [lerp(ll[0], exit[0], 0.5), lerp(ll[1], exit[1], 0.5) + 0.02], exit], t, t0 + v * 1.1, 11);
      if (t < t0 + v * 1.1 || m.k >= 1) continue;
      const p = f.S(m.p);
      if (f.on(p)) vehicle(f, p, m.a, kind, t, m.moving, undefined, v);
    }
    // forced evacuation: people on the roofs, police lines, burning tires
    if (spec.mode === "immediate" && si < 3) {
      const c = f.L(ll);
      if (!f.on(c, 60)) return;
      for (let i = 0; i < 8; i++) {
        const q = { x: c.x + (hash01(seed, si * 10 + i) - 0.5) * 16 * u, y: c.y + (hash01(seed, si * 10 + i + 3) - 0.5) * 6 * u };
        person(f, q, t + i, { color: i % 2 ? "#E8862A" : "#EFEFEF", flag: i % 4 === 0 ? "#E8862A" : null });
      }
      for (let i = 0; i < 6; i++) person(f, { x: c.x - 14 * u + i * 5 * u, y: c.y + 10 * u }, 0.1, { color: "#1F3F8A" });
      smokeColumn(f, { x: c.x + 12 * u, y: c.y + 4 * u }, t - t0, 0.8 * u, seed + si, 20);
      fire(f, { x: c.x + 12 * u, y: c.y + 4 * u }, t, 0.7 * u, seed + si, window01(t, t0, t0 + 18));
    }
  });
  if (spec.mode === "un") {
    const bridge = L("allenby");
    for (let v = 0; v < 5; v++) {
      const dest: LonLat = [35.2 + (v % 3) * 0.04, 31.95 + v * 0.06];
      const m = travel([bridge, [35.4, 31.9], dest], t, 6 + v * 1.4, 14);
      if (t < 6 + v * 1.4) continue;
      const p = f.S(m.p);
      if (f.on(p)) vehicle(f, p, m.a, "un", t, m.moving, undefined, v);
    }
    for (let h = 0; h < 2; h++) {
      const m = travel([[35.9, 31.95], [35.25, 32.0 + h * 0.2]], t, 8 + h * 2, 12);
      if (t > 8 + h * 2 && m.k < 1) helicopter(f, f.S(m.p), m.a, 16, t);
    }
  }
  const anchor = f.L([35.25, 32.05]);
  const text: Bi = spec.mode === "immediate" ? { he: "פינוי כפוי מההתנחלויות", en: "Forced evacuation of the settlements" } : spec.mode === "un" ? { he: "נסיגה וכניסת כוח או\"ם", en: "Withdrawal; UN force moves in" } : { he: "פינוי מדורג בהסכמה", en: "Staged, compensated evacuation" };
  pill(f, tr(env.caption ?? text, f.lang), { x: anchor.x, y: anchor.y - 60 }, spec.mode === "immediate" ? RED : "#35506E", "#FFFFFF", window01(t, 0.3, 34, 0.6));
}

function runSettlers(env: SceneEnv, spec: Extract<SceneSpec, { kind: "settlers" }>): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const anchor = f.L([35.25, 32.0]);
  if (spec.mode === "build" || spec.mode === "sovereignty") {
    OUTPOSTS.forEach((ll, i) => {
      const t0 = 1 + i * 1.2;
      const p = f.L(ll);
      if (!f.on(p, 40)) return;
      const grow = smooth(t0, t0 + 4, t);
      if (grow > 0) {
        for (let c = 0; c < 3; c++) box(ctx, { x: p.x + (c - 1) * 3.6 * u, y: p.y + (c % 2) * 2 * u }, 3 * u, 1.6 * u, 1.3 * u * grow, "#F4F1EA", "#D9D4C8", "#BDB6A8");
        // crane slewing while it builds
        const swing = Math.sin(t * 0.8 + i) * 0.6 * (1 - smooth(t0 + 6, t0 + 8, t));
        ctx.strokeStyle = "#D9A62A";
        ctx.lineWidth = 0.8 * u;
        ctx.beginPath();
        ctx.moveTo(p.x + 6 * u, p.y);
        ctx.lineTo(p.x + 6 * u, p.y - 10 * u);
        ctx.lineTo(p.x + 6 * u + Math.cos(swing) * 7 * u, p.y - 10 * u + Math.sin(swing) * 2 * u);
        ctx.stroke();
      }
    });
    if (spec.mode === "sovereignty") {
      const a = smooth(4, 16, t);
      for (const ring of AREA_C) fillRing(f, ring, `rgba(47,99,176,${(0.13 * a).toFixed(3)})`, `rgba(47,99,176,${(0.45 * a).toFixed(3)})`, 1);
      const k = f.L(P.knesset);
      if (f.on(k, 60)) icon(f, { x: k.x, y: k.y - 26 }, "ballot", BLUE, smooth(1, 2, t));
    }
    const text: Bi = spec.mode === "sovereignty" ? { he: "חוק הריבונות עבר: החלת ריבונות על שטחי C", en: "Sovereignty law passed over Area C" } : { he: "הרחבת בנייה והכשרת מאחזים", en: "Construction and outposts legalized" };
    pill(f, tr(env.caption ?? text, f.lang), { x: anchor.x, y: anchor.y - 70 }, BLUE, "#FFFFFF", window01(t, 0.3, 22, 0.6));
    return;
  }
  if (spec.mode === "freeze") {
    OUTPOSTS.forEach((ll, i) => {
      const p = f.L(ll);
      if (!f.on(p, 40)) return;
      const stopAt = 2 + i * 1.1;
      // the crane still swings, then work stops
      const swing = Math.sin(Math.min(t, stopAt) * 0.9 + i) * 0.7;
      ctx.strokeStyle = "#D9A62A";
      ctx.lineWidth = 0.8 * u;
      ctx.beginPath();
      ctx.moveTo(p.x + 6 * u, p.y);
      ctx.lineTo(p.x + 6 * u, p.y - 10 * u);
      ctx.lineTo(p.x + 6 * u + Math.cos(swing) * 7 * u, p.y - 10 * u + Math.sin(swing) * 2 * u);
      ctx.stroke();
      const a = smooth(stopAt, stopAt + 0.8, t);
      ctx.strokeStyle = `rgba(200,55,45,${(0.85 * a).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(p.x - 4 * u, p.y - 4 * u);
      ctx.lineTo(p.x + 4 * u, p.y + 2 * u);
      ctx.moveTo(p.x + 4 * u, p.y - 4 * u);
      ctx.lineTo(p.x - 4 * u, p.y + 2 * u);
      ctx.stroke();
      // the work crew drives off toward the Green Line
      const m = travel([ll, [34.98, ll[1]]], t, stopAt + 0.5, 9);
      if (t > stopAt + 0.5 && m.k < 1) {
        const tp = f.S(m.p);
        if (f.on(tp)) vehicle(f, tp, m.a, "truck", t, true, undefined, i);
      }
    });
    pill(f, tr(env.caption ?? { he: "הקפאת בנייה בהתנחלויות", en: "Settlement construction frozen" }, f.lang), { x: anchor.x, y: anchor.y - 70 }, "#35506E", "#FFFFFF", window01(t, 0.3, 20, 0.6));
    return;
  }
  // violence / revolt / enforce
  const villages: PlaceId[] = ["huwara", "turmus_ayya"];
  villages.forEach((vid, vi) => {
    const v = f.L(L(vid));
    const from = f.L(OUTPOSTS[vi]);
    if (!f.on(v, 80)) return;
    for (let h = 0; h < 5; h++) house(ctx, { x: v.x + (h - 2) * 4.5 * u, y: v.y + (h % 2) * 3 * u }, 0.8 * u, "#C9B48A", "#EAE0CB", spec.mode === "violence" && h < 2 ? smooth(6 + vi * 2, 10 + vi * 2, t) * 0.8 : 0);
    if (spec.mode === "violence" || spec.mode === "revolt") {
      for (let i = 0; i < 8; i++) {
        const k = smooth(1 + i * 0.3, 7 + i * 0.3, t) * (spec.mode === "revolt" ? 0.5 : 1);
        const q = { x: lerp(from.x, v.x, k) + (hash01(seed, i + vi * 10) - 0.5) * 10 * u, y: lerp(from.y, v.y, k) + (hash01(seed, i + vi * 10 + 1) - 0.5) * 5 * u };
        if (f.people > 0) person(f, q, t * 1.5 + i, { color: i % 3 === 0 ? "#F2F2F2" : "#3B4A63", flag: spec.mode === "revolt" && i % 4 === 0 ? "#E8862A" : null });
      }
      if (spec.mode === "violence") {
        for (let h = 0; h < 2; h++) {
          const hp = { x: v.x + (h - 2) * 4.5 * u, y: v.y - 3 * u };
          fire(f, hp, t, u, seed + h + vi, window01(t, 6 + vi * 2, 22, 1));
          smokeColumn(f, hp, t - 6 - vi * 2, u, seed + h, 18);
        }
        const car = { x: v.x + 12 * u, y: v.y + 6 * u };
        vehicle(f, car, 0.3, "car", t, false, undefined, 1);
        fire(f, car, t, 0.8 * u, seed + 9, window01(t, 7, 20, 1));
      } else {
        const junction = { x: lerp(from.x, v.x, 0.5), y: lerp(from.y, v.y, 0.5) };
        smokeColumn(f, junction, t - 3, 0.8 * u, seed + vi, 20);
        fire(f, junction, t, 0.7 * u, seed + vi, window01(t, 3, 20, 1));
      }
    }
    // the army arrives late (violence) or on time (enforce)
    const arrive = spec.mode === "enforce" ? 2 : 11;
    for (let j = 0; j < 2; j++) {
      const m = smooth(arrive + j, arrive + 6 + j, t);
      if (m <= 0) continue;
      const base = f.L(P.wb_staging);
      vehicle(f, { x: lerp(base.x, v.x - 10 * u, m), y: lerp(base.y, v.y + (j * 6 - 3) * u, m) }, Math.atan2(v.y - base.y, v.x - base.x), spec.mode === "revolt" ? "police" : "humvee", t, m < 1, undefined, j);
    }
    if (spec.mode === "enforce" && t > 8) {
      for (let i = 0; i < 3; i++) person(f, { x: v.x - (14 - smooth(8, 14, t) * 6) * u + i * 3 * u, y: v.y + 6 * u }, t, { color: "#F2F2F2" });
    }
  });
  const text: Bi = spec.mode === "violence" ? { he: "אלימות מתנחלים בכפרים", en: "Settler violence in villages" } : spec.mode === "revolt" ? { he: "מרד אזרחי: חסימות צירים", en: "Civil revolt: roads blocked" } : { he: "אכיפה: מעצרים מנהליים", en: "Enforcement: administrative detentions" };
  pill(f, tr(env.caption ?? text, f.lang), { x: anchor.x, y: anchor.y - 70 }, spec.mode === "enforce" ? "#35506E" : RED, "#FFFFFF", window01(t, 0.3, 24, 0.6));
}

// ---------------------------------------------------------------------------
// Gaza: siege, aid, transfer, boats, nuclear
// ---------------------------------------------------------------------------

function runSiege(env: SceneEnv, spec: Extract<SceneSpec, { kind: "siege" }>): void {
  const { f, t } = env;
  const { ctx, u } = f;
  const k = f.L(P.kerem_shalom);
  const route: LonLat[] = [[34.42, 31.08], [34.33, 31.17], P.kerem_shalom, [34.3, 31.3], [34.37, 31.4]];
  for (let i = 0; i < 8; i++) {
    const t0 = 0.5 + i * 1.1;
    let kk: number;
    if (spec.mode === "aid") kk = smooth(t0, t0 + 16, t);
    else kk = smooth(t0, t0 + 6, t) * (0.42 - i * 0.03) - smooth(t0 + 9, t0 + 16, t) * 0.25;
    const { p, a } = along(route, Math.max(0, kk));
    const sp = f.S(p);
    if (t > t0 && f.on(sp)) vehicle(f, sp, spec.mode === "close" && t > t0 + 9 ? a + Math.PI : a, "truck", t, true, undefined, i);
  }
  if (f.on(k, 60)) {
    ctx.fillStyle = spec.mode === "close" && t > 3 ? RED : "#3C9A66";
    ctx.beginPath();
    ctx.arc(k.x, k.y - 6 * u, 2.2 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  if (spec.mode === "close") {
    // lights go out over Gaza City, corvettes take the blockade line
    const g = f.L(P.gaza_city);
    puff(ctx, g, 34 * u, `rgba(30,32,44,${(0.28 * smooth(4, 14, t)).toFixed(3)})`);
    const line: LonLat[][] = [[[33.6, 31.8], [34.25, 31.62]], [[33.5, 31.5], [34.14, 31.47]], [[33.6, 31.2], [34.05, 31.32]]];
    line.forEach((path, i) => {
      const m = travel(path, t, 1 + i, 12);
      const sp = f.S(m.p);
      if (f.on(sp)) ship(f, sp, m.a, "corvette", m.moving, i);
    });
  }
  pill(f, tr(env.caption ?? (spec.mode === "close" ? { he: "סגר מוחלט: הסיוע נעצר", en: "Total siege: aid halted" } : { he: "משאיות סיוע נכנסות לרצועה", en: "Aid trucks enter the Strip" }), f.lang), { x: k.x, y: k.y - 50 }, spec.mode === "close" ? RED : "#1F7A4A", "#FFFFFF", window01(t, 0.3, 24, 0.6));
}

function runTransfer(env: SceneEnv): void {
  const { f, t, seed } = env;
  const { u } = f;
  const cross = L("rafah_crossing");
  const sources: LonLat[] = [L("khan_younis"), L("rafah"), L("deir_balah")];
  sources.forEach((src, si) => {
    const route: LonLat[] = [src, cross, [34.05, 31.18], [33.95, 31.12]];
    for (let i = 0; i < 16; i++) {
      const t0 = si * 1.5 + i * 0.9;
      const k = smooth(t0, t0 + 24, t);
      if (k <= 0 || k >= 1) continue;
      const { p } = along(route, k);
      const sp = f.S(p);
      const side = (hash01(seed, si * 50 + i) - 0.5) * 5 * u;
      if (f.on(sp) && (f.people > 0 || f.ppd > 100)) person(f, { x: sp.x + side, y: sp.y + side * 0.5 }, t * 1.2 + i * 0.3, { color: ["#6E6A60", "#8A8578", "#5B5750"][i % 3] });
      if (i % 5 === 0) {
        const bus = along(route, Math.max(0, k - 0.05));
        const bp = f.S(bus.p);
        if (f.on(bp)) vehicle(f, bp, bus.a, "bus", t, true, undefined, i);
      }
    }
  });
  for (let e = 0; e < 4; e++) {
    const m = travel([[33.6, 30.9 - e * 0.1], [34.12 - e * 0.05, 31.12 - e * 0.12]], t, 4 + e, 14);
    const sp = f.S(m.p);
    if (t > 4 + e && f.on(sp)) vehicle(f, sp, m.a, "egypt_tank", t, m.moving, m.a, e);
  }
  const c = f.L(cross);
  pill(f, tr(env.caption ?? { he: "טרנספר כפוי דרך מעבר רפיח", en: "Forced transfer through Rafah" }, f.lang), { x: c.x, y: c.y - 52 }, RED, "#FFFFFF", window01(t, 0.3, 34, 0.6));
}

function runBoats(env: SceneEnv): void {
  const { f, t } = env;
  const port = L("gaza_port");
  for (let i = 0; i < 5; i++) {
    const m = travel([port, [33.9, 31.65 + i * 0.04], [32.2, 32.4 + i * 0.1]], t, 0.5 + i * 2.2, 22);
    const sp = f.S(m.p);
    if (t > 0.5 + i * 2.2 && m.k < 1 && f.on(sp, 40)) ship(f, sp, m.a, "ferry", m.moving, i);
  }
  const p = f.L(port);
  pill(f, tr(env.caption ?? { he: "\"הגירה מעודדת\": אוניות יוצאות מעזה", en: "\"Encouraged emigration\": ships leave Gaza" }, f.lang), { x: p.x - 40, y: p.y - 46 }, "#8A2E2A", "#FFFFFF", window01(t, 0.3, 28, 0.6));
}

function runNuclear(env: SceneEnv): void {
  const { f, t, seed } = env;
  const { ctx, u, w, h } = f;
  const gz = f.L([34.42, 31.45]);
  if (t < 0.6) {
    ctx.fillStyle = `rgba(255,252,240,${(0.85 * (1 - t / 0.6)).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (crossed(env, 0.05)) env.sound("impact");
  if (t < 8) {
    const k = smooth(0, 7, t);
    ctx.strokeStyle = `rgba(150,110,70,${(0.7 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(gz.x, gz.y, (10 + k * 220) * u, (5 + k * 110) * u, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  puff(ctx, gz, 60 * u * smooth(0, 3, t), `rgba(45,38,32,${(0.55 * smooth(0, 6, t)).toFixed(3)})`);
  for (let i = 0; i < 12; i++) {
    const p = f.L(jitter([34.42, 31.45], 0.12, seed, i));
    fire(f, p, t, u, seed + i, window01(t, 1 + i * 0.3, 40, 2));
  }
  mushroom(f, gz, t - 0.3, 1.1 * u);
  const drift = smooth(10, 40, t);
  puff(ctx, { x: gz.x + drift * 90 * u, y: gz.y - drift * 50 * u }, (30 + drift * 60) * u, `rgba(150,130,90,${(0.3 * smooth(8, 16, t)).toFixed(3)})`);
  pill(f, tr(env.caption ?? { he: "פיצוץ גרעיני בעזה", en: "Nuclear detonation in Gaza" }, f.lang), { x: gz.x, y: gz.y - 150 * u - 20 }, "#3A1E1A", "#FFFFFF", window01(t, 0.6, 40, 0.8));
}

// ---------------------------------------------------------------------------
// diplomacy: cables between capitals
// ---------------------------------------------------------------------------

function runDiplomacy(env: SceneEnv, spec: Extract<SceneSpec, { kind: "diplomacy" }>): void {
  const { f, t } = env;
  const { ctx } = f;
  spec.links.forEach((l, i) => {
    const t0 = 0.8 + i * 1.4;
    const a = f.L(L(l.from));
    const b = f.L(L(l.to));
    if (!f.on(a, 400) && !f.on(b, 400)) return;
    const color = l.tone < 0 ? "200,55,45" : l.tone > 0 ? "31,122,74" : "53,80,110";
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const H = Math.min(160, dist * 0.25 + 10);
    const k = smooth(t0, t0 + 3, t);
    const fade = 1 - smooth(sceneLen(spec) - 3, sceneLen(spec), t);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.setLineDash([4, 3]);
    arcTrail(f, a, b, 0, k, H, color, 1.6);
    ctx.setLineDash([]);
    const head = arcPoint(a, b, k, H).air;
    if (k < 1) {
      ctx.fillStyle = `rgb(${color})`;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // capitals pulse, the icon lands at the destination
    for (const [p, when] of [[a, t0], [b, t0 + 3]] as Array<[Pt, number]>) {
      const age = t - when;
      if (age > 0 && age < 1.5) {
        ctx.strokeStyle = `rgba(${color},${(0.8 * (1 - age / 1.5)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 + age * 16, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = `rgb(${color})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const land = smooth(t0 + 2.6, t0 + 3.2, t);
    if (land > 0) icon(f, { x: b.x, y: b.y - 20 }, l.icon, `rgb(${color})`, 0.6 + 0.4 * land);
    ctx.restore();
  });
  const first = spec.links[0];
  if (first !== undefined && env.caption !== null) {
    const p = f.L(L(first.to));
    const tone = first.tone < 0 ? "#8A2E2A" : first.tone > 0 ? "#1F7A4A" : "#35506E";
    pill(f, tr(env.caption, f.lang), { x: p.x, y: p.y - 48 }, tone, "#FFFFFF", window01(t, 0.5, sceneLen(spec), 0.6));
  }
}

// ---------------------------------------------------------------------------
// war footing: mobilization, ceasefire, Egypt, Iran
// ---------------------------------------------------------------------------

function runMobilize(env: SceneEnv): void {
  const { f, t } = env;
  const cities: PlaceId[] = ["tel_aviv", "jerusalem", "haifa", "beersheba"];
  for (const c of cities) {
    const p = f.L(L(c));
    if (f.on(p, 60)) sirenZone(f, p, t, 14 * f.u, window01(t, 0.3, 6, 0.4), null);
  }
  if (crossed(env, 0.4)) env.sound("alert");
  const streams: Array<{ from: PlaceId; to: PlaceId; kind: VehicleKind }> = [
    { from: "tel_aviv", to: "north_staging", kind: "bus" }, { from: "jerusalem", to: "gaza_staging", kind: "bus" }, { from: "haifa", to: "north_staging", kind: "bus" },
    { from: "beersheba", to: "gaza_staging", kind: "bus" }, { from: "tel_aviv", to: "gaza_staging", kind: "transporter" }, { from: "afula", to: "north_staging", kind: "transporter" },
  ];
  streams.forEach((s, si) => {
    for (let i = 0; i < 3; i++) {
      const t0 = 2 + si * 0.8 + i * 1.6;
      const m = travel([L(s.from), L(s.to)], t, t0, 12);
      if (t < t0 || m.k >= 1) continue;
      const p = f.S(m.p);
      if (f.on(p)) vehicle(f, p, m.a, s.kind, t, true, undefined, i + si);
    }
  });
  for (let j = 0; j < 4; j++) {
    const base = j < 2 ? L("nevatim") : L("ramat_david");
    const m = travel([base, [base[0] - 0.25, base[1] + 0.35], [base[0] + 0.2, base[1] + 0.6]], t, 3 + j * 0.8, 9);
    if (t > 3 + j * 0.8 && m.k < 1) jet(f, f.S(m.p), m.a, 20 * smooth(0, 0.2, m.k), t, true);
  }
  const p = f.L(P.center_staging);
  pill(f, tr(env.caption ?? { he: "גיוס מילואים נרחב · שינוי מצב לחירום", en: "Mass reserve call-up · emergency footing" }, f.lang), { x: p.x, y: p.y - 70 }, RED, "#FFFFFF", window01(t, 0.3, 26, 0.6));
}

function runCeasefire(env: SceneEnv): void {
  const { f, t } = env;
  const fronts: Array<{ from: LonLat; to: PlaceId }> = [
    { from: [35.38, 33.2], to: "north_staging" }, { from: [35.5, 33.18], to: "north_staging" }, { from: [34.41, 31.45], to: "gaza_staging" }, { from: [34.36, 31.39], to: "gaza_staging" },
  ];
  fronts.forEach((fr, i) => {
    const m = travel([fr.from, L(fr.to)], t, 2 + i * 0.7, 12);
    const p = f.S(m.p);
    if (f.on(p)) vehicle(f, p, m.a, i % 2 ? "apc" : "tank", t, m.moving, m.a, i);
  });
  for (const id of ["north_staging", "gaza_staging"] as PlaceId[]) {
    const p = f.L(L(id));
    if (f.on(p, 100)) pill(f, f.lang === "he" ? "הפסקת אש" : "Ceasefire", { x: p.x, y: p.y - 30 }, "#1F7A4A", "#FFFFFF", window01(t, 1, 20, 0.6));
  }
}

function runEgyptArmy(env: SceneEnv): void {
  const { f, t } = env;
  const routes: LonLat[][] = [
    [P.ismailia, [32.6, 30.62], [33.4, 30.85], [34.05, 31.05]],
    [P.suez, [32.7, 30.0], [33.5, 30.3], [34.2, 30.55]],
    [[31.9, 30.9], [32.33, 30.95], [33.2, 31.05], [33.9, 31.15]],
  ];
  routes.forEach((r, ri) => {
    for (let v = 0; v < 4; v++) {
      const t0 = 1 + ri + v * 1.2;
      const m = travel(r, t, t0, 18);
      if (t < t0) continue;
      const pos = along(r, Math.max(0, m.k - v * 0.03));
      const p = f.S(pos.p);
      if (f.on(p)) vehicle(f, p, pos.a, v % 3 === 2 ? "truck" : "egypt_tank", t, m.moving, pos.a, v + ri);
    }
  });
  const p = f.L(P.el_arish);
  pill(f, tr(env.caption ?? { he: "צבא מצרים נע לסיני", en: "Egypt's army moves into Sinai" }, f.lang), { x: p.x, y: p.y - 50 }, RED, "#FFFFFF", window01(t, 0.3, 26, 0.6));
}

function runIranTels(env: SceneEnv): void {
  const { f, t } = env;
  const sites: PlaceId[] = ["isfahan", "kermanshah", "tehran"];
  sites.forEach((id, i) => {
    const c = f.L(L(id));
    if (!f.on(c, 80)) return;
    for (let v = 0; v < 3; v++) {
      const t0 = 1 + i + v * 1.2;
      const out = smooth(t0, t0 + 5, t);
      const p = { x: c.x - 16 * f.u + out * 14 * f.u + v * 6 * f.u, y: c.y + v * 4 * f.u };
      vehicle(f, p, 0, "tel", t, out > 0 && out < 1);
      raisedMissile(f, { x: p.x + 2 * f.u, y: p.y - 1 * f.u }, smooth(t0 + 5.5, t0 + 8, t));
    }
    icon(f, { x: c.x, y: c.y - 30 }, "warning", RED, smooth(3 + i, 4 + i, t));
  });
  const p = f.L(P.isfahan);
  pill(f, tr(env.caption ?? { he: "איראן מציבה משגרי טילים", en: "Iran deploys missile launchers" }, f.lang), { x: p.x, y: p.y - 60 }, RED, "#FFFFFF", window01(t, 0.3, 20, 0.6));
}

// ---------------------------------------------------------------------------
// economy, Knesset, water, PA forces, demolitions
// ---------------------------------------------------------------------------

function runEconomy(env: SceneEnv, spec: Extract<SceneSpec, { kind: "economy" }>): void {
  const { f, t, seed } = env;
  const { ctx } = f;
  const c = f.L(P.tel_aviv);
  if (!f.on(c, 300)) return;
  if (spec.mode === "factories") {
    const zones: LonLat[] = [[35.05, 32.8], [34.84, 31.3], [34.62, 31.52]];
    zones.forEach((z, i) => {
      const p = f.L(z);
      if (!f.on(p, 60)) return;
      for (let b = 0; b < 3; b++) box(ctx, { x: p.x + (b - 1) * 5 * f.u, y: p.y }, 4 * f.u, 3 * f.u, 2.5 * f.u, "#C9CCD0", "#9EA3A9", "#7E848B");
      smokeColumn(f, { x: p.x + 5 * f.u, y: p.y - 3 * f.u }, t - i, 0.9 * f.u, seed + i, 18, 0.3);
      for (let v = 0; v < 2; v++) {
        const m = travel([z, [z[0] + 0.15, z[1] + 0.25]], t, 3 + i + v * 2, 9);
        if (m.k > 0 && m.k < 1) vehicle(f, f.S(m.p), m.a, "truck", t, true, undefined, v);
      }
    });
    pill(f, tr(env.caption ?? { he: "תוכנית חימוש לאומית", en: "National munitions program" }, f.lang), { x: c.x, y: c.y - 70 }, "#35506E", "#FFFFFF", window01(t, 0.3, 18, 0.6));
    return;
  }
  // a stock-exchange panel beside Tel Aviv with the index drawing itself
  const down = spec.mode === "downgrade" || spec.mode === "deficit";
  const x0 = c.x + 30;
  const y0 = c.y - 110;
  const W = 150;
  const H = 70;
  const a = window01(t, 0.3, 16, 0.6);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(ctx, x0, y0, W, H, 10);
  ctx.fill();
  ctx.strokeStyle = "#E7E1D6";
  ctx.lineWidth = 1;
  ctx.stroke();
  const pts = 24;
  const k = smooth(0.6, 8, t);
  ctx.beginPath();
  for (let i = 0; i <= pts * k; i++) {
    const x = x0 + 10 + (i / pts) * (W - 20);
    const trend = down ? i / pts : spec.mode === "austerity" ? 0.35 - (i / pts) * 0.15 : -(i / pts) * 0.5;
    const noise = (hash01(seed, i) - 0.5) * 0.18;
    const y = y0 + 16 + (0.2 + trend * 0.65 + noise) * (H - 30);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = down ? RED : "#1F7A4A";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `600 11px Rubik, Heebo, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillStyle = "#1C2330";
  ctx.fillText(f.lang === "he" ? "ת\"א 125" : "TA-125", x0 + 10, y0 + 13);
  ctx.textAlign = "right";
  ctx.fillStyle = down ? RED : "#1F7A4A";
  const pct = down ? -(2.1 + hash01(seed, 99) * 3).toFixed(1) : +(0.6 + hash01(seed, 98) * 1.5).toFixed(1);
  ctx.fillText(`${pct > 0 ? "+" : ""}${(pct * k).toFixed(1)}%`, x0 + W - 10, y0 + 13);
  if (spec.mode === "downgrade") {
    ctx.fillStyle = "#1C2330";
    ctx.textAlign = "right";
    ctx.fillText("A+  →  A", x0 + W - 10, y0 + H - 7);
  }
  ctx.restore();
  const text: Bi = spec.mode === "downgrade" ? { he: "הורדת דירוג האשראי", en: "Credit rating downgraded" } : spec.mode === "austerity" ? { he: "קיצוצים ומסים", en: "Cuts and tax hikes" } : spec.mode === "boost" ? { he: "המשק מתאושש", en: "The economy recovers" } : { he: "גירעון מתרחב", en: "Deficit widens" };
  pill(f, tr(env.caption ?? text, f.lang), { x: x0 + W / 2, y: y0 - 16 }, down ? RED : "#1F7A4A", "#FFFFFF", a);
}

function runKnesset(env: SceneEnv, spec: Extract<SceneSpec, { kind: "knesset" }>): void {
  const { f, t, seed } = env;
  const k = f.L(P.knesset);
  if (!f.on(k, 200)) return;
  const u = Math.min(f.u, 1.6);
  if (spec.mode === "threat") {
    // the partner's members come out on the steps with signs, make their point, and go back in
    for (let i = 0; i < 8; i++) {
      const out = smooth(1 + i * 0.35, 5 + i * 0.35, t) * (1 - smooth(9 + i * 0.3, 13 + i * 0.3, t));
      const q = { x: k.x - 6 * u + out * (10 + (i % 4) * 5) * u, y: k.y + 2 * u + ((i % 2) * 2 - 1) * out * 6 * u };
      const walking = (t > 1 + i * 0.35 && t < 5 + i * 0.35) || (t > 9 + i * 0.3 && t < 13 + i * 0.3);
      person(f, q, walking ? t * 1.5 + i : 0.2, { color: i % 2 === 0 ? spec.color : "#2E3440", sign: i % 3 === 0 && out > 0.5 ? "#FFF3C4" : null });
    }
  }
  if (spec.mode === "quit" || spec.mode === "fall") {
    for (let i = 0; i < 10; i++) {
      const out = smooth(1 + i * 0.3, 8 + i * 0.3, t);
      const q = { x: k.x - 6 * u + out * (20 + hash01(seed, i) * 24) * u, y: k.y + 2 * u + (hash01(seed, i + 1) - 0.5) * 10 * u * out };
      person(f, q, out > 0 && out < 1 ? t * 1.5 + i : 0.2, { color: i % 3 === 0 ? spec.color : "#2E3440" });
    }
  }
  if (spec.mode === "election") {
    const cities: PlaceId[] = ["tel_aviv", "jerusalem", "haifa", "beersheba", "ashdod", "netanya"];
    cities.forEach((c, i) => {
      const p = f.L(L(c));
      if (f.on(p, 60)) icon(f, { x: p.x, y: p.y - 22 }, "ballot", BLUE, smooth(1 + i * 0.6, 1.6 + i * 0.6, t));
    });
  } else {
    icon(f, { x: k.x, y: k.y - 28 }, spec.mode === "threat" ? "warning" : "ballot", spec.mode === "threat" ? "#946312" : RED, smooth(0.5, 1.2, t));
  }
  if (env.caption !== null) pill(f, tr(env.caption, f.lang), { x: k.x, y: k.y - 58 }, spec.mode === "threat" ? "#946312" : RED, "#FFFFFF", window01(t, 0.3, 14, 0.6));
}

function runWater(env: SceneEnv, spec: Extract<SceneSpec, { kind: "water" }>): void {
  const { f, t } = env;
  const { ctx } = f;
  const flow = spec.mode === "resume" ? smooth(1, 3, t) : 1 - smooth(3, 5, t);
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -t * 30 * flow;
  const pts = WATER_PIPE.map((ll) => f.L(ll));
  ctx.strokeStyle = "rgba(50,120,180,0.85)";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  const valve = f.L([35.62, 32.5]);
  if (spec.mode === "cut") icon(f, { x: valve.x, y: valve.y - 18 }, "lock", RED, smooth(3, 4, t));
  pill(f, tr(env.caption ?? (spec.mode === "cut" ? { he: "איום לעצור את אספקת המים לירדן", en: "Threat to stop Jordan's water" } : { he: "אספקת המים לירדן נמשכת", en: "Water to Jordan continues" }), f.lang), { x: valve.x + 40, y: valve.y - 50 }, spec.mode === "cut" ? RED : "#1F7A4A", "#FFFFFF", window01(t, 0.3, 16, 0.6));
}

function runPaForces(env: SceneEnv, spec: Extract<SceneSpec, { kind: "pa_forces" }>): void {
  const { f, t, seed } = env;
  const { u } = f;
  if (spec.mode === "enter_gaza") {
    const route: LonLat[] = [[34.2, 31.2], P.rafah_crossing, P.khan_younis, P.gaza_city];
    for (let v = 0; v < 6; v++) {
      const m = travel(route, t, 1 + v * 1.3, 18);
      if (t < 1 + v * 1.3) continue;
      const pos = along(route, Math.max(0, m.k - v * 0.02));
      const p = f.S(pos.p);
      if (f.on(p)) vehicle(f, p, pos.a, "police", t, m.moving, undefined, v);
    }
    const g = f.L(P.gaza_city);
    pill(f, tr(env.caption ?? { he: "כוחות הרשות נכנסים לעזה", en: "PA forces enter Gaza" }, f.lang), { x: g.x, y: g.y - 50 }, "#35506E", "#FFFFFF", window01(t, 0.3, 24, 0.6));
    return;
  }
  // collapse: posts overrun in the cities
  for (const [i, id] of (["jenin", "nablus", "tulkarm"] as PlaceId[]).entries()) {
    const c = f.L(L(id));
    if (!f.on(c, 60)) continue;
    box(f.ctx, { x: c.x + 8 * u, y: c.y }, 4 * u, 3 * u, 2.4 * u, "#E8E2D4", "#C9C0AE", "#AFA592");
    for (let m = 0; m < 5; m++) {
      const k = smooth(2 + i + m * 0.3, 8 + i + m * 0.3, t);
      person(f, { x: c.x - 16 * u + k * 22 * u + m * 2 * u, y: c.y + (m - 2) * 2 * u }, t * 1.6 + m, { color: "#2B2B2B", armed: true });
    }
    fire(f, { x: c.x + 8 * u, y: c.y - 3 * u }, t, u, seed + i, window01(t, 8 + i, 24, 1));
    smokeColumn(f, { x: c.x + 8 * u, y: c.y - 2 * u }, t - 8 - i, u, seed + i, 16);
  }
}

function runDemolitions(env: SceneEnv): void {
  const { f, t, seed } = env;
  const { ctx, u } = f;
  const village = f.L(P.huwara);
  if (f.on(village, 80)) {
    for (let h = 0; h < 3; h++) {
      const p = { x: village.x + (h - 1) * 7 * u, y: village.y };
      const hit = 6 + h * 3;
      const m = smooth(hit - 5, hit, t);
      vehicle(f, { x: p.x - (1 - m) * 26 * u, y: p.y + 5 * u }, 0, "dozer", t, m < 1, undefined, h);
      if (t < hit) house(ctx, p, 0.9 * u, "#C9B48A", "#EAE0CB");
      else {
        puff(ctx, p, (6 + (t - hit) * 4) * u, `rgba(175,155,120,${(0.45 * (1 - smooth(hit, hit + 4, t))).toFixed(3)})`);
        ctx.fillStyle = "rgba(140,128,110,0.85)";
        for (let r = 0; r < 5; r++) ctx.fillRect(p.x + (hash01(seed, r + h * 7) - 0.5) * 6 * u, p.y - (hash01(seed, r + h * 7 + 1)) * 1.5 * u, 1.4 * u, 1 * u);
      }
    }
  }
  for (const [i, id] of (["ramallah", "nablus", "hebron", "jenin"] as PlaceId[]).entries()) {
    const c = f.L(L(id));
    if (!f.on(c, 60)) continue;
    const a = smooth(1 + i * 0.5, 2 + i * 0.5, t);
    f.ctx.fillStyle = `rgba(200,55,45,${a.toFixed(3)})`;
    f.ctx.fillRect(c.x - 7 * u, c.y + 8 * u, 14 * u, 2 * u);
  }
  pill(f, tr(env.caption ?? { he: "סגר והריסת בתים", en: "Closure and home demolitions" }, f.lang), { x: village.x, y: village.y - 50 }, RED, "#FFFFFF", window01(t, 0.3, 22, 0.6));
}

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

/** Length of a scene in seconds (it draws nothing afterwards). */
export function sceneDuration(spec: SceneSpec, seed: number, world: LivingWorld): number {
  if (spec.kind === "barrage") return barrageDuration(spec, seed, world);
  if (spec.kind === "airstrike") return strikePlan(spec, seed).end;
  if (spec.kind === "red_sea" && spec.mode === "hodeidah") return strikePlan({ kind: "airstrike", area: "yemen", sorties: 6, bombs: 10, wide: false }, seed).end;
  if (spec.kind === "flights") return spec.mode === "riyadh" ? 24 : 1 + Math.max(2, Math.min(16, spec.count)) * 1.6 + 18;
  if (spec.kind === "diplomacy") return 0.8 + spec.links.length * 1.4 + 7;
  return sceneLen(spec);
}

function sceneLen(spec: SceneSpec): number {
  switch (spec.kind) {
    case "ground": return spec.mode === "raid" ? 34 : spec.mode === "pullback" ? 20 : 38;
    case "infiltration": return 30;
    case "terror": return 20;
    case "crowd": return 24;
    case "airlift": return 32;
    case "trade": return 34;
    case "red_sea": return 28;
    case "barrier": return spec.mode === "demolish" ? DEMOLISH_SECONDS + 4 : 24;
    case "withdrawal": return 34;
    case "settlers": return spec.mode === "freeze" ? 22 : 24;
    case "siege": return 26;
    case "transfer": return 36;
    case "boats": return 28;
    case "nuclear": return 42;
    case "mobilize": return 26;
    case "ceasefire": return 20;
    case "egypt_army": return 26;
    case "iran_tels": return 20;
    case "economy": return spec.mode === "factories" ? 18 : 16;
    case "knesset": return 14;
    case "water": return 16;
    case "pa_forces": return 26;
    case "demolitions": return 22;
    case "diplomacy": return 0.8 + spec.links.length * 1.4 + 7;
    case "flights": return spec.mode === "riyadh" ? 24 : 1 + Math.max(2, Math.min(16, spec.count)) * 1.6 + 18;
    default: return 24;
  }
}

/** Where the scene's lasting damage lands once it is over. */
export function sceneScars(spec: SceneSpec, seed: number, world: LivingWorld, step: number, id: string): Scar[] {
  const out: Scar[] = [];
  if (spec.kind === "barrage") {
    for (const s of planBarrage(spec, seed, world)) {
      if (s.kill !== null) continue;
      out.push({ id: `${id}:${s.i}`, kind: s.open ? "crater" : "burn", at: s.to, size: spec.weapon === "ballistic" ? 1.5 : 1, step });
    }
  } else if (spec.kind === "airstrike") {
    strikePlan(spec, seed).aims.forEach((a, i) => { if (i % (spec.wide ? 2 : 1) === 0) out.push({ id: `${id}:${i}`, kind: "rubble", at: a, size: 1, step }); });
  } else if (spec.kind === "red_sea" && spec.mode === "hodeidah") {
    out.push({ id: `${id}:port`, kind: "scorched", at: P.hodeidah, size: 1, step });
  } else if (spec.kind === "ground" && spec.mode !== "pullback") {
    for (let i = 0; i < 4; i++) out.push({ id: `${id}:${i}`, kind: "rubble", at: jitter(AXES[spec.theater].objective, 0.03, seed, i + 400), size: 1, step });
  } else if (spec.kind === "nuclear") {
    out.push({ id: `${id}:gz`, kind: "scorched", at: [34.42, 31.45], size: 2.5, step });
  } else if (spec.kind === "settlers" && spec.mode === "violence") {
    out.push({ id: `${id}:v1`, kind: "burn", at: P.huwara, size: 1, step }, { id: `${id}:v2`, kind: "burn", at: P.turmus_ayya, size: 1, step });
  } else if (spec.kind === "demolitions") {
    out.push({ id: `${id}:d`, kind: "rubble", at: P.huwara, size: 1.2, step });
  } else if (spec.kind === "infiltration" && spec.front !== "west_bank" && world.metrics.securityThreat >= 60) {
    out.push({ id: `${id}:h`, kind: "burn", at: P[INFIL[spec.front][0].to], size: 0.9, step });
  } else if (spec.kind === "red_sea" && spec.mode === "attack") {
    out.push({ id: `${id}:ship`, kind: "wreck", at: [42.1, 15.6], size: 1, step });
  }
  return out;
}

export function drawScene(env: SceneEnv, spec: SceneSpec): void {
  const { f } = env;
  f.ctx.save();
  switch (spec.kind) {
    case "barrage": runBarrage(env, spec); break;
    case "airstrike": runAirstrike(env, spec); break;
    case "ground": runGround(env, spec); break;
    case "infiltration": runInfiltration(env, spec); break;
    case "terror": runTerror(env, spec); break;
    case "crowd": runCrowd(env, spec); break;
    case "flights": runFlights(env, spec); break;
    case "airlift": runAirlift(env, spec); break;
    case "trade": runTrade(env, spec); break;
    case "red_sea": runRedSea(env, spec); break;
    case "barrier": runBarrier(env, spec); break;
    case "withdrawal": runWithdrawal(env, spec); break;
    case "settlers": runSettlers(env, spec); break;
    case "siege": runSiege(env, spec); break;
    case "transfer": runTransfer(env); break;
    case "boats": runBoats(env); break;
    case "nuclear": runNuclear(env); break;
    case "diplomacy": runDiplomacy(env, spec); break;
    case "mobilize": runMobilize(env); break;
    case "ceasefire": runCeasefire(env); break;
    case "egypt_army": runEgyptArmy(env); break;
    case "iran_tels": runIranTels(env); break;
    case "economy": runEconomy(env, spec); break;
    case "knesset": runKnesset(env, spec); break;
    case "water": runWater(env, spec); break;
    case "pa_forces": runPaForces(env, spec); break;
    case "demolitions": runDemolitions(env); break;
  }
  f.ctx.restore();
}

// ---------------------------------------------------------------------------
// where the camera should look while a scene plays
// ---------------------------------------------------------------------------

function box2(points: LonLat[], pad: number, minSpan: number): [LonLat, LonLat] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hw = Math.max(minSpan / 2, (x1 - x0) / 2 + pad);
  const hh = Math.max(minSpan / 2, (y1 - y0) / 2 + pad);
  return [[cx - hw, cy - hh], [cx + hw, cy + hh]];
}

const around = (id: PlaceId, d: number): [LonLat, LonLat] => box2([L(id)], d, d * 2);
const WB: [LonLat, LonLat] = [[34.75, 31.3], [35.65, 32.6]];
const GAZA_VIEW: [LonLat, LonLat] = [[34.05, 31.05], [34.85, 31.75]];

export function sceneBounds(spec: SceneSpec): [LonLat, LonLat] {
  switch (spec.kind) {
    case "barrage": {
      const far = spec.front === "iran" || spec.front === "iraq" || spec.front === "yemen";
      return box2([...LAUNCH_SITES[spec.front].map(L), ...spec.targets.map(L)], far ? 1.5 : 0.12, far ? 8 : 0.9);
    }
    case "airstrike": {
      const s = STRIKE[spec.area];
      return s.route !== null ? box2(s.route, 1, 8) : box2([s.center, L(s.base)], 0.15, 0.9);
    }
    case "ground": return box2(AXES[spec.theater].axes.flat(), 0.12, 0.8);
    case "infiltration": return box2(INFIL[spec.front].flatMap((r) => [r.breach, L(r.to)]), 0.12, 0.7);
    case "terror": return around(spec.place, 0.4);
    case "crowd": return around(spec.place, 0.4);
    case "knesset": return spec.mode === "election" ? box2([L("tel_aviv"), L("haifa"), L("beersheba")], 0.2, 1.2) : around("knesset", 0.4);
    case "flights": return spec.mode === "riyadh" ? box2([L("ben_gurion"), L("riyadh")], 1.5, 6) : box2([L("ben_gurion"), [31.5, 33.5]], 0.4, 2);
    case "airlift": return spec.mode === "pact" ? box2([[22, 34.4], L("nevatim")], 1, 6) : spec.mode === "halt" ? [[-82, 30], [-45, 48]] : [[-82, 18], [40, 52]];
    case "trade": return [[30.5, 31.3], [35.6, 34]];
    case "red_sea": return spec.mode === "hodeidah" ? [[32, 12], [46, 32]] : spec.mode === "reroute" ? [[30, 11], [46, 34]] : [[41.2, 12.4], [44.2, 16.2]];
    case "barrier": case "withdrawal": case "settlers": case "demolitions": return WB;
    case "siege": case "boats": return GAZA_VIEW;
    case "transfer": return [[33.6, 30.8], [34.8, 31.7]];
    case "nuclear": return [[33.4, 30.6], [35.8, 32.4]];
    case "pa_forces": return spec.mode === "enter_gaza" ? GAZA_VIEW : WB;
    case "diplomacy": return box2(spec.links.flatMap((l) => [L(l.from), L(l.to)]), 2, 6);
    case "mobilize": return [[34.2, 30.9], [35.8, 33.3]];
    case "ceasefire": return [[34.1, 31.0], [35.9, 33.5]];
    case "egypt_army": return [[31.4, 29.5], [34.7, 31.6]];
    case "iran_tels": return box2([L("isfahan"), L("kermanshah"), L("tehran")], 0.6, 3);
    case "economy": return spec.mode === "factories" ? box2([[35.05, 32.8], [34.84, 31.3], [34.62, 31.52]], 0.15, 1) : [[34.35, 31.75], [35.55, 32.55]];
    case "water": return [[35.3, 31.7], [36.2, 32.95]];
  }
}
