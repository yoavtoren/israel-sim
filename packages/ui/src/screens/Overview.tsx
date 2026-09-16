/** Overview: headline KPIs, macro small-multiples, coalition strip, event feed. */

import { useMemo } from "react";
import { useStore } from "../store";
import { t } from "../lib/strings";
import { fmtBudget, fmtPct, fmtQuarter } from "../lib/format";
import { DOMAIN, INK, SEM } from "../lib/colors";
import { GaugeBar, Num, Panel, Sparkline } from "../components/ui";
import { Traceable } from "../components/CausalTrace";
import { SeriesChart, type ChartRow } from "../components/SeriesChart";

export function Overview() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const frames = useStore((s) => s.frames);
  const feed = useStore((s) => s.feed);

  const rows: ChartRow[] = useMemo(
    () =>
      frames.map((f) => ({
        x: fmtQuarter(f.year, f.quarter),
        gdp: f.gdp_real / 1000,
        potential: f.gdp_potential / 1000,
        debt: f.debt_gdp * 100,
        unemployment: f.unemployment * 100,
        participation: f.participation * 100,
        inflation: f.inflation * 100,
        deficit: (f.deficit / f.gdp_real) * 100,
        poverty: f.poverty_rate * 100,
        cohesion: f.cohesion * 100,
        stability: f.stability * 100,
      })),
    [frames],
  );

  if (state === null || frames.length === 0) return null;
  const now = frames[frames.length - 1];

  const yearAgo = frames[Math.max(0, frames.length - 5)];
  const tail = frames.slice(-16);

  const kpis: Array<{ label: string; value: string; raw: number; dir: number; path: string; pick: (f: typeof now) => number; fmtDelta: (d: number) => string }> = [
    { label: t("gdp", lang), value: fmtBudget(now.gdp_real, 0), raw: now.gdp_real, dir: 1, path: "macro.gdp_real", pick: (f) => f.gdp_real, fmtDelta: (d) => `${d > 0 ? "+" : ""}${((d / yearAgo.gdp_real) * 100).toFixed(1)}%` },
    { label: t("debtGdp", lang), value: fmtPct(now.debt_gdp, 1), raw: now.debt_gdp, dir: -1, path: "macro.debt_gdp", pick: (f) => f.debt_gdp, fmtDelta: pp },
    { label: t("unemployment", lang), value: fmtPct(now.unemployment, 2), raw: now.unemployment, dir: -1, path: "macro.unemployment", pick: (f) => f.unemployment, fmtDelta: pp },
    { label: t("inflation", lang), value: fmtPct(now.inflation, 1), raw: now.inflation, dir: -1, path: "macro.inflation", pick: (f) => f.inflation, fmtDelta: pp },
    { label: t("deficit", lang), value: fmtPct(now.deficit / now.gdp_real, 1), raw: now.deficit, dir: -1, path: "fiscal.deficit", pick: (f) => f.deficit / f.gdp_real, fmtDelta: pp },
    { label: t("poverty", lang), value: fmtPct(now.poverty_rate, 1), raw: now.poverty_rate, dir: -1, path: "macro.poverty_rate", pick: (f) => f.poverty_rate, fmtDelta: pp },
    { label: t("rating", lang), value: now.credit_rating.toFixed(1), raw: now.credit_rating, dir: 1, path: "macro.credit_rating", pick: (f) => f.credit_rating, fmtDelta: (d) => `${d > 0 ? "+" : ""}${d.toFixed(1)}` },
    { label: t("participation", lang), value: fmtPct(now.participation, 1), raw: now.participation, dir: 1, path: "macro.participation", pick: (f) => f.participation, fmtDelta: pp },
  ];

  const stabilityTone = now.stability < 0.25 ? SEM.bad : now.stability < 0.4 ? SEM.warn : SEM.good;
  const yoyLabel = lang === "he" ? "מול שנה קודמת" : "vs. a year ago";

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      {/* KPI cards: value, year-on-year change, a quiet 4-year trace */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const series = tail.map(k.pick);
          const delta = k.pick(now) - k.pick(yearAgo);
          const flat = Math.abs(delta) < 1e-9 || frames.length < 2;
          const good = Math.sign(delta) === Math.sign(k.dir);
          return (
            <div key={k.path} className="panel flex flex-col gap-1 px-5 pt-4 pb-3">
              <div className="eyebrow !text-[12.5px]">{k.label}</div>
              <div className="flex items-end justify-between gap-3">
                <Traceable path={k.path}>
                  <Num value={k.value} raw={k.raw} direction={k.dir} className="text-[26px] leading-[34px] font-medium tracking-tight" />
                </Traceable>
                <Sparkline values={series} width={88} height={28} color={flat ? INK.fg2 : good ? SEM.good : SEM.bad} />
              </div>
              <div className="flex items-center gap-1.5 text-[12px] leading-[18px] text-fg2">
                {flat ? (
                  <span>{lang === "he" ? "ללא שינוי" : "No change"}</span>
                ) : (
                  <>
                    <span
                      className={`num inline-flex items-center rounded-full px-2 text-[11.5px] font-medium ${good ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}
                    >
                      {delta > 0 ? "▲" : "▼"} {k.fmtDelta(delta)}
                    </span>
                    <span>{yoyLabel}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title={`${t("gdp", lang)} (₪B)`} accent={DOMAIN.macro}>
          <SeriesChart
            data={rows}
            series={[
              { key: "gdp", name: lang === "he" ? "תוצר בפועל" : "Actual", color: DOMAIN.macro },
              { key: "potential", name: lang === "he" ? "תוצר פוטנציאלי" : "Potential", color: SEM.info, dash: true },
            ]}
            format={(v) => v.toFixed(0)}
            height={190}
          />
        </Panel>
        <Panel title={`${t("debtGdp", lang)} (%)`} accent={DOMAIN.fiscal}>
          <SeriesChart data={rows} series={[{ key: "debt", name: t("debtGdp", lang), color: DOMAIN.fiscal }]} format={(v) => v.toFixed(0)} height={190} />
        </Panel>
        <Panel title={`${t("unemployment", lang)} · ${t("participation", lang)} (%)`} accent={DOMAIN.macro}>
          <SeriesChart
            data={rows}
            series={[
              { key: "unemployment", name: t("unemployment", lang), color: SEM.bad },
              { key: "participation", name: t("participation", lang), color: DOMAIN.macro },
            ]}
            format={(v) => v.toFixed(1)}
            height={190}
          />
        </Panel>
        <Panel title={`${t("poverty", lang)} · ${t("cohesion", lang)} (%)`} accent={DOMAIN.social}>
          <SeriesChart
            data={rows}
            series={[
              { key: "poverty", name: t("poverty", lang), color: DOMAIN.social },
              { key: "cohesion", name: t("cohesion", lang), color: SEM.info },
            ]}
            format={(v) => v.toFixed(0)}
            height={190}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* coalition strip */}
        <Panel title={t("stability", lang)} accent={DOMAIN.social}>
          <div className="flex items-center gap-5">
            <Traceable path="politics.coalition.stability">
              <Num value={fmtPct(now.stability, 0)} raw={now.stability} direction={1} className="text-[34px] leading-[40px] font-medium tracking-tight" />
            </Traceable>
            <div className="flex flex-1 flex-col gap-1.5">
              <GaugeBar value={now.stability} tick={0.15} color={stabilityTone} height={10} />
              <span className="text-[12px] leading-[18px] text-fg2">
                {t("coalitionSeats", lang)}: <span className="num font-medium text-fg0">{state.politics.coalition.seats}</span>
                <span className="num">/120</span>
              </span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat label={t("trust", lang)} value={fmtPct(now.trust, 0)} />
            <MiniStat label={t("protest", lang)} value={fmtPct(now.protest, 0)} />
            <MiniStat label={t("cwp", lang)} value={fmtPct(now.civil_war_pressure, 0)} alarm={now.civil_war_pressure > 0.5} />
          </div>
        </Panel>

        {/* event feed */}
        <Panel title={t("eventTicker", lang)} accent={DOMAIN.diplomacy}>
          <EventFeed feed={feed} lang={lang} limit={40} />
        </Panel>
      </div>
    </div>
  );
}

const pp = (d: number): string => `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)}pp`;

function MiniStat(props: { label: string; value: string; alarm?: boolean }) {
  return (
    <div className={`rounded-[10px] px-3 py-2 ${props.alarm === true ? "bg-bad-dim" : "bg-bg2"}`}>
      <div className="text-[12px] leading-[18px] text-fg1">{props.label}</div>
      <div className={`num text-[17px] leading-[24px] font-medium ${props.alarm === true ? "text-bad-bright" : "text-fg0"}`}>{props.value}</div>
    </div>
  );
}

/** Quarter-stamped event list shared by the overview and the security board. */
export function EventFeed(props: { feed: Array<{ year: number; quarter: number; id: string; count: number; note?: string }>; lang: "he" | "en"; limit?: number; maxHeight?: string }) {
  const items = [...props.feed].reverse().slice(0, props.limit ?? props.feed.length);
  if (items.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-[10px] bg-bg2 text-[13px] text-fg2">
        {props.lang === "he" ? "רבעון שקט — אין אירועים" : "A quiet quarter — no events"}
      </div>
    );
  }
  return (
    <ul className={`${props.maxHeight ?? "max-h-52"} -mx-2 overflow-y-auto`}>
      {items.map((e, i) => (
        <li key={i} className="flex items-center gap-3 rounded-[8px] px-2 py-1.5 text-[13px] leading-[20px] hover:bg-bg2" title={e.note}>
          <span className="num shrink-0 rounded-full bg-bg3 px-2 text-[11.5px] leading-[18px] text-fg1">{fmtQuarter(e.year, e.quarter)}</span>
          <span className="min-w-0 truncate text-fg0" dir="ltr">
            {e.id.replace(/_/g, " ")}
          </span>
          {e.count > 1 && <span className="num shrink-0 text-[12px] text-fg2">×{e.count}</span>}
        </li>
      ))}
    </ul>
  );
}
