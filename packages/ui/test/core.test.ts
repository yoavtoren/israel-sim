/** M10 gate tests — the worker core is the UI's engine seam; exercised directly
 *  (no DOM). Covers init meta, advance frames, preview purity, counterfactual
 *  replay, determinism through the UI layer, and a playable decade.
 */

import { describe, expect, it } from "vitest";
import { hashState } from "@engine";
import { SimCore } from "../src/sim/core";
import type { HistoryFrame } from "../src/sim/types";

function finiteFrame(f: HistoryFrame): boolean {
  const scalars = [
    f.gdp_real, f.unemployment, f.debt_gdp, f.deficit, f.readiness, f.deterrence,
    f.stability, f.cohesion, f.poverty_rate, f.revenue_total, f.spend_total,
  ];
  return scalars.every((v) => Number.isFinite(v));
}

describe("SimCore.init", () => {
  it("returns run meta the screens depend on", () => {
    const core = new SimCore("ui-test");
    const { meta, frame, state } = core.init("ui-test");

    expect(meta.ministries).toHaveLength(17);
    expect(meta.reforms.length).toBeGreaterThanOrEqual(9);
    expect(meta.models).toContain("libertarian");
    expect(meta.placeholder_ids.length).toBeGreaterThan(0);

    // map layer: nearly all localities carry WGS84 coordinates inside Israel's bbox
    const { lon, lat, code, name_he } = meta.localities;
    expect(code.length).toBeGreaterThan(1100);
    expect(name_he.length).toBe(code.length);
    let withCoords = 0;
    for (let i = 0; i < code.length; i++) {
      if (Number.isFinite(lon[i])) {
        withCoords++;
        expect(lon[i]).toBeGreaterThan(33.5);
        expect(lon[i]).toBeLessThan(36.5);
        expect(lat[i]).toBeGreaterThan(29);
        expect(lat[i]).toBeLessThan(34);
      }
    }
    expect(withCoords / code.length).toBeGreaterThan(0.95);

    expect(frame.tickIndex).toBe(0);
    expect(finiteFrame(frame)).toBe(true);
    expect(frame.loc_population.length).toBe(code.length);
    expect(state.t.year).toBe(2026);
  });
});

describe("SimCore.advance", () => {
  it("produces one frame per quarter with sane values", () => {
    const core = new SimCore("ui-test");
    core.init("ui-test");
    const r = core.advance(4, {});
    expect(r.frames).toHaveLength(4);
    expect(r.frames.map((f) => f.tickIndex)).toEqual([1, 2, 3, 4]);
    for (const f of r.frames) expect(finiteFrame(f)).toBe(true);
    expect(r.state.t.year).toBe(2027);
    expect(r.log.length).toBeGreaterThan(0);
  });

  it("applies decisions on the first tick and they persist", () => {
    const core = new SimCore("ui-test");
    core.init("ui-test");
    const baseline = core.preview({});
    expect(baseline.diffs).toHaveLength(0);

    const r = core.advance(2, { budgets: { education: 85000 } });
    const fr = r.frames[1].funding_ratio.education;
    expect(fr).toBeLessThan(0.95);
    expect(fr).toBeGreaterThan(0.5);
  });

  it("is deterministic through the UI seam", () => {
    const a = new SimCore("det");
    a.init("det");
    a.advance(8, { budgets: { defense: 140000 } });
    const b = new SimCore("det");
    b.init("det");
    b.advance(8, { budgets: { defense: 140000 } });
    expect(hashState(a.current())).toBe(hashState(b.current()));
  });
});

describe("SimCore.preview", () => {
  it("surfaces breaks for a deep education cut and does not mutate the run", () => {
    const core = new SimCore("ui-test");
    core.init("ui-test");
    const before = hashState(core.current());

    const p = core.preview({ budgets: { education: 75000 } });
    expect(p.diffs.length).toBeGreaterThan(0);
    expect(p.breaks.length).toBeGreaterThan(0);
    expect(p.breaks.some((b) => b.ministry === "education" && b.fires_after_quarters > 0)).toBe(true);

    expect(hashState(core.current())).toBe(before);
    const control = new SimCore("ui-test");
    control.init("ui-test");
    control.advance(1, {});
    core.advance(1, {});
    expect(hashState(core.current())).toBe(hashState(control.current()));
  });
});

describe("SimCore.counterfactual", () => {
  it("replays the same seed with zero decisions", () => {
    const core = new SimCore("cf");
    core.init("cf");
    core.advance(8, { budgets: { welfare: 5000 } });
    const cf = core.counterfactual();
    expect(cf).toHaveLength(8);
    // gutted welfare must diverge from the no-change path
    expect(cf[7].deficit).not.toBe(core.advance(0, {}).state.fiscal.deficit);
    const actualWelfare = core.current().fiscal.ministries.welfare.funding_ratio;
    expect(actualWelfare).toBeLessThan(cf[7].funding_ratio.welfare);
  });

  it("matches the actual run when no decisions were made", () => {
    const core = new SimCore("cf2");
    core.init("cf2");
    const r = core.advance(6, {});
    const cf = core.counterfactual();
    expect(cf.map((f) => f.gdp_real)).toEqual(r.frames.map((f) => f.gdp_real));
  });
});

describe("playable decade", () => {
  it("40 quarters of zero-change stay finite and at peace", () => {
    const core = new SimCore("decade");
    core.init("decade");
    const r = core.advance(40, {});
    expect(r.frames).toHaveLength(40);
    for (const f of r.frames) expect(finiteFrame(f)).toBe(true);
    expect(r.state.outcome.ended).toBe(false);
    const last = r.frames[39];
    expect(last.year).toBe(2036);
    // locality columns stay aligned and populated
    expect(last.loc_population.length).toBeGreaterThan(1100);
    let pop = 0;
    for (const v of last.loc_population) pop += v;
    expect(pop).toBeGreaterThan(9e6);
  });
});
