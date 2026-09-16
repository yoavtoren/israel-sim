/** Universal crisis engine: crisis definitions (with the historical precedent
 *  each dilemma is modelled on) and the trigger rules that open them — either
 *  directly from a policy or as a random operational shock.
 *
 *  Option metric deltas are the design brief's numbers. Trigger probabilities
 *  and cooldowns are ASSUMPTIONS. Pure: probabilities are functions of state;
 *  the reducer owns the random draws. */

import type {
  Bi, CheckpointKey, CrisisId, CrisisOptionId, GambleBranch, PolicyAction, SimulationMetrics,
  SimulationState, StrategicFlags,
} from "./types";

type Deltas = Partial<SimulationMetrics>;

export interface CrisisPrecedent {
  /** e.g. "1994–2000 · 2002 · 2007" */ years: string;
  title: Bi;
  body: Bi;
  lesson: Bi;
}

export interface CrisisGamble {
  /** probability of success */ p: number;
  success: { deltas: Deltas; label: Bi };
  failure: { deltas: Deltas; label: Bi };
}

/** Semantic side-effects beyond metric deltas. */
export interface CrisisEffects {
  /** B/C of the forced-transfer crisis: the brief's hard failure rule */ executesTransfer?: boolean;
  /** the posture that caused the crisis is abandoned (activeTrack → null) */ abandonsTrack?: boolean;
  /** IDF re-enters: terror-infrastructure growth stops */ restoresIdfControl?: boolean;
  /** trusteeship frozen for a turn; Gulf money suspended */ freezesProcess?: boolean;
  /** US conditions (no annexation / expansion) for N turns */ usConditionsTurns?: number;
}

export interface CrisisOptionDef {
  id: CrisisOptionId;
  label: Bi;
  /** מטרה מושגת */ objective: Bi;
  pros: Bi[];
  cons: Bi[];
  deltas: Deltas;
  gamble?: CrisisGamble;
  effects?: CrisisEffects;
  /** log line on resolution; for executesTransfer, the game-over reason */ result: Bi;
}

export interface CrisisDef {
  id: CrisisId;
  title: Bi;
  situation: Bi;
  trigger: Bi;
  precedent: CrisisPrecedent;
  options: CrisisOptionDef[];
  /** turns before it may open again */ cooldownTurns: number;
}

// ---------------------------------------------------------------------------
// definitions
// ---------------------------------------------------------------------------

export const CRISIS_DEFS: Record<CrisisId, CrisisDef> = {
  EGYPTIAN_BALLISTIC_ATTACK: {
    id: "EGYPTIAN_BALLISTIC_ATTACK",
    title: { he: "מתקפה בליסטית מצרית בעקבות הנחיית הטרנספר", en: "Egyptian ballistic attack after the transfer directive" },
    situation: {
      he: "התראות גבול בחזית מצרים. דיביזיות ממוכנות של ארמיה 2 ו-3 נערכות לאורך תעלת סואץ. טילים בליסטיים שוגרו מסיני לעבר גוש דן; סוללות חץ וקלע דוד מיירטות מעל מרכז הארץ.",
      en: "Border alerts on the Egyptian front. Mechanized divisions of the 2nd and 3rd Armies deploy along the Suez Canal. Ballistic missiles launched from Sinai toward Gush Dan; Arrow and David's Sling intercept over central Israel.",
    },
    trigger: { he: "מסלול ימין רדיקלי: הנחיית טרנספר כפוי", en: "Radical-right track: forced-transfer directive" },
    precedent: {
      years: "1979 · 2023",
      title: { he: "הסכם השלום עם מצרים והקו האדום של קהיר", en: "The Egypt–Israel peace treaty and Cairo's red line" },
      body: {
        he: "הסכם השלום (מרץ 1979) מעגן את פירוז סיני ואת הגבול הבינלאומי. באוקטובר 2023 הצהיר הנשיא א-סיסי כי דחיקת תושבי עזה לסיני אינה מקובלת ועלולה להפוך את סיני לבסיס למתקפות נגד ישראל; ירדן הגדירה עקירה כזו \"קו אדום\". העברה כפויה של אוכלוסייה אסורה לפי סעיף 49 לאמנת ז'נבה הרביעית.",
        en: "The March 1979 treaty anchors Sinai's demilitarization and the international border. In October 2023 President al-Sisi said pushing Gazans into Sinai was unacceptable and could turn Sinai into a base for attacks on Israel; Jordan called such displacement a \"red line\". Forcible population transfer is prohibited under Article 49 of the Fourth Geneva Convention.",
      },
      lesson: {
        he: "ההסכם עם מצרים הוא עוגן ביטחוני ממדרגה ראשונה; מהלך שמאיים על ריבונות מצרים בסיני הופך שכן בשלום לחזית.",
        en: "The Egypt treaty is a first-order security anchor; a move that threatens Egyptian sovereignty in Sinai turns a peace partner into a front.",
      },
    },
    cooldownTurns: 0,
    options: [
      {
        id: "A_CANCEL_TRANSFER",
        label: { he: "ביטול מיידי של הטרנספר ונסיגה דיפלומטית", en: "Cancel the transfer immediately; diplomatic retreat" },
        objective: { he: "עצירה מיידית של האש המצרית ומניעת מלחמה כוללת.", en: "Stop Egyptian fire at once and prevent all-out war." },
        pros: [
          { he: "שימור הסכמי השלום עם מצרים וירדן", en: "Peace treaties with Egypt and Jordan preserved" },
          { he: "מניעת אמברגו נשק אמריקאי", en: "US arms embargo averted" },
          { he: "הגנה על שוק ההון", en: "Capital markets protected" },
        ],
        cons: [
          { he: "פגיעה חמורה בהרתעה", en: "Severe damage to deterrence" },
          { he: "התפרקות מיידית של הקואליציה", en: "Immediate coalition breakup" },
          { he: "העצמת מוטיבציית הטרור בגדה ובעזה", en: "Terror motivation rises in the West Bank and Gaza" },
        ],
        deltas: { securityThreat: 15, regionalRelations: 30, coalitionStability: -50, usMilitaryAid: 10 },
        effects: { abandonsTrack: true },
        result: { he: "הטרנספר בוטל תחת אש.", en: "The transfer was cancelled under fire." },
      },
      {
        id: "B_AIR_RETALIATION",
        label: { he: "תקיפת תגמול אווירית ממוקדת על יעדים צבאיים במצרים", en: "Targeted air retaliation on military targets in Egypt" },
        objective: { he: "גביית מחיר והשמדת משגרים בסיני ללא מלחמה קרקעית.", en: "Exact a price and destroy launchers in Sinai without a ground war." },
        pros: [
          { he: "החזרת הרתעה טקטית מול צבא סדיר", en: "Tactical deterrence restored against a regular army" },
          { he: "סיכול סבבי ירי נוספים", en: "Further salvos prevented" },
        ],
        cons: [
          { he: "הסלמה למלחמה אזורית פתוחה", en: "Escalation to open regional war" },
          { he: "סוף הסכמי קמפ דייוויד", en: "The Camp David accords end" },
          { he: "חסימת תעלת סואץ ומצרי טיראן לשיט ישראלי", en: "Suez Canal and Straits of Tiran closed to Israeli shipping" },
        ],
        deltas: { securityThreat: 35, regionalRelations: -40, usMilitaryAid: -25, economicStability: -30 },
        effects: { executesTransfer: true },
        result: {
          he: "קריסה אסטרטגית: הטרנספר בוצע תחת אש. אמברגו נשק אמריקאי מלא, מלחמה אזורית פתוחה עם מצרים וירדן וסנקציות משתקות.",
          en: "Strategic collapse: the transfer went ahead under fire. Full US arms embargo, open regional war with Egypt and Jordan, crippling sanctions.",
        },
      },
      {
        id: "C_GROUND_INVASION_SINAI",
        label: { he: "פלישה קרקעית לרפיח ולמרחב חיץ בסיני", en: "Ground invasion of Rafah and a Sinai buffer zone" },
        objective: { he: "עומק אסטרטגי וניתוק הרצועה ממצרים.", en: "Strategic depth and severing the Strip from Egypt." },
        pros: [
          { he: "שליטה פיזית בצירי ההברחה", en: "Physical control of smuggling routes" },
          { he: "מניעת ירי תלול מסלול קצר טווח", en: "Short-range high-trajectory fire prevented" },
        ],
        cons: [
          { he: "מלחמה בעצימות גבוהה מול ארמיה 2 ו-3", en: "High-intensity war against the 2nd and 3rd Armies" },
          { he: "שחיקת סד\"כ המילואים", en: "Reserve forces worn down" },
          { he: "אמברגו נשק מערבי מיידי", en: "Immediate Western arms embargo" },
        ],
        deltas: { securityThreat: 60, regionalRelations: -100, internationalLegitimacy: -80, usMilitaryAid: -70 },
        effects: { executesTransfer: true },
        result: {
          he: "קריסה אסטרטגית: מלחמה קרקעית מול צבא מצרים ללא חימוש מערבי. אמברגו מלא, בידוד בינלאומי וצווי מעצר לשרשרת הפיקוד.",
          en: "Strategic collapse: a ground war against Egypt's army with no Western munitions. Full embargo, international isolation, arrest warrants for the chain of command.",
        },
      },
      {
        id: "D_US_MEDIATION",
        label: { he: "פנייה בהולה לארה\"ב ללחץ על קהיר", en: "Urgent appeal to the US to pressure Cairo" },
        objective: { he: "מטרייה דיפלומטית ולחץ אמריקאי להפסקת אש.", en: "US diplomatic umbrella and pressure for a ceasefire." },
        pros: [
          { he: "שימור הברית האסטרטגית עם ארה\"ב", en: "Strategic alliance with the US preserved" },
          { he: "מניעת שחיקת החימוש", en: "Munitions depletion avoided" },
          { he: "הפסקת אש בתיווך בינלאומי", en: "Internationally brokered ceasefire" },
        ],
        cons: [
          { he: "אובדן עצמאות ההחלטה", en: "Loss of decision autonomy" },
          { he: "דרישה אמריקאית לחזרה לסטטוס קוו", en: "US demands a return to the status quo" },
          { he: "כרסום בתדמית העוצמה האזורית", en: "Regional power image eroded" },
        ],
        deltas: { securityThreat: -10, usMilitaryAid: 20, coalitionStability: -25, internationalLegitimacy: 20 },
        effects: { abandonsTrack: true, usConditionsTurns: 4 },
        result: { he: "הפסקת אש בתיווך אמריקאי; הטרנספר הוקפא. ארה\"ב מתנה את הסיוע בהימנעות מסיפוח והרחבת התנחלויות.", en: "US-brokered ceasefire; the transfer is frozen. The US conditions aid on no annexation or settlement expansion." },
      },
    ],
  },

  PA_SECURITY_COLLAPSE: {
    id: "PA_SECURITY_COLLAPSE",
    title: { he: "קריסת התיאום הביטחוני ומרד חמושים ברשות הפלסטינית", en: "Security coordination collapses; armed revolt inside the PA" },
    situation: {
      he: "התיאום הביטחוני הושעה. גדודי מנגנונים בג'נין, שכם וטול כרם עברו לצד החמושים ומטה הרשות באזור צפון השומרון הושתלט. ירי לעבר יישובים בקו התפר.",
      en: "Security coordination is suspended. PA security battalions in Jenin, Nablus and Tulkarm have gone over to the militants and the PA's northern headquarters has been overrun. Fire on communities along the seam line.",
    },
    trigger: { he: "הסתמכות על הרש\"פ ללא חופש פעולה לצה\"ל", en: "Reliance on PA security without IDF freedom of action" },
    precedent: {
      years: "1994–2000 · 2002 · 2007",
      title: { he: "אוסלו, חומת מגן וההשתלטות על עזה", en: "Oslo, Defensive Shield and the takeover of Gaza" },
      body: {
        he: "הסכמי אוסלו (1993–1995) הקימו את מנגנוני הביטחון של הרשות. בספטמבר 1996 (מהומות מנהרת הכותל) ובאינתיפאדה השנייה (2000) השתתפו אנשי מנגנונים בירי על צה\"ל. במרץ–אפריל 2002, אחרי הפיגוע במלון פארק, יצא מבצע \"חומת מגן\" וצה\"ל חזר לערי הגדה. ביוני 2007 חמאס השתלט על עזה בתוך ימים וגבר על כוחות הרשות.",
        en: "The Oslo Accords (1993–95) created the PA security services. In September 1996 (Western Wall tunnel riots) and in the Second Intifada (2000) PA personnel took part in firing on the IDF. In March–April 2002, after the Park Hotel bombing, Operation Defensive Shield sent the IDF back into West Bank cities. In June 2007 Hamas seized Gaza within days, overpowering PA forces.",
      },
      lesson: {
        he: "מנגנון מקומי ללא גיבוי צבאי חיצוני עלול להתפרק דווקא ברגע המבחן; ואקום ביטחוני מתמלא מהר על ידי הגורם החמוש החזק ביותר.",
        en: "A local force without outside military backing can disintegrate at the moment of testing; a security vacuum is filled fast by the strongest armed actor.",
      },
    },
    cooldownTurns: 2,
    options: [
      {
        id: "PA_DEFENSIVE_SHIELD_2",
        label: { he: "מבצע \"חומת מגן 2\": כניסה קרקעית לכל הערים ופירוק המנגנונים", en: "\"Defensive Shield 2\": ground entry into every city; dismantle the services" },
        objective: { he: "השבת שליטה ביטחונית מלאה ופירוק תשתיות החמושים.", en: "Restore full security control and dismantle militant infrastructure." },
        pros: [
          { he: "בלימה מהירה של הירי ושל ההתחמשות", en: "Fire and rearmament halted quickly" },
          { he: "חופש פעולה מלא לצה\"ל מוחזר", en: "Full IDF freedom of action restored" },
          { he: "גיבוי של אגף הימין בממשלה", en: "Backing from the government's right flank" },
        ],
        cons: [
          { he: "גינוי בינלאומי ונפגעים אזרחיים", en: "International condemnation and civilian casualties" },
          { he: "גיוס מילואים נרחב ועלות כלכלית", en: "Large reserve call-up and economic cost" },
          { he: "סוף המסגרת המדינית עם הרשות", en: "End of the political framework with the PA" },
        ],
        deltas: { securityThreat: -30, internationalLegitimacy: -25, coalitionStability: 15, economicStability: -15 },
        effects: { restoresIdfControl: true },
        result: { he: "צה\"ל נכנס לערי הגדה ומפרק את המנגנונים שעברו צד.", en: "The IDF enters West Bank cities and dismantles the defecting services." },
      },
      {
        id: "PA_US_STABILIZATION",
        label: { he: "הזרמת כספי סיוע וחימוש אמריקאי למנגנוני הרשות לייצוב", en: "Channel US funds and arms to PA forces to stabilize them" },
        objective: { he: "הצלת הרשות כשותף ביטחוני בלי כניסה קרקעית.", en: "Save the PA as a security partner without a ground entry." },
        pros: [
          { he: "שימור המסגרת המדינית והתמיכה האמריקאית", en: "Political framework and US support preserved" },
          { he: "הימנעות מגיוס ומנפגעים", en: "No call-up, no casualties" },
        ],
        cons: [
          { he: "החמושים ממשיכים להתעצם בטווח הקצר", en: "Militants keep growing in the short term" },
          { he: "חשש שהנשק יגיע לידיים עוינות (כמו ב-2007)", en: "Risk the weapons reach hostile hands (as in 2007)" },
          { he: "איום אגף הימין בפירוק הממשלה", en: "The right flank threatens to bring down the government" },
        ],
        deltas: { securityThreat: 20, usMilitaryAid: 10, coalitionStability: -40 },
        result: { he: "סיוע אמריקאי חירום הוזרם למנגנוני הרשות.", en: "Emergency US assistance was channelled to the PA services." },
      },
      {
        id: "PA_RETREAT_TO_BARRIER",
        label: { he: "נסיגה לקווי גדר ההפרדה וסגר מוחלט", en: "Pull back to the separation barrier; full closure" },
        objective: { he: "ניתוק פיזי וצמצום חיכוך בלי לשלוט בערים.", en: "Physical separation and less friction without holding the cities." },
        pros: [
          { he: "אין כניסה לערים צפופות", en: "No entry into dense cities" },
          { he: "צמצום חיכוך יומיומי", en: "Less daily friction" },
        ],
        cons: [
          { he: "השטח שמעבר לגדר נשאר בידי החמושים", en: "The area beyond the barrier stays in militant hands" },
          { he: "סגר פוגע בכלכלה משני צדי הקו", en: "Closure hurts the economy on both sides" },
          { he: "ביקורת ירדנית ומפרצית", en: "Jordanian and Gulf criticism" },
        ],
        deltas: { securityThreat: 45, economicStability: -20, regionalRelations: -15 },
        result: { he: "צה\"ל נערך לאורך גדר ההפרדה והוטל סגר מלא.", en: "The IDF redeployed along the barrier and a full closure was imposed." },
      },
    ],
  },

  EGYPT_TREATY_BREACH: {
    id: "EGYPT_TREATY_BREACH",
    title: { he: "משבר הפרת הסכם השלום מול מצרים בסיני", en: "Peace-treaty breach crisis with Egypt in Sinai" },
    situation: {
      he: "כוחות צה\"ל נכנסו לציר פילדלפי המורחב. בתגובה חצתה דיביזיה ממוכנת מצרית את התעלה אל אזור B, בניגוד לנספח הצבאי. שיירות אספקה מצריות נעות מזרחה, וכוח המשקיפים הרב-לאומי (MFO) מדווח על הפרות.",
      en: "IDF forces have entered an expanded Philadelphi corridor. In response an Egyptian mechanized division crossed the canal into Zone B, contrary to the military annex. Egyptian supply convoys move east and the Multinational Force & Observers (MFO) reports violations.",
    },
    trigger: { he: "ממשל צבאי ופעילות בציר פילדלפי המורחב, או הידרדרות אזורית חריפה", en: "Military government and operations on an expanded Philadelphi corridor, or a sharp regional deterioration" },
    precedent: {
      years: "1979 · 1981 · 2005 · 2024",
      title: { he: "הנספח הצבאי להסכם השלום ואזורי A–D", en: "The treaty's military annex and Zones A–D" },
      body: {
        he: "נספח I להסכם 1979 מחלק את סיני לאזורים A, B, C ואת הצד הישראלי לאזור D, עם מגבלות כוחות: באזור A דיביזיה ממוכנת אחת לכל היותר, באזור C משטרה מצרית וכוח האו\"ם/ה-MFO בלבד. ה-MFO הוקם ב-1981. \"הסכם פילדלפי\" (2005) התיר פריסת משמר גבול מצרי מוגבל; בשנים 2011–2018 הסכימה ישראל לתגבור מצרי בסיני נגד דאע\"ש. במאי 2024 השתלט צה\"ל על ציר פילדלפי, ומצרים מחתה.",
        en: "Annex I of the 1979 treaty divides Sinai into Zones A, B and C and the Israeli side into Zone D, with force limits: at most one mechanized division in Zone A, only Egyptian police and UN/MFO forces in Zone C. The MFO was established in 1981. The 2005 Philadelphi agreement allowed a limited Egyptian border-guard deployment; in 2011–2018 Israel agreed to Egyptian reinforcements in Sinai against ISIS. In May 2024 the IDF took the Philadelphi corridor and Egypt protested.",
      },
      lesson: {
        he: "פריסות מעבר למגבלות הנספח טופלו לאורך השנים בהסכמה ובתיאום; פריסה חד-צדדית נתפסת כהפרה מהותית שמאיימת על עמוד התווך של ההסכם.",
        en: "Deployments beyond the annex limits have historically been handled by consent and coordination; a unilateral deployment is read as a material breach that threatens the treaty's core.",
      },
    },
    cooldownTurns: 3,
    options: [
      {
        id: "EGT_STOP_AND_MONITORS",
        label: { he: "עצירת הפעולה והסכמה לכוח פיקוח בינלאומי בגבול", en: "Halt the operation; accept an international monitoring force on the border" },
        objective: { he: "הורדת המתח והחזרת המצב לנספח הצבאי.", en: "De-escalate and restore the military annex arrangements." },
        pros: [
          { he: "שיקום היחסים עם קהיר", en: "Relations with Cairo restored" },
          { he: "מנגנון בינלאומי במקום חיכוך ישיר", en: "International mechanism instead of direct friction" },
        ],
        cons: [
          { he: "ויתור על שליטה ישירה בציר ההברחות", en: "Direct control of the smuggling route given up" },
          { he: "זעם באגף הימין", en: "Fury on the right flank" },
        ],
        deltas: { regionalRelations: 35, securityThreat: 10, coalitionStability: -30 },
        result: { he: "צה\"ל עצר את הפעולה; כוח פיקוח בינלאומי נפרס לאורך הגבול.", en: "The IDF halted; an international monitoring force deploys along the border." },
      },
      {
        id: "EGT_PREEMPTIVE_STRIKE",
        label: { he: "תקיפת מנע על שיירות האספקה המצריות בסיני", en: "Pre-emptive strike on Egyptian supply convoys in Sinai" },
        objective: { he: "מניעת התבססות מצרית באזורי B–C.", en: "Prevent an Egyptian build-up in Zones B–C." },
        pros: [
          { he: "פגיעה מיידית ביכולת התמרון המצרית", en: "Immediate blow to Egyptian manoeuvre capacity" },
        ],
        cons: [
          { he: "הסלמה למלחמה כוללת עם מצרים", en: "Escalation to all-out war with Egypt" },
          { he: "סנקציות ואמברגו חלקי", en: "Sanctions and a partial embargo" },
          { he: "סגירת תעלת סואץ ומצרי טיראן", en: "Suez and Tiran closed" },
        ],
        deltas: { securityThreat: 60, usMilitaryAid: -50, economicStability: -40 },
        result: { he: "חיל האוויר תקף שיירות מצריות בסיני; מצרים מגיבה בירי.", en: "The Air Force struck Egyptian convoys in Sinai; Egypt fires back." },
      },
      {
        id: "EGT_US_IMF_PRESSURE",
        label: { he: "ערבויות חירום מוושינגטון ולחץ כלכלי (קרן המטבע) על קהיר", en: "Emergency US guarantees and economic (IMF) pressure on Cairo" },
        objective: { he: "החזרת הכוחות המצריים בלי ירי.", en: "Get Egyptian forces pulled back without a shot." },
        pros: [
          { he: "חיזוק המטרייה האמריקאית", en: "US umbrella strengthened" },
          { he: "שימור ההסכם", en: "Treaty preserved" },
        ],
        cons: [
          { he: "תלות בהחלטות וושינגטון", en: "Dependence on Washington's decisions" },
          { he: "תנאים אמריקאיים לגבי המשך הפעולה", en: "US conditions on further operations" },
        ],
        deltas: { usMilitaryAid: 15, regionalRelations: 10, internationalLegitimacy: 15 },
        effects: { usConditionsTurns: 2 },
        result: { he: "וושינגטון העניקה ערבויות והפעילה לחץ; הכוחות המצריים נסוגים לאזור A.", en: "Washington issued guarantees and pressure; Egyptian forces pull back to Zone A." },
      },
    ],
  },

  IRAN_COMBINED_BARRAGE: {
    id: "IRAN_COMBINED_BARRAGE",
    title: { he: "מכת פתיחה משולבת של טילים וכטב\"מים מאיראן ועיראק", en: "Combined opening strike of missiles and drones from Iran and Iraq" },
    situation: {
      he: "גל ראשון של עשרות כטב\"מים וטילי שיוט שוגר מאיראן וממיליציות בעיראק, ואחריו מטח טילים בליסטיים. מטוסי קואליציה (ארה\"ב, בריטניה, ירדן) מיירטים מעל ירדן; חץ 3 מיירט מחוץ לאטמוספרה.",
      en: "A first wave of dozens of drones and cruise missiles launched from Iran and Iraqi militias, followed by a ballistic salvo. Coalition aircraft (US, UK, Jordan) intercept over Jordan; Arrow 3 engages outside the atmosphere.",
    },
    trigger: { he: "הסלמה אזורית (איום ביטחוני גבוה) — זעזוע מבצעי", en: "Regional escalation (high security threat) — operational shock" },
    precedent: {
      years: "אפריל 2024 · אוקטובר 2024",
      title: { he: "מתקפות הטילים האיראניות של 2024", en: "Iran's 2024 missile attacks" },
      body: {
        he: "ב-13–14 באפריל 2024 שיגרה איראן כ-170 כטב\"מים, למעלה מ-30 טילי שיוט ויותר מ-120 טילים בליסטיים; הרוב המכריע יורט בסיוע ארה\"ב, בריטניה, צרפת וירדן. ב-1 באוקטובר 2024 שוגרו כ-180 טילים בליסטיים. תגובות ישראל (19 באפריל, 26 באוקטובר) כוונו למערכי הגנה אווירית וייצור טילים, ונמנעו מתשתיות נפט וגרעין — בין היתר בעקבות לחץ אמריקאי.",
        en: "On 13–14 April 2024 Iran launched about 170 drones, 30+ cruise missiles and 120+ ballistic missiles; the vast majority were intercepted with help from the US, UK, France and Jordan. On 1 October 2024 about 180 ballistic missiles were fired. Israel's responses (19 April, 26 October) targeted air defenses and missile production and avoided oil and nuclear infrastructure, partly under US pressure.",
      },
      lesson: {
        he: "הגנה רב-שכבתית אפקטיבית תלויה בקואליציה אזורית ובתמיכה אמריקאית; היקף התגובה קובע אם המערכה נבלמת או מתרחבת.",
        en: "Effective layered defense depends on a regional coalition and US support; the scale of the response decides whether the exchange stops or widens.",
      },
    },
    cooldownTurns: 3,
    options: [
      {
        id: "IRN_WIDE_RETALIATION",
        label: { he: "תקיפת תגמול רחבה על תשתיות נפט וגרעין באיראן", en: "Wide retaliation on Iranian oil and nuclear infrastructure" },
        objective: { he: "פגיעה אסטרטגית ביכולות ובמקורות המימון של איראן.", en: "Strategic damage to Iran's capabilities and revenue." },
        pros: [
          { he: "פגיעה ממשית בתוכנית הגרעין", en: "Real damage to the nuclear program" },
          { he: "מסר הרתעתי חד", en: "Sharp deterrent message" },
        ],
        cons: [
          { he: "זינוק מחירי אנרגיה ופגיעה במשק", en: "Energy-price spike and economic damage" },
          { he: "מטחי תגובה נוספים ומעורבות חזבאללה", en: "Further salvos and Hezbollah involvement" },
          { he: "חיכוך חריף עם וושינגטון", en: "Sharp friction with Washington" },
        ],
        deltas: { securityThreat: 30, regionalRelations: -20, economicStability: -35, usMilitaryAid: -20 },
        result: { he: "חיל האוויר תקף מתקני נפט וגרעין באיראן; טהרן מאיימת בגל נוסף.", en: "The Air Force struck oil and nuclear sites in Iran; Tehran threatens another wave." },
      },
      {
        id: "IRN_DEFENSIVE_SURGICAL",
        label: { he: "יירוט הגנתי ותקיפה כירורגית של אתרי השיגור בלבד", en: "Defensive interception plus surgical strikes on launch sites only" },
        objective: { he: "בלימת המערכה תוך היענות ללחץ האמריקאי.", en: "Contain the exchange while heeding US pressure." },
        pros: [
          { he: "חיזוק הברית עם ארה\"ב", en: "Alliance with the US strengthened" },
          { he: "לגיטימציה בינלאומית להגנה עצמית", en: "International legitimacy for self-defense" },
        ],
        cons: [
          { he: "שחיקת הרתעה", en: "Deterrence erodes" },
          { he: "התשתית האיראנית נותרת שלמה", en: "Iran's infrastructure stays intact" },
        ],
        deltas: { usMilitaryAid: 25, internationalLegitimacy: 20, securityThreat: 10 },
        result: { he: "תקיפה ממוקדת על אתרי שיגור; ארה\"ב מתגברת את ההגנה האווירית.", en: "Focused strike on launch sites; the US reinforces air defense." },
      },
      {
        id: "IRN_REGIONAL_ALLIANCE",
        label: { he: "הפעלת הברית האזורית: מרחב אווירי ירדני ומפרצי לתקיפה משותפת", en: "Activate the regional alliance: Jordanian and Gulf airspace for a joint strike" },
        objective: { he: "הפיכת ההגנה המשותפת למסגרת התקפית אזורית.", en: "Turn joint defense into a regional offensive framework." },
        pros: [
          { he: "עומק אסטרטגי ומודיעין משותף", en: "Strategic depth and shared intelligence" },
          { he: "חיזוק הציר עם המפרץ", en: "Stronger axis with the Gulf" },
        ],
        cons: [
          { he: "חשיפת שותפים לתגובה איראנית", en: "Partners exposed to Iranian reprisal" },
          { he: "תלות בהסכמות פוליטיות שבירות", en: "Dependence on fragile political consent" },
        ],
        deltas: { regionalRelations: 15, securityThreat: -15, internationalLegitimacy: 10 },
        result: { he: "ירדן ומדינות המפרץ פתחו מרחב אווירי; תקיפה משותפת על מערכי השיגור.", en: "Jordan and the Gulf opened airspace; a joint strike hit the launch array." },
      },
    ],
  },

  TUNNEL_NETWORK_EXPOSED: {
    id: "TUNNEL_NETWORK_EXPOSED",
    title: { he: "חשיפת מערך מנהרות התקפיות והברחות חוצות-גבול", en: "Offensive tunnel network and cross-border smuggling exposed" },
    situation: {
      he: "בזמן אימות שלבי המתווה נחשף מערך מנהרות תחת ציר פילדלפי ורפיח, כולל פיר התקפי לכיוון כרם שלום. כוח השיטור האזורי לא דיווח על התשתית.",
      en: "While the framework's stages were being verified, a tunnel network was found under the Philadelphi corridor and Rafah, including an attack shaft toward Kerem Shalom. The regional policing force had not reported it.",
    },
    trigger: { he: "מעבר שלב במתווה האזורי המדורג", en: "A stage passed in the staged regional framework" },
    precedent: {
      years: "2005 · 2006 · 2014",
      title: { he: "רפיח אחרי ההתנתקות ומבצע \"צוק איתן\"", en: "Rafah after the disengagement and Operation Protective Edge" },
      body: {
        he: "אחרי ההתנתקות (2005) פיקחה משלחת האיחוד האירופי (EUBAM) על מעבר רפיח, אך פעילותה הושבתה בפועל לאחר יוני 2006 — חטיפת גלעד שליט דרך מנהרה ליד כרם שלום. מנהרות ההברחה תחת ציר פילדלפי התרבו. במבצע \"צוק איתן\" (יולי–אוגוסט 2014) איתר צה\"ל והשמיד 32 מנהרות, 14 מהן חוצות לשטח ישראל.",
        en: "After the 2005 disengagement the EU mission (EUBAM) monitored the Rafah crossing, but it was effectively suspended after June 2006 — the abduction of Gilad Shalit through a tunnel near Kerem Shalom. Smuggling tunnels under the Philadelphi corridor multiplied. In Operation Protective Edge (July–August 2014) the IDF located and destroyed 32 tunnels, 14 crossing into Israel.",
      },
      lesson: {
        he: "פיקוח בינלאומי בלי אכיפה ובלי יכולת חשיפה תת-קרקעית נשחק; מנגנון אימות חייב לכלול כלי תגובה כשהוא נכשל.",
        en: "International monitoring without enforcement or subterranean detection erodes; a verification mechanism needs a response tool for when it fails.",
      },
    },
    cooldownTurns: 3,
    options: [
      {
        id: "TUN_FREEZE_FUNDS",
        label: { he: "הקפאה מיידית של כספי השיקום והסכמי הביניים עד לחקירה מלאה", en: "Freeze reconstruction funds and interim agreements pending a full inquiry" },
        objective: { he: "הפעלת מנגנון הנסיגה של המתווה ומנוף כלכלי.", en: "Trigger the framework's withdrawal mechanism and economic leverage." },
        pros: [
          { he: "מסר ברור שההתקדמות מותנית", en: "Clear message that progress is conditional" },
          { he: "עצירת כספים שעלולים לזלוג לטרור", en: "Stops money that could leak to terror" },
        ],
        cons: [
          { he: "חיכוך עם שותפות המפרץ", en: "Friction with Gulf partners" },
          { he: "עיכוב השיקום ופגיעה כלכלית", en: "Reconstruction delayed; economic cost" },
        ],
        deltas: { securityThreat: -10, regionalRelations: -15, economicStability: -10 },
        effects: { freezesProcess: true },
        result: { he: "כספי השיקום הוקפאו; התהליך המדורג מושהה עד לסיום החקירה.", en: "Reconstruction funds frozen; the staged process is on hold pending the inquiry." },
      },
      {
        id: "TUN_ULTIMATUM_48H",
        label: { he: "אולטימטום של 48 שעות לכוח השיטור האזורי להשמיד את התשתית", en: "48-hour ultimatum to the regional policing force to destroy the network" },
        objective: { he: "בוחן אמינות לכוח המקומי — בלי כניסה ישראלית.", en: "A credibility test for the local force — without Israeli entry." },
        pros: [
          { he: "אם יצליח: הוכחה שהמנגנון עובד", en: "If it works: proof the mechanism functions" },
          { he: "אין פגיעה בהסכם", en: "No breach of the agreement" },
        ],
        cons: [
          { he: "סיכון של 40% לכישלון והתעצמות", en: "40% risk of failure and a build-up" },
          { he: "48 שעות של חשיפה", en: "48 hours of exposure" },
        ],
        deltas: {},
        gamble: {
          p: 0.6,
          success: { deltas: { securityThreat: -20 }, label: { he: "הצלחה (60%)", en: "Success (60%)" } },
          failure: { deltas: { securityThreat: 30 }, label: { he: "כישלון (40%)", en: "Failure (40%)" } },
        },
        result: { he: "פג תוקף האולטימטום.", en: "The ultimatum expired." },
      },
      {
        id: "TUN_SPECIAL_FORCES",
        label: { he: "כניסה נקודתית של כוחות מיוחדים תוך סיכון פגיעה בהסכם", en: "Targeted special-forces entry, risking the agreement" },
        objective: { he: "השמדה מיידית של התשתית בידי צה\"ל.", en: "Immediate destruction of the network by the IDF." },
        pros: [
          { he: "ודאות מבצעית", en: "Operational certainty" },
          { he: "גיבוי ציבורי ופוליטי", en: "Public and political backing" },
        ],
        cons: [
          { he: "ביקורת בינלאומית על הפרת ההסדר", en: "International criticism for breaching the arrangement" },
          { he: "פגיעה באמון השותפים", en: "Partner trust damaged" },
        ],
        deltas: { securityThreat: -15, internationalLegitimacy: -10, coalitionStability: 10 },
        result: { he: "כוחות מיוחדים השמידו את פירי המנהרות ברפיח.", en: "Special forces destroyed the tunnel shafts in Rafah." },
      },
    ],
  },
};

export function crisisOption(id: CrisisId, option: CrisisOptionId): CrisisOptionDef {
  const o = CRISIS_DEFS[id].options.find((x) => x.id === option);
  if (o === undefined) throw new Error(`option ${option} does not belong to crisis ${id}`);
  return o;
}

// ---------------------------------------------------------------------------
// triggers
// ---------------------------------------------------------------------------

export interface TriggerContext {
  prev: SimulationState;
  action: PolicyAction;
  /** metrics after this turn's decision */ metrics: SimulationMetrics;
  flags: StrategicFlags;
  /** checkpoints passed this turn */ passed: CheckpointKey[];
  adopting: boolean;
  /** brief rule 2 fired for the first time this turn */ paSecurityRuleFired: boolean;
}

export interface CrisisRisk {
  id: CrisisId;
  p: number;
  why: Bi;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Trigger probabilities (assumptions), in priority order. */
export const TRIGGER_RULES = {
  paCollapseOnRule: 1,
  paCollapsePerTurn: 0.35,
  tunnelsOnCheckpoint: 0.5,
  egyptOnAnnexationAdopted: 0.6,
  egyptOnAnnexationSustained: 0.2,
  egyptLowRelationsThreshold: 20,
  egyptLowRelations: 0.15,
  iranThreatFloor: 60,
};

export function crisisOnCooldown(prev: SimulationState, id: CrisisId): boolean {
  const last = prev.crisisLastTurn[id];
  return last !== undefined && prev.turn - last <= CRISIS_DEFS[id].cooldownTurns;
}

/** Every crisis that could open this turn, with its probability (for the preview and the draw). */
export function crisisRisks(ctx: TriggerContext): CrisisRisk[] {
  const out: CrisisRisk[] = [];
  const a = ctx.action;
  const paAlone = (a.gazaCivilianControl === "PALESTINIAN_AUTHORITY" || a.gazaCivilianControl === "NONE") && !a.allowIdfFreedomOfAction;

  if (a.track === "CENTER_LEFT_PA_RETURN" && paAlone) {
    out.push({
      id: "PA_SECURITY_COLLAPSE",
      p: ctx.paSecurityRuleFired ? TRIGGER_RULES.paCollapseOnRule : TRIGGER_RULES.paCollapsePerTurn,
      why: { he: "הרשות מחזיקה בביטחון ללא חופש פעולה לצה\"ל", en: "The PA holds security without IDF freedom of action" },
    });
  }
  if (a.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" && ctx.passed.length > 0) {
    out.push({ id: "TUNNEL_NETWORK_EXPOSED", p: TRIGGER_RULES.tunnelsOnCheckpoint, why: { he: "אימות שלב חושף תשתיות", en: "Stage verification exposes infrastructure" } });
  }
  const egyptP = Math.max(
    a.track === "CONSERVATIVE_RIGHT_ANNEXATION" && a.gazaCivilianControl === "MILITARY_GOVERNMENT"
      ? ctx.adopting ? TRIGGER_RULES.egyptOnAnnexationAdopted : TRIGGER_RULES.egyptOnAnnexationSustained
      : 0,
    ctx.metrics.regionalRelations <= TRIGGER_RULES.egyptLowRelationsThreshold ? TRIGGER_RULES.egyptLowRelations : 0,
  );
  if (egyptP > 0) {
    out.push({ id: "EGYPT_TREATY_BREACH", p: egyptP, why: { he: "פעילות צה\"ל בציר פילדלפי / יחסים אזוריים קורסים", en: "IDF operations on Philadelphi / collapsing regional relations" } });
  }
  if (ctx.metrics.securityThreat >= TRIGGER_RULES.iranThreatFloor) {
    out.push({
      id: "IRAN_COMBINED_BARRAGE",
      p: clamp01(0.1 + (ctx.metrics.securityThreat - TRIGGER_RULES.iranThreatFloor) / 80),
      why: { he: "הסלמה אזורית", en: "Regional escalation" },
    });
  }
  return out.filter((r) => r.p > 0 && !crisisOnCooldown(ctx.prev, r.id));
}

/** Resolve a gamble outcome; returns the combined deltas. */
export function optionDeltas(opt: CrisisOptionDef, branch: GambleBranch | null): Deltas {
  if (opt.gamble === undefined || branch === null) return opt.deltas;
  const extra = opt.gamble[branch].deltas;
  const out: Deltas = { ...opt.deltas };
  for (const k of Object.keys(extra) as Array<keyof SimulationMetrics>) out[k] = (out[k] ?? 0) + (extra[k] ?? 0);
  return out;
}
