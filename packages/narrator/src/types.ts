/**
 * Narrator contract (spec §11, CONTRACT C5): receives numbers, returns text,
 * NEVER returns state. Output is schema-validated; on failure the caller falls
 * back to templated text.
 */

export type Lang = "he" | "en";

export interface DeltaEntry {
  /** current value, already rounded for display */ value: number;
  /** change this tick */ delta: number;
  /** display unit, e.g. "%", "₪B" */ unit: string;
}

export interface NarratorInput {
  tick: { year: number; quarter: number };
  lang: Lang;
  /** true when a red line fired or the run ended — constrains the register to consequence-reporting (CONTRACT C6) */
  red_line: boolean;
  /** headline metric name → entry; names are stable keys like "gdp_growth" */
  deltas: Record<string, DeltaEntry>;
  events: Array<{ id: string; note: string; count: number }>;
  /** sector id → approval 0-1 */
  sector_moods: Record<string, number>;
  /** cumulative war casualties if any (for consequence register) */
  war_casualties: number;
}

export type Tone = "supportive" | "critical" | "neutral" | "alarmed";

export interface Headline {
  /** fictional outlet name — never a real organization */ outlet: string;
  text: string;
  tone: Tone;
}

export interface MinisterQuote {
  /** role, never a personal name */ role: string;
  text: string;
}

export interface NarratorOutput {
  headlines: Headline[];
  minister_quotes: MinisterQuote[];
  street_mood: string;
}

export interface NarratorConfig {
  /** "off" is the default; the game is fully playable without a model */
  mode: "off" | "ollama";
  model?: string;
  base_url?: string;
}

const TONES: ReadonlySet<string> = new Set(["supportive", "critical", "neutral", "alarmed"]);

/** Schema validation per CONTRACT C5. Returns null on any violation. */
export function validateOutput(raw: unknown): NarratorOutput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.headlines) || o.headlines.length < 1 || o.headlines.length > 6) return null;
  const headlines: Headline[] = [];
  for (const h of o.headlines) {
    const hh = h as Record<string, unknown>;
    if (typeof hh.outlet !== "string" || typeof hh.text !== "string" || typeof hh.tone !== "string") return null;
    if (!TONES.has(hh.tone) || hh.text.length === 0 || hh.text.length > 300 || hh.outlet.length > 60) return null;
    headlines.push({ outlet: hh.outlet, text: hh.text, tone: hh.tone as Tone });
  }
  if (!Array.isArray(o.minister_quotes) || o.minister_quotes.length > 4) return null;
  const minister_quotes: MinisterQuote[] = [];
  for (const q of o.minister_quotes) {
    const qq = q as Record<string, unknown>;
    if (typeof qq.role !== "string" || typeof qq.text !== "string") return null;
    if (qq.text.length === 0 || qq.text.length > 300 || qq.role.length > 60) return null;
    minister_quotes.push({ role: qq.role, text: qq.text });
  }
  if (typeof o.street_mood !== "string" || o.street_mood.length === 0 || o.street_mood.length > 500) return null;
  return { headlines, minister_quotes, street_mood: o.street_mood };
}
