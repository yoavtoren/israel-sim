/** ETL: Open Budget (next.obudget.org) 2025 state budget →
 *  normalized/budget_2025.json + patches defs/ministries.json baselines and
 *  regenerates constants/fiscal.json from published figures.
 *  Run AFTER boi_macro.ts (needs GDP for revenue shares). */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataRoot, fetchJson, normalizedDir, saveRaw, today, writeNormalized } from "./lib";

const YEAR = 2025;

async function obudget(sql: string): Promise<Array<Record<string, unknown>>> {
  const url = "https://next.obudget.org/api/query?query=" + encodeURIComponent(sql);
  const d = (await fetchJson(url)) as { rows: Array<Record<string, unknown>> };
  return d.rows;
}

const sections = await obudget(
  `select code, title, net_allocated, net_revised from raw_budget where year=${YEAR} and length(code)=4 and code like '00%' order by code`,
);
const revenue = await obudget(
  `select code, title, net_allocated from raw_budget where year=${YEAR} and code in ('C881','C882','C884','C886')`,
);
saveRaw("obudget_sections_2025.json", { sections, revenue });

const alloc = new Map<string, number>();
const titles = new Map<string, string>();
for (const r of sections) {
  alloc.set(r.code as string, (r.net_allocated as number) ?? 0);
  titles.set(r.code as string, r.title as string);
}
const get = (code: string): number => alloc.get(code) ?? 0;

/** Section → ministry mapping (functional-category cross-checks in sidecar). */
const MAPPING: Record<string, string[]> = {
  defense: ["0015", "0031", "0010", "0017"],
  education: ["0020", "0021", "0060"],
  health: ["0024", "0093", "0067"],
  internal_security: ["0007", "0052"],
  transport: ["0079", "0040"],
  welfare: ["0023", "0027", "0025", "0036", "0046"],
  housing: ["0029", "0042", "0070", "0051"],
  justice: ["0008"],
  economy: ["0038", "0076", "0037", "0078", "0039"],
  foreign_affairs: ["0009"],
  environment: ["0026"],
  water_agriculture: ["0033", "0041", "0073"],
  culture_sport: [],
  science: ["0035"],
  religious_services: ["0022"],
  immigration: ["0030"],
  hasbara: [],
};
// 0019 "מדע, תרבות וספורט" split 50/50 between science and culture_sport (imputed).
const split0019 = get("0019") / 2;

const INCOME = "0000";
const DEBT_PRINCIPAL = "0084";
const DEBT_INTEREST = "0045";
// Gross business-enterprise sections excluded from net ministry spend (self-financed):
const GROSS_EXCLUDED = ["0094", "0098", "0089", "0095"];

const grossExpenditure = get(INCOME); // income side == total expenditure envelope
const spendExclFinancing = grossExpenditure - get(DEBT_PRINCIPAL) - get(DEBT_INTEREST);

const baselines: Record<string, number> = {};
for (const [ministry, codes] of Object.entries(MAPPING)) {
  let sum = codes.reduce((a, c) => a + get(c), 0);
  if (ministry === "science" || ministry === "culture_sport") sum += split0019;
  baselines[ministry] = Math.round(sum / 1e6); // ₪ → ₪M
}
if (baselines.hasbara === 0) baselines.hasbara = 500; // no dedicated section; placeholder ₪0.5B kept

const mappedTotal = Object.values(baselines).reduce((a, b) => a + b, 0); // ₪M
const nonMinistrySpend = Math.round(spendExclFinancing / 1e6) - mappedTotal; // ₪M

const rev = new Map(revenue.map((r) => [r.code as string, (r.net_allocated as number) / 1e6])); // ₪M
const direct = rev.get("C881") ?? 0;
const indirect = rev.get("C882") ?? 0;
const other = rev.get("C884") ?? 0;

// GDP from the BoI ETL output (₪M).
const macro = JSON.parse(readFileSync(join(normalizedDir, "macro_current.json"), "utf8")) as Record<string, { value: number }>;
const gdp = macro.gdp_nominal_annual.value;

const out = {
  year: YEAR,
  gross_expenditure_ils_m: Math.round(grossExpenditure / 1e6),
  debt_principal_ils_m: Math.round(get(DEBT_PRINCIPAL) / 1e6),
  debt_interest_ils_m: Math.round(get(DEBT_INTEREST) / 1e6),
  spend_excl_financing_ils_m: Math.round(spendExclFinancing / 1e6),
  ministry_baselines_ils_m: baselines,
  non_ministry_spend_ils_m: nonMinistrySpend,
  revenue_ils_m: { direct_taxes: Math.round(direct), indirect_taxes: Math.round(indirect), other: Math.round(other) },
  gdp_used_ils_m: Math.round(gdp),
  sections: sections.map((s) => ({ code: s.code, title: s.title, net_allocated: s.net_allocated, net_revised: s.net_revised })),
};

writeNormalized("budget_2025", out, {
  id: "obudget.budget_2025",
  source_url: "https://next.obudget.org/api/query (raw_budget, year=2025, net_allocated)",
  retrieved: today(),
  license: "Open Budget / MoF open data",
  rows: sections.length,
  schema: { code: "string(4)", title: "string", net_allocated: "₪", net_revised: "₪" },
  known_gaps: [
    "net_allocated (original approved) used, not net_revised (war supplements) — baseline = pre-war-supplement law.",
    "Section 0019 (science, culture & sport) split 50/50 science/culture_sport — imputed.",
    "hasbara has no dedicated budget section; ₪500M placeholder kept.",
    "Gross business-enterprise sections excluded from ministry spend: " + GROSS_EXCLUDED.map((c) => `${c} ${titles.get(c) ?? ""}`).join(", "),
    "Cross-checks: internal_security (0007+0052) matches functional category C112; transport (0079+0040) matches C331.",
    "Direct-tax split into income/corporate/capital and indirect into VAT/customs is imputed (62/28/10 and 78/22).",
  ],
  transform_script: "packages/data/etl/obudget_budget.ts",
});

// --- Patch defs/ministries.json baselines ---
const defsPath = join(dataRoot, "defs", "ministries.json");
const defs = JSON.parse(readFileSync(defsPath, "utf8")) as Array<{ id: string; baseline_budget: number }>;
for (const d of defs) {
  if (baselines[d.id] !== undefined && baselines[d.id] > 0) d.baseline_budget = baselines[d.id];
}
writeFileSync(defsPath, JSON.stringify(defs, null, 1));
console.log("patched defs/ministries.json baselines");

// --- Regenerate constants/fiscal.json from published figures ---
const src = `Open Budget raw_budget ${YEAR} net_allocated + BoI GDP_Q_N; retrieved ${today()}`;
const e = (id: string, value: number, unit: string, confidence: string, source: string, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ id, value, unit, lag_kernel: "immediate", confidence, source, ...extra });
const fiscalConstants = [
  e("fiscal.revenue_share_income", +((direct * 0.62) / gdp).toFixed(5), "share of GDP", "medium", src + "; 62% of direct taxes imputed as household income tax"),
  e("fiscal.revenue_share_corporate", +((direct * 0.28) / gdp).toFixed(5), "share of GDP", "medium", src + "; 28% of direct taxes imputed as corporate"),
  e("fiscal.revenue_share_capital", +((direct * 0.10) / gdp).toFixed(5), "share of GDP", "medium", src + "; 10% of direct taxes imputed as capital"),
  e("fiscal.revenue_share_vat", +((indirect * 0.78) / gdp).toFixed(5), "share of GDP", "medium", src + "; 78% of indirect taxes imputed as VAT"),
  e("fiscal.revenue_share_customs", +(((indirect * 0.22) + other) / gdp).toFixed(5), "share of GDP", "medium", src + "; customs+excise+other revenue bucket"),
  e("fiscal.non_ministry_spend_annual", nonMinistrySpend, "₪M/yr", "medium", src + "; expenditure excl. financing minus mapped ministries (pensions, Knesset, local-authority grants, reserves, development)"),
  e("fiscal.yield_base", 0.02, "fraction/yr", "placeholder", "invented, needs real data (fit to BoI yield history)", { ci: [0.01, 0.03] }),
  e("fiscal.yield_beta_debt", 0.03, "Δyield per unit debt/GDP", "placeholder", "invented, needs real data (sovereign-spread literature)", { ci: [0.01, 0.06] }),
  e("fiscal.yield_beta_deficit", 0.15, "Δyield per unit deficit/GDP", "placeholder", "invented, needs real data (sovereign-spread literature)", { ci: [0.05, 0.35] }),
  e("fiscal.debt_repricing_quarterly", 0.03, "fraction of stock repricing to market yield per quarter", "placeholder", "invented, needs real data (MoF debt maturity profile)", { ci: [0.02, 0.06] }),
  e("fiscal.rating_debt_coef", 10, "rating notches (0-20) per unit debt/GDP", "placeholder", "invented, needs real data (rating-agency methodology studies)"),
  e("fiscal.rating_deficit_coef", 40, "rating notches (0-20) per unit deficit/GDP", "placeholder", "invented, needs real data (rating-agency methodology studies)"),
  e("fiscal.rating_adjust_quarterly", 0.1, "fraction of gap to implied rating closed per quarter", "placeholder", "invented, needs real data"),
];
writeFileSync(join(dataRoot, "constants", "fiscal.json"), JSON.stringify(fiscalConstants, null, 1));
console.log("regenerated constants/fiscal.json");
console.log(JSON.stringify({ baselines, nonMinistrySpend, revenue: out.revenue_ils_m }, null, 1));
