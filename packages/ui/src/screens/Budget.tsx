/** Screen 1 — The Budget Chamber (DESIGN §6.1).
 *  Dense ministry table with editable proposals, a live fiscal strip, and the
 *  "מה יישבר" panel fed by the engine's shadow-tick preview (not hardcoded warnings).
 */

import { useMemo, useRef } from "react";
import type { MinistryId } from "@engine";
import { useStore, draftIsEmpty } from "../store";
import { MINISTRY_NAMES, t } from "../lib/strings";
import { fmtBudget, fmtSignedPct, fmtPct, deltaClass, fmtSigned } from "../lib/format";
import { DOMAIN, SEM } from "../lib/colors";
import { Chip, GaugeBar, Num, Sparkline } from "../components/ui";
import { Traceable } from "../components/CausalTrace";

export function Budget() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const meta = useStore((s) => s.meta);
  const frames = useStore((s) => s.frames);
  const draft = useStore((s) => s.draft);
  const setBudgetDraft = useStore((s) => s.setBudgetDraft);
  const preview = useStore((s) => s.preview);
  const previewBusy = useStore((s) => s.previewBusy);
  const advance = useStore((s) => s.advance);
  const busy = useStore((s) => s.busy);
  const clearDraft = useStore((s) => s.clearDraft);
  const rowRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const fundingHistory = useMemo(() => {
    const out = new Map<MinistryId, number[]>();
    if (meta === null) return out;
    const tail = frames.slice(-12);
    for (const m of meta.ministries) out.set(m.id, tail.map((f) => f.funding_ratio[m.id]));
    return out;
  }, [frames, meta]);

  if (state === null || meta === null) return null;

  const previewedDeficit = preview?.diffs.find((d) => d.path === "fiscal.deficit");
  const dirty = !draftIsEmpty(draft);

  const nudge = (id: MinistryId, current: number, pct: number) => {
    const base = draft.budgets[id] ?? current;
    setBudgetDraft(id, Math.max(0, Math.round(base * (1 + pct))));
  };

  return (
    <div className="flex h-full gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {/* fixed fiscal strip — live, mono, 24px, deficit colored by band (DESIGN §6.1) */}
        <div className="panel flex items-center gap-8 px-4 py-3">
          <Strip label={t("revenue", lang)} value={fmtBudget(totalRev(state), 1)} raw={totalRev(state)} dir={1} path="fiscal.revenue" />
          <Strip label={t("spend", lang)} value={fmtBudget(totalSpendFrame(frames), 1)} raw={totalSpendFrame(frames)} dir={0} path="fiscal.ministries" />
          <Strip
            label={state.fiscal.deficit >= 0 ? t("deficit", lang) : t("surplus", lang)}
            value={fmtBudget(Math.abs(state.fiscal.deficit), 1)}
            raw={state.fiscal.deficit}
            dir={-1}
            path="fiscal.deficit"
            color={deficitColor(state.fiscal.deficit, state.macro.gdp_real)}
          />
          {previewedDeficit !== undefined && (
            <span className="flex items-baseline gap-2 text-[12px] text-fg2">
              ⇐
              <span className="num text-[15px]" style={{ color: deficitColor(previewedDeficit.proposed, state.macro.gdp_real) }}>
                {fmtBudget(previewedDeficit.proposed, 1)}
              </span>
              ({t("proposed", lang)})
            </span>
          )}
          <span className="ms-auto flex gap-2">
            {dirty && (
              <button
                type="button"
                onClick={clearDraft}
                className="rounded-[2px] border border-line0 px-3 py-1.5 text-[12px] text-fg1 hover:bg-bg2"
              >
                {lang === "he" ? "נקה" : "Reset"}
              </button>
            )}
            {/* the only filled-primary element on screen (DESIGN §6.1) */}
            <button
              type="button"
              disabled={busy || state.outcome.ended}
              onClick={() => void advance(1)}
              className="rounded-[2px] bg-info px-3 py-1.5 text-[13px] font-medium text-fg0 hover:bg-info-bright disabled:opacity-40"
            >
              {t("confirmBudget", lang)}
            </button>
          </span>
        </div>

        {/* ministry table */}
        <div className="panel min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-[12px] leading-[16px]">
            <thead className="sticky top-0 bg-bg1">
              <tr className="border-b border-line1 text-start text-fg1">
                <th className="px-3 py-2 text-start font-medium">{t("ministry", lang)}</th>
                <th className="px-2 py-2 text-end font-medium">{t("current", lang)}</th>
                <th className="px-2 py-2 text-end font-medium">{t("proposed", lang)}</th>
                <th className="px-2 py-2 text-end font-medium">{t("change", lang)}</th>
                <th className="px-2 py-2 font-medium">{lang === "he" ? "קשיחות" : "Rigidity"}</th>
                <th className="px-3 py-2 text-end font-medium">{t("fundingRatio12q", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {meta.ministries.map((m) => {
                const st = state.fiscal.ministries[m.id];
                const proposed = draft.budgets[m.id] ?? st.budget;
                const changed = draft.budgets[m.id] !== undefined && Math.abs(proposed - st.budget) > 0.5;
                const rel = proposed / st.budget - 1;
                return (
                  <tr key={m.id} className="border-b border-line0/60 hover:bg-bg2/50">
                    <td className="px-3 py-1.5">
                      <Traceable path={`fiscal.ministries.${m.id}`} className="text-fg0">
                        {MINISTRY_NAMES[m.id][lang]}
                      </Traceable>
                    </td>
                    <td className="num px-2 py-1.5 text-end text-fg1">{fmtBudget(st.budget, 1)}</td>
                    <td className="w-28 px-2 py-1.5">
                      <input
                        ref={(el) => {
                          if (el) rowRefs.current.set(m.id, el);
                          else rowRefs.current.delete(m.id);
                        }}
                        className={`cell ${changed ? "edited" : ""}`}
                        type="text"
                        inputMode="numeric"
                        value={String(Math.round(proposed))}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(/[^\d]/g, ""));
                          setBudgetDraft(m.id, Number.isFinite(v) && v !== Math.round(st.budget) ? v : null);
                        }}
                        onKeyDown={(e) => {
                          // DESIGN §7: arrows move rows, +/- nudge 1%
                          if (e.key === "+" || e.key === "=") { e.preventDefault(); nudge(m.id, st.budget, 0.01); }
                          if (e.key === "-") { e.preventDefault(); nudge(m.id, st.budget, -0.01); }
                          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                            e.preventDefault();
                            const ids = meta.ministries.map((x) => x.id);
                            const i = ids.indexOf(m.id) + (e.key === "ArrowDown" ? 1 : -1);
                            const next = ids[i];
                            if (next !== undefined) rowRefs.current.get(next)?.focus();
                          }
                        }}
                      />
                    </td>
                    <td className={`num px-2 py-1.5 text-end ${changed ? (rel > 0 ? "text-good-bright" : "text-bad-bright") : "text-fg2"}`}>
                      {fmtSignedPct(rel, 1)}
                    </td>
                    <td className="w-32 px-2 py-1.5">
                      {/* proposal vs baseline; the red tick is the rigidity floor (uncuttable share) */}
                      <GaugeBar value={proposed / m.baseline_budget / 1.5} tick={m.rigidity / 1.5} color={changed ? SEM.warnBright : DOMAIN.fiscal} />
                    </td>
                    <td className="px-3 py-1.5 text-end">
                      <Sparkline values={fundingHistory.get(m.id) ?? []} color={SEM.info} refLine={1} width={110} height={18} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* מה יישבר — the shadow-tick preview panel */}
      <aside className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="panel">
          <header className="flex items-center justify-between border-b border-line0 px-3 py-2">
            <span className="text-[15px] font-medium">{t("whatBreaks", lang)}</span>
            {previewBusy && <span className="animate-pulse text-[11px] text-fg2">…</span>}
          </header>
          <div className="p-3">
            {preview === null ? (
              <div className="text-[12px] text-fg2">{lang === "he" ? "ערכו את התקציב כדי לראות תחזית" : "Edit the budget to see the preview"}</div>
            ) : preview.breaks.length === 0 ? (
              <div className="text-[12px] text-good-bright">{t("noBreaks", lang)}</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {preview.breaks.map((b, i) => (
                  <li key={i} className="rounded-[2px] border border-warn-dim bg-bg2 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-medium text-warn-bright">{MINISTRY_NAMES[b.ministry][lang]}</span>
                      <Chip tone="warn">
                        <span className="num">{b.fires_after_quarters}</span> {t("firesAfter", lang)}
                      </Chip>
                    </div>
                    <div className="text-[12px] leading-[16px] text-fg1">{b.surfaces_as}</div>
                    {b.triggers_event !== null && (
                      <div className="num mt-1 text-[11px] text-bad-bright">→ {b.triggers_event}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {preview !== null && preview.events.length > 0 && (
              <div className="mt-2 border-t border-line0 pt-2">
                {preview.events.map((e, i) => (
                  <div key={i} className="text-[12px] text-bad-bright">⚠ {e.note}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {preview !== null && preview.diffs.length > 0 && (
          <div className="panel">
            <header className="border-b border-line0 px-3 py-2 text-[15px] font-medium">{t("topDiffs", lang)}</header>
            <table className="w-full text-[12px] leading-[16px]">
              <tbody>
                {preview.diffs.slice(0, 10).map((d) => (
                  <tr key={d.path} className="border-b border-line0/50 last:border-0">
                    <td className="max-w-[180px] truncate px-3 py-1.5 text-fg1" title={d.path}>
                      <Traceable path={d.path}>{d.path}</Traceable>
                    </td>
                    <td className={`num px-3 py-1.5 text-end ${deltaClass(d.path, d.delta)}`}>{fmtSigned(d.delta, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </aside>
    </div>
  );
}

function Strip(props: { label: string; value: string; raw: number; dir: number; path: string; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] leading-[16px] text-fg2">{props.label}</span>
      <Traceable path={props.path}>
        <Num value={props.value} raw={props.raw} direction={props.dir} className="text-[24px] leading-[32px]" title={props.path} />
      </Traceable>
      {props.color !== undefined && <span className="-mt-1 block h-[2px] w-full rounded" style={{ background: props.color }} />}
    </div>
  );
}

function deficitColor(deficit: number, gdp: number): string {
  const share = deficit / gdp;
  if (share < 0) return SEM.goodBright;
  if (share < 0.03) return SEM.warnBright;
  return SEM.badBright;
}

import type { WorldState } from "@engine";
import type { HistoryFrame } from "../sim/types";

function totalRev(s: WorldState): number {
  const r = s.fiscal.revenue;
  return r.income + r.vat + r.corporate + r.capital + r.customs;
}

function totalSpendFrame(frames: HistoryFrame[]): number {
  return frames.length > 0 ? frames[frames.length - 1].spend_total : 0;
}
