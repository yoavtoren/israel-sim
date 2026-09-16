/** Living-map drawing kit: the frame (camera → screen), geometry helpers and
 *  every sprite and effect. Nothing here reads the clock — animated pieces
 *  take the scene time `t` explicitly, so a still map stays perfectly still.
 *
 *  Pseudo-3D convention: light from the north-west. Height lifts a thing up
 *  the screen; its shadow falls to the south-east on the ground. */

import { project, toScreen, type Camera, type LonLat, type Pt } from "../geo";
import { hash01 } from "../scenarios";

export const SANS = "Rubik, Heebo, system-ui, sans-serif";
export const INK = "#1C2330";
export const SHADOW = "rgba(40,34,24,0.22)";
export const OLIVE = "#5F6B3E";
export const OLIVE_DARK = "#454E2B";
export const OLIVE_LIGHT = "#7C8A52";
export const STEEL = "#6B7684";
export const STEEL_DARK = "#4A5361";
export const STEEL_LIGHT = "#9AA4B1";
export const RED = "#C8372D";
export const TEAL = "#0E8A94";
export const BLUE = "#2456B5";
export const DESERT = "#A08A5C";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
export const ease = (x: number) => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};
/** 0 → 1 → 0 window: fades in over `fade` s after a, out over `fade` s before b. */
export const window01 = (t: number, a: number, b: number, fade = 0.6) => smooth(a, a + fade, t) * (1 - smooth(b - fade, b, t));

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** px per degree of latitude */ ppd: number;
  /** sprite scale */ u: number;
  lang: "he" | "en";
  S(p: Pt): Pt;
  L(ll: LonLat): Pt;
  on(p: Pt, margin?: number): boolean;
  /** visibility of ground-scale detail (0–1) */ ground: number;
  /** visibility of people-scale detail */ people: number;
  /** visibility of region-scale things (ships, airliners, long-range) */ far: number;
}

export function makeFrame(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, lang: "he" | "en"): Frame {
  const ppd = cam.scale * 100;
  const S = (p: Pt) => toScreen(p, cam, w, h);
  return {
    ctx, w, h, ppd, lang,
    u: Math.max(0.55, Math.min(2.4, ppd / 150)),
    S,
    L: (ll) => S(project(ll)),
    on: (p, m = 40) => p.x > -m && p.x < w + m && p.y > -m && p.y < h + m,
    ground: smooth(55, 100, ppd),
    people: smooth(95, 140, ppd),
    far: smooth(12, 34, ppd),
  };
}

// ---------------------------------------------------------------------------
// polylines
// ---------------------------------------------------------------------------

interface Poly {
  pts: Pt[];
  cum: number[];
  len: number;
}
const polyCache = new WeakMap<LonLat[], Poly>();
function poly(path: LonLat[]): Poly {
  let p = polyCache.get(path);
  if (p === undefined) {
    const pts = path.map(project);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    p = { pts, cum, len: cum[cum.length - 1] };
    polyCache.set(path, p);
  }
  return p;
}

export function pathLength(path: LonLat[]): number {
  return poly(path).len;
}

/** Map-unit point and heading at fraction k of a polyline. */
export function along(path: LonLat[], k: number): { p: Pt; a: number } {
  const { pts, cum, len } = poly(path);
  if (pts.length === 1) return { p: pts[0], a: 0 };
  const d = clamp01(k) * len;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (d - cum[i - 1]) / seg;
  const a = pts[i - 1];
  const b = pts[i];
  return { p: { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) }, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

export function strokePath(f: Frame, path: LonLat[], color: string, width: number, dash: number[] = []): void {
  const { ctx } = f;
  ctx.beginPath();
  path.forEach((ll, i) => {
    const q = f.L(ll);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function fillRing(f: Frame, ring: LonLat[], fill: string, stroke?: string, width = 1): void {
  const { ctx } = f;
  ctx.beginPath();
  ring.forEach((ll, i) => {
    const q = f.L(ll);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke !== undefined) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

/** Jitter a lon/lat by up to d degrees, deterministically. */
export function jitter(ll: LonLat, d: number, seed: number, i: number): LonLat {
  return [ll[0] + (hash01(seed, i * 2 + 1) - 0.5) * 2 * d, ll[1] + (hash01(seed, i * 2 + 2) - 0.5) * 2 * d];
}

// ---------------------------------------------------------------------------
// text
// ---------------------------------------------------------------------------

export function label(f: Frame, text: string, p: Pt, color = INK, size = 11, weight = 600): void {
  const { ctx } = f;
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.94)";
  ctx.strokeText(text, p.x, p.y);
  ctx.fillStyle = color;
  ctx.fillText(text, p.x, p.y);
}

/** Rounded pill caption (scene titles, tallies). */
export function pill(f: Frame, text: string, p: Pt, bg: string, fg = "#FFFFFF", alpha = 1, size = 12): void {
  const { ctx } = f;
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `600 ${size}px ${SANS}`;
  const w = ctx.measureText(text).width + 18;
  const h = size + 10;
  const x = p.x - w / 2;
  const y = p.y - h / 2;
  ctx.fillStyle = "rgba(40,32,20,0.18)";
  roundRect(ctx, x + 1, y + 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, p.x, p.y + 0.5);
  ctx.restore();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

export function puff(ctx: CanvasRenderingContext2D, p: Pt, r: number, color: string): void {
  if (r <= 0.1) return;
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function withXf(ctx: CanvasRenderingContext2D, p: Pt, angle: number, scale: number, draw: () => void): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  draw();
  ctx.restore();
}

/** An extruded box: footprint centered at p (ground), height h px. */
export function box(ctx: CanvasRenderingContext2D, p: Pt, w: number, d: number, h: number, top: string, front: string, side: string, shadow = true): void {
  if (shadow && h > 0.5) {
    ctx.fillStyle = SHADOW;
    ctx.beginPath();
    ctx.moveTo(p.x - w / 2, p.y + d / 2);
    ctx.lineTo(p.x + w / 2, p.y + d / 2);
    ctx.lineTo(p.x + w / 2 + h * 0.55, p.y + d / 2 + h * 0.3);
    ctx.lineTo(p.x - w / 2 + h * 0.55, p.y - d / 2 + h * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = front;
  ctx.fillRect(p.x - w / 2, p.y + d / 2 - h, w, h);
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(p.x + w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2);
  ctx.lineTo(p.x + w / 2, p.y + d / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.lineTo(p.x - w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.closePath();
  ctx.fill();
}

/** A small house with a pitched roof (villages, settlements, kibbutzim). */
export function house(ctx: CanvasRenderingContext2D, p: Pt, s: number, roof: string, wall = "#EFE7D6", burnt = 0): void {
  const w = 3.2 * s;
  const h = 2 * s;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(p.x - w / 2 + h * 0.4, p.y - 0.2 * s, w, 1.2 * s);
  ctx.fillStyle = burnt > 0 ? mixHex(wall, "#3A332C", burnt) : wall;
  ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = burnt > 0 ? mixHex(roof, "#221E1A", burnt) : roof;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2 - 0.4 * s, p.y - h);
  ctx.lineTo(p.x, p.y - h - 1.5 * s);
  ctx.lineTo(p.x + w / 2 + 0.4 * s, p.y - h);
  ctx.closePath();
  ctx.fill();
}

export function mixHex(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(lerp(v, pb[i], clamp01(k))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---------------------------------------------------------------------------
// effects (all driven by an explicit age in seconds)
// ---------------------------------------------------------------------------

/** Detonation: flash, fireball, shock ring, then a leaning smoke column. */
export function explosion(f: Frame, p: Pt, age: number, size: number, seed: number, smokeFor = 8): void {
  const { ctx, u } = f;
  if (age < 0) return;
  const s = size * u;
  if (age < 0.25) puff(ctx, p, (6 + age * 60) * s, `rgba(255,248,220,${(1 - age / 0.25).toFixed(3)})`);
  if (age < 1.1) {
    puff(ctx, { x: p.x, y: p.y - age * 3 * s }, (4 + age * 10) * s, `rgba(255,150,50,${(0.95 * (1 - age / 1.1)).toFixed(3)})`);
    puff(ctx, { x: p.x, y: p.y - age * 3 * s }, (2 + age * 5) * s, `rgba(255,230,150,${(1 - age / 1.1).toFixed(3)})`);
  }
  if (age < 0.9) {
    ctx.strokeStyle = `rgba(120,90,60,${(0.6 * (1 - age / 0.9)).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (3 + age * 26) * s, (1.6 + age * 13) * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // debris specks
  if (age < 1.4) {
    ctx.fillStyle = `rgba(60,48,36,${(1 - age / 1.4).toFixed(3)})`;
    for (let i = 0; i < 7; i++) {
      const ang = hash01(seed, i) * Math.PI * 2;
      const v = 8 + hash01(seed, i + 20) * 10;
      const x = p.x + Math.cos(ang) * v * age * s;
      const y = p.y + Math.sin(ang) * v * 0.5 * age * s - (12 * age - 14 * age * age) * s;
      ctx.fillRect(x, y, 1.1 * s, 1.1 * s);
    }
  }
  smokeColumn(f, p, age - 0.3, s, seed, smokeFor);
}

/** A rising, wind-leaning smoke column (wind toward the east). */
export function smokeColumn(f: Frame, p: Pt, age: number, s: number, seed: number, life: number, dark = 0.42): void {
  const { ctx } = f;
  if (age < 0 || age > life) return;
  const fade = 1 - smooth(life * 0.6, life, age);
  for (let j = 0; j < 9; j++) {
    const k = (j / 9) * Math.min(1, age / 2.5);
    const drift = (hash01(seed, j + 40) - 0.35) * 4 * s;
    const q = { x: p.x + k * 16 * s + drift * k, y: p.y - k * 34 * s };
    const g = Math.round(lerp(70, 150, k));
    puff(ctx, q, (2.5 + k * 9) * s, `rgba(${g},${g - 6},${g - 12},${(dark * (1 - k * 0.8) * fade).toFixed(3)})`);
  }
}

/** Flickering fire (scene-time driven). */
export function fire(f: Frame, p: Pt, t: number, s: number, seed: number, alpha = 1): void {
  const { ctx } = f;
  if (alpha <= 0) return;
  for (let i = 0; i < 3; i++) {
    const fl = 0.75 + 0.25 * Math.sin(t * (9 + i * 3) + seed + i);
    puff(ctx, { x: p.x + (i - 1) * 1.6 * s, y: p.y - (1 + i % 2) * s }, (2.2 + (i === 1 ? 1 : 0)) * s * fl, `rgba(255,${120 + i * 30},40,${(0.9 * alpha).toFixed(3)})`);
  }
}

/** Static burn scar (no animation): scorched ground and a smudge. */
export function scorch(f: Frame, p: Pt, s: number, strength: number): void {
  const { ctx } = f;
  puff(ctx, p, 7 * s, `rgba(50,40,32,${(0.35 * strength).toFixed(3)})`);
  puff(ctx, { x: p.x + 2 * s, y: p.y - 1 * s }, 3.5 * s, `rgba(25,20,16,${(0.45 * strength).toFixed(3)})`);
}

/** Muzzle flash. */
export function flash(f: Frame, p: Pt, s: number, alpha = 1): void {
  puff(f.ctx, p, 3.2 * s, `rgba(255,220,120,${alpha.toFixed(3)})`);
}

/** A tracer burst from a to b at scene time t (blinks). */
export function tracer(f: Frame, a: Pt, b: Pt, t: number, seed: number, color = "rgba(255,190,60,0.95)"): void {
  const { ctx } = f;
  const phase = (t * 3 + hash01(seed, 1)) % 1;
  if (phase > 0.55) return;
  const k = phase / 0.55;
  const x0 = lerp(a.x, b.x, k);
  const y0 = lerp(a.y, b.y, k);
  const x1 = lerp(a.x, b.x, Math.min(1, k + 0.18));
  const y1 = lerp(a.y, b.y, Math.min(1, k + 0.18));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  if (phase < 0.12) flash(f, a, f.u * 0.6, 0.9);
}

/** Red-alert siren zone. */
export function sirenZone(f: Frame, p: Pt, t: number, r: number, alpha: number, text: string | null): void {
  const { ctx } = f;
  if (alpha <= 0) return;
  const pulse = 0.5 + 0.5 * Math.sin(t * 7);
  ctx.save();
  ctx.globalAlpha *= alpha;
  puff(ctx, p, r * (1.05 + 0.08 * pulse), `rgba(214,48,40,${(0.18 + 0.12 * pulse).toFixed(3)})`);
  for (let i = 0; i < 2; i++) {
    const k = ((t * 0.9 + i * 0.5) % 1);
    ctx.strokeStyle = `rgba(200,40,35,${(0.6 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (0.35 + k * 0.8), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (text !== null) label(f, text, { x: p.x, y: p.y - r - 4 }, "#B3302A", 10.5);
}

/** A 3D ballistic/rocket arc point: lifted by sin(πk)·H. */
export function arcPoint(a: Pt, b: Pt, k: number, H: number): { ground: Pt; air: Pt; alt: number } {
  const ground = { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
  const alt = Math.sin(Math.PI * clamp01(k)) * H;
  return { ground, air: { x: ground.x, y: ground.y - alt }, alt };
}

export function arcTrail(f: Frame, a: Pt, b: Pt, k0: number, k1: number, H: number, rgb: string, width: number): void {
  const { ctx } = f;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const ka = lerp(k0, k1, i / steps);
    const kb = lerp(k0, k1, (i + 1) / steps);
    const pa = arcPoint(a, b, ka, H).air;
    const pb = arcPoint(a, b, kb, H).air;
    ctx.strokeStyle = `rgba(${rgb},${(((i + 1) / steps) * 0.85).toFixed(3)})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
}

/** Mushroom cloud rising over `age` seconds. */
export function mushroom(f: Frame, p: Pt, age: number, s: number): void {
  const { ctx } = f;
  if (age < 0) return;
  const rise = smooth(0, 14, age);
  const H = (20 + 90 * rise) * s;
  // stem
  for (let i = 0; i < 10; i++) {
    const k = i / 10;
    const q = { x: p.x + k * 6 * s * rise, y: p.y - k * H };
    puff(ctx, q, (5 + k * 3) * s, `rgba(${Math.round(lerp(150, 120, k))},${Math.round(lerp(110, 100, k))},90,0.55)`);
  }
  // cap: rolling torus
  const cap = { x: p.x + 6 * s * rise, y: p.y - H };
  const cw = (14 + 34 * rise) * s;
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2 + age * 0.3;
    const q = { x: cap.x + Math.cos(ang) * cw, y: cap.y + Math.sin(ang) * cw * 0.35 };
    const lit = Math.sin(ang) < 0 ? 185 : 130;
    puff(ctx, q, cw * 0.55, `rgba(${lit},${lit - 30},${lit - 55},0.55)`);
  }
  puff(ctx, { x: cap.x - cw * 0.2, y: cap.y - cw * 0.2 }, cw * 0.7, "rgba(230,200,160,0.5)");
  if (age < 4) puff(ctx, { x: cap.x, y: cap.y + cw * 0.2 }, cw * 0.8, `rgba(255,170,70,${(0.7 * (1 - age / 4)).toFixed(3)})`);
}

// ---------------------------------------------------------------------------
// aircraft
// ---------------------------------------------------------------------------

function jetPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(3, -0.9);
  ctx.lineTo(0.5, -1);
  ctx.lineTo(-1.5, -5.2);
  ctx.lineTo(-3, -5.2);
  ctx.lineTo(-2.2, -1.1);
  ctx.lineTo(-4.2, -1);
  ctx.lineTo(-5.5, -2.8);
  ctx.lineTo(-6.3, -2.8);
  ctx.lineTo(-5.8, -0.6);
  ctx.lineTo(-6.2, 0);
  ctx.lineTo(-5.8, 0.6);
  ctx.lineTo(-6.3, 2.8);
  ctx.lineTo(-5.5, 2.8);
  ctx.lineTo(-4.2, 1);
  ctx.lineTo(-2.2, 1.1);
  ctx.lineTo(-3, 5.2);
  ctx.lineTo(-1.5, 5.2);
  ctx.lineTo(0.5, 1);
  ctx.lineTo(3, 0.9);
  ctx.closePath();
}

/** Fighter jet (F-35I / F-15I style). */
export function jet(f: Frame, ground: Pt, heading: number, alt: number, t: number, burner: boolean): void {
  const { ctx, u } = f;
  const sc = 1.05 * u;
  const lift = alt * u;
  withXf(ctx, { x: ground.x + lift * 0.55, y: ground.y + lift * 0.3 }, heading, sc, () => {
    jetPath(ctx);
    ctx.fillStyle = "rgba(40,34,24,0.17)";
    ctx.fill();
  });
  withXf(ctx, { x: ground.x, y: ground.y - lift }, heading, sc, () => {
    if (burner) puff(ctx, { x: -7, y: 0 }, 2.6 * (0.75 + 0.25 * Math.sin(t * 40)), "rgba(255,160,60,0.9)");
    jetPath(ctx);
    const g = ctx.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, STEEL_LIGHT);
    g.addColorStop(0.5, STEEL);
    g.addColorStop(1, STEEL_DARK);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(30,34,40,0.75)";
    ctx.lineWidth = 0.35;
    ctx.stroke();
    ctx.fillStyle = "#2E4A66";
    ctx.beginPath();
    ctx.ellipse(3.6, 0, 1.4, 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Airliner (white, blue cheatline) or transport (grey C-17). */
export function airliner(f: Frame, ground: Pt, heading: number, alt: number, kind: "airliner" | "transport" | "tanker" = "airliner"): void {
  const { ctx, u } = f;
  const sc = (kind === "airliner" ? 1.15 : 1.35) * u;
  const lift = alt * u;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.quadraticCurveTo(8.6, -1.2, 7, -1.2);
    ctx.lineTo(-7, -1.1);
    ctx.lineTo(-9, -0.4);
    ctx.lineTo(-9, 0.4);
    ctx.lineTo(-7, 1.1);
    ctx.lineTo(7, 1.2);
    ctx.quadraticCurveTo(8.6, 1.2, 9, 0);
    ctx.closePath();
    const sweep = kind === "transport" ? 1.5 : 3.5;
    ctx.moveTo(2, -1);
    ctx.lineTo(2 - sweep, -9);
    ctx.lineTo(0.5 - sweep, -9);
    ctx.lineTo(-2, -1);
    ctx.closePath();
    ctx.moveTo(2, 1);
    ctx.lineTo(2 - sweep, 9);
    ctx.lineTo(0.5 - sweep, 9);
    ctx.lineTo(-2, 1);
    ctx.closePath();
    ctx.moveTo(-6.5, -0.8);
    ctx.lineTo(-8.6, -3.8);
    ctx.lineTo(-9.3, -3.8);
    ctx.lineTo(-8.6, -0.6);
    ctx.closePath();
    ctx.moveTo(-6.5, 0.8);
    ctx.lineTo(-8.6, 3.8);
    ctx.lineTo(-9.3, 3.8);
    ctx.lineTo(-8.6, 0.6);
    ctx.closePath();
  };
  withXf(ctx, { x: ground.x + lift * 0.55, y: ground.y + lift * 0.3 }, heading, sc, () => {
    shape();
    ctx.fillStyle = `rgba(40,34,24,${(0.26 - Math.min(0.1, alt / 300)).toFixed(3)})`;
    ctx.fill();
  });
  withXf(ctx, { x: ground.x, y: ground.y - lift }, heading, sc, () => {
    shape();
    ctx.fillStyle = kind === "airliner" ? "#FBFBFA" : kind === "tanker" ? "#C9CDD2" : "#8B949E";
    ctx.fill();
    ctx.strokeStyle = "rgba(30,40,56,0.95)";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    if (kind === "airliner") {
      ctx.fillStyle = "#1F3F8A";
      ctx.fillRect(-6.5, -0.25, 13, 0.5);
      ctx.fillRect(-9, -0.35, 2.2, 0.7);
    }
    ctx.fillStyle = "#5B6573";
    const e = kind === "transport" ? [[-0.2, -3.3], [-0.6, -6.2], [-0.2, 2.3], [-0.6, 5.2]] : [[-0.9, -4.8], [-0.9, 3.8]];
    for (const [x, y] of e) ctx.fillRect(x, y, 2.2, 1);
  });
}

/** Attack helicopter (Apache) with a spinning rotor. */
export function helicopter(f: Frame, ground: Pt, heading: number, alt: number, t: number): void {
  const { ctx, u } = f;
  const sc = 0.95 * u;
  const lift = alt * u;
  withXf(ctx, { x: ground.x + lift * 0.55, y: ground.y + lift * 0.3 }, heading, sc, () => {
    ctx.fillStyle = "rgba(40,34,24,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  withXf(ctx, { x: ground.x, y: ground.y - lift }, heading, sc, () => {
    ctx.fillStyle = "#4F5A3A";
    ctx.beginPath();
    ctx.ellipse(1, 0, 3.6, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-7, -0.35, 6, 0.7);
    ctx.fillRect(-7.2, -1.6, 0.8, 3.2);
    ctx.fillStyle = "#2E3A4A";
    ctx.beginPath();
    ctx.ellipse(3, 0, 1.2, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(60,60,60,0.12)";
    ctx.beginPath();
    ctx.arc(0.5, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(35,35,35,0.75)";
    ctx.lineWidth = 0.45;
    const r = t * 25;
    for (let i = 0; i < 2; i++) {
      const a = r + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(0.5 + Math.cos(a) * 6.5, Math.sin(a) * 6.5);
      ctx.lineTo(0.5 - Math.cos(a) * 6.5, -Math.sin(a) * 6.5);
      ctx.stroke();
    }
  });
}

/** Surveillance drone (Hermes/Heron): long straight wings, V-tail. */
export function drone(f: Frame, ground: Pt, heading: number, alt: number, hostile = false): void {
  const { ctx, u } = f;
  const sc = 0.9 * u;
  const lift = alt * u;
  const shape = () => {
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-4, -0.45);
    ctx.lineTo(-4, 0.45);
    ctx.closePath();
    ctx.moveTo(0.8, -7);
    ctx.lineTo(1.6, -7);
    ctx.lineTo(1.6, 7);
    ctx.lineTo(0.8, 7);
    ctx.closePath();
    ctx.moveTo(-3.4, 0);
    ctx.lineTo(-4.6, -2);
    ctx.lineTo(-4.2, 0);
    ctx.lineTo(-4.6, 2);
    ctx.closePath();
  };
  withXf(ctx, { x: ground.x + lift * 0.55, y: ground.y + lift * 0.3 }, heading, sc, () => {
    shape();
    ctx.fillStyle = "rgba(40,34,24,0.15)";
    ctx.fill();
  });
  withXf(ctx, { x: ground.x, y: ground.y - lift }, heading, sc, () => {
    shape();
    ctx.fillStyle = hostile ? "#5A4A3A" : "#A7AFB8";
    ctx.fill();
    ctx.strokeStyle = "rgba(40,40,40,0.8)";
    ctx.lineWidth = 0.35;
    ctx.stroke();
  });
}

/** A falling bomb with its shadow converging on the aim point. */
export function fallingBomb(f: Frame, target: Pt, k: number, dropAlt: number): void {
  const { ctx, u } = f;
  const alt = (1 - k * k) * dropAlt * u;
  ctx.fillStyle = "rgba(40,34,24,0.3)";
  ctx.beginPath();
  ctx.arc(target.x + alt * 0.55, target.y + alt * 0.3, 0.9 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2B2B2B";
  ctx.beginPath();
  ctx.ellipse(target.x, target.y - alt, 0.6 * u, 1.3 * u, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// ground vehicles
// ---------------------------------------------------------------------------

export type VehicleKind = "tank" | "apc" | "dozer" | "howitzer" | "truck" | "bus" | "humvee" | "police" | "ambulance" | "un" | "water_cannon" | "transporter" | "egypt_tank" | "tel" | "car";

const VEHICLE_SIZE: Record<VehicleKind, [number, number]> = {
  tank: [12, 7.2], apc: [11, 6.4], dozer: [10, 6.6], howitzer: [11, 6], truck: [10, 4.6], bus: [12, 4.4], humvee: [7, 4.2],
  police: [7, 3.8], ambulance: [8, 4], un: [7.5, 4.2], water_cannon: [10, 5], transporter: [18, 5], egypt_tank: [12, 7.2], tel: [16, 5], car: [5.5, 3],
};

/** Top-down vehicle with height cues; turret aims along `turret` if given. */
export function vehicle(f: Frame, p: Pt, heading: number, kind: VehicleKind, t: number, moving: boolean, turret?: number, seed = 0): void {
  const { ctx, u } = f;
  const sc = 0.82 * u;
  const [L, W] = VEHICLE_SIZE[kind];
  if (moving && kind !== "car" && kind !== "bus" && kind !== "police" && kind !== "ambulance") {
    for (let j = 0; j < 4; j++) {
      const age = (t * 1.6 + j / 4 + seed * 0.1) % 1;
      const back = { x: p.x - Math.cos(heading) * (L / 2 + age * 10) * sc, y: p.y - Math.sin(heading) * (L / 2 + age * 10) * sc };
      puff(ctx, back, (2 + age * 5) * sc, `rgba(185,160,120,${(0.32 * (1 - age)).toFixed(3)})`);
    }
  }
  withXf(ctx, { x: p.x + 1.6 * sc, y: p.y + 1.2 * sc }, heading, sc, () => {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(-L / 2, -W / 2, L, W);
  });
  withXf(ctx, p, heading, sc, () => {
    const hull = (body: string, dark: string, light: string) => {
      ctx.fillStyle = dark;
      ctx.fillRect(-L / 2, -W / 2 + 0.4, L, W - 0.2);
      ctx.fillStyle = body;
      ctx.fillRect(-L / 2, -W / 2, L, W - 0.6);
      ctx.fillStyle = light;
      ctx.fillRect(-L / 2, -W / 2, L, 0.7);
    };
    const tracks = () => {
      ctx.fillStyle = "#3A3A32";
      ctx.fillRect(-L / 2, -W / 2 - 0.3, L, 1.5);
      ctx.fillRect(-L / 2, W / 2 - 1.2, L, 1.5);
      if (moving) {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 0.25;
        const off = (t * 6) % 1.2;
        for (let x = -L / 2 + off; x < L / 2; x += 1.2) {
          ctx.beginPath();
          ctx.moveTo(x, -W / 2 - 0.3);
          ctx.lineTo(x, -W / 2 + 1.2);
          ctx.moveTo(x, W / 2 - 1.2);
          ctx.lineTo(x, W / 2 + 0.3);
          ctx.stroke();
        }
      }
    };
    switch (kind) {
      case "tank":
      case "egypt_tank": {
        const desert = kind === "egypt_tank";
        tracks();
        hull(desert ? "#B09A6A" : OLIVE, desert ? "#8A7650" : OLIVE_DARK, desert ? "#CDB98A" : OLIVE_LIGHT);
        break;
      }
      case "apc":
        tracks();
        hull(OLIVE, OLIVE_DARK, OLIVE_LIGHT);
        ctx.fillStyle = OLIVE_DARK;
        ctx.fillRect(-1, -1, 2.6, 2);
        break;
      case "howitzer":
        tracks();
        hull(OLIVE, OLIVE_DARK, OLIVE_LIGHT);
        ctx.fillStyle = OLIVE_DARK;
        ctx.fillRect(-2.5, -2, 5, 4);
        break;
      case "dozer":
        tracks();
        hull("#6D6A45", "#4E4C30", "#8C8A5C");
        ctx.fillStyle = "#3D3C28";
        ctx.fillRect(L / 2, -W / 2 - 0.8, 1.4, W + 1.6);
        ctx.fillStyle = "#2E3A4A";
        ctx.fillRect(-2.5, -1.4, 2.4, 2.8);
        break;
      case "truck":
      case "transporter":
        ctx.fillStyle = "#2C2C2C";
        for (const x of [-L / 2 + 1.5, -L / 2 + 3.5, L / 2 - 2]) {
          ctx.fillRect(x, -W / 2 - 0.4, 1.2, 0.8);
          ctx.fillRect(x, W / 2 - 0.4, 1.2, 0.8);
        }
        hull(kind === "transporter" ? "#5C5F55" : OLIVE, OLIVE_DARK, OLIVE_LIGHT);
        ctx.fillStyle = "#2E3A4A";
        ctx.fillRect(L / 2 - 2.6, -W / 2 + 0.6, 1.6, W - 1.8);
        if (kind === "transporter") {
          ctx.fillStyle = OLIVE;
          ctx.fillRect(-L / 2 + 1, -2.2, 10, 4);
          ctx.fillStyle = OLIVE_DARK;
          ctx.fillRect(-L / 2 + 4, -1, 5, 2);
        }
        break;
      case "bus":
        hull("#F2F0EA", "#C9C5BA", "#FFFFFF");
        ctx.fillStyle = "#2E6FB8";
        ctx.fillRect(-L / 2, -0.4, L, 0.8);
        break;
      case "humvee":
        hull("#6E7450", "#4F5438", "#8D946A");
        ctx.fillStyle = "#2E3A4A";
        ctx.fillRect(0.5, -1.4, 1.6, 2.8);
        break;
      case "police":
      case "ambulance": {
        hull("#F7F7F5", "#CFCFCB", "#FFFFFF");
        const blink = Math.floor(t * 6) % 2 === 0;
        ctx.fillStyle = kind === "police" ? (blink ? "#1F5FD6" : "#E23B3B") : "#E23B3B";
        ctx.fillRect(-0.8, -1.2, 1.6, 2.4);
        if (kind === "police") {
          ctx.fillStyle = "#1F4FB0";
          ctx.fillRect(-L / 2, -0.35, L, 0.7);
        }
        if (moving || blink) puff(ctx, { x: 0, y: 0 }, 3, kind === "police" ? (blink ? "rgba(31,95,214,0.35)" : "rgba(226,59,59,0.35)") : "rgba(226,59,59,0.3)");
        break;
      }
      case "un":
        hull("#FFFFFF", "#D2D6DC", "#FFFFFF");
        ctx.fillStyle = "#1E6FB8";
        ctx.font = `700 2.2px ${SANS}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("UN", 0, 0.2);
        break;
      case "water_cannon":
        hull("#DADCD8", "#B0B3AE", "#F0F1EE");
        ctx.fillStyle = "#1F4FB0";
        ctx.fillRect(1, -1, 2, 2);
        break;
      case "tel":
        ctx.fillStyle = "#2C2C2C";
        for (let x = -L / 2 + 1; x < L / 2 - 1; x += 3) {
          ctx.fillRect(x, -W / 2 - 0.4, 1.2, 0.8);
          ctx.fillRect(x, W / 2 - 0.4, 1.2, 0.8);
        }
        hull("#7A7456", "#5C573F", "#958F6E");
        break;
      case "car":
        hull(["#8A2E2A", "#2C3E55", "#D8D4CA", "#5A6B3A", "#B0892E"][seed % 5], "#555555", "#EEEEEE");
        break;
    }
  });
  if (turret !== undefined && (kind === "tank" || kind === "egypt_tank" || kind === "howitzer")) {
    const desert = kind === "egypt_tank";
    withXf(ctx, { x: p.x - Math.cos(heading) * 0.8 * sc, y: p.y - Math.sin(heading) * 0.8 * sc - 0.8 * sc }, turret, sc, () => {
      ctx.fillStyle = desert ? "#6E5E3E" : OLIVE_DARK;
      ctx.fillRect(1.5, -0.35, kind === "howitzer" ? 10 : 7.5, 0.7);
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.lineTo(0.5, -2.2);
      ctx.lineTo(-3, -2.2);
      ctx.lineTo(-3.2, 2.2);
      ctx.lineTo(0.5, 2.2);
      ctx.closePath();
      ctx.fillStyle = desert ? "#B09A6A" : OLIVE;
      ctx.fill();
      ctx.fillStyle = desert ? "#CDB98A" : OLIVE_LIGHT;
      ctx.fillRect(-2.6, -2, 2.4, 1);
    });
  }
}

/** A missile raised on a TEL (Iranian launch preparation), height 0–1. */
export function raisedMissile(f: Frame, p: Pt, raise: number): void {
  const { ctx, u } = f;
  const len = 11 * u;
  const ang = -Math.PI / 2 * raise;
  const tip = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len };
  ctx.strokeStyle = SHADOW;
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + len * 0.55 * raise + len * (1 - raise), p.y + len * 0.3 * raise);
  ctx.stroke();
  ctx.strokeStyle = "#D8D2C0";
  ctx.lineWidth = 1.8 * u;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = "#8A2E2A";
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 1 * u, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// ships
// ---------------------------------------------------------------------------

export type ShipKind = "cargo" | "tanker" | "corvette" | "carrier" | "destroyer" | "skiff" | "fishing" | "ferry";

export function ship(f: Frame, p: Pt, heading: number, kind: ShipKind, moving: boolean, seed: number, burning = 0, t = 0): void {
  const { ctx, u } = f;
  const size = { cargo: 1.2, tanker: 1.2, corvette: 0.8, carrier: 2.1, destroyer: 1.05, skiff: 0.4, fishing: 0.45, ferry: 0.75 }[kind] * u;
  if (moving) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    const len = 22 * size;
    const g = ctx.createLinearGradient(-6 * size, 0, -6 * size - len, 0);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.1 * size;
    ctx.beginPath();
    ctx.moveTo(-5 * size, -1.5 * size);
    ctx.lineTo(-5 * size - len, -5 * size);
    ctx.moveTo(-5 * size, 1.5 * size);
    ctx.lineTo(-5 * size - len, 5 * size);
    ctx.stroke();
    ctx.restore();
  }
  withXf(ctx, { x: p.x + 1.2 * size, y: p.y + 1.4 * size }, heading, size, () => {
    ctx.fillStyle = "rgba(30,60,80,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  withXf(ctx, p, heading, size, () => {
    const hull = (w: number, l: number) => {
      ctx.beginPath();
      ctx.moveTo(l, 0);
      ctx.quadraticCurveTo(l * 0.6, -w, l * 0.2, -w);
      ctx.lineTo(-l, -w);
      ctx.lineTo(-l, w);
      ctx.lineTo(l * 0.2, w);
      ctx.quadraticCurveTo(l * 0.6, w, l, 0);
      ctx.closePath();
    };
    if (kind === "cargo" || kind === "tanker") {
      hull(2, 7);
      ctx.fillStyle = kind === "tanker" ? "#8A2E2A" : "#2C3E55";
      ctx.fill();
      ctx.fillStyle = kind === "tanker" ? "#9DA39A" : "#394C64";
      ctx.fillRect(-6.5, -1.5, 11, 3);
      if (kind === "cargo") {
        const cols = ["#C8543C", "#2F6FB8", "#D9A62A", "#3C8A5A", "#E3E0D6"];
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = cols[Math.floor(hash01(seed, i * 2 + j) * cols.length)];
            ctx.fillRect(-4.3 + i * 1.45, -1.3 + j * 1.35, 1.3, 1.2);
          }
        }
      }
      ctx.fillStyle = "#F4F2EC";
      ctx.fillRect(-6.4, -1.4, 1.6, 2.8);
    } else if (kind === "carrier") {
      ctx.beginPath();
      ctx.moveTo(8, -1.2);
      ctx.lineTo(6, -2.6);
      ctx.lineTo(-7.5, -2.6);
      ctx.lineTo(-8, 2.2);
      ctx.lineTo(3, 2.2);
      ctx.lineTo(8, 1);
      ctx.closePath();
      ctx.fillStyle = "#6E7784";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 0.18;
      ctx.setLineDash([0.6, 0.5]);
      ctx.beginPath();
      ctx.moveTo(-7.5, 0.6);
      ctx.lineTo(7, -0.4);
      ctx.moveTo(-3, 1.8);
      ctx.lineTo(4, -1.8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#4C5563";
      ctx.fillRect(0, 1.5, 2.2, 1.2);
      ctx.fillStyle = "#AEB6C0";
      for (let i = 0; i < 4; i++) ctx.fillRect(-6.5 + i * 1.3, -2.2, 0.8, 0.6);
    } else if (kind === "corvette" || kind === "destroyer") {
      hull(1.5, 7);
      ctx.fillStyle = STEEL;
      ctx.fill();
      ctx.fillStyle = STEEL_LIGHT;
      ctx.fillRect(-2.5, -1, 4, 2);
      ctx.fillStyle = STEEL_DARK;
      ctx.beginPath();
      ctx.arc(4.2, 0, 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(4.2, -0.15, 1.8, 0.3);
    } else if (kind === "ferry") {
      hull(2, 6);
      ctx.fillStyle = "#F2EFE6";
      ctx.fill();
      ctx.fillStyle = "#3B6E8F";
      ctx.fillRect(-4, -1.2, 7, 2.4);
    } else {
      hull(1.6, 6);
      ctx.fillStyle = kind === "skiff" ? "#3A3A36" : "#E7E0CF";
      ctx.fill();
      ctx.fillStyle = kind === "skiff" ? "#1E1E1C" : "#3F6F8F";
      ctx.fillRect(-2.5, -0.8, 2.5, 1.6);
    }
  });
  if (burning > 0) {
    smokeColumn(f, p, 3, u * 1.1, seed, 1e9, 0.5 * burning);
    fire(f, p, t, u * 1.2, seed, burning);
  }
}

/** Offshore gas rig with a steady (static) flare. */
export function rig(f: Frame, p: Pt): void {
  const { ctx, u } = f;
  const k = 1.1 * u;
  ctx.strokeStyle = "#5C6470";
  ctx.lineWidth = 0.7 * k;
  for (const [dx, dy] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) {
    ctx.beginPath();
    ctx.moveTo(p.x + dx * k, p.y + dy * k);
    ctx.lineTo(p.x + dx * k, p.y + dy * k - 3 * k);
    ctx.stroke();
  }
  box(ctx, { x: p.x, y: p.y - 3 * k }, 5 * k, 3 * k, 1.8 * k, "#D8DCE1", "#9AA3AE", "#7B8591");
  ctx.strokeStyle = "#C8543C";
  ctx.lineWidth = 0.6 * k;
  ctx.beginPath();
  ctx.moveTo(p.x + 2 * k, p.y - 5 * k);
  ctx.lineTo(p.x + 4.5 * k, p.y - 9 * k);
  ctx.stroke();
  puff(ctx, { x: p.x + 4.8 * k, y: p.y - 10 * k }, 2.4 * k, "rgba(255,150,50,0.9)");
}

/** Port gantry crane (static). */
export function crane(f: Frame, p: Pt, s: number): void {
  const { ctx } = f;
  ctx.strokeStyle = SHADOW;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + 6 * s, p.y + 3.2 * s);
  ctx.stroke();
  ctx.strokeStyle = "#C8543C";
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(p.x - 1.5 * s, p.y);
  ctx.lineTo(p.x - 1.5 * s, p.y - 9 * s);
  ctx.moveTo(p.x + 1.5 * s, p.y);
  ctx.lineTo(p.x + 1.5 * s, p.y - 9 * s);
  ctx.moveTo(p.x - 4 * s, p.y - 9 * s);
  ctx.lineTo(p.x + 6 * s, p.y - 9 * s);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------

export interface PersonStyle {
  color: string;
  armed?: boolean;
  flag?: string | null;
  down?: boolean;
  /** hands up / sign board */ sign?: string | null;
}

export function person(f: Frame, p: Pt, stride: number, st: PersonStyle): void {
  const { ctx } = f;
  const k = 0.8 * Math.min(f.u, 1.5);
  if (st.down === true) {
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 1.1 * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - 2.6 * k, p.y);
    ctx.lineTo(p.x + 2 * k, p.y - 0.4 * k);
    ctx.stroke();
    ctx.fillStyle = st.color;
    ctx.beginPath();
    ctx.arc(p.x + 2.8 * k, p.y - 0.5 * k, 0.9 * k, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sw = Math.sin(stride * Math.PI * 2) * 1.2 * k;
  ctx.fillStyle = "rgba(40,34,24,0.2)";
  ctx.beginPath();
  ctx.ellipse(p.x + 1.2 * k, p.y + 0.3 * k, 1.8 * k, 0.6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.color;
  ctx.lineCap = "round";
  ctx.lineWidth = 0.9 * k;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 2.6 * k);
  ctx.lineTo(p.x - sw, p.y);
  ctx.moveTo(p.x, p.y - 2.6 * k);
  ctx.lineTo(p.x + sw, p.y);
  ctx.moveTo(p.x, p.y - 2.6 * k);
  ctx.lineTo(p.x, p.y - 5.2 * k);
  ctx.stroke();
  ctx.fillStyle = st.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6.2 * k, 1 * k, 0, Math.PI * 2);
  ctx.fill();
  if (st.armed === true) {
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 0.55 * k;
    ctx.beginPath();
    ctx.moveTo(p.x - 1.2 * k, p.y - 3.2 * k);
    ctx.lineTo(p.x + 2.6 * k, p.y - 5 * k);
    ctx.stroke();
  }
  if (st.flag !== undefined && st.flag !== null) {
    ctx.strokeStyle = "#6A6A6A";
    ctx.lineWidth = 0.4 * k;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.8 * k, p.y - 4 * k);
    ctx.lineTo(p.x + 0.8 * k, p.y - 10 * k);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(p.x + 0.8 * k, p.y - 10 * k, 3.4 * k, 2.3 * k);
    ctx.fillStyle = st.flag;
    ctx.fillRect(p.x + 0.8 * k, p.y - 9.7 * k, 3.4 * k, 0.35 * k);
    ctx.fillRect(p.x + 0.8 * k, p.y - 8.2 * k, 3.4 * k, 0.35 * k);
  }
  if (st.sign !== undefined && st.sign !== null) {
    ctx.fillStyle = st.sign;
    ctx.fillRect(p.x - 2 * k, p.y - 10 * k, 4 * k, 2.4 * k);
    ctx.strokeStyle = "#6A6A6A";
    ctx.lineWidth = 0.35 * k;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 7.6 * k);
    ctx.lineTo(p.x, p.y - 5 * k);
    ctx.stroke();
  }
}

/** Minimal icons for diplomatic scenes. */
export function icon(f: Frame, p: Pt, kind: "gavel" | "envelope" | "recall" | "pen" | "lock" | "warning" | "money" | "ballot" | "chart_down", color: string, s: number): void {
  const { ctx } = f;
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5 * s;
  ctx.lineCap = "round";
  const x = p.x;
  const y = p.y;
  ctx.beginPath();
  switch (kind) {
    case "gavel":
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.7);
      ctx.fillRect(-4 * s, -2.2 * s, 5 * s, 3 * s);
      ctx.moveTo(-1.5 * s, 0.8 * s);
      ctx.lineTo(-1.5 * s, 5 * s);
      ctx.stroke();
      ctx.restore();
      ctx.moveTo(x - 4 * s, y + 5 * s);
      ctx.lineTo(x + 4 * s, y + 5 * s);
      ctx.stroke();
      break;
    case "envelope":
      ctx.strokeRect(x - 5 * s, y - 3.5 * s, 10 * s, 7 * s);
      ctx.moveTo(x - 5 * s, y - 3.5 * s);
      ctx.lineTo(x, y + 0.5 * s);
      ctx.lineTo(x + 5 * s, y - 3.5 * s);
      ctx.stroke();
      break;
    case "recall":
      ctx.moveTo(x - 3 * s, y + 5 * s);
      ctx.lineTo(x - 3 * s, y - 5 * s);
      ctx.stroke();
      ctx.fillRect(x - 3 * s, y - 5 * s, 7 * s, 4 * s);
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(x - 1 * s, y - 4.5 * s);
      ctx.lineTo(x + 2.5 * s, y - 1.5 * s);
      ctx.moveTo(x + 2.5 * s, y - 4.5 * s);
      ctx.lineTo(x - 1 * s, y - 1.5 * s);
      ctx.stroke();
      break;
    case "pen":
      ctx.moveTo(x - 4 * s, y + 4 * s);
      ctx.lineTo(x + 4 * s, y - 4 * s);
      ctx.stroke();
      ctx.moveTo(x - 5 * s, y + 5.5 * s);
      ctx.quadraticCurveTo(x, y + 2 * s, x + 5 * s, y + 5.5 * s);
      ctx.stroke();
      break;
    case "lock":
      ctx.fillRect(x - 4 * s, y - 1 * s, 8 * s, 6 * s);
      ctx.arc(x, y - 1 * s, 3 * s, Math.PI, 0);
      ctx.stroke();
      break;
    case "warning":
      ctx.moveTo(x, y - 5 * s);
      ctx.lineTo(x, y + 1 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y + 4 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "money":
      ctx.font = `700 ${11 * s}px ${SANS}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", x, y + 0.5);
      break;
    case "ballot":
      ctx.strokeRect(x - 4.5 * s, y - 1 * s, 9 * s, 6 * s);
      ctx.moveTo(x - 2 * s, y - 1 * s);
      ctx.lineTo(x - 1 * s, y - 6 * s);
      ctx.lineTo(x + 3 * s, y - 5 * s);
      ctx.lineTo(x + 2 * s, y - 1 * s);
      ctx.stroke();
      break;
    case "chart_down":
      ctx.moveTo(x - 5 * s, y - 4 * s);
      ctx.lineTo(x - 1.5 * s, y);
      ctx.lineTo(x + 1 * s, y - 2 * s);
      ctx.lineTo(x + 5 * s, y + 4 * s);
      ctx.stroke();
      break;
  }
  ctx.restore();
}
