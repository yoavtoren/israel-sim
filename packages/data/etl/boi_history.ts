/** ETL: BoI historical series for the M9 backtest →
 *  normalized/history/macro_history.json. Real (chained) GDP and unemployment
 *  are fetched; debt/GDP and poverty are hand-transcribed annual tables
 *  (MoF Accountant General / NII reports) with provenance in the sidecar. */

import { boiSeries, saveRaw, today, writeNormalized } from "./lib";

const YEARS = Array.from({ length: 26 }, (_, i) => 2000 + i);

// Hand-transcribed: MoF/BoI gross public debt, % of GDP (approx, ±2pp).
const DEBT_GDP: Record<number, number> = {
  2000: 0.78, 2001: 0.81, 2002: 0.88, 2003: 0.93, 2004: 0.91, 2005: 0.87,
  2006: 0.81, 2007: 0.74, 2008: 0.72, 2009: 0.75, 2010: 0.71, 2011: 0.69,
  2012: 0.68, 2013: 0.67, 2014: 0.66, 2015: 0.64, 2016: 0.62, 2017: 0.61,
  2018: 0.61, 2019: 0.60, 2020: 0.71, 2021: 0.68, 2022: 0.605, 2023: 0.62,
  2024: 0.69, 2025: 0.69,
};

// Hand-transcribed: NII poverty rate among persons (approx, ±1pp).
const POVERTY: Record<number, number> = {
  2000: 0.18, 2001: 0.185, 2002: 0.19, 2003: 0.195, 2004: 0.20, 2005: 0.205,
  2006: 0.20, 2007: 0.20, 2008: 0.198, 2009: 0.205, 2010: 0.20, 2011: 0.198,
  2012: 0.197, 2013: 0.187, 2014: 0.185, 2015: 0.196, 2016: 0.185, 2017: 0.181,
  2018: 0.181, 2019: 0.18, 2020: 0.185, 2021: 0.19, 2022: 0.185, 2023: 0.185,
  2024: 0.19, 2025: 0.19,
};

function annualMeans(obs: Array<[string, number]>): Record<number, number> {
  const byYear = new Map<number, number[]>();
  for (const [t, v] of obs) {
    const y = Number(t.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(v);
  }
  const out: Record<number, number> = {};
  for (const [y, vals] of byYear) out[y] = vals.reduce((a, b) => a + b, 0) / vals.length;
  return out;
}

// Real (chained) GDP, quarterly SA → annual mean index.
const gdpObs = await boiSeries("NA", "CHAINED_GDP_Q_FP_SA", 130);
saveRaw("boi_chained_gdp.json", gdpObs);
const gdpAnnual = annualMeans(gdpObs);

// Unemployment: monthly SA (2012+) merged over annual series for earlier years.
let ueAnnual: Record<number, number> = {};
try {
  const ueA = await boiSeries("LBM", "BI_UE_R_A", 30);
  ueAnnual = annualMeans(ueA);
} catch {
  console.log("BI_UE_R_A unavailable");
}
const ueM = await boiSeries("LBM", "UE_R_M_SA", 320);
saveRaw("boi_ue_history.json", { ueM, ueAnnual });
Object.assign(ueAnnual, annualMeans(ueM)); // monthly SA overrides where present

const rows = YEARS.map((y) => ({
  year: y,
  real_gdp_index: gdpAnnual[y] ?? null,
  unemployment: ueAnnual[y] !== undefined ? +(ueAnnual[y] / 100).toFixed(4) : null,
  debt_gdp: DEBT_GDP[y],
  poverty: POVERTY[y],
}));

const missingGdp = rows.filter((r) => r.real_gdp_index === null).map((r) => r.year);
const missingUe = rows.filter((r) => r.unemployment === null).map((r) => r.year);

writeNormalized("history/macro_history", rows, {
  id: "history.macro.2000_2025",
  source_url: "BoI SDMX NA/CHAINED_GDP_Q_FP_SA + LBM unemployment; debt/GDP and poverty hand-transcribed (MoF Accountant General, NII annual poverty reports)",
  retrieved: today(),
  license: "BoI open data + transcribed published figures",
  rows: rows.length,
  schema: { year: "int", real_gdp_index: "chained real GDP, annual mean of quarterly SA index | null", unemployment: "fraction, annual mean | null", debt_gdp: "fraction (hand, ±2pp)", poverty: "fraction of persons (hand, ±1pp)" },
  known_gaps: [
    `GDP index missing for years: ${missingGdp.join(", ") || "none"}.`,
    `Unemployment missing for years: ${missingUe.join(", ") || "none"} (LFS methodology break 2012 — pre-2012 uses annual series if available).`,
    "Debt/GDP and poverty are hand tables; replace with MoF debt reports and NII series when fetchable.",
  ],
  transform_script: "packages/data/etl/boi_history.ts",
});
console.log(JSON.stringify(rows.filter((r) => [2000, 2008, 2015, 2020, 2025].includes(r.year)), null, 1));
