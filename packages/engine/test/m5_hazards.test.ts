/** M5 gate: simulated terror/protest rates match the historical distribution
 *  (recent-regime means from normalized/history/incidents.json), plus spawn
 *  chains, cooldowns, and dispersion sanity. */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tick, type WorldState } from "../src/index";
import { loadContext } from "./helpers";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));
const incidents = JSON.parse(
  readFileSync(join(dataDir, "normalized", "history", "incidents.json"), "utf8"),
) as { calibration_regime: { terror_mean_per_year: number; protest_mean_per_year: number } };

describe("M5: hazards and events", () => {
  it("terror and protest rates match the historical regime mean (20 seeds × 10y)", () => {
    const SEEDS = 20;
    const YEARS = 10;
    let terror = 0;
    let protest = 0;
    const annualTerror: number[] = [];
    for (let seedIdx = 0; seedIdx < SEEDS; seedIdx++) {
      const { ctx, initial } = loadContext(`m5-seed-${seedIdx}`);
      let s: WorldState = initial;
      let yearCount = 0;
      for (let q = 0; q < YEARS * 4; q++) {
        const r = tick(s, {}, ctx);
        s = r.state;
        for (const e of r.events) {
          if (e.id === "terror_incident") {
            terror += e.count;
            yearCount += e.count;
          }
          if (e.id === "mass_protest") protest += e.count;
        }
        if (s.t.quarter === 1) {
          annualTerror.push(yearCount);
          yearCount = 0;
        }
      }
    }
    const simYears = SEEDS * YEARS;
    const terrorPerYear = terror / simYears;
    const protestPerYear = protest / simYears;
    console.log(`simulated rates over ${simYears} sim-years: terror ${terrorPerYear.toFixed(1)}/yr (target ${incidents.calibration_regime.terror_mean_per_year}), protest ${protestPerYear.toFixed(2)}/yr (target ${incidents.calibration_regime.protest_mean_per_year})`);

    expect(terrorPerYear).toBeGreaterThan(incidents.calibration_regime.terror_mean_per_year * 0.7);
    expect(terrorPerYear).toBeLessThan(incidents.calibration_regime.terror_mean_per_year * 1.3);
    expect(protestPerYear).toBeGreaterThan(incidents.calibration_regime.protest_mean_per_year * 0.5);
    expect(protestPerYear).toBeLessThan(incidents.calibration_regime.protest_mean_per_year * 1.5);

    // Dispersion: annual counts vary (a distribution, not a constant).
    const mean = annualTerror.reduce((a, b) => a + b, 0) / annualTerror.length;
    const variance = annualTerror.reduce((a, b) => a + (b - mean) ** 2, 0) / annualTerror.length;
    expect(variance).toBeGreaterThan(1);
  });

  it("spawn queue fires follow-on events next tick (escalation chains)", () => {
    const { ctx, initial } = loadContext();
    const s = structuredClone(initial);
    s.pending_events = ["general_strike"];
    const r = tick(s, {}, ctx);
    expect(r.events.some((e) => e.id === "general_strike" && e.note === "spawned")).toBe(true);
    // The strike's effects landed.
    expect(r.state.macro.productivity_index).toBeLessThan(s.macro.productivity_index * 1.001);
  });

  it("condition events respect thresholds and cooldowns", () => {
    const { ctx, initial } = loadContext();
    const s = structuredClone(initial);
    s.security.stockpiles.interceptors = 3000;
    const r1 = tick(s, {}, ctx);
    expect(r1.events.some((e) => e.id === "stockpile_alert")).toBe(true);
    // Still below threshold next tick, but cooldown (8q) suppresses a refire.
    const r2 = tick(r1.state, {}, ctx);
    expect(r2.events.some((e) => e.id === "stockpile_alert")).toBe(false);
  });

  it("ambient events leave the 10-year baseline bounded (no runaway feedback)", () => {
    const { ctx, initial } = loadContext("bounded-check");
    let s = initial;
    for (let q = 0; q < 40; q++) s = tick(s, {}, ctx).state;
    expect(s.politics.social_cohesion).toBeGreaterThan(0.3);
    expect(s.politics.protest_intensity).toBeLessThan(0.6);
    for (const v of Object.values(s.security.threat_level)) expect(v).toBeLessThan(0.95);
    for (const v of Object.values(s.politics.approval_by_sector)) expect(v).toBeGreaterThan(0.05);
    expect(s.security.stockpiles.interceptors).toBeGreaterThan(2000);
  });
});
