/** In-game panels: HUD (date, coalition, metrics), the decision panel, the
 *  consequence popups, the event log and the end screen. */

import { useMemo, useState } from "react";
import { strategic } from "@engine";
import type { Lang } from "../../lib/strings";
import { useCampaign } from "../../strategic/campaignStore";
import { TIER_COLORS } from "../../strategic/regionGeo";

const S = strategic;
type Game = strategic.CampaignState;
type Deltas = Partial<strategic.SimulationMetrics>;
const tr = (b: strategic.Bi, lang: Lang) => b[lang];

const SHORT: Record<strategic.MetricKey, strategic.Bi> = {
  securityThreat: { he: "איום ביטחוני", en: "Threat" },
  internationalLegitimacy: { he: "לגיטימציה", en: "Legitimacy" },
  usMilitaryAid: { he: "סיוע ארה\"ב", en: "US aid" },
  economicStability: { he: "כלכלה", en: "Economy" },
  regionalRelations: { he: "יחסים אזוריים", en: "Regional" },
  coalitionStability: { he: "קואליציה", en: "Coalition" },
  internalCohesion: { he: "לכידות חברתית", en: "Cohesion" },
};

const SEVERITY_STYLE: Record<strategic.Severity, { border: string; text: string; label: strategic.Bi }> = {
  good: { border: "bg-good", text: "bg-good-dim text-good-bright", label: { he: "התפתחות חיובית", en: "Positive development" } },
  info: { border: "bg-info", text: "bg-info-dim text-info-bright", label: { he: "עדכון", en: "Update" } },
  warn: { border: "bg-warn", text: "bg-warn-dim text-warn-bright", label: { he: "אזהרה", en: "Warning" } },
  bad: { border: "bg-bad", text: "bg-bad-dim text-bad-bright", label: { he: "השלכה", en: "Consequence" } },
  critical: { border: "bg-bad-bright", text: "bg-bad-bright text-white", label: { he: "מבזק · חמור", en: "Breaking · critical" } },
};

function goodness(k: strategic.MetricKey, v: number): number {
  return S.METRIC_POLARITY[k] === 1 ? v : 100 - v;
}

function DeltaChips(props: { deltas: Deltas; lang: Lang; small?: boolean }) {
  const entries = (Object.entries(props.deltas) as Array<[strategic.MetricKey, number]>).filter(([, v]) => Math.round(v) !== 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => {
        const good = Math.sign(v) === S.METRIC_POLARITY[k];
        return (
          <span key={k} className={`rounded-full px-2 ${props.small === true ? "text-[11px] leading-[18px]" : "text-[12px] leading-[20px]"} ${good ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}>
            {tr(SHORT[k], props.lang)} <span className="num font-medium">{v > 0 ? "+" : ""}{Math.round(v)}</span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

export function Hud(props: { game: Game; lang: Lang }) {
  const { game, lang } = props;
  const he = lang === "he";
  const m = game.sim.metrics;
  const seats = S.coalitionSeats(game);
  const atWar = S.warOngoing(game);
  const prev = game.sim.metricsHistory[game.sim.metricsHistory.length - 2];
  const progress = Math.min(1, game.step / game.maxSteps);
  return (
    <div className="glass overlay pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[16px] border border-line0 px-5 py-3">
      <div className="flex min-w-[130px] flex-col gap-1">
        <span className="display text-[21px] leading-[24px]">{tr(S.stepDate(game.step), lang)}</span>
        <span className="text-[12px] leading-[16px] text-fg2">
          {he ? `רבעון ${game.step + 1}` : `Quarter ${game.step + 1}`}
          {game.step >= game.maxSteps ? (he ? " · הבחירות נדחו" : " · elections postponed") : he ? ` מתוך ${game.maxSteps}` : ` of ${game.maxSteps}`}
        </span>
        <bdi dir={he ? "rtl" : "ltr"} className="block h-1 w-full overflow-hidden rounded-full bg-bg3">
          <span className="block h-full rounded-full bg-fg1/60" style={{ width: `${progress * 100}%` }} />
        </bdi>
      </div>
      {game.party !== null && (
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-s border-line0 ps-6">
          <div className="flex items-center gap-2 text-[14px]">
            <span className="inline-block h-3 w-3 rounded-full ring-2 ring-white" style={{ background: S.PARTIES[game.party].color }} />
            <span className="font-medium">{tr(S.partyName(game.party, game.roster), lang)}</span>
            <span className="text-fg2">·</span>
            <span className={`rounded-full px-2 text-[12px] leading-[20px] font-medium ${seats >= 61 ? "bg-bg3 text-fg0" : "bg-bad-dim text-bad-bright"}`}>
              <span className="num">{seats}</span> {he ? "מנדטים" : "seats"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {game.coalition.filter((p) => p !== game.party).map((p) => {
              const pat = game.patience[p] ?? 50;
              return (
                <span
                  key={p}
                  title={`${tr(S.partyName(p, game.roster), lang)} · ${he ? "סבלנות" : "patience"} ${Math.round(pat)}`}
                  className={`flex items-center gap-1.5 rounded-full px-2 text-[11.5px] leading-[20px] ${pat <= 25 ? "bg-bad-dim text-bad-bright" : pat <= 45 ? "bg-warn-dim text-warn-bright" : "bg-bg3/70 text-fg1"}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: S.PARTIES[p].color }} />
                  {tr(S.partyName(p, game.roster), lang)}
                  <span className="num font-medium">{Math.round(pat)}</span>
                </span>
              );
            })}
            {game.departed.map((p) => (
              <span key={p} className="rounded-full px-2 text-[11.5px] leading-[20px] text-fg2 line-through">{tr(S.partyName(p, game.roster), lang)}</span>
            ))}
          </div>
        </div>
      )}
      <div className="ms-auto flex shrink-0 items-center gap-0.5">
        {atWar && <span className="me-2 flex items-center gap-1.5 rounded-full bg-bad-bright px-3 py-1 text-[13px] font-medium text-white"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />{he ? "מלחמה" : "At war"}</span>}
        {S.METRIC_KEYS.map((k) => {
          const v = m[k];
          const g = goodness(k, v);
          const d = prev === undefined ? 0 : v - prev[k];
          const color = g >= 55 ? "#3C9A66" : g >= 35 ? "#D49A2A" : "#D9534A";
          return (
            <div key={k} className="flex min-w-[66px] flex-col gap-1 rounded-[10px] px-1.5 py-1" title={tr(S.METRIC_LABELS[k], lang)}>
              <span className="text-[12px] leading-[14px] whitespace-nowrap text-fg1">{tr(SHORT[k], lang)}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="num text-[19px] leading-[22px] font-medium">{Math.round(v)}</span>
                {Math.round(d) !== 0 && (
                  <span className={`num text-[11px] font-medium ${Math.sign(d) === S.METRIC_POLARITY[k] ? "text-good-bright" : "text-bad-bright"}`}>
                    {d > 0 ? "▲" : "▼"}{Math.abs(Math.round(d))}
                  </span>
                )}
              </span>
              <bdi dir="ltr" className="block h-1 w-full overflow-hidden rounded-full bg-bg3">
                <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: color }} />
              </bdi>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// decision panel
// ---------------------------------------------------------------------------

function PartnerImpact(props: { game: Game; option: strategic.DilemmaOption; isDoctrine: boolean; lang: Lang }) {
  const { game, option, lang } = props;
  const reactions = props.isDoctrine && option.setTrack !== undefined && option.setTrack !== null ? S.DOCTRINE_REACTIONS[option.setTrack] : option.partners;
  if (reactions === undefined) return null;
  const rows = game.coalition
    .filter((p) => p !== game.party)
    .map((p) => ({ p, d: reactions[S.PARTIES[p].tag] ?? 0 }))
    .filter((r) => r.d !== 0);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map(({ p, d }) => {
        const after = (game.patience[p] ?? 50) + d;
        const quits = after <= 0;
        return (
          <span key={p} className={`rounded-full px-2 text-[12px] leading-[20px] ${quits ? "bg-bad-bright font-medium text-white" : d > 0 ? "bg-good-dim text-good-bright" : "bg-warn-dim text-warn-bright"}`}>
            {tr(S.partyName(p, game.roster), lang)} {quits ? (lang === "he" ? "· פורשת" : "· quits") : <span className="num">{d > 0 ? "+" : ""}{d}</span>}
          </span>
        );
      })}
    </div>
  );
}

function OptionCard(props: { game: Game; dilemma: strategic.DilemmaDef; option: strategic.DilemmaOption; index: number; lang: Lang; open: boolean; onOpen(): void }) {
  const { game, dilemma, option, lang, open } = props;
  const he = lang === "he";
  const choose = useCampaign((s) => s.choose);
  const isDoctrine = dilemma.id === "DOCTRINE";
  const previews = useMemo(() => {
    if (!open) return [];
    const branches: Array<strategic.GambleBranch | undefined> = option.gamble === undefined ? [undefined] : ["success", "failure"];
    return branches.map((b) => ({ branch: b, state: S.previewOption(game, option.id, b) }));
  }, [open, game, option]);
  const letter = he ? "אבגדהוזחט"[props.index] : "ABCDEFGHI"[props.index];
  const catastrophic = option.ending !== undefined;

  const label = (text: string) => <div className="eyebrow mb-1">{text}</div>;

  return (
    <section
      className={`overflow-hidden rounded-[14px] border bg-bg1 transition-all ${
        open ? "border-info/50 shadow-[0_0_0_3px_rgb(47_99_176/0.12),0_4px_14px_rgb(40_32_20/0.08)]" : catastrophic ? "border-bad/35 hover:border-bad/60" : "border-line0 hover:border-line1 hover:shadow-[0_2px_8px_rgb(40_32_20/0.06)]"
      }`}
    >
      <button type="button" onClick={props.onOpen} className="flex w-full items-start gap-3 p-4 text-start">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${
            open ? "bg-info text-white" : catastrophic ? "bg-bad-dim text-bad-bright" : "bg-bg3 text-fg1"
          }`}
        >
          {letter}
        </span>
        <span className="flex-1">
          <span className={`block text-[15px] leading-[22px] font-medium ${catastrophic ? "text-bad-bright" : "text-fg0"}`}>{tr(option.label, lang)}</span>
          {!open && <span className="mt-0.5 block text-[13px] leading-[19px] text-fg1">{tr(option.objective, lang)}</span>}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" className={`mt-1.5 shrink-0 text-fg2 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="fade-in flex flex-col gap-4 px-4 pb-4">
          <div className="rounded-[10px] bg-bg2 px-3 py-2.5">
            {label(he ? "מטרה מושגת" : "Achieved objective")}
            <div className="text-[14px] leading-[21px]">{tr(option.objective, lang)}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-[13px] leading-[19px]">
            <div>
              {label(he ? "יתרונות" : "Pros")}
              {option.pros.length === 0 ? (
                <div className="text-fg2">—</div>
              ) : (
                <ul className="flex flex-col gap-1">
                  {option.pros.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
                      {tr(p, lang)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              {label(he ? "חסרונות" : "Cons")}
              <ul className="flex flex-col gap-1">
                {option.cons.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />
                    {tr(c, lang)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            {label(he ? "השפעה צפויה על המדדים" : "Projected metric changes")}
            {option.gamble === undefined ? (
              <DeltaChips deltas={option.deltas} lang={lang} />
            ) : (
              (["success", "failure"] as const).map((b) => {
                const g = option.gamble;
                if (g === undefined) return null;
                const merged: Deltas = { ...option.deltas };
                for (const [k, v] of Object.entries(g[b].deltas) as Array<[strategic.MetricKey, number]>) merged[k] = (merged[k] ?? 0) + v;
                return (
                  <div key={b} className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`text-[12px] font-medium ${b === "success" ? "text-good-bright" : "text-bad-bright"}`}>{tr(g[b].label, lang)}:</span>
                    <DeltaChips deltas={merged} lang={lang} />
                  </div>
                );
              })
            )}
          </div>
          <div>
            {label(he ? "תגובת השותפים" : "Partner reactions")}
            <PartnerImpact game={game} option={option} isDoctrine={isDoctrine} lang={lang} />
          </div>
          {option.consequences !== undefined && option.consequences.length > 0 && (
            <div>
              {label(he ? "השלכות אפשריות" : "Possible consequences")}
              <ul className="flex flex-col gap-1 text-[13px] leading-[19px]">
                {option.consequences.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c.severity === "good" ? "bg-good" : c.severity === "warn" ? "bg-warn" : "bg-bad"}`} />
                    <span>
                      {tr(c.headline, lang)}
                      {c.p !== undefined && c.p < 1 && <span className="num ms-1.5 text-fg2">{Math.round(c.p * 100)}%</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {previews.map(({ branch, state }) => {
            const ending = state.ending;
            if (ending === null) return null;
            return (
              <div key={branch ?? "-"} className={`rounded-[10px] px-3 py-2 text-[13px] leading-[19px] ${ending.kind === "TERM_COMPLETED" ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}>
                {branch !== undefined && option.gamble !== undefined && <span className="me-1 font-medium">{tr(option.gamble[branch].label, lang)} ·</span>}
                <span className="font-medium">{tr(ending.headline, lang)}</span>
              </div>
            );
          })}
          <button type="button" onClick={() => choose(option.id)} className={`btn py-2.5 text-[15px] ${catastrophic ? "btn-danger" : "btn-primary"}`}>
            {he ? "זו ההחלטה שלי" : "This is my decision"}
          </button>
        </div>
      )}
    </section>
  );
}

export function DecisionPanel(props: { game: Game; lang: Lang }) {
  const { game, lang } = props;
  const he = lang === "he";
  const dilemma = S.currentDilemma(game);
  const [open, setOpen] = useState<string | null>(null);
  const [showPrecedent, setShowPrecedent] = useState(true);
  if (dilemma === null) return null;
  const isCrisis = dilemma.crisisId !== undefined;

  return (
    <aside key={`${game.step}:${dilemma.id}`} className="overlay consequence-in pointer-events-auto flex max-h-full w-[min(500px,100%)] flex-col self-start overflow-hidden rounded-[18px] border border-line0 bg-bg1">
      <header className="px-5 pt-5 pb-4">
        <div
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${isCrisis ? "bg-bad-bright text-white" : "bg-info-dim text-info-bright"}`}
        >
          {isCrisis && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {dilemma.id === "DOCTRINE"
            ? he ? "שלב 3 מתוך 3 · מדיניות הממשלה" : "Step 3 of 3 · Government policy"
            : isCrisis ? he ? "הקבינט נדרש להכרעה מיידית" : "The cabinet must decide immediately" : he ? "הכרעת ראש הממשלה" : "Prime Minister's decision"}
        </div>
        <h2 className="display mt-2.5 text-[25px] leading-[32px]">{tr(dilemma.title, lang)}</h2>
        <p className="mt-2 text-[14px] leading-[22px] text-fg1">{tr(dilemma.context, lang)}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line0 bg-bg2 p-4">
        {dilemma.precedent !== undefined && (
          <section className="mb-4 rounded-[14px] border border-warn/25 bg-[#FBF5E6] p-3.5">
            <button type="button" className="flex w-full items-start justify-between gap-3 text-start" onClick={() => setShowPrecedent(!showPrecedent)}>
              <span>
                <span className="eyebrow block text-warn-bright">{he ? "תקדים היסטורי" : "Historical precedent"}</span>
                <span className="mt-0.5 block text-[14px] leading-[20px] font-medium text-fg0">{tr(dilemma.precedent.title, lang)}</span>
              </span>
              <span className="num shrink-0 rounded-full bg-white/70 px-2 text-[12px] leading-[20px] text-fg1">{dilemma.precedent.years}</span>
            </button>
            {showPrecedent && (
              <>
                <p className="mt-2 text-[13px] leading-[20px] text-fg1">{tr(dilemma.precedent.body, lang)}</p>
                <p className="mt-2 border-s-2 border-warn ps-3 text-[13px] leading-[20px] text-fg0">
                  <span className="font-medium">{he ? "הלקח: " : "Lesson: "}</span>
                  {tr(dilemma.precedent.lesson, lang)}
                </p>
              </>
            )}
          </section>
        )}
        <div className="flex flex-col gap-2.5">
          {dilemma.options.map((o, i) => (
            <OptionCard key={o.id} game={game} dilemma={dilemma} option={o} index={i} lang={lang} open={open === o.id} onOpen={() => setOpen(open === o.id ? null : o.id)} />
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-[17px] text-fg2">
          {he ? "המספרים הם הנחות המודל. ההתייחסויות ההיסטוריות עובדתיות." : "Numbers are model assumptions. Historical references are factual."}
        </p>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// consequence popup
// ---------------------------------------------------------------------------

export function ConsequenceCard(props: { game: Game; lang: Lang }) {
  const { game, lang } = props;
  const he = lang === "he";
  const ack = useCampaign((s) => s.acknowledge);
  const e = game.queue[0];
  if (e === undefined) return null;
  const st = SEVERITY_STYLE[e.severity];
  const total = game.lastConsequences.length;
  const index = total - game.queue.length + 1;
  const stance = (Object.entries(e.stance) as Array<[strategic.ActorId, number]>).filter(([, v]) => v !== 0);

  return (
    <div key={e.id} className="overlay pointer-events-auto consequence-in bg-bg1 w-[min(580px,100%)] overflow-hidden rounded-[18px] border border-line0">
      <div className={`h-1.5 ${st.border}`} />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${st.text}`}>{tr(st.label, lang)}</span>
          {total > 1 && (
            <span className="flex items-center gap-1" aria-label={`${index}/${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className={`inline-block h-1.5 rounded-full transition-all ${i + 1 === index ? "w-4 bg-fg1" : "w-1.5 bg-line1"}`} />
              ))}
            </span>
          )}
        </div>
        <h3 className="display mt-3 text-[25px] leading-[32px]">{tr(e.headline, lang)}</h3>
        <p className="mt-2 text-[14px] leading-[22px] text-fg1">{tr(e.body, lang)}</p>
        <div className="mt-4 flex flex-col gap-2">
          <DeltaChips deltas={e.deltas} lang={lang} />
          {stance.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stance.map(([a, v]) => (
                <span key={a} className={`rounded-full border px-2 text-[12px] leading-[20px] ${v > 0 ? "border-good/40 text-good-bright" : "border-bad/40 text-bad-bright"}`}>
                  {tr(S.ACTOR_DEFS[a].name, lang)} <span className="num font-medium">{v > 0 ? "+" : ""}{v}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <button type="button" autoFocus onClick={ack} className="btn btn-primary mt-5 w-full py-2.5 text-[15px]">
          {game.queue.length > 1 ? (he ? "המשך" : "Continue") : game.ending !== null ? (he ? "לסיכום" : "To the verdict") : he ? "להחלטה הבאה" : "To the next decision"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// log + legend
// ---------------------------------------------------------------------------

export function EventLog(props: { game: Game; lang: Lang }) {
  const { game, lang } = props;
  const [open, setOpen] = useState(false);
  const he = lang === "he";
  return (
    <div className="glass overlay pointer-events-auto w-[min(380px,100%)] overflow-hidden rounded-[14px] border border-line0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-[13px] font-medium hover:bg-bg2/70">
        <span className="flex items-center gap-2">
          {he ? "יומן אירועים" : "Event log"}
          <span className="num rounded-full bg-bg3 px-1.5 text-[11px] leading-[18px] text-fg1">{game.log.length}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" className={`text-fg2 transition-transform ${open ? "" : "rotate-180"}`} aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="max-h-[280px] overflow-y-auto border-t border-line0 px-4 py-3 text-[13px] leading-[19px]">
          {[...game.log].reverse().map((l, i) => (
            <li key={i} className="mb-2 flex gap-2.5">
              <span className={`mt-[6px] inline-block h-2 w-2 shrink-0 rounded-full ${l.severity === "good" ? "bg-good" : l.severity === "warn" ? "bg-warn" : l.severity === "bad" || l.severity === "critical" ? "bg-bad" : "bg-line1"}`} />
              <span>
                <span className="block text-[11.5px] text-fg2">{tr(S.stepDate(l.step), lang)}</span>
                <span className="text-fg0">{tr(l.text, lang)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StanceLegend(props: { lang: Lang }) {
  return (
    <div className="glass overlay pointer-events-auto flex flex-wrap items-center gap-3 rounded-full border border-line0 px-4 py-2 text-[12px] text-fg1">
      {S.STANCE_TIERS.map((t) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: TIER_COLORS[t] }} />
          {tr(S.TIER_LABELS[t], props.lang)}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ending
// ---------------------------------------------------------------------------

export function EndScreen(props: { game: Game; lang: Lang }) {
  const { game, lang } = props;
  const he = lang === "he";
  const newGame = useCampaign((s) => s.newGame);
  const ending = game.ending;
  if (ending === null) return null;
  const good = ending.kind === "TERM_COMPLETED";
  const KIND: Record<strategic.EndingKind, strategic.Bi> = {
    GOVERNMENT_FELL: { he: "הממשלה נפלה", en: "Government fell" },
    STATE_COLLAPSE_EXTERNAL: { he: "קריסת המדינה · גורמים חיצוניים", en: "State collapse · external" },
    STATE_COLLAPSE_INTERNAL: { he: "קריסת המדינה · שסע פנימי", en: "State collapse · internal rift" },
    TERM_COMPLETED: { he: "הקדנציה הושלמה", en: "Term completed" },
  };
  return (
    <div className="fade-in pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#2a2418]/25 p-6 backdrop-blur-[2px]">
      <div className="overlay consequence-in flex max-h-full w-full max-w-[780px] flex-col overflow-hidden rounded-[22px] border border-line0 bg-bg1">
        <div className={`h-2 ${good ? "bg-good" : "bg-bad"}`} />
        <header className="px-8 pt-7 pb-6 text-center">
          <div className={`inline-block rounded-full px-3 py-1 text-[13px] font-medium ${good ? "bg-good-dim text-good-bright" : "bg-bad-dim text-bad-bright"}`}>{tr(KIND[ending.kind], lang)}</div>
          <h2 className="display mt-4 text-[38px] leading-[46px]">{tr(ending.headline, lang)}</h2>
          <p className="mx-auto mt-3 max-w-[600px] text-[15px] leading-[24px] text-fg1">{tr(ending.reason, lang)}</p>
          <div className="mt-3 text-[13px] text-fg2">
            {he
              ? `שרדת ${game.step} רבעונים · ${tr(S.stepDate(Math.max(0, game.step - 1)), lang)}`
              : `You lasted ${game.step} quarters · ${tr(S.stepDate(Math.max(0, game.step - 1)), lang)}`}
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto border-t border-line0 bg-bg2/60 px-8 py-5">
          <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
            {S.METRIC_KEYS.map((k) => (
              <div key={k} className="rounded-[12px] border border-line0 bg-bg1 px-2 py-2.5 text-center">
                <div className="num text-[22px] leading-[26px] font-medium">{Math.round(game.sim.metrics[k])}</div>
                <div className="mt-0.5 text-[12px] text-fg1">{tr(SHORT[k], lang)}</div>
              </div>
            ))}
          </div>
          <div className="display mt-6 text-[18px]">{he ? "ההחלטות שלך" : "Your decisions"}</div>
          <ol className="mt-2 flex flex-col divide-y divide-line0 text-[13px] leading-[19px]">
            {game.choices.map((c, i) => {
              const d = S.DILEMMAS[c.dilemma];
              const o = d?.options.find((x) => x.id === c.option);
              return (
                <li key={i} className="flex gap-3 py-2">
                  <span className="w-24 shrink-0 text-fg2">{tr(S.stepDate(c.step), lang)}</span>
                  <span className="text-fg1">{d !== undefined ? tr(d.title, lang) : c.dilemma}</span>
                  <span className="text-fg0">→ {o !== undefined ? tr(o.label, lang) : c.option}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <footer className="border-t border-line0 px-8 py-4">
          <button type="button" onClick={newGame} className="btn btn-primary w-full py-3 text-[16px]">
            {he ? "משחק חדש" : "New game"}
          </button>
        </footer>
      </div>
    </div>
  );
}
