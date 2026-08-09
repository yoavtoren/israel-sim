/** Number formatting — DESIGN §3: every number mono, unit always visible. */

/** ₪M/yr engine unit → "₪412.5B" */
export function fmtBudget(m: number, digits = 1): string {
  return `₪${(m / 1000).toFixed(digits)}B`;
}

export function fmtPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function fmtSignedPct(fraction: number, digits = 1): string {
  const v = fraction * 100;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function fmtCompact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  return n.toFixed(abs < 10 && !Number.isInteger(n) ? digits : 0);
}

export function fmtSigned(n: number, digits = 1): string {
  return `${n > 0 ? "+" : ""}${fmtCompact(n, digits)}`;
}

/** "Q3 2031" / "2031 ר3" — keep LTR mono form everywhere per DESIGN */
export function fmtQuarter(year: number, quarter: number): string {
  return `Q${quarter} ${year}`;
}

/** State paths where a LOWER value is the good direction. Everything else: higher is good. */
const LOWER_IS_GOOD: RegExp[] = [
  /unemployment/, /inflation/, /poverty/, /debt/, /deficit/, /grievance/, /protest/,
  /civil_war_pressure/, /water_deficit/, /congestion/, /emissions/, /threat/, /gini/,
  /welfare_dependency/, /bond_yield/, /war_casualties/, /mobilization/,
];

export function goodDirection(path: string): 1 | -1 {
  return LOWER_IS_GOOD.some((r) => r.test(path)) ? -1 : 1;
}

/** semantic color class for a delta on a given state path */
export function deltaClass(path: string, delta: number): string {
  if (delta === 0) return "text-fg2";
  const good = Math.sign(delta) === goodDirection(path);
  return good ? "text-good-bright" : "text-bad-bright";
}
