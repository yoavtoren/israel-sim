/** Campaign setup: "Welcome, Prime Minister" → pick a party → build a coalition.
 *  Seats follow the chosen roster: current polls (default) or the 2022 election. */

import { strategic } from "@engine";
import type { Lang } from "../../lib/strings";
import { useCampaign } from "../../strategic/campaignStore";

const S = strategic;
const tr = (b: strategic.Bi, lang: Lang) => b[lang];

function RosterToggle(props: { roster: strategic.SeatRoster; lang: Lang; onChange?: (r: strategic.SeatRoster) => void }) {
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="inline-flex rounded-full border border-line0 bg-bg2 p-1" role="radiogroup">
        {S.SEAT_ROSTERS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={props.roster === r}
            disabled={props.onChange === undefined}
            onClick={() => props.onChange?.(r)}
            className={`rounded-full px-4 py-1.5 text-[13px] transition-all ${props.roster === r ? "bg-bg1 font-medium text-fg0 shadow-[0_1px_3px_rgb(40_32_20/0.12)]" : "text-fg1 hover:text-fg0"} disabled:cursor-default`}
          >
            {tr(S.ROSTER_LABELS[r], props.lang)}
          </button>
        ))}
      </div>
      <span className="text-[12px] text-fg2">{tr(S.ROSTER_NOTES[props.roster], props.lang)}</span>
    </div>
  );
}

function SeatBar(props: { members: strategic.PartyId[]; roster: strategic.SeatRoster; lang: Lang }) {
  const seats = props.members.reduce((a, p) => a + S.partySeats(props.roster, p), 0);
  const missing = S.MAJORITY - seats;
  let x = 0;
  return (
    <div>
      <bdi dir="ltr" className="relative block h-3 w-full overflow-hidden rounded-full bg-bg3">
        {props.members.map((p) => {
          const w = (S.partySeats(props.roster, p) / 120) * 100;
          const el = <span key={p} className="absolute inset-y-0" style={{ left: `${x}%`, width: `${w}%`, background: S.PARTIES[p].color, borderRight: "2px solid #FFFFFF" }} />;
          x += w;
          return el;
        })}
        <span className="absolute inset-y-0 w-[2px] bg-fg0" style={{ left: `${(61 / 120) * 100}%` }} />
      </bdi>
      <div className="mt-2 flex items-baseline justify-between text-[13px]">
        <span className={seats >= S.MAJORITY ? "text-good-bright" : "text-fg1"}>
          <span className="num text-[20px] font-medium">{seats}</span> / 120 {props.lang === "he" ? "מנדטים" : "seats"}
        </span>
        <span className={missing > 0 ? "text-warn-bright" : "text-fg2"}>
          {missing > 0
            ? props.lang === "he" ? `חסרים ${missing} מנדטים לרוב` : `${missing} seats short of a majority`
            : props.lang === "he" ? "יש רוב" : "Majority reached"}
        </span>
      </div>
    </div>
  );
}

export function PartyPicker(props: { lang: Lang }) {
  const { lang } = props;
  const pick = useCampaign((s) => s.pickParty);
  const roster = useCampaign((s) => s.game.roster);
  const setRoster = useCampaign((s) => s.setRoster);
  const he = lang === "he";
  return (
    <div className="fade-in pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#f4f1ea]/55 p-6 backdrop-blur-[3px]">
      <div className="overlay consequence-in max-h-full w-full max-w-[1000px] overflow-y-auto rounded-[22px] border border-line0 bg-bg1 px-8 py-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-bg2 px-3 py-1 text-[13px] text-fg1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" />
            {he ? "משרד ראש הממשלה · ירושלים" : "Prime Minister's Office · Jerusalem"}
          </div>
          <h1 className="display mt-4 text-[44px] leading-[52px]">{he ? "ברוך הבא, ראש הממשלה" : "Welcome, Prime Minister"}</h1>
          <p className="mx-auto mt-3 max-w-[640px] text-[16px] leading-[26px] text-fg1">
            {he
              ? "ניצחת בבחירות. עכשיו עליך להקים קואליציה ולהוביל את מדיניות הביטחון של ישראל. כל החלטה תשנה את המפה — ואת עמדת העולם כלפינו. המשחק נגמר כשהממשלה מתפרקת או כשהמדינה קורסת."
              : "You won the election. Now you must form a coalition and lead Israel's security policy. Every decision changes the map — and how the world sees us. The game ends when the government falls or the state collapses."}
          </p>
          <div className="mt-6">
            <RosterToggle roster={roster} lang={lang} onChange={setRoster} />
          </div>
          <div className="display mt-6 text-[21px]">{he ? "באיזו מפלגה אתה?" : "Which party do you lead?"}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {S.rosterParties(roster).map((id) => {
            const p = S.PARTIES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className="group relative flex flex-col overflow-hidden rounded-[14px] border border-line0 bg-bg1 p-4 text-start transition-all hover:-translate-y-0.5 hover:border-line1 hover:shadow-[0_8px_24px_rgb(40_32_20/0.10)]"
              >
                <span className="absolute inset-x-0 top-0 h-1 opacity-80 transition-opacity group-hover:opacity-100" style={{ background: p.color }} />
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="text-[16px] leading-[22px] font-medium">{tr(S.partyName(id, roster), lang)}</span>
                  <span className="flex flex-col items-center leading-none">
                    <span className="num text-[22px] font-medium text-fg0">{S.partySeats(roster, id)}</span>
                    <span className="mt-0.5 text-[10.5px] text-fg2">{he ? "מנדטים" : "seats"}</span>
                  </span>
                </span>
                <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-bg2 px-2 text-[12px] leading-[20px] text-fg1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
                  {tr(S.TAG_LABELS[p.tag], lang)}
                </span>
                <span className="mt-2 text-[13px] leading-[19px] text-fg1">{tr(p.blurb, lang)}</span>
              </button>
            );
          })}
        </div>
        <p className="mx-auto mt-6 max-w-[720px] text-center text-[12px] leading-[18px] text-fg2">
          {he
            ? "עמדות המפלגות, הסירובים והחיכוכים במשחק הם הפשטה המבוססת על הצהרות פומביות — לא טענה על מה שמפלגה כלשהי תעשה בפועל."
            : "Party positions, refusals and frictions in the game are an abstraction of public statements — not a claim about what any party would actually do."}
        </p>
      </div>
    </div>
  );
}

export function CoalitionBuilder(props: { lang: Lang }) {
  const { lang } = props;
  const he = lang === "he";
  const game = useCampaign((s) => s.game);
  const draft = useCampaign((s) => s.draft);
  const toggle = useCampaign((s) => s.toggleMember);
  const load = useCampaign((s) => s.loadCoalition);
  const form = useCampaign((s) => s.formGovernment);
  const back = useCampaign((s) => s.backToParties);
  const pm = game.party;
  const roster = game.roster;
  if (pm === null) return null;
  const check = S.checkCoalition(draft, roster);
  const vetoed = new Set(check.vetoes.flat());
  const name = (p: strategic.PartyId) => tr(S.partyName(p, roster), lang);

  return (
    <div className="fade-in pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#f4f1ea]/55 p-6 backdrop-blur-[3px]">
      <div className="overlay flex max-h-full w-full max-w-[1060px] flex-col overflow-hidden rounded-[22px] border border-line0 bg-bg1">
        <header className="border-b border-line0 px-8 pt-6 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center rounded-full bg-info-dim px-2.5 py-0.5 text-[12px] font-medium text-info-bright">{he ? "שלב 2 מתוך 3 · הקמת קואליציה" : "Step 2 of 3 · Forming a coalition"}</div>
            <span className="rounded-full bg-bg2 px-2.5 py-0.5 text-[12px] text-fg1">{tr(S.ROSTER_LABELS[roster], lang)}</span>
          </div>
          <h2 className="display mt-3 text-[30px] leading-[38px]">{he ? `ראש הממשלה מטעם ${name(pm)} — הרכב את הממשלה` : `Prime Minister from ${name(pm)} — assemble your government`}</h2>
          <p className="mt-1.5 max-w-[780px] text-[14px] leading-[22px] text-fg1">{he ? "בחר שותפים עד 61 מנדטים. חלק מהמפלגות מסרבות לשבת יחד; חיכוך — ובמיוחד חיכוך עמוק — מקצר את סבלנות השותפים." : "Pick partners until you reach 61 seats. Some parties refuse to sit together; friction — especially deep friction — shortens partners' patience."}</p>
          <div className="mt-5">
            <SeatBar members={draft} roster={roster} lang={lang} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="me-1 text-[12px] text-fg2">{he ? "קואליציות אפשריות:" : "Possible coalitions:"}</span>
            {S.BENCHMARK_COALITIONS.map((b) => {
              const c = S.checkCoalition(b.members, roster);
              const containsPm = b.members.includes(pm);
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!containsPm}
                  onClick={() => load(b.members)}
                  title={containsPm ? undefined : he ? "המפלגה שלך אינה חלק מהגוש הזה" : "Your party is not part of this bloc"}
                  className={`rounded-full border px-2.5 py-0.5 text-[12px] transition-colors disabled:opacity-35 ${c.valid ? "border-good/40 text-good-bright hover:bg-good-dim" : "border-bad/40 text-bad-bright hover:bg-bad-dim"}`}
                >
                  {tr(b.label, lang)} · <span className="num">{c.seats}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto bg-bg2/60 px-8 py-5">
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {S.rosterParties(roster).map((id) => {
              const p = S.PARTIES[id];
              const inDraft = draft.includes(id);
              const isPm = id === pm;
              const refusesPm = S.refusesEachOther(id, pm);
              const clash = draft.filter((m) => m !== id && S.refusesEachOther(id, m));
              const deep = draft.filter((m) => m !== id && S.frictionBetween(id, m) === "deep");
              const light = draft.filter((m) => m !== id && S.frictionBetween(id, m) === "friction");
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isPm || refusesPm}
                  onClick={() => toggle(id)}
                  className={`relative flex flex-col rounded-[14px] border bg-bg1 p-3.5 text-start transition-all disabled:cursor-not-allowed ${
                    isPm ? "border-info/50 shadow-[0_0_0_3px_rgb(47_99_176/0.10)]" : inDraft ? (vetoed.has(id) ? "border-bad/60 shadow-[0_0_0_3px_rgb(217_83_74/0.12)]" : deep.length > 0 ? "border-warn/60 shadow-[0_0_0_3px_rgb(212_154_42/0.14)]" : "border-good/60 shadow-[0_0_0_3px_rgb(60_154_102/0.12)]") : "border-line0 hover:border-line1 hover:shadow-[0_4px_14px_rgb(40_32_20/0.07)]"
                  } ${refusesPm ? "opacity-50" : ""}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${inDraft ? "border-transparent text-white" : "border-line1 text-transparent"}`}
                        style={inDraft ? { background: vetoed.has(id) ? "#D9534A" : isPm ? "#2F63B0" : deep.length > 0 ? "#D49A2A" : "#3C9A66" } : undefined}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="text-[15px] font-medium">{name(id)}</span>
                      {isPm && <span className="rounded-full bg-info px-2 text-[11px] leading-[18px] whitespace-nowrap text-white">{he ? "המפלגה שלך" : "your party"}</span>}
                    </span>
                    <span className="num text-[18px] font-medium">{S.partySeats(roster, id)}</span>
                  </span>
                  <span className="mt-1 ms-[30px] text-[12px] text-fg2">{tr(S.TAG_LABELS[p.tag], lang)}</span>
                  {refusesPm && <span className="mt-1.5 ms-[30px] text-[12px] leading-[17px] text-bad-bright">{he ? "לא תשב בממשלה שלך" : "Won't sit in your government"}</span>}
                  {!refusesPm && clash.length > 0 && (
                    <span className="mt-1.5 ms-[30px] text-[12px] leading-[17px] text-bad-bright">{he ? "מסרבת לשבת עם " : "Refuses to sit with "}{clash.map(name).join(", ")}</span>
                  )}
                  {!refusesPm && deep.length > 0 && (
                    <span className="mt-1.5 ms-[30px] text-[12px] leading-[17px] font-medium text-warn-bright">{he ? "חיכוך עמוק עם " : "Deep friction with "}{deep.map(name).join(", ")}</span>
                  )}
                  {!refusesPm && light.length > 0 && (
                    <span className="mt-1.5 ms-[30px] text-[12px] leading-[17px] text-warn-bright">{he ? "חיכוך עם " : "Friction with "}{light.map(name).join(", ")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line0 px-8 py-4">
          <button type="button" className="btn btn-ghost px-3 py-2 text-[13px]" onClick={back}>
            {he ? "← בחירת מפלגה אחרת" : "← Pick another party"}
          </button>
          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            {check.vetoes.length > 0 && <span className="text-bad-bright">{he ? "יש בהרכב מפלגות שמסרבות זו לזו" : "Some parties in the lineup refuse each other"}</span>}
            {check.frictions.length > 0 && check.vetoes.length === 0 && (
              <span className="text-warn-bright">
                {he ? "חיכוכים: " : "Frictions: "}
                {check.frictions.map((f) => `${name(f.a)}–${name(f.b)}${f.level === "deep" ? (he ? " (עמוק)" : " (deep)") : ""}`).join(" · ")}
              </span>
            )}
            {check.majority && check.vetoes.length === 0 && (
              <span className="text-fg1">
                {he ? "יציבות צפויה: " : "Expected stability: "}
                <span className={`num ${check.stability >= 55 ? "text-good-bright" : check.stability >= 40 ? "text-warn-bright" : "text-bad-bright"}`}>{check.stability}</span>
              </span>
            )}
            <button
              type="button"
              disabled={!check.valid}
              onClick={form}
              className="btn btn-primary px-6 py-2.5 text-[15px]"
            >
              {he ? "הקם ממשלה" : "Form the government"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
