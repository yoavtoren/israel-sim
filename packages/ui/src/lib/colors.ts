/** Color scales from DESIGN.md — the only chart colors in the app (light theme). */

import type { SectorId } from "@engine";

export const SECTOR_COLORS: Record<SectorId, string> = {
  secular: "#3F84CF",
  national_religious: "#2A9A82",
  haredi: "#7A6BBD",
  arab: "#D9912A",
  other: "#BF6A9A",
};

export const DOMAIN = {
  fiscal: "#C9921F",
  macro: "#3C9A66",
  security: "#D05A43",
  diplomacy: "#2F63B0",
  social: "#8A63C2",
  infra: "#3B8FB8",
} as const;

export const INK = { fg0: "#1C2330", fg1: "#555E6C", fg2: "#8B919A", line0: "#E7E1D6", line1: "#D3CBBD", bg1: "#FFFFFF", bg2: "#F6F3ED" } as const;
export const SEM = { good: "#3C9A66", goodBright: "#1F7A4A", bad: "#D9534A", badBright: "#B3302A", warn: "#D49A2A", warnBright: "#946312", info: "#2F63B0", infoBright: "#24518F" } as const;

/** sequential ramp on paper, 5 stops (light → deep blue) */
const SEQ = ["#EEF3F8", "#C6D8EC", "#8DB3DA", "#4F86C0", "#23508F"];

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

/** diverging vs a midpoint: bad → paper → good (DESIGN §1) */
export function divColor(u: number): string {
  const x = Math.max(-1, Math.min(1, u));
  return x < 0 ? mix("#F4F1EA", SEM.bad, -x) : mix("#F4F1EA", SEM.good, x);
}

/** socio-economic cluster 1–10: warn → info interpolation (DESIGN §1) */
export function clusterColor(cluster: number): string {
  if (cluster <= 0) return INK.fg2;
  return mix(SEM.warn, SEM.info, (cluster - 1) / 9);
}

/** semantic band for a 0–1 gauge where higher is better */
export function bandColor(v: number, warnBelow: number, badBelow: number): string {
  if (v < badBelow) return SEM.bad;
  if (v < warnBelow) return SEM.warn;
  return SEM.good;
}

/** threat heat 0–1 */
export function threatColor(v: number): string {
  return mix("#F6E9E4", SEM.bad, Math.max(0, Math.min(1, v)));
}
