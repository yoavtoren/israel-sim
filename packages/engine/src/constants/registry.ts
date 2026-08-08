/**
 * Constants registry — CONTRACT C2. Every coefficient the engine uses is an
 * entry loaded from packages/data/constants/*.json and passed in; the engine
 * itself contains no numeric coefficients.
 */

export type Confidence = "high" | "medium" | "low" | "placeholder";

export interface ConstantEntry {
  id: string;
  value: number;
  unit: string;
  /** "immediate" | "step(k=N)" | "gamma(shape=a, scale=b)" */
  lag_kernel: string;
  confidence: Confidence;
  source: string;
  ci?: [number, number];
}

export interface Registry {
  get(id: string): number;
  entry(id: string): ConstantEntry;
  all(): ConstantEntry[];
}

const CONFIDENCES: ReadonlySet<string> = new Set(["high", "medium", "low", "placeholder"]);

function validateEntry(raw: unknown, ordinal: number): ConstantEntry {
  if (typeof raw !== "object" || raw === null) throw new Error(`constants entry #${ordinal}: not an object`);
  const e = raw as Record<string, unknown>;
  const id = e.id;
  if (typeof id !== "string" || id.length === 0) throw new Error(`constants entry #${ordinal}: missing id`);
  if (typeof e.value !== "number" || !Number.isFinite(e.value)) throw new Error(`constant "${id}": value must be a finite number`);
  if (typeof e.unit !== "string") throw new Error(`constant "${id}": missing unit`);
  if (typeof e.lag_kernel !== "string") throw new Error(`constant "${id}": missing lag_kernel`);
  if (typeof e.confidence !== "string" || !CONFIDENCES.has(e.confidence)) throw new Error(`constant "${id}": bad confidence`);
  if (typeof e.source !== "string" || e.source.length === 0) throw new Error(`constant "${id}": missing source`);
  const entry: ConstantEntry = {
    id,
    value: e.value,
    unit: e.unit,
    lag_kernel: e.lag_kernel,
    confidence: e.confidence as Confidence,
    source: e.source,
  };
  if (Array.isArray(e.ci) && e.ci.length === 2 && typeof e.ci[0] === "number" && typeof e.ci[1] === "number") {
    entry.ci = [e.ci[0], e.ci[1]];
  }
  return entry;
}

export function buildRegistry(groups: unknown[][]): Registry {
  const map = new Map<string, ConstantEntry>();
  let ordinal = 0;
  for (const group of groups) {
    for (const raw of group) {
      ordinal++;
      const entry = validateEntry(raw, ordinal);
      if (map.has(entry.id)) throw new Error(`duplicate constant id "${entry.id}"`);
      map.set(entry.id, entry);
    }
  }
  return {
    get(id: string): number {
      const e = map.get(id);
      if (e === undefined) throw new Error(`unknown constant "${id}"`);
      return e.value;
    },
    entry(id: string): ConstantEntry {
      const e = map.get(id);
      if (e === undefined) throw new Error(`unknown constant "${id}"`);
      return e;
    },
    all(): ConstantEntry[] {
      return [...map.values()];
    },
  };
}
