/** Post-mortem — CONTRACT C6: catastrophic branches report human cost in explicit
 *  numbers, next to a zero-change counterfactual replay of the same seed.
 */

import { useMemo } from "react";
import { useStore } from "../store";
import { t } from "../lib/strings";
import { fmtBudget, fmtInt, fmtPct, fmtQuarter } from "../lib/format";
import { DOMAIN, SEM } from "../lib/colors";
import { Panel } from "../components/ui";
import { SeriesChart, type ChartRow } from "../components/SeriesChart";
import type { HistoryFrame } from "../sim/types";

export function PostMortem() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const frames = useStore((s) => s.frames);
  const counterfactual = useStore((s) => s.counterfactual);
  const boot = useStore((s) => s.boot);
  const seed = useStore((s) => s.seed);
  const busy = useStore((s) => s.busy);

  const gdpRows = useMemo(() => mergeRows(frames, counterfactual, (f) => f.gdp_real / 1000), [frames, counterfactual]);
  const debtRows = useMemo(() => mergeRows(frames, counterfactual, (f) => f.debt_gdp * 100), [frames, counterfactual]);
  const povertyRows = useMemo(() => mergeRows(frames, counterfactual, (f) => f.poverty_rate * 100), [frames, counterfactual]);

  if (state === null || frames.length === 0) return null;
  const now = frames[frames.length - 1];
  const cf = counterfactual !== null && counterfactual.length > 0 ? counterfactual[counterfactual.length - 1] : null;
  const ended = state.outcome.ended;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="panel overflow-hidden">
        <div className="h-1.5 w-full" style={{ background: ended ? SEM.bad : SEM.warn }} />
        <div className="px-7 pt-6 pb-6">
        <div className="eyebrow mb-1 !text-[12.5px]">{lang === "he" ? "סיכום הריצה" : "Run summary"}</div>
        {/* 32/40 verdict type — the only place it's allowed (DESIGN §3) */}
        <div className="display text-[34px] leading-[42px]" style={{ color: ended ? SEM.badBright : SEM.warnBright }}>
          {ended ? (state.outcome.kind ?? "") : lang === "he" ? "הריצה נמשכת" : "Run in progress"}
        </div>
        {state.outcome.note !== null && (
          <p className="mt-3 max-w-3xl text-[15px] leading-[24px] text-fg1">{state.outcome.note}</p>
        )}
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-t border-line0 pt-4">
          <Verdict label={t("casualties", lang)} value={fmtInt(now.war_casualties)} bad={now.war_casualties > 0} />
          <Verdict label={t("gdp", lang)} value={fmtBudget(now.gdp_real, 0)} />
          <Verdict label={t("debtGdp", lang)} value={fmtPct(now.debt_gdp, 0)} />
          <Verdict label={t("poverty", lang)} value={fmtPct(now.poverty_rate, 1)} />
          <Verdict label={t("cwp", lang)} value={fmtPct(now.civil_war_pressure, 0)} />
          <span className="ms-auto self-end text-[12px] text-fg2">
            <span className="num">{fmtQuarter(frames[0].year, frames[0].quarter)} → {fmtQuarter(now.year, now.quarter)}</span> · {t("seed", lang)}{" "}
            <span className="num">{seed}</span>
          </span>
        </div>
        </div>
      </div>

      {cf !== null && (
        <Panel title={t("vsNoChange", lang)} accent={DOMAIN.macro}>
          <table className="w-full text-[14px] leading-[22px]">
            <thead>
              <tr className="border-b border-line0">
                <th className="eyebrow pb-2 text-start font-medium"></th>
                <th className="eyebrow pb-2 text-end font-medium">{lang === "he" ? "בפועל" : "Actual"}</th>
                <th className="eyebrow pb-2 text-end font-medium">{lang === "he" ? "ללא שינוי" : "No-change"}</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow label={t("gdp", lang)} a={fmtBudget(now.gdp_real, 0)} b={fmtBudget(cf.gdp_real, 0)} />
              <CompareRow label={t("debtGdp", lang)} a={fmtPct(now.debt_gdp, 1)} b={fmtPct(cf.debt_gdp, 1)} />
              <CompareRow label={t("poverty", lang)} a={fmtPct(now.poverty_rate, 1)} b={fmtPct(cf.poverty_rate, 1)} />
              <CompareRow label={t("unemployment", lang)} a={fmtPct(now.unemployment, 2)} b={fmtPct(cf.unemployment, 2)} />
              <CompareRow label={t("casualties", lang)} a={fmtInt(now.war_casualties)} b={fmtInt(cf.war_casualties)} />
              <CompareRow label={t("cohesion", lang)} a={fmtPct(now.cohesion, 0)} b={fmtPct(cf.cohesion, 0)} />
            </tbody>
          </table>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5">
        <Panel title={`${t("gdp", lang)} (₪B) — ${t("vsNoChange", lang)}`} accent={DOMAIN.macro}>
          <SeriesChart
            data={gdpRows}
            series={[
              { key: "actual", name: lang === "he" ? "בפועל" : "Actual", color: DOMAIN.macro },
              { key: "cf", name: lang === "he" ? "ללא שינוי" : "No-change", color: SEM.info, dash: true },
            ]}
            format={(v) => v.toFixed(0)}
          />
        </Panel>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Panel title={`${t("debtGdp", lang)} (%)`} accent={DOMAIN.fiscal}>
            <SeriesChart
              data={debtRows}
              series={[
                { key: "actual", name: lang === "he" ? "בפועל" : "Actual", color: DOMAIN.fiscal },
                { key: "cf", name: lang === "he" ? "ללא שינוי" : "No-change", color: SEM.info, dash: true },
              ]}
              format={(v) => v.toFixed(0)}
            />
          </Panel>
          <Panel title={`${t("poverty", lang)} (%)`} accent={DOMAIN.social}>
            <SeriesChart
              data={povertyRows}
              series={[
                { key: "actual", name: lang === "he" ? "בפועל" : "Actual", color: DOMAIN.social },
                { key: "cf", name: lang === "he" ? "ללא שינוי" : "No-change", color: SEM.info, dash: true },
              ]}
              format={(v) => v.toFixed(1)}
            />
          </Panel>
        </div>
      </div>

      <div className="flex justify-center pb-6">
        <button
          type="button"
          disabled={busy}
          onClick={() => void boot(`${seed}-${frames.length}`)}
          className="btn btn-primary px-6 py-2.5 text-[14px]"
        >
          {t("newRun", lang)}
        </button>
      </div>
    </div>
  );
}

function Verdict(props: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[12.5px] leading-[18px] text-fg2">{props.label}</span>
      <span className={`num text-[22px] leading-[30px] font-medium ${props.bad === true ? "text-bad-bright" : "text-fg0"}`}>{props.value}</span>
    </div>
  );
}

function CompareRow(props: { label: string; a: string; b: string }) {
  return (
    <tr className="border-b border-line0 last:border-0 hover:bg-bg2">
      <td className="py-2 text-fg1">{props.label}</td>
      <td className="num py-2 text-end font-medium text-fg0">{props.a}</td>
      <td className="num py-2 text-end text-fg2">{props.b}</td>
    </tr>
  );
}

function mergeRows(
  frames: HistoryFrame[],
  cf: HistoryFrame[] | null,
  pick: (f: HistoryFrame) => number,
): ChartRow[] {
  return frames.map((f, i) => {
    const row: ChartRow = { x: fmtQuarter(f.year, f.quarter), actual: pick(f) };
    if (cf !== null && cf[i] !== undefined) row.cf = pick(cf[i]);
    return row;
  });
}
