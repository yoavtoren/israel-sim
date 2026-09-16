/** History & comparison — real 2000–2025 series (BoI/MoF/NII/Shabak, see the
 *  history sidecars) with the simulation continuing on the same axes from 2026,
 *  so the run can be compared against actual past situations. GDP is compared
 *  as annual growth (the chained index and the sim level are different units).
 */

import { useMemo } from "react";
import type { SectorId } from "@engine";
import { useStore } from "../store";
import { incidentsHistory, macroHistory, participationHistory } from "../data";
import { t } from "../lib/strings";
import { DOMAIN, SECTOR_COLORS, SEM } from "../lib/colors";
import { Panel } from "../components/ui";
import { SeriesChart, type ChartRow, type Episode } from "../components/SeriesChart";
import type { HistoryFrame } from "../sim/types";

const EPISODES_HE: Episode[] = [
  { from: "2001", to: "2004", label: "אינתיפאדה שנייה" },
  { from: "2008", to: "2009", label: "משבר פיננסי" },
  { from: "2020", to: "2021", label: "קורונה" },
  { from: "2023", to: "2024", label: "חרבות ברזל" },
];
const EPISODES_EN: Episode[] = [
  { from: "2001", to: "2004", label: "Second Intifada" },
  { from: "2008", to: "2009", label: "Financial crisis" },
  { from: "2020", to: "2021", label: "COVID" },
  { from: "2023", to: "2024", label: "2023–24 war" },
];

interface SimYear {
  year: number;
  gdp_growth: number | null;
  unemployment: number;
  debt_gdp: number;
  poverty: number;
  terror: number;
  protests: number;
  sectors: Record<SectorId, { men: number; women: number }>;
}

/** annual means of the sim run, growth from year-mean GDP */
function annualizeSim(frames: HistoryFrame[], feed: Array<{ year: number; id: string; count: number }>): SimYear[] {
  const byYear = new Map<number, HistoryFrame[]>();
  for (const f of frames) {
    const list = byYear.get(f.year) ?? [];
    list.push(f);
    byYear.set(f.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const out: SimYear[] = [];
  let prevGdp: number | null = null;
  for (const y of years) {
    const fs = byYear.get(y) ?? [];
    const gdp = mean(fs.map((f) => f.gdp_real));
    const sectors = {} as SimYear["sectors"];
    const last = fs[fs.length - 1];
    for (const id of Object.keys(last.sectors) as SectorId[]) {
      sectors[id] = { men: last.sectors[id].participation_men, women: last.sectors[id].participation_women };
    }
    out.push({
      year: y,
      gdp_growth: prevGdp !== null && fs.length === 4 ? gdp / prevGdp - 1 : null,
      unemployment: mean(fs.map((f) => f.unemployment)),
      debt_gdp: mean(fs.map((f) => f.debt_gdp)),
      poverty: mean(fs.map((f) => f.poverty_rate)),
      terror: feed.filter((e) => e.year === y && e.id.includes("terror")).reduce((a, e) => a + e.count, 0),
      protests: feed.filter((e) => e.year === y && e.id.includes("protest")).reduce((a, e) => a + e.count, 0),
      sectors,
    });
    prevGdp = fs.length === 4 ? gdp : null;
  }
  return out;
}

export function History() {
  const lang = useStore((s) => s.lang);
  const frames = useStore((s) => s.frames);
  const feed = useStore((s) => s.feed);

  const sim = useMemo(() => annualizeSim(frames, feed), [frames, feed]);
  const episodes = lang === "he" ? EPISODES_HE : EPISODES_EN;
  const actualName = lang === "he" ? "בפועל (היסטורי)" : "Actual (history)";
  const simName = lang === "he" ? "סימולציה" : "Simulation";

  const rows: ChartRow[] = useMemo(() => {
    const out: ChartRow[] = [];
    for (let i = 0; i < macroHistory.length; i++) {
      const h = macroHistory[i];
      const prev = macroHistory[i - 1];
      const inc = incidentsHistory.years.indexOf(h.year);
      out.push({
        x: String(h.year),
        growth_a: prev !== undefined ? (h.real_gdp_index / prev.real_gdp_index - 1) * 100 : (null as unknown as number),
        unemp_a: h.unemployment * 100,
        debt_a: h.debt_gdp * 100,
        poverty_a: h.poverty * 100,
        terror_a: inc >= 0 ? incidentsHistory.fatal_terror_attacks[inc] : (null as unknown as number),
        protest_a: inc >= 0 ? incidentsHistory.major_protest_waves[inc] : (null as unknown as number),
      });
    }
    for (const s of sim) {
      out.push({
        x: String(s.year),
        growth_s: s.gdp_growth !== null ? s.gdp_growth * 100 : (null as unknown as number),
        unemp_s: s.unemployment * 100,
        debt_s: s.debt_gdp * 100,
        poverty_s: s.poverty * 100,
        terror_s: s.terror,
        protest_s: s.protests,
      });
    }
    return out;
  }, [sim]);

  const partRows = useMemo(() => {
    const out: Record<"men" | "women", ChartRow[]> = { men: [], women: [] };
    const years = new Set<number>([...participationHistory.years, ...sim.map((s) => s.year)]);
    for (const y of [...years].sort((a, b) => a - b)) {
      const hIdx = participationHistory.years.indexOf(y);
      const s = sim.find((r) => r.year === y);
      for (const g of ["men", "women"] as const) {
        const row: ChartRow = { x: String(y) };
        for (const sec of ["secular", "national_religious", "haredi", "arab"] as const) {
          const hs = participationHistory.series[`${sec}_${g}`];
          if (hIdx >= 0 && hs !== undefined) row[`${sec}_a`] = hs[hIdx] * 100;
          if (s !== undefined) row[`${sec}_s`] = s.sectors[sec][g] * 100;
        }
        out[g].push(row);
      }
    }
    return out;
  }, [sim]);

  const pair = (key: string, name: string, color: string) => [
    { key: `${key}_a`, name: `${name} — ${actualName}`, color },
    { key: `${key}_s`, name: `${name} — ${simName}`, color: SEM.info, dash: true },
  ];

  const pct1 = (v: number) => `${v.toFixed(1)}`;
  const int0 = (v: number) => v.toFixed(0);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <div className="flex flex-col gap-1.5 px-1 pt-1">
        <h1 className="display text-[26px] leading-[34px] text-fg0">{lang === "he" ? "איך הריצה שלכם נראית מול העבר" : "How your run compares with the past"}</h1>
        <p className="max-w-[860px] text-[14px] leading-[22px] text-fg1">
        {lang === "he"
          ? "סדרות אמת 2000–2025 (בנק ישראל, החשב הכללי, ביטוח לאומי, שב\"כ — מקורות בקבצי sidecar); הסימולציה נמשכת מ-2026 באותם צירים. תוצר מושווה כצמיחה שנתית — לא כרמה."
          : "Real 2000–2025 series (BoI, Accountant General, NII, Shabak — sources in the sidecars); the simulation continues from 2026 on the same axes. GDP compared as annual growth, not level."}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-fg1">
          <span className="flex items-center gap-2">
            <span className="inline-block h-0 w-5 border-t-[2.5px] border-fg1" />
            {actualName}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-0 w-5 border-t-[2.5px] border-dotted border-info" />
            {simName}
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block h-3 w-5 rounded-[3px] bg-[#EFE9DE]" />
            {lang === "he" ? "אירועים היסטוריים" : "Historical episodes"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title={`${lang === "he" ? "צמיחת תוצר שנתית" : "Annual GDP growth"} (%)`} accent={DOMAIN.macro}>
          <SeriesChart data={rows} episodes={episodes} series={pair("growth", lang === "he" ? "צמיחה" : "Growth", DOMAIN.macro)} format={pct1} height={200} />
        </Panel>
        <Panel title={`${t("unemployment", lang)} (%)`} accent={DOMAIN.macro}>
          <SeriesChart data={rows} episodes={episodes} series={pair("unemp", t("unemployment", lang), SEM.badBright)} format={pct1} height={200} />
        </Panel>
        <Panel title={`${t("debtGdp", lang)} (%)`} accent={DOMAIN.fiscal}>
          <SeriesChart data={rows} episodes={episodes} series={pair("debt", t("debtGdp", lang), DOMAIN.fiscal)} format={int0} height={200} />
        </Panel>
        <Panel title={`${t("poverty", lang)} (%)`} accent={DOMAIN.social}>
          <SeriesChart data={rows} episodes={episodes} series={pair("poverty", t("poverty", lang), DOMAIN.social)} format={pct1} height={200} />
        </Panel>
        <Panel title={lang === "he" ? "פיגועים קטלניים בשנה" : "Fatal terror attacks / year"} accent={DOMAIN.security}>
          <SeriesChart data={rows} episodes={episodes} series={pair("terror", lang === "he" ? "פיגועים" : "Attacks", DOMAIN.security)} format={int0} height={200} />
        </Panel>
        <Panel title={lang === "he" ? "גלי מחאה גדולים בשנה" : "Major protest waves / year"} accent={DOMAIN.social}>
          <SeriesChart data={rows} episodes={episodes} series={pair("protest", lang === "he" ? "גלי מחאה" : "Protest waves", DOMAIN.diplomacy)} format={int0} height={200} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(["men", "women"] as const).map((g) => (
          <Panel key={g} title={`${t("participation", lang)} — ${g === "men" ? (lang === "he" ? "גברים" : "Men") : lang === "he" ? "נשים" : "Women"} (%)`} accent={DOMAIN.social}>
            <SeriesChart
              data={partRows[g]}
              connectNulls
              series={(["secular", "national_religious", "haredi", "arab"] as const).flatMap((sec) => [
                { key: `${sec}_a`, name: lang === "he" ? { secular: "חילוני", national_religious: "דתי-לאומי", haredi: "חרדי", arab: "ערבי" }[sec] : sec, color: SECTOR_COLORS[sec] },
                { key: `${sec}_s`, name: `${lang === "he" ? "סימ׳" : "sim"} ${sec}`, color: SECTOR_COLORS[sec], dash: true },
              ])}
              format={int0}
              height={210}
            />
          </Panel>
        ))}
      </div>

      {/* the detailed year-by-year table */}
      <Panel title={lang === "he" ? "טבלה מפורטת, שנה אחר שנה" : "Detailed year-by-year table"} accent={DOMAIN.macro}>
        <div className="-mx-5 max-h-[440px] overflow-y-auto">
          <table className="w-full text-[13px] leading-[20px]">
            <thead className="sticky top-0 z-10 bg-bg1/95 backdrop-blur">
              <tr className="border-b border-line0">
                <th className="eyebrow py-2 ps-5 pe-3 text-start font-medium">{lang === "he" ? "שנה" : "Year"}</th>
                <th className="eyebrow px-3 py-2 text-end font-medium">{lang === "he" ? "צמיחה" : "Growth"}</th>
                <th className="eyebrow px-3 py-2 text-end font-medium">{t("unemployment", lang)}</th>
                <th className="eyebrow px-3 py-2 text-end font-medium">{t("debtGdp", lang)}</th>
                <th className="eyebrow px-3 py-2 text-end font-medium">{t("poverty", lang)}</th>
                <th className="eyebrow px-3 py-2 text-end font-medium">{lang === "he" ? "פיגועים" : "Terror"}</th>
                <th className="eyebrow py-2 ps-3 pe-5 text-end font-medium">{lang === "he" ? "מחאות" : "Protests"}</th>
              </tr>
            </thead>
            <tbody>
              {macroHistory.map((h, i) => {
                const prev = macroHistory[i - 1];
                const inc = incidentsHistory.years.indexOf(h.year);
                return (
                  <HRow
                    key={h.year}
                    year={String(h.year)}
                    growth={prev !== undefined ? `${((h.real_gdp_index / prev.real_gdp_index - 1) * 100).toFixed(1)}%` : "—"}
                    unemp={`${(h.unemployment * 100).toFixed(1)}%`}
                    debt={`${(h.debt_gdp * 100).toFixed(0)}%`}
                    poverty={`${(h.poverty * 100).toFixed(1)}%`}
                    terror={inc >= 0 ? String(incidentsHistory.fatal_terror_attacks[inc]) : "—"}
                    protests={inc >= 0 ? String(incidentsHistory.major_protest_waves[inc]) : "—"}
                  />
                );
              })}
              {sim.map((s) => (
                <HRow
                  key={`sim-${s.year}`}
                  sim
                  year={`${s.year} ·${lang === "he" ? " סימ׳" : " sim"}`}
                  growth={s.gdp_growth !== null ? `${(s.gdp_growth * 100).toFixed(1)}%` : "—"}
                  unemp={`${(s.unemployment * 100).toFixed(1)}%`}
                  debt={`${(s.debt_gdp * 100).toFixed(0)}%`}
                  poverty={`${(s.poverty * 100).toFixed(1)}%`}
                  terror={String(s.terror)}
                  protests={String(s.protests)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function HRow(props: { year: string; growth: string; unemp: string; debt: string; poverty: string; terror: string; protests: string; sim?: boolean }) {
  return (
    <tr className={`border-b border-line0 last:border-0 ${props.sim === true ? "bg-info-dim/50 text-info-bright hover:bg-info-dim" : "text-fg0 hover:bg-bg2"}`}>
      <td className={`num py-1.5 ps-5 pe-3 ${props.sim === true ? "font-medium" : "text-fg1"}`}>{props.year}</td>
      <td className="num px-3 py-1.5 text-end">{props.growth}</td>
      <td className="num px-3 py-1.5 text-end">{props.unemp}</td>
      <td className="num px-3 py-1.5 text-end">{props.debt}</td>
      <td className="num px-3 py-1.5 text-end">{props.poverty}</td>
      <td className="num px-3 py-1.5 text-end">{props.terror}</td>
      <td className="num py-1.5 ps-3 pe-5 text-end">{props.protests}</td>
    </tr>
  );
}
