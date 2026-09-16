import { describe, expect, it } from "vitest";
import { strategic } from "@engine";
import { CITIES, ORIGINS, distanceKm, focusCamera, project, toMap, toScreen } from "../src/strategic/geo";
import {
  bezierAt, bezierControls, buildCrisisScript, buildTurnScript, endTime, focusAt, progressAt, speedKmS,
} from "../src/strategic/scenarios";

function crisisState() {
  const s0 = strategic.createInitialState("RIGHT_WING_BLOC", "tactical-test");
  return strategic.executePolicyDecision(s0, { track: "RADICAL_RIGHT_DEPORTATION", ...strategic.TRACK_DEFS.RADICAL_RIGHT_DEPORTATION.defaults });
}

describe("tactical scenarios", () => {
  it("projection round-trips through the camera", () => {
    const cam = focusCamera("israel", 1200, 800);
    const p = project(CITIES.tel_aviv.pos);
    const back = toMap(toScreen(p, cam, 1200, 800), cam, 1200, 800);
    expect(back.x).toBeCloseTo(p.x, 6);
    expect(back.y).toBeCloseTo(p.y, 6);
    expect(distanceKm(ORIGINS.tehran.pos, CITIES.tel_aviv.pos)).toBeGreaterThan(1450);
    expect(distanceKm(ORIGINS.tehran.pos, CITIES.tel_aviv.pos)).toBeLessThan(1700);
  });

  it("crisis script: border alert, canal mobilization, Sinai ballistic fire on Tel Aviv, halt, Tel Aviv focus", () => {
    const sim = crisisState();
    const s = buildCrisisScript(sim, null);
    expect(s.haltAt).not.toBeNull();
    const halt = s.haltAt ?? 0;
    expect(s.zones.some((z) => z.kind === "border_alert" && z.t0 < halt)).toBe(true);
    expect(s.units.filter((u) => u.faction === "egypt").length).toBe(3);
    const egypt = s.launches.filter((l) => l.faction === "egypt");
    expect(egypt.length).toBeGreaterThan(5);
    expect(egypt.every((l) => l.kind === "ballistic" && l.originName.en === "Northern Sinai")).toBe(true);
    expect(egypt.some((l) => l.targetName.en === "Tel Aviv")).toBe(true);
    // every first-wave engagement has resolved before the cabinet is called
    expect(s.launches.every((l) => endTime(l) <= halt)).toBe(true);
    expect(focusAt(s, halt)).toBe("tel_aviv");
    expect(s.markers.some((m) => m.kind === "halt" && m.t === halt)).toBe(true);
  });

  it("scripts are deterministic and the aftermath extends the halted script unchanged", () => {
    const sim = crisisState();
    const a = buildCrisisScript(sim, null);
    expect(buildCrisisScript(sim, null)).toEqual(a);
    for (const opt of strategic.CRISIS_OPTION_IDS) {
      const b = buildCrisisScript(sim, opt);
      expect(b.haltAt).toBeNull();
      expect(b.duration).toBeGreaterThan(a.duration);
      // the pre-halt picture is identical, so playback continues seamlessly
      expect(b.launches.slice(0, a.launches.length)).toEqual(a.launches);
    }
    const inv = buildCrisisScript(sim, "C_GROUND_INVASION_SINAI");
    expect(inv.units.some((u) => u.faction === "idf")).toBe(true);
    expect(inv.zones.some((z) => z.kind === "contested")).toBe(true);
    const air = buildCrisisScript(sim, "B_AIR_RETALIATION");
    expect(air.launches.some((l) => l.faction === "idf" && l.kind === "airstrike")).toBe(true);
    expect(air.launches.some((l) => l.faction === "iran")).toBe(true);
  });

  it("interceptors launch after the threat and kill it before impact", () => {
    const s = buildCrisisScript(crisisState(), "B_AIR_RETALIATION");
    for (const l of s.launches) {
      if (l.intercept === null) continue;
      expect(l.intercept.tLaunch).toBeGreaterThanOrEqual(l.t0);
      expect(l.intercept.tHit).toBeGreaterThan(l.intercept.tLaunch);
      expect(l.intercept.tHit).toBeLessThan(l.t0 + l.flight);
      expect(progressAt(l, l.intercept.tHit)).toBeCloseTo(l.intercept.u, 6);
    }
  });

  it("trajectories start at the origin and end at the target; speeds are plausible", () => {
    const s = buildCrisisScript(crisisState(), "C_GROUND_INVASION_SINAI");
    for (const l of s.launches) {
      const c = bezierControls(l);
      expect(bezierAt(c, 0)).toEqual(project(l.from));
      const end = bezierAt(c, 1);
      expect(end.x).toBeCloseTo(project(l.to).x, 6);
      const v = speedKmS(l);
      if (l.kind === "ballistic") expect(v).toBeGreaterThan(0.8);
      if (l.kind === "drone") expect(v).toBeLessThan(0.1);
    }
  });

  it("the ambient picture scales with the security threat", () => {
    const quiet = strategic.createInitialState("CENTER_LEFT_BLOC", "q");
    const calm = { ...quiet, metrics: { ...quiet.metrics, securityThreat: 20 } };
    const hot = { ...quiet, metrics: { ...quiet.metrics, securityThreat: 88 } };
    expect(buildTurnScript(calm).launches.length).toBe(0);
    const h = buildTurnScript(hot);
    expect(h.launches.some((l) => l.faction === "iran")).toBe(true);
    expect(h.launches.some((l) => l.faction === "hezbollah")).toBe(true);
    expect(focusAt(h, 0)).toBe("theater");
  });
});
