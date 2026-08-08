/** Shared ETL helpers: fetch with UA + retry, raw-cache, sidecar writer (CONTRACT C1). */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const dataRoot = fileURLToPath(new URL("..", import.meta.url));
export const rawDir = join(dataRoot, "raw");
export const normalizedDir = join(dataRoot, "normalized");

const UA = "israel-sim-etl (open-data research; contact: local)";

export async function fetchJson(url: string, tries = 3): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

export function saveRaw(name: string, data: unknown): void {
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, name), JSON.stringify(data));
}

export interface Sidecar {
  id: string;
  source_url: string;
  retrieved: string;
  license: string;
  rows: number;
  schema: Record<string, string>;
  known_gaps: string[];
  transform_script: string;
}

export function writeNormalized(baseName: string, rows: unknown, sidecar: Sidecar): void {
  mkdirSync(normalizedDir, { recursive: true });
  writeFileSync(join(normalizedDir, `${baseName}.json`), JSON.stringify(rows, null, 1));
  writeFileSync(join(normalizedDir, `${baseName}.sidecar.json`), JSON.stringify(sidecar, null, 2));
  console.log(`wrote normalized/${baseName}.json (+sidecar)`);
}

/** data.gov.il CKAN datastore paginated fetch. */
export async function datastoreAll(resourceId: string, pageSize = 1000): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&limit=${pageSize}&offset=${offset}`;
    const d = (await fetchJson(url)) as { result: { records: Record<string, unknown>[]; total: number } };
    out.push(...d.result.records);
    if (out.length >= d.result.total || d.result.records.length === 0) break;
  }
  return out;
}

/** BoI SDMX: last N observations of one series. Returns [time, value] pairs. */
export async function boiSeries(flow: string, seriesCode: string, lastN = 1): Promise<Array<[string, number]>> {
  const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/${flow}/1.0/${seriesCode}?lastNObservations=${lastN}&format=sdmx-json`;
  const d = (await fetchJson(url)) as {
    data: {
      dataSets: Array<{ series: Record<string, { observations: Record<string, number[]> }> }>;
      structure: { dimensions: { observation: Array<{ id: string; values: Array<{ id: string }> }> } };
    };
  };
  const ds = d.data.dataSets[0];
  const timeDim = d.data.structure.dimensions.observation.find((o) => o.id === "TIME_PERIOD");
  if (!timeDim) throw new Error(`no TIME_PERIOD for ${flow}/${seriesCode}`);
  const seriesObj = Object.values(ds.series)[0];
  if (!seriesObj) throw new Error(`no data for ${flow}/${seriesCode}`);
  return Object.entries(seriesObj.observations)
    .map(([idx, vals]): [string, number] => [timeDim.values[Number(idx)].id, Number(vals[0])])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

export function today(): string {
  // ETL runs outside the engine; wall-clock here is fine and recorded in sidecars.
  return new Date().toISOString().slice(0, 10);
}
