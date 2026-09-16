/** The living map: a persistent, state-driven layer of small moving things
 *  drawn over the campaign and tactical maps — the separation barrier, city
 *  skylines, ships and gas rigs, patrolling tanks, fighter jets, airliners
 *  leaving Ben Gurion, rocket fire and Iron Dome interceptions, infiltrating
 *  squads, protest crowds. Everything is a pure function of real time plus the
 *  campaign state (flags + metrics), so nothing needs to be stepped or stored —
 *  except the barrier's demolition moment.
 *
 *  Pseudo-3D: light comes from the north-west; anything with height (aircraft,
 *  rockets, towers, the wall) is drawn lifted up the screen with a soft shadow
 *  cast on the ground below it. */

import { strategic } from "@engine";
import { BATTERIES, CITIES, project, toScreen, type Camera, type LonLat, type Pt } from "./geo";
import { hash01, hashString } from "./scenarios";

type Flags = strategic.CampaignFlags;
type Metrics = strategic.SimulationMetrics;

export interface AmbientWorld {
  flags: Flags;
  metrics: Metrics;
  atWar: boolean;
  track: strategic.PolicyTrack | null;
  /** false before the government is formed: quiet peacetime picture */ active: boolean;
}

export interface AmbientEnv {
  cam: Camera;
  w: number;
  h: number;
  nowMs: number;
  lang: "he" | "en";
  world: AmbientWorld;
}

export function ambientFromGame(game: strategic.CampaignState): AmbientWorld {
  const active = game.phase !== "party" && game.phase !== "coalition";
  return {
    flags: game.flags,
    metrics: game.sim.metrics,
    atWar: active && strategic.warOngoing(game),
    track: game.sim.activeTrack,
    active,
  };
}

// ---------------------------------------------------------------------------
// palette
// ---------------------------------------------------------------------------

const SANS = "Rubik, Heebo, system-ui, sans-serif";
const INK = "#1C2330";
const SHADOW = "rgba(40,34,24,0.22)";
const OLIVE = "#5F6B3E";
const OLIVE_DARK = "#454E2B";
const OLIVE_LIGHT = "#7C8A52";
const STEEL = "#6B7684";
const STEEL_DARK = "#4A5361";
const STEEL_LIGHT = "#9AA4B1";
const HOSTILE = "#2B2B2B";
const RED = "#C8372D";
const TEAL = "#0E8A94";

// ---------------------------------------------------------------------------
// geography (schematic)
// ---------------------------------------------------------------------------

/** West Bank separation barrier, including the Jerusalem envelope — schematic. */
const BARRIER: LonLat[] = [
  [35.52, 32.4], [35.4, 32.5], [35.3, 32.53], [35.18, 32.5], [35.07, 32.44], [35.02, 32.38], [34.99, 32.3], [34.98, 32.2],
  [35.02, 32.12], [35.05, 32.03], [35.02, 31.95], [35.05, 31.88], [35.13, 31.86], [35.22, 31.88], [35.3, 31.83], [35.28, 31.74],
  [35.2, 31.7], [35.12, 31.66], [35.05, 31.58], [34.97, 31.5], [34.93, 31.42], [35.0, 31.37], [35.15, 31.37], [35.3, 31.4], [35.45, 31.49],
];
const GAZA_FENCE: LonLat[] = [[34.27, 31.22], [34.4, 31.34], [34.53, 31.5], [34.565, 31.55], [34.49, 31.595]];

const KINNERET: LonLat[] = [[35.53, 32.84], [35.57, 32.89], [35.62, 32.885], [35.65, 32.84], [35.645, 32.76], [35.62, 32.71], [35.58, 32.71], [35.55, 32.76]];
const DEAD_SEA: LonLat[] = [[35.47, 31.77], [35.55, 31.76], [35.58, 31.6], [35.56, 31.45], [35.5, 31.28], [35.43, 31.13], [35.39, 31.2], [35.4, 31.4], [35.43, 31.58]];

const BEN_GURION: LonLat = [34.886, 32.009];
const NEVATIM: LonLat = [35.01, 31.21];
const RAMAT_DAVID: LonLat = [35.18, 32.66];
const IRON_DOME_NORTH: LonLat = [35.28, 32.95];

// ---------------------------------------------------------------------------
// small math
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const cycle = (s: number, period: number, phase: number) => (((s / period + phase) % 1) + 1) % 1;
const ping = (f: number) => (f < 0.5 ? f * 2 : 2 - f * 2);
const ease = (f: number) => f * f * (3 - 2 * f);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

interface Poly {
  pts: Pt[];
  cum: number[];
  len: number;
}
const polyCache = new Map<LonLat[], Poly>();
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

/** Map-unit point and heading at fraction f of a polyline. */
function along(path: LonLat[], f: number): { p: Pt; a: number } {
  const { pts, cum, len } = poly(path);
  const d = clamp01(f) * len;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (d - cum[i - 1]) / seg;
  const a = pts[i - 1];
  const b = pts[i];
  return { p: { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) }, a: Math.atan2(b.y - a.y, b.x - a.x) };
}

// ---------------------------------------------------------------------------
// frame context
// ---------------------------------------------------------------------------

interface F {
  ctx: CanvasRenderingContext2D;
  env: AmbientEnv;
  s: number;
  /** px per degree of latitude */ ppd: number;
  /** sprite scale */ u: number;
  S(p: Pt): Pt;
  L(ll: LonLat): Pt;
  on(p: Pt, m?: number): boolean;
  /** ground detail visibility */ ground: number;
  /** people visibility */ people: number;
  /** airborne / sea visibility */ far: number;
}

function frameOf(ctx: CanvasRenderingContext2D, env: AmbientEnv): F {
  const { cam, w, h } = env;
  const ppd = cam.scale * 100;
  const S = (p: Pt) => toScreen(p, cam, w, h);
  return {
    ctx, env, s: env.nowMs / 1000, ppd,
    u: Math.max(0.55, Math.min(2.4, ppd / 150)),
    S,
    L: (ll) => S(project(ll)),
    on: (p, m = 40) => p.x > -m && p.x < w + m && p.y > -m && p.y < h + m,
    ground: smooth(60, 105, ppd),
    people: smooth(95, 140, ppd),
    far: smooth(14, 40, ppd),
  };
}

function label(f: F, text: string, p: Pt, color = INK, size = 11): void {
  const { ctx } = f;
  ctx.font = `600 ${size}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(text, p.x, p.y);
  ctx.fillStyle = color;
  ctx.fillText(text, p.x, p.y);
}

function puff(ctx: CanvasRenderingContext2D, p: Pt, r: number, color: string): void {
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(0.1, r));
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// terrain: water bodies, relief, skylines, airport, barrier
// ---------------------------------------------------------------------------

function drawTerrain(f: F): void {
  const { ctx } = f;
  const a = smooth(40, 90, f.ppd);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  // lakes
  for (const lake of [KINNERET, DEAD_SEA]) {
    ctx.beginPath();
    lake.forEach((ll, i) => {
      const p = f.L(ll);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = lake === DEAD_SEA ? "#BFD6DA" : "#AFCBDD";
    ctx.fill();
    ctx.strokeStyle = "rgba(60,110,140,0.45)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

interface Tower {
  dx: number;
  dy: number;
  w: number;
  h: number;
  tone: number;
}
const skylineCache = new Map<string, Tower[]>();
function skyline(id: string, n: number, spread: number, hMin: number, hMax: number): Tower[] {
  const key = `${id}:${n}`;
  let t = skylineCache.get(key);
  if (t === undefined) {
    const seed = hashString(id);
    t = Array.from({ length: n }, (_, i) => {
      const ang = hash01(seed, i * 3 + 1) * Math.PI * 2;
      const rad = Math.sqrt(hash01(seed, i * 3 + 2)) * spread;
      const tall = hash01(seed, i * 3 + 3);
      return { dx: Math.cos(ang) * rad * 1.2, dy: Math.sin(ang) * rad * 0.8, w: 0.6 + hash01(seed, i + 91) * 0.6, h: lerp(hMin, hMax, tall * tall), tone: hash01(seed, i + 57) };
    }).sort((a, b) => a.dy - b.dy);
    skylineCache.set(key, t);
  }
  return t;
}

/** An extruded box: footprint centered at p (ground), height h px. */
function box(ctx: CanvasRenderingContext2D, p: Pt, w: number, d: number, h: number, top: string, front: string, side: string): void {
  // shadow on the ground, cast south-east
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y + d / 2);
  ctx.lineTo(p.x + w / 2, p.y + d / 2);
  ctx.lineTo(p.x + w / 2 + h * 0.55, p.y + d / 2 + h * 0.3);
  ctx.lineTo(p.x - w / 2 + h * 0.55, p.y - d / 2 + h * 0.3);
  ctx.closePath();
  ctx.fill();
  // front (south) face
  ctx.fillStyle = front;
  ctx.fillRect(p.x - w / 2, p.y + d / 2 - h, w, h);
  // east face
  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(p.x + w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2);
  ctx.lineTo(p.x + w / 2, p.y + d / 2);
  ctx.closePath();
  ctx.fill();
  // roof
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2, p.y + d / 2 - h);
  ctx.lineTo(p.x + w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.lineTo(p.x - w / 2 + d * 0.5, p.y - d / 2 - h);
  ctx.closePath();
  ctx.fill();
}

function drawCities(f: F): void {
  const { ctx } = f;
  const a = smooth(90, 150, f.ppd);
  if (a <= 0) return;
  const u = f.u;
  ctx.save();
  ctx.globalAlpha = a;
  const specs: Array<{ id: keyof typeof CITIES; n: number; spread: number; h: [number, number]; kind: "glass" | "stone" | "mixed" }> = [
    { id: "tel_aviv", n: 22, spread: 10, h: [4, 30], kind: "glass" },
    { id: "haifa", n: 12, spread: 8, h: [3, 16], kind: "mixed" },
    { id: "jerusalem", n: 16, spread: 9, h: [3, 9], kind: "stone" },
    { id: "beersheba", n: 9, spread: 7, h: [3, 11], kind: "mixed" },
    { id: "ashdod", n: 8, spread: 6, h: [3, 12], kind: "mixed" },
    { id: "netanya", n: 8, spread: 5, h: [4, 14], kind: "glass" },
    { id: "ashkelon", n: 6, spread: 5, h: [3, 10], kind: "mixed" },
    { id: "eilat", n: 6, spread: 5, h: [3, 9], kind: "mixed" },
  ];
  for (const sp of specs) {
    const c = f.L(CITIES[sp.id].pos);
    if (!f.on(c, 60)) continue;
    for (const t of skyline(sp.id, sp.n, sp.spread, sp.h[0], sp.h[1])) {
      const p = { x: c.x + t.dx * u, y: c.y + t.dy * u };
      const w = 3.2 * u * t.w;
      const hh = t.h * u * 0.8;
      if (sp.kind === "glass" || (sp.kind === "mixed" && t.tone > 0.55)) {
        const l = Math.round(lerp(150, 190, t.tone));
        box(ctx, p, w, w, hh, `rgb(${l + 40},${l + 50},${l + 60})`, `rgb(${l - 30},${l - 15},${l + 5})`, `rgb(${l - 60},${l - 45},${l - 25})`);
      } else {
        box(ctx, p, w, w, hh, "#EFE4CC", "#D6C49C", "#B9A57B");
      }
    }
    if (sp.id === "jerusalem") {
      // golden dome
      const p = { x: c.x + 2 * u, y: c.y - 3 * u };
      ctx.fillStyle = SHADOW;
      ctx.beginPath();
      ctx.ellipse(p.x + 3 * u, p.y + 1.5 * u, 3 * u, 1.4 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      box(ctx, { x: p.x, y: p.y + 1 * u }, 5 * u, 3 * u, 2.5 * u, "#8FB3C9", "#5E86A6", "#4B6E8A");
      const g = ctx.createRadialGradient(p.x - u, p.y - 4 * u, 0.3, p.x, p.y - 3 * u, 3 * u);
      g.addColorStop(0, "#FFF1B8");
      g.addColorStop(1, "#C9961E");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x + 0.8 * u, p.y - 1.5 * u, 2.2 * u, Math.PI, 0);
      ctx.fill();
    }
  }
  // Ben Gurion runways
  const bg = f.L(BEN_GURION);
  if (f.on(bg)) {
    ctx.strokeStyle = "rgba(70,74,82,0.75)";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(bg.x - 6 * u, bg.y + 3 * u);
    ctx.lineTo(bg.x + 6 * u, bg.y - 3 * u);
    ctx.moveTo(bg.x - 5 * u, bg.y - 3.5 * u);
    ctx.lineTo(bg.x + 4 * u, bg.y + 4 * u);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 0.4 * u;
    ctx.setLineDash([1.2 * u, 1.2 * u]);
    ctx.beginPath();
    ctx.moveTo(bg.x - 6 * u, bg.y + 3 * u);
    ctx.lineTo(bg.x + 6 * u, bg.y - 3 * u);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// barrier demolition memory (the one piece of state in this module)
const barrierMemo: { gone: boolean | null; at: number } = { gone: null, at: -1e12 };

function barrierGone(world: AmbientWorld): boolean {
  const fl = world.flags;
  return fl.annexationLaw || fl.paDismantled || fl.transferOrdered || world.track === "CONSERVATIVE_RIGHT_ANNEXATION" || world.track === "RADICAL_RIGHT_DEPORTATION";
}

const DEMOLISH_MS = 5000;

function drawWall(f: F, path: LonLat[], height: number, face: string, top: string, posts: boolean, gone: boolean, sinceMs: number): void {
  const { ctx, u } = f;
  const { len } = poly(path);
  const step = Math.max(0.5, 400 / f.ppd); // map units per sample (~4 px)
  const n = Math.max(8, Math.ceil(len / step));
  const k = gone ? clamp01(sinceMs / DEMOLISH_MS) : 1 - clamp01(sinceMs / DEMOLISH_MS);
  // with k = demolished fraction, sweeping from north to south
  const hPx = height * u;
  let prev: Pt | null = null;
  for (let i = 0; i <= n; i++) {
    const fi = i / n;
    const cur = f.S(along(path, fi).p);
    const dead = fi < k;
    if (prev !== null && !dead && (f.on(cur, 20) || f.on(prev, 20))) {
      // shadow
      ctx.strokeStyle = SHADOW;
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(prev.x + hPx * 0.5, prev.y + hPx * 0.25);
      ctx.lineTo(cur.x + hPx * 0.5, cur.y + hPx * 0.25);
      ctx.stroke();
      // face
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.lineTo(cur.x, cur.y - hPx);
      ctx.lineTo(prev.x, prev.y - hPx);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = top;
      ctx.lineWidth = Math.max(0.8, 0.9 * u);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y - hPx);
      ctx.lineTo(cur.x, cur.y - hPx);
      ctx.stroke();
      if (posts && i % 3 === 0) {
        ctx.strokeStyle = "rgba(60,60,60,0.55)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cur.x, cur.y);
        ctx.lineTo(cur.x, cur.y - hPx - 1.2 * u);
        ctx.stroke();
      }
    }
    // demolition front: dust and tumbling blocks
    if (sinceMs < DEMOLISH_MS + 3000 && Math.abs(fi - k) < 0.06 && (f.on(cur, 20))) {
      const seed = i * 7.13;
      for (let j = 0; j < 3; j++) {
        const age = (sinceMs / 1000 + hash01(seed, j)) % 1.2;
        puff(ctx, { x: cur.x + (hash01(seed, j + 5) - 0.5) * 8 * u, y: cur.y - age * 8 * u }, (3 + age * 6) * u, `rgba(170,150,120,${(0.35 * (1 - age / 1.2)).toFixed(3)})`);
      }
      ctx.fillStyle = face;
      ctx.fillRect(cur.x + (hash01(seed, 9) - 0.5) * 6 * u, cur.y - 1 * u, 1.5 * u, 1.2 * u);
    }
    // rubble where it stood
    if (dead && gone && i % 2 === 0 && f.on(cur, 10) && f.ppd > 110) {
      ctx.fillStyle = "rgba(150,142,128,0.5)";
      ctx.fillRect(cur.x + (hash01(i, 3) - 0.5) * 2 * u, cur.y + (hash01(i, 4) - 0.5) * 2 * u, 1.1 * u, 0.8 * u);
    }
    prev = dead ? null : cur;
  }
}

function drawBarriers(f: F): void {
  if (f.ground <= 0) return;
  const { ctx, env } = f;
  const gone = barrierGone(env.world);
  if (barrierMemo.gone === null) barrierMemo.gone = gone;
  else if (barrierMemo.gone !== gone) {
    barrierMemo.gone = gone;
    barrierMemo.at = env.nowMs;
  }
  const since = env.nowMs - barrierMemo.at;
  ctx.save();
  ctx.globalAlpha = f.ground;
  drawWall(f, GAZA_FENCE, 2.2, "rgba(120,118,110,0.85)", "#E9E4D8", true, false, 1e9);
  if (!gone || since < DEMOLISH_MS + 3000) drawWall(f, BARRIER, 3.2, "#A39D8F", "#DDD6C6", false, gone, since);
  else drawWall(f, BARRIER, 3.2, "#A39D8F", "#DDD6C6", false, true, 1e9);
  if (f.ppd > 120) {
    const mid = f.S(along(BARRIER, 0.28).p);
    const he = env.lang === "he";
    if (!gone) label(f, he ? "גדר ההפרדה" : "Separation barrier", { x: mid.x - 34 * f.u, y: mid.y + 4 }, "#6B6456", 10.5);
    else if (since < DEMOLISH_MS + 6000) label(f, he ? "הגדר מפורקת" : "Barrier torn down", { x: mid.x - 34 * f.u, y: mid.y + 4 }, RED, 11);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// sprites
// ---------------------------------------------------------------------------

function withXf(ctx: CanvasRenderingContext2D, p: Pt, angle: number, scale: number, draw: () => void): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  draw();
  ctx.restore();
}

/** Fighter jet, nose along +x, ~12 units long. */
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

function drawJet(f: F, ground: Pt, heading: number, alt: number, burner: boolean, color = STEEL): void {
  const { ctx, u } = f;
  const sc = 1.05 * u;
  const lift = alt * u;
  // shadow on the ground
  withXf(ctx, { x: ground.x + lift * 0.55, y: ground.y + lift * 0.3 }, heading, sc, () => {
    jetPath(ctx);
    ctx.fillStyle = "rgba(40,34,24,0.16)";
    ctx.fill();
  });
  const p = { x: ground.x, y: ground.y - lift };
  withXf(ctx, p, heading, sc, () => {
    if (burner) {
      const fl = 0.7 + 0.3 * Math.sin(f.s * 40);
      puff(ctx, { x: -7, y: 0 }, 2.6 * fl, "rgba(255,160,60,0.9)");
    }
    jetPath(ctx);
    const g = ctx.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, STEEL_LIGHT);
    g.addColorStop(0.5, color);
    g.addColorStop(1, STEEL_DARK);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(30,34,40,0.7)";
    ctx.lineWidth = 0.35;
    ctx.stroke();
    // canopy
    ctx.fillStyle = "#2E4A66";
    ctx.beginPath();
    ctx.ellipse(3.6, 0, 1.4, 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Airliner (white, El Al-style blue cheatline), nose along +x, ~18 units long. */
function drawAirliner(f: F, ground: Pt, heading: number, alt: number): void {
  const { ctx, u } = f;
  const sc = 1.15 * u;
  const lift = alt * u;
  const shape = () => {
    ctx.beginPath();
    // fuselage
    ctx.moveTo(9, 0);
    ctx.quadraticCurveTo(8.6, -1.1, 7, -1.1);
    ctx.lineTo(-7, -1);
    ctx.lineTo(-9, -0.4);
    ctx.lineTo(-9, 0.4);
    ctx.lineTo(-7, 1);
    ctx.lineTo(7, 1.1);
    ctx.quadraticCurveTo(8.6, 1.1, 9, 0);
    ctx.closePath();
    // wings
    ctx.moveTo(2, -1);
    ctx.lineTo(-3.5, -9);
    ctx.lineTo(-5, -9);
    ctx.lineTo(-2, -1);
    ctx.closePath();
    ctx.moveTo(2, 1);
    ctx.lineTo(-3.5, 9);
    ctx.lineTo(-5, 9);
    ctx.lineTo(-2, 1);
    ctx.closePath();
    // tailplane
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
    ctx.fillStyle = "#FBFBFA";
    ctx.fill();
    ctx.strokeStyle = "rgba(30,40,56,0.95)";
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.fillStyle = "rgba(190,198,210,0.9)";
    ctx.fillRect(-7, 0.2, 14, 0.8);
    ctx.stroke();
    // cheatline + engines + tail fin
    ctx.fillStyle = "#1F3F8A";
    ctx.fillRect(-6.5, -0.25, 13, 0.5);
    ctx.fillRect(-9, -0.35, 2.2, 0.7);
    ctx.fillStyle = "#7B8594";
    ctx.fillRect(-0.9, -4.8, 2.2, 1);
    ctx.fillRect(-0.9, 3.8, 2.2, 1);
  });
}

/** Merkava-style tank, top-down with a little height; hull along +x. */
function drawTank(f: F, p: Pt, heading: number, turret: number, moving: boolean, hostile = false): void {
  const { ctx, u, s } = f;
  const sc = 0.85 * u;
  const body = hostile ? "#6E6552" : OLIVE;
  const dark = hostile ? "#4E4838" : OLIVE_DARK;
  const light = hostile ? "#8E846C" : OLIVE_LIGHT;
  if (moving) {
    for (let j = 0; j < 4; j++) {
      const age = (s * 1.6 + j / 4) % 1;
      const back = { x: p.x - Math.cos(heading) * (6 + age * 10) * sc, y: p.y - Math.sin(heading) * (6 + age * 10) * sc };
      puff(ctx, back, (2 + age * 5) * sc, `rgba(185,160,120,${(0.35 * (1 - age)).toFixed(3)})`);
    }
  }
  withXf(ctx, { x: p.x + 1.6 * sc, y: p.y + 1.2 * sc }, heading, sc, () => {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(-6, -3.6, 12, 7.2);
  });
  withXf(ctx, p, heading, sc, () => {
    // tracks
    ctx.fillStyle = "#3A3A32";
    ctx.fillRect(-6, -3.8, 12, 1.6);
    ctx.fillRect(-6, 2.2, 12, 1.6);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.25;
    const off = moving ? (s * 6) % 1.2 : 0;
    for (let x = -6 + off; x < 6; x += 1.2) {
      ctx.beginPath();
      ctx.moveTo(x, -3.8);
      ctx.lineTo(x, -2.2);
      ctx.moveTo(x, 2.2);
      ctx.lineTo(x, 3.8);
      ctx.stroke();
    }
    // hull with a lit top edge (height cue)
    ctx.fillStyle = dark;
    ctx.fillRect(-5.6, -2.4, 11.4, 5);
    ctx.fillStyle = body;
    ctx.fillRect(-5.6, -2.6, 11.4, 4.2);
    ctx.fillStyle = light;
    ctx.fillRect(-5.6, -2.6, 11.4, 0.7);
  });
  withXf(ctx, { x: p.x - Math.cos(heading) * 0.8 * sc, y: p.y - Math.sin(heading) * 0.8 * sc - 0.8 * sc }, turret, sc, () => {
    ctx.fillStyle = dark;
    ctx.fillRect(1.5, -0.35, 7.5, 0.7);
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(0.5, -2.2);
    ctx.lineTo(-3, -2.2);
    ctx.lineTo(-3.2, 2.2);
    ctx.lineTo(0.5, 2.2);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.35;
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.fillRect(-2.6, -2, 2.4, 1);
  });
}

type ShipKind = "cargo" | "tanker" | "corvette" | "carrier" | "destroyer" | "skiff" | "fishing";

function drawShip(f: F, p: Pt, heading: number, kind: ShipKind, moving: boolean, seed: number, burning = false): void {
  const { ctx, u, s } = f;
  const size = { cargo: 1.2, tanker: 1.2, corvette: 0.8, carrier: 2.1, destroyer: 1.05, skiff: 0.4, fishing: 0.45 }[kind] * u;
  // wake
  if (moving) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(heading);
    const len = 22 * size;
    const g = ctx.createLinearGradient(-6 * size, 0, -6 * size - len, 0);
    g.addColorStop(0, "rgba(255,255,255,0.85)");
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
      } else {
        ctx.strokeStyle = "#6F766C";
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(4, 0);
        ctx.stroke();
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
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 0.2;
      ctx.strokeRect(-6.3, -1, 2.2, 2);
    } else {
      hull(1.6, 6);
      ctx.fillStyle = kind === "skiff" ? "#3A3A36" : "#E7E0CF";
      ctx.fill();
      ctx.fillStyle = kind === "skiff" ? "#1E1E1C" : "#3F6F8F";
      ctx.fillRect(-2.5, -0.8, 2.5, 1.6);
    }
  });
  if (burning) {
    for (let j = 0; j < 6; j++) {
      const age = (s * 0.5 + j / 6) % 1;
      puff(ctx, { x: p.x + age * 10 * u, y: p.y - age * 22 * u }, (3 + age * 10) * u, `rgba(60,55,50,${(0.45 * (1 - age)).toFixed(3)})`);
    }
    puff(ctx, { x: p.x, y: p.y - 1 }, (4 + Math.sin(s * 13) * 0.8) * u, "rgba(255,120,40,0.95)");
  }
}

function drawRig(f: F, p: Pt, seed: number): void {
  const { ctx, u, s } = f;
  const k = 1.1 * u;
  ctx.fillStyle = "rgba(30,60,80,0.2)";
  ctx.fillRect(p.x - 2.5 * k + 2 * k, p.y - 2 * k + 2 * k, 5 * k, 4 * k);
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
  const fl = 1 + 0.25 * Math.sin(s * 11 + seed);
  puff(ctx, { x: p.x + 4.8 * k, y: p.y - 10 * k }, 2.4 * k * fl, "rgba(255,150,50,0.9)");
}

/** Tiny walking figure. */
function drawPerson(f: F, p: Pt, phase: number, color: string, armed: boolean, down = false, flag: string | null = null): void {
  const { ctx } = f;
  const k = 0.8 * Math.min(f.u, 1.5);
  if (down) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.1 * k;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x - 2.6 * k, p.y);
    ctx.lineTo(p.x + 2 * k, p.y - 0.4 * k);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x + 2.8 * k, p.y - 0.5 * k, 0.9 * k, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const sw = Math.sin(phase * Math.PI * 2) * 1.2 * k;
  ctx.fillStyle = "rgba(40,34,24,0.2)";
  ctx.beginPath();
  ctx.ellipse(p.x + 1.2 * k, p.y + 0.3 * k, 1.8 * k, 0.6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
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
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6.2 * k, 1 * k, 0, Math.PI * 2);
  ctx.fill();
  if (armed) {
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 0.55 * k;
    ctx.beginPath();
    ctx.moveTo(p.x - 1.2 * k, p.y - 3.2 * k);
    ctx.lineTo(p.x + 2.6 * k, p.y - 5 * k);
    ctx.stroke();
  }
  if (flag !== null) {
    ctx.strokeStyle = "#6A6A6A";
    ctx.lineWidth = 0.4 * k;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.8 * k, p.y - 4 * k);
    ctx.lineTo(p.x + 0.8 * k, p.y - 10 * k);
    ctx.stroke();
    const wave = Math.sin(f.s * 6 + phase * 9) * 0.4 * k;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(p.x + 0.8 * k, p.y - 10 * k + wave, 3.4 * k, 2.3 * k);
    ctx.fillStyle = flag;
    ctx.fillRect(p.x + 0.8 * k, p.y - 9.7 * k + wave, 3.4 * k, 0.35 * k);
    ctx.fillRect(p.x + 0.8 * k, p.y - 8.2 * k + wave, 3.4 * k, 0.35 * k);
  }
}

// ---------------------------------------------------------------------------
// scene: sea
// ---------------------------------------------------------------------------

const LANES = {
  haifa: [[24.0, 34.2], [31.5, 33.4], [34.2, 33.0], [34.99, 32.83]] as LonLat[],
  ashdod: [[24.0, 32.9], [31.0, 32.3], [34.2, 31.95], [34.63, 31.83]] as LonLat[],
  suez: [[32.35, 31.3], [32.8, 32.4], [33.4, 34.2], [34.0, 35.8]] as LonLat[],
  red: [[43.35, 12.7], [42.4, 14.6], [40.6, 17.5], [38.9, 20.3], [37.4, 23.0], [35.6, 26.2], [34.9, 27.5], [34.48, 28.05], [34.62, 28.6], [34.85, 29.2], [34.95, 29.5]] as LonLat[],
  gazaPatrol: [[34.2, 31.62], [34.02, 31.28]] as LonLat[],
  haifaPatrol: [[34.8, 33.05], [34.55, 32.55]] as LonLat[],
  gazaBoats: [[34.3, 31.45], [33.2, 31.9], [31.5, 33.0]] as LonLat[],
};
const RIGS: LonLat[] = [[34.83, 32.6], [34.44, 31.71], [34.2, 33.05]];

function shipOn(f: F, path: LonLat[], period: number, phase: number, kind: ShipKind, seed: number, pingPong = false): void {
  const c = cycle(f.s, period, phase);
  const fr = pingPong ? ease(ping(c)) : c;
  const { p, a } = along(path, fr);
  const sp = f.S(p);
  if (!f.on(sp)) return;
  drawShip(f, sp, pingPong && c >= 0.5 ? a + Math.PI : a, kind, true, seed);
}

function drawSea(f: F): void {
  const { ctx, env } = f;
  const { flags, metrics, atWar } = env.world;
  const a = f.far;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const trade = flags.euSanctions ? 1 : 2;
  for (let i = 0; i < trade; i++) {
    shipOn(f, LANES.haifa, 150, i / trade, i % 2 === 0 ? "cargo" : "tanker", 11 + i);
    shipOn(f, LANES.ashdod, 170, i / trade + 0.3, "cargo", 23 + i);
  }
  shipOn(f, LANES.suez, 120, 0.1, "cargo", 5);
  shipOn(f, LANES.suez, 120, 0.6, "tanker", 6);
  if (!flags.redSeaBlockade) {
    shipOn(f, LANES.red, 200, 0.15, "cargo", 31);
    shipOn(f, LANES.red, 200, 0.65, "tanker", 32);
  } else {
    const burn = f.L([42.25, 15.1]);
    if (f.on(burn, 80)) {
      drawShip(f, burn, -1.2, "cargo", false, 40, true);
      for (let i = 0; i < 3; i++) {
        const ang = f.s * 0.6 + (i * Math.PI * 2) / 3;
        const q = { x: burn.x + Math.cos(ang) * 22 * f.u, y: burn.y + Math.sin(ang) * 12 * f.u };
        drawShip(f, q, ang + Math.PI / 2, "skiff", true, 50 + i);
      }
      if (f.ppd > 25) label(f, env.lang === "he" ? "חסימת הים האדום" : "Red Sea blockade", { x: burn.x, y: burn.y - 34 * f.u }, RED);
    }
  }
  for (const [i, r] of RIGS.entries()) {
    const p = f.L(r);
    if (f.on(p) && f.ground > 0) drawRig(f, p, i);
  }
  // navy
  const siege = flags.gazaSiege || flags.gazaOccupied;
  shipOn(f, LANES.gazaPatrol, 60, 0, "corvette", 61, true);
  if (siege || atWar) shipOn(f, LANES.gazaPatrol, 60, 0.5, "corvette", 62, true);
  shipOn(f, LANES.haifaPatrol, 70, 0.2, "corvette", 63, true);
  if (siege && f.ppd > 110) {
    const q = f.L([34.1, 31.45]);
    label(f, env.lang === "he" ? "סגר ימי" : "Naval blockade", { x: q.x - 10, y: q.y - 16 * f.u }, "#35506E", 10.5);
  }
  // fishing boats off Gaza in quiet times
  if (!siege && !atWar) {
    for (let i = 0; i < 3; i++) {
      const base = f.L([34.3 - i * 0.03, 31.5 - i * 0.07]);
      const bob = Math.sin(f.s * 0.4 + i) * 3 * f.u;
      if (f.on(base)) drawShip(f, { x: base.x - 8 * f.u + bob, y: base.y }, Math.PI + i, "fishing", false, 70 + i);
    }
  }
  // US carrier strike group
  if (!flags.usArmsHold && (atWar || metrics.securityThreat >= 60 || metrics.usMilitaryAid >= 70)) {
    const c = f.L([33.2, 33.4]);
    const ang = f.s * 0.05;
    const cp = { x: c.x + Math.cos(ang) * 18 * f.u, y: c.y + Math.sin(ang) * 10 * f.u };
    drawShip(f, cp, ang + Math.PI / 2, "carrier", true, 80);
    for (let i = 0; i < 2; i++) {
      const aa = ang - 0.5 - i * 0.6;
      drawShip(f, { x: c.x + Math.cos(aa) * 34 * f.u, y: c.y + Math.sin(aa) * 20 * f.u }, aa + Math.PI / 2, "destroyer", true, 81 + i);
    }
    if (f.ppd > 45 && f.on(cp)) label(f, env.lang === "he" ? "נושאת מטוסים אמריקנית" : "US carrier group", { x: cp.x, y: cp.y - 20 * f.u }, "#35506E", 10.5);
  }
  // "encouraged emigration" boats from Gaza
  if (flags.emigrationProgram) {
    for (let i = 0; i < 3; i++) shipOn(f, LANES.gazaBoats, 90, i / 3, "fishing", 90 + i);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// scene: ground forces, infiltration, crowds
// ---------------------------------------------------------------------------

function tankOn(f: F, path: LonLat[], period: number, phase: number, aim: LonLat | null, seed: number): void {
  const c = cycle(f.s, period, phase);
  const fr = ease(ping(c));
  const { p, a } = along(path, fr);
  const sp = f.S(p);
  if (!f.on(sp)) return;
  const heading = c >= 0.5 ? a + Math.PI : a;
  const moving = Math.abs(ping(c) - 0.5) < 0.46;
  let turret = heading + Math.sin(f.s * 0.3 + seed) * 0.6;
  if (aim !== null) {
    const t = f.L(aim);
    turret = Math.atan2(t.y - sp.y, t.x - sp.x) + Math.sin(f.s * 0.5 + seed) * 0.2;
  }
  drawTank(f, sp, heading, turret, moving);
}

const GAZA_CENTER: LonLat = [34.42, 31.45];
const LEBANON_AIM: LonLat = [35.45, 33.3];

function drawGround(f: F): void {
  const { ctx, env } = f;
  const { flags, atWar, metrics, active } = env.world;
  if (f.ground <= 0) return;
  ctx.save();
  ctx.globalAlpha = f.ground;

  // --- armor
  if (flags.gazaOccupied) {
    tankOn(f, [[34.47, 31.5], [34.4, 31.45]], 26, 0, GAZA_CENTER, 1);
    tankOn(f, [[34.36, 31.4], [34.3, 31.33]], 30, 0.3, [34.3, 31.28], 2);
    tankOn(f, [[34.44, 31.43], [34.35, 31.37]], 34, 0.6, GAZA_CENTER, 3);
    if (f.ppd > 120) label(f, env.lang === "he" ? "צה\"ל ברצועה" : "IDF inside Gaza", f.L([34.2, 31.52]), OLIVE_DARK, 10.5);
  } else {
    tankOn(f, [[34.58, 31.47], [34.545, 31.4]], 40, 0, GAZA_CENTER, 4);
    tankOn(f, [[34.46, 31.28], [34.42, 31.23]], 46, 0.5, GAZA_CENTER, 5);
  }
  if (flags.lebanonWar) {
    tankOn(f, [[35.35, 33.07], [35.4, 33.24]], 32, 0, LEBANON_AIM, 6);
    tankOn(f, [[35.52, 33.1], [35.5, 33.28]], 36, 0.35, LEBANON_AIM, 7);
    tankOn(f, [[35.2, 33.09], [35.28, 33.2]], 40, 0.7, LEBANON_AIM, 8);
  } else {
    tankOn(f, [[35.28, 33.02], [35.45, 33.03]], 50, 0.1, atWar ? LEBANON_AIM : null, 9);
  }
  tankOn(f, [[35.75, 33.08], [35.79, 32.92]], 60, 0.4, null, 10);
  if (atWar || metrics.securityThreat >= 70) tankOn(f, [[34.62, 30.95], [34.52, 30.7]], 55, 0.2, null, 11);

  // --- UN monitors after a withdrawal
  if (flags.withdrawal || flags.unForce) {
    for (let i = 0; i < 3; i++) {
      const c = cycle(f.s, 50, i / 3);
      const { p, a } = along([[35.3, 32.3], [35.2, 32.0], [35.22, 31.7]], ease(ping(c)));
      const sp = f.S(p);
      if (!f.on(sp)) continue;
      withXf(ctx, sp, c >= 0.5 ? a + Math.PI : a, 0.8 * f.u, () => {
        ctx.fillStyle = SHADOW;
        ctx.fillRect(-2, -1, 5, 3);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(-3, -1.8, 6, 3.6);
        ctx.strokeStyle = "#556";
        ctx.lineWidth = 0.3;
        ctx.strokeRect(-3, -1.8, 6, 3.6);
        ctx.fillStyle = "#1E6FB8";
        ctx.font = `700 2px ${SANS}`;
        ctx.fillText("UN", -1.6, 0.8);
      });
    }
  }

  if (active) drawInfiltration(f);
  drawCrowds(f);
  ctx.restore();
}

interface Squad {
  id: string;
  path: LonLat[];
  /** crosses the barrier at this fraction (null = no barrier on the route) */ barrierAt: number | null;
  front: "gaza" | "west_bank" | "lebanon";
}

const SQUADS: Squad[] = [
  { id: "g1", path: [[34.5, 31.5], [34.6, 31.525]], barrierAt: null, front: "gaza" },
  { id: "g2", path: [[34.41, 31.37], [34.5, 31.36]], barrierAt: null, front: "gaza" },
  { id: "g3", path: [[34.32, 31.265], [34.4, 31.22]], barrierAt: null, front: "gaza" },
  { id: "w1", path: [[35.28, 32.44], [35.25, 32.58]], barrierAt: 0.6, front: "west_bank" },
  { id: "w2", path: [[35.06, 32.3], [34.91, 32.31]], barrierAt: 0.5, front: "west_bank" },
  { id: "w3", path: [[35.2, 31.8], [35.13, 31.9]], barrierAt: 0.55, front: "west_bank" },
  { id: "l1", path: [[35.46, 33.2], [35.42, 33.04]], barrierAt: null, front: "lebanon" },
  { id: "l2", path: [[35.22, 33.16], [35.17, 33.03]], barrierAt: null, front: "lebanon" },
];

function drawInfiltration(f: F): void {
  const { env, ctx } = f;
  const { flags, metrics, atWar } = env.world;
  const threat = metrics.securityThreat;
  const gone = barrierGone(env.world);
  const count: Record<Squad["front"], number> = {
    gaza: flags.gazaOccupied || flags.nuclearUsed ? 0 : threat >= 75 || atWar ? 3 : threat >= 55 ? 2 : threat >= 35 ? 1 : 0,
    west_bank: (threat >= 60 ? 2 : threat >= 40 ? 1 : 0) + (gone ? 1 : 0) + (flags.paDismantled ? 1 : 0),
    lebanon: flags.lebanonWar ? 2 : threat >= 70 ? 1 : 0,
  };
  const used: Record<Squad["front"], number> = { gaza: 0, west_bank: 0, lebanon: 0 };
  let warned = false;
  for (const sq of SQUADS) {
    if (used[sq.front] >= count[sq.front]) continue;
    used[sq.front]++;
    const seed = hashString(sq.id);
    const period = 34 + hash01(seed, 1) * 14;
    const c = cycle(f.s, period, hash01(seed, 2));
    const walkEnd = 0.72;
    // blocked by an intact barrier: they stop at it and are caught there
    const stopAt = sq.barrierAt !== null && !gone ? sq.barrierAt : 1;
    const progress = Math.min(stopAt, c / walkEnd);
    const caught = c > walkEnd * stopAt + 0.08;
    const fade = 1 - smooth(0.9, 1, c);
    const { p: head, a } = along(sq.path, progress);
    const hs = f.S(head);
    if (!f.on(hs, 30)) continue;
    ctx.save();
    ctx.globalAlpha *= fade;
    // warning marker visible even when people are too small to see
    const pulse = 0.5 + 0.5 * Math.sin(f.s * 6 + seed);
    if (!caught) {
      ctx.strokeStyle = `rgba(200,55,45,${(0.35 + 0.45 * pulse).toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hs.x, hs.y - 3 * f.u, (7 + pulse * 3) * f.u, 0, Math.PI * 2);
      ctx.stroke();
      // dotted trail of the route so far
      const tail = f.S(along(sq.path, 0).p);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = "rgba(200,55,45,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(hs.x, hs.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (f.people > 0) {
      ctx.globalAlpha *= f.people;
      const n = 4;
      for (let i = 0; i < n; i++) {
        const back = i * 5 * f.u;
        const q = { x: hs.x - Math.cos(a) * back + (i % 2 === 0 ? 1.5 : -1.5) * f.u, y: hs.y - Math.sin(a) * back + (i % 2 === 0 ? -1 : 1) * f.u };
        drawPerson(f, q, f.s * 1.6 + i * 0.3, HOSTILE, true, caught && hash01(seed, i + 10) < 0.75);
      }
      if (caught || progress > 0.75 * stopAt) {
        // IDF response team closing in from ahead
        const k = smooth(0.55 * stopAt, stopAt, progress);
        for (let i = 0; i < 3; i++) {
          const ahead = (18 - k * 10) * f.u;
          const q = { x: hs.x + Math.cos(a) * ahead + (i - 1) * 3 * f.u, y: hs.y + Math.sin(a) * ahead + (i - 1) * 2 * f.u };
          drawPerson(f, q, f.s * 1.8 + i * 0.4, OLIVE_DARK, true);
        }
        if (!caught && Math.floor(f.s * 8 + seed) % 3 === 0) puff(ctx, { x: hs.x + Math.cos(a) * 6 * f.u, y: hs.y - 3 * f.u }, 2.2 * f.u, "rgba(255,210,120,0.95)");
      }
    }
    ctx.restore();
    if (!caught && !warned && f.ppd > 110) {
      warned = true;
      label(f, env.lang === "he" ? "חדירת מחבלים" : "Infiltration", { x: hs.x, y: hs.y - 16 * f.u }, RED, 10.5);
    }
  }
}

function drawCrowds(f: F): void {
  const { env, ctx } = f;
  const fl = env.world.flags;
  const sites: Array<{ at: LonLat; n: number; flag: string; label: strategic.Bi }> = [];
  if (fl.massProtests || fl.reservistRefusal || fl.emergencyRule) {
    sites.push({ at: [34.786, 32.072], n: 46, flag: "#2456B5", label: { he: "הפגנה בקפלן", en: "Kaplan protest" } });
    sites.push({ at: [35.205, 31.777], n: 28, flag: "#2456B5", label: { he: "מול הכנסת", en: "Outside the Knesset" } });
  }
  if (sites.length === 0 || f.people <= 0) return;
  ctx.save();
  ctx.globalAlpha *= f.people;
  for (const site of sites) {
    const c = f.L(site.at);
    if (!f.on(c, 60)) continue;
    const seed = hashString(site.label.en);
    for (let i = 0; i < site.n; i++) {
      const ang = hash01(seed, i) * Math.PI * 2;
      const r = Math.sqrt(hash01(seed, i + 100)) * 9 * Math.min(f.u, 1.5);
      const jig = Math.sin(f.s * 3 + i) * 0.6 * f.u;
      const q = { x: c.x + Math.cos(ang) * r * 1.4 + jig, y: c.y + Math.sin(ang) * r * 0.7 };
      const colors = ["#3B4A63", "#6E5A4A", "#2F5E8C", "#8A4B4B", "#4A6B4A"];
      drawPerson(f, q, i * 0.13, colors[i % colors.length], false, false, i % 6 === 0 ? site.flag : null);
    }
    label(f, site.label[env.lang], { x: c.x, y: c.y - 20 * Math.min(f.u, 1.5) }, "#2456B5", 10.5);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// scene: air — patrols, sorties, airliners, rockets & interceptors
// ---------------------------------------------------------------------------

function orbit(f: F, center: LonLat, rx: number, ry: number, period: number, phase: number, alt: number, pairOffset: number): void {
  const c = f.L(center);
  const ang = cycle(f.s, period, phase) * Math.PI * 2;
  const pos = (a: number) => ({ x: c.x + Math.cos(a) * rx * f.ppd, y: c.y + Math.sin(a) * ry * f.ppd });
  for (let i = 0; i < 2; i++) {
    const a = ang - i * pairOffset;
    const p = pos(a);
    if (!f.on(p)) continue;
    const next = pos(a + 0.01);
    const heading = Math.atan2(next.y - p.y, next.x - p.x);
    // contrail
    f.ctx.strokeStyle = "rgba(120,130,145,0.22)";
    f.ctx.lineWidth = 1.2 * f.u;
    f.ctx.beginPath();
    for (let k = 0; k <= 12; k++) {
      const q = pos(a - k * 0.025);
      if (k === 0) f.ctx.moveTo(q.x, q.y - alt * f.u);
      else f.ctx.lineTo(q.x, q.y - alt * f.u);
    }
    f.ctx.stroke();
    drawJet(f, p, heading, alt, false);
  }
}

function sortie(f: F, path: LonLat[], period: number, phase: number, alt: number, seed: number): void {
  const c = cycle(f.s, period, phase);
  const out = c < 0.5;
  const fr = ease(ping(c));
  const { p, a } = along(path, fr);
  const sp = f.S(p);
  const climb = Math.min(1, Math.min(fr, 1 - fr) * 8 + 0.15);
  if (f.on(sp, 60)) {
    drawJet(f, sp, out ? a : a + Math.PI, alt * climb, out && fr < 0.4, "#5E6A78");
  }
  // bomb impact at the far end
  const since = (c - 0.5) * period;
  if (since > 0 && since < 9) {
    const tgt = f.S(along(path, 1).p);
    if (f.on(tgt, 60)) drawStrikeFx(f, tgt, since, seed);
  }
}

function drawStrikeFx(f: F, p: Pt, age: number, seed: number): void {
  const { ctx, u } = f;
  if (age < 0.6) puff(ctx, p, (4 + age * 20) * u, `rgba(255,190,90,${(1 - age / 0.6).toFixed(3)})`);
  if (age < 1.2) {
    ctx.strokeStyle = `rgba(217,83,30,${(0.8 * (1 - age / 1.2)).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (2 + age * 14) * u, 0, Math.PI * 2);
    ctx.stroke();
  }
  // rising smoke column (height = 3D cue)
  for (let j = 0; j < 7; j++) {
    const k = (age * 0.35 + j / 7) % 1;
    if (k * 9 > age + 0.5) continue;
    const drift = (hash01(seed, j) - 0.3) * 6 * u;
    puff(ctx, { x: p.x + drift * k + k * 8 * u, y: p.y - k * 30 * u }, (2.5 + k * 7) * u, `rgba(80,72,64,${(0.4 * (1 - k) * (1 - age / 9)).toFixed(3)})`);
  }
}

interface Airline {
  path: LonLat[];
  period: number;
}
const DEPARTURES: Airline[] = [
  { path: [BEN_GURION, [34.35, 32.15], [31.5, 33.5], [25, 37.5], [14, 42], [2, 48.5]], period: 90 },
  { path: [BEN_GURION, [34.3, 32.05], [30, 33.8], [18, 38], [-6, 43], [-40, 45]], period: 110 },
  { path: [BEN_GURION, [34.4, 32.3], [32.5, 34.5], [28.5, 40], [20, 47], [13, 52.5]], period: 100 },
];
const ARRIVAL: LonLat[] = [[24, 37], [31, 33.4], [34.3, 32.1], BEN_GURION];
const SAUDI_ROUTE: LonLat[] = [BEN_GURION, [35.6, 31.6], [38.5, 29.5], [46.7, 24.7]];

function emigrationPressure(world: AmbientWorld): number {
  const m = world.metrics;
  const fl = world.flags;
  let p = ((100 - m.internalCohesion) * 0.45 + (100 - m.economicStability) * 0.3 + m.securityThreat * 0.25) / 100;
  if (fl.massProtests) p += 0.1;
  if (fl.euSanctions) p += 0.08;
  if (fl.emergencyRule) p += 0.15;
  if (fl.reservistRefusal) p += 0.05;
  return clamp01(p);
}

function drawAirliners(f: F): void {
  const { env } = f;
  if (f.far <= 0) return;
  const pressure = emigrationPressure(env.world);
  const n = 1 + Math.round(pressure * 8);
  let labelAt: Pt | null = null;
  for (let i = 0; i < n; i++) {
    const r = DEPARTURES[i % DEPARTURES.length];
    const c = cycle(f.s, r.period, i / n + i * 0.13);
    const { p, a } = along(r.path, c ** 2.2);
    const sp = f.S(p);
    if (!f.on(sp, 60)) continue;
    const alt = 26 * smooth(0, 0.08, c);
    const taxi = c < 0.004;
    f.ctx.save();
    f.ctx.globalAlpha *= (taxi ? 0.6 : 1) * (1 - smooth(0.92, 1, c));
    if (alt > 6) {
      f.ctx.strokeStyle = "rgba(150,160,175,0.25)";
      f.ctx.lineWidth = 1.4 * f.u;
      const back = f.S(along(r.path, Math.max(0, c - 0.02)).p);
      f.ctx.beginPath();
      f.ctx.moveTo(back.x, back.y - alt * f.u);
      f.ctx.lineTo(sp.x - Math.cos(a) * 9 * f.u, sp.y - Math.sin(a) * 9 * f.u - alt * f.u);
      f.ctx.stroke();
    }
    drawAirliner(f, sp, a, alt);
    f.ctx.restore();
    if (c > 0.08 && c < 0.45 && labelAt === null) labelAt = { x: sp.x, y: sp.y - alt * f.u - 14 * f.u };
  }
  if (pressure < 0.35) {
    const c = cycle(f.s, 95, 0.4);
    const { p, a } = along(ARRIVAL, c);
    const sp = f.S(p);
    if (f.on(sp, 60)) drawAirliner(f, sp, a, 26 * (1 - smooth(0.9, 1, c)));
  }
  if (env.world.flags.saudiDeal) {
    const c = cycle(f.s, 80, 0.2);
    const { p, a } = along(SAUDI_ROUTE, c);
    const sp = f.S(p);
    if (f.on(sp, 60)) drawAirliner(f, sp, a, 26 * smooth(0, 0.1, c) * (1 - smooth(0.9, 1, c)));
  }
  if (labelAt !== null && f.ppd > 60 && n >= 4) {
    label(f, env.lang === "he" ? `גל ירידה מהארץ · ${n} טיסות` : `Emigration wave · ${n} flights`, labelAt, "#2456B5", 10.5);
  }
}

/** A rocket with a 3D arc (altitude lifts it up the screen; a shadow runs on the ground). */
function projectile(f: F, from: Pt, to: Pt, u01: number, heightPx: number): { ground: Pt; air: Pt; alt: number } {
  const ground = { x: lerp(from.x, to.x, u01), y: lerp(from.y, to.y, u01) };
  const alt = Math.sin(Math.PI * u01) * heightPx;
  return { ground, air: { x: ground.x, y: ground.y - alt }, alt };
}

function trail(f: F, from: Pt, to: Pt, u0: number, u1: number, heightPx: number, color: string, width: number): void {
  const { ctx } = f;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const a = lerp(u0, u1, i / steps);
    const b = lerp(u0, u1, (i + 1) / steps);
    const pa = projectile(f, from, to, a, heightPx).air;
    const pb = projectile(f, from, to, b, heightPx).air;
    ctx.strokeStyle = color.replace("ALPHA", ((i + 1) / steps * 0.8).toFixed(3));
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
}

interface Stream {
  id: string;
  from: LonLat[];
  to: LonLat[];
  battery: LonLat;
  period: number;
  kind: "rocket" | "ballistic";
}

const STREAMS: Record<"gaza" | "lebanon" | "iran" | "yemen", Stream> = {
  gaza: { id: "gaza", from: [[34.45, 31.52], [34.33, 31.4], [34.27, 31.3], [34.4, 31.47]], to: [[34.6, 31.52], [34.57, 31.67], [34.59, 31.42], [34.65, 31.8], [34.78, 32.08]], battery: BATTERIES.iron_dome_south.pos, period: 9, kind: "rocket" },
  lebanon: { id: "lebanon", from: [[35.45, 33.25], [35.3, 33.2], [35.55, 33.3]], to: [[35.57, 33.21], [35.1, 33.0], [34.99, 32.79], [35.5, 32.97]], battery: IRON_DOME_NORTH, period: 8, kind: "rocket" },
  iran: { id: "iran", from: [[51.4, 35.7], [51.67, 32.65], [47.07, 34.31]], to: [[34.78, 32.08], [35.03, 31.07], [34.99, 32.79]], battery: BATTERIES.arrow3.pos, period: 40, kind: "ballistic" },
  yemen: { id: "yemen", from: [[44.2, 15.35]], to: [[34.95, 29.56], [34.78, 32.08]], battery: BATTERIES.arrow3.pos, period: 55, kind: "ballistic" },
};

function drawStream(f: F, st: Stream, lanes: number): void {
  const { ctx } = f;
  for (let li = 0; li < lanes; li++) {
    const seed = hashString(`${st.id}:${li}`);
    const period = st.period * (0.85 + hash01(seed, 1) * 0.4);
    const raw = (f.s / period + hash01(seed, 2));
    const round = Math.floor(raw);
    const c = raw - round;
    const from = f.L(st.from[Math.floor(hash01(seed, round * 3 + 1) * st.from.length)]);
    const to = f.L(st.to[Math.floor(hash01(seed, round * 3 + 2) * st.to.length)]);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    if (!f.on(from, 400) && !f.on(to, 400)) continue;
    const H = st.kind === "ballistic" ? Math.min(160, dist * 0.35) : Math.min(60, dist * 0.35 + 8);
    const flight = st.kind === "ballistic" ? 0.7 : 0.55;
    const u01 = c / flight;
    const intercepted = hash01(seed, round * 3 + 3) < (st.kind === "ballistic" ? 0.9 : 0.88);
    const killU = st.kind === "ballistic" ? 0.72 : 0.78;
    const end = intercepted ? killU : 1;
    const color = st.kind === "ballistic" ? "rgba(217,106,28,ALPHA)" : "rgba(110,100,90,ALPHA)";
    if (u01 <= end) {
      const head = projectile(f, from, to, u01, H);
      // ground track + shadow
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = "rgba(200,55,45,0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(head.ground.x, head.ground.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(40,34,24,0.25)";
      ctx.beginPath();
      ctx.ellipse(head.ground.x + head.alt * 0.3, head.ground.y + head.alt * 0.15, 2 * f.u, 1 * f.u, 0, 0, Math.PI * 2);
      ctx.fill();
      trail(f, from, to, Math.max(0, u01 - (st.kind === "ballistic" ? 0.35 : 0.5)), u01, H, color, st.kind === "ballistic" ? 2 * f.u : 1.4 * f.u);
      if (st.kind === "ballistic" && u01 > 0.75) puff(ctx, head.air, 6 * f.u, "rgba(255,170,90,0.8)");
      puff(ctx, head.air, 3.2 * f.u, st.kind === "ballistic" ? "rgba(217,106,28,0.9)" : "rgba(240,140,60,0.9)");
      ctx.fillStyle = "#3A2A20";
      ctx.beginPath();
      ctx.arc(head.air.x, head.air.y, 1.2 * f.u, 0, Math.PI * 2);
      ctx.fill();
    }
    // interceptor (Tamir / Arrow) — launches from the battery, meets the threat
    if (intercepted) {
      const launchU = killU - (st.kind === "ballistic" ? 0.3 : 0.28);
      const kill = projectile(f, from, to, killU, H).air;
      const bat = f.L(st.battery);
      if (u01 >= launchU && u01 <= killU) {
        const k = (u01 - launchU) / (killU - launchU);
        const ctrl = { x: lerp(bat.x, kill.x, 0.3), y: Math.min(bat.y, kill.y) - 30 * f.u };
        const pt = (t: number) => ({ x: (1 - t) * (1 - t) * bat.x + 2 * (1 - t) * t * ctrl.x + t * t * kill.x, y: (1 - t) * (1 - t) * bat.y + 2 * (1 - t) * t * ctrl.y + t * t * kill.y });
        ctx.strokeStyle = "rgba(14,138,148,0.55)";
        ctx.lineWidth = 1.2 * f.u;
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const q = pt(Math.max(0, k - 0.5) + (i / 12) * Math.min(k, 0.5));
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        }
        ctx.stroke();
        const h = pt(k);
        puff(ctx, h, 3 * f.u, "rgba(120,230,235,0.95)");
        ctx.fillStyle = TEAL;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 1.2 * f.u, 0, Math.PI * 2);
        ctx.fill();
      }
      const since = (u01 - killU) * flight * period;
      if (since > 0 && since < 5) {
        if (since < 0.5) puff(ctx, kill, (5 + since * 24) * f.u, `rgba(255,235,170,${(1 - since / 0.5).toFixed(3)})`);
        ctx.strokeStyle = `rgba(14,138,148,${(0.6 * (1 - since / 1.5)).toFixed(3)})`;
        if (since < 1.5) {
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(kill.x, kill.y, (3 + since * 12) * f.u, 0, Math.PI * 2);
          ctx.stroke();
        }
        puff(ctx, { x: kill.x + since * 3 * f.u, y: kill.y + since * 1 * f.u }, (4 + since * 3) * f.u, `rgba(120,115,110,${(0.4 * (1 - since / 5)).toFixed(3)})`);
      }
    } else {
      const since = (u01 - 1) * flight * period;
      if (since > 0 && since < 8) drawStrikeFx(f, to, since, seed + round);
    }
  }
}

function drawAir(f: F): void {
  const { env } = f;
  const { flags, metrics, atWar, active } = env.world;
  const threat = metrics.securityThreat;
  // combat air patrols
  if (f.ground > 0) {
    f.ctx.save();
    f.ctx.globalAlpha *= f.ground;
    orbit(f, [34.95, 31.7], 0.3, 0.75, 46, 0, 18, 0.12);
    if (atWar || threat >= 60) orbit(f, [35.35, 32.85], 0.25, 0.18, 34, 0.5, 18, 0.14);
    if (active && (atWar || threat >= 55 || flags.gazaOccupied)) sortie(f, [NEVATIM, [34.8, 31.35], [34.45, 31.47]], 36, 0, 20, 1);
    if (active && (flags.lebanonWar || threat >= 70)) sortie(f, [RAMAT_DAVID, [35.3, 33.0], [35.48, 33.3]], 40, 0.4, 20, 2);
    f.ctx.restore();
  }
  if (f.far > 0) {
    f.ctx.save();
    f.ctx.globalAlpha *= f.far;
    if (active && (threat >= 75 || (atWar && threat >= 60))) sortie(f, [NEVATIM, [36.5, 32.6], [40, 33.2], [44.5, 33.6], [51.67, 32.65]], 110, 0.2, 24, 3);
    f.ctx.restore();
  }
  drawAirliners(f);
  if (!active) return;
  // rockets & interceptions
  const gazaLanes = flags.gazaOccupied || flags.nuclearUsed ? 0 : atWar ? 4 : threat >= 65 ? 2 : threat >= 45 ? 1 : 0;
  const lebLanes = flags.lebanonWar ? 4 : threat >= 72 ? 1 : 0;
  if (f.ground > 0 && gazaLanes + lebLanes > 0) {
    f.ctx.save();
    f.ctx.globalAlpha *= f.ground;
    drawStream(f, STREAMS.gaza, gazaLanes);
    drawStream(f, STREAMS.lebanon, lebLanes);
    f.ctx.restore();
  }
  if (f.far > 0) {
    f.ctx.save();
    f.ctx.globalAlpha *= f.far;
    if (threat >= 78 || (atWar && threat >= 65)) drawStream(f, STREAMS.iran, 1);
    if (flags.redSeaBlockade || threat >= 70) drawStream(f, STREAMS.yemen, 1);
    f.ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// entry points
// ---------------------------------------------------------------------------

/** Terrain, skylines, barrier, ships, ground forces — draw before the tactical script. */
export function drawAmbientGround(ctx: CanvasRenderingContext2D, env: AmbientEnv): void {
  const f = frameOf(ctx, env);
  if (f.far <= 0 && f.ground <= 0) return;
  drawTerrain(f);
  drawSea(f);
  drawBarriers(f);
  drawCities(f);
  drawGround(f);
}

/** Aircraft, rockets and interceptors — draw after the tactical script. */
export function drawAmbientAir(ctx: CanvasRenderingContext2D, env: AmbientEnv): void {
  const f = frameOf(ctx, env);
  if (f.far <= 0 && f.ground <= 0) return;
  drawAir(f);
}
