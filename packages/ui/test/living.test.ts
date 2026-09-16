import { describe, expect, it } from "vitest";
import { strategic } from "@engine";
import { CONSEQUENCE_SCENES, DILEMMA_SCENES, OPTION_SCENES, type SceneItem } from "../src/strategic/living/catalog";
import { useLiving } from "../src/strategic/living/director";
import { drawScene, sceneDuration, sceneScars } from "../src/strategic/living/scenes";
import { drawStill, worldFromGame } from "../src/strategic/living/static";
import { makeFrame } from "../src/strategic/living/draw";
import { P } from "../src/strategic/living/places";

/** A canvas that records every call and property write, so frames can be compared. */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const grad = { addColorStop: (o: number, c: string) => log.push(`stop ${o.toFixed(3)} ${c}`) };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      if (key === "createRadialGradient" || key === "createLinearGradient") return (...a: number[]) => (log.push(`${key} ${a.map((v) => v.toFixed(2)).join(",")}`), grad);
      if (key === "measureText") return (s: string) => ({ width: s.length * 6 });
      return (...a: unknown[]) => log.push(`${key}(${a.map((v) => (typeof v === "number" ? v.toFixed(2) : String(v))).join(",")})`);
    },
    set(_t, key: string, value: unknown) {
      log.push(`${key}=${typeof value === "number" ? value.toFixed(3) : String(value)}`);
      target[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const camAt = (lon: number, lat: number, scale: number) => ({ cx: (lon - 28) * Math.cos((31.5 * Math.PI) / 180) * 100, cy: (38.5 - lat) * 100, scale });
const CAM_ISRAEL = camAt(34.9, 31.7, 2.2);
const CAMS = [CAM_ISRAEL, camAt(40, 26, 0.35), camAt(-20, 40, 0.06)];

function playTo(game: strategic.CampaignState): strategic.CampaignState {
  const party = strategic.rosterParties(game.roster)[0];
  let g = strategic.chooseParty(game, party);
  const bloc = strategic.BENCHMARK_COALITIONS.find((b) => b.members.includes(party) && strategic.checkCoalition(b.members, g.roster).valid && (b.roster === undefined || b.roster === g.roster));
  if (bloc === undefined) throw new Error("no valid coalition for the test");
  g = strategic.formGovernment(g, bloc.members);
  return g;
}

describe("living map: every event has a scene", () => {
  const allItems: SceneItem[] = [];

  it("covers every non-crisis option, consequence and eventful dilemma in the content", () => {
    const missing: string[] = [];
    for (const d of Object.values(strategic.DILEMMAS)) {
      if (d.crisisId !== undefined) continue;
      if (d.visual !== undefined && DILEMMA_SCENES[d.id] === undefined) missing.push(`dilemma ${d.id}`);
      for (const o of d.options) {
        if (OPTION_SCENES[o.id] === undefined) missing.push(`option ${o.id}`);
        for (const c of o.consequences ?? []) if (CONSEQUENCE_SCENES[c.headline.en] === undefined) missing.push(`consequence "${c.headline.en}"`);
      }
    }
    expect(missing).toEqual([]);
    for (const list of [...Object.values(DILEMMA_SCENES), ...Object.values(OPTION_SCENES), ...Object.values(CONSEQUENCE_SCENES)]) allItems.push(...list);
    expect(allItems.length).toBeGreaterThan(90);
  });

  it("every catalogued scene is finite, lands on known places, and draws something that changes over time", () => {
    const world = worldFromGame(playTo(strategic.createCampaign("living-cat")));
    for (const [i, it] of allItems.entries()) {
      const d = sceneDuration(it.spec, i, world);
      expect(d, it.spec.kind).toBeGreaterThan(5);
      expect(d, it.spec.kind).toBeLessThan(90);
      for (const s of sceneScars(it.spec, i, world, 1, `s${i}`)) {
        expect(Number.isFinite(s.at[0]) && Number.isFinite(s.at[1])).toBe(true);
      }
      // the scene must visibly change at the zoom its story is told at (country, region or world)
      let moves = false;
      for (const cam of CAMS) {
        const a = recorder();
        const b = recorder();
        drawScene({ f: makeFrame(a.ctx, cam, 1200, 800, "he"), t: d * 0.3, prevT: d * 0.3, seed: i, world, caption: it.caption, sound: () => undefined }, it.spec);
        drawScene({ f: makeFrame(b.ctx, cam, 1200, 800, "he"), t: d * 0.6, prevT: d * 0.6, seed: i, world, caption: it.caption, sound: () => undefined }, it.spec);
        if (a.log.join("\n") !== b.log.join("\n")) moves = true;
      }
      expect(moves, `${it.spec.kind} ${JSON.stringify(it.spec)} moves`).toBe(true);
    }
  });

  it("names real places", () => {
    const ids = new Set(Object.keys(P));
    const text = JSON.stringify([DILEMMA_SCENES, OPTION_SCENES, CONSEQUENCE_SCENES]);
    for (const m of text.matchAll(/"(?:place|from|to)":"([a-z_]+)"/g)) expect(ids.has(m[1]), m[1]).toBe(true);
  });
});

describe("living map: motion only when something happens", () => {
  it("the still map is identical whenever it is drawn", () => {
    let g = playTo(strategic.createCampaign("living-still"));
    g = { ...g, flags: { ...g.flags, gazaOccupied: true, lebanonWar: true, massProtests: true, emergencyRule: true, redSeaBlockade: true, annexationLaw: true, transferOrdered: true } };
    const world = worldFromGame(g);
    const scars = [{ id: "x", kind: "burn" as const, at: [34.6, 31.52] as [number, number], size: 1, step: 0 }];
    const a = recorder();
    const b = recorder();
    drawStill(makeFrame(a.ctx, CAM_ISRAEL, 1200, 800, "he"), world, scars, { barrierProgress: null, settlementsInScene: false });
    drawStill(makeFrame(b.ctx, CAM_ISRAEL, 1200, 800, "he"), world, scars, { barrierProgress: null, settlementsInScene: false });
    expect(a.log.length).toBeGreaterThan(500);
    expect(a.log).toEqual(b.log);
  });

  it("a quiet game is still; a decision starts scenes; they end and leave scars; nothing restarts on its own", () => {
    const L = useLiving.getState();
    L.observe(null, strategic.createCampaign("living-flow"), 0);
    let g = playTo(strategic.createCampaign("living-flow"));
    L.observe(null, g, 0);
    // the doctrine dilemma has no scene: the map is still
    expect(useLiving.getState().activeAt(1)).toBe(false);

    // choose the annexation doctrine, then run the game forward until a dilemma with an eventful option comes up
    let now = 1000;
    const prev = g;
    g = strategic.choose(g, "D_ANNEXATION");
    useLiving.getState().observe(prev, g, now);
    expect(useLiving.getState().activeAt(now + 100)).toBe(true);
    const ends = Math.max(...useLiving.getState().running.map((r) => r.start + r.duration * 1000));

    // observing the same state again starts nothing new
    const count = useLiving.getState().running.length;
    useLiving.getState().observe(g, g, now + 500);
    expect(useLiving.getState().running.length).toBe(count);

    // after the last scene ends the map is still again
    now = ends + 10;
    useLiving.getState().settle(now);
    expect(useLiving.getState().activeAt(now)).toBe(false);
    expect(useLiving.getState().running.length).toBe(0);

    // walk through consequences: each card that has a scene starts it, then it ends
    let guard = 0;
    while (g.phase === "consequences" && guard++ < 20) {
      const before = g;
      g = strategic.acknowledge(g);
      now += 1000;
      useLiving.getState().observe(before, g, now);
    }
    // replay restarts the last trigger only when asked
    const lt = useLiving.getState().lastTrigger;
    if (lt !== null) {
      useLiving.getState().settle(now + 1e6);
      expect(useLiving.getState().activeAt(now + 1e6)).toBe(false);
      useLiving.getState().replay(now + 1e6);
      expect(useLiving.getState().activeAt(now + 1e6 + 100)).toBe(true);
    }
  });

  it("carpet bombing Gaza leaves rubble; Hezbollah's precision fire leaves burn marks where it hits", () => {
    const world = worldFromGame(playTo(strategic.createCampaign("living-scars")));
    const carpet = OPTION_SCENES.RR_CARPET[0].spec;
    expect(sceneScars(carpet, 7, world, 3, "c").filter((s) => s.kind === "rubble").length).toBeGreaterThan(10);
    const precision = CONSEQUENCE_SCENES["Hezbollah fires precision missiles at Gush Dan"][0].spec;
    // a weaker US supply means more leakers
    const weak = { ...world, metrics: { ...world.metrics, usMilitaryAid: 0 }, flags: { ...world.flags, usArmsHold: true } };
    const strong = { ...world, metrics: { ...world.metrics, usMilitaryAid: 100 } };
    let weakHits = 0;
    let strongHits = 0;
    for (let seed = 0; seed < 40; seed++) {
      weakHits += sceneScars(precision, seed, weak, 1, "w").length;
      strongHits += sceneScars(precision, seed, strong, 1, "s").length;
    }
    expect(weakHits).toBeGreaterThan(strongHits);
  });

  it("a new game clears the map", () => {
    useLiving.getState().observe(null, strategic.createCampaign("living-reset"), 0);
    expect(useLiving.getState().running).toEqual([]);
    expect(useLiving.getState().scars).toEqual([]);
  });
});
