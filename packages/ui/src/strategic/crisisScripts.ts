/** Crisis scenes: what the map shows while each crisis builds up to the
 *  cabinet halt, and the visual consequences of every option afterwards.
 *  The pre-halt part depends only on the pending state, so choosing an option
 *  extends the halted script without changing what was already shown. */

import { strategic } from "@engine";
import {
  BASES, EGYPT_BORDER, EGYPT_FORMATIONS, ORIGINS, SINAI_BUFFER, TREATY_LINES, TUNNEL_ROUTES, REGIONS,
  boxAround, westBankRing, type FocusId, type LonLat,
} from "./geo";
import {
  FACTION_COLORS, baseTimeFor, buildSalvo, endTime, finalize, launchMarkers, rngFrom, standingForces, strikes, unit,
  type Blast, type FocusCue, type Launch, type Marker, type TacticalScript, type UnitMove, type ZoneFx,
} from "./scenarios";

type Bi = strategic.Bi;
type CrisisId = strategic.CrisisId;
type OptionId = strategic.CrisisOptionId;
type Branch = strategic.GambleBranch;

interface Parts {
  launches: Launch[];
  units: UnitMove[];
  zones: ZoneFx[];
  markers: Marker[];
  blasts: Blast[];
  focus: FocusCue[];
  /** hide pre-halt units from this time */ retire: Array<{ id: string; t: number }>;
  /** end pre-halt zones at this time */ endZones: Array<{ id: string; t: number }>;
}

const empty = (): Parts => ({ launches: [], units: [], zones: [], markers: [], blasts: [], focus: [], retire: [], endZones: [] });

interface Scene {
  focus: FocusId;
  pre(r: () => number): Parts;
  after: Record<string, (r: () => number, a: number, branch: Branch | null) => Parts>;
}

const WAR_WARN = "#E3B341";
const zone = (id: string, kind: ZoneFx["kind"], path: LonLat[], t0: number, t1: number, color: string, label: Bi | null = null): ZoneFx =>
  ({ id, kind, path, t0, t1, color, label });
const mk = (t: number, kind: Marker["kind"], he: string, en: string): Marker => ({ t, kind, label: { he, en } });

// ---------------------------------------------------------------------------
// 1 · forced-transfer directive → Egyptian ballistic attack
// ---------------------------------------------------------------------------

const EGYPT_BALLISTIC: Scene = {
  focus: "tel_aviv",
  pre(r) {
    const p = empty();
    p.launches.push(
      ...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai", targets: ["tel_aviv", "tel_aviv", "ashdod", "tel_aviv", "dimona"], count: 9, tStart: 170, spacing: 7 }, r, "w1"),
      ...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashkelon", "beersheba", "tel_aviv"], count: 6, tStart: 210, spacing: 9 }, r, "w1"),
    );
    p.units.push(
      ...EGYPT_FORMATIONS.map((f, i) => unit(f.id, "egypt", i === 1 ? "armor" : "mech", "XX", f.label, f.from, f.to, 25 + i * 15, 150 + i * 15)),
      unit("egn-med", "egypt", "naval", "", { he: "חיל הים המצרי · פורט סעיד", en: "Egyptian Navy · Port Said" }, BASES.egypt_navy_port_said),
      unit("egn-red", "egypt", "naval", "", { he: "חיל הים המצרי · ים סוף", en: "Egyptian Navy · Red Sea" }, BASES.egypt_navy_red_sea),
    );
    p.zones.push(zone("egypt-border", "border_alert", EGYPT_BORDER, 12, 1e9, FACTION_COLORS.egypt));
    p.markers.push(
      mk(0, "crisis", "הנחיית טרנספר נכנסת לתוקף", "Transfer directive takes effect"),
      mk(12, "alert", "התראות גבול בחזית מצרים", "Border alerts on the Egyptian front"),
      mk(25, "mobilize", "ארמיות 2 ו-3 נערכות לאורך התעלה", "2nd & 3rd Armies deploy along the canal"),
    );
    p.focus.push({ t: 0, focus: "israel" }, { t: 230, focus: "tel_aviv" });
    return p;
  },
  after: {
    A_CANCEL_TRANSFER(_r, a) {
      const p = empty();
      p.markers.push(mk(a + 8, "ceasefire", "הטרנספר בוטל — האש המצרית נפסקת", "Transfer cancelled — Egyptian fire stops"));
      p.units.push(...EGYPT_FORMATIONS.map((f, i) => unit(`${f.id}-back`, "egypt", "mech", "XX", f.label, f.to, f.from, a + 40 + i * 10, a + 180 + i * 10)));
      p.retire.push(...EGYPT_FORMATIONS.map((f, i) => ({ id: f.id, t: a + 40 + i * 10 })));
      p.endZones.push({ id: "egypt-border", t: a + 120 });
      p.focus.push({ t: a + 30, focus: "sinai" });
      return p;
    },
    D_US_MEDIATION(r, a) {
      const p = empty();
      p.launches.push(...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai", targets: ["tel_aviv"], count: 2, tStart: a + 4, spacing: 6 }, r, "d"));
      p.units.push(unit("us-csg-move", "us", "carrier", "", { he: "נושאת מטוסים אמריקאית", en: "US carrier group" }, BASES.us_csg_med, [32.9, 32.4], a + 10, a + 200));
      p.retire.push({ id: "us-csg", t: a + 10 });
      p.markers.push(mk(a + 20, "info", "שליח אמריקאי בדרך לקהיר", "US envoy en route to Cairo"), mk(a + 150, "ceasefire", "הפסקת אש בתיווך ארה\"ב", "US-brokered ceasefire"));
      p.units.push(...EGYPT_FORMATIONS.map((f, i) => unit(`${f.id}-back`, "egypt", "mech", "XX", f.label, f.to, f.from, a + 170 + i * 10, a + 310 + i * 10)));
      p.retire.push(...EGYPT_FORMATIONS.map((f, i) => ({ id: f.id, t: a + 170 + i * 10 })));
      p.endZones.push({ id: "egypt-border", t: a + 170 });
      p.focus.push({ t: a + 30, focus: "israel" });
      return p;
    },
    B_AIR_RETALIATION(r, a) {
      const p = empty();
      const targets: LonLat[] = [ORIGINS.sinai.pos, ORIGINS.sinai_south.pos, ...EGYPT_FORMATIONS.map((f) => f.to)];
      const names: Bi[] = [ORIGINS.sinai.name, ORIGINS.sinai_south.name, ...EGYPT_FORMATIONS.map((f) => f.label)];
      p.launches.push(
        ...strikes([...targets, ...targets], names, a + 15, r, "b"),
        ...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai_south", targets: ["tel_aviv", "haifa", "dimona", "tel_aviv"], count: 12, tStart: a + 110, spacing: 6 }, r, "b2"),
        ...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "dimona", "haifa"], count: 6, tStart: a + 60, spacing: 8 }, r, "b3"),
        ...buildSalvo({ faction: "hezbollah", kind: "rocket", origin: "south_lebanon", targets: ["haifa", "afula"], count: 10, tStart: a + 90, spacing: 5 }, r, "b4"),
      );
      p.units.push(unit("egn-tiran", "egypt", "naval", "", { he: "סגירת מצרי טיראן", en: "Closing the Straits of Tiran" }, BASES.egypt_navy_red_sea, [34.45, 27.98], a + 5, a + 160));
      p.retire.push({ id: "egn-red", t: a + 5 });
      p.markers.push(mk(a + 5, "alert", "מצרי טיראן ותעלת סואץ נסגרים לשיט ישראלי", "Tiran Straits and Suez closed to Israeli shipping"));
      p.focus.push({ t: a + 10, focus: "sinai" }, { t: a + 200, focus: "theater" }, { t: a + 560, focus: "israel" });
      return p;
    },
    C_GROUND_INVASION_SINAI(r, a) {
      const p = empty();
      p.units.push(
        unit("idf-armor-1", "idf", "armor", "XX", { he: "אוגדה משוריינת", en: "Armored division" }, [34.35, 31.26], [33.95, 31.1], a + 15, a + 320),
        unit("idf-armor-2", "idf", "armor", "X", { he: "חטיבת שריון", en: "Armored brigade" }, [34.45, 30.9], [34.05, 30.72], a + 30, a + 340),
        ...EGYPT_FORMATIONS.map((f, i) => unit(`${f.id}-cross`, "egypt", "mech", "XX", f.label, f.to, [f.to[0] + 0.9, f.to[1] + 0.05], a + 40 + i * 12, a + 330 + i * 12)),
      );
      p.retire.push(...EGYPT_FORMATIONS.map((f, i) => ({ id: f.id, t: a + 40 + i * 12 })));
      p.zones.push(zone("sinai-buffer", "contested", SINAI_BUFFER, a + 60, 1e9, FACTION_COLORS.egypt));
      p.launches.push(
        ...strikes([[33.2, 30.9], [32.9, 30.5], ORIGINS.sinai.pos], [{ he: "ארמיה 2", en: "2nd Army" }, { he: "ארמיה 3", en: "3rd Army" }, ORIGINS.sinai.name], a + 20, r, "c"),
        ...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai_south", targets: ["tel_aviv", "beersheba", "dimona", "eilat"], count: 14, tStart: a + 90, spacing: 5 }, r, "c2"),
        ...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "haifa"], count: 8, tStart: a + 40, spacing: 7 }, r, "c3"),
        ...buildSalvo({ faction: "iraq", kind: "drone", origin: "western_iraq", targets: ["eilat", "haifa"], count: 8, tStart: a + 30, spacing: 12, battery: "coalition_cap" }, r, "c4"),
      );
      p.markers.push(mk(a + 15, "mobilize", "כוחות צה\"ל חוצים לרפיח ולסיני", "IDF forces cross into Rafah and Sinai"));
      p.focus.push({ t: a + 10, focus: "sinai" }, { t: a + 260, focus: "theater" }, { t: a + 620, focus: "israel" });
      return p;
    },
  },
};

// ---------------------------------------------------------------------------
// 2 · PA security coordination collapses
// ---------------------------------------------------------------------------

const WB_CITIES = { jenin: ORIGINS.jenin.pos, nablus: ORIGINS.nablus.pos, tulkarm: ORIGINS.tulkarm.pos, ramallah: [35.2, 31.9] as LonLat };
const GREEN_LINE_STAGING: Record<keyof typeof WB_CITIES, LonLat> = {
  jenin: [35.22, 32.56], nablus: [35.0, 32.18], tulkarm: [34.93, 32.31], ramallah: [34.98, 31.86],
};
const WB_NAMES: Record<keyof typeof WB_CITIES, Bi> = {
  jenin: ORIGINS.jenin.name, nablus: ORIGINS.nablus.name, tulkarm: ORIGINS.tulkarm.name, ramallah: { he: "רמאללה", en: "Ramallah" },
};

const PA_COLLAPSE: Scene = {
  focus: "west_bank",
  pre(r) {
    const p = empty();
    for (const k of ["jenin", "nablus", "tulkarm"] as const) {
      p.zones.push(zone(`wb-${k}`, "contested", boxAround(WB_CITIES[k], 0.05), 20, 1e9, FACTION_COLORS.militants, WB_NAMES[k]));
      p.units.push(unit(`pa-${k}`, "pa", "police", "II", { he: `גדוד מנגנון · ${WB_NAMES[k].he}`, en: `PA battalion · ${WB_NAMES[k].en}` }, WB_CITIES[k], WB_CITIES[k], 30, 30));
    }
    p.units.push(
      unit("mil-jenin", "militants", "infantry", "II", { he: "חמושים · מחנה ג'נין", en: "Militants · Jenin camp" }, [35.29, 32.45], [35.26, 32.5], 40, 160),
      unit("mil-nablus", "militants", "infantry", "II", { he: "חמושים · שכם", en: "Militants · Nablus" }, [35.27, 32.21], [35.2, 32.24], 60, 180),
      ...(["jenin", "nablus", "tulkarm", "ramallah"] as const).map((k) => unit(`idf-stage-${k}`, "idf", k === "jenin" ? "armor" : "infantry", "X", { he: `חטיבה · מול ${WB_NAMES[k].he}`, en: `Brigade · facing ${WB_NAMES[k].en}` }, GREEN_LINE_STAGING[k])),
    );
    p.launches.push(
      ...buildSalvo({ faction: "militants", kind: "rocket", origin: "jenin", targets: ["afula"], count: 4, tStart: 90, spacing: 12, scatter: 0.05 }, r, "pa1"),
      ...buildSalvo({ faction: "militants", kind: "rocket", origin: "tulkarm", targets: ["netanya"], count: 3, tStart: 130, spacing: 14, scatter: 0.04 }, r, "pa2"),
      ...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashkelon", "ashdod"], count: 4, tStart: 150, spacing: 10 }, r, "pa3"),
    );
    p.blasts.push({ id: "pa-hq", pos: [35.25, 32.23], t: 55, heavy: false }, { id: "pa-hq2", pos: [35.3, 32.47], t: 70, heavy: false });
    p.markers.push(
      mk(5, "crisis", "התיאום הביטחוני הושעה", "Security coordination suspended"),
      mk(30, "alert", "גדודי מנגנונים בג'נין, שכם וטול כרם עוברים צד", "PA battalions in Jenin, Nablus and Tulkarm defect"),
      mk(55, "impact", "מטה הרשות בצפון השומרון הושתלט", "PA northern headquarters overrun"),
    );
    p.focus.push({ t: 0, focus: "west_bank" });
    return p;
  },
  after: {
    PA_DEFENSIVE_SHIELD_2(r, a) {
      const p = empty();
      for (const [i, k] of (["jenin", "nablus", "tulkarm", "ramallah"] as const).entries()) {
        p.units.push(unit(`idf-enter-${k}`, "idf", k === "jenin" ? "armor" : "mech", "X", { he: `חומת מגן 2 · ${WB_NAMES[k].he}`, en: `Defensive Shield 2 · ${WB_NAMES[k].en}` }, GREEN_LINE_STAGING[k], WB_CITIES[k], a + 20 + i * 15, a + 260 + i * 15));
        p.retire.push({ id: `idf-stage-${k}`, t: a + 20 + i * 15 });
      }
      p.launches.push(...strikes([WB_CITIES.jenin, [35.27, 32.21]], [WB_NAMES.jenin, WB_NAMES.nablus], a + 25, r, "ds", [BASES.ramat_david]));
      for (const k of ["jenin", "nablus", "tulkarm"] as const) {
        p.retire.push({ id: `pa-${k}`, t: a + 280 });
        p.endZones.push({ id: `wb-${k}`, t: a + 320 });
      }
      p.retire.push({ id: "mil-jenin", t: a + 220 }, { id: "mil-nablus", t: a + 240 });
      p.blasts.push(...[0, 1, 2, 3].map((i) => ({ id: `ds-b${i}`, pos: [35.28 - i * 0.02, 32.44 - i * 0.07] as LonLat, t: a + 200 + i * 20, heavy: false })));
      p.markers.push(mk(a + 10, "mobilize", "מבצע \"חומת מגן 2\" יוצא לדרך", "Operation \"Defensive Shield 2\" begins"), mk(a + 330, "success", "הערים אובטחו; המנגנונים שערקו פורקו", "Cities secured; defecting services dismantled"));
      return p;
    },
    PA_US_STABILIZATION(r, a) {
      const p = empty();
      p.units.push(unit("us-convoy", "us", "supply", "II", { he: "שיירת סיוע אמריקאית", en: "US assistance convoy" }, [35.55, 31.87], WB_CITIES.ramallah, a + 20, a + 300));
      p.launches.push(...buildSalvo({ faction: "militants", kind: "rocket", origin: "jenin", targets: ["afula"], count: 4, tStart: a + 60, spacing: 20, scatter: 0.05 }, r, "us1"));
      p.markers.push(mk(a + 20, "info", "סיוע אמריקאי חירום חוצה את גשר אלנבי", "Emergency US assistance crosses the Allenby Bridge"), mk(a + 120, "alert", "החמושים ממשיכים לירות מג'נין", "Militants keep firing from Jenin"));
      return p;
    },
    PA_RETREAT_TO_BARRIER(r, a) {
      const p = empty();
      p.zones.push(zone("barrier", "barrier", [...westBankRing(REGIONS), westBankRing(REGIONS)[0]], a + 10, 1e9, WAR_WARN, { he: "סגר מלא", en: "Full closure" }));
      for (const k of ["jenin", "nablus", "tulkarm", "ramallah"] as const) {
        const s = GREEN_LINE_STAGING[k];
        p.units.push(unit(`idf-line-${k}`, "idf", "infantry", "X", { he: "כוחות על קו התפר", en: "Seam-line forces" }, s, [s[0] - 0.06, s[1]], a + 20, a + 120));
        p.retire.push({ id: `idf-stage-${k}`, t: a + 20 });
      }
      p.launches.push(
        ...buildSalvo({ faction: "militants", kind: "rocket", origin: "jenin", targets: ["afula", "haifa"], count: 8, tStart: a + 40, spacing: 10, scatter: 0.05 }, r, "rb1"),
        ...buildSalvo({ faction: "militants", kind: "rocket", origin: "tulkarm", targets: ["netanya", "tel_aviv"], count: 7, tStart: a + 70, spacing: 11, scatter: 0.04 }, r, "rb2"),
      );
      p.markers.push(mk(a + 10, "alert", "סגר מלא לאורך גדר ההפרדה", "Full closure along the separation barrier"));
      p.focus.push({ t: a + 30, focus: "israel" });
      return p;
    },
  },
};

// ---------------------------------------------------------------------------
// 3 · peace-treaty breach in Sinai
// ---------------------------------------------------------------------------

const EG_DIV_FROM: LonLat = [32.05, 30.62];
const EG_DIV_TO: LonLat = [33.3, 30.66];
const EG_CONVOY_FROM: LonLat = [32.3, 30.95];
const EG_CONVOY_TO: LonLat = [33.15, 30.98];

const EGYPT_TREATY: Scene = {
  focus: "sinai",
  pre() {
    const p = empty();
    for (const l of TREATY_LINES) p.zones.push(zone(l.id, "treaty_line", l.path, 0, 1e9, "#7EE787", l.label));
    p.units.push(
      unit("idf-philadelphi", "idf", "armor", "XX", { he: "אוגדה 162 · פילדלפי המורחב", en: "162nd Div. · expanded Philadelphi" }, [34.4, 31.3], [34.22, 31.22], 10, 150),
      unit("eg-div", "egypt", "mech", "XX", { he: "דיביזיה ממוכנת · חוצה לאזור B", en: "Mech. division · crossing into Zone B" }, EG_DIV_FROM, EG_DIV_TO, 40, 280),
      unit("eg-convoy", "egypt", "supply", "III", { he: "שיירות אספקה מצריות", en: "Egyptian supply convoys" }, EG_CONVOY_FROM, EG_CONVOY_TO, 90, 300),
      unit("mfo-north", "mfo", "monitor", "", { he: "MFO · אל-גורה", en: "MFO · El Gorah" }, [34.13, 31.07]),
      unit("mfo-south", "mfo", "monitor", "", { he: "MFO · שארם א-שייח'", en: "MFO · Sharm el-Sheikh" }, [34.33, 27.97]),
      unit("egn-med", "egypt", "naval", "", { he: "חיל הים המצרי · פורט סעיד", en: "Egyptian Navy · Port Said" }, BASES.egypt_navy_port_said),
      unit("egn-red", "egypt", "naval", "", { he: "חיל הים המצרי · ים סוף", en: "Egyptian Navy · Red Sea" }, BASES.egypt_navy_red_sea),
    );
    p.zones.push(zone("egypt-border", "border_alert", EGYPT_BORDER, 70, 1e9, FACTION_COLORS.egypt));
    p.markers.push(
      mk(5, "crisis", "צה\"ל נכנס לציר פילדלפי המורחב", "IDF enters the expanded Philadelphi corridor"),
      mk(40, "mobilize", "דיביזיה מצרית חוצה את התעלה לעבר אזור B", "Egyptian division crosses the canal toward Zone B"),
      mk(90, "alert", "שיירות אספקה נעות מזרחה; ה-MFO מדווח על הפרות", "Supply convoys move east; MFO reports violations"),
    );
    p.focus.push({ t: 0, focus: "sinai" });
    return p;
  },
  after: {
    EGT_STOP_AND_MONITORS(_r, a) {
      const p = empty();
      p.units.push(
        unit("idf-philadelphi-back", "idf", "armor", "XX", { he: "אוגדה 162 · חוזרת", en: "162nd Div. · pulling back" }, [34.22, 31.22], [34.42, 31.32], a + 15, a + 160),
        unit("eg-div-back", "egypt", "mech", "XX", { he: "דיביזיה מצרית · חוזרת לאזור A", en: "Egyptian division · back to Zone A" }, EG_DIV_TO, [32.6, 30.62], a + 40, a + 260),
        ...[[34.25, 31.2], [34.45, 30.7], [34.7, 29.95]].map((pos, i) => unit(`mfo-border-${i}`, "mfo", "monitor", "", { he: "כוח פיקוח בינלאומי", en: "International monitors" }, [34.13, 31.07], pos as LonLat, a + 60 + i * 20, a + 260 + i * 20)),
      );
      p.retire.push({ id: "idf-philadelphi", t: a + 15 }, { id: "eg-div", t: a + 40 }, { id: "eg-convoy", t: a + 120 });
      p.endZones.push({ id: "egypt-border", t: a + 200 });
      p.markers.push(mk(a + 10, "ceasefire", "צה\"ל עוצר; כוח פיקוח בינלאומי נפרס בגבול", "IDF halts; international monitors deploy on the border"));
      return p;
    },
    EGT_PREEMPTIVE_STRIKE(r, a) {
      const p = empty();
      p.launches.push(
        ...strikes([EG_CONVOY_TO, EG_DIV_TO, [32.9, 30.95], [33.05, 30.7]], [{ he: "שיירות אספקה", en: "Supply convoys" }, { he: "דיביזיה ממוכנת", en: "Mechanized division" }], a + 15, r, "pe"),
        ...buildSalvo({ faction: "egypt", kind: "ballistic", origin: "sinai_south", targets: ["beersheba", "dimona", "eilat", "tel_aviv"], count: 10, tStart: a + 110, spacing: 6 }, r, "pe2"),
      );
      p.units.push(unit("egn-tiran", "egypt", "naval", "", { he: "סגירת מצרי טיראן", en: "Closing the Straits of Tiran" }, BASES.egypt_navy_red_sea, [34.45, 27.98], a + 30, a + 200));
      p.retire.push({ id: "egn-red", t: a + 30 }, { id: "eg-convoy", t: a + 90 });
      p.zones.push(zone("sinai-buffer", "contested", SINAI_BUFFER, a + 90, 1e9, FACTION_COLORS.egypt));
      p.markers.push(mk(a + 15, "strike", "חיל האוויר תוקף שיירות מצריות בסיני", "Air Force strikes Egyptian convoys in Sinai"), mk(a + 30, "alert", "מצרים סוגרת את מצרי טיראן", "Egypt closes the Straits of Tiran"));
      p.focus.push({ t: a + 200, focus: "israel" });
      return p;
    },
    EGT_US_IMF_PRESSURE(_r, a) {
      const p = empty();
      p.units.push(
        unit("us-csg-move", "us", "carrier", "", { he: "נושאת מטוסים אמריקאית", en: "US carrier group" }, BASES.us_csg_med, [32.8, 32.3], a + 10, a + 220),
        unit("eg-div-back", "egypt", "mech", "XX", { he: "דיביזיה מצרית · חוזרת לאזור A", en: "Egyptian division · back to Zone A" }, EG_DIV_TO, [32.6, 30.62], a + 140, a + 360),
      );
      p.retire.push({ id: "us-csg", t: a + 10 }, { id: "eg-div", t: a + 140 }, { id: "eg-convoy", t: a + 160 });
      p.endZones.push({ id: "egypt-border", t: a + 260 });
      p.markers.push(mk(a + 15, "info", "ערבויות אמריקאיות ולחץ קרן המטבע על קהיר", "US guarantees and IMF pressure on Cairo"), mk(a + 140, "ceasefire", "הכוחות המצריים נסוגים לאזור A", "Egyptian forces withdraw to Zone A"));
      return p;
    },
  },
};

// ---------------------------------------------------------------------------
// 4 · combined Iranian / Iraqi missile and drone barrage
// ---------------------------------------------------------------------------

const COALITION_JETS: Array<{ id: string; label: Bi; pos: LonLat }> = [
  { id: "cap-us", label: { he: "USAF · מעל ירדן", en: "USAF · over Jordan" }, pos: [37.3, 31.9] },
  { id: "cap-uk", label: { he: "RAF · מעל ירדן", en: "RAF · over Jordan" }, pos: [38.4, 32.5] },
  { id: "cap-jo", label: { he: "חיל האוויר הירדני", en: "Royal Jordanian AF" }, pos: [36.5, 31.3] },
];

const IRAN_BARRAGE: Scene = {
  focus: "theater",
  pre(r) {
    const p = empty();
    p.units.push(...COALITION_JETS.map((j) => unit(j.id, "coalition", "air", "", j.label, j.pos)));
    p.launches.push(
      ...buildSalvo({ faction: "iran", kind: "drone", origin: "kermanshah", targets: ["haifa", "tel_aviv", "dimona"], count: 16, tStart: 0, spacing: 6, battery: "coalition_cap" }, r, "ir-d"),
      ...buildSalvo({ faction: "iraq", kind: "drone", origin: "western_iraq", targets: ["eilat", "haifa"], count: 8, tStart: 40, spacing: 6, battery: "coalition_cap" }, r, "iq-d"),
      ...buildSalvo({ faction: "iran", kind: "cruise", origin: "kermanshah", targets: ["haifa", "tel_aviv"], count: 6, tStart: 60, spacing: 12 }, r, "ir-c"),
      ...buildSalvo({ faction: "iran", kind: "ballistic", origin: "isfahan", targets: ["tel_aviv", "dimona", "haifa"], count: 8, tStart: 300, spacing: 7 }, r, "ir-b1"),
      ...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tabriz", targets: ["tel_aviv", "haifa"], count: 6, tStart: 320, spacing: 8 }, r, "ir-b2"),
    );
    p.markers.push(
      mk(0, "crisis", "גל כטב\"מים ממערב איראן", "Drone wave from western Iran"),
      mk(40, "launch", "מיליציות בעיראק מצטרפות", "Iraqi militias join"),
      mk(300, "alert", "מטח טילים בליסטיים מאספהאן ומתבריז", "Ballistic salvo from Isfahan and Tabriz"),
    );
    p.focus.push({ t: 0, focus: "theater" });
    return p;
  },
  after: {
    IRN_WIDE_RETALIATION(r, a) {
      const p = empty();
      const targets: LonLat[] = [[48.29, 30.35], [50.32, 29.24], [51.73, 33.72], [51.67, 32.65]];
      const names: Bi[] = [{ he: "זיקוק אבאדן", en: "Abadan refinery" }, { he: "מסוף חרג", en: "Kharg terminal" }, { he: "נתנז", en: "Natanz" }, { he: "אספהאן", en: "Isfahan" }];
      p.launches.push(
        ...strikes([...targets, ...targets], names, a + 15, r, "wr"),
        ...buildSalvo({ faction: "iran", kind: "ballistic", origin: "tehran", targets: ["tel_aviv", "haifa", "dimona"], count: 12, tStart: a + 380, spacing: 6 }, r, "wr2"),
        ...buildSalvo({ faction: "hezbollah", kind: "rocket", origin: "south_lebanon", targets: ["haifa", "afula"], count: 12, tStart: a + 120, spacing: 5 }, r, "wr3"),
      );
      p.markers.push(mk(a + 15, "strike", "תקיפה על מתקני נפט וגרעין באיראן", "Strikes on Iranian oil and nuclear sites"), mk(a + 200, "alert", "זינוק במחירי האנרגיה", "Energy prices spike"));
      p.focus.push({ t: a + 5, focus: "theater" });
      return p;
    },
    IRN_DEFENSIVE_SURGICAL(r, a) {
      const p = empty();
      p.launches.push(...strikes([ORIGINS.kermanshah.pos, ORIGINS.tabriz.pos, ORIGINS.isfahan.pos], [ORIGINS.kermanshah.name, ORIGINS.tabriz.name, ORIGINS.isfahan.name], a + 20, r, "ds"));
      p.units.push(unit("us-ddg-move", "us", "naval", "", { he: "משחתת אמריקאית · מיירטת", en: "US destroyer · intercepting" }, BASES.us_ddg_red_sea, [35.5, 27.2], a + 10, a + 250));
      p.retire.push({ id: "us-ddg", t: a + 10 });
      p.markers.push(mk(a + 20, "strike", "תקיפה כירורגית על אתרי השיגור", "Surgical strike on launch sites"), mk(a + 60, "info", "ארה\"ב מתגברת את ההגנה האווירית", "US reinforces air defense"));
      return p;
    },
    IRN_REGIONAL_ALLIANCE(r, a) {
      const p = empty();
      p.units.push(...COALITION_JETS.map((j, i) => unit(`${j.id}-fwd`, "coalition", "air", "", j.label, j.pos, [41.5 + i * 0.6, 33.2 - i * 0.3], a + 10, a + 260)));
      p.retire.push(...COALITION_JETS.map((j) => ({ id: j.id, t: a + 10 })));
      p.launches.push(
        ...strikes([ORIGINS.kermanshah.pos, [46.4, 34.1], ORIGINS.tabriz.pos], [ORIGINS.kermanshah.name, ORIGINS.kermanshah.name, ORIGINS.tabriz.name], a + 60, r, "ra"),
        ...strikes([ORIGINS.kermanshah.pos, ORIGINS.isfahan.pos], [ORIGINS.kermanshah.name, ORIGINS.isfahan.name], a + 80, r, "ra2", COALITION_JETS.map((j) => j.pos), "coalition"),
      );
      p.markers.push(mk(a + 10, "info", "ירדן ומדינות המפרץ פותחות מרחב אווירי", "Jordan and the Gulf open their airspace"), mk(a + 60, "strike", "תקיפה משותפת על מערכי השיגור", "Joint strike on the launch array"));
      return p;
    },
  },
};

// ---------------------------------------------------------------------------
// 5 · offensive tunnel network exposed
// ---------------------------------------------------------------------------

const KEREM_SHALOM: LonLat = [34.29, 31.225];

const TUNNELS: Scene = {
  focus: "gaza",
  pre(r) {
    const p = empty();
    TUNNEL_ROUTES.forEach((route, i) => p.zones.push(zone(`tunnel-${i}`, "tunnels", route, 20 + i * 12, 1e9, "#D29922", i === 0 ? { he: "מערך מנהרות", en: "Tunnel network" } : null)));
    p.units.push(
      unit("reg-rafah", "regional", "police", "II", { he: "כוח שיטור אזורי · רפיח", en: "Regional police · Rafah" }, [34.25, 31.29]),
      unit("reg-khan", "regional", "police", "II", { he: "כוח שיטור אזורי · ח'אן יונס", en: "Regional police · Khan Yunis" }, [34.31, 31.35]),
      unit("idf-yahalom", "idf", "engineer", "II", { he: "יחידת יהל\"ם", en: "Yahalom engineers" }, [34.33, 31.21]),
      unit("hamas-cell", "militants", "sof", "", { he: "חוליית מנהרה", en: "Tunnel cell" }, [34.29, 31.28], [34.3, 31.25], 60, 200),
    );
    p.launches.push(...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashkelon", "ashdod"], count: 3, tStart: 120, spacing: 15 }, r, "tn"));
    p.markers.push(
      mk(10, "crisis", "פיר התקפי אותר ליד כרם שלום", "Attack shaft detected near Kerem Shalom"),
      mk(60, "alert", "המערך ממופה: מנהרות חוצות את ציר פילדלפי", "Network mapped: tunnels cross the Philadelphi corridor"),
    );
    p.focus.push({ t: 0, focus: "gaza" });
    return p;
  },
  after: {
    TUN_FREEZE_FUNDS(_r, a) {
      const p = empty();
      p.markers.push(mk(a + 10, "info", "כספי השיקום הוקפאו עד לסיום החקירה", "Reconstruction funds frozen pending the inquiry"));
      p.units.push(unit("idf-yahalom-seal", "idf", "engineer", "II", { he: "יהל\"ם · אוטמת פירים", en: "Yahalom · sealing shafts" }, [34.33, 31.21], KEREM_SHALOM, a + 30, a + 140));
      p.retire.push({ id: "idf-yahalom", t: a + 30 });
      p.blasts.push({ id: "seal", pos: [34.3, 31.235], t: a + 150, heavy: false });
      return p;
    },
    TUN_ULTIMATUM_48H(r, a, branch) {
      const p = empty();
      p.markers.push(mk(a + 5, "alert", "אולטימטום 48 שעות לכוח השיטור האזורי", "48-hour ultimatum to the regional police"));
      if (branch === "failure") {
        p.units.push(unit("hamas-raid", "militants", "sof", "", { he: "חדירה דרך מנהרה", en: "Tunnel infiltration" }, [34.3, 31.25], [34.37, 31.28], a + 150, a + 240));
        p.retire.push({ id: "hamas-cell", t: a + 150 });
        p.launches.push(...buildSalvo({ faction: "gaza", kind: "rocket", origin: "gaza", targets: ["ashkelon", "ashdod", "beersheba", "tel_aviv"], count: 14, tStart: a + 160, spacing: 6 }, r, "uf"));
        p.markers.push(mk(a + 150, "failure", "האולטימטום נכשל: חדירה דרך מנהרה ומטח רקטות", "Ultimatum failed: tunnel infiltration and a rocket barrage"));
      } else {
        p.units.push(unit("reg-demo", "regional", "engineer", "II", { he: "כוח אזורי · הריסת מנהרות", en: "Regional force · tunnel demolition" }, [34.25, 31.29], [34.27, 31.25], a + 40, a + 150));
        p.retire.push({ id: "hamas-cell", t: a + 120 });
        TUNNEL_ROUTES.forEach((route, i) => {
          p.blasts.push(...route.map((pos, j) => ({ id: `demo-${i}-${j}`, pos, t: a + 160 + i * 12 + j * 5, heavy: j === 1 })));
          p.endZones.push({ id: `tunnel-${i}`, t: a + 180 + i * 12 });
        });
        p.markers.push(mk(a + 160, "success", "הכוח האזורי השמיד את התשתית בעצמו", "The regional force destroyed the network itself"));
      }
      return p;
    },
    TUN_SPECIAL_FORCES(_r, a) {
      const p = empty();
      p.units.push(unit("idf-sof", "idf", "sof", "", { he: "כוחות מיוחדים", en: "Special forces" }, KEREM_SHALOM, [34.26, 31.27], a + 15, a + 110));
      p.retire.push({ id: "hamas-cell", t: a + 110 });
      TUNNEL_ROUTES.forEach((route, i) => {
        p.blasts.push(...route.map((pos, j) => ({ id: `sof-${i}-${j}`, pos, t: a + 120 + i * 10 + j * 4, heavy: j === 1 })));
        p.endZones.push({ id: `tunnel-${i}`, t: a + 140 + i * 10 });
      });
      p.markers.push(mk(a + 15, "mobilize", "כוחות מיוחדים נכנסים לרפיח", "Special forces enter Rafah"), mk(a + 120, "success", "פירי המנהרות הושמדו", "Tunnel shafts destroyed"));
      return p;
    },
  },
};

export const CRISIS_SCENES: Record<CrisisId, Scene> = {
  EGYPTIAN_BALLISTIC_ATTACK: EGYPT_BALLISTIC,
  PA_SECURITY_COLLAPSE: PA_COLLAPSE,
  EGYPT_TREATY_BREACH: EGYPT_TREATY,
  IRAN_COMBINED_BARRAGE: IRAN_BARRAGE,
  TUNNEL_NETWORK_EXPOSED: TUNNELS,
};

export function crisisFocus(id: CrisisId): FocusId {
  return CRISIS_SCENES[id].focus;
}

/** Halt once the pre-halt picture has played out: missiles/rockets resolved, units in place.
 *  Slow drone swarms keep flying through the decision. */
function haltTime(p: Parts): number {
  const shots = p.launches.filter((l) => l.kind !== "drone").reduce((m, l) => Math.max(m, endTime(l)), 0);
  const moves = p.units.reduce((m, u) => Math.max(m, u.t1), 0);
  const blasts = p.blasts.reduce((m, b) => Math.max(m, b.t), 0);
  const markers = p.markers.reduce((m, k) => Math.max(m, k.t), 0);
  return Math.ceil(Math.max(120, shots + 12, moves + 12, blasts + 20, markers + 25));
}

/**
 * Script for a crisis. `sim` must be the state with the crisis PENDING (the
 * aftermath is keyed on it so the pre-halt picture is identical).
 */
export function buildCrisisScript(
  sim: strategic.SimulationState,
  option: OptionId | null,
  branch: Branch | null = null,
): TacticalScript {
  if (sim.pendingCrisis === null) throw new Error("buildCrisisScript needs a state with a pending crisis");
  const crisisId = sim.pendingCrisis.id;
  const title = strategic.CRISIS_DEFS[crisisId].title;
  const scene = CRISIS_SCENES[crisisId];
  const key = `crisis:${crisisId}:${sim.turn}:${sim.rngState}`;
  const pre = scene.pre(rngFrom(key));
  const haltAt = haltTime(pre);
  const parts: Parts = {
    ...pre,
    units: [...standingForces(), ...pre.units],
    markers: [...pre.markers, ...launchMarkers(pre.launches), { t: haltAt, kind: "halt", label: { he: "הקבינט נדרש להכרעה מיידית", en: "The cabinet must decide immediately" } }],
    focus: [...pre.focus, { t: Math.max(0, haltAt - 40), focus: scene.focus }],
  };

  if (option !== null) {
    const build = scene.after[option];
    if (build !== undefined) {
      const aft = build(rngFrom(`${key}:${option}:${branch ?? "-"}`), haltAt, branch);
      parts.launches = [...parts.launches, ...aft.launches];
      parts.units = [...parts.units, ...aft.units];
      parts.zones = [...parts.zones, ...aft.zones];
      parts.blasts = [...parts.blasts, ...aft.blasts];
      parts.focus = [...parts.focus, ...aft.focus];
      parts.markers = [...parts.markers, ...aft.markers, ...launchMarkers(aft.launches)];
      for (const r of aft.retire) {
        parts.units = parts.units.map((u) => (u.id === r.id ? { ...u, until: Math.min(u.until, r.t) } : u));
      }
      for (const z of aft.endZones) {
        parts.zones = parts.zones.map((x) => (x.id === z.id ? { ...x, t1: Math.min(x.t1, z.t) } : x));
      }
    }
  }

  return finalize({
    key: option === null ? key : `${key}:${option}:${branch ?? "-"}`,
    title,
    crisisId,
    baseTime: baseTimeFor(sim.turn),
    launches: parts.launches,
    units: parts.units,
    zones: parts.zones,
    blasts: parts.blasts,
    markers: parts.markers,
    focus: parts.focus,
    haltAt: option === null ? haltAt : null,
    minDuration: option === null ? haltAt + 1 : haltAt + 300,
  });
}
