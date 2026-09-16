/** The still picture: what the country looks like between events. Nothing in
 *  this file moves — it is drawn from the campaign flags, the metrics and the
 *  scars that past scenes left behind. A frame drawn now and a frame drawn a
 *  minute from now are identical. */

import { strategic } from "@engine";
import { hash01, hashString } from "../scenarios";
import type { LonLat } from "../geo";
import {
  BLUE, INK, OLIVE_DARK, RED, along, box, crane, fillRing, house, label, lerp, pathLength, person, puff, rig, scorch,
  ship, smokeColumn, vehicle, type Frame,
} from "./draw";
import {
  AREA_C, BARRIER, DEAD_SEA, GAZA_FENCE, KINNERET, OUTPOSTS, P, PAL_TOWNS, RIGS, SETTLEMENTS, type PlaceId,
} from "./places";

export interface LivingWorld {
  flags: strategic.CampaignFlags;
  metrics: strategic.SimulationMetrics;
  track: strategic.PolicyTrack | null;
  step: number;
  /** false before the government is formed */ active: boolean;
  atWar: boolean;
}

export function worldFromGame(game: strategic.CampaignState): LivingWorld {
  const active = game.phase !== "party" && game.phase !== "coalition";
  return {
    flags: game.flags,
    metrics: game.sim.metrics,
    track: game.sim.activeTrack,
    step: game.step,
    active,
    atWar: active && strategic.warOngoing(game),
  };
}

export type ScarKind = "burn" | "rubble" | "crater" | "scorched" | "wreck";
export interface Scar {
  id: string;
  kind: ScarKind;
  at: LonLat;
  size: number;
  step: number;
}

/** The barrier stands until sovereignty is legislated. */
export function barrierDown(world: LivingWorld): boolean {
  return world.flags.annexationLaw;
}

export interface StillOverrides {
  /** barrier demolition in progress: fraction already down (north → south) */ barrierProgress: number | null;
  /** settlements being evacuated right now (drawn by the scene instead) */ settlementsInScene: boolean;
}

const L = (id: PlaceId): LonLat => P[id];

// ---------------------------------------------------------------------------

export function drawStill(f: Frame, world: LivingWorld, scars: Scar[], o: StillOverrides): void {
  if (f.far <= 0 && f.ground <= 0) return;
  const { ctx } = f;
  ctx.save();
  drawWater(f);
  if (f.far > 0) {
    ctx.globalAlpha = f.far;
    drawSea(f, world);
  }
  if (f.ground > 0) {
    ctx.globalAlpha = f.ground;
    if (world.flags.annexationLaw) drawSovereignty(f);
    drawTowns(f, world, o);
    drawBarrier(f, world, o.barrierProgress);
    drawInfrastructure(f, world);
    drawDeployments(f, world);
    drawScars(f, scars, world.step);
    drawPlaceLabels(f);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// water, sea, ports
// ---------------------------------------------------------------------------

function drawWater(f: Frame): void {
  const a = smoothA(40, 90, f.ppd);
  if (a <= 0) return;
  f.ctx.save();
  f.ctx.globalAlpha = a;
  fillRing(f, KINNERET, "#AFCBDD", "rgba(60,110,140,0.45)", 0.8);
  fillRing(f, DEAD_SEA, "#BFD6DA", "rgba(60,110,140,0.45)", 0.8);
  f.ctx.restore();
}

function smoothA(a: number, b: number, v: number): number {
  const x = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

function drawSea(f: Frame, world: LivingWorld): void {
  const fl = world.flags;
  // ships at anchor off the ports
  const anchored: Array<{ at: LonLat; kind: "cargo" | "tanker"; a: number }> = [
    { at: [34.9, 32.9], kind: "cargo", a: 0.4 }, { at: [34.52, 31.9], kind: "tanker", a: 0.3 }, { at: [34.9, 29.4], kind: "cargo", a: -1.2 },
  ];
  if (fl.euSanctions || fl.redSeaBlockade) {
    // idle ships queue outside Haifa: trade is stuck
    for (let i = 0; i < 4; i++) anchored.push({ at: [34.72 - i * 0.07, 33.0 + (i % 2) * 0.05], kind: i % 2 === 0 ? "cargo" : "tanker", a: 0.2 * i });
  }
  anchored.forEach((s, i) => {
    const p = f.L(s.at);
    if (f.on(p)) ship(f, p, s.a, s.kind, false, 100 + i);
  });
  for (const r of RIGS) {
    const p = f.L(r);
    if (f.on(p) && f.ground > 0) rig(f, p);
  }
  // naval posture
  const blockade = fl.gazaSiege || fl.gazaOccupied;
  const navy: LonLat[] = blockade ? [[34.25, 31.62], [34.14, 31.47], [34.05, 31.32]] : [[34.2, 31.55]];
  navy.forEach((ll, i) => {
    const p = f.L(ll);
    if (f.on(p)) ship(f, p, Math.PI / 2 + 0.6, "corvette", false, 200 + i);
  });
  if (blockade && f.ppd > 110) label(f, f.lang === "he" ? "סגר ימי" : "Naval blockade", f.L([34.0, 31.62]), "#35506E", 10.5);
  if (fl.redSeaBlockade) {
    const wreck = f.L([42.25, 15.1]);
    if (f.on(wreck, 80)) {
      ship(f, wreck, -1.2, "cargo", false, 300);
      smokeColumn(f, wreck, 4, f.u, 300, 1e9, 0.35);
      if (f.ppd > 25) label(f, f.lang === "he" ? "הים האדום חסום" : "Red Sea closed", { x: wreck.x, y: wreck.y - 40 * f.u }, RED);
    }
  }
  if (!fl.usArmsHold && world.active && (world.atWar || world.metrics.securityThreat >= 60) && world.metrics.usMilitaryAid >= 50) {
    const c = f.L(P.east_med);
    if (f.on(c, 80)) {
      ship(f, c, 0.3, "carrier", false, 400);
      ship(f, { x: c.x - 30 * f.u, y: c.y + 14 * f.u }, 0.3, "destroyer", false, 401);
      ship(f, { x: c.x + 26 * f.u, y: c.y - 16 * f.u }, 0.3, "destroyer", false, 402);
      if (f.ppd > 45) label(f, f.lang === "he" ? "נושאת מטוסים אמריקנית" : "US carrier group", { x: c.x, y: c.y - 22 * f.u }, "#35506E", 10.5);
    }
  }
  if (fl.emigrationProgram) {
    const port = f.L(P.gaza_port);
    for (let i = 0; i < 2; i++) if (f.on(port)) ship(f, { x: port.x - (8 + i * 9) * f.u, y: port.y + i * 4 * f.u }, Math.PI, "ferry", false, 500 + i);
  }
}

// ---------------------------------------------------------------------------
// towns, settlements, skylines
// ---------------------------------------------------------------------------

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

const CITY_SPECS: Array<{ id: PlaceId; n: number; spread: number; h: [number, number]; kind: "glass" | "stone" | "mixed" | "low" }> = [
  { id: "tel_aviv", n: 24, spread: 10, h: [4, 30], kind: "glass" },
  { id: "haifa", n: 12, spread: 8, h: [3, 16], kind: "mixed" },
  { id: "jerusalem", n: 16, spread: 9, h: [3, 9], kind: "stone" },
  { id: "beersheba", n: 9, spread: 7, h: [3, 11], kind: "mixed" },
  { id: "ashdod", n: 8, spread: 6, h: [3, 12], kind: "mixed" },
  { id: "netanya", n: 8, spread: 5, h: [4, 14], kind: "glass" },
  { id: "ashkelon", n: 6, spread: 5, h: [3, 10], kind: "mixed" },
  { id: "eilat", n: 6, spread: 5, h: [3, 9], kind: "mixed" },
  { id: "gaza_city", n: 14, spread: 7, h: [3, 9], kind: "low" },
  { id: "khan_younis", n: 8, spread: 5, h: [2, 6], kind: "low" },
  { id: "rafah", n: 6, spread: 4, h: [2, 5], kind: "low" },
];

function drawTowns(f: Frame, world: LivingWorld, o: StillOverrides): void {
  const { ctx, u } = f;
  const a = smoothA(90, 150, f.ppd);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const nuked = world.flags.nuclearUsed;
  for (const sp of CITY_SPECS) {
    const c = f.L(L(sp.id));
    if (!f.on(c, 60)) continue;
    const gazaSide = sp.id === "gaza_city" || sp.id === "khan_younis" || sp.id === "rafah";
    if (gazaSide && nuked) continue;
    const ruin = gazaSide && (world.flags.indiscriminateBombing || world.flags.gazaOccupied) ? 0.55 : 0;
    for (const [i, t] of skyline(sp.id, sp.n, sp.spread, sp.h[0], sp.h[1]).entries()) {
      const p = { x: c.x + t.dx * u, y: c.y + t.dy * u };
      const w = 3.2 * u * t.w;
      const broken = ruin > 0 && hash01(hashString(sp.id), i + 300) < ruin;
      const hh = t.h * u * 0.8 * (broken ? 0.3 : 1);
      if (sp.kind === "glass" || (sp.kind === "mixed" && t.tone > 0.55)) {
        const l = Math.round(lerp(150, 190, t.tone));
        box(ctx, p, w, w, hh, `rgb(${l + 40},${l + 50},${l + 60})`, `rgb(${l - 30},${l - 15},${l + 5})`, `rgb(${l - 60},${l - 45},${l - 25})`);
      } else if (sp.kind === "low") {
        box(ctx, p, w, w, hh, broken ? "#9C958A" : "#E6DCC8", broken ? "#7E776C" : "#CDBFA4", broken ? "#6A645A" : "#B3A487");
      } else {
        box(ctx, p, w, w, hh, "#EFE4CC", "#D6C49C", "#B9A57B");
      }
    }
    if (sp.id === "jerusalem") {
      const p = { x: c.x + 2 * u, y: c.y - 3 * u };
      box(ctx, { x: p.x, y: p.y + 1 * u }, 5 * u, 3 * u, 2.5 * u, "#8FB3C9", "#5E86A6", "#4B6E8A");
      const g = ctx.createRadialGradient(p.x - u, p.y - 4 * u, 0.3, p.x, p.y - 3 * u, 3 * u);
      g.addColorStop(0, "#FFF1B8");
      g.addColorStop(1, "#C9961E");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x + 0.8 * u, p.y - 1.5 * u, 2.2 * u, Math.PI, 0);
      ctx.fill();
      // the Knesset
      const k = f.L(P.knesset);
      box(ctx, { x: k.x - 6 * u, y: k.y + 2 * u }, 6 * u, 4 * u, 2.4 * u, "#F2EEE4", "#CFC7B4", "#B2A993");
    }
  }
  // kibbutzim on the Gaza border
  for (const id of ["kfar_aza", "nahal_oz", "sderot"] as PlaceId[]) {
    const c = f.L(L(id));
    if (!f.on(c)) continue;
    for (let i = 0; i < 5; i++) house(ctx, { x: c.x + (hash01(i, 11) - 0.5) * 12 * u, y: c.y + (hash01(i, 12) - 0.5) * 6 * u }, 0.8 * u, "#B5523B");
  }
  // Palestinian towns: flat roofs, sand tones
  for (const id of PAL_TOWNS) {
    const c = f.L(L(id));
    if (!f.on(c)) continue;
    const seed = hashString(id);
    for (let i = 0; i < 6; i++) {
      const p = { x: c.x + (hash01(seed, i) - 0.5) * 12 * u, y: c.y + (hash01(seed, i + 9) - 0.5) * 7 * u };
      box(ctx, p, 2.6 * u, 2.2 * u, (1.2 + hash01(seed, i + 30) * 2) * u, "#EAE0CB", "#D2C3A5", "#BCAB8A");
    }
  }
  // Israeli settlements: red roofs on hilltops (gone after a withdrawal)
  if (!world.flags.withdrawal && !o.settlementsInScene) {
    for (const id of SETTLEMENTS) drawSettlement(f, L(id), hashString(id), 6);
    const outposts = world.flags.annexationLaw ? OUTPOSTS.length : world.track === "CONSERVATIVE_RIGHT_ANNEXATION" || world.track === "RADICAL_RIGHT_DEPORTATION" ? 5 : 2;
    OUTPOSTS.slice(0, outposts).forEach((ll, i) => drawSettlement(f, ll, 900 + i, 3, true));
  } else if (world.flags.withdrawal && !o.settlementsInScene) {
    // empty foundations where settlements stood
    for (const id of SETTLEMENTS) {
      const c = f.L(L(id));
      if (!f.on(c)) continue;
      ctx.fillStyle = "rgba(150,140,125,0.45)";
      for (let i = 0; i < 5; i++) ctx.fillRect(c.x + (hash01(i, 21) - 0.5) * 10 * u, c.y + (hash01(i, 22) - 0.5) * 5 * u, 2.6 * u, 1.6 * u);
    }
  }
  ctx.restore();
}

export function drawSettlement(f: Frame, ll: LonLat, seed: number, n: number, caravans = false): void {
  const c = f.L(ll);
  if (!f.on(c)) return;
  const u = f.u;
  for (let i = 0; i < n; i++) {
    const p = { x: c.x + (hash01(seed, i + 40) - 0.5) * 10 * u, y: c.y + (hash01(seed, i + 41) - 0.5) * 5 * u };
    if (caravans) box(f.ctx, p, 3 * u, 1.6 * u, 1.2 * u, "#F4F1EA", "#D9D4C8", "#BDB6A8");
    else house(f.ctx, p, 0.75 * u, "#C0503A");
  }
}

// ---------------------------------------------------------------------------
// sovereignty tint, barrier
// ---------------------------------------------------------------------------

function drawSovereignty(f: Frame): void {
  for (const ring of AREA_C) fillRing(f, ring, "rgba(47,99,176,0.13)", "rgba(47,99,176,0.45)", 1);
  if (f.ppd > 110) label(f, f.lang === "he" ? "שטחי C · ריבונות" : "Area C · sovereignty", f.L([35.46, 31.72]), BLUE, 10.5);
}

export function drawBarrier(f: Frame, world: LivingWorld, progress: number | null): void {
  const down = progress !== null ? progress : barrierDown(world) ? 1 : 0;
  drawWall(f, GAZA_FENCE, 2.2, "rgba(120,118,110,0.85)", "#E9E4D8", 0);
  drawWall(f, BARRIER, 3.2, "#A39D8F", "#DDD6C6", down);
  if (f.ppd > 120 && down < 1) {
    const mid = f.S(along(BARRIER, 0.28).p);
    label(f, f.lang === "he" ? "גדר ההפרדה" : "Separation barrier", { x: mid.x - 34 * f.u, y: mid.y + 4 }, "#6B6456", 10.5);
  }
}

/** Wall with height; `down` = fraction demolished from the start of the path. */
function drawWall(f: Frame, path: LonLat[], height: number, face: string, top: string, down: number): void {
  const { ctx, u } = f;
  const step = Math.max(0.5, 400 / f.ppd);
  const n = Math.max(8, Math.ceil(pathLength(path) / step));
  const hPx = height * u;
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const cur = f.S(along(path, k).p);
    const dead = k < down;
    if (dead) {
      if (i % 2 === 0 && f.on(cur, 10) && f.ppd > 100) {
        ctx.fillStyle = "rgba(150,142,128,0.55)";
        ctx.fillRect(cur.x + (hash01(i, 3) - 0.5) * 2.5 * u, cur.y + (hash01(i, 4) - 0.5) * 2.5 * u, 1.2 * u, 0.9 * u);
      }
      prev = null;
      continue;
    }
    if (prev !== null && (f.on(cur, 20) || f.on(prev, 20))) {
      ctx.strokeStyle = "rgba(40,34,24,0.2)";
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      ctx.moveTo(prev.x + hPx * 0.5, prev.y + hPx * 0.25);
      ctx.lineTo(cur.x + hPx * 0.5, cur.y + hPx * 0.25);
      ctx.stroke();
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
    }
    prev = cur;
  }
}

// ---------------------------------------------------------------------------
// bases, batteries, crossings
// ---------------------------------------------------------------------------

function drawInfrastructure(f: Frame, world: LivingWorld): void {
  const { ctx, u } = f;
  const a = smoothA(80, 130, f.ppd);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  // Ben Gurion
  const bg = f.L(P.ben_gurion);
  if (f.on(bg)) {
    runway(f, bg, -0.45, 12);
    runway(f, bg, 0.7, 10);
  }
  // air bases
  for (const id of ["nevatim", "hatzerim", "ramat_david"] as PlaceId[]) {
    const p = f.L(L(id));
    if (!f.on(p)) continue;
    runway(f, p, 0.2, 9);
    ctx.fillStyle = "#8C949E";
    for (let i = 0; i < 3; i++) ctx.fillRect(p.x - 5 * u + i * 3 * u, p.y + 4 * u, 2 * u, 1.2 * u);
  }
  // Iron Dome batteries: launcher boxes
  for (const id of ["dome_south", "dome_gushdan", "dome_north", "dome_negev"] as PlaceId[]) {
    const p = f.L(L(id));
    if (!f.on(p)) continue;
    for (let i = 0; i < 3; i++) box(ctx, { x: p.x + (i - 1) * 3.2 * u, y: p.y }, 2.4 * u, 1.8 * u, 1.4 * u, "#8E9A6A", "#6F7A50", "#58623F");
  }
  // ports
  for (const id of ["haifa_port", "ashdod_port"] as PlaceId[]) {
    const p = f.L(L(id));
    if (!f.on(p)) continue;
    for (let i = 0; i < 3; i++) crane(f, { x: p.x + i * 4 * u, y: p.y + i * 1.5 * u }, 0.55 * u);
  }
  // crossings: a gate that is red when closed
  const closed = world.flags.gazaSiege || world.flags.gazaOccupied || world.flags.transferOrdered;
  for (const id of ["kerem_shalom", "erez"] as PlaceId[]) {
    const p = f.L(L(id));
    if (!f.on(p)) continue;
    box(ctx, p, 4 * u, 2 * u, 1.6 * u, "#E8E2D4", "#C9C0AE", "#AFA592");
    ctx.fillStyle = closed ? RED : "#3C9A66";
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4 * u, 1.3 * u, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world.flags.gazaSiege && !world.flags.gazaOccupied) {
    // aid trucks halted in a queue at Kerem Shalom
    const k = f.L(P.kerem_shalom);
    for (let i = 0; i < 6; i++) vehicle(f, { x: k.x + (6 + i * 7) * u * 0.9, y: k.y + (2 + i * 3.2) * u * 0.9 }, -2.6, "truck", 0, false, undefined, i);
    if (f.ppd > 130) label(f, f.lang === "he" ? "משאיות סיוע עצורות" : "Aid trucks halted", { x: k.x + 30 * u, y: k.y + 30 * u }, RED, 10.5);
  }
  ctx.restore();
}

function runway(f: Frame, p: { x: number; y: number }, angle: number, len: number): void {
  const { ctx, u } = f;
  const dx = Math.cos(angle) * len * u * 0.5;
  const dy = Math.sin(angle) * len * u * 0.5;
  ctx.strokeStyle = "rgba(80,84,92,0.8)";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.7 * u;
  ctx.beginPath();
  ctx.moveTo(p.x - dx, p.y - dy);
  ctx.lineTo(p.x + dx, p.y + dy);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 0.35 * u;
  ctx.setLineDash([1.2 * u, 1.2 * u]);
  ctx.beginPath();
  ctx.moveTo(p.x - dx, p.y - dy);
  ctx.lineTo(p.x + dx, p.y + dy);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ---------------------------------------------------------------------------
// standing deployments (parked, not moving)
// ---------------------------------------------------------------------------

const GAZA_AIM: LonLat = [34.42, 31.45];
const LEB_AIM: LonLat = [35.45, 33.3];

function aimFrom(f: Frame, p: { x: number; y: number }, target: LonLat): number {
  const t = f.L(target);
  return Math.atan2(t.y - p.y, t.x - p.x);
}

function parked(f: Frame, ll: LonLat, kind: Parameters<typeof vehicle>[3], heading: number, aim: LonLat | null, seed: number): void {
  const p = f.L(ll);
  if (!f.on(p)) return;
  vehicle(f, p, heading, kind, 0, false, aim === null ? heading : aimFrom(f, p, aim), seed);
}

function drawDeployments(f: Frame, world: LivingWorld): void {
  const fl = world.flags;
  const { u } = f;
  if (fl.gazaOccupied) {
    const spots: LonLat[] = [[34.47, 31.5], [34.41, 31.45], [34.36, 31.39], [34.31, 31.33], [34.39, 31.42]];
    spots.forEach((ll, i) => parked(f, ll, i % 2 === 0 ? "tank" : "apc", 2.4, GAZA_AIM, i));
    // the corridor road cutting the Strip
    const a = f.L([34.39, 31.44]);
    const b = f.L([34.49, 31.47]);
    f.ctx.strokeStyle = "rgba(95,107,62,0.55)";
    f.ctx.lineWidth = 2.2 * u;
    f.ctx.setLineDash([3 * u, 2 * u]);
    f.ctx.beginPath();
    f.ctx.moveTo(a.x, a.y);
    f.ctx.lineTo(b.x, b.y);
    f.ctx.stroke();
    f.ctx.setLineDash([]);
    if (f.ppd > 120) label(f, f.lang === "he" ? "ממשל צבאי ברצועה" : "Military government in Gaza", f.L([34.18, 31.5]), OLIVE_DARK, 10.5);
  } else if (world.active) {
    parked(f, [34.58, 31.46], "tank", 3.6, GAZA_AIM, 1);
    parked(f, [34.45, 31.27], "tank", 3.9, GAZA_AIM, 2);
  }
  if (fl.lebanonWar) {
    parked(f, [35.38, 33.2], "tank", -1.3, LEB_AIM, 3);
    parked(f, [35.5, 33.18], "apc", -1.4, LEB_AIM, 4);
    parked(f, [35.25, 33.15], "tank", -1.1, LEB_AIM, 5);
    parked(f, [35.3, 32.98], "howitzer", -1.2, LEB_AIM, 6);
    parked(f, [35.42, 32.99], "howitzer", -1.3, LEB_AIM, 7);
  } else if (world.active) {
    parked(f, [35.3, 33.03], "tank", 0.1, world.atWar ? LEB_AIM : null, 8);
  }
  if (world.active) parked(f, [35.77, 33.02], "tank", -1.5, null, 9);
  if (fl.paDismantled) {
    for (const id of ["jenin", "nablus", "ramallah", "hebron"] as PlaceId[]) {
      const ll = L(id);
      parked(f, [ll[0] - 0.03, ll[1] - 0.02], "humvee", 0.5, null, hashString(id) % 7);
    }
  }
  if (fl.unForce) {
    for (const ll of [[35.26, 32.18], [35.2, 31.95], [35.12, 31.58]] as LonLat[]) {
      parked(f, ll, "un", 0.4, null, 1);
      const p = f.L(ll);
      if (f.on(p)) flagPole(f, { x: p.x + 5 * u, y: p.y }, "#4B92DB");
    }
  }
  if (fl.transferOrdered) {
    // Egyptian armor deployed along the border and tent camps in northern Sinai
    for (let i = 0; i < 4; i++) parked(f, [34.12 - i * 0.05, 31.12 - i * 0.12], "egypt_tank", 0.4, [34.3, 31.25], i);
    const camp = f.L([33.95, 31.12]);
    if (f.on(camp)) {
      for (let i = 0; i < 18; i++) tent(f, { x: camp.x + ((i % 6) - 3) * 4 * u, y: camp.y + (Math.floor(i / 6) - 1) * 3.2 * u });
      if (f.ppd > 110) label(f, f.lang === "he" ? "מחנות אוהלים בסיני" : "Tent camps in Sinai", { x: camp.x, y: camp.y - 14 * u }, INK, 10.5);
    }
  }
  if (fl.massProtests || fl.emergencyRule) {
    const k = f.L(P.kaplan);
    if (f.on(k, 60) && f.people > 0) {
      f.ctx.save();
      f.ctx.globalAlpha *= f.people;
      for (let i = 0; i < 8; i++) tent(f, { x: k.x - 14 * u + i * 4 * u, y: k.y + 8 * u + (i % 2) * 2 * u });
      for (let i = 0; i < 14; i++) {
        const q = { x: k.x + (hash01(i, 71) - 0.5) * 22 * u, y: k.y + (hash01(i, 72) - 0.5) * 8 * u };
        person(f, q, 0.25, { color: ["#3B4A63", "#6E5A4A", "#2F5E8C", "#8A4B4B"][i % 4], flag: i % 5 === 0 ? BLUE : null });
      }
      if (fl.emergencyRule) {
        parked(f, [34.795, 32.066], "police", 0, null, 0);
        parked(f, [34.776, 32.078], "water_cannon", 3.1, null, 0);
      }
      f.ctx.restore();
    }
  }
  if (fl.nuclearUsed) {
    const g = f.L(GAZA_AIM);
    puff(f.ctx, g, 40 * u, "rgba(45,38,32,0.55)");
    puff(f.ctx, { x: g.x + 30 * u, y: g.y - 12 * u }, 50 * u, "rgba(120,110,95,0.25)");
  }
}

function tent(f: Frame, p: { x: number; y: number }): void {
  const { ctx, u } = f;
  ctx.fillStyle = "rgba(40,34,24,0.18)";
  ctx.fillRect(p.x, p.y - 0.5 * u, 3.4 * u, 1 * u);
  ctx.fillStyle = "#E9E4D6";
  ctx.beginPath();
  ctx.moveTo(p.x - 1.6 * u, p.y);
  ctx.lineTo(p.x, p.y - 2.2 * u);
  ctx.lineTo(p.x + 1.6 * u, p.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(120,110,95,0.7)";
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

function flagPole(f: Frame, p: { x: number; y: number }, color: string): void {
  const { ctx, u } = f;
  ctx.strokeStyle = "#6A6A6A";
  ctx.lineWidth = 0.5 * u;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - 8 * u);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(p.x, p.y - 8 * u, 4 * u, 2.6 * u);
}

// ---------------------------------------------------------------------------
// scars left by past scenes
// ---------------------------------------------------------------------------

function drawScars(f: Frame, scars: Scar[], step: number): void {
  const { ctx, u } = f;
  for (const s of scars) {
    const p = f.L(s.at);
    if (!f.on(p, 30)) continue;
    const age = Math.max(0, step - s.step);
    const strength = Math.max(0.3, 1 - age * 0.12);
    switch (s.kind) {
      case "burn":
        scorch(f, p, s.size * u, strength);
        house(ctx, { x: p.x + 2 * u, y: p.y + 1 * u }, 0.8 * u * s.size, "#5A4A40", "#9A8F80", 0.7);
        break;
      case "crater":
        scorch(f, p, s.size * 0.7 * u, strength);
        ctx.strokeStyle = `rgba(70,60,50,${(0.6 * strength).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 2.4 * s.size * u, 1.2 * s.size * u, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "rubble":
        scorch(f, p, s.size * 0.8 * u, strength * 0.8);
        ctx.fillStyle = `rgba(130,120,108,${(0.9 * strength).toFixed(3)})`;
        for (let i = 0; i < 6; i++) ctx.fillRect(p.x + (hash01(i, s.id.length) - 0.5) * 7 * u, p.y + (hash01(i + 5, s.id.length) - 0.5) * 3.5 * u, 1.6 * u, 1.1 * u);
        break;
      case "scorched":
        puff(ctx, p, 14 * s.size * u, `rgba(40,32,26,${(0.4 * strength).toFixed(3)})`);
        break;
      case "wreck":
        ship(f, p, -0.8, "cargo", false, 7);
        scorch(f, p, 1.2 * u, strength);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// place names
// ---------------------------------------------------------------------------

const NAMES: Partial<Record<PlaceId, { he: string; en: string }>> = {
  tel_aviv: { he: "תל אביב", en: "Tel Aviv" }, jerusalem: { he: "ירושלים", en: "Jerusalem" }, haifa: { he: "חיפה", en: "Haifa" },
  beersheba: { he: "באר שבע", en: "Be'er Sheva" }, ashdod: { he: "אשדוד", en: "Ashdod" }, ashkelon: { he: "אשקלון", en: "Ashkelon" },
  netanya: { he: "נתניה", en: "Netanya" }, eilat: { he: "אילת", en: "Eilat" }, afula: { he: "עפולה", en: "Afula" },
  sderot: { he: "שדרות", en: "Sderot" }, kiryat_shmona: { he: "קריית שמונה", en: "Kiryat Shmona" }, nahariya: { he: "נהריה", en: "Nahariya" },
  gaza_city: { he: "עזה", en: "Gaza" }, khan_younis: { he: "חאן יונס", en: "Khan Younis" }, rafah: { he: "רפיח", en: "Rafah" },
  jenin: { he: "ג'נין", en: "Jenin" }, nablus: { he: "שכם", en: "Nablus" }, ramallah: { he: "רמאללה", en: "Ramallah" }, hebron: { he: "חברון", en: "Hebron" },
  ben_gurion: { he: "נתב\"ג", en: "Ben Gurion" }, nevatim: { he: "נבטים", en: "Nevatim" }, ramat_david: { he: "רמת דוד", en: "Ramat David" },
  tyre: { he: "צור", en: "Tyre" }, beirut: { he: "ביירות", en: "Beirut" }, amman: { he: "עמאן", en: "Amman" },
};

function drawPlaceLabels(f: Frame): void {
  const major: PlaceId[] = ["tel_aviv", "jerusalem", "haifa", "beersheba", "eilat", "gaza_city", "beirut", "amman"];
  const detail = f.ppd > 140;
  for (const [id, name] of Object.entries(NAMES) as Array<[PlaceId, { he: string; en: string }]>) {
    if (!detail && !major.includes(id)) continue;
    const p = f.L(L(id));
    if (!f.on(p, 0)) continue;
    f.ctx.fillStyle = INK;
    f.ctx.beginPath();
    f.ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    f.ctx.fill();
    label(f, name[f.lang], { x: p.x, y: p.y + 13 }, INK, major.includes(id) ? 11.5 : 10, major.includes(id) ? 600 : 500);
  }
}
