import { describe, expect, it } from "vitest";
import { strategic } from "@engine";
import { ambientFromGame, ambientMotionActive } from "../src/strategic/ambient";

const QUIET = { playing: false, crisisOpen: false };

/** A world taken from a real campaign, then bent into the state under test. */
const base = ambientFromGame(strategic.createCampaign("ambient-test"));
const inGame = { ...base, active: true };

describe("map motion is an event, not wallpaper", () => {
  it("stands still before a government is formed", () => {
    expect(base.active).toBe(false);
    expect(ambientMotionActive(base, QUIET)).toBe(false);
    // even a flag set in the pre-game state cannot start the loop
    expect(ambientMotionActive({ ...base, flags: { ...base.flags, massProtests: true } }, QUIET)).toBe(false);
  });

  it("stands still during a quiet term", () => {
    expect(ambientMotionActive(inGame, QUIET)).toBe(false);
  });

  it("moves only while something is actually happening", () => {
    expect(ambientMotionActive({ ...inGame, atWar: true }, QUIET)).toBe(true);
    for (const f of ["massProtests", "emergencyRule", "redSeaBlockade", "lebanonWar"] as const) {
      expect(ambientMotionActive({ ...inGame, flags: { ...inGame.flags, [f]: true } }, QUIET)).toBe(true);
    }
    // a flag the map does not animate leaves it still
    expect(ambientMotionActive({ ...inGame, flags: { ...inGame.flags, downgraded: true } }, QUIET)).toBe(false);
  });

  it("moves while a script plays or a crisis is open, whatever the world looks like", () => {
    expect(ambientMotionActive(base, { playing: true, crisisOpen: false })).toBe(true);
    expect(ambientMotionActive(base, { playing: false, crisisOpen: true })).toBe(true);
  });
});
