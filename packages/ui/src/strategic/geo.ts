/** Tactical-map geography: an equirectangular projection into "map units"
 *  (100 per degree of latitude) and SCHEMATIC outlines — hand-simplified
 *  from memory for a situation display, not survey data. */

export type LonLat = [number, number];
export interface Pt {
  x: number;
  y: number;
}

const LON0 = 28;
const LAT1 = 38.5;
const K = 100;
const COS = Math.cos((31.5 * Math.PI) / 180);

export function project([lon, lat]: LonLat): Pt {
  return { x: (lon - LON0) * COS * K, y: (LAT1 - lat) * K };
}

/** great-circle-ish distance, km (good enough at this scale) */
export function distanceKm(a: LonLat, b: LonLat): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** km → map units (latitude scale) */
export function kmToUnits(km: number): number {
  return (km / 111.2) * K;
}

export type RegionId =
  | "israel" | "gaza" | "west_bank" | "golan" | "egypt" | "jordan" | "lebanon" | "syria"
  | "iraq" | "saudi" | "kuwait" | "iran" | "turkey" | "cyprus";

export interface Region {
  id: RegionId;
  name: { he: string; en: string };
  label: LonLat;
  kind: "own" | "territory" | "neighbor" | "distant";
  ring: LonLat[];
}

export const REGIONS: Region[] = [
  {
    id: "egypt", name: { he: "מצרים", en: "Egypt" }, label: [30.6, 27.2], kind: "neighbor",
    ring: [[34.22, 31.32], [33.8, 31.13], [33.1, 31.05], [32.3, 31.26], [31.8, 31.5], [31.0, 31.58], [29.9, 31.2], [25, 31.6], [25, 22], [36.9, 22], [35.5, 23.9], [34.0, 26.1], [33.3, 27.6], [32.6, 29.9], [32.9, 29.3], [33.6, 28.3], [34.25, 27.75], [34.45, 28.2], [34.7, 29.1], [34.9, 29.49], [34.73, 29.9], [34.55, 30.4], [34.4, 30.85], [34.27, 31.22]],
  },
  {
    id: "israel", name: { he: "ישראל", en: "Israel" }, label: [34.85, 30.75], kind: "own",
    ring: [[35.1, 33.09], [35.35, 33.07], [35.5, 33.09], [35.57, 33.27], [35.65, 33.25], [35.62, 33.0], [35.64, 32.83], [35.57, 32.7], [35.55, 32.4], [35.55, 32.1], [35.52, 31.75], [35.47, 31.45], [35.4, 31.1], [35.33, 30.9], [35.18, 30.6], [35.1, 30.2], [35.02, 29.8], [34.98, 29.55], [34.9, 29.49], [34.73, 29.9], [34.55, 30.4], [34.4, 30.85], [34.27, 31.22], [34.4, 31.34], [34.53, 31.5], [34.56, 31.55], [34.49, 31.6], [34.55, 31.67], [34.63, 31.8], [34.76, 32.08], [34.85, 32.33], [34.88, 32.45], [34.96, 32.82], [35.07, 32.93]],
  },
  {
    id: "gaza", name: { he: "עזה", en: "Gaza" }, label: [34.2, 31.62], kind: "territory",
    ring: [[34.22, 31.32], [34.49, 31.59], [34.56, 31.55], [34.53, 31.5], [34.4, 31.34], [34.27, 31.22]],
  },
  {
    id: "west_bank", name: { he: "יהודה ושומרון", en: "West Bank" }, label: [35.25, 32.0], kind: "territory",
    ring: [[35.55, 32.39], [35.3, 32.55], [35.02, 32.4], [34.96, 32.2], [35.02, 32.0], [34.99, 31.85], [35.2, 31.78], [35.0, 31.6], [34.88, 31.36], [35.1, 31.35], [35.48, 31.49], [35.47, 31.6], [35.53, 31.75], [35.55, 32.1]],
  },
  {
    id: "golan", name: { he: "רמת הגולן", en: "Golan Heights" }, label: [35.8, 33.02], kind: "territory",
    ring: [[35.64, 32.7], [35.85, 32.72], [35.95, 32.95], [35.85, 33.25], [35.78, 33.33], [35.65, 33.25], [35.62, 33.0]],
  },
  {
    id: "lebanon", name: { he: "לבנון", en: "Lebanon" }, label: [35.85, 33.95], kind: "neighbor",
    ring: [[35.1, 33.09], [35.19, 33.27], [35.37, 33.56], [35.48, 33.9], [35.64, 34.12], [35.84, 34.44], [35.97, 34.63], [36.35, 34.6], [36.6, 34.2], [36.3, 33.8], [35.95, 33.55], [35.82, 33.33], [35.65, 33.25], [35.57, 33.27], [35.5, 33.09], [35.35, 33.07]],
  },
  {
    id: "syria", name: { he: "סוריה", en: "Syria" }, label: [38.6, 35.0], kind: "neighbor",
    ring: [[35.97, 34.63], [35.88, 34.9], [35.78, 35.52], [35.92, 35.92], [36.6, 36.2], [36.8, 36.8], [38.0, 36.85], [40.0, 36.9], [42.35, 37.1], [41.3, 36.4], [41.2, 34.8], [40.9, 34.4], [38.79, 33.37], [36.83, 32.31], [36.0, 32.72], [35.64, 32.7], [35.62, 33.0], [35.65, 33.25], [35.82, 33.33], [35.95, 33.55], [36.3, 33.8], [36.6, 34.2], [36.35, 34.6]],
  },
  {
    id: "jordan", name: { he: "ירדן", en: "Jordan" }, label: [36.7, 31.0], kind: "neighbor",
    ring: [[35.58, 32.64], [36.0, 32.72], [36.83, 32.31], [38.79, 33.37], [39.3, 32.23], [37.0, 31.5], [38.0, 30.5], [37.5, 30.0], [36.5, 29.9], [36.07, 29.19], [34.96, 29.36], [35.02, 29.8], [35.1, 30.2], [35.18, 30.6], [35.33, 30.9], [35.4, 31.1], [35.47, 31.45], [35.52, 31.75], [35.55, 32.1], [35.55, 32.4]],
  },
  {
    id: "saudi", name: { he: "ערב הסעודית", en: "Saudi Arabia" }, label: [42.5, 26.5], kind: "distant",
    ring: [[34.96, 29.36], [34.6, 28.1], [35.5, 27.0], [36.5, 25.8], [37.9, 24.0], [38.8, 22.0], [50.0, 22.0], [51.5, 24.2], [50.1, 26.5], [48.5, 28.0], [47.7, 28.5], [46.5, 29.1], [44.7, 29.2], [42.0, 31.1], [40.4, 31.95], [39.3, 32.23], [37.0, 31.5], [38.0, 30.5], [37.5, 30.0], [36.5, 29.9], [36.07, 29.19]],
  },
  {
    id: "kuwait", name: { he: "כווית", en: "Kuwait" }, label: [47.6, 29.3], kind: "distant",
    ring: [[47.1, 30.0], [48.0, 29.95], [48.4, 28.55], [47.7, 28.5], [46.5, 29.1]],
  },
  {
    id: "iraq", name: { he: "עיראק", en: "Iraq" }, label: [43.6, 33.0], kind: "distant",
    ring: [[42.35, 37.1], [43.0, 37.35], [44.8, 37.15], [45.0, 35.8], [46.1, 35.1], [45.4, 34.0], [46.1, 33.0], [47.5, 32.0], [47.8, 31.0], [48.5, 29.95], [48.0, 29.95], [47.1, 30.0], [46.5, 29.1], [44.7, 29.2], [42.0, 31.1], [40.4, 31.95], [39.3, 32.23], [38.79, 33.37], [40.9, 34.4], [41.2, 34.8], [41.3, 36.4]],
  },
  {
    id: "iran", name: { he: "איראן", en: "Iran" }, label: [53.0, 32.5], kind: "distant",
    ring: [[44.3, 38.5], [48.0, 38.5], [48.9, 38.4], [49.0, 37.5], [50.3, 37.0], [53.9, 36.9], [56.5, 37.3], [56.5, 26.5], [54.5, 26.6], [53.0, 27.0], [51.4, 27.9], [50.6, 29.2], [50.0, 30.1], [48.5, 29.95], [47.8, 31.0], [47.5, 32.0], [46.1, 33.0], [45.4, 34.0], [46.1, 35.1], [45.0, 35.8], [44.8, 37.15]],
  },
  {
    id: "turkey", name: { he: "טורקיה", en: "Turkey" }, label: [33.0, 37.7], kind: "distant",
    ring: [[35.92, 35.92], [36.2, 36.6], [35.5, 36.6], [34.6, 36.8], [32.8, 36.1], [30.5, 36.3], [27.5, 36.7], [27.5, 38.8], [44.3, 38.8], [44.3, 38.5], [44.8, 37.15], [43.0, 37.35], [42.35, 37.1], [40.0, 36.9], [38.0, 36.85], [36.8, 36.8], [36.6, 36.2]],
  },
  {
    id: "cyprus", name: { he: "קפריסין", en: "Cyprus" }, label: [33.2, 35.05], kind: "distant",
    ring: [[32.3, 35.1], [32.9, 35.4], [34.0, 35.6], [34.6, 35.7], [33.9, 35.25], [34.0, 34.95], [33.0, 34.6], [32.4, 34.75]],
  },
];

export const SUEZ_CANAL: LonLat[] = [[32.35, 31.25], [32.32, 30.85], [32.27, 30.6], [32.4, 30.3], [32.55, 29.95]];
/** Egypt–Israel border + Philadelphi corridor (Kerem Shalom → Taba) */
export const EGYPT_BORDER: LonLat[] = [[34.22, 31.32], [34.27, 31.22], [34.4, 30.85], [34.55, 30.4], [34.73, 29.9], [34.9, 29.49]];

export type CityId =
  | "tel_aviv" | "haifa" | "dimona" | "ashdod" | "ashkelon" | "eilat" | "jerusalem" | "beersheba" | "netanya" | "afula";
export interface City {
  id: CityId;
  name: { he: string; en: string };
  pos: LonLat;
}
export const CITIES: Record<CityId, City> = {
  tel_aviv: { id: "tel_aviv", name: { he: "תל אביב", en: "Tel Aviv" }, pos: [34.78, 32.08] },
  haifa: { id: "haifa", name: { he: "חיפה", en: "Haifa" }, pos: [34.99, 32.79] },
  dimona: { id: "dimona", name: { he: "דימונה", en: "Dimona" }, pos: [35.03, 31.07] },
  ashdod: { id: "ashdod", name: { he: "אשדוד", en: "Ashdod" }, pos: [34.65, 31.8] },
  ashkelon: { id: "ashkelon", name: { he: "אשקלון", en: "Ashkelon" }, pos: [34.57, 31.67] },
  eilat: { id: "eilat", name: { he: "אילת", en: "Eilat" }, pos: [34.95, 29.56] },
  jerusalem: { id: "jerusalem", name: { he: "ירושלים", en: "Jerusalem" }, pos: [35.21, 31.77] },
  beersheba: { id: "beersheba", name: { he: "באר שבע", en: "Be'er Sheva" }, pos: [34.79, 31.25] },
  netanya: { id: "netanya", name: { he: "נתניה", en: "Netanya" }, pos: [34.86, 32.33] },
  afula: { id: "afula", name: { he: "עפולה", en: "Afula" }, pos: [35.29, 32.61] },
};

export type OriginId =
  | "sinai" | "sinai_south" | "tehran" | "western_iraq" | "south_lebanon" | "gaza"
  | "jenin" | "nablus" | "tulkarm" | "kermanshah" | "isfahan" | "tabriz";
export const ORIGINS: Record<OriginId, { name: { he: string; en: string }; pos: LonLat }> = {
  sinai: { name: { he: "צפון סיני", en: "Northern Sinai" }, pos: [33.75, 30.95] },
  sinai_south: { name: { he: "מרכז סיני", en: "Central Sinai" }, pos: [33.55, 30.2] },
  tehran: { name: { he: "טהרן", en: "Tehran" }, pos: [51.39, 35.69] },
  western_iraq: { name: { he: "מערב עיראק", en: "Western Iraq" }, pos: [40.2, 33.4] },
  south_lebanon: { name: { he: "דרום לבנון", en: "Southern Lebanon" }, pos: [35.45, 33.3] },
  gaza: { name: { he: "רצועת עזה", en: "Gaza Strip" }, pos: [34.42, 31.45] },
  jenin: { name: { he: "ג'נין", en: "Jenin" }, pos: [35.3, 32.46] },
  nablus: { name: { he: "שכם", en: "Nablus" }, pos: [35.26, 32.22] },
  tulkarm: { name: { he: "טול כרם", en: "Tulkarm" }, pos: [35.03, 32.31] },
  kermanshah: { name: { he: "כרמאנשאה", en: "Kermanshah" }, pos: [47.07, 34.31] },
  isfahan: { name: { he: "אספהאן", en: "Isfahan" }, pos: [51.67, 32.65] },
  tabriz: { name: { he: "תבריז", en: "Tabriz" }, pos: [46.29, 38.08] },
};

export type BatteryId =
  | "iron_dome_gush_dan" | "iron_dome_south" | "davids_sling_haifa" | "patriot_haifa" | "arrow3" | "coalition_cap";
export interface Battery {
  id: BatteryId;
  name: { he: string; en: string };
  pos: LonLat;
  radiusKm: number;
  /** estimated single-engagement kill probability (display assumption) */ pk: number;
  outer: boolean;
  /** airborne combat air patrol rather than a ground battery */ airborne?: boolean;
}
export const BATTERIES: Record<BatteryId, Battery> = {
  iron_dome_gush_dan: { id: "iron_dome_gush_dan", name: { he: "כיפת ברזל · גוש דן", en: "Iron Dome · Gush Dan" }, pos: [34.86, 32.02], radiusKm: 70, pk: 0.9, outer: false },
  iron_dome_south: { id: "iron_dome_south", name: { he: "כיפת ברזל · דרום", en: "Iron Dome · South" }, pos: [34.62, 31.55], radiusKm: 70, pk: 0.9, outer: false },
  davids_sling_haifa: { id: "davids_sling_haifa", name: { he: "קלע דוד · חיפה", en: "David's Sling · Haifa" }, pos: [35.08, 32.72], radiusKm: 180, pk: 0.85, outer: false },
  patriot_haifa: { id: "patriot_haifa", name: { he: "פטריוט · צפון", en: "Patriot · North" }, pos: [35.2, 32.9], radiusKm: 100, pk: 0.75, outer: false },
  arrow3: { id: "arrow3", name: { he: "חץ 3 · מעטפת חיצונית", en: "Arrow 3 · outer envelope" }, pos: [34.92, 31.85], radiusKm: 450, pk: 0.88, outer: true },
  coalition_cap: { id: "coalition_cap", name: { he: "סיור אווירי קואליציוני · ירדן", en: "Coalition CAP · Jordan" }, pos: [37.6, 31.6], radiusKm: 260, pk: 0.9, outer: false, airborne: true },
};

/** Egyptian mechanized formations west of the canal and their forward lines. */
export const EGYPT_FORMATIONS: Array<{ id: string; label: { he: string; en: string }; from: LonLat; to: LonLat }> = [
  { id: "army2_a", label: { he: "ארמיה 2 · דיב' ממוכנת", en: "2nd Army · mech. div." }, from: [31.75, 30.95], to: [32.45, 30.9] },
  { id: "army2_b", label: { he: "ארמיה 2 · דיב' שריון", en: "2nd Army · armored div." }, from: [31.6, 30.55], to: [32.4, 30.55] },
  { id: "army3_a", label: { he: "ארמיה 3 · דיב' ממוכנת", en: "3rd Army · mech. div." }, from: [31.8, 30.05], to: [32.7, 30.05] },
];

/** Contested buffer along Philadelphi / northern Sinai (drawn when fighting spreads). */
export const SINAI_BUFFER: LonLat[] = [[34.22, 31.32], [34.27, 31.22], [34.4, 30.85], [34.0, 30.75], [33.7, 31.08], [33.9, 31.13]];

/** 1979 treaty Annex I zone boundaries in Sinai — schematic. */
export const TREATY_LINES: Array<{ id: string; label: { he: string; en: string }; path: LonLat[] }> = [
  { id: "line_a", label: { he: "קו A", en: "Line A" }, path: [[32.95, 31.08], [32.95, 29.3]] },
  { id: "line_b", label: { he: "קו B", en: "Line B" }, path: [[33.55, 31.1], [33.6, 28.6]] },
  { id: "line_c", label: { he: "גבול אזור C", en: "Zone C edge" }, path: [[34.0, 31.15], [34.1, 28.1]] },
];

/** Tunnel routes under Philadelphi / Rafah (schematic). */
export const TUNNEL_ROUTES: LonLat[][] = [
  [[34.26, 31.30], [34.24, 31.27], [34.21, 31.23]],
  [[34.29, 31.29], [34.27, 31.25], [34.25, 31.21]],
  [[34.31, 31.28], [34.3, 31.25], [34.285, 31.225]],
  [[34.33, 31.30], [34.35, 31.27], [34.3, 31.235]],
];

/** Separation barrier, drawn as the West Bank outline (schematic). */
export function westBankRing(regions: Region[]): LonLat[] {
  return regions.find((r) => r.id === "west_bank")?.ring ?? [];
}

export function boxAround([lon, lat]: LonLat, d: number): LonLat[] {
  return [[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d]];
}

/** Standing order of battle positions. */
export const BASES = {
  nevatim: [35.01, 31.21] as LonLat,
  hatzerim: [34.66, 31.23] as LonLat,
  ramat_david: [35.18, 32.66] as LonLat,
  haifa_naval: [34.82, 32.98] as LonLat,
  ashdod_naval: [34.45, 31.88] as LonLat,
  eilat_naval: [34.72, 28.95] as LonLat,
  us_csg_med: [33.3, 33.4] as LonLat,
  us_ddg_red_sea: [36.4, 24.8] as LonLat,
  egypt_navy_port_said: [32.45, 31.55] as LonLat,
  egypt_navy_red_sea: [34.1, 27.2] as LonLat,
};

export interface Camera {
  cx: number;
  cy: number;
  /** px per map unit */ scale: number;
}

export type FocusId = "theater" | "israel" | "tel_aviv" | "west_bank" | "gaza" | "sinai";

const FOCUS_BOUNDS: Record<FocusId, [LonLat, LonLat]> = {
  theater: [[29.5, 24.5], [53.5, 38.2]],
  israel: [[31.2, 29.2], [37.8, 33.6]],
  tel_aviv: [[33.6, 31.35], [35.9, 32.75]],
  west_bank: [[34.3, 31.25], [36.1, 32.75]],
  gaza: [[33.85, 30.95], [34.85, 31.72]],
  sinai: [[31.4, 28.6], [35.4, 32.0]],
};

export function focusCamera(focus: FocusId, w: number, h: number): Camera {
  const [a, b] = FOCUS_BOUNDS[focus];
  const p0 = project([a[0], b[1]]);
  const p1 = project([b[0], a[1]]);
  const bw = p1.x - p0.x;
  const bh = p1.y - p0.y;
  const scale = Math.min(w / bw, h / bh);
  return { cx: (p0.x + p1.x) / 2, cy: (p0.y + p1.y) / 2, scale };
}

export function toScreen(p: Pt, cam: Camera, w: number, h: number): Pt {
  return { x: w / 2 + (p.x - cam.cx) * cam.scale, y: h / 2 + (p.y - cam.cy) * cam.scale };
}

export function toMap(p: Pt, cam: Camera, w: number, h: number): Pt {
  return { x: cam.cx + (p.x - w / 2) / cam.scale, y: cam.cy + (p.y - h / 2) / cam.scale };
}
