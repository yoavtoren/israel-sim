/** Tactical Canvas renderer. Every effect is PROCEDURAL in simulation time
 *  (smoke puffs, debris, shockwaves are recomputed from their emission time
 *  plus hash noise), so scrubbing the timeline backwards shows exactly what
 *  playing forward did — no particle state to rewind. Real time is used only
 *  for ambient motion (radar sweep, reticle rotation, flicker, shake jitter). */

import {
  BATTERIES, CITIES, ORIGINS, REGIONS, kmToUnits, project, toScreen,
  type Camera, type LonLat, type Pt,
} from "./geo";
import {
  AFFILIATION, FACTION_COLORS, INTERCEPTOR_COLOR, bezierControls, endTime, hash01, hashString, pathPoint, progressAt,
  type Affiliation, type Ctrl, type Launch, type TacticalScript, type UnitMove,
} from "./scenarios";

export interface FrameEnv {
  script: TacticalScript;
  t: number;
  cam: Camera;
  w: number;
  h: number;
  lang: "he" | "en";
  nowMs: number;
  trackedId: string | null;
  /** radar, defense envelopes, city and region labels (off when zoomed out to the world) */ chrome?: boolean;
}

const SANS = "Rubik, Heebo, system-ui, sans-serif";
const INK = "#1C2330";
const BAD_INK = "#B3302A";
const BLAST_COLOR = "#D9531E";
const FRIENDLY_BLAST_COLOR = "#2F63B0";
const RADAR_CENTER: LonLat = [34.95, 31.75];

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Map label on paper: dark fill over a soft white halo so it reads on any ground. */
function haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, haloAlpha = 0.92): void {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(255,255,255,${clamp01(haloAlpha).toFixed(3)})`;
  ctx.strokeText(text, x, y);
  ctx.restore();
  ctx.fillText(text, x, y);
}

/** Solid projectile head: colored dot with a white rim. */
function headDot(ctx: CanvasRenderingContext2D, p: Pt, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// per-script geometry cache
// ---------------------------------------------------------------------------

const ctrlCache = new Map<string, Map<string, Ctrl>>();

export function ctrlFor(script: TacticalScript, l: Launch): Ctrl {
  let m = ctrlCache.get(script.key);
  if (m === undefined) {
    if (ctrlCache.size > 8) ctrlCache.clear();
    m = new Map();
    ctrlCache.set(script.key, m);
  }
  let c = m.get(l.id);
  if (c === undefined) {
    c = bezierControls(l);
    m.set(l.id, c);
  }
  return c;
}

/** Map-unit position of a launch at time t. */
export function launchPos(script: TacticalScript, l: Launch, t: number): Pt {
  return pathPoint(l, ctrlFor(script, l), progressAt(l, t));
}

/** Interceptor path from its battery to the kill point. */
function interceptorCtrl(l: Launch, c: Ctrl): Ctrl | null {
  const ic = l.intercept;
  if (ic === null) return null;
  const hit = pathPoint(l, c, ic.u);
  const bp = project(BATTERIES[ic.battery].pos);
  const lift = Math.min(40, Math.hypot(hit.x - bp.x, hit.y - bp.y) * 0.35);
  return [
    bp,
    { x: bp.x + (hit.x - bp.x) * 0.15, y: bp.y - lift },
    { x: bp.x + (hit.x - bp.x) * 0.7, y: hit.y - lift * 0.5 },
    hit,
  ];
}

function bez(c: Ctrl, u: number): Pt {
  const v = 1 - u;
  return {
    x: v * v * v * c[0].x + 3 * v * v * u * c[1].x + 3 * v * u * u * c[2].x + u * u * u * c[3].x,
    y: v * v * v * c[0].y + 3 * v * v * u * c[1].y + 3 * v * u * u * c[2].y + u * u * u * c[3].y,
  };
}

// ---------------------------------------------------------------------------
// camera shake
// ---------------------------------------------------------------------------

const SHAKE_WINDOW = 7; // sim seconds

/** Pixel offset from heavy impacts near time t (0 when nothing heavy landed). */
export function shakeOffset(script: TacticalScript, t: number, nowMs: number, playing: boolean): Pt {
  if (!playing) return { x: 0, y: 0 };
  let amp = 0;
  for (const l of script.launches) {
    if (l.kind !== "ballistic" || AFFILIATION[l.faction] === "friend") continue;
    if (l.intercept !== null && l.intercept.success) continue;
    const dt = t - (l.t0 + l.flight);
    if (dt >= 0 && dt < SHAKE_WINDOW) amp += 6 * (1 - dt / SHAKE_WINDOW) ** 2;
  }
  for (const b of script.blasts) {
    const dt = t - b.t;
    if (b.heavy && dt >= 0 && dt < SHAKE_WINDOW) amp += 3 * (1 - dt / SHAKE_WINDOW) ** 2;
  }
  amp = Math.min(amp, 10);
  if (amp < 0.05) return { x: 0, y: 0 };
  const k = Math.floor(nowMs / 28);
  return { x: (hash01(k, 1) - 0.5) * 2 * amp, y: (hash01(k, 2) - 0.5) * 2 * amp };
}

// ---------------------------------------------------------------------------
// frame
// ---------------------------------------------------------------------------

export function drawFrame(ctx: CanvasRenderingContext2D, env: FrameEnv): void {
  const { script, t, cam, w, h, nowMs } = env;
  const S = (p: Pt) => toScreen(p, cam, w, h);
  const SL = (ll: LonLat) => S(project(ll));
  const pxPerUnit = cam.scale;
  const pxPerKm = kmToUnits(1) * cam.scale;

  const active = script.launches.filter((l) => t >= l.t0 && t < endTime(l));

  const chrome = env.chrome !== false;
  if (chrome) drawRadar(ctx, env, SL(RADAR_CENTER), pxPerKm, active);
  if (chrome || active.length > 0) drawEnvelopes(ctx, env, SL, pxPerKm, active);
  drawZones(ctx, env, SL);
  drawUnits(ctx, env, SL);

  ctx.globalCompositeOperation = "multiply";
  for (const l of script.launches) drawSmoke(ctx, env, l, S, pxPerUnit);
  ctx.globalCompositeOperation = "source-over";
  for (const l of script.launches) drawLaunch(ctx, env, l, S);
  for (const b of script.blasts) drawBlast(ctx, env, SL(b.pos), t - b.t, b.heavy, hashString(b.id), BLAST_COLOR);

  drawReticles(ctx, env, SL, active);
  drawOrigins(ctx, env, SL);
  if (chrome) drawLabels(ctx, env, SL);
}

// ---------------------------------------------------------------------------
// radar
// ---------------------------------------------------------------------------

function drawRadar(ctx: CanvasRenderingContext2D, env: FrameEnv, c: Pt, pxPerKm: number, active: Launch[]): void {
  const { w, h, nowMs, script, t } = env;
  const R = Math.hypot(w, h);
  const angle = ((nowMs / 4200) % 1) * Math.PI * 2;

  // range rings every 100 km
  ctx.save();
  ctx.strokeStyle = "rgba(36,81,143,0.13)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 6]);
  const step = 100 * pxPerKm;
  if (step > 12) {
    for (let r = step; r < R; r += step) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // sweep wedge
  const wedge = 0.55;
  if (typeof ctx.createConicGradient === "function") {
    const g = ctx.createConicGradient(angle - wedge, c.x, c.y);
    g.addColorStop(0, "rgba(47,99,176,0)");
    g.addColorStop(wedge / (Math.PI * 2), "rgba(47,99,176,0.05)");
    g.addColorStop(wedge / (Math.PI * 2) + 0.0005, "rgba(47,99,176,0)");
    g.addColorStop(1, "rgba(47,99,176,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, R, angle - wedge, angle);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(47,99,176,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y);
  ctx.lineTo(c.x + Math.cos(angle) * R, c.y + Math.sin(angle) * R);
  ctx.stroke();

  // blips: brightest just after the sweep passes a contact
  for (const l of active) {
    const p = toScreen(launchPos(script, l, t), env.cam, w, h);
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    let behind = angle - a;
    behind = ((behind % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const alpha = 1 - behind / (Math.PI * 1.6);
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(31,122,74,${(0.6 * alpha).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 + 5 * (1 - alpha), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// defense envelopes
// ---------------------------------------------------------------------------

function drawEnvelopes(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt, pxPerKm: number, active: Launch[]): void {
  const pulse = 0.5 + 0.5 * Math.sin(env.nowMs / 260);
  const engaged = new Set(active.filter((l) => l.intercept !== null && env.t >= l.intercept.tLaunch).map((l) => l.intercept?.battery));
  for (const b of Object.values(BATTERIES)) {
    const hot = engaged.has(b.id);
    if (b.airborne === true && !hot && !env.script.launches.some((l) => l.intercept?.battery === b.id)) continue;
    const c = SL(b.pos);
    const r = b.radiusKm * pxPerKm;
    if (b.outer || b.airborne === true) {
      ctx.setLineDash(b.airborne === true ? [2, 5] : [8, 6]);
      ctx.lineDashOffset = -env.nowMs / 60;
      ctx.strokeStyle = rgba(INTERCEPTOR_COLOR, hot ? 0.45 + 0.35 * pulse : 0.24);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    } else {
      const g = ctx.createRadialGradient(c.x, c.y, r * 0.2, c.x, c.y, r);
      g.addColorStop(0, rgba(INTERCEPTOR_COLOR, 0));
      g.addColorStop(0.85, rgba(INTERCEPTOR_COLOR, hot ? 0.07 : 0.018));
      g.addColorStop(1, rgba(INTERCEPTOR_COLOR, hot ? 0.13 : 0.035));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(INTERCEPTOR_COLOR, hot ? 0.55 + 0.4 * pulse : 0.26);
      ctx.lineWidth = hot ? 1.5 : 1;
      ctx.stroke();
    }
    if (b.airborne !== true) {
      // launcher glyph
      ctx.fillStyle = rgba(INTERCEPTOR_COLOR, 0.95);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 5);
      ctx.lineTo(c.x + 4, c.y + 3);
      ctx.lineTo(c.x - 4, c.y + 3);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// zones
// ---------------------------------------------------------------------------

function drawZones(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt): void {
  const { script, t, nowMs, lang } = env;
  const pulse = 0.5 + 0.5 * Math.sin(nowMs / 300);
  for (const z of script.zones) {
    if (t < z.t0 || t > z.t1) continue;
    const fadeIn = clamp01((t - z.t0) / 8);
    const fadeOut = clamp01((z.t1 - t) / 8);
    const a = Math.min(fadeIn, fadeOut);
    const pts = z.path.map(SL);
    if (pts.length === 0) continue;
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));

    if (z.kind === "border_alert" || z.kind === "barrier") {
      ctx.strokeStyle = rgba(z.color, (0.4 + 0.5 * pulse) * a);
      ctx.lineWidth = z.kind === "barrier" ? 2 + 1.5 * pulse : 3 + 3 * pulse;
      ctx.shadowColor = rgba(z.color, 0.45 * a);
      ctx.shadowBlur = 10;
      if (z.kind === "barrier") ctx.setLineDash([10, 5]);
      ctx.stroke();
    } else if (z.kind === "contested") {
      ctx.closePath();
      ctx.fillStyle = rgba(z.color, (0.1 + 0.1 * pulse) * a);
      ctx.fill();
      ctx.strokeStyle = rgba(z.color, 0.7 * a);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.clip();
      ctx.strokeStyle = rgba(z.color, 0.28 * a);
      ctx.lineWidth = 1;
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const off = (nowMs / 90) % 8;
      for (let x = x0 - (y1 - y0) - 8 + off; x < x1; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x + (y1 - y0), y0);
        ctx.stroke();
      }
    } else if (z.kind === "tunnels") {
      ctx.strokeStyle = rgba(z.color, 0.9 * a);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -nowMs / 40;
      ctx.shadowColor = rgba(z.color, 0.35 * a);
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      for (const p of [pts[0], pts[pts.length - 1]]) {
        ctx.strokeStyle = rgba(z.color, a);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x - 3.5, p.y - 3.5, 7, 7);
      }
    } else if (z.kind === "treaty_line") {
      ctx.strokeStyle = rgba(z.color, 0.7 * a);
      ctx.lineWidth = 1.3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
    }
    ctx.restore();

    if (z.label !== null) {
      const top = pts.reduce((m, p) => (p.y < m.y ? p : m), pts[0]);
      ctx.font = `600 11px ${SANS}`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(z.color, a);
      haloText(ctx, z.label[lang], top.x, top.y - 6, 0.92 * a);
    }
  }
}

// ---------------------------------------------------------------------------
// NATO-style unit symbols (APP-6 inspired)
// ---------------------------------------------------------------------------

const AFF_STYLE: Record<Affiliation, { stroke: string; fill: string }> = {
  friend: { stroke: "#2F63B0", fill: "rgba(222,234,249,0.94)" },
  hostile: { stroke: "#B3302A", fill: "rgba(250,224,219,0.94)" },
  neutral: { stroke: "#2F7D52", fill: "rgba(220,239,227,0.94)" },
};

function unitPos(u: UnitMove, t: number): LonLat {
  const k = u.t1 > u.t0 ? clamp01((t - u.t0) / (u.t1 - u.t0)) : 1;
  const e = k * k * (3 - 2 * k);
  return [u.from[0] + (u.to[0] - u.from[0]) * e, u.from[1] + (u.to[1] - u.from[1]) * e];
}

/** Screen boxes of labels already drawn this frame — later labels that would overlap are skipped. */
type LabelBoxes = Array<{ x0: number; y0: number; x1: number; y1: number }>;

function placeLabel(ctx: CanvasRenderingContext2D, boxes: LabelBoxes, text: string, x: number, y: number, haloAlpha = 0.92): boolean {
  const w = ctx.measureText(text).width;
  const box = { x0: x - w / 2 - 2, y0: y - 10, x1: x + w / 2 + 2, y1: y + 3 };
  if (boxes.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) return false;
  boxes.push(box);
  haloText(ctx, text, x, y, haloAlpha);
  return true;
}

function drawUnits(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt): void {
  const { script, t, nowMs, lang, cam } = env;
  const boxes: LabelBoxes = [];
  // moving units label first: they carry the story
  const ordered = [...script.units].sort((a, b) => Number(t >= b.t0 && t < b.t1) - Number(t >= a.t0 && t < a.t1));
  for (const u of ordered) {
    const staticUnit = u.t0 === u.t1 && u.from[0] === u.to[0] && u.from[1] === u.to[1];
    if ((!staticUnit && t < u.t0) || (staticUnit && t < u.t0) || t >= u.until) continue;
    const pos = unitPos(u, t);
    let c = SL(pos);
    const aff = AFFILIATION[u.faction];
    const style = AFF_STYLE[aff];
    const moving = t >= u.t0 && t < u.t1;
    const appear = clamp01((t - u.t0 + 1) / 6);

    if (u.type === "naval" || u.type === "carrier") {
      c = { x: c.x, y: c.y + Math.sin(nowMs / 700 + hashString(u.id)) * 1.2 };
    }

    // movement track + arrow
    if (moving) {
      const from = SL(u.from);
      const to = SL(u.to);
      ctx.strokeStyle = rgba(FACTION_COLORS[u.faction], 0.5);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = rgba(FACTION_COLORS[u.faction], 0.8);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      const ang = Math.atan2(to.y - c.y, to.x - c.x);
      ctx.fillStyle = rgba(FACTION_COLORS[u.faction], 0.9);
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(to.x - 8 * Math.cos(ang - 0.4), to.y - 8 * Math.sin(ang - 0.4));
      ctx.lineTo(to.x - 8 * Math.cos(ang + 0.4), to.y - 8 * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = appear;
    drawSymbol(ctx, c, u, aff, style);
    ctx.restore();

    if (cam.scale > 1.0 || u.type === "carrier") {
      ctx.font = `500 11px ${SANS}`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(style.stroke, 0.95 * appear);
      placeLabel(ctx, boxes, u.label[lang], c.x, c.y + 23, 0.92 * appear);
    }
  }
}

function drawSymbol(ctx: CanvasRenderingContext2D, c: Pt, u: UnitMove, aff: Affiliation, style: { stroke: string; fill: string }): void {
  const W = 26;
  const H = 17;
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.strokeStyle = style.stroke;
  ctx.fillStyle = style.fill;
  ctx.beginPath();
  const isAir = u.type === "air";
  const isSea = u.type === "naval" || u.type === "carrier";
  if (isAir) {
    if (aff === "hostile") {
      ctx.moveTo(c.x - W / 2, c.y + H / 2);
      ctx.lineTo(c.x - W / 2, c.y);
      ctx.lineTo(c.x, c.y - H / 2 - 4);
      ctx.lineTo(c.x + W / 2, c.y);
      ctx.lineTo(c.x + W / 2, c.y + H / 2);
    } else {
      ctx.moveTo(c.x - W / 2, c.y + H / 2);
      ctx.lineTo(c.x - W / 2, c.y);
      ctx.arc(c.x, c.y, W / 2, Math.PI, 0);
      ctx.lineTo(c.x + W / 2, c.y + H / 2);
    }
  } else if (aff === "hostile") {
    const d = 13;
    ctx.moveTo(c.x, c.y - d);
    ctx.lineTo(c.x + d, c.y);
    ctx.lineTo(c.x, c.y + d);
    ctx.lineTo(c.x - d, c.y);
    ctx.closePath();
  } else if (isSea && aff === "friend") {
    ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
  } else if (aff === "neutral") {
    ctx.rect(c.x - 11, c.y - 11, 22, 22);
  } else {
    ctx.rect(c.x - W / 2, c.y - H / 2, W, H);
  }
  ctx.fill();
  ctx.stroke();

  // icon
  ctx.beginPath();
  ctx.lineWidth = 1.3;
  const iw = aff === "hostile" ? 7 : 9;
  const ih = aff === "hostile" ? 5 : 6;
  switch (u.type) {
    case "armor":
      ctx.ellipse(c.x, c.y, iw, ih * 0.7, 0, 0, Math.PI * 2);
      break;
    case "mech":
      ctx.ellipse(c.x, c.y, iw * 0.8, ih * 0.6, 0, 0, Math.PI * 2);
      ctx.moveTo(c.x - iw, c.y - ih);
      ctx.lineTo(c.x + iw, c.y + ih);
      ctx.moveTo(c.x + iw, c.y - ih);
      ctx.lineTo(c.x - iw, c.y + ih);
      break;
    case "infantry":
      ctx.moveTo(c.x - iw, c.y - ih);
      ctx.lineTo(c.x + iw, c.y + ih);
      ctx.moveTo(c.x + iw, c.y - ih);
      ctx.lineTo(c.x - iw, c.y + ih);
      break;
    case "engineer":
      ctx.moveTo(c.x - iw, c.y + ih * 0.5);
      ctx.lineTo(c.x - iw, c.y - ih * 0.5);
      ctx.lineTo(c.x + iw, c.y - ih * 0.5);
      ctx.lineTo(c.x + iw, c.y + ih * 0.5);
      ctx.moveTo(c.x, c.y - ih * 0.5);
      ctx.lineTo(c.x, c.y + ih * 0.5);
      break;
    case "supply":
      ctx.moveTo(c.x - iw, c.y + ih * 0.5);
      ctx.lineTo(c.x + iw, c.y + ih * 0.5);
      break;
    case "air":
      // fixed-wing: two lobes
      ctx.ellipse(c.x - 4, c.y, 4, 2.4, 0, 0, Math.PI * 2);
      ctx.moveTo(c.x + 8, c.y);
      ctx.ellipse(c.x + 4, c.y, 4, 2.4, 0, 0, Math.PI * 2);
      break;
    case "naval":
    case "carrier":
      ctx.moveTo(c.x - 6, c.y - 1);
      ctx.lineTo(c.x + 6, c.y - 1);
      ctx.lineTo(c.x + 4, c.y + 4);
      ctx.lineTo(c.x - 4, c.y + 4);
      ctx.closePath();
      ctx.moveTo(c.x, c.y - 1);
      ctx.lineTo(c.x, c.y - 6);
      if (u.type === "carrier") {
        ctx.moveTo(c.x - 8, c.y - 1);
        ctx.lineTo(c.x + 8, c.y - 1);
      }
      break;
    default:
      break;
  }
  ctx.stroke();
  const text = u.type === "sof" ? "SF" : u.type === "police" ? "MP" : u.type === "monitor" ? "MFO" : null;
  if (text !== null) {
    ctx.font = `700 8px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillStyle = style.stroke;
    ctx.fillText(text, c.x, c.y + 3);
  }
  if (u.echelon !== "") {
    ctx.font = `700 8px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillStyle = style.stroke;
    haloText(ctx, u.echelon, c.x, c.y - (aff === "hostile" ? 16 : 12));
  }
}

// ---------------------------------------------------------------------------
// projectiles
// ---------------------------------------------------------------------------

const SMOKE: Record<Launch["kind"], { n: number; life: number; until: number; size: number; alpha: number }> = {
  ballistic: { n: 90, life: 60, until: 0.38, size: 2.2, alpha: 0.2 },
  rocket: { n: 36, life: 25, until: 0.6, size: 1.5, alpha: 0.17 },
  cruise: { n: 40, life: 20, until: 1, size: 0.9, alpha: 0.08 },
  drone: { n: 0, life: 0, until: 0, size: 0, alpha: 0 },
  airstrike: { n: 30, life: 18, until: 1, size: 0.9, alpha: 0.08 },
};

/** Procedural exhaust puffs: emitted along the path at fixed intervals, drifting and fading. */
function drawSmoke(ctx: CanvasRenderingContext2D, env: FrameEnv, l: Launch, S: (p: Pt) => Pt, pxPerUnit: number): void {
  const spec = SMOKE[l.kind];
  if (spec.n === 0 || env.t < l.t0) return;
  const end = endTime(l);
  const c = ctrlFor(env.script, l);
  const seed = hashString(l.id);
  const dtE = l.flight / spec.n;
  const puffScale = Math.max(0.6, Math.min(2.2, pxPerUnit * 0.9));
  for (let k = 0; k < spec.n; k++) {
    const te = l.t0 + k * dtE;
    if (te > env.t || te > end) break;
    const u = progressAt(l, te);
    if (u > spec.until) break;
    const age = env.t - te;
    if (age > spec.life) continue;
    const f = age / spec.life;
    const p = S(pathPoint(l, c, u));
    const dx = (hash01(seed, k) - 0.5) * age * 0.45 * puffScale;
    const dy = (hash01(seed, k + 7919) - 0.5) * age * 0.45 * puffScale - age * 0.08 * puffScale;
    const r = (spec.size + age * 0.12) * puffScale;
    ctx.fillStyle = `rgba(178,184,194,${(spec.alpha * 0.9 * (1 - f) ** 1.6).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x + dx, p.y + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // interceptor exhaust
  const ic = l.intercept;
  const ictrl = interceptorCtrl(l, c);
  if (ic === null || ictrl === null || env.t < ic.tLaunch) return;
  const n = 18;
  for (let k = 0; k <= n; k++) {
    const te = ic.tLaunch + ((ic.tHit - ic.tLaunch) * k) / n;
    if (te > env.t) break;
    const age = env.t - te;
    if (age > 30) continue;
    const p = S(bez(ictrl, k / n));
    ctx.fillStyle = `rgba(120,185,190,${(0.2 * (1 - age / 30) ** 1.5).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x + (hash01(seed, k + 31) - 0.5) * age * 0.3, p.y - age * 0.05, (1 + age * 0.1) * puffScale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glow(ctx: CanvasRenderingContext2D, p: Pt, r: number, inner: string, outer: string): void {
  const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, outer);
  g.addColorStop(1, outer.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawLaunch(ctx: CanvasRenderingContext2D, env: FrameEnv, l: Launch, S: (p: Pt) => Pt): void {
  const { t, nowMs, script } = env;
  if (t < l.t0) return;
  const c = ctrlFor(script, l);
  const col = FACTION_COLORS[l.faction];
  const end = endTime(l);
  const intercepted = l.intercept !== null && l.intercept.success;
  const seed = hashString(l.id);
  const flicker = 0.75 + 0.25 * hash01(Math.floor(nowMs / 45), seed);

  if (t < end) {
    const u = progressAt(l, t);
    const head = S(pathPoint(l, c, u));
    // hot trail
    const span = l.kind === "drone" ? 0.03 : l.kind === "ballistic" ? 0.14 : 0.1;
    const u0 = Math.max(0, u - span);
    const n = 14;
    let prev = S(pathPoint(l, c, u0));
    for (let i = 1; i <= n; i++) {
      const p = S(pathPoint(l, c, u0 + ((u - u0) * i) / n));
      ctx.strokeStyle = rgba(col, (i / n) ** 1.3 * 0.95);
      ctx.lineWidth = l.kind === "ballistic" ? 2.6 : l.kind === "drone" ? 1.2 : 2;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
    }

    if (l.kind === "ballistic") {
      if (u < 0.38) glow(ctx, head, 16 * flicker, "rgba(255,196,84,0.95)", "rgba(232,120,40,0.4)"); // boost plume
      else if (u > 0.78) glow(ctx, head, 12 * flicker, "rgba(255,170,70,0.9)", rgba(col, 0.38)); // re-entry heating
      else glow(ctx, head, 7, rgba(col, 0.5), rgba(col, 0.2));
      headDot(ctx, head, 2.8, col);
    } else if (l.kind === "rocket") {
      glow(ctx, head, (u < 0.6 ? 10 : 7) * flicker, "rgba(255,196,96,0.8)", rgba(col, 0.26));
      headDot(ctx, head, 2.2, col);
    } else if (l.kind === "cruise") {
      glow(ctx, head, 7 * flicker, rgba(col, 0.55), rgba(col, 0.22));
      headDot(ctx, head, 2, col);
    } else if (l.kind === "airstrike") {
      glow(ctx, head, 8, rgba(col, 0.45), rgba(col, 0.18));
    }

    if (l.kind === "drone" || l.kind === "airstrike") {
      const ahead = S(pathPoint(l, c, Math.min(1, u + 0.01)));
      const ang = Math.atan2(ahead.y - head.y, ahead.x - head.x);
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(ang);
      ctx.fillStyle = l.kind === "drone" ? rgba(col, 0.95) : col;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (l.kind === "drone") {
        ctx.moveTo(5, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4);
      } else {
        ctx.moveTo(7, 0);
        ctx.lineTo(-3, -6);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-3, 6);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      if (l.kind === "drone" && Math.floor(nowMs / 400 + seed) % 2 === 0) {
        ctx.fillStyle = "rgba(200,40,40,0.95)";
        ctx.fillRect(head.x - 1.5, head.y - 1.5, 3, 3);
      }
    }

    if (env.trackedId === l.id) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      const s = 11;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(head.x + sx * s, head.y + sy * (s - 4));
        ctx.lineTo(head.x + sx * s, head.y + sy * s);
        ctx.lineTo(head.x + sx * (s - 4), head.y + sy * s);
        ctx.stroke();
      }
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = rgba(col, 0.6);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const p = S(pathPoint(l, c, u + ((1 - u) * i) / 30));
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // interceptor body
  const ic = l.intercept;
  const ictrl = interceptorCtrl(l, c);
  if (ic !== null && ictrl !== null && t >= ic.tLaunch && t < ic.tHit) {
    const v = clamp01((t - ic.tLaunch) / Math.max(0.01, ic.tHit - ic.tLaunch));
    const v0 = Math.max(0, v - 0.3);
    let prev = S(bez(ictrl, v0));
    for (let i = 1; i <= 12; i++) {
      const p = S(bez(ictrl, v0 + ((v - v0) * i) / 12));
      ctx.strokeStyle = rgba(INTERCEPTOR_COLOR, (i / 12) * 0.95);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      prev = p;
    }
    glow(ctx, prev, 9 * flicker, rgba(INTERCEPTOR_COLOR, 0.55), rgba(INTERCEPTOR_COLOR, 0.22));
    headDot(ctx, prev, 2.2, INTERCEPTOR_COLOR);
    // launch flash at the battery
    const since = t - ic.tLaunch;
    if (since < 4) {
      glow(ctx, S(ictrl[0]), 16 * (1 - since / 4), rgba(INTERCEPTOR_COLOR, 0.6), rgba(INTERCEPTOR_COLOR, 0.25));
    }
  }

  // kill: flash + shockwave + falling debris
  if (ic !== null && t >= ic.tHit) {
    const dt = t - ic.tHit;
    const p = S(pathPoint(l, c, ic.u));
    if (intercepted) {
      if (dt < 40) drawKill(ctx, p, dt, seed);
    } else if (dt < 8) {
      // near miss: interceptor self-destructs beside the threat
      glow(ctx, { x: p.x + 9, y: p.y - 6 }, 12 * (1 - dt / 8), rgba(INTERCEPTOR_COLOR, 0.5), rgba(INTERCEPTOR_COLOR, 0.2));
    }
  }

  // impact
  const tImpact = l.t0 + l.flight;
  if (!intercepted && t >= tImpact) {
    const friendly = AFFILIATION[l.faction] === "friend";
    drawBlast(ctx, env, S(pathPoint(l, c, 1)), t - tImpact, l.kind === "ballistic" || l.kind === "airstrike", seed, friendly ? FRIENDLY_BLAST_COLOR : BLAST_COLOR);
  }
}

function drawKill(ctx: CanvasRenderingContext2D, p: Pt, dt: number, seed: number): void {
  if (dt < 4) {
    glow(ctx, p, 30 * (1 - dt / 4) + 6, "rgba(255,214,120,0.95)", rgba(INTERCEPTOR_COLOR, 0.35));
    ctx.strokeStyle = rgba(INTERCEPTOR_COLOR, 0.9 * (1 - dt / 4));
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 + 3 * (1 - dt / 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (dt < 14) {
    const k = dt / 14;
    ctx.strokeStyle = rgba(INTERCEPTOR_COLOR, 0.9 * (1 - k));
    ctx.lineWidth = 2.2 * (1 - k) + 0.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + 34 * Math.sqrt(k), 0, Math.PI * 2);
    ctx.stroke();
  }
  // debris: ballistic fragments with gravity, glowing then cooling
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = hash01(seed, i * 13) * Math.PI * 2;
    const sp = 0.8 + hash01(seed, i * 17) * 1.8;
    const x = p.x + Math.cos(a) * sp * dt;
    const y = p.y + Math.sin(a) * sp * dt * 0.6 + 0.025 * dt * dt;
    const life = 1 - dt / 40;
    const hot = clamp01(1 - dt / 12);
    ctx.fillStyle = `rgba(${Math.round(85 + 140 * hot)},${Math.round(92 + 18 * hot)},${Math.round(104 - 74 * hot)},${(0.85 * life).toFixed(3)})`;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
}

function drawBlast(ctx: CanvasRenderingContext2D, env: FrameEnv, p: Pt, dt: number, heavy: boolean, seed: number, color: string): void {
  if (dt < 0) return;
  const scale = heavy ? 1 : 0.6;
  if (dt < 3) {
    glow(ctx, p, (40 * (1 - dt / 3) + 8) * scale, "rgba(255,206,90,1)", "rgba(226,96,36,0.5)");
  }
  if (dt < 30) {
    const k = dt / 30;
    for (let i = 0; i < 3; i++) {
      const kk = Math.max(0, k - i * 0.1);
      ctx.strokeStyle = rgba(color, 0.9 * (1 - kk));
      ctx.lineWidth = (2.2 - i * 0.6) * scale + 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (4 + 55 * Math.sqrt(kk)) * scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ejecta
    for (let i = 0; i < (heavy ? 14 : 8); i++) {
      const a = hash01(seed, i * 29 + 3) * Math.PI * 2;
      const sp = (1.2 + hash01(seed, i * 31) * 2.5) * scale;
      const x = p.x + Math.cos(a) * sp * dt;
      const y = p.y + Math.sin(a) * sp * dt * 0.7 + 0.03 * dt * dt;
      ctx.fillStyle = `rgba(${Math.round(200 - dt * 3)},${Math.round(110 - dt * 2)},40,${(0.9 * (1 - k)).toFixed(3)})`;
      ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
    }
  }
  // lingering fire, then scorch
  if (dt < 90) {
    const flick = 0.6 + 0.4 * hash01(Math.floor(env.nowMs / 80), seed);
    glow(ctx, p, 9 * scale * flick * (1 - dt / 90) + 2, "rgba(255,170,60,0.8)", "rgba(210,70,30,0.3)");
  }
  ctx.fillStyle = rgba(color === FRIENDLY_BLAST_COLOR ? "#24518F" : "#7A2A1A", 0.75);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// target acquisition reticles
// ---------------------------------------------------------------------------

function drawReticles(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt, active: Launch[]): void {
  const { nowMs, t } = env;
  for (const city of Object.values(CITIES)) {
    const incoming = active.filter((l) => AFFILIATION[l.faction] !== "friend" && l.targetName.en === city.name.en);
    if (incoming.length === 0) continue;
    const closing = Math.max(...incoming.map((l) => progressAt(l, t)));
    const c = SL(city.pos);
    const size = 30 - 16 * closing;
    const rot = (nowMs / 1800) % (Math.PI * 2);
    const pulse = 0.5 + 0.5 * Math.sin(nowMs / 160);

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rot * (closing > 0.8 ? 3 : 1));
    ctx.strokeStyle = `rgba(200,55,45,${(0.6 + 0.4 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1.6;
    const L = size * 0.38;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(sx * size, sy * (size - L));
      ctx.lineTo(sx * size, sy * size);
      ctx.lineTo(sx * (size - L), sy * size);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = "rgba(200,55,45,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x - size * 0.55, c.y);
    ctx.lineTo(c.x - 4, c.y);
    ctx.moveTo(c.x + 4, c.y);
    ctx.lineTo(c.x + size * 0.55, c.y);
    ctx.moveTo(c.x, c.y - size * 0.55);
    ctx.lineTo(c.x, c.y - 4);
    ctx.moveTo(c.x, c.y + 4);
    ctx.lineTo(c.x, c.y + size * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x, c.y, size * 0.8, 0, Math.PI * 2);
    ctx.setLineDash([2, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = `600 10px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillStyle = `rgba(179,48,42,${(0.8 + 0.2 * pulse).toFixed(3)})`;
    haloText(ctx, `LOCK ×${incoming.length}`, c.x + size + 4, c.y - size + 8);
  }
}

// ---------------------------------------------------------------------------
// labels
// ---------------------------------------------------------------------------

function drawOrigins(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt): void {
  const { script, t, lang, nowMs } = env;
  ctx.font = `500 11px ${SANS}`;
  ctx.textAlign = "center";
  for (const o of Object.values(ORIGINS)) {
    const firing = script.launches.some((l) => AFFILIATION[l.faction] === "hostile" && l.originName.en === o.name.en && t >= l.t0 - 20);
    if (!firing) continue;
    const c = SL(o.pos);
    const hot = script.launches.some((l) => l.originName.en === o.name.en && t >= l.t0 && t - l.t0 < 15);
    ctx.strokeStyle = hot ? `rgba(200,55,45,${(0.6 + 0.4 * Math.sin(nowMs / 90)).toFixed(3)})` : BAD_INK;
    ctx.fillStyle = "rgba(250,224,219,0.9)";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 7);
    ctx.lineTo(c.x + 6, c.y + 4);
    ctx.lineTo(c.x - 6, c.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = BAD_INK;
    haloText(ctx, o.name[lang], c.x, c.y + 18);
  }
}

function drawLabels(ctx: CanvasRenderingContext2D, env: FrameEnv, SL: (ll: LonLat) => Pt): void {
  const { cam, lang, w, h } = env;
  ctx.font = `500 11.5px ${SANS}`;
  for (const city of Object.values(CITIES)) {
    const c = SL(city.pos);
    ctx.fillStyle = INK;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (cam.scale > 0.9 || city.id === "tel_aviv") {
      ctx.textAlign = "start";
      ctx.fillStyle = "rgba(28,35,48,0.92)";
      haloText(ctx, city.name[lang], c.x + 6, c.y - 4);
    }
  }
  ctx.textAlign = "center";
  for (const r of REGIONS) {
    if (r.kind === "territory" && cam.scale < 1.1) continue;
    const c = SL(r.label);
    if (c.x < -40 || c.x > w + 40 || c.y < -20 || c.y > h + 20) continue;
    ctx.font = r.kind === "territory" ? `500 10.5px ${SANS}` : `600 12px ${SANS}`;
    ctx.fillStyle = r.kind === "own" ? "rgba(36,81,143,0.85)" : "rgba(85,94,108,0.62)";
    haloText(ctx, r.name[lang].toUpperCase(), c.x, c.y, 0.7);
  }
}
