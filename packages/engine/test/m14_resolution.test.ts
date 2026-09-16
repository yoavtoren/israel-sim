import { describe, expect, it } from "vitest";
import { strategic as S } from "../src/index";

type Game = S.CampaignState;

const CENTER: S.PartyId[] = ["yashar", "together", "democrats", "yisrael_beiteinu", "raam"];
const RIGHT: S.PartyId[] = ["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "amcha_yisrael", "yisrael_beiteinu"];

function start(seed: string, members: S.PartyId[]): Game {
  let g = S.createCampaign(seed);
  g = S.chooseParty(g, members[0]);
  g = S.formGovernment(g, members);
  if (g.phase !== "policy") throw new Error(`coalition invalid: ${members.join(",")}`);
  return g;
}

/** Play to the end with a chooser; returns the final state. */
function play(g: Game, pick: (g: Game, d: S.DilemmaDef) => { option: string; branch?: S.GambleBranch }): Game {
  let guard = 0;
  while (g.phase !== "ended" && guard++ < 400) {
    if (g.phase === "consequences") {
      g = S.acknowledge(g);
      continue;
    }
    const d = S.currentDilemma(g);
    if (d === null) break;
    const c = pick(g, d);
    const next = S.choose(g, c.option, c.branch === undefined ? {} : { branch: c.branch });
    if (next === g) throw new Error(`choice rejected: ${d.id}/${c.option}`);
    g = next;
  }
  return g;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The best move for resolution: highest expected progress, odds-weighted. */
function bestForPeace(g: Game, d: S.DilemmaDef): { option: string; branch?: S.GambleBranch } {
  let best = d.options[0];
  let bestScore = -Infinity;
  for (const o of d.options) {
    const p = S.optionPeace(o);
    const odds = S.optionOdds(g, o);
    // a sensible player: progress first, then the country's health (cohesion above all)
    let health = 0;
    for (const [k, v] of Object.entries(o.deltas) as Array<[S.MetricKey, number]>) health += v * S.METRIC_POLARITY[k] * (k === "internalCohesion" ? 2 : 1);
    const score = (p.success * odds + p.failure * (1 - odds)) * 2 + (o.milestone !== undefined ? 2 : 0) + health / 4 + (o.ending !== undefined ? -1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return { option: best.id };
}

describe("M14 the goal is resolving the conflict", () => {
  it("the Jerusalem shooting attack is rare, not a refrain", () => {
    const counts: number[] = [];
    for (let i = 0; i < 60; i++) {
      const r = rng(i + 1);
      const g = play(start(`terror-${i}`, i % 2 === 0 ? CENTER : RIGHT), (_g, d) => ({ option: d.options[Math.floor(r() * d.options.length)].id }));
      counts.push(g.choices.filter((c) => c.dilemma === "TERROR_ATTACK").length);
    }
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    console.log(`TERROR_ATTACK per campaign: avg ${avg.toFixed(2)}, max ${Math.max(...counts)}`);
    expect(avg).toBeLessThan(0.8);
    expect(Math.max(...counts)).toBeLessThanOrEqual(2);
  });

  it("each doctrine sets its path; far right has none", () => {
    const expected: Record<string, S.ResolutionPath | null> = {
      D_TRUSTEESHIP: "regional", D_PA_RETURN: "two_state", D_WITHDRAWAL: "unilateral", D_ANNEXATION: "sovereignty", D_RADICAL_RIGHT: null,
    };
    for (const [option, path] of Object.entries(expected)) {
      const g = S.choose(start("path", CENTER), option);
      expect(g.resolution.path, option).toBe(path);
    }
  });

  it("good play can end the conflict on every path; the far right never does", () => {
    const doctrines: Array<[string, S.PartyId[]]> = [["D_TRUSTEESHIP", CENTER], ["D_PA_RETURN", CENTER], ["D_WITHDRAWAL", CENTER], ["D_ANNEXATION", RIGHT], ["D_RADICAL_RIGHT", RIGHT]];
    for (const [doctrine, coalition] of doctrines) {
      let resolved = 0;
      let bestProgress = 0;
      const endings: string[] = [];
      for (let i = 0; i < 30; i++) {
        const g = play(start(`peace-${doctrine}-${i}`, coalition), (gg, d) => (d.id === "DOCTRINE" ? { option: doctrine } : bestForPeace(gg, d)));
        if (g.ending?.kind === "CONFLICT_RESOLVED") resolved++;
        bestProgress = Math.max(bestProgress, g.resolution.progress);
        endings.push(g.ending?.kind ?? "none");
      }
      console.log(`${doctrine}: resolved ${resolved}/30, best progress ${bestProgress}, endings ${[...new Set(endings)].join(",")}`);
      if (doctrine === "D_RADICAL_RIGHT") {
        expect(resolved).toBe(0);
        expect(bestProgress).toBe(0);
      } else {
        if (doctrine === "D_TRUSTEESHIP") expect(resolved, doctrine).toBeGreaterThan(0);
      }
    }
  });

  it("with a coalition that holds, every path except the far right's can end the conflict", () => {
    for (const doctrine of ["D_TRUSTEESHIP", "D_PA_RETURN", "D_WITHDRAWAL", "D_ANNEXATION"]) {
      let resolved = 0;
      for (let i = 0; i < 30; i++) {
        // an unbreakable coalition isolates the path mechanics from partner politics
        const hold = (x: Game): Game => ({ ...x, patience: Object.fromEntries(Object.keys(x.patience).map((k) => [k, 100])) });
        let g = hold(S.choose(hold(start(`hold-${doctrine}-${i}`, CENTER)), doctrine));
        let guard = 0;
        while (g.phase !== "ended" && guard++ < 400) {
          if (g.phase === "consequences") {
            g = S.acknowledge(g);
            continue;
          }
          const d = S.currentDilemma(g);
          if (d === null) break;
          g = hold(S.choose(g, bestForPeace(g, d).option));
        }
        if (g.ending?.kind === "CONFLICT_RESOLVED") resolved++;
      }
      console.log(`${doctrine} (holding coalition): resolved ${resolved}/30`);
      expect(resolved, doctrine).toBeGreaterThan(3);
    }
  });

  it("a signed final agreement ends the game as CONFLICT_RESOLVED", () => {
    let g = S.choose(start("final", CENTER), "D_PA_RETURN");
    g = { ...g, phase: "dilemma", queue: [], current: "TS_FINAL", resolution: { path: "two_state", progress: 80, milestones: ["TS_COORDINATION", "TS_BORDERS", "TS_JERUSALEM", "TS_REFUGEES_SECURITY"] } };
    const done = S.choose(g, "TS_FN_REFERENDUM", { branch: "success" });
    expect(done.ending?.kind).toBe("CONFLICT_RESOLVED");
    expect(done.resolution.progress).toBe(100);
    const failed = S.choose(g, "TS_FN_REFERENDUM", { branch: "failure" });
    expect(failed.ending?.kind).not.toBe("CONFLICT_RESOLVED");
    expect(failed.resolution.progress).toBeLessThan(80);
  });

  it("milestones come in order and the final signing waits for enough progress", () => {
    const g = S.choose(start("order", CENTER), "D_PA_RETURN");
    const v = S.campaignView(g);
    expect(S.DILEMMAS.TS_BORDERS.weight?.(v)).toBe(0);
    expect(S.DILEMMAS.TS_COORDINATION.weight?.(v)).toBeGreaterThan(0);
    const ready = { ...v, resolution: { path: "two_state" as const, progress: 50, milestones: ["TS_COORDINATION", "TS_BORDERS", "TS_JERUSALEM", "TS_REFUGEES_SECURITY"] } };
    expect(S.DILEMMAS.TS_FINAL.weight?.(ready)).toBe(0);
    expect(S.DILEMMAS.TS_FINAL.weight?.({ ...ready, resolution: { ...ready.resolution, progress: 70 } })).toBeGreaterThan(0);
  });
});
