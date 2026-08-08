/** ETL: Bank of Israel SDMX macro series → normalized/macro_current.json
 *  GDP (nominal), policy rate, 10y zero-coupon yield, unemployment (SA),
 *  CPI y/y, USD/ILS, work-age population. Run: tsx packages/data/etl/boi_macro.ts */

import { boiSeries, fetchJson, saveRaw, today, writeNormalized } from "./lib";

async function findSeriesCode(flow: string, nameRegex: RegExp, codeHint?: RegExp): Promise<string> {
  const url = `https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/${flow}/1.0?format=sdmx-json&detail=serieskeysonly`;
  const d = (await fetchJson(url)) as { data: { structure: { dimensions: { series: Array<{ id: string; values: Array<{ id: string; name?: string }> }> } } } };
  const dim = d.data.structure.dimensions.series.find((x) => x.id === "SERIES_CODE");
  if (!dim) throw new Error(`${flow}: no SERIES_CODE dim`);
  const candidates = dim.values.filter((v) => nameRegex.test(v.name ?? "") && (!codeHint || codeHint.test(v.id)));
  if (candidates.length === 0) throw new Error(`${flow}: no series matching ${nameRegex}`);
  candidates.sort((a, b) => a.id.length - b.id.length);
  console.log(`${flow}: picked ${candidates[0].id} (${candidates[0].name}) of ${candidates.length} candidates`);
  return candidates[0].id;
}

const out: Record<string, { value: number; period: string; flow: string; series: string; note: string }> = {};

// Nominal GDP, ₪M: sum last 4 quarterly observations → annual.
{
  const obs = await boiSeries("NA", "GDP_Q_N", 4);
  saveRaw("boi_gdp_q_n.json", obs);
  const annual = obs.reduce((a, [, v]) => a + v, 0);
  out.gdp_nominal_annual = { value: annual, period: `${obs[0][0]}..${obs.at(-1)![0]}`, flow: "NA", series: "GDP_Q_N", note: "sum of last 4 quarters, NIS millions current prices" };
}

// Policy rate, %/yr.
{
  const obs = await boiSeries("BR", "MNT_RIB_BOI_D", 1);
  out.policy_rate = { value: obs.at(-1)![1] / 100, period: obs.at(-1)![0], flow: "BR", series: "MNT_RIB_BOI_D", note: "fraction/yr" };
}

// 10y nominal zero-coupon yield, %/yr.
{
  const obs = await boiSeries("ZCM", "ZC_TSB_ZND_10Y_MA", 1);
  out.bond_yield_10y = { value: obs.at(-1)![1] / 100, period: obs.at(-1)![0], flow: "ZCM", series: "ZC_TSB_ZND_10Y_MA", note: "fraction/yr, monthly avg" };
}

// Unemployment rate, % of labour force (15+, SA monthly preferred).
{
  const code = await findSeriesCode("LBM", /^Unemployment rate$|^Unemployment rate - Total/i, /^(BI_)?UE_R/);
  const obs = await boiSeries("LBM", code, 1);
  out.unemployment = { value: obs.at(-1)![1] / 100, period: obs.at(-1)![0], flow: "LBM", series: code, note: "fraction of labour force" };
}

// Labour-force participation rate if available.
try {
  const code = await findSeriesCode("LBM", /participation rate$|Participation rate - Total/i);
  const obs = await boiSeries("LBM", code, 1);
  out.participation = { value: obs.at(-1)![1] / 100, period: obs.at(-1)![0], flow: "LBM", series: code, note: "fraction of work-age population" };
} catch (e) {
  console.log("participation series not found, skipping:", (e as Error).message);
}

// Work-age population (15+), persons.
{
  const code = await findSeriesCode("LBM", /^Population in work age - [Tt]otal$/, /^POP_/);
  const obs = await boiSeries("LBM", code, 1);
  out.workage_population = { value: obs.at(-1)![1] * 1000, period: obs.at(-1)![0], flow: "LBM", series: code, note: "persons (source in thousands)" };
}

// CPI inflation y/y, computed from the headline index level (series "CP").
{
  const obs = await boiSeries("PRI", "CP", 13);
  const last = obs.at(-1)!;
  const yearAgo = obs.find(([t]) => t === `${Number(last[0].slice(0, 4)) - 1}${last[0].slice(4)}`) ?? obs[0];
  out.inflation_yoy = { value: last[1] / yearAgo[1] - 1, period: `${yearAgo[0]}→${last[0]}`, flow: "PRI", series: "CP", note: "y/y from headline index level" };
}

// USD/ILS representative rate.
{
  const code = await findSeriesCode("EXR", /Dollar|USD/i, /USD/);
  const obs = await boiSeries("EXR", code, 1);
  out.shekel_usd = { value: obs.at(-1)![1], period: obs.at(-1)![0], flow: "EXR", series: code, note: "₪ per USD" };
}

writeNormalized("macro_current", out, {
  id: "boi.macro_current",
  source_url: "https://edge.boi.org.il/FusionEdgeServer/sdmx/v2/ (BOI.STATISTICS: NA, BR, ZCM, LBM, PRI, EXR)",
  retrieved: today(),
  license: "Bank of Israel open data",
  rows: Object.keys(out).length,
  schema: { "<key>": "{ value:number, period:string, flow:string, series:string, note:string }" },
  known_gaps: [
    "GDP is sum of last 4 quarterly nominal observations (NIS millions).",
    "No government debt-stock series found on BoI SDMX; debt/GDP is set separately (low confidence) in build_initial_state.ts.",
  ],
  transform_script: "packages/data/etl/boi_macro.ts",
});
console.log(JSON.stringify(out, null, 1));
