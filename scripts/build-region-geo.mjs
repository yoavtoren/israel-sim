/** Builds packages/ui/src/strategic/region-geo.json — country outlines for the
 *  alliance map, cut from Natural Earth 1:50m (public domain) via world-atlas.
 *  Self-contained: decodes TopoJSON, clips to the region, simplifies
 *  (Douglas–Peucker), rounds to 0.01°. Palestine is split into Gaza and the
 *  West Bank. Run: node scripts/build-region-geo.mjs */

import { writeFileSync } from "node:fs";

const SRC = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json";
const BBOX = [14, 4, 66, 47]; // lon0, lat0, lon1, lat1
const OUT = new URL("../packages/ui/src/strategic/region-geo.json", import.meta.url);

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
      // closed rings start and end on the same point: fall back to point distance
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

const slug = (n) => n.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");

const countries = [];
function emit(key, name, polys) {
  const [x0, y0, x1, y1] = bboxOf(polys);
  const small = Math.max(x1 - x0, y1 - y0) < 4;
  const tol = small ? 0.006 : 0.03;
  const rings = [];
  for (const p of polys) {
    const [px0, py0, px1, py1] = bboxOf([p]);
    if (px1 < BBOX[0] || px0 > BBOX[2] || py1 < BBOX[1] || py0 > BBOX[3]) continue;
    // drop specks (tiny islands) except for small countries
    if (!small && Math.max(px1 - px0, py1 - py0) < 0.25) continue;
    for (const r of p) {
      const s = simplify(r, tol).map(([x, y]) => [r2(x), r2(y)]);
      if (s.length >= 4) rings.push(s);
    }
  }
  if (rings.length > 0) countries.push({ key, name, rings });
}

for (const g of topo.objects.countries.geometries) {
  const name = g.properties.name;
  const polys = polygonsOf(g);
  if (polys.length === 0) continue;
  const [x0, y0, x1, y1] = bboxOf(polys);
  if (x1 < BBOX[0] || x0 > BBOX[2] || y1 < BBOX[1] || y0 > BBOX[3]) continue;
  if (name === "Palestine") {
    emit("gaza", "Gaza", polys.filter((p) => bboxOf([p])[2] < 34.7));
    emit("west_bank", "West Bank", polys.filter((p) => bboxOf([p])[2] >= 34.7));
    continue;
  }
  emit(slug(name), name, polys);
}

countries.sort((a, b) => a.key.localeCompare(b.key));
writeFileSync(OUT, JSON.stringify({ source: "Natural Earth 1:50m via world-atlas@2.0.2 (public domain)", bbox: BBOX, countries }) + "\n");
console.log(`${countries.length} countries → ${OUT.pathname}`);
