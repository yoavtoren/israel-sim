import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

const act = (t: S.PolicyTrack): S.PolicyAction => ({ track: t, ...S.TRACK_DEFS[t].defaults });

describe("foreign stances", () => {
  it("baseline: allies, neutrals and enemies land in the expected tiers", () => {
    const st = S.computeStances(S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "stances"));
    expect(st.usa.tier).toBe("ALLY");
    expect(st.uae.tier).toBe("FRIENDLY");
    expect(st.egypt.tier).toBe("NEUTRAL");
    expect(st.turkey.tier).toBe("HOSTILE");
    expect(st.iran.tier).toBe("ENEMY");
    expect(st.gaza.tier).toBe("ENEMY");
  });

  it("drivers sum to the score, scores stay in range, tiers match scores", () => {
    const s = S.executePolicyDecision(S.createInitialState("RIGHT_WING_BLOC", "x"), act("CONSERVATIVE_RIGHT_ANNEXATION"));
    for (const id of S.ACTOR_IDS) {
      const a = S.actorStance(id, s);
      const sum = a.drivers.reduce((t, d) => t + d.delta, 0);
      expect(a.score).toBe(Math.max(-100, Math.min(100, sum)));
      expect(a.tier).toBe(S.tierOf(a.score));
    }
  });

  it("annexation pushes Jordan and the PA away; trusteeship brings Saudi Arabia in", () => {
    const s0 = S.createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", "x");
    const base = S.computeStances(s0);
    const annex = S.computeStances(S.executePolicyDecision(s0, act("CONSERVATIVE_RIGHT_ANNEXATION")));
    expect(annex.jordan.score).toBeLessThan(base.jordan.score - 30);
    expect(annex.palestinian_authority.tier).toBe("ENEMY");
    let t = s0;
    for (let i = 0; i < 4; i++) t = S.executePolicyDecision(t, act("PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP"));
    expect(S.computeStances(t).saudi.tier).toBe("ALLY");
  });

  it("the transfer crisis puts Egypt at war; US mediation pulls it back from war", () => {
    const c = S.executePolicyDecision(S.createInitialState("RIGHT_WING_BLOC", "x"), act("RADICAL_RIGHT_DEPORTATION"));
    expect(S.computeStances(c).egypt.tier).toBe("ENEMY");
    const d = S.computeStances(S.resolveCrisis(c, "D_US_MEDIATION"));
    expect(d.egypt.tier).not.toBe("ENEMY");
    expect(d.usa.tier).toBe("ALLY");
  });

  it("every on-map actor has a unique outline key", () => {
    const keys = S.ACTOR_IDS.map((id) => S.ACTOR_DEFS[id].mapKey).filter((k) => k !== null);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
