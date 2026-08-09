/** M7 gate: the government can fall. Plus reforms (prerequisites, pipeline
 *  non-refund, irreversibility) and economic-model overlays with transition costs. */

import { describe, expect, it } from "vitest";
import { enactedReformCost, tick, totalRevenue, type WorldState } from "../src/index";
import { loadContext } from "./helpers";

describe("M7: reforms, economic models, coalition", () => {
  it("GATE: sustained anti-coalition budgets bring the government down and trigger elections", () => {
    const { ctx, initial } = loadContext("gov-falls");
    // Gut every ministry the coalition partners care about, keep cutting to the compounding floor.
    const decisions = {
      budgets: {
        education: 0, welfare: 0, religious_services: 0, housing: 0, health: 0,
      },
      reforms: { judicial_reform: "enact" as const },
    };
    let s: WorldState = initial;
    let fell = false;
    let quarters = 0;
    const partiesBefore = initial.politics.coalition.parties.map((p) => p.id).join(",");
    for (let i = 0; i < 40 && !fell; i++) {
      const r = tick(s, decisions, ctx);
      s = r.state;
      quarters++;
      if (r.events.some((e) => e.id === "government_falls")) {
        fell = true;
        expect(r.events.some((e) => e.id === "elections_held")).toBe(true);
      }
    }
    expect(fell).toBe(true);
    console.log(`government fell after ${quarters} quarters`);
    // Elections produced a new coalition with a majority and reset stability.
    expect(s.politics.coalition.seats).toBeGreaterThanOrEqual(61);
    expect(s.politics.coalition.parties.map((p) => p.id).join(",")).not.toBe(partiesBefore);
    expect(s.politics.coalition.stability).toBeGreaterThan(0.3);
    expect(s.outcome.ended).toBe(false); // elections, not a terminal state
  });

  it("a well-funded status quo keeps the coalition standing for a decade", () => {
    const { ctx, initial } = loadContext("gov-stands");
    let s = initial;
    for (let i = 0; i < 40; i++) {
      const r = tick(s, {}, ctx);
      s = r.state;
      expect(r.events.some((e) => e.id === "government_falls")).toBe(false);
    }
    expect(s.politics.coalition.stability).toBeGreaterThan(0.25);
  });

  it("reforms: prerequisites block, enactment pays into the pipeline, repeal does not refund it", () => {
    const { ctx, initial } = loadContext("reforms");
    // Blocked: vocational_colleges requires haredi_core_curriculum.
    let r = tick(initial, { reforms: { vocational_colleges: "enact" } }, ctx);
    expect(r.state.reforms.vocational_colleges).toBeUndefined();
    expect(r.log.some((e) => e.fn === "reform_blocked" && /prerequisites/.test(e.note ?? ""))).toBe(true);

    // Enact the prerequisite: haredi grievance jumps now, vocational share pays off later.
    r = tick(initial, { reforms: { haredi_core_curriculum: "enact" } }, ctx);
    const enacted = r.state;
    expect(enacted.reforms.haredi_core_curriculum.status).toBe("enacted");
    expect(enacted.sectors.haredi.grievance).toBeGreaterThan(initial.sectors.haredi.grievance);
    expect(enacted.pipeline.some((p) => p.origin.decision === "reform:haredi_core_curriculum")).toBe(true);
    expect(enactedReformCost(enacted, ctx.reforms)).toBe(1500);

    // Run 8 years enacted, then repeal: in-flight pipeline effects keep flowing.
    let s = enacted;
    for (let i = 0; i < 32; i++) s = tick(s, {}, ctx).state;
    const vocBefore = s.sectors.haredi.vocational_share;
    s = tick(s, { reforms: { haredi_core_curriculum: "repeal" } }, ctx).state;
    expect(s.reforms.haredi_core_curriculum.status).toBe("repealed");
    expect(enactedReformCost(s, ctx.reforms)).toBe(0);
    expect(s.pipeline.some((p) => p.origin.decision === "reform:haredi_core_curriculum")).toBe(true);
    for (let i = 0; i < 8; i++) s = tick(s, {}, ctx).state;
    expect(s.sectors.haredi.vocational_share).toBeGreaterThan(vocBefore); // still maturing

    // Irreversible reforms cannot be repealed.
    let s2 = tick(initial, { reforms: { pension_reform: "enact" } }, ctx).state;
    s2 = tick(s2, { reforms: { pension_reform: "repeal" } }, ctx).state;
    expect(s2.reforms.pension_reform.status).toBe("enacted");
  });

  it("economic-model switch: overlay changes revenue immediately, transition shocks stability", () => {
    const { ctx, initial } = loadContext("models");
    const base = tick(initial, {}, ctx).state;
    const lib = tick(initial, { economic_model: "libertarian" }, ctx).state;
    // Lower tax take under the libertarian overlay, same GDP inputs.
    expect(totalRevenue(lib)).toBeLessThan(totalRevenue(base) * 0.75);
    // Transition costs hit stability and cohesion.
    expect(lib.politics.coalition.stability).toBeLessThan(base.politics.coalition.stability - 0.1);
    expect(lib.economic_model).toBe("libertarian");
    // Bigger deficit is the price of the tax cut.
    expect(lib.fiscal.deficit).toBeGreaterThan(base.fiscal.deficit * 1.5);
  });
});
