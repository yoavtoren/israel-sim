import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

type Action = S.PolicyAction;

function withTrack(track: S.PolicyTrack, patch: Partial<Action> = {}): Action {
  return { track, ...S.TRACK_DEFS[track].defaults, ...patch };
}

const trusteeship = withTrack("PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP");
const paAlone = withTrack("CENTER_LEFT_PA_RETURN", { allowIdfFreedomOfAction: false });

describe("M12 crisis engine", () => {
  it("defines five crises, each with a precedent and ≥3 options with pros, cons and an objective", () => {
    expect(S.CRISIS_IDS.length).toBeGreaterThanOrEqual(5);
    const optionIds = new Set<string>();
    for (const id of S.CRISIS_IDS) {
      const d = S.CRISIS_DEFS[id];
      expect(d.id).toBe(id);
      expect(d.precedent.body.he.length).toBeGreaterThan(50);
      expect(d.precedent.lesson.en.length).toBeGreaterThan(20);
      expect(d.options.length).toBeGreaterThanOrEqual(3);
      for (const o of d.options) {
        expect(optionIds.has(o.id)).toBe(false);
        optionIds.add(o.id);
        expect(o.pros.length).toBeGreaterThan(0);
        expect(o.cons.length).toBeGreaterThan(0);
        expect(o.objective.he.length).toBeGreaterThan(0);
        if (o.gamble !== undefined) expect(o.gamble.p).toBeGreaterThan(0);
        else expect(Object.keys(o.deltas).length).toBeGreaterThan(0);
      }
    }
  });

  it("the RNG advances across turns (regression: finish() used to drop rngState)", () => {
    let s = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "rng");
    const seen = new Set<number>([s.rngState]);
    for (let i = 0; i < 4 && !s.gameOver; i++) {
      s = S.executePolicyDecision(s, trusteeship);
      if (s.pendingCrisis !== null) s = S.resolveCrisis(s, "TUN_SPECIAL_FORCES");
      seen.add(s.rngState);
    }
    expect(seen.size).toBeGreaterThan(2);
  });

  it("PA reliance without IDF freedom opens the PA-collapse crisis after the decision; Defensive Shield 2 rescues the term", () => {
    const s0 = S.createInitialState("CENTER_LEFT_BLOC", "pa");
    const s1 = S.executePolicyDecision(s0, paAlone);
    expect(s1.pendingCrisis?.id).toBe("PA_SECURITY_COLLAPSE");
    expect(s1.pendingCrisis?.phase).toBe("post");
    expect(s1.turn).toBe(1);
    expect(s1.metrics.securityThreat).toBe(100); // rule 2 already applied
    expect(s1.turns.length).toBe(0);
    expect(S.executePolicyDecision(s1, paAlone)).toBe(s1);

    const s2 = S.resolveCrisis(s1, "PA_DEFENSIVE_SHIELD_2");
    expect(s2.gameOver).toBe(false);
    expect(s2.metrics.securityThreat).toBe(70);
    expect(s2.metrics.internationalLegitimacy).toBe(s1.metrics.internationalLegitimacy - 25);
    expect(s2.flags.terrorInfrastructureGrowth).toBe(false);
    expect(s2.turn).toBe(2);
    const rec = s2.turns[0];
    expect(rec.crisisId).toBe("PA_SECURITY_COLLAPSE");
    expect(rec.crisisOption).toBe("PA_DEFENSIVE_SHIELD_2");
    expect(rec.events).toContain("CRISIS_TRIGGERED");
    expect(rec.events).toContain("TERROR_INFRASTRUCTURE_GROWTH");

    // the barrier option leaves the vacuum in place → security collapse
    expect(S.resolveCrisis(s1, "PA_RETREAT_TO_BARRIER").outcome).toBe("SECURITY_COLLAPSE");
    // cooldown: the same crisis cannot reopen next turn
    const s3 = S.executePolicyDecision(s2, withTrack("CENTER_LEFT_PA_RETURN", { allowIdfFreedomOfAction: true }));
    expect(s3.pendingCrisis?.id).not.toBe("PA_SECURITY_COLLAPSE");
  });

  it("tunnel crisis opens only on checkpoint passes; the ultimatum resolves 60/40 and previews either branch", () => {
    let opened = 0;
    const branches = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      let s = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", seed);
      while (!s.gameOver) {
        const before = s;
        s = S.executePolicyDecision(s, trusteeship);
        if (s.pendingCrisis === null) continue;
        const passedNow = S.CHECKPOINT_ORDER.some((k) => s.checkpoints[k] && !before.checkpoints[k]);
        if (s.pendingCrisis.id === "TUNNEL_NETWORK_EXPOSED") {
          expect(passedNow).toBe(true);
          opened++;
          const win = S.resolveCrisis(s, "TUN_ULTIMATUM_48H", { branch: "success" });
          const lose = S.resolveCrisis(s, "TUN_ULTIMATUM_48H", { branch: "failure" });
          expect(win.metrics.securityThreat).toBe(Math.max(0, s.metrics.securityThreat - 20));
          expect(lose.metrics.securityThreat).toBe(Math.min(100, s.metrics.securityThreat + 30));
          s = S.resolveCrisis(s, "TUN_ULTIMATUM_48H");
          branches.add(String(s.turns[s.turns.length - 1].crisisBranch));
        } else {
          const opts = S.CRISIS_DEFS[s.pendingCrisis.id].options;
          s = S.resolveCrisis(s, opts[opts.length - 1].id);
        }
      }
    }
    expect(opened).toBeGreaterThan(10);
    expect(branches).toEqual(new Set(["success", "failure"]));
  });

  it("freezing reconstruction funds pauses the staged process", () => {
    for (let seed = 0; seed < 40; seed++) {
      const s1 = S.executePolicyDecision(S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", seed), trusteeship);
      if (s1.pendingCrisis?.id !== "TUNNEL_NETWORK_EXPOSED") continue;
      const s2 = S.resolveCrisis(s1, "TUN_FREEZE_FUNDS");
      expect(s2.flags.processFrozenTurns).toBe(1);
      expect(s2.flags.gulfFundsReconstruction).toBe(false);
      const s3 = S.executePolicyDecision(s2, trusteeship);
      expect(s3.checkpoints.terrorFundingHalted).toBe(false);
      return;
    }
    throw new Error("no seed opened the tunnel crisis");
  });

  it("annexation with a military government can open the Egypt treaty crisis; the Iran barrage needs threat ≥ 60", () => {
    let egypt = 0;
    let iran = 0;
    for (let seed = 0; seed < 100; seed++) {
      const s = S.executePolicyDecision(S.createInitialState("RIGHT_WING_BLOC", seed), withTrack("CONSERVATIVE_RIGHT_ANNEXATION"));
      if (s.pendingCrisis?.id === "EGYPT_TREATY_BREACH") egypt++;
      if (s.pendingCrisis?.id === "IRAN_COMBINED_BARRAGE") iran++;
    }
    expect(egypt).toBeGreaterThan(40);
    expect(egypt).toBeLessThan(80);
    expect(iran).toBe(0); // annexation drops the threat to 55

    const hot = S.createInitialState("CENTER_LEFT_BLOC", "hot");
    const risks = S.crisisRisks({
      prev: hot, action: withTrack("CENTER_LEFT_PA_RETURN"), metrics: { ...hot.metrics, securityThreat: 90 }, flags: hot.flags,
      passed: [], adopting: true, paSecurityRuleFired: false,
    });
    const r = risks.find((x) => x.id === "IRAN_COMBINED_BARRAGE");
    expect(r?.p).toBeCloseTo(0.475, 3);
    const calm = S.crisisRisks({
      prev: hot, action: withTrack("CENTER_LEFT_PA_RETURN"), metrics: { ...hot.metrics, securityThreat: 59 }, flags: hot.flags,
      passed: [], adopting: true, paSecurityRuleFired: false,
    });
    expect(calm.some((x) => x.id === "IRAN_COMBINED_BARRAGE")).toBe(false);
  });

  it("no crisis opens once the government has already fallen", () => {
    const s = S.executePolicyDecision(S.createInitialState(), withTrack("CONSERVATIVE_RIGHT_ANNEXATION"));
    expect(s.pendingCrisis).toBeNull();
    expect(s.outcome).toBe("COALITION_COLLAPSE");
  });

  it("previewCrisisRisks reports certain and probable crises without drawing", () => {
    const s0 = S.createInitialState("CENTER_LEFT_BLOC", "prev");
    expect(S.previewCrisisRisks(s0, paAlone)).toEqual([expect.objectContaining({ id: "PA_SECURITY_COLLAPSE", p: 1 })]);
    expect(S.previewCrisisRisks(s0, withTrack("RADICAL_RIGHT_DEPORTATION"))[0].id).toBe("EGYPTIAN_BALLISTIC_ATTACK");
    const t = S.previewCrisisRisks(S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "prev"), trusteeship);
    expect(t.find((x) => x.id === "TUNNEL_NETWORK_EXPOSED")?.p).toBe(0.5);
  });

  it("every crisis option resolves to a valid state from a pending crisis", () => {
    const pending: S.SimulationState[] = [
      S.executePolicyDecision(S.createInitialState("RIGHT_WING_BLOC", "x"), withTrack("RADICAL_RIGHT_DEPORTATION")),
      S.executePolicyDecision(S.createInitialState("CENTER_LEFT_BLOC", "x"), paAlone),
    ];
    const base = S.createInitialState("RIGHT_WING_BLOC", "x");
    for (const id of ["EGYPT_TREATY_BREACH", "IRAN_COMBINED_BARRAGE", "TUNNEL_NETWORK_EXPOSED"] as const) {
      pending.push({ ...base, pendingCrisis: { id, action: trusteeship, phase: "post", metricsBefore: base.metrics, events: [] } });
    }
    for (const s of pending) {
      const id = s.pendingCrisis?.id;
      expect(id).toBeDefined();
      if (id === undefined) continue;
      for (const o of S.CRISIS_DEFS[id].options) {
        const r = S.resolveCrisis(s, o.id);
        expect(r.pendingCrisis).toBeNull();
        expect(r.turns[r.turns.length - 1].crisisOption).toBe(o.id);
        for (const k of S.METRIC_KEYS) {
          expect(r.metrics[k]).toBeGreaterThanOrEqual(0);
          expect(r.metrics[k]).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});
