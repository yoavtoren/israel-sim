/** Campaign setup: "Welcome, Prime Minister" → pick a party → build a coalition. */

import { strategic } from "@engine";
import type { Lang } from "../../lib/strings";
import { useCampaign } from "../../strategic/campaignStore";

const S = strategic;
const tr = (b: strategic.Bi, lang: Lang) => b[lang];

function SeatBar(props: { members: strategic.PartyId[]; lang: Lang }) {
  const seats = props.members.reduce((a, p) => a + S.PARTIES[p].seats, 0);
  return (
    <div>
      <bdi dir="ltr" className="relative block h-5 w-full overflow-hidden rounded-[3px] bg-bg2">
        {(() => {
          let x = 0;
          return props.members.map((p) => {
            const w = (S.PARTIES[p].seats / 120) * 100;
            const el = <span key={p} className="absolute inset-y-0" style={{ left: `${x}%`, width: `${w}%`, background: S.PARTIES[p].color, borderRight: "1px solid #0A0E14" }} />;
            x += w;
            return el;
          });
        })()}
        <span className="absolute inset-y-0 w-[2px] bg-fg0" style={{ left: `${(61 / 120) * 100}%` }} />
      </bdi>
      <div className="mt-1 flex items-baseline justify-between text-[12px]">
        <span className={seats >= S.MAJORITY ? "text-good-bright" : "text-fg1"}>
          <span className="num text-[16px] font-medium">{seats}</span> / 120 {props.lang === "he" ? "מנדטים" : "seats"}
        </span>
        <span className="text-fg2">{props.lang === "he" ? "נדרשים 61 לרוב" : "61 needed for a majority"}</span>
      </div>
    </div>
  );
}

export function PartyPicker(props: { lang: Lang }) {
  const { lang } = props;
  const pick = useCampaign((s) => s.pickParty);
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
          <div className="mt-4 text-[15px] font-medium">{he ? "באיזו מפלגה אתה?" : "Which party do you lead?"}</div>
          <div className="text-[11px] text-fg2">{he ? "מנדטים לפי בחירות נובמבר 2022" : "Seats as elected in November 2022"}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
          {S.PARTY_IDS.map((id) => {
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
                    <span className="text-[15px] font-bold">{tr(p.name, lang)}</span>
                  </span>
                  <span className="num text-[18px] text-fg0">{p.seats}</span>
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
  const form = useCampaign((s) => s.formGovernment);
  const back = useCampaign((s) => s.backToParties);
  const pm = game.party;
  if (pm === null) return null;
  const check = S.checkCoalition(draft);
  const vetoed = new Set(check.vetoes.flat());

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg0/55 p-4">
      <div className="overlay flex max-h-full w-full max-w-[1000px] flex-col overflow-hidden rounded-[8px] border border-line1 bg-bg1/95">
        <header className="border-b border-line0 px-6 py-4">
          <div className="text-[12px] text-fg2">{he ? "שלב 2 מתוך 3 · הקמת קואליציה" : "Step 2 of 3 · Forming a coalition"}</div>
          <h2 className="mt-1 text-[24px] font-bold">{he ? `ראש הממשלה מטעם ${tr(S.PARTIES[pm].name, lang)} — הרכב את הממשלה` : `Prime Minister from ${tr(S.PARTIES[pm].name, lang)} — assemble your government`}</h2>
          <p className="mt-1 text-[13px] text-fg1">{he ? "בחר שותפים עד 61 מנדטים. שים לב: חלק מהמפלגות מסרבות לשבת יחד, ושותפים רחוקים זה מזה יפרשו מהר יותר." : "Pick partners until you reach 61 seats. Some parties refuse to sit together, and partners far apart will walk out sooner."}</p>
          <div className="mt-3">
            <SeatBar members={draft} lang={lang} />
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {S.PARTY_IDS.map((id) => {
              const p = S.PARTIES[id];
              const inDraft = draft.includes(id);
              const isPm = id === pm;
              const refusesPm = p.refuses.includes(pm) || S.PARTIES[pm].refuses.includes(id);
              const clash = draft.filter((m) => m !== id && (p.refuses.includes(m) || S.PARTIES[m].refuses.includes(id)));
              const friction = draft.filter((m) => m !== id && (p.friction.includes(m) || S.PARTIES[m].friction.includes(id)));
              return (
                <button
                  key={id}
                  type="button"
                  disabled={isPm || refusesPm}
                  onClick={() => toggle(id)}
                  className={`flex flex-col rounded-[6px] border p-3 text-start transition-colors disabled:cursor-not-allowed ${
                    isPm ? "border-info bg-info-dim/25" : inDraft ? (vetoed.has(id) ? "border-bad bg-bad-dim/20" : "border-good bg-good-dim/15") : "border-line0 bg-bg2 hover:bg-bg3"
                  } ${refusesPm ? "opacity-45" : ""}`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
                      <span className="text-[14px] font-bold">{tr(p.name, lang)}</span>
                      {isPm && <span className="rounded-[2px] bg-info px-1 text-[10px] text-bg0">{he ? "המפלגה שלך" : "your party"}</span>}
                    </span>
                    <span className="num text-[16px]">{p.seats}</span>
                  </span>
                  <span className="mt-0.5 text-[11px] text-fg2">{tr(S.TAG_LABELS[p.tag], lang)}</span>
                  {refusesPm && <span className="mt-1 text-[11px] text-bad-bright">{he ? "לא תשב בממשלה שלך" : "Won't sit in your government"}</span>}
                  {!refusesPm && clash.length > 0 && (
                    <span className="mt-1 text-[11px] text-bad-bright">
                      {he ? "מסרבת לשבת עם " : "Refuses to sit with "}
                      {clash.map((m) => tr(S.PARTIES[m].name, lang)).join(", ")}
                    </span>
                  )}
                  {!refusesPm && clash.length === 0 && friction.length > 0 && (
                    <span className="mt-1 text-[11px] text-warn-bright">
                      {he ? "חיכוך עם " : "Friction with "}
                      {friction.map((m) => tr(S.PARTIES[m].name, lang)).join(", ")}
                    </span>
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
          <div className="flex items-center gap-4 text-[12px]">
            {check.vetoes.length > 0 && <span className="text-bad-bright">{he ? "יש בהרכב מפלגות שמסרבות זו לזו" : "Some parties in the lineup refuse each other"}</span>}
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
