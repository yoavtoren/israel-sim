/** Knesset parties for the Prime Minister campaign and the coalition rules.
 *
 *  Two seat rosters, both summing to exactly 120:
 *  - "polls" (default): the average of the ten polls published 9–15 September
 *    2026 (Kan 11, Maariv, Zman Yisrael, Channel 16, Channel 13, i24NEWS,
 *    Channel 14, Walla, Kan 11, Channel 12 — as tabulated on Wikipedia's
 *    "Opinion polling for the 2026 Israeli legislative election"), rounded by
 *    largest remainder. Ofer Winter's list clears the threshold in 8 of the 10
 *    polls and is shown at the 4-seat minimum.
 *  - "election_2022": as elected in November 2022 (the Religious Zionism joint
 *    list shown as its three factions).
 *
 *  Security positions, refusals and friction are ASSUMPTIONS drawn from the
 *  parties' public positions — a game abstraction, not a statement of what any
 *  party would actually do. */

import type { Bi, CoalitionType, PolicyTrack } from "../types";

export type PartyId =
  | "yashar" | "likud" | "together" | "democrats" | "yisrael_beiteinu" | "shas" | "utj" | "otzma_yehudit"
  | "joint_list" | "religious_zionism" | "raam" | "amcha_yisrael"
  | "national_unity" | "yesh_atid" | "hadash_taal" | "balad" | "noam";

export type SeatRoster = "polls" | "election_2022";
export const SEAT_ROSTERS: SeatRoster[] = ["polls", "election_2022"];

export const ROSTER_LABELS: Record<SeatRoster, Bi> = {
  polls: { he: "סקרים עדכניים", en: "Current polls" },
  election_2022: { he: "בחירות 2022", en: "2022 election" },
};

export const ROSTER_NOTES: Record<SeatRoster, Bi> = {
  polls: {
    he: "ממוצע 10 הסקרים האחרונים, 9–15 בספטמבר 2026 · כחול לבן והמילואימניקים מתחת לאחוז החסימה",
    en: "Average of the 10 latest polls, 9–15 September 2026 · Blue and White and the Reservists below the threshold",
  },
  election_2022: { he: "תוצאות בחירות נובמבר 2022", en: "November 2022 election results" },
};

export const SEATS: Record<SeatRoster, Record<PartyId, number>> = {
  polls: {
    yashar: 24, likud: 22, together: 13, democrats: 9, yisrael_beiteinu: 8, shas: 8, utj: 8, otzma_yehudit: 7,
    joint_list: 7, religious_zionism: 5, raam: 5, amcha_yisrael: 4,
    national_unity: 0, yesh_atid: 0, hadash_taal: 0, balad: 0, noam: 0,
  },
  election_2022: {
    likud: 32, yesh_atid: 24, national_unity: 12, shas: 11, religious_zionism: 7, utj: 7,
    otzma_yehudit: 6, yisrael_beiteinu: 6, raam: 5, hadash_taal: 5, democrats: 4, noam: 1, balad: 0,
    yashar: 0, together: 0, joint_list: 0, amcha_yisrael: 0,
  },
};

export function partySeats(roster: SeatRoster, p: PartyId): number {
  return SEATS[roster][p];
}

export const PARTY_IDS: PartyId[] = [
  "yashar", "likud", "together", "democrats", "yisrael_beiteinu", "shas", "utj", "otzma_yehudit",
  "joint_list", "religious_zionism", "raam", "amcha_yisrael",
  "national_unity", "yesh_atid", "hadash_taal", "balad", "noam",
];

/** Parties with seats in a roster, largest first. */
export function rosterParties(roster: SeatRoster): PartyId[] {
  return PARTY_IDS.filter((p) => SEATS[roster][p] > 0).sort((a, b) => SEATS[roster][b] - SEATS[roster][a]);
}

/** Reaction groups: dilemmas address groups, not individual parties. */
export type PartyTag = "far_right" | "right" | "haredi" | "center" | "left" | "arab";

export interface PartyDef {
  id: PartyId;
  name: Bi;
  tag: PartyTag;
  /** security axis: −2 dovish … +2 hawkish */ hawk: number;
  color: string;
  blurb: Bi;
  /** will not sit in a government with these parties */ refuses: PartyId[];
  /** can sit together, with friction (stability penalty) */ friction: PartyId[];
  /** can sit together only under heavy strain (triple penalty) */ deepFriction: PartyId[];
}

export const PARTIES: Record<PartyId, PartyDef> = {
  yashar: {
    id: "yashar", name: { he: "ישר!", en: "Yashar" }, tag: "center", hawk: 0.6, color: "#0E7C86",
    blurb: { he: "מרכז ממלכתי-ביטחוני בראשות גדי איזנקוט, עם חילי טרופר.", en: "Statist security-minded center led by Gadi Eisenkot, with Hili Tropper." },
    refuses: ["otzma_yehudit", "amcha_yisrael"], friction: ["likud", "shas", "utj"], deepFriction: ["joint_list", "religious_zionism"],
  },
  together: {
    id: "together", name: { he: "ביחד", en: "Together" }, tag: "right", hawk: 1.0, color: "#1F4E9C",
    blurb: { he: "ימין-מרכז: הרשימה המשותפת של נפתלי בנט ויאיר לפיד.", en: "Center-right: the joint list of Naftali Bennett and Yair Lapid." },
    refuses: ["otzma_yehudit"], friction: ["likud", "shas", "utj", "amcha_yisrael"], deepFriction: ["joint_list", "raam"],
  },
  joint_list: {
    id: "joint_list", name: { he: "הרשימה המשותפת", en: "Joint List" }, tag: "arab", hawk: -2, color: "#B83B5E",
    blurb: { he: "חד\"ש, תע\"ל ובל\"ד שחזרו לרוץ יחד (אוגוסט 2026).", en: "Hadash, Ta'al and Balad running together again (August 2026)." },
    refuses: ["likud", "religious_zionism", "otzma_yehudit", "noam", "shas", "utj", "amcha_yisrael"], friction: ["national_unity", "democrats"], deepFriction: ["yisrael_beiteinu"],
  },
  amcha_yisrael: {
    id: "amcha_yisrael", name: { he: "עמך ישראל", en: "Amcha Yisrael" }, tag: "far_right", hawk: 1.7, color: "#7A5C2E",
    blurb: { he: "ימין דתי-לאומי בראשות האלוף (מיל') עופר וינטר.", en: "Religious-nationalist right led by Maj. Gen. (res.) Ofer Winter." },
    refuses: ["raam", "hadash_taal", "balad", "democrats"], friction: ["yisrael_beiteinu"], deepFriction: [],
  },
  likud: {
    id: "likud", name: { he: "הליכוד", en: "Likud" }, tag: "right", hawk: 1.2, color: "#3B82D0",
    blurb: { he: "ימין לאומי-ליברלי, מפלגת השלטון הגדולה.", en: "National-liberal right; the largest ruling party." },
    refuses: ["hadash_taal", "balad"], friction: ["yesh_atid", "democrats"], deepFriction: ["raam"],
  },
  national_unity: {
    id: "national_unity", name: { he: "המחנה הממלכתי", en: "National Unity" }, tag: "center", hawk: 0.6, color: "#4F6FB8",
    blurb: { he: "מרכז-ימין ביטחוני.", en: "Security-minded center-right." },
    refuses: ["noam", "balad"], friction: ["religious_zionism", "hadash_taal"], deepFriction: ["otzma_yehudit"],
  },
  yisrael_beiteinu: {
    id: "yisrael_beiteinu", name: { he: "ישראל ביתנו", en: "Yisrael Beiteinu" }, tag: "right", hawk: 1.3, color: "#6FA8DC",
    blurb: { he: "ימין חילוני, נגד כפייה דתית.", en: "Secular right; against religious coercion." },
    refuses: ["balad"], friction: ["raam"], deepFriction: ["shas", "utj", "hadash_taal"],
  },
  yesh_atid: {
    id: "yesh_atid", name: { he: "יש עתיד", en: "Yesh Atid" }, tag: "center", hawk: 0, color: "#2F9FD8",
    blurb: { he: "מרכז ליברלי-חילוני.", en: "Liberal secular center." },
    refuses: ["otzma_yehudit", "noam", "balad"], friction: ["shas", "utj", "likud"], deepFriction: ["religious_zionism"],
  },
  democrats: {
    id: "democrats", name: { he: "הדמוקרטים", en: "The Democrats" }, tag: "left", hawk: -1.4, color: "#E4572E",
    blurb: { he: "איחוד העבודה ומרצ בראשות יאיר גולן: שמאל ציוני.", en: "Labor and Meretz merged, led by Yair Golan: the Zionist left." },
    refuses: ["otzma_yehudit", "religious_zionism", "noam", "balad"], friction: ["shas", "utj", "yisrael_beiteinu"], deepFriction: ["likud"],
  },
  shas: {
    id: "shas", name: { he: "ש\"ס", en: "Shas" }, tag: "haredi", hawk: 0.7, color: "#1F2F57",
    blurb: { he: "חרדית-ספרדית, דגש חברתי ודתי.", en: "Sephardi Haredi; social and religious focus." },
    refuses: ["hadash_taal", "balad"], friction: ["yesh_atid", "democrats"], deepFriction: ["yisrael_beiteinu"],
  },
  otzma_yehudit: {
    id: "otzma_yehudit", name: { he: "עוצמה יהודית", en: "Otzma Yehudit" }, tag: "far_right", hawk: 2, color: "#C0392B",
    blurb: { he: "ימין קיצוני.", en: "Far right." },
    refuses: ["raam", "hadash_taal", "balad", "democrats", "yesh_atid"], friction: [], deepFriction: ["national_unity"],
  },
  utj: {
    id: "utj", name: { he: "יהדות התורה", en: "United Torah Judaism" }, tag: "haredi", hawk: 0.5, color: "#5C6B7A",
    blurb: { he: "חרדית-אשכנזית.", en: "Ashkenazi Haredi." },
    refuses: ["hadash_taal", "balad"], friction: ["yesh_atid", "democrats"], deepFriction: ["yisrael_beiteinu"],
  },
  raam: {
    id: "raam", name: { he: "רע\"מ", en: "Ra'am" }, tag: "arab", hawk: -1, color: "#2EA98F",
    blurb: { he: "איסלאמית-שמרנית, דגש על הישגים אזרחיים לחברה הערבית.", en: "Conservative Islamist; focused on civic gains for Arab citizens." },
    refuses: ["otzma_yehudit", "religious_zionism", "noam"], friction: ["yisrael_beiteinu", "balad"], deepFriction: ["likud"],
  },
  hadash_taal: {
    id: "hadash_taal", name: { he: "חד\"ש-תע\"ל", en: "Hadash–Ta'al" }, tag: "arab", hawk: -2, color: "#D1495B",
    blurb: { he: "שמאל ערבי-יהודי; מעולם לא ישבה בקואליציה.", en: "Arab-Jewish left; has never sat in a coalition." },
    refuses: ["likud", "religious_zionism", "otzma_yehudit", "noam", "shas", "utj"], friction: ["national_unity"], deepFriction: ["yisrael_beiteinu"],
  },
  religious_zionism: {
    id: "religious_zionism", name: { he: "הציונות הדתית", en: "Religious Zionism" }, tag: "far_right", hawk: 1.9, color: "#E3A33D",
    blurb: { he: "ימין דתי-לאומי, תומכת סיפוח והתיישבות.", en: "Religious-nationalist right; pro-annexation and settlement." },
    refuses: ["raam", "hadash_taal", "balad", "democrats"], friction: ["national_unity"], deepFriction: ["yesh_atid"],
  },
  balad: {
    id: "balad", name: { he: "בל\"ד", en: "Balad" }, tag: "arab", hawk: -2, color: "#7A3E9D",
    blurb: { he: "לאומית-ערבית; שוללת השתתפות בממשלה ציונית.", en: "Arab nationalist; rejects joining a Zionist government." },
    refuses: ["likud", "national_unity", "yisrael_beiteinu", "yesh_atid", "democrats", "shas", "otzma_yehudit", "utj", "religious_zionism", "noam"],
    friction: ["raam"], deepFriction: [],
  },
  noam: {
    id: "noam", name: { he: "נעם", en: "Noam" }, tag: "far_right", hawk: 1.8, color: "#8B6E4E",
    blurb: { he: "ימין דתי-שמרני.", en: "Religious-conservative right." },
    refuses: ["raam", "hadash_taal", "balad", "democrats", "yesh_atid", "national_unity"], friction: [], deepFriction: [],
  },
};

/** Names that differ by roster (the Democrats ran as Labor in 2022). */
const ROSTER_NAMES: Partial<Record<SeatRoster, Partial<Record<PartyId, Bi>>>> = {
  polls: {
    religious_zionism: { he: "הציונות הדתית וזהות", en: "Religious Zionism–Zehut" },
    national_unity: { he: "כחול לבן", en: "Blue and White" },
  },
  election_2022: { democrats: { he: "העבודה", en: "Labor" } },
};

export function partyName(p: PartyId, roster: SeatRoster): Bi {
  return ROSTER_NAMES[roster]?.[p] ?? PARTIES[p].name;
}

/** Who heads each list, per roster. */
const LEADERS: Record<SeatRoster, Partial<Record<PartyId, Bi>>> = {
  polls: {
    yashar: { he: "גדי איזנקוט", en: "Gadi Eisenkot" },
    likud: { he: "בנימין נתניהו", en: "Benjamin Netanyahu" },
    together: { he: "נפתלי בנט ויאיר לפיד", en: "Naftali Bennett & Yair Lapid" },
    democrats: { he: "יאיר גולן", en: "Yair Golan" },
    yisrael_beiteinu: { he: "אביגדור ליברמן", en: "Avigdor Lieberman" },
    shas: { he: "אריה דרעי", en: "Aryeh Deri" },
    otzma_yehudit: { he: "איתמר בן גביר", en: "Itamar Ben-Gvir" },
    religious_zionism: { he: "בצלאל סמוטריץ' ומשה פייגלין", en: "Bezalel Smotrich & Moshe Feiglin" },
    raam: { he: "מנסור עבאס", en: "Mansour Abbas" },
    amcha_yisrael: { he: "עופר וינטר", en: "Ofer Winter" },
  },
  election_2022: {
    likud: { he: "בנימין נתניהו", en: "Benjamin Netanyahu" },
    yesh_atid: { he: "יאיר לפיד", en: "Yair Lapid" },
    national_unity: { he: "בני גנץ", en: "Benny Gantz" },
    shas: { he: "אריה דרעי", en: "Aryeh Deri" },
    religious_zionism: { he: "בצלאל סמוטריץ'", en: "Bezalel Smotrich" },
    otzma_yehudit: { he: "איתמר בן גביר", en: "Itamar Ben-Gvir" },
    yisrael_beiteinu: { he: "אביגדור ליברמן", en: "Avigdor Lieberman" },
    raam: { he: "מנסור עבאס", en: "Mansour Abbas" },
    hadash_taal: { he: "איימן עודה", en: "Ayman Odeh" },
    democrats: { he: "מרב מיכאלי", en: "Merav Michaeli" },
    noam: { he: "אבי מעוז", en: "Avi Maoz" },
  },
};

export function partyLeader(p: PartyId, roster: SeatRoster): Bi | null {
  return LEADERS[roster][p] ?? null;
}

export const TAG_LABELS: Record<PartyTag, Bi> = {
  far_right: { he: "ימין קיצוני", en: "Far right" },
  right: { he: "ימין", en: "Right" },
  haredi: { he: "חרדים", en: "Haredim" },
  center: { he: "מרכז", en: "Center" },
  left: { he: "שמאל", en: "Left" },
  arab: { he: "מפלגות ערביות", en: "Arab parties" },
};

export const MAJORITY = 61;

export type FrictionLevel = "friction" | "deep";
export const FRICTION_WEIGHT: Record<FrictionLevel, number> = { friction: 1, deep: 3 };

export interface CoalitionCheck {
  seats: number;
  /** refusals inside the proposed coalition: [refuser, refused] */ vetoes: Array<[PartyId, PartyId]>;
  /** unordered pairs, each listed once with its worst level */ frictions: Array<{ a: PartyId; b: PartyId; level: FrictionLevel }>;
  majority: boolean;
  valid: boolean;
  /** 0–100 starting coalition stability */ stability: number;
  /** seat-weighted hawkishness −2 … +2 */ hawk: number;
  type: CoalitionType;
}

/** The friction level between two parties, whichever side declares it. */
export function frictionBetween(a: PartyId, b: PartyId): FrictionLevel | null {
  const A = PARTIES[a];
  const B = PARTIES[b];
  if (A.deepFriction.includes(b) || B.deepFriction.includes(a)) return "deep";
  if (A.friction.includes(b) || B.friction.includes(a)) return "friction";
  return null;
}

export function refusesEachOther(a: PartyId, b: PartyId): boolean {
  return PARTIES[a].refuses.includes(b) || PARTIES[b].refuses.includes(a);
}

export function checkCoalition(members: PartyId[], roster: SeatRoster = "polls"): CoalitionCheck {
  const list = [...new Set(members)];
  const set = new Set(list);
  const seats = list.reduce((s, p) => s + SEATS[roster][p], 0);
  const vetoes: Array<[PartyId, PartyId]> = [];
  for (const p of list) for (const r of PARTIES[p].refuses) if (set.has(r)) vetoes.push([p, r]);
  const frictions: CoalitionCheck["frictions"] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const level = frictionBetween(list[i], list[j]);
      if (level !== null) frictions.push({ a: list[i], b: list[j], level });
    }
  }
  const hawk = seats === 0 ? 0 : list.reduce((s, p) => s + PARTIES[p].hawk * SEATS[roster][p], 0) / seats;
  const spread = list.length === 0 ? 0 : Math.max(...list.map((p) => PARTIES[p].hawk)) - Math.min(...list.map((p) => PARTIES[p].hawk));
  const strain = frictions.reduce((s, f) => s + FRICTION_WEIGHT[f.level], 0);
  const majority = seats >= MAJORITY;
  const stability = Math.round(Math.max(15, Math.min(85, 60 + Math.min(8, seats - 61) * 2 - spread * 5 - strain * 3)));
  const type: CoalitionType = hawk >= 1.1 ? "RIGHT_WING_BLOC" : hawk <= 0.1 ? "CENTER_LEFT_BLOC" : "BENNETT_LIEBERMAN_GOLAN_ABBAS";
  return { seats, vetoes, frictions, majority, valid: majority && vetoes.length === 0, stability, hawk, type };
}

/** Friction strain a partner carries inside a coalition (for its starting patience). */
export function partnerStrain(p: PartyId, members: PartyId[]): number {
  return members.reduce((s, m) => {
    if (m === p) return s;
    const level = frictionBetween(p, m);
    return level === null ? s : s + FRICTION_WEIGHT[level];
  }, 0);
}

/** Reference coalitions shown in the builder — the September 2026 poll arithmetic. */
export const BENCHMARK_COALITIONS: Array<{ id: string; label: Bi; members: PartyId[] }> = [
  {
    id: "netanyahu_bloc", label: { he: "גוש נתניהו", en: "Netanyahu bloc" },
    members: ["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "amcha_yisrael"],
  },
  {
    id: "netanyahu_plus_lieberman", label: { he: "גוש נתניהו + ליברמן", en: "Netanyahu bloc + Lieberman" },
    members: ["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "amcha_yisrael", "yisrael_beiteinu"],
  },
  {
    id: "change_zionist", label: { he: "איזנקוט + בנט + גולן + ליברמן", en: "Eisenkot + Bennett + Golan + Lieberman" },
    members: ["yashar", "together", "democrats", "yisrael_beiteinu"],
  },
  {
    id: "change_plus_raam", label: { he: "גוש השינוי + רע\"מ", en: "Change bloc + Ra'am" },
    members: ["yashar", "together", "democrats", "yisrael_beiteinu", "raam"],
  },
  {
    id: "change_plus_arab", label: { he: "גוש השינוי + רע\"מ + המשותפת", en: "Change bloc + Ra'am + Joint List" },
    members: ["yashar", "together", "democrats", "yisrael_beiteinu", "raam", "joint_list"],
  },
  {
    id: "unity", label: { he: "אחדות: איזנקוט + ליכוד + בנט + ליברמן", en: "Unity: Eisenkot + Likud + Bennett + Lieberman" },
    members: ["yashar", "likud", "together", "yisrael_beiteinu"],
  },
];

/** Partner patience change when a doctrine is adopted (assumption). */
export const DOCTRINE_REACTIONS: Record<PolicyTrack, Record<PartyTag, number>> = {
  RADICAL_RIGHT_DEPORTATION: { far_right: 20, right: -15, haredi: -10, center: -70, left: -100, arab: -100 },
  CONSERVATIVE_RIGHT_ANNEXATION: { far_right: 15, right: 5, haredi: 0, center: -35, left: -70, arab: -80 },
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { far_right: -35, right: -5, haredi: 0, center: 10, left: 5, arab: 5 },
  CENTER_LEFT_PA_RETURN: { far_right: -90, right: -45, haredi: -15, center: 5, left: 15, arab: 15 },
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { far_right: -100, right: -80, haredi: -45, center: -40, left: 10, arab: 15 },
};
