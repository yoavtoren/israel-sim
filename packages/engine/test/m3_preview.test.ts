/** M3 gate: the budget-preview panel works at engine level —
 *  shadow-tick diff shows what moves, degradation rules show what breaks,
 *  and sustained underfunding actually fires its events in the real tick. */

import { describe, expect, it } from "vitest";
import { previewBudget, tick, type WorldState } from "../src/index";
import { loadContext } from "./helpers";

describe("M3: budget preview (shadow tick)", () => {
  const { ctx, initial } = loadContext();
  const baselineOf = (id: string): number => ctx.ministries.find((d) => d.id === id)!.baseline_budget;

  it("zero-change proposal produces no diffs, no breaks, no events", () => {
    const p = previewBudget(initial, {}, ctx);
    expect(p.diffs).toHaveLength(0);
    expect(p.breaks).toHaveLength(0);
    expect(p.events).toHaveLength(0);
  });

  it("education cut: deficit falls, teacher stock erodes, both degradation rules surface with delays", () => {
    const p = previewBudget(initial, { budgets: { education: 0.7 * baselineOf("education") } }, ctx);

    const deficit = p.diffs.find((d) => d.path === "fiscal.deficit");
    expect(deficit).toBeDefined();
    expect(deficit!.delta).toBeLessThan(0);

    const teachers = p.diffs.find((d) => d.path === "infrastructure.teachers");
    expect(teachers).toBeDefined();
    expect(teachers!.delta).toBeLessThan(0);

    const eduBreaks = p.breaks.filter((b) => b.ministry === "education");
    expect(eduBreaks.some((b) => /quality/i.test(b.surfaces_as))).toBe(true);
    expect(eduBreaks.find((b) => b.effect === "politics.approval_by_sector.*")!.fires_after_quarters).toBe(8);
  });

  it("moderate defense cut activates the readiness rule but not the deterrence rule", () => {
    const p = previewBudget(initial, { budgets: { defense: 0.75 * baselineOf("defense") } }, ctx);
    const defBreaks = p.breaks.filter((b) => b.ministry === "defense");
    expect(defBreaks.some((b) => b.effect === "security.force_readiness")).toBe(true);
    expect(defBreaks.some((b) => b.effect === "security.deterrence_index")).toBe(false);
  });

  it("raising a budget produces no breaks for that ministry and moves its output up", () => {
    const p = previewBudget(initial, { budgets: { health: 1.5 * baselineOf("health") } }, ctx);
    expect(p.breaks.filter((b) => b.ministry === "health")).toHaveLength(0);
    const beds = p.diffs.find((d) => d.path === "infrastructure.hospital_beds");
    expect(beds).toBeDefined();
    expect(beds!.delta).toBeGreaterThan(0);
  });

  it("sustained underfunding compounds through rigidity and fires the triggered event", () => {
    const decisions = { budgets: { internal_security: 0.5 * baselineOf("internal_security") } };
    let s: WorldState = initial;
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      const r = tick(s, decisions, ctx);
      s = r.state;
      seen.push(...r.events.map((e) => e.id));
    }
    // rigidity 0.8/yr → fr < 0.7 after ~7 quarters; rule needs 4 sustained quarters.
    expect(seen).toContain("public_safety_crisis");
    expect(s.fiscal.ministries.internal_security.funding_ratio).toBeLessThan(0.7);
    // The event fired exactly once (counter crossing, not every quarter).
    expect(seen.filter((id) => id === "public_safety_crisis")).toHaveLength(1);
  });
});
