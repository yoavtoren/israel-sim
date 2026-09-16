/** What the map shows for each thing that happens in the campaign.
 *
 *  Every dilemma, option and consequence in the content has a hand-written
 *  entry here (keyed by id, or by the consequence's English headline), so the
 *  animation matches the story rather than a guess. Anything the table does
 *  not know — new content, engine-generated events — goes through `infer`,
 *  which reads the event's visual, flags, metric deltas and focus. */

import { strategic } from "@engine";
import type { SceneSpec, Front } from "./scenes";
import type { PlaceId } from "./places";

type Bi = strategic.Bi;
export interface SceneItem {
  spec: SceneSpec;
  /** seconds after the trigger */ delay: number;
  caption: Bi | null;
}

const item = (spec: SceneSpec, caption: Bi | null = null, delay = 0): SceneItem => ({ spec, delay, caption });

// ---------------------------------------------------------------------------
// dilemmas: shown when the question is put to the Prime Minister
// ---------------------------------------------------------------------------

const BASE_DILEMMA_SCENES: Record<string, SceneItem[]> = {
  HEZBOLLAH_FRONT: [
    item({ kind: "barrage", front: "lebanon", count: 14, weapon: "rocket", targets: ["kiryat_shmona", "nahariya", "metula", "shlomi", "haifa"] }, { he: "חזבאללה פותח חזית בצפון", en: "Hezbollah opens a northern front" }),
    item({ kind: "infiltration", front: "lebanon", squads: 1, tunnel: false }, null, 6),
  ],
  HOUTHI_RED_SEA: [item({ kind: "red_sea", mode: "attack" }, { he: "החות'ים סוגרים את הים האדום", en: "The Houthis close the Red Sea" })],
  MASS_PROTESTS: [item({ kind: "crowd", place: "kaplan", size: 80, mode: "protest" }, { he: "מאות אלפים ברחובות", en: "Hundreds of thousands in the streets" })],
  RESERVIST_REFUSAL: [item({ kind: "crowd", place: "kaplan", size: 40, mode: "refusal" }, { he: "גל סרבנות במילואים", en: "Wave of reservist refusal" })],
  TERROR_ATTACK: [item({ kind: "terror", place: "jerusalem" }, { he: "פיגוע ירי בירושלים", en: "Shooting attack in Jerusalem" })],
  SETTLER_VIOLENCE: [item({ kind: "settlers", mode: "violence" }, { he: "אלימות מתנחלים וסנקציות מערביות", en: "Settler violence and Western sanctions" })],
  CIVIL_REVOLT: [item({ kind: "settlers", mode: "revolt" }, { he: "מרד אזרחי בהתנחלויות", en: "Civil revolt in the settlements" })],
  JORDAN_TREATY: [item({ kind: "diplomacy", links: [{ from: "amman", to: "jerusalem", tone: -1, icon: "warning" }] }, { he: "ירדן מאיימת להשעות את הסכם השלום", en: "Jordan threatens to suspend the treaty" })],
  ICC_WARRANTS: [item({ kind: "diplomacy", links: [{ from: "the_hague", to: "jerusalem", tone: -1, icon: "gavel" }] }, { he: "צווי מעצר מבית הדין בהאג", en: "Arrest warrants from The Hague" })],
  EU_BOYCOTT: [item({ kind: "diplomacy", links: [{ from: "brussels", to: "jerusalem", tone: -1, icon: "lock" }] }, { he: "חרם כלכלי מאירופה", en: "Economic boycott from Europe" })],
  US_ARMS_HOLD: [item({ kind: "airlift", mode: "halt" }, { he: "ארה\"ב עוצרת תחמושת ומיירטים", en: "The US holds munitions and interceptors" })],
  CREDIT_DOWNGRADE: [item({ kind: "economy", mode: "downgrade" })],
  SAUDI_DEAL: [item({ kind: "diplomacy", links: [{ from: "riyadh", to: "jerusalem", tone: 1, icon: "envelope" }, { from: "washington", to: "riyadh", tone: 1, icon: "pen" }] }, { he: "הסכם נורמליזציה על השולחן", en: "A normalization deal on the table" })],
  CEASEFIRE_TALKS: [item({ kind: "diplomacy", links: [{ from: "cairo", to: "jerusalem", tone: 0, icon: "envelope" }, { from: "doha", to: "jerusalem", tone: 0, icon: "envelope" }, { from: "washington", to: "jerusalem", tone: 0, icon: "envelope" }] }, { he: "משא ומתן להפסקת אש", en: "Ceasefire negotiations" })],
  TR_TERMS: [item({ kind: "diplomacy", links: [{ from: "riyadh", to: "jerusalem", tone: 0, icon: "envelope" }, { from: "abu_dhabi", to: "jerusalem", tone: 0, icon: "envelope" }] }, { he: "תנאי כוח הנאמנות האזורי", en: "Terms of the regional trusteeship force" })],
  PA_TERMS: [item({ kind: "diplomacy", links: [{ from: "ramallah", to: "jerusalem", tone: 0, icon: "envelope" }] }, { he: "תנאי חזרת הרשות לעזה", en: "Terms of the PA's return to Gaza" })],
};

// ---------------------------------------------------------------------------
// options: the decision itself
// ---------------------------------------------------------------------------

const BASE_OPTION_SCENES: Record<string, SceneItem[]> = {
  // doctrine
  D_RADICAL_RIGHT: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "new_york", tone: -1, icon: "warning" }, { from: "brussels", to: "jerusalem", tone: -1, icon: "warning" }] }, { he: "מדיניות: הכרעה צבאית ודחיקת אוכלוסייה", en: "Policy: military decision, pushing the population out" })],
  D_ANNEXATION: [item({ kind: "settlers", mode: "build" }, { he: "מדיניות: שליטה, סיפוח והתיישבות", en: "Policy: control, annexation, settlement" })],
  D_TRUSTEESHIP: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "riyadh", tone: 1, icon: "envelope" }, { from: "jerusalem", to: "abu_dhabi", tone: 1, icon: "envelope" }, { from: "jerusalem", to: "cairo", tone: 1, icon: "envelope" }] }, { he: "מדיניות: מסגרת אזורית מדורגת", en: "Policy: staged regional framework" })],
  D_PA_RETURN: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "ramallah", tone: 1, icon: "envelope" }, { from: "washington", to: "jerusalem", tone: 1, icon: "envelope" }] }, { he: "מדיניות: רש\"פ מחודשת והיפרדות", en: "Policy: a reformed PA and separation" })],
  D_WITHDRAWAL: [
    item({ kind: "diplomacy", links: [{ from: "new_york", to: "jerusalem", tone: 1, icon: "envelope" }] }, { he: "מדיניות: נסיגה לקווי 67", en: "Policy: withdrawal to the 1967 lines" }),
    item({ kind: "crowd", place: "jerusalem", size: 50, mode: "right_rally" }, null, 4),
  ],
  // Gaza
  RR_OCCUPY: [item({ kind: "airstrike", area: "gaza", sorties: 6, bombs: 10, wide: false }, { he: "הכנה אווירית לכניסה", en: "Air preparation for the entry" }), item({ kind: "ground", theater: "gaza", mode: "occupy" }, { he: "כיבוש מלא של הרצועה", en: "Full occupation of the Strip" }, 10)],
  RR_SIEGE: [item({ kind: "siege", mode: "close" })],
  RR_EMIGRATION: [item({ kind: "boats" })],
  RR_TRANSFER: [item({ kind: "transfer" })],
  RR_CARPET: [item({ kind: "airstrike", area: "gaza", sorties: 12, bombs: 36, wide: true }, { he: "הפצצה רחבה ללא הבחנה", en: "Wide bombing without distinction" })],
  RR_NUCLEAR: [item({ kind: "nuclear" })],
  // annexation
  AN_LAW_C: [item({ kind: "settlers", mode: "sovereignty" }), item({ kind: "barrier", mode: "demolish" }, null, 3)],
  AN_DISMANTLE_PA: [item({ kind: "pa_forces", mode: "collapse" }, { he: "פירוק הרשות: המנגנונים קורסים", en: "PA dismantled: the services collapse" }), item({ kind: "ground", theater: "west_bank", mode: "sweep" }, { he: "ממשל אזרחי ישיר: צה\"ל נכנס לערים", en: "Direct administration: the IDF enters the cities" }, 4)],
  AN_DE_FACTO: [item({ kind: "settlers", mode: "build" })],
  // trusteeship
  TR_AMBIGUITY: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "riyadh", tone: 1, icon: "pen" }, { from: "jerusalem", to: "abu_dhabi", tone: 1, icon: "pen" }] }, { he: "הצהרת אופק מדיני תמורת כוח סעודי-אמירתי", en: "Political horizon for a Saudi-Emirati force" })],
  TR_DEMIL_FIRST: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "riyadh", tone: -1, icon: "warning" }] }, { he: "פירוז מלא קודם", en: "Full demilitarization first" })],
  TR_US_PACT: [item({ kind: "airlift", mode: "pact" }), item({ kind: "diplomacy", links: [{ from: "washington", to: "riyadh", tone: 1, icon: "pen" }, { from: "washington", to: "jerusalem", tone: 1, icon: "pen" }] }, null, 2)],
  // PA terms
  PA_WITH_IDF: [item({ kind: "pa_forces", mode: "enter_gaza" }, { he: "הרשות חוזרת, צה\"ל שומר על חופש פעולה", en: "The PA returns; the IDF keeps freedom of action" })],
  PA_ALONE: [item({ kind: "ground", theater: "gaza", mode: "pullback" }), item({ kind: "pa_forces", mode: "enter_gaza" }, null, 6)],
  PA_FREEZE_TALKS: [item({ kind: "settlers", mode: "freeze" }), item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "ramallah", tone: 1, icon: "envelope" }] }, null, 3)],
  // withdrawal
  WD_IMMEDIATE: [item({ kind: "withdrawal", mode: "immediate" })],
  WD_STAGED: [item({ kind: "withdrawal", mode: "staged" })],
  WD_UN_FORCE: [item({ kind: "withdrawal", mode: "un" })],
  // Jordan
  JO_FREEZE: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "amman", tone: 1, icon: "envelope" }] }, { he: "הקפאת צעדי סיפוח בבקעה", en: "Annexation steps in the Jordan Valley frozen" })],
  JO_PRESSURE: [item({ kind: "water", mode: "cut" }), item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "amman", tone: -1, icon: "warning" }] }, null, 2)],
  JO_US: [item({ kind: "diplomacy", links: [{ from: "washington", to: "amman", tone: 1, icon: "money" }, { from: "jerusalem", to: "amman", tone: 1, icon: "envelope" }] }, { he: "תיווך אמריקני וחבילה כלכלית לירדן", en: "US mediation and an economic package for Jordan" })],
  // settler violence
  SV_ENFORCE: [item({ kind: "settlers", mode: "enforce" })],
  SV_IGNORE: [item({ kind: "settlers", mode: "violence" }, { he: "האלימות נמשכת", en: "The violence goes on" })],
  SV_SUPPORT: [item({ kind: "settlers", mode: "violence" }, { he: "גיבוי ממשלתי ל\"הגנה עצמית\"", en: "Government backing for \"self-defense\"" })],
  // ICC
  ICC_INQUIRY: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "the_hague", tone: 1, icon: "envelope" }] }, { he: "ועדת חקירה ממלכתית עצמאית", en: "An independent state commission" })],
  ICC_DEFY: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "the_hague", tone: -1, icon: "lock" }, { from: "washington", to: "the_hague", tone: -1, icon: "lock" }] }, { he: "חרם על בית הדין", en: "Boycott of the Court" })],
  ICC_IGNORE: [item({ kind: "diplomacy", links: [{ from: "the_hague", to: "jerusalem", tone: -1, icon: "gavel" }] }, { he: "הצווים נותרים בתוקף", en: "The warrants stand" })],
  // EU
  EU_BLOCK: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "budapest", tone: 1, icon: "envelope" }, { from: "jerusalem", to: "prague", tone: 1, icon: "envelope" }, { from: "jerusalem", to: "berlin", tone: 0, icon: "envelope" }] }, { he: "גיוס בעלות ברית באיחוד לחסימה", en: "Rallying EU allies to block it" })],
  EU_CONCEDE: [item({ kind: "siege", mode: "aid" }), item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "brussels", tone: 1, icon: "envelope" }] }, null, 4)],
  EU_RETALIATE: [item({ kind: "trade", mode: "sanctions" }, { he: "מלחמת סחר עם אירופה", en: "Trade war with Europe" })],
  // Hezbollah
  HZ_OFFENSIVE: [item({ kind: "airstrike", area: "lebanon", sorties: 10, bombs: 14, wide: false }, { he: "מערכה אווירית בדרום לבנון", en: "Air campaign in southern Lebanon" }), item({ kind: "ground", theater: "lebanon", mode: "occupy" }, { he: "תמרון קרקעי בדרום לבנון", en: "Ground manoeuvre in southern Lebanon" }, 14)],
  HZ_CONTAIN: [item({ kind: "barrage", front: "lebanon", count: 8, weapon: "rocket", targets: ["kiryat_shmona", "nahariya", "metula"] }, { he: "תגובה מדודה והגנה", en: "Measured response and defense" }), item({ kind: "airstrike", area: "lebanon", sorties: 2, bombs: 3, wide: false }, null, 8)],
  HZ_US_FRANCE: [item({ kind: "diplomacy", links: [{ from: "washington", to: "beirut", tone: 1, icon: "envelope" }, { from: "paris", to: "beirut", tone: 1, icon: "envelope" }] }, { he: "תיווך אמריקני-צרפתי ואכיפת 1701", en: "US–French mediation, enforcing 1701" }), item({ kind: "ceasefire" }, null, 4)],
  // Houthis
  HO_STRIKE: [item({ kind: "red_sea", mode: "hodeidah" })],
  HO_COALITION: [item({ kind: "red_sea", mode: "task_force" })],
  HO_ABSORB: [item({ kind: "red_sea", mode: "reroute" })],
  // US arms hold
  US_COMPLY: [item({ kind: "airlift", mode: "arrive" }, { he: "המשלוחים מחודשים", en: "Shipments resume" })],
  US_CONGRESS: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "washington", tone: 0, icon: "envelope" }] }, { he: "גיוס הקונגרס נגד הממשל", en: "Rallying Congress against the administration" })],
  US_INDEPENDENT: [item({ kind: "economy", mode: "factories" })],
  // reservists
  RR_PROSECUTE: [item({ kind: "crowd", place: "kaplan", size: 40, mode: "crackdown" }, { he: "העמדה לדין של סרבנים", en: "Refusers prosecuted" })],
  RR_HAREDI_DRAFT: [item({ kind: "crowd", place: "bnei_brak", size: 60, mode: "haredi" })],
  RR_DIALOGUE: [item({ kind: "crowd", place: "kaplan", size: 40, mode: "disperse" }, { he: "הקפאת המהלך ופתיחת דיאלוג", en: "The move paused, dialogue opened" })],
  // mass protests
  MP_EMERGENCY: [item({ kind: "crowd", place: "kaplan", size: 70, mode: "crackdown" })],
  MP_REFERENDUM: [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "הכרעה בקלפי", en: "Decided at the ballot box" })],
  MP_COMPROMISE: [item({ kind: "crowd", place: "kaplan", size: 60, mode: "disperse" }, { he: "פשרה: המחאה נרגעת", en: "Compromise: the protest calms" })],
  // civil revolt
  CR_FORCE: [item({ kind: "withdrawal", mode: "immediate" }, { he: "פינוי בכל מחיר", en: "Evacuation at any cost" })],
  CR_PAUSE: [item({ kind: "settlers", mode: "freeze" }, { he: "הפינוי מושהה", en: "The evacuation is paused" })],
  CR_REFERENDUM: [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "משאל עם על הנסיגה", en: "Referendum on the withdrawal" })],
  // economy
  CD_AUSTERITY: [item({ kind: "economy", mode: "austerity" })],
  CD_COALITION_FUNDS: [item({ kind: "economy", mode: "boost" }, { he: "ביטול כספים קואליציוניים", en: "Coalition earmarks cancelled" })],
  CD_DEFICIT: [item({ kind: "economy", mode: "deficit" })],
  // terror
  TA_TARGETED: [item({ kind: "ground", theater: "west_bank", mode: "raid" }, { he: "פשיטה על רשת המחבל", en: "Raid on the attacker's network" })],
  TA_COLLECTIVE: [item({ kind: "demolitions" })],
  TA_RESTRAINT: [item({ kind: "crowd", place: "jerusalem", size: 14, mode: "disperse" }, { he: "איפוק ותגבור כוחות", en: "Restraint and reinforcement" })],
  // Saudi
  SA_SIGN: [item({ kind: "flights", count: 1, mode: "riyadh" }, { he: "חתימה על הסכם עם סעודיה", en: "Signing the Saudi deal" }), item({ kind: "diplomacy", links: [{ from: "riyadh", to: "jerusalem", tone: 1, icon: "pen" }, { from: "washington", to: "riyadh", tone: 1, icon: "pen" }] }, null, 3)],
  SA_LIGHT: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "riyadh", tone: 0, icon: "envelope" }] }, { he: "הסכם \"קל\"", en: "A \"light\" deal" })],
  SA_DECLINE: [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "riyadh", tone: -1, icon: "lock" }] }, { he: "ישראל דוחה את ההסכם", en: "Israel declines the deal" })],
  // ceasefire
  CF_COMPREHENSIVE: [item({ kind: "ceasefire" }), item({ kind: "diplomacy", links: [{ from: "washington", to: "jerusalem", tone: 1, icon: "pen" }, { from: "cairo", to: "jerusalem", tone: 1, icon: "pen" }, { from: "doha", to: "jerusalem", tone: 1, icon: "pen" }] }, { he: "הפסקת אש כוללת", en: "Comprehensive ceasefire" }, 2)],
  CF_FIGHT_ON: [item({ kind: "airstrike", area: "lebanon", sorties: 6, bombs: 10, wide: false }, { he: "הלחימה נמשכת עד הכרעה", en: "Fighting on to a decision" }), item({ kind: "barrage", front: "lebanon", count: 12, weapon: "rocket", targets: ["haifa", "kiryat_shmona", "nahariya"] }, null, 6)],
  CF_UNILATERAL: [item({ kind: "ceasefire" }, { he: "הפסקת אש חד-צדדית", en: "Unilateral ceasefire" })],
};

// ---------------------------------------------------------------------------
// the road to a settlement
// ---------------------------------------------------------------------------

const sign = (links: Array<[PlaceId, PlaceId]>, caption: Bi | null, tone: -1 | 0 | 1 = 1): SceneItem =>
  item({ kind: "diplomacy", links: links.map(([from, to]) => ({ from, to, tone, icon: tone > 0 ? "pen" : tone < 0 ? "warning" : "envelope" })) }, caption);

const RESOLUTION_OPTION_SCENES: Record<string, SceneItem[]> = {
  // regional
  REG_GF_HANDOVER: [item({ kind: "pa_forces", mode: "enter_gaza" }, { he: "כוח ערבי נכנס לעזה", en: "An Arab force enters Gaza" }), item({ kind: "ground", theater: "gaza", mode: "pullback" }, null, 6)],
  REG_GF_JOINT: [item({ kind: "pa_forces", mode: "enter_gaza" }, { he: "פיקוד משותף בעזה", en: "Joint command in Gaza" })],
  REG_GF_DELAY: [sign([["cairo", "jerusalem"], ["abu_dhabi", "jerusalem"]], { he: "המדינות הערביות מאוכזבות", en: "Arab states are disappointed" }, -1)],
  REG_RC_CONDITIONAL: [item({ kind: "siege", mode: "aid" }, { he: "שיקום בשלבים תמורת איסוף נשק", en: "Staged reconstruction for weapons collection" }), sign([["riyadh", "jerusalem"], ["abu_dhabi", "jerusalem"]], null)],
  REG_RC_OPEN: [item({ kind: "siege", mode: "aid" }, { he: "שיקום מהיר של עזה", en: "Fast reconstruction of Gaza" })],
  REG_RC_REFUSE: [item({ kind: "siege", mode: "close" }, { he: "השיקום נחסם", en: "Reconstruction blocked" })],
  REG_PR_ELECTIONS: [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "בחירות פלסטיניות בתנאי סף", en: "Palestinian elections with entry conditions" })],
  REG_PR_TECHNOCRATS: [sign([["cairo", "ramallah"], ["riyadh", "ramallah"]], { he: "ממשלת מומחים ברמאללה", en: "A technocratic government in Ramallah" })],
  REG_PR_BYPASS: [sign([["ramallah", "jerusalem"]], { he: "הרשות נעקפת", en: "The PA is bypassed" }, -1)],
  REG_NM_PATH: [item({ kind: "flights", count: 1, mode: "riyadh" }, { he: "נורמליזציה ומסלול למדינה", en: "Normalization and a path to a state" }), sign([["riyadh", "jerusalem"], ["washington", "riyadh"]], null)],
  REG_NM_VAGUE: [sign([["jerusalem", "riyadh"]], { he: "הצהרה עמומה לריאד", en: "A vague statement to Riyadh" }, 0)],
  REG_NM_DECLINE: [sign([["riyadh", "jerusalem"]], { he: "הנורמליזציה ירדה מהשולחן", en: "Normalization is off the table" }, -1)],
  REG_FN_REFERENDUM: [sign([["jerusalem", "washington"], ["ramallah", "washington"], ["riyadh", "washington"]], { he: "חתימה על הסכם המסגרת", en: "Signing the framework agreement" }), item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "משאל עם על ההסכם", en: "Referendum on the deal" }, 6)],
  REG_FN_KNESSET: [sign([["jerusalem", "washington"], ["ramallah", "washington"]], { he: "חתימה ואשרור בכנסת", en: "Signing and Knesset ratification" }), item({ kind: "crowd", place: "jerusalem", size: 60, mode: "right_rally" }, null, 5)],
  REG_FN_WAIT: [sign([["washington", "jerusalem"]], { he: "החתימה נדחית", en: "The signing is postponed" }, -1)],
  // two states
  TS_CO_FULL: [item({ kind: "pa_forces", mode: "enter_gaza" }, { he: "כוחות הרשות לוקחים אחריות", en: "PA forces take responsibility" })],
  TS_CO_PARTIAL: [sign([["jerusalem", "ramallah"]], { he: "תיאום ביטחוני מחודש", en: "Security coordination renewed" })],
  TS_CO_REFUSE: [sign([["ramallah", "jerusalem"]], { he: "הכספים נשארים מוקפאים", en: "The funds stay frozen" }, -1)],
  TS_BD_BLOCS: [item({ kind: "withdrawal", mode: "staged" }, { he: "מפת הגושים: פינוי התנחלויות מבודדות", en: "The blocs map: isolated settlements evacuated" })],
  TS_BD_MAX: [sign([["jerusalem", "ramallah"]], { he: "דרישה ל-10% כולל הבקעה", en: "A demand for 10% including the valley" }, 0)],
  TS_BD_PAUSE: [sign([["washington", "jerusalem"]], { he: "דיוני המפות מושהים", en: "Map talks paused" }, -1)],
  TS_JR_NEIGHBORHOODS: [sign([["amman", "jerusalem"], ["riyadh", "jerusalem"], ["ramallah", "jerusalem"]], { he: "הסדר בירושלים ובאגן הקדוש", en: "A Jerusalem and Holy Basin arrangement" }), item({ kind: "crowd", place: "jerusalem", size: 50, mode: "right_rally" }, null, 5)],
  TS_JR_SUBURBS: [sign([["jerusalem", "ramallah"]], { he: "הצעה: בירה באבו דיס", en: "Offer: a capital in Abu Dis" }, 0)],
  TS_JR_DEFER: [sign([["jerusalem", "washington"]], { he: "ירושלים נדחית לסוף", en: "Jerusalem left for last" }, 0)],
  TS_RS_PACKAGE: [sign([["washington", "jerusalem"], ["jerusalem", "ramallah"]], { he: "פליטים וביטחון: חבילה מוסכמת", en: "Refugees and security: an agreed package" })],
  TS_RS_NO_RETURN: [sign([["jerusalem", "ramallah"]], { he: "הקווים האדומים הישראליים", en: "Israel's red lines" }, 0)],
  TS_FN_REFERENDUM: [sign([["jerusalem", "washington"], ["ramallah", "washington"]], { he: "טקס חתימה על הסכם הקבע", en: "Signing the permanent-status agreement" }), item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "משאל עם", en: "Referendum" }, 6)],
  TS_FN_KNESSET: [sign([["jerusalem", "washington"], ["ramallah", "washington"]], { he: "הסכם הקבע נחתם", en: "The permanent-status agreement is signed" }), item({ kind: "crowd", place: "jerusalem", size: 60, mode: "right_rally" }, null, 5)],
  TS_FN_WAIT: [sign([["washington", "jerusalem"]], { he: "החתימה נדחית", en: "The signing is delayed" }, -1)],
  // unilateral
  UN_ST_FORCE: [item({ kind: "withdrawal", mode: "un" }, { he: "כוח ייצוב בינלאומי נפרס", en: "An international stabilization force deploys" })],
  UN_ST_PA: [item({ kind: "pa_forces", mode: "enter_gaza" }, { he: "כוחות הרשות נבנים", en: "PA forces are built up" })],
  UN_ST_RETURN: [item({ kind: "ground", theater: "west_bank", mode: "sweep" }, { he: "צה\"ל חוזר לערים", en: "The IDF returns to the cities" })],
  UN_BR_OPEN: [item({ kind: "barrier", mode: "seal" }, { he: "הגדר הופכת לגבול עם מעברים", en: "The barrier becomes a border with crossings" })],
  UN_BR_TIGHT: [item({ kind: "barrier", mode: "seal" }, { he: "גבול הרמטי", en: "A sealed border" })],
  UN_RC_MUTUAL: [sign([["new_york", "jerusalem"], ["new_york", "ramallah"], ["brussels", "ramallah"]], { he: "הכרה הדדית באו\"ם", en: "Mutual recognition at the UN" })],
  UN_RC_WAIT: [sign([["jerusalem", "new_york"]], { he: "הכרה מותנית", en: "Conditional recognition" }, 0)],
  UN_FN_SIGN: [sign([["jerusalem", "new_york"], ["ramallah", "new_york"]], { he: "הסכם שלום בין שתי מדינות", en: "A peace treaty between two states" })],
  UN_FN_WAIT: [sign([["new_york", "jerusalem"]], { he: "בלי חתימה פורמלית", en: "No formal signature" }, 0)],
  // sovereignty
  SV_AU_CITIES: [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "בחירות מקומיות בערים הפלסטיניות", en: "Local elections in the Palestinian cities" })],
  SV_AU_MILITARY: [item({ kind: "ground", theater: "west_bank", mode: "sweep" }, { he: "שלטון צבאי ישיר", en: "Direct military rule" })],
  SV_EC_ZONES: [item({ kind: "economy", mode: "factories" }, { he: "אזורי תעשייה והיתרי עבודה", en: "Industrial zones and work permits" })],
  SV_EC_LIMITED: [item({ kind: "economy", mode: "boost" }, { he: "הקלות כלכליות מוגבלות", en: "Limited economic relief" })],
  SV_ST_CITIZENSHIP: [item({ kind: "crowd", place: "jerusalem", size: 60, mode: "right_rally" }, { he: "מסלול אזרחות ושוויון", en: "A citizenship and equality path" }), sign([["brussels", "jerusalem"]], null, 1)],
  SV_ST_JORDAN: [sign([["jerusalem", "amman"], ["washington", "amman"]], { he: "הצעת קונפדרציה לירדן", en: "A confederation offer to Jordan" }, 0)],
  SV_ST_RESIDENCY: [sign([["brussels", "jerusalem"], ["new_york", "jerusalem"]], { he: "תושבות בלי הצבעה: גינוי בינלאומי", en: "Residency without the vote: condemnation" }, -1)],
  SV_FN_VOTE: [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "משאל פלסטיני בפיקוח בינלאומי", en: "A supervised Palestinian vote" })],
  SV_FN_IMPOSE: [sign([["new_york", "jerusalem"], ["amman", "jerusalem"]], { he: "הסדר כפוי: העולם דוחה", en: "An imposed arrangement: the world rejects it" }, -1)],
  // spoilers
  SP_RK_PRECISE: [item({ kind: "airstrike", area: "gaza", sorties: 2, bombs: 4, wide: false }, { he: "תקיפה ממוקדת, השיחות נמשכות", en: "A precise strike; talks continue" })],
  SP_RK_SUSPEND: [sign([["jerusalem", "washington"]], { he: "המגעים מושעים", en: "Talks suspended" }, -1)],
  SP_RK_WIDE: [item({ kind: "airstrike", area: "gaza", sorties: 10, bombs: 18, wide: true }, { he: "מבצע רחב ברצועה", en: "A wide operation in the Strip" })],
  SP_TM_STATUS_QUO: [item({ kind: "crowd", place: "jerusalem", size: 40, mode: "disperse" }, { he: "הסטטוס קוו נאכף", en: "The status quo is enforced" })],
  SP_TM_FORCE: [item({ kind: "crowd", place: "jerusalem", size: 60, mode: "crackdown" }, { he: "פינוי בכוח בהר הבית", en: "Forced clearing on the Temple Mount" }), item({ kind: "barrage", front: "gaza", count: 10, weapon: "rocket", targets: ["sderot", "ashkelon", "jerusalem"] }, null, 6)],
  SP_PR_RELEASE: [sign([["jerusalem", "ramallah"]], { he: "שחרור אסירים כמחווה", en: "Prisoners released as a gesture" })],
  SP_PR_REFUSE: [sign([["ramallah", "jerusalem"]], { he: "סירוב לשחרור", en: "Release refused" }, -1)],
  SP_OP_EVACUATE: [item({ kind: "settlers", mode: "enforce" }, { he: "המאחז מפונה", en: "The outpost is evacuated" })],
  SP_OP_LEGALIZE: [item({ kind: "settlers", mode: "build" }, { he: "המאחז מוכשר", en: "The outpost is legalized" })],
};

const RESOLUTION_DILEMMA_SCENES: Record<string, SceneItem[]> = {
  SP_ROCKETS: [item({ kind: "barrage", front: "gaza", count: 12, weapon: "rocket", targets: ["sderot", "ashkelon", "netivot"] }, { he: "ירי כדי לטרפד את המגעים", en: "Fire to derail the talks" })],
  SP_TEMPLE_MOUNT: [item({ kind: "crowd", place: "jerusalem", size: 60, mode: "protest" }, { he: "עימותים בהר הבית", en: "Clashes on the Temple Mount" })],
};

export const OPTION_SCENES: Record<string, SceneItem[]> = { ...BASE_OPTION_SCENES, ...RESOLUTION_OPTION_SCENES };
export const DILEMMA_SCENES: Record<string, SceneItem[]> = { ...BASE_DILEMMA_SCENES, ...RESOLUTION_DILEMMA_SCENES };

// ---------------------------------------------------------------------------
// consequences, keyed by English headline
// ---------------------------------------------------------------------------

export const CONSEQUENCE_SCENES: Record<string, SceneItem[]> = {
  "IDF completes the occupation of the Strip": [item({ kind: "barrage", front: "gaza", count: 8, weapon: "rocket", targets: ["sderot", "ashkelon", "netivot"] }, { he: "ירי אחרון מהרצועה", en: "Last fire from the Strip" })],
  "EU freezes dialogue under the Association Agreement": [item({ kind: "diplomacy", links: [{ from: "brussels", to: "jerusalem", tone: -1, icon: "lock" }] }, { he: "האיחוד מקפיא את הדיאלוג", en: "The EU freezes dialogue" })],
  "Reservist fatigue deepens": [item({ kind: "crowd", place: "kaplan", size: 30, mode: "refusal" }, { he: "שחיקת המילואים", en: "Reservist fatigue" })],
  "International Court of Justice orders provisional measures": [item({ kind: "diplomacy", links: [{ from: "the_hague", to: "jerusalem", tone: -1, icon: "gavel" }] }, { he: "צו ביניים מבית הדין הבינלאומי", en: "ICJ provisional measures" })],
  "Washington holds a munitions shipment": [item({ kind: "airlift", mode: "halt" })],
  "Egypt seals Rafah and warns: \"the peace treaty is at risk\"": [item({ kind: "diplomacy", links: [{ from: "cairo", to: "jerusalem", tone: -1, icon: "warning" }] }, { he: "מצרים סוגרת את רפיח", en: "Egypt seals Rafah" }), item({ kind: "egypt_army" }, null, 3)],
  "ICC prosecutor: \"suspected crime against humanity\"": [item({ kind: "diplomacy", links: [{ from: "the_hague", to: "jerusalem", tone: -1, icon: "gavel" }] }, { he: "התובע בהאג: חשד לפשע נגד האנושות", en: "ICC prosecutor: suspected crime against humanity" })],
  "Border alerts: Egypt mobilizes the 2nd and 3rd Armies": [item({ kind: "egypt_army" })],
  "The EU imposes sanctions": [item({ kind: "trade", mode: "sanctions" }), item({ kind: "diplomacy", links: [{ from: "brussels", to: "jerusalem", tone: -1, icon: "lock" }] }, null, 2)],
  "International arrest warrants for government and army leaders": [item({ kind: "diplomacy", links: [{ from: "the_hague", to: "jerusalem", tone: -1, icon: "gavel" }, { from: "london", to: "jerusalem", tone: -1, icon: "warning" }, { from: "paris", to: "jerusalem", tone: -1, icon: "warning" }] }, { he: "צווי מעצר בינלאומיים", en: "International arrest warrants" })],
  "Refusal letters from pilots and reservists": [item({ kind: "crowd", place: "tel_nof", size: 30, mode: "refusal" }, { he: "מכתבי סרבנות של טייסים", en: "Pilots' refusal letters" })],
  "The US imposes an arms embargo": [item({ kind: "airlift", mode: "halt" }, { he: "אמברגו נשק אמריקני", en: "US arms embargo" })],
  "The UAE freezes cooperation": [item({ kind: "diplomacy", links: [{ from: "abu_dhabi", to: "jerusalem", tone: -1, icon: "lock" }] }, { he: "איחוד האמירויות מקפיא שיתוף פעולה", en: "The UAE freezes cooperation" })],
  "Jordan recalls its ambassador and threatens the water and gas deals": [item({ kind: "diplomacy", links: [{ from: "amman", to: "jerusalem", tone: -1, icon: "recall" }] }, { he: "ירדן מחזירה את שגרירה", en: "Jordan recalls its ambassador" }), item({ kind: "water", mode: "cut" }, null, 3)],
  "Security services disintegrate; weapons leak to militants": [item({ kind: "pa_forces", mode: "collapse" }), item({ kind: "barrage", front: "west_bank", count: 5, weapon: "rocket", targets: ["afula", "kfar_saba"] }, null, 6)],
  "Wave of settler violence in Palestinian villages": [item({ kind: "settlers", mode: "violence" })],
  "Riyadh announces the start of talks": [item({ kind: "diplomacy", links: [{ from: "riyadh", to: "jerusalem", tone: 1, icon: "envelope" }] }, { he: "ריאד מכריזה על פתיחת שיחות", en: "Riyadh announces talks" })],
  "A tunnel threat tests the framework": [item({ kind: "infiltration", front: "gaza", squads: 1, tunnel: true }, { he: "איום מנהרה", en: "Tunnel threat" })],
  "Iran warns: \"a Zionist–Saudi alliance will be answered\"": [item({ kind: "iran_tels" })],
  "Militants seize PA posts in Rafah": [item({ kind: "barrage", front: "gaza", count: 10, weapon: "rocket", targets: ["sderot", "ashkelon", "beersheba"] }, { he: "חמושים משתלטים על עמדות הרשות ברפיח", en: "Militants seize PA posts in Rafah" })],
  "Tens of thousands at a right-wing rally in Jerusalem": [item({ kind: "crowd", place: "jerusalem", size: 70, mode: "right_rally" })],
  "Thousands of soldiers and police refuse to evacuate": [item({ kind: "crowd", place: "ariel", size: 40, mode: "refusal" }, { he: "חיילים ושוטרים מסרבים לפנות", en: "Soldiers and police refuse to evacuate" })],
  "Militants fill the vacuum; fire at Kfar Saba and Netanya": [item({ kind: "barrage", front: "west_bank", count: 8, weapon: "rocket", targets: ["kfar_saba", "netanya"] }, { he: "ירי על כפר סבא ונתניה", en: "Fire at Kfar Saba and Netanya" }), item({ kind: "infiltration", front: "west_bank", squads: 1, tunnel: false }, null, 5)],
  "Huge protests in Amman against the regime": [item({ kind: "crowd", place: "amman", size: 60, mode: "amman" })],
  "Sanctions on ministers and settlement budgets": [item({ kind: "diplomacy", links: [{ from: "washington", to: "jerusalem", tone: -1, icon: "lock" }] }, { he: "סנקציות על שרים ותקציבי התנחלויות", en: "Sanctions on ministers and settlement budgets" })],
  "Hezbollah fires precision missiles at Gush Dan": [item({ kind: "barrage", front: "lebanon", count: 12, weapon: "precision", targets: ["tel_aviv", "haifa", "netanya"] }, { he: "טילים מדויקים על גוש דן", en: "Precision missiles on Gush Dan" })],
  "Signing ceremony at the White House": [item({ kind: "diplomacy", links: [{ from: "jerusalem", to: "washington", tone: 1, icon: "pen" }, { from: "riyadh", to: "washington", tone: 1, icon: "pen" }] }, { he: "טקס חתימה בבית הלבן", en: "Signing at the White House" })],
  // engine-generated
  "Israel is at war": [item({ kind: "mobilize" })],
  "The fighting has subsided": [item({ kind: "ceasefire" }, { he: "הלחימה שככה", en: "The fighting has subsided" })],
  "Elections postponed: the war goes on": [item({ kind: "knesset", mode: "threat", color: "#946312" }, { he: "הבחירות נדחות", en: "Elections postponed" })],
  "The government has fallen": [item({ kind: "knesset", mode: "fall", color: "#B3302A" }, { he: "הממשלה נפלה", en: "The government has fallen" })],
  "You survived the term": [item({ kind: "knesset", mode: "election", color: "#2456B5" }, { he: "בחירות במועדן", en: "Elections on schedule" })],
  "Security collapse: multi-front war": [item({ kind: "barrage", front: "lebanon", count: 20, weapon: "precision", targets: ["tel_aviv", "haifa", "jerusalem"] }), item({ kind: "barrage", front: "iran", count: 6, weapon: "ballistic", targets: ["tel_aviv", "dimona", "haifa"] }, null, 2)],
  "The interceptors ran out": [item({ kind: "barrage", front: "lebanon", count: 18, weapon: "rocket", targets: ["tel_aviv", "haifa", "ashdod"] }, { he: "המיירטים נגמרו", en: "The interceptors ran out" })],
  "Economic collapse": [item({ kind: "economy", mode: "downgrade" }, { he: "קריסה כלכלית", en: "Economic collapse" }), item({ kind: "flights", count: 14, mode: "emigration" }, null, 4)],
  "Total isolation": [item({ kind: "trade", mode: "sanctions" }, { he: "בידוד מוחלט", en: "Total isolation" })],
  "Collapse from within: the rift tore society apart": [item({ kind: "crowd", place: "kaplan", size: 90, mode: "crackdown" }, { he: "קריסה מבפנים", en: "Collapse from within" }), item({ kind: "flights", count: 14, mode: "emigration" }, null, 6)],
};

// ---------------------------------------------------------------------------
// inference for anything not in the tables
// ---------------------------------------------------------------------------

const SALVO_FRONT: Record<strategic.SalvoSource, Front> = { egypt: "gaza", gaza: "gaza", hezbollah: "lebanon", iran: "iran", iraq: "iraq", houthis: "yemen", west_bank: "west_bank" };
const SALVO_TARGETS: Record<strategic.SalvoSource, PlaceId[]> = {
  egypt: ["beersheba", "dimona", "tel_aviv"], gaza: ["sderot", "ashkelon", "netivot", "ashdod"], hezbollah: ["kiryat_shmona", "nahariya", "haifa"],
  iran: ["tel_aviv", "dimona", "haifa"], iraq: ["eilat", "haifa"], houthis: ["eilat", "tel_aviv"], west_bank: ["afula", "kfar_saba", "netanya"],
};
const STRIKE_AREA: Record<strategic.StrikeTarget, "gaza" | "lebanon" | "iran" | "yemen" | "west_bank"> = { gaza: "gaza", lebanon: "lebanon", iran: "iran", yemen: "yemen", sinai: "gaza", west_bank: "west_bank" };
const FOCUS_CAPITAL: Partial<Record<strategic.MapFocus, PlaceId>> = { europe: "brussels", usa: "washington", gulf: "riyadh", jordan: "amman", iran: "tehran", sinai: "cairo", red_sea: "sanaa", lebanon: "beirut" };

export function fromVisual(v: strategic.Visual | null | undefined, caption: Bi | null): SceneItem[] {
  if (v === null || v === undefined) return [];
  switch (v.kind) {
    case "salvo": {
      const weapon = v.weapon === "ballistic" ? "ballistic" : v.weapon === "drone" ? "drone" : v.weapon === "cruise" ? "precision" : "rocket";
      return [item({ kind: "barrage", front: SALVO_FRONT[v.from], count: v.count, weapon, targets: SALVO_TARGETS[v.from] }, caption)];
    }
    case "strike":
      return [item({ kind: "airstrike", area: STRIKE_AREA[v.target], sorties: Math.max(2, Math.round(v.count / 2)), bombs: v.count, wide: v.count >= 14 }, caption)];
    case "ground":
      return v.target === "sinai" ? [item({ kind: "egypt_army" }, caption)] : [item({ kind: "ground", theater: v.target, mode: v.target === "west_bank" ? "raid" : "occupy" }, caption)];
    case "protest":
      return [item({ kind: "crowd", place: "kaplan", size: 60, mode: "protest" }, caption)];
    case "nuclear":
      return [item({ kind: "nuclear" }, caption)];
    case "crisis":
      // crisis scenes are played by the tactical script
      return [];
  }
}

export function infer(e: { headline: Bi; severity: strategic.Severity; focus: strategic.MapFocus; visual: strategic.Visual | null; deltas: Partial<strategic.SimulationMetrics>; quits: strategic.PartyId[]; threats: strategic.PartyId[] }, flags: Partial<strategic.CampaignFlags> | undefined, partyColor: (p: strategic.PartyId) => string): SceneItem[] {
  const byVisual = fromVisual(e.visual, e.headline);
  if (byVisual.length > 0) return byVisual;
  if (e.visual !== null && e.visual.kind === "crisis") return [];
  if (e.quits.length > 0) return [item({ kind: "knesset", mode: "quit", color: partyColor(e.quits[0]) }, e.headline)];
  if (e.threats.length > 0) return [item({ kind: "knesset", mode: "threat", color: partyColor(e.threats[0]) }, e.headline)];
  const fl = flags ?? {};
  if (fl.annexationLaw === true) return [item({ kind: "barrier", mode: "demolish" }, e.headline)];
  if (fl.redSeaBlockade === true) return [item({ kind: "red_sea", mode: "attack" }, e.headline)];
  if (fl.lebanonWar === true) return [item({ kind: "mobilize" }, e.headline)];
  if (fl.lebanonWar === false) return [item({ kind: "ceasefire" }, e.headline)];
  if (fl.usArmsHold === true) return [item({ kind: "airlift", mode: "halt" }, e.headline)];
  if (fl.usArmsHold === false) return [item({ kind: "airlift", mode: "arrive" }, e.headline)];
  if (fl.euSanctions === true) return [item({ kind: "trade", mode: "sanctions" }, e.headline)];
  if (fl.massProtests === true || fl.reservistRefusal === true) return [item({ kind: "crowd", place: "kaplan", size: 60, mode: fl.reservistRefusal === true ? "refusal" : "protest" }, e.headline)];
  if (fl.emergencyRule === true) return [item({ kind: "crowd", place: "kaplan", size: 60, mode: "crackdown" }, e.headline)];
  if (fl.gazaSiege === true) return [item({ kind: "siege", mode: "close" }, e.headline)];
  const d = e.deltas;
  const capital = FOCUS_CAPITAL[e.focus];
  if (capital !== undefined) {
    const tone: -1 | 0 | 1 = e.severity === "good" ? 1 : e.severity === "info" ? 0 : -1;
    return [item({ kind: "diplomacy", links: [{ from: capital, to: "jerusalem", tone, icon: tone < 0 ? "warning" : "envelope" }] }, e.headline)];
  }
  if ((d.securityThreat ?? 0) >= 8) return [item({ kind: "barrage", front: e.focus === "west_bank" ? "west_bank" : "gaza", count: Math.min(14, 4 + Math.round((d.securityThreat ?? 0) / 3)), weapon: "rocket", targets: e.focus === "west_bank" ? ["afula", "kfar_saba"] : ["sderot", "ashkelon"] }, e.headline)];
  if ((d.economicStability ?? 0) <= -8) return [item({ kind: "economy", mode: "downgrade" }, e.headline)];
  if ((d.internalCohesion ?? 0) <= -8) return [item({ kind: "crowd", place: "kaplan", size: 50, mode: "protest" }, e.headline)];
  if ((d.economicStability ?? 0) >= 8) return [item({ kind: "economy", mode: "boost" }, e.headline)];
  return [];
}

/** Emigration follows the blow to cohesion and the economy a decision delivers. */
export function emigrationFor(deltas: Partial<strategic.SimulationMetrics>): SceneItem[] {
  const hit = -Math.min(0, deltas.internalCohesion ?? 0) - Math.min(0, deltas.economicStability ?? 0);
  if (hit < 18) return [];
  const count = Math.max(3, Math.min(14, Math.round(hit / 5)));
  return [item({ kind: "flights", count, mode: "emigration" }, null, 5)];
}
