/** Crisis decision modal — opens whenever the crisis engine halts the
 *  timeline: the situation, the historical precedent the dilemma is modelled
 *  on, and every option with its achieved objective, pros, cons, projected
 *  metric changes and modelled outcome. */

import { strategic } from "@engine";
import { useStore } from "../../store";
import { useStrategic } from "../../strategic/store";
import type { Lang } from "../../lib/strings";

type Deltas = Partial<strategic.SimulationMetrics>;

const LETTERS = ["א", "ב", "ג", "ד", "ה"];
const LETTERS_EN = ["A", "B", "C", "D", "E"];

function DeltaChips(props: { deltas: Deltas; lang: Lang }) {
  const entries = (Object.entries(props.deltas) as Array<[strategic.MetricKey, number]>).filter(([, v]) => v !== 0);
  if (entries.length === 0) return <span className="text-[12px] text-fg2">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => {
        const good = Math.sign(v) === strategic.METRIC_POLARITY[k];
        return (
          <span key={k} className={`rounded-full px-2 text-[12px] leading-[22px] ${good ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}>
            {strategic.METRIC_LABELS[k][props.lang]} <span className="num font-medium">{v > 0 ? "+" : ""}{v}</span>
          </span>
        );
      })}
    </div>
  );
}

function Outcome(props: { state: strategic.SimulationState; lang: Lang; prefix?: string }) {
  const { state, lang } = props;
  const he = lang === "he";
  const m = state.metrics;
  const text = state.gameOver && state.gameOverReason !== null && state.outcome !== "TERM_COMPLETED"
    ? state.gameOverReason[lang]
    : he
      ? `הקדנציה נמשכת · איום ${m.securityThreat} · קואליציה ${m.coalitionStability} · כלכלה ${m.economicStability} · אזורי ${m.regionalRelations}`
      : `Term continues · threat ${m.securityThreat} · coalition ${m.coalitionStability} · economy ${m.economicStability} · regional ${m.regionalRelations}`;
  const bad = state.gameOver && state.outcome !== "TERM_COMPLETED";
  return (
    <div className={`rounded-[8px] px-2.5 py-1.5 text-[12px] leading-[18px] ${bad ? "bg-bad-dim text-bad-bright" : "bg-bg2 text-fg1"}`}>
      {props.prefix !== undefined && <span className="me-1 font-medium">{props.prefix}</span>}
      {text}
    </div>
  );
}

function SectionTitle(props: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1">{props.children}</div>;
}

export function CrisisDecisionModal() {
  const lang = useStore((s) => s.lang);
  const sim = useStrategic((s) => s.sim);
  const open = useStrategic((s) => s.modalOpen);
  const resolve = useStrategic((s) => s.resolve);
  const setModalOpen = useStrategic((s) => s.setModalOpen);
  const pending = sim.pendingCrisis;
  if (!open || pending === null) return null;

  const def = strategic.CRISIS_DEFS[pending.id];
  const he = lang === "he";
  const cols = def.options.length >= 4 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div className="fade-in absolute inset-0 z-30 flex items-center justify-center bg-[rgb(28_35_48/0.28)] p-6 backdrop-blur-[3px]" role="dialog" aria-modal="true" aria-labelledby="crisis-title">
      <div className="overlay consequence-in flex max-h-full w-full max-w-[1240px] flex-col overflow-hidden rounded-[18px] border border-line0 bg-bg1">
        <header className="border-t-[3px] border-b border-t-bad border-b-line0 px-6 pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bad-dim px-2.5 leading-[24px] font-medium text-bad-bright">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bad" />
              {he ? "הקבינט נדרש להכרעה מיידית" : "The cabinet must decide immediately"}
            </span>
            <span className="text-fg2">{def.trigger[lang]}</span>
          </div>
          <h2 id="crisis-title" className="display mt-2 text-[26px] leading-[34px] text-fg0">{def.title[lang]}</h2>
          <p className="mt-1.5 max-w-[900px] text-[14px] leading-[22px] text-fg1">{def.situation[lang]}</p>
        </header>

        <div className="min-h-0 overflow-y-auto bg-bg0 p-5">
          {/* historical precedent */}
          <section className="mb-4 rounded-[14px] border border-warn/40 bg-warn-dim px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[14px] font-medium text-warn-bright">
                {he ? "תקדים היסטורי והפקת לקחים" : "Historical precedent & lessons learned"} · {def.precedent.title[lang]}
              </div>
              <span className="num text-[12px] text-fg1">{def.precedent.years}</span>
            </div>
            <p className="mt-1 text-[13px] leading-[21px] text-fg0">{def.precedent.body[lang]}</p>
            <p className="mt-1.5 text-[13px] leading-[21px] text-warn-bright">
              <span className="font-medium">{he ? "הלקח: " : "Lesson: "}</span>
              {def.precedent.lesson[lang]}
            </p>
          </section>

          <div className={`grid grid-cols-1 gap-3 ${cols}`}>
            {def.options.map((opt, i) => {
              const letter = he ? LETTERS[i] : LETTERS_EN[i];
              const gamble = opt.gamble;
              return (
                <section key={opt.id} className="panel flex flex-col p-4 transition-shadow hover:shadow-[0_4px_18px_rgb(40_32_20/0.10)]">
                  <div className="flex items-start gap-2.5">
                    <span className="display flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg0 text-[14px] text-white">{letter}</span>
                    <h3 className="text-[15px] leading-[22px] font-medium text-fg0">{opt.label[lang]}</h3>
                  </div>

                  <div className="mt-3">
                    <SectionTitle>{he ? "מטרה מושגת" : "Achieved objective"}</SectionTitle>
                    <div className="text-[13px] leading-[20px] text-fg0">{opt.objective[lang]}</div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] leading-[20px]">
                    <div>
                      <SectionTitle>{he ? "יתרונות" : "Pros"}</SectionTitle>
                      <ul className="flex flex-col gap-0.5">
                        {opt.pros.map((p, j) => (
                          <li key={j} className="text-good-bright">+ {p[lang]}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <SectionTitle>{he ? "חסרונות" : "Cons"}</SectionTitle>
                      <ul className="flex flex-col gap-0.5">
                        {opt.cons.map((c, j) => (
                          <li key={j} className="text-bad-bright">− {c[lang]}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-3">
                    <SectionTitle>{he ? "השפעת מדדים צפויה" : "Projected metric changes"}</SectionTitle>
                    {gamble === undefined ? (
                      <DeltaChips deltas={opt.deltas} lang={lang} />
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(["success", "failure"] as const).map((b) => (
                          <div key={b} className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[12px] font-medium ${b === "success" ? "text-good-bright" : "text-bad-bright"}`}>{gamble[b].label[lang]}:</span>
                            <DeltaChips deltas={strategic.optionDeltas(opt, b)} lang={lang} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-col gap-1">
                    {gamble === undefined ? (
                      <Outcome state={strategic.resolveCrisis(sim, opt.id)} lang={lang} />
                    ) : (
                      (["success", "failure"] as const).map((b) => (
                        <Outcome key={b} state={strategic.resolveCrisis(sim, opt.id, { branch: b })} lang={lang} prefix={`${gamble[b].label[lang]} ·`} />
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => resolve(opt.id)}
                    className="btn btn-primary mt-auto px-3 py-2 text-[14px]"
                    style={{ marginTop: 14 }}
                  >
                    {he ? `הכרעה: אפשרות ${letter}` : `Decide: option ${letter}`}
                  </button>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-line0 px-6 py-3 text-[12px] text-fg2">
          <span>
            {pending.phase === "pre"
              ? he ? "ההשפעות נמדדות ביחס למצב שלפני ההנחיה." : "Impacts apply to the state before the directive."
              : he ? "ההשפעות מתווספות למצב שאחרי הכרעת המחצית." : "Impacts apply on top of this half-year's decision."}
          </span>
          <button type="button" className="btn btn-ghost px-3 py-1 text-[13px]" onClick={() => setModalOpen(false)}>
            {he ? "חזרה לתמונה הטקטית" : "Back to the tactical picture"}
          </button>
        </footer>
      </div>
    </div>
  );
}
