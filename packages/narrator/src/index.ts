/**
 * Narrator entry point. narrate() always succeeds: mode "off" (default) and
 * any model failure produce deterministic templated text. Results are cached
 * by a bucketed situation key so repeat situations don't re-invoke the model.
 * Off the critical path by design — fast-forwards may skip narration entirely.
 */

import type { NarratorConfig, NarratorInput, NarratorOutput } from "./types";
import { templateNarration } from "./templates";
import { narrateWithOllama, type Transport } from "./ollama";

export type { NarratorConfig, NarratorInput, NarratorOutput, DeltaEntry, Headline, MinisterQuote, Lang, Tone } from "./types";
export { validateOutput } from "./types";
export { templateNarration } from "./templates";
export { narrateWithOllama, fetchTransport, type Transport } from "./ollama";

/** Bucket deltas so similar situations share a cache entry (spec §11). */
export function situationKey(input: NarratorInput): string {
  const deltaBuckets = Object.entries(input.deltas)
    .map(([k, d]) => `${k}:${Math.round(d.delta * 20) / 20}`)
    .sort()
    .join("|");
  const eventIds = input.events.map((e) => e.id).sort().join(",");
  return `${input.lang}|${input.red_line ? "RL" : "ok"}|${deltaBuckets}|${eventIds}`;
}

const cache = new Map<string, NarratorOutput>();

export function clearNarratorCache(): void {
  cache.clear();
}

export async function narrate(
  input: NarratorInput,
  config: NarratorConfig = { mode: "off" },
  transport?: Transport,
): Promise<NarratorOutput> {
  const key = situationKey(input);
  const cached = cache.get(key);
  if (cached) return cached;

  let out: NarratorOutput | null = null;
  if (config.mode === "ollama") {
    out = await narrateWithOllama(input, config, transport);
  }
  if (out === null) out = templateNarration(input);

  cache.set(key, out);
  return out;
}
