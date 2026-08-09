/** M6 gate: the isolation scenario terminates coherently — a mass-atrocity
 *  order collapses diplomacy, an embargoed war consumes stockpiles with no
 *  resupply, and exhaustion is a computable defeat. Plus the other red lines. */

import { describe, expect, it } from "vitest";
import { quartersOfSupply, tick, type WorldState } from "../src/index";
import { loadContext } from "./helpers";

describe("M6: security, diplomacy, red lines", () => {
  it("isolation scenario terminates coherently: embargo → drain → computable defeat with human cost reported", () => {
    const { ctx, initial } = loadContext("isolation");
    // Some quarters of normal play first.
    let s: WorldState = initial;
    for (let i = 0; i < 4; i++) s = tick(s, {}, ctx).state;

    // The order is issued once.
    const r = tick(s, { orders: { mass_atrocity_order: true } }, ctx);
    s = r.state;
    expect(r.events.some((e) => e.id === "red_line_mass_atrocity")).toBe(true);
    expect(s.diplomacy.arms_embargo).toBe(true);
    expect(s.diplomacy.us_support.military_aid).toBe(0);
    expect(s.diplomacy.trade_access.europe).toBeLessThanOrEqual(0.1);
    for (const v of Object.values(s.diplomacy.alignment)) expect(v).toBeLessThanOrEqual(-0.9);
    expect(s.security.active_fronts.length).toBeGreaterThan(0);

    // Supply is now finite and computable.
    const qos0 = quartersOfSupply(s, ctx.registry);
    expect(Number.isFinite(qos0)).toBe(true);
    expect(qos0).toBeLessThan(25);

    // Zero-change play from here: stockpiles drain monotonically, GDP sags, and
    // the run ends in a military collapse within a bounded number of quarters.
    let ended = 0;
    const gdpAtOrder = s.macro.gdp_real;
    let lastInterceptors = s.security.stockpiles.interceptors;
    for (let i = 0; i < 30; i++) {
      s = tick(s, {}, ctx).state;
      if (s.outcome.ended) { ended = i + 1; break; }
      expect(s.security.stockpiles.interceptors).toBeLessThanOrEqual(lastInterceptors + 1e-6);
      lastInterceptors = s.security.stockpiles.interceptors;
    }
    expect(ended).toBeGreaterThan(0);
    expect(s.outcome.kind).toBe("military_collapse");
    // C6: consequence-reporting with explicit numbers, framed as failure.
    expect(s.outcome.note).toMatch(/casualties/i);
    expect(s.outcome.note).toMatch(/\d/);
    expect(s.outcome.note).toMatch(/failure/i);
    expect(s.security.war_casualties).toBeGreaterThan(1000);
    expect(s.macro.gdp_real).toBeLessThan(gdpAtOrder * 0.85);

    // Absorbing: further ticks are no-ops.
    const frozen = tick(s, {}, ctx).state;
    expect(frozen.t.year).toBe(s.t.year);
    expect(frozen.macro.gdp_real).toBe(s.macro.gdp_real);
  });

  it("nuclear use is terminal immediately and never a strategy", () => {
    const { ctx, initial } = loadContext("nuclear");
    const r = tick(initial, { orders: { nuclear_use: true } }, ctx);
    expect(r.state.outcome.ended).toBe(true);
    expect(r.state.outcome.kind).toBe("nuclear");
    for (const v of Object.values(r.state.diplomacy.trade_access)) expect(v).toBe(0);
    expect(r.state.outcome.note).toMatch(/no post-war scenario/i);
  });

  it("debt spiral triggers a forced IMF austerity program", () => {
    const { ctx, initial } = loadContext("debt-spiral");
    const s = structuredClone(initial);
    s.fiscal.debt = 1.4 * s.macro.gdp_real;
    s.macro.debt_gdp = 1.4;
    s.macro.bond_yield_10y = 0.09;
    const before = Object.values(s.fiscal.ministries).reduce((a, m) => a + m.budget, 0);
    const r = tick(s, {}, ctx);
    expect(r.events.some((e) => e.id === "red_line_imf_program")).toBe(true);
    const after = Object.values(r.state.fiscal.ministries).reduce((a, m) => a + m.budget, 0);
    expect(after).toBeLessThan(before * 0.9);
    expect(r.state.fiscal.tax_policy.revenue_multiplier).toBeGreaterThan(1.05);
  });

  it("civil-war pressure accumulates under social collapse and becomes absorbing", () => {
    const { ctx, initial } = loadContext("civil");
    const s = structuredClone(initial);
    s.politics.social_cohesion = 0.1;
    s.politics.institutional_trust = 0.05;
    s.sectors.haredi.grievance = 0.95;
    s.sectors.arab.grievance = 0.95;
    s.sectors.secular.grievance = 0.1;
    let cur: WorldState = s;
    let ended = false;
    for (let i = 0; i < 60 && !ended; i++) {
      // Keep the pressure cooker sealed: reversion pulls slowly, so re-pin the drivers.
      cur = tick(cur, {}, ctx).state;
      cur.politics.social_cohesion = Math.min(cur.politics.social_cohesion, 0.1);
      cur.politics.institutional_trust = Math.min(cur.politics.institutional_trust, 0.05);
      ended = cur.outcome.ended;
    }
    expect(ended).toBe(true);
    expect(cur.outcome.kind).toBe("civil_conflict");
    expect(cur.outcome.note).toMatch(/absorbing failure state/i);
  });

  it("baseline run stays at peace: no fronts, Ω ≈ 1, casualties zero, no red lines", () => {
    const { ctx, initial } = loadContext("peace");
    let s = initial;
    for (let i = 0; i < 40; i++) s = tick(s, {}, ctx).state;
    expect(s.outcome.ended).toBe(false);
    expect(s.security.active_fronts).toHaveLength(0);
    expect(s.security.war_casualties).toBe(0);
    expect(s.diplomacy.arms_embargo).toBe(false);
    expect(s.politics.civil_war_pressure).toBeLessThan(0.3);
  });
});
