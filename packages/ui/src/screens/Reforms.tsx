/** Reforms, economic model, periphery program — decision levers beyond the budget.
 *  Selections join the draft and apply on the next quarter advance.
 */

import type { EconomicModelId } from "@engine";
import { useStore, draftIsEmpty } from "../store";
import { MODEL_NAMES, REFORM_NAMES, t } from "../lib/strings";
import { fmtBudget } from "../lib/format";
import { DOMAIN } from "../lib/colors";
import { Chip, Panel } from "../components/ui";

export function Reforms() {
  const lang = useStore((s) => s.lang);
  const state = useStore((s) => s.state);
  const meta = useStore((s) => s.meta);
  const draft = useStore((s) => s.draft);
  const setReformDraft = useStore((s) => s.setReformDraft);
  const setModelDraft = useStore((s) => s.setModelDraft);
  const setPeripheryDraft = useStore((s) => s.setPeripheryDraft);
  const advance = useStore((s) => s.advance);
  const busy = useStore((s) => s.busy);

  if (state === null || meta === null) return null;

  const enacted = new Set(Object.entries(state.reforms).filter(([, r]) => r.status === "enacted").map(([id]) => id));
  const periphery = draft.periphery ?? {
    annual_budget: state.fiscal.periphery_spend,
    target_clusters: state.fiscal.periphery_target_clusters,
  };
  const dirty = !draftIsEmpty(draft);

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-5">
      {dirty && (
        <div className="panel flex items-center gap-3 !border-warn/50 !bg-warn-dim/50 px-5 py-3 text-[13.5px] text-warn-bright">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-warn" />
          {t("pendingNextQ", lang)}
          <button
            type="button"
            disabled={busy || state.outcome.ended}
            onClick={() => void advance(1)}
            className="btn btn-accent ms-auto px-4 py-2 text-[13px]"
          >
            {t("confirmBudget", lang)}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title={t("reforms", lang)} accent={DOMAIN.diplomacy}>
          <ul className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            {meta.reforms.map((r) => {
              const st = state.reforms[r.id]?.status ?? "pending";
              const isEnacted = st === "enacted";
              const prereqsMet = r.prerequisites.every((p) => enacted.has(p));
              const drafted = draft.reforms[r.id];
              const tone =
                drafted === "enact"
                  ? "border-good bg-good-dim/40"
                  : drafted === "repeal"
                    ? "border-bad bg-bad-dim/40"
                    : isEnacted
                      ? "border-line0 bg-bg2"
                      : "border-line0 bg-bg1 hover:border-line1";
              return (
                <li key={r.id} className={`flex flex-col rounded-[12px] border px-4 py-3 transition-colors ${tone}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex-1 text-[14.5px] leading-[21px] font-medium text-fg0">{REFORM_NAMES[r.id]?.[lang] ?? r.id}</span>
                    <span className="num shrink-0 text-[13px] text-fg1">
                      {fmtBudget(r.fiscal_cost, 1)}
                      <span className="text-fg2">/y</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {isEnacted && <Chip tone="good">{t("enacted", lang)}</Chip>}
                    {st === "repealed" && <Chip tone="muted">{t("repealed", lang)}</Chip>}
                    {!r.reversible && <Chip tone="bad">{t("irreversible", lang)}</Chip>}
                  </div>
                  {!prereqsMet && !isEnacted && (
                    <div className="mt-2 text-[12px] leading-[18px] text-warn-bright">
                      {t("prereqMissing", lang)}:{" "}
                      <span className="text-fg1">{r.prerequisites.filter((p) => !enacted.has(p)).map((p) => REFORM_NAMES[p]?.[lang] ?? p).join(", ")}</span>
                    </div>
                  )}
                  <div className="mt-auto flex gap-2 pt-3">
                    {!isEnacted && (
                      <button
                        type="button"
                        disabled={!prereqsMet}
                        onClick={() => setReformDraft(r.id, drafted === "enact" ? null : "enact")}
                        className={`btn px-3.5 py-1.5 text-[13px] ${drafted === "enact" ? "bg-good text-white hover:bg-good-bright" : "btn-ghost"}`}
                      >
                        {drafted === "enact" ? "✓ " : ""}
                        {t("enact", lang)}
                      </button>
                    )}
                    {isEnacted && r.reversible && (
                      <button
                        type="button"
                        onClick={() => setReformDraft(r.id, drafted === "repeal" ? null : "repeal")}
                        className={`btn px-3.5 py-1.5 text-[13px] ${drafted === "repeal" ? "btn-danger" : "btn-ghost"}`}
                      >
                        {drafted === "repeal" ? "✓ " : ""}
                        {t("repeal", lang)}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel title={t("economicModel", lang)} accent={DOMAIN.fiscal}>
            <div className="grid grid-cols-2 gap-2">
              {meta.models.map((m) => {
                const active = state.economic_model === m;
                const drafted = draft.economic_model === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelDraft(active || drafted ? null : (m as EconomicModelId))}
                    className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 text-start text-[13px] leading-[18px] transition-colors ${
                      active
                        ? "border-info bg-info-dim/60 font-medium text-info-bright"
                        : drafted
                          ? "border-warn bg-warn-dim/60 font-medium text-warn-bright"
                          : "border-line0 text-fg1 hover:border-line1 hover:bg-bg2 hover:text-fg0"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 ${active ? "border-info bg-info shadow-[inset_0_0_0_2px_white]" : drafted ? "border-warn bg-warn shadow-[inset_0_0_0_2px_white]" : "border-line1"}`}
                    />
                    {MODEL_NAMES[m]?.[lang] ?? m}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2 rounded-[10px] bg-warn-dim/50 px-3 py-2 text-[12.5px] leading-[19px] text-warn-bright">
              <span aria-hidden>⚠</span>
              {t("transitionWarning", lang)}
            </div>
          </Panel>

          <Panel title={t("periphery", lang)} accent={DOMAIN.infra}>
            <div className="flex flex-col gap-4 text-[13px]">
              <label className="flex flex-col gap-1.5">
                <span className="text-fg1">{t("annualBudget", lang)} (₪M)</span>
                <input
                  className="cell !py-1.5 text-[15px]"
                  type="text"
                  inputMode="numeric"
                  value={String(Math.round(periphery.annual_budget))}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/[^\d]/g, ""));
                    setPeripheryDraft({ annual_budget: Number.isFinite(v) ? v : 0, target_clusters: periphery.target_clusters });
                  }}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-fg1">{t("targetClusters", lang)}</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((c) => {
                    const on = periphery.target_clusters.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setPeripheryDraft({
                            annual_budget: periphery.annual_budget,
                            target_clusters: on ? periphery.target_clusters.filter((x) => x !== c) : [...periphery.target_clusters, c].sort(),
                          })
                        }
                        className={`num h-9 w-11 rounded-full border text-[14px] transition-colors ${
                          on ? "border-info bg-info text-white" : "border-line0 bg-bg1 text-fg1 hover:border-line1 hover:bg-bg2"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[12px] text-fg2">{lang === "he" ? "אשכול 1 — החלש ביותר" : "Cluster 1 is the most deprived"}</span>
              </div>
              {state.fiscal.periphery_spend > 0 && (
                <div className="rounded-[10px] bg-info-dim/60 px-3 py-2 text-[12.5px] text-info-bright">
                  {lang === "he" ? "פעיל כעת" : "Currently active"}: <span className="num font-medium">{fmtBudget(state.fiscal.periphery_spend, 1)}/y</span> →{" "}
                  <span className="num">{state.fiscal.periphery_target_clusters.join(", ")}</span>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
