/** Locality coordinates for the M10 map.
 *  Source: data.gov.il "יישובים בישראל - קובצי יישובים", קובץ היישובים 2023
 *  (resource d47a54ff-87f0-44b3-b33a-f284c0c38e5a, served via the CKAN datastore).
 *  The "קואורדינטות" field is a 12-digit concatenation of ITM east (6) + north (6).
 *  Converted here ITM (EPSG:2039, GRS80) → WGS84 lon/lat with an in-house inverse
 *  transverse-Mercator — sub-100m accuracy, far below map-marker needs.
 *  Output: normalized/locality_coords.json — { [cbs_code]: [lon, lat] }.
 *  Run: tsx packages/data/etl/locality_coords.ts (network).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { datastoreAll, normalizedDir, saveRaw, today, writeNormalized } from "./lib";

const RESOURCE = "d47a54ff-87f0-44b3-b33a-f284c0c38e5a";

// ITM / Israel 1993 projection constants (EPSG:2039).
const A = 6378137.0; // GRS80 semi-major
const F = 1 / 298.257222101;
const K0 = 1.0000067;
const LAT0 = (31.734393889 * Math.PI) / 180;
const LON0 = (35.204516944 * Math.PI) / 180;
const FE = 219529.584;
const FN = 626907.39;

/** Inverse transverse Mercator (standard USGS series), ITM east/north → WGS84 [lon, lat] degrees. */
function itmToWgs84(east: number, north: number): [number, number] {
  const e2 = 2 * F - F * F;
  const ep2 = e2 / (1 - e2);
  const m0 = meridianArc(LAT0, A, e2);
  const m = m0 + (north - FN) / K0;
  const mu = m / (A * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = A / Math.sqrt(1 - e2 * sin1 * sin1);
  const r1 = (A * (1 - e2)) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const d = (east - FE) / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    LON0 +
    (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) / cos1;
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI];
}

function meridianArc(phi: number, a: number, e2: number): number {
  return (
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi))
  );
}

const records = await datastoreAll(RESOURCE);
saveRaw("localities_2023_coords.json", records);

const known: Set<number> = new Set(
  (JSON.parse(readFileSync(join(normalizedDir, "localities.json"), "utf8")) as Array<{ code: number }>).map((r) => r.code),
);

const coords: Record<string, [number, number]> = {};
let badField = 0;
let outOfRange = 0;
for (const r of records) {
  const code = Number(r["סמל יישוב"]);
  const raw = r["קואורדינטות"];
  if (!Number.isFinite(code) || raw === null || raw === undefined) {
    badField++;
    continue;
  }
  const s = String(raw).trim();
  if (!/^\d{11,12}$/.test(s)) {
    badField++;
    continue;
  }
  // 12 digits = east(6)+north(6); 11 digits = east lost a leading zero pad — take last 6 as north.
  const east = Number(s.slice(0, s.length - 6));
  const north = Number(s.slice(-6));
  const [lon, lat] = itmToWgs84(east, north);
  if (lon < 33.5 || lon > 36.5 || lat < 29 || lat > 34) {
    outOfRange++;
    continue;
  }
  coords[String(code)] = [Number(lon.toFixed(5)), Number(lat.toFixed(5))];
}

const matched = [...known].filter((c) => coords[String(c)] !== undefined).length;
console.log(
  `records ${records.length}, coords ${Object.keys(coords).length}, bad-field ${badField}, out-of-range ${outOfRange}; ` +
    `matched ${matched}/${known.size} engine localities`,
);
if (matched / known.size < 0.9) throw new Error("coordinate coverage below 90% of engine localities");

writeNormalized("locality_coords", coords, {
  id: "locality_coords",
  source_url: `https://data.gov.il/api/3/action/datastore_search?resource_id=${RESOURCE}`,
  retrieved: today(),
  license: "data.gov.il open license",
  rows: Object.keys(coords).length,
  schema: { "<cbs_code>": "[lon, lat] WGS84 degrees (from ITM east/north, in-house inverse TM, ~<100m)" },
  known_gaps: [
    `${badField} records lacked a parseable coordinate field; ${outOfRange} fell outside the Israel bounding box.`,
    `${known.size - matched} engine localities have no coordinate and are dropped from the map layer.`,
    "Point coordinates only (locality centroid-ish); no polygons — map renders proportional circles, not choropleth polygons.",
  ],
  transform_script: "packages/data/etl/locality_coords.ts",
});
