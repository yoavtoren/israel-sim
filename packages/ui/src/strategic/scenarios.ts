/** Tactical playback scripts, derived deterministically from the strategic
 *  state: the Egyptian-retaliation crisis (with a per-option aftermath) and
 *  an ambient "operational picture" whose intensity follows securityThreat.
 *  Time unit = simulated seconds. Pure — tested in test/tactical.test.ts. */

import type { strategic } from "@engine";
import {
  BATTERIES, CITIES, EGYPT_BORDER, EGYPT_FORMATIONS, ORIGINS, SINAI_BUFFER,
  distanceKm, project,
  type BatteryId, type CityId, type FocusId, type LonLat, type OriginId, type Pt,
} from "./geo";

type Bi = strategic.Bi;

export type Faction = "egypt" | "gaza" | "iran" | "iraq" | "hezbollah" | "idf";
export type ProjectileKind = "ballistic" | "rocket" | "drone" | "airstrike";

/** Attack-vector colors (brief §4): red Egypt, green Gaza, orange Iran/Iraq, cyan/blue IDF. */
export const FACTION_COLORS: Record<Faction, string> = {
  egypt: "#F85149",
  gaza: "#3FB950",
  iran: "#F0883E",
  iraq: "#F0883E",
  hezbollah: "#E3B341",
  idf: "#58A6FF",
};
export const INTERCEPTOR_COLOR = "#56D4DD";

export const FACTION_NAMES: Record<Faction, Bi> = {
  egypt: { he: "מצרים", en: "Egypt" },
  gaza: { he: "עזה", en: "Gaza" },
  iran: { he: "איראן", en: "Iran" },
  iraq: { he: "מיליציות בעיראק", en: "Iraqi militias" },
  hezbollah: { he: "חזבאללה", en: "Hezbollah" },
  idf: { he: "צה\"ל", en: "IDF" },
};

export const KIND_NAMES: Record<ProjectileKind, Bi> = {
  ballistic: { he: "טיל בליסטי", en: "Ballistic missile" },
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
  /** real seconds per simulated second of flight (slow drones are time-compressed) */ compression: number;
}

export interface UnitMove {
  id: string;
  faction: Faction;
  label: Bi;
  from: LonLat;
  to: LonLat;
  t0: number;
  t1: number;
}

export type MarkerKind = "info" | "alert" | "mobilize" | "launch" | "intercept" | "impact" | "halt" | "strike" | "ceasefire";
export interface Marker {
  t: number;
  kind: MarkerKind;
  label: Bi;
}

export interface ZoneFx {
  id: string;
  kind: "border_alert" | "contested";
  path: LonLat[];
  t0: number;
  t1: number;
  color: string;
}

export interface FocusCue {
  t: number;
  focus: FocusId;
}

export interface TacticalScript {
  key: string;
  title: Bi;
  /** ISO timestamp of T+0 */ baseTime: string;
  duration: number;
  launches: Launch[];
  units: UnitMove[];
  markers: Marker[];
  zones: ZoneFx[];
  focus: FocusCue[];
  /** crisis scripts stop here until the cabinet decides */ haltAt: number | null;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function rngFrom(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LIFT: Record<ProjectileKind, number> = { ballistic: 0.38, rocket: 0.26, drone: 0.04, airstrike: 0.1 };

/** Cubic Bezier control points in map units — the arc is a top-down stylization of altitude. */
export function bezierControls(l: Pick<Launch, "from" | "to" | "kind">): [Pt, Pt, Pt, Pt] {
  const p0 = project(l.from);
  const p3 = project(l.to);
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const len = Math.hypot(dx, dy);
  const lift = len * LIFT[l.kind];
  // lift "up" on screen, leaning away from the chord so arcs don't collapse on N–S paths
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

export function bezierAt(c: [Pt, Pt, Pt, Pt], u: number): Pt {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const d = 3 * v * u * u;
  const e = u * u * u;
  return { x: a * c[0].x + b * c[1].x + d * c[2].x + e * c[3].x, y: a * c[0].y + b * c[1].y + d * c[2].y + e * c[3].y };
}

/** progress along the incoming path at sim time t (ballistic: slight terminal acceleration) */
export function progressAt(l: Launch, t: number): number {
  const raw = (t - l.t0) / l.flight;
  if (raw <= 0) return 0;
  if (raw >= 1) return 1;
  return l.kind === "ballistic" ? raw * (0.85 + 0.15 * raw) : raw;
}

/** time at which a launch reaches path fraction u (inverse of progressAt) */
function timeAtProgress(kind: ProjectileKind, t0: number, flight: number, u: number): number {
  if (kind !== "ballistic") return t0 + flight * u;
  // solve 0.15 r² + 0.85 r − u = 0
  const r = (-0.85 + Math.sqrt(0.85 * 0.85 + 4 * 0.15 * u)) / (2 * 0.15);
  return t0 + flight * r;
}

/** when the incoming stops: kill time, or impact */
export function endTime(l: Launch): number {
  return l.intercept !== null && l.intercept.success ? l.intercept.tHit : l.t0 + l.flight;
}

export function pathLengthKm(l: Launch): number {
  return distanceKm(l.from, l.to) * (l.kind === "ballistic" ? 1.25 : l.kind === "rocket" ? 1.12 : 1.02);
}

/** real-world speed, undoing any display time-compression */
export function speedKmS(l: Launch): number {
  return pathLengthKm(l) / (l.flight * l.compression);
}

/** nominal speeds; ballistic speed grows with range (SRBM ~1 km/s, MRBM ~2.5 km/s) */
function nominalSpeedKmS(kind: ProjectileKind, km: number): number {
  if (kind === "ballistic") return 0.9 + km / 1000;
  if (kind === "rocket") return 0.45;
  if (kind === "drone") return 0.05;
  return 0.25;
}
const COMPRESSION: Record<ProjectileKind, number> = { ballistic: 1, rocket: 1, drone: 12, airstrike: 1 };
const INTERCEPTOR_KMS: Record<BatteryId, number> = {
  arrow3: 2.6, davids_sling_haifa: 2.0, patriot_haifa: 1.4, iron_dome_gush_dan: 0.8, iron_dome_south: 0.8,
};

function jitter(p: LonLat, r: () => number, d: number): LonLat {
  return [p[0] + (r() - 0.5) * d, p[1] + (r() - 0.5) * d];
}

function batteryFor(kind: ProjectileKind, target: CityId, faction: Faction): BatteryId {
  if (kind === "ballistic") return faction === "egypt" && target !== "tel_aviv" ? "davids_sling_haifa" : "arrow3";
  if (kind === "drone") return target === "eilat" ? "arrow3" : "patriot_haifa";
  if (target === "haifa") return "davids_sling_haifa";
  if (target === "tel_aviv") return "iron_dome_gush_dan";
  return "iron_dome_south";
}

interface Salvo {
  faction: Faction;
  kind: ProjectileKind;
  origin: OriginId;
  targets: CityId[];
  count: number;
  tStart: number;
  spacing: number;
}

function buildSalvo(s: Salvo, r: () => number, idPrefix: string): Launch[] {
  const out: Launch[] = [];
  const o = ORIGINS[s.origin];
  for (let i = 0; i < s.count; i++) {
    const target = s.targets[i % s.targets.length];
    const city = CITIES[target];
    const from = jitter(o.pos, r, s.origin === "tehran" ? 1.2 : 0.25);
    const to = jitter(city.pos, r, 0.07);
    const km = distanceKm(from, to);
    const flight = Math.max(25, (km / nominalSpeedKmS(s.kind, km) / COMPRESSION[s.kind]) * (0.9 + r() * 0.2));
    const t0 = s.tStart + i * s.spacing + r() * s.spacing * 0.6;
    const battery = batteryFor(s.kind, target, s.faction);
    const b = BATTERIES[battery];
    const u = b.outer ? 0.62 + r() * 0.12 : 0.8 + r() * 0.12;
    const tHit = timeAtProgress(s.kind, t0, flight, u);
    const partial: Launch = {
      id: `${idPrefix}-${s.faction}-${i}`, kind: s.kind, faction: s.faction, originName: o.name, targetName: city.name,
      from, to, t0, flight, intercept: null, compression: COMPRESSION[s.kind],
    };
    const hitPoint = bezierAt(bezierControls(partial), u);
    const bp = project(b.pos);
    const interKm = (Math.hypot(hitPoint.x - bp.x, hitPoint.y - bp.y) / 100) * 111.2;
    const tLaunch = Math.max(t0 + 3, tHit - Math.max(6, interKm / INTERCEPTOR_KMS[battery]));
    partial.intercept = { battery, u, tLaunch, tHit, success: r() < b.pk };
    out.push(partial);
  }
  return out;
}

function strikes(targets: LonLat[], names: Bi[], tStart: number, r: () => number, prefix: string): Launch[] {
  const bases: LonLat[] = [[34.93, 31.21], [34.67, 31.23]]; // Nevatim, Hatzerim
  return targets.map((to, i) => {
    const from = bases[i % bases.length];
    return {
      id: `${prefix}-idf-${i}`, kind: "airstrike" as const, faction: "idf" as const,
      originName: { he: "חיל האוויר", en: "Israeli Air Force" }, targetName: names[i % names.length],
      from, to: jitter(to, r, 0.12), t0: tStart + i * 9 + r() * 5, flight: distanceKm(from, to) / nominalSpeedKmS("airstrike", 0), intercept: null, compression: 1,
    };
  });
}

function launchMarkers(ls: Launch[]): Marker[] {
  const out: Marker[] = [];
  const firstBy = new Map<Faction, Launch>();
  for (const l of ls) {
    const f = firstBy.get(l.faction);
    if (f === undefined || l.t0 < f.t0) firstBy.set(l.faction, l);
  }
  for (const l of firstBy.values()) {
    out.push({
      t: l.t0,
      kind: l.faction === "idf" ? "strike" : "launch",
      label: l.faction === "idf"
        ? { he: "גיחות תקיפה של חיל האוויר", en: "Israeli Air Force strike sorties" }
        : { he: `שיגור: ${FACTION_NAMES[l.faction].he} → ${l.targetName.he}`, en: `Launch: ${FACTION_NAMES[l.faction].en} → ${l.targetName.en}` },
    });
  }
  const hits = ls.filter((l) => l.intercept !== null && l.intercept.success).sort((a, b) => endTime(a) - endTime(b));
  if (hits.length > 0) out.push({ t: endTime(hits[0]), kind: "intercept", label: { he: "יירוט ראשון", en: "First interception" } });
  const impacts = ls.filter((l) => l.faction !== "idf" && (l.intercept === null || !l.intercept.success)).sort((a, b) => endTime(a) - endTime(b));
  if (impacts.length > 0) out.push({ t: endTime(impacts[0]), kind: "impact", label: { he: `פגיעה: ${impacts[0].targetName.he}`, en: `Impact: ${impacts[0].targetName.en}` } });
  return out;
}

export function baseTimeFor(turn: number): string {
  const year = 2027 + Math.floor((turn - 1) / 2);
  const month = (turn - 1) % 2 === 0 ? 2 : 8;
  return new Date(Date.UTC(year, month - 1, 14, 3, 40, 0)).toISOString(); // 05:40 local (UTC+2)
}

function finalize(s: Omit<TacticalScript, "duration" | "markers"> & { markers: Marker[]; minDuration: number }): TacticalScript {
  const lastLaunch = s.launches.reduce((m, l) => Math.max(m, l.t0 + l.flight), 0);
  const lastUnit = s.units.reduce((m, u) => Math.max(m, u.t1), 0);
  const duration = Math.ceil(Math.max(s.minDuration, lastLaunch + 25, lastUnit + 10));
  const { minDuration: _unused, ...rest } = s;
  void _unused;
  return { ...rest, duration, markers: [...s.markers].sort((a, b) => a.t - b.t) };
}

// ---------------------------------------------------------------------------
// crisis: forced-transfer directive → Egyptian retaliation
// ---------------------------------------------------------------------------

const FIRST_WAVE_START = 170;

export function buildCrisisScript(sim: strategic.SimulationState, option: strategic.CrisisOptionId | null): TacticalScript {
  const key = `crisis:${sim.turn}:${sim.rngState}`;
  const r = rngFrom(key);
  const launches: Launch[] = [
    ...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai", targets: ["tel_aviv", "tel_aviv", "ashdod", "tel_aviv", "dimona"], count: 9, tStart: FIRST_WAVE_START, spacing: 7 }, r, "w1"),
    ...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashdod", "beersheba", "tel_aviv"], count: 6, tStart: FIRST_WAVE_START + 40, spacing: 9 }, r, "w1"),
  ];
  const wave1End = launches.reduce((m, l) => Math.max(m, endTime(l)), 0);
  const haltAt = Math.ceil(wave1End + 12);

  const units: UnitMove[] = EGYPT_FORMATIONS.map((f, i) => ({
    id: f.id, faction: "egypt", label: f.label, from: f.from, to: f.to, t0: 25 + i * 15, t1: 150 + i * 15,
  }));
  const zones: ZoneFx[] = [{ id: "egypt-border", kind: "border_alert", path: EGYPT_BORDER, t0: 12, t1: haltAt + 400, color: FACTION_COLORS.egypt }];
  const markers: Marker[] = [
    { t: 0, kind: "info", label: { he: "הנחיית טרנספר נכנסת לתוקף", en: "Transfer directive takes effect" } },
    { t: 12, kind: "alert", label: { he: "התראות גבול בחזית מצרים", en: "Border alerts on the Egyptian front" } },
    { t: 25, kind: "mobilize", label: { he: "ארמיות 2 ו-3 נערכות לאורך התעלה", en: "2nd & 3rd Armies deploy along the canal" } },
    ...launchMarkers(launches),
    { t: haltAt, kind: "halt", label: { he: "הקבינט מתכנס — נדרשת הכרעה", en: "Cabinet convenes — decision required" } },
  ];
  const focus: FocusCue[] = [
    { t: 0, focus: "israel" },
    { t: FIRST_WAVE_START + 60, focus: "tel_aviv" },
  ];

  if (option !== null) {
    const a = haltAt;
    const r2 = rngFrom(`${key}:${option}`);
    const retreat = (t0: number): UnitMove[] =>
      EGYPT_FORMATIONS.map((f, i) => ({ id: `${f.id}-back`, faction: "egypt", label: f.label, from: f.to, to: f.from, t0: t0 + i * 10, t1: t0 + 140 + i * 10 }));
    zones[0] = { ...zones[0], t1: option === "A_CANCEL_TRANSFER" || option === "D_US_MEDIATION" ? a + 120 : a + 2000 };

    if (option === "A_CANCEL_TRANSFER") {
      markers.push({ t: a + 8, kind: "ceasefire", label: { he: "הטרנספר בוטל — האש המצרית נפסקת", en: "Transfer cancelled — Egyptian fire stops" } });
      units.push(...retreat(a + 40));
      focus.push({ t: a + 30, focus: "israel" });
    }
    if (option === "D_US_MEDIATION") {
      launches.push(...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai", targets: ["tel_aviv"], count: 2, tStart: a + 4, spacing: 6 }, r2, "d"));
      markers.push({ t: a + 20, kind: "info", label: { he: "שליח אמריקאי בדרך לקהיר", en: "US envoy en route to Cairo" } });
      markers.push({ t: a + 150, kind: "ceasefire", label: { he: "הפסקת אש בתיווך ארה\"ב", en: "US-brokered ceasefire" } });
      units.push(...retreat(a + 170));
      focus.push({ t: a + 140, focus: "israel" });
    }
    if (option === "B_AIR_RETALIATION") {
      const targets: LonLat[] = [ORIGINS.sinai.pos, ORIGINS.sinai_south.pos, ...EGYPT_FORMATIONS.map((f) => f.to)];
      const names: Bi[] = [ORIGINS.sinai.name, ORIGINS.sinai_south.name, ...EGYPT_FORMATIONS.map((f) => f.label)];
      launches.push(...strikes([...targets, ...targets], names, a + 15, r2, "b"));
      launches.push(...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai_south", targets: ["tel_aviv", "haifa", "dimona", "tel_aviv"], count: 12, tStart: a + 110, spacing: 6 }, r2, "b2"));
      launches.push(...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "dimona", "haifa"], count: 6, tStart: a + 60, spacing: 8 }, r2, "b3"));
      launches.push(...buildSalvo({ faction: "hezbollah", kind: "rocket", origin: "south_lebanon", targets: ["haifa"], count: 10, tStart: a + 90, spacing: 5 }, r2, "b4"));
      markers.push({ t: a + 5, kind: "info", label: { he: "מצרי טיראן ותעלת סואץ נסגרים לשיט ישראלי", en: "Tiran Straits and Suez closed to Israeli shipping" } });
      focus.push({ t: a + 10, focus: "israel" }, { t: a + 200, focus: "theater" }, { t: a + 560, focus: "israel" });
    }
    if (option === "C_GROUND_INVASION_SINAI") {
      units.push(
        { id: "idf-armor-1", faction: "idf", label: { he: "אוגדה משוריינת", en: "Armored division" }, from: [34.35, 31.26], to: [33.95, 31.1], t0: a + 15, t1: a + 320 },
        { id: "idf-armor-2", faction: "idf", label: { he: "חטיבת שריון", en: "Armored brigade" }, from: [34.45, 30.9], to: [34.05, 30.72], t0: a + 30, t1: a + 340 },
        ...EGYPT_FORMATIONS.map((f, i) => ({
          id: `${f.id}-cross`, faction: "egypt" as const, label: f.label, from: f.to, to: [f.to[0] + 0.9, f.to[1] + 0.05] as LonLat, t0: a + 40 + i * 12, t1: a + 330 + i * 12,
        })),
      );
      zones.push({ id: "sinai-buffer", kind: "contested", path: SINAI_BUFFER, t0: a + 60, t1: a + 2000, color: FACTION_COLORS.egypt });
      launches.push(...strikes([[33.2, 30.9], [32.9, 30.5], ORIGINS.sinai.pos], [{ he: "ארמיה 2", en: "2nd Army" }, { he: "ארמיה 3", en: "3rd Army" }, ORIGINS.sinai.name], a + 20, r2, "c"));
      launches.push(...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai_south", targets: ["tel_aviv", "beersheba", "dimona", "eilat"], count: 14, tStart: a + 90, spacing: 5 }, r2, "c2"));
      launches.push(...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "haifa"], count: 8, tStart: a + 40, spacing: 7 }, r2, "c3"));
      launches.push(...buildSalvo({ faction: "iraq", kind: "drone", origin: "western_iraq", targets: ["eilat", "haifa"], count: 6, tStart: a + 30, spacing: 12 }, r2, "c4"));
      markers.push({ t: a + 15, kind: "mobilize", label: { he: "כוחות צה\"ל חוצים לרפיח ולסיני", en: "IDF forces cross into Rafah and Sinai" } });
      focus.push({ t: a + 10, focus: "israel" }, { t: a + 260, focus: "theater" }, { t: a + 620, focus: "israel" });
    }
    markers.push(...launchMarkers(launches.filter((l) => l.t0 > a)));
  }

  return finalize({
    key: option === null ? key : `${key}:${option}`,
    title: { he: "מתקפה בליסטית מצרית בעקבות הנחיית הטרנספר", en: "Egyptian ballistic attack after the transfer directive" },
    baseTime: baseTimeFor(sim.turn),
    launches, units, zones, focus, markers, haltAt: option === null ? haltAt : null,
    minDuration: option === null ? haltAt + 1 : haltAt + 260,
  });
}

// ---------------------------------------------------------------------------
// ambient operational picture for a normal turn
// ---------------------------------------------------------------------------

/** The picture for the turn just decided (`sim.turn - 1`), from its threat level. */
export function buildTurnScript(sim: strategic.SimulationState): TacticalScript {
  const turn = Math.max(1, sim.turns.length > 0 ? sim.turns[sim.turns.length - 1].turn : sim.turn);
  const threat = sim.metrics.securityThreat;
  const key = `turn:${turn}:${sim.rngState}:${Math.round(threat)}`;
  const r = rngFrom(key);
  const launches: Launch[] = [];
  const markers: Marker[] = [];
  if (threat >= 35) {
    launches.push(...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashdod", "beersheba", "tel_aviv"], count: Math.round((threat - 30) / 5), tStart: 20, spacing: 10 }, r, "g"));
  }
  if (threat >= 55) {
    launches.push(...buildSalvo({ faction: "hezbollah", kind: "rocket", origin: "south_lebanon", targets: ["haifa"], count: Math.round((threat - 50) / 6), tStart: 60, spacing: 8 }, r, "h"));
  }
  if (threat >= 70) {
    launches.push(...buildSalvo({ faction: "iraq", kind: "drone", origin: "western_iraq", targets: ["eilat", "haifa"], count: 2 + Math.round((threat - 70) / 8), tStart: 10, spacing: 25 }, r, "q"));
  }
  if (threat >= 85) {
    launches.push(...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "dimona", "haifa"], count: 4 + Math.round((threat - 85) / 3), tStart: 40, spacing: 10 }, r, "i"));
  }
  if (launches.length === 0) {
    markers.push({ t: 5, kind: "info", label: { he: "גזרות שקטות — פעילות סיכול שגרתית", en: "Sectors quiet — routine counter-terror activity" } });
  } else {
    markers.push({ t: 2, kind: "alert", label: { he: `רמת איום ${Math.round(threat)} — ירי לעבר ישראל`, en: `Threat level ${Math.round(threat)} — fire toward Israel` } });
    markers.push(...launchMarkers(launches));
  }
  const theater = launches.some((l) => l.faction === "iran" || l.faction === "iraq");
  return finalize({
    key,
    title: { he: "תמונת מצב מבצעית", en: "Operational picture" },
    baseTime: baseTimeFor(turn),
    launches, units: [], zones: [], markers,
    focus: [{ t: 0, focus: theater ? "theater" : "israel" }, ...(theater ? [{ t: 380, focus: "israel" as const }] : [])],
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
