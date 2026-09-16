/** Alliance-map geography: Natural Earth 1:50m outlines (region-geo.json,
 *  built by scripts/build-region-geo.mjs), projected with the tactical map's
 *  equirectangular projection so both maps share map units. */

import { strategic } from "@engine";
import raw from "./region-geo.json";
import { project, type LonLat } from "./geo";

export interface CountryShape {
  key: string;
  name: string;
  rings: LonLat[][];
}

interface RegionGeoFile {
  source: string;
  bbox: [number, number, number, number];
  countries: CountryShape[];
}

const GEO = raw as RegionGeoFile;
export const GEO_SOURCE = GEO.source;
export const COUNTRY_SHAPES: CountryShape[] = GEO.countries;

export type TierColors = Record<strategic.StanceTier, string>;

/** Diverging ramp: blue = with us, grey = neutral, amber → red = against us. */
export const TIER_COLORS: TierColors = {
  ALLY: "#2F6FD6",
  FRIENDLY: "#4F8FB0",
  NEUTRAL: "#56606E",
  COLD: "#B08326",
  HOSTILE: "#C8552F",
  ENEMY: "#B3202A",
};

export const ISRAEL_FILL = "#DCE6F0";
export const CONTEXT_FILL = "#111823";
export const CONTEXT_STROKE = "#243042";
export const SEA = "#070B11";

/** Which actor, if any, owns each outline. */
export const ACTOR_BY_MAPKEY: Map<string, strategic.ActorId> = new Map(
  strategic.ACTOR_IDS.flatMap((id) => {
    const key = strategic.ACTOR_DEFS[id].mapKey;
    return key === null ? [] : [[key, id] as [string, strategic.ActorId]];
  }),
);

/** Label anchors. `callout` places the label off the shape (in the sea or a
 *  neighbor) with a leader line back to it — for shapes too small to hold text. */
export const LABEL_ANCHORS: Record<string, { at: LonLat; callout?: boolean }> = {
  israel: { at: [34.8, 30.4] },
  gaza: { at: [33.1, 31.95], callout: true },
  west_bank: { at: [37.6, 32.75], callout: true },
  lebanon: { at: [33.85, 33.45], callout: true },
  cyprus: { at: [33.3, 36.05] },
  qatar: { at: [52.3, 26.4], callout: true },
  bahrain: { at: [49.3, 27.9], callout: true },
  kuwait: { at: [48.9, 30.4], callout: true },
  egypt: { at: [29.8, 26.5] },
  jordan: { at: [37.0, 30.9] },
  syria: { at: [38.6, 35.2] },
  iraq: { at: [43.5, 33.2] },
  saudi_arabia: { at: [45.0, 23.8] },
  iran: { at: [54.0, 32.5] },
  turkey: { at: [34.5, 39.0] },
  united_arab_emirates: { at: [54.2, 23.4] },
  oman: { at: [56.9, 20.6] },
  yemen: { at: [47.0, 15.8] },
  greece: { at: [22.0, 39.4] },
  azerbaijan: { at: [47.8, 40.4] },
  russia: { at: [44.5, 45.6] },
};

/** Where a callout's leader line lands on the shape. */
export const CALLOUT_TARGETS: Record<string, LonLat> = {
  gaza: [34.38, 31.42],
  west_bank: [35.3, 32.0],
  lebanon: [35.75, 33.9],
  qatar: [51.2, 25.35],
  bahrain: [50.55, 26.05],
  kuwait: [47.7, 29.3],
};

/** The "Axis of Resistance": Iran's arcs to its proxies. */
export const PROXY_LINKS: Array<{ from: LonLat; to: LonLat; actor: strategic.ActorId }> = [
  { from: [51.4, 35.7], to: [35.75, 33.9], actor: "hezbollah" },
  { from: [51.4, 35.7], to: [44.2, 15.4], actor: "houthis" },
  { from: [51.4, 35.7], to: [44.4, 33.3], actor: "iraq" },
  { from: [51.4, 35.7], to: [34.38, 31.42], actor: "gaza" },
];

/** Default framing of the alliance map. */
export const ALLIANCE_BOUNDS: [LonLat, LonLat] = [[19.5, 11], [61, 44]];

export function ringsPath(rings: LonLat[][]): string {
  let d = "";
  for (const r of rings) {
    r.forEach((p, i) => {
      const q = project(p);
      d += `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    });
    d += "Z";
  }
  return d;
}
