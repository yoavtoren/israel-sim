/** World map geography for the Prime Minister campaign: every country from
 *  world-geo.json (Natural Earth 1:50m, built by scripts/build-world-geo.mjs),
 *  the country → stance-actor mapping, camera zones, label anchors. */

import { strategic } from "@engine";
import raw from "./world-geo.json";
import { project, type Camera, type LonLat } from "./geo";
import { ACTOR_BY_MAPKEY } from "./regionGeo";

export interface WorldCountry {
  key: string;
  name: string;
  rings: LonLat[][];
}

interface WorldGeoFile {
  source: string;
  countries: WorldCountry[];
}

const GEO = raw as WorldGeoFile;
export const WORLD_SOURCE = GEO.source;
export const WORLD_COUNTRIES: WorldCountry[] = GEO.countries;
export const WORLD_NAME: Map<string, string> = new Map(GEO.countries.map((c) => [c.key, c.name]));

const EU_MEMBERS = [
  "austria", "belgium", "bulgaria", "croatia", "czechia", "denmark", "estonia", "finland", "france", "germany",
  "hungary", "ireland", "italy", "latvia", "lithuania", "luxembourg", "malta", "netherlands", "poland", "portugal",
  "romania", "slovakia", "slovenia", "spain", "sweden",
];

/** Which stance actor colors each outline (null = context only). */
export const WORLD_ACTOR: Map<string, strategic.ActorId> = new Map<string, strategic.ActorId>([
  ...ACTOR_BY_MAPKEY.entries(),
  ["united_states_of_america", "usa"],
  ["united_kingdom", "uk"],
  ["china", "china"],
  ["india", "india"],
  ...EU_MEMBERS.map((k) => [k, "eu"] as [string, strategic.ActorId]),
]);

export const EU_KEYS = new Set(EU_MEMBERS);

/** Hebrew names for the countries the campaign talks about; others show their English name. */
export const COUNTRY_HE: Record<string, string> = {
  united_states_of_america: "ארצות הברית", united_kingdom: "בריטניה", france: "צרפת", germany: "גרמניה", italy: "איטליה",
  spain: "ספרד", poland: "פולין", netherlands: "הולנד", belgium: "בלגיה", ireland: "אירלנד", hungary: "הונגריה",
  czechia: "צ'כיה", greece: "יוון", cyprus: "קפריסין", turkey: "טורקיה", russia: "רוסיה", china: "סין", india: "הודו",
  egypt: "מצרים", jordan: "ירדן", syria: "סוריה", lebanon: "לבנון", iraq: "עיראק", iran: "איראן", saudi_arabia: "ערב הסעודית",
  united_arab_emirates: "איחוד האמירויות", qatar: "קטאר", bahrain: "בחריין", kuwait: "כווית", oman: "עומאן", yemen: "תימן",
  morocco: "מרוקו", azerbaijan: "אזרבייג'ן", israel: "ישראל", gaza: "עזה", west_bank: "יהודה ושומרון", ukraine: "אוקראינה",
  canada: "קנדה", brazil: "ברזיל", south_africa: "דרום אפריקה", japan: "יפן", australia: "אוסטרליה", norway: "נורבגיה",
  sweden: "שוודיה", austria: "אוסטריה", portugal: "פורטוגל", libya: "לוב", sudan: "סודן", algeria: "אלג'יריה", tunisia: "תוניסיה",
  pakistan: "פקיסטן", afghanistan: "אפגניסטן", ethiopia: "אתיופיה", mexico: "מקסיקו", argentina: "ארגנטינה", indonesia: "אינדונזיה",
};

export type WorldFocus = strategic.MapFocus;

const BOUNDS: Record<WorldFocus, [LonLat, LonLat]> = {
  world: [[-125, -35], [150, 68]],
  theater: [[27, 12], [60, 40]],
  israel: [[32.2, 29.2], [37.2, 33.6]],
  gaza: [[33.3, 30.5], [35.8, 32.4]],
  west_bank: [[34.3, 31.2], [36.0, 32.8]],
  sinai: [[31.0, 28.3], [35.6, 32.0]],
  lebanon: [[33.4, 31.9], [37.4, 34.8]],
  iran: [[33, 25], [62, 40]],
  europe: [[-12, 34], [45, 64]],
  usa: [[-128, 20], [-40, 56]],
  gulf: [[33, 14], [60, 34]],
  red_sea: [[31, 10], [47, 31]],
  jordan: [[33.5, 28.8], [40.5, 33.6]],
};

export function fitWorld(focus: WorldFocus, w: number, h: number, inset = { left: 0, right: 0, top: 0, bottom: 0 }): Camera {
  return fitBounds(BOUNDS[focus], w, h, inset);
}

/** Camera that frames a lon/lat box inside the free area of the screen. */
export function fitBounds(bounds: [LonLat, LonLat], w: number, h: number, inset = { left: 0, right: 0, top: 0, bottom: 0 }): Camera {
  const [a, b] = bounds;
  const p0 = project([a[0], b[1]]);
  const p1 = project([b[0], a[1]]);
  const aw = Math.max(100, w - inset.left - inset.right);
  const ah = Math.max(100, h - inset.top - inset.bottom);
  const scale = Math.min(aw / (p1.x - p0.x), ah / (p1.y - p0.y));
  // center of the free area, expressed back in map units
  const cxScreen = inset.left + aw / 2;
  const cyScreen = inset.top + ah / 2;
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  return { cx: mx - (cxScreen - w / 2) / scale, cy: my - (cyScreen - h / 2) / scale, scale };
}

export function ringsToPath(rings: LonLat[][]): string {
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

/** Label anchor: bbox center of each country's largest ring (map units). */
export const WORLD_LABELS: Array<{ key: string; x: number; y: number; area: number }> = WORLD_COUNTRIES.map((c) => {
  let best = { x: 0, y: 0, area: -1 };
  for (const r of c.rings) {
    const xs = r.map((p) => p[0]);
    const ys = r.map((p) => p[1]);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (area > best.area) {
      const q = project([(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]);
      best = { x: q.x, y: q.y, area };
    }
  }
  return { key: c.key, ...best };
});
