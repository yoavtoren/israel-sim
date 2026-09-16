/** Knesset parties for the Prime Minister campaign: seats as elected in the
 *  November 2022 election (the Religious Zionism joint list shown as its three
 *  factions), and coalition rules.
 *
 *  Security positions, refusals and friction are ASSUMPTIONS drawn from the
 *  parties' public positions — a game abstraction, not a statement of what any
 *  party would actually do. */

import type { Bi, CoalitionType, PolicyTrack } from "../types";

export type PartyId =
  | "likud" | "yesh_atid" | "national_unity" | "shas" | "utj" | "religious_zionism"
  | "otzma_yehudit" | "yisrael_beiteinu" | "raam" | "hadash_taal" | "labor" | "noam";

/** Reaction groups: dilemmas address groups, not individual parties. */
export type PartyTag = "far_right" | "right" | "haredi" | "center" | "left" | "arab";

export interface PartyDef {
  id: PartyId;
  name: Bi;
  seats: number;
  tag: PartyTag;
  /** security axis: −2 dovish … +2 hawkish */ hawk: number;
  color: string;
  blurb: Bi;
  /** will not sit in a government with these parties */ refuses: PartyId[];
  /** can sit together, but with friction (stability penalty) */ friction: PartyId[];
}

export const PARTY_IDS: PartyId[] = [
  "likud", "yesh_atid", "national_unity", "shas", "religious_zionism", "utj",
  "otzma_yehudit", "yisrael_beiteinu", "raam", "hadash_taal", "labor", "noam",
];

export const PARTIES: Record<PartyId, PartyDef> = {
  likud: {
    id: "likud", name: { he: "הליכוד", en: "Likud" }, seats: 32, tag: "right", hawk: 1.2, color: "#3B82D0",
    blurb: { he: "ימין לאומי-ליברלי, מפלגת השלטון הגדולה.", en: "National-liberal right; the largest ruling party." },
    refuses: ["hadash_taal"], friction: ["raam", "yesh_atid", "labor"],
  },
  yesh_atid: {
    id: "yesh_atid", name: { he: "יש עתיד", en: "Yesh Atid" }, seats: 24, tag: "center", hawk: 0, color: "#2F9FD8",
    blurb: { he: "מרכז ליברלי-חילוני.", en: "Liberal secular center." },
    refuses: ["otzma_yehudit", "noam"], friction: ["shas", "utj", "religious_zionism", "likud"],
  },
  national_unity: {
    id: "national_unity", name: { he: "המחנה הממלכתי", en: "National Unity" }, seats: 12, tag: "center", hawk: 0.6, color: "#4F6FB8",
    blurb: { he: "מרכז-ימין ביטחוני.", en: "Security-minded center-right." },
    refuses: ["noam"], friction: ["otzma_yehudit", "religious_zionism", "hadash_taal"],
  },
  shas: {
    id: "shas", name: { he: "ש\"ס", en: "Shas" }, seats: 11, tag: "haredi", hawk: 0.7, color: "#1F2F57",
    blurb: { he: "חרדית-ספרדית, דגש חברתי ודתי.", en: "Sephardi Haredi; social and religious focus." },
    refuses: ["hadash_taal"], friction: ["yesh_atid", "yisrael_beiteinu"],
  },
  religious_zionism: {
    id: "religious_zionism", name: { he: "הציונות הדתית", en: "Religious Zionism" }, seats: 7, tag: "far_right", hawk: 1.9, color: "#E3A33D",
    blurb: { he: "ימין דתי-לאומי, תומכת סיפוח והתיישבות.", en: "Religious-nationalist right; pro-annexation and settlement." },
    refuses: ["raam", "hadash_taal", "labor"], friction: ["yesh_atid", "national_unity"],
  },
  utj: {
    id: "utj", name: { he: "יהדות התורה", en: "United Torah Judaism" }, seats: 7, tag: "haredi", hawk: 0.5, color: "#5C6B7A",
    blurb: { he: "חרדית-אשכנזית.", en: "Ashkenazi Haredi." },
    refuses: ["hadash_taal"], friction: ["yesh_atid", "yisrael_beiteinu"],
  },
  otzma_yehudit: {
    id: "otzma_yehudit", name: { he: "עוצמה יהודית", en: "Otzma Yehudit" }, seats: 6, tag: "far_right", hawk: 2, color: "#C0392B",
    blurb: { he: "ימין קיצוני.", en: "Far right." },
    refuses: ["raam", "hadash_taal", "labor", "yesh_atid"], friction: ["national_unity"],
  },
  yisrael_beiteinu: {
    id: "yisrael_beiteinu", name: { he: "ישראל ביתנו", en: "Yisrael Beiteinu" }, seats: 6, tag: "right", hawk: 1.3, color: "#6FA8DC",
    blurb: { he: "ימין חילוני.", en: "Secular right." },
    refuses: ["hadash_taal"], friction: ["shas", "utj", "raam"],
  },
  raam: {
    id: "raam", name: { he: "רע\"מ", en: "Ra'am" }, seats: 5, tag: "arab", hawk: -1, color: "#2EA98F",
    blurb: { he: "איסלאמית-שמרנית, דגש על הישגים אזרחיים לחברה הערבית.", en: "Conservative Islamist; focused on civic gains for Arab citizens." },
    refuses: ["otzma_yehudit", "religious_zionism", "noam"], friction: ["likud", "yisrael_beiteinu"],
  },
  hadash_taal: {
    id: "hadash_taal", name: { he: "חד\"ש-תע\"ל", en: "Hadash–Ta'al" }, seats: 5, tag: "arab", hawk: -2, color: "#D1495B",
    blurb: { he: "שמאל ערבי-יהודי, מחוץ לקואליציות מאז ומעולם.", en: "Arab-Jewish left; has never joined a coalition." },
    refuses: ["likud", "religious_zionism", "otzma_yehudit", "noam", "yisrael_beiteinu", "shas", "utj", "national_unity"], friction: ["yesh_atid"],
  },
  labor: {
    id: "labor", name: { he: "העבודה", en: "Labor" }, seats: 4, tag: "left", hawk: -1.4, color: "#E4572E",
    blurb: { he: "שמאל ציוני.", en: "Zionist left." },
    refuses: ["otzma_yehudit", "religious_zionism", "noam"], friction: ["likud", "shas", "utj"],
  },
  noam: {
    id: "noam", name: { he: "נעם", en: "Noam" }, seats: 1, tag: "far_right", hawk: 1.8, color: "#8B6E4E",
    blurb: { he: "ימין דתי-שמרני.", en: "Religious-conservative right." },
    refuses: ["raam", "hadash_taal", "labor", "yesh_atid", "national_unity"], friction: [],
  },
};

export const TAG_LABELS: Record<PartyTag, Bi> = {
  far_right: { he: "ימין קיצוני", en: "Far right" },
  right: { he: "ימין", en: "Right" },
  haredi: { he: "חרדים", en: "Haredim" },
  center: { he: "מרכז", en: "Center" },
  left: { he: "שמאל", en: "Left" },
  arab: { he: "מפלגות ערביות", en: "Arab parties" },
};

export const MAJORITY = 61;

export interface CoalitionCheck {
  seats: number;
  /** refusals inside the proposed coalition: [refuser, refused] */ vetoes: Array<[PartyId, PartyId]>;
  frictions: Array<[PartyId, PartyId]>;
  majority: boolean;
  valid: boolean;
  /** 0–100 starting coalition stability */ stability: number;
  /** seat-weighted hawkishness −2 … +2 */ hawk: number;
  type: CoalitionType;
}

export function checkCoalition(members: PartyId[]): CoalitionCheck {
  const set = new Set(members);
  const seats = members.reduce((s, p) => s + PARTIES[p].seats, 0);
  const vetoes: Array<[PartyId, PartyId]> = [];
  const frictions: Array<[PartyId, PartyId]> = [];
  const seen = new Set<string>();
  for (const p of members) {
    for (const r of PARTIES[p].refuses) if (set.has(r)) vetoes.push([p, r]);
    for (const f of PARTIES[p].friction) {
      const key = [p, f].sort().join("|");
      if (set.has(f) && !seen.has(key)) {
        seen.add(key);
        frictions.push([p, f]);
      }
    }
  }
  const hawk = seats === 0 ? 0 : members.reduce((s, p) => s + PARTIES[p].hawk * PARTIES[p].seats, 0) / seats;
  const spread = members.length === 0 ? 0 : Math.max(...members.map((p) => PARTIES[p].hawk)) - Math.min(...members.map((p) => PARTIES[p].hawk));
  const majority = seats >= MAJORITY;
  const stability = Math.round(Math.max(20, Math.min(85, 60 + Math.min(8, seats - 61) * 2 - spread * 5 - frictions.length * 3)));
  const type: CoalitionType = hawk >= 1.1 ? "RIGHT_WING_BLOC" : hawk <= 0.1 ? "CENTER_LEFT_BLOC" : "BENNETT_LIEBERMAN_GOLAN_ABBAS";
  return { seats, vetoes, frictions, majority, valid: majority && vetoes.length === 0, stability, hawk, type };
}

/** Partner patience change when a doctrine is adopted (assumption). */
export const DOCTRINE_REACTIONS: Record<PolicyTrack, Record<PartyTag, number>> = {
  RADICAL_RIGHT_DEPORTATION: { far_right: 20, right: -15, haredi: -10, center: -70, left: -100, arab: -100 },
  CONSERVATIVE_RIGHT_ANNEXATION: { far_right: 15, right: 5, haredi: 0, center: -35, left: -70, arab: -80 },
  PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP: { far_right: -35, right: -5, haredi: 0, center: 10, left: 5, arab: 5 },
  CENTER_LEFT_PA_RETURN: { far_right: -90, right: -45, haredi: -15, center: 5, left: 15, arab: 15 },
  RADICAL_LEFT_UNILATERAL_WITHDRAWAL: { far_right: -100, right: -80, haredi: -45, center: -40, left: 10, arab: 15 },
};
