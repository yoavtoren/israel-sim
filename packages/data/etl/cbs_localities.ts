/** ETL: CBS Census 2022 (data.gov.il) + socio-economic cluster 2019 →
 *  normalized/localities.json (one row per locality) and
 *  normalized/sector_populations_2022.json (national sector split derived from
 *  per-area majority religion × religiosity). */

import { datastoreAll, saveRaw, today, writeNormalized } from "./lib";

const CENSUS = "9a9e085f-3bc8-41df-b15f-be0daaf99e30";      // census 2022 selected data by locality & stat area
const CLUSTER = "7c860e04-9f8d-41c2-9f24-6249958d2081";     // socio-economic cluster 2019
const YESHUVIM = "5c78e9fa-c2e2-4771-93ff-7f400a12f7ba";    // locality list (codes, districts)

const census = await datastoreAll(CENSUS);
const clusters = await datastoreAll(CLUSTER);
const yeshuvim = await datastoreAll(YESHUVIM);
saveRaw("census_2022_selected.json", census);
saveRaw("cluster_2019.json", clusters);
saveRaw("yeshuvim_list.json", yeshuvim);

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v.trim()) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : String(v ?? ""));

// Cluster map: locality code → cluster 1-10.
const clusterByCode = new Map<number, number>();
{
  const sample = clusters[0] ?? {};
  const codeKey = Object.keys(sample).find((k) => /סמל|SYMBOL|semel|code/i.test(k) && !/אשכול|ESHKOL/i.test(k));
  const clusterKey = Object.keys(sample).find((k) => /אשכול|ESHKOL|cluster/i.test(k));
  if (!codeKey || !clusterKey) throw new Error(`cluster columns not found in: ${Object.keys(sample).join(",")}`);
  for (const r of clusters) {
    const c = num(r[codeKey]);
    const cl = num(r[clusterKey]);
    if (c !== null && cl !== null) clusterByCode.set(c, cl);
  }
}

// District per locality from the yeshuvim list (napa name).
const districtByCode = new Map<number, string>();
for (const r of yeshuvim) {
  const c = num(r["סמל_ישוב"]);
  if (c !== null) districtByCode.set(c, str(r["שם_נפה"]));
}

// Census rows: locality-level = StatArea null & LocalityCode set. National row: LocalityCode null.
interface CensusRow { code: number | null; statArea: string | null; name: string; pop: number | null; religion: string; religiosity: string; empl: number | null; wage: number | null; age0_19: number | null; age65: number | null }
const rows: CensusRow[] = census.map((r) => ({
  code: num(r.LocalityCode),
  statArea: r.StatArea === null || r.StatArea === undefined ? null : str(r.StatArea),
  name: str(r.LocNameHeb),
  pop: num(r.pop_approx),
  religion: str(r.ReligionHeb),
  religiosity: str(r.hh_MidatDatiyut),
  empl: num(r.Empl_pcnt),
  wage: num(r.employeesAnnual_medWage),
  age0_19: num(r.age0_19_pcnt),
  age65: num(r.age65_pcnt),
}));

const national = rows.find((r) => r.code === null && r.statArea === null);
if (!national?.pop) throw new Error("national census row not found");

const localityRows = rows.filter((r) => r.code !== null && r.statArea === null);
const statAreaRows = rows.filter((r) => r.code !== null && r.statArea !== null);
const localitiesWithSA = new Set(statAreaRows.map((r) => r.code));

const localities = localityRows.map((r) => ({
  code: r.code as number,
  name_he: r.name,
  population: r.pop ?? 0,
  district: districtByCode.get(r.code as number) ?? "",
  socioeconomic_cluster: clusterByCode.get(r.code as number) ?? null,
  majority_religion: r.religion,
  majority_religiosity: r.religiosity,
  employment_pcnt: r.empl,
  median_annual_wage_ils: r.wage,
  age0_19_pcnt: r.age0_19,
  age65_pcnt: r.age65,
}));

const localitySum = localities.reduce((a, l) => a + l.population, 0);
const missingCluster = localities.filter((l) => l.socioeconomic_cluster === null && l.population > 1000).length;

writeNormalized("localities", localities, {
  id: "cbs.census2022.localities",
  source_url: `https://data.gov.il datastore ${CENSUS} + ${CLUSTER} + ${YESHUVIM}`,
  retrieved: today(),
  license: "CBS open data (data.gov.il)",
  rows: localities.length,
  schema: {
    code: "int (CBS locality code)", name_he: "string", population: "persons (census 2022)",
    district: "string (napa)", socioeconomic_cluster: "int 1-10 (2019) | null",
    majority_religion: "string", majority_religiosity: "string (household majority)",
    employment_pcnt: "% employed of work-age | null", median_annual_wage_ils: "₪/yr | null",
    age0_19_pcnt: "%", age65_pcnt: "%",
  },
  known_gaps: [
    `Locality populations sum to ${localitySum} vs national census row ${national.pop} (diff ${(100 * (localitySum / national.pop - 1)).toFixed(2)}%).`,
    `${missingCluster} localities >1000 pop missing a 2019 socio-economic cluster.`,
    "Population values are census-2022 rounded approximations (pop_approx).",
  ],
  transform_script: "packages/data/etl/cbs_localities.ts",
});

// --- National sector split from finest-available areas (stat areas where present, else locality) ---
const finest = [...statAreaRows, ...localityRows.filter((r) => !localitiesWithSA.has(r.code))];
const sums: Record<string, number> = { secular: 0, national_religious: 0, haredi: 0, arab: 0, other: 0 };
for (const r of finest) {
  if (!r.pop) continue;
  const rel = r.religion;
  if (/מוסלמי|דרוזי|נוצרי|ערבי/.test(rel)) sums.arab += r.pop;
  else if (/יהודי/.test(rel)) {
    if (/חרדי/.test(r.religiosity)) sums.haredi += r.pop;
    else if (/דתי/.test(r.religiosity)) sums.national_religious += r.pop;
    else if (/מסורתי|חילוני/.test(r.religiosity)) sums.secular += r.pop;
    else sums.secular += r.pop;
  } else sums.other += r.pop;
}
const finestSum = Object.values(sums).reduce((a, b) => a + b, 0);

writeNormalized("sector_populations_2022", { national_total: national.pop, by_sector: sums, covered: finestSum }, {
  id: "cbs.census2022.sector_split",
  source_url: `https://data.gov.il datastore ${CENSUS}`,
  retrieved: today(),
  license: "CBS open data (data.gov.il)",
  rows: 5,
  schema: { by_sector: "persons per sector (census 2022)" },
  known_gaps: [
    "IMPUTED CLASSIFICATION: each statistical area / locality is assigned wholly to its household-majority religion & religiosity; minorities within areas are misassigned.",
    "Jewish religiosity mapping: חרדי→haredi, דתי→national_religious, מסורתי+חילוני→secular; non-Jewish non-Arab→other.",
    `Covered population ${finestSum} vs national ${national.pop}.`,
  ],
  transform_script: "packages/data/etl/cbs_localities.ts",
});
console.log(JSON.stringify({ national: national.pop, localitySum, sums }, null, 1));
