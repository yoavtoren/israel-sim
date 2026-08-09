/** Calibrates the terror and protest hazard base rates so the expected rate
 *  at the 2026 initial state matches the historical recent-regime mean from
 *  normalized/history/incidents.json (spec §12: calibrate the least-sourced
 *  coefficients against history). Patches constants/hazards.json in place.
 *  Offline — no network. */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataRoot, normalizedDir } from "./lib";
import {
  buildInitialState, buildRegistry, evalHazard, parseEventDefs, parseMinistryDefs,
  type InitialStateJson, type LocalityInitRow,
} from "../../engine/src/index";
import { readdirSync } from "node:fs";

const constantsDir = join(dataRoot, "constants");
const groups = readdirSync(constantsDir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(constantsDir, f), "utf8")) as unknown[]);
const registry = buildRegistry(groups);
const ministries = parseMinistryDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "ministries.json"), "utf8")));
const events = parseEventDefs(JSON.parse(readFileSync(join(dataRoot, "defs", "events.json"), "utf8")));
const initialRaw = JSON.parse(readFileSync(join(normalizedDir, "initial_2026.json"), "utf8")) as InitialStateJson;
const localities = JSON.parse(readFileSync(join(normalizedDir, "localities.json"), "utf8")) as LocalityInitRow[];
const state = buildInitialState(initialRaw, ministries, registry, "calibration", { localities });

const incidents = JSON.parse(readFileSync(join(normalizedDir, "history", "incidents.json"), "utf8")) as {
  calibration_regime: { terror_mean_per_year: number; protest_mean_per_year: number; years: string };
};

const targets: Record<string, { baseId: string; perYear: number }> = {
  terror_incident: { baseId: "hazards.base_terror_incident", perYear: incidents.calibration_regime.terror_mean_per_year },
  mass_protest: { baseId: "hazards.base_mass_protest", perYear: incidents.calibration_regime.protest_mean_per_year },
};

void fileURLToPath; // path helpers imported via lib

const hazardsPath = join(constantsDir, "hazards.json");
const entries = JSON.parse(readFileSync(hazardsPath, "utf8")) as Array<{ id: string; value: number; source: string; confidence: string }>;

for (const [eventId, t] of Object.entries(targets)) {
  const def = events.find((e) => e.id === eventId);
  if (!def?.hazard) throw new Error(`event ${eventId} has no hazard`);
  // h = base·exp(Σβx) → base = target_q / exp(Σβx at t0)
  const currentBase = registry.get(t.baseId);
  const hNow = evalHazard(state, def.hazard, registry);
  const expFactor = hNow / currentBase;
  const base = t.perYear / 4 / expFactor;
  const entry = entries.find((e) => e.id === t.baseId);
  if (!entry) throw new Error(`missing ${t.baseId}`);
  entry.value = +base.toFixed(5);
  entry.confidence = "medium";
  entry.source = `calibrated by etl/calibrate_hazards.ts: E[rate] at 2026 initial state = ${t.perYear}/yr (incidents.json regime ${incidents.calibration_regime.years})`;
  console.log(`${t.baseId}: exp-factor ${expFactor.toFixed(3)} → base ${base.toFixed(4)}/q (target ${t.perYear}/yr)`);
}

writeFileSync(hazardsPath, JSON.stringify(entries, null, 1));
console.log("patched constants/hazards.json");
