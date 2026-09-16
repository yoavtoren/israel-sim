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
  good: { border: "border-good", text: "text-good-bright", label: { he: "התפתחות חיובית", en: "Positive development" } },
  info: { border: "border-info", text: "text-info-bright", label: { he: "עדכון", en: "Update" } },
  warn: { border: "border-warn", text: "text-warn-bright", label: { he: "אזהרה", en: "Warning" } },
  bad: { border: "border-bad", text: "text-bad-bright", label: { he: "השלכה", en: "Consequence" } },
  critical: { border: "border-bad", text: "text-bad-bright", label: { he: "מבזק · חמור", en: "Flash · critical" } },
};

function goodness(k: strategic.MetricKey, v: number): number {
  return S.METRIC_POLARITY[k] === 1 ? v : 100 - v;
}

function DeltaChips(props: { deltas: Deltas; lang: Lang; small?: boolean }) {
  const entries = (Object.entries(props.deltas) as Array<[strategic.MetricKey, number]>).filter(([, v]) => Math.round(v) !== 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([k, v]) => {
        const good = Math.sign(v) === S.METRIC_POLARITY[k];
        return (
          <span key={k} className={`rounded-[2px] border px-1.5 ${props.small === true ? "text-[10px] leading-[16px]" : "text-[11px] leading-[18px]"} ${good ? "border-good/60 text-good-bright" : "border-bad/60 text-bad-bright"}`}>
            {tr(SHORT[k], props.lang)} <span className="num">{v > 0 ? "+" : ""}{Math.round(v)}</span>
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
  return (
    <div className="overlay pointer-events-auto flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[8px] border border-line0 bg-bg1/92 px-4 py-2">
      <div className="flex flex-col leading-[18px]">
        <span className="text-[16px] font-bold">{tr(S.stepDate(game.step), lang)}</span>
        <span className="text-[11px] text-fg2">
          {he ? `רבעון ${game.step + 1}` : `Quarter ${game.step + 1}`}
          {game.step >= game.maxSteps ? (he ? " · הבחירות נדחו" : " · elections postponed") : he ? ` מתוך ${game.maxSteps}` : ` of ${game.maxSteps}`}
        </span>
      </div>
      {game.party !== null && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: S.PARTIES[game.party].color }} />
            <span className="font-medium">{he ? "ראש הממשלה" : "Prime Minister"} · {tr(S.partyName(game.party, game.roster), lang)}</span>
            <span className={`num ${seats >= 61 ? "text-fg0" : "text-bad-bright"}`}>{seats}</span>
            <span className="text-fg2">{he ? "מנדטים" : "seats"}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {game.coalition.filter((p) => p !== game.party).map((p) => {
              const pat = game.patience[p] ?? 50;
              return (
                <span
                  key={p}
                  title={`${tr(S.partyName(p, game.roster), lang)} · ${he ? "סבלנות" : "patience"} ${Math.round(pat)}`}
                  className={`flex items-center gap-1 rounded-[2px] border px-1 text-[10px] leading-[16px] ${pat <= 25 ? "border-bad text-bad-bright" : pat <= 45 ? "border-warn text-warn-bright" : "border-line1 text-fg1"}`}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: S.PARTIES[p].color }} />
                  {tr(S.partyName(p, game.roster), lang)}
                  <span className="num">{Math.round(pat)}</span>
                </span>
              );
            })}
            {game.departed.map((p) => (
              <span key={p} className="rounded-[2px] border border-line0 px-1 text-[10px] leading-[16px] text-fg2 line-through">{tr(S.partyName(p, game.roster), lang)}</span>
            ))}
          </div>
        </div>
      )}
      <div className="ms-auto flex flex-wrap items-center gap-3">
        {atWar && <span className="animate-pulse rounded-[2px] border border-bad px-2 py-0.5 text-[12px] font-bold text-bad-bright">{he ? "מלחמה" : "AT WAR"}</span>}
        {S.METRIC_KEYS.map((k) => {
          const v = m[k];
          const g = goodness(k, v);
          const d = prev === undefined ? 0 : v - prev[k];
          return (
            <div key={k} className="flex min-w-[64px] flex-col items-center leading-[15px]" title={tr(S.METRIC_LABELS[k], lang)}>
              <span className="flex items-baseline gap-1">
                <span className="num text-[16px]">{Math.round(v)}</span>
                {Math.round(d) !== 0 && (
                  <span className={`num text-[10px] ${Math.sign(d) === S.METRIC_POLARITY[k] ? "text-good-bright" : "text-bad-bright"}`}>{d > 0 ? "▲" : "▼"}</span>
                )}
              </span>
              <bdi dir="ltr" className="mt-0.5 block h-1 w-12 overflow-hidden rounded bg-bg3">
                <span className="block h-full" style={{ width: `${v}%`, background: g >= 55 ? "#2EA043" : g >= 35 ? "#D29922" : "#DA3633" }} />
              </bdi>
              <span className="mt-0.5 text-[10px] text-fg1">{tr(SHORT[k], lang)}</span>
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
    <div className="flex flex-wrap gap-1">
      {rows.map(({ p, d }) => {
        const after = (game.patience[p] ?? 50) + d;
        const quits = after <= 0;
        return (
          <span key={p} className={`rounded-[2px] border px-1.5 text-[10px] leading-[16px] ${quits ? "border-bad bg-bad-dim/40 font-bold text-bad-bright" : d > 0 ? "border-good/50 text-good-bright" : "border-warn/50 text-warn-bright"}`}>
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

  return (
    <section className={`rounded-[6px] border ${open ? "border-info bg-bg2" : catastrophic ? "border-bad/60 bg-bg2/70" : "border-line0 bg-bg2/70"} transition-colors`}>
      <button type="button" onClick={props.onOpen} className="flex w-full items-start gap-2 p-3 text-start">
        <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line1 text-[12px]">{letter}</span>
        <span className="flex-1">
          <span className={`block text-[14px] leading-[20px] font-medium ${catastrophic ? "text-bad-bright" : "text-fg0"}`}>{tr(option.label, lang)}</span>
          {!open && <span className="mt-0.5 block text-[12px] leading-[17px] text-fg2">{tr(option.objective, lang)}</span>}
        </span>
        <span className="text-[12px] text-fg2">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div>
            <div className="text-[10px] font-medium tracking-wide text-fg2">{he ? "מטרה מושגת" : "Achieved objective"}</div>
            <div className="text-[12px] leading-[18px]">{tr(option.objective, lang)}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] leading-[17px]">
            <div>
              <div className="text-[10px] font-medium tracking-wide text-fg2">{he ? "יתרונות" : "Pros"}</div>
              {option.pros.length === 0 ? <div className="text-fg2">—</div> : option.pros.map((p, i) => <div key={i} className="text-good-bright">+ {tr(p, lang)}</div>)}
            </div>
            <div>
              <div className="text-[10px] font-medium tracking-wide text-fg2">{he ? "חסרונות" : "Cons"}</div>
              {option.cons.map((c, i) => <div key={i} className="text-bad-bright">− {tr(c, lang)}</div>)}
            </div>
          </div>
          <div>
            <div className="mb-0.5 text-[10px] font-medium tracking-wide text-fg2">{he ? "השפעת מדדים צפויה" : "Projected metric changes"}</div>
            {option.gamble === undefined ? (
              <DeltaChips deltas={option.deltas} lang={lang} />
            ) : (
              (["success", "failure"] as const).map((b) => {
                const g = option.gamble;
                if (g === undefined) return null;
                const merged: Deltas = { ...option.deltas };
                for (const [k, v] of Object.entries(g[b].deltas) as Array<[strategic.MetricKey, number]>) merged[k] = (merged[k] ?? 0) + v;
                return (
                  <div key={b} className="mb-1 flex flex-wrap items-center gap-1">
                    <span className={`text-[11px] font-medium ${b === "success" ? "text-good-bright" : "text-bad-bright"}`}>{tr(g[b].label, lang)}:</span>
                    <DeltaChips deltas={merged} lang={lang} />
                  </div>
                );
              })
            )}
          </div>
          <div>
            <div className="mb-0.5 text-[10px] font-medium tracking-wide text-fg2">{he ? "תגובת השותפים" : "Partner reactions"}</div>
            <PartnerImpact game={game} option={option} isDoctrine={isDoctrine} lang={lang} />
          </div>
          {option.consequences !== undefined && option.consequences.length > 0 && (
            <div>
              <div className="mb-0.5 text-[10px] font-medium tracking-wide text-fg2">{he ? "השלכות אפשריות" : "Possible consequences"}</div>
              <ul className="flex flex-col gap-0.5 text-[12px] leading-[17px]">
                {option.consequences.map((c, i) => (
                  <li key={i} className={c.severity === "good" ? "text-good-bright" : c.severity === "warn" ? "text-warn-bright" : "text-bad-bright"}>
                    • {tr(c.headline, lang)}
                    {c.p !== undefined && c.p < 1 && <span className="num ms-1 text-fg2">({Math.round(c.p * 100)}%)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {previews.map(({ branch, state }) => {
            const ending = state.ending;
            if (ending === null) return null;
            return (
              <div key={branch ?? "-"} className={`rounded-[3px] px-2 py-1 text-[12px] leading-[17px] ${ending.kind === "TERM_COMPLETED" ? "bg-good-dim/30 text-good-bright" : "bg-bad-dim/40 text-bad-bright"}`}>
                {branch !== undefined && option.gamble !== undefined && <span className="me-1 font-medium">{tr(option.gamble[branch].label, lang)} ·</span>}
                <span className="font-bold">{tr(ending.headline, lang)}</span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => choose(option.id)}
            className={`mt-1 rounded-[4px] border px-3 py-2 text-[13px] font-bold ${catastrophic ? "border-bad bg-bad-dim/50 text-bad-bright hover:bg-bad-dim/70" : "border-info bg-info-dim/50 text-fg0 hover:bg-info-dim/80"}`}
          >
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
    <aside key={`${game.step}:${dilemma.id}`} className="overlay pointer-events-auto flex max-h-full w-[min(480px,100%)] flex-col overflow-hidden rounded-[8px] border border-line1 bg-bg1/95">
      <header className={`border-b px-4 py-3 ${isCrisis ? "border-bad bg-bad-dim/20" : "border-line0"}`}>
        <div className={`flex items-center gap-2 text-[11px] font-bold tracking-wide ${isCrisis ? "text-bad-bright" : "text-info-bright"}`}>
          {isCrisis && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-bad-bright" />}
          {dilemma.id === "DOCTRINE"
            ? he ? "שלב 3 מתוך 3 · מדיניות הממשלה" : "Step 3 of 3 · Government policy"
            : isCrisis ? he ? "הקבינט נדרש להכרעה מיידית" : "The cabinet must decide immediately" : he ? "הכרעת ראש הממשלה" : "Prime Minister's decision"}
        </div>
        <h2 className="mt-1 text-[20px] leading-[27px] font-bold">{tr(dilemma.title, lang)}</h2>
        <p className="mt-1 text-[13px] leading-[20px] text-fg1">{tr(dilemma.context, lang)}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {dilemma.precedent !== undefined && (
          <section className="mb-3 rounded-[6px] border border-warn/50 bg-warn-dim/10 p-2.5">
            <button type="button" className="flex w-full items-baseline justify-between text-start" onClick={() => setShowPrecedent(!showPrecedent)}>
              <span className="text-[12px] font-bold text-warn-bright">{he ? "תקדים היסטורי והפקת לקחים" : "Historical precedent & lessons"} · {tr(dilemma.precedent.title, lang)}</span>
              <span className="num text-[10px] text-fg2">{dilemma.precedent.years}</span>
            </button>
            {showPrecedent && (
              <>
                <p className="mt-1 text-[12px] leading-[18px] text-fg0">{tr(dilemma.precedent.body, lang)}</p>
                <p className="mt-1 text-[12px] leading-[18px] text-warn-bright">
                  <span className="font-medium">{he ? "הלקח: " : "Lesson: "}</span>
                  {tr(dilemma.precedent.lesson, lang)}
                </p>
              </>
            )}
          </section>
        )}
        <div className="flex flex-col gap-2">
          {dilemma.options.map((o, i) => (
            <OptionCard key={o.id} game={game} dilemma={dilemma} option={o} index={i} lang={lang} open={open === o.id} onOpen={() => setOpen(open === o.id ? null : o.id)} />
          ))}
        </div>
        <p className="mt-3 text-[10px] leading-[15px] text-fg2">
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
    <div key={e.id} className={`overlay pointer-events-auto consequence-in w-[min(560px,100%)] rounded-[8px] border-2 ${st.border} bg-bg1/96 p-4 ${e.severity === "critical" ? "shadow-[0_0_40px_rgba(248,81,73,0.35)]" : ""}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold tracking-[0.15em] ${st.text}`}>{tr(st.label, lang)}</span>
        <span className="num text-[11px] text-fg2">{index}/{total}</span>
      </div>
      <h3 className="mt-1 text-[20px] leading-[27px] font-bold">{tr(e.headline, lang)}</h3>
      <p className="mt-1 text-[13px] leading-[20px] text-fg1">{tr(e.body, lang)}</p>
      <div className="mt-2 flex flex-col gap-1.5">
        <DeltaChips deltas={e.deltas} lang={lang} />
        {stance.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {stance.map(([a, v]) => (
              <span key={a} className={`rounded-[2px] border px-1.5 text-[11px] leading-[18px] ${v > 0 ? "border-good/60 text-good-bright" : "border-bad/60 text-bad-bright"}`}>
                {tr(S.ACTOR_DEFS[a].name, lang)} <span className="num">{v > 0 ? "+" : ""}{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="button" autoFocus onClick={ack} className="mt-3 w-full rounded-[4px] border border-line1 bg-bg3 px-3 py-2 text-[14px] font-bold hover:border-info hover:bg-info-dim/40">
        {game.queue.length > 1 ? (he ? "המשך" : "Continue") : game.ending !== null ? (he ? "לסיכום" : "To the verdict") : he ? "להחלטה הבאה" : "To the next decision"}
      </button>
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
    <div className="overlay pointer-events-auto w-[min(360px,100%)] rounded-[8px] border border-line0 bg-bg1/92">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-medium">
        {he ? "יומן אירועים" : "Event log"} <span className="num text-fg2">{game.log.length}</span>
      </button>
      {open && (
        <ul className="max-h-[260px] overflow-y-auto border-t border-line0 px-3 py-2 text-[12px] leading-[17px]">
          {[...game.log].reverse().map((l, i) => (
            <li key={i} className={`mb-1 ${l.severity === "good" ? "text-good-bright" : l.severity === "warn" ? "text-warn-bright" : l.severity === "bad" || l.severity === "critical" ? "text-bad-bright" : "text-fg1"}`}>
              <span className="num me-1 text-fg2">{tr(S.stepDate(l.step), lang)}</span>
              {tr(l.text, lang)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StanceLegend(props: { lang: Lang }) {
  return (
    <div className="overlay pointer-events-auto flex flex-wrap items-center gap-2 rounded-[8px] border border-line0 bg-bg1/92 px-3 py-1.5 text-[11px] text-fg1">
      {S.STANCE_TIERS.map((t) => (
        <span key={t} className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: TIER_COLORS[t] }} />
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
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg0/70 p-4">
      <div className={`overlay flex max-h-full w-full max-w-[760px] flex-col overflow-hidden rounded-[8px] border-2 ${good ? "border-good" : "border-bad"} bg-bg1`}>
        <header className="px-6 py-5 text-center">
          <div className={`text-[12px] font-bold tracking-[0.2em] ${good ? "text-good-bright" : "text-bad-bright"}`}>{tr(KIND[ending.kind], lang)}</div>
          <h2 className="mt-2 text-[30px] leading-[38px] font-bold">{tr(ending.headline, lang)}</h2>
          <p className="mx-auto mt-2 max-w-[600px] text-[14px] leading-[22px] text-fg1">{tr(ending.reason, lang)}</p>
          <div className="mt-3 text-[13px] text-fg2">
            {he
              ? `שרדת ${game.step} רבעונים · ${tr(S.stepDate(Math.max(0, game.step - 1)), lang)}`
              : `You lasted ${game.step} quarters · ${tr(S.stepDate(Math.max(0, game.step - 1)), lang)}`}
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto border-t border-line0 px-6 py-4">
          <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
            {S.METRIC_KEYS.map((k) => (
              <div key={k} className="rounded-[4px] bg-bg2 p-2 text-center">
                <div className="num text-[18px]">{Math.round(game.sim.metrics[k])}</div>
                <div className="text-[10px] text-fg1">{tr(SHORT[k], lang)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[12px] font-medium text-fg2">{he ? "ההחלטות שלך" : "Your decisions"}</div>
          <ol className="mt-1 flex flex-col gap-1 text-[12px] leading-[17px]">
            {game.choices.map((c, i) => {
              const d = S.DILEMMAS[c.dilemma];
              const o = d?.options.find((x) => x.id === c.option);
              return (
                <li key={i} className="flex gap-2">
                  <span className="num w-24 shrink-0 text-fg2">{tr(S.stepDate(c.step), lang)}</span>
                  <span className="text-fg1">{d !== undefined ? tr(d.title, lang) : c.dilemma}</span>
                  <span className="text-fg0">→ {o !== undefined ? tr(o.label, lang) : c.option}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <footer className="border-t border-line0 px-6 py-3">
          <button type="button" onClick={newGame} className="w-full rounded-[4px] border border-info bg-info-dim/60 px-4 py-2.5 text-[15px] font-bold hover:bg-info-dim">
            {he ? "משחק חדש" : "New game"}
          </button>
        </footer>
      </div>
    </div>
  );
}
