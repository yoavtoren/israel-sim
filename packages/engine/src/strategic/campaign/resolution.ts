/** The campaign's goal: resolving the Israeli–Palestinian conflict.
 *
 *  "Resolved" means an arrangement that ends the conflict and its claims,
 *  accepted by both sides and recognized internationally — not a quiet term.
 *  Each doctrine opens a path of negotiation milestones; spoilers push back as
 *  the process advances. Progress (0–100) is a game ASSUMPTION; the historical
 *  precedents quoted in the text are factual. */

import type { MetricKey, PolicyTrack } from "../types";
import type { CampaignView, DilemmaDef, DilemmaOption, ResolutionPath } from "./types";

type Bi = { he: string; en: string };

export const PATH_OF_TRACK: Record<PolicyTrack, ResolutionPath | null> = {
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: "regional",
  CENTER_LEFT_PA_RETURN: "two_state",
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: "unilateral",
  CONSERVATIVE_RIGHT_ANNEXATION: "sovereignty",
  // forced displacement does not end the conflict — it exports and escalates it
  RADICAL_RIGHT_DEPORTATION: null,
};

export const PATH_LABELS: Record<ResolutionPath, Bi> = {
  regional: { he: "מסלול אזורי מדורג", en: "Staged regional path" },
  two_state: { he: "שתי מדינות במשא ומתן", en: "Negotiated two states" },
  unilateral: { he: "נסיגה והכרה בינלאומית", en: "Withdrawal and recognition" },
  sovereignty: { he: "ריבונות והסדר אזרחי", en: "Sovereignty and a civil arrangement" },
};

/** Milestones of each path, in order; the last one ends the conflict. */
export const PATH_MILESTONES: Record<ResolutionPath, string[]> = {
  regional: ["REG_GAZA_FORCE", "REG_RECONSTRUCTION", "REG_PA_REFORM", "REG_NORMALIZATION", "REG_FINAL"],
  two_state: ["TS_COORDINATION", "TS_BORDERS", "TS_JERUSALEM", "TS_REFUGEES_SECURITY", "TS_FINAL"],
  unilateral: ["UN_STABILIZE", "UN_BORDER", "UN_RECOGNITION", "UN_FINAL"],
  sovereignty: ["SV_AUTONOMY", "SV_ECONOMY", "SV_STATUS", "SV_FINAL"],
};

export const FINAL_MILESTONES = new Set(Object.values(PATH_MILESTONES).map((m) => m[m.length - 1]));

/** Progress needed before the final signing can be put on the table. */
export const FINAL_THRESHOLD = 60;

export const MILESTONE_LABELS: Record<string, Bi> = {
  REG_GAZA_FORCE: { he: "כוח ערבי בעזה", en: "Arab force in Gaza" },
  REG_RECONSTRUCTION: { he: "שיקום תמורת פירוז", en: "Reconstruction for demilitarization" },
  REG_PA_REFORM: { he: "רשות מתוקנת", en: "Reformed PA" },
  REG_NORMALIZATION: { he: "נורמליזציה ואופק מדיני", en: "Normalization and a horizon" },
  REG_FINAL: { he: "הסכם מסגרת סופי", en: "Final framework agreement" },
  TS_COORDINATION: { he: "תיאום ביטחוני", en: "Security coordination" },
  TS_BORDERS: { he: "גבולות וחילופי שטחים", en: "Borders and swaps" },
  TS_JERUSALEM: { he: "ירושלים והמקומות הקדושים", en: "Jerusalem and the holy sites" },
  TS_REFUGEES_SECURITY: { he: "פליטים וסידורי ביטחון", en: "Refugees and security" },
  TS_FINAL: { he: "הסכם קבע", en: "Permanent-status agreement" },
  UN_STABILIZE: { he: "כוח ייצוב בינלאומי", en: "International stabilization force" },
  UN_BORDER: { he: "משטר גבול ומעברים", en: "Border regime and crossings" },
  UN_RECOGNITION: { he: "הכרה במדינה פלסטינית", en: "Recognition of a Palestinian state" },
  UN_FINAL: { he: "הסכם שלום בין מדינות", en: "Peace treaty between states" },
  SV_AUTONOMY: { he: "אוטונומיה לערים", en: "Autonomy for the cities" },
  SV_ECONOMY: { he: "שלום כלכלי", en: "Economic peace" },
  SV_STATUS: { he: "שאלת המעמד", en: "The status question" },
  SV_FINAL: { he: "הסדר מוכר", en: "A recognized arrangement" },
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clampP = (p: number) => Math.max(0.1, Math.min(0.9, p));

/** Success odds from the metrics that make a deal hold. Weights are per 100 points away from 50. */
function odds(base: number, w: Partial<Record<MetricKey | "progress", number>>): (v: CampaignView) => number {
  return (v) => {
    let p = base;
    for (const [k, weight] of Object.entries(w) as Array<[MetricKey | "progress", number]>) {
      const value = k === "progress" ? v.resolution.progress : v.metrics[k];
      p += (weight * (value - 50)) / 100;
    }
    return clampP(p);
  };
}

function milestone(path: ResolutionPath, id: string, def: Omit<DilemmaDef, "id" | "weight" | "cooldown" | "milestone">): DilemmaDef {
  const list = PATH_MILESTONES[path];
  const index = list.indexOf(id);
  const final = index === list.length - 1;
  // partners on the moderate right and the Haredi parties dislike these steps, but a working
  // process does not drain them the way a doctrine fight does: half the strain
  const options = def.options.map((o) => (o.partners === undefined ? o : {
    ...o,
    partners: Object.fromEntries(Object.entries(o.partners).map(([tag, v]) => [tag, tag === "right" || tag === "haredi" ? Math.round((v ?? 0) / 2) : v])),
  }));
  return {
    ...def,
    options,
    id,
    milestone: { path, index: index + 1, of: list.length },
    cooldown: 2,
    weight: (v) => {
      if (v.resolution.path !== path) return 0;
      if (v.resolution.milestones.includes(id)) return 0;
      if (index > 0 && !v.resolution.milestones.includes(list[index - 1])) return 0;
      if (final && v.resolution.progress < FINAL_THRESHOLD) return 0;
      return final ? 4 : 3;
    },
  };
}

const opt = (o: DilemmaOption): DilemmaOption => o;

// ---------------------------------------------------------------------------
// regional path (pragmatic center)
// ---------------------------------------------------------------------------

const REG_GAZA_FORCE = milestone("regional", "REG_GAZA_FORCE", {
  title: { he: "מי יחזיק את הביטחון בעזה?", en: "Who holds security in Gaza?" },
  context: { he: "מצרים, איחוד האמירויות וירדן מוכנות להציב כוח בעזה — בתנאי שישראל תעביר סמכויות ותתחייב לאופק מדיני. צה\"ל חושש מאובדן חופש הפעולה.", en: "Egypt, the UAE and Jordan are ready to deploy a force in Gaza — if Israel hands over authority and commits to a political horizon. The IDF fears losing freedom of action." },
  precedent: { years: "2005 · 2007", title: { he: "ההתנתקות ומשבר המעברים", en: "The disengagement and the crossings crisis" }, body: { he: "אחרי ההתנתקות נחתם הסכם המעברים (2005) עם משקיפי האיחוד האירופי ברפיח; המשקיפים עזבו כשחמאס השתלט על הרצועה ב-2007.", en: "After the disengagement the 2005 crossings agreement placed EU monitors at Rafah; they left when Hamas took over the Strip in 2007." }, lesson: { he: "כוח חיצוני מחזיק רק אם יש לו מנדט, גב פוליטי וסמכות לאכוף.", en: "An outside force holds only with a mandate, political backing and the authority to enforce." } },
  focus: "gaza",
  options: [
    opt({ id: "REG_GF_HANDOVER", label: { he: "העברה מלאה לכוח הערבי עם מנגנון תיאום", en: "Full handover to the Arab force with a coordination mechanism" }, objective: { he: "הכוח האזורי אחראי על הביטחון ועל המעברים.", en: "The regional force runs security and the crossings." }, pros: [{ he: "לגיטימציה ערבית להסדר", en: "Arab legitimacy for the arrangement" }], cons: [{ he: "צה\"ל מאבד שליטה ישירה", en: "The IDF loses direct control" }], deltas: { regionalRelations: 12, internationalLegitimacy: 8, securityThreat: 4 }, partners: { far_right: -25, right: -10, center: 5 }, stance: { egypt: 8, uae: 8, jordan: 6 }, gamble: { p: 0.6, success: { label: { he: "הכוח נפרס ומחזיק", en: "The force deploys and holds" }, deltas: {} }, failure: { label: { he: "תקריות קשות מעכבות את הפריסה", en: "Serious incidents delay deployment" }, deltas: { securityThreat: 6 } } }, odds: odds(0.6, { regionalRelations: 0.35, securityThreat: -0.25 }), peaceGamble: { success: 20, failure: 6 }, milestone: "REG_GAZA_FORCE" }),
    opt({ id: "REG_GF_JOINT", label: { he: "פיקוד משותף עם זכות וטו לצה\"ל", en: "Joint command with an IDF veto" }, objective: { he: "הכוח האזורי בשטח, צה\"ל שומר על חופש פעולה.", en: "Regional force on the ground; the IDF keeps freedom of action." }, pros: [{ he: "מקובל על מערכת הביטחון", en: "Acceptable to the defense establishment" }], cons: [{ he: "המדינות הערביות חוששות להיראות כקבלני משנה", en: "Arab states fear looking like subcontractors" }], deltas: { regionalRelations: 5, securityThreat: -2 }, partners: { far_right: -10 }, peace: 12, milestone: "REG_GAZA_FORCE" }),
    opt({ id: "REG_GF_DELAY", label: { he: "לדחות עד לפירוז מלא", en: "Postpone until full demilitarization" }, objective: { he: "שום העברת סמכות לפני פירוז.", en: "No handover before demilitarization." }, pros: [{ he: "אין סיכון ביטחוני מיידי", en: "No immediate security risk" }], cons: [{ he: "הכוח האזורי עלול להתפרק", en: "The regional force may fall apart" }], deltas: { regionalRelations: -8 }, partners: { far_right: 5 }, peace: -4 }),
  ],
});

const REG_RECONSTRUCTION = milestone("regional", "REG_RECONSTRUCTION", {
  title: { he: "שיקום עזה תמורת פירוז", en: "Rebuilding Gaza for demilitarization" },
  context: { he: "מדינות המפרץ מציעות עשרות מיליארדים לשיקום — בתנאי שישראל תאפשר כניסת חומרים. ישראל דורשת מנגנון איסוף נשק ופיקוח על חומרים דו-שימושיים.", en: "The Gulf offers tens of billions for reconstruction — if Israel lets materials in. Israel demands a weapons-collection mechanism and oversight of dual-use materials." },
  precedent: { years: "2014 · 2021", title: { he: "מנגנון השיקום של האו\"ם (GRM)", en: "The UN reconstruction mechanism (GRM)" }, body: { he: "אחרי 2014 הוקם מנגנון לפיקוח על מלט וחומרי בניין; חלק מהחומרים הוסטו לבניית מנהרות.", en: "After 2014 a mechanism supervised cement and building materials; some materials were diverted to tunnel building." }, lesson: { he: "שיקום בלי פירוז אמיתי מממן את הסבב הבא; פירוז בלי שיקום אינו מחזיק.", en: "Reconstruction without real demilitarization funds the next round; demilitarization without reconstruction does not hold." } },
  focus: "gaza",
  options: [
    opt({ id: "REG_RC_CONDITIONAL", label: { he: "שיקום בשלבים מותנה באיסוף נשק", en: "Staged reconstruction tied to weapons collection" }, objective: { he: "כל שלב כסף תמורת שלב פירוז מאומת.", en: "Each tranche for a verified stage of demilitarization." }, pros: [{ he: "תמריץ אמיתי לפירוז", en: "A real incentive to disarm" }], cons: [{ he: "חמאס ינסה לחבל", en: "Hamas will try to sabotage it" }], deltas: { economicStability: 6, regionalRelations: 8, securityThreat: -3 }, stance: { saudi: 6, uae: 6 }, gamble: { p: 0.55, success: { label: { he: "איסוף הנשק מתקדם", en: "Weapons collection advances" }, deltas: { securityThreat: -4 } }, failure: { label: { he: "מחבואי נשק נחשפים; הכסף מוקפא", en: "Hidden arsenals exposed; funds frozen" }, deltas: { securityThreat: 5 } } }, odds: odds(0.55, { regionalRelations: 0.3, securityThreat: -0.3, progress: 0.2 }), peaceGamble: { success: 18, failure: 2 }, milestone: "REG_RECONSTRUCTION" }),
    opt({ id: "REG_RC_OPEN", label: { he: "שיקום מהיר ללא התניות", en: "Fast reconstruction with no conditions" }, objective: { he: "שיפור מיידי בחיים ברצועה.", en: "Immediate improvement in Gaza." }, pros: [{ he: "תמיכה בינלאומית רחבה", en: "Broad international support" }], cons: [{ he: "סיכון להתחמשות מחדש", en: "Risk of rearmament" }], deltas: { internationalLegitimacy: 10, securityThreat: 6, regionalRelations: 6 }, partners: { far_right: -20, right: -10 }, peace: 12, milestone: "REG_RECONSTRUCTION" }),
    opt({ id: "REG_RC_REFUSE", label: { he: "לסרב עד לפירוז מוחלט", en: "Refuse until total demilitarization" }, objective: { he: "אין שיקום לפני פירוז.", en: "No reconstruction before demilitarization." }, pros: [{ he: "אין סיכון להתחמשות", en: "No rearmament risk" }], cons: [{ he: "משבר הומניטרי מעמיק", en: "The humanitarian crisis deepens" }], deltas: { internationalLegitimacy: -8, regionalRelations: -6 }, peace: -6 }),
  ],
});

const REG_PA_REFORM = milestone("regional", "REG_PA_REFORM", {
  title: { he: "רשות מתוקנת: בחירות או ממשלת מומחים?", en: "A reformed PA: elections or technocrats?" },
  context: { he: "התנאי של המדינות הערביות לשלב הבא: רשות פלסטינית מתוקנת. בחירות עלולות להעלות את חמאס; ממשלה ממונה חסרה לגיטימציה.", en: "The Arab states' condition for the next stage: a reformed PA. Elections could empower Hamas; an appointed government lacks legitimacy." },
  precedent: { years: "2006", title: { he: "הבחירות לפרלמנט הפלסטיני", en: "The Palestinian legislative elections" }, body: { he: "ב-2006 ניצח חמאס בבחירות שארה\"ב דחפה לקיים; בתוך שנה השתלט בכוח על עזה.", en: "In 2006 Hamas won elections the US had pushed for; within a year it seized Gaza by force." }, lesson: { he: "בחירות בלי תנאי סף (פירוק מיליציות, הכרה בהסכמים) עלולות להפוך את הרפורמה.", en: "Elections without entry conditions (disarming militias, recognizing agreements) can reverse the reform." } },
  focus: "west_bank",
  options: [
    opt({ id: "REG_PR_ELECTIONS", label: { he: "בחירות עם תנאי סף: רק מי שמכיר בהסכמים", en: "Elections with entry conditions: only those who accept the agreements" }, objective: { he: "הנהגה נבחרת ולגיטימית להסדר.", en: "An elected, legitimate leadership for a deal." }, pros: [{ he: "לגיטימציה פנימית פלסטינית", en: "Palestinian domestic legitimacy" }], cons: [{ he: "הימור על התוצאה", en: "A gamble on the result" }], deltas: { internationalLegitimacy: 8 }, stance: { usa: 5, eu: 8 }, gamble: { p: 0.5, success: { label: { he: "רשימה פרגמטית מנצחת", en: "A pragmatic list wins" }, deltas: { securityThreat: -4 } }, failure: { label: { he: "חמאס עוקף את התנאים ומתחזק", en: "Hamas circumvents the conditions and gains" }, deltas: { securityThreat: 8 } } }, odds: odds(0.5, { internationalLegitimacy: 0.25, regionalRelations: 0.25, securityThreat: -0.3 }), peaceGamble: { success: 20, failure: -8 }, milestone: "REG_PA_REFORM" }),
    opt({ id: "REG_PR_TECHNOCRATS", label: { he: "ממשלת מומחים בפיקוח אזורי, בחירות בעוד שנתיים", en: "A technocratic government under regional oversight; elections in two years" }, objective: { he: "רפורמה מנהלית קודם.", en: "Administrative reform first." }, pros: [{ he: "יציב בטווח הקצר", en: "Stable in the short term" }], cons: [{ he: "טענות ל\"מינוי מבחוץ\"", en: "\"Imposed from outside\" claims" }], deltas: { regionalRelations: 4 }, peace: 12, milestone: "REG_PA_REFORM" }),
    opt({ id: "REG_PR_BYPASS", label: { he: "לעקוף את הרשות ולעבוד מול ראשי ערים", en: "Bypass the PA and work with mayors" }, objective: { he: "הנהגה מקומית במקום לאומית.", en: "Local leadership instead of national." }, pros: [{ he: "גמיש", en: "Flexible" }], cons: [{ he: "מפרק את הכתובת הפלסטינית להסדר", en: "Dismantles the Palestinian address for a deal" }], deltas: { regionalRelations: -10, internationalLegitimacy: -6 }, partners: { far_right: 5 }, peace: -8 }),
  ],
});

const REG_NORMALIZATION = milestone("regional", "REG_NORMALIZATION", {
  title: { he: "נורמליזציה עם סעודיה — ומה עם המדינה הפלסטינית?", en: "Normalization with Saudi Arabia — and the Palestinian state?" },
  context: { he: "ריאד מוכנה לנורמליזציה, אבל דורשת מסלול \"אמין ובלתי הפיך\" למדינה פלסטינית. חלק מהקואליציה יפרוש אם תתחייב.", en: "Riyadh is ready to normalize but demands a \"credible, irreversible\" path to a Palestinian state. Part of the coalition will walk if you commit." },
  precedent: { years: "2002 · 2020", title: { he: "יוזמת השלום הערבית והסכמי אברהם", en: "The Arab Peace Initiative and the Abraham Accords" }, body: { he: "יוזמת 2002 הציעה נורמליזציה תמורת נסיגה ומדינה; הסכמי אברהם (2020) הפרידו בין נורמליזציה לבין הסוגיה הפלסטינית — סעודיה סירבה להצטרף בלי אופק.", en: "The 2002 initiative offered normalization for withdrawal and a state; the 2020 Abraham Accords decoupled normalization from the Palestinian issue — Saudi Arabia declined to join without a horizon." }, lesson: { he: "נורמליזציה עם סעודיה היא המנוף האזורי הגדול — והיא דורשת מחיר בסוגיה הפלסטינית.", en: "Saudi normalization is the biggest regional lever — and it has a price on the Palestinian question." } },
  focus: "gulf",
  options: [
    opt({ id: "REG_NM_PATH", label: { he: "להתחייב למסלול מדורג למדינה מפורזת", en: "Commit to a staged path to a demilitarized state" }, objective: { he: "נורמליזציה מלאה ומסגרת להסדר.", en: "Full normalization and a framework for a settlement." }, pros: [{ he: "מהפך אזורי", en: "A regional transformation" }, { he: "סיוע וערבויות אמריקניות", en: "US aid and guarantees" }], cons: [{ he: "הימין הקיצוני פורש", en: "The far right walks out" }], deltas: { regionalRelations: 22, economicStability: 10, usMilitaryAid: 10, internationalLegitimacy: 10 }, partners: { far_right: -60, right: -15, center: 10, left: 10 }, stance: { saudi: 25, usa: 10 }, flags: { saudiDeal: true }, peace: 24, milestone: "REG_NORMALIZATION" }),
    opt({ id: "REG_NM_VAGUE", label: { he: "הצהרה עמומה על \"אופק\"", en: "A vague statement about a \"horizon\"" }, objective: { he: "לנסות לקבל נורמליזציה בלי מחויבות.", en: "Try for normalization without commitment." }, pros: [{ he: "הקואליציה שורדת", en: "The coalition survives" }], cons: [{ he: "ריאד עלולה לסגת", en: "Riyadh may pull back" }], deltas: { regionalRelations: 6 }, partners: { far_right: -15 }, gamble: { p: 0.35, success: { label: { he: "ריאד מקבלת את הנוסח", en: "Riyadh accepts the wording" }, deltas: { regionalRelations: 10, economicStability: 6 } }, failure: { label: { he: "ריאד מקפיאה את המגעים", en: "Riyadh freezes contacts" }, deltas: { regionalRelations: -10 } } }, odds: odds(0.35, { regionalRelations: 0.3, usMilitaryAid: 0.15 }), peaceGamble: { success: 14, failure: -4 }, milestone: "REG_NORMALIZATION" }),
    opt({ id: "REG_NM_DECLINE", label: { he: "לוותר על הנורמליזציה", en: "Give up on normalization" }, objective: { he: "שום מחויבות מדינית.", en: "No political commitment." }, pros: [{ he: "שקט קואליציוני", en: "Coalition calm" }], cons: [{ he: "המסלול האזורי נתקע", en: "The regional path stalls" }], deltas: { regionalRelations: -14, usMilitaryAid: -5 }, peace: -10 }),
  ],
});

const REG_FINAL = milestone("regional", "REG_FINAL", {
  title: { he: "הסכם המסגרת הסופי: מדינה פלסטינית מפורזת בשלבים", en: "The final framework: a demilitarized Palestinian state in stages" },
  context: { he: "על השולחן: גבולות על בסיס 67 עם חילופי שטחים, פירוז ונוכחות ביטחונית אזורית, בירה פלסטינית בשכונות ערביות בירושלים, פתרון פליטים במדינה הפלסטינית ובפיצוי, והכרה הדדית וסוף תביעות. נדרשת חתימה — ואישור הציבור.", en: "On the table: 1967-based borders with swaps, demilitarization and regional security presence, a Palestinian capital in Arab neighborhoods of Jerusalem, refugees resettled in Palestine or compensated, mutual recognition and an end of claims. It needs signatures — and the public's approval." },
  precedent: { years: "2000 · 2008", title: { he: "קמפ דייוויד ומתווה אולמרט", en: "Camp David and the Olmert offer" }, body: { he: "בקמפ דייוויד (2000) ובהצעת אולמרט (2008) הפערים בירושלים ובפליטים לא נסגרו, והמנהיגים לא הביאו את ההסכם לחתימה.", en: "At Camp David (2000) and in the Olmert offer (2008) the gaps on Jerusalem and refugees did not close, and the leaders did not bring a deal to signature." }, lesson: { he: "הסכם נופל בשעה האחרונה בלי לגיטימציה פנימית משני הצדדים ובלי גב אזורי.", en: "A deal fails at the last hour without domestic legitimacy on both sides and regional backing." } },
  focus: "israel",
  options: [
    opt({ id: "REG_FN_REFERENDUM", label: { he: "לחתום ולהביא למשאל עם", en: "Sign and put it to a referendum" }, objective: { he: "הסכם עם לגיטימציה ציבורית מלאה.", en: "A deal with full public legitimacy." }, pros: [{ he: "סוף הסכסוך אם יאושר", en: "The end of the conflict if approved" }], cons: [{ he: "הציבור עלול לדחות", en: "The public may reject it" }], deltas: { internationalLegitimacy: 15, regionalRelations: 15 }, partners: { far_right: -80, right: -30, haredi: -10, center: 15, left: 20, arab: 20 }, gamble: { p: 0.55, success: { label: { he: "הציבור מאשר את ההסכם", en: "The public approves the deal" }, deltas: { internalCohesion: 6, economicStability: 10 } }, failure: { label: { he: "ההסכם נדחה במשאל העם", en: "The deal is rejected at the referendum" }, deltas: { internalCohesion: -12 } } }, odds: odds(0.55, { internalCohesion: 0.35, securityThreat: -0.3, regionalRelations: 0.15 }), peaceGamble: { success: 40, failure: -15 }, milestone: "REG_FINAL" }),
    opt({ id: "REG_FN_KNESSET", label: { he: "לחתום ולאשרר בכנסת בלבד", en: "Sign and ratify in the Knesset only" }, objective: { he: "הסכם מהיר ברוב פרלמנטרי.", en: "A quick deal by parliamentary majority." }, pros: [{ he: "לא תלוי במשאל עם", en: "No referendum risk" }], cons: [{ he: "שסע פנימי עמוק", en: "A deep internal rift" }], deltas: { internationalLegitimacy: 12, regionalRelations: 12, internalCohesion: -15 }, partners: { far_right: -100, right: -40, center: 10, left: 15, arab: 15 }, gamble: { p: 0.5, success: { label: { he: "הכנסת מאשררת", en: "The Knesset ratifies" }, deltas: {} }, failure: { label: { he: "האשרור נופל ברוב של קול אחד", en: "Ratification fails by one vote" }, deltas: { coalitionStability: -15 } } }, odds: odds(0.5, { coalitionStability: 0.4, internalCohesion: 0.15 }), peaceGamble: { success: 40, failure: -12 }, milestone: "REG_FINAL" }),
    opt({ id: "REG_FN_WAIT", label: { he: "לא עכשיו — להמשיך צעדים מדורגים", en: "Not now — keep taking gradual steps" }, objective: { he: "לשמור על ההישגים בלי הימור.", en: "Keep the gains without gambling." }, pros: [{ he: "אין סיכון מיידי", en: "No immediate risk" }], cons: [{ he: "חלון ההזדמנויות נסגר", en: "The window closes" }], deltas: { regionalRelations: -6 }, peace: -6 }),
  ],
});

// ---------------------------------------------------------------------------
// two-state path (center-left)
// ---------------------------------------------------------------------------

const TS_COORDINATION = milestone("two_state", "TS_COORDINATION", {
  title: { he: "חידוש התיאום הביטחוני", en: "Restoring security coordination" },
  context: { he: "הרשות מוכנה לחדש תיאום ביטחוני מלא — אם ישראל תעצור פשיטות בשטחי A ותעביר כספי מסים מוקפאים.", en: "The PA will fully restore security coordination — if Israel stops raids in Area A and releases frozen tax revenues." },
  precedent: { years: "2007–2014", title: { he: "תוכנית דייטון", en: "The Dayton program" }, body: { he: "כוחות הביטחון הפלסטיניים שאומנו בפיקוח אמריקני הורידו דרמטית את הטרור ביהודה ושומרון בשנים שאחרי האינתיפאדה השנייה.", en: "US-trained Palestinian security forces sharply reduced terror in the West Bank in the years after the second intifada." }, lesson: { he: "תיאום ביטחוני עובד כשיש לרשות אופק ולגיטימציה — ומתפרק כשהם נעלמים.", en: "Security coordination works when the PA has a horizon and legitimacy — and unravels when they vanish." } },
  focus: "west_bank",
  options: [
    opt({ id: "TS_CO_FULL", label: { he: "לעצור פשיטות בשטחי A ולהעביר את הכספים", en: "Stop raids in Area A and release the funds" }, objective: { he: "הרשות אחראית על הביטחון בעריה.", en: "The PA handles security in its cities." }, pros: [{ he: "בניית אמון", en: "Builds trust" }], cons: [{ he: "סיכון לחממות טרור", en: "Risk of terror hotbeds" }], deltas: { internationalLegitimacy: 8, securityThreat: 3 }, partners: { far_right: -25, right: -10, left: 5 }, gamble: { p: 0.6, success: { label: { he: "כוחות הרשות פועלים ביעילות", en: "PA forces act effectively" }, deltas: { securityThreat: -6 } }, failure: { label: { he: "תאים חמושים מתחזקים בג'נין", en: "Armed cells grow in Jenin" }, deltas: { securityThreat: 6 } } }, odds: odds(0.6, { securityThreat: -0.3, internationalLegitimacy: 0.2 }), peaceGamble: { success: 18, failure: 4 }, milestone: "TS_COORDINATION" }),
    opt({ id: "TS_CO_PARTIAL", label: { he: "תיאום עם שמירת חופש פעולה לצה\"ל", en: "Coordination while the IDF keeps freedom of action" }, objective: { he: "שיתוף פעולה בלי ויתור ביטחוני.", en: "Cooperation without a security concession." }, pros: [{ he: "מקובל על השב\"כ", en: "Acceptable to the Shin Bet" }], cons: [{ he: "הרשות מוחלשת בעיני הציבור שלה", en: "The PA looks weak to its public" }], deltas: { securityThreat: -2 }, peace: 10, milestone: "TS_COORDINATION" }),
    opt({ id: "TS_CO_REFUSE", label: { he: "להמשיך להקפיא את הכספים", en: "Keep the funds frozen" }, objective: { he: "לחץ על הרשות.", en: "Pressure on the PA." }, pros: [{ he: "תמיכה מהימין", en: "Right-wing support" }], cons: [{ he: "הרשות קרובה לקריסה", en: "The PA nears collapse" }], deltas: { securityThreat: 6, internationalLegitimacy: -6 }, peace: -8 }),
  ],
});

const TS_BORDERS = milestone("two_state", "TS_BORDERS", {
  title: { he: "גבולות: קווי 67 עם חילופי שטחים", en: "Borders: the 1967 lines with land swaps" },
  context: { he: "המשא ומתן הגיע למפות. גושי ההתיישבות הגדולים יסופחו תמורת שטחים בנגב ובעמק; התנחלויות מבודדות יפונו. כמה אחוזים להחליף?", en: "Talks have reached the maps. The large settlement blocs would be annexed in exchange for land in the Negev and valleys; isolated settlements would be evacuated. How much to swap?" },
  precedent: { years: "2000 · 2008", title: { he: "מתווה קלינטון והצעת אולמרט", en: "The Clinton Parameters and the Olmert offer" }, body: { he: "מתווה קלינטון דיבר על 4–6% סיפוח עם חילופין; אולמרט הציע כ-6.3% סיפוח ו-5.8% חילופין. הפלסטינים דרשו כ-2%.", en: "The Clinton Parameters spoke of 4–6% annexation with swaps; Olmert offered about 6.3% annexation and 5.8% in swaps. The Palestinians asked for about 2%." }, lesson: { he: "הפער במפות קטן מכפי שנראה; הקושי הוא הפינוי הפנימי.", en: "The gap on maps is smaller than it looks; the hard part is evacuation at home." } },
  focus: "west_bank",
  options: [
    opt({ id: "TS_BD_BLOCS", label: { he: "סיפוח הגושים (כ-6%) ופינוי התנחלויות מבודדות", en: "Annex the blocs (~6%) and evacuate isolated settlements" }, objective: { he: "80% מהמתנחלים נשארים בריבונות ישראלית.", en: "80% of settlers stay under Israeli sovereignty." }, pros: [{ he: "מפה שמקובלת על רוב הציבור", en: "A map most of the public accepts" }], cons: [{ he: "פינוי עשרות אלפים", en: "Tens of thousands evacuated" }], deltas: { internationalLegitimacy: 12, internalCohesion: -10 }, partners: { far_right: -70, right: -30, haredi: -5, center: 10, left: 10 }, gamble: { p: 0.6, success: { label: { he: "הפלסטינים מקבלים את המפה", en: "The Palestinians accept the map" }, deltas: {} }, failure: { label: { he: "המגעים נתקעים סביב אריאל", en: "Talks stall over Ariel" }, deltas: { internationalLegitimacy: -4 } } }, odds: odds(0.6, { internationalLegitimacy: 0.2, regionalRelations: 0.2 }), peaceGamble: { success: 20, failure: 4 }, milestone: "TS_BORDERS" }),
    opt({ id: "TS_BD_MAX", label: { he: "לדרוש 10% כולל בקעת הירדן", en: "Demand 10% including the Jordan Valley" }, objective: { he: "גבול ביטחוני מקסימלי.", en: "A maximal security border." }, pros: [{ he: "עומק אסטרטגי", en: "Strategic depth" }], cons: [{ he: "הפלסטינים ככל הנראה ידחו", en: "The Palestinians will likely refuse" }], deltas: { internalCohesion: -4 }, partners: { far_right: -30, right: 5 }, gamble: { p: 0.2, success: { label: { he: "הפלסטינים מסכימים בלחץ אמריקני", en: "The Palestinians agree under US pressure" }, deltas: {} }, failure: { label: { he: "המשלחת הפלסטינית עוזבת", en: "The Palestinian delegation walks out" }, deltas: { internationalLegitimacy: -8 } } }, odds: odds(0.2, { usMilitaryAid: 0.2 }), peaceGamble: { success: 16, failure: -6 }, milestone: "TS_BORDERS" }),
    opt({ id: "TS_BD_PAUSE", label: { he: "להשהות את דיוני המפות", en: "Pause the map talks" }, objective: { he: "לא להכריע.", en: "Don't decide." }, pros: [{ he: "הקואליציה נרגעת", en: "The coalition calms" }], cons: [{ he: "האמון נשחק", en: "Trust erodes" }], deltas: { internationalLegitimacy: -5 }, peace: -5 }),
  ],
});

const TS_JERUSALEM = milestone("two_state", "TS_JERUSALEM", {
  title: { he: "ירושלים והמקומות הקדושים", en: "Jerusalem and the holy sites" },
  context: { he: "השאלה הקשה מכולן: השכונות הערביות במזרח העיר, העיר העתיקה והר הבית.", en: "The hardest question of all: the Arab neighborhoods in the east, the Old City and the Temple Mount." },
  precedent: { years: "2000 · 2008", title: { he: "\"מה שיהודי — לישראל, מה שערבי — לפלסטין\"", en: "\"What is Jewish to Israel, what is Arab to Palestine\"" }, body: { he: "מתווה קלינטון הציע חלוקה לפי שכונות; אולמרט הציע משטר נאמנות בינלאומי ל\"אגן הקדוש\" בהשתתפות ישראל, פלסטין, ירדן, סעודיה וארה\"ב.", en: "The Clinton Parameters proposed a division by neighborhood; Olmert proposed an international trusteeship for the \"Holy Basin\" with Israel, Palestine, Jordan, Saudi Arabia and the US." }, lesson: { he: "הסדר בירושלים דורש יצירתיות ריבונית — ושותפים אזוריים שנותנים לו גב דתי.", en: "A Jerusalem arrangement needs creative sovereignty — and regional partners giving it religious backing." } },
  focus: "israel",
  options: [
    opt({ id: "TS_JR_NEIGHBORHOODS", label: { he: "חלוקה לפי שכונות ומשטר מיוחד באגן הקדוש", en: "Division by neighborhood and a special regime in the Holy Basin" }, objective: { he: "שתי בירות, ניהול משותף למקומות הקדושים.", en: "Two capitals; joint management of the holy sites." }, pros: [{ he: "פותח את הדרך להסכם", en: "Opens the way to a deal" }], cons: [{ he: "סערה ציבורית ודתית", en: "Public and religious storm" }], deltas: { internationalLegitimacy: 12, regionalRelations: 12, internalCohesion: -12 }, partners: { far_right: -80, right: -40, haredi: -30, center: 5, left: 10, arab: 10 }, stance: { jordan: 12, saudi: 10 }, gamble: { p: 0.55, success: { label: { he: "ירדן וסעודיה מגבות את ההסדר", en: "Jordan and Saudi Arabia back the arrangement" }, deltas: { regionalRelations: 6 } }, failure: { label: { he: "המגעים קורסים סביב הר הבית", en: "Talks collapse over the Temple Mount" }, deltas: { securityThreat: 5 } } }, odds: odds(0.55, { regionalRelations: 0.3, internalCohesion: 0.15 }), peaceGamble: { success: 20, failure: -4 }, milestone: "TS_JERUSALEM" }),
    opt({ id: "TS_JR_SUBURBS", label: { he: "בירה פלסטינית באבו דיס; העיר נשארת מאוחדת", en: "A Palestinian capital in Abu Dis; the city stays united" }, objective: { he: "ירושלים בריבונות ישראלית מלאה.", en: "Jerusalem fully under Israeli sovereignty." }, pros: [{ he: "מקובל על רוב הקואליציה", en: "Acceptable to most of the coalition" }], cons: [{ he: "הפלסטינים והעולם הערבי מתנגדים", en: "Palestinians and the Arab world object" }], deltas: { regionalRelations: -4 }, partners: { right: 5 }, gamble: { p: 0.25, success: { label: { he: "הפלסטינים מקבלים בכפוף לנוכחות באל-אקצא", en: "The Palestinians accept with access to Al-Aqsa" }, deltas: {} }, failure: { label: { he: "ההצעה נדחית", en: "The offer is rejected" }, deltas: { internationalLegitimacy: -5 } } }, odds: odds(0.25, { regionalRelations: 0.2 }), peaceGamble: { success: 16, failure: -5 }, milestone: "TS_JERUSALEM" }),
    opt({ id: "TS_JR_DEFER", label: { he: "לדחות את ירושלים לסוף", en: "Leave Jerusalem for last" }, objective: { he: "להתקדם בשאר הסוגיות.", en: "Advance on the other issues." }, pros: [{ he: "מונע פיצוץ מיידי", en: "Avoids an immediate blow-up" }], cons: [{ he: "הבעיה רק גדלה", en: "The problem only grows" }], deltas: {}, peace: -3 }),
  ],
});

const TS_REFUGEES_SECURITY = milestone("two_state", "TS_REFUGEES_SECURITY", {
  title: { he: "פליטים וסידורי ביטחון", en: "Refugees and security arrangements" },
  context: { he: "הפלסטינים דורשים הכרה בזכות השיבה; ישראל דורשת נוכחות בבקעת הירדן ופירוז. חבילה אחת או שתי סוגיות נפרדות?", en: "The Palestinians demand recognition of a right of return; Israel demands a Jordan Valley presence and demilitarization. One package or two separate issues?" },
  precedent: { years: "2000 · 2014", title: { he: "מתווה קלינטון ותוכנית אלן", en: "The Clinton Parameters and the Allen plan" }, body: { he: "קלינטון הציע שיבה למדינה הפלסטינית ופיצוי; תוכנית הגנרל ג'ון אלן (2014) הציעה נוכחות ישראלית מתכלה בבקעה וטכנולוגיה במעברים.", en: "Clinton proposed return to the Palestinian state and compensation; General John Allen's 2014 plan proposed a phasing-out Israeli presence in the valley and technology at the crossings." }, lesson: { he: "זכות שיבה סמלית ומענה ביטחוני מתכלה הם הגשר שנבחן שוב ושוב.", en: "A symbolic return and a phasing-out security answer are the bridge tested again and again." } },
  focus: "west_bank",
  options: [
    opt({ id: "TS_RS_PACKAGE", label: { he: "שיבה למדינה הפלסטינית ופיצוי; צה\"ל בבקעה ל-10 שנים", en: "Return to Palestine and compensation; the IDF in the valley for 10 years" }, objective: { he: "סגירת שתי הסוגיות יחד.", en: "Close both issues together." }, pros: [{ he: "ערבויות ביטחוניות", en: "Security guarantees" }], cons: [{ he: "הפליטים בלבנון ובסוריה מתנגדים", en: "Refugees in Lebanon and Syria object" }], deltas: { internationalLegitimacy: 10, usMilitaryAid: 8 }, partners: { far_right: -40, right: -10, center: 5 }, stance: { usa: 8 }, gamble: { p: 0.6, success: { label: { he: "החבילה מוסכמת", en: "The package is agreed" }, deltas: { securityThreat: -4 } }, failure: { label: { he: "המשלחות נתקעות על ניסוח ההכרה", en: "The delegations stall on the wording of recognition" }, deltas: {} } }, odds: odds(0.6, { usMilitaryAid: 0.2, internationalLegitimacy: 0.2 }), peaceGamble: { success: 20, failure: 3 }, milestone: "TS_REFUGEES_SECURITY" }),
    opt({ id: "TS_RS_NO_RETURN", label: { he: "אפס הכרה בזכות שיבה; נוכחות קבועה בבקעה", en: "Zero recognition of return; a permanent valley presence" }, objective: { he: "הקווים האדומים הישראליים במלואם.", en: "Israel's red lines in full." }, pros: [{ he: "גיבוי מהימין", en: "Right-wing backing" }], cons: [{ he: "סיכוי נמוך להסכמה", en: "Low chance of agreement" }], deltas: {}, partners: { right: 5 }, gamble: { p: 0.25, success: { label: { he: "הפלסטינים מקבלים בלחץ אזורי", en: "The Palestinians accept under regional pressure" }, deltas: {} }, failure: { label: { he: "הרשות מושכת את המשלחת", en: "The PA withdraws its delegation" }, deltas: { internationalLegitimacy: -6 } } }, odds: odds(0.25, { regionalRelations: 0.25 }), peaceGamble: { success: 15, failure: -6 }, milestone: "TS_REFUGEES_SECURITY" }),
  ],
});

const TS_FINAL = milestone("two_state", "TS_FINAL", {
  title: { he: "הסכם הקבע: חתימה ומשאל עם", en: "The permanent-status agreement: signing and referendum" },
  context: { he: "כל הפרקים סגורים: גבולות, ירושלים, פליטים, ביטחון, סוף תביעות. הטקס מתוכנן בבית הלבן. האם להביא לחתימה?", en: "Every chapter is closed: borders, Jerusalem, refugees, security, an end of claims. A ceremony is planned at the White House. Bring it to signature?" },
  precedent: { years: "1993 · 1994", title: { he: "אוסלו והשלום עם ירדן", en: "Oslo and peace with Jordan" }, body: { he: "הסכמי אוסלו נחתמו בלי הכרעה בסוגיות הליבה ונשחקו; הסכם השלום עם ירדן (1994) סגר את כל הסוגיות — ומחזיק עד היום.", en: "The Oslo Accords were signed without resolving the core issues and eroded; the 1994 peace with Jordan closed every issue — and still holds." }, lesson: { he: "הסכם שסוגר את כל הסוגיות ומאושר בבית שורד משברים; הסכם ביניים פתוח לחבלה.", en: "A deal that closes every issue and is ratified at home survives crises; an interim deal is open to sabotage." } },
  focus: "usa",
  options: [
    opt({ id: "TS_FN_REFERENDUM", label: { he: "לחתום ולהביא למשאל עם", en: "Sign and hold a referendum" }, objective: { he: "סוף הסכסוך, בגיבוי הציבור.", en: "The end of the conflict, backed by the public." }, pros: [{ he: "הכרה עולמית ונורמליזציה אזורית", en: "Global recognition and regional normalization" }], cons: [{ he: "הימין פורש; הציבור עלול לדחות", en: "The right walks; the public may reject" }], deltas: { internationalLegitimacy: 20, regionalRelations: 20 }, partners: { far_right: -100, right: -40, haredi: -10, center: 15, left: 20, arab: 20 }, gamble: { p: 0.55, success: { label: { he: "הציבור מאשר: הסכסוך הסתיים", en: "The public approves: the conflict is over" }, deltas: { economicStability: 12, internalCohesion: 5 } }, failure: { label: { he: "רוב דחה את ההסכם", en: "A majority rejected the deal" }, deltas: { internalCohesion: -12 } } }, odds: odds(0.55, { internalCohesion: 0.35, securityThreat: -0.3, internationalLegitimacy: 0.1 }), peaceGamble: { success: 40, failure: -15 }, milestone: "TS_FINAL" }),
    opt({ id: "TS_FN_KNESSET", label: { he: "לחתום ולאשרר בכנסת", en: "Sign and ratify in the Knesset" }, objective: { he: "הסכם ברוב פרלמנטרי.", en: "A deal by parliamentary majority." }, pros: [{ he: "לא נחשף לסיכון משאל עם", en: "No referendum exposure" }], cons: [{ he: "טענה ל\"הסכם בלי עם\"", en: "\"A deal without the people\"" }], deltas: { internationalLegitimacy: 18, regionalRelations: 18, internalCohesion: -15 }, partners: { far_right: -100, right: -50, center: 10, left: 15, arab: 20 }, gamble: { p: 0.5, success: { label: { he: "הכנסת מאשררת", en: "The Knesset ratifies" }, deltas: {} }, failure: { label: { he: "האשרור נכשל", en: "Ratification fails" }, deltas: { coalitionStability: -15 } } }, odds: odds(0.5, { coalitionStability: 0.4, internalCohesion: 0.15 }), peaceGamble: { success: 40, failure: -12 }, milestone: "TS_FINAL" }),
    opt({ id: "TS_FN_WAIT", label: { he: "לדחות את החתימה", en: "Delay the signing" }, objective: { he: "לחכות לרגע פוליטי טוב יותר.", en: "Wait for a better political moment." }, pros: [{ he: "אין סיכון", en: "No risk" }], cons: [{ he: "ההסכם עלול להישחק", en: "The deal may erode" }], deltas: { internationalLegitimacy: -6 }, peace: -8 }),
  ],
});

// ---------------------------------------------------------------------------
// unilateral path (withdrawal)
// ---------------------------------------------------------------------------

const UN_STABILIZE = milestone("unilateral", "UN_STABILIZE", {
  title: { he: "מי ימלא את החלל אחרי הנסיגה?", en: "Who fills the vacuum after the withdrawal?" },
  context: { he: "צה\"ל יצא מרוב השטח. חמושים מנסים להשתלט על ערים. כוח בינלאומי, כוחות הרשות — או חזרה של צה\"ל?", en: "The IDF has left most of the territory. Militants are trying to take over cities. An international force, PA forces — or the IDF back in?" },
  precedent: { years: "2005 · 2007", title: { he: "יציאה מעזה", en: "Leaving Gaza" }, body: { he: "אחרי ההתנתקות לא הושאר מנגנון שיבטיח את השליטה; בתוך שנתיים חמאס השתלט בכוח.", en: "The disengagement left no mechanism to secure control; within two years Hamas took over by force." }, lesson: { he: "נסיגה בלי כוח שמחליף אותך מזמינה את השחקן החמוש ביותר.", en: "Withdrawal with no one to replace you invites the best-armed actor." } },
  focus: "west_bank",
  options: [
    opt({ id: "UN_ST_FORCE", label: { he: "כוח בינלאומי חזק עם מנדט אכיפה", en: "A strong international force with an enforcement mandate" }, objective: { he: "ביטחון בזמן בניית המדינה.", en: "Security while the state is built." }, pros: [{ he: "גב בינלאומי", en: "International backing" }], cons: [{ he: "תקדים יוניפי\"ל", en: "The UNIFIL precedent" }], deltas: { internationalLegitimacy: 10, securityThreat: -4 }, flags: { unForce: true }, gamble: { p: 0.55, success: { label: { he: "הכוח משתלט על המצב", en: "The force takes control" }, deltas: { securityThreat: -6 } }, failure: { label: { he: "הכוח נמנע מעימות עם החמושים", en: "The force avoids confronting militants" }, deltas: { securityThreat: 6 } } }, odds: odds(0.55, { internationalLegitimacy: 0.25, securityThreat: -0.3 }), peaceGamble: { success: 22, failure: 4 }, milestone: "UN_STABILIZE" }),
    opt({ id: "UN_ST_PA", label: { he: "לבנות את כוחות הרשות עם אימון אמריקני", en: "Build PA forces with US training" }, objective: { he: "ריבונות פלסטינית אמיתית.", en: "Real Palestinian sovereignty." }, pros: [{ he: "בעלות פלסטינית", en: "Palestinian ownership" }], cons: [{ he: "זמן ארוך", en: "Takes time" }], deltas: { usMilitaryAid: 4, securityThreat: 3 }, peace: 14, milestone: "UN_STABILIZE" }),
    opt({ id: "UN_ST_RETURN", label: { he: "להחזיר את צה\"ל לערים", en: "Send the IDF back into the cities" }, objective: { he: "לעצור את ההידרדרות.", en: "Stop the deterioration." }, pros: [{ he: "שקט ביטחוני", en: "Security calm" }], cons: [{ he: "הנסיגה מתרוקנת מתוכן", en: "The withdrawal is emptied of meaning" }], deltas: { securityThreat: -10, internationalLegitimacy: -12 }, partners: { left: -30, arab: -30, right: 10 }, peace: -15 }),
  ],
});

const UN_BORDER = milestone("unilateral", "UN_BORDER", {
  title: { he: "משטר הגבול והמעברים", en: "The border regime and crossings" },
  context: { he: "הגדר הופכת לגבול. כמה פועלים ייכנסו? מי שולט במעבר אלנבי? האם יהיה מעבר בטוח בין עזה ליהודה ושומרון?", en: "The barrier becomes a border. How many workers enter? Who runs the Allenby crossing? Will there be safe passage between Gaza and the West Bank?" },
  focus: "west_bank",
  options: [
    opt({ id: "UN_BR_OPEN", label: { he: "גבול פתוח לסחר ולעבודה עם פיקוח טכנולוגי", en: "An open border for trade and work with tech monitoring" }, objective: { he: "כלכלה פלסטינית בת-קיימא.", en: "A viable Palestinian economy." }, pros: [{ he: "יציבות כלכלית לשני הצדדים", en: "Economic stability on both sides" }], cons: [{ he: "סיכון חדירות", en: "Infiltration risk" }], deltas: { economicStability: 6, securityThreat: 3, internationalLegitimacy: 6 }, peace: 18, milestone: "UN_BORDER" }),
    opt({ id: "UN_BR_TIGHT", label: { he: "גבול הרמטי עם מכסות", en: "A sealed border with quotas" }, objective: { he: "הפרדה מלאה.", en: "Full separation." }, pros: [{ he: "שליטה ביטחונית", en: "Security control" }], cons: [{ he: "משבר כלכלי בצד הפלסטיני", en: "Economic crisis on the Palestinian side" }], deltas: { securityThreat: -3, economicStability: -3 }, peace: 8, milestone: "UN_BORDER" }),
  ],
});

const UN_RECOGNITION = milestone("unilateral", "UN_RECOGNITION", {
  title: { he: "הכרה במדינה פלסטינית באו\"ם", en: "Recognizing a Palestinian state at the UN" },
  context: { he: "מדינות רבות מוכנות להכיר במדינה פלסטינית ככל שישראל תכיר ראשונה. ההכרה תהפוך את הנסיגה לבלתי הפיכה.", en: "Many states will recognize Palestine if Israel recognizes first. Recognition would make the withdrawal irreversible." },
  precedent: { years: "2012 · 2024", title: { he: "מעמד משקיפה ומגל ההכרות", en: "Observer status and the recognition wave" }, body: { he: "ב-2012 קיבלה פלסטין מעמד מדינה משקיפה באו\"ם; ב-2024 הכירו בה ספרד, אירלנד ונורבגיה.", en: "In 2012 Palestine became a non-member observer state at the UN; in 2024 Spain, Ireland and Norway recognized it." }, lesson: { he: "הכרה בלי הסכם ביטחוני יוצרת מדינה על הנייר; עם הסכם — שותף מחויב.", en: "Recognition without a security deal makes a state on paper; with one — a committed partner." } },
  focus: "world",
  options: [
    opt({ id: "UN_RC_MUTUAL", label: { he: "הכרה הדדית עם התחייבות לפירוז", en: "Mutual recognition with a demilitarization commitment" }, objective: { he: "שתי מדינות מכירות זו בזו.", en: "Two states recognizing each other." }, pros: [{ he: "לגיטימציה עולמית", en: "Global legitimacy" }], cons: [{ he: "הימין מתקומם", en: "The right revolts" }], deltas: { internationalLegitimacy: 18, regionalRelations: 12, internalCohesion: -8 }, partners: { far_right: -60, right: -25, left: 10, arab: 15 }, peace: 22, milestone: "UN_RECOGNITION" }),
    opt({ id: "UN_RC_WAIT", label: { he: "להכיר רק אחרי שנתיים של שקט", en: "Recognize only after two quiet years" }, objective: { he: "הכרה מותנית בהוכחה.", en: "Recognition conditioned on proof." }, pros: [{ he: "זהירות", en: "Caution" }], cons: [{ he: "החמושים מקבלים זמן לחבל", en: "Militants get time to sabotage" }], deltas: { internationalLegitimacy: 4 }, peace: 10, milestone: "UN_RECOGNITION" }),
  ],
});

const UN_FINAL = milestone("unilateral", "UN_FINAL", {
  title: { he: "הסכם שלום בין ישראל לפלסטין", en: "A peace treaty between Israel and Palestine" },
  context: { he: "שתי מדינות, גבול קיים, כוח בינלאומי. נשאר לחתום על סוף תביעות ולאשר.", en: "Two states, a border in place, an international force. What remains is to sign an end of claims and ratify." },
  focus: "world",
  options: [
    opt({ id: "UN_FN_SIGN", label: { he: "לחתום ולאשרר", en: "Sign and ratify" }, objective: { he: "סוף הסכסוך.", en: "The end of the conflict." }, pros: [{ he: "שלום חוזי", en: "A treaty peace" }], cons: [{ he: "שסע פנימי", en: "Internal rift" }], deltas: { internationalLegitimacy: 20, regionalRelations: 15 }, partners: { far_right: -100, right: -40, center: 10, left: 20, arab: 20 }, gamble: { p: 0.55, success: { label: { he: "האמנה אושררה", en: "The treaty is ratified" }, deltas: { economicStability: 10 } }, failure: { label: { he: "האשרור נכשל", en: "Ratification fails" }, deltas: { internalCohesion: -10 } } }, odds: odds(0.55, { internalCohesion: 0.3, securityThreat: -0.35, coalitionStability: 0.15 }), peaceGamble: { success: 40, failure: -12 }, milestone: "UN_FINAL" }),
    opt({ id: "UN_FN_WAIT", label: { he: "להסתפק בהסדר הקיים", en: "Settle for the current arrangement" }, objective: { he: "בלי חתימה פורמלית.", en: "Without a formal signature." }, pros: [{ he: "אין סיכון", en: "No risk" }], cons: [{ he: "הסכסוך לא הסתיים רשמית", en: "The conflict has not formally ended" }], deltas: {}, peace: -5 }),
  ],
});

// ---------------------------------------------------------------------------
// sovereignty path (conservative right)
// ---------------------------------------------------------------------------

const SV_AUTONOMY = milestone("sovereignty", "SV_AUTONOMY", {
  title: { he: "אוטונומיה לערים הפלסטיניות", en: "Autonomy for the Palestinian cities" },
  context: { he: "אם ישראל שולטת בשטחי C, מה יהיה בערים? אוטונומיה מוניציפלית, ממשל מחוזי ('אמירויות') או שלטון צבאי ישיר?", en: "If Israel controls Area C, what happens in the cities? Municipal autonomy, district governments ('emirates') or direct military rule?" },
  precedent: { years: "1978 · 1981", title: { he: "האוטונומיה של קמפ דייוויד והמנהל האזרחי", en: "The Camp David autonomy and the Civil Administration" }, body: { he: "הסכמי קמפ דייוויד (1978) הבטיחו אוטונומיה לפלסטינים שלא מומשה; אגודות הכפרים שהקימה ישראל בשנות ה-80 לא זכו ללגיטימציה.", en: "The 1978 Camp David Accords promised Palestinian autonomy that never materialized; the Village Leagues Israel set up in the 1980s never gained legitimacy." }, lesson: { he: "אוטונומיה שנכפית מבחוץ בלי הנהגה מקומית אמיתית לא מחזיקה.", en: "Autonomy imposed from outside without real local leadership does not hold." } },
  focus: "west_bank",
  options: [
    opt({ id: "SV_AU_CITIES", label: { he: "אוטונומיה רחבה לערים עם בחירות מקומיות", en: "Broad city autonomy with local elections" }, objective: { he: "ניהול עצמי אמיתי.", en: "Real self-rule." }, pros: [{ he: "הפחתת חיכוך", en: "Less friction" }], cons: [{ he: "העולם רואה בזה בנטוסטנים", en: "The world sees Bantustans" }], deltas: { securityThreat: -3, internationalLegitimacy: 3 }, partners: { far_right: -15 }, gamble: { p: 0.5, success: { label: { he: "הנהגה מקומית משתפת פעולה", en: "Local leaders cooperate" }, deltas: {} }, failure: { label: { he: "המועמדים מחרימים את הבחירות", en: "Candidates boycott the elections" }, deltas: { securityThreat: 4 } } }, odds: odds(0.5, { regionalRelations: 0.25, economicStability: 0.2 }), peaceGamble: { success: 14, failure: 0 }, milestone: "SV_AUTONOMY" }),
    opt({ id: "SV_AU_MILITARY", label: { he: "שלטון צבאי ישיר", en: "Direct military rule" }, objective: { he: "שליטה מלאה.", en: "Full control." }, pros: [{ he: "ביטחון", en: "Security" }], cons: [{ he: "עלות וסכסוך מתמשך", en: "Cost and continuing conflict" }], deltas: { securityThreat: -2, economicStability: -8, internationalLegitimacy: -10 }, partners: { far_right: 10 }, peace: -10 }),
  ],
});

const SV_ECONOMY = milestone("sovereignty", "SV_ECONOMY", {
  title: { he: "שלום כלכלי", en: "Economic peace" },
  context: { he: "אזורי תעשייה משותפים, היתרי עבודה ותשתיות — עם מימון מהמפרץ, אם תהיה הצדקה פוליטית.", en: "Joint industrial zones, work permits and infrastructure — with Gulf funding, if there is a political justification." },
  precedent: { years: "2019", title: { he: "סדנת בחריין", en: "The Bahrain workshop" }, body: { he: "תוכנית \"שלום לשגשוג\" הציעה 50 מיליארד דולר השקעות; הפלסטינים החרימו, והתוכנית לא יצאה לפועל.", en: "The \"Peace to Prosperity\" plan offered $50bn in investment; the Palestinians boycotted and it never took off." }, lesson: { he: "כסף לא מחליף הסכמה מדינית — אבל שגשוג מחזק את מי שבוחרים בשקט.", en: "Money does not replace political consent — but prosperity strengthens those who choose calm." } },
  focus: "west_bank",
  options: [
    opt({ id: "SV_EC_ZONES", label: { he: "100 אלף היתרי עבודה ואזורי תעשייה", en: "100,000 work permits and industrial zones" }, objective: { he: "שיפור דרמטי ברמת החיים.", en: "A dramatic rise in living standards." }, pros: [{ he: "צמיחה בשני הצדדים", en: "Growth on both sides" }], cons: [{ he: "סיכון ביטחוני בכניסה", en: "Entry security risk" }], deltas: { economicStability: 8, securityThreat: 2, regionalRelations: 6 }, stance: { uae: 6 }, peace: 14, milestone: "SV_ECONOMY" }),
    opt({ id: "SV_EC_LIMITED", label: { he: "צעדים מוגבלים בפיקוח שב\"כ", en: "Limited steps under Shin Bet oversight" }, objective: { he: "הקלות בלי סיכון.", en: "Relief without risk." }, pros: [{ he: "זהיר", en: "Careful" }], cons: [{ he: "השפעה קטנה", en: "Small impact" }], deltas: { economicStability: 2 }, peace: 6, milestone: "SV_ECONOMY" }),
  ],
});

const SV_STATUS = milestone("sovereignty", "SV_STATUS", {
  title: { he: "שאלת המעמד: אזרחות, תושבות או קונפדרציה?", en: "The status question: citizenship, residency or confederation?" },
  context: { he: "ריבונות בלי מעמד מוגדר לפלסטינים לא תוכר בעולם. שלוש דרכים: אזרחות מדורגת, קונפדרציה עם ירדן — או תושבות בלי זכות הצבעה.", en: "Sovereignty without a defined status for Palestinians will not be recognized. Three ways: graduated citizenship, a confederation with Jordan — or residency without the vote." },
  precedent: { years: "1987 · 1988", title: { he: "הסכם לונדון וההתנתקות של ירדן", en: "The London Agreement and Jordan's disengagement" }, body: { he: "ב-1987 סיכמו פרס והמלך חוסיין על ועידה והסדר עם ירדן; שמיר דחה, וב-1988 ניתקה ירדן את זיקתה לגדה המערבית.", en: "In 1987 Peres and King Hussein agreed on a conference and a Jordanian arrangement; Shamir rejected it, and in 1988 Jordan severed its ties to the West Bank." }, lesson: { he: "\"האופציה הירדנית\" דורשת את ירדן — שאינה רוצה בה בלי הסכמה פלסטינית.", en: "The \"Jordanian option\" needs Jordan — which won't take it without Palestinian consent." } },
  focus: "jordan",
  options: [
    opt({ id: "SV_ST_CITIZENSHIP", label: { he: "מסלול אזרחות מדורג ושוויון זכויות", en: "A graduated citizenship path and equal rights" }, objective: { he: "מדינה אחת עם זכויות מלאות.", en: "One state with full rights." }, pros: [{ he: "לגיטימציה בינלאומית", en: "International legitimacy" }], cons: [{ he: "שאלת הרוב היהודי; הימין מתקומם", en: "The Jewish-majority question; the right revolts" }], deltas: { internationalLegitimacy: 18, internalCohesion: -18 }, partners: { far_right: -80, right: -40, haredi: -20, left: 10, arab: 25 }, peace: 22, milestone: "SV_STATUS" }),
    opt({ id: "SV_ST_JORDAN", label: { he: "קונפדרציה עם ירדן: אזרחות ירדנית, ניהול מקומי", en: "Confederation with Jordan: Jordanian citizenship, local rule" }, objective: { he: "זהות מדינית פלסטינית דרך ירדן.", en: "A Palestinian political identity via Jordan." }, pros: [{ he: "שומר על רוב יהודי", en: "Preserves a Jewish majority" }], cons: [{ he: "תלוי בהסכמת ירדן והפלסטינים", en: "Depends on Jordan and the Palestinians" }], deltas: { regionalRelations: 6 }, partners: { far_right: -30, right: 5 }, stance: { jordan: -5 }, gamble: { p: 0.3, success: { label: { he: "ירדן מסכימה בכפוף למשאל פלסטיני", en: "Jordan agrees, subject to a Palestinian vote" }, deltas: { regionalRelations: 12 } }, failure: { label: { he: "עמאן דוחה: \"ירדן איננה פלסטין\"", en: "Amman refuses: \"Jordan is not Palestine\"" }, deltas: { regionalRelations: -12 } } }, odds: odds(0.3, { regionalRelations: 0.3, usMilitaryAid: 0.15 }), peaceGamble: { success: 20, failure: -6 }, milestone: "SV_STATUS" }),
    opt({ id: "SV_ST_RESIDENCY", label: { he: "תושבות קבע בלי זכות הצבעה", en: "Permanent residency without the vote" }, objective: { he: "ריבונות בלי שינוי דמוגרפי.", en: "Sovereignty without demographic change." }, pros: [{ he: "מקובל על הימין", en: "Acceptable to the right" }], cons: [{ he: "האשמות באפרטהייד ובידוד", en: "Apartheid accusations and isolation" }], deltas: { internationalLegitimacy: -22, regionalRelations: -15 }, partners: { far_right: 10, center: -20 }, stance: { eu: -15 }, peace: -15 }),
  ],
});

const SV_FINAL = milestone("sovereignty", "SV_FINAL", {
  title: { he: "הסדר מוכר: אישור פלסטיני ובינלאומי", en: "A recognized arrangement: Palestinian and international approval" },
  context: { he: "המודל גובש. בלי הסכמה פלסטינית והכרה בינלאומית הסכסוך לא נגמר — הוא רק משנה צורה.", en: "The model is set. Without Palestinian consent and international recognition the conflict does not end — it only changes form." },
  focus: "world",
  options: [
    opt({ id: "SV_FN_VOTE", label: { he: "משאל פלסטיני בפיקוח בינלאומי", en: "A Palestinian vote under international supervision" }, objective: { he: "הסכמה אמיתית של הצד השני.", en: "Genuine consent from the other side." }, pros: [{ he: "סוף תביעות אם יאושר", en: "An end of claims if approved" }], cons: [{ he: "סיכוי נמוך", en: "Low odds" }], deltas: { internationalLegitimacy: 10 }, partners: { far_right: -40 }, gamble: { p: 0.35, success: { label: { he: "הפלסטינים מאשרים את ההסדר", en: "The Palestinians approve the arrangement" }, deltas: { regionalRelations: 15, economicStability: 8 } }, failure: { label: { he: "רוב פלסטיני דוחה", en: "A Palestinian majority rejects it" }, deltas: { securityThreat: 8 } } }, odds: odds(0.35, { internationalLegitimacy: 0.3, regionalRelations: 0.25, economicStability: 0.15 }), peaceGamble: { success: 40, failure: -15 }, milestone: "SV_FINAL" }),
    opt({ id: "SV_FN_IMPOSE", label: { he: "להכריז על ההסדר כעובדה", en: "Declare the arrangement a fact" }, objective: { he: "בלי הסכמה.", en: "Without consent." }, pros: [{ he: "הימין מרוצה", en: "The right is pleased" }], cons: [{ he: "הסכסוך נמשך", en: "The conflict continues" }], deltas: { internationalLegitimacy: -15, securityThreat: 8 }, partners: { far_right: 10 }, peace: -20 }),
  ],
});

// ---------------------------------------------------------------------------
// spoilers: the harder the process moves, the harder they push
// ---------------------------------------------------------------------------

const onPath = (v: CampaignView) => v.resolution.path !== null;

const SP_ROCKETS: DilemmaDef = {
  id: "SP_ROCKETS",
  title: { he: "ירי רקטות כדי לטרפד את המגעים", en: "Rocket fire to derail the talks" },
  context: { he: "ארגון קיצוני בעזה שיגר מטח לשדרות ולאשקלון דווקא ביום סבב השיחות. הוא רוצה תגובה שתפוצץ את התהליך.", en: "An extremist group in Gaza fired a barrage at Sderot and Ashkelon on the very day of talks. It wants a response that blows up the process." },
  focus: "gaza",
  visual: { kind: "salvo", from: "gaza", weapon: "rocket", count: 12 },
  weight: (v) => (onPath(v) && v.resolution.progress >= 15 ? 0.4 + v.resolution.progress / 180 : 0),
  cooldown: 4,
  options: [
    opt({ id: "SP_RK_PRECISE", label: { he: "תקיפה ממוקדת בחוליות וממשיכים לדבר", en: "Hit the cells precisely and keep talking" }, objective: { he: "תגובה בלי לשבור את התהליך.", en: "Respond without breaking the process." }, pros: [{ he: "מנטרל את המחבלים", en: "Denies the spoilers" }], cons: [{ he: "ביקורת מימין על \"חולשה\"", en: "\"Weakness\" criticism from the right" }], deltas: { securityThreat: -3 }, partners: { far_right: -10 }, visual: { kind: "strike", target: "gaza", count: 4 }, peace: 2 }),
    opt({ id: "SP_RK_SUSPEND", label: { he: "להשעות את המגעים עד לשקט מלא", en: "Suspend talks until full calm" }, objective: { he: "אין משא ומתן תחת אש.", en: "No negotiating under fire." }, pros: [{ he: "תמיכה ציבורית", en: "Public support" }], cons: [{ he: "המחבלים השיגו את מטרתם", en: "The spoilers got what they wanted" }], deltas: { internalCohesion: 3 }, partners: { right: 5 }, peace: -10 }),
    opt({ id: "SP_RK_WIDE", label: { he: "מבצע רחב ברצועה", en: "A wide operation in the Strip" }, objective: { he: "הרתעה.", en: "Deterrence." }, pros: [{ he: "פגיעה קשה בתשתיות", en: "Heavy damage to infrastructure" }], cons: [{ he: "התהליך קורס; לחץ בינלאומי", en: "The process collapses; international pressure" }], deltas: { securityThreat: -6, internationalLegitimacy: -12, regionalRelations: -10 }, partners: { far_right: 10, left: -20, arab: -30 }, visual: { kind: "strike", target: "gaza", count: 12 }, peace: -18 }),
  ],
};

const SP_TEMPLE_MOUNT: DilemmaDef = {
  id: "SP_TEMPLE_MOUNT",
  title: { he: "עימותים בהר הבית ברמדאן", en: "Clashes on the Temple Mount during Ramadan" },
  context: { he: "שר בממשלה עלה להר הבית עם מאות תומכים; מתפללים התבצרו באל-אקצא. ירדן מזהירה, ההפגנות מתפשטות.", en: "A cabinet minister went up to the Temple Mount with hundreds of supporters; worshippers barricaded inside Al-Aqsa. Jordan warns; protests spread." },
  precedent: { years: "2000 · 2021", title: { he: "העלייה של שרון ו\"שומר החומות\"", en: "Sharon's visit and \"Guardian of the Walls\"" }, body: { he: "עלייתו של שרון להר (2000) קדמה לאינתיפאדה השנייה; העימותים ברמדאן 2021 הובילו לירי מעזה ולמהומות בערים המעורבות.", en: "Sharon's visit (2000) preceded the second intifada; the Ramadan 2021 clashes led to rocket fire from Gaza and riots in mixed cities." }, lesson: { he: "הר הבית הוא הנפץ המהיר ביותר של הסכסוך.", en: "The Temple Mount is the conflict's fastest fuse." } },
  focus: "israel",
  visual: { kind: "protest" },
  weight: (v) => 0.25 + (onPath(v) ? v.resolution.progress / 250 : 0.1),
  cooldown: 6,
  options: [
    opt({ id: "SP_TM_STATUS_QUO", label: { he: "לאכוף את הסטטוס קוו ולהגביל את השר", en: "Enforce the status quo and restrain the minister" }, objective: { he: "הרגעה מהירה.", en: "Quick de-escalation." }, pros: [{ he: "ירדן וסעודיה מרוצות", en: "Jordan and Saudi Arabia are satisfied" }], cons: [{ he: "משבר קואליציוני", en: "Coalition crisis" }], deltas: { securityThreat: -4, regionalRelations: 6 }, partners: { far_right: -30 }, stance: { jordan: 6 }, peace: 4 }),
    opt({ id: "SP_TM_FORCE", label: { he: "פינוי המתבצרים בכוח", en: "Clear the barricaded worshippers by force" }, objective: { he: "משילות בהר.", en: "Governance on the Mount." }, pros: [{ he: "תמיכה מהימין", en: "Right-wing support" }], cons: [{ he: "תמונות מאל-אקצא מציתות את האזור", en: "Images from Al-Aqsa inflame the region" }], deltas: { securityThreat: 10, regionalRelations: -15 }, partners: { far_right: 10, arab: -40 }, stance: { jordan: -12 }, visual: { kind: "salvo", from: "gaza", weapon: "rocket", count: 10 }, peace: -12 }),
  ],
};

const SP_PRISONERS: DilemmaDef = {
  id: "SP_PRISONERS",
  title: { he: "שחרור אסירים כמחווה לבניית אמון", en: "Prisoner release as a confidence-building step" },
  context: { he: "הצד הפלסטיני מבקש שחרור אסירים ותיקים כדי להצדיק את המשך המגעים מול הציבור שלו. משפחות שכולות מפגינות.", en: "The Palestinian side asks for the release of veteran prisoners to justify continued talks to its public. Bereaved families protest." },
  precedent: { years: "2013–2014", title: { he: "שחרור האסירים בשיחות קרי", en: "The prisoner releases in the Kerry talks" }, body: { he: "ישראל שחררה שלוש פעימות אסירים; הפעימה הרביעית בוטלה והשיחות קרסו.", en: "Israel released three tranches of prisoners; the fourth was cancelled and the talks collapsed." }, lesson: { he: "מחוות בונות אמון רק כשהן חלק ממהלך שמתקדם.", en: "Gestures build trust only as part of a process that moves." } },
  focus: "israel",
  weight: (v) => (onPath(v) && v.resolution.progress >= 10 && v.resolution.progress < 75 ? 0.5 : 0),
  once: true,
  options: [
    opt({ id: "SP_PR_RELEASE", label: { he: "לשחרר אסירים ללא דם על הידיים", en: "Release prisoners without blood on their hands" }, objective: { he: "מחווה מוגבלת.", en: "A limited gesture." }, pros: [{ he: "מחזק את ההנהגה הפלסטינית", en: "Strengthens the Palestinian leadership" }], cons: [{ he: "סערה ציבורית", en: "Public storm" }], deltas: { internalCohesion: -5, internationalLegitimacy: 5 }, partners: { far_right: -25, right: -10 }, peace: 8 }),
    opt({ id: "SP_PR_REFUSE", label: { he: "לסרב", en: "Refuse" }, objective: { he: "בלי מחוות.", en: "No gestures." }, pros: [{ he: "תמיכה ציבורית", en: "Public support" }], cons: [{ he: "הצד השני נחלש", en: "The other side is weakened" }], deltas: { internalCohesion: 2 }, peace: -6 }),
  ],
};

const SP_OUTPOST: DilemmaDef = {
  id: "SP_OUTPOST",
  title: { he: "בג\"ץ מורה לפנות מאחז לא חוקי", en: "The High Court orders an illegal outpost evacuated" },
  context: { he: "מאחז על קרקע פלסטינית פרטית. המתנחלים מתבצרים; שרים בקואליציה מאיימים.", en: "An outpost on private Palestinian land. Settlers barricade themselves; coalition ministers threaten." },
  precedent: { years: "2006 · 2017", title: { he: "עמונה", en: "Amona" }, body: { he: "פינוי עמונה (2006) לווה בעימותים קשים; הפינוי השני (2017) בוצע אחרי שנים של דחיות.", en: "The 2006 Amona evacuation saw violent clashes; the second (2017) came after years of delays." }, lesson: { he: "אכיפת שלטון החוק על מאחזים היא מבחן אמינות לכל תהליך מדיני.", en: "Enforcing the law on outposts is a credibility test for any political process." } },
  focus: "west_bank",
  weight: (v) => (onPath(v) ? 0.35 : 0.15),
  cooldown: 6,
  options: [
    opt({ id: "SP_OP_EVACUATE", label: { he: "לפנות כפי שהורה בג\"ץ", en: "Evacuate as the court ordered" }, objective: { he: "שלטון החוק.", en: "Rule of law." }, pros: [{ he: "אמינות מול העולם והפלסטינים", en: "Credibility with the world and the Palestinians" }], cons: [{ he: "עימותים ומשבר קואליציוני", en: "Clashes and coalition crisis" }], deltas: { internationalLegitimacy: 6, internalCohesion: -4 }, partners: { far_right: -30, right: -5 }, peace: 5 }),
    opt({ id: "SP_OP_LEGALIZE", label: { he: "חוק להכשרת המאחז", en: "A law to legalize the outpost" }, objective: { he: "לעקוף את הפסיקה.", en: "Bypass the ruling." }, pros: [{ he: "הימין מרוצה", en: "The right is pleased" }], cons: [{ he: "פגיעה בתהליך ובלגיטימציה", en: "Damages the process and legitimacy" }], deltas: { internationalLegitimacy: -10 }, partners: { far_right: 15, center: -15 }, stance: { eu: -8, usa: -5 }, peace: -9 }),
  ],
};

export const RESOLUTION_DILEMMAS: DilemmaDef[] = [
  REG_GAZA_FORCE, REG_RECONSTRUCTION, REG_PA_REFORM, REG_NORMALIZATION, REG_FINAL,
  TS_COORDINATION, TS_BORDERS, TS_JERUSALEM, TS_REFUGEES_SECURITY, TS_FINAL,
  UN_STABILIZE, UN_BORDER, UN_RECOGNITION, UN_FINAL,
  SV_AUTONOMY, SV_ECONOMY, SV_STATUS, SV_FINAL,
  SP_ROCKETS, SP_TEMPLE_MOUNT, SP_PRISONERS, SP_OUTPOST,
];

/** How the existing (pre-resolution) choices move the process. */
export const OPTION_PEACE: Record<string, number> = {
  D_TRUSTEESHIP: 5, D_PA_RETURN: 5, D_WITHDRAWAL: 5, D_ANNEXATION: 0, D_RADICAL_RIGHT: -20,
  RR_OCCUPY: -15, RR_SIEGE: -15, RR_EMIGRATION: -25, RR_TRANSFER: -40, RR_CARPET: -30, RR_NUCLEAR: -100,
  AN_LAW_C: -8, AN_DISMANTLE_PA: -15, AN_DE_FACTO: -5,
  TR_AMBIGUITY: 10, TR_DEMIL_FIRST: 3, TR_US_PACT: 8,
  PA_WITH_IDF: 10, PA_ALONE: 8, PA_FREEZE_TALKS: 12,
  WD_IMMEDIATE: 8, WD_STAGED: 12, WD_UN_FORCE: 12,
  JO_FREEZE: 4, JO_PRESSURE: -6, JO_US: 3,
  SV_ENFORCE: 4, SV_IGNORE: -5, SV_SUPPORT: -12,
  ICC_INQUIRY: 2, ICC_DEFY: -3,
  EU_CONCEDE: 4, EU_RETALIATE: -4,
  TA_TARGETED: 0, TA_COLLECTIVE: -6, TA_RESTRAINT: 2,
  SA_SIGN: 12, SA_DECLINE: -6,
  CF_COMPREHENSIVE: 5, CF_FIGHT_ON: -5,
  CR_FORCE: 6, CR_PAUSE: -6,
  PA_DEFENSIVE_SHIELD_2: -10, PA_US_STABILIZATION: 6, PA_RETREAT_TO_BARRIER: -4,
  TUN_FREEZE_FUNDS: -4, TUN_SPECIAL_FORCES: -3,
};

/** Consequences that set the process back (by English headline). */
export const CONSEQUENCE_PEACE: Record<string, number> = {
  "Security services disintegrate; weapons leak to militants": -8,
  "Wave of settler violence in Palestinian villages": -5,
  "Militants seize PA posts in Rafah": -10,
  "Militants fill the vacuum; fire at Kfar Saba and Netanya": -8,
  "Riyadh announces the start of talks": 5,
  "A tunnel threat tests the framework": -4,
  "Signing ceremony at the White House": 5,
};

/** Visible progress wins back patience: success builds public support for the government. */
export const MILESTONE_MOMENTUM = { right: 6, center: 6, left: 4, arab: 4, haredi: 3 } as const;

export function milestoneOf(id: string): { path: ResolutionPath; index: number; of: number } | null {
  for (const [path, list] of Object.entries(PATH_MILESTONES) as Array<[ResolutionPath, string[]]>) {
    const i = list.indexOf(id);
    if (i >= 0) return { path, index: i + 1, of: list.length };
  }
  return null;
}
