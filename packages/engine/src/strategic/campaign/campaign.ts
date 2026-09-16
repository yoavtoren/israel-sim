/** Prime Minister campaign reducer. Pure; randomness from `rngState`.
 *
 *  party → coalition → doctrine → [dilemma → consequences]* → ending
 *
 *  Each decision is one quarter. The game ends when the government loses its
 *  majority, when the state collapses (external: war, embargo, economy;
 *  internal: the social rift), or at the end of the four-year term — but never
 *  while a war is still going on: elections are postponed until a ceasefire. */

import { CRISIS_DEFS, type CrisisOptionDef } from "../crisisEngine";
import { computeStances, tierOf, type ActorId, type ActorStance } from "../stances";
import { TRACK_DEFS, type Deltas } from "../defs";
import { clamp, createInitialState, seedFromString, updateMetrics } from "../reducer";
import type { Bi, CrisisId, CrisisOptionId, GambleBranch, MetricKey, SimulationMetrics } from "../types";
import { METRIC_KEYS } from "../types";
import { AUTHORED_DILEMMAS, CEASEFIRE_TALKS, DOCTRINE } from "./dilemmas";
import { CONSEQUENCE_PEACE, FINAL_MILESTONES, MILESTONE_MOMENTUM, OPTION_PEACE, PATH_LABELS, PATH_OF_TRACK, RESOLUTION_DILEMMAS } from "./resolution";
import { DOCTRINE_REACTIONS, MAJORITY, PARTIES, SEATS, checkCoalition, partnerStrain, partyName, type PartyId, type PartyTag, type SeatRoster } from "./parties";
import type {
  CampaignFlags, CampaignState, CampaignView, ConsequenceDef, ConsequenceEvent, DilemmaDef, DilemmaOption,
  Ending, MapFocus, Resolution, Severity,
} from "./types";

// ---------------------------------------------------------------------------
// crisis engine → campaign dilemmas
// ---------------------------------------------------------------------------

const CRISIS_FOCUS: Record<CrisisId, MapFocus> = {
  EGYPTIAN_BALLISTIC_ATTACK: "israel",
  PA_SECURITY_COLLAPSE: "west_bank",
  EGYPT_TREATY_BREACH: "sinai",
  IRAN_COMBINED_BARRAGE: "theater",
  TUNNEL_NETWORK_EXPOSED: "gaza",
};

/** Coalition reactions to crisis options (assumption). */
const CRISIS_PARTNERS: Partial<Record<CrisisOptionId, Partial<Record<PartyTag, number>>>> = {
  A_CANCEL_TRANSFER: { far_right: -60, right: -10 },
  B_AIR_RETALIATION: { far_right: 10, center: -60, left: -80, arab: -80 },
  C_GROUND_INVASION_SINAI: { far_right: 15, right: -10, center: -80, left: -100, arab: -100 },
  D_US_MEDIATION: { far_right: -35, right: -5 },
  PA_DEFENSIVE_SHIELD_2: { far_right: 15, right: 10, left: -30, arab: -50 },
  PA_US_STABILIZATION: { far_right: -40, right: -25, center: 5 },
  PA_RETREAT_TO_BARRIER: { far_right: -30, right: -20 },
  EGT_STOP_AND_MONITORS: { far_right: -40, right: -10, center: 5 },
  EGT_PREEMPTIVE_STRIKE: { far_right: 10, center: -30, left: -50, arab: -40 },
  EGT_US_IMF_PRESSURE: { far_right: -10 },
  IRN_WIDE_RETALIATION: { far_right: 10, center: -5, left: -20, arab: -20 },
  IRN_DEFENSIVE_SURGICAL: { far_right: -15 },
  TUN_FREEZE_FUNDS: { far_right: 5, center: -5 },
  TUN_ULTIMATUM_48H: { far_right: -15 },
  TUN_SPECIAL_FORCES: { far_right: 10, left: -10 },
};

const CRISIS_WEIGHT: Record<CrisisId, (v: CampaignView) => number> = {
  EGYPTIAN_BALLISTIC_ATTACK: () => 0, // only after a transfer order
  PA_SECURITY_COLLAPSE: (v) => (v.flags.paAlone || v.flags.paDismantled ? 1.5 : 0),
  EGYPT_TREATY_BREACH: (v) => (v.flags.gazaOccupied ? 0.9 : v.metrics.regionalRelations <= 15 ? 0.5 : 0),
  IRAN_COMBINED_BARRAGE: (v) => (v.metrics.securityThreat >= 60 ? (v.metrics.securityThreat - 50) / 30 : 0),
  TUNNEL_NETWORK_EXPOSED: (v) => (v.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" && v.step >= 3 ? 0.7 : 0),
};

function crisisOptionToDilemma(id: CrisisId, o: CrisisOptionDef): DilemmaOption {
  const fx = o.effects ?? {};
  const flags: Partial<CampaignFlags> = {};
  if (fx.restoresIdfControl === true) flags.paAlone = false;
  if (fx.abandonsTrack === true) flags.transferOrdered = false;
  return {
    id: o.id,
    label: o.label,
    objective: o.objective,
    pros: o.pros,
    cons: o.cons,
    deltas: o.deltas,
    gamble: o.gamble,
    partners: CRISIS_PARTNERS[o.id],
    flags,
    crisisOption: o.id,
    setTrack: fx.abandonsTrack === true ? null : undefined,
    ending: fx.executesTransfer === true ? { kind: "STATE_COLLAPSE_EXTERNAL", reason: o.result } : undefined,
    consequences: [{
      headline: o.label,
      body: o.result,
      severity: fx.executesTransfer === true ? "critical" : "warn",
      focus: CRISIS_FOCUS[id],
      visual: { kind: "crisis", crisisId: id, option: o.id, branch: null },
    }],
  };
}

function crisisDilemma(id: CrisisId): DilemmaDef {
  const d = CRISIS_DEFS[id];
  return {
    id,
    crisisId: id,
    title: d.title,
    context: d.situation,
    precedent: d.precedent,
    focus: CRISIS_FOCUS[id],
    visual: { kind: "crisis", crisisId: id, option: null, branch: null },
    options: d.options.map((o) => crisisOptionToDilemma(id, o)),
    weight: CRISIS_WEIGHT[id],
    cooldown: Math.max(3, d.cooldownTurns + 1),
  };
}

export const DILEMMAS: Record<string, DilemmaDef> = Object.fromEntries(
  [...AUTHORED_DILEMMAS, CEASEFIRE_TALKS, ...RESOLUTION_DILEMMAS, ...(Object.keys(CRISIS_DEFS) as CrisisId[]).map(crisisDilemma)].map((d) => [d.id, d]),
);

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

const NO_FLAGS: CampaignFlags = {
  gazaOccupied: false, gazaSiege: false, emigrationProgram: false, transferOrdered: false, indiscriminateBombing: false,
  nuclearUsed: false, annexationLaw: false, paDismantled: false, paAlone: false, trusteeshipTalks: false, saudiDeal: false,
  settlementFreeze: false, withdrawal: false, unForce: false, euSanctions: false, iccWarrants: false, usArmsHold: false,
  lebanonWar: false, redSeaBlockade: false, massProtests: false, reservistRefusal: false, emergencyRule: false, downgraded: false,
};

export const TERM_STEPS = 16;

export function createCampaign(seed: string, roster: SeatRoster = "polls"): CampaignState {
  return {
    phase: "party",
    seed,
    rngState: seedFromString(`campaign:${seed}`),
    roster,
    party: null,
    coalition: [],
    patience: {},
    departed: [],
    sim: createInitialState("BENNETT_LIEBERMAN_GOLAN_ABBAS", seed),
    step: 0,
    maxSteps: TERM_STEPS,
    flags: { ...NO_FLAGS },
    resolution: { progress: 0, path: null, milestones: [] },
    stanceShift: {},
    current: null,
    forced: [],
    lastSeen: {},
    queue: [],
    lastConsequences: [],
    log: [],
    choices: [],
    ending: null,
  };
}

/** Switch between the 2022 election and current polls (before a party is picked). */
export function setRoster(state: CampaignState, roster: SeatRoster): CampaignState {
  if (state.phase !== "party" || state.roster === roster) return state;
  return { ...state, roster };
}

export function chooseParty(state: CampaignState, party: PartyId): CampaignState {
  if (state.phase !== "party" || SEATS[state.roster][party] === 0) return state;
  return { ...state, party, coalition: [party], phase: "coalition" };
}

export function formGovernment(state: CampaignState, members: PartyId[]): CampaignState {
  if (state.phase !== "coalition" || state.party === null) return state;
  const set = [...new Set([state.party, ...members])];
  const check = checkCoalition(set, state.roster);
  if (!check.valid) return state;
  const sim = createInitialState(check.type, state.seed);
  const patience: Partial<Record<PartyId, number>> = {};
  for (const p of set) {
    if (p === state.party) continue;
    // a partner that just signed the coalition deal starts fairly patient; friction wears it down
    patience[p] = clamp(Math.round(45 + check.stability * 0.45 - partnerStrain(p, set, state.roster) * 6));
  }
  const next: CampaignState = {
    ...state,
    coalition: set,
    patience,
    sim,
    phase: "policy",
    current: DOCTRINE.id,
    log: [{
      step: 0, severity: "good",
      text: {
        he: `הממשלה הושבעה: ${set.map((p) => partyName(p, state.roster).he).join(", ")} (${check.seats} מנדטים).`,
        en: `Government sworn in: ${set.map((p) => partyName(p, state.roster).en).join(", ")} (${check.seats} seats).`,
      },
    }],
  };
  return syncCoalitionMetric(next);
}

// ---------------------------------------------------------------------------
// derived
// ---------------------------------------------------------------------------

export function coalitionSeats(state: CampaignState): number {
  return state.coalition.reduce((s, p) => s + SEATS[state.roster][p], 0);
}

export function campaignView(state: CampaignState): CampaignView {
  return {
    step: state.step,
    metrics: state.sim.metrics,
    flags: state.flags,
    track: state.sim.activeTrack,
    coalitionTags: state.coalition.map((p) => PARTIES[p].tag),
    resolution: state.resolution,
  };
}

/** Security threat at or above which Israel counts as being at war (baseline is 65). */
export const WAR_THREAT = 70;

export function warOngoing(state: Pick<CampaignState, "flags" | "sim">): boolean {
  return state.flags.lebanonWar || state.flags.transferOrdered || state.sim.metrics.securityThreat >= WAR_THREAT;
}

export function campaignStances(state: CampaignState): Record<ActorId, ActorStance> {
  const base = computeStances(state.sim);
  const out = {} as Record<ActorId, ActorStance>;
  for (const id of Object.keys(base) as ActorId[]) {
    const shift = state.stanceShift[id] ?? 0;
    if (shift === 0) {
      out[id] = base[id];
      continue;
    }
    const score = Math.max(-100, Math.min(100, base[id].score + shift));
    out[id] = {
      ...base[id],
      score,
      tier: tierOf(score),
      drivers: [...base[id].drivers, { label: { he: "אירועי הקדנציה", en: "Events this term" }, delta: shift }],
    };
  }
  return out;
}

/** Calendar label for a step (quarter). Term starts Q1 2027. */
export function stepDate(step: number): Bi {
  const year = 2027 + Math.floor(step / 4);
  const q = (step % 4) + 1;
  const monthsHe = ["ינואר", "אפריל", "יולי", "אוקטובר"];
  const monthsEn = ["January", "April", "July", "October"];
  return { he: `${monthsHe[q - 1]} ${year}`, en: `${monthsEn[q - 1]} ${year}` };
}

function syncCoalitionMetric(state: CampaignState): CampaignState {
  const partners = state.coalition.filter((p) => p !== state.party);
  const seats = partners.reduce((s, p) => s + SEATS[state.roster][p], 0);
  const margin = coalitionSeats(state) - (MAJORITY - 1);
  const avg = seats === 0 ? 70 : partners.reduce((s, p) => s + (state.patience[p] ?? 50) * SEATS[state.roster][p], 0) / seats;
  const value = clamp(Math.round(avg * 0.8 + Math.min(10, margin) * 2));
  return { ...state, sim: { ...state.sim, metrics: { ...state.sim.metrics, coalitionStability: value } } };
}

// ---------------------------------------------------------------------------
// the decision step
// ---------------------------------------------------------------------------

function nextRandom(s: number): [number, number] {
  const next = (s + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

interface Work {
  s: CampaignState;
  rng: number;
  events: ConsequenceEvent[];
  preview: boolean;
}

function draw(w: Work): number {
  const [u, n] = nextRandom(w.rng);
  w.rng = n;
  return u;
}

function applyDeltas(w: Work, d: Deltas | undefined): Deltas {
  if (d === undefined) return {};
  const applied: Deltas = {};
  const before = w.s.sim.metrics;
  const coalitionDelta = d.coalitionStability ?? 0;
  const { coalitionStability: _c, ...rest } = d;
  void _c;
  const after = updateMetrics(before, rest);
  for (const k of METRIC_KEYS) if (after[k] !== before[k]) applied[k] = after[k] - before[k];
  w.s = { ...w.s, sim: { ...w.s.sim, metrics: after } };
  if (coalitionDelta !== 0) {
    applyPartners(w, { far_right: coalitionDelta, right: coalitionDelta, haredi: coalitionDelta, center: coalitionDelta, left: coalitionDelta, arab: coalitionDelta });
    applied.coalitionStability = coalitionDelta;
  }
  return applied;
}

function applyPartners(w: Work, p: Partial<Record<PartyTag, number>> | undefined): void {
  if (p === undefined) return;
  const patience = { ...w.s.patience };
  for (const id of w.s.coalition) {
    if (id === w.s.party) continue;
    const d = p[PARTIES[id].tag];
    if (d !== undefined) patience[id] = Math.max(-50, Math.min(100, (patience[id] ?? 50) + d));
  }
  w.s = { ...w.s, patience };
}

function applyStance(w: Work, st: Partial<Record<ActorId, number>> | undefined): void {
  if (st === undefined) return;
  const shift = { ...w.s.stanceShift };
  for (const [k, v] of Object.entries(st) as Array<[ActorId, number]>) shift[k] = Math.max(-150, Math.min(150, (shift[k] ?? 0) + v));
  w.s = { ...w.s, stanceShift: shift };
}

function applyFlags(w: Work, f: Partial<CampaignFlags> | undefined): void {
  if (f === undefined) return;
  w.s = { ...w.s, flags: { ...w.s.flags, ...f } };
}

function pushEvent(w: Work, e: Omit<ConsequenceEvent, "id" | "step">): void {
  w.events.push({ ...e, id: `${w.s.step}-${w.events.length}`, step: w.s.step });
}

function applyConsequence(w: Work, c: ConsequenceDef): void {
  if (c.p !== undefined && c.p < 1) {
    if (w.preview) return;
    if (draw(w) >= c.p) return;
  }
  const before = { ...w.s.sim.metrics };
  applyDeltas(w, c.deltas);
  applyStance(w, c.stance);
  applyPartners(w, c.partners);
  applyFlags(w, c.flags);
  const peace = applyPeace(w, c.peace ?? CONSEQUENCE_PEACE[c.headline.en] ?? 0);
  if (c.next !== undefined && !w.s.forced.includes(c.next)) w.s = { ...w.s, forced: [...w.s.forced, c.next] };
  pushEvent(w, {
    headline: c.headline, body: c.body, severity: c.severity, focus: c.focus, visual: c.visual ?? null,
    deltas: diff(before, w.s.sim.metrics), stance: c.stance ?? {}, quits: [], threats: [], peace: peace === 0 ? undefined : peace,
  });
}

function diff(a: SimulationMetrics, b: SimulationMetrics): Deltas {
  const out: Deltas = {};
  for (const k of METRIC_KEYS) if (a[k] !== b[k]) out[k] = b[k] - a[k];
  return out;
}

/** Partners at ≤ 0 patience leave; newly ≤ 25 threaten. */
function settleCoalition(w: Work, before: Partial<Record<PartyId, number>>): void {
  const quits: PartyId[] = [];
  const threats: PartyId[] = [];
  for (const id of w.s.coalition) {
    if (id === w.s.party) continue;
    const now = w.s.patience[id] ?? 50;
    const was = before[id] ?? 50;
    if (now <= 0) quits.push(id);
    else if (now <= 25 && was > 25) threats.push(id);
  }
  if (quits.length > 0) {
    const patience = { ...w.s.patience };
    for (const q of quits) delete patience[q];
    w.s = { ...w.s, coalition: w.s.coalition.filter((p) => !quits.includes(p)), departed: [...w.s.departed, ...quits], patience };
    const seats = coalitionSeats(w.s);
    pushEvent(w, {
      headline: {
        he: `${quits.map((q) => partyName(q, w.s.roster).he).join(" ו")} ${quits.length > 1 ? "פורשות" : "פורשת"} מהקואליציה`,
        en: `${quits.map((q) => partyName(q, w.s.roster).en).join(" and ")} ${quits.length > 1 ? "quit" : "quits"} the coalition`,
      },
      body: {
        he: `לקואליציה נותרו ${seats} מנדטים${seats < MAJORITY ? " — אין רוב בכנסת." : "."}`,
        en: `The coalition is left with ${seats} seats${seats < MAJORITY ? " — no Knesset majority." : "."}`,
      },
      severity: seats < MAJORITY ? "critical" : "bad",
      focus: "israel", visual: null, deltas: {}, stance: {}, quits, threats: [],
    });
  }
  if (threats.length > 0) {
    pushEvent(w, {
      headline: {
        he: `${threats.map((q) => partyName(q, w.s.roster).he).join(" ו")} מאיימת לפרוש`,
        en: `${threats.map((q) => partyName(q, w.s.roster).en).join(" and ")} threatens to quit`,
      },
      body: { he: "עוד צעד בכיוון הזה — והם בחוץ.", en: "One more step in this direction and they are out." },
      severity: "warn", focus: "israel", visual: null, deltas: {}, stance: {}, quits: [], threats,
    });
  }
  w.s = syncCoalitionMetric(w.s);
}

function endingFor(s: CampaignState): Ending | null {
  const m = s.sim.metrics;
  if (coalitionSeats(s) < MAJORITY) {
    return {
      kind: "GOVERNMENT_FELL",
      headline: { he: "הממשלה התפרקה", en: "The government has fallen" },
      reason: {
        he: `הקואליציה איבדה את הרוב בכנסת (${coalitionSeats(s)} מנדטים). ישראל הולכת לבחירות.`,
        en: `The coalition lost its Knesset majority (${coalitionSeats(s)} seats). Israel heads to elections.`,
      },
    };
  }
  if (m.internalCohesion <= 10) {
    return {
      kind: "STATE_COLLAPSE_INTERNAL",
      headline: { he: "קריסה מבפנים: השסע קרע את החברה", en: "Collapse from within: the rift tore society apart" },
      reason: { he: "סרבנות המונית, עימותים אלימים בין מחנות ושיתוק מוסדות המדינה. הממשלה אינה מסוגלת למשול.", en: "Mass refusal, violent clashes between camps and paralysed state institutions. The government cannot govern." },
    };
  }
  if (m.securityThreat >= 95) {
    return {
      kind: "STATE_COLLAPSE_EXTERNAL",
      headline: { he: "קריסה ביטחונית: מלחמה רב-זירתית", en: "Security collapse: multi-front war" },
      reason: { he: "החזיתות נפתחו במקביל ומערכי ההגנה קרסו. העורף אינו מתפקד.", en: "Fronts opened at once and the defensive systems collapsed. The home front no longer functions." },
    };
  }
  if (m.usMilitaryAid <= 5 && m.securityThreat >= 75) {
    return {
      kind: "STATE_COLLAPSE_EXTERNAL",
      headline: { he: "המיירטים נגמרו", en: "The interceptors ran out" },
      reason: { he: "ללא אספקה אמריקאית ותחת מתקפה מתמשכת, מלאי המיירטים והתחמושת התרוקן.", en: "With no US supply and under sustained attack, interceptor and munitions stocks ran dry." },
    };
  }
  if (m.economicStability <= 10) {
    return {
      kind: "STATE_COLLAPSE_EXTERNAL",
      headline: { he: "קריסה כלכלית", en: "Economic collapse" },
      reason: { he: "סנקציות, בריחת הון ועלויות מלחמה הביאו את המשק לחדלות פירעון בפועל.", en: "Sanctions, capital flight and war costs pushed the economy into de facto default." },
    };
  }
  if (m.internationalLegitimacy <= 0 && m.regionalRelations <= 5 && m.usMilitaryAid <= 20) {
    return {
      kind: "STATE_COLLAPSE_EXTERNAL",
      headline: { he: "בידוד מוחלט", en: "Total isolation" },
      reason: { he: "ישראל מנותקת מסחר, מתעופה ומהמוסדות הבינלאומיים.", en: "Israel is cut off from trade, aviation and international institutions." },
    };
  }
  if (s.step >= s.maxSteps && !warOngoing(s)) {
    const p = s.resolution.progress;
    const headline: Bi = p >= 70
      ? { he: "הקדנציה הסתיימה — קרוב מאוד להסדר", en: "The term is over — very close to a settlement" }
      : p >= 40
        ? { he: "הקדנציה הסתיימה — התקדמות חלקית", en: "The term is over — partial progress" }
        : { he: "הקדנציה הסתיימה — הסכסוך נמשך", en: "The term is over — the conflict goes on" };
    return {
      kind: "TERM_COMPLETED",
      headline,
      reason: {
        he: `שרדת ארבע שנים, אבל המטרה לא הושגה: ההתקדמות להסדר עומדת על ${p}%. ישראל הולכת לבחירות והממשלה הבאה תירש את הסכסוך.`,
        en: `You lasted four years, but the goal was not reached: progress toward a settlement stands at ${p}%. Israel heads to elections and the next government inherits the conflict.`,
      },
    };
  }
  return null;
}

function pickNext(w: Work): string {
  const s = w.s;
  if (s.forced.length > 0) {
    const [head, ...rest] = s.forced;
    w.s = { ...s, forced: rest };
    return head;
  }
  const v = campaignView(s);
  const candidates: Array<{ id: string; weight: number }> = [];
  for (const d of Object.values(DILEMMAS)) {
    if (d.weight === undefined) continue;
    const last = s.lastSeen[d.id];
    if (last !== undefined && (d.once === true || s.step - last < (d.cooldown ?? 3))) continue;
    if (d.id === s.current) continue;
    const weight = d.weight(v);
    if (weight > 0) candidates.push({ id: d.id, weight });
  }
  if (candidates.length === 0) return "SP_TEMPLE_MOUNT";
  const total = candidates.reduce((a, c) => a + c.weight, 0);
  let u = draw(w) * total;
  for (const c of candidates) {
    u -= c.weight;
    if (u <= 0) return c.id;
  }
  return candidates[candidates.length - 1].id;
}

export interface ChooseOptions {
  /** force a gamble outcome instead of drawing it */ branch?: GambleBranch;
  /** skip random consequences and the next-dilemma draw (UI preview) */ preview?: boolean;
}

export function currentDilemma(state: CampaignState): DilemmaDef | null {
  return state.current === null ? null : DILEMMAS[state.current] ?? null;
}

export function choose(state: CampaignState, optionId: string, opts: ChooseOptions = {}): CampaignState {
  if ((state.phase !== "dilemma" && state.phase !== "policy") || state.current === null) return state;
  const def = DILEMMAS[state.current];
  const opt = def?.options.find((o) => o.id === optionId);
  if (def === undefined || opt === undefined) return state;

  const w: Work = { s: state, rng: state.rngState, events: [], preview: opts.preview === true };
  const patienceBefore = { ...state.patience };
  const wasAtWar = warOngoing(state);

  let branch: GambleBranch | null = null;
  if (opt.gamble !== undefined) branch = opts.branch ?? (w.preview ? "success" : draw(w) < optionOdds(state, opt) ? "success" : "failure");

  // 1. the choice itself
  const deltas: Deltas = { ...opt.deltas };
  if (opt.gamble !== undefined && branch !== null) {
    for (const [k, v] of Object.entries(opt.gamble[branch].deltas) as Array<[MetricKey, number]>) deltas[k] = (deltas[k] ?? 0) + v;
  }
  applyDeltas(w, deltas);
  applyStance(w, opt.stance);
  applyFlags(w, opt.flags);
  if (def.id === DOCTRINE.id && opt.setTrack !== undefined && opt.setTrack !== null) {
    applyPartners(w, DOCTRINE_REACTIONS[opt.setTrack]);
  } else {
    applyPartners(w, opt.partners);
  }
  if (opt.setTrack !== undefined) {
    w.s = { ...w.s, sim: { ...w.s.sim, activeTrack: opt.setTrack }, resolution: { ...w.s.resolution, path: opt.setTrack === null ? null : PATH_OF_TRACK[opt.setTrack] } };
  }
  const optionPeace = applyPeace(w, opt.peaceGamble !== undefined && branch !== null ? opt.peaceGamble[branch] : opt.peace ?? OPTION_PEACE[opt.id] ?? 0);
  const reached = opt.milestone !== undefined && (opt.gamble === undefined || branch === "success") && !w.s.resolution.milestones.includes(opt.milestone) ? opt.milestone : null;
  if (reached !== null) {
    w.s = { ...w.s, resolution: { ...w.s.resolution, milestones: [...w.s.resolution.milestones, reached] } };
    applyPartners(w, MILESTONE_MOMENTUM);
  }
  if (opt.crisisOption !== undefined) {
    const track = w.s.sim.activeTrack ?? "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP";
    w.s = {
      ...w.s,
      sim: {
        ...w.s.sim,
        turns: [...w.s.sim.turns, {
          turn: w.s.step + 1, action: { track, ...TRACK_DEFS[track].defaults }, crisisId: def.crisisId ?? null,
          crisisOption: opt.crisisOption, crisisBranch: branch, events: [], metricsAfter: { ...w.s.sim.metrics },
        }],
      },
    };
  }
  if (opt.gamble !== undefined && branch !== null) {
    pushEvent(w, {
      headline: opt.gamble[branch].label, body: opt.label, severity: branch === "success" ? "good" : "bad",
      focus: def.focus, visual: null, deltas: {}, stance: {}, quits: [], threats: [], peace: optionPeace,
    });
  } else if (reached !== null && def.milestone !== undefined) {
    pushEvent(w, {
      headline: { he: `אבן דרך בדרך להסדר: ${def.title.he}`, en: `A milestone toward a settlement: ${def.title.en}` },
      body: opt.label, severity: "good", focus: def.focus, visual: null, deltas: {}, stance: {}, quits: [], threats: [], peace: optionPeace,
    });
  }
  if (opt.next !== undefined) w.s = { ...w.s, forced: [opt.next, ...w.s.forced] };

  // 2. consequences
  for (const c of opt.consequences ?? []) applyConsequence(w, c);

  // 3. the quarter passes: the doctrine's steady drift
  if (def.id !== DOCTRINE.id && w.s.sim.activeTrack !== null) {
    const sustain = TRACK_DEFS[w.s.sim.activeTrack].sustain.deltas;
    const half: Deltas = {};
    for (const [k, v] of Object.entries(sustain) as Array<[MetricKey, number]>) half[k] = Math.round(v / 2);
    applyDeltas(w, half);
  }
  if (w.s.flags.lebanonWar && w.s.sim.metrics.securityThreat <= 45) applyFlags(w, { lebanonWar: false });

  // 4. coalition
  settleCoalition(w, patienceBefore);

  // 5. war status
  const atWar = warOngoing(w.s);
  if (atWar && !wasAtWar) {
    pushEvent(w, { headline: { he: "ישראל במלחמה", en: "Israel is at war" }, body: { he: "כל עוד המלחמה נמשכת — הקדנציה לא תסתיים בבחירות.", en: "While the war goes on, the term will not end in elections." }, severity: "bad", focus: "israel", visual: null, deltas: {}, stance: {}, quits: [], threats: [] });
  } else if (!atWar && wasAtWar) {
    pushEvent(w, { headline: { he: "הלחימה שככה", en: "The fighting has subsided" }, body: { he: "רמת האיום ירדה והחזיתות נרגעו.", en: "The threat level fell and the fronts calmed." }, severity: "good", focus: "israel", visual: null, deltas: {}, stance: {}, quits: [], threats: [] });
  }

  // 6. the clock
  const step = w.s.step + 1;
  w.s = {
    ...w.s,
    step,
    lastSeen: { ...w.s.lastSeen, [def.id]: w.s.step },
    choices: [...w.s.choices, { step: w.s.step, dilemma: def.id, option: opt.id, branch }],
    sim: { ...w.s.sim, turn: step + 1, metricsHistory: [...w.s.sim.metricsHistory, { ...w.s.sim.metrics }] },
  };
  if (step === w.s.maxSteps && atWar) {
    pushEvent(w, { headline: { he: "הבחירות נדחות: המלחמה נמשכת", en: "Elections postponed: the war goes on" }, body: { he: "הקדנציה תסתיים רק אחרי הפסקת אש — או קריסה.", en: "The term ends only after a ceasefire — or a collapse." }, severity: "warn", focus: "israel", visual: null, deltas: {}, stance: {}, quits: [], threats: [] });
    if (!w.s.forced.includes(CEASEFIRE_TALKS.id)) w.s = { ...w.s, forced: [CEASEFIRE_TALKS.id, ...w.s.forced] };
  }

  // 7. ending
  let ending: Ending | null = null;
  if (opt.ending !== undefined) {
    ending = { kind: opt.ending.kind, reason: opt.ending.reason, headline: opt.ending.headline ?? opt.label };
  } else if (reached !== null && FINAL_MILESTONES.has(reached)) {
    w.s = { ...w.s, resolution: { ...w.s.resolution, progress: 100 } };
    ending = resolvedEnding(w.s.resolution);
  } else {
    ending = endingFor(w.s);
  }
  if (ending !== null) {
    pushEvent(w, { headline: ending.headline, body: ending.reason, severity: ending.kind === "CONFLICT_RESOLVED" ? "good" : ending.kind === "TERM_COMPLETED" ? "warn" : "critical", focus: ending.kind === "STATE_COLLAPSE_INTERNAL" || ending.kind === "GOVERNMENT_FELL" ? "israel" : "world", visual: null, deltas: {}, stance: {}, quits: [], threats: [] });
  }

  // 8. what comes next
  const log = [
    ...w.s.log,
    { step: state.step, severity: "info" as Severity, text: { he: `${def.title.he} — ${opt.label.he}`, en: `${def.title.en} — ${opt.label.en}` } },
    ...w.events.map((e) => ({ step: state.step, severity: e.severity, text: e.headline })),
  ];
  const next = ending === null && !w.preview ? pickNext(w) : null;
  const phase = w.events.length > 0 ? "consequences" : ending !== null ? "ended" : "dilemma";
  return {
    ...w.s,
    rngState: w.preview ? state.rngState : w.rng,
    current: next,
    queue: w.events,
    lastConsequences: w.events,
    log,
    ending,
    phase,
  };
}

/** Dismiss the consequence popup on top. */
export function acknowledge(state: CampaignState): CampaignState {
  if (state.phase !== "consequences") return state;
  const queue = state.queue.slice(1);
  if (queue.length > 0) return { ...state, queue };
  return { ...state, queue, phase: state.ending !== null ? "ended" : "dilemma" };
}

/** What an option does before any random consequence (for the decision panel). */
export function previewOption(state: CampaignState, optionId: string, branch?: GambleBranch): CampaignState {
  return choose(state, optionId, { preview: true, branch });
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

/** Success odds of a gamble option in the current situation. */
export function optionOdds(state: CampaignState, opt: DilemmaOption): number {
  if (opt.gamble === undefined) return 1;
  return opt.odds !== undefined ? opt.odds(campaignView(state)) : opt.gamble.p;
}

/** Progress an option would add, by outcome (for the decision panel). */
export function optionPeace(opt: DilemmaOption): { success: number; failure: number } {
  if (opt.peaceGamble !== undefined) return opt.peaceGamble;
  const v = opt.peace ?? OPTION_PEACE[opt.id] ?? 0;
  return { success: v, failure: v };
}

function applyPeace(w: Work, delta: number): number {
  if (delta === 0) return 0;
  const r = w.s.resolution;
  // a doctrine with no path can lose ground but not gain it
  const d = r.path === null && delta > 0 ? 0 : delta;
  const progress = clamp(r.progress + d);
  w.s = { ...w.s, resolution: { ...r, progress } };
  return progress - r.progress;
}

function resolvedEnding(r: Resolution): Ending {
  const path = r.path === null ? null : PATH_LABELS[r.path];
  return {
    kind: "CONFLICT_RESOLVED",
    headline: { he: "הסכסוך הישראלי-פלסטיני הסתיים", en: "The Israeli–Palestinian conflict has ended" },
    reason: {
      he: `הסדר שמסיים את הסכסוך ואת התביעות אושר ומוכר בעולם${path === null ? "" : ` (${path.he})`}. זו המטרה שלשמה הוקמה הממשלה.`,
      en: `An arrangement ending the conflict and its claims was ratified and is recognized internationally${path === null ? "" : ` (${path.en})`}. This is what the government set out to do.`,
    },
  };
}
