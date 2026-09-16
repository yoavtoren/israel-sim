import { describe, expect, it } from "vitest";
import { strategic } from "@engine";
import { visualScript } from "../src/strategic/visuals";
import { WORLD_ACTOR, WORLD_COUNTRIES, fitWorld } from "../src/strategic/worldGeo";

describe("Prime Minister campaign UI data", () => {
  it("every visual used by the campaign content builds a playable script", () => {
    const visuals: strategic.Visual[] = [];
    for (const d of Object.values(strategic.DILEMMAS)) {
      if (d.visual !== undefined) visuals.push(d.visual);
      for (const o of d.options) {
        if (o.visual !== undefined) visuals.push(o.visual);
        for (const c of o.consequences ?? []) if (c.visual !== undefined) visuals.push(c.visual);
      }
    }
    expect(visuals.length).toBeGreaterThan(15);
    visuals.forEach((v, i) => {
      const s = visualScript(v, `k${i}`, 1);
      expect(s.haltAt).toBeNull();
      expect(s.duration).toBeGreaterThan(0);
      const content = s.launches.length + s.units.length + s.zones.length + s.blasts.length;
      expect(content).toBeGreaterThan(0);
    });
    // deterministic per key
    expect(visualScript(visuals[0], "same", 1)).toEqual(visualScript(visuals[0], "same", 1));
  });

  it("the world map covers every country and every stance actor that has territory", () => {
    expect(WORLD_COUNTRIES.length).toBeGreaterThan(200);
    const keys = new Set(WORLD_COUNTRIES.map((c) => c.key));
    for (const k of ["united_states_of_america", "france", "germany", "united_kingdom", "china", "india", "israel", "gaza", "west_bank"]) {
      expect(keys.has(k)).toBe(true);
    }
    const mapped = new Set(WORLD_ACTOR.values());
    for (const id of ["usa", "eu", "uk", "china", "india", "egypt", "iran", "saudi"] as const) expect(mapped.has(id)).toBe(true);
    for (const key of WORLD_ACTOR.keys()) expect(keys.has(key)).toBe(true);
  });

  it("camera zones fit inside the viewport", () => {
    for (const f of ["world", "europe", "usa", "israel", "gaza", "theater", "gulf", "red_sea"] as const) {
      const cam = fitWorld(f, 1400, 900, { left: 500, right: 0, top: 90, bottom: 40 });
      expect(cam.scale).toBeGreaterThan(0);
      expect(Number.isFinite(cam.cx) && Number.isFinite(cam.cy)).toBe(true);
    }
  });
});
