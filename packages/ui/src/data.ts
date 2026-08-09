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
