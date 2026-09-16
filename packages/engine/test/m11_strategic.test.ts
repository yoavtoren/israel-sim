import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

type Action = S.PolicyAction;

const trusteeship: Action = {
  track: "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP",
  concedeConstructiveAmbiguity: true,
  allowIdfFreedomOfAction: true,
  settlementPolicy: "FREEZE_OUTSIDE_BLOCS",
  gazaCivilianControl: "REGIONAL_COALITION",
};

function withTrack(track: S.PolicyTrack, patch: Partial<Action> = {}): Action {
  return { track, ...S.TRACK_DEFS[track].defaults, ...patch };
}

/** one half-year: decide, and if a crisis opens, take its last option */
function step(state: S.SimulationState, action: Action): S.SimulationState {
  const s = S.executePolicyDecision(state, action);
  if (s.pendingCrisis === null) return s;
  const opts = S.CRISIS_DEFS[s.pendingCrisis.id].options;
  return S.resolveCrisis(s, opts[opts.length - 1].id);
}

function playOut(state: S.SimulationState, action: Action): S.SimulationState {
  let s = state;
  while (!s.gameOver) s = step(s, action);
  return s;
}

describe("M11 strategic layer", () => {
  it("initial state follows the brief", () => {
    const s = S.createInitialState();
    expect(s.metrics).toEqual(S.initialMetrics);
    expect(s.maxTurns).toBe(8);
    expect(s.turn).toBe(1);
    expect(S.nextCheckpoint(s.checkpoints)).toBe("demilitarizationVerified");
  });

  it("is pure and replayable", () => {
    const s0 = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "replay");
    const frozen = JSON.stringify(s0);
    const a = playOut(s0, trusteeship);
    const b = playOut(S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "replay"), trusteeship);
    expect(JSON.stringify(s0)).toBe(frozen);
    expect(a).toEqual(b);
  });

  it("forced transfer → Egyptian crisis; carrying it out is a strategic collapse (hard rule)", () => {
    const s0 = S.createInitialState("RIGHT_WING_BLOC");
    const s1 = S.executePolicyDecision(s0, withTrack("RADICAL_RIGHT_DEPORTATION"));
    expect(s1.pendingCrisis?.id).toBe("EGYPTIAN_BALLISTIC_ATTACK");
    expect(s1.turn).toBe(1);
    expect(s1.gameOver).toBe(false);
    // no other decision while the crisis is pending
    expect(S.executePolicyDecision(s1, trusteeship)).toBe(s1);

    for (const opt of ["B_AIR_RETALIATION", "C_GROUND_INVASION_SINAI"] as const) {
      const s2 = S.resolveCrisis(s1, opt);
      expect(s2.gameOver).toBe(true);
      expect(s2.outcome).toBe("STRATEGIC_COLLAPSE");
      expect(s2.metrics.usMilitaryAid).toBe(0);
      expect(s2.metrics.regionalRelations).toBe(0);
      expect(s2.metrics.internationalLegitimacy).toBe(0);
      expect(s2.metrics.securityThreat).toBe(100);
      expect(s2.metrics.economicStability).toBeLessThanOrEqual(10);
    }
  });

  it("crisis exits A/D resolve against pre-directive metrics with the brief's deltas", () => {
    const s0 = S.createInitialState("RIGHT_WING_BLOC");
    const s1 = S.executePolicyDecision(s0, withTrack("RADICAL_RIGHT_DEPORTATION"));
    const d = S.resolveCrisis(s1, "D_US_MEDIATION");
    expect(d.gameOver).toBe(false);
    expect(d.metrics.securityThreat).toBe(s0.metrics.securityThreat - 10);
    expect(d.metrics.usMilitaryAid).toBe(s0.metrics.usMilitaryAid + 20);
    expect(d.metrics.coalitionStability).toBe(s0.metrics.coalitionStability - 25);
    expect(d.flags.usConditionsTurns).toBeGreaterThan(0);
    expect(d.activeTrack).toBeNull();
    expect(d.turn).toBe(2);

    const a = S.resolveCrisis(s1, "A_CANCEL_TRANSFER");
    expect(a.metrics.coalitionStability).toBe(s0.metrics.coalitionStability - 50);
    expect(a.metrics.regionalRelations).toBe(s0.metrics.regionalRelations + 30);

    // US conditions bite if the government then annexes
    const annex = S.executePolicyDecision(d, withTrack("CONSERVATIVE_RIGHT_ANNEXATION"));
    expect(annex.metrics.usMilitaryAid).toBeLessThan(d.metrics.usMilitaryAid - 25);
  });

  it("unilateral withdrawal: immediate fall outside a center-left coalition; security collapse inside one", () => {
    const blga = S.executePolicyDecision(S.createInitialState(), withTrack("RADICAL_LEFT_UNILATERAL_WITHDRAWAL"));
    expect(blga.outcome).toBe("COALITION_COLLAPSE");
    expect(blga.metrics.internationalLegitimacy).toBe(100);

    const cl = S.executePolicyDecision(S.createInitialState("CENTER_LEFT_BLOC"), withTrack("RADICAL_LEFT_UNILATERAL_WITHDRAWAL"));
    expect(cl.gameOver).toBe(true);
    expect(cl.metrics.securityThreat).toBeGreaterThanOrEqual(95);
    expect(cl.metrics.internalCohesion).toBeLessThanOrEqual(10);
  });

  it("annexation: the unity government falls; a right-wing government bleeds out economically", () => {
    const blga = S.executePolicyDecision(S.createInitialState(), withTrack("CONSERVATIVE_RIGHT_ANNEXATION"));
    expect(blga.outcome).toBe("COALITION_COLLAPSE");

    const rw = playOut(S.createInitialState("RIGHT_WING_BLOC"), withTrack("CONSERVATIVE_RIGHT_ANNEXATION"));
    expect(rw.outcome).toBe("ECONOMIC_COLLAPSE");
    expect(rw.turn).toBeLessThan(8);
    expect(rw.flags.saudiNormalization).toBe(false);
    expect(rw.flags.israelPaysForGazaAdministration).toBe(true);
  });

  it("brief rule 2: PA security alone adds +40 threat and flags terror growth", () => {
    const s0 = S.createInitialState("CENTER_LEFT_BLOC");
    const without = S.executePolicyDecision(s0, withTrack("CENTER_LEFT_PA_RETURN", { allowIdfFreedomOfAction: false }));
    expect(without.flags.terrorInfrastructureGrowth).toBe(true);
    expect(without.metrics.securityThreat).toBe(100);
    const withIdf = S.executePolicyDecision(s0, withTrack("CENTER_LEFT_PA_RETURN", { allowIdfFreedomOfAction: true }));
    expect(withIdf.flags.terrorInfrastructureGrowth).toBe(false);
    expect(withIdf.metrics.securityThreat).toBe(s0.metrics.securityThreat + 5);
  });

  it("brief rule 3: no political horizon → no Saudi normalization, Israel pays", () => {
    const s = S.executePolicyDecision(S.createInitialState(), { ...trusteeship, concedeConstructiveAmbiguity: false });
    expect(s.flags.saudiNormalization).toBe(false);
    expect(s.flags.gulfFundsReconstruction).toBe(false);
    expect(s.flags.israelPaysForGazaAdministration).toBe(true);
    expect(s.metrics.economicStability).toBeLessThan(S.initialMetrics.economicStability);
    const yes = S.executePolicyDecision(S.createInitialState(), trusteeship);
    expect(yes.flags.saudiNormalization).toBe(true);
    expect(yes.flags.gulfFundsReconstruction).toBe(true);
  });

  it("brief rule 4: the unity government loses 50 over settlement building", () => {
    const s0 = S.createInitialState();
    const freeze = S.executePolicyDecision(s0, trusteeship);
    const expand = S.executePolicyDecision(s0, { ...trusteeship, settlementPolicy: "EXPAND" });
    expect(expand.metrics.coalitionStability).toBe(Math.max(0, freeze.metrics.coalitionStability - 50));
    expect(expand.outcome).toBe("COALITION_COLLAPSE");
  });

  it("checkpoints pass in order, one per turn, and a rollback resets stages 2–4 and freezes", () => {
    let sawRollback = false;
    let sawCompletion = false;
    for (let seed = 0; seed < 60; seed++) {
      let s = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", seed);
      while (!s.gameOver) {
        const before = s;
        s = step(s, trusteeship);
        const passed = S.CHECKPOINT_ORDER.filter((k) => s.checkpoints[k] && !before.checkpoints[k]);
        expect(passed.length).toBeLessThanOrEqual(1);
        // stages are a prefix: never a later stage without the earlier one
        const flags = S.CHECKPOINT_ORDER.map((k) => s.checkpoints[k]);
        expect(flags.join()).toBe([...flags].sort((x, y) => Number(y) - Number(x)).join());
        if (s.turns[s.turns.length - 1].events.includes("PROCESS_FROZEN")) {
          sawRollback = true;
          expect(s.checkpoints.terrorFundingHalted).toBe(false);
          expect(s.flags.processFrozenTurns).toBe(1);
        }
      }
      if (s.outcome === "TERM_COMPLETED") sawCompletion = true;
    }
    expect(sawRollback).toBe(true);
    expect(sawCompletion).toBe(true);
  });

  it("the trusteeship lifts regional relations to ~85+ as the brief states", () => {
    let best = 0;
    for (let seed = 0; seed < 20; seed++) {
      const s = playOut(S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", seed), trusteeship);
      best = Math.max(best, s.metrics.regionalRelations);
    }
    expect(best).toBeGreaterThanOrEqual(85);
  });

  it("preview draws no randomness", () => {
    const s0 = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", 7);
    let s = s0;
    for (let i = 0; i < 3; i++) {
      const p = S.previewPolicyDecision(s, trusteeship);
      expect(p.rngState).toBe(s.rngState);
      expect(p.turns[p.turns.length - 1].events).not.toContain("PROCESS_FROZEN");
      s = step(s, trusteeship);
    }
  });
});
