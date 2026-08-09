/** Calibration (spec §3.4 method 2): fit a logistic participation curve per
 *  sector×gender to the 2000–2025 anchor table by grid search (min MAPE), and
 *  compute the 25-64 → 15+ definition bridge so the weighted aggregate at the
 *  2026 initial state equals the BoI-fetched participation rate.
 *  Writes packages/data/constants/participation.json. Offline — no network. */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataRoot, normalizedDir } from "./lib";

interface Anchors { years: number[]; series: Record<string, number[]> }
const anchors = JSON.parse(readFileSync(join(normalizedDir, "history", "participation_by_sector.json"), "utf8")) as Anchors;

const logistic = (low: number, high: number, k: number, t0: number, year: number): number =>
  low + (high - low) / (1 + Math.exp(-k * (year - t0)));

function fit(years: number[], values: number[]): { low: number; high: number; k: number; t0: number; mape: number } {
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const rising = values[values.length - 1] >= values[0];
  let best = { low: vMin, high: vMax, k: 0.1, t0: 2012, mape: Infinity };
  for (let low = vMin - 0.06; low <= vMin + 0.02; low += 0.005) {
    for (let high = vMax - 0.02; high <= vMax + 0.08; high += 0.005) {
      for (let k = 0.03; k <= 0.4; k += 0.01) {
        for (let t0 = 1995; t0 <= 2030; t0 += 1) {
          const [a, b] = rising ? [low, high] : [high, low];
          let err = 0;
          for (let i = 0; i < years.length; i++) {
            err += Math.abs(logistic(a, b, k, t0, years[i]) - values[i]) / values[i];
          }
          const mape = err / years.length;
          if (mape < best.mape) best = { low: a, high: b, k, t0, mape };
        }
      }
    }
  }
  return best;
}

const entries: Array<Record<string, unknown>> = [];
const src = "fit by packages/data/etl/calibrate_participation.ts to normalized/history/participation_by_sector.json (hand-transcribed CBS/BoI/Taub anchors)";
const fits: Record<string, { low: number; high: number; k: number; t0: number; mape: number }> = {};

for (const [name, values] of Object.entries(anchors.series)) {
  const f = fit(anchors.years, values);
  fits[name] = f;
  console.log(`${name}: low=${f.low.toFixed(3)} high=${f.high.toFixed(3)} k=${f.k.toFixed(2)} t0=${f.t0} fit-MAPE=${(f.mape * 100).toFixed(2)}%`);
  for (const [param, value] of [["low", f.low], ["high", f.high], ["k", f.k], ["t0", f.t0]] as const) {
    entries.push({
      id: `participation.${name}.${param}`,
      value: +Number(value).toFixed(4),
      unit: param === "k" ? "1/yr logistic steepness" : param === "t0" ? "logistic midpoint year" : "participation fraction (25-64)",
      lag_kernel: "immediate",
      confidence: "medium",
      source: src,
    });
  }
}

// Definition bridge: weighted 2026 aggregate of the fitted curves vs BoI 15+ participation.
const initial = JSON.parse(readFileSync(join(normalizedDir, "initial_2026.json"), "utf8")) as {
  macro: { participation: number };
  sectors: Record<string, { population: number; age_structure: number[] }>;
};
let wSum = 0;
let pSum = 0;
for (const [sector, sec] of Object.entries(initial.sectors)) {
  const wa = sec.population * sec.age_structure[1];
  const men = fits[`${sector}_men`];
  const women = fits[`${sector}_women`];
  const p = (logistic(men.low, men.high, men.k, men.t0, 2026) + logistic(women.low, women.high, women.k, women.t0, 2026)) / 2;
  wSum += wa;
  pSum += wa * p;
}
const aggregate = pSum / wSum;
const bridge = initial.macro.participation / aggregate;
console.log(`2026 curve aggregate (25-64): ${(aggregate * 100).toFixed(2)}% → def_bridge to 15+ rate ${(initial.macro.participation * 100).toFixed(2)}%: ${bridge.toFixed(4)}`);

entries.push(
  { id: "participation.def_bridge", value: +bridge.toFixed(4), unit: "macro 15+ participation per weighted 25-64 sector participation", lag_kernel: "immediate", confidence: "medium", source: "computed: BoI LF_R_Q (15+) / weighted 25-64 curve aggregate at 2026" },
  { id: "participation.convergence_quarterly", value: 0.25, unit: "fraction of gap to curve target closed per quarter", lag_kernel: "immediate", confidence: "placeholder", source: "invented, needs real data" },
  { id: "participation.edu_target_beta", value: 0.05, unit: "relative shift of participation target per unit education funding-ratio deviation", lag_kernel: "immediate", confidence: "placeholder", source: "invented, needs real data (spec §6.1 response function)", ci: [0, 0.15] },
  { id: "participation.welfare_target_beta", value: -0.03, unit: "relative shift of participation target per unit welfare funding-ratio deviation (transfer-dependency channel)", lag_kernel: "immediate", confidence: "low", source: "assumption; contested literature on transfer generosity vs participation", ci: [-0.08, 0] },
);

writeFileSync(join(dataRoot, "constants", "participation.json"), JSON.stringify(entries, null, 1));
console.log(`wrote constants/participation.json (${entries.length} entries)`);
