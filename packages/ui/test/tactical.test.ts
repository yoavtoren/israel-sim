import { describe, expect, it } from "vitest";
import { strategic } from "@engine";
import { CITIES, ORIGINS, distanceKm, focusCamera, project, toMap, toScreen } from "../src/strategic/geo";
import {
  AFFILIATION, bezierControls, buildTurnScript, endTime, focusAt, pathPoint, progressAt, speedKmS, timeAtProgress,
  type TacticalScript,
} from "../src/strategic/scenarios";
import { CRISIS_SCENES, buildCrisisScript, crisisFocus } from "../src/strategic/crisisScripts";
import { shakeOffset } from "../src/strategic/renderer";

type Sim = strategic.SimulationState;

function withTrack(track: strategic.PolicyTrack, patch: Partial<strategic.PolicyAction> = {}): strategic.PolicyAction {
  return { track, ...strategic.TRACK_DEFS[track].defaults, ...patch };
}

function transferCrisis(): Sim {
  return strategic.executePolicyDecision(strategic.createInitialState("RIGHT_WING_BLOC", "tactical-test"), withTrack("RADICAL_RIGHT_DEPORTATION"));
}

/** A state with any crisis pending (the scene only reads turn, rngState and the pending id). */
function pendingFor(id: strategic.CrisisId): Sim {
  const base = strategic.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", `scene-${id}`);
  return { ...base, pendingCrisis: { id, action: withTrack("PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP"), phase: "post", metricsBefore: base.metrics, events: [] } };
}

function checkInvariants(s: TacticalScript): void {
  for (const l of s.launches) {
    const c = bezierControls(l);
    expect(pathPoint(l, c, 0).x).toBeCloseTo(project(l.from).x, 6);
    expect(pathPoint(l, c, 1).y).toBeCloseTo(project(l.to).y, 6);
    expect(l.flight).toBeGreaterThan(0);
    if (l.intercept !== null) {
      expect(l.intercept.tLaunch).toBeGreaterThanOrEqual(l.t0);
      expect(l.intercept.tHit).toBeGreaterThan(l.intercept.tLaunch);
      expect(l.intercept.tHit).toBeLessThan(l.t0 + l.flight);
      expect(progressAt(l, l.intercept.tHit)).toBeCloseTo(l.intercept.u, 5);
    }
  }
  for (const u of s.units) expect(u.t1).toBeGreaterThanOrEqual(u.t0);
  expect(s.duration).toBeGreaterThan(0);
}

describe("tactical scenarios", () => {
  it("projection round-trips through the camera for every focus zone", () => {
    for (const f of ["theater", "israel", "tel_aviv", "west_bank", "gaza", "sinai"] as const) {
      const cam = focusCamera(f, 1200, 800);
      const p = project(CITIES.tel_aviv.pos);
      const back = toMap(toScreen(p, cam, 1200, 800), cam, 1200, 800);
      expect(back.x).toBeCloseTo(p.x, 6);
      expect(back.y).toBeCloseTo(p.y, 6);
    }
    expect(distanceKm(ORIGINS.tehran.pos, CITIES.tel_aviv.pos)).toBeGreaterThan(1450);
    expect(distanceKm(ORIGINS.tehran.pos, CITIES.tel_aviv.pos)).toBeLessThan(1700);
  });

  it("ballistic profile is slow early, fast in the terminal phase; timeAtProgress inverts it", () => {
    const l = { kind: "ballistic" as const, t0: 0, flight: 100 };
    expect(progressAt(l, 50)).toBeLessThan(0.5);
    const early = progressAt(l, 10) - progressAt(l, 0);
    const late = progressAt(l, 100) - progressAt(l, 90);
    expect(late).toBeGreaterThan(early * 2);
    for (const u of [0.1, 0.5, 0.9]) expect(progressAt(l, timeAtProgress("ballistic", 0, 100, u))).toBeCloseTo(u, 6);
  });

  it("every crisis has a scene with an aftermath for each of its options", () => {
    for (const id of strategic.CRISIS_IDS) {
      const scene = CRISIS_SCENES[id];
      for (const o of strategic.CRISIS_DEFS[id].options) expect(typeof scene.after[o.id]).toBe("function");
    }
  });

  it("crisis scripts halt, center on the focal zone, and each option extends the halted picture unchanged", () => {
    const states: Sim[] = [transferCrisis(), ...strategic.CRISIS_IDS.filter((id) => id !== "EGYPTIAN_BALLISTIC_ATTACK").map(pendingFor)];
    for (const sim of states) {
      const id = sim.pendingCrisis?.id;
      if (id === undefined) throw new Error("no pending crisis");
      const halted = buildCrisisScript(sim, null);
      expect(halted.haltAt).not.toBeNull();
      const halt = halted.haltAt ?? 0;
      expect(halted.crisisId).toBe(id);
      expect(halted.markers.some((m) => m.kind === "halt" && m.t === halt)).toBe(true);
      expect(focusAt(halted, halt)).toBe(crisisFocus(id));
      // missiles and rockets resolve before the cabinet is called; slow drone swarms may keep flying
      expect(halted.launches.filter((l) => l.kind !== "drone").every((l) => endTime(l) <= halt)).toBe(true);
      expect(buildCrisisScript(sim, null)).toEqual(halted);
      checkInvariants(halted);

      for (const o of strategic.CRISIS_DEFS[id].options) {
        const branches: Array<strategic.GambleBranch | null> = o.gamble === undefined ? [null] : ["success", "failure"];
        for (const b of branches) {
          const after = buildCrisisScript(sim, o.id, b);
          expect(after.haltAt).toBeNull();
          expect(after.duration).toBeGreaterThan(halt);
          expect(after.launches.slice(0, halted.launches.length)).toEqual(halted.launches);
          // pre-halt units are only ever retired after the halt, never rewritten before it
          for (const u of halted.units) {
            const v = after.units.find((x) => x.id === u.id);
            expect(v).toBeDefined();
            if (v !== undefined) expect(v.until).toBeGreaterThanOrEqual(halt);
          }
          const hasConsequence = after.launches.length > halted.launches.length || after.units.length > halted.units.length || after.blasts.length > halted.blasts.length || after.markers.length > halted.markers.length;
          expect(hasConsequence).toBe(true);
          checkInvariants(after);
        }
      }
    }
  });

  it("scene specifics: Egyptian Sinai fire, PA defections, treaty lines, combined Iranian barrage, tunnel demolition", () => {
    const eg = buildCrisisScript(transferCrisis(), null);
    const egypt = eg.launches.filter((l) => l.faction === "egypt");
    expect(egypt.length).toBeGreaterThan(5);
    expect(egypt.every((l) => l.kind === "ballistic" && l.originName.en === "Northern Sinai")).toBe(true);
    expect(eg.zones.some((z) => z.kind === "border_alert")).toBe(true);

    const pa = buildCrisisScript(pendingFor("PA_SECURITY_COLLAPSE"), null);
    expect(pa.units.filter((u) => u.faction === "pa").length).toBe(3);
    const shield = buildCrisisScript(pendingFor("PA_SECURITY_COLLAPSE"), "PA_DEFENSIVE_SHIELD_2");
    expect(shield.units.filter((u) => u.faction === "idf" && u.t0 >= (pa.haltAt ?? 0)).length).toBeGreaterThanOrEqual(4);

    const treaty = buildCrisisScript(pendingFor("EGYPT_TREATY_BREACH"), null);
    expect(treaty.zones.filter((z) => z.kind === "treaty_line").length).toBe(3);
    expect(treaty.units.some((u) => u.faction === "mfo")).toBe(true);

    const iran = buildCrisisScript(pendingFor("IRAN_COMBINED_BARRAGE"), null);
    const kinds = new Set(iran.launches.map((l) => l.kind));
    expect(kinds).toEqual(new Set(["drone", "cruise", "ballistic"]));
    expect(iran.launches.some((l) => l.intercept?.battery === "coalition_cap")).toBe(true);
    expect(iran.launches.filter((l) => l.kind === "drone").every((l) => l.swarm !== null)).toBe(true);

    const tunnels = pendingFor("TUNNEL_NETWORK_EXPOSED");
    const win = buildCrisisScript(tunnels, "TUN_ULTIMATUM_48H", "success");
    const lose = buildCrisisScript(tunnels, "TUN_ULTIMATUM_48H", "failure");
    expect(win.blasts.length).toBeGreaterThan(5);
    expect(lose.launches.filter((l) => l.faction === "gaza").length).toBeGreaterThan(win.launches.filter((l) => l.faction === "gaza").length);
    expect(win.zones.filter((z) => z.kind === "tunnels").every((z) => z.t1 < win.duration)).toBe(true);
  });

  it("every script carries the standing naval and air order of battle", () => {
    const s = buildTurnScript(strategic.createInitialState("CENTER_LEFT_BLOC", "oob"));
    expect(s.units.filter((u) => u.type === "naval" || u.type === "carrier").length).toBeGreaterThanOrEqual(4);
    expect(s.units.filter((u) => u.type === "air").length).toBeGreaterThanOrEqual(3);
    expect(s.units.every((u) => AFFILIATION[u.faction] === "friend")).toBe(true);
  });

  it("speeds are plausible after undoing time compression", () => {
    const s = buildCrisisScript(pendingFor("IRAN_COMBINED_BARRAGE"), "IRN_WIDE_RETALIATION");
    for (const l of s.launches) {
      const v = speedKmS(l);
      if (l.kind === "ballistic") expect(v).toBeGreaterThan(0.8);
      if (l.kind === "cruise") expect(v).toBeLessThan(0.35);
      if (l.kind === "drone") expect(v).toBeLessThan(0.1);
    }
  });

  it("the ambient picture scales with the security threat", () => {
    const quiet = strategic.createInitialState("CENTER_LEFT_BLOC", "q");
    const calm = { ...quiet, metrics: { ...quiet.metrics, securityThreat: 20 } };
    const hot = { ...quiet, metrics: { ...quiet.metrics, securityThreat: 88 } };
    expect(buildTurnScript(calm).launches.length).toBe(0);
    const h = buildTurnScript(hot);
    expect(h.launches.some((l) => l.faction === "iran" && l.kind === "ballistic")).toBe(true);
    expect(h.launches.some((l) => l.kind === "cruise")).toBe(true);
    expect(h.launches.some((l) => l.faction === "hezbollah")).toBe(true);
    expect(focusAt(h, 0)).toBe("theater");
  });

  it("screen shake only follows heavy impacts while playing", () => {
    const s = buildCrisisScript(transferCrisis(), null);
    const hit = s.launches.find((l) => l.kind === "ballistic" && l.intercept !== null && !l.intercept.success);
    if (hit === undefined) return; // every missile intercepted with this seed — nothing to shake
    const t = hit.t0 + hit.flight + 0.5;
    const on = shakeOffset(s, t, 1000, true);
    expect(Math.abs(on.x) + Math.abs(on.y)).toBeGreaterThan(0);
    expect(shakeOffset(s, t, 1000, false)).toEqual({ x: 0, y: 0 });
    expect(shakeOffset(s, t + 30, 1000, true)).toEqual({ x: 0, y: 0 });
  });
});
