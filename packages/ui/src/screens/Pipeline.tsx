/** The pipeline — "investments maturing" as a first-class panel (DESIGN §7):
 *  maturation horizon over 20 years grouped by ministry, cancel-risk flags where
 *  funding is near decays_below, and the largest pending effects.
 */

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { MinistryId } from "@engine";
import { useStore } from "../store";
import { MINISTRY_NAMES, t } from "../lib/strings";
import { fmtCompact, fmtSigned } from "../lib/format";
import { DOMAIN, INK, SECTOR_COLORS } from "../lib/colors";
import { Chip, Panel } from "../components/ui";

/** fixed categorical assignment: top ministries by pending magnitude, rest folded into "other" */
const PIPE_COLORS = [DOMAIN.fiscal, DOMAIN.infra, DOMAIN.macro, DOMAIN.social, SECTOR_COLORS.arab];

const HORIZON_Q = 80;

export function Pipeline() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);

  const { chartData, groups, largest, cancelRisk } = useMemo(() => {
    if (state === null) return { chartData: [], groups: [], largest: [], cancelRisk: [] };
    const byMinistry = new Map<string, number>();
    for (const p of state.pipeline) {
      const key = p.origin.ministry ?? "reform";
      const pending = p.remaining.reduce((a, b) => a + Math.abs(b), 0);
      byMinistry.set(key, (byMinistry.get(key) ?? 0) + pending);
    }
    const ranked = [...byMinistry.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, 4).map(([k]) => k);
    const groupOf = (m: string | null) => {
      const key = m ?? "reform";
      return top.includes(key) ? key : "other";
    };
    const groupIds = [...top, "other"];

    const rows: Array<Record<string, number | string>> = [];
    for (let q = 0; q < HORIZON_Q; q++) {
      const row: Record<string, number | string> = { x: `+${(q / 4).toFixed(0)}y` };
      for (const g of groupIds) row[g] = 0;
      rows.push(row);
    }
    for (const p of state.pipeline) {
      const g = groupOf(p.origin.ministry);
      for (let q = 0; q < Math.min(p.remaining.length, HORIZON_Q); q++) {
        rows[q][g] = Number(rows[q][g]) + Math.abs(p.remaining[q]);
      }
    }

    const largest = [...state.pipeline]
      .map((p) => ({
        ministry: p.origin.ministry,
        decision: p.origin.decision,
        target: p.target,
        magnitude: p.magnitude,
        pending: p.remaining.reduce((a, b) => a + Math.abs(b), 0),
        decays_if: p.decays_if,
      }))
      .sort((a, b) => Math.abs(b.pending) - Math.abs(a.pending))
      .slice(0, 12);

    const cancelRisk = largest.filter((p) => {
      if (p.decays_if === null || p.ministry === null) return false;
      const fr = state.fiscal.ministries[p.ministry].funding_ratio;
      return fr < p.decays_if.ministry_funding_below + 0.08;
    });

    return { chartData: rows, groups: groupIds, largest, cancelRisk };
  }, [state]);

  if (state === null) return null;

  const groupName = (g: string): string =>
    g === "other" ? t("otherMinistries", lang) : g === "reform" ? (lang === "he" ? "רפורמות" : "Reforms") : MINISTRY_NAMES[g as MinistryId][lang];

  const totalPending = largest.reduce((a, p) => a + Math.abs(p.pending), 0);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      <Panel title={t("maturing20y", lang)} accent={DOMAIN.fiscal}>
        {state.pipeline.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-[12px] bg-bg2 text-center">
            <span className="text-[14px] text-fg1">{lang === "he" ? "אין עדיין השקעות תלויות" : "No pending effects yet"}</span>
            <span className="text-[12.5px] text-fg2">
              {lang === "he" ? "תקציבים משנים זרמים, וזרמים ממלאים מלאים לאט" : "Budgets change flows; flows fill stocks slowly"}
            </span>
          </div>
        ) : (
          <bdi dir="ltr" className="block">
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                  <CartesianGrid stroke={INK.line0} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="x" tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "Rubik, system-ui, sans-serif" }} axisLine={{ stroke: INK.line1 }} tickLine={false} tickMargin={6} minTickGap={24} />
                  <YAxis tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "Rubik, system-ui, sans-serif" }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmtCompact(v, Math.abs(v) < 10 ? 1 : 0)} />
                  <Tooltip
                    cursor={{ stroke: INK.line1, strokeDasharray: "3 3" }}
                    content={(p: TooltipProps<number, string>) =>
                      p.active === true && p.payload !== undefined && p.payload.length > 0 ? (
                        <div className="overlay min-w-[160px] rounded-[10px] border border-line0 bg-bg1 px-3 py-2 text-[12px] leading-[18px]" dir={lang === "he" ? "rtl" : "ltr"}>
                          <div className="num mb-1 text-[11.5px] font-medium text-fg2">{String(p.label)}</div>
                          {p.payload.map((row) => (
                            <div key={String(row.dataKey)} className="flex items-center gap-2 py-px">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ background: String(row.color) }} />
                              <span className="text-fg1">{groupName(String(row.dataKey))}</span>
                              <span className="num ms-auto ps-3 font-medium text-fg0">{fmtCompact(Number(row.value), 1)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  {groups.map((g, i) => (
                    <Area
                      key={g}
                      type="monotone"
                      dataKey={g}
                      stackId="1"
                      stroke={PIPE_COLORS[i % PIPE_COLORS.length]}
                      strokeWidth={1.5}
                      fill={PIPE_COLORS[i % PIPE_COLORS.length]}
                      fillOpacity={0.28}
                      isAnimationActive={false}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </bdi>
        )}
        {state.pipeline.length > 0 && groups.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 px-1">
            {groups.map((g, i) => (
              <span key={g} className="flex items-center gap-1.5 text-[12.5px] text-fg1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PIPE_COLORS[i % PIPE_COLORS.length] }} />
                {groupName(g)}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={t("largestPending", lang)} accent={DOMAIN.fiscal}>
          {largest.length === 0 ? (
            <div className="rounded-[10px] bg-bg2 py-6 text-center text-[13px] text-fg2">{lang === "he" ? "הרשימה תתמלא כשהחלטות תקציב יתחילו להבשיל" : "Fills in as budget decisions start maturing"}</div>
          ) : (
            <table className="w-full text-[13px] leading-[20px]">
              <thead>
                <tr className="border-b border-line0">
                  <th className="eyebrow pb-2 text-start font-medium">{t("ministry", lang)}</th>
                  <th className="eyebrow pb-2 text-start font-medium">{lang === "he" ? "יעד" : "Target"}</th>
                  <th className="eyebrow pb-2 text-end font-medium">{lang === "he" ? "יתרה" : "Pending"}</th>
                </tr>
              </thead>
              <tbody>
                {largest.map((p, i) => (
                  <tr key={i} className="border-b border-line0 last:border-0 hover:bg-bg2">
                    <td className="py-2 pe-3 text-fg0">{p.ministry !== null ? MINISTRY_NAMES[p.ministry][lang] : p.decision}</td>
                    <td className="max-w-[220px] truncate py-2 pe-3 text-[12px] text-fg2" title={p.target} dir="ltr">
                      <span className="block truncate text-end">{p.target}</span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        <bdi dir="ltr" className="hidden w-20 sm:block">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg3">
                            <div className="h-full rounded-full bg-dom-fiscal" style={{ width: `${totalPending > 0 ? Math.min(100, (Math.abs(p.pending) / Math.abs(largest[0].pending)) * 100) : 0}%` }} />
                          </div>
                        </bdi>
                        <span className="num w-14 text-end font-medium text-fg0">{fmtSigned(p.pending, 2)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title={t("cancelRisk", lang)} accent={DOMAIN.security}>
          {cancelRisk.length === 0 ? (
            <div className="flex items-center gap-2 rounded-[10px] bg-good-dim/70 px-4 py-3 text-[13px] text-good-bright">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-good" />
              {lang === "he" ? "אין השקעות בסיכון ביטול במימון הנוכחי" : "Nothing at cancel risk at current funding"}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {cancelRisk.map((p, i) => (
                <li key={i} className="flex flex-col gap-1.5 rounded-[10px] bg-warn-dim/60 px-3 py-2.5 text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-fg0">{p.ministry !== null ? MINISTRY_NAMES[p.ministry][lang] : p.decision}</span>
                    <Chip tone="warn">
                      {lang === "he" ? "מתבטל מתחת" : "decays below"} <span className="num">{(p.decays_if?.ministry_funding_below ?? 0).toFixed(2)}</span>
                    </Chip>
                  </div>
                  <span className="truncate text-[12px] text-fg1" dir="ltr">
                    → {p.target}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-line0 pt-3 text-[12.5px] leading-[19px] text-fg1">
            {lang === "he"
              ? "קיצוץ מאוחר מבטל את היתרה שלא נמסרה — היא אינה מוחזרת."
              : "A later cut cancels the undelivered remainder — it is not refunded."}
            <span className="text-fg2"> (spec §7)</span>
          </p>
        </Panel>
      </div>
    </div>
  );
}
