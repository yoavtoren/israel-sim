import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

/** The 2022 right bloc (64 seats in the 2022 roster; 54 in current polls). */
const RIGHT: S.PartyId[] = ["likud", "shas", "utj", "religious_zionism", "otzma_yehudit", "noam"];
/** Poll-era unity government: Gantz + Lapid + Lieberman + Likud (66). */
const UNITY: S.PartyId[] = ["national_unity", "yesh_atid", "yisrael_beiteinu", "likud"];
/** Poll-era center-left + Lieberman + Arab parties (64). */
const CHANGE: S.PartyId[] = ["national_unity", "yisrael_beiteinu", "yesh_atid", "democrats", "raam", "hadash_taal"];

function started(members: S.PartyId[], seed = "t", roster: S.SeatRoster = "polls"): S.CampaignState {
  return S.formGovernment(S.chooseParty(S.createCampaign(seed, roster), members[0]), members);
}

const started2022 = (members: S.PartyId[], seed = "t") => started(members, seed, "election_2022");

function drain(s: S.CampaignState): S.CampaignState {
  let x = s;
  while (x.phase === "consequences") x = S.acknowledge(x);
  return x;
}

describe("M13 Prime Minister campaign", () => {
  it("both seat rosters hold exactly 120 seats; polls are the default", () => {
    for (const r of S.SEAT_ROSTERS) expect(S.PARTY_IDS.reduce((a, p) => a + S.SEATS[r][p], 0)).toBe(120);
    expect(S.createCampaign("d").roster).toBe("polls");
    expect(S.SEATS.polls.likud).toBe(23);
    expect(S.SEATS.polls.balad).toBe(2);
    expect(S.partyName("democrats", "election_2022").en).toBe("Labor");
    expect(S.partyName("democrats", "polls").he).toBe("הדמוקרטים");
    // a zero-seat party cannot be picked
    expect(S.chooseParty(S.createCampaign("z"), "noam").phase).toBe("party");
    expect(S.chooseParty(S.createCampaign("z", "election_2022"), "balad").phase).toBe("party");
    // the roster can only change before a party is picked
    const r = S.setRoster(S.createCampaign("r"), "election_2022");
    expect(r.roster).toBe("election_2022");
    expect(S.setRoster(S.chooseParty(r, "likud"), "polls").roster).toBe("election_2022");
  });

  it("2022 roster: the right bloc has 64; refusals block a government", () => {
    const right = S.checkCoalition(RIGHT, "election_2022");
    expect(right.valid).toBe(true);
    expect(right.seats).toBe(64);
    expect(right.type).toBe("RIGHT_WING_BLOC");
    expect(S.checkCoalition(["likud", "otzma_yehudit", "raam", "shas", "utj"], "election_2022").vetoes.length).toBeGreaterThan(0);
    const s = S.chooseParty(S.createCampaign("x", "election_2022"), "likud");
    expect(S.formGovernment(s, ["likud", "raam", "otzma_yehudit", "shas", "utj"])).toBe(s);
  });

  it("current polls: 61 needs a compromise", () => {
    const rightBloc = S.checkCoalition(["likud", "shas", "utj", "otzma_yehudit", "religious_zionism"]);
    expect(rightBloc.seats).toBe(54);
    expect(rightBloc.valid).toBe(false);

    const plusLieberman = S.checkCoalition(["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "yisrael_beiteinu"]);
    expect(plusLieberman.seats).toBe(68);
    expect(plusLieberman.valid).toBe(true);
    expect(plusLieberman.frictions.filter((f) => f.level === "deep").length).toBe(2); // Lieberman vs. the Haredi parties

    const plusGantz = S.checkCoalition(["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "national_unity"]);
    expect(plusGantz.seats).toBe(70);
    expect(plusGantz.valid).toBe(true);

    const change = S.checkCoalition(CHANGE);
    expect(change.seats).toBe(64);
    expect(change.valid).toBe(true);
    const pairs = change.frictions.map((f) => [f.a, f.b].sort().join("|"));
    expect(pairs).toContain(["raam", "yisrael_beiteinu"].sort().join("|"));
    expect(change.frictions.find((f) => [f.a, f.b].includes("hadash_taal") && [f.a, f.b].includes("yisrael_beiteinu"))?.level).toBe("deep");
    // the most strained government starts the least stable
    expect(change.stability).toBeLessThan(S.checkCoalition(UNITY).stability);
    expect(S.checkCoalition(UNITY).seats).toBe(66);

    // Hadash–Ta'al's patience starts lowest in the change bloc (deep friction with Lieberman)
    const g = started(CHANGE, "chg");
    expect(g.phase).toBe("policy");
    const hadash = g.patience.hadash_taal ?? 100;
    for (const [p, v] of Object.entries(g.patience)) if (p !== "hadash_taal" && p !== "yisrael_beiteinu") expect(v).toBeGreaterThan(hadash);

    // every benchmark adds up and all but the right bloc can govern
    for (const b of S.BENCHMARK_COALITIONS) {
      const c = S.checkCoalition(b.members);
      expect(c.vetoes).toEqual([]);
      expect(c.valid).toBe(b.id !== "right_bloc");
    }
  });

  it("forming a government opens the doctrine popup with patient partners", () => {
    const s = started2022(RIGHT);
    expect(s.phase).toBe("policy");
    expect(s.current).toBe("DOCTRINE");
    expect(Object.keys(s.patience).length).toBe(RIGHT.length - 1);
    for (const v of Object.values(s.patience)) expect(v).toBeGreaterThan(30);
    expect(s.sim.metrics.coalitionStability).toBeGreaterThan(0);
  });

  it("a doctrine the coalition cannot live with brings the government down", () => {
    const s = S.choose(started2022(RIGHT), "D_WITHDRAWAL");
    expect(s.ending?.kind).toBe("GOVERNMENT_FELL");
    expect(s.queue.some((e) => e.quits.length > 0)).toBe(true);
    expect(s.phase).toBe("consequences");
    expect(drain(s).phase).toBe("ended");
  });

  it("radical right → \"what will you do in Gaza?\" → nuclear use ends the state", () => {
    const s1 = drain(S.choose(started2022(RIGHT), "D_RADICAL_RIGHT"));
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
    const s1 = drain(S.choose(started2022(RIGHT), "D_RADICAL_RIGHT"));
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
    const coalitions: Array<{ members: S.PartyId[]; roster: S.SeatRoster }> = [
      { members: RIGHT, roster: "election_2022" },
      { members: UNITY, roster: "polls" },
      { members: CHANGE, roster: "polls" },
    ];
    const endings = new Set<string>();
    for (let seed = 0; seed < 90; seed++) {
      let x = seed * 7919 + 13;
      const r = () => ((x = (x * 48271) % 2147483647) / 2147483647);
      const c = coalitions[seed % 3];
      let s = started(c.members, `rand-${seed}`, c.roster);
      expect(s.phase).toBe("policy");
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
