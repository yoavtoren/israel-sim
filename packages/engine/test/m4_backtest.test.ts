/** M4 gate: backtest of sectoral participation 2000–2025 (MAPE reported),
 *  plus locality-agent sanity and the periphery lever. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tick, type SectorId, type WorldState } from "../src/index";
import { loadContext } from "./helpers";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const anchors = JSON.parse(
  readFileSync(join(dataDir, "normalized", "history", "participation_by_sector.json"), "utf8"),
) as { years: number[]; series: Record<string, number[]> };

describe("M4: sectors, localities, migration", () => {
  it("backtest 2000→2025: sector participation tracks the historical anchors (MAPE reported)", () => {
    const { ctx, initial } = loadContext("backtest-seed", 2000);
    const sampled: Record<string, Record<number, number>> = {};

    let s: WorldState = initial;
    const record = (state: WorldState): void => {
      for (const id of Object.keys(state.sectors) as SectorId[]) {
        for (const g of ["men", "women"] as const) {
          const key = `${id}_${g}`;
          (sampled[key] ??= {})[state.t.year] = state.sectors[id].labour_participation[g];
        }
      }
    };
    record(s);
    for (let i = 0; i < 26 * 4; i++) {
      s = tick(s, {}, ctx).state;
      if (s.t.quarter === 1) record(s);
    }

    let worst = { series: "", mape: 0 };
    let total = 0;
    let n = 0;
    console.log("participation backtest MAPE per series (2000–2025 anchors):");
    for (const [name, values] of Object.entries(anchors.series)) {
      let err = 0;
      anchors.years.forEach((year, i) => {
        err += Math.abs(sampled[name][year] - values[i]) / values[i];
      });
      const mape = err / anchors.years.length;
      total += err;
      n += anchors.years.length;
      if (mape > worst.mape) worst = { series: name, mape };
      console.log(`  ${name.padEnd(26)} ${(mape * 100).toFixed(2)}%`);
    }
    console.log(`  ${"OVERALL".padEnd(26)} ${((total / n) * 100).toFixed(2)}%  (worst: ${worst.series} ${(worst.mape * 100).toFixed(2)}%)`);

    expect(total / n).toBeLessThan(0.08);
    expect(worst.mape).toBeLessThan(0.12);
  });

  it("locality agents load, stay positive, and drift smoothly", () => {
    const { ctx, initial } = loadContext();
    expect(initial.localities.count).toBeGreaterThan(1000);
    let s = initial;
    for (let i = 0; i < 20; i++) s = tick(s, {}, ctx).state;
    for (let i = 0; i < s.localities.count; i++) {
      expect(s.localities.population[i]).toBeGreaterThan(0);
      expect(s.localities.employment[i]).toBeGreaterThan(0);
      expect(s.localities.employment[i]).toBeLessThan(1);
    }
  });

  it("periphery program: targeted low-cluster localities gain population share vs the no-program run", () => {
    const { ctx, initial } = loadContext();
    const targetShare = (s: WorldState): number => {
      let target = 0;
      let all = 0;
      for (let i = 0; i < s.localities.count; i++) {
        all += s.localities.population[i];
        if (s.localities.cluster[i] >= 1 && s.localities.cluster[i] <= 3) target += s.localities.population[i];
      }
      return target / all;
    };
    const run = (decisions: Parameters<typeof tick>[1]): WorldState => {
      let s = initial;
      for (let i = 0; i < 40; i++) s = tick(s, decisions, ctx).state;
      return s;
    };
    const base = run({});
    const program = run({ periphery: { annual_budget: 3000, target_clusters: [1, 2, 3] } });
    expect(targetShare(program)).toBeGreaterThan(targetShare(base));
    // The program costs real money: deficit is higher than baseline.
    expect(program.fiscal.deficit).toBeGreaterThan(base.fiscal.deficit);
  });
});
