/**
 * Invariant tests (protocol: written in M1, green forever):
 *  1 money conserves   2 population conserves   3 determinism
 *  4 zero-change run is smooth   5 doubling a ministry never worsens its own indicator
 * Plus tick purity (input state is never mutated).
 */

import { describe, expect, it } from "vitest";
import { hashState, tick, totalRevenue, totalSpend, totalPopulation, type Decisions, type WorldState } from "../src/index";
import type { EngineContext } from "../src/tick";
import { deepFreeze, loadContext, numericLeaves } from "./helpers";

const YEARS = 10;
const TICKS = YEARS * 4;

function run(ctx: EngineContext, initial: WorldState, decisions: Decisions, ticks = TICKS): WorldState[] {
  const states: WorldState[] = [initial];
  let s = initial;
  for (let i = 0; i < ticks; i++) {
    s = tick(s, decisions, ctx).state;
    states.push(s);
  }
  return states;
}

describe("invariants", () => {
  it("money conserves: revenue − spend − carried debt service == −deficit, every tick", () => {
    const { ctx, initial } = loadContext();
    const states = run(ctx, initial, {});
    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1];
      const next = states[i];
      const nonMinistry = ctx.registry.get("fiscal.non_ministry_spend_annual");
      const residual = totalRevenue(next) - totalSpend(next) - nonMinistry - prev.fiscal.debt_service + next.fiscal.deficit;
      expect(Math.abs(residual)).toBeLessThan(1e-6);
      // Debt issuance matches the deficit exactly.
      const issued = next.fiscal.debt - prev.fiscal.debt;
      expect(Math.abs(issued - next.fiscal.deficit / 4)).toBeLessThan(1e-6);
    }
  });

  it("population conserves: sector totals move only by logged natural-growth flows", () => {
    const { ctx, initial } = loadContext();
    const states = run(ctx, initial, {});
    for (let i = 1; i < states.length; i++) {
      const prev = states[i - 1];
      const next = states[i];
      const flows = next.log
        .filter((e) => e.fn === "natural_growth")
        .reduce((a, e) => a + e.delta, 0);
      const diff = totalPopulation(next) - totalPopulation(prev);
      expect(Math.abs(diff - flows)).toBeLessThan(1e-3); // persons, fp epsilon
    }
  });

  it("determinism: same (state, decisions, seed) → byte-identical final state hash", () => {
    const a = loadContext("seed-A");
    const b = loadContext("seed-A");
    const c = loadContext("seed-B");
    const ha = hashState(run(a.ctx, a.initial, {}).at(-1));
    const hb = hashState(run(b.ctx, b.initial, {}).at(-1));
    const hc = hashState(run(c.ctx, c.initial, {}).at(-1));
    expect(ha).toBe(hb);
    expect(ha).not.toBe(hc);
  });

  it("tick purity: input state is never mutated", () => {
    const { ctx, initial } = loadContext();
    const before = hashState(initial);
    deepFreeze(initial);
    const result = tick(initial, {}, ctx);
    expect(result.state).not.toBe(initial);
    expect(hashState(initial)).toBe(before);
  });

  it("zero-change 10-year run: smooth trends, no drama, sane values", () => {
    const { ctx, initial } = loadContext();
    const states = run(ctx, initial, {});

    const tracked = [
      "macro.gdp_real", "macro.capital_stock", "macro.unemployment", "macro.debt_gdp",
      "infrastructure.teachers", "infrastructure.hospital_beds", "security.force_readiness",
      "security.stockpiles.interceptors", "security.stockpiles.artillery_shells",
    ];
    for (let i = 1; i < states.length; i++) {
      for (const [path, v] of numericLeaves({ s: states[i] })) {
        expect(Number.isFinite(v), `${path} is not finite at tick ${i}`).toBe(true);
      }
      for (const p of tracked) {
        const get = (s: WorldState): number =>
          p.split(".").reduce((o: unknown, k) => (o as Record<string, unknown>)[k], s) as number;
        const prev = get(states[i - 1]);
        const cur = get(states[i]);
        expect(prev).toBeGreaterThan(0);
        expect(Math.abs(cur - prev) / Math.abs(prev), `${p} moved >50% at tick ${i}`).toBeLessThan(0.5);
        expect(cur, `${p} went negative at tick ${i}`).toBeGreaterThanOrEqual(0);
      }
    }

    // Population drift within ±2%/yr.
    for (let y = 1; y <= YEARS; y++) {
      const growth = totalPopulation(states[y * 4]) / totalPopulation(states[(y - 1) * 4]) - 1;
      expect(Math.abs(growth)).toBeLessThan(0.02);
    }

    // Trend continuation, not drama: GDP ends within a sane band of start.
    const g10 = states.at(-1)!.macro.gdp_real / states[0].macro.gdp_real;
    expect(g10).toBeGreaterThan(1.05);
    expect(g10).toBeLessThan(1.6);
  });

  it("doubling a ministry's budget never worsens its own headline indicator", () => {
    const { ctx, initial } = loadContext();
    const base = run(ctx, initial, {}).at(-1)!;
    const cases: Array<{ decisions: Decisions; headline: (s: WorldState) => number }> = [
      { decisions: { budgets: { education: 170000 } }, headline: (s) => s.infrastructure.teachers },
      { decisions: { budgets: { health: 120000 } }, headline: (s) => s.infrastructure.hospital_beds },
      { decisions: { budgets: { defense: 220000 } }, headline: (s) => s.security.force_readiness },
    ];
    for (const { decisions, headline } of cases) {
      const doubled = run(ctx, initial, decisions).at(-1)!;
      expect(headline(doubled)).toBeGreaterThanOrEqual(headline(base) - 1e-9);
    }
  });
});
