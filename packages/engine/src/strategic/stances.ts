/** Foreign stances: how each relevant state or armed actor leans toward
 *  Israel, on a −100 (at war) … +100 (full ally) scale, derived from the
 *  strategic state. Pure, no randomness — recomputed from any state.
 *
 *  Every number here is an ASSUMPTION (a 2026 baseline plus sensitivities),
 *  not data. The score is transparent: `drivers` lists each contribution so
 *  the UI can show why a country moved. */

import type { Bi, CrisisOptionId, MetricKey, PolicyTrack, SimulationMetrics, SimulationState } from "./types";

export type ActorId =
  | "usa" | "eu" | "uk" | "russia" | "china" | "india"
  | "egypt" | "jordan" | "saudi" | "uae" | "bahrain" | "morocco" | "qatar" | "oman" | "kuwait"
  | "turkey" | "cyprus" | "greece" | "azerbaijan"
  | "iran" | "hezbollah" | "syria" | "iraq" | "houthis" | "gaza" | "palestinian_authority";

export type StanceTier = "ALLY" | "FRIENDLY" | "NEUTRAL" | "COLD" | "HOSTILE" | "ENEMY";

/** Strongest ally first. */
export const STANCE_TIERS: StanceTier[] = ["ALLY", "FRIENDLY", "NEUTRAL", "COLD", "HOSTILE", "ENEMY"];

export const TIER_LABELS: Record<StanceTier, Bi> = {
  ALLY: { he: "בעלת ברית", en: "Ally" },
  FRIENDLY: { he: "ידידותית", en: "Friendly" },
  NEUTRAL: { he: "ניטרלית / שלום קר", en: "Neutral / cold peace" },
  COLD: { he: "מתוחה", en: "Strained" },
  HOSTILE: { he: "עוינת", en: "Hostile" },
  ENEMY: { he: "אויב / במלחמה", en: "Enemy / at war" },
};

/** Lower bound of each tier's score band (ENEMY takes the rest). */
export const TIER_FLOOR: Record<Exclude<StanceTier, "ENEMY">, number> = {
  ALLY: 55,
  FRIENDLY: 20,
  NEUTRAL: -15,
  COLD: -45,
  HOSTILE: -80,
};

export function tierOf(score: number): StanceTier {
  if (score >= TIER_FLOOR.ALLY) return "ALLY";
  if (score >= TIER_FLOOR.FRIENDLY) return "FRIENDLY";
  if (score >= TIER_FLOOR.NEUTRAL) return "NEUTRAL";
  if (score >= TIER_FLOOR.COLD) return "COLD";
  if (score >= TIER_FLOOR.HOSTILE) return "HOSTILE";
  return "ENEMY";
}

export interface ActorDef {
  name: Bi;
  /** who is actually taking the stance, when it isn't the state itself */ entity?: Bi;
  /** Natural Earth outline key on the regional map; null = off-map power */ mapKey: string | null;
  /** 2026 status-quo score */ base: number;
  /** points per metric point away from the term's starting value */ weights: Partial<Record<MetricKey, number>>;
  /** shift while a policy track is in force */ tracks: Partial<Record<PolicyTrack, number>>;
  /** shift while Saudi normalization is open */ normalization?: number;
  /** shift while the Gulf funds Gaza's reconstruction */ gulfFunds?: number;
  /** shift per verified trusteeship checkpoint */ perCheckpoint?: number;
  /** shift while terror infrastructure is growing */ terrorGrowth?: number;
  /** shift while the Egyptian crisis is open (before the cabinet decides) */ crisisOpen?: number;
  /** shift after each crisis resolution option */ crisisOutcome?: Partial<Record<CrisisOptionId, number>>;
  /** one line on the 2026 baseline */ note: Bi;
}

export const ACTOR_IDS: ActorId[] = [
  "usa", "eu", "uk", "russia", "china", "india",
  "egypt", "jordan", "saudi", "uae", "bahrain", "morocco", "qatar", "oman", "kuwait",
  "turkey", "cyprus", "greece", "azerbaijan",
  "iran", "hezbollah", "syria", "iraq", "houthis", "gaza", "palestinian_authority",
];

export const ACTOR_DEFS: Record<ActorId, ActorDef> = {
  usa: {
    name: { he: "ארצות הברית", en: "United States" }, mapKey: null, base: 78,
    weights: { usMilitaryAid: 0.9, internationalLegitimacy: 0.15 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -35, CONSERVATIVE_RIGHT_ANNEXATION: -10, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8 },
    normalization: 8, crisisOutcome: { D_US_MEDIATION: -5, B_AIR_RETALIATION: -30, C_GROUND_INVASION_SINAI: -40 },
    note: { he: "בעלת הברית המרכזית: סיוע צבאי, וטו במועצת הביטחון.", en: "Principal ally: military aid, Security Council veto." },
  },
  eu: {
    name: { he: "האיחוד האירופי", en: "European Union" }, mapKey: null, base: 0,
    weights: { internationalLegitimacy: 0.9 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -45, CONSERVATIVE_RIGHT_ANNEXATION: -20, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8, CENTER_LEFT_PA_RETURN: 15, RADICAL_LEFT_UNILATERAL_WITHDRAWAL: 15 },
    crisisOutcome: { B_AIR_RETALIATION: -25, C_GROUND_INVASION_SINAI: -35 },
    note: { he: "שותפת סחר עיקרית, ביקורתית מאוד על המלחמה וההתנחלויות.", en: "Main trade partner, sharply critical of the war and settlements." },
  },
  uk: {
    name: { he: "בריטניה", en: "United Kingdom" }, mapKey: null, base: 25,
    weights: { internationalLegitimacy: 0.6, usMilitaryAid: 0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -45, CONSERVATIVE_RIGHT_ANNEXATION: -20, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8, CENTER_LEFT_PA_RETURN: 12, RADICAL_LEFT_UNILATERAL_WITHDRAWAL: 10 },
    crisisOutcome: { B_AIR_RETALIATION: -25, C_GROUND_INVASION_SINAI: -35 },
    note: { he: "שותפה ביטחונית, הכירה במדינה פלסטינית.", en: "Security partner; recognized a Palestinian state." },
  },
  russia: {
    name: { he: "רוסיה", en: "Russia" }, mapKey: "russia", base: -25,
    weights: { usMilitaryAid: -0.2, regionalRelations: -0.1 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -15, CONSERVATIVE_RIGHT_ANNEXATION: -5 },
    note: { he: "מתואמת עם איראן; ערוץ תיאום מוגבל מול צה\"ל.", en: "Aligned with Iran; limited deconfliction channel with the IDF." },
  },
  china: {
    name: { he: "סין", en: "China" }, mapKey: null, base: -10,
    weights: { internationalLegitimacy: 0.3, economicStability: 0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -30, CONSERVATIVE_RIGHT_ANNEXATION: -10 },
    note: { he: "קשרי סחר, תמיכה דיפלומטית בצד הפלסטיני.", en: "Trade ties; diplomatic backing for the Palestinian side." },
  },
  india: {
    name: { he: "הודו", en: "India" }, mapKey: null, base: 55,
    weights: { regionalRelations: 0.2, economicStability: 0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -30 }, normalization: 5,
    note: { he: "שותפה ביטחונית וטכנולוגית; מעוניינת במסדרון IMEC.", en: "Defense and tech partner; invested in the IMEC corridor." },
  },
  egypt: {
    name: { he: "מצרים", en: "Egypt" }, mapKey: "egypt", base: 0,
    weights: { regionalRelations: 0.7 },
    tracks: { CONSERVATIVE_RIGHT_ANNEXATION: -15, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8, CENTER_LEFT_PA_RETURN: 12 },
    crisisOpen: -110, crisisOutcome: { A_CANCEL_TRANSFER: -25, B_AIR_RETALIATION: -110, C_GROUND_INVASION_SINAI: -130, D_US_MEDIATION: -30 },
    note: { he: "שלום קר: תיאום ביטחוני בסיני, חשש מדחיקת עזתים לשטחה.", en: "Cold peace: Sinai security coordination, fear of Gazans pushed onto its soil." },
  },
  jordan: {
    name: { he: "ירדן", en: "Jordan" }, mapKey: "jordan", base: -5,
    weights: { regionalRelations: 0.7, internationalLegitimacy: 0.15 },
    tracks: { CONSERVATIVE_RIGHT_ANNEXATION: -35, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8, CENTER_LEFT_PA_RETURN: 20, RADICAL_LEFT_UNILATERAL_WITHDRAWAL: 15 },
    crisisOpen: -60, crisisOutcome: { A_CANCEL_TRANSFER: -15, B_AIR_RETALIATION: -80, C_GROUND_INVASION_SINAI: -90, D_US_MEDIATION: -15 },
    note: { he: "שלום קר; סיפוח ביהודה ושומרון הוא קו אדום עבור הממלכה.", en: "Cold peace; West Bank annexation is a red line for the kingdom." },
  },
  saudi: {
    name: { he: "ערב הסעודית", en: "Saudi Arabia" }, mapKey: "saudi_arabia", base: -5,
    weights: { regionalRelations: 0.6 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -40, CONSERVATIVE_RIGHT_ANNEXATION: -20, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 5, CENTER_LEFT_PA_RETURN: 5 },
    normalization: 30, gulfFunds: 5, perCheckpoint: 4,
    note: { he: "אין יחסים רשמיים; נורמליזציה מותנית באופק מדיני.", en: "No formal ties; normalization conditioned on a political horizon." },
  },
  uae: {
    name: { he: "איחוד האמירויות", en: "UAE" }, mapKey: "united_arab_emirates", base: 40,
    weights: { regionalRelations: 0.6 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -50, CONSERVATIVE_RIGHT_ANNEXATION: -25, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 10 },
    normalization: 5, gulfFunds: 10, perCheckpoint: 3,
    note: { he: "הסכמי אברהם; מתנגדת לסיפוח.", en: "Abraham Accords; opposes annexation." },
  },
  bahrain: {
    name: { he: "בחריין", en: "Bahrain" }, mapKey: "bahrain", base: 30,
    weights: { regionalRelations: 0.5 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -50, CONSERVATIVE_RIGHT_ANNEXATION: -20, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8 },
    normalization: 8, gulfFunds: 5,
    note: { he: "הסכמי אברהם, צמודה לקו הסעודי.", en: "Abraham Accords; follows the Saudi line." },
  },
  morocco: {
    name: { he: "מרוקו", en: "Morocco" }, mapKey: null, base: 25,
    weights: { regionalRelations: 0.4 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -45, CONSERVATIVE_RIGHT_ANNEXATION: -15, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 5 },
    normalization: 5,
    note: { he: "הסכמי אברהם, שיתוף פעולה ביטחוני.", en: "Abraham Accords; security cooperation." },
  },
  qatar: {
    name: { he: "קטאר", en: "Qatar" }, mapKey: "qatar", base: -35,
    weights: { regionalRelations: 0.4 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -35, CONSERVATIVE_RIGHT_ANNEXATION: -10, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 8, CENTER_LEFT_PA_RETURN: 10 },
    gulfFunds: 8,
    note: { he: "מתווכת; אירחה את הנהגת חמאס.", en: "Mediator; has hosted Hamas's leadership." },
  },
  oman: {
    name: { he: "עומאן", en: "Oman" }, mapKey: "oman", base: 0,
    weights: { regionalRelations: 0.4 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -35, CONSERVATIVE_RIGHT_ANNEXATION: -10 },
    normalization: 8,
    note: { he: "ניטרלית, ערוץ לאיראן.", en: "Neutral; a channel to Iran." },
  },
  kuwait: {
    name: { he: "כווית", en: "Kuwait" }, mapKey: "kuwait", base: -35,
    weights: { regionalRelations: 0.35 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -35, CONSERVATIVE_RIGHT_ANNEXATION: -10 },
    normalization: 6,
    note: { he: "ללא יחסים; דעת קהל עוינת.", en: "No relations; hostile public opinion." },
  },
  turkey: {
    name: { he: "טורקיה", en: "Turkey" }, mapKey: "turkey", base: -55,
    weights: { internationalLegitimacy: 0.3, regionalRelations: 0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -30, CONSERVATIVE_RIGHT_ANNEXATION: -10, CENTER_LEFT_PA_RETURN: 10 },
    crisisOutcome: { B_AIR_RETALIATION: -20, C_GROUND_INVASION_SINAI: -25 },
    note: { he: "חרם סחר ותמיכה בחמאס; מתחרה על השפעה בסוריה.", en: "Trade boycott and support for Hamas; competing for influence in Syria." },
  },
  cyprus: {
    name: { he: "קפריסין", en: "Cyprus" }, mapKey: "cyprus", base: 60,
    weights: { internationalLegitimacy: 0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -35 },
    note: { he: "ברית אנרגיה וביטחון במזרח הים התיכון.", en: "Energy and security partner in the eastern Mediterranean." },
  },
  greece: {
    name: { he: "יוון", en: "Greece" }, mapKey: "greece", base: 55,
    weights: { internationalLegitimacy: 0.3 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -40, CONSERVATIVE_RIGHT_ANNEXATION: -8 },
    note: { he: "שותפה ביטחונית ואנרגטית.", en: "Defense and energy partner." },
  },
  azerbaijan: {
    name: { he: "אזרבייג'ן", en: "Azerbaijan" }, mapKey: "azerbaijan", base: 60,
    weights: { usMilitaryAid: 0.1 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -20 },
    note: { he: "ספקית נפט ולקוחת נשק; גבול עם איראן.", en: "Oil supplier and arms client on Iran's border." },
  },
  iran: {
    name: { he: "איראן", en: "Iran" }, mapKey: "iran", base: -95,
    weights: { securityThreat: -0.1 },
    tracks: {},
    normalization: -5,
    note: { he: "אויבת מוצהרת; מפעילה את 'ציר ההתנגדות'.", en: "Declared enemy; runs the \"Axis of Resistance\"." },
  },
  hezbollah: {
    name: { he: "לבנון", en: "Lebanon" }, entity: { he: "חזבאללה", en: "Hezbollah" }, mapKey: "lebanon", base: -75,
    weights: { securityThreat: -0.35 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -10 },
    crisisOutcome: { B_AIR_RETALIATION: -20, C_GROUND_INVASION_SINAI: -20 },
    note: { he: "חזבאללה מוחלש אך חמוש; מדינת לבנון חלשה.", en: "Hezbollah weakened but armed; a weak Lebanese state." },
  },
  syria: {
    name: { he: "סוריה", en: "Syria" }, mapKey: "syria", base: -40,
    weights: { regionalRelations: 0.3, securityThreat: -0.15 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -20, CONSERVATIVE_RIGHT_ANNEXATION: -8 },
    normalization: 8,
    note: { he: "משטר חדש אחרי אסד; מגעים זהירים, צה\"ל בחיץ.", en: "New post-Assad regime; cautious contacts, IDF in the buffer zone." },
  },
  iraq: {
    name: { he: "עיראק", en: "Iraq" }, entity: { he: "מיליציות פרו-איראניות", en: "Pro-Iran militias" }, mapKey: "iraq", base: -70,
    weights: { securityThreat: -0.2 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -15 },
    crisisOutcome: { B_AIR_RETALIATION: -15, C_GROUND_INVASION_SINAI: -15 },
    note: { he: "מיליציות שיעיות משגרות כטב\"מים; ממשלה בהשפעה איראנית.", en: "Shiite militias launch drones; a government under Iranian sway." },
  },
  houthis: {
    name: { he: "תימן", en: "Yemen" }, entity: { he: "החות'ים", en: "Houthis" }, mapKey: "yemen", base: -92,
    weights: { securityThreat: -0.1 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -10 },
    note: { he: "ירי טילים וכטב\"מים, חסימת ים סוף.", en: "Missile and drone fire; Red Sea blockade." },
  },
  gaza: {
    name: { he: "רצועת עזה", en: "Gaza Strip" }, entity: { he: "חמאס", en: "Hamas" }, mapKey: "gaza", base: -100,
    weights: {},
    tracks: { PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 25, CENTER_LEFT_PA_RETURN: 30, RADICAL_LEFT_UNILATERAL_WITHDRAWAL: 5 },
    perCheckpoint: 12, terrorGrowth: -20,
    note: { he: "שרידי חמאס; השליטה האזרחית תלויה במדיניות.", en: "Hamas remnants; civil control depends on policy." },
  },
  palestinian_authority: {
    name: { he: "יהודה ושומרון", en: "West Bank" }, entity: { he: "הרשות הפלסטינית", en: "Palestinian Authority" }, mapKey: "west_bank", base: -35,
    weights: { internationalLegitimacy: 0.15 },
    tracks: { RADICAL_RIGHT_DEPORTATION: -40, CONSERVATIVE_RIGHT_ANNEXATION: -45, PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: 10, CENTER_LEFT_PA_RETURN: 40, RADICAL_LEFT_UNILATERAL_WITHDRAWAL: 30 },
    perCheckpoint: 5, terrorGrowth: -15,
    note: { he: "תיאום ביטחוני חלקי; תשלומים למשפחות מחבלים.", en: "Partial security coordination; payments to attackers' families." },
  },
};

export interface StanceDriver {
  label: Bi;
  delta: number;
}

export interface ActorStance {
  id: ActorId;
  score: number;
  tier: StanceTier;
  drivers: StanceDriver[];
}

const METRIC_SHORT: Record<MetricKey, Bi> = {
  securityThreat: { he: "רמת האיום", en: "Threat level" },
  internationalLegitimacy: { he: "לגיטימציה בינלאומית", en: "International legitimacy" },
  usMilitaryAid: { he: "סיוע אמריקאי", en: "US aid" },
  economicStability: { he: "יציבות כלכלית", en: "Economic stability" },
  regionalRelations: { he: "יחסים אזוריים", en: "Regional relations" },
  coalitionStability: { he: "יציבות קואליציונית", en: "Coalition stability" },
  internalCohesion: { he: "לכידות פנימית", en: "Internal cohesion" },
};

const TRACK_SHORT: Record<PolicyTrack, Bi> = {
  RADICAL_RIGHT_DEPORTATION: { he: "הנחיית טרנספר", en: "Transfer directive" },
  CONSERVATIVE_RIGHT_ANNEXATION: { he: "ממשל צבאי וסיפוח", en: "Military government & annexation" },
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { he: "מתווה נאמנות אזורי", en: "Regional trusteeship" },
  CENTER_LEFT_PA_RETURN: { he: "החזרת הרשות", en: "PA return" },
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { he: "נסיגה חד-צדדית", en: "Unilateral withdrawal" },
};

const CRISIS_SHORT: Record<CrisisOptionId, Bi> = {
  A_CANCEL_TRANSFER: { he: "ביטול הטרנספר תחת אש", en: "Transfer cancelled under fire" },
  B_AIR_RETALIATION: { he: "תקיפה אווירית במצרים", en: "Air strikes in Egypt" },
  C_GROUND_INVASION_SINAI: { he: "פלישה לסיני", en: "Sinai invasion" },
  D_US_MEDIATION: { he: "הפסקת אש בתיווך ארה\"ב", en: "US-brokered ceasefire" },
};

const round = (v: number): number => Math.round(v);

/** The stance of one actor in a given state. */
export function actorStance(id: ActorId, state: SimulationState): ActorStance {
  const def = ACTOR_DEFS[id];
  const drivers: StanceDriver[] = [{ label: { he: "בסיס 2026", en: "2026 baseline" }, delta: def.base }];
  const add = (label: Bi, delta: number | undefined): void => {
    if (delta !== undefined && round(delta) !== 0) drivers.push({ label, delta: round(delta) });
  };

  const m = state.metrics;
  const start: SimulationMetrics = state.metricsHistory[0] ?? m;
  for (const [k, w] of Object.entries(def.weights) as Array<[MetricKey, number]>) {
    add(METRIC_SHORT[k], w * (m[k] - start[k]));
  }

  const track = state.pendingCrisis !== null ? state.pendingCrisis.action.track : state.activeTrack;
  if (track !== null) add(TRACK_SHORT[track], def.tracks[track]);

  const f = state.flags;
  if (f.saudiNormalization) add({ he: "ערוץ נורמליזציה", en: "Normalization channel" }, def.normalization);
  if (f.gulfFundsReconstruction) add({ he: "מימון מפרצי לעזה", en: "Gulf funding for Gaza" }, def.gulfFunds);
  if (f.terrorInfrastructureGrowth) add({ he: "התחמשות טרור", en: "Terror rearmament" }, def.terrorGrowth);
  if (def.perCheckpoint !== undefined) {
    const passed = Object.values(state.checkpoints).filter(Boolean).length;
    if (passed > 0) add({ he: `${passed} נקודות בדיקה אומתו`, en: `${passed} checkpoints verified` }, def.perCheckpoint * passed);
  }

  if (state.pendingCrisis !== null) {
    add({ he: "משבר פתוח מול מצרים", en: "Open crisis with Egypt" }, def.crisisOpen);
  } else {
    const option = lastCrisisOption(state);
    if (option !== null) add(CRISIS_SHORT[option], def.crisisOutcome?.[option]);
  }

  const raw = drivers.reduce((s, d) => s + d.delta, 0);
  const score = Math.max(-100, Math.min(100, raw));
  return { id, score, tier: tierOf(score), drivers };
}

/** The most recent crisis option still coloring relations (the term's last one). */
function lastCrisisOption(state: SimulationState): CrisisOptionId | null {
  for (let i = state.turns.length - 1; i >= 0; i--) {
    const o = state.turns[i].crisisOption;
    if (o !== null) return o;
  }
  return null;
}

export function computeStances(state: SimulationState): Record<ActorId, ActorStance> {
  const out = {} as Record<ActorId, ActorStance>;
  for (const id of ACTOR_IDS) out[id] = actorStance(id, state);
  return out;
}
