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
import { DOMAIN, INK, SECTOR_COLORS, SEM } from "../lib/colors";
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

  return (
    <div className="flex flex-col gap-4">
      <Panel title={t("maturing20y", lang)} accent={DOMAIN.fiscal}>
        {state.pipeline.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-fg2">
            {lang === "he" ? "אין השקעות תלויות — תקציבים משנים זרמים, זרמים ממלאים מלאים לאט" : "No pending effects yet"}
          </div>
        ) : (
          <bdi dir="ltr" className="block">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={INK.line0} vertical={false} />
                  <XAxis dataKey="x" tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: INK.line1 }} tickLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: INK.fg2, fontSize: 11, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => fmtCompact(v, 0)} />
                  <Tooltip
                    content={(p: TooltipProps<number, string>) =>
                      p.active === true && p.payload !== undefined && p.payload.length > 0 ? (
                        <div className="overlay rounded-[4px] border border-line1 bg-bg2 px-2 py-1 text-[12px]">
                          <div className="num mb-0.5 text-fg2">{String(p.label)}</div>
                          {p.payload.map((row) => (
                            <div key={String(row.dataKey)} className="flex items-center gap-2">
                              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: String(row.color) }} />
                              <span className="text-fg1">{groupName(String(row.dataKey))}</span>
                              <span className="num ms-auto">{fmtCompact(Number(row.value), 1)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null
                    }
                  />
                  {groups.map((g, i) => (
                    <Area key={g} dataKey={g} stackId="1" stroke={PIPE_COLORS[i % PIPE_COLORS.length]} fill={PIPE_COLORS[i % PIPE_COLORS.length]} fillOpacity={0.35} isAnimationActive={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </bdi>
        )}
        {groups.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-3 px-1">
            {groups.map((g, i) => (
              <span key={g} className="flex items-center gap-1.5 text-[11px] text-fg1">
                <span className="inline-block h-2 w-3 rounded-[1px]" style={{ background: PIPE_COLORS[i % PIPE_COLORS.length] }} />
                {groupName(g)}
              </span>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        <Panel title={t("largestPending", lang)} accent={DOMAIN.fiscal}>
          <table className="w-full text-[12px] leading-[16px]">
            <tbody>
              {largest.map((p, i) => (
                <tr key={i} className="border-b border-line0/50 last:border-0">
                  <td className="py-1.5 pe-2 text-fg1">{p.ministry !== null ? MINISTRY_NAMES[p.ministry][lang] : p.decision}</td>
                  <td className="num max-w-[200px] truncate py-1.5 pe-2 text-fg2" title={p.target}>{p.target}</td>
                  <td className="num py-1.5 text-end">{fmtSigned(p.pending, 2)}</td>
                </tr>
              ))}
              {largest.length === 0 && (
                <tr><td className="py-2 text-fg2">—</td></tr>
              )}
            </tbody>
          </table>
        </Panel>

        <Panel title={t("cancelRisk", lang)} accent={DOMAIN.security}>
          {cancelRisk.length === 0 ? (
            <div className="text-[12px] text-good-bright">
              {lang === "he" ? "אין השקעות בסיכון ביטול במימון הנוכחי" : "Nothing at cancel risk at current funding"}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {cancelRisk.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-[2px] border border-warn-dim bg-bg2 p-2 text-[12px]">
                  <span className="text-fg1">
                    {p.ministry !== null ? MINISTRY_NAMES[p.ministry][lang] : p.decision} → <span className="num">{p.target}</span>
                  </span>
                  <Chip tone="warn">
                    {lang === "he" ? "מתבטל מתחת" : "decays below"} <span className="num">{(p.decays_if?.ministry_funding_below ?? 0).toFixed(2)}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 border-t border-line0 pt-2 text-[11px] leading-[16px] text-fg2" style={{ color: SEM.warn }}>
            {lang === "he"
              ? "קיצוץ מאוחר מבטל את היתרה שלא נמסרה — היא אינה מוחזרת (spec §7)"
              : "A later cut cancels the undelivered remainder — it is not refunded (spec §7)"}
          </div>
        </Panel>
      </div>
    </div>
  );
}
