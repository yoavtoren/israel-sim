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
  if (entries.length === 0) return <span className="text-[11px] text-fg2">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => {
        const good = Math.sign(v) === strategic.METRIC_POLARITY[k];
        return (
          <span key={k} className={`rounded-[2px] border px-1.5 text-[11px] leading-[18px] ${good ? "border-good/70 text-good-bright" : "border-bad/70 text-bad-bright"}`}>
            {strategic.METRIC_LABELS[k][props.lang]} <span className="num">{v > 0 ? "+" : ""}{v}</span>
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
    <div className={`rounded-[2px] px-2 py-1 text-[12px] leading-[18px] ${bad ? "bg-bad-dim/30 text-bad-bright" : "bg-bg1 text-fg1"}`}>
      {props.prefix !== undefined && <span className="me-1 font-medium">{props.prefix}</span>}
      {text}
    </div>
  );
}

function SectionTitle(props: { children: React.ReactNode }) {
  return <div className="mb-0.5 text-[11px] font-medium tracking-wide text-fg2">{props.children}</div>;
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
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg0/70 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="crisis-title">
      <div className="overlay flex max-h-full w-full max-w-[1240px] flex-col overflow-hidden rounded-[6px] border border-bad bg-bg1 shadow-[0_0_40px_rgba(248,81,73,0.25)]">
        <header className="border-b border-line0 px-5 py-3">
          <div className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-bad-bright">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-bad-bright" />
            {he ? "הקבינט נדרש להכרעה מיידית" : "The cabinet must decide immediately"}
            <span className="ms-2 font-normal text-fg2">· {def.trigger[lang]}</span>
          </div>
          <h2 id="crisis-title" className="mt-1 text-[20px] leading-[28px] font-bold">{def.title[lang]}</h2>
          <p className="mt-1 text-[13px] leading-[20px] text-fg1">{def.situation[lang]}</p>
        </header>

        <div className="min-h-0 overflow-y-auto p-4">
          {/* historical precedent */}
          <section className="mb-3 rounded-[4px] border border-warn/60 bg-warn-dim/15 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-[13px] font-bold text-warn-bright">
                {he ? "תקדים היסטורי והפקת לקחים" : "Historical precedent & lessons learned"} · {def.precedent.title[lang]}
              </div>
              <span className="num text-[11px] text-fg2">{def.precedent.years}</span>
            </div>
            <p className="mt-1 text-[12px] leading-[19px] text-fg0">{def.precedent.body[lang]}</p>
            <p className="mt-1.5 text-[12px] leading-[19px] text-warn-bright">
              <span className="font-medium">{he ? "הלקח: " : "Lesson: "}</span>
              {def.precedent.lesson[lang]}
            </p>
          </section>

          <div className={`grid grid-cols-1 gap-3 ${cols}`}>
            {def.options.map((opt, i) => {
              const letter = he ? LETTERS[i] : LETTERS_EN[i];
              const gamble = opt.gamble;
              return (
                <section key={opt.id} className="flex flex-col rounded-[4px] border border-line0 bg-bg2 p-3">
                  <div className="flex items-start gap-2">
                    <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-[2px] border border-line1 text-[13px]">{letter}</span>
                    <h3 className="text-[14px] leading-[21px] font-medium">{opt.label[lang]}</h3>
                  </div>

                  <div className="mt-2">
                    <SectionTitle>{he ? "מטרה מושגת" : "Achieved objective"}</SectionTitle>
                    <div className="text-[12px] leading-[18px] text-fg0">{opt.objective[lang]}</div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 text-[12px] leading-[18px]">
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

                  <div className="mt-2">
                    <SectionTitle>{he ? "השפעת מדדים צפויה" : "Projected metric changes"}</SectionTitle>
                    {gamble === undefined ? (
                      <DeltaChips deltas={opt.deltas} lang={lang} />
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(["success", "failure"] as const).map((b) => (
                          <div key={b} className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-[11px] font-medium ${b === "success" ? "text-good-bright" : "text-bad-bright"}`}>{gamble[b].label[lang]}:</span>
                            <DeltaChips deltas={strategic.optionDeltas(opt, b)} lang={lang} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-col gap-1">
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
                    className="mt-auto rounded-[2px] border border-line1 bg-bg3 px-3 py-1.5 text-[13px] font-medium hover:border-info hover:bg-info-dim/40"
                    style={{ marginTop: 12 }}
                  >
                    {he ? `הכרעה: אפשרות ${letter}` : `Decide: option ${letter}`}
                  </button>
                </section>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-line0 px-5 py-2 text-[11px] text-fg2">
          <span>
            {pending.phase === "pre"
              ? he ? "ההשפעות נמדדות ביחס למצב שלפני ההנחיה." : "Impacts apply to the state before the directive."
              : he ? "ההשפעות מתווספות למצב שאחרי הכרעת המחצית." : "Impacts apply on top of this half-year's decision."}
          </span>
          <button type="button" className="text-info-bright hover:underline" onClick={() => setModalOpen(false)}>
            {he ? "חזרה לתמונה הטקטית" : "Back to the tactical picture"}
          </button>
        </footer>
      </div>
    </div>
  );
}
