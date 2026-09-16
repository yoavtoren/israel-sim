/** Strategic layer data: labels, track effects, coalition reactions,
 *  checkpoints, the crisis tree. Every numeric table carries `source`:
 *  "brief" = taken from the design brief, "assumption" = filled in here to
 *  make the brief's rules playable over 8 turns (the UI underlines those). */

import type {
  Bi, CheckpointKey, CoalitionType, GazaCivilianControl, MetricKey,
  OutcomeKind, PolicyTrack, SettlementPolicy, SimulationMetrics,
} from "./types";

export type Source = "brief" | "assumption";
export type Deltas = Partial<SimulationMetrics>;

export interface SourcedDeltas {
  deltas: Deltas;
  source: Source;
}

export const METRIC_LABELS: Record<MetricKey, Bi> = {
  securityThreat: { he: "איום ביטחוני", en: "Security threat" },
  internationalLegitimacy: { he: "לגיטימציה בינלאומית", en: "International legitimacy" },
  usMilitaryAid: { he: "סיוע צבאי אמריקאי", en: "US military aid" },
  economicStability: { he: "יציבות כלכלית", en: "Economic stability" },
  regionalRelations: { he: "יחסים אזוריים", en: "Regional relations" },
  coalitionStability: { he: "יציבות קואליציונית", en: "Coalition stability" },
  internalCohesion: { he: "לכידות פנימית", en: "Internal cohesion" },
};

export const COALITION_LABELS: Record<CoalitionType, Bi> = {
  RIGHT_WING_BLOC: { he: "גוש ימין-חרדים", en: "Right-wing / Haredi bloc" },
  BENNETT_LIEBERMAN_GOLAN_ABBAS: { he: "בנט–ליברמן–גולן–עבאס", en: "Bennett–Lieberman–Golan–Abbas" },
  CENTER_LEFT_BLOC: { he: "גוש מרכז-שמאל", en: "Center-left bloc" },
};

export const COALITION_TYPES: CoalitionType[] = ["RIGHT_WING_BLOC", "BENNETT_LIEBERMAN_GOLAN_ABBAS", "CENTER_LEFT_BLOC"];

/** Starting coalition stability differs by composition (assumption; brief default 50). */
export const INITIAL_COALITION_STABILITY: Record<CoalitionType, number> = {
  RIGHT_WING_BLOC: 60,
  BENNETT_LIEBERMAN_GOLAN_ABBAS: 50,
  CENTER_LEFT_BLOC: 45,
};

export const SETTLEMENT_LABELS: Record<SettlementPolicy, Bi> = {
  EXPAND: { he: "הרחבה", en: "Expand" },
  FREEZE_OUTSIDE_BLOCS: { he: "הקפאה מחוץ לגושים", en: "Freeze outside blocs" },
  FULL_FREEZE: { he: "הקפאה מלאה", en: "Full freeze" },
  EVACUATE_ALL: { he: "פינוי כל ההתנחלויות", en: "Evacuate all" },
};

export const GAZA_CONTROL_LABELS: Record<GazaCivilianControl, Bi> = {
  MILITARY_GOVERNMENT: { he: "ממשל צבאי", en: "Military government" },
  REGIONAL_COALITION: { he: "קואליציה אזורית", en: "Regional coalition" },
  PALESTINIAN_AUTHORITY: { he: "רשות פלסטינית", en: "Palestinian Authority" },
  NONE: { he: "ללא (ואקום)", en: "None (vacuum)" },
};

export interface TrackDef {
  label: Bi;
  spectrum: Bi;
  action: Bi;
  /** the brief's stated immediate consequences, shown on the card */ consequences: Bi[];
  /** default action parameters when the card is picked */
  defaults: {
    concedeConstructiveAmbiguity: boolean;
    allowIdfFreedomOfAction: boolean;
    settlementPolicy: SettlementPolicy;
    gazaCivilianControl: GazaCivilianControl;
  };
  /** one-time shock when the posture is adopted */ transition: SourcedDeltas;
  /** per-turn drift while the posture stays in force */ sustain: SourcedDeltas;
}

export const TRACK_DEFS: Record<PolicyTrack, TrackDef> = {
  RADICAL_RIGHT_DEPORTATION: {
    label: { he: "טרנספר כפוי / כוח ללא הבחנה", en: "Forced transfer / indiscriminate force" },
    spectrum: { he: "ימין רדיקלי", en: "Radical right" },
    action: {
      he: "עקירה בכוח של כ-2 מיליון עזתים מעבר לגבול, או הפעלת כוח צבאי ללא הבחנה באוכלוסייה אזרחית.",
      en: "Forcibly removing ~2 million Gazans across the border, or using force without distinguishing civilians.",
    },
    consequences: [
      { he: "אמברגו נשק אמריקאי מלא וביטול הווטו באו\"ם", en: "Full US arms embargo; UN veto withdrawn" },
      { he: "ביטול הסכמי השלום עם מצרים וירדן, מלחמה אזורית", en: "Peace treaties with Egypt & Jordan void; regional war" },
      { he: "סנקציות גלובליות וצווי מעצר בינלאומיים לשרשרת הפיקוד", en: "Global sanctions; international arrest warrants for the chain of command" },
      { he: "קריסת המשק ובידוד סחר", en: "Economic collapse and trade isolation" },
    ],
    defaults: {
      concedeConstructiveAmbiguity: false,
      allowIdfFreedomOfAction: true,
      settlementPolicy: "EXPAND",
      gazaCivilianControl: "NONE",
    },
    // The directive's transient shock while the crisis plays out; the crisis
    // option then resolves against the pre-directive metrics.
    transition: {
      source: "assumption",
      deltas: { securityThreat: 25, internationalLegitimacy: -35, usMilitaryAid: -30, regionalRelations: -35, economicStability: -15 },
    },
    sustain: { source: "assumption", deltas: {} },
  },
  CONSERVATIVE_RIGHT_ANNEXATION: {
    label: { he: "כיבוש מלא, סיפוח שטחי C ופירוק הרשות", en: "Full occupation, Area C annexation, PA dismantled" },
    spectrum: { he: "ימין שמרני", en: "Conservative right" },
    action: {
      he: "ממשל צבאי ישיר בעזה וביהודה ושומרון, שלילת כל ישות פלסטינית, הכשרת מאחזים ובנייה רציפה.",
      en: "Direct military government in Gaza and the West Bank, no Palestinian entity, outposts legalized, continuous building.",
    },
    consequences: [
      { he: "ירידה חלקית באיום בטווח הקצר, שחיקת גדודי מילואים בשיטור קבוע", en: "Short-term threat dip; reserve battalions worn down by permanent policing" },
      { he: "עלות של עשרות מיליארדי ₪ בשנה לניהול אזרחי", en: "Tens of billions ₪/yr to administer millions of residents" },
      { he: "חסימת הנורמליזציה עם סעודיה", en: "Saudi normalization blocked" },
      { he: "ממשלת ימין יציבה", en: "A right-wing government stays stable" },
    ],
    defaults: {
      concedeConstructiveAmbiguity: false,
      allowIdfFreedomOfAction: true,
      settlementPolicy: "EXPAND",
      gazaCivilianControl: "MILITARY_GOVERNMENT",
    },
    transition: {
      source: "brief",
      deltas: { securityThreat: -10, economicStability: -25, internationalLegitimacy: -20, regionalRelations: -30 },
    },
    // Reservist erosion; the civil-administration bill is the generic
    // israelPaysForGazaAdministration drag (−4/turn) on top of this.
    sustain: { source: "assumption", deltas: { securityThreat: -2, economicStability: -2, internalCohesion: -4, internationalLegitimacy: -3 } },
  },
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: {
    label: { he: "מודל אזורי מדורג ומותנה (נאמנות)", en: "Staged, conditional regional trusteeship" },
    spectrum: { he: "מרכז פרגמטי", en: "Pragmatic center" },
    action: {
      he: "העברת הניהול האזרחי והחינוך לקואליציה ערבית-מערבית, פירוז מלא, שליטה ישראלית בגבולות החיצוניים וחופש פעולה לצה\"ל. התקדמות מותנית בתוצאות.",
      en: "Civil administration and education handed to an Arab-Western coalition, full demilitarization, Israeli control of outer borders and IDF freedom of action. Progress conditional on results.",
    },
    consequences: [
      { he: "פתיחת ערוץ להסכם הגנה אמריקאי-סעודי ונורמליזציה", en: "Opens a channel to a US-Saudi defense pact and normalization" },
      { he: "סיוע אמריקאי מובטח", en: "US aid secured" },
      { he: "שיקום עזה במימון המפרץ", en: "Gaza reconstruction funded by the Gulf" },
      { he: "סיכון קואליציוני משני האגפים", en: "Coalition risk from both flanks" },
    ],
    defaults: {
      concedeConstructiveAmbiguity: true,
      allowIdfFreedomOfAction: true,
      settlementPolicy: "FREEZE_OUTSIDE_BLOCS",
      gazaCivilianControl: "REGIONAL_COALITION",
    },
    transition: { source: "brief", deltas: { economicStability: 15, usMilitaryAid: 10 } },
    sustain: { source: "assumption", deltas: { securityThreat: -2, usMilitaryAid: 1 } },
  },
  CENTER_LEFT_PA_RETURN: {
    label: { he: "החזרת רשות פלסטינית מחודשת והיפרדות", en: "Reformed PA returns; separation" },
    spectrum: { he: "מרכז-שמאל", en: "Center-left" },
    action: {
      he: "מסירת עזה לרשות הפלסטינית, הקפאת התנחלויות מחוץ לגושים, העברת חלק משטחי C לשליטה אזרחית פלסטינית, חתירה להסדר קבע של שתי מדינות.",
      en: "Gaza handed to the PA, settlements frozen outside the blocs, parts of Area C to Palestinian civil control, aiming at a two-state final status.",
    },
    consequences: [
      { he: "לגיטימציה בינלאומית ויחסים אזוריים במגמת עלייה חדה", en: "Legitimacy and regional relations climb sharply" },
      { he: "תלות במפלגות מרכז-שמאל ורע\"מ, פגיעות לכל אירוע ביטחוני", en: "Depends on center-left parties and Ra'am; fragile to any attack" },
      { he: "הסתברות גבוהה לעליית האיום אם הרשות לא מסכלת טרור לבדה", en: "Threat likely rises if the PA fails to foil terror on its own" },
    ],
    defaults: {
      concedeConstructiveAmbiguity: true,
      allowIdfFreedomOfAction: true,
      settlementPolicy: "FREEZE_OUTSIDE_BLOCS",
      gazaCivilianControl: "PALESTINIAN_AUTHORITY",
    },
    // Security consequence comes from the generic "PA security alone" rule
    // (+40) or +5 with IDF freedom — see reducer.
    transition: { source: "brief", deltas: { internationalLegitimacy: 25, regionalRelations: 20, economicStability: 5 } },
    sustain: { source: "assumption", deltas: { internationalLegitimacy: 2, regionalRelations: 2, securityThreat: 2 } },
  },
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: {
    label: { he: "נסיגה חד-צדדית מיידית לקווי 67", en: "Immediate unilateral withdrawal to 1967 lines" },
    spectrum: { he: "שמאל רדיקלי", en: "Radical left" },
    action: {
      he: "נסיגה מלאה לקווי 1967, פינוי כל ההתנחלויות ללא התניה בפירוז, סיום השליטה בציר פילדלפי ובבקעת הירדן.",
      en: "Full withdrawal to the 1967 lines, all settlements evacuated with no demilitarization condition, control of Philadelphi and the Jordan Valley ended.",
    },
    consequences: [
      { he: "לגיטימציה בינלאומית מקסימלית", en: "Maximal international legitimacy" },
      { he: "ואקום ביטחוני, הברחות נשק כבדות (כמו אחרי ההתנתקות)", en: "Security vacuum, heavy arms smuggling (as after the 2005 disengagement)" },
      { he: "סכנת מלחמת אזרחים בעקבות פינוי מאות אלפים", en: "Risk of civil strife from evacuating hundreds of thousands" },
      { he: "אובדן הרוב בכנסת", en: "Loss of the Knesset majority" },
    ],
    defaults: {
      concedeConstructiveAmbiguity: true,
      allowIdfFreedomOfAction: false,
      settlementPolicy: "EVACUATE_ALL",
      gazaCivilianControl: "NONE",
    },
    transition: { source: "brief", deltas: {} }, // absolute sets in the reducer
    sustain: { source: "assumption", deltas: { internalCohesion: -3 } },
  },
};

/** Coalition reaction when a track is ADOPTED (brief where it gives numbers). */
export const COALITION_REACTION: Record<CoalitionType, Record<PolicyTrack, SourcedDeltas>> = {
  RIGHT_WING_BLOC: {
    RADICAL_RIGHT_DEPORTATION: { source: "brief", deltas: { coalitionStability: 15 } },
    CONSERVATIVE_RIGHT_ANNEXATION: { source: "brief", deltas: { coalitionStability: 15 } },
    PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { source: "assumption", deltas: { coalitionStability: -30 } },
    CENTER_LEFT_PA_RETURN: { source: "assumption", deltas: { coalitionStability: -70 } },
    RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { source: "brief", deltas: {} }, // immediate fall, reducer
  },
  BENNETT_LIEBERMAN_GOLAN_ABBAS: {
    RADICAL_RIGHT_DEPORTATION: { source: "assumption", deltas: { coalitionStability: -60 } },
    CONSERVATIVE_RIGHT_ANNEXATION: { source: "brief", deltas: { coalitionStability: -60 } },
    PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { source: "brief", deltas: {} }, // −20 only with ambiguity, reducer
    CENTER_LEFT_PA_RETURN: { source: "brief", deltas: { coalitionStability: -40 } },
    RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { source: "brief", deltas: {} },
  },
  CENTER_LEFT_BLOC: {
    RADICAL_RIGHT_DEPORTATION: { source: "assumption", deltas: { coalitionStability: -90 } },
    CONSERVATIVE_RIGHT_ANNEXATION: { source: "assumption", deltas: { coalitionStability: -60 } },
    PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { source: "assumption", deltas: { coalitionStability: -5 } },
    CENTER_LEFT_PA_RETURN: { source: "assumption", deltas: { coalitionStability: 10 } },
    RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { source: "brief", deltas: { coalitionStability: -30 } },
  },
};

/** Per-turn coalition drift while a track stays in force (assumption). */
export const COALITION_SUSTAIN: Record<CoalitionType, Partial<Record<PolicyTrack, number>>> = {
  RIGHT_WING_BLOC: { CONSERVATIVE_RIGHT_ANNEXATION: 2, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: -3, CENTER_LEFT_PA_RETURN: -6 },
  BENNETT_LIEBERMAN_GOLAN_ABBAS: { CONSERVATIVE_RIGHT_ANNEXATION: -8, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: -2, CENTER_LEFT_PA_RETURN: -5 },
  CENTER_LEFT_BLOC: { CONSERVATIVE_RIGHT_ANNEXATION: -8, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: -1, CENTER_LEFT_PA_RETURN: 1 },
};

/** Settlement policy, applied when it CHANGES. Coalition numbers for the
 *  Bennett–Lieberman–Golan–Abbas government are the brief's ±50 rule. */
export const SETTLEMENT_EFFECTS: Record<SettlementPolicy, { general: SourcedDeltas; coalition: Record<CoalitionType, number>; coalitionSource: Source }> = {
  EXPAND: {
    general: { source: "assumption", deltas: { internationalLegitimacy: -5, regionalRelations: -5 } },
    coalition: { RIGHT_WING_BLOC: 5, BENNETT_LIEBERMAN_GOLAN_ABBAS: -50, CENTER_LEFT_BLOC: -40 },
    coalitionSource: "brief",
  },
  FREEZE_OUTSIDE_BLOCS: {
    general: { source: "assumption", deltas: {} },
    coalition: { RIGHT_WING_BLOC: -25, BENNETT_LIEBERMAN_GOLAN_ABBAS: 0, CENTER_LEFT_BLOC: 0 },
    coalitionSource: "assumption",
  },
  FULL_FREEZE: {
    general: { source: "assumption", deltas: { internationalLegitimacy: 5 } },
    coalition: { RIGHT_WING_BLOC: -40, BENNETT_LIEBERMAN_GOLAN_ABBAS: -50, CENTER_LEFT_BLOC: 5 },
    coalitionSource: "brief",
  },
  EVACUATE_ALL: {
    general: { source: "assumption", deltas: { internationalLegitimacy: 10, internalCohesion: -30 } },
    coalition: { RIGHT_WING_BLOC: -80, BENNETT_LIEBERMAN_GOLAN_ABBAS: -50, CENTER_LEFT_BLOC: -20 },
    coalitionSource: "brief",
  },
};

/** Generic engine rules (brief §3) — magnitudes. */
export const RULES = {
  /** PA/nobody holds security and the IDF may not act: Oslo / disengagement lesson */
  paSecurityAloneThreat: { value: 40, source: "brief" as Source },
  /** per turn while that condition persists */
  terrorGrowthPerTurn: { value: 8, source: "assumption" as Source },
  /** PA return with IDF freedom kept */
  paReturnWithIdfThreat: { value: 5, source: "assumption" as Source },
  /** Israel funds Gaza's civil administration (no Gulf money), per turn */
  israelPaysPerTurn: { value: -4, source: "assumption" as Source },
  /** trusteeship refused the political horizon: Israel pays instead of the Gulf */
  trusteeshipNoHorizonEconomy: { value: -10, source: "assumption" as Source },
  /** US conditions after a US-brokered exit: aid penalty for tracks 1–2 or expansion */
  usConditionsAidPenalty: { value: -30, source: "assumption" as Source },
  usConditionsTurns: 4,
  processFreezeTurns: 1,
};

export interface CheckpointDef {
  label: Bi;
  detail: Bi;
  /** why it is not passing yet */ blocker: Bi;
  reward: SourcedDeltas;
}

export const CHECKPOINT_DEFS: Record<CheckpointKey, CheckpointDef> = {
  demilitarizationVerified: {
    label: { he: "שלב 1 · פירוז ומעטפת", en: "Stage 1 · Demilitarization & envelope" },
    detail: {
      he: "השמדת כל המנהרות והרקטות, שליטה ישראלית מלאה בציר פילדלפי ובמרחב האווירי.",
      en: "All tunnels and rockets destroyed; full Israeli control of Philadelphi and the airspace.",
    },
    blocker: { he: "נדרש חופש פעולה מלא לצה\"ל", en: "Requires full IDF freedom of action" },
    reward: { source: "brief", deltas: { securityThreat: -15, regionalRelations: 5 } },
  },
  terrorFundingHalted: {
    label: { he: "שלב 2 · עצירת כספי טרור", en: "Stage 2 · Terror funding halted" },
    detail: {
      he: "ביטול מוחלט של תשלומי הרשות למשפחות מחבלים ופיקוח בנקאי בינלאומי.",
      en: "PA payments to attackers' families abolished; international banking oversight.",
    },
    blocker: { he: "נדרשים אופק מדיני (שותפות מפרץ) וסיוע אמריקאי ≥ 50", en: "Requires the political horizon (Gulf buy-in) and US aid ≥ 50" },
    reward: { source: "assumption", deltas: { securityThreat: -5, internationalLegitimacy: 5, regionalRelations: 5, coalitionStability: 5 } },
  },
  educationReformImplemented: {
    label: { he: "שלב 3 · רפורמת חינוך", en: "Stage 3 · Education reform" },
    detail: {
      he: "החלפת תוכניות הלימודים וספרי הלימוד תחת בקרה סעודית/אמירתית.",
      en: "Curricula and textbooks replaced under Saudi/Emirati supervision.",
    },
    blocker: { he: "נדרשים יחסים אזוריים ≥ 60", en: "Requires regional relations ≥ 60" },
    reward: { source: "assumption", deltas: { internationalLegitimacy: 5, regionalRelations: 5, coalitionStability: 5 } },
  },
  localPolicingFunctional: {
    label: { he: "שלב 4 · שיטור מקומי", en: "Stage 4 · Local policing" },
    detail: {
      he: "כוחות מקומיים מסכלים טרור בעצמם; אם נכשלים — צה\"ל פועל ללא פגיעה בהסכם.",
      en: "Local forces foil attacks themselves; if they fail, the IDF acts without breaching the agreement.",
    },
    blocker: { he: "נדרש איום ביטחוני ≤ 50", en: "Requires security threat ≤ 50" },
    reward: { source: "assumption", deltas: { securityThreat: -10, economicStability: 5, regionalRelations: 5, coalitionStability: 5 } },
  },
};

export const OUTCOME_REASONS: Record<Exclude<OutcomeKind, "STRATEGIC_COLLAPSE">, Bi> = {
  COALITION_COLLAPSE: {
    he: "הממשלה התפרקה: אובדן הרוב בכנסת והקדמת הבחירות בעקבות מחלוקת על המדיניות הביטחונית.",
    en: "The government fell: Knesset majority lost and early elections called over security policy.",
  },
  SECURITY_COLLAPSE: {
    he: "קריסה ביטחונית: גל טרור בלתי נשלט ומלחמה רב-זירתית בעקבות אובדן חופש הפעולה המבצעי.",
    en: "Security collapse: uncontrolled terror wave and multi-front war after operational freedom was lost.",
  },
  ECONOMIC_COLLAPSE: {
    he: "קריסה כלכלית: נטל הממשל הצבאי והסנקציות הבינלאומיות ריסקו את התקציב ואת דירוג האשראי.",
    en: "Economic collapse: the military-government burden and sanctions wrecked the budget and credit rating.",
  },
  CIVIL_CRISIS: {
    he: "משבר פנים: סרבנות המונית ועימותים אזרחיים שיתקו את יכולת המשילות.",
    en: "Internal crisis: mass refusal and civil confrontation paralysed governance.",
  },
  TERM_COMPLETED: {
    he: "סיום קדנציה: הממשלה שרדה 4 שנים מלאות תוך איזון בין ביטחון, דיפלומטיה ויציבות פנימית.",
    en: "Term completed: the government survived four full years balancing security, diplomacy and internal stability.",
  },
};

/** Failure thresholds (brief; cohesion floor is an addition). */
export const THRESHOLDS = {
  coalitionFloor: 0,
  securityCeiling: 90,
  economyFloor: 15,
  cohesionFloor: 10,
};

export const COHESION_THRESHOLD_SOURCE: Source = "assumption";

export function halfYearLabel(turn: number): Bi {
  const year = 2027 + Math.floor((turn - 1) / 2);
  const half = (turn - 1) % 2 === 0 ? 1 : 2;
  return { he: `מחצית ${half} · ${year}`, en: `H${half} ${year}` };
}
