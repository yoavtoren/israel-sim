/** Tactical playback scripts, derived deterministically from the strategic
 *  state. Time unit = simulated seconds. Pure — tested in test/tactical.test.ts.
 *
 *  This module holds the script model and the building blocks (salvos, drone
 *  swarms, air strikes, standing order of battle) plus the ambient
 *  operational picture; per-crisis scenes live in crisisScripts.ts. */

import type { strategic } from "@engine";
import {
  BASES, BATTERIES, CITIES, ORIGINS, distanceKm, project,
  type BatteryId, type CityId, type FocusId, type LonLat, type OriginId, type Pt,
} from "./geo";

type Bi = strategic.Bi;

export type Faction =
  | "egypt" | "gaza" | "iran" | "iraq" | "hezbollah" | "pa" | "militants"
  | "idf" | "us" | "coalition"
  | "mfo" | "regional";

export type Affiliation = "friend" | "hostile" | "neutral";

export const AFFILIATION: Record<Faction, Affiliation> = {
  egypt: "hostile", gaza: "hostile", iran: "hostile", iraq: "hostile", hezbollah: "hostile", pa: "hostile", militants: "hostile",
  idf: "friend", us: "friend", coalition: "friend",
  mfo: "neutral", regional: "neutral",
};

/** Attack-vector colors: red Egypt, green Gaza, orange Iran/Iraq, cyan/blue IDF & partners. */
export const FACTION_COLORS: Record<Faction, string> = {
  egypt: "#F85149",
  gaza: "#3FB950",
  iran: "#F0883E",
  iraq: "#F0883E",
  hezbollah: "#E3B341",
  pa: "#D2A8FF",
  militants: "#FF7B72",
  idf: "#58A6FF",
  us: "#79C0FF",
  coalition: "#A5D6FF",
  mfo: "#7EE787",
  regional: "#AFF5B4",
};
export const INTERCEPTOR_COLOR = "#56D4DD";

export const FACTION_NAMES: Record<Faction, Bi> = {
  egypt: { he: "מצרים", en: "Egypt" },
  gaza: { he: "עזה", en: "Gaza" },
  iran: { he: "איראן", en: "Iran" },
  iraq: { he: "מיליציות בעיראק", en: "Iraqi militias" },
  hezbollah: { he: "חזבאללה", en: "Hezbollah" },
  pa: { he: "מנגנוני הרש\"פ (עריקים)", en: "PA services (defected)" },
  militants: { he: "חמושים", en: "Militants" },
  idf: { he: "צה\"ל", en: "IDF" },
  us: { he: "ארה\"ב", en: "United States" },
  coalition: { he: "קואליציה אזורית", en: "Regional coalition" },
  mfo: { he: "כוח המשקיפים (MFO)", en: "MFO observers" },
  regional: { he: "כוח שיטור אזורי", en: "Regional policing force" },
};

export type ProjectileKind = "ballistic" | "cruise" | "rocket" | "drone" | "airstrike";

export const KIND_NAMES: Record<ProjectileKind, Bi> = {
  ballistic: { he: "טיל בליסטי", en: "Ballistic missile" },
  cruise: { he: "טיל שיוט", en: "Cruise missile" },
  rocket: { he: "רקטה", en: "Rocket" },
  drone: { he: "כטב\"ם", en: "Drone" },
  airstrike: { he: "תקיפה אווירית", en: "Air strike" },
};

export interface Intercept {
  battery: BatteryId;
  /** fraction of the incoming path at the kill */ u: number;
  tLaunch: number;
  tHit: number;
  success: boolean;
}

export interface Weave {
  /** lateral amplitude, map units */ amp: number;
  /** oscillations over the whole path */ freq: number;
  phase: number;
}

export interface Launch {
  id: string;
  kind: ProjectileKind;
  faction: Faction;
  originName: Bi;
  targetName: Bi;
  from: LonLat;
  to: LonLat;
  t0: number;
  flight: number;
  /** null = no engagement (e.g. IDF strikes) */ intercept: Intercept | null;
  /** real seconds per simulated second of flight (slow threats are time-compressed) */ compression: number;
  /** terrain-contouring (cruise) or swarm weave (drones) */ weave: Weave | null;
  /** swarm id for drones launched together */ swarm: string | null;
}

export type UnitType = "armor" | "mech" | "infantry" | "sof" | "engineer" | "supply" | "police" | "monitor" | "air" | "naval" | "carrier";
export type Echelon = "XXX" | "XX" | "X" | "III" | "II" | "";

export interface UnitMove {
  id: string;
  faction: Faction;
  type: UnitType;
  echelon: Echelon;
  label: Bi;
  from: LonLat;
  to: LonLat;
  t0: number;
  t1: number;
  /** hidden from this time on (superseded by a follow-on move) */ until: number;
}

export type MarkerKind =
  | "info" | "crisis" | "alert" | "mobilize" | "launch" | "intercept" | "impact" | "halt" | "strike" | "ceasefire" | "success" | "failure";
export interface Marker {
  t: number;
  kind: MarkerKind;
  label: Bi;
}

export type ZoneKind = "border_alert" | "contested" | "tunnels" | "treaty_line" | "barrier";
export interface ZoneFx {
  id: string;
  kind: ZoneKind;
  path: LonLat[];
  t0: number;
  t1: number;
  color: string;
  label: Bi | null;
}

/** Ground detonations that are not the end of a flight (demolitions, raids). */
export interface Blast {
  id: string;
  pos: LonLat;
  t: number;
  heavy: boolean;
}

export interface FocusCue {
  t: number;
  focus: FocusId;
}

export interface TacticalScript {
  key: string;
  title: Bi;
  crisisId: strategic.CrisisId | null;
  /** ISO timestamp of T+0 */ baseTime: string;
  duration: number;
  launches: Launch[];
  units: UnitMove[];
  markers: Marker[];
  zones: ZoneFx[];
  blasts: Blast[];
  focus: FocusCue[];
  /** crisis scripts stop here until the cabinet decides */ haltAt: number | null;
}

// ---------------------------------------------------------------------------
// randomness + geometry
// ---------------------------------------------------------------------------

export function rngFrom(key: string): () => number {
  let s = hashString(key);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless hash noise in [0,1) — procedural FX stay consistent under scrubbing. */
export function hash01(a: number, b = 0): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LIFT: Record<ProjectileKind, number> = { ballistic: 0.42, cruise: 0.04, rocket: 0.26, drone: 0.03, airstrike: 0.08 };

export type Ctrl = [Pt, Pt, Pt, Pt];

/** Cubic Bezier control points in map units — the arc is a top-down stylization of altitude. */
export function bezierControls(l: Pick<Launch, "from" | "to" | "kind">): Ctrl {
  const p0 = project(l.from);
  const p3 = project(l.to);
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const len = Math.hypot(dx, dy);
  const lift = len * LIFT[l.kind];
  const nx = -dy / (len || 1);
  const ny = dx / (len || 1);
  const ux = nx * 0.35 * lift;
  const uy = -lift + ny * 0.35 * lift * Math.sign(ny || 1);
  return [
    p0,
    { x: p0.x + dx * 0.25 + ux, y: p0.y + dy * 0.25 + uy },
    { x: p0.x + dx * 0.75 + ux, y: p0.y + dy * 0.75 + uy },
    p3,
  ];
}

export function bezierAt(c: Ctrl, u: number): Pt {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const d = 3 * v * u * u;
  const e = u * u * u;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

/** Point along a launch's path, including cruise terrain-contouring / swarm weave. */
export function pathPoint(l: Pick<Launch, "weave">, c: Ctrl, u: number): Pt {
  const p = bezierAt(c, u);
  if (l.weave === null) return p;
  const dx = c[3].x - c[0].x;
  const dy = c[3].y - c[0].y;
  const len = Math.hypot(dx, dy) || 1;
  const off = l.weave.amp * Math.sin(u * l.weave.freq * Math.PI * 2 + l.weave.phase) * Math.sin(Math.PI * u);
  return { x: p.x + (-dy / len) * off, y: p.y + (dx / len) * off };
}

/** Speed profile: ballistic missiles loft slowly and accelerate hard in the terminal phase. */
function profile(kind: ProjectileKind, r: number): number {
  if (kind === "ballistic") return 0.55 * r + 0.45 * r * r * r;
  if (kind === "rocket") return 0.8 * r + 0.2 * r * r;
  return r;
}

/** progress along the path (0–1) at sim time t */
export function progressAt(l: Pick<Launch, "t0" | "flight" | "kind">, t: number): number {
  const raw = (t - l.t0) / l.flight;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return profile(l.kind, raw);
}

/** time at which a launch reaches path fraction u (bisection — profiles are monotone) */
export function timeAtProgress(kind: ProjectileKind, t0: number, flight: number, u: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (profile(kind, mid) < u) lo = mid;
    else hi = mid;
  }
  return t0 + flight * ((lo + hi) / 2);
}

/** when the incoming stops: kill time, or impact */
export function endTime(l: Launch): number {
  return l.intercept !== null && l.intercept.success ? l.intercept.tHit : l.t0 + l.flight;
}

export function pathLengthKm(l: Launch): number {
  return distanceKm(l.from, l.to) * (l.kind === "ballistic" ? 1.25 : l.kind === "rocket" ? 1.12 : 1.03);
}

/** real-world speed, undoing display time-compression */
export function speedKmS(l: Launch): number {
  return pathLengthKm(l) / (l.flight * l.compression);
}

/** nominal speeds; ballistic speed grows with range (SRBM ~1 km/s, MRBM ~2.5 km/s) */
function nominalSpeedKmS(kind: ProjectileKind, km: number): number {
  if (kind === "ballistic") return 0.9 + km / 1000;
  if (kind === "rocket") return 0.45;
  if (kind === "cruise") return 0.24;
  if (kind === "drone") return 0.05;
  return 0.25;
}

function compressionFor(kind: ProjectileKind, km: number): number {
  if (kind === "drone") return km > 400 ? 20 : 8;
  if (kind === "cruise") return km > 400 ? 6 : 2;
  if (kind === "airstrike") return km > 400 ? 10 : 1;
  return 1;
}

const INTERCEPTOR_KMS: Record<BatteryId, number> = {
  arrow3: 2.6, davids_sling_haifa: 2.0, patriot_haifa: 1.4, iron_dome_gush_dan: 0.8, iron_dome_south: 0.8, coalition_cap: 0.6,
};

export function jitter(p: LonLat, r: () => number, d: number): LonLat {
  return [p[0] + (r() - 0.5) * d, p[1] + (r() - 0.5) * d];
}

function batteryFor(kind: ProjectileKind, target: CityId, faction: Faction): BatteryId {
  if (kind === "ballistic") return faction === "egypt" && target !== "tel_aviv" ? "davids_sling_haifa" : "arrow3";
  if (kind === "drone") return target === "eilat" ? "arrow3" : "patriot_haifa";
  if (kind === "cruise") return target === "haifa" ? "patriot_haifa" : "davids_sling_haifa";
  if (target === "haifa" || target === "afula") return "davids_sling_haifa";
  if (target === "tel_aviv" || target === "netanya") return "iron_dome_gush_dan";
  return "iron_dome_south";
}

// ---------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------

export interface Salvo {
  faction: Faction;
  kind: ProjectileKind;
  origin: OriginId;
  targets: CityId[];
  count: number;
  tStart: number;
  spacing: number;
  /** override the defending battery */ battery?: BatteryId;
  /** kill point range along the path */ killU?: [number, number];
  /** launch-site scatter in degrees */ scatter?: number;
}

export function buildSalvo(s: Salvo, r: () => number, idPrefix: string): Launch[] {
  const out: Launch[] = [];
  const o = ORIGINS[s.origin];
  const swarm = s.kind === "drone" ? `${idPrefix}-swarm` : null;
  const swarmPhase = r() * Math.PI * 2;
  for (let i = 0; i < s.count; i++) {
    const target = s.targets[i % s.targets.length];
    const city = CITIES[target];
    const far = s.origin === "tehran" || s.origin === "isfahan" || s.origin === "tabriz";
    const scatter = s.scatter ?? (far ? 1.2 : s.kind === "drone" ? 0.12 : 0.25);
    const from = jitter(o.pos, r, scatter);
    const to = jitter(city.pos, r, s.kind === "drone" ? 0.05 : 0.07);
    const km = distanceKm(from, to);
    const compression = compressionFor(s.kind, km);
    const flight = Math.max(25, (km / nominalSpeedKmS(s.kind, km) / compression) * (s.kind === "drone" ? 0.97 + r() * 0.06 : 0.9 + r() * 0.2));
    const t0 = s.kind === "drone" ? s.tStart + i * s.spacing * 0.25 : s.tStart + i * s.spacing + r() * s.spacing * 0.6;
    const battery = s.battery ?? batteryFor(s.kind, target, s.faction);
    const b = BATTERIES[battery];
    const [k0, k1] = s.killU ?? (b.outer ? [0.6, 0.72] : b.airborne === true ? [0.4, 0.55] : [0.8, 0.92]);
    const u = k0 + r() * (k1 - k0);
    const partial: Launch = {
      id: `${idPrefix}-${s.faction}-${i}`, kind: s.kind, faction: s.faction, originName: o.name, targetName: city.name,
      from, to, t0, flight, intercept: null, compression,
      weave: s.kind === "cruise"
        ? { amp: 4 + r() * 5, freq: 3 + r() * 4, phase: r() * 6.28 }
        : s.kind === "drone"
          ? { amp: 5 + (i % 4) * 2.5, freq: 2.5, phase: swarmPhase + i * 0.7 }
          : null,
      swarm,
    };
    const hitPoint = pathPoint(partial, bezierControls(partial), u);
    const bp = project(b.pos);
    const interKm = (Math.hypot(hitPoint.x - bp.x, hitPoint.y - bp.y) / 100) * 111.2;
    const tHit = timeAtProgress(s.kind, t0, flight, u);
    const tLaunch = Math.max(t0 + 3, tHit - Math.max(6, interKm / INTERCEPTOR_KMS[battery] / compression));
    partial.intercept = { battery, u, tLaunch, tHit, success: r() < b.pk };
    out.push(partial);
  }
  return out;
}

export function strikes(targets: LonLat[], names: Bi[], tStart: number, r: () => number, prefix: string, from?: LonLat[], faction: Faction = "idf"): Launch[] {
  const bases: LonLat[] = from ?? [BASES.nevatim, BASES.hatzerim, BASES.ramat_david];
  return targets.map((to, i) => {
    const origin = bases[i % bases.length];
    const target = jitter(to, r, 0.1);
    const km = distanceKm(origin, target);
    const compression = compressionFor("airstrike", km);
    return {
      id: `${prefix}-${faction}-${i}`, kind: "airstrike" as const, faction,
      originName: faction === "idf" ? { he: "חיל האוויר", en: "Israeli Air Force" } : FACTION_NAMES[faction], targetName: names[i % names.length],
      from: origin, to: target, t0: tStart + i * 9 + r() * 5, flight: km / nominalSpeedKmS("airstrike", km) / compression,
      intercept: null, compression, weave: null, swarm: null,
    };
  });
}

export function unit(
  id: string, faction: Faction, type: UnitType, echelon: Echelon, label: Bi,
  from: LonLat, to: LonLat = from, t0 = 0, t1 = t0,
): UnitMove {
  return { id, faction, type, echelon, label, from, to, t0, t1, until: Infinity };
}

/** Standing order of battle shown in every script: IAF wings, navy, US forces. */
export function standingForces(): UnitMove[] {
  return [
    unit("iaf-28", "idf", "air", "", { he: "כנף 28 · נבטים", en: "Wing 28 · Nevatim" }, BASES.nevatim),
    unit("iaf-8", "idf", "air", "", { he: "כנף 8 · חצרים", en: "Wing 8 · Hatzerim" }, BASES.hatzerim),
    unit("iaf-1", "idf", "air", "", { he: "כנף 1 · רמת דוד", en: "Wing 1 · Ramat David" }, BASES.ramat_david),
    unit("navy-haifa", "idf", "naval", "", { he: "שייטת 3 · סער 6", en: "Flotilla 3 · Sa'ar 6" }, BASES.haifa_naval),
    unit("navy-ashdod", "idf", "naval", "", { he: "סער 5 · אשדוד", en: "Sa'ar 5 · Ashdod" }, BASES.ashdod_naval),
    unit("navy-eilat", "idf", "naval", "", { he: "ספינת סטי\"ל · אילת", en: "Missile boat · Eilat" }, BASES.eilat_naval),
    unit("us-csg", "us", "carrier", "", { he: "קבוצת נושאת מטוסים · מזרח הים התיכון", en: "Carrier strike group · East Med" }, BASES.us_csg_med),
    unit("us-ddg", "us", "naval", "", { he: "משחתת אמריקאית · ים סוף", en: "US destroyer · Red Sea" }, BASES.us_ddg_red_sea),
  ];
}

export function launchMarkers(ls: Launch[]): Marker[] {
  const out: Marker[] = [];
  const firstBy = new Map<string, Launch>();
  for (const l of ls) {
    const key = `${l.faction}:${l.kind}`;
    const f = firstBy.get(key);
    if (f === undefined || l.t0 < f.t0) firstBy.set(key, l);
  }
  for (const l of firstBy.values()) {
    const friendly = AFFILIATION[l.faction] === "friend";
    out.push({
      t: l.t0,
      kind: friendly ? "strike" : "launch",
      label: friendly
        ? { he: `גיחות תקיפה → ${l.targetName.he}`, en: `Strike sorties → ${l.targetName.en}` }
        : { he: `שיגור ${KIND_NAMES[l.kind].he}: ${FACTION_NAMES[l.faction].he} → ${l.targetName.he}`, en: `${KIND_NAMES[l.kind].en} launch: ${FACTION_NAMES[l.faction].en} → ${l.targetName.en}` },
    });
  }
  const hits = ls.filter((l) => l.intercept !== null && l.intercept.success).sort((a, b) => endTime(a) - endTime(b));
  if (hits.length > 0) out.push({ t: endTime(hits[0]), kind: "intercept", label: { he: "יירוט ראשון", en: "First interception" } });
  const impacts = ls.filter((l) => AFFILIATION[l.faction] !== "friend" && (l.intercept === null || !l.intercept.success)).sort((a, b) => endTime(a) - endTime(b));
  if (impacts.length > 0) out.push({ t: endTime(impacts[0]), kind: "impact", label: { he: `פגיעה: ${impacts[0].targetName.he}`, en: `Impact: ${impacts[0].targetName.en}` } });
  return out;
}

export function baseTimeFor(turn: number): string {
  const year = 2027 + Math.floor((turn - 1) / 2);
  const month = (turn - 1) % 2 === 0 ? 2 : 8;
  return new Date(Date.UTC(year, month - 1, 14, 3, 40, 0)).toISOString(); // 05:40 local (UTC+2)
}

export interface ScriptDraft {
  key: string;
  title: Bi;
  crisisId: strategic.CrisisId | null;
  baseTime: string;
  launches: Launch[];
  units: UnitMove[];
  markers: Marker[];
  zones: ZoneFx[];
  blasts: Blast[];
  focus: FocusCue[];
  haltAt: number | null;
  minDuration: number;
}

export function finalize(s: ScriptDraft): TacticalScript {
  const lastLaunch = s.launches.reduce((m, l) => Math.max(m, l.t0 + l.flight), 0);
  const lastUnit = s.units.reduce((m, u) => Math.max(m, u.t1), 0);
  const lastBlast = s.blasts.reduce((m, b) => Math.max(m, b.t), 0);
  const duration = Math.ceil(Math.max(s.minDuration, lastLaunch + 30, lastUnit + 10, lastBlast + 30));
  return {
    key: s.key, title: s.title, crisisId: s.crisisId, baseTime: s.baseTime, duration,
    launches: s.launches, units: s.units, zones: s.zones, blasts: s.blasts,
    focus: [...s.focus].sort((a, b) => a.t - b.t),
    markers: [...s.markers].sort((a, b) => a.t - b.t),
    haltAt: s.haltAt,
  };
}

// ---------------------------------------------------------------------------
// ambient operational picture for a normal turn
// ---------------------------------------------------------------------------

/** The picture for the turn just decided, from its threat level. */
export function buildTurnScript(sim: strategic.SimulationState): TacticalScript {
  const turn = Math.max(1, sim.turns.length > 0 ? sim.turns[sim.turns.length - 1].turn : sim.turn);
  const threat = sim.metrics.securityThreat;
  const key = `turn:${turn}:${sim.rngState}:${Math.round(threat)}`;
  const r = rngFrom(key);
  const launches: Launch[] = [];
  const markers: Marker[] = [];
  if (threat >= 35) {
    launches.push(...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashkelon", "ashdod", "beersheba", "tel_aviv"], count: Math.round((threat - 30) / 5), tStart: 20, spacing: 10 }, r, "g"));
  }
  if (threat >= 55) {
    launches.push(...buildSalvo({ faction: "hezbollah", kind: "rocket", origin: "south_lebanon", targets: ["haifa", "afula"], count: Math.round((threat - 50) / 6), tStart: 60, spacing: 8 }, r, "h"));
  }
  if (threat >= 70) {
    launches.push(...buildSalvo({ faction: "iraq", kind: "drone", origin: "western_iraq", targets: ["eilat", "haifa"], count: 3 + Math.round((threat - 70) / 6), tStart: 10, spacing: 8, battery: "coalition_cap" }, r, "q"));
  }
  if (threat >= 85) {
    launches.push(...buildSalvo({ faction: "iran", kind: "cruise", origin: "kermanshah", targets: ["haifa", "tel_aviv"], count: 3, tStart: 20, spacing: 15 }, r, "c"));
    launches.push(...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "dimona", "haifa"], count: 4 + Math.round((threat - 85) / 3), tStart: 240, spacing: 10 }, r, "i"));
  }
  if (launches.length === 0) {
    markers.push({ t: 5, kind: "info", label: { he: "גזרות שקטות — פעילות סיכול שגרתית", en: "Sectors quiet — routine counter-terror activity" } });
  } else {
    markers.push({ t: 2, kind: "alert", label: { he: `רמת איום ${Math.round(threat)} — ירי לעבר ישראל`, en: `Threat level ${Math.round(threat)} — fire toward Israel` } });
    markers.push(...launchMarkers(launches));
  }
  const theater = launches.some((l) => l.faction === "iran" || l.faction === "iraq");
  const ballisticEnd = launches.filter((l) => l.kind === "ballistic").reduce((m, l) => Math.max(m, endTime(l)), 0);
  return finalize({
    key,
    title: { he: "תמונת מצב מבצעית", en: "Operational picture" },
    crisisId: null,
    baseTime: baseTimeFor(turn),
    launches, units: standingForces(), zones: [], blasts: [], markers,
    focus: [{ t: 0, focus: theater ? "theater" : "israel" }, ...(theater ? [{ t: Math.max(300, ballisticEnd - 120), focus: "israel" as const }] : [])],
    haltAt: null,
    minDuration: 180,
  });
}

/** The camera focus in force at time t. */
export function focusAt(script: TacticalScript, t: number): FocusId {
  let f: FocusId = script.focus[0]?.focus ?? "israel";
  for (const c of script.focus) if (c.t <= t) f = c.focus;
  return f;
}
