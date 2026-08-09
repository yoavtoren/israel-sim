/** Color scales from DESIGN.md — the only chart colors in the app. */

import type { SectorId } from "@engine";

export const SECTOR_COLORS: Record<SectorId, string> = {
  secular: "#4C9BE8",
  national_religious: "#2EA98F",
  haredi: "#8B7EC8",
  arab: "#E8A33D",
  other: "#C97BA8",
};

export const DOMAIN = {
  fiscal: "#E3B341",
  macro: "#7EE787",
  security: "#E8604C",
  diplomacy: "#58A6FF",
  social: "#D2A8FF",
  infra: "#79C0FF",
} as const;

export const INK = { fg0: "#E6EDF3", fg1: "#93A4B5", fg2: "#5C6B7A", line0: "#2A3444", line1: "#3A4658", bg1: "#111722", bg2: "#1A2230" } as const;
export const SEM = { good: "#2EA043", goodBright: "#3FB950", bad: "#DA3633", badBright: "#F85149", warn: "#D29922", warnBright: "#E3B341", info: "#3B82D0", infoBright: "#58A6FF" } as const;

/** DESIGN map sequential ramp, 5 stops */
const SEQ = ["#0E1B2C", "#1E4976", "#2E7BB8", "#58A6FF", "#A5D6FF"];

function hexToRgb(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

function mix(a: string, b: string, u: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const c = ra.map((v, i) => Math.round(v + (rb[i] - v) * u));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** t in [0,1] → sequential ramp color */
export function seqColor(u: number): string {
  const x = Math.max(0, Math.min(1, u)) * (SEQ.length - 1);
  const i = Math.min(SEQ.length - 2, Math.floor(x));
  return mix(SEQ[i], SEQ[i + 1], x - i);
}

/** diverging vs a midpoint: bad-base → bg-1 → good-base (DESIGN §1) */
export function divColor(u: number): string {
  const x = Math.max(-1, Math.min(1, u));
  return x < 0 ? mix(INK.bg1, SEM.bad, -x) : mix(INK.bg1, SEM.good, x);
}

/** socio-economic cluster 1–10: warn → info interpolation (DESIGN §1) */
export function clusterColor(cluster: number): string {
  if (cluster <= 0) return INK.fg2;
  return mix(SEM.warn, SEM.info, (cluster - 1) / 9);
}

/** semantic band for a 0–1 gauge where higher is better */
export function bandColor(v: number, warnBelow: number, badBelow: number): string {
  if (v < badBelow) return SEM.badBright;
  if (v < warnBelow) return SEM.warnBright;
  return SEM.good;
}

/** threat heat 0–1 */
export function threatColor(v: number): string {
  return mix(INK.bg2, SEM.bad, Math.max(0, Math.min(1, v)));
}
