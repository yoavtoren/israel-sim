/** Strategic step functions. Pure: (state, action) → new state; randomness
 *  comes from `state.rngState` so a run replays exactly. */

import {
  CHECKPOINT_DEFS, COALITION_REACTION, COALITION_SUSTAIN, CRISIS_DEFS,
  INITIAL_COALITION_STABILITY, OUTCOME_REASONS, RULES, SETTLEMENT_EFFECTS, THRESHOLDS, TRACK_DEFS,
  type Deltas,
} from "./defs";
import {
  CHECKPOINT_ORDER, METRIC_KEYS,
  type Bi, type CheckpointKey, type CheckpointStatus, type CoalitionType, type CrisisOptionId, type LogEntry,
  type LogTone, type OutcomeKind, type PolicyAction, type SimulationMetrics, type SimulationState,
  type StepOptions, type StrategicFlags, type TriggeredEvent,
} from "./types";

// ---------------------------------------------------------------------------
// initial state
// ---------------------------------------------------------------------------

export const initialMetrics: SimulationMetrics = {
  securityThreat: 65,
  internationalLegitimacy: 45,
  usMilitaryAid: 75,
  economicStability: 60,
  regionalRelations: 40,
  coalitionStability: 50,
  internalCohesion: 45,
};

export const initialCheckpoints: CheckpointStatus = {
  demilitarizationVerified: false,
  terrorFundingHalted: false,
  educationReformImplemented: false,
  localPolicingFunctional: false,
};

const initialFlags: StrategicFlags = {
  saudiNormalization: false,
  gulfFundsReconstruction: false,
  israelPaysForGazaAdministration: false,
  terrorInfrastructureGrowth: false,
  processFrozenTurns: 0,
  usConditionsTurns: 0,
};

export function seedFromString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createInitialState(
  coalition: CoalitionType = "BENNETT_LIEBERMAN_GOLAN_ABBAS",
  seed: string | number = "strategic",
): SimulationState {
  const metrics = { ...initialMetrics, coalitionStability: INITIAL_COALITION_STABILITY[coalition] };
  return {
    metrics,
    coalition,
    checkpoints: { ...initialCheckpoints },
    flags: { ...initialFlags },
    turn: 1,
    maxTurns: 8, // four-year term, one decision per half-year
    activeTrack: null,
    lastAction: null,
    pendingCrisis: null,
    gameOver: false,
    gameOverReason: null,
    outcome: null,
    historyLogs: [
      {
        turn: 1,
        tone: "info",
        text: { he: "תחילת קדנציה: הקבינט התכנס להכרעה על המדיניות האסטרטגית.", en: "Term begins: the cabinet convenes to decide the strategic policy." },
      },
    ],
    turns: [],
    metricsHistory: [{ ...metrics }],
    rngState: seedFromString(String(seed)),
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function updateMetrics(metrics: SimulationMetrics, deltas: Deltas): SimulationMetrics {
  const out = { ...metrics };
  for (const k of METRIC_KEYS) out[k] = clamp(metrics[k] + (deltas[k] ?? 0));
  return out;
}

/** mulberry32: returns [u in [0,1), next state] */
function nextRandom(s: number): [number, number] {
  const next = (s + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Whether a decision includes the "political horizon" (brief rule 3). */
export function hasPoliticalHorizon(a: PolicyAction): boolean {
  return (
    a.track === "CENTER_LEFT_PA_RETURN" ||
    a.track === "RADICAL_LEFT_UNILATERAL_WITHDRAWAL" ||
    a.concedeConstructiveAmbiguity === true
  );
}

/** Brief rule 2: Palestinian (or no) security with the IDF's hands tied. */
export function reliesOnPalestinianSecurityAlone(a: PolicyAction): boolean {
  return (a.gazaCivilianControl === "PALESTINIAN_AUTHORITY" || a.gazaCivilianControl === "NONE") && !a.allowIdfFreedomOfAction;
}

/** Postures are "the same" when the track and (for the trusteeship) the horizon match. */
function postureKey(a: PolicyAction): string {
  return a.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" ? `${a.track}:${a.concedeConstructiveAmbiguity === true}` : a.track;
}

/** Per-turn chance an attack or rearmament freezes the trusteeship process. */
export function rollbackProbability(metrics: SimulationMetrics, checkpoints: CheckpointStatus): number {
  const base = clamp((metrics.securityThreat - 20) / 150, 0.02, 0.5);
  return checkpoints.localPolicingFunctional ? base * 0.5 : base;
}

export function nextCheckpoint(c: CheckpointStatus): CheckpointKey | null {
  return CHECKPOINT_ORDER.find((k) => !c[k]) ?? null;
}

/** Whether the next stage's conditions hold (independent of freezes). */
export function checkpointReady(key: CheckpointKey, c: CheckpointStatus, m: SimulationMetrics, a: PolicyAction): boolean {
  switch (key) {
    case "demilitarizationVerified":
      return a.allowIdfFreedomOfAction;
    case "terrorFundingHalted":
      return c.demilitarizationVerified && hasPoliticalHorizon(a) && m.usMilitaryAid >= 50;
    case "educationReformImplemented":
      return c.terrorFundingHalted && m.regionalRelations >= 60;
    case "localPolicingFunctional":
      return c.educationReformImplemented && m.securityThreat <= 50;
  }
}

class Ledger {
  logs: LogEntry[] = [];
  events: TriggeredEvent[] = [];
  constructor(private turn: number) {}
  log(tone: LogTone, text: Bi): void {
    this.logs.push({ turn: this.turn, tone, text });
  }
  event(e: TriggeredEvent): void {
    if (!this.events.includes(e)) this.events.push(e);
  }
}

function endCheck(m: SimulationMetrics, turn: number, maxTurns: number): OutcomeKind | null {
  if (m.coalitionStability <= THRESHOLDS.coalitionFloor) return "COALITION_COLLAPSE";
  if (m.securityThreat >= THRESHOLDS.securityCeiling) return "SECURITY_COLLAPSE";
  if (m.economicStability <= THRESHOLDS.economyFloor) return "ECONOMIC_COLLAPSE";
  if (m.internalCohesion <= THRESHOLDS.cohesionFloor) return "CIVIL_CRISIS";
  if (turn >= maxTurns) return "TERM_COMPLETED";
  return null;
}

function finish(
  state: SimulationState,
  patch: {
    metrics: SimulationMetrics;
    checkpoints: CheckpointStatus;
    flags: StrategicFlags;
    activeTrack: SimulationState["activeTrack"];
    action: PolicyAction;
    crisisOption: CrisisOptionId | null;
    ledger: Ledger;
    forcedOutcome?: { kind: OutcomeKind; reason: Bi };
  },
): SimulationState {
  const outcome = patch.forcedOutcome?.kind ?? endCheck(patch.metrics, state.turn, state.maxTurns);
  const reason =
    patch.forcedOutcome?.reason ??
    (outcome === null || outcome === "STRATEGIC_COLLAPSE" ? null : OUTCOME_REASONS[outcome]);
  if (outcome !== null && reason !== null) {
    patch.ledger.log(outcome === "TERM_COMPLETED" ? "good" : "bad", reason);
  }
  return {
    ...state,
    metrics: patch.metrics,
    checkpoints: patch.checkpoints,
    flags: patch.flags,
    activeTrack: patch.activeTrack,
    lastAction: patch.action,
    pendingCrisis: null,
    turn: outcome === null ? state.turn + 1 : state.turn,
    gameOver: outcome !== null,
    gameOverReason: reason,
    outcome,
    historyLogs: [...state.historyLogs, ...patch.ledger.logs],
    turns: [
      ...state.turns,
      { turn: state.turn, action: patch.action, crisisOption: patch.crisisOption, events: patch.ledger.events, metricsAfter: { ...patch.metrics } },
    ],
    metricsHistory: [...state.metricsHistory, { ...patch.metrics }],
  };
}

// ---------------------------------------------------------------------------
// the decision step
// ---------------------------------------------------------------------------

export function executePolicyDecision(state: SimulationState, action: PolicyAction, opts: StepOptions = {}): SimulationState {
  if (state.gameOver || state.pendingCrisis !== null) return state;

  const L = new Ledger(state.turn);
  const def = TRACK_DEFS[action.track];
  const coalition = state.coalition;
  const prev = state.lastAction;
  const adopting = prev === null || state.activeTrack === null || postureKey(prev) !== postureKey(action);
  let m = { ...state.metrics };
  let cps = { ...state.checkpoints };
  const flags = { ...state.flags };
  let rng = state.rngState;

  // -- track 1: the directive triggers the Egyptian crisis; resolution happens in resolveCrisis
  if (action.track === "RADICAL_RIGHT_DEPORTATION") {
    L.log("bad", { he: "הקבינט הורה על טרנספר כפוי של אוכלוסיית עזה.", en: "The cabinet ordered the forced transfer of Gaza's population." });
    L.log("bad", { he: "התראות גבול בחזית מצרים — פריצת מלחמה אזורית.", en: "Border alerts on the Egyptian front — regional war breaks out." });
    L.event("REGIONAL_WAR_BREAKOUT");
    return {
      ...state,
      metrics: updateMetrics(state.metrics, def.transition.deltas),
      activeTrack: action.track,
      lastAction: action,
      pendingCrisis: { id: "EGYPTIAN_BALLISTIC_ATTACK", action, metricsBefore: { ...state.metrics } },
      historyLogs: [...state.historyLogs, ...L.logs],
    };
  }

  // -- track 5: absolute sets from the brief; non-left coalitions fall at once
  if (action.track === "RADICAL_LEFT_UNILATERAL_WITHDRAWAL" && adopting) {
    L.log("bad", { he: "נסיגה מלאה וחד-צדדית ללא התניות או פיקוח צבאי במעברי הגבול.", en: "Full unilateral withdrawal with no conditions or military control of the crossings." });
    m.internationalLegitimacy = 100;
    m.securityThreat = Math.max(m.securityThreat, 95);
    m.internalCohesion = clamp(m.internalCohesion - 50);
    L.event("TERROR_INFRASTRUCTURE_GROWTH");
    flags.terrorInfrastructureGrowth = true;
    cps = { ...initialCheckpoints };
    if (coalition !== "CENTER_LEFT_BLOC") {
      L.event("COALITION_CRISIS");
      return finish(state, {
        metrics: m, checkpoints: cps, flags, activeTrack: action.track, action, crisisOption: null, ledger: L,
        forcedOutcome: {
          kind: "COALITION_COLLAPSE",
          reason: {
            he: "הקואליציה התפרקה מיד עקב התנגדות גורפת של מפלגות הימין והמרכז לנסיגה ללא פירוז.",
            en: "The coalition collapsed at once: right and center parties refuse a withdrawal without demilitarization.",
          },
        },
      });
    }
    m = updateMetrics(m, COALITION_REACTION[coalition][action.track].deltas);
  } else if (adopting) {
    // -- tracks 2–4 adopted: transition shock + coalition reaction
    m = updateMetrics(m, def.transition.deltas);
    m = updateMetrics(m, COALITION_REACTION[coalition][action.track].deltas);

    if (action.track === "CONSERVATIVE_RIGHT_ANNEXATION") {
      L.log("warn", { he: "ישראל הטילה ממשל צבאי ישיר על עזה וקידמה הרחבת התנחלויות.", en: "Israel imposed direct military government on Gaza and advanced settlement expansion." });
      if (coalition === "BENNETT_LIEBERMAN_GOLAN_ABBAS") {
        L.event("COALITION_CRISIS");
        L.log("bad", { he: "משבר קואליציוני: רע\"מ ויאיר גולן פורשים במחאה על הממשל הצבאי והסיפוח.", en: "Coalition crisis: Ra'am and Yair Golan quit over military government and annexation." });
      }
    }

    if (action.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP") {
      L.log("info", { he: "נבחר מתווה אזורי מדורג במימון ופיקוח מדינות המפרץ.", en: "A staged regional framework, funded and supervised by the Gulf states, was adopted." });
      if (action.concedeConstructiveAmbiguity === true) {
        L.event("SAUDI_NORMALIZATION_OPENED");
        L.log("good", { he: "הופעלה 'עמימות קונסטרוקטיבית' לגבי אופק מדיני: ערוץ הנורמליזציה עם סעודיה נפתח.", en: "\"Constructive ambiguity\" on a political horizon: the Saudi normalization channel opens." });
        m = updateMetrics(m, { regionalRelations: 30, internationalLegitimacy: 15 });
        if (coalition === "BENNETT_LIEBERMAN_GOLAN_ABBAS") {
          m = updateMetrics(m, { coalitionStability: -20 });
          L.log("warn", { he: "מתח מול בנט וליברמן סביב הגדרת 'אופק מדיני'.", en: "Friction with Bennett and Lieberman over the \"political horizon\" wording." });
        }
      } else {
        L.log("warn", { he: "סירוב להצהרה על אופק מדיני: מדינות המפרץ מעכבות את פריסת הכוחות וישראל מממנת את הניהול.", en: "No political horizon: the Gulf states hold back deployment and Israel pays for administration." });
        m = updateMetrics(m, { regionalRelations: -10, economicStability: RULES.trusteeshipNoHorizonEconomy.value - 15 });
      }
    }

    if (action.track === "CENTER_LEFT_PA_RETURN") {
      L.log("info", { he: "השליטה האזרחית בעזה הועברה לרשות הפלסטינית; הבנייה מחוץ לגושים הוקפאה.", en: "Civil control of Gaza passed to the PA; construction outside the blocs frozen." });
      if (action.allowIdfFreedomOfAction) m = updateMetrics(m, { securityThreat: RULES.paReturnWithIdfThreat.value });
      if (coalition === "BENNETT_LIEBERMAN_GOLAN_ABBAS") {
        L.event("COALITION_CRISIS");
        L.log("bad", { he: "חיכוך פנימי: אגף הימין בממשלה זועם על החזרת הרשות הפלסטינית.", en: "Internal friction: the government's right flank is furious over the PA's return." });
      }
    }
  } else {
    // -- posture sustained
    m = updateMetrics(m, def.sustain.deltas);
    const drift = COALITION_SUSTAIN[coalition][action.track];
    if (drift !== undefined) m = updateMetrics(m, { coalitionStability: drift });
    L.log("info", { he: `המדיניות נמשכת: ${def.label.he}.`, en: `Policy sustained: ${def.label.en}.` });
  }

  // -- settlement policy (applied when it changes)
  if (prev === null || prev.settlementPolicy !== action.settlementPolicy) {
    const eff = SETTLEMENT_EFFECTS[action.settlementPolicy];
    const general = action.track === "RADICAL_LEFT_UNILATERAL_WITHDRAWAL" ? { ...eff.general.deltas, internalCohesion: 0 } : eff.general.deltas;
    m = updateMetrics(m, { ...general, coalitionStability: eff.coalition[coalition] });
    if (coalition === "BENNETT_LIEBERMAN_GOLAN_ABBAS" && eff.coalition[coalition] <= -50) {
      L.event("COALITION_CRISIS");
      L.log(
        "bad",
        action.settlementPolicy === "EXPAND"
          ? { he: "עבאס וגולן מאיימים בפרישה בעקבות אישור בנייה בהתנחלויות.", en: "Abbas and Golan threaten to quit over approved settlement building." }
          : { he: "בנט וליברמן מאיימים בפרישה בעקבות הקפאה/פינוי.", en: "Bennett and Lieberman threaten to quit over the freeze/evacuation." },
      );
    }
  }

  // -- brief rule 2: PA security alone
  if (reliesOnPalestinianSecurityAlone(action)) {
    if (!flags.terrorInfrastructureGrowth) {
      flags.terrorInfrastructureGrowth = true;
      L.event("TERROR_INFRASTRUCTURE_GROWTH");
      L.log("bad", { he: "אזהרה ביטחונית: ללא חופש פעולה לצה\"ל ארגוני הטרור מתחמשים מחדש (לקח אוסלו וההתנתקות).", en: "Security warning: without IDF freedom of action, terror groups rearm (the Oslo and disengagement lesson)." });
      m = updateMetrics(m, { securityThreat: RULES.paSecurityAloneThreat.value });
    } else {
      m = updateMetrics(m, { securityThreat: RULES.terrorGrowthPerTurn.value });
      L.log("warn", { he: "תשתיות הטרור ממשיכות להתעצם.", en: "Terror infrastructure keeps growing." });
    }
  } else if (flags.terrorInfrastructureGrowth) {
    flags.terrorInfrastructureGrowth = false;
    L.log("good", { he: "חופש הפעולה של צה\"ל הושב: צמיחת תשתיות הטרור נבלמה.", en: "IDF freedom of action restored: terror infrastructure growth halted." });
  }

  // -- brief rule 3: political horizon ↔ Saudi normalization / who pays for Gaza
  const horizon = hasPoliticalHorizon(action);
  flags.saudiNormalization = horizon && (action.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" || action.track === "CENTER_LEFT_PA_RETURN");
  flags.gulfFundsReconstruction = horizon && action.gazaCivilianControl === "REGIONAL_COALITION";
  flags.israelPaysForGazaAdministration =
    action.gazaCivilianControl === "MILITARY_GOVERNMENT" || (action.gazaCivilianControl === "REGIONAL_COALITION" && !horizon);
  if (flags.israelPaysForGazaAdministration && !adopting) {
    m = updateMetrics(m, { economicStability: RULES.israelPaysPerTurn.value });
  }

  // -- US conditions after a US-brokered crisis exit
  if (flags.usConditionsTurns > 0) {
    if (action.track === "CONSERVATIVE_RIGHT_ANNEXATION" || action.settlementPolicy === "EXPAND") {
      m = updateMetrics(m, { usMilitaryAid: RULES.usConditionsAidPenalty.value });
      L.log("bad", { he: "וושינגטון מקפיאה משלוחי חימוש: הפרת התנאים להפסקת האש.", en: "Washington freezes munitions shipments: ceasefire conditions breached." });
    }
    flags.usConditionsTurns -= 1;
  }

  // -- checkpoints (trusteeship only)
  if (action.track === "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP") {
    const frozenThisTurn = flags.processFrozenTurns > 0;
    if (frozenThisTurn) {
      flags.processFrozenTurns -= 1;
      L.log("warn", { he: "התהליך המדורג מוקפא: הסמכויות בשליטה ביטחונית מלאה של צה\"ל.", en: "The staged process is frozen: powers held under full IDF security control." });
    } else {
      const next = nextCheckpoint(cps);
      if (next !== null && checkpointReady(next, cps, m, action)) {
        cps[next] = true;
        m = updateMetrics(m, CHECKPOINT_DEFS[next].reward.deltas);
        L.event("CHECKPOINT_PASSED");
        L.log("good", { he: `אומת: ${CHECKPOINT_DEFS[next].label.he}.`, en: `Verified: ${CHECKPOINT_DEFS[next].label.en}.` });
      } else if (next !== null) {
        L.log("info", { he: `${CHECKPOINT_DEFS[next].label.he} ממתין — ${CHECKPOINT_DEFS[next].blocker.he}.`, en: `${CHECKPOINT_DEFS[next].label.en} pending — ${CHECKPOINT_DEFS[next].blocker.en}.` });
      }
    }
    // withdrawal mechanism: an attack or rearmament freezes the process
    if (opts.preview !== true && !frozenThisTurn && cps.demilitarizationVerified) {
      const [u, s] = nextRandom(rng);
      rng = s;
      if (u < rollbackProbability(m, cps)) {
        cps = { ...initialCheckpoints, demilitarizationVerified: action.allowIdfFreedomOfAction };
        flags.processFrozenTurns = RULES.processFreezeTurns;
        m = updateMetrics(m, { securityThreat: 10, internationalLegitimacy: -5, coalitionStability: coalition === "RIGHT_WING_BLOC" ? 0 : -5 });
        L.event("PROCESS_FROZEN");
        L.log("bad", { he: "פיגוע / התחמשות מחודשת אותרו: התהליך הוקפא והסמכויות חזרו לשליטה ביטחונית מלאה של צה\"ל.", en: "Attack / rearmament detected: the process is frozen and powers return to full IDF security control." });
      }
    }
  } else if (CHECKPOINT_ORDER.some((k) => cps[k])) {
    cps = { ...initialCheckpoints };
    L.log("warn", { he: "המתווה האזורי ננטש: כל שלבי האימות אופסו.", en: "Regional framework abandoned: all verification stages reset." });
  }

  return finish(state, { metrics: m, checkpoints: cps, flags, activeTrack: action.track, action, crisisOption: null, ledger: L });
}

// ---------------------------------------------------------------------------
// crisis resolution
// ---------------------------------------------------------------------------

export function resolveCrisis(state: SimulationState, optionId: CrisisOptionId): SimulationState {
  const pending = state.pendingCrisis;
  if (state.gameOver || pending === null) return state;
  const opt = CRISIS_DEFS[pending.id].options[optionId];
  const L = new Ledger(state.turn);
  const flags = { ...state.flags };
  let m = updateMetrics(pending.metricsBefore, opt.deltas);

  L.log(opt.executesTransfer ? "bad" : "warn", { he: `הכרעת הקבינט: ${opt.label.he}.`, en: `Cabinet decision: ${opt.label.en}.` });

  if (opt.executesTransfer) {
    // brief §3 hard rule: MASS_DEPORTATION carried out
    m.usMilitaryAid = 0;
    m.regionalRelations = 0;
    m.internationalLegitimacy = 0;
    m.securityThreat = 100;
    m.economicStability = Math.min(m.economicStability, 10);
    m = updateMetrics(m, COALITION_REACTION[state.coalition].RADICAL_RIGHT_DEPORTATION.deltas);
    L.event("REGIONAL_WAR_BREAKOUT");
    return finish(state, {
      metrics: m, checkpoints: { ...initialCheckpoints }, flags, activeTrack: pending.action.track, action: pending.action,
      crisisOption: optionId, ledger: L, forcedOutcome: { kind: "STRATEGIC_COLLAPSE", reason: opt.outcomeReason },
    });
  }

  L.log("info", opt.outcomeReason);
  if (optionId === "D_US_MEDIATION") {
    flags.usConditionsTurns = RULES.usConditionsTurns;
    L.log("warn", { he: "ארה\"ב מתנה את הסיוע בחזרה לסטטוס קוו ובהימנעות מסיפוח והרחבת התנחלויות.", en: "The US conditions aid on a return to the status quo and no annexation or settlement expansion." });
  }
  return finish(state, {
    metrics: m, checkpoints: { ...initialCheckpoints }, flags, activeTrack: null, action: pending.action, crisisOption: optionId, ledger: L,
  });
}

/** Decision preview: the same step without random draws. */
export function previewPolicyDecision(state: SimulationState, action: PolicyAction): SimulationState {
  return executePolicyDecision(state, action, { preview: true });
}
