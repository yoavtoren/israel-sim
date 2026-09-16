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
 *  - "poll_2026_09_n12": the N12 / Madgam benchmark of September 2026, a second
 *    reading of the same month. It seats the Reservists & Economic list (below
 *    the threshold in the 10-poll average) and draws the vetoes harder: there
 *    Eisenkot REFUSES Likud and Lieberman REFUSES the Haredi parties, where the
 *    default roster has friction. Relations are therefore ROSTER-SCOPED via
 *    ROSTER_RELATIONS — one global matrix cannot hold both readings.
 *
 *  Security positions, refusals and friction are ASSUMPTIONS drawn from the
 *  parties' public positions — a game abstraction, not a statement of what any
 *  party would actually do. */

import type { Bi, CoalitionType, PolicyTrack } from "../types";

export type PartyId =
  | "yashar" | "likud" | "together" | "democrats" | "yisrael_beiteinu" | "shas" | "utj" | "otzma_yehudit"
  | "joint_list" | "religious_zionism" | "raam" | "amcha_yisrael"
  | "national_unity" | "yesh_atid" | "hadash_taal" | "balad" | "noam"
  | "miluimnikim_calcalit";

/** Coalition blocs as the September 2026 benchmarks group them. */
export type Bloc = "LIKUD_BLOC" | "CHANGE_BLOC" | "ARAB_LISTS" | "NON_ALIGNED";

export const PARTY_BLOC: Record<PartyId, Bloc> = {
  likud: "LIKUD_BLOC", shas: "LIKUD_BLOC", utj: "LIKUD_BLOC", otzma_yehudit: "LIKUD_BLOC",
  religious_zionism: "LIKUD_BLOC", amcha_yisrael: "LIKUD_BLOC", noam: "LIKUD_BLOC",
  yashar: "CHANGE_BLOC", together: "CHANGE_BLOC", democrats: "CHANGE_BLOC",
  yisrael_beiteinu: "CHANGE_BLOC", national_unity: "CHANGE_BLOC", yesh_atid: "CHANGE_BLOC",
  joint_list: "ARAB_LISTS", raam: "ARAB_LISTS", hadash_taal: "ARAB_LISTS", balad: "ARAB_LISTS",
  miluimnikim_calcalit: "NON_ALIGNED",
};

export type SeatRoster = "polls" | "election_2022" | "poll_2026_09_n12";
export const SEAT_ROSTERS: SeatRoster[] = ["polls", "election_2022", "poll_2026_09_n12"];

export const ROSTER_LABELS: Record<SeatRoster, Bi> = {
  polls: { he: "סקרים עדכניים", en: "Current polls" },
  election_2022: { he: "בחירות 2022", en: "2022 election" },
  poll_2026_09_n12: { he: "N12 / מדגם, ספטמבר 2026", en: "N12 / Madgam, September 2026" },
};

export const ROSTER_NOTES: Record<SeatRoster, Bi> = {
  polls: {
    he: "ממוצע 10 הסקרים האחרונים, 9–15 בספטמבר 2026 · כחול לבן והמילואימניקים מתחת לאחוז החסימה",
    en: "Average of the 10 latest polls, 9–15 September 2026 · Blue and White and the Reservists below the threshold",
  },
  election_2022: { he: "תוצאות בחירות נובמבר 2022", en: "November 2022 election results" },
  poll_2026_09_n12: {
    he: "קריאה שנייה של ספטמבר 2026 · המילואימניקים עוברים את אחוז החסימה · ווטו הדוק יותר",
    en: "A second reading of September 2026 · the Reservists clear the threshold · tighter vetoes",
  },
};

export const SEATS: Record<SeatRoster, Record<PartyId, number>> = {
  polls: {
    yashar: 24, likud: 22, together: 13, democrats: 9, yisrael_beiteinu: 8, shas: 8, utj: 8, otzma_yehudit: 7,
    joint_list: 7, religious_zionism: 5, raam: 5, amcha_yisrael: 4,
    national_unity: 0, yesh_atid: 0, hadash_taal: 0, balad: 0, noam: 0, miluimnikim_calcalit: 0,
  },
  election_2022: {
    likud: 32, yesh_atid: 24, national_unity: 12, shas: 11, religious_zionism: 7, utj: 7,
    otzma_yehudit: 6, yisrael_beiteinu: 6, raam: 5, hadash_taal: 5, democrats: 4, noam: 1, balad: 0,
    yashar: 0, together: 0, joint_list: 0, amcha_yisrael: 0, miluimnikim_calcalit: 0,
  },
  // N12 / Madgam, September 2026. Bennett and Lapid run as "together" here too.
  poll_2026_09_n12: {
    yashar: 23, likud: 20, together: 13, democrats: 10, yisrael_beiteinu: 8, utj: 8, joint_list: 8,
    shas: 7, otzma_yehudit: 6, religious_zionism: 5, miluimnikim_calcalit: 4, amcha_yisrael: 4, raam: 4,
    national_unity: 0, yesh_atid: 0, hadash_taal: 0, balad: 0, noam: 0,
  },
};

export function partySeats(roster: SeatRoster, p: PartyId): number {
  return SEATS[roster][p];
}

export const PARTY_IDS: PartyId[] = [
  "yashar", "likud", "together", "democrats", "yisrael_beiteinu", "shas", "utj", "otzma_yehudit",
  "joint_list", "religious_zionism", "raam", "amcha_yisrael",
  "national_unity", "yesh_atid", "hadash_taal", "balad", "noam", "miluimnikim_calcalit",
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
  // Seated only in the N12 / Madgam roster; below the threshold in the 10-poll average.
  miluimnikim_calcalit: {
    id: "miluimnikim_calcalit", name: { he: "המילואימניקים והכלכלית", en: "Reservists & Economic Party" },
    tag: "right", hawk: 0.9, color: "#7F8C4A",
    blurb: { he: "רשימת מילואימניקים וכלכלנים, לא מזוהה עם גוש.", en: "Reservists and economists; aligned with no bloc." },
    refuses: ["joint_list", "raam", "hadash_taal", "balad"], friction: ["shas", "utj"], deepFriction: [],
  },
};

/** Names that differ by roster (the Democrats ran as Labor in 2022). */
const ROSTER_NAMES: Partial<Record<SeatRoster, Partial<Record<PartyId, Bi>>>> = {
  polls: {
    religious_zionism: { he: "הציונות הדתית וזהות", en: "Religious Zionism–Zehut" },
    national_unity: { he: "כחול לבן", en: "Blue and White" },
  },
  election_2022: { democrats: { he: "העבודה", en: "Labor" } },
  poll_2026_09_n12: {
    religious_zionism: { he: "הציונות הדתית וזהות", en: "Religious Zionism-Zehut" },
  },
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
  poll_2026_09_n12: {
    yashar: { he: "גדי איזנקוט", en: "Gadi Eisenkot" },
    likud: { he: "בנימין נתניהו", en: "Benjamin Netanyahu" },
    together: { he: "נפתלי בנט ויאיר לפיד", en: "Naftali Bennett & Yair Lapid" },
    democrats: { he: "יאיר גולן", en: "Yair Golan" },
    yisrael_beiteinu: { he: "אביגדור ליברמן", en: "Avigdor Lieberman" },
    utj: { he: "יצחק גולדקנופף ומשה גפני", en: "Yitzhak Goldknopf & Moshe Gafni" },
    joint_list: { he: "איימן עודה ואחמד טיבי", en: "Ayman Odeh & Ahmad Tibi" },
    shas: { he: "אריה דרעי", en: "Aryeh Deri" },
    otzma_yehudit: { he: "איתמר בן גביר", en: "Itamar Ben-Gvir" },
    religious_zionism: { he: "בצלאל סמוטריץ' ומשה פייגלין", en: "Bezalel Smotrich & Moshe Feiglin" },
    miluimnikim_calcalit: { he: "יועז הנדל וירון זליכה", en: "Yoaz Hendel & Yaron Zelekha" },
    amcha_yisrael: { he: "עופר וינטר", en: "Ofer Winter" },
    raam: { he: "מנסור עבאס", en: "Mansour Abbas" },
  },
};

export function partyLeader(p: PartyId, roster: SeatRoster): Bi | null {
  return LEADERS[roster][p] ?? null;
}

export interface PartyRelations {
  refuses: PartyId[];
  friction: PartyId[];
  deepFriction: PartyId[];
}

/** Relations a roster overrides. The N12 / Madgam reading draws the vetoes
 *  harder than the 10-poll average, so the two cannot share one matrix.
 *  A friction is NOT repeated where a refusal already stands: the pair can
 *  never sit together, and carrying both would double-count the strain. */
const ROSTER_RELATIONS: Partial<Record<SeatRoster, Partial<Record<PartyId, Partial<PartyRelations>>>>> = {
  poll_2026_09_n12: {
    yashar: { refuses: ["likud", "otzma_yehudit", "religious_zionism"], friction: ["shas", "utj"], deepFriction: [] },
    likud: { refuses: ["democrats", "joint_list"], friction: ["yisrael_beiteinu"], deepFriction: [] },
    together: { refuses: ["otzma_yehudit", "religious_zionism"], friction: ["shas", "utj", "joint_list"], deepFriction: [] },
    // friction with Shas and UTJ dropped: both refuse the Democrats outright
    democrats: { refuses: ["likud", "otzma_yehudit", "religious_zionism", "amcha_yisrael"], friction: ["yisrael_beiteinu"], deepFriction: [] },
    yisrael_beiteinu: { refuses: ["shas", "utj", "joint_list", "raam"], friction: ["democrats"], deepFriction: [] },
    utj: { refuses: ["yisrael_beiteinu", "democrats"], friction: ["together", "yashar"], deepFriction: [] },
    joint_list: { refuses: ["likud", "otzma_yehudit", "religious_zionism", "yisrael_beiteinu", "amcha_yisrael"], friction: ["together", "yashar"], deepFriction: [] },
    shas: { refuses: ["yisrael_beiteinu", "democrats"], friction: ["together", "yashar"], deepFriction: [] },
    otzma_yehudit: { refuses: ["democrats", "joint_list", "raam", "yashar", "together"], friction: [], deepFriction: [] },
    religious_zionism: { refuses: ["democrats", "joint_list", "raam", "yashar"], friction: [], deepFriction: [] },
    miluimnikim_calcalit: { refuses: ["joint_list", "raam"], friction: ["shas", "utj"], deepFriction: [] },
    amcha_yisrael: { refuses: ["democrats", "joint_list", "raam"], friction: [], deepFriction: [] },
    // friction with Lieberman and the Reservists dropped: both refuse Ra'am outright
    raam: { refuses: ["otzma_yehudit", "religious_zionism", "amcha_yisrael"], friction: [], deepFriction: [] },
  },
};

/** A party's refusals and friction as they stand in a roster. */
export function relationsOf(p: PartyId, roster: SeatRoster = "polls"): PartyRelations {
  const base = PARTIES[p];
  const over = ROSTER_RELATIONS[roster]?.[p];
  return {
    refuses: over?.refuses ?? base.refuses,
    friction: over?.friction ?? base.friction,
    deepFriction: over?.deepFriction ?? base.deepFriction,
  };
}

export const TAG_LABELS: Record<PartyTag, Bi> = {
  far_right: { he: "ימין קיצוני", en: "Far right" },
  right: { he: "ימין", en: "Right" },
  haredi: { he: "חרדים", en: "Haredim" },
  center: { he: "מרכז", en: "Center" },
  left: { he: "שמאל", en: "Left" },
  arab: { he: "מפלגות ערביות", en: "Arab parties" },
};

/** The questions a coalition actually has to agree on. Security alone (hawk)
 *  never explained why a government broke: the 2021-22 coalition died on
 *  religion-and-state and the Palestinian question, not on hawkishness. */
export type Axis = "security" | "religion_state" | "judiciary" | "economy" | "palestinian";
export const AXES: Axis[] = ["security", "religion_state", "judiciary", "economy", "palestinian"];

export const AXIS_LABELS: Record<Axis, Bi> = {
  security: { he: "ביטחון", en: "Security" },
  religion_state: { he: "דת ומדינה", en: "Religion and state" },
  judiciary: { he: "מערכת המשפט", en: "The judiciary" },
  economy: { he: "כלכלה", en: "Economy" },
  palestinian: { he: "השאלה הפלסטינית", en: "The Palestinian question" },
};

/** How much each axis moves coalition stability (weights sum to 1). */
const AXIS_WEIGHT: Record<Axis, number> = {
  security: 0.22, religion_state: 0.26, judiciary: 0.22, economy: 0.12, palestinian: 0.18,
};

/** Position on each axis, -2 … +2 (assumption):
 *  security       dovish … hawkish
 *  religion_state secular … religious control
 *  judiciary      strengthen the courts … curb them
 *  economy        welfare … free market
 *  palestinian    two states … annexation */
export const POSITIONS: Record<PartyId, Record<Axis, number>> = {
  likud: { security: 1.2, religion_state: 0.6, judiciary: 1.4, economy: 1.0, palestinian: 1.0 },
  national_unity: { security: 0.6, religion_state: 0, judiciary: -0.6, economy: 0.6, palestinian: 0.2 },
  yisrael_beiteinu: { security: 1.3, religion_state: -1.8, judiciary: 0.2, economy: 0.8, palestinian: 0.8 },
  yesh_atid: { security: 0, religion_state: -1.2, judiciary: -1.0, economy: 0.4, palestinian: -0.4 },
  democrats: { security: -1.4, religion_state: -1.4, judiciary: -1.6, economy: -1.0, palestinian: -1.6 },
  shas: { security: 0.7, religion_state: 2.0, judiciary: 0.8, economy: -0.8, palestinian: 0.6 },
  otzma_yehudit: { security: 2.0, religion_state: 1.4, judiciary: 2.0, economy: 0.4, palestinian: 2.0 },
  utj: { security: 0.5, religion_state: 2.0, judiciary: 0.6, economy: -0.6, palestinian: 0.4 },
  raam: { security: -1.0, religion_state: 1.2, judiciary: -0.6, economy: -0.6, palestinian: -1.4 },
  hadash_taal: { security: -2.0, religion_state: -1.0, judiciary: -1.4, economy: -1.6, palestinian: -2.0 },
  religious_zionism: { security: 1.9, religion_state: 1.6, judiciary: 1.8, economy: 0.8, palestinian: 2.0 },
  balad: { security: -2.0, religion_state: -0.6, judiciary: -1.2, economy: -1.2, palestinian: -2.0 },
  noam: { security: 1.8, religion_state: 2.0, judiciary: 1.6, economy: 0.2, palestinian: 1.6 },
  yashar: { security: 0.6, religion_state: -0.8, judiciary: -0.8, economy: 0.6, palestinian: 0 },
  together: { security: 1.0, religion_state: -0.6, judiciary: -0.4, economy: 0.8, palestinian: 0.4 },
  joint_list: { security: -2.0, religion_state: -0.8, judiciary: -1.2, economy: -1.4, palestinian: -2.0 },
  amcha_yisrael: { security: 1.7, religion_state: 1.2, judiciary: 1.2, economy: 0.4, palestinian: 1.6 },
  miluimnikim_calcalit: { security: 0.9, religion_state: -1.0, judiciary: -0.2, economy: 1.2, palestinian: 0.4 },
};

/** The senior portfolios parties fight over. Two claimants on one chair is a
 *  coalition crisis before the government is even sworn in. */
export type Portfolio = "finance" | "defence" | "interior" | "justice" | "foreign";
export const PORTFOLIOS: Portfolio[] = ["finance", "defence", "interior", "justice", "foreign"];

export const PORTFOLIO_LABELS: Record<Portfolio, Bi> = {
  finance: { he: "האוצר", en: "Finance" },
  defence: { he: "הביטחון", en: "Defence" },
  interior: { he: "הפנים", en: "Interior" },
  justice: { he: "המשפטים", en: "Justice" },
  foreign: { he: "החוץ", en: "Foreign Affairs" },
};

/** What each list demands as its price for joining (assumption). */
export const PORTFOLIO_DEMANDS: Record<PartyId, Portfolio[]> = {
  likud: ["defence", "foreign"],
  national_unity: ["defence", "justice"],
  yisrael_beiteinu: ["finance", "interior"],
  yesh_atid: ["finance", "foreign"],
  democrats: ["justice"],
  shas: ["interior", "finance"],
  otzma_yehudit: ["interior"],
  utj: ["interior"],
  raam: [],
  hadash_taal: [],
  religious_zionism: ["finance", "defence"],
  balad: [],
  noam: [],
  yashar: ["defence"],
  together: ["foreign", "finance"],
  joint_list: [],
  amcha_yisrael: ["defence"],
  miluimnikim_calcalit: ["finance"],
};

export const MAJORITY = 61;

export type FrictionLevel = "friction" | "deep";
export const FRICTION_WEIGHT: Record<FrictionLevel, number> = { friction: 1, deep: 3 };

/** Distance between the two furthest partners on one question. */
export interface AxisStrain {
  axis: Axis;
  /** 0 … 4 */ spread: number;
  /** the two parties holding the poles */ poles: [PartyId, PartyId] | null;
}

export interface PortfolioClash {
  portfolio: Portfolio;
  parties: PartyId[];
}

/** Gamson's law: portfolios split roughly in proportion to seats brought in. */
export interface PortfolioSplit {
  party: PartyId;
  seats: number;
  /** share of the coalition's seats, 0 … 1 */ share: number;
  /** senior portfolios this party is expected to take */ takes: Portfolio[];
}

export interface StabilityPart {
  key: string;
  label: Bi;
  /** signed contribution to the stability score */ delta: number;
}

export interface CoalitionCheck {
  /** seats of the parties sitting in the government */ seats: number;
  /** seats promised from outside without joining */ supportSeats: number;
  /** refusals inside the proposed coalition: [refuser, refused] */ vetoes: Array<[PartyId, PartyId]>;
  /** unordered pairs, each listed once with its worst level */ frictions: Array<{ a: PartyId; b: PartyId; level: FrictionLevel }>;
  majority: boolean;
  valid: boolean;
  /** 0–100 starting coalition stability */ stability: number;
  /** how the stability score was arrived at */ stabilityParts: StabilityPart[];
  /** seat-weighted hawkishness −2 … +2 */ hawk: number;
  type: CoalitionType;
  /** disagreement per question, worst first */ axes: AxisStrain[];
  /** partners whose exit alone costs the majority — they can topple it */ pivotal: PartyId[];
  /** seats above 61 */ surplus: number;
  /** no member can leave without losing the majority */ minimalWinning: boolean;
  /** two or more claimants on the same senior portfolio */ portfolioClashes: PortfolioClash[];
  /** expected split of the senior portfolios */ portfolios: PortfolioSplit[];
  /** how long the government is expected to last, in months (max 48) */ durabilityMonths: number;
}

/** The friction level between two parties, whichever side declares it. */
export function frictionBetween(a: PartyId, b: PartyId, roster: SeatRoster = "polls"): FrictionLevel | null {
  const A = relationsOf(a, roster);
  const B = relationsOf(b, roster);
  if (A.deepFriction.includes(b) || B.deepFriction.includes(a)) return "deep";
  if (A.friction.includes(b) || B.friction.includes(a)) return "friction";
  return null;
}

export function refusesEachOther(a: PartyId, b: PartyId, roster: SeatRoster = "polls"): boolean {
  return relationsOf(a, roster).refuses.includes(b) || relationsOf(b, roster).refuses.includes(a);
}

/** Disagreement on one question: the gap between the two furthest partners. */
export function axisStrain(members: PartyId[], axis: Axis): AxisStrain {
  if (members.length === 0) return { axis, spread: 0, poles: null };
  let lo = members[0];
  let hi = members[0];
  for (const p of members) {
    if (POSITIONS[p][axis] < POSITIONS[lo][axis]) lo = p;
    if (POSITIONS[p][axis] > POSITIONS[hi][axis]) hi = p;
  }
  const spread = POSITIONS[hi][axis] - POSITIONS[lo][axis];
  return { axis, spread, poles: spread === 0 ? null : [lo, hi] };
}

/** Who gets the senior chairs, by seats brought in (Gamson's law). */
function splitPortfolios(members: PartyId[], roster: SeatRoster): PortfolioSplit[] {
  const total = members.reduce((s, p) => s + SEATS[roster][p], 0);
  const byWeight = [...members].sort((a, b) => SEATS[roster][b] - SEATS[roster][a]);
  const taken = new Set<Portfolio>();
  const takes = new Map<PartyId, Portfolio[]>();
  // the strongest partner picks first, among the chairs it actually demands
  for (const p of byWeight) {
    const got: Portfolio[] = [];
    for (const f of PORTFOLIO_DEMANDS[p]) {
      if (taken.has(f)) continue;
      taken.add(f);
      got.push(f);
      if (got.length >= 2) break;
    }
    takes.set(p, got);
  }
  return byWeight.map((p) => ({
    party: p,
    seats: SEATS[roster][p],
    share: total === 0 ? 0 : SEATS[roster][p] / total,
    takes: takes.get(p) ?? [],
  }));
}

/** Two or more partners demanding the same chair. */
function portfolioClashesOf(members: PartyId[]): PortfolioClash[] {
  const out: PortfolioClash[] = [];
  for (const f of PORTFOLIOS) {
    const claim = members.filter((p) => PORTFOLIO_DEMANDS[p].includes(f));
    if (claim.length > 1) out.push({ portfolio: f, parties: claim });
  }
  return out;
}

/** `support` are lists that keep the government alive from outside without
 *  joining it — the 2021 arrangement. They carry seats and take no portfolios,
 *  and refusals do not apply to them: refusing to SIT with a party is not the
 *  same as refusing to keep it in power. */
export function checkCoalition(members: PartyId[], roster: SeatRoster = "polls", support: PartyId[] = []): CoalitionCheck {
  const list = [...new Set(members)];
  const set = new Set(list);
  const backers = [...new Set(support)].filter((p) => !set.has(p));
  const seats = list.reduce((s, p) => s + SEATS[roster][p], 0);
  const supportSeats = backers.reduce((s, p) => s + SEATS[roster][p], 0);
  const total = seats + supportSeats;

  const vetoes: Array<[PartyId, PartyId]> = [];
  for (const p of list) for (const r of relationsOf(p, roster).refuses) if (set.has(r)) vetoes.push([p, r]);
  const frictions: CoalitionCheck["frictions"] = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const level = frictionBetween(list[i], list[j], roster);
      if (level !== null) frictions.push({ a: list[i], b: list[j], level });
    }
  }

  const hawk = seats === 0 ? 0 : list.reduce((s, p) => s + PARTIES[p].hawk * SEATS[roster][p], 0) / seats;
  const axes = AXES.map((a) => axisStrain(list, a)).sort((a, b) => b.spread - a.spread);
  const axisPenalty = axes.reduce((s, a) => s + a.spread * AXIS_WEIGHT[a.axis], 0);
  const strain = frictions.reduce((s, f) => s + FRICTION_WEIGHT[f.level], 0);

  const majority = total >= MAJORITY;
  const pivotal = majority ? list.filter((p) => total - SEATS[roster][p] < MAJORITY) : [];
  const surplus = Math.max(0, total - MAJORITY);
  const minimalWinning = majority && list.length > 0 && pivotal.length === list.length;
  const clashes = portfolioClashesOf(list);
  const portfolios = splitPortfolios(list, roster);

  const parts: StabilityPart[] = [
    { key: "base", label: { he: "בסיס", en: "Base" }, delta: 60 },
    { key: "cushion", label: { he: "כרית מנדטים מעל 61", en: "Seat cushion above 61" }, delta: Math.min(8, surplus) * 2 },
    { key: "axes", label: { he: "פערים אידאולוגיים", en: "Ideological distance" }, delta: -Math.round(axisPenalty * 12) },
    { key: "friction", label: { he: "חיכוך בין שותפים", en: "Friction between partners" }, delta: -strain * 3 },
    { key: "pivotal", label: { he: "שותפים שיכולים להפיל לבד", en: "Partners who can topple it alone" }, delta: -pivotal.length * 2 },
    { key: "portfolios", label: { he: "מריבות על תיקים בכירים", en: "Fights over senior portfolios" }, delta: -clashes.length * 3 },
    { key: "outside", label: { he: "תמיכה מבחוץ", en: "Support from outside" }, delta: -backers.length * 4 },
  ].filter((p) => p.delta !== 0);

  const raw = parts.reduce((s, p) => s + p.delta, 0);
  const stability = Math.round(Math.max(15, Math.min(85, raw)));
  const durabilityMonths = Math.max(
    4,
    Math.min(48, Math.round(48 * (stability / 85) * (1 - 0.05 * pivotal.length) * (1 - 0.08 * clashes.length))),
  );
  const type: CoalitionType = hawk >= 1.1 ? "RIGHT_WING_BLOC" : hawk <= 0.1 ? "CENTER_LEFT_BLOC" : "BENNETT_LIEBERMAN_GOLAN_ABBAS";

  return {
    seats, supportSeats, vetoes, frictions, majority,
    valid: majority && vetoes.length === 0,
    stability, stabilityParts: parts, hawk, type,
    axes, pivotal, surplus, minimalWinning,
    portfolioClashes: clashes, portfolios, durabilityMonths,
  };
}

/** Friction strain a partner carries inside a coalition (for its starting patience). */
export function partnerStrain(p: PartyId, members: PartyId[], roster: SeatRoster = "polls"): number {
  return members.reduce((s, m) => {
    if (m === p) return s;
    const level = frictionBetween(p, m, roster);
    return level === null ? s : s + FRICTION_WEIGHT[level];
  }, 0);
}

/** Reference coalitions shown in the builder — the September 2026 poll arithmetic. */
export const BENCHMARK_COALITIONS: Array<{ id: string; label: Bi; members: PartyId[]; roster?: SeatRoster }> = [
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
  // N12 / Madgam: the veto triangle. The only majority that clears every refusal
  // needs BOTH the Haredi parties and the Arab lists, which is exactly what
  // Lieberman, Hendel and Golan will not sit with.
  {
    id: "veto_triangle_n12", label: { he: "ישר + ביחד + חרדים + ערבים", en: "Yashar + Together + Haredim + Arab lists" },
    members: ["yashar", "together", "shas", "utj", "joint_list", "raam"], roster: "poll_2026_09_n12",
  },
  {
    id: "netanyahu_bloc_n12", label: { he: "גוש נתניהו (N12)", en: "Netanyahu bloc (N12)" },
    members: ["likud", "shas", "utj", "otzma_yehudit", "religious_zionism", "amcha_yisrael"], roster: "poll_2026_09_n12",
  },
  {
    id: "secular_change_n12", label: { he: "גוש השינוי החילוני (N12)", en: "Secular change bloc (N12)" },
    members: ["yashar", "together", "democrats", "yisrael_beiteinu", "miluimnikim_calcalit"], roster: "poll_2026_09_n12",
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

/** The N12 / Madgam benchmark as a flat roster, derived from the tables above. */
export interface Party {
  id: PartyId;
  name: string;
  leader: string;
  seats: number;
  bloc: Bloc;
  refusesToSitWith: PartyId[];
  frictionWith: PartyId[];
}

export const CURRENT_POLL_ROSTER: SeatRoster = "poll_2026_09_n12";

export const CURRENT_POLL_PARTIES: Party[] = rosterParties(CURRENT_POLL_ROSTER).map((id) => {
  const rel = relationsOf(id, CURRENT_POLL_ROSTER);
  return {
    id,
    name: partyName(id, CURRENT_POLL_ROSTER).he,
    leader: partyLeader(id, CURRENT_POLL_ROSTER)?.he ?? "",
    seats: SEATS[CURRENT_POLL_ROSTER][id],
    bloc: PARTY_BLOC[id],
    refusesToSitWith: rel.refuses,
    frictionWith: rel.friction,
  };
});
