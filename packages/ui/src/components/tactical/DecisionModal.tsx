/** Crisis decision modal: the simulation halts; four options with objective,
 *  pros/cons, metric impacts and the modelled outcome of each. */

import { strategic } from "@engine";
import { useStore } from "../../store";
import { useStrategic } from "../../strategic/store";

const LETTERS: Record<strategic.CrisisOptionId, string> = {
  A_CANCEL_TRANSFER: "A",
  B_AIR_RETALIATION: "B",
  C_GROUND_INVASION_SINAI: "C",
  D_US_MEDIATION: "D",
};

export function DecisionModal() {
  const lang = useStore((s) => s.lang);
  const sim = useStrategic((s) => s.sim);
  const open = useStrategic((s) => s.modalOpen);
  const resolve = useStrategic((s) => s.resolve);
  const setModalOpen = useStrategic((s) => s.setModalOpen);
  const pending = sim.pendingCrisis;
  if (!open || pending === null) return null;

  const def = strategic.CRISIS_DEFS[pending.id];
  const he = lang === "he";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg0/70 p-6" role="dialog" aria-modal="true">
      <div className="overlay flex max-h-full w-full max-w-[1080px] flex-col overflow-hidden rounded-[6px] border border-bad bg-bg1">
        <header className="border-b border-line0 px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-bad-bright">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bad-bright" />
            {he ? "דילמת הכרעה · הסימולציה הושהתה" : "Decision dilemma · simulation halted"}
          </div>
          <h2 className="mt-1 text-[20px] leading-[28px] font-bold">{def.title[lang]}</h2>
          <p className="mt-1 text-[13px] leading-[20px] text-fg1">{def.situation[lang]}</p>
        </header>

        <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto p-4">
          {strategic.CRISIS_OPTION_IDS.map((id) => {
            const opt = def.options[id];
            const outcome = strategic.resolveCrisis(sim, id);
            return (
              <section key={id} className="flex flex-col rounded-[4px] border border-line0 bg-bg2 p-3">
                <div className="flex items-start gap-2">
                  <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-line1 text-[13px]">{LETTERS[id]}</span>
                  <h3 className="text-[15px] leading-[22px] font-medium">{opt.label[lang]}</h3>
                </div>
                <div className="mt-2 text-[12px] leading-[18px]">
                  <span className="text-fg2">{he ? "יעד: " : "Objective: "}</span>
                  <span className="text-fg0">{opt.objective[lang]}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-[12px] leading-[18px]">
                  <ul className="flex flex-col gap-0.5">
                    <li className="text-[11px] text-fg2">{he ? "יתרונות" : "Pros"}</li>
                    {opt.pros.map((p, i) => (
                      <li key={i} className="text-good-bright">+ {p[lang]}</li>
                    ))}
                  </ul>
                  <ul className="flex flex-col gap-0.5">
                    <li className="text-[11px] text-fg2">{he ? "חסרונות" : "Cons"}</li>
                    {opt.cons.map((c, i) => (
                      <li key={i} className="text-bad-bright">− {c[lang]}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(Object.entries(opt.deltas) as Array<[strategic.MetricKey, number]>).map(([k, v]) => {
                    const good = Math.sign(v) === strategic.METRIC_POLARITY[k];
                    return (
                      <span key={k} className={`rounded-[2px] border px-1.5 text-[11px] leading-[18px] ${good ? "border-good text-good-bright" : "border-bad text-bad-bright"}`}>
                        {strategic.METRIC_LABELS[k][lang]} <span className="num">{v > 0 ? "+" : ""}{v}</span>
                      </span>
                    );
                  })}
                </div>
                <div className={`mt-2 rounded-[2px] px-2 py-1 text-[12px] leading-[18px] ${outcome.gameOver ? "bg-bad-dim/30 text-bad-bright" : "bg-bg1 text-fg1"}`}>
                  {outcome.gameOver && outcome.gameOverReason !== null
                    ? outcome.gameOverReason[lang]
                    : he
                      ? `הקדנציה נמשכת · איום ${outcome.metrics.securityThreat} · קואליציה ${outcome.metrics.coalitionStability} · סיוע ארה"ב ${outcome.metrics.usMilitaryAid}`
                      : `Term continues · threat ${outcome.metrics.securityThreat} · coalition ${outcome.metrics.coalitionStability} · US aid ${outcome.metrics.usMilitaryAid}`}
                </div>
                <button
                  type="button"
                  onClick={() => resolve(id)}
                  className="mt-3 rounded-[2px] border border-line1 bg-bg3 px-3 py-1.5 text-[13px] font-medium hover:border-info hover:bg-info-dim/40"
                >
                  {he ? `בחירה באפשרות ${LETTERS[id]}` : `Choose option ${LETTERS[id]}`}
                </button>
              </section>
            );
          })}
        </div>

        <footer className="flex items-center justify-between border-t border-line0 px-5 py-2 text-[11px] text-fg2">
          <span>{he ? "השפעות המדדים נמדדות ביחס למצב שלפני הנחיית הטרנספר." : "Metric impacts apply to the state before the transfer directive."}</span>
          <button type="button" className="text-info-bright hover:underline" onClick={() => setModalOpen(false)}>
            {he ? "חזרה לתמונה הטקטית" : "Back to the tactical picture"}
          </button>
        </footer>
      </div>
    </div>
  );
}
