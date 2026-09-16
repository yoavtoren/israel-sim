/** Builds packages/ui/src/strategic/world-geo.json — every country's outline for
 *  the Prime Minister campaign's world map, from Natural Earth 1:50m (public
 *  domain) via world-atlas. Full detail in the Middle East, stronger
 *  simplification elsewhere; rings are unwrapped across the antimeridian;
 *  Antarctica dropped; Palestine split into Gaza and the West Bank.
 *  Run: node scripts/build-world-geo.mjs */

import { writeFileSync } from "node:fs";

const SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const DETAIL = [14, 4, 66, 47]; // lon0, lat0, lon1, lat1 — the region kept at full detail
const OUT = new URL("../packages/ui/src/strategic/world-geo.json", import.meta.url);

const topo = await (await fetch(SRC)).json();
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;

const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * sx + tx, y * sy + ty];
  });
});

function ring(indices) {
  const out = [];
  for (const i of indices) {
    const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i];
    out.push(...(out.length > 0 ? a.slice(1) : a));
  }
  // unwrap across the antimeridian so the ring stays continuous in the plane
  for (let k = 1; k < out.length; k++) {
    const d = out[k][0] - out[k - 1][0];
    if (d > 180) out[k] = [out[k][0] - 360, out[k][1]];
    else if (d < -180) out[k] = [out[k][0] + 360, out[k][1]];
  }
  return out;
}

function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay);
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = len === 0
        ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay)
        : Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i] === 1);
}

const r2 = (v) => Math.round(v * 100) / 100;

function polygonsOf(geom) {
  if (geom.type === "Polygon") return [geom.arcs.map(ring)];
  if (geom.type === "MultiPolygon") return geom.arcs.map((p) => p.map(ring));
  return [];
}

function bboxOf(polys) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys) for (const [x, y] of p[0]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

const inDetail = ([x0, y0, x1, y1]) => x1 >= DETAIL[0] && x0 <= DETAIL[2] && y1 >= DETAIL[1] && y0 <= DETAIL[3];
const slug = (n) => n.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");

const countries = [];
function emit(key, name, polys) {
  const [x0, y0, x1, y1] = bboxOf(polys);
  const size = Math.max(x1 - x0, y1 - y0);
  const detail = inDetail([x0, y0, x1, y1]);
  const tol = detail ? (size < 4 ? 0.006 : 0.03) : size < 4 ? 0.03 : 0.12;
  const speck = detail ? (size < 4 ? 0 : 0.25) : size < 4 ? 0.05 : 0.8;
  const rings = [];
  for (const p of polys) {
    const [px0, py0, px1, py1] = bboxOf([p]);
    if (Math.max(px1 - px0, py1 - py0) < speck) continue;
    for (const r of p) {
      const s = simplify(r, tol).map(([x, y]) => [r2(x), r2(y)]);
      if (s.length >= 4) rings.push(s);
    }
  }
  if (rings.length > 0) countries.push({ key, name, rings });
}

for (const g of topo.objects.countries.geometries) {
  const name = g.properties.name;
  if (name === "Antarctica") continue;
  const polys = polygonsOf(g);
  if (polys.length === 0) continue;
  if (name === "Palestine") {
    emit("gaza", "Gaza", polys.filter((p) => bboxOf([p])[2] < 34.7));
    emit("west_bank", "West Bank", polys.filter((p) => bboxOf([p])[2] >= 34.7));
    continue;
  }
  emit(slug(name), name, polys);
}

countries.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(OUT, JSON.stringify({ source: "Natural Earth 1:50m via world-atlas@2.0.2 (public domain)", countries }) + "\n");
console.log(`${countries.length} countries → ${OUT.pathname}`);
