import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

const RIGHT: S.PartyId[] = ["likud", "shas", "utj", "religious_zionism", "otzma_yehudit", "noam"];
const UNITY: S.PartyId[] = ["likud", "yesh_atid", "national_unity"];

function started(members: S.PartyId[], seed = "t"): S.CampaignState {
  return S.formGovernment(S.chooseParty(S.createCampaign(seed), members[0]), members);
}

function drain(s: S.CampaignState): S.CampaignState {
  let x = s;
  while (x.phase === "consequences") x = S.acknowledge(x);
  return x;
}

describe("M13 Prime Minister campaign", () => {
  it("parties hold 120 seats; coalition rules enforce majority and refusals", () => {
    expect(S.PARTY_IDS.reduce((a, p) => a + S.PARTIES[p].seats, 0)).toBe(120);
    const right = S.checkCoalition(RIGHT);
    expect(right.valid).toBe(true);
    expect(right.seats).toBe(64);
    expect(right.type).toBe("RIGHT_WING_BLOC");
    expect(S.checkCoalition(["likud", "otzma_yehudit", "raam", "shas", "utj"]).vetoes.length).toBeGreaterThan(0);
    expect(S.checkCoalition(["likud", "shas"]).majority).toBe(false);
    // an invalid government is not formed
    const s = S.chooseParty(S.createCampaign("x"), "likud");
    expect(S.formGovernment(s, ["likud", "raam", "otzma_yehudit", "shas", "utj"])).toBe(s);
  });

  it("forming a government opens the doctrine popup with patient partners", () => {
    const s = started(RIGHT);
    expect(s.phase).toBe("policy");
    expect(s.current).toBe("DOCTRINE");
    expect(Object.keys(s.patience).length).toBe(RIGHT.length - 1);
    for (const v of Object.values(s.patience)) expect(v).toBeGreaterThan(30);
    expect(s.sim.metrics.coalitionStability).toBeGreaterThan(0);
  });

  it("a doctrine the coalition cannot live with brings the government down", () => {
    const s = S.choose(started(RIGHT), "D_WITHDRAWAL");
    expect(s.ending?.kind).toBe("GOVERNMENT_FELL");
    expect(s.queue.some((e) => e.quits.length > 0)).toBe(true);
    expect(s.phase).toBe("consequences");
    expect(drain(s).phase).toBe("ended");
  });

  it("radical right → \"what will you do in Gaza?\" → nuclear use ends the state", () => {
    const s1 = drain(S.choose(started(RIGHT), "D_RADICAL_RIGHT"));
    expect(s1.current).toBe("RR_GAZA");
    expect(S.currentDilemma(s1)?.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(["RR_OCCUPY", "RR_EMIGRATION", "RR_TRANSFER", "RR_NUCLEAR", "RR_SIEGE", "RR_CARPET"]),
    );
    const nuke = S.choose(s1, "RR_NUCLEAR");
    expect(nuke.ending?.kind).toBe("STATE_COLLAPSE_EXTERNAL");
    expect(nuke.flags.nuclearUsed).toBe(true);
    const stances = S.campaignStances(nuke);
    expect(stances.usa.tier).toBe("ENEMY");
    expect(stances.eu.tier).toBe("ENEMY");
  });

  it("forced transfer queues the Egyptian ballistic crisis; carrying it out collapses the state", () => {
    const s1 = drain(S.choose(started(RIGHT), "D_RADICAL_RIGHT"));
    const s2 = S.choose(s1, "RR_TRANSFER");
    expect(s2.ending).toBeNull();
    expect(s2.queue.some((e) => e.focus === "europe")).toBe(true);
    const s3 = drain(s2);
    expect(s3.current).toBe("EGYPTIAN_BALLISTIC_ATTACK");
    expect(S.currentDilemma(s3)?.precedent).toBeDefined();
    const s4 = S.choose(s3, "B_AIR_RETALIATION");
    expect(s4.ending?.kind).toBe("STATE_COLLAPSE_EXTERNAL");
    // the crisis option is recorded where the stances layer reads it
    expect(s4.sim.turns[s4.sim.turns.length - 1].crisisOption).toBe("B_AIR_RETALIATION");
  });

  it("the term does not end while a war goes on; a ceasefire lets it end", () => {
    let s = drain(S.choose(started(UNITY, "war"), "D_TRUSTEESHIP"));
    s = {
      ...s,
      step: s.maxSteps - 1,
      flags: { ...s.flags, lebanonWar: true },
      sim: { ...s.sim, metrics: { ...s.sim.metrics, securityThreat: 70 } },
      current: "TERROR_ATTACK",
      phase: "dilemma",
    };
    const s1 = S.choose(s, "TA_RESTRAINT");
    expect(s1.ending).toBeNull();
    expect(s1.queue.some((e) => e.headline.en.startsWith("Elections postponed"))).toBe(true);
    const s2 = drain(s1);
    expect(s2.current).toBe("CEASEFIRE_TALKS");
    const s3 = S.choose(s2, "CF_COMPREHENSIVE");
    expect(S.warOngoing(s3)).toBe(false);
    expect(s3.ending?.kind).toBe("TERM_COMPLETED");
  });

  it("is deterministic and pure; preview draws nothing", () => {
    const base = drain(S.choose(started(UNITY, "det"), "D_PA_RETURN"));
    const snapshot = JSON.stringify(base);
    const opt = S.currentDilemma(base)?.options[0].id ?? "";
    const a = S.choose(base, opt);
    const b = S.choose(base, opt);
    expect(a).toEqual(b);
    expect(JSON.stringify(base)).toBe(snapshot);
    const p = S.previewOption(base, opt);
    expect(p.rngState).toBe(base.rngState);
    expect(p.current).toBeNull();
  });

  it("every `next` target exists, and random playthroughs always end", () => {
    const ids = new Set(Object.keys(S.DILEMMAS));
    for (const d of Object.values(S.DILEMMAS)) {
      for (const o of d.options) {
        if (o.next !== undefined) expect(ids.has(o.next)).toBe(true);
        for (const c of o.consequences ?? []) if (c.next !== undefined) expect(ids.has(c.next)).toBe(true);
      }
    }
    const coalitions = [RIGHT, UNITY, ["yesh_atid", "national_unity", "yisrael_beiteinu", "labor", "raam", "shas"] as S.PartyId[]];
    const endings = new Set<string>();
    for (let seed = 0; seed < 90; seed++) {
      let x = seed * 7919 + 13;
      const r = () => ((x = (x * 48271) % 2147483647) / 2147483647);
      let s = started(coalitions[seed % 3], `rand-${seed}`);
      let guard = 0;
      while (s.phase !== "ended" && guard++ < 400) {
        if (s.phase === "consequences") {
          s = S.acknowledge(s);
          continue;
        }
        const d = S.currentDilemma(s);
        expect(d).not.toBeNull();
        if (d === null) break;
        s = S.choose(s, d.options[Math.floor(r() * d.options.length)].id);
        for (const k of S.METRIC_KEYS) {
          expect(s.sim.metrics[k]).toBeGreaterThanOrEqual(0);
          expect(s.sim.metrics[k]).toBeLessThanOrEqual(100);
        }
      }
      expect(s.phase).toBe("ended");
      endings.add(s.ending?.kind ?? "none");
    }
    expect(endings.size).toBeGreaterThanOrEqual(3);
  });
});
