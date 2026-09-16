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
      <div className="inline-flex overflow-hidden rounded-[6px] border border-line1" role="radiogroup">
        {S.SEAT_ROSTERS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={props.roster === r}
            disabled={props.onChange === undefined}
            onClick={() => props.onChange?.(r)}
            className={`px-4 py-1.5 text-[13px] ${props.roster === r ? "bg-info-dim text-fg0" : "bg-bg2 text-fg1 hover:bg-bg3"} disabled:cursor-default`}
          >
            {tr(S.ROSTER_LABELS[r], props.lang)}
          </button>
        ))}
      </div>
      <span className="text-[11px] text-fg2">{tr(S.ROSTER_NOTES[props.roster], props.lang)}</span>
    </div>
  );
}

function SeatBar(props: { members: strategic.PartyId[]; roster: strategic.SeatRoster; lang: Lang }) {
  const seats = props.members.reduce((a, p) => a + S.partySeats(props.roster, p), 0);
  const missing = S.MAJORITY - seats;
  let x = 0;
  return (
    <div>
      <bdi dir="ltr" className="relative block h-5 w-full overflow-hidden rounded-[3px] bg-bg2">
        {props.members.map((p) => {
          const w = (S.partySeats(props.roster, p) / 120) * 100;
          const el = <span key={p} className="absolute inset-y-0" style={{ left: `${x}%`, width: `${w}%`, background: S.PARTIES[p].color, borderRight: "1px solid #0A0E14" }} />;
          x += w;
          return el;
        })}
        <span className="absolute inset-y-0 w-[2px] bg-fg0" style={{ left: `${(61 / 120) * 100}%` }} />
      </bdi>
      <div className="mt-1 flex items-baseline justify-between text-[12px]">
        <span className={seats >= S.MAJORITY ? "text-good-bright" : "text-fg1"}>
          <span className="num text-[16px] font-medium">{seats}</span> / 120 {props.lang === "he" ? "מנדטים" : "seats"}
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
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg0/55 p-4">
      <div className="overlay max-h-full w-full max-w-[980px] overflow-y-auto rounded-[8px] border border-line1 bg-bg1/95 p-6">
        <div className="text-center">
          <div className="text-[13px] tracking-[0.2em] text-info-bright">{he ? "משרד ראש הממשלה · ירושלים" : "PRIME MINISTER'S OFFICE · JERUSALEM"}</div>
          <h1 className="mt-2 text-[34px] leading-[42px] font-bold">{he ? "ברוך הבא, ראש הממשלה!" : "Welcome, Prime Minister!"}</h1>
          <p className="mx-auto mt-2 max-w-[640px] text-[14px] leading-[22px] text-fg1">
            {he
              ? "ניצחת בבחירות. עכשיו עליך להקים קואליציה ולהוביל את מדיניות הביטחון של ישראל. כל החלטה תשנה את המפה — ואת עמדת העולם כלפינו. המשחק נגמר כשהממשלה מתפרקת או כשהמדינה קורסת."
              : "You won the election. Now you must form a coalition and lead Israel's security policy. Every decision changes the map — and how the world sees us. The game ends when the government falls or the state collapses."}
          </p>
          <div className="mt-4">
            <RosterToggle roster={roster} lang={lang} onChange={setRoster} />
          </div>
          <div className="mt-4 text-[15px] font-medium">{he ? "באיזו מפלגה אתה?" : "Which party do you lead?"}</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {S.rosterParties(roster).map((id) => {
            const p = S.PARTIES[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => pick(id)}
                className="group flex flex-col rounded-[6px] border border-line0 bg-bg2 p-3 text-start transition-colors hover:border-info hover:bg-bg3"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
                    <span className="text-[15px] font-bold">{tr(S.partyName(id, roster), lang)}</span>
                  </span>
                  <span className="num text-[18px] text-fg0">{S.partySeats(roster, id)}</span>
                </span>
                <span className="mt-1 text-[11px] text-info-bright">{tr(S.TAG_LABELS[p.tag], lang)}</span>
                <span className="mt-1 text-[12px] leading-[17px] text-fg1">{tr(p.blurb, lang)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] leading-[16px] text-fg2">
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
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg0/55 p-4">
      <div className="overlay flex max-h-full w-full max-w-[1040px] flex-col overflow-hidden rounded-[8px] border border-line1 bg-bg1/95">
        <header className="border-b border-line0 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] text-fg2">{he ? "שלב 2 מתוך 3 · הקמת קואליציה" : "Step 2 of 3 · Forming a coalition"}</div>
            <span className="rounded-[3px] border border-line1 px-2 py-0.5 text-[11px] text-fg1">{tr(S.ROSTER_LABELS[roster], lang)}</span>
          </div>
          <h2 className="mt-1 text-[24px] font-bold">{he ? `ראש הממשלה מטעם ${name(pm)} — הרכב את הממשלה` : `Prime Minister from ${name(pm)} — assemble your government`}</h2>
          <p className="mt-1 text-[13px] text-fg1">{he ? "בחר שותפים עד 61 מנדטים. חלק מהמפלגות מסרבות לשבת יחד; חיכוך — ובמיוחד חיכוך עמוק — מקצר את סבלנות השותפים." : "Pick partners until you reach 61 seats. Some parties refuse to sit together; friction — especially deep friction — shortens partners' patience."}</p>
          <div className="mt-3">
            <SeatBar members={draft} roster={roster} lang={lang} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg2">{he ? "קואליציות אפשריות:" : "Possible coalitions:"}</span>
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
                  className={`rounded-[3px] border px-2 py-0.5 text-[11px] disabled:opacity-35 ${c.valid ? "border-good/60 text-good-bright hover:bg-good-dim/20" : "border-bad/60 text-bad-bright hover:bg-bad-dim/20"}`}
                >
                  {tr(b.label, lang)} · <span className="num">{c.seats}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
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
                  className={`flex flex-col rounded-[6px] border p-3 text-start transition-colors disabled:cursor-not-allowed ${
                    isPm ? "border-info bg-info-dim/25" : inDraft ? (vetoed.has(id) ? "border-bad bg-bad-dim/20" : deep.length > 0 ? "border-warn bg-warn-dim/15" : "border-good bg-good-dim/15") : "border-line0 bg-bg2 hover:bg-bg3"
                  } ${refusesPm ? "opacity-45" : ""}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
                      <span className="text-[14px] font-bold">{name(id)}</span>
                      {isPm && <span className="rounded-[2px] bg-info px-1 text-[10px] text-bg0">{he ? "המפלגה שלך" : "your party"}</span>}
                    </span>
                    <span className="num text-[16px]">{S.partySeats(roster, id)}</span>
                  </span>
                  <span className="mt-0.5 text-[11px] text-fg2">{tr(S.TAG_LABELS[p.tag], lang)}</span>
                  {refusesPm && <span className="mt-1 text-[11px] text-bad-bright">{he ? "לא תשב בממשלה שלך" : "Won't sit in your government"}</span>}
                  {!refusesPm && clash.length > 0 && (
                    <span className="mt-1 text-[11px] text-bad-bright">{he ? "מסרבת לשבת עם " : "Refuses to sit with "}{clash.map(name).join(", ")}</span>
                  )}
                  {!refusesPm && deep.length > 0 && (
                    <span className="mt-1 text-[11px] font-medium text-warn-bright">{he ? "חיכוך עמוק עם " : "Deep friction with "}{deep.map(name).join(", ")}</span>
                  )}
                  {!refusesPm && light.length > 0 && (
                    <span className="mt-1 text-[11px] text-warn">{he ? "חיכוך עם " : "Friction with "}{light.map(name).join(", ")}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line0 px-6 py-3">
          <button type="button" className="text-[12px] text-info-bright hover:underline" onClick={back}>
            {he ? "← בחירת מפלגה אחרת" : "← Pick another party"}
          </button>
          <div className="flex flex-wrap items-center gap-4 text-[12px]">
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
              className="rounded-[4px] border border-info bg-info-dim/60 px-5 py-2 text-[14px] font-bold text-fg0 hover:bg-info-dim disabled:opacity-35"
            >
              {he ? "הקם ממשלה" : "Form the government"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
