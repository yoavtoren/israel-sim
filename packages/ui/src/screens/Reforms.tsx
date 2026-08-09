/** Reforms, economic model, periphery program — decision levers beyond the budget.
 *  Selections join the draft and apply on the next quarter advance.
 */

import type { EconomicModelId } from "@engine";
import { useStore, draftIsEmpty } from "../store";
import { MODEL_NAMES, REFORM_NAMES, t } from "../lib/strings";
import { fmtBudget } from "../lib/format";
import { DOMAIN, SEM } from "../lib/colors";
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
    <div className="flex flex-col gap-4">
      {dirty && (
        <div className="panel flex items-center gap-3 border-warn-dim px-3 py-2 text-[12px] text-warn-bright">
          {t("pendingNextQ", lang)}
          <button
            type="button"
            disabled={busy || state.outcome.ended}
            onClick={() => void advance(1)}
            className="ms-auto rounded-[2px] bg-info px-3 py-1 text-[12px] font-medium text-fg0 hover:bg-info-bright disabled:opacity-40"
          >
            {t("confirmBudget", lang)}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Panel title={t("reforms", lang)} accent={DOMAIN.diplomacy}>
          <ul className="flex flex-col gap-2">
            {meta.reforms.map((r) => {
              const st = state.reforms[r.id]?.status ?? "pending";
              const isEnacted = st === "enacted";
              const prereqsMet = r.prerequisites.every((p) => enacted.has(p));
              const drafted = draft.reforms[r.id];
              return (
                <li key={r.id} className={`rounded-[2px] border p-2 ${drafted !== undefined ? "border-warn" : "border-line0"} bg-bg2`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{REFORM_NAMES[r.id]?.[lang] ?? r.id}</span>
                    {isEnacted && <Chip tone="good">{t("enacted", lang)}</Chip>}
                    {st === "repealed" && <Chip tone="muted">{t("repealed", lang)}</Chip>}
                    {!r.reversible && <Chip tone="bad">{t("irreversible", lang)}</Chip>}
                    <span className="num ms-auto text-[12px] text-fg1">{fmtBudget(r.fiscal_cost, 1)}/y</span>
                  </div>
                  {!prereqsMet && !isEnacted && (
                    <div className="mt-1 text-[11px] text-warn-bright">
                      {t("prereqMissing", lang)}: <span className="num">{r.prerequisites.filter((p) => !enacted.has(p)).join(", ")}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex gap-2">
                    {!isEnacted && (
                      <button
                        type="button"
                        disabled={!prereqsMet}
                        onClick={() => setReformDraft(r.id, drafted === "enact" ? null : "enact")}
                        className={`rounded-[2px] border px-2 py-0.5 text-[12px] disabled:opacity-40 ${
                          drafted === "enact" ? "border-good text-good-bright" : "border-line1 text-fg1 hover:bg-bg3"
                        }`}
                      >
                        {t("enact", lang)}
                      </button>
                    )}
                    {isEnacted && r.reversible && (
                      <button
                        type="button"
                        onClick={() => setReformDraft(r.id, drafted === "repeal" ? null : "repeal")}
                        className={`rounded-[2px] border px-2 py-0.5 text-[12px] ${
                          drafted === "repeal" ? "border-bad text-bad-bright" : "border-line1 text-fg1 hover:bg-bg3"
                        }`}
                      >
                        {t("repeal", lang)}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
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
                    className={`rounded-[2px] border px-2 py-1.5 text-start text-[12px] ${
                      active
                        ? "border-info text-info-bright"
                        : drafted
                          ? "border-warn text-warn-bright"
                          : "border-line0 text-fg1 hover:bg-bg2"
                    }`}
                  >
                    {MODEL_NAMES[m]?.[lang] ?? m}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-[11px] leading-[16px]" style={{ color: SEM.warn }}>
              {t("transitionWarning", lang)}
            </div>
          </Panel>

          <Panel title={t("periphery", lang)} accent={DOMAIN.infra}>
            <div className="flex flex-col gap-2 text-[12px]">
              <label className="flex items-center justify-between gap-3">
                <span className="text-fg1">{t("annualBudget", lang)} (₪M)</span>
                <input
                  className="cell w-32"
                  type="text"
                  inputMode="numeric"
                  value={String(Math.round(periphery.annual_budget))}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/[^\d]/g, ""));
                    setPeripheryDraft({ annual_budget: Number.isFinite(v) ? v : 0, target_clusters: periphery.target_clusters });
                  }}
                />
              </label>
              <div className="flex items-center gap-2">
                <span className="text-fg1">{t("targetClusters", lang)}:</span>
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
                      className={`num h-7 w-7 rounded-[2px] border text-[12px] ${
                        on ? "border-info bg-info-dim/40 text-info-bright" : "border-line0 text-fg2 hover:bg-bg2"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {state.fiscal.periphery_spend > 0 && (
                <div className="text-[11px] text-fg2">
                  {lang === "he" ? "פעיל כעת" : "Currently active"}: <span className="num">{fmtBudget(state.fiscal.periphery_spend, 1)}/y</span> →{" "}
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
