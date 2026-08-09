/** Overview: headline KPIs, macro small-multiples, coalition strip, event feed. */

import { useMemo } from "react";
import { useStore } from "../store";
import { t } from "../lib/strings";
import { fmtBudget, fmtPct, fmtQuarter, fmtCompact } from "../lib/format";
import { DOMAIN, SEM } from "../lib/colors";
import { GaugeBar, Num, Panel } from "../components/ui";
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

  const kpis: Array<{ label: string; value: string; raw: number; dir: number; path: string }> = [
    { label: t("gdp", lang), value: fmtBudget(now.gdp_real, 0), raw: now.gdp_real, dir: 1, path: "macro.gdp_real" },
    { label: t("debtGdp", lang), value: fmtPct(now.debt_gdp, 1), raw: now.debt_gdp, dir: -1, path: "macro.debt_gdp" },
    { label: t("unemployment", lang), value: fmtPct(now.unemployment, 2), raw: now.unemployment, dir: -1, path: "macro.unemployment" },
    { label: t("inflation", lang), value: fmtPct(now.inflation, 1), raw: now.inflation, dir: -1, path: "macro.inflation" },
    { label: t("deficit", lang), value: fmtPct(now.deficit / now.gdp_real, 1), raw: now.deficit, dir: -1, path: "fiscal.deficit" },
    { label: t("poverty", lang), value: fmtPct(now.poverty_rate, 1), raw: now.poverty_rate, dir: -1, path: "macro.poverty_rate" },
    { label: t("rating", lang), value: now.credit_rating.toFixed(1), raw: now.credit_rating, dir: 1, path: "macro.credit_rating" },
    { label: t("participation", lang), value: fmtPct(now.participation, 1), raw: now.participation, dir: 1, path: "macro.participation" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 xl:grid-cols-8">
        {kpis.map((k) => (
          <div key={k.path} className="panel px-3 py-2">
            <div className="text-[11px] leading-[16px] text-fg2">{k.label}</div>
            <Traceable path={k.path}>
              <Num value={k.value} raw={k.raw} direction={k.dir} className="text-[18px] leading-[26px]" />
            </Traceable>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title={`${t("gdp", lang)} (₪B)`} accent={DOMAIN.macro}>
          <SeriesChart
            data={rows}
            series={[
              { key: "gdp", name: lang === "he" ? "תוצר בפועל" : "Actual", color: DOMAIN.macro },
              { key: "potential", name: lang === "he" ? "תוצר פוטנציאלי" : "Potential", color: SEM.info, dash: true },
            ]}
            format={(v) => v.toFixed(0)}
          />
        </Panel>
        <Panel title={`${t("debtGdp", lang)} (%)`} accent={DOMAIN.fiscal}>
          <SeriesChart data={rows} series={[{ key: "debt", name: t("debtGdp", lang), color: DOMAIN.fiscal }]} format={(v) => v.toFixed(0)} />
        </Panel>
        <Panel title={`${t("unemployment", lang)} · ${t("participation", lang)} (%)`} accent={DOMAIN.macro}>
          <SeriesChart
            data={rows}
            series={[
              { key: "unemployment", name: t("unemployment", lang), color: SEM.badBright },
              { key: "participation", name: t("participation", lang), color: DOMAIN.macro },
            ]}
            format={(v) => v.toFixed(1)}
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
          />
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* coalition strip */}
        <Panel title={t("stability", lang)} accent={DOMAIN.social}>
          <div className="flex items-center gap-4">
            <Traceable path="politics.coalition.stability">
              <Num value={fmtPct(now.stability, 0)} raw={now.stability} direction={1} className="text-[24px] leading-[32px]" />
            </Traceable>
            <div className="flex-1">
              <GaugeBar value={now.stability} tick={0.15} color={now.stability < 0.25 ? SEM.badBright : now.stability < 0.4 ? SEM.warnBright : SEM.good} height={10} />
            </div>
            <span className="text-[12px] text-fg1">
              {t("coalitionSeats", lang)}: <span className="num text-fg0">{state.politics.coalition.seats}</span>/120
            </span>
          </div>
          <div className="mt-3 flex gap-4 text-[12px] text-fg1">
            <span>
              {t("trust", lang)}: <span className="num text-fg0">{fmtPct(now.trust, 0)}</span>
            </span>
            <span>
              {t("protest", lang)}: <span className="num text-fg0">{fmtPct(now.protest, 0)}</span>
            </span>
            <span>
              {t("cwp", lang)}: <span className={`num ${now.civil_war_pressure > 0.5 ? "text-bad-bright" : "text-fg0"}`}>{fmtPct(now.civil_war_pressure, 0)}</span>
            </span>
          </div>
        </Panel>

        {/* event feed */}
        <Panel title={t("eventTicker", lang)} accent={DOMAIN.diplomacy}>
          <div className="max-h-44 overflow-y-auto">
            {feed.length === 0 ? (
              <div className="text-[12px] text-fg2">{lang === "he" ? "רבעון שקט" : "Quiet quarter"}</div>
            ) : (
              [...feed].reverse().slice(0, 40).map((e, i) => (
                <div key={i} className="flex gap-3 border-b border-line0/40 py-1 text-[12px] leading-[16px] last:border-0" title={e.note}>
                  <span className="num shrink-0 text-fg2">{fmtQuarter(e.year, e.quarter)}</span>
                  <span className="num text-fg1">
                    {e.id}
                    {e.count > 1 && <span className="text-fg2"> ×{e.count}</span>}
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
