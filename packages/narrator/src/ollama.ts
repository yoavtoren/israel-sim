/**
 * Ollama adapter (spec §11). Model swappable via config; JSON output validated
 * against the C5 schema, retried once, null on repeated failure (caller falls
 * back to templates). The transport is injectable for tests.
 */

import type { NarratorConfig, NarratorInput, NarratorOutput } from "./types";
import { validateOutput } from "./types";

export type Transport = (url: string, body: unknown) => Promise<unknown>;

export const fetchTransport: Transport = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`ollama HTTP ${res.status}`);
  return res.json();
};

function systemPrompt(input: NarratorInput): string {
  const base =
    "You write short news-flash narration for a political-economy simulation of Israel. " +
    "Describe ONLY the numbers and event notes supplied. Invent no facts, no names of real living people, " +
    "no organizations, and no figures that were not given. Outlets must be fictional. Ministers appear by role only. " +
    `Write in ${input.lang === "he" ? "Hebrew" : "English"}. ` +
    'Return ONLY JSON: {"headlines":[{"outlet":string,"text":string,"tone":"supportive"|"critical"|"neutral"|"alarmed"}],"minister_quotes":[{"role":string,"text":string}],"street_mood":string}. 1-6 headlines, 0-4 quotes.';
  if (input.red_line) {
    return base +
      " REGISTER CONSTRAINT: a catastrophic red line has been crossed. Report consequences soberly — human cost, isolation, loss. " +
      "No triumphalism, no strategic framing, no silver linings. Alarmed or neutral tones only.";
  }
  return base;
}

export async function narrateWithOllama(
  input: NarratorInput,
  config: NarratorConfig,
  transport: Transport = fetchTransport,
): Promise<NarratorOutput | null> {
  const url = `${config.base_url ?? "http://localhost:11434"}/api/chat`;
  const body = {
    model: config.model ?? "aya-expanse:8b",
    stream: false,
    format: "json",
    messages: [
      { role: "system", content: systemPrompt(input) },
      { role: "user", content: JSON.stringify({ tick: input.tick, deltas: input.deltas, events: input.events, sector_moods: input.sector_moods, war_casualties: input.war_casualties }) },
    ],
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await transport(url, body);
      const content = (raw as { message?: { content?: string } }).message?.content;
      if (typeof content !== "string") continue;
      const parsed: unknown = JSON.parse(content);
      const valid = validateOutput(parsed);
      if (valid) return valid;
    } catch {
      // fall through to retry / null
    }
  }
  return null;
}
