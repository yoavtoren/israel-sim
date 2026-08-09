/** M8 gate: the game plays fine with the narrator off — narration is always
 *  schema-valid, deterministic without a model, constrained to consequence
 *  reporting on red lines, cached, and falls back safely on bad model output. */

import { describe, expect, it } from "vitest";
import { tick } from "../../engine/src/index";
import { loadContext } from "../../engine/test/helpers";
import { buildNarratorInput } from "../src/bridge";
import {
  clearNarratorCache, narrate, situationKey, templateNarration, validateOutput,
  type NarratorInput, type Transport,
} from "../src/index";

function realInput(lang: "he" | "en" = "he"): NarratorInput {
  const { ctx, initial } = loadContext("narrator");
  const r = tick(initial, {}, ctx);
  return buildNarratorInput(initial, r, lang);
}

describe("M8: narrator", () => {
  it("narrator OFF (default): schema-valid narration from a real tick, both languages, no model", async () => {
    for (const lang of ["he", "en"] as const) {
      clearNarratorCache();
      const out = await narrate(realInput(lang));
      expect(validateOutput(out)).not.toBeNull();
      expect(out.headlines.length).toBeGreaterThan(0);
      expect(out.street_mood.length).toBeGreaterThan(0);
    }
  });

  it("red-line input is rendered in consequence register with explicit numbers", () => {
    const input = realInput("en");
    input.red_line = true;
    input.war_casualties = 4321;
    input.events.unshift({ id: "red_line_mass_atrocity", note: "arms embargo; regional coalition at war", count: 1 });
    const out = templateNarration(input);
    expect(out.headlines[0].tone).toBe("alarmed");
    expect(out.headlines[0].text).toContain("4,321");
    expect(out.minister_quotes).toHaveLength(0); // no one spins this
  });

  it("schema validation rejects malformed output", () => {
    expect(validateOutput(null)).toBeNull();
    expect(validateOutput({ headlines: [], minister_quotes: [], street_mood: "x" })).toBeNull(); // 0 headlines
    expect(validateOutput({ headlines: [{ outlet: "a", text: "b", tone: "gleeful" }], minister_quotes: [], street_mood: "x" })).toBeNull(); // bad tone
    expect(validateOutput({ headlines: [{ outlet: "a", text: "b", tone: "neutral" }], minister_quotes: [], street_mood: "" })).toBeNull(); // empty mood
    expect(validateOutput({ headlines: [{ outlet: "a", text: "b", tone: "neutral" }], minister_quotes: [], street_mood: "calm" })).not.toBeNull();
  });

  it("model failure falls back to templates; valid model output is used", async () => {
    const input = realInput("en");
    clearNarratorCache();
    const badTransport: Transport = async () => ({ message: { content: "not json {{" } });
    const fallback = await narrate(input, { mode: "ollama" }, badTransport);
    expect(validateOutput(fallback)).not.toBeNull(); // template saved the day

    clearNarratorCache();
    const modelOut = { headlines: [{ outlet: "Wire", text: "Model text", tone: "neutral" }], minister_quotes: [], street_mood: "steady" };
    const goodTransport: Transport = async () => ({ message: { content: JSON.stringify(modelOut) } });
    const used = await narrate(input, { mode: "ollama" }, goodTransport);
    expect(used.headlines[0].text).toBe("Model text");
  });

  it("cache: identical bucketed situations invoke the transport once", async () => {
    clearNarratorCache();
    const input = realInput("en");
    let calls = 0;
    const transport: Transport = async () => {
      calls++;
      return { message: { content: JSON.stringify({ headlines: [{ outlet: "W", text: "t", tone: "neutral" }], minister_quotes: [], street_mood: "m" }) } };
    };
    await narrate(input, { mode: "ollama" }, transport);
    await narrate(structuredClone(input), { mode: "ollama" }, transport);
    expect(calls).toBe(1);
    expect(situationKey(input)).toBe(situationKey(structuredClone(input)));
  });

  it("the engine needs nothing from the narrator: a 5-year run completes with narration fully off", () => {
    const { ctx, initial } = loadContext("no-narrator");
    let s = initial;
    for (let i = 0; i < 20; i++) s = tick(s, {}, ctx).state;
    expect(s.t.year).toBe(2031);
    expect(s.outcome.ended).toBe(false);
  });
});
