/** Strategic layer — half-yearly cabinet decisions on the Gaza / West Bank
 *  question, scored on seven 0–100 metrics. Pure data types; no I/O.
 *  Names follow the design brief (SimulationMetrics, PolicyAction, …). */

export interface Bi {
  he: string;
  en: string;
}

export type CoalitionType =
  | "RIGHT_WING_BLOC" // ממשלת ימין-חרדים מלאה
  | "BENNETT_LIEBERMAN_GOLAN_ABBAS" // ממשלת אחדות מקצוות פוליטיים מנוגדים
  | "CENTER_LEFT_BLOC"; // ממשלת מרכז-שמאל

export interface SimulationMetrics {
  /** 0 = quiet, 100 = existential war (higher is WORSE) */ securityThreat: number;
  /** 0 = isolation & sanctions, 100 = full legitimacy */ internationalLegitimacy: number;
  /** 0 = full arms embargo, 100 = maximal supply & diplomatic umbrella */ usMilitaryAid: number;
  /** 0 = default & inflation, 100 = growth & high rating */ economicStability: number;
  /** 0 = regional war with Egypt/Jordan, 100 = full Saudi normalization */ regionalRelations: number;
  /** 0 = government falls, 100 = fully stable */ coalitionStability: number;
  /** 0 = civil strife / mass refusal, 100 = full cohesion */ internalCohesion: number;
}

export type MetricKey = keyof SimulationMetrics;

export const METRIC_KEYS: MetricKey[] = [
  "securityThreat",
  "internationalLegitimacy",
  "usMilitaryAid",
  "economicStability",
  "regionalRelations",
  "coalitionStability",
  "internalCohesion",
];

/** +1 when a higher value is good, −1 when a higher value is bad. */
export const METRIC_POLARITY: Record<MetricKey, 1 | -1> = {
  securityThreat: -1,
  internationalLegitimacy: 1,
  usMilitaryAid: 1,
  economicStability: 1,
  regionalRelations: 1,
  coalitionStability: 1,
  internalCohesion: 1,
};

export type PolicyTrack =
  | "RADICAL_RIGHT_DEPORTATION" // טרנספר כפוי / שימוש בכוח ללא הבחנה
  | "CONSERVATIVE_RIGHT_ANNEXATION" // ממשל צבאי מלא, סיפוח שטחי C, פירוק הרש"פ
  | "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP" // מודל מדורג: פיקוח סעודי/אמירתי, פירוז, חופש פעולה לצה"ל
  | "CENTER_LEFT_PA_RETURN" // החזרת רש"פ מחודשת, הקפאת בנייה, חתירה ל-2 מדינות
  | "RADICAL_LEFT_UNILATERAL_WITHDRAWAL"; // נסיגה חד-צדדית מיידית לקווי 67 ללא התניות

/** Right → left, the order the cabinet screen lays the tracks out in. */
export const POLICY_TRACKS: PolicyTrack[] = [
  "RADICAL_RIGHT_DEPORTATION",
  "CONSERVATIVE_RIGHT_ANNEXATION",
  "PRAGMATIC_CENTER_REGIONAL_TRUSTEESHIP",
  "CENTER_LEFT_PA_RETURN",
  "RADICAL_LEFT_UNILATERAL_WITHDRAWAL",
];

export type SettlementPolicy = "EXPAND" | "FREEZE_OUTSIDE_BLOCS" | "FULL_FREEZE" | "EVACUATE_ALL";
export type GazaCivilianControl = "MILITARY_GOVERNMENT" | "REGIONAL_COALITION" | "PALESTINIAN_AUTHORITY" | "NONE";

export interface PolicyAction {
  track: PolicyTrack;
  /** willingness to state an ambiguous "political horizon" */ concedeConstructiveAmbiguity?: boolean;
  /** full IDF operational freedom on the ground */ allowIdfFreedomOfAction: boolean;
  settlementPolicy: SettlementPolicy;
  gazaCivilianControl: GazaCivilianControl;
}

export interface CheckpointStatus {
  /** stage 1: tunnels & rockets destroyed, Israeli control of Philadelphi + airspace */ demilitarizationVerified: boolean;
  /** stage 2: PA payments to attackers' families end, international banking oversight */ terrorFundingHalted: boolean;
  /** stage 3: curricula replaced under Saudi/Emirati supervision */ educationReformImplemented: boolean;
  /** stage 4: local forces foil attacks themselves; IDF may still act */ localPolicingFunctional: boolean;
}

export type CheckpointKey = keyof CheckpointStatus;

export const CHECKPOINT_ORDER: CheckpointKey[] = [
  "demilitarizationVerified",
  "terrorFundingHalted",
  "educationReformImplemented",
  "localPolicingFunctional",
];

export type CrisisId = "EGYPTIAN_BALLISTIC_ATTACK";
export type CrisisOptionId = "A_CANCEL_TRANSFER" | "B_AIR_RETALIATION" | "C_GROUND_INVASION_SINAI" | "D_US_MEDIATION";
export const CRISIS_OPTION_IDS: CrisisOptionId[] = [
  "A_CANCEL_TRANSFER",
  "B_AIR_RETALIATION",
  "C_GROUND_INVASION_SINAI",
  "D_US_MEDIATION",
];

export type TriggeredEvent =
  | "REGIONAL_WAR_BREAKOUT"
  | "TERROR_INFRASTRUCTURE_GROWTH"
  | "CHECKPOINT_PASSED"
  | "PROCESS_FROZEN"
  | "COALITION_CRISIS"
  | "SAUDI_NORMALIZATION_OPENED";

export type OutcomeKind =
  | "TERM_COMPLETED"
  | "COALITION_COLLAPSE"
  | "SECURITY_COLLAPSE"
  | "ECONOMIC_COLLAPSE"
  | "CIVIL_CRISIS"
  | "STRATEGIC_COLLAPSE";

export interface StrategicFlags {
  saudiNormalization: boolean;
  gulfFundsReconstruction: boolean;
  israelPaysForGazaAdministration: boolean;
  terrorInfrastructureGrowth: boolean;
  /** turns the trusteeship process stays frozen after an attack / rearmament */ processFrozenTurns: number;
  /** turns of US conditions after a US-brokered crisis exit */ usConditionsTurns: number;
}

export type LogTone = "info" | "good" | "warn" | "bad";

export interface LogEntry {
  turn: number;
  tone: LogTone;
  text: Bi;
}

export interface PendingCrisis {
  id: CrisisId;
  action: PolicyAction;
  /** metrics before the directive — crisis options resolve against these */ metricsBefore: SimulationMetrics;
}

export interface TurnRecord {
  turn: number;
  action: PolicyAction;
  crisisOption: CrisisOptionId | null;
  events: TriggeredEvent[];
  metricsAfter: SimulationMetrics;
}

export interface SimulationState {
  metrics: SimulationMetrics;
  coalition: CoalitionType;
  checkpoints: CheckpointStatus;
  flags: StrategicFlags;
  turn: number;
  maxTurns: number;
  /** posture currently in force (null = status quo) */ activeTrack: PolicyTrack | null;
  lastAction: PolicyAction | null;
  pendingCrisis: PendingCrisis | null;
  gameOver: boolean;
  gameOverReason: Bi | null;
  outcome: OutcomeKind | null;
  historyLogs: LogEntry[];
  turns: TurnRecord[];
  /** metrics at the start and after every resolved turn */ metricsHistory: SimulationMetrics[];
  /** mulberry32 state — the reducer stays pure and replayable */ rngState: number;
}

export interface StepOptions {
  /** skip random draws (attack/rearmament rollback) — for the decision preview */ preview?: boolean;
}
