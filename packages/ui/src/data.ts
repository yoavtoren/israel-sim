/** Static data bundled into the app: constants registry inputs, defs, initial state.
 *  The engine only ever sees normalized/ + constants/ + defs/ (PLAN §10) — same here.
 */

import type { InitialStateJson, LocalityInitRow } from "@engine";
import initialJsonRaw from "../../data/normalized/initial_2026.json";
import localitiesJsonRaw from "../../data/normalized/localities.json";
import coordsJsonRaw from "../../data/normalized/locality_coords.json";
import ministriesJsonRaw from "../../data/defs/ministries.json";
import eventsJsonRaw from "../../data/defs/events.json";
import reformsJsonRaw from "../../data/defs/reforms.json";
import modelsJsonRaw from "../../data/defs/economic_models.json";

import macroHistoryRaw from "../../data/normalized/history/macro_history.json";
import incidentsRaw from "../../data/normalized/history/incidents.json";
import participationRaw from "../../data/normalized/history/participation_by_sector.json";

export interface MacroHistoryRow {
  year: number;
  /** BoI chained-GDP index, own units — comparable only as growth rates */
  real_gdp_index: number;
  unemployment: number;
  debt_gdp: number;
  poverty: number;
}

export const macroHistory = macroHistoryRaw as unknown as MacroHistoryRow[];
export const incidentsHistory = incidentsRaw as unknown as {
  years: number[];
  fatal_terror_attacks: number[];
  major_protest_waves: number[];
};
export const participationHistory = participationRaw as unknown as {
  years: number[];
  series: Record<string, number[]>;
};

export const constantGroups: unknown[][] = Object.values(
  import.meta.glob("../../data/constants/*.json", { eager: true, import: "default" }),
) as unknown[][];

export const initialJson = initialJsonRaw as unknown as InitialStateJson;
export const localityRows = localitiesJsonRaw as unknown as LocalityInitRow[];
export const localityCoords = coordsJsonRaw as unknown as Record<string, [number, number]>;
export const ministriesJson = ministriesJsonRaw as unknown;
export const eventsJson = eventsJsonRaw as unknown;
export const reformsJson = reformsJsonRaw as unknown;
export const modelsJson = modelsJsonRaw as unknown;
