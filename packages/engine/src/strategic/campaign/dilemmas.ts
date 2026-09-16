/** Campaign content: the doctrine choice, the first dilemma of each doctrine,
 *  and the pool of follow-up dilemmas (international fallout, fronts, internal
 *  rifts). Metric deltas, partner reactions and consequence probabilities are
 *  ASSUMPTIONS of the game; historical references in the text are factual. */

import type { CampaignView, DilemmaDef } from "./types";

// ---------------------------------------------------------------------------
// doctrine (the first popup after forming the government)
// ---------------------------------------------------------------------------

export const DOCTRINE: DilemmaDef = {
  id: "DOCTRINE",
  title: { he: "בחר את מדיניות הממשלה בנושא הסכסוך הישראלי-פלסטיני", en: "Choose the government's policy on the Israeli–Palestinian conflict" },
  context: {
    he: "הקואליציה הושבעה. הקבינט מתכנס לקבוע את הדוקטרינה שתנחה את הממשלה בעזה וביהודה ושומרון. כל שותף בקואליציה יגיב — וכך גם העולם.",
    en: "The coalition is sworn in. The cabinet convenes to set the doctrine for Gaza and the West Bank. Every coalition partner will react — and so will the world.",
  },
  focus: "israel",
  options: [
    {
      id: "D_RADICAL_RIGHT", setTrack: "RADICAL_RIGHT_DEPORTATION", next: "RR_GAZA",
      label: { he: "ימין קיצוני: הכרעה צבאית ודחיקת האוכלוסייה", en: "Far right: military decision and pushing the population out" },
      objective: { he: "סילוק האיום מעזה באמצעים קיצוניים.", en: "Remove the threat from Gaza by extreme means." },
      pros: [{ he: "תמיכה נלהבת בבסיס הימני", en: "Enthusiastic right-wing base" }],
      cons: [{ he: "סיכון לבידוד בינלאומי ולמלחמה אזורית", en: "Risk of international isolation and regional war" }, { he: "המרכז והשמאל ייצאו מכל קואליציה", en: "Center and left leave any coalition" }],
      deltas: { internationalLegitimacy: -10, regionalRelations: -10 },
      stance: { eu: -10, egypt: -15, jordan: -15 },
    },
    {
      id: "D_ANNEXATION", setTrack: "CONSERVATIVE_RIGHT_ANNEXATION", next: "AN_SCOPE",
      label: { he: "ימין שמרני: שליטה צבאית, סיפוח והתיישבות", en: "Conservative right: military control, annexation, settlement" },
      objective: { he: "שליטה ישראלית קבועה ללא ישות פלסטינית.", en: "Permanent Israeli control with no Palestinian entity." },
      pros: [{ he: "שליטה ביטחונית מלאה בשטח", en: "Full security control on the ground" }],
      cons: [{ he: "עלות עתק לניהול אזרחי", en: "Huge civil-administration cost" }, { he: "חסימת נורמליזציה עם סעודיה", en: "Saudi normalization blocked" }],
      deltas: { internationalLegitimacy: -8, regionalRelations: -10, securityThreat: -3 },
    },
    {
      id: "D_TRUSTEESHIP", setTrack: "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP", next: "TR_TERMS",
      label: { he: "מרכז פרגמטי: מתווה אזורי מדורג", en: "Pragmatic center: staged regional framework" },
      objective: { he: "פירוז ושיקום בפיקוח מפרצי, חופש פעולה לצה\"ל.", en: "Demilitarization and Gulf-supervised reconstruction; IDF keeps freedom of action." },
      pros: [{ he: "פתח לנורמליזציה ולמימון חיצוני", en: "Opening to normalization and outside funding" }],
      cons: [{ he: "הימין הקיצוני מאיים לפרוש", en: "Far right threatens to quit" }],
      deltas: { internationalLegitimacy: 5, regionalRelations: 8 },
      stance: { saudi: 8, uae: 8, usa: 5 },
    },
    {
      id: "D_PA_RETURN", setTrack: "CENTER_LEFT_PA_RETURN", next: "PA_TERMS",
      label: { he: "מרכז-שמאל: החזרת רשות מחודשת והיפרדות", en: "Center-left: reformed PA returns; separation" },
      objective: { he: "הסדר מדיני והיפרדות לשתי מדינות.", en: "Political settlement and two-state separation." },
      pros: [{ he: "לגיטימציה בינלאומית ויחסים אזוריים", en: "International legitimacy and regional ties" }],
      cons: [{ he: "סיכון ביטחוני אם הרשות לא מתפקדת", en: "Security risk if the PA fails" }, { he: "הימין ייצא מהממשלה", en: "The right leaves the government" }],
      deltas: { internationalLegitimacy: 10, regionalRelations: 8, securityThreat: 3 },
      stance: { eu: 10, jordan: 8, palestinian_authority: 15 },
    },
    {
      id: "D_WITHDRAWAL", setTrack: "RADICAL_LEFT_UNILATERAL_WITHDRAWAL", next: "WD_HOW",
      label: { he: "שמאל רדיקלי: נסיגה חד-צדדית לקווי 67", en: "Radical left: unilateral withdrawal to the 1967 lines" },
      objective: { he: "סיום השליטה בשטחים באופן מיידי.", en: "End control of the territories immediately." },
      pros: [{ he: "לגיטימציה בינלאומית מקסימלית", en: "Maximal international legitimacy" }],
      cons: [{ he: "ואקום ביטחוני", en: "Security vacuum" }, { he: "סכנת שסע פנימי חריף", en: "Risk of a severe internal rift" }],
      deltas: { internationalLegitimacy: 15, internalCohesion: -10 },
    },
  ],
};

// ---------------------------------------------------------------------------
// radical right — "what will you do in Gaza?"
// ---------------------------------------------------------------------------

const RR_GAZA: DilemmaDef = {
  id: "RR_GAZA",
  title: { he: "מה תעשה בעזה?", en: "What will you do in Gaza?" },
  context: {
    he: "הממשלה אימצה קו ימני קיצוני. הרמטכ\"ל, ראש השב\"כ והיועמ\"ש מחכים להנחיה. כ-2.1 מיליון בני אדם חיים ברצועה.",
    en: "The government has adopted a far-right line. The chief of staff, the Shin Bet chief and the attorney general await instructions. About 2.1 million people live in the Strip.",
  },
  focus: "gaza",
  options: [
    {
      id: "RR_OCCUPY",
      label: { he: "כיבוש מלא וממשל צבאי", en: "Full occupation and military government" },
      objective: { he: "שליטה צבאית ישירה בכל הרצועה.", en: "Direct military control of the entire Strip." },
      pros: [{ he: "פירוק תשתיות בשטח", en: "Infrastructure dismantled on the ground" }, { he: "גיבוי מהימין", en: "Backing from the right" }],
      cons: [{ he: "עשרות גדודי מילואים בשיטור קבוע", en: "Dozens of reserve battalions on permanent policing" }, { he: "עלות של עשרות מיליארדים בשנה", en: "Tens of billions a year" }],
      deltas: { securityThreat: -8, economicStability: -18, internationalLegitimacy: -20, regionalRelations: -20, internalCohesion: -6 },
      partners: { far_right: 10, right: 5, center: -25, left: -40, arab: -60 },
      stance: { eu: -12, egypt: -25, jordan: -15, saudi: -15, gaza: -20 },
      flags: { gazaOccupied: true },
      visual: { kind: "ground", target: "gaza" },
      consequences: [
        { headline: { he: "צה\"ל משלים את כיבוש הרצועה", en: "IDF completes the occupation of the Strip" }, body: { he: "ממשל צבאי הוקם. ארגוני הטרור עוברים ללוחמת גרילה ממנהרות ומהריסות.", en: "A military government is set up. Armed groups switch to guerrilla warfare from tunnels and rubble." }, severity: "warn", focus: "gaza", visual: { kind: "salvo", from: "gaza", weapon: "rocket", count: 8 } },
        { p: 0.6, headline: { he: "האיחוד האירופי מקפיא את השיח בהסכם השיוך", en: "EU freezes dialogue under the Association Agreement" }, body: { he: "הנציבות בוחנת השעיית העדפות סחר בנימוק של סעיף 2 (זכויות אדם) בהסכם.", en: "The Commission weighs suspending trade preferences under the agreement's Article 2 human-rights clause." }, severity: "bad", focus: "europe", deltas: { economicStability: -6 }, stance: { eu: -10 } },
        { headline: { he: "עייפות המילואים מחריפה", en: "Reservist fatigue deepens" }, body: { he: "אחוזי ההתייצבות יורדים; מעסיקים ומשפחות קורסים תחת סבבים חוזרים.", en: "Turnout drops; employers and families buckle under repeated rotations." }, severity: "warn", focus: "israel", deltas: { internalCohesion: -5, economicStability: -4 } },
      ],
    },
    {
      id: "RR_SIEGE",
      label: { he: "מצור מוחלט: עצירת כל הסיוע ההומניטרי", en: "Total siege: halt all humanitarian aid" },
      objective: { he: "לחץ מקסימלי על חמאס באמצעות מצור.", en: "Maximum pressure on Hamas through siege." },
      pros: [{ he: "אין סיכון לכוחות קרקע", en: "No risk to ground forces" }],
      cons: [{ he: "משבר רעב ואחריות משפטית בינלאומית", en: "Famine crisis and international legal liability" }, { he: "לחץ אמריקאי חריף", en: "Sharp US pressure" }],
      deltas: { securityThreat: -3, internationalLegitimacy: -30, usMilitaryAid: -15, regionalRelations: -18 },
      partners: { far_right: 10, right: -5, haredi: -5, center: -35, left: -60, arab: -80 },
      stance: { eu: -15, uk: -15, usa: -12, egypt: -20, jordan: -20, qatar: -15 },
      flags: { gazaSiege: true },
      consequences: [
        { headline: { he: "בית הדין הבינלאומי לצדק מורה על צעדים זמניים", en: "International Court of Justice orders provisional measures" }, body: { he: "כמו בינואר 2024 (דרום אפריקה נגד ישראל), בית הדין מורה לאפשר כניסת סיוע — והפעם ישראל מסרבת.", en: "As in January 2024 (South Africa v. Israel), the Court orders aid access — this time Israel refuses." }, severity: "bad", focus: "europe", deltas: { internationalLegitimacy: -10 } },
        { headline: { he: "וושינגטון מעכבת משלוח חימוש", en: "Washington holds a munitions shipment" }, body: { he: "כמו עיכוב פצצות 2,000 הליברות במאי 2024 — הפעם בהיקף רחב, עד לחידוש הסיוע.", en: "Like the May 2024 hold on 2,000-lb bombs — this time broader, until aid resumes." }, severity: "bad", focus: "usa", deltas: { usMilitaryAid: -12 }, flags: { usArmsHold: true }, stance: { usa: -10 } },
      ],
    },
    {
      id: "RR_EMIGRATION",
      label: { he: "\"עידוד הגירה\" במימון תקציבי", en: "\"Encouraged emigration\" funded by the budget" },
      objective: { he: "הוצאת תושבים מהרצועה בתמריצים כספיים.", en: "Moving residents out of the Strip with cash incentives." },
      pros: [{ he: "מוצג כ\"וולונטרי\" לציבור", en: "Presented to the public as \"voluntary\"" }],
      cons: [{ he: "אין מדינה קולטת; מצרים וירדן רואות בכך איום ישיר", en: "No receiving country; Egypt and Jordan see a direct threat" }, { he: "נתפס בעולם כטרנספר", en: "Seen abroad as transfer" }],
      deltas: { internationalLegitimacy: -28, regionalRelations: -30, economicStability: -8 },
      partners: { far_right: 15, right: -10, haredi: -5, center: -45, left: -70, arab: -90 },
      stance: { egypt: -40, jordan: -35, saudi: -25, uae: -20, eu: -20, usa: -8 },
      flags: { emigrationProgram: true },
      consequences: [
        { headline: { he: "מצרים סוגרת את רפיח ומזהירה: \"הסכם השלום בסכנה\"", en: "Egypt seals Rafah and warns: \"the peace treaty is at risk\"" }, body: { he: "קהיר הגדירה מאז 2023 דחיקת עזתים לסיני כקו אדום; כוחות מצריים מתוגברים בצפון סיני.", en: "Cairo has called pushing Gazans into Sinai a red line since 2023; Egyptian forces reinforce northern Sinai." }, severity: "bad", focus: "sinai", next: "EGYPT_TREATY_BREACH" },
        { p: 0.5, headline: { he: "תובע בית הדין הפלילי הבינלאומי: \"חשד לפשע נגד האנושות\"", en: "ICC prosecutor: \"suspected crime against humanity\"" }, body: { he: "גירוש או העברה כפויה של אוכלוסייה הם פשע לפי אמנת רומא.", en: "Deportation or forcible transfer of population is a crime under the Rome Statute." }, severity: "bad", focus: "europe", flags: { iccWarrants: true }, deltas: { internationalLegitimacy: -8 } },
      ],
    },
    {
      id: "RR_TRANSFER",
      label: { he: "טרנספר כפוי מעבר לגבול", en: "Forced transfer across the border" },
      objective: { he: "עקירה בכוח של אוכלוסיית הרצועה.", en: "Forcibly removing the Strip's population." },
      pros: [{ he: "הבסיס הקיצוני מריע", en: "The extreme base cheers" }],
      cons: [{ he: "פשע מלחמה לפי אמנת ז'נבה הרביעית", en: "A war crime under the Fourth Geneva Convention" }, { he: "תגובה צבאית מצרית צפויה", en: "Egyptian military response expected" }, { he: "אמברגו נשק", en: "Arms embargo" }],
      deltas: { internationalLegitimacy: -35, usMilitaryAid: -30, regionalRelations: -35, economicStability: -15, securityThreat: 20 },
      partners: { far_right: 15, right: -30, haredi: -25, center: -100, left: -100, arab: -100 },
      stance: { egypt: -60, jordan: -50, usa: -30, eu: -40, uk: -35, saudi: -40 },
      flags: { transferOrdered: true },
      consequences: [
        { headline: { he: "התראות גבול: מצרים מגייסת את ארמיות 2 ו-3", en: "Border alerts: Egypt mobilizes the 2nd and 3rd Armies" }, body: { he: "דיביזיות ממוכנות נעות לתעלת סואץ. מטוסי קרב מצריים בכוננות.", en: "Mechanized divisions move to the Suez Canal. Egyptian fighters on alert." }, severity: "critical", focus: "sinai", next: "EGYPTIAN_BALLISTIC_ATTACK" },
        { headline: { he: "האיחוד האירופי מטיל סנקציות", en: "The EU imposes sanctions" }, body: { he: "השעיית הסכם השיוך, אמברגו נשק מצד מדינות חברות והקפאת נכסים של בכירים.", en: "Association Agreement suspended, member-state arms embargoes, asset freezes on officials." }, severity: "critical", focus: "europe", flags: { euSanctions: true }, deltas: { economicStability: -12 }, stance: { eu: -20 } },
      ],
    },
    {
      id: "RR_CARPET",
      label: { he: "הפצצה רחבה ללא הבחנה בין לוחמים לאזרחים", en: "Wide bombing without distinguishing fighters from civilians" },
      objective: { he: "הכרעה באש בכל מחיר.", en: "Decision by firepower at any cost." },
      pros: [{ he: "פגיעה מהירה ביכולות", en: "Rapid damage to capabilities" }],
      cons: [{ he: "הפרה בוטה של דיני המלחמה", en: "Flagrant breach of the laws of war" }, { he: "צווי מעצר לשרשרת הפיקוד", en: "Arrest warrants for the chain of command" }, { he: "סרבנות בצבא", en: "Refusal in the ranks" }],
      deltas: { securityThreat: 15, internationalLegitimacy: -55, usMilitaryAid: -45, regionalRelations: -45, internalCohesion: -22, economicStability: -15 },
      partners: { far_right: 5, right: -35, haredi: -30, center: -100, left: -100, arab: -100 },
      stance: { usa: -45, eu: -45, uk: -45, egypt: -50, jordan: -50, saudi: -45, uae: -35, turkey: -30 },
      flags: { indiscriminateBombing: true, iccWarrants: true },
      visual: { kind: "strike", target: "gaza", count: 16 },
      consequences: [
        { headline: { he: "צווי מעצר בינלאומיים לבכירי הממשלה והצבא", en: "International arrest warrants for government and army leaders" }, body: { he: "124 מדינות החברות בבית הדין מחויבות לאכוף. טייסים ומפקדים מבטלים נסיעות לחו\"ל.", en: "124 member states are bound to enforce. Pilots and commanders cancel travel abroad." }, severity: "critical", focus: "europe", deltas: { internationalLegitimacy: -10 } },
        { headline: { he: "מכתבי סרבנות של טייסים ואנשי מילואים", en: "Refusal letters from pilots and reservists" }, body: { he: "מאות חותמים שלא ישתתפו בפקודות בלתי חוקיות בעליל.", en: "Hundreds sign that they will not take part in manifestly illegal orders." }, severity: "critical", focus: "israel", flags: { reservistRefusal: true }, deltas: { internalCohesion: -10 } },
        { headline: { he: "ארה\"ב מטילה אמברגו נשק", en: "The US imposes an arms embargo" }, body: { he: "משלוחי חימוש, חלפים ומיירטים מוקפאים.", en: "Munitions, spare parts and interceptor shipments frozen." }, severity: "critical", focus: "usa", deltas: { usMilitaryAid: -20 }, flags: { usArmsHold: true } },
      ],
    },
    {
      id: "RR_NUCLEAR",
      label: { he: "שימוש בנשק גרעיני בעזה", en: "Use a nuclear weapon on Gaza" },
      objective: { he: "השמדת הרצועה.", en: "Destroying the Strip." },
      pros: [],
      cons: [
        { he: "מאות אלפי הרוגים אזרחים", en: "Hundreds of thousands of civilian deaths" },
        { he: "נשורת רדיואקטיבית על יישובי העוטף, אשקלון ובאר שבע", en: "Radioactive fallout on the Gaza-border communities, Ashkelon and Be'er Sheva" },
        { he: "סוף מדיניות העמימות וקריסת כל הבריתות", en: "End of the ambiguity policy and collapse of every alliance" },
      ],
      deltas: { internationalLegitimacy: -100, usMilitaryAid: -100, regionalRelations: -100, internalCohesion: -60, economicStability: -60, securityThreat: 40 },
      stance: { usa: -150, eu: -150, uk: -150, india: -120, russia: -80, china: -100, egypt: -150, jordan: -150, saudi: -150, uae: -150, bahrain: -150, morocco: -150, turkey: -100, greece: -120, cyprus: -120, azerbaijan: -120 },
      flags: { nuclearUsed: true },
      visual: { kind: "nuclear" },
      ending: {
        kind: "STATE_COLLAPSE_EXTERNAL",
        headline: { he: "קריסת מדינת ישראל: שימוש בנשק גרעיני", en: "Collapse of the State of Israel: nuclear use" },
        reason: {
          he: "הערכת המודל: מאות אלפי הרוגים ברצועה, נשורת על דרום ישראל במרחק קילומטרים ספורים. מועצת הביטחון פועלת ללא וטו אמריקאי, סנקציות כוללות, ניתוק מוחלט של הסיוע והסחר, סרבנות המונית ופירוק שרשרת הפיקוד. זהו פשע נגד האנושות — אין ממנו דרך חזרה.",
          en: "Model estimate: hundreds of thousands killed in the Strip, fallout over southern Israel a few kilometres away. The Security Council acts without a US veto; total sanctions, a complete cutoff of aid and trade, mass refusal and a broken chain of command. It is a crime against humanity — there is no way back.",
        },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// conservative right
// ---------------------------------------------------------------------------

const AN_SCOPE: DilemmaDef = {
  id: "AN_SCOPE",
  title: { he: "מה היקף הסיפוח ומה יעלה בגורל הרשות?", en: "How far does annexation go, and what happens to the PA?" },
  context: { he: "הקואליציה דורשת צעדים מעשיים. משרד החוץ מזהיר מתגובת איחוד האמירויות, ירדן והאיחוד האירופי.", en: "The coalition demands concrete steps. The Foreign Ministry warns about the UAE, Jordan and the EU." },
  focus: "west_bank",
  options: [
    {
      id: "AN_LAW_C",
      label: { he: "חוק סיפוח שטחי C", en: "Law annexing Area C" },
      objective: { he: "ריבונות ישראלית על כ-60% מהגדה.", en: "Israeli sovereignty over about 60% of the West Bank." },
      pros: [{ he: "מימוש חזון הימין", en: "Fulfils the right's vision" }],
      cons: [{ he: "הסכמי אברהם נבנו על השעיית הסיפוח (2020)", en: "The Abraham Accords rested on suspending annexation (2020)" }, { he: "משבר מול ירדן", en: "Crisis with Jordan" }],
      deltas: { internationalLegitimacy: -22, regionalRelations: -28, usMilitaryAid: -10 },
      partners: { far_right: 15, right: 5, center: -40, left: -60, arab: -80 },
      stance: { uae: -35, bahrain: -25, morocco: -25, jordan: -40, eu: -25, saudi: -20, palestinian_authority: -30 },
      flags: { annexationLaw: true },
      consequences: [
        { headline: { he: "איחוד האמירויות מקפיאה את שיתוף הפעולה", en: "The UAE freezes cooperation" }, body: { he: "אבו דאבי מזכירה שההסכם מ-2020 נחתם בתמורה להשעיית הסיפוח.", en: "Abu Dhabi recalls that the 2020 accord was signed in return for suspending annexation." }, severity: "bad", focus: "gulf", deltas: { economicStability: -5 } },
        { headline: { he: "ירדן מחזירה את שגרירה ומאיימת על הסכמי המים והגז", en: "Jordan recalls its ambassador and threatens the water and gas deals" }, body: { he: "ישראל מספקת לירדן מים לפי הסכם 1994, וירדן רוכשת גז ממאגר לוויתן.", en: "Israel supplies Jordan water under the 1994 treaty, and Jordan buys gas from the Leviathan field." }, severity: "bad", focus: "jordan", next: "JORDAN_TREATY" },
      ],
    },
    {
      id: "AN_DISMANTLE_PA",
      label: { he: "פירוק הרשות הפלסטינית וממשל אזרחי ישיר", en: "Dismantle the PA; direct civil administration" },
      objective: { he: "ביטול כל ישות פלסטינית.", en: "No Palestinian entity at all." },
      pros: [{ he: "אין תשלומים למשפחות מחבלים דרך הרשות", en: "No payments to attackers' families via the PA" }],
      cons: [{ he: "ישראל אחראית לחינוך, בריאות ורווחה של מיליונים", en: "Israel responsible for schooling, health and welfare of millions" }, { he: "אלפי אנשי מנגנונים חמושים ללא מעסיק", en: "Thousands of armed security men without a paymaster" }],
      deltas: { economicStability: -20, securityThreat: 12, internationalLegitimacy: -15 },
      partners: { far_right: 15, right: 0, center: -30, left: -50, arab: -70 },
      stance: { palestinian_authority: -70, jordan: -25, eu: -20, egypt: -10 },
      flags: { paDismantled: true },
      consequences: [
        { headline: { he: "מנגנוני הביטחון מתפרקים; נשק זולג לחמושים", en: "Security services disintegrate; weapons leak to militants" }, body: { he: "אלפי אנשי מנגנונים לא קיבלו משכורת; בג'נין ושכם הם מצטרפים לחוליות.", en: "Thousands of unpaid security men join cells in Jenin and Nablus." }, severity: "bad", focus: "west_bank", visual: { kind: "salvo", from: "west_bank", weapon: "rocket", count: 5 }, next: "PA_SECURITY_COLLAPSE" },
      ],
    },
    {
      id: "AN_DE_FACTO",
      label: { he: "סיפוח דה-פקטו: הכשרת מאחזים והרחבת בנייה ללא חוק", en: "De facto annexation: legalize outposts and build, without a law" },
      objective: { he: "קביעת עובדות בשטח במחיר מדיני נמוך יותר.", en: "Facts on the ground at a lower diplomatic price." },
      pros: [{ he: "פחות חשיפה בינלאומית", en: "Less international exposure" }],
      cons: [{ he: "אלימות מתנחלים ועימותים", en: "Settler violence and clashes" }, { he: "הימין הקיצוני דורש יותר", en: "The far right wants more" }],
      deltas: { internationalLegitimacy: -8, regionalRelations: -8, securityThreat: 4 },
      partners: { far_right: -5, right: 5, center: -15, left: -35, arab: -50 },
      stance: { eu: -10, usa: -5 },
      consequences: [
        { p: 0.6, headline: { he: "גל אלימות מתנחלים בכפרים פלסטיניים", en: "Wave of settler violence in Palestinian villages" }, body: { he: "ארה\"ב ובריטניה כבר הטילו סנקציות על מתנחלים אלימים ב-2024.", en: "The US and UK already sanctioned violent settlers in 2024." }, severity: "warn", focus: "west_bank", next: "SETTLER_VIOLENCE" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// pragmatic center
// ---------------------------------------------------------------------------

const TR_TERMS: DilemmaDef = {
  id: "TR_TERMS",
  title: { he: "איך תשיג את כוח הנאמנות האזורי?", en: "How will you secure the regional trusteeship force?" },
  context: { he: "ריאד ואבו דאבי מוכנות לממן ולפרוס — בתנאי ל\"אופק מדיני\". וושינגטון מציעה לעגן זאת בהסכם הגנה.", en: "Riyadh and Abu Dhabi will fund and deploy — on condition of a \"political horizon\". Washington offers to anchor it in a defense pact." },
  focus: "gulf",
  options: [
    {
      id: "TR_AMBIGUITY",
      label: { he: "הצהרה עמומה על אופק מדיני תמורת כוח סעודי-אמירתי", en: "Ambiguous political-horizon statement in return for a Saudi-Emirati force" },
      objective: { he: "פתיחת ערוץ הנורמליזציה.", en: "Open the normalization channel." },
      pros: [{ he: "מימון מפרצי לשיקום", en: "Gulf funding for reconstruction" }, { he: "חיזוק הברית עם ארה\"ב", en: "Stronger US alliance" }],
      cons: [{ he: "הימין הקיצוני רואה בכך \"מדינה פלסטינית\"", en: "Far right sees a \"Palestinian state\"" }],
      deltas: { regionalRelations: 22, usMilitaryAid: 10, economicStability: 10, securityThreat: -5 },
      partners: { far_right: -40, right: -10, center: 10, left: 5, arab: 10 },
      stance: { saudi: 25, uae: 20, usa: 10, egypt: 10, jordan: 10 },
      flags: { trusteeshipTalks: true },
      consequences: [
        { headline: { he: "ריאד מודיעה על פתיחת מגעים", en: "Riyadh announces the start of talks" }, body: { he: "משלחת סעודית-אמירתית תגיע לבחון את פריסת הכוח.", en: "A Saudi-Emirati delegation will assess deploying the force." }, severity: "good", focus: "gulf" },
        { p: 0.5, headline: { he: "מתקפת מנהרות מאתגרת את המתווה", en: "A tunnel threat tests the framework" }, body: { he: "גורמי ביטחון מזהירים מהתחמשות מחודשת ברפיח.", en: "Security officials warn of rearmament in Rafah." }, severity: "warn", focus: "gaza", next: "TUNNEL_NETWORK_EXPOSED" },
      ],
    },
    {
      id: "TR_DEMIL_FIRST",
      label: { he: "פירוז מלא קודם — שום ויתור לפני כן", en: "Full demilitarization first — no concession before" },
      objective: { he: "שמירת כל הקלפים עד הוכחת פירוז.", en: "Keep every card until demilitarization is proven." },
      pros: [{ he: "גיבוי מהימין", en: "Backing from the right" }],
      cons: [{ he: "המפרץ מעכב את הכוח ואת הכסף", en: "The Gulf holds back force and money" }, { he: "ישראל ממשיכה לממן את הניהול", en: "Israel keeps paying for administration" }],
      deltas: { securityThreat: -3, regionalRelations: -5, economicStability: -8 },
      partners: { far_right: 5, right: 5, center: -5 },
      stance: { saudi: -8, uae: -5 },
    },
    {
      id: "TR_US_PACT",
      label: { he: "הסכם הגנה אמריקאי-סעודי-ישראלי משולש", en: "Trilateral US–Saudi–Israeli defense pact" },
      objective: { he: "עיגון המתווה בברית אסטרטגית.", en: "Anchor the framework in a strategic alliance." },
      pros: [{ he: "מטרייה אמריקאית ומערך הגנה אזורי מול איראן", en: "US umbrella and a regional air-defense web against Iran" }],
      cons: [{ he: "דרישות אמריקאיות להקפאת בנייה", en: "US demands for a building freeze" }, { he: "איראן רואה בכך איום", en: "Iran sees a threat" }],
      deltas: { usMilitaryAid: 18, regionalRelations: 15, securityThreat: 5 },
      partners: { far_right: -30, right: -5, center: 10, left: 5 },
      stance: { usa: 20, saudi: 20, iran: -20 },
      flags: { trusteeshipTalks: true },
      consequences: [
        { p: 0.5, headline: { he: "איראן מזהירה: \"ברית ציונית-סעודית תיענה\"", en: "Iran warns: \"a Zionist–Saudi alliance will be answered\"" }, body: { he: "משמרות המהפכה מעלים כוננות.", en: "The IRGC raises its alert level." }, severity: "warn", focus: "iran", deltas: { securityThreat: 6 } },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// center-left
// ---------------------------------------------------------------------------

const PA_TERMS: DilemmaDef = {
  id: "PA_TERMS",
  title: { he: "באילו תנאים תחזור הרשות לעזה?", en: "On what terms does the PA return to Gaza?" },
  context: { he: "רמאללה מוכנה, בתמיכה אירופית ומצרית. צה\"ל מזהיר: לקחי 2007 עוד טריים.", en: "Ramallah is ready, with European and Egyptian backing. The IDF warns: the lessons of 2007 are fresh." },
  focus: "gaza",
  options: [
    {
      id: "PA_WITH_IDF",
      label: { he: "החזרת הרשות עם חופש פעולה מלא לצה\"ל", en: "PA returns; the IDF keeps full freedom of action" },
      objective: { he: "הסדר מדיני בלי לוותר על סיכול.", en: "A political settlement without giving up counter-terror operations." },
      pros: [{ he: "לגיטימציה ויחסים אזוריים", en: "Legitimacy and regional ties" }, { he: "ביטחון נשמר", en: "Security preserved" }],
      cons: [{ he: "הרשות נתפסת כ\"קבלן משנה\" של ישראל", en: "PA seen as Israel's subcontractor" }],
      deltas: { internationalLegitimacy: 18, regionalRelations: 15, securityThreat: 4 },
      partners: { far_right: -60, right: -25, center: 10, left: 15, arab: 10 },
      stance: { eu: 15, egypt: 12, jordan: 12, palestinian_authority: 20 },
    },
    {
      id: "PA_ALONE",
      label: { he: "החזרה מלאה בלי נוכחות צה\"ל", en: "Full return with no IDF presence" },
      objective: { he: "ריבונות פלסטינית אמיתית בעזה.", en: "Genuine Palestinian sovereignty in Gaza." },
      pros: [{ he: "תמיכה בינלאומית מקסימלית", en: "Maximal international support" }],
      cons: [{ he: "לקח אוסלו וההשתלטות ב-2007: ואקום ביטחוני", en: "The lesson of Oslo and the 2007 takeover: a security vacuum" }],
      deltas: { internationalLegitimacy: 25, regionalRelations: 18, securityThreat: 25 },
      partners: { far_right: -80, right: -50, haredi: -15, center: -10, left: 20, arab: 20 },
      stance: { eu: 25, uk: 20, palestinian_authority: 30 },
      flags: { paAlone: true },
      consequences: [
        { p: 0.7, headline: { he: "חמושים משתלטים על עמדות הרשות ברפיח", en: "Militants seize PA posts in Rafah" }, body: { he: "ירי רקטות מתחדש לעבר אשקלון ואשדוד.", en: "Rocket fire resumes toward Ashkelon and Ashdod." }, severity: "bad", focus: "gaza", visual: { kind: "salvo", from: "gaza", weapon: "rocket", count: 10 }, next: "PA_SECURITY_COLLAPSE" },
      ],
    },
    {
      id: "PA_FREEZE_TALKS",
      label: { he: "הקפאת בנייה מלאה ומו\"מ לשתי מדינות", en: "Full settlement freeze and two-state negotiations" },
      objective: { he: "אופק מדיני מלא.", en: "A full political horizon." },
      pros: [{ he: "האיחוד האירופי וסעודיה בתמיכה", en: "EU and Saudi Arabia on board" }],
      cons: [{ he: "מחאת מתנחלים חריפה", en: "Fierce settler protests" }, { he: "הימין יוצא", en: "The right walks out" }],
      deltas: { internationalLegitimacy: 22, regionalRelations: 15, internalCohesion: -12 },
      partners: { far_right: -100, right: -45, haredi: -10, center: 5, left: 20, arab: 15 },
      stance: { eu: 20, saudi: 15, usa: 8, palestinian_authority: 25 },
      flags: { settlementFreeze: true },
      consequences: [
        { headline: { he: "עשרות אלפים בהפגנת ימין בירושלים", en: "Tens of thousands at a right-wing rally in Jerusalem" }, body: { he: "חסימות כבישים בכניסות לערים.", en: "Roads blocked at city entrances." }, severity: "warn", focus: "israel", visual: { kind: "protest" }, deltas: { internalCohesion: -5 }, flags: { massProtests: true } },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// radical left
// ---------------------------------------------------------------------------

const WD_HOW: DilemmaDef = {
  id: "WD_HOW",
  title: { he: "איך תבוצע הנסיגה?", en: "How will the withdrawal be carried out?" },
  context: { he: "כ-500 אלף ישראלים חיים מעבר לקו הירוק. בהתנתקות 2005 פונו כ-8,000.", en: "About 500,000 Israelis live beyond the Green Line. The 2005 disengagement evacuated about 8,000." },
  focus: "west_bank",
  options: [
    {
      id: "WD_IMMEDIATE",
      label: { he: "נסיגה מיידית ופינוי בכוח", en: "Immediate withdrawal and forced evacuation" },
      objective: { he: "סיום הכיבוש בתוך חודשים.", en: "End the occupation within months." },
      pros: [{ he: "לגיטימציה בינלאומית שיא", en: "Peak international legitimacy" }],
      cons: [{ he: "סרבנות המונית בצבא ובמשטרה", en: "Mass refusal in the army and police" }, { he: "סכנת מלחמת אחים", en: "Risk of civil strife" }, { he: "ואקום ביטחוני", en: "Security vacuum" }],
      deltas: { internationalLegitimacy: 30, internalCohesion: -40, securityThreat: 35, economicStability: -15 },
      partners: { far_right: -100, right: -100, haredi: -60, center: -60, left: 10, arab: 15 },
      stance: { eu: 30, uk: 25, palestinian_authority: 30, jordan: 15 },
      flags: { withdrawal: true },
      consequences: [
        { headline: { he: "אלפי חיילים ושוטרים מסרבים לפנות", en: "Thousands of soldiers and police refuse to evacuate" }, body: { he: "עימותים אלימים ביישובים; ראשי מועצות מכריזים על \"מרי אזרחי\".", en: "Violent clashes in settlements; council heads declare \"civil disobedience\"." }, severity: "critical", focus: "west_bank", flags: { reservistRefusal: true, massProtests: true }, deltas: { internalCohesion: -8 }, next: "CIVIL_REVOLT" },
        { p: 0.6, headline: { he: "חמושים ממלאים את הוואקום; ירי לעבר כפר סבא ונתניה", en: "Militants fill the vacuum; fire at Kfar Saba and Netanya" }, body: { he: "קו התפר הופך לחזית.", en: "The seam line becomes a front." }, severity: "bad", focus: "west_bank", visual: { kind: "salvo", from: "west_bank", weapon: "rocket", count: 8 } },
      ],
    },
    {
      id: "WD_STAGED",
      label: { he: "נסיגה מדורגת: פינוי מרצון ופיצויים", en: "Staged withdrawal: voluntary evacuation with compensation" },
      objective: { he: "צמצום השסע תוך התקדמות.", en: "Limit the rift while moving forward." },
      pros: [{ he: "פחות עימות פנימי", en: "Less internal confrontation" }],
      cons: [{ he: "עלות של מאות מיליארדים", en: "Hundreds of billions in cost" }, { he: "תהליך ארוך ופגיע", en: "Long and vulnerable process" }],
      deltas: { internationalLegitimacy: 18, internalCohesion: -18, economicStability: -18, securityThreat: 15 },
      partners: { far_right: -80, right: -60, haredi: -30, center: -15, left: 15, arab: 10 },
      stance: { eu: 18, palestinian_authority: 20 },
      flags: { withdrawal: true },
    },
    {
      id: "WD_UN_FORCE",
      label: { he: "נסיגה והזמנת כוח או\"ם לשטח", en: "Withdraw and invite a UN force" },
      objective: { he: "כוח בינלאומי ימלא את הוואקום.", en: "An international force fills the vacuum." },
      pros: [{ he: "תמיכה בינלאומית רחבה", en: "Broad international support" }],
      cons: [{ he: "תקדים יוניפי\"ל: החלטה 1701 (2006) לא מנעה את התעצמות חזבאללה", en: "The UNIFIL precedent: Resolution 1701 (2006) did not stop Hezbollah's buildup" }],
      deltas: { internationalLegitimacy: 22, securityThreat: 22, internalCohesion: -20 },
      partners: { far_right: -100, right: -70, haredi: -40, center: -30, left: 10, arab: 10 },
      stance: { eu: 20, china: 10, russia: 5 },
      flags: { withdrawal: true, unForce: true },
    },
  ],
};

// ---------------------------------------------------------------------------
// follow-up pool
// ---------------------------------------------------------------------------

const JORDAN_TREATY: DilemmaDef = {
  id: "JORDAN_TREATY",
  title: { he: "ירדן מאיימת להשעות את הסכם השלום", en: "Jordan threatens to suspend the peace treaty" },
  context: { he: "עמאן החזירה את שגרירה. הפגנות ענק בבירה; המלך בלחץ.", en: "Amman recalled its ambassador. Huge protests in the capital; the king is under pressure." },
  precedent: {
    years: "1994 · 2019 · 2020",
    title: { he: "הסכם השלום עם ירדן", en: "The Israel–Jordan peace treaty" },
    body: { he: "הסכם 1994 כולל אספקת מים לירדן. ב-2019 סירבה ירדן לחדש את החכירה בנהריים ובצופר. מאז 2020 זורם גז מלוויתן לירדן.", en: "The 1994 treaty includes water supply to Jordan. In 2019 Jordan declined to renew the Naharayim and Tzofar leases. Since 2020 Leviathan gas flows to Jordan." },
    lesson: { he: "השלום עם ירדן תלוי ביציבות המשטר ההאשמי ובשאלה הפלסטינית.", en: "Peace with Jordan depends on the Hashemite regime's stability and on the Palestinian question." },
  },
  focus: "jordan",
  weight: (v) => (v.flags.annexationLaw || v.flags.emigrationProgram ? 1.2 : v.metrics.regionalRelations < 20 ? 0.6 : 0),
  cooldown: 4,
  options: [
    { id: "JO_FREEZE", label: { he: "הקפאת צעדי הסיפוח בבקעת הירדן", en: "Freeze annexation steps in the Jordan Valley" }, objective: { he: "הצלת ההסכם.", en: "Save the treaty." }, pros: [{ he: "הגבול המזרחי שקט", en: "Quiet eastern border" }], cons: [{ he: "הימין זועם", en: "The right is furious" }], deltas: { regionalRelations: 15, internationalLegitimacy: 5 }, partners: { far_right: -30, right: -10 }, stance: { jordan: 25 } },
    { id: "JO_PRESSURE", label: { he: "לחץ: איום לעצור את אספקת המים", en: "Pressure: threaten to stop the water supply" }, objective: { he: "הרתעת עמאן.", en: "Deter Amman." }, pros: [{ he: "מנוף מיידי", en: "Immediate leverage" }], cons: [{ he: "ערעור יציבות המשטר ההאשמי", en: "Destabilizes the Hashemite regime" }, { he: "ביקורת אמריקאית", en: "US criticism" }], deltas: { regionalRelations: -20, internationalLegitimacy: -10, securityThreat: 10 }, partners: { far_right: 10, center: -20 }, stance: { jordan: -35, usa: -10, saudi: -10 },
      consequences: [{ p: 0.5, headline: { he: "הפגנות ענק בעמאן נגד המשטר", en: "Huge protests in Amman against the regime" }, body: { he: "גורמי ביטחון מזהירים מהסתננות חמושים בגבול המזרחי.", en: "Security officials warn of militant infiltration across the eastern border." }, severity: "bad", focus: "jordan", deltas: { securityThreat: 8 } }] },
    { id: "JO_US", label: { he: "תיווך אמריקאי ומענק כלכלי לירדן", en: "US mediation and an economic package for Jordan" }, objective: { he: "הרגעה בלי ויתור מהותי.", en: "Calm things without a real concession." }, pros: [{ he: "שימור ההסכם", en: "Treaty preserved" }], cons: [{ he: "תלות בוושינגטון", en: "Dependence on Washington" }], deltas: { regionalRelations: 6, usMilitaryAid: 3, economicStability: -3 }, stance: { jordan: 10, usa: 5 } },
  ],
};

const SETTLER_VIOLENCE: DilemmaDef = {
  id: "SETTLER_VIOLENCE",
  title: { he: "אלימות מתנחלים והחרמות מערביות", en: "Settler violence and Western sanctions" },
  context: { he: "כפר פלסטיני הוצת. וושינגטון ולונדון שוקלות סנקציות רחבות.", en: "A Palestinian village was set on fire. Washington and London weigh broad sanctions." },
  focus: "west_bank",
  weight: (v) => (v.track === "CONSERVATIVE_RIGHT_ANNEXATION" || v.flags.annexationLaw ? 0.8 : 0),
  cooldown: 4,
  options: [
    { id: "SV_ENFORCE", label: { he: "אכיפה: מעצרים מנהליים לפורעים", en: "Enforce: administrative detention for rioters" }, objective: { he: "השבת שלטון החוק.", en: "Restore the rule of law." }, pros: [{ he: "הסנקציות נמנעות", en: "Sanctions averted" }], cons: [{ he: "משבר עם הימין הקיצוני", en: "Crisis with the far right" }], deltas: { internationalLegitimacy: 10, securityThreat: -4 }, partners: { far_right: -35, right: -5, center: 10 }, stance: { usa: 8, eu: 5 } },
    { id: "SV_IGNORE", label: { he: "גינוי מילולי בלבד", en: "Verbal condemnation only" }, objective: { he: "שקט קואליציוני.", en: "Coalition calm." }, pros: [{ he: "הקואליציה יציבה", en: "Coalition stable" }], cons: [{ he: "סנקציות אמריקאיות ובריטיות", en: "US and UK sanctions" }, { he: "הסלמה ביו\"ש", en: "West Bank escalation" }], deltas: { internationalLegitimacy: -12, securityThreat: 8 }, partners: { far_right: 5, center: -15, left: -25 }, stance: { usa: -10, uk: -12, eu: -10 },
      consequences: [{ headline: { he: "סנקציות על שרים ועל תקציבי התיישבות", en: "Sanctions on ministers and settlement budgets" }, body: { he: "בריטניה, קנדה, אוסטרליה, ניו זילנד ונורבגיה הטילו ב-2025 סנקציות על שני שרים — כעת גם ארה\"ב מצטרפת.", en: "In 2025 the UK, Canada, Australia, New Zealand and Norway sanctioned two ministers — now the US joins." }, severity: "bad", focus: "usa", deltas: { usMilitaryAid: -8 } }] },
    { id: "SV_SUPPORT", label: { he: "תמיכה ממשלתית ב\"הגנה עצמית\" של המתנחלים", en: "Government backing for settler \"self-defense\"" }, objective: { he: "חיזוק האחיזה בשטח.", en: "Tighten the hold on the ground." }, pros: [{ he: "הימין הקיצוני מרוצה", en: "Far right satisfied" }], cons: [{ he: "אנרכיה ביטחונית", en: "Security anarchy" }, { he: "גל טרור", en: "Terror wave" }], deltas: { internationalLegitimacy: -20, securityThreat: 15, internalCohesion: -6 }, partners: { far_right: 15, right: -10, center: -35 }, stance: { usa: -15, eu: -20, jordan: -20 } },
  ],
};

const ICC_WARRANTS: DilemmaDef = {
  id: "ICC_WARRANTS",
  title: { he: "צווי מעצר מבית הדין הפלילי הבינלאומי", en: "International Criminal Court arrest warrants" },
  context: { he: "הוצאו צווים נגד ראש הממשלה ושר הביטחון. מדינות אירופה הודיעו שיאכפו.", en: "Warrants issued against the prime minister and defense minister. European states say they will enforce." },
  precedent: {
    years: "2020 · 2024 · 2025",
    title: { he: "ישראל, ארה\"ב ובית הדין בהאג", en: "Israel, the US and The Hague" },
    body: { he: "בנובמבר 2024 הוציא בית הדין צווי מעצר לנתניהו ולגלנט. ארה\"ב אינה חברה וממשל טראמפ הטיל סנקציות על בכירי בית הדין ב-2020 וב-2025.", en: "In November 2024 the Court issued warrants for Netanyahu and Gallant. The US is not a member, and the Trump administration sanctioned Court officials in 2020 and 2025." },
    lesson: { he: "הגנה אמריקאית מקטינה את הנזק — אבל לא מבטלת את הבידוד האירופי.", en: "US protection limits the damage — but does not undo European isolation." },
  },
  focus: "europe",
  weight: (v) => (v.flags.iccWarrants ? 0 : v.metrics.internationalLegitimacy <= 20 ? 1.4 : 0),
  once: true,
  options: [
    { id: "ICC_INQUIRY", label: { he: "ועדת חקירה ממלכתית עצמאית", en: "Independent state commission of inquiry" }, objective: { he: "עקרון המשלימות: חקירה ישראלית מונעת התערבות בינלאומית.", en: "Complementarity: an Israeli inquiry pre-empts international action." }, pros: [{ he: "טענה משפטית חזקה בהאג", en: "Strong legal argument in The Hague" }], cons: [{ he: "סכנה פוליטית לממשלה", en: "Political danger for the government" }], deltas: { internationalLegitimacy: 15, internalCohesion: 4 }, partners: { far_right: -25, right: -20, center: 15, left: 10 }, stance: { eu: 12, uk: 10 }, flags: { iccWarrants: true } },
    { id: "ICC_DEFY", label: { he: "חרם מלא על בית הדין וגיוס סנקציות אמריקאיות נגדו", en: "Full boycott of the Court and US sanctions against it" }, objective: { he: "דה-לגיטימציה של ההליך.", en: "Delegitimize the proceedings." }, pros: [{ he: "גיבוי מהימין ומוושינגטון", en: "Backing from the right and Washington" }], cons: [{ he: "הגבלות נסיעה לבכירים", en: "Travel limits for officials" }, { he: "אירופה מקשיחה עמדות", en: "Europe hardens" }], deltas: { internationalLegitimacy: -12, usMilitaryAid: 4 }, partners: { far_right: 10, right: 10, center: -10 }, stance: { eu: -15, usa: 5 }, flags: { iccWarrants: true } },
    { id: "ICC_IGNORE", label: { he: "התעלמות", en: "Ignore it" }, objective: { he: "לחכות שיעבור.", en: "Wait it out." }, pros: [{ he: "אין מחיר פוליטי מיידי", en: "No immediate political cost" }], cons: [{ he: "שחיקה מתמשכת בלגיטימציה", en: "Steady erosion of legitimacy" }], deltas: { internationalLegitimacy: -6, economicStability: -3 }, flags: { iccWarrants: true } },
  ],
};

const EU_BOYCOTT: DilemmaDef = {
  id: "EU_BOYCOTT",
  title: { he: "חרם כלכלי מאירופה", en: "Economic boycott from Europe" },
  context: { he: "הנציבות האירופית מציעה להשעות את העדפות הסחר בהסכם השיוך. האיחוד הוא שותף הסחר הגדול של ישראל.", en: "The European Commission proposes suspending trade preferences in the Association Agreement. The EU is Israel's largest trading partner." },
  focus: "europe",
  weight: (v) => (v.flags.euSanctions ? 0 : v.metrics.internationalLegitimacy <= 30 ? 1.2 : 0),
  cooldown: 5,
  options: [
    { id: "EU_BLOCK", label: { he: "גיוס בעלות ברית באיחוד (הונגריה, צ'כיה, גרמניה) לחסימה", en: "Rally EU allies (Hungary, Czechia, Germany) to block it" }, objective: { he: "מניעת רוב מיוחס.", en: "Deny a qualified majority." }, pros: [{ he: "הסחר נשמר", en: "Trade preserved" }], cons: [{ he: "סיכוי חלקי בלבד", en: "Only a partial chance" }], deltas: {}, gamble: { p: 0.5, success: { deltas: { economicStability: 2 }, label: { he: "נחסם (50%)", en: "Blocked (50%)" } }, failure: { deltas: { economicStability: -14, internationalLegitimacy: -5 }, label: { he: "עבר (50%)", en: "Passed (50%)" } } }, stance: { eu: -5 } },
    { id: "EU_CONCEDE", label: { he: "צעדים הומניטריים ובלימת ההתנחלויות", en: "Humanitarian steps and a settlement brake" }, objective: { he: "הסרת העילה.", en: "Remove the grounds." }, pros: [{ he: "החרם נמנע", en: "Boycott averted" }], cons: [{ he: "הימין מאיים", en: "The right threatens" }], deltas: { internationalLegitimacy: 12, economicStability: 3 }, partners: { far_right: -35, right: -10, center: 10 }, stance: { eu: 20 } },
    { id: "EU_RETALIATE", label: { he: "תגובת נגד: הגבלת פעילות האיחוד ביו\"ש", en: "Retaliate: restrict EU activity in the West Bank" }, objective: { he: "הרתעה.", en: "Deterrence." }, pros: [{ he: "מסר תקיף", en: "Firm message" }], cons: [{ he: "החרם עובר ומחמיר", en: "The boycott passes and deepens" }], deltas: { economicStability: -16, internationalLegitimacy: -10 }, partners: { far_right: 10 }, stance: { eu: -20 }, flags: { euSanctions: true } },
  ],
};

const HEZBOLLAH_FRONT: DilemmaDef = {
  id: "HEZBOLLAH_FRONT",
  title: { he: "חזבאללה פותח חזית בצפון", en: "Hezbollah opens a northern front" },
  context: { he: "מטחי רקטות על חיפה והגליל; עשרות אלפי תושבים בממ\"דים.", en: "Rocket barrages on Haifa and the Galilee; tens of thousands in shelters." },
  precedent: {
    years: "2006 · 2023–2024",
    title: { he: "מלחמת לבנון השנייה והחזית הצפונית", en: "The Second Lebanon War and the northern front" },
    body: { he: "ב-2006 נורו כ-4,000 רקטות על הצפון. באוקטובר 2023 פתח חזבאללה באש; כ-60 אלף תושבים פונו. ב-2024 פגעה ישראל קשות בהנהגת הארגון, ובנובמבר נחתמה הפסקת אש.", en: "In 2006 about 4,000 rockets hit the north. In October 2023 Hezbollah opened fire; about 60,000 residents were evacuated. In 2024 Israel badly hit the group's leadership, and a ceasefire was signed in November." },
    lesson: { he: "מלחמה בצפון מכריעה בזמן — אבל גובה מחיר עורפי וכלכלי כבד.", en: "A northern war can be decisive over time — but exacts a heavy home-front and economic price." },
  },
  focus: "lebanon",
  visual: { kind: "salvo", from: "hezbollah", weapon: "rocket", count: 14 },
  weight: (v) => (v.flags.lebanonWar ? 0 : v.metrics.securityThreat >= 60 ? (v.metrics.securityThreat - 50) / 25 : 0),
  cooldown: 4,
  options: [
    { id: "HZ_OFFENSIVE", label: { he: "מערכה אווירית וקרקעית בדרום לבנון", en: "Air and ground campaign in southern Lebanon" }, objective: { he: "הרחקת האיום מהגבול.", en: "Push the threat back from the border." }, pros: [{ he: "פגיעה ביכולות", en: "Damage to capabilities" }], cons: [{ he: "שחיקת מילואים ומשק", en: "Reserves and economy worn down" }], deltas: { securityThreat: -12, economicStability: -12, internalCohesion: -4, internationalLegitimacy: -8 }, partners: { far_right: 5, right: 5, center: 5, arab: -20 }, stance: { hezbollah: -20, iran: -10 }, flags: { lebanonWar: true }, visual: { kind: "strike", target: "lebanon", count: 10 },
      consequences: [{ headline: { he: "חזבאללה משגר טילים מדויקים לגוש דן", en: "Hezbollah fires precision missiles at Gush Dan" }, body: { he: "קלע דוד ופטריוט מיירטים; נפילות במרכז.", en: "David's Sling and Patriot intercept; impacts in the center." }, severity: "bad", focus: "israel", visual: { kind: "salvo", from: "hezbollah", weapon: "rocket", count: 12 }, deltas: { economicStability: -4 } }] },
    { id: "HZ_CONTAIN", label: { he: "תגובה מדודה והגנה", en: "Measured response and defense" }, objective: { he: "הימנעות ממלחמה כוללת.", en: "Avoid all-out war." }, pros: [{ he: "משק מתפקד", en: "Economy keeps running" }], cons: [{ he: "הצפון נשאר מפונה", en: "The north stays evacuated" }], deltas: { securityThreat: 6, internalCohesion: -6, economicStability: -5 }, partners: { far_right: -10, right: -5 } },
    { id: "HZ_US_FRANCE", label: { he: "תיווך אמריקאי-צרפתי ואכיפת 1701", en: "US–French mediation and enforcing 1701" }, objective: { he: "הפסקת אש מדינית.", en: "A diplomatic ceasefire." }, pros: [{ he: "תמיכה בינלאומית", en: "International support" }], cons: [{ he: "תלות באכיפה שנכשלה בעבר", en: "Relies on enforcement that failed before" }], deltas: { securityThreat: -4, internationalLegitimacy: 8, usMilitaryAid: 4 }, partners: { far_right: -15 }, stance: { usa: 5, eu: 5 }, flags: { lebanonWar: false } },
  ],
};

const HOUTHI_RED_SEA: DilemmaDef = {
  id: "HOUTHI_RED_SEA",
  title: { he: "החות'ים סוגרים את ים סוף", en: "The Houthis close the Red Sea" },
  context: { he: "טילים וכטב\"מים לעבר אילת ואוניות; נמל אילת משותק.", en: "Missiles and drones at Eilat and shipping; Eilat port paralysed." },
  precedent: {
    years: "2023–2025",
    title: { he: "המצור החות'י", en: "The Houthi blockade" },
    body: { he: "מנובמבר 2023 תקפו החות'ים אוניות בים סוף; פעילות נמל אילת קרסה. ביולי 2024 תקפה ישראל את נמל חודיידה; ארה\"ב ובריטניה תקפו בתימן לאורך 2024–2025.", en: "From November 2023 the Houthis attacked Red Sea shipping; Eilat port activity collapsed. In July 2024 Israel struck Hodeidah port; the US and UK struck Yemen through 2024–2025." },
    lesson: { he: "תקיפות מרחוק פוגעות אך לא מכריעות שחקן לא-מדינתי עמיד.", en: "Long-range strikes hurt but do not defeat a resilient non-state actor." },
  },
  focus: "red_sea",
  visual: { kind: "salvo", from: "houthis", weapon: "drone", count: 6 },
  weight: (v) => (v.flags.redSeaBlockade ? 0 : v.metrics.securityThreat >= 55 ? 0.7 : 0),
  once: true,
  options: [
    { id: "HO_STRIKE", label: { he: "תקיפה ארוכת טווח על נמל חודיידה", en: "Long-range strike on Hodeidah port" }, objective: { he: "גביית מחיר.", en: "Exact a price." }, pros: [{ he: "הרתעה", en: "Deterrence" }], cons: [{ he: "המצור נמשך", en: "The blockade continues" }], deltas: { securityThreat: -3, economicStability: -4 }, stance: { houthis: -15 }, flags: { redSeaBlockade: true }, visual: { kind: "strike", target: "yemen", count: 6 } },
    { id: "HO_COALITION", label: { he: "הצטרפות לכוח משימה ימי בינלאומי", en: "Join an international naval task force" }, objective: { he: "פתיחת הנתיב בשיתוף פעולה.", en: "Reopen the route together." }, pros: [{ he: "חיזוק בריתות", en: "Stronger alliances" }], cons: [{ he: "המצור רק מוקל", en: "The blockade only eases" }], deltas: { usMilitaryAid: 5, regionalRelations: 4, economicStability: -2 }, stance: { usa: 6, uk: 5, egypt: 5 }, flags: { redSeaBlockade: true } },
    { id: "HO_ABSORB", label: { he: "ספיגה והסטת סחר לנמלי הים התיכון", en: "Absorb it; reroute trade to Mediterranean ports" }, objective: { he: "הימנעות מהסלמה.", en: "Avoid escalation." }, pros: [{ he: "אין חזית נוספת", en: "No extra front" }], cons: [{ he: "עלות כלכלית ופגיעה באילת", en: "Economic cost; Eilat hit" }], deltas: { economicStability: -7, internalCohesion: -2 }, flags: { redSeaBlockade: true } },
  ],
};

const US_ARMS_HOLD: DilemmaDef = {
  id: "US_ARMS_HOLD",
  title: { he: "ארה\"ב מעכבת חימוש ומיירטים", en: "The US holds munitions and interceptors" },
  context: { he: "הבית הלבן מתנה את המשלוחים הבאים בשינוי מדיניות. מלאי המיירטים יורד.", en: "The White House conditions the next shipments on a policy change. Interceptor stocks are falling." },
  focus: "usa",
  weight: (v) => (v.metrics.usMilitaryAid <= 40 ? 1.1 : 0),
  cooldown: 4,
  options: [
    { id: "US_COMPLY", label: { he: "היענות לתנאים האמריקאיים", en: "Accept the US conditions" }, objective: { he: "חידוש אספקה.", en: "Resume supply." }, pros: [{ he: "מיירטים וחלפים", en: "Interceptors and spares" }], cons: [{ he: "הימין רואה כניעה", en: "The right sees surrender" }], deltas: { usMilitaryAid: 20, internationalLegitimacy: 6 }, partners: { far_right: -30, right: -10, center: 5 }, stance: { usa: 15 }, flags: { usArmsHold: false }, setTrack: null },
    { id: "US_CONGRESS", label: { he: "גיוס הקונגרס נגד הממשל", en: "Rally Congress against the administration" }, objective: { he: "עקיפת הבית הלבן.", en: "Go around the White House." }, pros: [{ he: "ללא ויתור מדיני", en: "No policy concession" }], cons: [{ he: "הפיכת ישראל לסוגיה מפלגתית", en: "Israel becomes a partisan issue" }], deltas: {}, gamble: { p: 0.45, success: { deltas: { usMilitaryAid: 12 }, label: { he: "הצליח (45%)", en: "Worked (45%)" } }, failure: { deltas: { usMilitaryAid: -8, internationalLegitimacy: -4 }, label: { he: "נכשל (55%)", en: "Failed (55%)" } } }, stance: { usa: -3 } },
    { id: "US_INDEPENDENT", label: { he: "תוכנית חירום לייצור חימוש עצמי", en: "Emergency domestic munitions program" }, objective: { he: "עצמאות אסטרטגית.", en: "Strategic independence." }, pros: [{ he: "פחות תלות לטווח ארוך", en: "Less long-term dependence" }], cons: [{ he: "שנים ועשרות מיליארדים", en: "Years and tens of billions" }], deltas: { economicStability: -12, securityThreat: 5 }, partners: { far_right: 5, right: 5 } },
  ],
};

const RESERVIST_REFUSAL: DilemmaDef = {
  id: "RESERVIST_REFUSAL",
  title: { he: "גל סרבנות במילואים", en: "Wave of reservist refusal" },
  context: { he: "אלפי מילואימניקים מודיעים שלא יתייצבו. יחידות מובחרות בחוסר.", en: "Thousands of reservists say they won't report. Elite units are short." },
  precedent: {
    years: "2023",
    title: { he: "מחאת המילואימניקים", en: "The reservists' protest" },
    body: { he: "ביולי 2023, על רקע הרפורמה המשפטית, חתמו יותר מ-10,000 אנשי מילואים על הודעות שלא יתנדבו. אחרי 7 באוקטובר התייצבו רובם.", en: "In July 2023, amid the judicial overhaul, more than 10,000 reservists signed that they would stop volunteering. After October 7 most reported for duty." },
    lesson: { he: "צבא העם תלוי בלגיטימציה של ההחלטות ובשוויון בנטל.", en: "A people's army depends on the legitimacy of decisions and on sharing the burden." },
  },
  focus: "israel",
  visual: { kind: "protest" },
  weight: (v) => (v.metrics.internalCohesion <= 35 || v.flags.reservistRefusal ? 1.2 : 0),
  cooldown: 4,
  options: [
    { id: "RR_PROSECUTE", label: { he: "העמדה לדין של סרבנים", en: "Prosecute refusers" }, objective: { he: "שמירת המשמעת.", en: "Preserve discipline." }, pros: [{ he: "מסר תקיף", en: "Firm message" }], cons: [{ he: "הסלמת השסע", en: "Deepens the rift" }], deltas: { internalCohesion: -12, securityThreat: 5 }, partners: { far_right: 10, center: -20, left: -30 } },
    { id: "RR_HAREDI_DRAFT", label: { he: "חוק גיוס שוויוני לחרדים", en: "Equal draft law for Haredim" }, objective: { he: "שוויון בנטל.", en: "Share the burden." }, pros: [{ he: "לכידות ומוטיבציה", en: "Cohesion and motivation" }], cons: [{ he: "המפלגות החרדיות מאיימות לפרוש", en: "Haredi parties threaten to quit" }], deltas: { internalCohesion: 15, securityThreat: -3 }, partners: { haredi: -70, center: 20, right: 5 } },
    { id: "RR_DIALOGUE", label: { he: "הקפאת המהלך השנוי במחלוקת ודיאלוג", en: "Pause the contested move and open dialogue" }, objective: { he: "הרגעה.", en: "De-escalation." }, pros: [{ he: "חזרה להתייצבות", en: "Reservists return" }], cons: [{ he: "הקואליציה רואה חולשה", en: "Coalition sees weakness" }], deltas: { internalCohesion: 10 }, partners: { far_right: -20, right: -10, center: 10 }, flags: { reservistRefusal: false } },
  ],
};

const MASS_PROTESTS: DilemmaDef = {
  id: "MASS_PROTESTS",
  title: { he: "מחאה המונית: מאות אלפים ברחובות", en: "Mass protest: hundreds of thousands in the streets" },
  context: { he: "צומת קפלן וכבישי איילון חסומים. ההסתדרות שוקלת שביתה כללית.", en: "Kaplan junction and the Ayalon highway are blocked. The Histadrut weighs a general strike." },
  focus: "israel",
  visual: { kind: "protest" },
  weight: (v) => (v.metrics.internalCohesion <= 30 || v.flags.massProtests ? 1 : 0),
  cooldown: 3,
  options: [
    { id: "MP_EMERGENCY", label: { he: "תקנות חירום והגבלת הפגנות", en: "Emergency regulations limiting protests" }, objective: { he: "השבת הסדר.", en: "Restore order." }, pros: [{ he: "שקט זמני", en: "Temporary calm" }], cons: [{ he: "משבר דמוקרטי", en: "Democratic crisis" }, { he: "ביקורת בינלאומית", en: "International criticism" }], deltas: { internalCohesion: -18, internationalLegitimacy: -10 }, partners: { far_right: 10, center: -40, left: -60 }, flags: { emergencyRule: true } },
    { id: "MP_REFERENDUM", label: { he: "הקדמת בחירות / משאל עם על המדיניות", en: "Early elections / referendum on the policy" }, objective: { he: "הכרעה דמוקרטית.", en: "A democratic decision." }, pros: [{ he: "הורדת הלהבות", en: "Lowers the temperature" }], cons: [{ he: "סכנה לשלטון", en: "Risk to your rule" }], deltas: { internalCohesion: 18 }, gamble: { p: 0.5, success: { deltas: { coalitionStability: 15 }, label: { he: "הציבור תומך (50%)", en: "Public backs you (50%)" } }, failure: { deltas: { coalitionStability: -60 }, label: { he: "הציבור דוחה (50%)", en: "Public rejects you (50%)" } } } },
    { id: "MP_COMPROMISE", label: { he: "פשרה: מיתון המדיניות", en: "Compromise: soften the policy" }, objective: { he: "רגיעה חברתית.", en: "Social calm." }, pros: [{ he: "לכידות משתפרת", en: "Cohesion improves" }], cons: [{ he: "הבסיס מאוכזב", en: "The base is disappointed" }], deltas: { internalCohesion: 12, internationalLegitimacy: 4 }, partners: { far_right: -25, right: -10, center: 10 }, flags: { massProtests: false } },
  ],
};

const CIVIL_REVOLT: DilemmaDef = {
  id: "CIVIL_REVOLT",
  title: { he: "מרי אזרחי ביהודה ושומרון", en: "Civil revolt in the West Bank settlements" },
  context: { he: "מועצות יש\"ע מכריזות על אי-ציות; חלק מכיתות הכוננות מסרבות להתפרק מנשקן.", en: "The settlement councils declare non-compliance; some local security squads refuse to disarm." },
  precedent: {
    years: "2005",
    title: { he: "ההתנתקות", en: "The disengagement" },
    body: { he: "ב-2005 פונו כ-8,000 תושבים מרצועת עזה ומצפון השומרון. המחאה הייתה עזה אך התפנות בוצעה ללא שפיכות דמים המונית.", en: "In 2005 about 8,000 residents were evacuated from Gaza and northern Samaria. Protest was fierce, but the evacuation passed without mass bloodshed." },
    lesson: { he: "פינוי בהיקף של מאות אלפים הוא אתגר מסדר גודל אחר לחלוטין.", en: "Evacuating hundreds of thousands is a challenge of an entirely different order." },
  },
  focus: "west_bank",
  options: [
    { id: "CR_FORCE", label: { he: "פינוי בכוח בכל מחיר", en: "Forced evacuation at any cost" }, objective: { he: "ביצוע ההחלטה.", en: "Carry out the decision." }, pros: [{ he: "שלטון החוק", en: "Rule of law" }], cons: [{ he: "סכנת מלחמת אחים", en: "Risk of fratricide" }], deltas: { internalCohesion: -25, internationalLegitimacy: 5 }, partners: { center: -20 } },
    { id: "CR_PAUSE", label: { he: "השהיית הפינוי ומו\"מ עם המועצות", en: "Pause the evacuation; negotiate with the councils" }, objective: { he: "מניעת שפיכות דמים.", en: "Prevent bloodshed." }, pros: [{ he: "הורדת מתח", en: "Lower tension" }], cons: [{ he: "העולם רואה נסיגה מההבטחה", en: "The world sees a broken promise" }, { he: "ואקום ביטחוני נמשך", en: "The security vacuum persists" }], deltas: { internalCohesion: 12, internationalLegitimacy: -12, securityThreat: 6 }, partners: { left: -20, arab: -20 } },
    { id: "CR_REFERENDUM", label: { he: "משאל עם על הנסיגה", en: "Referendum on the withdrawal" }, objective: { he: "לגיטימציה דמוקרטית.", en: "Democratic legitimacy." }, pros: [{ he: "מקור סמכות מוסכם", en: "Agreed source of authority" }], cons: [{ he: "הימור", en: "A gamble" }], deltas: {}, gamble: { p: 0.4, success: { deltas: { internalCohesion: 20 }, label: { he: "רוב לנסיגה (40%)", en: "Majority for withdrawal (40%)" } }, failure: { deltas: { internalCohesion: 5, coalitionStability: -50, internationalLegitimacy: -10 }, label: { he: "רוב נגד (60%)", en: "Majority against (60%)" } } } },
  ],
};

const CREDIT_DOWNGRADE: DilemmaDef = {
  id: "CREDIT_DOWNGRADE",
  title: { he: "הורדת דירוג אשראי", en: "Credit-rating downgrade" },
  context: { he: "סוכנויות הדירוג מורידות את ישראל; התשואות מזנקות והשקל נחלש.", en: "Rating agencies downgrade Israel; yields jump and the shekel weakens." },
  precedent: {
    years: "2024",
    title: { he: "הורדות הדירוג של 2024", en: "The 2024 downgrades" },
    body: { he: "ב-2024 הורידו מודי'ס, S&P ופיץ' את דירוג ישראל לראשונה בתולדותיה, בנימוק של המלחמה והגירעון.", en: "In 2024 Moody's, S&P and Fitch downgraded Israel for the first time in its history, citing the war and the deficit." },
    lesson: { he: "ביטחון ממומן בחוב — והשווקים מתמחרים את הסיכון.", en: "Security is financed with debt — and markets price the risk." },
  },
  focus: "israel",
  weight: (v) => (v.flags.downgraded ? 0 : v.metrics.economicStability <= 38 ? 1.3 : 0),
  once: true,
  options: [
    { id: "CD_AUSTERITY", label: { he: "קיצוצים רוחביים והעלאת מסים", en: "Across-the-board cuts and tax hikes" }, objective: { he: "הרגעת השווקים.", en: "Calm the markets." }, pros: [{ he: "יציבות פיסקלית", en: "Fiscal stability" }], cons: [{ he: "מחאה חברתית", en: "Social protest" }], deltas: { economicStability: 12, internalCohesion: -8 }, partners: { haredi: -10 }, flags: { downgraded: true } },
    { id: "CD_COALITION_FUNDS", label: { he: "ביטול כספים קואליציוניים", en: "Cancel coalition earmarks" }, objective: { he: "קיצוץ בלי לפגוע בציבור הרחב.", en: "Cut without hurting the general public." }, pros: [{ he: "אמון ציבורי", en: "Public trust" }], cons: [{ he: "החרדים והימין הקיצוני זועמים", en: "Haredim and far right furious" }], deltas: { economicStability: 8, internalCohesion: 4 }, partners: { haredi: -40, far_right: -20 }, flags: { downgraded: true } },
    { id: "CD_DEFICIT", label: { he: "הגדלת הגירעון", en: "Run a bigger deficit" }, objective: { he: "דחיית הכאב.", en: "Postpone the pain." }, pros: [{ he: "אין מחיר מיידי", en: "No immediate price" }], cons: [{ he: "הורדות דירוג נוספות", en: "Further downgrades" }], deltas: { economicStability: -10 }, flags: { downgraded: true } },
  ],
};

const TERROR_ATTACK: DilemmaDef = {
  id: "TERROR_ATTACK",
  title: { he: "פיגוע ירי בירושלים", en: "Shooting attack in Jerusalem" },
  context: { he: "מחבל פתח באש בתחנת אוטובוס; יש הרוגים. הציבור דורש תגובה.", en: "A gunman opened fire at a bus stop; people were killed. The public demands a response." },
  focus: "israel",
  weight: (v) => 0.35 + v.metrics.securityThreat / 150,
  cooldown: 2,
  options: [
    { id: "TA_TARGETED", label: { he: "מבצע סיכול ממוקד בתשתית המחבל", en: "Targeted counter-terror raid on the attacker's network" }, objective: { he: "פגיעה ברשת בלי ענישה קולקטיבית.", en: "Hit the network without collective punishment." }, pros: [{ he: "יעיל ומדויק", en: "Effective and precise" }], cons: [{ he: "הימין דורש יותר", en: "The right demands more" }], deltas: { securityThreat: -6, internationalLegitimacy: 2 }, partners: { far_right: -5 }, visual: { kind: "ground", target: "west_bank" } },
    { id: "TA_COLLECTIVE", label: { he: "סגר, הריסת בתים ושלילת היתרי עבודה", en: "Closure, home demolitions, work permits revoked" }, objective: { he: "הרתעה רחבה.", en: "Broad deterrence." }, pros: [{ he: "תמיכה ציבורית מיידית", en: "Immediate public support" }], cons: [{ he: "התלקחות וביקורת בינלאומית", en: "Flare-up and international criticism" }], deltas: { securityThreat: 4, internationalLegitimacy: -8, economicStability: -3 }, partners: { far_right: 10, right: 5, center: -10, arab: -25 }, stance: { eu: -5, jordan: -5 } },
    { id: "TA_RESTRAINT", label: { he: "איפוק וחיזוק שמירה", en: "Restraint and reinforced security" }, objective: { he: "מניעת הסלמה.", en: "Prevent escalation." }, pros: [{ he: "שקט יחסי", en: "Relative calm" }], cons: [{ he: "נתפס כחולשה", en: "Seen as weakness" }], deltas: { internalCohesion: -3, securityThreat: 2 }, partners: { far_right: -15, right: -5 } },
  ],
};

const SAUDI_DEAL: DilemmaDef = {
  id: "SAUDI_DEAL",
  title: { he: "הסכם נורמליזציה עם סעודיה על השולחן", en: "A normalization deal with Saudi Arabia is on the table" },
  context: { he: "ריאד מוכנה לחתום — בתמורה למסלול מחייב לקראת מדינה פלסטינית ולהסכם הגנה אמריקאי.", en: "Riyadh is ready to sign — in return for a binding path toward a Palestinian state and a US defense pact." },
  focus: "gulf",
  weight: (v) => (v.flags.saudiDeal ? 0 : v.flags.trusteeshipTalks && v.metrics.regionalRelations >= 55 ? 1.5 : 0),
  once: true,
  options: [
    { id: "SA_SIGN", label: { he: "חתימה עם מסלול מדיני מחייב", en: "Sign with a binding political path" }, objective: { he: "שלום היסטורי עם סעודיה.", en: "Historic peace with Saudi Arabia." }, pros: [{ he: "קפיצה כלכלית וביטחונית", en: "Economic and security leap" }, { he: "בידוד איראן", en: "Iran isolated" }], cons: [{ he: "הימין הקיצוני יפרוש", en: "The far right will quit" }], deltas: { regionalRelations: 25, economicStability: 15, usMilitaryAid: 10, internationalLegitimacy: 12, securityThreat: -8 }, partners: { far_right: -100, right: -15, center: 20, left: 10, arab: 10 }, stance: { saudi: 40, uae: 15, usa: 15, iran: -15 }, flags: { saudiDeal: true },
      consequences: [{ headline: { he: "טקס חתימה בבית הלבן", en: "Signing ceremony at the White House" }, body: { he: "מסדרון IMEC מקבל דחיפה; מטוסים ישראליים טסים מעל ריאד.", en: "The IMEC corridor gets a boost; Israeli planes fly over Riyadh." }, severity: "good", focus: "gulf" }] },
    { id: "SA_LIGHT", label: { he: "הסכם \"רך\" ללא התחייבות מדינית", en: "A \"light\" deal without a political commitment" }, objective: { he: "רווחים כלכליים בלי מחיר קואליציוני.", en: "Economic gains without a coalition price." }, pros: [{ he: "שימור הקואליציה", en: "Coalition preserved" }], cons: [{ he: "ריאד עלולה לסרב", en: "Riyadh may refuse" }], deltas: {}, gamble: { p: 0.35, success: { deltas: { regionalRelations: 12, economicStability: 8 }, label: { he: "ריאד מסכימה (35%)", en: "Riyadh agrees (35%)" } }, failure: { deltas: { regionalRelations: -8 }, label: { he: "ריאד מסרבת (65%)", en: "Riyadh refuses (65%)" } } }, stance: { saudi: 5 } },
    { id: "SA_DECLINE", label: { he: "דחייה", en: "Decline" }, objective: { he: "שמירת חופש הפעולה.", en: "Keep freedom of action." }, pros: [{ he: "אין ויתורים", en: "No concessions" }], cons: [{ he: "הזדמנות היסטורית מוחמצת", en: "A historic chance missed" }], deltas: { regionalRelations: -15, usMilitaryAid: -5 }, partners: { far_right: 10, center: -15 }, stance: { saudi: -25, usa: -8 } },
  ],
};

/** Offered whenever a war keeps the term from ending — the way out of a war. */
export const CEASEFIRE_TALKS: DilemmaDef = {
  id: "CEASEFIRE_TALKS",
  title: { he: "משא ומתן על הפסקת אש", en: "Ceasefire negotiations" },
  context: {
    he: "המלחמה נמשכת והבחירות נדחו. מצרים, קטאר וארה\"ב מציעות מתווה להפסקת אש כוללת.",
    en: "The war goes on and elections are postponed. Egypt, Qatar and the US propose a framework for a comprehensive ceasefire.",
  },
  precedent: {
    years: "2006 · 2024 · 2025",
    title: { he: "הפסקות אש בתיווך", en: "Brokered ceasefires" },
    body: {
      he: "מלחמת לבנון השנייה הסתיימה בהחלטה 1701 (אוגוסט 2006); הלחימה מול חזבאללה נעצרה בהסכם בתיווך אמריקאי-צרפתי (נובמבר 2024); הפסקות האש בעזה ב-2025 הושגו בתיווך מצרי, קטארי ואמריקאי.",
      en: "The Second Lebanon War ended with Resolution 1701 (August 2006); fighting with Hezbollah stopped under a US–French brokered deal (November 2024); the 2025 Gaza ceasefires were brokered by Egypt, Qatar and the US.",
    },
    lesson: { he: "הפסקות אש מחזיקות כשיש להן מנגנון אכיפה וערבות של מעצמה.", en: "Ceasefires hold when they have an enforcement mechanism and a great-power guarantor." },
  },
  focus: "israel",
  weight: (v) => ((v.flags.lebanonWar || v.flags.transferOrdered || v.metrics.securityThreat >= 70) ? (v.step >= 12 ? 2 : 0.3) : 0),
  cooldown: 2,
  options: [
    {
      id: "CF_COMPREHENSIVE",
      label: { he: "הפסקת אש כוללת בתיווך אמריקאי-מצרי-קטארי", en: "Comprehensive ceasefire brokered by the US, Egypt and Qatar" },
      objective: { he: "סיום הלחימה בכל החזיתות.", en: "End the fighting on every front." },
      pros: [{ he: "העורף חוזר לשגרה", en: "The home front returns to normal" }, { he: "הבחירות יכולות להתקיים", en: "Elections can go ahead" }],
      cons: [{ he: "הימין רואה בכך הפסד", en: "The right calls it a defeat" }, { he: "האויב שורד", en: "The enemy survives" }],
      deltas: { securityThreat: -28, internationalLegitimacy: 10, economicStability: 6, internalCohesion: 4 },
      partners: { far_right: -35, right: -10, center: 10, left: 10, arab: 10 },
      stance: { usa: 8, egypt: 10, qatar: 10 },
      flags: { lebanonWar: false, transferOrdered: false },
    },
    {
      id: "CF_FIGHT_ON",
      label: { he: "המשך הלחימה עד הכרעה", en: "Fight on until a decisive outcome" },
      objective: { he: "ניצחון צבאי מוחלט.", en: "Total military victory." },
      pros: [{ he: "אם יצליח — הרתעה לשנים", en: "If it works — deterrence for years" }],
      cons: [{ he: "שחיקת המילואים והמשק", en: "Reserves and economy worn down" }, { he: "אין ודאות", en: "No certainty" }],
      deltas: { economicStability: -10, internalCohesion: -8 },
      gamble: {
        p: 0.35,
        success: { deltas: { securityThreat: -32 }, label: { he: "הכרעה (35%)", en: "Decisive (35%)" } },
        failure: { deltas: { securityThreat: 8, internationalLegitimacy: -8 }, label: { he: "מלחמת התשה (65%)", en: "War of attrition (65%)" } },
      },
      partners: { far_right: 10, center: -10, left: -20 },
    },
    {
      id: "CF_UNILATERAL",
      label: { he: "הפסקת אש חד-צדדית והיערכות הגנתית", en: "Unilateral ceasefire and a defensive posture" },
      objective: { he: "הורדת עצימות בלי הסכם.", en: "Lower the intensity without a deal." },
      pros: [{ he: "ללא ויתורים מדיניים", en: "No political concessions" }],
      cons: [{ he: "האויב יכול לחדש את האש", en: "The enemy can resume fire" }],
      deltas: { securityThreat: -15, economicStability: 3 },
      partners: { far_right: -25, right: -5 },
      flags: { lebanonWar: false },
    },
  ],
};

export const AUTHORED_DILEMMAS: DilemmaDef[] = [
  DOCTRINE, RR_GAZA, AN_SCOPE, TR_TERMS, PA_TERMS, WD_HOW,
  JORDAN_TREATY, SETTLER_VIOLENCE, ICC_WARRANTS, EU_BOYCOTT, HEZBOLLAH_FRONT, HOUTHI_RED_SEA,
  US_ARMS_HOLD, RESERVIST_REFUSAL, MASS_PROTESTS, CIVIL_REVOLT, CREDIT_DOWNGRADE, TERROR_ATTACK, SAUDI_DEAL,
];
