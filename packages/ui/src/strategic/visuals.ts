/** Campaign visuals → tactical scripts, drawn over the world map by the same
 *  Canvas renderer as the tactical screen. Deterministic per key. */

import { strategic } from "@engine";
import { ORIGINS, boxAround, type LonLat, type OriginId } from "./geo";
import { buildCrisisScript } from "./crisisScripts";
import {
  FACTION_COLORS, baseTimeFor, buildSalvo, finalize, launchMarkers, rngFrom, strikes, unit,
  type Faction, type Launch, type Marker, type TacticalScript, type UnitMove, type ZoneFx,
} from "./scenarios";

type Visual = strategic.Visual;
type Bi = strategic.Bi;

const SOURCE: Record<strategic.SalvoSource, { faction: Faction; origin: OriginId; targets: Parameters<typeof buildSalvo>[0]["targets"] }> = {
  egypt: { faction: "egypt", origin: "sinai", targets: ["tel_aviv", "beersheba", "dimona", "ashdod"] },
  gaza: { faction: "gaza", origin: "gaza", targets: ["ashkelon", "ashdod", "beersheba", "tel_aviv"] },
  hezbollah: { faction: "hezbollah", origin: "south_lebanon", targets: ["haifa", "afula", "tel_aviv"] },
  iran: { faction: "iran", origin: "tehran", targets: ["tel_aviv", "dimona", "haifa"] },
  iraq: { faction: "iraq", origin: "western_iraq", targets: ["eilat", "haifa"] },
  houthis: { faction: "houthis", origin: "yemen", targets: ["eilat", "tel_aviv"] },
  west_bank: { faction: "militants", origin: "jenin", targets: ["afula", "netanya"] },
};

const STRIKE_TARGETS: Record<strategic.StrikeTarget, { points: LonLat[]; name: Bi }> = {
  gaza: { points: [[34.45, 31.52], [34.35, 31.42], [34.28, 31.33], [34.4, 31.48]], name: { he: "רצועת עזה", en: "Gaza Strip" } },
  lebanon: { points: [[35.5, 33.3], [35.3, 33.2], [35.6, 33.45], [35.52, 33.85]], name: { he: "דרום לבנון", en: "Southern Lebanon" } },
  iran: { points: [[51.73, 33.72], [51.67, 32.65], [48.29, 30.35]], name: { he: "איראן", en: "Iran" } },
  yemen: { points: [[42.95, 14.8], [44.2, 15.35]], name: { he: "חודיידה", en: "Hodeidah" } },
  sinai: { points: [[33.75, 30.95], [33.55, 30.2]], name: { he: "סיני", en: "Sinai" } },
  west_bank: { points: [[35.3, 32.46], [35.26, 32.22], [35.03, 32.31]], name: { he: "צפון השומרון", en: "Northern West Bank" } },
};

const GROUND_TARGETS: Record<"gaza" | "west_bank" | "lebanon" | "sinai", Array<{ from: LonLat; to: LonLat }>> = {
  gaza: [{ from: [34.56, 31.62], to: [34.46, 31.52] }, { from: [34.5, 31.36], to: [34.38, 31.42] }, { from: [34.36, 31.22], to: [34.27, 31.3] }],
  west_bank: [{ from: [35.22, 32.56], to: [35.3, 32.46] }, { from: [35.0, 32.18], to: [35.26, 32.22] }],
  lebanon: [{ from: [35.2, 33.05], to: [35.35, 33.25] }, { from: [35.55, 33.1], to: [35.55, 33.35] }],
  sinai: [{ from: [34.35, 31.26], to: [33.95, 31.1] }],
};

function circle([lon, lat]: LonLat, r: number, stretch = 1, n = 28): LonLat[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [lon + Math.cos(a) * r * stretch, lat + Math.sin(a) * r] as LonLat;
  });
}

/** A state with the crisis pending — the crisis scenes are keyed on it. */
function pendingSim(crisisId: strategic.CrisisId, key: string): strategic.SimulationState {
  const base = strategic.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", key);
  const action = { track: "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" as const, ...strategic.TRACK_DEFS.PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP.defaults };
  return { ...base, pendingCrisis: { id: crisisId, action, phase: "post", metricsBefore: base.metrics, events: [] } };
}

export function visualScript(visual: Visual, key: string, turn: number): TacticalScript {
  if (visual.kind === "crisis") {
    const script = buildCrisisScript(pendingSim(visual.crisisId, `v:${visual.crisisId}:${key}`), visual.option, visual.branch);
    // campaign playback never halts
    return { ...script, haltAt: null };
  }

  const r = rngFrom(`visual:${key}`);
  const launches: Launch[] = [];
  const units: UnitMove[] = [];
  const zones: ZoneFx[] = [];
  const markers: Marker[] = [];
  const blasts: TacticalScript["blasts"] = [];

  if (visual.kind === "salvo") {
    const src = SOURCE[visual.from];
    launches.push(...buildSalvo({
      faction: src.faction, kind: visual.weapon, origin: src.origin, targets: src.targets, count: visual.count, tStart: 5, spacing: visual.weapon === "drone" ? 6 : 8,
      scatter: visual.from === "west_bank" ? 0.05 : undefined,
      battery: visual.weapon === "drone" && (visual.from === "iran" || visual.from === "iraq") ? "coalition_cap" : undefined,
    }, r, `v-${visual.from}`));
    markers.push(...launchMarkers(launches));
  } else if (visual.kind === "strike") {
    const t = STRIKE_TARGETS[visual.target];
    const pts = Array.from({ length: visual.count }, (_, i) => t.points[i % t.points.length]);
    launches.push(...strikes(pts, [t.name], 5, r, `v-strike-${visual.target}`));
    markers.push(...launchMarkers(launches));
  } else if (visual.kind === "ground") {
    GROUND_TARGETS[visual.target].forEach((g, i) => {
      units.push(unit(`v-ground-${i}`, "idf", i === 0 ? "armor" : "mech", i === 0 ? "XX" : "X", { he: "כוחות צה\"ל", en: "IDF forces" }, g.from, g.to, 5 + i * 10, 150 + i * 10));
    });
    zones.push({ id: "v-ground-zone", kind: "contested", path: circle(GROUND_TARGETS[visual.target][0].to, 0.12, 1.2), t0: 20, t1: 1e9, color: FACTION_COLORS.militants, label: null });
    markers.push({ t: 5, kind: "mobilize", label: { he: "כוחות צה\"ל נכנסים", en: "IDF forces move in" } });
  } else if (visual.kind === "protest") {
    const sites: Array<{ pos: LonLat; label: Bi }> = [
      { pos: [34.79, 32.07], label: { he: "קפלן, תל אביב", en: "Kaplan, Tel Aviv" } },
      { pos: [35.2, 31.78], label: { he: "ירושלים", en: "Jerusalem" } },
      { pos: [34.99, 32.8], label: { he: "חיפה", en: "Haifa" } },
    ];
    sites.forEach((s, i) => zones.push({ id: `v-protest-${i}`, kind: "contested", path: boxAround(s.pos, 0.035), t0: 3 + i * 6, t1: 1e9, color: "#E3B341", label: s.label }));
    markers.push({ t: 3, kind: "alert", label: { he: "הפגנות המוניות", en: "Mass protests" } });
  } else if (visual.kind === "nuclear") {
    const gz: LonLat = [34.42, 31.45];
    blasts.push({ id: "v-nuke", pos: gz, t: 8, heavy: true }, { id: "v-nuke-2", pos: [34.44, 31.47], t: 9, heavy: true });
    // fallout plume carried north-east over the Israeli south (schematic)
    zones.push({ id: "v-fireball", kind: "contested", path: circle(gz, 0.09), t0: 8, t1: 1e9, color: "#F85149", label: null });
    zones.push({ id: "v-fallout", kind: "contested", path: circle([34.78, 31.62], 0.28, 1.6), t0: 40, t1: 1e9, color: "#E3B341", label: { he: "אזור נשורת משוער", en: "Estimated fallout zone" } });
    markers.push({ t: 8, kind: "impact", label: { he: "פיצוץ גרעיני", en: "Nuclear detonation" } }, { t: 40, kind: "alert", label: { he: "נשורת רדיואקטיבית", en: "Radioactive fallout" } });
  }

  return finalize({
    key: `visual:${key}`,
    title: { he: "תמונת מצב", en: "Situation" },
    crisisId: null,
    baseTime: baseTimeFor(turn),
    launches, units, zones, blasts, markers,
    focus: [{ t: 0, focus: "israel" }],
    haltAt: null,
    minDuration: 160,
  });
}

/** Where a visual's action is, when the camera should follow the action rather than the story. */
export const ORIGIN_FOR_SOURCE: Record<strategic.SalvoSource, LonLat> = Object.fromEntries(
  (Object.keys(SOURCE) as strategic.SalvoSource[]).map((k) => [k, ORIGINS[SOURCE[k].origin].pos]),
) as Record<strategic.SalvoSource, LonLat>;
