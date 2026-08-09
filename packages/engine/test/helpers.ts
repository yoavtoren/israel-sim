/** Test/smoke loader: reads data JSONs from packages/data and builds the
 *  engine context + initial state. All I/O stays out here, per CONTRACT C4. */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildInitialState, buildRegistry, parseMinistryDefs,
  type InitialStateJson, type LocalityInitRow, type WorldState,
} from "../src/index";
import type { EngineContext } from "../src/tick";

const dataDir = fileURLToPath(new URL("../../data", import.meta.url));

export function loadContext(seed = "m1-seed", startYear?: number): { ctx: EngineContext; initial: WorldState } {
  const constantsDir = join(dataDir, "constants");
  const groups: unknown[][] = readdirSync(constantsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const parsed: unknown = JSON.parse(readFileSync(join(constantsDir, f), "utf8"));
      if (!Array.isArray(parsed)) throw new Error(`${f}: expected array`);
      return parsed as unknown[];
    });
  const registry = buildRegistry(groups);

  const defsRaw: unknown = JSON.parse(readFileSync(join(dataDir, "defs", "ministries.json"), "utf8"));
  const ministries = parseMinistryDefs(defsRaw);

  const initialRaw = JSON.parse(
    readFileSync(join(dataDir, "normalized", "initial_2026.json"), "utf8"),
  ) as InitialStateJson;
  const localities = JSON.parse(
    readFileSync(join(dataDir, "normalized", "localities.json"), "utf8"),
  ) as LocalityInitRow[];

  const initial = buildInitialState(initialRaw, ministries, registry, seed, { localities, startYear });
  return { ctx: { registry, ministries, start_year: startYear ?? initialRaw.start_year }, initial };
}

export function deepFreeze<T>(obj: T): T {
  if (typeof obj === "object" && obj !== null && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const v of Object.values(obj)) deepFreeze(v);
  }
  return obj;
}

/** Collects every numeric leaf with its path — used by the NaN/negativity checks. */
export function numericLeaves(value: unknown, prefix = ""): Array<[string, number]> {
  if (typeof value === "number") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [];
  const out: Array<[string, number]> = [];
  for (const [k, v] of Object.entries(value)) {
    out.push(...numericLeaves(v, prefix === "" ? k : `${prefix}.${k}`));
  }
  return out;
}
